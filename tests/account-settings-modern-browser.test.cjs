// Plain React settings views, including the mixed Security layout reported by
// the user. All values, actions, themes, and sessions in this fixture are local.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const assets = ['src/shared/theme.css', 'src/settings/settings.css', 'src/shared/site-pages.css',
  'src/shared/startup.js', 'src/pages/account/account-settings-page.js', 'src/pages/account/account-settings-page.css'];
const tabs = ['browser-preferences', 'parental-controls', 'notifications', 'privacy', 'security'];

const category = (name, description = '') => `<button type="button" class="native-category" data-action="category"><span class="row-copy"><strong>${name}</strong>${description ? `<span class="text-body-small">${description}</span>` : ''}</span><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="m7 4 6 6-6 6-2-2 4-4-4-4z"/></svg></button>`;
const sessions = count => Array.from({ length: count }, (_, i) => category(`Sample device ${i + 1}`, 'Sample region · Oct 10, 2026')).join('');
function tabContent(tab) {
  if (tab === 'browser-preferences') return `<h2>Browser preferences</h2><div class="mode-row"><div><h3>Mode</h3><p class="text-body-small">Select an app mode. Your other devices will not be affected.</p></div><button type="button" role="combobox" aria-label="Mode" aria-expanded="false" id="mode">Dark</button></div><h3>App theme</h3><p class="text-body-small">Explore themes to customize your experience.</p><div role="radiogroup" aria-label="App theme" class="themes">${['Default', 'Cosmic Dust', 'Polar Freeze', 'Super Charge', 'Electric Lime', 'Lava Glow'].map((name, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-theme="${i}"><span class="swatch" style="background-color:${['#151821', '#6633cc', '#005e8f', '#00685a', '#426200', '#b82e16'][i]}"></span><span>${name}</span></button>`).join('')}</div>`;
  if (tab === 'parental-controls') return '<h2>Parental controls</h2><h3>Manage your child\'s Roblox experience</h3><p>Link your account to your child\'s to get access to parental controls and insights on your child\'s screen time, friends, spending, and more.</p><p>Visit parental controls on your child\'s account and enter your email to get started.</p>';
  if (tab === 'notifications') return `<h2>Notifications</h2><p class="text-description">Choose which notifications you get and how you receive them.</p>${category('Device Notifications', 'Manage channels')}${category('Communities', 'Community announcements and forum discussions')}${category('Games', 'Game updates and suggestions')}${category('Marketplace', 'Activity related to avatar items and offers.')}${category('Platform News', 'Official Roblox events and updates')}${category('Social', 'Friends and party activity')}<a href="https://en.help.roblox.com/hc/en-us" id="help">Learn more about notification settings</a>`;
  if (tab === 'privacy') return `<h2>Privacy &amp; content restrictions</h2>${['Content maturity', 'Screen time', 'Communication', 'Visibility & private servers', 'Trading & inventory', 'Ads preferences', 'Blocked users', 'Account data, deactivation & deletion'].map(name => category(name)).join('')}`;
  return '<h2>Security</h2><section class="setting-section" id="legacy-security"><h3>Two-Step Verification</h3><div class="section-content"><label><input type="checkbox" checked id="verification"> Sample verification setting</label><button class="btn-secondary-sm" type="button" id="codes">Recovery Codes</button></div></section><div id="session-mount"></div>';
}

function fixture(variant) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${process.env.ACCOUNT_CONTROLS_NATIVE_CSS ? '<link rel="stylesheet" href="/native.css">' : ''}
  <style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;color:#eee;background:#191b21}.light-theme{color:#202227;background:#f4f4f5}#content{width:970px;margin:auto}.page-content{padding-top:10px}h1,h2,h3,p{margin:0 0 16px}h2{font-size:24px}h3{font-size:18px}.menu-vertical{padding:8px;list-style:none;background:#303238}.menu-option-content{display:block;padding:12px;color:inherit;text-decoration:none}.section-content,.setting-section{padding:15px;background:#303238}.light-theme .section-content,.light-theme .setting-section{background:white}.text-body-small,.text-description{color:#bbb;font-size:14px}.light-theme .text-body-small,.light-theme .text-description{color:#555}button{font:inherit;color:inherit;cursor:pointer}.native-category{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:16px 12px;text-align:left;border:0;border-bottom:1px solid #8886;background:transparent}.row-copy{display:flex;flex-direction:column;min-width:0}.native-category svg{flex:none}.mode-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:center;margin-bottom:24px}.themes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.themes button{display:flex;gap:10px;align-items:center;padding:12px;border:1px solid #888;background:transparent}.swatch{display:block;flex:none;width:32px;height:32px;border-radius:50%;border:1px solid #fff}#mode{padding:12px;text-align:left;border:1px solid #888;background:transparent}#show-more,#logout,#codes{padding:10px 14px;border:1px solid #777;border-radius:4px;background:#444;color:inherit}#logout{display:block;width:100%;margin-top:20px}.hidden,.ng-hide,[hidden]{display:none!important}[role=dialog]:not([hidden]){position:fixed;inset:20%;background:#333;z-index:50;padding:24px}.light-theme [role=dialog]{background:white}a{color:inherit}@media(max-width:600px){.mode-row,.themes{grid-template-columns:minmax(0,1fr)}}</style>
  ${assets.filter(file => file.endsWith('.css')).map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
  ${assets.filter(file => file.endsWith('.js')).map(file => `<script src="/${file}"></script>`).join('')}
  </head><body class="dark-theme"><div id="rc-background-layer"></div><main><div id="content"><div class="page-content" id="settings-container"><header class="container-header"><h1>Settings</h1></header><aside style="float:left;width:1040px;min-height:720px"><nav><ul class="menu-vertical">${tabs.map(tab => `<li class="menu-option"><a class="menu-option-content" id="tab-${tab}" href="#!/${tab}">${tab.replaceAll('-', ' ')}</a></li>`).join('')}</ul></nav></aside><div class="react-outlet" style="width:80%;margin-left:20%"><div id="mounted-view" ${variant === 'tabpanel' ? 'role="tabpanel"' : ''}></div></div></div></div></main><div role="dialog" id="detail-dialog" hidden><div class="section-content" id="dialog-section"><p>Sample native details</p><button type="button" id="close">Close</button></div></div>
  <script>
  const templates=${JSON.stringify(Object.fromEntries(tabs.map(tab => [tab, tabContent(tab)])))};
  window.actions=[];window.securityVisits=0;
  function render(){
    const tab=location.hash.replace(/^#!\\//,'').split('/')[0]||'browser-preferences';
    const view=document.querySelector('#mounted-view');
    let markup=templates[tab]||templates.privacy;
    if(${JSON.stringify(variant)}==='plain')markup=markup.replaceAll('<h2>','<div class="text-heading-large">').replaceAll('</h2>','</div>').replaceAll('<h3>','<div class="text-title-large">').replaceAll('</h3>','</div>').replaceAll('<p>','<div class="text-body-medium">').replaceAll('<p class="text-body-small">','<div class="text-body-small">').replaceAll('<p class="text-description">','<div class="text-description">').replaceAll('</p>','</div>');
    view.innerHTML=markup+'<div class="section-content hidden" id="obsolete">Obsolete hidden section</div>';
    view.dataset.tab=tab;
    document.querySelectorAll('.menu-option').forEach(n=>n.classList.toggle('active',n.querySelector('a').id==='tab-'+tab));
    if(tab==='security'){
      window.securityVisits++;
      setTimeout(()=>{const mount=document.querySelector('#session-mount');if(mount)mount.innerHTML='<div id="sessions"><h3>Devices where you’re logged in</h3><p class="text-body-small">Sample trusted-device description. Native security actions remain unchanged.</p><div id="devices">'+${JSON.stringify(sessions(4))}+'</div><button id="show-more" type="button">Show More</button><button id="logout" class="btn-control-md" type="button">Log Out of All Other Sessions</button></div>'},100);
    }
  }
  addEventListener('hashchange',render);setTimeout(render,60);
  document.addEventListener('click',event=>{const control=event.target.closest('button');if(!control||control.disabled)return;if(control.dataset.action){window.actions.push(control.dataset.action);document.querySelector('#detail-dialog').hidden=false}if(control.id==='close')document.querySelector('#detail-dialog').hidden=true;if(control.id==='mode'){control.textContent=control.textContent==='Dark'?'Light':'Dark';window.actions.push('mode')}if(control.hasAttribute('data-theme')){document.querySelectorAll('[data-theme]').forEach(n=>n.setAttribute('aria-checked',String(n===control)));window.actions.push('theme')}if(control.id==='show-more'){document.querySelector('#devices').innerHTML=${JSON.stringify(sessions(9))};window.actions.push('show-more')}});
  </script></body></html>`;
}

for (const variant of ['plain', 'tabpanel']) test(`All five modern account tabs retain panel backgrounds and native controls (${variant} wrappers)`, { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  if (process.env.ACCOUNT_CONTROLS_NATIVE_CSS) assert.ok(fs.existsSync(process.env.ACCOUNT_CONTROLS_NATIVE_CSS));
  const server = http.createServer((request, response) => {
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
    if (assets.includes(file)) response.end(fs.readFileSync(path.join(workspace, file)));
    else if (file === 'native.css' && process.env.ACCOUNT_CONTROLS_NATIVE_CSS) response.end(fs.readFileSync(process.env.ACCOUNT_CONTROLS_NATIVE_CSS));
    else response.end(fixture(variant));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await isolatedChrome(t, 'account-modern');
  const initialUrl = `http://127.0.0.1:${server.address().port}/my/account#!/browser-preferences`;
  await browser.send('Page.navigate', { url: initialUrl });
  await waitForDocument(browser, '#mode', initialUrl);
  for (const tab of tabs) {
    await browser.click(`#tab-${tab}`);
    try { await browser.waitFor(`location.hash==='#!/${tab}' && document.querySelector('#mounted-view').dataset.tab==='${tab}' && !!document.querySelector('[data-rc-settings-surface]')`); }
    catch (error) {
      error.message += '\n' + JSON.stringify({ errors: browser.errors, markup: await browser.evaluate("document.querySelector('#settings-container').outerHTML") });
      throw error;
    }
    if (tab === 'security') await browser.waitFor("!!document.querySelector('#logout')");
    const original = await browser.evaluate("JSON.stringify({text:document.querySelector('#mounted-view').textContent,inputs:[...document.querySelectorAll('#mounted-view input')].map(n=>({value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('#mounted-view a')].map(n=>n.href)})");
    for (const wallpaper of [false, true]) {
      await browser.evaluate(`RobloxCustomizerStartup.setPreferences({source:'${wallpaper ? 'url' : 'none'}',url:'sample',glassBlur:24,glassOpacity:75})`);
      for (const theme of ['dark', 'light']) {
        await browser.evaluate(`document.body.className='${theme}-theme';document.querySelector('#rc-background-layer').style.background='${theme === 'dark' ? '#eee' : '#14161c'}'`);
        for (const width of [1360, 768, 390, 320]) {
          await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
          await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
          const state = await browser.evaluate(`(()=>{const surface=document.querySelector('[data-rc-settings-surface]'),r=surface.getBoundingClientRect(),b=getComputedStyle(surface,'::before');return {surfaces:document.querySelectorAll('[data-rc-settings-surface]').length,overflow:document.documentElement.scrollWidth>innerWidth,blur:b.backdropFilter,backingWidth:parseFloat(b.width),backingHeight:parseFloat(b.height),width:r.width,height:r.height,color:getComputedStyle(surface).color,dialogMarked:!!document.querySelector('[role=dialog] [data-rc-settings-panel]'),hidden:getComputedStyle(document.querySelector('#obsolete')).display,covered:[...document.querySelectorAll('#mounted-view *')].filter(n=>n.getBoundingClientRect().width).every(n=>{const a=n.getBoundingClientRect();return a.left>=r.left&&a.right<=r.right+.5&&a.top>=r.top&&a.bottom<=r.bottom+.5&&a.right<=innerWidth+.5}),nested:[...document.querySelectorAll('[data-rc-settings-surface] [data-rc-settings-panel]')].every(n=>getComputedStyle(n,'::before').content==='none')}})()`);
          const label = `${variant} ${tab} ${theme} ${width} wallpaper ${wallpaper}`;
          assert.equal(state.surfaces, 1, label);
          assert.equal(state.overflow, false, label);
          assert.equal(state.covered, true, `${label}: all content has a backing and fits`);
          assert.ok(state.backingWidth >= state.width - 1 && state.backingHeight >= state.height - 1, `${label}: the backing covers the whole tab`);
          assert.match(state.blur, /blur\(24px\)/, label);
          assert.equal(state.color, theme === 'light' ? 'rgb(27, 35, 48)' : 'rgb(244, 246, 251)', label);
          assert.equal(state.nested, true, `${label}: security uses one backing`);
          assert.equal(state.hidden, 'none', label);
          assert.equal(state.dialogMarked, false, label);
          assert.equal(await browser.evaluate("JSON.stringify({text:document.querySelector('#mounted-view').textContent,inputs:[...document.querySelectorAll('#mounted-view input')].map(n=>({value:n.value,checked:n.checked,disabled:n.disabled})),links:[...document.querySelectorAll('#mounted-view a')].map(n=>n.href)})"), original, 'Appearance does not change settings or native links');
          if (process.env.ACCOUNT_MODERN_SCREENSHOTS && variant === 'plain' && wallpaper && [1360, 390].includes(width)) {
            await browser.evaluate('scrollTo(0,0)');
            const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
            fs.writeFileSync(path.join(workspace, `.tmp-account-${tab}-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
          }
        }
      }
    }
    if (tab === 'browser-preferences') {
      const colors = await browser.evaluate("[...document.querySelectorAll('.swatch')].map(n=>getComputedStyle(n).backgroundColor)");
      await browser.click('#mode');assert.equal(await browser.evaluate("document.querySelector('#mode').textContent"), 'Light');
      await browser.click('[data-theme="1"]');
      assert.equal(await browser.evaluate("document.querySelector('[data-theme=\"1\"]').getAttribute('aria-checked')"), 'true');
      assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.swatch')].map(n=>getComputedStyle(n).backgroundColor)"), colors, 'Theme swatches retain their own colors');
    }
    if (['privacy', 'notifications'].includes(tab)) {
      await browser.click('.native-category');assert.equal(await browser.evaluate("document.querySelector('#detail-dialog').hidden"), false);
      await browser.click('#close');
    }
    if (tab === 'security') {
      await browser.click('#show-more');assert.equal(await browser.evaluate("document.querySelectorAll('#devices button').length"), 9);
      await browser.waitFor("document.querySelector('[data-rc-settings-surface]').getBoundingClientRect().bottom>=document.querySelector('#logout').getBoundingClientRect().bottom");
      assert.equal(await browser.evaluate("document.querySelector('#verification').checked"), true);
    }
  }
  await browser.evaluate("document.querySelector('.react-outlet').innerHTML=document.querySelector('.react-outlet').innerHTML;history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
  await browser.waitFor("!document.querySelector('[data-rc-settings-surface],[data-rc-settings-panel],[data-rc-settings-layout]')");
  assert.deepEqual(browser.errors, []);
});
