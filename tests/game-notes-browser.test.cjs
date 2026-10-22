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
  'src/pages/games/game-page.js', 'src/notes/game-notes-core.js', 'src/background/game-notes-background.js',
  'src/notes/game-notes.js'];

function fixture() {
  return `<!doctype html><html lang="en" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:linear-gradient(120deg,#a84958,#283e69);color:white}#content{width:min(1100px,calc(100% - 32px));margin:24px auto}h1,h2,h3{padding:5px 0}.game-buttons-container button{min-height:44px;font:inherit}#game-details-carousel-container{background:linear-gradient(135deg,#3b9bb7,#4e673e);aspect-ratio:16/9}#settings-popover-menu{position:fixed;right:0;top:0;z-index:1000}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="content"></main>
    <script>
      const changed=[],listeners=[];window.nativeClicks=0;window.noteRequests=[];window.saved=JSON.parse(localStorage.getItem('notes-fixture')||'{}');
      window.failNoteWrite=false;window.pauseNoteWrite=false;
      window.gameMarkup=id=>'<div id="game-detail-page" data-place-id="'+id+'"><input id="game-detail-meta-data" type="hidden" data-place-id="'+id+'" data-universe-id="'+(id+1000)+'"><div class="game-main-content"><div id="game-details-carousel-container"></div><div class="game-calls-to-action"><div class="game-title-container"><h1 class="game-name">Game '+id+'</h1><div class="game-creator">By Creator</div></div><div class="game-buttons-container"><button id="native-play" onclick="nativeClicks++">Play</button></div></div></div><section id="about"><h2>Description</h2><p>Native game description</p></section></div>';
      const place=Number(location.pathname.match(/games\\/(\\d+)/)?.[1])||123;document.getElementById('content').innerHTML=gameMarkup(place);
      window.routeTo=(id,render=true)=>{history.pushState({},'',id?'/ko/games/'+id+'/Game':'/home');dispatchEvent(new PopStateEvent('popstate'));if(render)document.getElementById('content').innerHTML=id?gameMarkup(id):'<h1>Home</h1>'};
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return structuredClone(saved)},async set(patch){
        if('rcGameNotes'in patch){if(pauseNoteWrite){pauseNoteWrite=false;await new Promise(resolve=>{window.releaseNoteWrite=resolve})}if(failNoteWrite)throw new Error('Storage full')}
        const delta=Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,{oldValue:saved[key],newValue:structuredClone(value)}]));Object.assign(saved,structuredClone(patch));localStorage.setItem('notes-fixture',JSON.stringify(saved));changed.forEach(fn=>fn(delta,'local'))},
        async remove(key){const previous=saved[key];delete saved[key];localStorage.setItem('notes-fixture',JSON.stringify(saved));changed.forEach(fn=>fn({[key]:{oldValue:previous,newValue:undefined}},'local'))}},onChanged:{addListener:fn=>changed.push(fn)}},runtime:{id:'notes-extension',lastError:null,getURL:file=>'/'+file,onMessage:{addListener:fn=>listeners.push(fn)},sendMessage(message,callback){
        if(message.type==='rc-game-notes'){noteRequests.push(structuredClone(message));for(const listener of listeners)if(listener(message,{id:'notes-extension',url:'https://www.roblox.com'+location.pathname,frameId:0},callback))return}
        queueMicrotask(()=>callback({error:'No optional fixture data'}));}}};
      window.externalNote=async(id,text)=>chrome.storage.local.set({rcGameNotes:RobloxCustomizerGameNotes.update(saved.rcGameNotes,{placeId:id,name:'Game '+id},text)});
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('game notes autosave privately, survive reloads and SPA remounts, and isolate edits between games',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(files.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_NOTES_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'game-notes');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const url = `http://127.0.0.1:${server.address().port}/ko/games/123/Game`;
    const ready = "!!document.querySelector('#rc-game-notes .rc-game-notes-toggle:not(:disabled)')";
    const noteText = id => browser.evaluate(`saved.rcGameNotes?.notes.find(n=>n.placeId===${id})?.text ?? null`);
    const type = async text => {
      await browser.evaluate(`(()=>{const input=document.querySelector('#rc-game-notes-text');input.focus();input.value=${JSON.stringify(text)};input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
    };
    const open = async () => {
      if (!await browser.evaluate("!document.querySelector('#rc-game-notes-editor').hidden")) await browser.click('.rc-game-notes-toggle');
    };
    await browser.send('Page.navigate', { url }); await waitForDocument(browser, '#game-detail-page', url); await browser.waitFor(ready);
    await open();
    const text = '私人攻略\n한국어 日本語 ไทย\n<img src=x onerror="window.injected=true">\nRefresh';
    await type(text);
    await browser.waitFor(`saved.rcGameNotes?.notes.find(n=>n.placeId===123)?.text===${JSON.stringify(text)} && document.querySelector('#rc-game-notes-status').textContent==='Note saved.'`);
    await browser.click('.rc-game-notes-toggle');
    assert.equal(await browser.evaluate("document.querySelector('.rc-game-notes-preview').textContent"), text);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-game-notes img') || !!window.injected"), false, 'Note text is never interpreted as markup');
    await browser.send('Page.reload'); await waitForDocument(browser, '#game-detail-page', url); await browser.waitFor(ready);
    assert.equal(await browser.evaluate("document.querySelector('.rc-game-notes-preview').textContent"), text);
    await open();
    await type('Edit before native remount');
    await browser.evaluate("window.editorBefore=document.getElementById('rc-game-notes-text');document.getElementById('game-detail-page').outerHTML=document.getElementById('game-detail-page').outerHTML");
    await browser.waitFor("document.querySelector('#rc-game-notes-text')===editorBefore && document.querySelectorAll('#rc-game-notes').length===1");
    assert.equal(await browser.evaluate('editorBefore.value'), 'Edit before native remount');
    await browser.evaluate('routeTo(456,false)');
    await browser.waitFor("!document.querySelector('#rc-game-notes')");
    await browser.evaluate("document.getElementById('content').innerHTML=gameMarkup(456)"); await browser.waitFor(ready);
    await browser.waitFor("saved.rcGameNotes?.notes.find(n=>n.placeId===123)?.text==='Edit before native remount'");
    await open(); await type('Different game');
    await browser.evaluate('RobloxCustomizerGameNotesUI.flush()');
    assert.equal(await noteText(456), 'Different game');
    assert.equal(await noteText(123), 'Edit before native remount');
    await browser.evaluate('routeTo(123)'); await browser.waitFor(ready); await open();
    assert.equal(await browser.evaluate("document.querySelector('textarea').value"), 'Edit before native remount');

    await browser.evaluate("document.querySelector('textarea').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}))");
    await type('中'); await pause(850);
    assert.equal(await noteText(123), 'Edit before native remount', 'IME intermediate text is not saved');
    await type('中文输入完成');
    await browser.evaluate("document.querySelector('textarea').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}))");
    await browser.waitFor("saved.rcGameNotes.notes.find(n=>n.placeId===123).text==='中文输入完成'");
    await browser.evaluate('failNoteWrite=true'); await type('Keep this failed edit');
    await browser.waitFor("document.querySelector('#rc-game-notes-status').dataset.error==='true'");
    assert.equal(await browser.evaluate("document.querySelector('textarea').value"), 'Keep this failed edit');
    assert.equal(await noteText(123), '中文输入完成');
    await browser.evaluate('failNoteWrite=false'); await browser.click('.rc-game-notes-save');
    await browser.waitFor("saved.rcGameNotes.notes.find(n=>n.placeId===123).text==='Keep this failed edit'");
    await type('Delete while this edit is pending');
    await browser.click('.rc-game-notes-delete');
    await browser.waitFor("!saved.rcGameNotes.notes.some(n=>n.placeId===123) && document.querySelector('#rc-game-notes-status').textContent==='Note deleted.'");
    assert.equal(await noteText(456), 'Different game', 'Deleting a note preserves other games');
    await browser.evaluate("externalNote(123,'Refresh')");
    await browser.waitFor("document.querySelector('textarea').value==='Refresh'");

    const languages = [['en','Game notes','Private note'], ['zh-CN','游戏备注','私人备注'], ['zh-TW','遊戲備註','私人備註'],
      ['id','Catatan game','Catatan pribadi'], ['ja','ゲームのメモ','自分用のメモ'], ['th','บันทึกเกม','บันทึกส่วนตัว'], ['ko','게임 메모','개인 메모']];
    for (const [locale, title, label] of languages) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      assert.equal(await browser.evaluate("document.getElementById('rc-game-notes-title').textContent"), title);
      assert.equal(await browser.evaluate("document.querySelector('#rc-game-notes label').textContent"), label);
      assert.equal(await browser.evaluate("document.querySelector('textarea').value"), 'Refresh', 'User notes are never translated');
      for (const theme of ['dark-theme','light-theme']) for (const width of [1360, 700, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.documentElement.className=${JSON.stringify(theme)}`);
        const geometry = await browser.evaluate(`(()=>{const panel=document.getElementById('rc-game-notes'),input=panel.querySelector('textarea'),p=panel.getBoundingClientRect(),r=input.getBoundingClientRect(),media=document.getElementById('game-details-carousel-container').getBoundingClientRect();return {overflow:panel.scrollWidth>panel.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,inside:r.left>=p.left&&r.right<=p.right,afterMedia:p.top>=media.bottom,hidden:panel.querySelector('form').hidden}})()`);
        assert.deepEqual(geometry, {overflow:false,inside:true,afterMedia:true,hidden:false}, `${locale}/${theme}/${width}`);
        if (process.env.GAME_NOTES_SCREENSHOT_DIR && locale === 'zh-CN' && [1360,390].includes(width)) {
          await browser.evaluate("document.getElementById('rc-game-notes').scrollIntoView({block:'center'})");
          const shot = await browser.send('Page.captureScreenshot', {format:'png'});
          fs.writeFileSync(path.join(process.env.GAME_NOTES_SCREENSHOT_DIR, `game-notes-${theme}-${width}.png`), Buffer.from(shot.data,'base64'));
        }
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', {width:1360,height:1000,deviceScaleFactor:1,mobile:false});
    await browser.click('#native-play'); assert.equal(await browser.evaluate('nativeClicks'), 1);
    await browser.evaluate('pauseNoteWrite=true');
    await type('Do not resurrect after reset');
    await browser.evaluate('window.firstFlush=RobloxCustomizerGameNotesUI.flush();window.secondFlush=RobloxCustomizerGameNotesUI.flush()');
    await browser.waitFor("typeof releaseNoteWrite==='function'");
    await browser.evaluate("RobloxCustomizerGameNotesUI.discardDrafts();window.resetNotes=RobloxCustomizerGameNotesBackground.withStorageLock(()=>chrome.storage.local.remove('rcGameNotes'));releaseNoteWrite()");
    await browser.evaluate('Promise.all([firstFlush,secondFlush,resetNotes])');
    await pause(850);
    assert.equal(await browser.evaluate('saved.rcGameNotes ?? null'), null, 'Pending saves do not recreate notes after reset');
    await browser.evaluate("externalNote(123,'Pagehide flush')"); await open(); await type('Saved before leaving');
    await browser.evaluate("dispatchEvent(new PageTransitionEvent('pagehide'));routeTo(0)");
    await browser.waitFor("!document.querySelector('#rc-game-notes') && saved.rcGameNotes.notes.find(n=>n.placeId===123)?.text==='Saved before leaving'");
    assert.equal(await browser.evaluate('noteRequests.every(r=>r.type===\'rc-game-notes\'&&r.action===\'save\')'), true);
    assert.deepEqual(browser.errors, []);
  });
