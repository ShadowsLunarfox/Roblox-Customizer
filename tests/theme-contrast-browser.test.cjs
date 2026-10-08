const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json')));
const stylesheets = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];

// Real extension selectors and styles, with native theme colors supplied by the fixture.
const samples = {
  home: `<div id="HomeContainer"><section id="rc-home-greeting"><div class="rc-home-greeting-copy"><span data-contrast class="rc-home-greeting-eyebrow">WELCOME BACK</span><h2 data-contrast class="rc-home-greeting-title">Hello, Roblox player</h2><span data-contrast class="rc-home-greeting-username">@player</span></div></section><section id="rc-pinned-games"><div class="rc-pinned-games-grid"><article class="rc-pinned-game-card"><a data-contrast class="rc-pinned-game-details">Pinned adventure</a><button data-contrast data-primary class="rc-pinned-game-join">Join</button></article></div></section></div>`,
  games: `<div id="game-detail-page"><div class="game-main-content"><div id="game-details-carousel-container"><img class="native-art" alt="Game art" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23386b94'/%3E%3C/svg%3E"></div><div class="game-calls-to-action"><h1 data-contrast class="game-name">Adventure</h1><div class="rc-private-server-more"><button data-contrast>More servers</button></div></div></div><div class="fixture-panel"><form class="rc-public-server-filters"><label>Country<select data-contrast><option>All countries</option></select></label><label>Players<input data-contrast placeholder="Any" value="5"></label><button data-contrast data-primary class="rc-public-server-filter-search" type="button">Search</button><button data-contrast class="rc-public-server-filter-reset" type="button">Reset</button><div class="rc-server-metrics" data-rc-latency="low"><span data-contrast class="rc-server-latency">Low latency</span></div><div class="rc-server-metrics" data-rc-latency="medium"><span data-contrast class="rc-server-latency">Medium latency</span></div><div class="rc-server-metrics" data-rc-latency="high"><span data-contrast class="rc-server-latency">High latency</span></div></form></div><div class="fixture-panel" id="rc-rolimons-panel"><h2 data-contrast>Game statistics</h2><button data-contrast data-primary class="rc-rolimons-tab rc-rolimons-tab-active">Overview</button></div></div>`,
  profile: `<section id="rc-profile-details"><div class="rc-profile-details-header"><h2 data-contrast>Profile details</h2><button data-contrast class="rc-profile-copy-id">Copy ID</button></div><div class="rc-profile-facts"><div class="rc-profile-fact"><span data-contrast>Joined</span><strong data-contrast>January 2020</strong></div></div></section><section id="rc-profile-limiteds"><h2 data-contrast>Collectibles</h2><p data-contrast class="rc-limiteds-status">Updated just now</p></section>`,
  avatar: `<section data-rc-avatar-studio><div data-rc-avatar-view-column><span data-contrast>3D Preview</span></div></section><section id="rc-avatar-2d"><div class="rc-avatar-2d-heading"><h2 data-contrast>2D Preview</h2><button data-contrast class="rc-avatar-refresh">Refresh</button></div><p data-contrast class="rc-avatar-status">Preview is ready</p></section><nav data-rc-avatar-main-row><button data-contrast data-rc-avatar-main-control>Characters</button><button data-contrast data-primary data-rc-avatar-main-control class="active">Clothing</button></nav><nav data-rc-avatar-subcategories><button data-contrast data-rc-avatar-sub-control>Shirts</button></nav>`,
  catalog: `<section data-rc-item-studio><div id="rc-catalog-item-2d"><h2 data-contrast>Item preview</h2><button data-contrast class="rc-item-refresh">Refresh</button></div></section><section id="item-info-container-frontend"><div class="item-details-section"><div class="item-info-row-container"><div class="row-label">Description</div><div class="row-content"><p data-contrast class="description-content">A new accessory for your avatar.</p></div></div><div class="price-row-container"><span data-contrast class="text-robux-lg">150 Robux</span><div class="item-info-row-container"><span data-contrast class="row-label">Price</span></div></div></div></section><section id="asset-resale-data-container" data-rc-market-root><div data-rc-market-section="chart"><div class="fixture-panel"><span data-contrast class="legend-text">Average price</span></div></div></section>`,
  social: `<section id="rc-x-feed-panel"><h2 data-contrast>Social updates</h2><p data-contrast class="rc-x-feed-status">Latest posts</p><a data-contrast class="rc-x-feed-post">A new game update <time data-contrast>Today</time></a><footer class="rc-x-feed-footer"><a data-contrast href="#">View profile</a></footer></section>`,
  settings: `<div id="rc-settings-overlay"><section class="rc-settings-dialog"><div class="rc-settings-heading"><h2 data-contrast>Roblox Customizer</h2><button data-contrast class="rc-icon-button" aria-label="Close"><svg width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M4 3L10 9L16 3L17 4L11 10L17 16L16 17L10 11L4 17L3 16L9 10L3 4Z"/></svg></button></div><p data-contrast class="rc-settings-intro">Personalize your Roblox experience.</p><fieldset class="rc-settings-field"><label for="background">Background URL</label><input id="background" data-contrast type="url" placeholder="https://example.com/background.png"><select data-contrast><option>Cover</option><option>Contain</option></select><input data-contrast type="file"></fieldset><div class="rc-settings-currency"><h3 data-contrast>Currency estimates</h3><p data-contrast>Choose a currency to display alongside Robux.</p><input data-contrast type="search" placeholder="Search currencies"><output data-contrast>1,000 Robux ≈ MYR 45.00</output></div><div class="rc-hidden-recommended-game"><span data-contrast>Hidden recommendation</span><button data-contrast data-primary>Restore</button></div><p id="rc-settings-status" data-contrast>Saved successfully</p><div class="rc-settings-actions"><button data-contrast class="rc-button rc-button-secondary">Reset</button><button data-contrast data-primary class="rc-button rc-button-primary">Save</button><button disabled class="rc-button rc-button-secondary">Unavailable</button></div></section></div>`
};

function fixture() {
  return `<!doctype html><html data-rc-background-active><head><meta charset="utf-8">${stylesheets.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}<style>
  :root,.dark-theme{--fixture-text:#f4f6fb;--fixture-bg:#151821}.light-theme{--fixture-text:#202227;--fixture-bg:#f4f4f5}
  *{box-sizing:border-box}body{margin:0;padding:24px;font:16px/1.5 Arial;color:var(--fixture-text);background:var(--fixture-bg)}button,input,select{font:inherit}a{color:inherit}h1,h2,p{margin:0 0 12px}#samples{max-width:1050px;margin:auto;display:grid;gap:20px}.fixture-panel{padding:20px;border-radius:12px;background:rgb(var(--rc-glass-color) / var(--rc-surface-opacity))}#rc-avatar-2d,#rc-catalog-item-2d{min-height:0}.native-art{display:block;width:100%;max-width:320px}#rc-settings-overlay{position:relative;padding:0;background:transparent}#rc-settings-overlay .rc-settings-dialog{max-height:none}#rc-x-feed-panel{margin:0}
  </style></head><body class="dark-theme"><div id="rc-background-layer"></div><main id="samples"></main></body></html>`;
}

// Composite real CSS backgrounds (including glass, pseudo backings and gradient
// first stops) before measuring WCAG contrast. No screenshot text/OCR assumptions.
const contrastSnapshot = `(() => {
  const rgba = s => (s.match(/[\\d.]+/g)||[]).map(Number);
  const blend = (fg,bg) => {const a=fg.length>3?fg[3]:1;return fg.slice(0,3).map((v,i)=>v*a+bg[i]*(1-a))};
  const background = node => {let result=window.wallpaper;const chain=[];for(let n=node;n;n=n.parentElement)chain.unshift(n);for(const n of chain){const s=getComputedStyle(n);result=blend(rgba(s.backgroundColor),result);const gradient=s.backgroundImage.match(/rgba?\\([^)]+\\)/);if(gradient)result=blend(rgba(gradient[0]),result);const before=getComputedStyle(n,'::before');if(before.position==='absolute'&&before.zIndex==='-1'&&before.content!=='none')result=blend(rgba(before.backgroundColor),result)}return result};
  const luminance = c => c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  return [...document.querySelectorAll('[data-contrast]')].map(n=>{const s=getComputedStyle(n),bg=background(n),fg=blend(rgba(s.color),bg),a=luminance(bg),b=luminance(fg);return {label:n.textContent.trim().slice(0,45)||n.type,color:s.color,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),primary:n.hasAttribute('data-primary')}});
})()`;

test('Extension text, controls, glass and icons stay readable across live light/dark theme changes', { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const server = http.createServer((request,response) => {
    response.setHeader('Cache-Control','no-store');
    const file = new URL(request.url,'http://localhost').pathname.slice(1);
    response.setHeader('Content-Type',stylesheets.includes(file)?'text/css':'text/html; charset=utf-8');
    response.end(stylesheets.includes(file)?fs.readFileSync(path.join(workspace,file)):fixture());
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser = await isolatedChrome(t,'theme-contrast');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
  await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  await waitForDocument(browser,'#samples');
  const failures = [];
  // Opposite html/body themes exercise inheritance. Switching without a reload
  // catches computed custom properties that accidentally retain the root theme.
  for (const theme of ['light','dark','light']) {
    await browser.evaluate(`document.documentElement.className='${theme==='light'?'dark':'light'}-theme';document.body.className='${theme}-theme'`);
    for (const wallpaper of theme==='light'?[[0,0,0],[255,255,255]]:[[15,18,25]]) {
      await browser.evaluate(`window.wallpaper=${JSON.stringify(wallpaper)};document.querySelector('#rc-background-layer').style.background='rgb(${wallpaper.join(' ')})'`);
      for (const [page,markup] of Object.entries(samples)) {
        await browser.evaluate(`document.documentElement.dataset.rcFrostPage=${JSON.stringify(page)};document.querySelector('#samples').innerHTML=${JSON.stringify(markup)}`);
        const rows = await browser.evaluate(contrastSnapshot);
        assert.ok(rows.length>=3,`${page}: fixture has readable elements`);
        for(const row of rows) {
          if(row.ratio<4.5)failures.push(`${theme} / ${wallpaper} / ${page} / ${row.label}: contrast ${row.ratio.toFixed(2)}; ${row.color} on ${row.bg}`);
          if(row.primary)assert.equal(row.color,'rgb(255, 255, 255)',`${page}: blue actions retain white labels`);
        }
        if(page==='settings') {
          await browser.click('#background');
          const input=await browser.evaluate(`(()=>{const n=document.querySelector('#background');n.focus();const s=getComputedStyle(n);return {scheme:s.colorScheme,outline:s.outlineStyle,placeholder:getComputedStyle(n,'::placeholder').color,icon:getComputedStyle(document.querySelector('.rc-icon-button path')).fill,button:getComputedStyle(document.querySelector('.rc-icon-button')).color}})()`);
          assert.equal(input.scheme,theme);assert.equal(input.outline,'solid');assert.equal(input.icon,input.button);
          assert.notEqual(input.placeholder,theme==='light'?'rgb(255, 255, 255)':'rgb(0, 0, 0)');
          assert.equal(await browser.evaluate("document.querySelector('button[disabled]').disabled"),true);
          if(process.env.THEME_SCREENSHOTS&&wallpaper[0]!==255) {
            const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
            fs.writeFileSync(path.join(workspace,`.tmp-theme-${theme}.png`),Buffer.from(shot.data,'base64'));
          }
        }
        if(page==='games')assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.native-art')).filter"),'none');
      }
    }
  }
  // A theme supplied only by html also works, and settings survive a DOM remount.
  await browser.evaluate(`document.body.className='';document.documentElement.className='light-theme';document.querySelector('#samples').innerHTML=${JSON.stringify(samples.settings)}`);
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#background')).colorScheme"),'light');
  assert.deepEqual(failures,[],failures.join('\n'));
  assert.deepEqual(browser.errors,[]);
});
