const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const { fileFor, parse, LOCALES } = require('../src/settings/update-announcement-core.js');
const workspace = path.resolve(__dirname, '..');
const original = fs.readFileSync(path.join(__dirname, 'fixtures/update-announcement.md'), 'utf8');
const scripts = ['src/shared/dialogs.js', 'src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/runtime.js',
  'src/shared/i18n.js', 'src/shared/startup.js', 'src/settings/terms-acceptance.js', 'src/settings/language-warning.js',
  'src/settings/extension-warning.js', 'src/settings/settings.js', 'src/settings/settings-guide.js',
  'src/settings/update-announcement-core.js', 'src/settings/update-announcement.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css', 'src/settings/extension-warning.css',
  'src/settings/settings-guide.css', 'src/settings/update-announcement.css'];
const key = 'rcUpdateAnnouncementSeen:1.2.0';
const announcement = '#rc-update-announcement-dialog';
const visible = `!!document.querySelector('${announcement}:modal')`;

async function launch(t) {
  let markdown = original;
  const translations = new Map(), held = new Map(), requests = [];
  const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
    response.setHeader('Cache-Control', 'no-store');
    if (/^UPDATE(?:\.[a-zA-Z-]+)?\.md$/.test(file)) {
      requests.push(file);
      const value = file === 'UPDATE.md' ? markdown : translations.get(file);
      const send = () => {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.statusCode = value === undefined ? 404 : 200; response.end(value || '');
      };
      if (held.has(file)) held.set(file, send); else send();
      return;
    }
    if (files.has(file)) {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/javascript');
      response.end(fs.readFileSync(path.join(workspace, file))); return;
    }
    const language = url.searchParams.get('lang') || 'en';
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="${language}" class="dark-theme" ${url.searchParams.has('btr') ? 'btr-loaded="true"' : ''}>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="locale-data" data-language-code="${language}">
      ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
      <style>body{margin:24px;background:linear-gradient(120deg,#394864,#655371);color:white;font:16px Arial}#settings-popover-menu{position:fixed;z-index:1000;right:24px;top:0;list-style:none}#settings-popover-menu a{color:white}</style></head>
      <body><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="HomeContainer"><h1>Roblox</h1></main>
      ${url.searchParams.has('hiddenModal') ? '<div id="native-modal" role="dialog" aria-modal="true" style="display:none">Native dialog</div><dialog role="dialog" aria-modal="true">Closed native dialog</dialog>' : ''}
      <script>
        const listeners=[],messages=[];
        window.readSaved=()=>({robloxCustomizerTermsAccepted:${!url.searchParams.has('first')},robloxCustomizerSettingsGuideSeen:${!url.searchParams.has('first')},customBackground:{source:'none',uiLanguage:'en'},...JSON.parse(localStorage.getItem('update-fixture')||'{}')});
        window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){
          if(typeof keys==='string'&&keys.startsWith('rcUpdateAnnouncementSeen:')&&location.search.includes('slow')){const old=readSaved();return new Promise(resolve=>{window.releaseUpdateRead=()=>resolve(old)})}return readSaved()},
          async set(patch){const old=readSaved();localStorage.setItem('update-fixture',JSON.stringify({...old,...patch}));listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(patch).map(([key,newValue])=>[key,{oldValue:old[key],newValue}])),'local'))},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{id:'fixture',lastError:null,getURL:file=>'/'+file,onMessage:{addListener:fn=>messages.push(fn)},sendMessage(message,callback){queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:1,name:'Player',displayName:'Player'}:{ok:true,games:[],folders:[]}))}}};
        window.openCustomizer=()=>messages.forEach(fn=>fn({type:'rc-open-settings'},{id:'fixture'}));
      </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const browser = await isolatedChrome(t, 'update-announcement');
  await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const navigate = async query => {
    const url = origin+'/home'+query; await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#HomeContainer', url);
  };
  return { browser, navigate, requests, setContent: value => { markdown = value; },
    setTranslation: (locale, value) => translations.set(fileFor(locale), value),
    hold: locale => held.set(fileFor(locale), null),
    release(locale) { const send = held.get(fileFor(locale)); held.delete(fileFor(locale)); send?.(); }
  };
}

test('Announcements load each selected language independently, update live, and share read state across languages',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const { browser, navigate, setTranslation, requests } = await launch(t);
    const catalog = {};
    for (const locale of LOCALES) {
      const source = (locale === 'en' ? original : fs.readFileSync(path.join(workspace, fileFor(locale)), 'utf8')).replace(/^id: .+$/m, 'id: 1.2.0');
      catalog[locale] = parse(source);
      if (locale !== 'en') setTranslation(locale, source);
    }
    await navigate(''); await browser.waitFor(visible);
    assert.deepEqual(requests, ['UPDATE.md'], 'English does not fetch unrelated translations');
    for (const locale of LOCALES) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
      await browser.waitFor(`document.querySelector('.rc-update-content')?.lang==='${locale}'&&RobloxCustomizerUpdateAnnouncement.available()`);
      assert.equal(await browser.evaluate("document.querySelector('#rc-update-announcement-title').textContent"), catalog[locale].title);
      assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.rc-update-content li')].map(node=>node.textContent)"), catalog[locale].blocks.filter(block => block.type === 'list').flatMap(block => block.items));
      await browser.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 720, deviceScaleFactor: 1, mobile: false });
      assert.equal(await browser.evaluate("(()=>{const node=document.querySelector('.rc-update-content');return node.scrollWidth<=node.clientWidth+1})()"), true, locale+' fits');
      if (process.env.UPDATE_ANNOUNCEMENT_SCREENSHOTS) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(workspace, `.tmp-update-announcement-${locale}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    assert.deepEqual(requests, LOCALES.map(fileFor), 'Only the selected file is requested, once per language');
    await browser.click('#rc-update-announcement-done');
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('zh-CN')");
    await browser.waitFor('RobloxCustomizerUpdateAnnouncement.available()');
    await pause(250); assert.equal(await browser.evaluate(visible), false, 'Changing language does not repeat an already read release');
    await browser.evaluate('openCustomizer()');
    await browser.waitFor("document.querySelector('#rc-view-updates')?.checkVisibility()");
    await browser.click('#rc-view-updates'); await browser.waitFor(visible);
    assert.equal(await browser.evaluate("document.querySelector('#rc-update-announcement-title').textContent"), catalog['zh-CN'].title);
    await browser.click('#rc-update-announcement-done');
    assert.deepEqual(browser.errors, []);
  });

test('Missing or invalid translations fall back to English, a disabled locale stays off, and stale responses cannot overwrite the chosen language',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const { browser, navigate, setTranslation, hold, release, requests } = await launch(t);
    await navigate(''); await browser.waitFor(visible);
    setTranslation('ja', 'Malformed content');
    setTranslation('ko', original.replace('enabled: true', 'enabled: false'));
    for (const locale of ['zh-CN', 'ja']) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
      await browser.waitFor('RobloxCustomizerUpdateAnnouncement.available()');
      await browser.waitFor("document.querySelector('.rc-update-content')?.lang==='en'");
      assert.equal(await browser.evaluate("document.querySelector('#rc-update-announcement-title').textContent"), 'Update Changelog');
    }
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('ko')");
    await browser.waitFor(`!document.querySelector('${announcement}')&&!RobloxCustomizerUpdateAnnouncement.available()`);
    assert.equal(await browser.evaluate(`readSaved()[${JSON.stringify(key)}]??false`), false);
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')"); await browser.waitFor(visible);
    await browser.click('#rc-update-announcement-done');
    setTranslation('ja', '---\nid: 1.2.0\nenabled: true\n---\n# 日本語の更新\n\n1. 日本語');
    setTranslation('ko', '---\nid: 1.2.0\nenabled: true\n---\n# 한국어 업데이트\n\n1. 한국어');
    await navigate(''); await browser.waitFor('RobloxCustomizerUpdateAnnouncement.available()');
    await browser.evaluate('RobloxCustomizerUpdateAnnouncement.open()'); await browser.waitFor(visible);
    hold('ja');
    const before = requests.length;
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('ja')");
    for (let i = 0; requests.length === before && i < 50; i++) await pause(20);
    assert.equal(requests.at(-1), 'UPDATE.ja.md');
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('ko')");
    await browser.waitFor("document.querySelector('.rc-update-content')?.lang==='ko'");
    release('ja'); await pause(250);
    assert.equal(await browser.evaluate("document.querySelector('#rc-update-announcement-title').textContent"), '한국어 업데이트');
    assert.deepEqual(browser.errors, []);
  });

test('Editable announcements remember each release, can be reopened, preserve text, and honor new IDs and disabled content',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const { browser, navigate, setContent } = await launch(t);
    await navigate(''); await browser.waitFor(visible);
    assert.equal(await browser.evaluate(`readSaved()[${JSON.stringify(key)}]??false`), false);
    assert.equal(await browser.evaluate(`document.querySelectorAll('${announcement} h3').length`), 3);
    assert.equal(await browser.evaluate(`document.querySelectorAll('${announcement} li').length`), 14);
    for (const locale of ['en','zh-CN','zh-TW','id','ja','th','ko']) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
      for (const width of [1280, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 720, deviceScaleFactor: 1, mobile: false });
        assert.equal(await browser.evaluate(`(()=>{const n=document.querySelector('${announcement}'),body=n.querySelector('.rc-update-content'),r=n.getBoundingClientRect(),b=n.querySelector('button').getBoundingClientRect();return n.scrollWidth<=n.clientWidth+1&&body.scrollWidth<=body.clientWidth+1&&r.left>=0&&r.right<=innerWidth&&r.height<=innerHeight&&b.bottom<=r.bottom})()`), true, locale+' at '+width);
        assert.equal(await browser.evaluate("document.querySelector('#rc-update-announcement-title').textContent"), 'Update Changelog', 'The editable copy is displayed exactly as written');
        assert.equal(await browser.evaluate("document.querySelector('#rc-update-announcement-done').textContent===RobloxCustomizerI18n.t('Got it')"), true);
        if (process.env.UPDATE_ANNOUNCEMENT_SCREENSHOTS && locale === 'zh-CN') {
          const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
          fs.writeFileSync(path.join(workspace, `.tmp-update-announcement-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 540, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate("document.querySelector('.rc-update-content').focus()");
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'PageDown', code: 'PageDown', windowsVirtualKeyCode: 34 });
    await browser.waitFor("document.querySelector('.rc-update-content').scrollTop>0");
    await browser.click('#rc-update-announcement-done');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await browser.evaluate(`readSaved()[${JSON.stringify(key)}]`), true);
    await navigate(''); await pause(350);
    assert.equal(await browser.evaluate(visible), false, 'The same ID does not repeat after reload');
    await browser.evaluate('openCustomizer()');
    await browser.waitFor("document.querySelector('#rc-view-updates')?.checkVisibility()");
    await browser.click('#rc-view-updates'); await browser.waitFor(visible);
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.waitFor(`!document.querySelector('${announcement}')`);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), true, 'Escape leaves the underlying settings open');
    await browser.click('#rc-done');
    setContent('---\nid: 1.2.1\nenabled: true\n---\n# 新的更新公告\n\n## New section\n1. <img src=x onerror=alert(1)>\n2. Edited in UPDATE.md');
    await navigate(''); await browser.waitFor(visible);
    assert.equal(await browser.evaluate("document.querySelector('#rc-update-announcement-title').textContent"), '新的更新公告');
    assert.equal(await browser.evaluate(`document.querySelectorAll('${announcement} img').length`), 0, 'Content is rendered as text');
    await browser.click('#rc-update-announcement-done');
    assert.equal(await browser.evaluate("readSaved()['rcUpdateAnnouncementSeen:1.2.1']&&readSaved()['rcUpdateAnnouncementSeen:1.2.0']"), true);
    setContent(original); await navigate(''); await pause(350);
    assert.equal(await browser.evaluate(visible), false, 'Viewing a later ID preserves the earlier ID acknowledgement');
    setContent(original.replace('enabled: true', 'enabled: false')); await navigate(''); await pause(350);
    assert.equal(await browser.evaluate(visible), false);
    await browser.evaluate('openCustomizer()');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
    assert.equal(await browser.evaluate("document.querySelector('#rc-view-updates').hidden"), true);
    await browser.click('#rc-done');
    // Completion from another tab wins over an earlier unresolved storage read.
    setContent(original.replace('id: 1.2.0', 'id: slow-release'));
    await navigate('?slow');
    await browser.waitFor("typeof releaseUpdateRead==='function'");
    assert.equal(await browser.evaluate(visible), false);
    await browser.evaluate("chrome.storage.local.set({'rcUpdateAnnouncementSeen:slow-release':true});releaseUpdateRead()");
    await pause(350); assert.equal(await browser.evaluate(visible), false);
    assert.deepEqual(browser.errors, []);
  });

test('Hidden and closed native modals do not prevent first-use prompts, and CSS dismissal releases the announcement',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const { browser, navigate } = await launch(t);
    await navigate('?first&hiddenModal');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    await browser.click('#rc-terms-accept');
    await browser.waitFor("!!document.querySelector('#rc-settings-guide-dialog:modal')");
    await browser.evaluate("document.querySelector('#native-modal').style.display='block'");
    await browser.waitFor("!document.querySelector('#rc-settings-guide-dialog')");
    assert.equal(await browser.evaluate('readSaved().robloxCustomizerSettingsGuideSeen'), false);
    await browser.evaluate("document.querySelector('#native-modal').style.visibility='hidden'");
    await browser.waitFor("!!document.querySelector('#rc-settings-guide-dialog:modal')");
    await browser.click('#rc-settings-guide-done');
    await browser.waitFor(visible);
    await browser.evaluate("document.querySelector('#native-modal').style.visibility='visible'");
    await browser.waitFor(`!document.querySelector('${announcement}')`);
    assert.equal(await browser.evaluate(`readSaved()[${JSON.stringify(key)}]??false`), false, 'Waiting for a native modal does not mark an announcement as read');
    await browser.evaluate("document.querySelector('#native-modal').style.display='none'");
    await browser.waitFor(visible);
    await browser.click('#rc-update-announcement-done');
    assert.deepEqual(browser.errors, []);
  });

test('A first Roblox visit shows the guide then the announcement without opening settings, and remembers both dismissals',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const { browser, navigate } = await launch(t);
    await navigate('?first');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-terms-accept');
    await browser.waitFor("!!document.querySelector('#rc-settings-guide-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false, 'The guide appears before the announcement');
    assert.equal(await browser.evaluate('readSaved().robloxCustomizerSettingsGuideSeen'), false);
    await browser.click('#rc-settings-guide-done');
    await browser.waitFor(visible);
    assert.equal(await browser.evaluate('readSaved().robloxCustomizerSettingsGuideSeen'), true);
    assert.equal(await browser.evaluate(`readSaved()[${JSON.stringify(key)}]??false`), false);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), false, 'No settings entry needs to be clicked');
    assert.equal(await browser.evaluate("document.querySelectorAll('dialog:modal').length"), 1);
    await browser.click('#rc-update-announcement-done');
    await browser.waitFor(`readSaved()[${JSON.stringify(key)}]===true`);
    await navigate('?first');
    await browser.evaluate('Promise.all([RobloxCustomizerSettingsGuide.ready, RobloxCustomizerExtensionWarning.ready])');
    await browser.waitFor('RobloxCustomizerUpdateAnnouncement.available()');
    await pause(350);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-guide-dialog, #rc-update-announcement-dialog, #rc-terms-dialog, #rc-settings-overlay')"), false, 'Refresh does not repeat completed first-use prompts');
    assert.deepEqual(browser.errors, []);
  });

test('Announcements follow terms, language and extension notices, the guide and settings, and yield to newly detected extensions',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const { browser, navigate } = await launch(t);
    await navigate('?first&lang=fr-FR&btr');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-terms-accept');
    await browser.waitFor("!!document.querySelector('#rc-language-warning-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-language-warning-dialog button');
    await browser.waitFor("!!document.querySelector('#rc-extension-warning-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-extension-warning-dialog button');
    await browser.waitFor("!!document.querySelector('#rc-settings-guide-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-settings-guide-open');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
    assert.equal(await browser.evaluate(visible), false);
    await browser.click('#rc-done'); await browser.waitFor(visible);
    assert.equal(await browser.evaluate("document.querySelectorAll('dialog:modal').length"), 1);
    await browser.evaluate("const marker=document.createElement('img');marker.src='chrome-extension://adbacgifemdbhdkfppmeilbgppmhaobf/icon.png';document.body.append(marker)");
    await browser.waitFor("!!document.querySelector('#rc-extension-warning-dialog:modal')");
    assert.equal(await browser.evaluate(visible), false);
    assert.equal(await browser.evaluate(`readSaved()[${JSON.stringify(key)}]??false`), false, 'Pausing for a notice does not dismiss the announcement');
    await browser.click('#rc-extension-warning-dialog button'); await browser.waitFor(visible);
    await browser.evaluate(`chrome.storage.local.set({${JSON.stringify(key)}:true})`);
    await browser.waitFor(`!document.querySelector('${announcement}')`);
    assert.deepEqual(browser.errors, []);
  });
