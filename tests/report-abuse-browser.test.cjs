// Isolated fixtures exercise report styling; no Roblox report is sent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const { waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{margin:0;background:#24262b;color:#f4f4f5;font:16px/1.5 Arial}body.light-theme{background:#f4f4f4;color:#202227}
    main{padding-top:60px}#content{width:970px;margin:24px auto;padding:12px;background:#24262b}
    #report-abuse-web-app{background:#24262b}.light-theme #report-abuse-web-app{background:#f4f4f4}
    .rc-background-media{background:radial-gradient(ellipse at 20% 15%,#7197bb 0,transparent 45%),radial-gradient(ellipse at 90% 60%,#6c8879 0,transparent 50%),#544f68}
    h1{font-size:32px}p{margin:0 0 20px}a{color:inherit}form{width:480px}.form-group{margin-bottom:12px}label{display:block;margin-bottom:8px}
    input,select,textarea,button{font:inherit;color:inherit}select,textarea{background:#353740;border:1px solid #666;border-radius:4px}textarea{display:block;width:480px;height:100px}
    .light-theme select,.light-theme textarea{background:#fff}button{cursor:pointer;border:1px solid #777}
    .btn-primary-md{background:#335fff;color:#fff}.btn-primary-md:disabled{background:#555;opacity:.35;cursor:not-allowed}.btn-control-md{background:transparent}
    .actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}.text-error{color:#ef7676}.choices label{display:inline-flex;align-items:center;gap:6px;margin:0 12px 0 0;font-size:14px}
    .input-dropdown{position:relative}.dropdown-menu{position:absolute;top:100%;left:0;display:none;list-style:none;margin:0;padding:0;background:#24262b;z-index:1000;width:100%}.open>.dropdown-menu{display:block}.dropdown-menu button{width:100%;padding:12px;background:transparent;border:0;text-align:left}
  </style>
  <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/settings/settings.css"><link rel="stylesheet" href="/src/shared/site-pages.css"><link rel="stylesheet" href="/src/pages/reporting/report-abuse.css">
  <script>localStorage.setItem('roblox-customizer-visuals-v1',JSON.stringify({version:1,backgroundActive:false,glassBlur:24,glassOpacity:78}));</script><script src="/src/shared/startup.js"></script>
  </head><body class="dark-theme"><div id="rc-background-layer"><div class="rc-background-media"></div></div><main id="container-main"><div id="content">
    <div id="report-abuse-web-app"><div class="section-content">
      <div class="container-header"><h1>Report Abuse</h1></div>
      <p>Tell us about content that violates the <a href="#standards">Roblox Community Standards</a>.</p>
      <form id="native-report" action="/report-abuse/" method="post">
        <input type="hidden" name="targetId" value="118155665728354"><input type="hidden" name="submitterId" value="2950704295"><input type="hidden" name="custom" value='{&quot;stringId&quot;:&quot;9082895193&quot;}'>
        <div class="form-group"><label for="reason">Reason</label><select id="reason" name="reason" required><option value="">Select a reason</option><option value="other">Other</option></select></div>
        <div class="form-group"><label for="description">Description</label><textarea id="description" name="description" class="input-field" required maxlength="1000" placeholder="Describe what happened"></textarea><p id="error" class="text-error" role="alert" hidden>Please describe the issue.</p></div>
        <div class="choices"><label><input id="context" name="context" type="checkbox"> Include context</label><label><input id="experience" name="scope" type="radio" value="experience" checked> Experience</label></div>
        <div id="inactive" class="form-group" hidden><label>Hidden native field<input disabled></label></div>
        <div class="actions"><button id="submit" type="submit" class="btn-primary-md" disabled>Submit report</button><button id="cancel" type="button" class="btn-control-md">Cancel</button></div>
      </form>
    </div></div>
  </div></main><script>
    window.submissions=0;window.cancellations=0;
    const form=document.querySelector('#native-report');
    form.addEventListener('input',()=>{document.querySelector('#submit').disabled=!form.checkValidity()});
    form.addEventListener('change',()=>{document.querySelector('#submit').disabled=!form.checkValidity()});
    form.addEventListener('submit',event=>{event.preventDefault();window.submissions++;window.payload=Object.fromEntries(new FormData(form))});
    document.querySelector('#cancel').onclick=()=>{window.cancellations++};
  </script></body></html>`;
}

class Browser {
  constructor(url) {
    this.socket = new WebSocket(url); this.pending = new Map(); this.next = 1; this.errors = [];
    this.ready = new Promise((resolve,reject)=>{this.socket.addEventListener('open',resolve);this.socket.addEventListener('error',reject,{once:true})});
    this.socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=this.pending.get(message.id);this.pending.delete(message.id);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails.text)});
  }
  async send(method,params={}) {
    await this.ready; const id=this.next++;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}))});
  }
  async evaluate(expression) {
    const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  }
  async click(selector) {
    const point=await this.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});node.scrollIntoView({block:'center'});const rect=node.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}})()`);
    await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }
  async waitFor(expression) {
    for(let i=0;i<100;i++){if(await this.evaluate(expression))return;await pause(30)}
    assert.fail(`Timed out: ${expression}`);
  }
}

test('Report form fits both themes and mobile widths while preserving native controls and report data', {skip:!process.env.CHROME_BIN,timeout:30000}, async t => {
  const profile=fs.mkdtempSync(path.join(workspace,'.tmp-report-abuse-browser-'));
  const server=http.createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');
    const file=new URL(request.url,'http://localhost').pathname.slice(1);
    if(['src/shared/theme.css','src/settings/settings.css','src/shared/site-pages.css','src/pages/reporting/report-abuse.css','src/shared/startup.js'].includes(file)){
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)));
    }else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixture())}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const child=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let browser;
  t.after(async()=>{
    if(browser){await Promise.race([browser.send('Browser.close').catch(()=>{}),pause(1000)]);browser.socket.close()}
    if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(1000)]);
    if(child.exitCode===null)child.kill();
    await new Promise(resolve=>server.close(resolve));await pause(300);
    assert.equal(path.dirname(path.resolve(profile)),workspace);
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  });
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await pause(50);
  assert.ok(fs.existsSync(portFile),'Isolated Chrome should start');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab=>tab.type==='page');
  browser=new Browser(target.webSocketDebuggerUrl);await browser.send('Page.enable');await browser.send('Runtime.enable');
  const query='?targetId=118155665728354&submitterId=2950704295&abuseVector=place&custom=%7B%22stringId%22%3A%229082895193%22%7D';
  await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/report-abuse/${query}`});
  await waitForDocument(browser, '#submit');
  await browser.waitFor("document.querySelector('#submit') && document.documentElement.dataset.rcFrostPage==='report-abuse'");
  const panel=()=>browser.evaluate("(()=>{const node=document.querySelector('#content'),style=getComputedStyle(node),rect=node.getBoundingClientRect();return {width:rect.width,blur:style.backdropFilter,background:style.backgroundColor}})()");
  for(const theme of ['dark','light']){
    await browser.evaluate(`document.body.className='${theme}-theme'`);
    for(const width of [1360,768,390,320]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});
      await pause(40);
      const surface=await panel();
      assert.match(surface.blur,/blur\(24px\)/);assert.match(surface.background,theme==='light'?/0\.82\)/:/0\.78\)/);
      assert.equal(surface.width,Math.min(720,width-32));
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#content')).borderRadius"),width<600?'16px':'20px');
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#content')).marginTop"),width<600?'16px':'28px');
      assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),true,`${theme} ${width}: no horizontal overflow`);
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#report-abuse-web-app')).backgroundColor"),'rgba(0, 0, 0, 0)');
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#inactive')).display"),'none');
      assert.equal(await browser.evaluate("document.querySelector('#description').getBoundingClientRect().height>=160"),true);
      for(const id of ['context','experience'])assert.equal(await browser.evaluate(`document.getElementById('${id}').getBoundingClientRect().width<24`),true,'Checkboxes and radios retain native sizing');
      if(process.env.REPORT_ABUSE_SCREENSHOTS && [1360,390].includes(width)){
        fs.mkdirSync(process.env.REPORT_ABUSE_SCREENSHOTS,{recursive:true});
        const screenshot=await browser.send('Page.captureScreenshot');
        fs.writeFileSync(path.join(process.env.REPORT_ABUSE_SCREENSHOTS,`report-abuse-${theme}-${width}.png`),Buffer.from(screenshot.data,'base64'));
      }
    }
  }
  await browser.evaluate("document.body.className='dark-theme';document.querySelector('#description').setAttribute('aria-invalid','true');document.querySelector('#error').hidden=false");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#description')).borderTopColor"),'rgb(239, 118, 118)');
  assert.notEqual(await browser.evaluate("getComputedStyle(document.querySelector('#error')).display"),'none');
  await browser.click('#submit');
  assert.equal(await browser.evaluate('window.submissions'),0,'A disabled submit button stays disabled');
  await browser.evaluate("document.querySelector('#submit').disabled=false;document.querySelector('#native-report').requestSubmit()");
  assert.equal(await browser.evaluate('window.submissions'),0,'Native required-field validation still blocks an empty report');
  await browser.evaluate("document.querySelector('#description').removeAttribute('aria-invalid');document.querySelector('#error').hidden=true;document.querySelector('#reason').value='other';document.querySelector('#reason').dispatchEvent(new Event('change',{bubbles:true}))");
  await browser.click('#description');await browser.send('Input.insertText',{text:'Local fixture verification.'});
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('#description')).outlineStyle"),/solid/,'Keyboard entry has a visible focus outline');
  await browser.click('#context');await browser.click('#submit');
  assert.equal(await browser.evaluate('window.submissions'),1,'The existing fixture submit handler still runs');
  assert.deepEqual(await browser.evaluate('window.payload'),{targetId:'118155665728354',submitterId:'2950704295',custom:'{"stringId":"9082895193"}',reason:'other',description:'Local fixture verification.',context:'on',scope:'experience'});
  assert.equal(await browser.evaluate('location.search'),query,'Styling leaves the target and custom query intact');
  await browser.click('#cancel');assert.equal(await browser.evaluate('window.cancellations'),1);
  await browser.evaluate("document.querySelector('.form-group').innerHTML='<label for=\"native-reason\">Reason</label><div class=\"input-dropdown\"><button id=\"native-reason\" type=\"button\" class=\"input-dropdown-btn\" aria-expanded=\"false\">Other</button><ul class=\"dropdown-menu\"><li><button id=\"native-option\" type=\"button\">Other</button></li></ul></div>';document.querySelector('#native-reason').onclick=event=>{const open=event.currentTarget.parentElement.classList.toggle('open');event.currentTarget.setAttribute('aria-expanded',String(open))};document.querySelector('#native-option').onclick=()=>document.querySelector('#native-reason').click()");
  await browser.click('#native-reason');
  assert.equal(await browser.evaluate("document.querySelector('#native-reason').getAttribute('aria-expanded')"),'true');
  await browser.click('#native-option');
  assert.equal(await browser.evaluate("document.querySelector('#native-reason').getAttribute('aria-expanded')"),'false','Native custom dropdown remains usable');
  await browser.evaluate("document.documentElement.removeAttribute('data-rc-background-active')");
  assert.match((await panel()).blur,/blur\(24px\)/,'The report form stays styled without wallpaper');
  await browser.evaluate("document.documentElement.setAttribute('data-rc-background-active','');history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
  assert.equal((await panel()).blur,'none','Report styles are scoped to the report route');
  assert.deepEqual(browser.errors,[]);
});
