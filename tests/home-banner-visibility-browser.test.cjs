const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8')).content_scripts;
const scripts = [...new Set(entries.filter(entry => entry.world !== 'MAIN').flatMap(entry => entry.js || []))];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];
const controls = { showHomeAvatar: 'avatar', showHomeLabel: 'label', showHomeDisplayName: 'display-name',
  showHomeUsername: 'username', showHomeGreeting: 'greeting', showHomeClock: 'clock', clockShowDate: 'date',
  showHomeMostPlayed: 'most-played' };
const id = key => key === 'clockShowDate' ? '#rc-clock-date' : `#rc-home-show-${controls[key]}`;
const games = [0, 1, 2].map(i => ({ universeId: 100 + i, placeId: 200 + i, name: `Game ${i + 1}`, iconUrl: '',
  totalMs: (i + 1) * 60000, sessions: 1, firstPlayedAt: 1800000000000, lastPlayedAt: 1800000060000, metadataCheckedAt: 1800000000000 }));
const initial = { robloxCustomizerTermsAccepted: true, playtimeTrackingEnabled: true,
  customBackground: { source: 'none', uiLanguage: 'en', clockShowSeconds: false,
    greetingMorning: 'hello again!', greetingAfternoon: 'hello again!', greetingEvening: 'hello again!' },
  rcPlaytimeHistory: { version: 1, currentUserId: 123, accounts: [{ userId: 123, name: 'Player', displayName: 'Display Player', games }],
    active: null, status: { kind: 'idle', checkedAt: 1800000060000 } } };
const setup = `
  window.saved=JSON.parse(localStorage.getItem('fixture-banner-settings')||'null')||${JSON.stringify(initial)};
  window.userRequests=0;window.playtimeActions=[];const listeners=[],waiting=[];
  window.releasePreferences=()=>{window.preferencesReleased=true;waiting.splice(0).forEach(resolve=>resolve(structuredClone(saved)))};
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){if(keys==='customBackground'&&location.search.includes('slow')&&!window.preferencesReleased)return new Promise(resolve=>waiting.push(resolve));return structuredClone(saved)},async set(patch){const changes=Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,{oldValue:saved[key],newValue:value}]));Object.assign(saved,structuredClone(patch));localStorage.setItem('fixture-banner-settings',JSON.stringify(saved));listeners.forEach(fn=>fn(changes,'local'))},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){queueMicrotask(()=>{if(message.type==='rc-home-user'){userRequests++;callback({id:123,name:'Player',displayName:'Display Player',imageUrl:location.origin+'/avatar.svg'})}else if(message.type==='rc-playtime'){playtimeActions.push(message.action);callback(RobloxCustomizerPlaytime.snapshot(saved.rcPlaytimeHistory,saved.playtimeTrackingEnabled))}else callback({ok:true,games:[],folders:[],servers:[]})})}}};
`;
const content = '<div id="native-first" class="friend-carousel-container">Friends</div><section id="continue"><h2>Continue</h2><a class="game-card-container" href="https://www.roblox.com/games/400/Example">Example</a></section>';
const fixture = `<!doctype html><html lang="en" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
  <style>body{margin:20px;font:16px/1.4 Arial;background:linear-gradient(120deg,#9b4a55,#546b88);color:white}#HomeContainer{max-width:1300px;margin:0 auto}#settings-popover-menu{position:fixed;right:0;top:0}#continue{padding:16px}#native-first{height:36px}</style></head><body>
  <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="HomeContainer">${content}</main></body></html>`;

test('every Home banner component can be hidden independently and stays hidden through reloads and remounts',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const assets = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : file === 'avatar.svg'
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#4b6987"/><circle cx="50" cy="50" r="32" fill="#ded7c9"/></svg>' : fixture);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'home-banner');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const visible = selector => browser.evaluate(`!!document.querySelector(${JSON.stringify(selector)})?.checkVisibility()`);
    const set = async (selector, value) => {
      if (await browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).checked`) !== value) await browser.click(selector);
    };
    const open = async () => { await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')"); await browser.evaluate("document.querySelector('.rc-settings-menu-entry').click()"); await browser.waitFor("!!document.querySelector('#rc-home-banner-parts')"); };
    await browser.send('Page.navigate', { url: origin + '/home' });
    await waitForDocument(browser, '#HomeContainer', origin + '/home');
    await browser.waitFor("document.querySelectorAll('#rc-playtime-home .rc-playtime-tile').length===3 && document.querySelector('.rc-home-greeting-username').textContent==='@Player'");
    assert.equal(await visible('#rc-home-greeting'), true);
    const history = await browser.evaluate('JSON.stringify(saved.rcPlaytimeHistory)');
    await open();
    for (const [key, selector] of [['showHomeAvatar', '.rc-home-greeting-avatar'], ['showHomeLabel', '.rc-home-greeting-eyebrow'], ['showHomeUsername', '.rc-home-greeting-username']]) {
      await set(id(key), false); assert.equal(await visible(selector), false, key);
      await set(id(key), true); assert.equal(await visible(selector), true, key);
    }
    await set(id('showHomeDisplayName'), false);
    assert.equal(await browser.evaluate("document.querySelector('.rc-home-greeting-title').textContent"), 'Hello again!');
    await set(id('showHomeDisplayName'), true);
    await set(id('showHomeGreeting'), false);
    assert.equal(await browser.evaluate("document.querySelector('.rc-home-greeting-title').textContent"), 'Display Player');
    await set(id('showHomeGreeting'), true);
    await set(id('showHomeClock'), false);
    assert.equal(await visible('.rc-home-greeting-time'), false);
    assert.equal(await visible('.rc-home-greeting-clock-label'), false);
    assert.equal(await visible('.rc-home-greeting-date'), true, 'The date can remain without a time');
    await set(id('clockShowDate'), false);
    assert.equal(await visible('.rc-home-greeting-clock'), false);
    assert.equal(await visible('#rc-playtime-home'), true, 'Most played works without a visible clock');
    await set(id('showHomeClock'), true);
    assert.equal(await visible('.rc-home-greeting-time'), true);
    assert.equal(await visible('.rc-home-greeting-date'), false);
    await set(id('showHomeMostPlayed'), false);
    await browser.waitFor("!document.querySelector('#rc-playtime-home')");
    assert.equal(await visible('.rc-home-greeting-clock'), true);
    await set(id('showHomeMostPlayed'), true);
    await browser.waitFor("document.querySelectorAll('#rc-playtime-home .rc-playtime-tile').length===3");
    await set(id('showHomeAvatar'), false);
    const chosen = await browser.evaluate('saved.customBackground');
    await set('#rc-home-show-banner', false);
    assert.equal(await visible('#rc-home-greeting'), false);
    assert.equal(await browser.evaluate("document.querySelector('#rc-home-banner-parts').disabled"), true);
    const noGap = "(()=>{const h=document.querySelector('#HomeContainer'),n=document.querySelector('#native-first');return document.querySelector('#rc-home-greeting').getBoundingClientRect().height===0&&Math.abs(n.getBoundingClientRect().top-h.getBoundingClientRect().top-parseFloat(getComputedStyle(h).paddingTop))<1})()";
    assert.equal(await browser.evaluate(noGap), true, 'Hidden banners leave no empty space');
    await set('#rc-home-show-banner', true);
    await browser.waitFor("!!document.querySelector('#rc-playtime-home')");
    for (const key of Object.keys(controls)) assert.equal(await browser.evaluate(`saved.customBackground.${key}`), chosen[key]);
    for (const [locale, title] of [['zh-CN', '首页横幅'], ['zh-TW', '首頁橫幅'], ['id', 'Banner beranda'], ['ja', 'ホームバナー'], ['th', 'แบนเนอร์หน้าหลัก'], ['ko', '홈 배너'], ['en', 'Home banner']]) {
      await browser.evaluate(`chrome.storage.local.set({customBackground:{...saved.customBackground,uiLanguage:'${locale}'}})`);
      await browser.waitFor(`document.querySelector('#rc-home-banner-title').textContent===${JSON.stringify(title)}`);
    }
    for (const key of Object.keys(controls)) await set(id(key), false);
    await browser.waitFor("!document.querySelector('#rc-playtime-home')");
    assert.equal(await visible('#rc-home-greeting'), false, 'Disabling every component removes the empty shell');
    assert.equal(await browser.evaluate("document.querySelector('#rc-home-show-banner').checked"), true);
    await set(id('showHomeMostPlayed'), true);
    await browser.waitFor("!!document.querySelector('#rc-playtime-home')");
    assert.equal(await visible('#rc-home-greeting'), true);
    assert.equal(await visible('.rc-home-greeting-copy'), false);
    assert.equal(await visible('.rc-home-greeting-clock'), false);
    assert.equal(await browser.evaluate('JSON.stringify(saved.rcPlaytimeHistory)'), history);
    assert.equal(await browser.evaluate("playtimeActions.includes('set-enabled')"), false, 'Visibility never pauses tracking');
    await browser.evaluate('window.keptHistory=structuredClone(saved.rcPlaytimeHistory);chrome.storage.local.set({playtimeTrackingEnabled:false,rcPlaytimeHistory:RobloxCustomizerPlaytime.normalize(null)})');
    await browser.waitFor("!document.querySelector('#rc-playtime-home')");
    assert.equal(await visible('#rc-home-greeting'), false, 'An unavailable summary cannot leave an empty banner');
    const idleChanges = await browser.evaluate(`new Promise(resolve=>{let changes=0;const observer=new MutationObserver(records=>changes+=records.length);observer.observe(document.querySelector('#rc-home-greeting'),{childList:true,subtree:true});setTimeout(()=>{observer.disconnect();resolve(changes)},250)})`);
    assert.equal(idleChanges, 0, 'An empty banner cannot cause an observer/render loop');
    await browser.evaluate('chrome.storage.local.set({playtimeTrackingEnabled:true,rcPlaytimeHistory:keptHistory})');
    await browser.waitFor("document.querySelectorAll('#rc-playtime-home .rc-playtime-tile').length===3");
    assert.equal(await visible('#rc-home-greeting'), true);
    for (const width of [1400, 360]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      assert.equal(await browser.evaluate("document.querySelector('#rc-home-greeting').scrollWidth<=document.querySelector('#rc-home-greeting').clientWidth+1"), true);
      assert.equal(await browser.evaluate("document.querySelector('.rc-settings-dialog').scrollWidth<=document.querySelector('.rc-settings-dialog').clientWidth+1"), true);
    }
    if (process.env.HOME_BANNER_SETTINGS_SCREENSHOT) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate("document.querySelector('.rc-settings-home-banner').scrollIntoView({block:'start'})");
      const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(process.env.HOME_BANNER_SETTINGS_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
    await set('#rc-home-show-banner', false);
    await browser.click('#rc-done');
    for (const route of ['/home?slow=1', '/id/home', '/zh-cn/home', '/zh-tw/home', '/ja/home', '/th/home', '/ko/home']) {
      await browser.send('Page.navigate', { url: origin + route });
      await waitForDocument(browser, '#HomeContainer', origin + route);
      await browser.waitFor("!!document.querySelector('#rc-home-greeting')");
      assert.equal(await visible('#rc-home-greeting'), false, route);
      assert.equal(await browser.evaluate(noGap), true, route);
      assert.equal(await browser.evaluate('userRequests'), 0, 'A disabled banner does not fetch avatar or identity details');
      await browser.evaluate('releasePreferences()');
    }
    await browser.evaluate(`document.querySelector('#HomeContainer').innerHTML=${JSON.stringify(content)};dispatchEvent(new PopStateEvent('popstate'))`);
    await browser.waitFor("!!document.querySelector('#rc-home-greeting')");
    assert.equal(await visible('#rc-home-greeting'), false, 'SPA remounts keep the saved visibility');
    await open(); await set('#rc-home-show-banner', true);
    await browser.waitFor("document.querySelectorAll('#rc-playtime-home .rc-playtime-tile').length===3");
    assert.equal(await visible('.rc-home-greeting-clock'), false);
    assert.equal(await visible('.rc-home-greeting-copy'), false);
    assert.equal(await browser.evaluate('JSON.stringify(saved.rcPlaytimeHistory)'), history);
    assert.equal(await visible('#continue'), true, 'Other Home content is unaffected');
    assert.deepEqual(browser.errors, []);
  });
