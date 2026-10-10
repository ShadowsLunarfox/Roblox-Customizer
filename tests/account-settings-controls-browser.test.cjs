// Reproduce narrow nested fields and role=radio inputs from Account Info.
// All account values and save handlers below are local samples.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/startup.js', 'src/pages/account/account-settings-page.js'];
const controls = [
  ['Facebook', 'facebook', 'e.g. www.facebook.com/Roblox', 'url'],
  ['X (formerly Twitter)', 'twitter', 'e.g. @Roblox', 'text'],
  ['YouTube', 'youtube', 'e.g. www.youtube.com/user/roblox', 'url'],
  ['Twitch', 'twitch', 'e.g. www.twitch.tv/roblox', 'url']
];
const field = (label, id, control, plainLabel = false, className = 'form-group') => `<div class="${className}" id="field-${id}">${plainLabel ? `<span class="text-label" id="label-${id}">${label}</span>` : `<label for="${id}">${label}</label>`}<div class="native-column" style="width:40%;max-width:160px"><div class="native-shell" style="width:50%;max-width:140px">${control}</div></div></div>`;

function fixture(variant) {
  const panelClass = variant === 'legacy' ? 'class="setting-section"' : '';
  const fieldClass = variant === 'compact' ? 'native-field' : 'form-group';
  const options = ['Everyone', 'Friends, followers & people I follow', 'Friends & people I follow', 'Friends', 'No one'].map((label, i) => `<div class="native-choice">${variant === 'compact'
    ? `<button type="button" class="foundation-web-button" role="radio" id="visibility-${i}" aria-checked="${i === 4}" data-value="${i}"><span class="native-dot" aria-hidden="true"></span></button>`
    : `<input type="radio" role="radio" id="visibility-${i}" name="visibility" value="${i}" ${i === 4 ? 'checked' : ''}>`}<label for="visibility-${i}">${label}</label></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${process.env.ACCOUNT_CONTROLS_NATIVE_CSS ? '<link rel="stylesheet" href="/native.css">' : ''}
    <style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;color:#eee;background:#202227}.light-theme{color:#202227;background:#eee}#content{width:970px;margin:auto}h1,h2,p{margin:0 0 16px}h2{font-size:20px}.menu-vertical{list-style:none;margin:0;padding:8px}.menu-option a{display:block;padding:12px;color:inherit;text-decoration:none}.native-choice{display:flex;gap:12px;align-items:center;min-height:44px}.native-choice label{margin:0;cursor:pointer}input[type=radio],input[type=checkbox]{appearance:auto;width:20px;height:20px}input,select,button{font:inherit;color:inherit}.form-group{margin:16px 0}.form-group>label,.form-group>.text-label{float:left;width:25%}.native-column{margin-left:25%}#info .form-control{width:35%;max-width:120px;padding:8px;border:1px solid #888;border-radius:4px;background:#333}.light-theme #info .form-control{background:white}.input-dropdown{position:relative}.input-dropdown-btn{width:30%;max-width:120px;text-align:left}.dropdown-menu{display:none;list-style:none;position:absolute;top:100%;left:0;width:100%;z-index:10;padding:6px;margin:0}.open .dropdown-menu{display:block}button{padding:8px 12px;border:1px solid #888;border-radius:4px;background:#333}.light-theme button{background:white}.dropdown-menu button{width:100%;text-align:left}.form-footer{display:flex;justify-content:flex-end;margin-top:24px}.btn-primary-sm{background:#335fff;color:white}button:disabled{opacity:.4}.hidden,[hidden]{display:none!important}#rc-background-layer{background:radial-gradient(ellipse at 5% 5%,#99c2c8,transparent 65%),linear-gradient(120deg,#26344c,#763b39)}</style>
    <style>.native-dot{display:block;width:8px;height:8px;border-radius:50%}button[role=radio][aria-checked=true] .native-dot{background:currentColor}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    ${scripts.map(file => `<script src="/${file}"></script>`).join('')}
    </head><body class="dark-theme"><div id="rc-background-layer"></div><main><div id="content"><div id="settings-container"><header class="container-header"><h1>Settings</h1></header><nav><ul class="menu-vertical"><li class="menu-option"><a href="#!/info">Account info</a></li><li class="menu-option"><a href="#!/security">Security</a></li></ul></nav><div class="native-view"><div id="info" role="tabpanel"><form id="settings-form">
    <section id="visibility" ${panelClass}><h2>Social networks visibility</h2><p>Who can see links to your social network profiles</p>${options}${variant === 'compact' ? '<input type="hidden" id="visibility-value" name="visibility" value="4">' : ''}<label class="native-choice"><input id="disabled-checkbox" type="checkbox" checked disabled> Sample unavailable option</label></section>
    <section id="social" ${panelClass}><h2>Social Networks</h2>${controls.map(([label, id, placeholder, type]) => field(label, id, `<input class="form-control" id="${id}" name="${id}" type="${type}" aria-labelledby="${id === 'youtube' ? 'label-youtube' : ''}" placeholder="${placeholder}" maxlength="100" ${id === 'youtube' ? 'required value="https://www.youtube.com/user/sample"' : ''}>`, id === 'youtube', fieldClass)).join('')}
    ${field('Language', 'language', '<select class="form-control" id="language" name="language"><option value="en">English (United States)</option><option value="ms">Bahasa Melayu</option></select>', false, fieldClass)}
    ${field('Automatic Translations', 'translation', '<div class="input-dropdown"><button id="translation" role="combobox" aria-expanded="false" type="button" class="input-dropdown-btn">On (experience content only)</button><ul class="dropdown-menu"><li><button id="translation-off" type="button">Off</button></li></ul></div>', false, fieldClass)}
    <div class="form-group hidden" id="hidden-field"><label for="hidden-input">Hidden native field</label><input id="hidden-input" value="Sample hidden value" disabled></div><div class="form-footer"><button id="save" type="submit" class="btn-primary-sm">Save</button></div></section>
    </form></div></div></div></div></main><script>
    window.saves=[];
    const form=document.querySelector('#settings-form');
    form.addEventListener('input',()=>document.querySelector('#save').disabled=!form.checkValidity());
    form.addEventListener('submit',event=>{event.preventDefault();window.saves.push(Object.fromEntries(new FormData(form)))});
    document.addEventListener('click',event=>{const radio=event.target.closest('button[role=radio]');if(radio){document.querySelectorAll('button[role=radio]').forEach(n=>n.setAttribute('aria-checked',String(n===radio)));document.querySelector('#visibility-value').value=radio.dataset.value}});
    document.querySelector('#translation').onclick=()=>{const button=document.querySelector('#translation');button.parentElement.classList.toggle('open');button.setAttribute('aria-expanded',String(button.parentElement.classList.contains('open')))};
    document.querySelector('#translation-off').onclick=()=>{document.querySelector('#translation').textContent='Off';document.querySelector('#translation').setAttribute('aria-expanded','false');document.querySelector('.input-dropdown').classList.remove('open')};
    </script></body></html>`;
}

for (const variant of ['legacy', 'plain', 'compact']) test(`Account Info nested fields fill their columns and native radios keep their shape (${variant})`, { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  if (process.env.ACCOUNT_CONTROLS_NATIVE_CSS) assert.ok(fs.existsSync(process.env.ACCOUNT_CONTROLS_NATIVE_CSS));
  const server = http.createServer((request, response) => {
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
    if ([...styles, ...scripts].includes(file)) response.end(fs.readFileSync(path.join(workspace, file)));
    else if (file === 'native.css' && process.env.ACCOUNT_CONTROLS_NATIVE_CSS) response.end(fs.readFileSync(process.env.ACCOUNT_CONTROLS_NATIVE_CSS));
    else response.end(fixture(variant));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await isolatedChrome(t, 'account-controls');
  const url = `http://127.0.0.1:${server.address().port}/my/account#!/info`;
  await browser.send('Page.navigate', { url });
  await waitForDocument(browser, '#save', url);
  await browser.waitFor("document.querySelectorAll('[data-rc-settings-field]').length===6");
  const snapshot = "JSON.stringify([...document.querySelectorAll('#info input,#info select,#info button[role=radio]')].map(n=>({value:n.value,type:n.type,checked:n.checked,ariaChecked:n.getAttribute('aria-checked'),disabled:n.disabled,maxLength:n.maxLength})))";
  const original = await browser.evaluate(snapshot);
  for (const wallpaper of [false, true]) {
    await browser.evaluate(`RobloxCustomizerStartup.setPreferences({source:'${wallpaper ? 'url' : 'none'}',url:'sample',glassBlur:24,glassOpacity:75})`);
    for (const theme of ['dark', 'light']) {
      await browser.evaluate(`document.body.className='${theme}-theme'`);
      for (const width of [1360, 1024, 768, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const layout = await browser.evaluate(`(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          fields: [...document.querySelectorAll('[data-rc-settings-field]')].map(field => {
            const control = field.querySelector('input,select,button'), r = control.getBoundingClientRect(),
              f = field.getBoundingClientRect(), label = field.querySelector(':scope>label,:scope>.text-label').getBoundingClientRect(),
              style = getComputedStyle(field);
            return { id: control.id, width: r.width, available: innerWidth < 768 ? f.width : f.width - label.width - parseFloat(style.columnGap),
              height: r.height, fontSize: parseFloat(getComputedStyle(control).fontSize), fits: r.left >= f.left && r.right <= f.right + .5 };
          }),
          choices: [...document.querySelectorAll('#visibility input:not([type=hidden]),#visibility button[role=radio]')].map(n => { const r = n.getBoundingClientRect(); return { width: r.width, height: r.height }; }),
          hidden: getComputedStyle(document.querySelector('#hidden-field')).display
        }))()`);
        const label = `${variant} ${theme} ${width} wallpaper ${wallpaper}`;
        assert.equal(layout.overflow, false, label);
        for (const field of layout.fields) {
          assert.ok(field.width >= field.available - 1, `${label}: ${field.id} fills its available column ${JSON.stringify(field)}`);
          assert.ok(field.height >= 42 && field.fontSize >= 16, `${label}: ${field.id} remains readable`);
          assert.equal(field.fits, true, label);
        }
        for (const choice of layout.choices) {
          assert.equal(choice.width, 20, `${label}: compact native choice`);
          assert.equal(choice.height, choice.width, `${label}: a radio or checkbox is not stretched`);
        }
        assert.equal(layout.hidden, 'none');
        assert.equal(await browser.evaluate(snapshot), original, 'Appearance preserves native values, validation constraints and disabled choices');
        if (process.env.ACCOUNT_CONTROL_SCREENSHOTS && variant === 'compact' && wallpaper && [1360, 390].includes(width)) {
          await browser.evaluate('scrollTo(0,0)');
          const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
          fs.writeFileSync(path.join(workspace, `.tmp-account-controls-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
  }
  await browser.click('label[for="visibility-3"]');
  assert.equal(await browser.evaluate(variant === 'compact' ? "document.querySelector('#visibility-value').value" : "document.querySelector('input[name=visibility]:checked').value"), '3');
  await browser.click('#language');
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  assert.equal(await browser.evaluate("document.querySelector('#language').value"), 'ms');
  await browser.click('#translation');await browser.click('#translation-off');
  assert.equal(await browser.evaluate("document.querySelector('#translation').textContent"), 'Off');
  await browser.evaluate("document.querySelector('#youtube').value='';document.querySelector('#youtube').dispatchEvent(new Event('input',{bubbles:true}))");
  await browser.click('#save');assert.deepEqual(await browser.evaluate('window.saves'), []);
  await browser.evaluate("document.querySelector('#youtube').value='https://www.youtube.com/user/updated';document.querySelector('#facebook').value='https://www.facebook.com/sample';document.querySelector('#youtube').dispatchEvent(new Event('input',{bubbles:true}))");
  await browser.click('#save');
  assert.deepEqual(await browser.evaluate('window.saves'), [{ visibility: '3', facebook: 'https://www.facebook.com/sample', twitter: '', youtube: 'https://www.youtube.com/user/updated', twitch: '', language: 'ms' }]);
  await browser.evaluate("document.querySelector('#info').innerHTML=document.querySelector('#info').innerHTML");
  await browser.waitFor("document.querySelectorAll('[data-rc-settings-field]').length===6");
  await browser.evaluate("history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
  await browser.waitFor("!document.querySelector('[data-rc-settings-field],[data-rc-settings-control],[data-rc-settings-choice]')");
  assert.deepEqual(browser.errors, []);
});
