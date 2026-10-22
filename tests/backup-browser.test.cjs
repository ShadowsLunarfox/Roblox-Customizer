const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const testFont = require('./helpers/font.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const entries = manifest.content_scripts.filter(entry => entry.world !== 'MAIN');
const scripts = [...new Set(entries.flatMap(entry => entry.js || [])),
  'src/background/pinned-games-background.js','src/background/playtime-background.js',
  'src/background/game-notes-background.js','src/background/backup-background.js'];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];
const game = {universeId:456,placeId:789,name:'Private game',iconUrl:'',totalMs:123456,sessions:2,
  firstPlayedAt:1800000000000,lastPlayedAt:1800000123456,metadataCheckedAt:1800000000000};
const initial = {robloxCustomizerTermsAccepted:true,customBackground:{source:'none',uiLanguage:'en',clockShowSeconds:false,glassBlur:23,glassOpacity:67,
  experimentalCustomColors:true,customTextColor:'#ddeeff',customBackgroundColor:'#203040',customAccentColor:'#aa3399',
  hideFavorites:true,showGameXFeed:false,hiddenRecommendedGames:[{placeId:'100',name:'Hidden game'}],greetingMorning:'Hello player'},
  robuxCurrency:{enabled:false,currency:'CNY'},pinnedGames:[{universeId:456,placeId:789,name:'Private game',iconUrl:'',updatedAt:123,folderId:'favorites'}],
  pinnedGameFolders:[{id:'favorites',name:'我的游戏'}],playtimeTrackingEnabled:false,
  rcServerLocation:{country:'SG',city:'Singapore',locationMode:'nearest',latitude:1.35,longitude:103.8},
  rcGameNotes:{version:1,notes:[{placeId:789,name:'Private game',text:'私人攻略\n第二行',updatedAt:12345}]},
  rcPlaytimeHistory:{version:1,currentUserId:123,active:null,status:{kind:'disabled',checkedAt:0},
    accounts:[{userId:123,name:'Player',displayName:'Player',games:[game]}, {userId:321,name:'Other',displayName:'另一个账号',games:[{...game,totalMs:98765}]}]},
  robuxCurrencyRates:{fixture:'cache should stay local'}};
function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}
    <style>body{font:16px Arial;margin:20px;background:#34465a;color:white}#settings-popover-menu{position:fixed;top:0;right:0}</style></head><body class="dark-theme">
    <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="HomeContainer"><h1>Home</h1></main>
    <script>
      window.saved=JSON.parse(localStorage.getItem('fixture-saved')||'null')||${JSON.stringify(initial)};
      window.failBackupSet=false;window.dropBackupReply=false;const changeListeners=[],messageListeners=[],alarms=new Map(),session={};
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return structuredClone(keys===null?saved:Object.fromEntries((Array.isArray(keys)?keys:[keys]).filter(key=>key in saved).map(key=>[key,saved[key]])))},
        async set(values){if(failBackupSet&&'pinnedGames'in values&&'rcPlaytimeHistory'in values)throw new Error('Could not import backup. Your existing data was kept.');
          const changes={};for(const [key,value]of Object.entries(values)){if(JSON.stringify(saved[key])!==JSON.stringify(value))changes[key]={oldValue:saved[key],newValue:structuredClone(value)}};
          Object.assign(saved,structuredClone(values));localStorage.setItem('fixture-saved',JSON.stringify(saved));changeListeners.forEach(fn=>fn(changes,'local'))},
        async clear(){const changes=Object.fromEntries(Object.entries(saved).map(([key,value])=>[key,{oldValue:value,newValue:undefined}]));saved={};localStorage.setItem('fixture-saved','{}');changeListeners.forEach(fn=>fn(changes,'local'))},
        async remove(keys){const changes={};for(const key of keys){changes[key]={oldValue:saved[key],newValue:undefined};delete saved[key]}localStorage.setItem('fixture-saved',JSON.stringify(saved));changeListeners.forEach(fn=>fn(changes,'local'))}},
        session:{async get(key){return {[key]:session[key]}},async set(values){Object.assign(session,values)},async clear(){for(const key of Object.keys(session))delete session[key]}},onChanged:{addListener:fn=>changeListeners.push(fn)}},
        alarms:{async get(key){return alarms.get(key)},async create(key,value){alarms.set(key,value)},async clear(key){return alarms.delete(key)},onAlarm:{addListener(){}}},
        runtime:{id:'test-extension',lastError:null,getManifest:()=>({version:'1.0'}),getURL:file=>'/'+file,onMessage:{addListener:fn=>messageListeners.push(fn)},onStartup:{addListener(){}},onInstalled:{addListener(){}},
          sendMessage(message,callback){if(message.type==='rc-data-backup'){for(const listener of messageListeners)if(listener(message,{id:'test-extension',url:'https://www.roblox.com/home',frameId:0},value=>callback(dropBackupReply&&message.action==='import'&&value.ok?undefined:value)))return;}
            queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:123,name:'Player',displayName:'Player'}:message.type==='rc-playtime'?globalThis.RobloxCustomizerPlaytime?.snapshot(saved.rcPlaytimeHistory,saved.playtimeTrackingEnabled!==false):{ok:true,...(globalThis.RobloxCustomizerPinnedGames?.state(saved.pinnedGames,saved.pinnedGameFolders)||{games:[],folders:[]})}));}}};
    </script>${scripts.map(file=>`<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Settings backup previews account ownership before restoring data and media; invalid and failed imports preserve existing data',
  {skip:!process.env.CHROME_BIN,timeout:60000}, async t => {
    const assets = new Set([...scripts,...styles,'icons/icon-128.png']);
    const server = http.createServer((request,response)=>{
      const file=new URL(request.url,'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');
      response.end(assets.has(file)?fs.readFileSync(path.join(workspace,file)):fixture());
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const files=fs.mkdtempSync(path.join(workspace,'.tmp-backup-files-'));
    t.after(()=>{assert.equal(path.dirname(path.resolve(files)),workspace);fs.rmSync(files,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
    const imagePath=path.join(files,'wallpaper.png');
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOwAAAABJRU5ErkJggg==','base64');
    fs.writeFileSync(imagePath,image);
    const fontPath=path.join(files,'Local font.ttf');
    if(testFont)fs.copyFileSync(testFont,fontPath);
    const browser=await isolatedChrome(t,'backup');
    await browser.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:files});
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1360,height:1000,deviceScaleFactor:1,mobile:false});
    await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/home`});
    await waitForDocument(browser,'.rc-settings-menu-entry');
    await browser.evaluate("document.querySelector('.rc-settings-menu-entry').click()");
    await browser.waitFor("!!document.querySelector('#rc-export-backup')");
    const upload=async(selector,file)=>{
      const {root}=await browser.send('DOM.getDocument');
      const {nodeId}=await browser.send('DOM.querySelector',{nodeId:root.nodeId,selector});
      await browser.send('DOM.setFileInputFiles',{nodeId,files:[file]});
    };
    await browser.click('input[name="rc-source"][value="file"]');
    await upload('#rc-file',imagePath);
    await browser.waitFor("saved.customBackground.source==='file'&&document.querySelector('#rc-background-layer img')?.naturalWidth===1");
    if(testFont){
      await upload('#rc-font-file',fontPath);
      await browser.waitFor("saved.customBackground.customFontEnabled&&document.documentElement.hasAttribute('data-rc-custom-font')");
    }
    // Export must include an edit still waiting in the slider debounce queue.
    await browser.evaluate("(()=>{const n=document.getElementById('rc-glass-blur');n.value='29';n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('rc-export-backup').click()})()");
    await browser.waitFor("document.getElementById('rc-settings-status').textContent==='Backup exported.'");
    let downloaded;
    for(let i=0;i<100;i++){downloaded=fs.readdirSync(files).find(file=>file.startsWith('roblox-customizer-backup-')&&file.endsWith('.json'));if(downloaded)break;await pause(30);}
    assert.ok(downloaded,'Export produces a downloadable JSON file');
    const backupPath=path.join(files,downloaded);
    const backup=JSON.parse(fs.readFileSync(backupPath,'utf8'));
    assert.deepEqual(Object.keys(backup.data).sort(),['customBackground','pinnedGameFolders','pinnedGames','playtimeTrackingEnabled','rcPlaytimeHistory','robuxCurrency','rcGameNotes'].sort());
    assert.equal(backup.data.rcGameNotes.notes[0].text, '私人攻略\n第二行');
    assert.equal(backup.data.customBackground.glassBlur,29);
    assert.equal(backup.data.customBackground._writer,undefined);
    assert.equal(backup.data.rcPlaytimeHistory.accounts.length,2);
    assert.equal(backup.data.rcPlaytimeHistory.accounts[0].games[0].totalMs,123456);
    assert.deepEqual(Buffer.from(backup.media.base64,'base64'),image);
    const originalKey=backup.data.customBackground.fileKey;
    const originalFontKey=backup.data.customBackground.fontFileKey;
    if(testFont)assert.deepEqual(Buffer.from(backup.font.base64,'base64'),fs.readFileSync(testFont));
    await browser.evaluate("chrome.storage.local.set({customBackground:{source:'none',uiLanguage:'en',glassBlur:4,clockShowSeconds:false},pinnedGames:[],pinnedGameFolders:[],robuxCurrency:{enabled:true,currency:'USD'},rcPlaytimeHistory:RobloxCustomizerPlaytime.normalize(null),playtimeTrackingEnabled:true,rcGameNotes:{version:1,notes:[]}})");
    const beforeImport=await browser.evaluate('JSON.stringify(saved)');
    await upload('#rc-import-file',backupPath);
    await browser.waitFor("!!document.querySelector('#rc-import-preview')");
    assert.equal(await browser.evaluate("document.querySelector('#rc-import-preview-counts').textContent.includes('2 Roblox accounts')"),true);
    assert.equal(await browser.evaluate("document.querySelector('#rc-import-preview-notes').textContent.includes('1 game notes')"),true);
    assert.equal(await browser.evaluate("document.querySelector('#rc-import-preview-accounts').textContent.includes('ID 123')"),true);
    assert.equal(await browser.evaluate("document.querySelector('#rc-import-preview-accounts').textContent.includes('ID 321')"),true);
    assert.equal(await browser.evaluate("document.querySelector('#rc-import-preview').textContent.includes('the records remain stored')"),true);
    assert.equal(await browser.evaluate('JSON.stringify(saved)'),beforeImport,'Choosing a file only previews it');
    await browser.clickAt({ x: 5, y: 5 });
    await browser.waitFor("!document.querySelector('#rc-import-preview')");
    assert.equal(await browser.evaluate('JSON.stringify(saved)'),beforeImport,'Outside dismissal cancels the import and keeps current data');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"),true,'Dismissing the import keeps settings open');
    await upload('#rc-import-file',backupPath);
    await browser.waitFor("!!document.querySelector('#rc-import-preview')");
    await browser.click('#rc-import-preview-confirm');
    await browser.waitFor("document.getElementById('rc-settings-status').textContent==='Backup imported.'&&document.querySelector('#rc-background-layer img')?.naturalWidth===1");
    const restored=await browser.evaluate('saved');
    assert.equal(restored.customBackground.glassBlur,29);
    assert.equal(restored.customBackground.greetingMorning,'Hello player');
    assert.notEqual(restored.customBackground.fileKey,originalKey,'Media is restored under a fresh key');
    if(testFont){
      await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-font')&&!RobloxCustomizerFonts.state().loading");
      assert.notEqual(restored.customBackground.fontFileKey,originalFontKey,'The font is restored under a fresh key');
    }
    assert.deepEqual({...restored.customBackground,fileKey:originalKey,...(testFont?{fontFileKey:originalFontKey}:{})},backup.data.customBackground,'All appearance and homepage preferences round trip');
    for(const key of ['pinnedGames','pinnedGameFolders','robuxCurrency','playtimeTrackingEnabled','rcPlaytimeHistory','rcGameNotes']) assert.deepEqual(restored[key],backup.data[key],key);
    assert.equal(Object.hasOwn(restored,'rcServerLocation'),false);
    assert.equal(await browser.evaluate("document.getElementById('rc-glass-blur').value"),'29');
    assert.equal(await browser.evaluate("document.getElementById('rc-currency-select').value"),'CNY');
    assert.equal(await browser.evaluate("document.getElementById('rc-greeting-morning').value"),'Hello player');
    const before=await browser.evaluate('JSON.stringify(saved)');
    const invalid=path.join(files,'invalid.json');fs.writeFileSync(invalid,'{"format":"other"}');
    await upload('#rc-import-file',invalid);
    await browser.waitFor("document.getElementById('rc-settings-status').textContent==='Invalid backup file. No data was imported.'");
    assert.equal(await browser.evaluate('JSON.stringify(saved)'),before);
    // A failed storage write removes the newly staged media and retains the current file.
    const mediaKeys=()=>browser.evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('roblox-customizer-media',1);r.onsuccess=()=>{const db=r.result;const tx=db.transaction('backgrounds');const q=tx.objectStore('backgrounds').getAllKeys();q.onsuccess=()=>resolve(q.result);tx.oncomplete=()=>db.close()};r.onerror=()=>reject(r.error)})`);
    const keys=await mediaKeys();
    await browser.evaluate('failBackupSet=true');
    await upload('#rc-import-file',backupPath);
    await browser.waitFor("!!document.querySelector('#rc-import-preview')");
    await browser.click('#rc-import-preview-confirm');
    await browser.waitFor("document.getElementById('rc-settings-status').textContent==='Could not import backup. Your existing data was kept.'");
    assert.equal(await browser.evaluate('JSON.stringify(saved)'),before);
    assert.deepEqual(await mediaKeys(),keys);
    await browser.evaluate('failBackupSet=false');
    if(testFont){
      const brokenFont=structuredClone(backup);
      Object.assign(brokenFont.font,{base64:'YQ==',size:1});
      const brokenFontPath=path.join(files,'broken-font-backup.json');
      fs.writeFileSync(brokenFontPath,JSON.stringify(brokenFont));
      await upload('#rc-import-file',brokenFontPath);
      await browser.waitFor("!!document.querySelector('#rc-import-preview')");
      await browser.click('#rc-import-preview-confirm');
      await browser.waitFor("document.getElementById('rc-settings-status').textContent==='This font file could not be loaded. Try another font file.'");
      assert.equal(await browser.evaluate('JSON.stringify(saved)'),before,'A corrupt font cannot partially replace saved settings');
      assert.deepEqual(await mediaKeys(),keys,'A corrupt font leaves no staged wallpaper or font behind');
    }
    // A lost acknowledgement after commit must never delete the restored image.
    await browser.evaluate('dropBackupReply=true');
    await upload('#rc-import-file',backupPath);
    await browser.waitFor("!!document.querySelector('#rc-import-preview')");
    await browser.click('#rc-import-preview-confirm');
    await browser.waitFor("document.getElementById('rc-settings-status').textContent==='No response from the extension.'&&document.querySelector('#rc-background-layer img')?.naturalWidth===1");
    assert.ok((await mediaKeys()).includes(await browser.evaluate('saved.customBackground.fileKey')));
    if(testFont)assert.ok((await mediaKeys()).includes(await browser.evaluate('saved.customBackground.fontFileKey')));
    await browser.evaluate('dropBackupReply=false');
    for(const [locale,title,exportText,importText]of [['zh-CN','备份与恢复','导出备份','导入备份'],['zh-TW','備份與還原','匯出備份','匯入備份'],['ja','バックアップと復元','バックアップを書き出す','バックアップを読み込む'],['th','สำรองและกู้คืนข้อมูล','ส่งออกข้อมูลสำรอง','นำเข้าข้อมูลสำรอง'],['ko','백업 및 복원','백업 내보내기','백업 가져오기'],['en','Backup and restore','Export backup','Import backup']]){
      await browser.evaluate(`(()=>{const n=document.getElementById('rc-ui-language');n.value='${locale}';n.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      assert.deepEqual(await browser.evaluate("['rc-backup-title','rc-export-backup','rc-import-backup'].map(id=>document.getElementById(id).textContent)"),[title,exportText,importText]);
      for(const theme of ['light','dark']){
        await browser.send('Emulation.setDeviceMetricsOverride',{width:320,height:900,deviceScaleFactor:1,mobile:false});
        await browser.evaluate(`document.body.className='${theme}-theme';document.querySelector('.rc-settings-backup').scrollIntoView({block:'center'})`);
        assert.equal(await browser.evaluate("document.querySelector('.rc-settings-dialog').scrollWidth>document.querySelector('.rc-settings-dialog').clientWidth+1"),false,'Backup controls fit on mobile');
        assert.equal(await browser.evaluate("getComputedStyle(document.getElementById('rc-import-file')).display"),'none','The file picker stays hidden');
      }
    }
    await browser.evaluate("(()=>{const n=document.getElementById('rc-ui-language');n.value='zh-CN';n.dispatchEvent(new Event('change',{bubbles:true}))})()");
    await upload('#rc-import-file',backupPath);
    await browser.waitFor("!!document.querySelector('#rc-import-preview')");
    assert.equal(await browser.evaluate("document.querySelector('#rc-import-preview-title').textContent"),'导入前检查备份');
    await browser.click('#rc-import-preview-cancel');
    await browser.click('#rc-done');
    await browser.send('Page.reload');
    await waitForDocument(browser,'.rc-settings-menu-entry');
    await browser.waitFor("document.querySelector('#rc-background-layer img')?.naturalWidth===1");
    assert.equal(await browser.evaluate('saved.rcPlaytimeHistory.accounts[1].games[0].totalMs'),98765);
    await browser.evaluate("document.querySelector('.rc-settings-menu-entry').click()");
    await browser.waitFor("!!document.querySelector('#rc-reset-all')");
    assert.equal(await browser.evaluate("document.querySelector('#rc-reset-all').textContent"),'重置全部');
    const beforeReset=await browser.evaluate('JSON.stringify(saved)');
    await browser.click('#rc-reset-all');
    await browser.waitFor("document.querySelector('[role=alertdialog]')?.textContent.includes('无法撤销')");
    await browser.clickAt({ x: 5, y: 5 });
    await browser.waitFor("!document.querySelector('#rc-reset-confirmation')");
    assert.equal(await browser.evaluate('JSON.stringify(saved)'),beforeReset,'Outside dismissal cancels the reset and keeps all saved data');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"),true,'Dismissing the reset keeps settings open');
    await browser.click('#rc-reset-all');
    await browser.click('#rc-reset-confirm');
    let resetReady=false;
    for(let i=0;i<100;i++){
      try {resetReady=await browser.evaluate("Object.keys(saved).length===1&&saved.robloxCustomizerTermsAccepted===true&&!!document.querySelector('.rc-settings-menu-entry')&&!document.querySelector('#rc-settings-overlay')");}
      catch { /* Navigation briefly replaces the execution context. */ }
      if(resetReady)break;
      await pause(50);
    }
    assert.equal(resetReady,true,'Confirmed reset clears user data and keeps only terms acceptance: '+await browser.evaluate("JSON.stringify({saved,status:document.querySelector('#rc-settings-status')?.textContent,overlay:!!document.querySelector('#rc-settings-overlay')})"));
    assert.deepEqual(await mediaKeys(),[],'Uploaded background files are erased');
    assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-background-active')"),false);
    assert.deepEqual(browser.errors,[]);
  });
