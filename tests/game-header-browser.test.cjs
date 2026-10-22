const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/runtime.js',
  'src/shared/native-labels.js', 'src/shared/i18n.js', 'src/shared/startup.js', 'src/settings/settings.js',
  'src/pages/games/game-page.js', 'src/home/pinned-games-core.js', 'src/home/pinned-games.js',
  'src/playtime/playtime-core.js', 'src/playtime/playtime.js', 'src/notes/game-notes-core.js', 'src/notes/game-notes.js'];

function fixture() {
  return `<!doctype html><html lang="en" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*{box-sizing:border-box}body{margin:0;font:15px/1.5 Arial;background:linear-gradient(120deg,#ae715a,#355674);min-height:100vh;color:white}button{font:inherit}#content{width:min(1100px,calc(100% - 32px));margin:24px auto}h1,h2,h3{padding:5px 0}#settings-popover-menu{position:fixed;right:0;top:0;z-index:1000}
  #game-details-carousel-container{aspect-ratio:16/9;background:linear-gradient(145deg,#173e54,#558ca2 45%,#de8f52)}.fixture-art{height:100%;display:flex;align-items:center;justify-content:center;font-size:clamp(24px,5vw,56px);font-weight:900;letter-spacing:.08em;color:#fffd;text-shadow:0 4px 10px #0006}
  .favorite-follow-vote-share{list-style:none}.favorite-follow-vote-share button{padding:0;border:0;background:transparent;color:inherit;cursor:pointer}.vote-container{position:absolute;top:30px;background:#ffffff30}.vote-percentage{height:100%;width:92%;background:#66cfa1}.vote-numbers{position:absolute;top:32px;transform:translateY(-6px)}.btn-common-play-game-lg{font-size:26px;color:white}</style>
  ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="content"><div id="game-detail-page" data-place-id="606849621"><input id="game-detail-meta-data" type="hidden" data-place-id="606849621" data-universe-id="245662005"><div class="game-main-content">
  <div id="game-details-carousel-container"><div class="fixture-art">JAILBREAK</div></div><div class="game-calls-to-action"><div class="game-title-container"><h1 class="game-name">Jailbreak</h1><div class="game-creator"><span class="text-label">By</span><a class="text-name" href="#creator">Badimo ✓</a></div><div id="game-age-recommendation-container"><span>Maturity: Mild</span></div></div><div class="game-buttons-container"><div id="game-details-play-button-container"><button class="btn-common-play-game-lg" onclick="nativeClicks.play++">▶</button></div>
  <ul class="favorite-follow-vote-share"><li class="game-favorite-button-container"><div class="favorite-button"><button id="toggle-game-favorite" onclick="nativeClicks.favorite++"><span class="icon-favorite">★</span><span class="icon-label">Favorite</span></button></div></li><li class="game-follow-button-container"><div class="follow-button"><button id="native-follow" onclick="nativeClicks.follow++"><span class="icon-notifications-bell">♧</span><span class="icon-label">Notify</span></button></div></li><li class="voting-panel"><div class="users-vote"><button class="upvote" onclick="nativeClicks.vote++">👍</button><div class="vote-details"><div class="vote-container"><div class="vote-percentage"></div></div><div class="vote-numbers"><span class="count-left">5M+</span><span class="count-right">812K+</span></div></div><button class="downvote">👎</button></div></li></ul></div></div></div><section id="about"><h2>Description</h2><p>Native game description.</p></section></div></main>
  <script>
  window.nativeClicks={play:0,favorite:0,follow:0,vote:0};window.saved={customBackground:{source:'none',glassBlur:23,glassOpacity:62},pinnedGames:[{universeId:245662005,placeId:606849621,name:'Jailbreak',pinnedAt:1800000000000}],pinnedGameFolders:[{id:'strategy',name:'Strategy & reminders'}]};
  const listeners=[];window.setSaved=async patch=>{const changes={};for(const[key,value]of Object.entries(patch)){changes[key]={oldValue:saved[key],newValue:structuredClone(value)};saved[key]=structuredClone(value)}listeners.forEach(fn=>fn(changes,'local'))};
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(){return structuredClone(saved)},set:setSaved},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,id:'header-extension',getURL:file=>'/'+file,sendMessage(message,callback){const work=async()=>{
    if(message.type==='rc-game-notes'){await setSaved({rcGameNotes:RobloxCustomizerGameNotes.update(saved.rcGameNotes,message.context,message.text)});return{ok:true,data:saved.rcGameNotes}}
    if(message.type==='rc-pinned-games'){if(message.action==='move')await setSaved({pinnedGames:saved.pinnedGames.map(game=>({...game,folderId:message.folderId}))});return{ok:true,games:saved.pinnedGames,folders:saved.pinnedGameFolders}}
    if(message.type==='rc-playtime')return{ok:true,enabled:true,account:{userId:123,name:'Player'},games:[{universeId:245662005,placeId:606849621,name:'Jailbreak',totalMs:540000,sessions:1,firstPlayedAt:1800000000000,lastPlayedAt:1800000000000}],status:{kind:'idle',checkedAt:1800000000000},activeUniverseId:0};
    return{id:123,name:'Player',displayName:'Player'}
  };if(callback){work().then(callback);return}return work()}}};
  </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Game header keeps combined pin, notes and playtime controls compact without crowding native actions',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(files.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_HEADER_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'game-header');
    await browser.send('Emulation.setFocusEmulationEnabled', {enabled:true});
    await browser.send('Page.navigate', {url:`http://127.0.0.1:${server.address().port}/games/606849621/Jailbreak`});
    await waitForDocument(browser, '#rc-game-notes');
    await browser.waitFor("!!document.querySelector('.rc-game-pin-folder-toggle') && !document.querySelector('.rc-game-notes-toggle').disabled && document.querySelector('.rc-playtime-game-total')?.textContent==='9m'");
    assert.equal(await browser.evaluate("!!(document.getElementById('rc-game-notes').compareDocumentPosition(document.getElementById('rc-playtime-game-page')) & Node.DOCUMENT_POSITION_FOLLOWING)"), true, 'Keyboard and visual reading order agree');
    await browser.evaluate("window.originalNative=[...document.querySelectorAll('.game-title-container,.game-buttons-container,#toggle-game-favorite,#native-follow,.upvote')];window.nativeParents=originalNative.map(node=>node.parentElement)");
    const shot = async name => {
      if (!process.env.GAME_HEADER_SCREENSHOT_DIR) return;
      await browser.evaluate('scrollTo(0,0)');
      const image = await browser.send('Page.captureScreenshot', {format:'png',captureBeyondViewport:true});
      fs.writeFileSync(path.join(process.env.GAME_HEADER_SCREENSHOT_DIR, `game-header-${name}.png`), Buffer.from(image.data,'base64'));
    };
    for (const locale of ['en','zh-CN','zh-TW','id','ja','th','ko']) for (const theme of ['dark','light']) for (const width of [1280,878,801,700,390,320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
      await browser.evaluate(`document.documentElement.className='${theme}-theme';document.body.className='${theme}-theme';RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)});document.getElementById('content').style.fontFamily='Courier New,monospace'`);
      const state = await browser.evaluate(`(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height,width:r.width}};const header=document.querySelector('.game-main-content'),row=header.querySelector('.favorite-follow-vote-share');return{overflow:document.documentElement.scrollWidth>innerWidth+1||header.scrollWidth>header.clientWidth+1,header:rect(header),notes:rect(document.getElementById('rc-game-notes')),folder:rect(document.querySelector('.rc-game-pin-folder')),fieldsHidden:document.getElementById('rc-game-pin-folder-fields').hidden,hintHidden:document.querySelector('.rc-game-notes-hint').hidden,emptyHidden:document.querySelector('.rc-game-notes-preview').hidden,statusHidden:document.getElementById('rc-game-notes-status').hidden,row:rect(row),items:[...row.children].map(rect),labels:[...row.querySelectorAll('.icon-label')].map(n=>({box:rect(n),fits:n.scrollWidth<=n.clientWidth+1})),nativePreserved:originalNative.every((n,i)=>n.isConnected&&n.parentElement===nativeParents[i])}})()`);
      const label = `${locale}/${theme}/${width}`;
      assert.equal(state.overflow, false, label);
      assert.equal(state.nativePreserved, true, label);
      assert.equal(state.fieldsHidden && state.hintHidden && state.emptyHidden && state.statusHidden, true, label);
      assert.ok(state.notes.height <= 70 && state.folder.height <= 55, `${label}: empty notes and saved folder stay compact`);
      assert.ok(state.items.every(item=>item.x>=state.row.x-1&&item.right<=state.row.right+1), `${label}: native actions fit`);
      assert.ok(state.labels.every(item=>item.fits), `${label}: action text fits without tiny type`);
      assert.ok(state.items[3].y>=Math.max(...state.items.slice(0,3).map(item=>item.bottom)), `${label}: votes have their own row`);
      if (width===878) assert.ok(state.header.height<640, `${label}: the complete header is shorter`);
      if (locale==='en' && [878,390].includes(width) && theme==='dark') await shot(`collapsed-${width}`);
    }
    await browser.send('Emulation.setDeviceMetricsOverride', {width:878,height:1000,deviceScaleFactor:1,mobile:false});
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en');document.documentElement.className='dark-theme';document.body.className='dark-theme'");
    await browser.click('.rc-game-pin-folder-toggle');
    await browser.waitFor("!document.querySelector('#rc-game-pin-folder-fields').hidden");
    await browser.evaluate("document.getElementById('rc-pin-game-folder').value='strategy';document.getElementById('rc-pin-game-folder').dispatchEvent(new Event('change',{bubbles:true}))");
    await browser.waitFor("saved.pinnedGames[0].folderId==='strategy' && document.querySelector('.rc-game-pin-folder-name').textContent==='Strategy & reminders'");
    await browser.evaluate("document.getElementById('rc-pin-game-folder').focus()");
    await browser.send('Input.dispatchKeyEvent', {type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await browser.send('Input.dispatchKeyEvent', {type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await browser.waitFor("document.getElementById('rc-game-pin-folder-fields').hidden && document.activeElement.classList.contains('rc-game-pin-folder-toggle')");
    await browser.click('.rc-game-notes-toggle');
    await browser.waitFor("!document.querySelector('#rc-game-notes-editor').hidden && !document.querySelector('.rc-game-notes-hint').hidden");
    await browser.evaluate("document.querySelector('textarea').value='Remember the strategy for this game.\\nSecond line of notes.';document.querySelector('textarea').dispatchEvent(new Event('input',{bubbles:true}));RobloxCustomizerGameNotesUI.flush()");
    await browser.waitFor("saved.rcGameNotes?.notes.length===1 && document.querySelector('#rc-game-notes-status').textContent==='Note saved.'");
    await shot('editor-878');
    await browser.click('.rc-game-notes-toggle');
    await browser.waitFor("document.querySelector('#rc-game-notes-editor').hidden");
    assert.equal(await browser.evaluate("document.querySelector('#rc-game-notes-status').hidden"), true);
    await shot('saved-878');
    await browser.evaluate("setSaved({pinnedGameFolders:[{id:'strategy',name:'Folder <img> '+ '長名稱'.repeat(40)}]});document.querySelector('.game-name').textContent='A long game title '.repeat(8)");
    await pause(150);
    for (const width of [878,320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', {width,height:1200,deviceScaleFactor:1,mobile:false});
      assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'Long game and private folder names stay inside the page');
      assert.equal(await browser.evaluate("!!document.querySelector('.rc-game-pin-folder img')"), false);
    }
    await browser.send('Emulation.setDeviceMetricsOverride', {width:878,height:1000,deviceScaleFactor:1,mobile:false});
    for (const selector of ['.btn-common-play-game-lg','#toggle-game-favorite','#native-follow','.upvote']) await browser.click(selector);
    assert.deepEqual(await browser.evaluate('nativeClicks'), {play:1,favorite:1,follow:1,vote:1});
    await browser.evaluate("document.documentElement.setAttribute('data-rc-hide-pinned-games','');document.dispatchEvent(new Event('rc-pinned-games-visibility-changed'))");
    await browser.waitFor("!document.querySelector('#rc-pin-game')");
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'Actions still fit with Pinned Games disabled');
    assert.deepEqual(browser.errors, []);
  });
