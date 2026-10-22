const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/dialogs.js', 'src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/runtime.js',
  'src/shared/i18n.js', 'src/shared/startup.js', 'src/settings/terms-acceptance.js', 'src/settings/language-warning.js',
  'src/settings/extension-warning.js', 'src/settings/settings.js', 'src/settings/settings-guide.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css', 'src/settings/extension-warning.css', 'src/settings/settings-guide.css'];
const key = 'robloxCustomizerSettingsGuideSeen';
const guide = '#rc-settings-guide-dialog';
const visible = `!!document.querySelector('${guide}:modal')`;

async function launch(t) {
  const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
    response.setHeader('Cache-Control', 'no-store');
    if (files.has(file)) {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/javascript');
      response.end(fs.readFileSync(path.join(workspace, file))); return;
    }
    const language = url.searchParams.get('lang') || 'en';
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="${language}" class="dark-theme" ${url.searchParams.has('btr') ? 'btr-loaded="true"' : ''}>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="locale-data" data-language-code="${language}">
      ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
      <style>body{margin:24px;background:linear-gradient(120deg,#394864,#655371);color:white;font:16px Arial}#settings-popover-menu{position:fixed;z-index:1000;right:24px;top:40px;padding:16px;list-style:none;background:#30343e}#settings-popover-menu a{color:white}#navbar-settings{float:right}</style></head>
      <body><button id="navbar-settings" aria-label="Settings" onclick="document.querySelector('#settings-popover-menu').hidden=!document.querySelector('#settings-popover-menu').hidden">⚙</button>
      <ul id="settings-popover-menu" hidden><li><a href="/my/account">Settings</a></li></ul><main id="HomeContainer"><h1>Roblox</h1></main>
      <script>
        const listeners=[],messages=[];
        window.readSaved=()=>({robloxCustomizerTermsAccepted:${!url.searchParams.has('first')},customBackground:{source:'none',uiLanguage:'en'},...JSON.parse(localStorage.getItem('guide-fixture')||'{}')});
        const update=async patch=>{const old=readSaved();localStorage.setItem('guide-fixture',JSON.stringify({...old,...patch}));listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(patch).map(([key,newValue])=>[key,{oldValue:old[key],newValue}])),'local'))};
        window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){
          if(keys==='${key}'&&location.search.includes('slow')){const old=readSaved();return new Promise(resolve=>{window.releaseGuideRead=()=>resolve(old)})}return readSaved()},set:update,
          async remove(key){const old=readSaved();delete old[key];localStorage.setItem('guide-fixture',JSON.stringify(old));listeners.forEach(fn=>fn({[key]:{newValue:undefined}},'local'))}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{id:'fixture',lastError:null,getURL:file=>'/'+file,onMessage:{addListener:fn=>messages.push(fn)},sendMessage(message,callback){queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:1,name:'Player',displayName:'Player'}:{ok:true,games:[],folders:[]}))}}};
        window.openCustomizer=()=>messages.forEach(fn=>fn({type:'rc-open-settings'},{id:'fixture'}));
      </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const browser = await isolatedChrome(t, 'settings-guide');
  await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const navigate = async query => {
    const url = origin+'/home'+query;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#navbar-settings', url);
  };
  return { browser, navigate };
}

test('First-use guide explains both settings entries, opens real settings, and remembers dismissal across visits and tabs',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const { browser, navigate } = await launch(t);
    await navigate('?first');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-terms-accept');
    await browser.waitFor(visible);
    assert.equal(await browser.evaluate("document.querySelectorAll('dialog:modal').length"), 1);
    assert.equal(await browser.evaluate(`readSaved().${key}??false`), false, 'Viewing the guide is not a remembered dismissal');
    assert.equal(await browser.evaluate(`document.querySelectorAll('${guide} li').length`), 2);
    for (const locale of ['en','zh-CN','zh-TW','id','ja','th','ko']) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
      await browser.waitFor("document.querySelector('#rc-settings-guide-title').textContent===RobloxCustomizerI18n.t('Find your Customizer settings')");
      for (const width of [1280, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        assert.equal(await browser.evaluate(`(()=>{const n=document.querySelector('${guide}'),r=n.getBoundingClientRect();return n.scrollWidth<=n.clientWidth+1&&r.left>=0&&r.right<=innerWidth&&r.height<=innerHeight})()`), true, locale+' at '+width);
        assert.equal(await browser.evaluate(`document.querySelector('${guide} li:last-child p').textContent===RobloxCustomizerI18n.t("On a Roblox page, click the Roblox Customizer icon in your browser's top-right toolbar.")`), true);
        if (process.env.SETTINGS_GUIDE_SCREENSHOTS && locale === 'zh-CN') {
          const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(workspace, `.tmp-settings-guide-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate("document.querySelector('#rc-settings-guide-open').focus()");
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await browser.evaluate("document.activeElement.id"), 'rc-settings-guide-done');
    await browser.click('#rc-settings-guide-open');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')&&!document.querySelector('#rc-settings-guide-dialog')");
    assert.equal(await browser.evaluate(`readSaved().${key}`), true);
    await browser.click('#rc-done');
    await browser.send('Page.reload');
    await waitForDocument(browser, '#navbar-settings');
    await pause(350);
    assert.equal(await browser.evaluate(visible), false);
    // Both actual entry points retain the same settings flow.
    await browser.click('#navbar-settings');
    await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
    assert.equal(await browser.evaluate("document.querySelector('.rc-settings-menu-entry').checkVisibility()"), true, 'The gear reveals the native settings menu');
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
    await browser.click('#rc-done');
    await browser.evaluate(`chrome.storage.local.set({${key}:false})`);
    await browser.waitFor(visible);
    await browser.evaluate('openCustomizer()');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')&&!document.querySelector('#rc-settings-guide-dialog')");
    assert.equal(await browser.evaluate(`readSaved().${key}`), true, 'The browser action completes an open guide before showing settings');
    await browser.click('#rc-done');
    await browser.evaluate(`chrome.storage.local.set({${key}:false})`);
    await browser.waitFor(visible);
    await browser.evaluate(`chrome.storage.local.set({${key}:true})`);
    await browser.waitFor(`!document.querySelector('${guide}')`);
    // A stale storage read must not undo completion received from another tab.
    await browser.evaluate(`localStorage.setItem('guide-fixture',JSON.stringify({...readSaved(),${key}:false}))`);
    await navigate('?slow');
    await browser.waitFor("typeof releaseGuideRead==='function'");
    assert.equal(await browser.evaluate(visible), false);
    await browser.evaluate(`chrome.storage.local.set({${key}:true});releaseGuideRead()`);
    await pause(350);
    assert.equal(await browser.evaluate(visible), false);
    await browser.evaluate(`chrome.storage.local.set({${key}:false})`);
    await browser.waitFor(visible);
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.waitFor(`!document.querySelector('${guide}')`);
    assert.equal(await browser.evaluate(`readSaved().${key}`), true);
    assert.deepEqual(browser.errors, []);
  });

test('Settings guide waits for consent, unsupported-language and extension notices, and yields to later warnings',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const { browser, navigate } = await launch(t);
    await navigate('?first&lang=fr-FR&btr');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    await browser.click('#rc-terms-later');
    await pause(350);
    assert.equal(await browser.evaluate(visible), false, 'Declining the terms does not reopen consent or show the guide');
    assert.equal(await browser.evaluate("!!document.querySelector('dialog:modal')"), false);
    await browser.evaluate('openCustomizer()');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    await browser.click('#rc-terms-accept');
    await browser.waitFor("!!document.querySelector('#rc-language-warning-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-language-warning-dialog button');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
    await browser.click('#rc-done');
    await browser.waitFor("!!document.querySelector('#rc-extension-warning-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-extension-warning-dialog button');
    await browser.waitFor(visible);
    assert.equal(await browser.evaluate("document.querySelectorAll('dialog:modal').length"), 1);
    await browser.evaluate("const marker=document.createElement('img');marker.src='chrome-extension://adbacgifemdbhdkfppmeilbgppmhaobf/icon.png';document.body.append(marker)");
    await browser.waitFor("!!document.querySelector('#rc-extension-warning-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false, 'A newly detected extension gets its notice before the guide resumes');
    assert.equal(await browser.evaluate(`readSaved().${key}??false`), false);
    await browser.click('#rc-extension-warning-dialog button');
    await browser.waitFor(visible);
    await browser.click('#rc-settings-guide-open');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
    assert.equal(await browser.evaluate("document.querySelector('#rc-settings-language-notice').hidden"), false, 'The guide can open the existing fallback settings');
    await browser.click('#rc-done');
    assert.deepEqual(browser.errors, []);
  });
