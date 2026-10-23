const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/routes.js', 'src/shared/native-labels.js', 'src/shared/i18n.js', 'src/settings/settings.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];
const qrImage = 'src/settings/assets/qq-group-qr.jpg';
const assets = new Set([...scripts, ...styles, qrImage, 'icons/icon-48.png', 'icons/icon-128.png']);

test('Support settings keep contact links, QQ copying and localized layouts usable',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
    assert.ok(manifest.web_accessible_resources.some(entry => entry.resources.includes(qrImage)
      && entry.matches.includes('https://www.roblox.com/*')), 'Roblox pages can load the packaged QR image');
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      if (assets.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : file.endsWith('.jpg') ? 'image/jpeg' : 'text/javascript');
        response.end(fs.readFileSync(path.join(workspace, file)));return;
      }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{margin:24px;font:16px Arial;background:#34465a;color:white}#settings-popover-menu{position:fixed;top:0;right:0}a{color:inherit}</style>
        ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme">
        <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="content"></main>
        <script>
          const listeners=[];window.saved={customBackground:{source:'none',uiLanguage:'en'}};
          window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(){return saved},async set(values){Object.assign(saved,values);listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(values).map(([key,newValue])=>[key,{newValue}])),'local'))}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){callback?.({})}}};
          window.copied=[];window.copyFails=false;window.links=[];
          Object.defineProperty(navigator,'clipboard',{value:{async writeText(value){if(copyFails)throw new Error('clipboard blocked');copied.push(value)}}});
          document.addEventListener('click',event=>{const link=event.target.closest('#rc-support-discord,#rc-support-email,#rc-support-qq-qr');if(link){event.preventDefault();links.push(link.href)}});
        </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections();server.close(resolve); }));
    const browser = await isolatedChrome(t, 'settings-support');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const url = `http://127.0.0.1:${server.address().port}/id/my/avatar`;
    await browser.send('Page.navigate', { url });await waitForDocument(browser, '.rc-settings-menu-entry', url);
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-settings-category-support')");
    const labels = {
      en: 'Support & feedback', 'zh-CN': '支持与反馈', 'zh-TW': '支援與回饋',
      id: 'Bantuan & masukan', ja: 'サポートとフィードバック', th: 'ความช่วยเหลือและข้อเสนอแนะ', ko: '지원 및 피드백'
    };
    for (const [locale, title] of Object.entries(labels)) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      await browser.waitFor(`document.querySelector('#rc-settings-category-title-support').textContent===${JSON.stringify(title)}`);
      for (const theme of ['dark', 'light']) for (const width of [1360, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.body.className='${theme}-theme'`);
        await browser.click('.rc-settings-nav-button[data-rc-settings-category="support"]');
        await browser.waitFor("document.querySelector('#rc-support-qq-qr img').naturalWidth===1284");
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const state = await browser.evaluate(`(()=>{const section=document.querySelector('#rc-settings-category-support'),content=document.querySelector('.rc-settings-content');
          return {current:document.querySelector('.rc-settings-nav-button[aria-current=true]').dataset.rcSettingsCategory,
            overflow:[section,content,document.querySelector('.rc-settings-dialog')].some(node=>node.scrollWidth>node.clientWidth+1)||document.documentElement.scrollWidth>innerWidth,
            contacts:[...section.querySelectorAll('[translate=no]')].map(node=>node.textContent),
            actions:[...section.querySelectorAll('.rc-button')].map(node=>{const r=node.getBoundingClientRect();return {height:r.height,left:r.left,right:r.right,background:getComputedStyle(node).backgroundColor}}),
            copy:document.querySelector('#rc-support-copy-qq').textContent,
            qr:(()=>{const link=document.querySelector('#rc-support-qq-qr'),img=link.querySelector('img'),rect=img.getBoundingClientRect();return {href:link.href,target:link.target,alt:img.alt,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,width:rect.width,height:rect.height,description:link.getAttribute('aria-label')}})(),
            email:document.querySelector('#rc-support-email').getAttribute('href'),
            discord:document.querySelector('#rc-support-discord').href,
            target:document.querySelector('#rc-support-discord').target,rel:document.querySelector('#rc-support-discord').rel}})()`);
        const label = `${locale}/${theme}/${width}`;
        assert.equal(state.current, 'support', `${label}: the last category remains selected after scrolling`);
        assert.equal(state.overflow, false, `${label}: translated text fits the panel`);
        assert.deepEqual(state.contacts, ['Discord', '1129354987', 'lunar@lunarfox.my']);
        assert.equal(state.email, 'mailto:lunar@lunarfox.my');assert.equal(state.discord, 'https://discord.gg/dndMGNPW3P');
        assert.equal(state.target, '_blank');assert.match(state.rel, /noopener/);
        assert.equal(state.qr.href, new URL('/'+qrImage, url).href);assert.equal(state.qr.target, '_blank');
        assert.equal(state.qr.naturalHeight, 2286);assert.ok(state.qr.width > 100 && state.qr.width <= 280);
        assert.ok(Math.abs(state.qr.width / state.qr.height - 1284 / 2286) < .001, `${label}: the original QR image is not cropped or stretched`);
        if (locale !== 'en') { assert.notEqual(state.qr.alt, 'QQ group QR code for Roblox Customizer');assert.notEqual(state.qr.description, 'Open QQ group QR code'); }
        if (locale !== 'en') assert.notEqual(state.copy, 'Copy group number');
        for (const action of state.actions) {
          assert.ok(action.height >= 44 && action.left >= 0 && action.right <= width, `${label}: contacts have usable buttons`);
          assert.notEqual(action.background, 'rgba(0, 0, 0, 0)');
        }
        if (process.env.SUPPORT_SCREENSHOT_DIR && ['zh-CN', 'th'].includes(locale) && theme === 'dark' && width !== 390) {
          await browser.evaluate("document.querySelector('#rc-support-qq-qr').scrollIntoView({block:'center'})");
          const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          fs.writeFileSync(path.join(process.env.SUPPORT_SCREENSHOT_DIR, `${locale}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
      await browser.click('#rc-support-copy-qq');
      await browser.waitFor("document.querySelector('#rc-support-copy-status').textContent===RobloxCustomizerI18n.t('Copied')");
      assert.equal(await browser.evaluate('copied.at(-1)'), '1129354987');
    }
    await browser.evaluate('copyFails=true');await browser.click('#rc-support-copy-qq');
    await browser.waitFor("document.querySelector('#rc-support-copy-status').textContent===RobloxCustomizerI18n.t('Select the text and copy it.')");
    assert.equal(await browser.evaluate('getSelection().toString()'), '1129354987', 'Clipboard denial leaves the group number selected for manual copying');
    await browser.click('#rc-support-discord');await browser.click('#rc-support-email');await browser.click('#rc-support-qq-qr');
    assert.deepEqual(await browser.evaluate('links'), ['https://discord.gg/dndMGNPW3P', 'mailto:lunar@lunarfox.my', new URL('/'+qrImage, url).href]);
    await browser.click('#rc-close');await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-support-copy-qq')");
    assert.equal(await browser.evaluate("document.querySelector('#rc-support-copy-status').textContent"), '', 'Reopening settings clears previous copy feedback');
    assert.deepEqual(browser.errors, []);
  });
