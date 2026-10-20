const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const testFont = require('./helpers/font.cjs');
const workspace = path.resolve(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8')).content_scripts;
const scripts = [...new Set(entries.filter(entry => entry.world !== 'MAIN').flatMap(entry => entry.js || []))];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];

const setup = `
  window.saved=JSON.parse(localStorage.getItem('fixture-font-settings')||'null')||{customBackground:{source:'none',uiLanguage:'en'},robloxCustomizerTermsAccepted:true};
  window.fontLoads=0;window.fileReads=0;window.clicks=0;
  const NativeFontFace=FontFace;window.FontFace=class extends NativeFontFace{constructor(...args){super(...args);fontLoads++}};
  const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(...args){fileReads++;return get.apply(this,args)};
  const listeners=[];
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return structuredClone(saved)},async set(patch){const changes=Object.fromEntries(Object.entries(patch).map(([key,value])=>[key,{oldValue:saved[key],newValue:value}]));Object.assign(saved,structuredClone(patch));localStorage.setItem('fixture-font-settings',JSON.stringify(saved));listeners.forEach(fn=>fn(changes,'local'))},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){queueMicrotask(()=>callback({error:'No optional fixture data'}))}}};
`;
const fixture = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
  <style>body{margin:24px;background:#29344d;color:white;font:16px Arial}main{max-width:1000px}button,input,textarea{font-family:Arial}.icon-fixture{font-family:"Fixture Icons"}.generated:before{content:'Generated text';font-family:Arial}#settings-popover-menu{position:fixed;right:0;top:0}.hidden{display:none!important}</style></head>
  <body><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="content"><h1>Website font</h1>
  <p id="native-copy">Readable text · 0123456789 · 中文字体</p><input id="native-input" value="Keep my input" placeholder="Native placeholder"><textarea id="native-textarea">Keep my text</textarea>
  <button id="native-button" onclick="clicks++">Native button</button><a id="native-link" href="#sample">Native link</a><span class="icon-fixture" id="native-icon">&#xe001;</span><p class="generated"></p><div id="late-content"></div></main></body></html>`;

test('local font files apply to native and dynamic text, persist after navigation, and restore cleanly',
  { skip: !process.env.CHROME_BIN || !testFont, timeout: 60000 }, async t => {
    const files = fs.mkdtempSync(path.join(workspace, '.tmp-font-files-'));
    t.after(() => { assert.equal(path.dirname(path.resolve(files)), workspace); fs.rmSync(files, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); });
    const fontFile = path.join(files, 'Local 字体.ttf');
    const invalidFile = path.join(files, 'Invalid.ttf');
    fs.copyFileSync(testFont, fontFile);
    fs.writeFileSync(invalidFile, 'This is not font data.');
    const assets = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'fonts');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await browser.send('Page.navigate', { url: origin + '/home' });
    await waitForDocument(browser, '#native-copy', origin + '/home');
    await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
    const open = async () => { await browser.evaluate("document.querySelector('.rc-settings-menu-entry').click()"); await browser.waitFor("!!document.querySelector('#rc-font-file')"); };
    const upload = async file => {
      const { root } = await browser.send('DOM.getDocument');
      const { nodeId } = await browser.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#rc-font-file' });
      await browser.send('DOM.setFileInputFiles', { nodeId, files: [file] });
    };
    await open();
    assert.equal(await browser.evaluate("document.querySelector('#rc-custom-font-enabled').disabled"), true);
    await upload(fontFile);
    await browser.waitFor("saved.customBackground.customFontEnabled && document.documentElement.hasAttribute('data-rc-custom-font') && !RobloxCustomizerFonts.state().loading");
    const key = await browser.evaluate('saved.customBackground.fontFileKey');
    const samples = ['#native-copy', '#native-input', '#native-textarea', '#native-button', '#native-link', '#rc-font-title'];
    assert.ok((await browser.evaluate(`${JSON.stringify(samples)}.map(s=>getComputedStyle(document.querySelector(s)).fontFamily)`)).every(font => font.includes('Roblox Customizer Local')));
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#native-icon')).fontFamily"), '"Fixture Icons"');
    assert.ok((await browser.evaluate("getComputedStyle(document.querySelector('.generated'),'::before').fontFamily")).includes('Roblox Customizer Local'));
    assert.ok((await browser.evaluate("getComputedStyle(document.querySelector('#native-input'),'::placeholder').fontFamily")).includes('Roblox Customizer Local'));
    await browser.send('DOM.enable'); await browser.send('CSS.enable');
    const { root } = await browser.send('DOM.getDocument');
    const { nodeId } = await browser.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#native-copy' });
    const rendered = await browser.send('CSS.getPlatformFontsForNode', { nodeId });
    assert.ok(rendered.fonts.some(font => font.isCustomFont && font.glyphCount > 0), 'The uploaded binary font actually renders glyphs');
    await browser.evaluate("document.querySelector('#late-content').innerHTML='<p id=late-copy style=font-family:Arial>Text added later</p>';window.activeFont=[...document.fonts].find(f=>f.family==='Roblox Customizer Local');window.initialReads=fileReads;window.initialLoads=fontLoads");
    assert.ok((await browser.evaluate("getComputedStyle(document.querySelector('#late-copy')).fontFamily")).includes('Roblox Customizer Local'));
    for (const [locale, title] of [['zh-CN', '网页字体'], ['zh-TW', '網頁字體'], ['id', 'Font situs web'], ['en', 'Website font']]) {
      await browser.evaluate(`chrome.storage.local.set({customBackground:{...saved.customBackground,uiLanguage:'${locale}',glassBlur:22}})`);
      await browser.waitFor(`document.querySelector('#rc-font-title').textContent===${JSON.stringify(title)}`);
      assert.equal(await browser.evaluate("document.querySelector('#rc-font-file-name').textContent"), 'Local 字体.ttf');
    }
    assert.deepEqual(await browser.evaluate('[fileReads-initialReads,fontLoads-initialLoads,document.fonts.has(activeFont)]'), [0, 0, true], 'Unrelated preferences do not reload the font');
    await upload(invalidFile);
    await browser.waitFor("document.querySelector('#rc-font-status').textContent.includes('could not be loaded')");
    assert.equal(await browser.evaluate('saved.customBackground.fontFileKey'), key, 'Invalid fonts preserve the current selection');
    assert.equal(await browser.evaluate('document.fonts.has(activeFont)'), true);
    await browser.click('#rc-done'); await browser.click('#native-button');
    assert.deepEqual(await browser.evaluate("[clicks,document.querySelector('#native-input').value,document.querySelector('#native-textarea').value]"), [1, 'Keep my input', 'Keep my text']);
    await browser.send('Page.reload');
    await waitForDocument(browser, '#native-copy', origin + '/home');
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-font')");
    assert.equal(await browser.evaluate('saved.customBackground.fontFileKey'), key);
    await browser.send('Page.navigate', { url: origin + '/id/users/7366396729/profile' });
    await waitForDocument(browser, '#native-copy', origin + '/id/users/7366396729/profile');
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-font')");
    await open();
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate("document.querySelector('.rc-settings-fonts').scrollIntoView({block:'start'})");
    assert.equal(await browser.evaluate("document.querySelector('.rc-settings-dialog').scrollWidth>document.querySelector('.rc-settings-dialog').clientWidth+1"), false, 'Font controls fit on narrow screens');
    if (process.env.FONT_SETTINGS_SCREENSHOT) {
      const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(process.env.FONT_SETTINGS_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
    await browser.click('#rc-custom-font-enabled');
    await browser.waitFor("!document.documentElement.hasAttribute('data-rc-custom-font') && !saved.customBackground.customFontEnabled");
    assert.equal(await browser.evaluate('saved.customBackground.fontFileKey'), key, 'Disabling keeps the chosen file');
    await browser.click('#rc-custom-font-enabled');
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-font')");
    await browser.evaluate("window.nativeLoad=FontFace.prototype.load;FontFace.prototype.load=function(){return new Promise(resolve=>window.finishFontLoad=()=>resolve(nativeLoad.call(this)))}");
    await upload(fontFile);
    await browser.waitFor("typeof finishFontLoad==='function'");
    await browser.click('#rc-reset-font');
    await browser.evaluate('finishFontLoad();FontFace.prototype.load=nativeLoad');
    await pause(150);
    assert.equal(await browser.evaluate('saved.customBackground.customFontEnabled'), false, 'A late file read cannot undo Restore default');
    assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-custom-font')"), false);
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#native-copy')).fontFamily"), 'Arial');
    await browser.evaluate("chrome.storage.local.set({customBackground:{...saved.customBackground,customFontEnabled:true,fontFileKey:'missing-font',fontFileName:'Missing.ttf'}})");
    await browser.waitFor("RobloxCustomizerFonts.state().error.includes('unavailable')");
    assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-custom-font')"), false, 'A missing saved file leaves native text readable');
    await upload(fontFile);
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-font')&&!RobloxCustomizerFonts.state().error");
    // Extension content scripts run in an isolated world, while native text
    // belongs to the page. Confirm the loaded face reaches that shared DOM.
    const preferences = await browser.evaluate('saved.customBackground');
    await browser.evaluate('RobloxCustomizerFonts.apply({})');
    const { frameTree } = await browser.send('Page.getFrameTree');
    const { executionContextId } = await browser.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'font-content-script' });
    const isolated = await browser.send('Runtime.evaluate', { contextId: executionContextId, awaitPromise: true, returnByValue: true,
      expression: `(async()=>{window.chrome={storage:{local:{async get(){return {}}},onChanged:{addListener(){}}}};${fs.readFileSync(path.join(workspace, 'src/shared/fonts.js'), 'utf8')}
        await RobloxCustomizerFonts.apply(${JSON.stringify(preferences)});return RobloxCustomizerFonts.state()})()` });
    assert.equal(isolated.exceptionDetails, undefined);
    assert.equal(isolated.result.value.error, '');
    const document = await browser.send('DOM.getDocument');
    const copy = await browser.send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#native-copy' });
    const isolatedFonts = await browser.send('CSS.getPlatformFontsForNode', { nodeId: copy.nodeId });
    assert.ok(isolatedFonts.fonts.some(font => font.isCustomFont && font.glyphCount > 0), 'An isolated content-script font renders on native page text');
    assert.deepEqual(browser.errors, []);
  });
