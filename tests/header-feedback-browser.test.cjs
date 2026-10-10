const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];

function fixture() {
  // Roblox's native feedback banners slide from top:-40px, but their padding
  // and text can make them taller than 40px (leaving the screenshot's red strip).
  return `<!doctype html><html class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:0;font:16px Arial;background:#6b6370}#header{position:fixed;top:0;left:0;right:0;height:40px;z-index:1020}#header>nav{display:flex;align-items:center;gap:20px;height:40px;padding:0 20px}.alert-system-feedback{width:100%;position:relative}.alert-system-feedback .alert{box-sizing:border-box;position:fixed;top:-40px;left:0;right:0;z-index:1029;width:100%;max-width:970px;margin:0 auto;padding:15px;font-size:20px;line-height:20px;text-align:center;color:white}.alert-system-feedback .alert.on{top:40px}.alert-warning{background:#d10f0f}.alert-success{background:#138029}.dismiss{position:absolute;right:4px;top:4px}main{margin-top:110px}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
    <header id="header" class="rbx-header"><nav><a href="#robux">Robux</a><input id="search" placeholder="Search"><button id="settings" onclick="settingsClicks++">Settings</button></nav></header>
    <main id="game-detail-page"><div class="system-feedback">
      <div class="alert-system-feedback"><div id="purchase" class="alert alert-success">Purchase Completed<button class="dismiss" onclick="this.parentElement.classList.remove('on');dismissals++" aria-label="Close">×</button></div></div>
      <div class="alert-system-feedback"><div id="error" class="alert alert-warning">Error occurred<button class="dismiss" onclick="this.parentElement.classList.remove('on');dismissals++" aria-label="Close">×</button></div></div>
    </div><h1>Piggy</h1><section id="game-instances">Private Servers / Other Servers</section></main>
    <script>window.settingsClicks=0;window.dismissals=0;</script></body></html>`;
}

test('Inactive feedback banners cannot leak a red strip above navigation; active messages and controls still work',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', styles.includes(file) ? 'text/css' : 'text/html; charset=utf-8');
      response.end(styles.includes(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'header-feedback');
    const url = `http://127.0.0.1:${server.address().port}/games/4623386862/Piggy#!/game-instances`;
    await browser.send('Page.navigate', { url }); await waitForDocument(browser, '#game-detail-page', url);
    assert.equal(await browser.evaluate("document.querySelector('#error').getBoundingClientRect().bottom"), 10, 'The native inactive banner reproduces the ten-pixel strip');
    assert.equal(await browser.evaluate("document.querySelector('#error').checkVisibility({visibilityProperty:true})"), true, 'Native positioning alone leaves it painted');
    await browser.evaluate("document.documentElement.setAttribute('data-rc-ui-active','')");
    for (const [language, message] of [['en', 'Error occurred'], ['zh-CN', '发生错误，请稍后重试。'], ['zh-TW', '發生錯誤，請稍後再試。']]) {
      await browser.evaluate(`document.documentElement.lang=${JSON.stringify(language)};document.querySelector('#error').firstChild.data=${JSON.stringify(message)}`);
      for (const theme of ['light', 'dark']) for (const width of [1280, 1023, 390]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.documentElement.className='${theme}-theme'`);
        assert.deepEqual(await browser.evaluate("['error','purchase'].map(id=>document.getElementById(id).checkVisibility({visibilityProperty:true}))"), [false, false], `${language}/${theme}/${width}: no inactive banner is painted`);
        await browser.click('#settings');
        for (const id of ['error', 'purchase']) {
          await browser.evaluate(`document.getElementById('${id}').classList.add('on')`);
          assert.equal(await browser.evaluate(`document.getElementById('${id}').checkVisibility({visibilityProperty:true})`), true, 'Roblox can still show an actual message');
          assert.equal(await browser.evaluate(`document.getElementById('${id}').getBoundingClientRect().top`), 40);
          await browser.click(`#${id} .dismiss`);
          assert.equal(await browser.evaluate(`document.getElementById('${id}').checkVisibility({visibilityProperty:true})`), false, 'Dismissal leaves no strip');
        }
      }
    }
    assert.deepEqual(await browser.evaluate('[settingsClicks,dismissals]'), [18, 36], 'Native header and dismiss actions remain usable');
    await browser.evaluate("document.querySelector('.system-feedback').outerHTML=document.querySelector('.system-feedback').outerHTML");
    assert.equal(await browser.evaluate("document.querySelector('#error').checkVisibility({visibilityProperty:true})"), false, 'A native remount does not restore the strip');
    assert.deepEqual(browser.errors, []);
  });
