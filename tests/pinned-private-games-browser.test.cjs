// Real pin UI and worker against local Roblox response fixtures; no account or game is launched.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const assets = ['src/shared/theme.css', 'src/home/pinned-games.css', 'src/shared/i18n.js',
  'src/home/pinned-games-core.js', 'src/background/pinned-games-background.js', 'src/home/pinned-games.js'];

function fixture() {
  return `<!doctype html><html lang="en" data-rc-ui-active><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${assets.filter(file => file.endsWith('.css')).map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
  <style>body{margin:0;font:16px Arial;color:var(--rc-text);background:var(--rc-surface)}main{max-width:1000px;margin:24px auto;padding:16px;box-sizing:border-box}h1{font-size:24px}.game-thumbnail img{width:100px;height:100px}.favorite-follow-vote-share{list-style:none;margin:0;padding:0}#toggle-game-favorite{height:44px}</style>
  </head><body class="dark-theme"><main></main><script>
    const messageListeners=[],storageListeners=[];
    const read=()=>JSON.parse(localStorage.getItem('pins')||'[]');
    window.privateMode='api';window.apiRequests=[];window.nativeClicks=0;
    window.chrome={i18n:{getUILanguage:()=> 'en'},runtime:{id:'test-extension',lastError:null,
      onMessage:{addListener:fn=>messageListeners.push(fn)},
      sendMessage(message,callback){for(const listener of messageListeners){if(listener(message,{id:'test-extension',url:'https://www.roblox.com'+location.pathname},callback)===true)return}callback()}
    },storage:{onChanged:{addListener:fn=>storageListeners.push(fn)},local:{
      async get(){return {pinnedGames:read(),customBackground:{uiLanguage:'auto'}}},
      async set(value){localStorage.setItem('pins',JSON.stringify(value.pinnedGames));storageListeners.forEach(fn=>fn({pinnedGames:{newValue:value.pinnedGames}},'local'))}
    }}};
    window.fetch=async(address,config)=>{
      const url=new URL(address);apiRequests.push({url:url.href,credentials:config.credentials});
      if(privateMode==='offline')throw new Error('Offline');
      let data;
      if(url.hostname==='apis.roblox.com')data={universeId:1071};
      else if(url.pathname==='/v1/games/multiget-place-details'){
        if(privateMode==='page')return {ok:false,status:403};
        data=[{placeId:71,universeId:1071,universeRootPlaceId:71,name:'Private test project',isPlayable:false,reasonProhibited:'UniverseRootPlaceIsNotActive'}];
      }else if(url.hostname==='games.roblox.com')data={data:[{id:0,rootPlaceId:0,name:'[TITLE UNAVAILABLE]'}]};
      else if(url.hostname==='thumbnails.roblox.com')data={data:[{targetId:1071,state:privateMode==='page'?'Blocked':'Completed',imageUrl:'https://tr.rbxcdn.com/private-api.png'}]};
      else throw new Error('Unexpected endpoint');
      return {ok:true,json:async()=>data};
    };
    window.go=route=>{
      history.pushState({},'',route);
      document.querySelector('main').innerHTML=route.startsWith('/games/')?
        '<div id="game-detail-page" data-place-id="71"><div id="game-detail-meta-data" data-place-id="71" data-universe-id="1071"></div><div id="game-details-unavailable-container"><h1>This experience is private</h1><button id="native-play" disabled>Unavailable</button><div class="game-thumbnail"><img src="https://tr.rbxcdn.com/private-page.png"></div></div></div>':
        '<div id="HomeContainer"><div class="friend-carousel-container">Friends</div><section id="native-recommendations">Recommended games</section></div>';
      const meta=document.getElementById('game-detail-meta-data');if(meta)meta.dataset.placeName='私人測試 <img onerror=alert(1)>';
    };go(location.pathname);
  </script>${assets.filter(file => file.endsWith('.js')).map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('private games without native actions pin to Home in English and both Chinese languages',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', assets.includes(file) ? (file.endsWith('.css') ? 'text/css' : 'text/javascript') : 'text/html; charset=utf-8');
      response.end(assets.includes(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(Number(process.env.PINNED_GAMES_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const browser = await isolatedChrome(t, 'pinned-private-games');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    browser.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method !== 'Fetch.requestPaused') return;
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#6071b2"/></svg>';
      browser.send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }], body: Buffer.from(svg).toString('base64') }).catch(() => {});
    });
    await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://tr.rbxcdn.com/*' }] });
    const url = `http://127.0.0.1:${server.address().port}/games/71/Private`;
    await browser.send('Page.navigate', { url });
    await browser.send('Page.bringToFront');
    await waitForDocument(browser, '#rc-pin-game', url);

    for (const [locale, label] of [['en', 'Pin Game'], ['zh-CN', '置顶游戏'], ['zh-TW', '釘選遊戲']]) {
      for (const theme of ['dark', 'light']) {
        for (const width of [1280, 320]) {
          const mode = width === 1280 ? 'api' : 'page';
          await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 320 });
          await browser.evaluate(`privateMode=${JSON.stringify(mode)};document.body.className='${theme}-theme';RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)});go('/games/71/Private')`);
          await browser.waitFor(`document.querySelector('#rc-pin-game')?.textContent===${JSON.stringify(label)} && !document.querySelector('#rc-pin-game').disabled`);
          assert.equal(await browser.evaluate("document.querySelectorAll('#rc-pin-game').length"), 1);
          assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game').parentElement.parentElement.id"), 'game-detail-page');
          assert.equal(await browser.evaluate("document.querySelector('#native-play').disabled"), true, 'A disabled native Play button does not prevent pinning');
          assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game').getBoundingClientRect().height>=44 && document.documentElement.scrollWidth<=innerWidth"), true);
          assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#rc-pin-game')).color===getComputedStyle(document.body).color"), true, 'The standalone control follows the active theme');
          await browser.click('#rc-pin-game');
          await browser.waitFor("!document.querySelector('.rc-game-pin-folder').hidden");
          assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('pins')||'[]').length"), 0, 'The folder prompt opens before the pin is saved');
          await browser.click('#rc-confirm-pin-game');
          await browser.waitFor("document.querySelector('#rc-pin-game')?.getAttribute('aria-pressed')==='true' && !document.querySelector('#rc-pin-game').disabled");
          const saved = await browser.evaluate("JSON.parse(localStorage.getItem('pins'))");
          assert.equal(saved.length, 1); assert.equal(saved[0].placeId, 71); assert.equal(saved[0].universeId, 1071);
          assert.equal(saved[0].name, mode === 'api' ? 'Private test project' : '私人測試 <img onerror=alert(1)>');
          assert.equal(saved[0].iconUrl, `https://tr.rbxcdn.com/private-${mode}.png`);
          await browser.evaluate("go('/home')");
          await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
          assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-game-card h3').textContent"), saved[0].name);
          assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-game-card h3 img')===null"), true, 'Page names remain plain text');
          assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-game-details').getAttribute('href')"), '/games/71');
          assert.equal(await browser.evaluate("document.querySelector('.friend-carousel-container').nextElementSibling.id"), 'rc-pinned-games');
          assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'), true);
          await browser.click('.rc-pinned-game-remove');
          await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===0");
        }
      }
    }

    await browser.evaluate("privateMode='api';RobloxCustomizerI18n.setLanguage('en');go('/games/71')");
    await browser.waitFor("document.querySelector('#rc-pin-game') && !document.querySelector('#rc-pin-game').disabled");
    await browser.click('#rc-pin-game');
    await browser.waitFor("!document.querySelector('.rc-game-pin-folder').hidden");
    await browser.click('#rc-confirm-pin-game');
    await browser.waitFor("document.querySelector('#rc-pin-game')?.getAttribute('aria-pressed')==='true'");
    await browser.evaluate(`const row=document.createElement('ul');row.className='favorite-follow-vote-share';row.innerHTML='<li class="game-favorite-button-container"><button id="toggle-game-favorite">Favorite</button></li>';document.querySelector('#game-detail-page').append(row);document.querySelector('#toggle-game-favorite').onclick=()=>nativeClicks++`);
    await browser.waitFor("document.querySelector('#rc-pin-game')?.parentElement.tagName==='LI'");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-pin-game').length"), 1, 'Late native controls move the existing pin without duplicating it');
    await browser.click('#toggle-game-favorite'); assert.equal(await browser.evaluate('nativeClicks'), 1);
    await browser.evaluate("document.querySelector('.favorite-follow-vote-share').remove()");
    await browser.waitFor("!!document.querySelector('.rc-game-pin-standalone #rc-pin-game')");
    await browser.evaluate("go('/home')");
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
    await browser.send('Page.reload');
    await waitForDocument(browser, '.rc-pinned-game-card');
    assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-game-card h3').textContent"), 'Private test project', 'A private pin survives a reload');
    await browser.click('.rc-pinned-game-remove');
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===0");
    await browser.evaluate("privateMode='offline';go('/games/71')");
    await browser.waitFor("document.querySelector('#rc-pin-game') && !document.querySelector('#rc-pin-game').disabled");
    await browser.click('#rc-pin-game');
    await browser.waitFor("!document.querySelector('.rc-game-pin-folder').hidden");
    await browser.click('#rc-confirm-pin-game');
    await browser.waitFor("!!document.querySelector('#rc-pinned-games-notification') && !document.querySelector('#rc-pin-game').disabled");
    assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('pins')).length"), 0, 'Unverified offline metadata cannot create a pin');
    assert.equal(await browser.evaluate("apiRequests.filter(request=>request.credentials==='include').every(request=>new URL(request.url).pathname==='/v1/games/multiget-place-details')"), true);
    await pause(50);
    assert.deepEqual(browser.errors, []);
  });
