// CHROME_BIN enables isolated local Home/settings checks with mock extension storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  const card = (id, name) => `<li class="game-card-container"><a href="https://www.roblox.com/games/${id}/Game"><div class="game-card-name">${name}</div></a></li>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:20px;background:#383439;color:#fff;font:14px Arial}a{color:inherit;cursor:pointer}ul{padding:0;list-style:none}section,.friend-carousel-container{padding:12px;margin:12px 0;border:1px solid #ffffff40;border-radius:12px}section ul{display:flex;gap:12px}.game-card-container{position:relative;background:#ffffff20;border-radius:8px;padding:20px}h2{font-size:18px;margin:0 0 10px}.game-home-page-carousel-title{font-size:18px;font-weight:bold}</style>
  <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/settings/settings.css"></head><body>
  <ul role="menu"><li><a href="/my/account">Settings</a></li></ul>
  <main id="HomeContainer"><h1>Home</h1>
    <div class="friend-carousel-container" id="friends"><h2>Friends</h2><a href="https://www.roblox.com/games/90/Game">Favorites</a></div>
    <section id="rc-pinned-games"><h2>Pinned Games</h2>${card(91, 'Standout Games')}</section>
    <div id="shared-sorts">
      <section id="favorites"><div class="container-header"><a href="/users/1/favorites"><span class="game-home-page-carousel-title">Favorites →</span></a></div><ul>${card(100, 'Favorite game')}</ul></section>
      <section id="standout"><div><h2>Standout Games: Island Exploration</h2><p>Curated games washed up on new shores</p></div><ul>${card(101, 'Island game')}</ul></section>
      <section id="recommended"><h2><span>Recommended For You</span></h2><ul>${card(102, 'Hidden game')}${card(103, 'Favorites')}${card(104, 'Standout Games')}</ul></section>
      <section id="standout-two"><div class="game-home-page-carousel-title">Standout Games: Racing</div><ul>${card(105, 'Racing game')}</ul></section>
      <section id="recommended-two" class="game-grid-container"><h2>Recommended Games</h2><ul>${card(106, 'Another recommendation')}</ul></section>
      <section id="continue"><h2>Continue</h2><ul>${card(107, 'Recommended For You')}</ul></section>
    </div>
  </main>
  <script>
    const listeners=[];
    if(!localStorage.getItem('customBackground'))localStorage.setItem('customBackground',JSON.stringify({hiddenRecommendedGames:[{placeId:'102',name:'Hidden game'}],friendRows:4,glassBlur:24}));
    const read=()=>JSON.parse(localStorage.getItem('customBackground')||'{}');
    const emit=value=>listeners.forEach(fn=>fn({customBackground:{newValue:value}},'local'));
    window.chrome={storage:{local:{async get(){return {customBackground:read()}},async set(value){localStorage.setItem('customBackground',JSON.stringify(value.customBackground));emit(value.customBackground)}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{getURL:file=>'/'+file,lastError:null,sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player',imageUrl:'/avatar.svg'})}}};
    addEventListener('storage',event=>{if(event.key==='customBackground')emit(read())});
  </script><script src="/src/shared/startup.js"></script><script src="/src/settings/settings.js"></script></body></html>`;
}

class Browser {
  constructor(url) {
    this.socket=new WebSocket(url);this.pending=new Map();this.next=1;this.errors=[];
    this.ready=new Promise((resolve,reject)=>{this.socket.addEventListener('open',resolve);this.socket.addEventListener('error',reject,{once:true})});
    this.socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=this.pending.get(message.id);this.pending.delete(message.id);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails.text)});
  }
  async send(method,params={}) {
    await this.ready;const id=this.next++;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}))});
  }
  async evaluate(expression) {
    const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  }
  async click(selector) {
    await this.send('Page.bringToFront');
    const point=await this.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});node.scrollIntoView({block:'center'});const rect=node.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}})()`);
    await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }
  async waitFor(expression) {
    for(let i=0;i<100;i++){if(await this.evaluate(expression))return;await pause(30)}
    assert.fail(`Timed out: ${expression}`);
  }
}

test('Home hide switches are independent, persistent, and handle native carousel remounts', {skip:!process.env.CHROME_BIN,timeout:30000}, async t => {
  const profile=fs.mkdtempSync(path.join(workspace,'.tmp-home-visibility-'));
  const server=http.createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');
    const file=new URL(request.url,'http://localhost').pathname.slice(1);
    if(['src/shared/theme.css','src/settings/settings.css','src/shared/startup.js','src/settings/settings.js'].includes(file)){
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)));
    }else if(file==='avatar.svg'){
      response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#6071b2"/></svg>');
    }else if(/^icons\/icon-\d+\.png$/.test(file)){
      response.setHeader('Content-Type','image/png');response.end(fs.readFileSync(path.join(workspace,file)));
    }else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixture())}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const child=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let browser,other;
  t.after(async()=>{
    if(browser){await Promise.race([browser.send('Browser.close').catch(()=>{}),pause(1000)]);browser.socket.close()}
    other?.socket.close();
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
  const url=`http://127.0.0.1:${server.address().port}/home`;
  await browser.send('Page.navigate',{url});
  await browser.waitFor("document.querySelector('#recommended-two[data-rc-home-section]') && document.querySelector('.rc-settings-menu-entry')");
  const sections={favorites:'favorites',standout:'standout','standout-two':'standout',recommended:'upper','recommended-two':'lower'};
  for(const [id,kind] of Object.entries(sections))assert.equal(await browser.evaluate(`document.getElementById(${JSON.stringify(id)}).dataset.${['upper','lower'].includes(kind)?'rcRecommendedSection':'rcHomeSection'}`),kind);
  const assertVisibility=async hidden=>{
    for(const [id,kind] of Object.entries(sections))assert.equal(await browser.evaluate(`getComputedStyle(document.getElementById(${JSON.stringify(id)})).display==='none'`),hidden.includes(kind),id);
    for(const id of ['friends','rc-pinned-games','continue','shared-sorts'])assert.equal(await browser.evaluate(`getComputedStyle(document.getElementById('${id}')).display==='none'`),false,`${id} stays visible`);
  };
  const controls={favorites:['#rc-hide-favorites','hideFavorites'],standout:['#rc-hide-standout-games','hideStandoutGames'],upper:['#rc-hide-recommended-upper','hideRecommendedUpper'],lower:['#rc-hide-recommended-lower','hideRecommendedLower']};
  await assertVisibility([]);
  assert.equal(await browser.evaluate("document.querySelector('[data-rc-recommended-place-id=\"102\"]').hasAttribute('data-rc-recommended-hidden')"),true,'Existing individual recommendation hiding is preserved');
  assert.equal(await browser.evaluate("document.querySelector('#continue .rc-hide-recommended-game')"),null,'Game names do not classify unrelated sections');
  await browser.click('.rc-settings-menu-entry');
  assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-background-active')"),false,'Settings work on a fresh install without wallpaper');
  await browser.evaluate("const blur=document.querySelector('#rc-glass-blur');blur.value='32';blur.dispatchEvent(new Event('input',{bubbles:true}));const opacity=document.querySelector('#rc-glass-opacity');opacity.value='85';opacity.dispatchEvent(new Event('input',{bubbles:true}))");
  await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).glassBlur===32 && JSON.parse(localStorage.getItem('customBackground')).glassOpacity===85");
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('[role=menu]')).backdropFilter"),/blur\(32px\)/,'Changing glass settings styles the menu without a wallpaper');
  assert.notEqual(await browser.evaluate("getComputedStyle(document.body).backgroundColor"),'rgba(0, 0, 0, 0)','Roblox default background stays opaque');
  for(const [kind,[selector,key]] of Object.entries(controls)){
    assert.equal(await browser.evaluate(`document.querySelector('${selector}').checked`),false,'Existing users default to visible');
    await browser.click(selector);await browser.waitFor(`JSON.parse(localStorage.getItem('customBackground')).${key}===true`);
    await assertVisibility([kind]);
    await browser.click(selector);await browser.waitFor(`JSON.parse(localStorage.getItem('customBackground')).${key}===false`);
    await assertVisibility([]);
  }
  for(const [selector,key] of Object.values(controls)){
    await browser.click(selector);await browser.waitFor(`JSON.parse(localStorage.getItem('customBackground')).${key}===true`);
  }
  await assertVisibility(Object.keys(controls));
  await browser.click('#rc-remove');
  await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).source==='none'");
  await assertVisibility(Object.keys(controls));
  assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('customBackground')).glassBlur"),32,'Removing wallpaper preserves appearance preferences');
  assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('customBackground')).glassOpacity"),85);
  assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('customBackground')).friendRows"),4,'Other Home preferences survive setting changes');
  await browser.click('#rc-done');
  await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
  // Both parts keep their identity while hidden, empty, or remounted by Roblox.
  await browser.evaluate("document.querySelector('#recommended-two ul').replaceChildren();document.querySelector('#recommended').outerHTML=document.querySelector('#recommended').outerHTML");
  await browser.waitFor("document.querySelector('#recommended').dataset.rcRecommendedSection==='upper' && document.querySelector('#recommended-two').dataset.rcRecommendedSection==='lower'");
  await assertVisibility(Object.keys(controls));
  await browser.evaluate("document.querySelector('#recommended-two ul').innerHTML='<li class=\"game-card-container\"><a href=\"https://www.roblox.com/games/106/Game\"><div class=\"game-card-name\">Another recommendation</div></a></li>'");
  await browser.waitFor("document.querySelector('#recommended-two [data-rc-recommended-place-id=\"106\"]')");
  assert.equal(await browser.evaluate("!!document.querySelector('#recommended-two .rc-hide-recommended-game')"),true,'Late lower cards support individual hiding');
  await browser.evaluate("const late=document.createElement('section');late.id='standout-late';late.className='game-sort-carousel-container';late.innerHTML='<h2>Standout Games: Adventure</h2>';document.querySelector('#shared-sorts').append(late)");
  await browser.waitFor("document.querySelector('#standout-late').dataset.rcHomeSection==='standout'");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#standout-late')).display"),'none','Late-loading and empty native carousels obey the switch');
  await browser.evaluate("document.querySelector('#standout-late h2').firstChild.data='Continue';document.querySelector('#standout').outerHTML=document.querySelector('#standout').outerHTML");
  await browser.waitFor("!document.querySelector('#standout-late').hasAttribute('data-rc-home-section') && document.querySelector('#standout').dataset.rcHomeSection==='standout'");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#standout-late')).display==='none'"),false,'Reused containers no longer retain the old category');
  await browser.send('Page.reload');
  await browser.waitFor("document.querySelector('#recommended-two[data-rc-home-section]') && document.querySelector('.rc-settings-menu-entry')");
  await assertVisibility(Object.keys(controls));
  await browser.click('.rc-settings-menu-entry');
  assert.equal(await browser.evaluate("document.querySelector('#rc-glass-blur').value"),'32','Glass preference survives a reload with no background');
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('[role=menu]')).backdropFilter"),/blur\(32px\)/);
  for(const [selector] of Object.values(controls))assert.equal(await browser.evaluate(`document.querySelector('${selector}').checked`),true,'Checkboxes reflect saved state after refresh');
  const cache=await browser.evaluate("JSON.parse(localStorage.getItem('roblox-customizer-visuals-v1'))");
  assert.equal(cache.hideFavorites,true);assert.equal(cache.hideStandoutGames,true);assert.equal(cache.hideRecommendedUpper,true);assert.equal(cache.hideRecommendedLower,true);
  // Separate choices survive an actual reload, then a legacy saved value hides both parts.
  await browser.click('#rc-hide-recommended-upper');
  await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).hideRecommendedUpper===false");
  await assertVisibility(['favorites','standout','lower']);
  await browser.send('Page.reload');
  await browser.waitFor("document.querySelector('#recommended-two').dataset.rcRecommendedSection==='lower' && document.querySelector('.rc-settings-menu-entry')");
  await assertVisibility(['favorites','standout','lower']);
  await browser.click('.rc-settings-menu-entry');
  assert.equal(await browser.evaluate("document.querySelector('#rc-hide-recommended-upper').checked"),false);
  assert.equal(await browser.evaluate("document.querySelector('#rc-hide-recommended-lower').checked"),true);
  await browser.evaluate("const legacy=JSON.parse(localStorage.getItem('customBackground'));delete legacy.hideRecommendedUpper;delete legacy.hideRecommendedLower;legacy.hideRecommended=true;chrome.storage.local.set({customBackground:legacy})");
  await browser.waitFor("document.querySelector('#rc-hide-recommended-upper').checked && document.querySelector('#rc-hide-recommended-lower').checked");
  await assertVisibility(Object.keys(controls));
  // A second Roblox tab updates both the page and an already-open settings dialog.
  const created=await browser.send('Target.createTarget',{url});
  const otherTarget=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab=>tab.id===created.targetId);
  other=new Browser(otherTarget.webSocketDebuggerUrl);
  await other.waitFor("document.querySelector('.rc-settings-menu-entry')");
  await other.click('.rc-settings-menu-entry');await other.click('#rc-hide-favorites');
  await other.waitFor("JSON.parse(localStorage.getItem('customBackground')).hideFavorites===false");
  await browser.send('Page.bringToFront');
  await browser.waitFor("!document.querySelector('#rc-hide-favorites').checked");
  await assertVisibility(['standout','upper','lower']);
  await browser.evaluate("chrome.storage.local.set({customBackground:{...JSON.parse(localStorage.getItem('customBackground')),source:'file',fileKey:'missing-fixture-file',fileName:'missing.png'}})");
  await browser.waitFor("!document.documentElement.hasAttribute('data-rc-background-active') && document.querySelector('#rc-settings-status').textContent.includes('unavailable')");
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('[role=menu]')).backdropFilter"),/blur\(32px\)/,'A missing saved background cannot disable interface features');
  await assertVisibility(['standout','upper','lower']);
  await browser.click('#rc-remove');
  await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).source==='none'");
  // Home-only markers are cleared if Roblox reuses the DOM while changing routes.
  await browser.click('#rc-done');
  await browser.evaluate("history.pushState({},'', '/charts');dispatchEvent(new PopStateEvent('popstate'))");
  await browser.waitFor("!document.querySelector('[data-rc-home-section], [data-rc-recommended-section]')");
  await assertVisibility([]);
  await browser.evaluate("history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
  await browser.waitFor("document.querySelector('#recommended-two').dataset.rcHomeSection==='recommended'");
  await assertVisibility(['standout','upper','lower']);
  assert.deepEqual(browser.errors,[],'Settings and carousel mutations should not throw browser errors');
});
