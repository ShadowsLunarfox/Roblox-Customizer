const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/runtime.js', 'src/shared/native-labels.js', 'src/shared/i18n.js', 'src/shared/startup.js', 'src/settings/settings.js'];

function fixture() {
  return `<!doctype html><html lang="en" class="light-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:#151821;color:#f4f6fb}.light-theme{color:#202227}body.light-theme{background:#f4f4f5}#content{max-width:1000px;margin:24px auto;padding:16px;background:#777}#settings-popover-menu{position:fixed;right:16px;top:0;z-index:1000}#sample-text{color:#eee}button{font:inherit}h1{margin:0}img{max-width:100%}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme">
    <ul id="settings-popover-menu" role="menu"><li><a href="/my/account">Settings</a></li></ul>
    <main id="content"><section id="sample-panel"><h1 id="sample-text">Palette preview</h1></section>
      <div id="game-detail-page"><section id="store"><h2>Store</h2><ul class="store-cards"><li class="list-item"><div class="store-card"><div class="store-product-card-caption"><div class="store-card-name">Sample item</div><div class="store-card-price">125</div><div class="store-card-footer"><button id="sample-buy" class="PurchaseButton">Buy</button></div></div></div></li></ul></section></div>
    </main><script>
      const listeners=[];
      window.readPreferences=()=>JSON.parse(localStorage.getItem('customBackground')||'null')||{source:'none',glassBlur:23,glassOpacity:65};
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(){return {customBackground:readPreferences()}},async set(value){localStorage.setItem('customBackground',JSON.stringify(value.customBackground));listeners.forEach(fn=>fn({customBackground:{newValue:value.customBackground}},'local'))}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

async function serveFixture(t) {
    const assets = new Set([...styles, ...scripts, 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html; charset=utf-8');
      response.end(file === 'wallpaper.svg' ? '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#0e263d"/></svg>' : assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return `http://127.0.0.1:${server.address().port}`;
}

test('Transparency and blur buttons work independently across panels, themes, languages, wallpaper and reloads',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serveFixture(t);
    const browser = await isolatedChrome(t, 'effect-controls');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
    const url = `${origin}/games/606849621/Jailbreak`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '.rc-settings-menu-entry', url);
    await browser.evaluate(`document.body.insertAdjacentHTML('afterbegin', '<header id="header" class="rbx-header"><input id="navbar-search-input" aria-label="Search"></header>');
      document.querySelector('#store').insertAdjacentHTML('beforeend', '<section class="rc-store-category">Products</section>');
      document.querySelector('#content').insertAdjacentHTML('beforeend', '<section class="rc-private-server-card rc-server-view">Private server</section><section id="rc-profile-details">Profile details</section><section data-rc-private-config-panel>Server configuration</section><section data-rc-settings-panel>Account settings</section><section data-rc-profile-section="wearing"><article data-rc-profile-card>Avatar item</article></section>')`);
    await browser.click('.rc-settings-menu-entry');
    const snapshot = () => browser.evaluate(`(()=>{
      const style=(selector,pseudo)=>getComputedStyle(document.querySelector(selector),pseudo);
      const surfaces=[['#header','::before'],['#navbar-search-input'],['#settings-popover-menu'],['#store','::after'],['.store-card','::before'],['.rc-private-server-card'],['#rc-profile-details']];
      const opacity=s=>{const channels=s.backgroundColor.match(/[\\d.]+/g).map(Number);return channels[3]??1};
      return {buttons:['transparency','blur'].map(id=>document.getElementById('rc-disable-'+id).getAttribute('aria-pressed')),disabled:['opacity','blur'].map(id=>document.getElementById('rc-glass-'+id).disabled),values:['opacity','blur'].map(id=>document.getElementById('rc-glass-'+id).value),surfaces:surfaces.map(([selector,pseudo])=>({selector,alpha:opacity(style(selector,pseudo)),blur:style(selector,pseudo).backdropFilter}))};
    })()`);
    const original = await snapshot();
    assert.deepEqual(original.buttons, ['false', 'false']);
    assert.deepEqual(original.disabled, [false, false]);
    assert.deepEqual(original.values, ['65', '23']);
    assert.ok(original.surfaces.every(s => s.alpha > 0 && s.alpha < 1), `All representative panels start translucent: ${JSON.stringify(original.surfaces)}`);
    assert.ok(original.surfaces.every(s => s.blur.includes('blur(')), `Every backdrop filter is valid and active by default: ${JSON.stringify(original.surfaces)}`);
    // Exercise the blur button by keyboard as well as pointer interaction.
    await browser.evaluate("document.querySelector('#rc-disable-blur').focus()");
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    const blurOff = await snapshot();
    assert.deepEqual(blurOff.disabled, [false, true]);
    assert.ok(blurOff.surfaces.every(s => s.blur === 'none'), 'Disabling blur removes filters on panels, controls and pseudo backings');
    assert.deepEqual(blurOff.surfaces.map(s => s.alpha), original.surfaces.map(s => s.alpha), 'Blur does not change transparency');
    await browser.click('#rc-disable-blur');
    assert.deepEqual(await snapshot(), original, 'Re-enabling restores each original filter and slider value');
    await browser.click('#rc-disable-transparency');
    const opaque = await snapshot();
    assert.deepEqual(opaque.disabled, [true, false]);
    assert.ok(opaque.surfaces.every(s => s.alpha === 1), 'All panel and pseudo backings become opaque');
    assert.deepEqual(opaque.surfaces.map(s => s.blur), original.surfaces.map(s => s.blur), 'Transparency does not change blur');
    await browser.click('#rc-disable-blur');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#rc-disable-blur')).backgroundColor"), 'rgb(36, 77, 224)', 'An enabled effect switch keeps its selected accent while hovered');
    for (const theme of ['dark', 'light']) for (const width of [1360, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`document.documentElement.className='${theme==='dark'?'light':'dark'}-theme';document.body.className='${theme}-theme';document.querySelector('.rc-settings-glass').scrollIntoView({block:'center'})`);
      await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const state = await snapshot();
      assert.ok(state.surfaces.every(s => s.alpha === 1 && s.blur === 'none'), `${theme}/${width}: nested themes respect both switches`);
      assert.equal(await browser.evaluate("document.querySelector('.rc-settings-dialog').scrollWidth>document.querySelector('.rc-settings-dialog').clientWidth+1"), false, 'Buttons and sliders fit narrow screens');
      if (process.env.EFFECT_CONTROLS_SCREENSHOTS) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(path.join(workspace, `.tmp-effects-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    for (const [language, transparency, blur] of [['zh-CN','关闭透明效果','关闭模糊效果'],['zh-TW','關閉透明效果','關閉模糊效果'],['en','Disable transparency','Disable blur']]) {
      await browser.evaluate(`(()=>{const n=document.querySelector('#rc-ui-language');n.value='${language}';n.dispatchEvent(new Event('change',{bubbles:true}))})()`);
      assert.deepEqual(await browser.evaluate("['transparency','blur'].map(id=>document.getElementById('rc-disable-'+id).textContent)"), [transparency, blur]);
      assert.deepEqual((await snapshot()).buttons, ['true', 'true']);
    }
    await browser.evaluate("chrome.storage.local.set({customBackground:{...readPreferences(),_writer:'external-fixture',source:'url',url:location.origin+'/wallpaper.svg',experimentalCustomColors:true,customBackgroundColor:'#eef2ff'}})");
    await browser.waitFor("document.querySelector('#rc-background-layer img')?.naturalWidth===100&&document.documentElement.hasAttribute('data-rc-custom-colors')");
    assert.ok((await snapshot()).surfaces.every(s => s.alpha === 1 && s.blur === 'none'), 'Custom palette cannot override effect switches');
    await browser.evaluate("window.originalMedia=document.querySelector('#rc-background-layer img')");
    for (const [path, selector, pseudo] of [['/my/account#!/security','[data-rc-settings-panel]','::before'],['/private-server/configure/123','[data-rc-private-config-panel]','::before'],['/users/123/profile','[data-rc-profile-card]',null]]) {
      await browser.evaluate(`history.pushState({},'',${JSON.stringify(path)});dispatchEvent(new PopStateEvent('popstate'))`);
      const state = await browser.evaluate(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}),${JSON.stringify(pseudo)});return {background:s.backgroundColor,blur:s.backdropFilter}})()`);
      assert.equal(state.background, 'rgb(238, 242, 255)', `${path}: even scaled or minimum-alpha backings are fully opaque`);
      assert.equal(state.blur, 'none');
    }
    await browser.click('#rc-disable-transparency');
    await browser.click('#rc-disable-transparency');
    assert.equal(await browser.evaluate("document.querySelector('#rc-background-layer img')===originalMedia"), true, 'Effect switches preserve wallpaper rendering');
    await browser.click('#rc-done');
    await browser.send('Page.reload');
    await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-disable-transparency')&&document.documentElement.hasAttribute('data-rc-disable-blur')");
    await browser.click('.rc-settings-menu-entry');
    assert.deepEqual(await browser.evaluate("[document.querySelector('#rc-disable-transparency').getAttribute('aria-pressed'),document.querySelector('#rc-disable-blur').getAttribute('aria-pressed'),document.querySelector('#rc-glass-opacity').value,document.querySelector('#rc-glass-blur').value]"), ['true', 'true', '65', '23']);
    await browser.click('#rc-disable-transparency');
    await browser.click('#rc-disable-blur');
    await browser.waitFor("!readPreferences().disableTransparency&&!readPreferences().disableBlur");
    assert.deepEqual(await browser.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--rc-glass-opacity'),getComputedStyle(document.documentElement).getPropertyValue('--rc-glass-blur'),readPreferences().source]"), ['0.65', '23px', 'url']);
    await browser.click('#rc-done');
    assert.deepEqual(browser.errors, []);
  });

test('Experimental colors opt in, apply on commit, survive reloads and themes, and reset without changing wallpaper or blur',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serveFixture(t);
    const browser = await isolatedChrome(t, 'custom-colors');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
    const url = `${origin}/games/606849621/Jailbreak`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '.rc-settings-menu-entry', url);
    const change = async (id, value, event = 'change') => {
      await browser.evaluate(`(()=>{const n=document.getElementById(${JSON.stringify(id)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}))})()`);
    };
    const sample = () => browser.evaluate(`(()=>{const style=id=>getComputedStyle(document.getElementById(id));return {text:style('sample-text').color,canvas:getComputedStyle(document.body).backgroundColor,accent:style('sample-buy').backgroundColor,accentText:style('sample-buy').color,surface:getComputedStyle(document.querySelector('.rc-settings-dialog')).backgroundColor,custom:document.documentElement.hasAttribute('data-rc-custom-colors')}})()`);
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate("document.querySelector('#rc-custom-colors-enabled').checked"), false);
    assert.equal(await browser.evaluate("document.querySelector('#rc-custom-color-fields input').matches(':disabled')"), true);
    assert.equal(await browser.evaluate("document.querySelector('.rc-experimental-badge').textContent"), 'Experimental');
    const ordinary = await sample();
    assert.equal(ordinary.custom, false);
    assert.equal(ordinary.accent, 'rgb(51, 95, 255)');
    await browser.click('#rc-custom-colors-enabled');
    for (const [id, value] of [['text', '#123456'], ['background', '#eef2ff'], ['accent', '#facc15']]) await change(`rc-custom-${id}-color`, value);
    await browser.waitFor("readPreferences().customAccentColor==='#facc15'");
    assert.deepEqual(await sample(), { text: 'rgb(18, 52, 86)', canvas: 'rgb(238, 242, 255)', accent: 'rgb(250, 204, 21)', accentText: 'rgb(0, 0, 0)', surface: 'rgb(238, 242, 255)', custom: true });
    await browser.click('#rc-custom-colors-enabled');
    assert.deepEqual(await sample(), ordinary, 'Turning the switch off restores the normal theme');
    assert.equal(await browser.evaluate("document.querySelector('#rc-custom-accent-color').value"), '#facc15', 'Disabling keeps the saved palette');
    await browser.click('#rc-custom-colors-enabled');
    await change('rc-custom-accent-color', '#2244aa');
    assert.equal((await sample()).accentText, 'rgb(255, 255, 255)', 'Dark accents use readable white labels');
    for (const language of ['zh-CN', 'zh-TW', 'en']) {
      await change('rc-ui-language', language, 'change');
      assert.equal(await browser.evaluate("document.querySelector('.rc-experimental-badge').textContent"), language === 'zh-CN' ? '实验性' : language === 'zh-TW' ? '實驗性' : 'Experimental');
      assert.equal(await browser.evaluate("document.querySelector('#rc-custom-accent-value').value"), '#2244AA');
    }
    for (const theme of ['light', 'dark']) for (const width of [1360, 390, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`document.documentElement.className='${theme==='dark'?'light':'dark'}-theme';document.body.className='${theme}-theme';document.querySelector('.rc-settings-colors').scrollIntoView({block:'center'})`);
      await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const state = await sample();
      assert.equal(state.text, 'rgb(18, 52, 86)', `${theme}/${width}: body themes cannot shadow the palette`);
      assert.equal(state.canvas, 'rgb(238, 242, 255)');
      const layout = await browser.evaluate(`(()=>{const panel=document.querySelector('.rc-settings-colors'),r=panel.getBoundingClientRect();return {overflow:document.querySelector('.rc-settings-dialog').scrollWidth>document.querySelector('.rc-settings-dialog').clientWidth+1,contained:[...panel.querySelectorAll('input,output,button')].every(n=>{const b=n.getBoundingClientRect();return b.left>=r.left-.5&&b.right<=r.right+.5})}})()`);
      assert.deepEqual(layout, { overflow: false, contained: true }, `${theme}/${width}: color controls fit`);
      if (process.env.CUSTOM_COLORS_SCREENSHOTS) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(path.join(workspace, `.tmp-custom-colors-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await browser.evaluate("chrome.storage.local.set({customBackground:{...readPreferences(),_writer:'external-fixture',source:'url',url:location.origin+'/wallpaper.svg'}})");
    await browser.waitFor("document.querySelector('#rc-background-layer img')?.naturalWidth===100");
    await browser.evaluate("window.originalMedia=document.querySelector('#rc-background-layer img')");
    await change('rc-custom-background-color', '#e4f1eb');
    assert.equal(await browser.evaluate("document.querySelector('#rc-background-layer img')===originalMedia&&document.documentElement.hasAttribute('data-rc-background-active')"), true, 'Changing colors preserves the active wallpaper');
    await browser.click('#rc-done');
    await browser.send('Page.reload');
    await waitForDocument(browser, '.rc-settings-menu-entry', url);
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-colors')&&document.querySelector('#rc-background-layer img')?.naturalWidth===100");
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate("document.querySelector('#rc-custom-colors-enabled').checked&&!document.querySelector('#rc-custom-color-fields').disabled"), true);
    assert.equal((await sample()).surface, 'rgb(228, 241, 235)');
    await browser.evaluate("history.pushState({},'', '/my/account#!/security');dispatchEvent(new PopStateEvent('popstate'))");
    assert.equal((await sample()).custom, true, 'Palette survives navigation inside Roblox');
    await browser.click('#rc-reset-colors');
    await browser.waitFor("readPreferences().experimentalCustomColors===false");
    assert.equal((await sample()).custom, false);
    assert.equal(await browser.evaluate("document.querySelector('#rc-custom-color-fields').disabled"), true);
    assert.deepEqual(await browser.evaluate("['text','background','accent'].map(id=>document.getElementById('rc-custom-'+id+'-color').value)"), ['#f4f6fb', '#14161c', '#335fff']);
    assert.deepEqual(await browser.evaluate("[readPreferences().source,readPreferences().glassBlur,readPreferences().glassOpacity,document.documentElement.hasAttribute('data-rc-background-active')]"), ['url', 23, 65, true]);
    await browser.click('#rc-done');
    assert.deepEqual(browser.errors, []);
  });
