const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/dialogs.js', 'src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/runtime.js', 'src/shared/i18n.js',
  'src/shared/startup.js', 'src/settings/terms-acceptance.js', 'src/settings/language-warning.js', 'src/settings/extension-warning.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css', 'src/settings/extension-warning.css'];
const ids = { ropro:'adbacgifemdbhdkfppmeilbgppmhaobf', rogold:'mafcicncghogpdpaieifglifaagndbni',
  ultimate:'namkakclifhmccmkbeddddpjegmdimed', roseal:'hfjngafpndganmdggnapblamgbfjhnof' };
const key = name => 'rcExtensionWarningAcknowledged:'+name;
const warning = '#rc-extension-warning-dialog';
const visible = `!!document.querySelector('${warning}:modal')`;
const setup = `
  const listeners=[];
  window.readSaved=()=>({robloxCustomizerTermsAccepted:!location.search.includes('first=1'),...JSON.parse(localStorage.getItem('extension-warning-fixture')||'{}')});
  window.savedWrites=[];window.nativeClicks=0;window.btrClicks=0;window.btrInitCalls=0;
  window.thirdPartySettings={enabled:true,preview:true};
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return readSaved()},async set(values){savedWrites.push(values);const old=readSaved();
    localStorage.setItem('extension-warning-fixture',JSON.stringify({...old,...values}));
    for(const listener of listeners)listener(Object.fromEntries(Object.entries(values).map(([key,newValue])=>[key,{oldValue:old[key],newValue}])),'local')},async remove(){}},
    onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{getURL:file=>'/'+file,lastError:null,sendMessage(){throw Error('Unexpected extension message')}},
    get management(){throw Error('Installed-extension inventory must not be read')}};
  document.addEventListener('btroblox/init',event=>{btrInitCalls++;window.observedBtrSettings=event.detail});
`;

async function launch(t) {
  const assets=new Set([...scripts,...styles,'icons/icon-128.png']);
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://localhost'),file=url.pathname.slice(1);
    response.setHeader('Cache-Control','no-store');
    if(assets.has(file)) {
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/javascript');
      response.end(fs.readFileSync(path.join(workspace,file)));return;
    }
    response.setHeader('Content-Type','text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="en" ${url.searchParams.has('btr')?'btr-loaded="true"':''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{margin:24px;font:16px Arial;background:#24252c;color:white}button{padding:10px}header{display:flex;gap:20px}</style>
      ${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><header>
      <button id="native-action" onclick="nativeClicks++">Native action</button><button id="btr-action" ${url.searchParams.has('btr')?'class="btr-settings-toggle"':'hidden'} onclick="btrClicks++">BTR Settings</button></header>
      <main><h1>Roblox</h1><p>RoPro, RoGold, RoSeal and BTRoblox are game names here.</p>
      <a href="https://chromewebstore.google.com/detail/${ids.ropro}">Store link</a><div id="native-game" style="width:176px;height:200px;background:#485889">Native game card</div></main></body></html>`);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  const browser=await isolatedChrome(t,'extension-warning');
  await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:setup});
  for(const file of scripts)await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')+'\n//# sourceURL='+file});
  const base=`http://127.0.0.1:${server.address().port}/home`;
  const navigate=async query=>{const url=base+query;await browser.send('Page.navigate',{url});await waitForDocument(browser,'#native-action',url)};
  const resource=async id=>browser.evaluate(`(()=>{const resource=document.createElement('script');resource.type='application/json';resource.src='chrome-extension://${id}/resource.js';document.head.append(resource)})()`);
  return {browser,navigate,resource};
}

test('Extension notices detect known page evidence, preserve other extensions, remember acknowledgements and wait for other dialogs',
  {skip:!process.env.CHROME_BIN,timeout:45000},async t=>{
    const {browser,navigate,resource}=await launch(t);
    await navigate('');await pause(350);
    assert.equal(await browser.evaluate(visible),false,'Extension names in ordinary text and store links are not evidence');
    assert.equal(await browser.evaluate('savedWrites.length'),0,'A clean page writes no detection history');
    // An unrelated class, unknown extension resource, and non-resource link are ignored.
    await browser.evaluate(`document.querySelector('main').className='ropro-game';const link=document.createElement('link');link.rel='author';link.href='chrome-extension://${ids.rogold}/author';document.head.append(link)`);
    await resource('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');await pause(250);
    assert.equal(await browser.evaluate(visible),false);
    await browser.evaluate("document.querySelector('#native-action').focus();document.dispatchEvent(new CustomEvent('btroblox/init',{detail:thirdPartySettings}))");
    await browser.waitFor(visible);
    assert.deepEqual(await browser.evaluate('observedBtrSettings'),{enabled:true,preview:true});
    assert.equal(await browser.evaluate('btrInitCalls'),1,'Detection does not cancel another extension initialization');
    assert.deepEqual(await browser.evaluate(`RobloxCustomizerExtensionWarning.detected()`),['BTRoblox']);
    const noticeText=await browser.evaluate(`document.querySelector('${warning}').textContent`);
    assert.match(noticeText,/extensive changes to the Roblox website's layout/);
    assert.match(noticeText,/duplicate buttons or features, overlapping elements/);
    assert.match(noticeText,/You can keep using these extensions together. You do not have to choose just one./);
    assert.match(noticeText,/will not automatically disable other extensions or change their settings/);
    assert.match(noticeText,/If the page looks and works normally, you can continue without changing anything/);
    assert.match(noticeText,/you can choose to temporarily turn off overlapping features/);
    assert.equal(await browser.evaluate(`document.activeElement===document.querySelector('${warning} button')`),true);
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});
    assert.equal(await browser.evaluate(`document.activeElement===document.querySelector('${warning} .rc-extension-warning-content')`),true,'The explanation can be reached with the keyboard');
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert.equal(await browser.evaluate(`document.activeElement===document.querySelector('${warning} button')`),true);
    await browser.click(`${warning} button`);await browser.waitFor('!('+visible+')');
    await browser.waitFor(`readSaved()[${JSON.stringify(key('btroblox'))}]===true`);
    assert.equal(await browser.evaluate('document.activeElement.id'),'native-action');
    assert.equal(await browser.evaluate("document.querySelector('#native-game').style.background"),'rgb(72, 88, 137)');
    await browser.evaluate("document.querySelector('#btr-action').hidden=false");
    await browser.click('#btr-action');await browser.click('#native-action');
    assert.deepEqual(await browser.evaluate('[btrClicks,nativeClicks]'),[1,1]);

    await navigate('?btr=1');await pause(350);
    assert.equal(await browser.evaluate(visible),false,'An already acknowledged extension does not warn again on reload');
    await resource(ids.ropro);await browser.waitFor(visible);
    const current=await browser.evaluate(`(window.firstNotice=document.querySelector('${warning}'),true)`);assert.equal(current,true);
    await resource(ids.rogold);await resource(ids.ultimate);await resource(ids.roseal);
    await browser.waitFor(`document.querySelectorAll('${warning} li').length===5`);
    assert.equal(await browser.evaluate(`firstNotice===document.querySelector('${warning}')`),true,'New detections update one notice');
    assert.deepEqual(await browser.evaluate(`[...document.querySelectorAll('${warning} li')].map(node=>node.textContent)`),['BTRoblox','RoPro','RoGold','RoGold Ultimate','RoSeal']);
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await browser.waitFor('!('+visible+')');
    await browser.waitFor(`readSaved()[${JSON.stringify(key('roseal'))}]===true`);
    assert.equal(await browser.evaluate("Object.keys(readSaved()).filter(key=>key.startsWith('rcExtensionWarningAcknowledged:')).length"),5);

    // A separately acknowledged extension (another tab) dismisses its notice.
    await browser.evaluate("localStorage.removeItem('extension-warning-fixture')");await navigate('');
    await resource(ids.rogold);await browser.waitFor(visible);
    await browser.evaluate(`chrome.storage.local.set({${JSON.stringify(key('rogold'))}:true})`);
    await browser.waitFor('!('+visible+')');
    // Native modal interactions finish before a new conflict warning opens.
    await browser.evaluate("const native=document.createElement('dialog');native.id='native-dialog';native.innerHTML='<button>Native modal</button>';document.body.append(native);native.showModal()");
    await resource(ids.ropro);await pause(300);
    assert.equal(await browser.evaluate(visible),false);
    await browser.evaluate("document.querySelector('#native-dialog').close();document.querySelector('#native-dialog').remove()");
    await browser.waitFor(visible);await browser.click(`${warning} button`);

    // First-visit onboarding has priority; no two extension dialogs overlap.
    await browser.evaluate("localStorage.removeItem('extension-warning-fixture')");await navigate('?first=1&btr=1');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");await pause(300);
    assert.equal(await browser.evaluate(visible),false);
    await browser.click('#rc-terms-accept');await browser.waitFor(visible);
    assert.equal(await browser.evaluate("document.querySelectorAll('dialog:modal').length"),1);
    await browser.click(`${warning} button`);
    // The same script in a subframe cannot open another advisory.
    await browser.evaluate("const frame=document.createElement('iframe');frame.srcdoc='<script src=\"/src/settings/extension-warning.js\"></script>';document.body.append(frame)");
    await pause(250);
    assert.equal(await browser.evaluate("document.querySelector('iframe').contentDocument.querySelector('#rc-extension-warning-dialog')"),null);
    assert.deepEqual(browser.errors,[]);
  });

test('Extension notices fit supported languages and themes, including narrow screens',
  {skip:!process.env.CHROME_BIN,timeout:45000},async t=>{
    const {browser,navigate}=await launch(t);
    await navigate('?btr=1');await browser.waitFor(visible);
    await browser.evaluate(`window.noticeSources=[...document.querySelectorAll('${warning} h2,${warning} p,${warning} strong,${warning} span,${warning} button')].flatMap(element=>[...element.childNodes]).filter(n=>n.nodeType===3&&n.data.trim()).map(n=>({element:n.parentElement,source:n.data.trim()}))`);
    for(const locale of ['en','zh-CN','zh-TW','id','ja','th','ko']) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      for(const theme of ['dark','light','custom']) {
        await browser.evaluate(`document.body.className='${theme==='light'?'light':'dark'}-theme';RobloxCustomizerStartup.setPreferences({source:'none',experimentalCustomColors:${theme==='custom'},customTextColor:'#ffffff',customBackgroundColor:'#394b84',customAccentColor:'#fc33ff'})`);
        for(const {width,height} of [{width:1200,height:900},{width:390,height:844},{width:320,height:568}]) {
          await browser.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
          const layout=await browser.evaluate(`(()=>{const node=document.querySelector('${warning}'),content=node.querySelector('.rc-extension-warning-content'),button=node.querySelector('button'),r=node.getBoundingClientRect(),c=content.getBoundingClientRect(),b=button.getBoundingClientRect();return {
            locale:node.lang,overflow:node.scrollWidth>node.clientWidth+1,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,
            contentOverflow:content.scrollWidth>content.clientWidth+1,contentStartsAtTop:content.scrollTop===0,contentVisible:c.height>60&&c.top>=r.top&&c.bottom<=b.top,
            buttonInside:b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom,
            translated:noticeSources.every(({element,source})=>element.textContent===RobloxCustomizerI18n.t(source)&&(${JSON.stringify(locale)}==='en'||element.textContent!==source)),
            textColor:getComputedStyle(node).color,background:getComputedStyle(node).backgroundColor,names:[...node.querySelectorAll('li')].map(n=>n.textContent)}})()`);
          assert.equal(layout.locale,locale);assert.equal(layout.overflow,false,`${locale}/${theme}/${width}`);assert.equal(layout.inside,true);assert.equal(layout.buttonInside,true);
          assert.equal(layout.contentOverflow,false);assert.equal(layout.contentStartsAtTop,true,'Autofocus must not skip the start of the explanation');assert.equal(layout.contentVisible,true);
          assert.equal(layout.translated,true);assert.notEqual(layout.textColor,layout.background);assert.deepEqual(layout.names,['BTRoblox']);
          if(process.env.EXTENSION_WARNING_SCREENSHOTS&&((locale==='zh-CN'&&theme==='custom'&&width===1200)||(locale==='zh-CN'&&theme==='light'&&width===390)||(locale==='th'&&theme==='dark'&&width===320))) {
            const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
            fs.writeFileSync(path.join(process.env.EXTENSION_WARNING_SCREENSHOTS,`${locale}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
          }
        }
      }
    }
    await browser.evaluate(`document.querySelector('${warning} .rc-extension-warning-content').focus({preventScroll:true})`);
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
    await browser.waitFor(`document.querySelector('${warning} .rc-extension-warning-content').scrollTop>0`);
    await browser.clickAt({ x: 5, y: 5 });
    await browser.waitFor(`!document.querySelector('${warning}')`);
    await pause(300);
    assert.equal(await browser.evaluate(visible),false,'Outside dismissal remembers the notice instead of reopening it immediately');
    await browser.click('#native-action');
    assert.equal(await browser.evaluate('nativeClicks'),1);assert.deepEqual(browser.errors,[]);
  });
