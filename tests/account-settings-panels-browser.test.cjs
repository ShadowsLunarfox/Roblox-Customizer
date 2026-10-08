// Representative native settings structures; all values and actions are local samples.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const assets = ['src/shared/theme.css', 'src/settings/settings.css', 'src/shared/site-pages.css',
  'src/shared/startup.js', 'src/pages/account/account-settings-page.js', 'src/pages/account/account-settings-page.css'];

async function assertRangeVisible(browser) {
  await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const pixels = await browser.evaluate(`(async()=>{const image=new Image();image.src='data:image/png;base64,${shot.data}';await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixel=(x,y)=>[...context.getImageData(Math.round(x),Math.round(y),1,1).data].slice(0,3);const r=document.querySelector('#range').getBoundingClientRect(),x=r.left+r.width*.1,y=r.top+r.height/2;return {surface:pixel(x,y-12),track:Array.from({length:9},(_,i)=>pixel(x,y-4+i))}})()`);
  const luminance = c => c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  assert.ok(Math.max(...pixels.track.map(c=>contrast(c,pixels.surface)))>=3, 'Range track stays visible in light mode: '+JSON.stringify(pixels));
}

function fixture(variant) {
  const panel = (id, title, body) => variant === 'legacy'
    ? `<section id="${id}" class="section"><div class="container-header"><h2>${title}</h2></div><div class="section-content">${body}</div></section>`
    : variant === 'plain' ? `<section id="${id}" class="section-content"><h2>${title}</h2>${body}</section>`
    : `<article id="${id}" data-slot="card" class="bg-surface-100"><div class="section-header"><h2>${title}</h2></div>${body}</article>`;
  const field = (label, id, control) => `<div class="form-group"><label for="${id}">${label}</label>${control}</div>`;
  const info = `<div id="info" role="tabpanel">
    ${panel('identity', 'Account Info', `<div class="native-account-row"><span class="text-label">Display Name</span><span class="text-lead text-overflow">${'SampleLongDisplayName'.repeat(5)}</span><div class="native-edit-wrapper"><button type="button" class="btn-generic-edit-sm" data-action="edit" aria-label="Edit display name">✎</button></div></div><div class="account-info-row"><span class="text-label">Previous usernames</span><span class="text-overflow">SamplePreviousName</span></div><div class="native-account-row"><span class="text-label">Email</span><span class="text-lead">s••••@example.invalid <span class="text-success">Verified</span></span><div class="native-edit-wrapper"><button type="button" class="btn-generic-edit-sm" data-action="email" aria-label="Edit email">✎</button></div></div><div class="account-info-row hidden"><span>Native hidden identity row</span></div>`)}
    ${panel('login', 'Login Methods', '<div data-slot="card"><h3>Tired of passwords?</h3><p class="text-description">Log in with a fingerprint, face ID, or screen lock.</p><button type="button" class="foundation-web-button bg-action-standard" data-action="passkey">Add Passkey</button></div>')}
    ${panel('personal', 'Personal', `<form id="sample-form">${field('Language', 'language', '<select id="language" name="language"><option value="en">English (United States)</option><option value="ms">Bahasa Melayu</option></select>')}${field('Automatic Translations', 'translations', '<select id="translations" name="translations"><option value="on">On (experience content only)</option><option value="off">Off</option></select><p class="text-description">Translations are generated automatically and may contain errors.</p>')}${field('Sample field', 'sample-name', '<input id="sample-name" name="displayName" value="Sample Player" required maxlength="20">')}<div class="form-group"><label><input type="checkbox" name="updates" checked> Receive updates</label></div><input type="hidden" name="token" value="sample-token"><button class="btn-primary-sm" type="submit">Save</button></form>`)}
    ${panel('visibility', 'Social networks visibility', '<p class="text-description">Who can see links to your social network profiles</p><label><input type="radio" name="visibility" value="everyone"> Everyone</label><label><input type="radio" name="visibility" value="friends"> Friends</label><label><input type="radio" name="visibility" value="none" checked> No one</label>')}
    ${panel('social', 'Social Networks', field('YouTube', 'youtube', '<input id="youtube" type="url" value="https://www.youtube.com/user/sample" placeholder="e.g. www.youtube.com/user/roblox">') + field('Profile description', 'description', '<textarea id="description" rows="3">Sample profile description.</textarea>'))}
  </div>`;
  const robux = `<div id="robux" role="tabpanel">${panel('balance', 'Robux', '<p class="text-label">Sample balance</p><p class="text-lead" data-amount="250">250 Robux</p><div class="alert alert-warning" role="alert">Sample pending transfer notice.</div><a href="https://www.roblox.com/transactions" class="btn-secondary-sm" data-action="transactions">My Transactions</a>')}${panel('preferences', 'Purchase preferences', '<div class="form-group switch-row"><span id="transfer-label" class="text-label">Sample transfer preference</span><button type="button" role="switch" class="btn-toggle" aria-labelledby="transfer-label" aria-checked="false"><span class="toggle-flip"></span></button></div><label for="range">Example range control</label><input id="range" type="range" min="0" max="100" value="25"><button class="btn-primary-sm" type="button" data-action="disabled" disabled>Unavailable</button><div class="table-responsive"><table><thead><tr><th>Sample transaction</th><th>Amount</th></tr></thead><tbody><tr><td>Example transaction with a long description</td><td>150</td></tr></tbody></table></div>')}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${process.env.ACCOUNT_CONTROLS_NATIVE_CSS ? '<link rel="stylesheet" href="/native.css">' : ''}
    <style>
      *{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:#24262b;color:#f7f7f8}.light-theme{background:#f4f4f4;color:#202227}#content{width:970px;margin:auto;padding:12px}.page-content{padding-top:10px}.container-header h1{margin:0}.menu-vertical{list-style:none;padding:0;background:#303238}.menu-option-content{display:block;padding:12px;color:inherit;text-decoration:none}.section-content,.bg-surface-100{background:#303238;padding:12px}.light-theme .section-content,.light-theme .bg-surface-100{background:white}.native-account-row{position:relative}.native-edit-wrapper{position:absolute;right:0;top:0}.text-overflow{white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.text-label,.text-description{color:#bbb}.light-theme .text-label,.light-theme .text-description{color:#666}h2,h3,p{margin:0 0 12px}.form-group{margin:12px 0}label{display:block}input,select,textarea,button{font:inherit;color:inherit}input:not([type=radio],[type=checkbox],[type=range]),select,textarea{width:100%;background:#333;border:1px solid #777}.light-theme input,.light-theme select,.light-theme textarea{background:white}button,a.btn-secondary-sm{display:inline-block;padding:8px 12px;border:1px solid #777;border-radius:4px;background:#444;color:inherit;text-decoration:none}.btn-primary-sm{background:#335fff;color:white}.btn-primary-sm:disabled{background:#555;opacity:.4}.switch-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.btn-toggle{position:relative;width:40px;min-width:40px;height:24px;min-height:24px;border:0;border-radius:12px;padding:2px;background:#888}.toggle-flip{position:absolute;left:2px;top:2px;width:20px;height:20px;border-radius:50%;background:white}.btn-toggle.on .toggle-flip{left:auto;right:2px}input[type=range]{appearance:none;background:transparent}input[type=range]::-webkit-slider-runnable-track{background:white;height:8px}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;background:white;width:20px;height:20px;border-radius:50%}.hidden,[hidden],.ng-hide{display:none!important}.table-responsive{overflow-x:auto}table{width:100%}th,td{border-bottom:1px solid #777}.alert{background:#aaa;color:#222;padding:12px}.btn-generic-edit-sm{font-size:18px}.menu-option.active{background:#303238}
    </style>
    ${assets.filter(file => file.endsWith('.css')).map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <script>localStorage.setItem('roblox-customizer-visuals-v1',JSON.stringify({version:1,backgroundActive:false,glassBlur:24,glassOpacity:75}));</script>
    ${assets.filter(file => file.endsWith('.js')).map(file => `<script src="/${file}"></script>`).join('')}
  </head><body class="dark-theme"><main id="container-main"><div id="content"><div id="settings-container" class="page-content"><div class="container-header"><h1>Settings</h1></div><aside style="float:left;width:1040px;min-height:720px"><nav><ul class="menu-vertical">${['info', 'robux'].map(tab => `<li class="menu-option"><a class="menu-option-content" id="tab-${tab}" href="#!/${tab}">${tab === 'info' ? 'Account Info' : 'Robux'}</a></li>`).join('')}</ul></nav></aside><div class="native-view-wrapper" style="width:80%;margin-left:20%"><div id="outlet"></div></div><div role="dialog" hidden><div class="section-content" id="native-dialog">Native dialog</div></div></div></div></main><script>
    const templates={info:${JSON.stringify(info)},robux:${JSON.stringify(robux)}};window.actions=[];window.saves=[];
    function render(){const tab=location.hash.includes('robux')?'robux':'info';document.querySelector('#outlet').innerHTML=templates[tab];document.querySelectorAll('.menu-option').forEach(n=>n.classList.toggle('active',n.querySelector('a').id==='tab-'+tab))}
    addEventListener('hashchange',render);setTimeout(render,60);
    document.addEventListener('click',event=>{const control=event.target.closest('[data-action]');if(control&&!control.disabled){if(control.tagName==='A')event.preventDefault();window.actions.push(control.dataset.action)}const toggle=event.target.closest('[role=switch]');if(toggle&&!toggle.disabled){const on=toggle.getAttribute('aria-checked')!=='true';toggle.setAttribute('aria-checked',on);toggle.classList.toggle('on',on)}});
    document.addEventListener('submit',event=>{event.preventDefault();window.saves.push(Object.fromEntries(new FormData(event.target)))});
  </script></body></html>`;
}

for (const variant of ['legacy', 'plain', 'foundation']) test(`Account Info and Robux ${variant} panels receive complete styling after loading and tab changes`, { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  if (process.env.ACCOUNT_CONTROLS_NATIVE_CSS) assert.ok(fs.existsSync(process.env.ACCOUNT_CONTROLS_NATIVE_CSS), 'The optional native stylesheet must exist');
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    if (assets.includes(file)) {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.end(fs.readFileSync(path.join(workspace, file)));
    } else if (file === 'native.css' && process.env.ACCOUNT_CONTROLS_NATIVE_CSS) {
      response.setHeader('Content-Type', 'text/css');
      response.end(fs.readFileSync(process.env.ACCOUNT_CONTROLS_NATIVE_CSS));
    } else {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(fixture(variant));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await isolatedChrome(t, 'account-panels');
  for (const tab of ['info', 'robux']) {
    const url = `http://127.0.0.1:${server.address().port}/my/account#!/${tab}`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#outlet', url);
    await browser.waitFor(`document.querySelectorAll('#${tab} [data-rc-settings-panel]').length===${tab === 'info' ? 5 : 2}`);
    for (const id of tab === 'info' ? ['identity', 'login', 'personal', 'visibility', 'social'] : ['balance', 'preferences']) {
      assert.equal(await browser.evaluate(`document.querySelector('#${id}').hasAttribute('data-rc-settings-panel')`), true, `${id}: the whole section, including its heading, receives styling`);
    }
    const snapshot = `JSON.stringify({text:document.querySelector('#outlet').textContent,fields:[...document.querySelectorAll('#outlet input,#outlet select,#outlet textarea')].map(n=>({name:n.name,value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('#outlet a')].map(n=>n.href)})`;
    const original = await browser.evaluate(snapshot);
    for (const background of [false, true]) {
      await browser.evaluate(`RobloxCustomizerStartup.setPreferences({source:'${background ? 'url' : 'none'}',url:'fixture',glassBlur:24,glassOpacity:75})`);
      for (const theme of ['dark', 'light']) {
        await browser.evaluate(`document.body.className='${theme}-theme'`);
        for (const width of [1360, 768, 390, 320]) {
          await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
          await pause(20);
          const layout = await browser.evaluate(`(()=>{const panels=[...document.querySelectorAll('#outlet [data-rc-settings-panel]')],nav=document.querySelector('[data-rc-settings-nav]').getBoundingClientRect(),body=document.querySelector('[data-rc-settings-body]').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,sideBySide:nav.right<body.left,panels:panels.map(n=>({blur:getComputedStyle(n,'::before').backdropFilter,backingFits:parseFloat(getComputedStyle(n,'::before').width)>=n.clientWidth-1&&parseFloat(getComputedStyle(n,'::before').height)>=n.clientHeight-1,nested:!!n.querySelector('[data-rc-settings-panel]'),color:getComputedStyle(n).color})),bounds:[...document.querySelectorAll('#outlet h2,#outlet p,#outlet .text-overflow,#outlet input:not([type=hidden]),#outlet select,#outlet textarea,#outlet button,#outlet table')].filter(n=>n.getBoundingClientRect().width).map(n=>{const r=n.getBoundingClientRect();return {name:n.id||n.className||n.tagName,fits:r.left>=0&&r.right<=innerWidth+.5,overflow:n.scrollWidth>n.clientWidth+1}}),dialogMarked:document.querySelector('#native-dialog').hasAttribute('data-rc-settings-panel')}})()`);
          const label = `${variant} ${tab} ${theme} ${width} background ${background}`;
          assert.equal(layout.overflow, false, label);
          assert.equal(layout.sideBySide, width >= 768, `${label}: navigation position`);
          assert.equal(layout.dialogMarked, false, 'Dialog is excluded from layout discovery');
          for (const panel of layout.panels) {
            assert.match(panel.blur, /blur\(24px\)/, label);
            assert.equal(panel.backingFits, true, `${label}: backing covers the whole panel`);
            assert.equal(panel.nested, false, `${label}: one backing per panel`);
            assert.equal(panel.color, theme === 'light' ? 'rgb(27, 35, 48)' : 'rgb(244, 246, 251)', label);
          }
          for (const node of layout.bounds) {
            assert.equal(node.fits, true, `${label}: ${node.name} stays inside the viewport`);
            if (!['INPUT', 'TEXTAREA'].includes(node.name) && !['sample-name', 'youtube', 'description'].includes(node.name)) assert.equal(node.overflow, false, `${label}: ${node.name} is not clipped`);
          }
          assert.equal(await browser.evaluate(snapshot), original, 'Styling preserves native text, values, and destinations');
          if (tab === 'info') {
            assert.equal(await browser.evaluate("document.querySelectorAll('#identity [data-rc-settings-row]').length"), 4);
            assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#identity .hidden')).display"), 'none');
            assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#language').closest('.form-group')).display"), 'grid');
            if (width < 600) {
              const fields = await browser.evaluate(`([...document.querySelectorAll('[data-rc-settings-field]')].map(n=>({id:n.querySelector('input,select,textarea').id,width:n.getBoundingClientRect().width,controlWidth:n.querySelector('input,select,textarea').getBoundingClientRect().width})))`);
              for (const field of fields) assert.ok(field.controlWidth >= field.width - 1, `${label}: control uses available mobile width ${JSON.stringify(field)}`);
            }
          } else {
            assert.equal(await browser.evaluate("document.querySelector('[data-action=disabled]').disabled"), true);
            assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#range')).padding"), '0px');
            assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[role=switch]')).height"), '24px');
          }
        }
      }
    }
    if (tab === 'info') {
      await browser.click('[data-action=edit]');await browser.click('[data-action=passkey]');
      assert.deepEqual(await browser.evaluate('window.actions'), ['edit', 'passkey']);
      await browser.evaluate("document.querySelector('#language').value='ms';document.querySelector('#sample-name').value='Updated Sample'");
      await browser.click('#sample-form button[type=submit]');
      assert.deepEqual(await browser.evaluate('window.saves'), [{ language: 'ms', translations: 'on', displayName: 'Updated Sample', updates: 'on', token: 'sample-token' }]);
      await browser.click('input[name=visibility][value=friends]');
      assert.equal(await browser.evaluate("document.querySelector('input[name=visibility]:checked').value"), 'friends');
      await browser.click('#tab-robux');await browser.waitFor("document.querySelectorAll('#robux [data-rc-settings-panel]').length===2");
      await browser.click('#tab-info');await browser.waitFor("document.querySelectorAll('#info [data-rc-settings-panel]').length===5");
    } else {
      await browser.click('[role=switch]');
      assert.equal(await browser.evaluate("document.querySelector('[role=switch]').getAttribute('aria-checked')"), 'true');
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[role=switch]')).backgroundColor"), 'rgb(51, 95, 255)');
      await browser.click('[data-action=disabled]');assert.deepEqual(await browser.evaluate('window.actions'), []);
      await browser.click('[data-action=transactions]');assert.deepEqual(await browser.evaluate('window.actions'), ['transactions']);
      await browser.click('#range');
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
      assert.equal(await browser.evaluate("document.querySelector('#range').value"), '51');
      await assertRangeVisible(browser);
    }
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none',glassBlur:32,glassOpacity:85});const outlet=document.querySelector('#outlet');outlet.innerHTML=outlet.innerHTML");
    await browser.waitFor("!!document.querySelector('#outlet [data-rc-settings-panel]')");
    assert.match(await browser.evaluate("getComputedStyle(document.querySelector('#outlet [data-rc-settings-panel]'),'::before').backdropFilter"), /blur\(32px\)/);
    if (process.env.ACCOUNT_PANEL_SCREENSHOTS && variant === 'legacy' && tab === 'info') {
      for (const [theme, width] of [['dark', 1360], ['light', 1360], ['light', 390]]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
        await browser.evaluate(`document.body.className='${theme}-theme';scrollTo(0,0)`);
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: width >= 600 });
        fs.writeFileSync(path.join(workspace, `.tmp-account-panels-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
        if (width < 600) {
          await browser.evaluate("document.querySelector('#personal').scrollIntoView();new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
          const mobileShot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          fs.writeFileSync(path.join(workspace, '.tmp-account-mobile-fields.png'), Buffer.from(mobileShot.data, 'base64'));
        }
      }
    }
    await browser.evaluate("history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("!document.querySelector('[data-rc-settings-panel], [data-rc-settings-row], [data-rc-settings-field]')");
  }
  assert.deepEqual(browser.errors, []);
});
