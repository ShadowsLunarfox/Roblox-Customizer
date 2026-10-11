// Packaged content scripts and the real pin worker against local Roblox API fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const scripts = [...new Set(manifest.content_scripts.flatMap(entry => entry.js || []))];
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const worker = 'src/background/pinned-games-background.js';
const assets = new Set([...scripts, ...styles, worker]);

async function checkGlass(browser, selectors, blur, alpha) {
  const styles = await browser.evaluate(`Array.from(document.querySelectorAll(${JSON.stringify(selectors)}),node=>{
    const style=getComputedStyle(node),parts=style.backgroundColor.match(/[\\d.]+/g);
    return {filter:style.backdropFilter,alpha:parts.length===4?Number(parts[3]):1}
  })`);
  assert.ok(styles.length > 0, 'Glass controls exist');
  for (const style of styles) {
    assert.equal(style.filter, `blur(${blur}px) saturate(1.2)`, 'Controls follow the shared blur setting');
    assert.ok(Math.abs(style.alpha - alpha) < .01, 'Controls follow glass opacity and the light-theme contrast floor');
  }
}

function fixture() {
  return `<!doctype html><html lang="en" data-rc-ui-active><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
  <style>body{margin:0;background:var(--rc-surface);color:var(--rc-text);font:16px/1.5 Arial}.pin-wallpaper{position:fixed;inset:0;z-index:-1;background:repeating-linear-gradient(120deg,#7e4e59 0 35px,#426a7d 35px 70px,#789374 70px 105px)}main{box-sizing:border-box;max-width:1100px;margin:auto;padding:16px}.friend-carousel-container,#native-recommendations{padding:16px}.game-calls-to-action{width:340px;max-width:100%}</style>
  </head><body class="dark-theme"><div class="pin-wallpaper" aria-hidden="true"></div><main></main><script>
    const messageListeners=[],storageListeners=[];
    const record=id=>({placeId:id,universeId:id+1000,name:id===1?'Search':'Adventure '+id+' — 長名稱 <img onerror=alert(1)>',iconUrl:'',updatedAt:Date.now()});
    if(!localStorage.getItem('seeded')){localStorage.setItem('pinnedGames',JSON.stringify(Array.from({length:60},(_,i)=>record(i+1))));localStorage.setItem('seeded','yes')}
    const read=()=>({pinnedGames:JSON.parse(localStorage.getItem('pinnedGames')||'[]'),pinnedGameFolders:JSON.parse(localStorage.getItem('pinnedGameFolders')||'[]'),customBackground:{source:'none',uiLanguage:'auto'}});
    function emit(changes){storageListeners.forEach(fn=>fn(changes,'local'))}
    window.chrome={i18n:{getUILanguage:()=> 'en'},runtime:{id:'test-extension',lastError:null,getURL:file=>'/'+file,
      onMessage:{addListener:fn=>messageListeners.push(fn)},
      sendMessage(message,callback){
        if(message.type==='rc-pinned-games'){const reply=response=>{if(window.holdMoveResponse&&message.action==='move')window.releaseMove=()=>callback(response);else callback(response)};for(const listener of messageListeners)if(listener(message,{id:'test-extension',url:'https://www.roblox.com'+location.pathname},reply)===true)return;callback();return}
        setTimeout(()=>callback({error:'No optional fixture data'}),0)
      }
    },storage:{onChanged:{addListener:fn=>storageListeners.push(fn)},local:{
      async get(){return read()},async set(value){
        if(window.failStorage)throw new Error('Storage unavailable');
        const changes={};for(const [key,newValue] of Object.entries(value)){const oldValue=read()[key];localStorage.setItem(key,JSON.stringify(newValue));changes[key]={oldValue,newValue}}emit(changes)
      }
    }}};
    addEventListener('storage',event=>{if(['pinnedGames','pinnedGameFolders'].includes(event.key))emit({[event.key]:{newValue:JSON.parse(event.newValue||'null')}})});
    window.apiRequests=[];
    window.fetch=async address=>{
      const url=new URL(address);apiRequests.push(url.href);let data;
      if(url.hostname==='apis.roblox.com')data={universeId:Number(url.pathname.match(/places\\/(\\d+)/)[1])+1000};
      else if(url.hostname==='games.roblox.com')data={data:url.searchParams.get('universeIds').split(',').map(Number).map(id=>({id,rootPlaceId:id-1000,name:'Game '+(id-1000)}))};
      else if(url.hostname==='thumbnails.roblox.com')data={data:[]};
      else throw new Error('Unexpected network request');
      return {ok:true,json:async()=>data}
    };
    window.go=route=>{history.pushState({},'',route);const id=Number(route.match(/^\\/games\\/(\\d+)/)?.[1]);document.querySelector('main').innerHTML=id?
      '<div id="game-detail-page" data-place-id="'+id+'"><div id="game-detail-meta-data" data-place-id="'+id+'" data-universe-id="'+(id+1000)+'"></div><h1>Game '+id+'</h1><div class="game-calls-to-action"><button id="native-play" disabled>Private experience</button></div></div>':
      '<div id="HomeContainer"><section class="friend-carousel-container"><h2>Friends</h2></section><section id="native-recommendations"><h2>Recommended For You</h2><p>Native recommendations</p></section></div>'};go(location.pathname);
  </script><script src="/src/home/pinned-games-core.js"></script><script src="/${worker}"></script>
  ${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('pin folders preserve existing pins, categorize across tabs and locales, and support large libraries',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', assets.has(file) ? (file.endsWith('.css') ? 'text/css' : 'text/javascript') : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(Number(process.env.PINNED_GAMES_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const browser = await isolatedChrome(t, 'pinned-folders');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const url = `http://127.0.0.1:${server.address().port}/home`;
    await browser.send('Page.navigate', { url });
    await browser.send('Page.bringToFront');
    await waitForDocument(browser, '.rc-pinned-game-card', url);
    const saved = expression => browser.evaluate(`JSON.parse(localStorage.getItem('${expression}'))`);
    const filter = id => `.rc-pinned-folder-filter[data-folder-id="${id}"]`;
    const pick = async id => {
      await browser.click(filter(id));
      await browser.waitFor(`document.querySelector('${filter(id)}')?.getAttribute('aria-pressed')==='true'`);
    };
    const change = async (selector, value) => {
      await browser.waitFor(`!!document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`);
      return browser.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    };
    const create = async name => {
      await browser.click('.rc-pinned-folder-new');
      await change('#rc-pinned-folder-name', name);
      await browser.click('.rc-pinned-folder-editor button[type="submit"]');
      await browser.waitFor("document.querySelector('.rc-pinned-folder-editor').hidden && !document.querySelector('.rc-pinned-folder-new').disabled");
      const id = (await saved('pinnedGameFolders')).at(-1).id;
      await browser.waitFor(`document.querySelector('${filter(id)}')?.getAttribute('aria-pressed')==='true'`);
      return id;
    };

    assert.equal((await saved('pinnedGames')).length, 60, 'Old pins survive with no folders');
    assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card').length"), 24);
    await browser.click('.rc-pinned-games-more');
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===48");
    await browser.click('.rc-pinned-games-more');
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===60");
    assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-games-more').hidden"), true);
    const first = await create('Search');
    assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-folder-empty').hidden"), false);
    assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-game-card').length"), 0);
    await pick('*');
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===24");
    await change('[data-universe-id="1001"] .rc-pinned-game-move', first);
    await browser.waitFor(`JSON.parse(localStorage.getItem('pinnedGames'))[0].folderId===${JSON.stringify(first)}`);
    await pick(first);
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
    assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-game-card h3').textContent"), 'Search');
    const second = await create('收藏 <img onerror=alert(1)>');
    await pick('*');
    await change('[data-universe-id="1002"] .rc-pinned-game-move', second);
    await browser.waitFor(`JSON.parse(localStorage.getItem('pinnedGames'))[1].folderId===${JSON.stringify(second)}`);
    await pick(second);
    await browser.click('.rc-pinned-folder-rename');
    await change('#rc-pinned-folder-name', '一起玩 — '+ '很長的資料夾名稱'.repeat(7));
    await browser.click('.rc-pinned-folder-editor button[type="submit"]');
    await browser.waitFor("document.querySelector('.rc-pinned-folder-editor').hidden");
    assert.equal((await saved('pinnedGameFolders'))[1].name.length <= 80, true);
    assert.equal(await browser.evaluate("document.querySelectorAll('.rc-pinned-folder-filter img,.rc-pinned-game-card h3 img').length"), 0, 'Names are rendered as text');

    const labels = { en: ['New folder', 'Uncategorized', 'Folder'], 'zh-CN': ['新建文件夹', '未分类', '文件夹'], 'zh-TW': ['新增資料夾', '未分類', '資料夾'] };
    for (const locale of ['en', 'zh-CN', 'zh-TW']) {
      await browser.evaluate(`document.documentElement.lang=${JSON.stringify(locale)};RobloxCustomizerI18n.setLanguage('auto')`);
      await browser.waitFor(`document.querySelector('.rc-pinned-folder-new').textContent===${JSON.stringify(labels[locale][0])}`);
      for (const theme of ['light', 'dark']) for (const width of [1280, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 320 });
        await browser.evaluate(`document.body.className='${theme}-theme'`);
        await pick('*');
        await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===24");
        assert.deepEqual(await browser.evaluate(`[document.querySelector('${filter('').replaceAll("'", "\\'")} span').textContent,document.querySelector('.rc-pinned-game-folder > span').textContent]`), labels[locale].slice(1));
        assert.equal(await browser.evaluate(`document.querySelector('${filter(first)} span').textContent`), 'Search', 'User folder names are never translated');
        assert.equal(await browser.evaluate("document.querySelector('[data-universe-id=\"1001\"] h3').textContent"), 'Search');
        assert.equal(await browser.evaluate(`(()=>{const cards=[...document.querySelectorAll('.rc-pinned-game-card')],inside=cards.every(card=>{const a=card.getBoundingClientRect();return [...card.querySelectorAll('h3,select,.rc-pinned-game-art')].every(node=>{const b=node.getBoundingClientRect();return b.left>=a.left&&b.right<=a.right+1})});return inside&&document.documentElement.scrollWidth<=innerWidth})()`), true, `${locale}/${theme}/${width}: cards and folders fit`);
        assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.rc-pinned-game-move')).color===getComputedStyle(document.body).color"), true, 'Select controls follow the active theme');
        await browser.click('.rc-pinned-folder-new');
        assert.equal(await browser.evaluate(`(()=>{const form=document.querySelector('.rc-pinned-folder-editor'),field=form.elements.name,r=field.getBoundingClientRect(),a=form.getBoundingClientRect();return r.height>=40&&r.width>=150&&r.left>=a.left&&r.right<=a.right&&form.scrollWidth<=form.clientWidth})()`), true, `${locale}/${theme}/${width}: the folder editor stays readable and fits`);
        await browser.evaluate("document.documentElement.style.setProperty('--rc-glass-blur','28px');document.documentElement.style.setProperty('--rc-glass-opacity','.46')");
        await checkGlass(browser, '#rc-pinned-games .rc-pinned-folder-new,#rc-pinned-games .rc-pinned-folder-filter,#rc-pinned-games .rc-pinned-folder-actions button,#rc-pinned-games .rc-pinned-folder-editor,#rc-pinned-games .rc-pinned-folder-editor input,#rc-pinned-games .rc-pinned-folder-editor button,#rc-pinned-games .rc-pinned-game-move,#rc-pinned-games .rc-pinned-games-more', 28, theme === 'light' ? .82 : .46);
        await browser.click('.rc-pinned-folder-cancel');
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");
    await browser.click('.rc-pinned-folder-new');
    await change('#rc-pinned-folder-name', 'Should not save');
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    assert.equal(await browser.evaluate("document.querySelector('.rc-pinned-folder-editor').hidden"), true);
    assert.equal((await saved('pinnedGameFolders')).length, 2);
    await browser.evaluate(`document.querySelector('${filter(first)}').focus()`);
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
    assert.equal(await browser.evaluate(`document.activeElement.dataset.folderId`), first, 'Keyboard filtering preserves focus');

    const target = await browser.send('Target.createTarget', { url });
    const secondary = new browser.constructor(browser.socket.url.replace(/\/devtools\/page\/.+$/, '/devtools/page/' + target.targetId));
    t.after(() => secondary.socket.close());
    await secondary.send('Page.enable');
    await secondary.send('Runtime.enable');
    await secondary.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await waitForDocument(secondary, '.rc-pinned-game-card', url);
    await browser.send('Page.bringToFront');
    await browser.click('.rc-pinned-folder-rename');
    await change('#rc-pinned-folder-name', 'Together');
    await browser.click('.rc-pinned-folder-editor button[type="submit"]');
    await secondary.waitFor(`document.querySelector('${filter(first)} span')?.textContent==='Together'`);
    await secondary.click(filter(first));
    await secondary.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
    await browser.send('Page.bringToFront');
    await browser.click('.rc-pinned-folder-delete');
    await browser.waitFor(`!document.querySelector('${filter(first)}')`);
    await secondary.waitFor(`!document.querySelector('${filter(first)}') && document.querySelectorAll('.rc-pinned-game-card').length===24`);
    assert.equal((await saved('pinnedGames')).length, 60, 'Deleting a folder keeps every game');
    assert.equal((await saved('pinnedGames'))[0].folderId, undefined);
    await pick(second);
    await browser.click('.rc-pinned-game-remove');
    await browser.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===0");
    assert.equal((await saved('pinnedGames')).length, 59);
    assert.equal((await saved('pinnedGameFolders')).length, 1, 'Empty folders remain usable');

    await browser.evaluate("go('/games/61')");
    await browser.waitFor("document.querySelector('#rc-pin-game') && !document.querySelector('#rc-pin-game').disabled");
    await browser.click('#rc-pin-game');
    await browser.waitFor("!document.querySelector('.rc-game-pin-folder').hidden");
    await browser.click('#rc-confirm-pin-game');
    await browser.waitFor("JSON.parse(localStorage.getItem('pinnedGames')).length===60");
    assert.equal(await browser.evaluate("document.querySelector('#native-play').disabled"), true);
    await browser.evaluate("go('/home')");
    await browser.waitFor("!!document.querySelector('.rc-pinned-folder-new')");
    await browser.send('Page.reload');
    await waitForDocument(browser, '.rc-pinned-game-card', url);
    assert.equal((await saved('pinnedGames')).length, 60);
    assert.equal((await saved('pinnedGameFolders')).length, 1);
    await pick(second);
    await browser.waitFor("!document.querySelector('.rc-pinned-folder-empty').hidden");
    await pick('*');
    await browser.evaluate("failStorage=true");
    await change('[data-universe-id="1001"] .rc-pinned-game-move', second);
    await browser.waitFor("document.querySelector('#rc-pinned-games-notification')?.textContent.includes('Could not update')");
    assert.equal(await browser.evaluate("document.querySelector('[data-universe-id=\"1001\"] .rc-pinned-game-move').value"), '');
    assert.equal((await saved('pinnedGames'))[0].folderId, undefined, 'Failed writes roll back the selection');
    await browser.evaluate("failStorage=false");
    await change('[data-universe-id="1001"] .rc-pinned-game-move', second);
    await browser.waitFor(`JSON.parse(localStorage.getItem('pinnedGames'))[0].folderId===${JSON.stringify(second)}`);
    await browser.evaluate("document.querySelector('.friend-carousel-container').outerHTML=document.querySelector('.friend-carousel-container').outerHTML");
    await browser.waitFor("document.querySelector('.friend-carousel-container').nextElementSibling.id==='rc-pinned-games'");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-pinned-games').length"), 1);
    assert.equal(await browser.evaluate("document.querySelector('#native-recommendations').parentElement.id"), 'HomeContainer');
    await pause(250);
    await browser.evaluate("window.pinWrites=0;window.pinObserver=new MutationObserver(records=>pinWrites+=records.length);pinObserver.observe(document.querySelector('#rc-pinned-games'),{subtree:true,childList:true,characterData:true})");
    await pause(1200);
    assert.equal(await browser.evaluate('pinWrites'), 0, 'Settled pin UI does not create observer or translation loops');
    if (process.env.PINNED_FOLDERS_SCREENSHOT) {
      const screenshot = await browser.send('Page.captureScreenshot');
      fs.writeFileSync(process.env.PINNED_FOLDERS_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
    }
    assert.deepEqual(browser.errors, []);
    assert.deepEqual(secondary.errors, []);
  });

test('Pin Game opens a glass folder prompt before saving and moves existing pins across languages, layouts, and tabs',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', assets.has(file) ? (file.endsWith('.css') ? 'text/css' : 'text/javascript') : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(Number(process.env.PINNED_GAMES_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const browser = await isolatedChrome(t, 'game-pin-folders');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await browser.send('Page.navigate', { url: origin + '/games/61' });
    await browser.send('Page.bringToFront');
    await waitForDocument(browser, '#rc-pin-game-folder');
    const storedGame = id => browser.evaluate(`JSON.parse(localStorage.getItem('pinnedGames')).find(game=>game.placeId===${id}) || null`);
    const change = async value => {
      await browser.waitFor("!!document.querySelector('#rc-pin-game-folder') && !document.querySelector('.rc-game-pin-folder').hidden && !document.querySelector('#rc-pin-game-folder').disabled");
      await browser.evaluate(`(()=>{const select=document.querySelector('#rc-pin-game-folder');select.focus();select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    };
    const waitFolder = async value => browser.waitFor(`document.querySelector('#rc-pin-game-folder')?.value===${JSON.stringify(value)} && !document.querySelector('#rc-pin-game-folder').disabled`);
    const openPicker = async () => {
      assert.equal(await browser.evaluate("document.querySelector('.rc-game-pin-folder').hidden"), true, 'An unpinned game does not show the picker before clicking Pin Game');
      await browser.click('#rc-pin-game');
      await browser.waitFor("!document.querySelector('.rc-game-pin-folder').hidden && document.activeElement?.id==='rc-pin-game-folder'");
      assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game').getAttribute('aria-expanded')"), 'true');
    };
    await openPicker();
    assert.equal(await storedGame(61), null, 'Opening the picker saves nothing');
    assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game-folder').options.length"), 1);
    assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game-folder-help').textContent"), 'Create folders in Pinned Games on Home.');
    await browser.click('.rc-cancel-pin-game');
    await browser.waitFor("document.querySelector('.rc-game-pin-folder').hidden");
    assert.equal(await storedGame(61), null, 'Cancel saves nothing');
    assert.equal(await browser.evaluate('document.activeElement.id'), 'rc-pin-game');
    await openPicker();
    await browser.evaluate("document.querySelector('#rc-confirm-pin-game').focus()");
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.waitFor("document.querySelector('.rc-game-pin-folder').hidden");
    assert.equal(await storedGame(61), null, 'Escape saves nothing');
    const folders = [{ id: 'together', name: 'Search' }, { id: 'projects', name: '私人作品 <img onerror=alert(1)> '+ '長名稱'.repeat(12) }];
    await browser.evaluate(`chrome.storage.local.set({pinnedGameFolders:${JSON.stringify(folders)}});window.favoriteClicks=0`);
    await browser.waitFor("document.querySelector('#rc-pin-game-folder').options.length===3");
    const labels = { en: 'Pinned game folder', 'zh-CN': '置顶游戏文件夹', 'zh-TW': '釘選遊戲資料夾' };
    for (const locale of ['en', 'zh-CN', 'zh-TW']) for (const theme of ['dark', 'light']) for (const width of [1280, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 320 });
      await browser.evaluate(`document.body.className='${theme}-theme';document.documentElement.lang=${JSON.stringify(locale)};RobloxCustomizerI18n.setLanguage('auto');go('/games/61')`);
      await browser.waitFor(`document.querySelector('.rc-game-pin-folder label')?.textContent===${JSON.stringify(labels[locale])} && !document.querySelector('#rc-pin-game-folder').disabled`);
      if (width === 1280) {
        await browser.evaluate(`(()=>{const row=document.createElement('ul');row.className='favorite-follow-vote-share';row.innerHTML='<li class="game-favorite-button-container"><button id="toggle-game-favorite">Favorite</button></li>';document.querySelector('.game-calls-to-action').append(row);document.querySelector('#toggle-game-favorite').onclick=()=>favoriteClicks++})()`);
        await browser.waitFor("document.querySelector('#rc-pin-game')?.parentElement.tagName==='LI' && document.querySelector('.favorite-follow-vote-share').nextElementSibling?.classList.contains('rc-game-pin-folder')");
        await browser.click('#toggle-game-favorite');
      }
      await openPicker();
      assert.equal(await browser.evaluate("document.querySelectorAll('#rc-pin-game-folder').length"), 1);
      assert.equal(await browser.evaluate("[...document.querySelector('#rc-pin-game-folder').options].map(option=>option.textContent).slice(1).join('|')"), folders.map(folder => folder.name).join('|'));
      assert.equal(await browser.evaluate("document.querySelectorAll('.rc-game-pin-folder img').length"), 0);
      assert.equal(await browser.evaluate(`(()=>{const panel=document.querySelector('.rc-game-pin-folder').getBoundingClientRect(),select=document.querySelector('#rc-pin-game-folder').getBoundingClientRect();return select.height>=44&&select.width>=150&&select.left>=panel.left&&select.right<=panel.right&&document.documentElement.scrollWidth<=innerWidth})()`), true, `${locale}/${theme}/${width}: selector fits without shrinking`);
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#rc-pin-game-folder')).color===getComputedStyle(document.body).color"), true);
      await browser.evaluate("document.documentElement.style.setProperty('--rc-glass-blur','28px');document.documentElement.style.setProperty('--rc-glass-opacity','.46')");
      const glassSelectors = '.rc-game-pin-folder,#rc-pin-game-folder,.rc-game-pin-folder-actions button,.rc-game-pin-standalone #rc-pin-game';
      await checkGlass(browser, glassSelectors, 28, theme === 'light' ? .82 : .46);
      await browser.evaluate("document.documentElement.style.setProperty('--rc-glass-blur','0px');document.documentElement.style.setProperty('--rc-glass-opacity','.70')");
      await checkGlass(browser, glassSelectors, 0, theme === 'light' ? .82 : .70);
      await browser.evaluate("document.documentElement.style.setProperty('--rc-glass-blur','28px');document.documentElement.style.setProperty('--rc-glass-opacity','.46')");
      await change('projects');
      assert.equal(await storedGame(61), null, 'Choosing a folder alone does not pin the game');
      await browser.evaluate("(()=>{const marker=document.createElement('div');marker.textContent='Late native content';document.querySelector('#game-detail-page').append(marker)})()");
      await waitFolder('projects');
      if (process.env.PINNED_GAME_FOLDER_PREVIEW && ((locale === 'en' && theme === 'dark' && width === 1280)
        || (locale === 'zh-TW' && theme === 'light' && width === 320))) {
        const screenshot = await browser.send('Page.captureScreenshot');
        fs.writeFileSync(process.env.PINNED_GAME_FOLDER_PREVIEW + `-${width}.png`, Buffer.from(screenshot.data, 'base64'));
      }
      await browser.click('#rc-confirm-pin-game');
      await browser.waitFor("document.querySelector('#rc-pin-game').getAttribute('aria-pressed')==='true' && !document.querySelector('#rc-pin-game').disabled");
      assert.equal((await storedGame(61)).folderId, 'projects');
      await change('together');
      await browser.waitFor("JSON.parse(localStorage.getItem('pinnedGames')).find(game=>game.placeId===61)?.folderId==='together'");
      await waitFolder('together');
      assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game').getAttribute('aria-pressed')"), 'true', 'Moving a pin never unpins it');
      await change('');
      await browser.waitFor("!JSON.parse(localStorage.getItem('pinnedGames')).find(game=>game.placeId===61)?.folderId");
      await waitFolder('');
      await browser.click('#rc-pin-game');
      await browser.waitFor("document.querySelector('#rc-pin-game').getAttribute('aria-pressed')==='false' && !document.querySelector('#rc-pin-game').disabled");
    }
    assert.equal(await browser.evaluate('favoriteClicks'), 6, 'Native Favorite actions keep their handlers');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en');go('/games/61')");
    await waitFolder('');
    await openPicker();
    await change('together');
    await browser.click('#rc-confirm-pin-game');
    await browser.waitFor("document.querySelector('#rc-pin-game').getAttribute('aria-pressed')==='true' && !document.querySelector('#rc-pin-game').disabled");
    await browser.send('Page.reload');
    await waitForDocument(browser, '#rc-pin-game-folder');
    await waitFolder('together');

    const target = await browser.send('Target.createTarget', { url: origin + '/home' });
    const secondary = new browser.constructor(browser.socket.url.replace(/\/devtools\/page\/.+$/, '/devtools/page/' + target.targetId));
    t.after(() => secondary.socket.close());
    await secondary.send('Page.enable'); await secondary.send('Runtime.enable');
    await secondary.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await waitForDocument(secondary, '.rc-pinned-folder-filter');
    await secondary.click('.rc-pinned-folder-filter[data-folder-id="together"]');
    await secondary.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
    await browser.send('Page.bringToFront');
    await change('projects');
    await waitFolder('projects');
    await secondary.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===0");
    await secondary.click('.rc-pinned-folder-filter[data-folder-id="projects"]');
    await secondary.waitFor("document.querySelectorAll('.rc-pinned-game-card').length===1");
    await secondary.click('.rc-pinned-folder-rename');
    await secondary.evaluate("document.querySelector('#rc-pinned-folder-name').value='Renamed from Home'");
    await secondary.click('.rc-pinned-folder-editor button[type="submit"]');
    await browser.waitFor("document.querySelector('#rc-pin-game-folder option[value=\"projects\"]')?.textContent==='Renamed from Home'");
    await waitFolder('projects');
    await secondary.click('.rc-pinned-folder-delete');
    await waitFolder('');
    assert.equal((await storedGame(61)).folderId, undefined);
    assert.equal(await browser.evaluate("document.querySelector('#rc-pin-game').getAttribute('aria-pressed')"), 'true');
    await browser.send('Page.bringToFront');
    await browser.evaluate('failStorage=true');
    await change('together');
    await browser.waitFor("document.querySelector('#rc-pinned-games-notification')?.textContent.includes('Could not update')");
    await waitFolder('');
    assert.equal((await storedGame(61)).folderId, undefined, 'A failed move restores the saved selection');
    await browser.evaluate("failStorage=false;holdMoveResponse=true");
    await change('together');
    await browser.waitFor("typeof releaseMove==='function'");
    await browser.evaluate("go('/games/62')");
    await browser.waitFor("document.querySelector('#game-detail-meta-data').dataset.placeId==='62' && document.querySelector('#rc-pin-game-folder')?.value===''");
    await browser.evaluate("holdMoveResponse=false;releaseMove()");
    await waitFolder('');
    await openPicker();
    await browser.click('#rc-confirm-pin-game');
    await browser.waitFor("JSON.parse(localStorage.getItem('pinnedGames')).some(game=>game.placeId===62)");
    assert.equal((await storedGame(62)).folderId, undefined, 'A late response cannot carry the old page selection to another game');
    assert.equal((await storedGame(61)).folderId, 'together');
    await pause(200);
    await browser.evaluate("window.folderWrites=0;window.folderObserver=new MutationObserver(records=>folderWrites+=records.length);folderObserver.observe(document.querySelector('.rc-game-pin-folder'),{subtree:true,childList:true,characterData:true})");
    await pause(1200);
    assert.equal(await browser.evaluate('folderWrites'), 0, 'The game page selector settles without observer or translation loops');
    assert.deepEqual(browser.errors, []);
    assert.deepEqual(secondary.errors, []);
  });
