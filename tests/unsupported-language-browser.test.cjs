const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/runtime.js', 'src/shared/native-labels.js', 'src/shared/i18n.js',
  'src/shared/startup.js', 'src/settings/language-warning.js', 'src/settings/settings.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];

test('Centered language warning persists across reopening and reloads, and returns on unsupported language changes',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
      const language = /^[a-z-]+$/i.test(url.searchParams.get('lang') || '') ? url.searchParams.get('lang') : 'fr-FR';
      response.setHeader('Cache-Control', 'no-store');
      if (files.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/png');
        response.end(fs.readFileSync(path.join(workspace, file)));
      } else {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(`<!doctype html><html lang="en" class="dark-theme"><head><meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <meta name="locale-data" data-language-code="${language}">
          <style>body{margin:20px;font:16px Arial;background:#24252c;color:white}a{color:inherit}
          #settings-popover-menu{position:fixed;top:0;right:0;z-index:1000}</style>
          ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
          <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>
          <main id="HomeContainer"><h1>Home</h1></main></body></html>`);
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'unsupported-language');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const listeners=[];
      const read=()=>({customBackground:{source:'none',uiLanguage:'en'},...JSON.parse(localStorage.getItem('preferences')||'{}')});
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{
        local:{async get(key){
          if(key==='robloxCustomizerLanguageWarning'&&location.search.includes('delay=1'))return new Promise(resolve=>{window.resolveWarningRead=()=>resolve(read())});
          return read();
        },async set(value){const previous=read();localStorage.setItem('preferences',JSON.stringify({...previous,...value}));listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(value).map(([key,newValue])=>[key,{oldValue:previous[key],newValue}])),'local'))}},
        onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,
        sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
    ` });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file
    });
    const url = `http://127.0.0.1:${server.address().port}/home`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '.rc-settings-menu-entry', url);
    const warning = '#rc-language-warning-dialog';
    const visible = `!!document.querySelector('${warning}:modal')`;
    const saved = "JSON.parse(localStorage.getItem('preferences'))?.robloxCustomizerLanguageWarning";
    const setLanguage = async language => {
      await browser.evaluate(`document.querySelector('meta[name="locale-data"]').setAttribute('data-language-code',${JSON.stringify(language)})`);
    };
    const dismiss = async () => {
      await browser.click(`${warning} button`);
      await browser.waitFor(`!(${visible})`);
    };
    const navigate = async query => {
      const target = url + query;
      await browser.send('Page.navigate', { url: target });
      await waitForDocument(browser, '.rc-settings-menu-entry', target);
    };
    assert.equal(await browser.evaluate(`${saved} ?? null`), null, 'Fresh installations do not write warning state before first use');
    assert.equal(await browser.evaluate(visible), false, 'First warning waits for the user to open Customizer');
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor(visible);
    assert.equal(await browser.evaluate(`document.querySelector('${warning}').getAttribute('role')`), 'alertdialog');
    let text = await browser.evaluate(`document.querySelector('${warning}').textContent`);
    for (const expected of ['fr-FR', 'Some features may not work correctly', 'English, Simplified Chinese, Traditional Chinese, or Indonesian']) {
      assert.ok(text.includes(expected), expected);
    }
    assert.equal(await browser.evaluate(`document.querySelector('${warning} a').getAttribute('href')`), '/my/account#!/info');
    assert.equal(await browser.evaluate(`document.activeElement===document.querySelector('${warning} button')`), true);
    await dismiss();
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay') && document.activeElement.id==='rc-close'"), true, 'Dismissing restores focus to settings');
    await browser.click('#rc-close');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate(visible), false, 'Reopening the plugin does not repeat the warning');
    await browser.send('Page.reload');
    await waitForDocument(browser, '.rc-settings-menu-entry', url);
    await browser.waitFor(`${saved}?.opened===true`);
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate(visible), false, 'Reloading remembers the warning');
    await browser.evaluate("document.querySelector('#rc-ui-language').value='zh-TW';document.querySelector('#rc-ui-language').dispatchEvent(new Event('change',{bubbles:true}))");
    assert.equal(await browser.evaluate(visible), false, 'Changing only the extension UI language does not repeat the warning');
    await setLanguage('FR_fr');
    assert.equal(await browser.evaluate(visible), false, 'Equivalent language tags do not repeat the warning');
    await setLanguage('es-ES');
    await browser.waitFor(`${visible} && document.querySelector('${warning} h2').textContent==='不支援的 Roblox 語言'`);
    await setLanguage('de-DE');
    await browser.waitFor(`document.querySelector('${warning}').textContent.includes('de-DE')`);
    assert.equal(await browser.evaluate(`document.querySelectorAll('${warning}').length`), 1, 'An active warning updates instead of stacking pop-ups');

    for (const theme of ['dark', 'light']) for (const width of [1280, 390, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`document.documentElement.className='${theme}-theme'`);
      assert.equal(await browser.evaluate(`(()=>{
        const warning=document.querySelector('${warning}'),r=warning.getBoundingClientRect();
        return warning.scrollWidth<=warning.clientWidth+1 && r.left>=0 && r.right<=innerWidth
          && r.top>=0 && r.bottom<=innerHeight && Math.abs(r.x+r.width/2-innerWidth/2)<2
          && Math.abs(r.y+r.height/2-innerHeight/2)<2;
      })()`), true, `${theme}/${width}: pop-up is centered and fits the screen`);
    }
    if (process.env.LANGUAGE_WARNING_SCREENSHOT) {
      const screenshot = await browser.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(workspace, '.tmp-language-warning.png'), Buffer.from(screenshot.data, 'base64'));
    }
    for (const language of ['en-US', 'zh_CN', 'zh-TW', 'zh-Hans-SG', 'zh-Hant-HK']) {
      await setLanguage(language);
      await browser.waitFor(`!(${visible})`);
    }
    await browser.click('#rc-close');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    await setLanguage('pt-BR');
    await browser.waitFor(visible);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), false, 'Switching Roblox language can warn while settings are closed');
    const key = async (key, modifiers = 0) => {
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key, modifiers });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers });
    };
    for (let i = 0; i < 4; i++) {
      await key('Tab', i % 2 ? 8 : 0);
      assert.equal(await browser.evaluate(`!!document.activeElement.closest('${warning}')`), true, 'Keyboard focus stays in the pop-up');
    }
    await key('Escape');
    await browser.waitFor(`!(${visible})`);
    await browser.waitFor(`${saved}?.language==='pt-br'`);
    await navigate('?lang=pt-BR');
    assert.equal(await browser.evaluate(visible), false, 'The language-change warning stays dismissed after navigation');
    await navigate('?lang=ja');
    await browser.waitFor(`${visible} && document.querySelector('${warning}').textContent.includes('ja')`);
    await dismiss();
    await browser.evaluate("document.documentElement.lang=''");
    await browser.evaluate("document.querySelector('meta[name=locale-data]').remove()");
    await browser.waitFor(`!(${visible})`);
    await browser.evaluate("localStorage.removeItem('preferences')");
    await navigate('?lang=ja&delay=1');
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate(visible), false, 'The first opening waits for saved warning state');
    await browser.evaluate('resolveWarningRead()');
    await browser.waitFor(visible);
    await key('Escape');
    await browser.waitFor(`!(${visible})`);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), true, 'Escape dismisses only the warning');
    await browser.evaluate("localStorage.removeItem('preferences')");
    await navigate('?lang=en');
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate(visible), false, 'Supported languages never show the first-opening warning');
    await setLanguage('fr-FR');
    await browser.waitFor(visible);
    await dismiss();
    await browser.evaluate("localStorage.removeItem('preferences')");
    await navigate('?lang=en');
    await setLanguage('es');
    await browser.waitFor(visible);
    await dismiss();
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate(visible), false, 'A warning shown before first opening does not repeat when Customizer opens');
    await browser.evaluate("localStorage.removeItem('preferences')");
    await navigate('?lang=fr-FR');
    await browser.evaluate("chrome.storage.local.set({robloxCustomizerLanguageWarning:{opened:true,language:'fr-fr'}})");
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate(visible), false, 'An opening recorded by another tab suppresses the first-opening warning');
    assert.deepEqual(browser.errors, []);
  });
