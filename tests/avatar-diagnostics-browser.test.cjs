const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(workspace, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const styles = ['src/shared/startup.css', 'src/shared/theme.css', 'src/pages/avatar/avatar-page.css'];
const preview = '<div class="preview-column"><div id="avatar-preview"><canvas width="300" height="300"></canvas></div></div>';
const inventory = '<div class="inventory-column"><nav id="avatar-categories"><ul>'
  + ['最近', 'アバター', 'ボディ', '服装', 'アクセサリ', 'アニメ'].map(text => `<li><button>${text}</button></li>`).join('')
  + '</ul></nav><div class="avatar-items-container"><a class="avatar-item-card" href="/catalog/123/private-avatar-sentinel">private-avatar-sentinel</a></div></div>';
const ready = "document.documentElement.getAttribute('data-rc-avatar-boot')==='ready'";
const report = 'RobloxCustomizerAvatarDiagnostics.snapshot()';

test('Avatar diagnostics identify a real remount, untracked gate changes and the loaded build without collecting page contents',
  { skip: !process.env.CHROME_BIN, timeout: 20000 }, async t => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      const file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      if (styles.includes(file)) { response.setHeader('Content-Type', 'text/css'); response.end(read(file)); return; }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="ja"><head><meta name="locale-data" data-language-code="ja">
        ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
        <style>body{margin:0;background:#455574;color:white;font:16px Arial}#content{margin:24px}
        #avatar-preview{width:300px;height:300px}ul{list-style:none;padding:0}.avatar-item-card{display:block;height:160px}</style>
        </head><body><main id="content"><div class="avatar-editor">${preview}${inventory}</div></main></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'avatar-diagnostics');
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.chrome={
      i18n:{getUILanguage:()=> 'ja'},runtime:{id:'test-extension',getManifest:()=>({version:${JSON.stringify(manifest.version)}}),sendMessage(){}},
      storage:{local:{async get(){return{}},async set(){},async remove(){}},onChanged:{addListener(){}}}};
      Object.defineProperty(navigator,'clipboard',{value:{async writeText(text){window.copiedDiagnostics=text}}});` });
    for (const file of manifest.content_scripts[0].js) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: read(file) });
    const url = `http://127.0.0.1:${server.address().port}/ja/my/avatar?token=private-query-sentinel`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#avatar-preview', url);
    for (const file of ['src/shared/native-labels.js', 'src/shared/i18n.js', 'src/pages/avatar/avatar-page.js']) await browser.evaluate(read(file));
    await browser.waitFor("!!document.querySelector('#rc-avatar-loading .rc-avatar-diagnostics-open')");
    await browser.click('#rc-avatar-loading .rc-avatar-diagnostics-open');
    assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-diagnostics').open"), true);
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#rc-avatar-diagnostics')).visibility"), 'visible', 'Report can be opened while the page is gated');
    assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-diagnostics h2').textContent"), '読み込み診断');
    await browser.click('#rc-avatar-diagnostics [data-copy]');
    await browser.waitFor('!!window.copiedDiagnostics');
    let data = JSON.parse(await browser.evaluate('copiedDiagnostics'));
    assert.equal(data.build, 'avatar-load-20261022-4');
    assert.equal(data.extensionVersion, manifest.version);
    assert.equal(data.layout.reason, 'preferences-pending');
    assert.equal(data.runtimeAvailable, true);
    await browser.click('#rc-avatar-diagnostics [data-close]');
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none'})");
    await browser.waitFor(ready);
    const initialPreview = (await browser.evaluate(report)).layout.nodes.preview;
    const before = (await browser.evaluate(report)).entries.length;
    await browser.evaluate('for(let i=0;i<250;i++)RobloxCustomizerStartup.syncRoute()');
    await pause(30);
    assert.equal((await browser.evaluate(report)).entries.length, before, 'Repeated identical readiness reports do not fill the trace');

    await browser.evaluate(`document.querySelector('.avatar-editor').replaceWith(Object.assign(document.createElement('div'),{className:'avatar-editor',innerHTML:${JSON.stringify(preview)}}))`);
    await browser.waitFor("document.documentElement.getAttribute('data-rc-avatar-boot')==='pending'");
    data = await browser.evaluate(report);
    assert.ok(data.entries.some(entry => entry.event === 'gate-request' && entry.from === 'ready' && entry.to === 'pending'
      && ['studio-not-arranged', 'studio-disconnected', 'view-moved', 'preview-disconnected'].includes(entry.reason)), 'Record why the enhanced editor was hidden again');
    await browser.evaluate(`document.querySelector('.avatar-editor').insertAdjacentHTML('beforeend',${JSON.stringify(inventory)})`);
    await browser.waitFor(ready);
    data = await browser.evaluate(report);
    assert.notEqual(data.layout.nodes.preview, initialPreview, 'Anonymous node identities distinguish native mounts');
    assert.equal(data.previewPanels, 1);
    assert.ok(data.entries.some(entry => entry.event === 'boot-observed' && entry.to === 'ready' && entry.source === 'startup'));

    await browser.evaluate("document.documentElement.setAttribute('data-rc-avatar-boot','pending')");
    await pause(30);
    assert.ok((await browser.evaluate(report)).entries.some(entry => entry.event === 'boot-observed' && entry.from === 'ready'
      && entry.to === 'pending' && entry.source === 'untracked'), 'Capture changes not requested by this startup instance');
    await browser.evaluate('RobloxCustomizerStartup.syncRoute()');
    await browser.waitFor(ready);
    await browser.click('#rc-avatar-2d .rc-avatar-diagnostics-open');
    assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-diagnostics').open"), true);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: false });
    assert.equal(await browser.evaluate(`(() => {const panel=document.querySelector('#rc-avatar-diagnostics'),rect=panel.getBoundingClientRect();
      return rect.x>=0&&rect.right<=innerWidth&&panel.scrollWidth<=panel.clientWidth})()`), true, 'The diagnostic window fits narrow screens');
    if (process.env.RC_DIAGNOSTICS_SCREENSHOT) {
      const screenshot = await browser.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(process.env.RC_DIAGNOSTICS_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
    }
    await browser.evaluate("Object.defineProperty(navigator.clipboard,'writeText',{value:()=>Promise.reject(new Error('blocked'))})");
    await browser.click('#rc-avatar-diagnostics [data-copy]');
    await browser.waitFor("document.querySelector('#rc-avatar-diagnostics [role=status]').textContent.includes('選択')");
    assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-diagnostics textarea').selectionEnd>0"), true);
    await browser.clickAt({ x: 5, y: 5 });
    await browser.waitFor("!document.querySelector('#rc-avatar-diagnostics')");
    assert.equal(await browser.evaluate(ready),true,'Dismissing diagnostics keeps the editor ready');

    // Keep the first startup events plus recent events, with a strict memory cap.
    await browser.evaluate(`(async()=>{for(let i=0;i<160;i++){
      document.documentElement.setAttribute('data-rc-avatar-boot',i%2?'ready':'pending');await Promise.resolve();
    }})()`);
    data = await browser.evaluate(report);
    assert.equal(data.entries.length, 120); assert.ok(data.dropped > 0);
    assert.equal(data.entries[0].event, 'startup');
    const serialized = JSON.stringify(data);
    assert.doesNotMatch(serialized, /private-query-sentinel|private-avatar-sentinel|https?:\/\/|chrome-extension:\/\//);
    assert.deepEqual(browser.errors, []);
  });
