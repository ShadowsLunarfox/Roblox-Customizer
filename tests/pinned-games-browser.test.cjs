// CHROME_BIN enables isolated local browser checks; no account or game is launched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  const voting = fs.readFileSync(path.join(__dirname, 'fixtures', 'game-voting.html'), 'utf8');
  return `<!doctype html><html data-rc-background-active><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${process.env.PINNED_NATIVE_CSS ? '<link rel="stylesheet" href="/native.css">' : ''}
  <style>body{margin:0;background:#25272c;color:#f7f7f8;font:14px Arial}.wallpaper{position:fixed;inset:0;background:repeating-linear-gradient(45deg,#9d433a 0 60px,#758570 60px 120px,#655278 120px 180px);z-index:-1}main{width:min(1060px,calc(100% - 32px));margin:30px auto}h1,h2{margin:12px 0}.friend-carousel-container{padding:18px;border:1px solid #ffffff30;border-radius:12px;background:#25272c90;backdrop-filter:blur(18px)}.friends{display:flex;gap:20px}.friend{display:grid;gap:6px;text-align:center}.avatar{display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#73818f}#game-detail-page{max-width:100%}.game-calls-to-action{width:min(360px,100%);margin:30px 0}.favorite-follow-vote-share{width:100%;box-sizing:border-box;padding:10px 0;margin:0;list-style:none}.favorite-follow-vote-share:after{content:'';display:block;clear:both}.game-main-content.follow-button-enabled .game-favorite-button-container{float:left;width:110px;white-space:nowrap}.favorite-button{text-align:center;width:55px}.icon-favorite{font-size:28px;height:28px;margin-bottom:4px}.icon-label{font-size:12px;line-height:16px}.voting-panel{float:left;width:110px}.social-media-share{float:right}.game-favorite-button-container a{display:block;color:inherit;text-decoration:none;cursor:pointer}@media(min-width:991px){.game-main-content.follow-button-enabled .game-favorite-button-container{width:calc(50% - 56px)}}@media(max-width:374px){.game-main-content.follow-button-enabled .game-favorite-button-container{max-width:75px}}#recommended{margin-top:30px}</style>
  <style>
  .tooltip-container{cursor:pointer;display:inline-block}.tooltip-container span{vertical-align:middle;padding:4px 0 0 6px;display:table-cell}
  .game-main-content.follow-button-enabled .game-follow-button-container{float:left;width:110px;white-space:nowrap;overflow:hidden}
  .follow-button{text-align:center;width:55px}.follow-button a{display:block;color:inherit;text-decoration:none;cursor:pointer}
  .icon-notifications-bell,.icon-like,.icon-dislike{display:block;width:28px;height:28px}.icon-notifications-bell{margin-bottom:4px}
  .voting-panel{position:relative;bottom:-24px}.users-vote{height:30px;display:block;position:relative;padding:0}
  .users-vote .upvote,.users-vote .downvote{position:absolute;top:-30px;right:0;cursor:pointer}.users-vote .upvote{left:0}
  .vote-details{display:block;width:100%}.vote-container{position:relative;height:2px;margin:6px 0 0;background:#ffffff30}
  .vote-percentage{position:absolute;top:0;left:0;background:#fff;height:100%;width:85%}
  .vote-numbers{display:block;white-space:nowrap;font-size:11px}.vote-numbers .count-left{float:left}.vote-numbers .count-right{float:right;text-align:right}
  .social-media-share{position:relative;bottom:-15px}
  .social-media-share{width:100%;display:inline-block}.share-game-container{position:absolute;bottom:0;left:24px}
  .icon-dislike svg{stroke:#f7f7f8}.voting-panel .loading{display:none}
  @media(min-width:991px){.game-main-content.follow-button-enabled .game-follow-button-container{width:calc(50% - 56px)}}
  </style>
  <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/home/pinned-games.css"></head><body class="dark-theme builder-font"><div class="wallpaper"></div><main id="content"></main>
  <script>
    const listeners=[];
    const record=id=>({placeId:id,universeId:id+1000,name:id===1?'Adventure <img onerror=alert(1)>':('Game '+id),iconUrl:'https://tr.rbxcdn.com/pin-'+id+'.png',updatedAt:Date.now()});
    if(!localStorage.getItem('pinnedGames'))localStorage.setItem('pinnedGames',JSON.stringify(Array.from({length:9},(_,i)=>record(i+1))));
    const read=()=>JSON.parse(localStorage.getItem('pinnedGames')||'[]');
    function emit(games){listeners.forEach(fn=>fn({pinnedGames:{newValue:games}},'local'))}
    function write(games){localStorage.setItem('pinnedGames',JSON.stringify(games));emit(games)}
    window.chrome={storage:{local:{async get(){return {pinnedGames:read()}}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,sendMessage(message,callback){setTimeout(()=>{let games=read(),status; if(message.action==='pin'){if(games.length===10){callback({ok:false,status:'full',games});return}games.push(record(message.placeId));status='pinned';write(games)}else if(message.action==='unpin'){games=games.filter(g=>g.universeId!==message.universeId);status='unpinned';write(games)}callback({ok:true,games,status})},15)}}};
    addEventListener('storage',event=>{if(event.key==='pinnedGames')emit(read())});
    window.launches=[];window.favoriteClicks=0;window.notifyClicks=0;window.voteClicks=0;
    window.Roblox={GameLauncher:{joinMultiplayerGame:(...args)=>{launches.push(args);return Promise.resolve()}}};
    const nativeActions='<ul class="favorite-follow-vote-share"><li class="game-favorite-button-container"><div class="tooltip-container"><div class="favorite-button"><a id="toggle-game-favorite"><div class="icon-favorite">☆</div><div class="icon-label">Favorited</div></a></div></div></li><li class="game-follow-button-container"><div class="follow-button"><a id="toggle-game-follow"><span class="icon-notifications-bell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM9 20h6M12 4V2"/></svg></span><span class="icon-label">Notify</span></a></div></li><li id="voting-panel-container" class="voting-panel"><div class="game-voting-panel"><div class="users-vote"><div class="upvote"><span class="icon-like"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 10v10h3V10zm5 0 4-8h2l-1 8h6l-3 10H9z"/></svg></span></div><div class="vote-details"><div class="vote-container"><div class="vote-percentage"></div></div><div class="vote-numbers"><span class="count-left">5M+</span><span class="count-right">811K+</span></div></div><div class="downvote"><span class="icon-dislike"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 4v10h3V4zm5 0h8l3 10h-6l1 8h-2l-4-8z"/></svg></span></div></div></div></li><li class="social-media-share"><span>↗</span></li></ul>';
    window.nativeActions=nativeActions;
    const actionTemplate=document.createElement('template');actionTemplate.innerHTML=nativeActions;
    const likes=actionTemplate.content.querySelector('.icon-like').innerHTML,dislikes=actionTemplate.content.querySelector('.icon-dislike').innerHTML;
    actionTemplate.content.querySelector('#voting-panel-container').outerHTML=${JSON.stringify(voting)};
    actionTemplate.content.querySelector('.icon-like').innerHTML=likes;actionTemplate.content.querySelector('.icon-dislike').innerHTML=dislikes;
    window.nativeActions=actionTemplate.innerHTML;
    window.renderRoute=()=>{const id=Number(location.pathname.match(/^\\/games\\/(\\d+)/)?.[1]);document.getElementById('content').innerHTML=id?
    '<div id="game-detail-page" data-place-id="'+id+'"><div id="game-detail-meta-data" data-place-id="'+id+'" data-universe-id="'+(id+1000)+'"></div><div class="game-main-content follow-button-enabled"><div class="game-calls-to-action" style="width:min(360px,100%);padding:0"><h1>Game '+id+'</h1><button id="native-play">Play</button>'+window.nativeActions+'</div></div></div>':
    '<div id="HomeContainer" class="home-container"><h1>Home</h1><div class="friend-carousel-container"><h2>Friends</h2><div class="friends"><span class="friend"><span class="avatar">A</span>Alex</span><span class="friend"><span class="avatar">J</span>Jamie</span><span class="friend"><span class="avatar">R</span>Riley</span></div></div><section id="recommended"><h2>Recommended For You</h2><p>Native recommendations remain below pinned games.</p></section></div>';
    window.nativeFavorite=document.getElementById('toggle-game-favorite');window.nativeFavoriteParent=nativeFavorite?.parentElement;
    if(nativeFavorite){nativeFavorite.onclick=()=>favoriteClicks++;document.getElementById('toggle-game-follow').onclick=()=>notifyClicks++;document.querySelector('.upvote').onclick=()=>voteClicks++}};
    window.go=path=>{history.pushState({},'',path);renderRoute()};renderRoute();
  </script><script src="/src/shared/page-bridge.js"></script><script src="/src/home/pinned-games-core.js"></script><script src="/src/home/pinned-games.js"></script></body></html>`;
}

class Browser {
  constructor(url) {
    this.socket = new WebSocket(url); this.pending = new Map(); this.next = 1;
    this.ready = new Promise((resolve, reject) => { this.socket.addEventListener('open', resolve); this.socket.addEventListener('error', reject, { once: true }); });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = this.pending.get(message.id); this.pending.delete(message.id);
        message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      } else if (message.method === 'Fetch.requestPaused') {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#6071b2"/><path d="M25 110 70 30l55 80z" fill="#a8ddcf"/><circle cx="110" cy="35" r="14" fill="#ffe199"/></svg>';
        this.send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }], body: Buffer.from(svg).toString('base64') }).catch(() => {});
      }
    });
  }
  async send(method, params = {}) {
    await this.ready; const id = this.next++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async click(selector) {
    await this.send('Page.bringToFront');
    const position = await this.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...position });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...position });
    await pause(90);
  }
}

test('Game pins appear beside Favorite, persist below Home friends, join natively and show List Full', { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const profile = fs.mkdtempSync(path.join(workspace, '.tmp-pinned-games-browser-'));
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control','no-store');
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    if (file === 'native.css' && process.env.PINNED_NATIVE_CSS) {
      response.setHeader('Content-Type', 'text/css');response.end(fs.readFileSync(process.env.PINNED_NATIVE_CSS));
    } else if (['src/shared/theme.css', 'src/home/pinned-games.css', 'src/home/pinned-games.js', 'src/home/pinned-games-core.js', 'src/shared/page-bridge.js'].includes(file)) {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'application/javascript');
      response.end(fs.readFileSync(path.join(workspace, file)));
    } else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture()); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const child = spawn(process.env.CHROME_BIN, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let browser;
  let secondary;
  t.after(async () => {
    secondary?.socket.close();
    if (browser) { await Promise.race([browser.send('Browser.close').catch(() => {}), pause(1000)]); browser.socket.close(); }
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(1000)]);
    if (child.exitCode === null) child.kill();
    await new Promise(resolve => server.close(resolve)); await pause(300);
    assert.equal(path.dirname(path.resolve(profile)), workspace);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await pause(50);
  assert.ok(fs.existsSync(portFile));
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab => tab.type === 'page');
  browser = new Browser(target.webSocketDebuggerUrl); await browser.send('Page.enable');
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://tr.rbxcdn.com/*' }] });
  await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 980, deviceScaleFactor: 1, mobile: false });
  await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/games/10/Adventure` }); await pause(220);
  const iconRow = `(()=>{const selectors=['#rc-pin-game svg','.icon-favorite','.icon-notifications-bell','.icon-like','.icon-dislike'];const rects=selectors.map(selector=>document.querySelector(selector).getBoundingClientRect());const group=document.querySelector('.favorite-follow-vote-share'),row=group.getBoundingClientRect();const labels=[...group.querySelectorAll('.icon-label,#vote-up-text,#vote-down-text')].map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height);const overlap=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;const clear=labels.every((r,i)=>labels.slice(i+1).every(other=>!overlap(r,other)));return {aligned:Math.max(...rects.map(r=>r.y))-Math.min(...rects.map(r=>r.y))<1,ordered:rects.every((r,i)=>!i||rects[i-1].right<=r.left),inside:rects.every(r=>r.left>=row.left&&r.right<=row.right),labels:document.querySelector('.vote-numbers').getBoundingClientRect().top>=rects[0].bottom,clear};})()`;
  const expectedRow = { aligned: true, ordered: true, inside: true, labels: true, clear: true };
  for (const width of [1360, 768, 360, 320]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 980, deviceScaleFactor: 1, mobile: width === 360 });
    const controls = await browser.evaluate(`(()=>{const pin=document.querySelector('#rc-pin-game'),fav=document.querySelector('#toggle-game-favorite'),p=pin.getBoundingClientRect(),f=fav.getBoundingClientRect();return {left:p.right<=f.left,center:Math.abs((p.y+p.height/2)-(f.y+f.height/2)),siblings:pin.parentElement.nextElementSibling===fav.closest('li'),native:fav===nativeFavorite&&fav.parentElement===nativeFavoriteParent,count:document.querySelectorAll('#rc-pin-game').length}})()`);
    assert.equal(controls.left, true, `${width}: Pin sits to the left of Favorite`);
    assert.ok(controls.center < 6, `${width}: Pin and Favorite remain vertically aligned`);
    assert.equal(controls.siblings, true); assert.equal(controls.native, true); assert.equal(controls.count, 1);
    assert.deepEqual(await browser.evaluate(iconRow), expectedRow, `${width}: Icons and labels are separated in one row`);
    for (const columnWidth of [300, 280, 260]) {
      await browser.evaluate(`document.querySelector('.game-calls-to-action').style.width='min(${columnWidth}px,100%)'`);
      assert.deepEqual(await browser.evaluate(iconRow), expectedRow, `${width}: A ${columnWidth}px sidebar stays separated`);
      assert.equal(await browser.evaluate("[...document.querySelectorAll('.favorite-follow-vote-share > li')].filter(n=>getComputedStyle(n).display!=='none').every(n=>n.getBoundingClientRect().width>0)"), true, 'No control collapses to zero width');
    }
    await browser.evaluate("document.querySelector('.game-calls-to-action').style.width='min(360px,100%)'");
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
    if (process.env.PINNED_GAMES_SCREENSHOTS) {
      fs.mkdirSync(process.env.PINNED_GAMES_SCREENSHOTS, { recursive: true });
      const screenshot = await browser.send('Page.captureScreenshot');
      fs.writeFileSync(path.join(process.env.PINNED_GAMES_SCREENSHOTS, `pin-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  await browser.click('#rc-pin-game');
  assert.deepEqual(await browser.evaluate(iconRow), expectedRow, 'The longer Unpin Game label still fits in one row');
  assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game').getAttribute('aria-pressed')"), 'true');
  assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('pinnedGames')).length"), 10);
  await browser.click('#toggle-game-favorite'); assert.equal(await browser.evaluate('favoriteClicks'), 1);
  await browser.click('#toggle-game-follow'); assert.equal(await browser.evaluate('notifyClicks'), 1);
  await browser.click('.upvote'); assert.equal(await browser.evaluate('voteClicks'), 1);
  await browser.evaluate("document.querySelector('.favorite-follow-vote-share').outerHTML=window.nativeActions"); await pause(90);
  assert.equal(await browser.evaluate("document.querySelectorAll('#rc-pin-game').length"), 1, 'Native remount recreates one pin control');
  await browser.evaluate("go('/home')"); await pause(160);
  assert.equal(await browser.evaluate("document.querySelector('.friend-carousel-container').nextElementSibling.id"), 'rc-pinned-games');
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card').length"), 10);
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card h3 img').length"), 0, 'Game names are inserted as text');
  assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game')===null"), true);
  for (const width of [1360, 768, 360]) {
    await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 980, deviceScaleFactor: 1, mobile: width === 360 });
    await pause(80);
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'), true, `${width}: Home fits the viewport`);
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.rc-pinned-game-card')).backdropFilter"), 'blur(18px) saturate(1.2)');
    assert.equal(await browser.evaluate("[...document.querySelectorAll('.rc-pinned-game-card')].every(card=>card.querySelector('.rc-pinned-game-art')&&card.querySelector('h3').textContent&&card.querySelector('.rc-pinned-game-join').textContent==='Join Game')"), true);
    if (process.env.PINNED_GAMES_SCREENSHOTS) {
      fs.mkdirSync(process.env.PINNED_GAMES_SCREENSHOTS, { recursive: true });
      const screenshot = await browser.send('Page.captureScreenshot');
      fs.writeFileSync(path.join(process.env.PINNED_GAMES_SCREENSHOTS, `home-${width}.png`), Buffer.from(screenshot.data, 'base64'));
    }
  }
  await browser.click('.rc-pinned-game-join');
  assert.deepEqual(await browser.evaluate('launches'), [[1, true, false]], 'Join uses the official launcher under a trusted user gesture');
  assert.equal(await browser.evaluate('location.pathname'), '/home');
  await browser.evaluate("Roblox.GameLauncher.joinMultiplayerGame=()=>{throw new Error('Unavailable')}");
  await browser.click('.rc-pinned-game-join');
  assert.match(await browser.evaluate("document.querySelector('#rc-pinned-games-notification').textContent"), /Could not join/);
  await browser.evaluate("document.querySelector('.rc-pinned-game-join').addEventListener('click',event=>event.preventDefault(),{once:true});document.querySelector('.rc-pinned-game-join').click()");
  assert.equal(await browser.evaluate('launches.length'), 1, 'Synthetic clicks cannot start the launcher');
  await browser.evaluate("go('/games/11')"); await pause(110); await browser.click('#rc-pin-game');
  assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-games-notification').textContent"), 'List Full');
  assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('pinnedGames')).length"), 10);
  await browser.evaluate("go('/home')"); await pause(110); await browser.click('.rc-pinned-game-remove');
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card').length"), 9);
  await browser.evaluate("go('/games/11')"); await pause(110); await browser.click('#rc-pin-game');
  assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game').getAttribute('aria-pressed')"), 'true');
  await browser.evaluate("go('/home')"); await pause(110);
  await browser.send('Page.reload'); await pause(220);
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card').length"), 10, 'Pins survive reload');
  assert.equal(await browser.evaluate("document.querySelector('[data-universe-id=\"1011\"] h3').textContent"), 'Game 11');
  await browser.evaluate("document.querySelector('.friend-carousel-container').outerHTML=document.querySelector('.friend-carousel-container').outerHTML"); await pause(90);
  assert.equal(await browser.evaluate("document.querySelector('.friend-carousel-container').nextElementSibling.id"), 'rc-pinned-games');
  assert.equal(await browser.evaluate("document.querySelectorAll('#rc-pinned-games').length"), 1);
  const secondTarget = await browser.send('Target.createTarget', { url: `http://127.0.0.1:${server.address().port}/games/12` });
  const secondPage = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab => tab.id === secondTarget.targetId);
  secondary = new Browser(secondPage.webSocketDebuggerUrl);
  await secondary.send('Page.enable'); await pause(160);
  await browser.click('.rc-pinned-game-remove'); await pause(90);
  assert.equal(await secondary.evaluate("document.querySelector('#rc-pin-game').disabled"), false);
  await secondary.click('#rc-pin-game'); await pause(120);
  await browser.send('Page.bringToFront');
  await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card').length"), 10);
  assert.equal(await browser.evaluate("document.querySelector('[data-universe-id=\"1012\"] h3').textContent"), 'Game 12', 'Pins update in another open Home tab without reloading');
  await browser.evaluate("document.documentElement.style.setProperty('--rc-glass-blur','32px')");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.rc-pinned-game-card')).backdropFilter"), 'blur(32px) saturate(1.2)');
  await browser.evaluate("document.documentElement.removeAttribute('data-rc-background-active')");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.rc-pinned-game-card')).backdropFilter"), 'none');
  await browser.evaluate("chrome.storage.onChanged;localStorage.removeItem('pinnedGames');emit([])"); await pause(90);
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card').length"), 0);
  assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-games-empty').hidden"), false);
  await browser.evaluate("go('/catalog/1')"); await pause(90);
  assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-games')===null"), true, 'Home panels disappear off-route');
});
