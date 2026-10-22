const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const scripts = [...new Set(manifest.content_scripts.flatMap(entry => entry.js || []))];
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const worker = 'src/background/pinned-games-background.js';
const artwork = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#5282b4"/></svg>';

function fixture() {
  return `<!doctype html><html lang="id" class="dark-theme"><head><meta charset="utf-8"><meta name="locale-data" data-language-code="id-id">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
  <style>*{box-sizing:border-box}body{margin:0;font:16px Arial;background:#252730;color:white}main{max-width:1100px;margin:auto;padding:20px}a{color:inherit}#settings-popover-menu{position:fixed;right:0;top:0}</style>
  <script src="/src/shared/routes.js"></script></head><body>
  <ul id="settings-popover-menu"><li><a href="/id/my/account">Pengaturan</a></li></ul><main></main>
  <script>
    const changed=[],messages=[],waiting=[];window.pinRequests=[];
    window.releasePreferences=()=>{window.preferencesReleased=true;waiting.splice(0).forEach(resolve=>resolve(readSaved()));};
    const pin=id=>({placeId:id,universeId:id+1000,name:'Game '+id,iconUrl:'https://tr.rbxcdn.com/fixture/'+id+'.png',updatedAt:Date.now()});
    const game=id=>({...pin(id),totalMs:180000,sessions:1,firstPlayedAt:1800000000000,lastPlayedAt:1800000000000,metadataCheckedAt:1800000000000});
    if(!localStorage.getItem('data'))localStorage.setItem('data',JSON.stringify({robloxCustomizerTermsAccepted:true,robloxCustomizerSettingsGuideSeen:true,
      customBackground:{source:'none',uiLanguage:'auto'},pinnedGames:[pin(1),pin(2)],pinnedGameFolders:[],
      rcPlaytimeHistory:{version:1,currentUserId:123,accounts:[{userId:123,name:'Player',displayName:'Player',games:[game(1),game(2),game(3)]}],active:null,status:{kind:'idle',checkedAt:1800000000000}}}));
    window.readSaved=()=>JSON.parse(localStorage.getItem('data'));
    window.chrome={i18n:{getUILanguage:()=> 'id'},storage:{local:{async get(keys){if(keys==='customBackground'&&location.search.includes('slow')&&!window.preferencesReleased)return new Promise(resolve=>waiting.push(resolve));return readSaved()},async set(values){
      const old=readSaved();localStorage.setItem('data',JSON.stringify({...old,...values}));changed.forEach(fn=>fn(Object.fromEntries(Object.entries(values).map(([key,newValue])=>[key,{oldValue:old[key],newValue}])),'local'));
    }},onChanged:{addListener:fn=>changed.push(fn)}},runtime:{id:'test-extension',lastError:null,getURL:file=>'/'+file,
      onMessage:{addListener:fn=>messages.push(fn)},sendMessage(message,callback){
        if(message.type==='rc-pinned-games'){pinRequests.push(message);for(const fn of messages)if(fn(message,{id:'test-extension',url:'https://www.roblox.com'+location.pathname,frameId:0},callback))return;callback();return}
        queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:123,name:'Player',displayName:'Indonesian Player',imageUrl:location.origin+'/image.svg'}:
          message.type==='rc-playtime'?RobloxCustomizerPlaytime.snapshot(readSaved().rcPlaytimeHistory,true):{ok:true,servers:[],games:[],folders:[]}));
      }}};
    window.fetch=async address=>{const url=new URL(address);let data;
      if(url.hostname==='apis.roblox.com')data={universeId:Number(url.pathname.match(/places\\/(\\d+)/)[1])+1000};
      else if(url.hostname==='games.roblox.com')data={data:url.searchParams.get('universeIds').split(',').map(Number).map(id=>({id,rootPlaceId:id-1000,name:'Game '+(id-1000)}))};
      else if(url.hostname==='thumbnails.roblox.com')data={data:[]};else data={data:[]};return{ok:true,json:async()=>data};};
    window.go=route=>{history.pushState({},'',route);const current=RobloxCustomizerRoutes.pathname(route),id=Number(current.match(/^\\/games\\/(\\d+)/)?.[1]);
      document.querySelector('main').innerHTML=id?'<div id="game-detail-page" data-place-id="'+id+'"><div id="game-detail-meta-data" data-place-id="'+id+'" data-universe-id="'+(id+1000)+'"></div><h1>Game '+id+'</h1><div class="game-calls-to-action"><button id="native-play">Mainkan</button></div></div>':
        '<div id="HomeContainer"><section class="friend-carousel-container"><h2>Teman</h2></section><section><h2>Direkomendasikan untuk Anda</h2><a class="game-card-container" href="/id/games/400/Example">Example</a></section></div>';dispatchEvent(new PopStateEvent('popstate'));};go(location.pathname+location.search);
  </script><script src="/src/home/pinned-games-core.js"></script><script src="/${worker}"></script>
  ${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('localized Home keeps pins and folders when hidden, reloaded, and restored across game navigation',
  { skip: !process.env.CHROME_BIN, timeout: 90000 }, async t => {
    const assets = new Set([...scripts, ...styles, worker, 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : file === 'image.svg' ? 'image/svg+xml' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : file === 'image.svg' ? artwork : fixture());
    });
    await new Promise(resolve => server.listen(Number(process.env.LOCALIZED_HOME_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'localized-home');
    browser.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Fetch.requestPaused') browser.send('Fetch.fulfillRequest', {
        requestId: message.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }], body: Buffer.from(artwork).toString('base64')
      }).catch(() => {});
    });
    await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://tr.rbxcdn.com/*' }] });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    const url = `http://127.0.0.1:${server.address().port}/id/home`;
    await browser.send('Page.navigate', { url }); await waitForDocument(browser, '#HomeContainer', url);
    const homeReady = "document.querySelector('.rc-home-greeting-avatar img')?.naturalWidth>0 && document.querySelectorAll('.rc-playtime-tile img').length===3 && [...document.querySelectorAll('.rc-playtime-tile img')].every(n=>n.naturalWidth>0) && document.querySelectorAll('.rc-pinned-game-card').length>=2";
    await browser.waitFor(homeReady);
    assert.equal(await browser.evaluate('location.pathname'), '/id/home');
    assert.equal(await browser.evaluate('RobloxCustomizerI18n.locale()'), 'id');
    assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-ui-active') && document.documentElement.hasAttribute('data-rc-home-friends')"), true);
    assert.equal(await browser.evaluate("document.querySelector('.rc-home-greeting-username').textContent"), '@Player');
    await browser.click('.rc-pinned-folder-new');
    await browser.evaluate("const name=document.querySelector('#rc-pinned-folder-name');name.value='Indonesia';name.dispatchEvent(new Event('input',{bubbles:true}))");
    await browser.click('.rc-pinned-folder-editor button[type=submit]');
    await browser.waitFor('readSaved().pinnedGameFolders.length===1');
    const folderId = await browser.evaluate('readSaved().pinnedGameFolders[0].id');
    await browser.waitFor("document.querySelector('.rc-pinned-folder-editor').hidden && !document.querySelector('.rc-pinned-folder-new').disabled");
    await browser.click('.rc-pinned-folder-filter[data-folder-id="*"]');
    await browser.waitFor(`!!document.querySelector('[data-universe-id="1001"] .rc-pinned-game-move:not(:disabled)') && [...document.querySelector('[data-universe-id="1001"] .rc-pinned-game-move').options].some(option=>option.value==='${folderId}')`);
    await browser.evaluate(`(()=>{const select=document.querySelector('[data-universe-id="1001"] .rc-pinned-game-move');select.value='${folderId}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await browser.waitFor(`readSaved().pinnedGames.find(game=>game.universeId===1001)?.folderId==='${folderId}'`).catch(async error => {
      t.diagnostic(await browser.evaluate("JSON.stringify({pins:readSaved().pinnedGames,folders:readSaved().pinnedGameFolders,requests:pinRequests,notice:document.querySelector('#rc-pinned-games-notification')?.textContent,options:[...document.querySelector('[data-universe-id=\"1001\"] .rc-pinned-game-move').options].map(n=>[n.value,n.textContent])})"));
      throw error;
    });
    await browser.send('Page.reload'); await waitForDocument(browser, '#HomeContainer', url); await browser.waitFor(homeReady);
    await browser.click(`.rc-pinned-folder-filter[data-folder-id="${folderId}"]`);
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
    await browser.evaluate("go('/id/games/300/Test')");
    await browser.waitFor("!!document.querySelector('#rc-pin-game')");
    await browser.click('#rc-pin-game');
    await browser.waitFor("!document.querySelector('.rc-game-pin-folder').hidden && !document.querySelector('#rc-pin-game-folder').disabled");
    await browser.evaluate(`(()=>{const select=document.querySelector('#rc-pin-game-folder');select.value='${folderId}';select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    await browser.click('#rc-confirm-pin-game');
    await browser.waitFor('readSaved().pinnedGames.length===3');
    await browser.evaluate("go('/id-id/home')"); await browser.waitFor(homeReady);
    await browser.click(`.rc-pinned-folder-filter[data-folder-id="${folderId}"]`);
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===2");
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal(await browser.evaluate("document.querySelector('#rc-home-greeting').scrollWidth<=document.querySelector('#rc-home-greeting').clientWidth+1"), true);
    await browser.evaluate("go('/home')"); await browser.waitFor(homeReady);
    assert.equal(await browser.evaluate('readSaved().pinnedGames.length'), 3);
    const pinnedData = await browser.evaluate('({games:readSaved().pinnedGames,folders:readSaved().pinnedGameFolders})');
    const visible = selector => browser.evaluate(`!!document.querySelector(${JSON.stringify(selector)})?.checkVisibility()`);
    const openSettings = async () => {
      await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
      await browser.evaluate("document.querySelector('.rc-settings-menu-entry').click()");
      await browser.waitFor("!!document.querySelector('#rc-show-pinned-games')");
      await browser.click('.rc-settings-nav-button[data-rc-settings-category="pinned-games"]');
    };
    const checkLibrary = async () => {
      await browser.waitFor("document.querySelectorAll('#rc-saved-pinned-games li').length===3");
      const savedOptions = await browser.evaluate("[...document.querySelector('#rc-saved-pinned-folder').options].map(n=>[n.value,n.textContent])");
      assert.equal(savedOptions.length, 3);
      assert.deepEqual(savedOptions.find(([id])=>id===folderId), [folderId, 'Indonesia (2)']);
      await browser.evaluate(`(()=>{const filter=document.querySelector('#rc-saved-pinned-folder');filter.value='${folderId}';filter.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('#rc-saved-pinned-games a')].map(n=>new URL(n.href).pathname)"), ['/games/1','/games/300']);
      await browser.evaluate("(()=>{const filter=document.querySelector('#rc-saved-pinned-folder');filter.value='*';filter.dispatchEvent(new Event('change',{bubbles:true}))})()");
    };
    for (const [locale, prefix, label] of [['zh-CN','zh-cn','启用置顶游戏'],['zh-TW','zh-tw','啟用釘選遊戲'],
      ['id','id','Aktifkan Game yang Disematkan'],['ja','ja','ゲームのピン留めを有効にする'],['th','th','เปิดใช้การปักหมุดเกม'],['ko','ko','게임 고정 기능 사용'],['en','','Enable Pinned Games']]) {
      await openSettings();
      await browser.evaluate(`(()=>{const language=document.querySelector('#rc-ui-language');language.value='${locale}';language.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      await browser.waitFor(`document.querySelector('label[for="rc-show-pinned-games"] span').textContent===${JSON.stringify(label)}`);
      assert.equal(await browser.evaluate("document.querySelector('#rc-show-pinned-games').checked"), true);
      await checkLibrary();
      await browser.click('#rc-show-pinned-games');
      await browser.waitFor("readSaved().customBackground.showPinnedGames===false && !document.querySelector('#rc-pinned-games')");
      assert.equal(await visible('#rc-home-greeting'), true, 'Hiding pins leaves the banner visible');
      await checkLibrary();
      await browser.click('#rc-done');
      await browser.evaluate(`go('/${prefix ? prefix+'/' : ''}games/300/Test')`);
      await browser.waitFor("!!document.querySelector('#game-detail-page') && !document.querySelector('.rc-game-pin-control, .rc-game-pin-folder')");
      assert.equal(await visible('#native-play'), true, 'Disabling pins preserves native game actions');
      await openSettings();
      await checkLibrary();
      await browser.click('#rc-done');
      const route = `/${prefix ? prefix+'/' : ''}home`;
      await browser.evaluate(`go(${JSON.stringify(route)})`);
      await browser.waitFor("!!document.querySelector('#rc-home-greeting')");
      assert.equal(await visible('#rc-pinned-games'), false, `${locale}: SPA remount stays hidden`);
      const reloadURL = new URL(route + '?slow=1', url).href;
      await browser.send('Page.navigate', { url: reloadURL });
      await waitForDocument(browser, '#HomeContainer', reloadURL);
      await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-hide-pinned-games')"), true);
      assert.equal(await visible('#rc-pinned-games'), false, `${locale}: cached visibility applies before preferences finish loading`);
      assert.equal(await browser.evaluate('pinRequests.length'), 0, 'Disabled pins do not refresh game metadata');
      await browser.evaluate('releasePreferences()');
      await openSettings();
      assert.equal(await browser.evaluate('RobloxCustomizerI18n.locale()'), locale, 'Reload keeps the selected extension language');
      assert.equal(await browser.evaluate("document.querySelector('#rc-show-pinned-games').checked"), false);
      await checkLibrary();
      await browser.click('#rc-home-show-banner');
      await browser.click('#rc-show-pinned-games');
      await browser.waitFor("readSaved().customBackground.showPinnedGames===true && document.querySelectorAll('.rc-pinned-game-card').length===3");
      assert.equal(await visible('#rc-pinned-games'), true, 'Pins can be shown while the banner is disabled');
      assert.equal(await visible('#rc-home-greeting'), false);
      assert.deepEqual(await browser.evaluate('({games:readSaved().pinnedGames,folders:readSaved().pinnedGameFolders})'), pinnedData,
        'Visibility preserves every saved game and its folder');
      assert.equal(await browser.evaluate("pinRequests.every(request=>request.action==='list')"), true, 'Visibility never sends a pin mutation');
      await browser.click('#rc-home-show-banner');
      await browser.click('#rc-done');
      await browser.waitFor(homeReady);
    }
    await browser.evaluate("go('/games/300/Test')");
    await browser.waitFor("!!document.querySelector('#rc-pin-game:not(:disabled)') && !document.querySelector('.rc-game-pin-folder').hidden");
    await browser.evaluate("window.oldPinButton=document.querySelector('#rc-pin-game')");
    await openSettings();
    await browser.click('#rc-show-pinned-games');
    await browser.waitFor("readSaved().customBackground.showPinnedGames===false && !document.querySelector('.rc-game-pin-control, .rc-game-pin-folder')");
    const requestsBefore = await browser.evaluate('pinRequests.length');
    await browser.evaluate('oldPinButton.click()');
    assert.equal(await browser.evaluate('pinRequests.length'), requestsBefore, 'Detached buttons cannot mutate saved pins while disabled');
    await checkLibrary();
    await browser.click('#rc-done');
    await browser.send('Page.reload');
    await waitForDocument(browser, '#game-detail-page');
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await browser.evaluate("!!document.querySelector('.rc-game-pin-control, .rc-game-pin-folder')"), false, 'Game page reloads keep the whole feature disabled');
    assert.equal(await browser.evaluate('pinRequests.length'), 0);
    await openSettings();
    await checkLibrary();
    await browser.evaluate('chrome.storage.local.set({customBackground:{...readSaved().customBackground,showPinnedGames:true}})');
    await browser.waitFor("document.querySelector('#rc-show-pinned-games').checked && !!document.querySelector('#rc-pin-game:not(:disabled)')");
    assert.equal(await browser.evaluate("document.querySelector('.rc-game-pin-folder').hidden"), false, 'Re-enabling restores pin and folder controls on the current game page');
    assert.deepEqual(await browser.evaluate('({games:readSaved().pinnedGames,folders:readSaved().pinnedGameFolders})'), pinnedData);
    // The library stays usable while disabled, including empty folders, large collections,
    // and updates from another tab. Names remain literal user content.
    await browser.click('#rc-show-pinned-games');
    await browser.evaluate(`chrome.storage.local.set({pinnedGames:[...readSaved().pinnedGames,...Array.from({length:30},(_,i)=>({placeId:900+i,universeId:1900+i,name:i===29?'Search <img src=x>':'Saved '+i,iconUrl:'',updatedAt:Date.now()}))],pinnedGameFolders:[...readSaved().pinnedGameFolders,{id:'empty',name:'Hide <img src=x>'}]})`);
    await browser.waitFor("document.querySelectorAll('#rc-saved-pinned-games li').length===24 && document.querySelector('#rc-saved-pinned-folder').options.length===4");
    assert.equal(await visible('#rc-saved-pinned-more'), true);
    await browser.click('#rc-saved-pinned-more');
    await browser.waitFor("document.querySelectorAll('#rc-saved-pinned-games li').length===33");
    assert.equal(await visible('#rc-saved-pinned-more'), false);
    assert.equal(await browser.evaluate("document.querySelector('#rc-saved-pinned-games li:last-child .rc-saved-pin-name').textContent"), 'Search <img src=x>');
    assert.equal(await browser.evaluate("document.querySelector('#rc-saved-pinned-folder option[value=empty]').textContent"), 'Hide <img src=x> (0)');
    for (const [width, theme] of [[1360,'dark'],[360,'light']]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`document.documentElement.className='${theme}-theme'`);
      assert.equal(await browser.evaluate("(()=>{const dialog=document.querySelector('.rc-settings-dialog'),list=document.querySelector('#rc-saved-pinned-games');return dialog.scrollWidth<=dialog.clientWidth+1&&list.scrollWidth<=list.clientWidth+1})()"), true, `${theme}/${width}: saved games fit the settings panel`);
    }
    if (process.env.PINNED_SETTINGS_SCREENSHOT) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.click('.rc-settings-nav-button[data-rc-settings-category="pinned-games"]');
      const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(process.env.PINNED_SETTINGS_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
    await browser.evaluate("(()=>{const filter=document.querySelector('#rc-saved-pinned-folder');filter.value='empty';filter.dispatchEvent(new Event('change',{bubbles:true}))})()");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-saved-pinned-games li').length"), 0);
    assert.equal(await visible('#rc-saved-pinned-status'), true);
    await browser.evaluate("chrome.storage.local.set({pinnedGames:readSaved().pinnedGames.map((game,i)=>i===0?{...game,folderId:'empty'}:game)})");
    await browser.waitFor("document.querySelectorAll('#rc-saved-pinned-games li').length===1");
    await browser.evaluate("chrome.storage.local.set({pinnedGameFolders:readSaved().pinnedGameFolders.filter(folder=>folder.id!=='empty')})");
    await browser.waitFor("document.querySelector('#rc-saved-pinned-folder').value==='*' && document.querySelectorAll('#rc-saved-pinned-games li').length===24");
    await browser.evaluate('chrome.storage.local.set({pinnedGames:[],pinnedGameFolders:[]})');
    await browser.waitFor("document.querySelectorAll('#rc-saved-pinned-games li').length===0 && document.querySelector('#rc-saved-pinned-folder').options.length===2");
    assert.equal(await visible('#rc-saved-pinned-status'), true, 'Empty libraries have a readable status');
    assert.equal(await visible('#rc-saved-pinned-more'), false);
    assert.deepEqual(browser.errors, []);
  });
