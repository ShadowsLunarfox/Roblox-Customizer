const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/startup.js', 'src/pages/games/private-server-configure.js'];
const art = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="480" height="480"%3E%3Crect width="480" height="480" fill="%23386b94"/%3E%3Ccircle cx="240" cy="240" r="100" fill="%23ffd47c"/%3E%3C/svg%3E';
const configPath = '/private-server/configure/4169319554';
const storePath = '/games/130950966579217/Title-Unavailable#!/store/developer-products';

function panel(variant, id, title, body) {
  if (variant === 'utility') return `<div id="${id}"><h2>${title}</h2>${body}</div>`;
  if (variant === 'foundation') return `<article id="${id}" data-slot="card" class="bg-surface-100"><h2>${title}</h2>${body}</article>`;
  if (variant === 'plain') return `<section id="${id}" class="section-content"><h2>${title}</h2>${body}</section>`;
  return `<section id="${id}" class="section"><header class="container-header"><h2>${title}</h2></header><div class="section-content">${body}</div></section>`;
}

function configuration(variant) {
  return `<h1>Configure Private Server</h1><form id="configuration">
    ${panel(variant, 'details', 'Server Details', '<div class="form-group"><label for="server-name">Server Name</label><input id="server-name" name="name" value="Sample private server" required maxlength="50"></div><p class="text-description">Manage the name and access settings for this server.</p><a href="/games/4623386862/Piggy" class="text-link">Back to experience</a>')}
    ${panel(variant, 'access', 'Access', '<div class="switch-row"><span id="friends-label">Friends Allowed</span><button id="friends" type="button" class="btn-toggle" role="switch" aria-checked="false" aria-labelledby="friends-label"><span class="toggle-flip"></span></button></div><label><input type="checkbox" name="active" checked> Allow joining</label><div class="form-group"><label for="member">Server Members</label><input id="member" placeholder="Search for a user"><button type="button" class="btn-control-sm" data-action="add">Add</button></div><div class="section-content hidden" id="native-hidden">Hidden native membership control</div>')}
    ${panel(variant, 'link', 'Private Server Link', '<div class="form-group"><label for="invite">Invitation Link</label><input id="invite" name="invite" readonly value="https://www.roblox.com/share?code=sample-local-invite-link&amp;type=Server"><button type="button" class="btn-control-sm" data-action="copy">Copy</button></div><button type="button" class="btn-secondary-sm" data-action="regenerate">Generate</button><p class="text-description">Use the native confirmation to generate a new link.</p>')}
    ${panel(variant, 'billing', 'Subscription', '<label><input type="checkbox" name="subscription"> Renew subscription</label><p class="text-description">Sample renewal details provided by the native page.</p><p class="text-error">Sample native validation message.</p><button class="btn-primary-md" type="submit">Save</button><button class="btn-primary-sm" type="button" disabled data-action="disabled">Unavailable</button>')}
    <input type="hidden" name="token" value="sample-token">
    </form><div role="dialog" id="confirmation" hidden><div class="section-content"><h2>Confirm link change</h2><button type="button" data-action="confirm">Confirm</button></div></div>`;
}

// Screenshot-style summaries have no form or button until Rename is opened.
// The mixed layout loads a recognized access section after that plain summary.
function configurationSummary(variant) {
  const edit = variant === 'summary-readonly' ? '' : '<a id="rename" href="#rename" role="button" class="btn-generic-edit-sm" data-action="rename" aria-label="Rename server"><span class="icon-edit" aria-hidden="true"></span></a>';
  return `<header class="summary-heading"><h1>Configure Private Server</h1><a id="back" href="/games/4623386862/Piggy#!/game-instances">Back to Private Servers →</a></header><div id="summary"><div class="summary-art"><a href="/games/4623386862/Piggy"><span class="thumbnail-2d-container"><img id="experience-art" src='${art}' width="256" height="256" alt="Sample experience"></span></a></div><div class="summary-details"><div class="summary-row"><span class="text-label">Server Name</span><span class="text-overflow" id="display-name">${'SampleLongServerName'.repeat(4)}</span>${edit}</div><div class="summary-row"><span class="text-label">Experience</span><a id="experience" class="text-overflow" href="/games/4623386862/Piggy">Sample experience with a long title</a></div><div class="summary-row"><span class="text-label">Subscription Price</span><span>Free</span></div></div></div><div id="later-controls"></div><div class="section-content hidden" id="obsolete-summary">Obsolete native section</div><div role="dialog" hidden><div class="section-content">Hidden native dialog</div></div>`;
}

// Classes and nesting follow Roblox's published GameStore component. No real purchases.
function productCards(page = 1) {
  return ['Small item', 'A product with a longer title that wraps into multiple lines', 'LongProductName'.repeat(7), 'Unavailable product'].map((name, i) => `<li class="list-item developer-product-tile"><div class="store-card"><div class="store-product-card-thumbnail"><a href="/developer-products/${page * 10 + i}/sample"><span class="thumbnail-2d-container"><img alt="${name}" src='${art}' width="480" height="480"></span></a>${i === 0 ? '<div class="pending-badge"><span class="pending-icon">&#9201;</span><span class="pending-count">1</span></div>' : ''}</div><div class="store-product-card-caption"><div class="store-product-card-name" title="${name}">${name}</div><div class="store-card-price"><span class="icon-robux-16x16"></span><span class="text-robux">${(i + 1) * 125}</span></div><div class="store-card-footer"><button type="button" class="PurchaseButton btn-buy-md btn-full-width rbx-gear-passes-purchase" data-product-id="${page * 10 + i}" ${i === 3 ? 'disabled' : ''}><span>Buy</span></button></div></div></div></li>`).join('') + '<li class="list-item developer-product-tile hidden" id="hidden-product">Native hidden item</li>';
}

function store(standalone) {
  const products = `<div id="rbx-developer-products" class="container-list game-dev-store game-passes"><div class="container-header"><h2>Products</h2></div><ul class="hlist store-cards store-developer-products-row">${productCards()}</ul><div class="overview-pagination-container"><button type="button" id="previous" disabled>Previous</button><button type="button" id="next">Next</button></div><p class="text-description" id="empty" hidden>No products available.</p></div>`;
  return `<div id="game-detail-page" data-place-id="130950966579217">${standalone ? products : `<div class="tab-content"><section id="store">${products}</section></div>`}</div><div role="dialog" id="purchase-dialog" hidden><p>Sample purchase confirmation</p><button type="button" id="cancel">Cancel</button></div>`;
}

function fixture(url) {
  const variant = url.searchParams.get('variant') || 'legacy';
  const isConfig = url.pathname.startsWith('/private-server/');
  const markup = isConfig ? (variant.startsWith('summary-') ? configurationSummary(variant) : configuration(variant)) : store(variant === 'standalone');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${process.env.GAME_SETTINGS_NATIVE_CSS ? '<link rel="stylesheet" href="/native.css">' : ''}
    <style>*{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:#151821;color:#f4f6fb}.light-theme{background:#f4f4f5;color:#202227}#content{width:1120px;max-width:calc(100% - 32px);margin:24px auto}#game-detail-page{width:100%;margin:0}.container-header h2{margin:0}.section-content,.bg-surface-100{background:#24262c;padding:15px}.light-theme .section-content,.light-theme .bg-surface-100{background:white}h1,h2,p{margin:0 0 12px}input,button{font:inherit}label{display:block}button{padding:8px 12px;border:1px solid #777;border-radius:4px;background:#444;color:inherit}button:disabled{opacity:.4}.btn-primary-md,.btn-primary-sm{background:#335fff;color:white}.form-group{margin:16px 0}input:not([type=checkbox],[type=hidden]){width:100%}.switch-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.btn-toggle{position:relative;width:40px;height:24px;padding:2px;border:0;border-radius:12px;background:#888}.toggle-flip{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:white}.btn-toggle.on .toggle-flip{left:auto;right:2px}.hidden,.ng-hide,[hidden]{display:none!important}.store-cards .list-item{float:left;width:25%;margin-bottom:12px}.store-cards:before,.store-cards:after{content:' ';display:table}.store-cards:after{clear:both}.store-card{max-width:150px;margin-right:5%}.store-product-card-thumbnail img{width:150px;height:150px}.store-product-card-name{white-space:nowrap;overflow:hidden;height:1.2em}.store-card-price .text-robux{float:left}.store-card-footer{height:30px;margin-top:6px}[role=dialog]:not([hidden]){position:fixed;inset:20%;z-index:50;background:#444;padding:24px}.light-theme [role=dialog]{background:white}a{color:inherit}</style>
    <style>.summary-heading{display:flex;align-items:baseline;justify-content:space-between;gap:20px;margin-bottom:24px}.summary-heading h1{margin:0}.summary-art{float:left;width:256px;margin-right:16px}.summary-art img{display:block;border-radius:10px}.summary-details{margin-left:272px}.summary-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #8886}.summary-row .text-label{flex:none;width:148px}.summary-row .text-overflow{min-width:0}.summary-row #rename{flex:none;margin-left:auto}.icon-edit{display:block;width:16px;height:16px;background:currentColor;clip-path:polygon(15% 65%,65% 15%,85% 35%,35% 85%,10% 90%)}#later-controls{clear:both;padding-top:24px}@media(max-width:640px){.summary-heading{display:block}.summary-art{float:none;width:256px;max-width:100%;margin:0 0 20px}.summary-details{margin:0}.summary-row{flex-wrap:wrap}.summary-row .text-label{width:100%}}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    ${scripts.map(file => `<script src="/${file}"></script>`).join('')}
    </head><body class="dark-theme"><main><div id="content"></div></main><script>
    window.actions=[];window.saves=[];window.page=1;
    setTimeout(()=>{document.querySelector('#content').innerHTML=${JSON.stringify(markup)};window.fixtureReady=true;
      if(${JSON.stringify(variant)}==='summary-mixed')setTimeout(()=>{document.querySelector('#later-controls').innerHTML='<section class="section-content" id="loaded-access"><h2>Access</h2><label><input type="checkbox" checked id="joining">Allow joining</label><button type="button" class="btn-control-sm" data-action="local-access">Sample access control</button></section>'},100);
    },60);
    document.addEventListener('submit',event=>{event.preventDefault();window.saves.push(Object.fromEntries(new FormData(event.target)))});
    document.addEventListener('click',event=>{const control=event.target.closest('button,[data-action="rename"]');if(!control||control.disabled)return;
      if(control.dataset.action==='rename'){event.preventDefault();document.querySelector('#content').insertAdjacentHTML('beforeend','<div role="dialog" id="rename-dialog"><div class="section-content"><h2>Rename server</h2><form id="rename-form"><label for="edit-name">Server Name</label><input id="edit-name" name="name" value="Sample name" required maxlength="50"><button class="btn-primary-sm" type="submit">Save</button><button type="button" data-action="close-rename">Cancel</button></form></div></div>')}
      if(control.dataset.action==='close-rename')document.querySelector('#rename-dialog').hidden=true;
      if(control.id==='friends'){const on=control.getAttribute('aria-checked')!=='true';control.setAttribute('aria-checked',on);control.classList.toggle('on',on)}
      if(control.dataset.action){window.actions.push(control.dataset.action);if(control.dataset.action==='regenerate')document.querySelector('#confirmation').hidden=false;if(control.dataset.action==='confirm')document.querySelector('#confirmation').hidden=true}
      if(control.dataset.productId){window.actions.push(control.dataset.productId);document.querySelector('#purchase-dialog').hidden=false}
      if(control.id==='cancel')document.querySelector('#purchase-dialog').hidden=true;
      if(control.id==='next'){window.page++;document.querySelector('.store-cards').innerHTML=${JSON.stringify(productCards(2))};document.querySelector('#previous').disabled=false}
    });
    </script></body></html>`;
}

async function setup(t, name) {
  if (process.env.GAME_SETTINGS_NATIVE_CSS) assert.ok(fs.existsSync(process.env.GAME_SETTINGS_NATIVE_CSS));
  const assets = [...styles, ...scripts];
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const url = new URL(request.url, 'http://localhost');
    const file = url.pathname.slice(1);
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
    if (assets.includes(file)) response.end(fs.readFileSync(path.join(workspace, file)));
    else if (file === 'native.css' && process.env.GAME_SETTINGS_NATIVE_CSS) response.end(fs.readFileSync(process.env.GAME_SETTINGS_NATIVE_CSS));
    else response.end(fixture(url));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { browser: await isolatedChrome(t, name), base: `http://127.0.0.1:${server.address().port}` };
}

async function checkLayouts(browser, kind) {
  for (const background of [false, true]) {
    await browser.evaluate(`RobloxCustomizerStartup.setPreferences({source:'${background ? 'url' : 'none'}',url:'sample',glassBlur:24,glassOpacity:75})`);
    for (const theme of ['dark', 'light']) {
      await browser.evaluate(`document.body.className='${theme}-theme'`);
      for (const width of [1360, 768, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const layout = await browser.evaluate(`(()=>{const selector=${JSON.stringify(kind === 'config' ? '[data-rc-private-config-panel]' : '.store-card')};return {overflow:document.documentElement.scrollWidth>innerWidth,panels:[...document.querySelectorAll(selector)].map(n=>({color:getComputedStyle(n).color,blur:getComputedStyle(n,'::before').backdropFilter})),bounds:[...document.querySelectorAll('#content h1,#content h2,#content p,#content input:not([type=hidden]),#content button,#content .store-product-card-name,#content .store-product-card-thumbnail img')].filter(n=>n.getBoundingClientRect().width).map(n=>{const r=n.getBoundingClientRect(),p=n.closest('.store-card')?.getBoundingClientRect();return {id:n.id||n.className||n.tagName,fits:r.left>=-.5&&r.right<=innerWidth+.5&&(!p||r.left>=p.left&&r.right<=p.right),unclipped:n.tagName==='INPUT'||n.scrollWidth<=n.clientWidth+1}})}})()`);
        const label = `${kind} ${theme} ${width} background ${background}`;
        assert.equal(layout.overflow, false, label);
        assert.ok(layout.panels.length, label);
        for (const p of layout.panels) {
          assert.equal(p.color, theme === 'light' ? 'rgb(27, 35, 48)' : 'rgb(244, 246, 251)', label);
          if (kind === 'config') assert.match(p.blur, /blur\(24px\)/, label);
        }
        if (kind === 'config') {
          const backings = await browser.evaluate(`([...document.querySelectorAll('[data-rc-private-config-panel]')].map(n=>{const s=getComputedStyle(n),b=getComputedStyle(n,'::before');return {id:n.id,position:s.position,isolation:s.isolation,width:n.clientWidth,height:n.clientHeight,backingWidth:parseFloat(b.width),backingHeight:parseFloat(b.height),background:b.backgroundColor,visibility:b.visibility,display:b.display,opacity:b.opacity,content:b.content,zIndex:b.zIndex,padding:s.padding}}))`);
          for (const p of backings) {
            assert.equal(p.position, 'relative', `${label}: panel positioning ${JSON.stringify(p)}`);
            assert.equal(p.isolation, 'isolate', `${label}: panel isolation ${JSON.stringify(p)}`);
            assert.ok(p.width > 0 && p.height > 0, `${label}: a visible panel receives styling ${JSON.stringify(p)}`);
            assert.ok(p.backingWidth >= p.width - 1 && p.backingHeight >= p.height - 1, `${label}: backing fills the panel ${JSON.stringify(p)}`);
          }
        }
        for (const n of layout.bounds) {
          assert.equal(n.fits, true, `${label}: ${n.id} stays contained`);
          assert.equal(n.unclipped, true, `${label}: ${n.id} is not clipped`);
        }
        if (kind === 'store') {
          const rows = await browser.evaluate(`([...document.querySelectorAll('.developer-product-tile:not(.hidden)')].map(n=>{const r=n.getBoundingClientRect(),b=n.querySelector('.PurchaseButton').getBoundingClientRect();return {top:r.top,height:r.height,bottom:b.bottom}}))`);
          for (const a of rows) for (const b of rows) if (Math.abs(a.top-b.top)<1) {
            assert.ok(Math.abs(a.height-b.height)<1, `${label}: cards have equal row heights`);
            assert.ok(Math.abs(a.bottom-b.bottom)<1, `${label}: Buy buttons align`);
          }
          assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.store-cards')).display"), 'grid');
          assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#hidden-product')).display"), 'none');
        }
        if (process.env.GAME_SETTINGS_SCREENSHOTS && !background && width !== 768 && theme === 'light') {
          await browser.evaluate('scrollTo(0,0)');
          const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          const variant = await browser.evaluate("new URL(location.href).searchParams.get('variant')");
          fs.writeFileSync(path.join(workspace, `.tmp-${kind}-${variant}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
  }
}

test('Private-server configuration keeps native access, link, billing and save controls across layouts', { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const { browser, base } = await setup(t, 'private-config');
  for (const variant of ['legacy', 'plain', 'foundation', 'utility']) {
    const url = `${base}${configPath}?variant=${variant}`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#configuration', url);
    await browser.waitFor(`document.querySelectorAll('[data-rc-private-config-panel]').length===${variant === 'utility' ? 1 : 4}`);
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('[data-rc-private-config-panel]')].map(n=>n.id)"), variant === 'utility' ? ['content'] : ['details', 'access', 'link', 'billing']);
    assert.equal(await browser.evaluate("document.documentElement.dataset.rcFrostPage"), 'private-server-configure');
    assert.equal(await browser.evaluate("!!document.querySelector('[role=dialog] [data-rc-private-config-panel]')"), false);
    await checkLayouts(browser, 'config');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#native-hidden')).display"), 'none');
    assert.equal(await browser.evaluate("document.querySelector('#invite').value"), 'https://www.roblox.com/share?code=sample-local-invite-link&type=Server');
    await browser.click('#friends');
    assert.equal(await browser.evaluate("document.querySelector('#friends').getAttribute('aria-checked')"), 'true');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#friends')).height"), '24px');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#friends')).backgroundColor"), 'rgb(51, 95, 255)');
    await browser.click('[data-action=copy]');await browser.click('[data-action=regenerate]');
    assert.equal(await browser.evaluate("document.querySelector('#confirmation').hidden"), false);
    await browser.click('[data-action=confirm]');
    await browser.click('[data-action=disabled]');
    assert.deepEqual(await browser.evaluate('window.actions'), ['copy', 'regenerate', 'confirm']);
    await browser.evaluate("document.querySelector('#server-name').value='Updated sample server'");
    await browser.click('button[type=submit]');
    const saved = await browser.evaluate('window.saves');
    assert.deepEqual(saved, [{ name: 'Updated sample server', active: 'on', invite: 'https://www.roblox.com/share?code=sample-local-invite-link&type=Server', token: 'sample-token' }]);
    await browser.evaluate("document.querySelector('#server-name').value=''");
    await browser.click('button[type=submit]');
    assert.equal(await browser.evaluate('window.saves.length'), 1, 'Native required validation is preserved');
    await browser.evaluate("document.querySelector('#content').innerHTML=document.querySelector('#content').innerHTML;history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("!document.querySelector('[data-rc-private-config-panel]')");
  }
  assert.deepEqual(browser.errors, []);
});

test('Private-server summaries receive a complete backing without forms and beside delayed native panels', { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const { browser, base } = await setup(t, 'private-summary');
  for (const variant of ['summary-readonly', 'summary-edit', 'summary-mixed']) {
    const url = `${base}/private-server/configure/289332693?variant=${variant}`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#summary', url);
    if (variant === 'summary-mixed') await browser.waitFor("!!document.querySelector('#loaded-access')");
    await browser.waitFor("document.querySelector('#content').hasAttribute('data-rc-private-config-panel')");
    if (variant !== 'summary-mixed') assert.equal(await browser.evaluate("!!document.querySelector('#content form,#content input,#content button')"), false, 'The reported display-only layout must not rely on finding a form or button');
    const snapshot = "JSON.stringify({text:document.querySelector('#content').textContent,links:[...document.querySelectorAll('#content a')].map(n=>n.getAttribute('href')),art:document.querySelector('#experience-art').src,checked:document.querySelector('#joining')?.checked})";
    const original = await browser.evaluate(snapshot);
    if (variant === 'summary-mixed') {
      await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none'})");
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#loaded-access')).backgroundColor"), 'rgba(0, 0, 0, 0)', 'Nested sections share the complete backing without needing wallpaper');
    }
    await checkLayouts(browser, 'config');
    assert.equal(await browser.evaluate(snapshot), original, 'Styling preserves server information, artwork, links and access state');
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('[data-rc-private-config-panel]')].map(n=>n.id)"), ['content'], 'One backing covers the summary and later native sections');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#obsolete-summary')).display"), 'none');
    assert.equal(await browser.evaluate("!!document.querySelector('[role=dialog] [data-rc-private-config-panel]')"), false);
    for (const theme of ['dark', 'light']) {
      await browser.evaluate(`document.body.className='${theme}-theme';document.body.style.background='${theme === 'dark' ? '#eee' : '#111'}';RobloxCustomizerStartup.setPreferences({source:'url',url:'sample',glassBlur:24,glassOpacity:75})`);
      for (const width of [1360, 390]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const covered = await browser.evaluate(`(()=>{const r=document.querySelector('#content').getBoundingClientRect();return [...document.querySelectorAll('#summary *,#back,#content h1,#loaded-access')].filter(n=>n.getBoundingClientRect().width).every(n=>{const a=n.getBoundingClientRect();return a.left>=r.left&&a.right<=r.right+.5&&a.top>=r.top&&a.bottom<=r.bottom+.5})})()`);
        assert.equal(covered, true, `${variant} ${theme} ${width}: backing contains artwork, information and controls`);
        if (process.env.PRIVATE_SUMMARY_SCREENSHOTS && variant === 'summary-mixed') {
          await browser.evaluate('scrollTo(0,0)');
          const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          fs.writeFileSync(path.join(workspace, `.tmp-private-summary-${theme}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
      }
    }
    if (variant !== 'summary-readonly') {
      await browser.click('#rename');
      await browser.waitFor("!!document.querySelector('#edit-name')");
      await browser.evaluate("document.querySelector('#edit-name').value='Updated local sample'");
      await browser.click('#rename-form button[type=submit]');
      assert.deepEqual(await browser.evaluate('window.saves'), [{ name: 'Updated local sample' }]);
      await browser.click('[data-action=close-rename]');
      assert.equal(await browser.evaluate("!!document.querySelector('[role=dialog] [data-rc-private-config-panel]')"), false);
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#rename')).minHeight"), '36px');
    }
    await browser.evaluate("document.querySelector('#content').innerHTML=document.querySelector('#content').innerHTML;history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("!document.querySelector('[data-rc-private-config-panel]')");
  }
  assert.deepEqual(browser.errors, []);
});

test('Developer Products keep aligned native cards, prices, pagination and purchase confirmations', { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const { browser, base } = await setup(t, 'game-store');
  for (const variant of ['legacy', 'standalone']) {
    const url = `${base}${storePath.replace('#', `?variant=${variant}#`)}`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '.PurchaseButton', url);
    const original = await browser.evaluate("[...document.querySelectorAll('.store-card')].map(n=>({name:n.querySelector('.store-product-card-name').textContent,price:n.querySelector('.text-robux').textContent,product:n.querySelector('button').dataset.productId,href:n.querySelector('a').getAttribute('href')}))");
    await checkLayouts(browser, 'store');
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.store-card')].map(n=>({name:n.querySelector('.store-product-card-name').textContent,price:n.querySelector('.text-robux').textContent,product:n.querySelector('button').dataset.productId,href:n.querySelector('a').getAttribute('href')}))"), original);
    await browser.click('.PurchaseButton[disabled]');assert.deepEqual(await browser.evaluate('window.actions'), []);
    await browser.click('.PurchaseButton:not([disabled])');
    assert.deepEqual(await browser.evaluate('window.actions'), ['10']);
    assert.equal(await browser.evaluate("document.querySelector('#purchase-dialog').hidden"), false);
    await browser.click('#cancel');
    await browser.click('#next');
    assert.equal(await browser.evaluate('window.page'), 2);
    assert.equal(await browser.evaluate("document.querySelector('.PurchaseButton').dataset.productId"), '20');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.store-cards')).display"), 'grid');
    assert.equal(await browser.evaluate('location.hash'), '#!/store/developer-products');
    await browser.evaluate("document.querySelector('.store-cards').replaceChildren();document.querySelector('#empty').hidden=false");
    assert.equal(await browser.evaluate("document.querySelector('#empty').checkVisibility()"), true);
  }
  assert.deepEqual(browser.errors, []);
});
