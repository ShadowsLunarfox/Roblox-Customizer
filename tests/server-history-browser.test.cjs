const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const entries = manifest.content_scripts.filter(entry => entry.world !== 'MAIN');
const scripts = [...new Set(entries.flatMap(entry => entry.js || [])), 'src/background/pinned-games-background.js',
  'src/background/playtime-background.js', 'src/background/server-history-background.js', 'src/background/backup-background.js'];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const record = (n, universeId, placeId, name, visitedAt) => ({ serverId: id(n), universeId, placeId, name, visitedAt });
const firstName = '<img src=x onerror=alert(1)> Game';
const initial = { robloxCustomizerTermsAccepted: true, playtimeTrackingEnabled: false,
  customBackground: { source: 'none', uiLanguage: 'en', clockShowSeconds: false },
  rcServerHistory: { version: 1, accounts: [{ userId: 123, servers: [
    ...Array.from({ length: 7 }, (_, n) => record(n + 1, 456, n % 2 ? 790 : 789, firstName, 1800000000100 - n)),
    ...Array.from({ length: 7 }, (_, n) => record(n + 101, 654, 987, 'Second game', 1800000000200 - n))
  ] }, { userId: 321, servers: [record(201, 456, 789, 'Other account game', 1800000000300),
    record(202, 654, 987, 'Other account second game', 1800000000400)] }] } };
function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <style>*{box-sizing:border-box}body{font:16px Arial;margin:20px;background:#34465a;color:white}#settings-popover-menu{position:fixed;top:0;right:0}main{max-width:1000px;margin:auto}</style></head><body class="dark-theme">
    <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="HomeContainer"><h1>Home</h1></main>
    <script>
    window.saved=structuredClone(${JSON.stringify(initial)});window.currentUser=123;window.publicFull=false;window.lookups=[];
    const listeners=[],messages=[],alarms=new Map(),session={};
    const area=data=>({async get(keys){return structuredClone(keys===null?data:Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,data[key]])))},
      async set(values){const changes={};for(const[key,value]of Object.entries(values)){if(JSON.stringify(data[key])!==JSON.stringify(value))changes[key]={oldValue:data[key],newValue:structuredClone(value)}}Object.assign(data,structuredClone(values));if(data===saved)listeners.forEach(fn=>fn(changes,'local'))},
      async remove(keys){for(const key of keys)delete data[key]},async clear(){for(const key of Object.keys(data))delete data[key]}});
    window.fetch=async(url)=>({ok:true,status:200,headers:{get(){}},async json(){url=String(url);if(url.includes('users/authenticated'))return{id:currentUser,name:'Player',displayName:'Player'};
      if(url.includes('presence.roblox.com'))return{userPresences:[]};if(url.includes('/universes/v1/places/')){lookups.push(url);return{universeId:456}};
      if(url.includes('/servers/Public'))return{data:${JSON.stringify(initial.rcServerHistory.accounts[0].servers.map(entry => ({ id: entry.serverId, playing: 1, maxPlayers: 10 })))}.map(entry=>({...entry,playing:publicFull?10:1})),nextPageCursor:null};return{data:[]}}});
    window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:area(saved),session:area(session),onChanged:{addListener:fn=>listeners.push(fn)}},
      alarms:{async get(key){return alarms.get(key)},async create(key,value){alarms.set(key,value)},async clear(key){return alarms.delete(key)},onAlarm:{addListener(){}}},
      runtime:{id:'fixture',lastError:null,getManifest:()=>({version:'1.0'}),getURL:file=>'/'+file,onMessage:{addListener:fn=>messages.push(fn)},onStartup:{addListener(){}},onInstalled:{addListener(){}},
        sendMessage(message,callback){if(['rc-data-backup','rc-server-history','rc-playtime'].includes(message.type)){for(const fn of messages)if(fn(message,{id:'fixture',url:'https://www.roblox.com'+location.pathname,frameId:0},callback))return;}
        queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:currentUser,name:'Player',displayName:'Player'}:{ok:true,games:[],folders:[],servers:[],data:[]}));}}};
    window.navigateGame=(placeId,universeId)=>{history.pushState({},'', '/games/'+placeId+'/Test');const main=document.querySelector('main');main.id='game-detail-page';main.dataset.placeId=placeId;
      main.innerHTML='<h1>Game</h1><div id="game-detail-meta-data" data-place-id="'+placeId+'"'+(universeId?' data-universe-id="'+universeId+'"':'')+'></div><section id="game-instances"></section>';dispatchEvent(new PopStateEvent('popstate'))};
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}
test('recent servers stay off Home and use separate six-server game lists across accounts, subplaces, search and mobile locales',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const assets = new Set([...scripts, ...styles, 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'server-history');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/home` });
    await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.waitFor('saved.rcServerHistory.accounts[0].servers.length===12');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-server-history-home')"), false);
    await browser.evaluate("document.querySelector('.rc-settings-menu-entry').click()");
    await browser.waitFor("!!document.querySelector('#rc-server-history-settings h3')");
    for (const locale of ['en', 'zh-CN', 'zh-TW']) for (const [theme, width] of [['dark', 1280], ['light', 390]]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`document.body.className='${theme}-theme';RobloxCustomizerI18n.setLanguage('${locale}');document.querySelector('#rc-server-history-settings').scrollIntoView({block:'start'})`);
      await pause(80);
      assert.equal(await browser.evaluate("document.querySelector('.rc-settings-dialog').scrollWidth>document.querySelector('.rc-settings-dialog').clientWidth+1"), false, `${locale}/${theme}: settings fit`);
      if (process.env.SETTINGS_SCREENSHOTS) {
        for (const category of ['appearance', 'home', 'social', 'currency', 'data']) {
          await browser.click(`.rc-settings-nav-button[data-rc-settings-category="${category}"]`);
          await pause(80);
          const shot = await browser.send('Page.captureScreenshot');
          fs.writeFileSync(path.join(process.env.SETTINGS_SCREENSHOTS, `${locale}-${theme}-${category}.png`), Buffer.from(shot.data, 'base64'));
        }
        await browser.evaluate("document.querySelector('#rc-server-history-settings').scrollIntoView({block:'start'})");
      }
      assert.equal(await browser.evaluate("document.querySelector('#rc-server-history-settings h3').textContent"), { en: 'Recent servers', 'zh-CN': '最近的服务器', 'zh-TW': '最近的伺服器' }[locale]);
    }
    await browser.click('#rc-server-history-settings button');
    await browser.waitFor("document.querySelectorAll('#rc-server-history-dialog .rc-server-history-group').length===2");
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.rc-server-history-group')].map(group=>group.querySelectorAll('.rc-server-history-row').length)"), [6, 6]);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-server-history-dialog img')"), false, 'Untrusted game names remain plain text');
    await browser.evaluate("const search=document.querySelector('#rc-server-history-dialog input');search.value='Second game';search.dispatchEvent(new Event('input'))");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-server-history-dialog .rc-server-history-group').length"), 1);
    assert.equal(await browser.evaluate("document.querySelector('.rc-server-history-group').dataset.universeId"), '654');
    await browser.evaluate("document.querySelector('#rc-server-history-dialog').close();RobloxCustomizerI18n.setLanguage('en');document.querySelector('#rc-close').click()");
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    await browser.evaluate('navigateGame(700,456)');
    await browser.waitFor("document.querySelectorAll('#rc-server-history-game .rc-server-history-row').length===6");
    assert.equal(await browser.evaluate("document.querySelector('#rc-server-history-game .rc-server-history-name').textContent"), firstName);
    assert.equal(await browser.evaluate("document.querySelector('#rc-server-history-game').textContent.includes('Second game')"), false);
    assert.equal(await browser.evaluate("document.querySelector('#rc-server-history-game a.rc-server-button').getAttribute('href')"), `roblox://experiences/start?placeId=789&gameInstanceId=${id(1)}`, 'Root-game history rejoins the actual subplace');
    await browser.click('#rc-server-history-game .rc-server-history-row button');
    await browser.waitFor("document.querySelector('#rc-server-history-game .rc-server-history-status').textContent==='Server available.'");
    await browser.evaluate('publicFull=true'); await browser.click('#rc-server-history-game .rc-server-history-row button');
    await browser.waitFor("document.querySelector('#rc-server-history-game .rc-server-history-status').textContent==='Server full. Check again later.'");
    assert.equal(await browser.evaluate("document.querySelector('#rc-server-history-game a.rc-server-button').hasAttribute('href')"), false);
    await browser.evaluate('navigateGame(701)');
    await browser.waitFor("lookups.some(url=>url.includes('/701/universe'))&&document.querySelectorAll('#rc-server-history-game .rc-server-history-row').length===6");
    await browser.evaluate('navigateGame(987,654)');
    await browser.waitFor("document.querySelector('#rc-server-history-game .rc-server-history-name')?.textContent==='Second game'");
    assert.equal(await browser.evaluate("document.querySelector('#rc-server-history-game').textContent.includes('onerror')"), false, 'SPA navigation cannot show the previous game list');
    await browser.evaluate('navigateGame(700,456)');
    await browser.waitFor("document.querySelector('#rc-server-history-game .rc-server-history-name')?.textContent.includes('onerror')");
    await browser.click('#rc-server-history-game > button');
    await browser.waitFor("document.querySelector('#rc-server-history-dialog[open] .rc-server-clear')?.textContent==='Clear this game'");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-server-history-dialog .rc-server-history-row').length"), 6);
    assert.equal(await browser.evaluate("document.querySelector('#rc-server-history-dialog').scrollWidth>document.querySelector('#rc-server-history-dialog').clientWidth+1"), false, 'The per-game list fits mobile');
    if (process.env.FEATURE_SCREENSHOTS) { const shot = await browser.send('Page.captureScreenshot'); fs.writeFileSync(path.join(process.env.FEATURE_SCREENSHOTS, 'per-game-servers.png'), Buffer.from(shot.data, 'base64')); }
    await browser.click('.rc-server-clear');
    await browser.click('.rc-server-clear-confirmation button');
    await browser.waitFor("saved.rcServerHistory.accounts.find(account=>account.userId===123).servers.length===6");
    assert.equal(await browser.evaluate('saved.rcServerHistory.accounts.find(account=>account.userId===123).servers.every(entry=>entry.universeId===654)'), true);
    assert.equal(await browser.evaluate('saved.rcServerHistory.accounts.find(account=>account.userId===321).servers.length'), 2);
    await browser.evaluate("document.querySelector('#rc-server-history-dialog').close();currentUser=321;document.dispatchEvent(new Event('visibilitychange'))");
    await browser.waitFor("document.querySelector('#rc-server-history-game .rc-server-history-name')?.textContent==='Other account game'");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-server-history-game .rc-server-history-row').length"), 1);
    await browser.evaluate("history.pushState({},'', '/home');document.querySelector('main').id='HomeContainer';dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("!document.querySelector('#rc-server-history-game')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-server-history-home')"), false, 'Returning Home never remounts recent servers');
    assert.deepEqual(browser.errors, []);
  });
