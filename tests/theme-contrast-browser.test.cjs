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
  'private-server-configure': `<div id="content"><section data-rc-private-config-panel><h2 data-contrast>Configure Private Server</h2><label data-contrast>Server Name</label><input data-contrast value="Sample private server"><p class="text-description" data-contrast>Manage server access and invitations.</p><p class="text-error" data-contrast>Sample validation message</p><button class="btn-control-sm" data-contrast>Copy Link</button><button class="btn-primary-md" data-primary data-contrast>Save</button></section></div>`,
  'account-settings': `<div id="content"><section data-rc-settings-panel><h2 data-contrast>Account Info</h2><span class="text-label" data-contrast>Display Name</span><p data-contrast>Sample Player</p><span class="text-success" data-contrast>Verified</span><button class="btn-generic-edit-sm" data-contrast>Edit</button><div class="form-group"><label for="sample-language" data-contrast>Language</label><select id="sample-language" data-contrast><option>English</option></select></div><textarea data-contrast>Profile description</textarea><p class="text-description" data-contrast>Choose who can see your social profiles.</p><div class="alert alert-warning" data-contrast>Sample warning</div><button class="btn-secondary-sm" data-contrast>Reset</button><button class="btn-primary-sm" data-contrast data-primary>Save</button></section></div>`,
  'game-pass': `<div id="item-container"><section class="section-content top-section"><header class="item-name-container"><h1 data-contrast>Admin Commands</h1><span class="text-label" data-contrast>By <a class="text-name" data-contrast>Creator</a></span></header><div id="item-details"><div class="price-container"><div class="price-container-text"><span class="text-label" data-contrast>Price</span><span class="text-robux-lg" data-contrast>150 Robux</span></div></div><p class="description-content" data-contrast>Unlock commands in this experience.</p></div></section></div>`,
  badge: `<div id="item-container"><section class="section-content top-section"><header class="item-name-container"><h1 data-contrast>You played!</h1><span class="text-label" data-contrast>By <a class="text-name" data-contrast>Creator</a></span></header><div class="item-thumbnail-container"><div class="thumbnail-holder"><div class="related-asset-container"><div class="asset-info"><p class="preview-text" data-contrast>Earn this Badge in: <a class="text-name" data-contrast>An experience</a></p></div></div></div></div><div id="item-details"><span class="field-label" data-contrast>Type</span><span data-contrast>Badge</span><p class="description-content" data-contrast>No description available.</p></div></section></div>`,
  home: `<div id="HomeContainer"><section id="rc-home-greeting"><div class="rc-home-greeting-copy"><span data-contrast class="rc-home-greeting-eyebrow">WELCOME BACK</span><h2 data-contrast class="rc-home-greeting-title">Hello, Roblox player</h2><span data-contrast class="rc-home-greeting-username">@player</span></div></section><section id="rc-pinned-games"><div class="rc-pinned-games-grid"><article class="rc-pinned-game-card"><a data-contrast class="rc-pinned-game-details">Pinned adventure</a><button data-contrast data-primary class="rc-pinned-game-join">Join</button></article></div></section></div>`,
  games: `<div id="game-detail-page"><div class="game-main-content"><div id="game-details-carousel-container"><img class="native-art" alt="Game art" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180'%3E%3Crect width='320' height='180' fill='%23386b94'/%3E%3C/svg%3E"></div><div class="game-calls-to-action"><h1 data-contrast class="game-name">Adventure</h1><div class="rc-private-server-more"><button data-contrast>More servers</button></div></div></div><div class="fixture-panel"><form class="rc-public-server-filters"><label>Country<select data-contrast><option>All countries</option></select></label><label>Players<input data-contrast placeholder="Any" value="5"></label><button data-contrast data-primary class="rc-public-server-filter-search" type="button">Search</button><button data-contrast class="rc-public-server-filter-reset" type="button">Reset</button><div class="rc-server-metrics" data-rc-latency="low"><span data-contrast class="rc-server-latency">Low latency</span></div><div class="rc-server-metrics" data-rc-latency="medium"><span data-contrast class="rc-server-latency">Medium latency</span></div><div class="rc-server-metrics" data-rc-latency="high"><span data-contrast class="rc-server-latency">High latency</span></div></form></div><div class="fixture-panel" id="rc-rolimons-panel"><h2 data-contrast>Game statistics</h2><button data-contrast data-primary class="rc-rolimons-tab rc-rolimons-tab-active">Overview</button></div></div>`,
  profile: `<section id="rc-profile-details"><div class="rc-profile-details-header"><h2 data-contrast>Profile details</h2><button data-contrast class="rc-profile-copy-id">Copy ID</button></div><div class="rc-profile-facts"><div class="rc-profile-fact"><span data-contrast>Joined</span><strong data-contrast>January 2020</strong></div></div></section><section id="rc-profile-limiteds"><h2 data-contrast>Collectibles</h2><p data-contrast class="rc-limiteds-status">Updated just now</p></section>`,
  avatar: `<section data-rc-avatar-studio><div data-rc-avatar-view-column><span data-contrast>3D Preview</span></div></section><section id="rc-avatar-2d"><div class="rc-avatar-2d-heading"><h2 data-contrast>2D Preview</h2><button data-contrast class="rc-avatar-refresh">Refresh</button></div><p data-contrast class="rc-avatar-status">Preview is ready</p></section><nav data-rc-avatar-main-row><button data-contrast data-rc-avatar-main-control>Characters</button><button data-contrast data-primary data-rc-avatar-main-control class="active">Clothing</button></nav><nav data-rc-avatar-subcategories><button data-contrast data-rc-avatar-sub-control>Shirts</button></nav>`,
  catalog: `<section data-rc-item-studio><div id="rc-catalog-item-2d"><h2 data-contrast>Item preview</h2><button data-contrast class="rc-item-refresh">Refresh</button></div></section><section id="item-info-container-frontend"><div class="item-details-section"><div class="item-info-row-container"><div class="row-label">Description</div><div class="row-content"><p data-contrast class="description-content">A new accessory for your avatar.</p></div></div><div class="price-row-container"><span data-contrast class="text-robux-lg">150 Robux</span><div class="item-info-row-container"><span data-contrast class="row-label">Price</span></div></div></div></section><section id="asset-resale-data-container" data-rc-market-root><div data-rc-market-section="chart"><div class="fixture-panel"><span data-contrast class="legend-text">Average price</span></div></div></section>`,
  social: `<section id="rc-x-feed-panel"><h2 data-contrast>Social updates</h2><p data-contrast class="rc-x-feed-status">Latest posts</p><a data-contrast class="rc-x-feed-post">A new game update <time data-contrast>Today</time></a><footer class="rc-x-feed-footer"><a data-contrast href="#">View profile</a></footer></section>`,
  settings: `<div id="rc-settings-overlay"><section class="rc-settings-dialog"><div class="rc-settings-heading"><h2 data-contrast>Roblox Customizer</h2><button data-contrast class="rc-icon-button" aria-label="Close"><svg width="20" height="20" viewBox="0 0 20 20"><path fill="currentColor" d="M4 3L10 9L16 3L17 4L11 10L17 16L16 17L10 11L4 17L3 16L9 10L3 4Z"/></svg></button></div><p data-contrast class="rc-settings-intro">Personalize your Roblox experience.</p><fieldset class="rc-settings-field"><label for="background">Background URL</label><input id="background" data-contrast type="url" placeholder="https://example.com/background.png"><select data-contrast><option>Cover</option><option>Contain</option></select><input data-contrast type="file"></fieldset><div class="rc-settings-options"><label data-contrast for="rc-dim">Dark overlay 20%</label><input id="rc-dim" type="range" min="0" max="80" step="5" value="20"></div><div class="rc-settings-glass"><h3 data-contrast>Frosted menus and page panels</h3><label data-contrast for="rc-glass-blur">Frost blur 40px</label><input id="rc-glass-blur" type="range" min="0" max="40" step="1" value="40"><label data-contrast for="rc-glass-opacity">Glass opacity 46%</label><input id="rc-glass-opacity" type="range" min="25" max="90" step="1" value="46"></div><div class="rc-settings-currency"><h3 data-contrast>Currency estimates</h3><p data-contrast>Choose a currency to display alongside Robux.</p><input data-contrast type="search" placeholder="Search currencies"><output data-contrast>1,000 Robux ≈ MYR 45.00</output></div><div class="rc-hidden-recommended-game"><span data-contrast>Hidden recommendation</span><button data-contrast data-primary>Restore</button></div><p id="rc-settings-status" data-contrast>Saved successfully</p><div class="rc-settings-actions"><button data-contrast class="rc-button rc-button-secondary">Reset</button><button data-contrast data-primary class="rc-button rc-button-primary">Save</button><button disabled class="rc-button rc-button-secondary">Unavailable</button></div></section></div>`
};

samples.games += `<div id="game-detail-page"><section id="store"><div id="rbx-developer-products"><h2 data-contrast>Products</h2><ul class="store-cards"><li class="list-item developer-product-tile"><div class="store-card"><div class="store-product-card-caption"><div class="store-product-card-name" data-contrast>Sample product</div><div class="store-card-price"><span class="text-robux" data-contrast>125</span></div><div class="store-card-footer"><button class="PurchaseButton btn-buy-md" data-primary data-contrast>Buy</button></div></div></div></li></ul></div></section></div>`;

function fixture() {
  return `<!doctype html><html data-rc-ui-active data-rc-background-active><head><meta charset="utf-8"><style>
  /* Reproduce native white slider parts that disappear on a light panel. */
  input[type=range]{appearance:none;background:transparent}
  input[type=range]::-webkit-slider-runnable-track{height:8px;background:#fff;border:1px solid #fff}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;background:#fff;border:0;border-radius:50%}
  </style>${stylesheets.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}<style>
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

async function assertVisibleSliders(browser, theme) {
  const shot = await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  const pixels = await browser.evaluate(`(async()=>{
    const image=new Image();image.src='data:image/png;base64,${shot.data}';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);
    const pixel=(x,y)=>[...context.getImageData(Math.round(x),Math.round(y),1,1).data].slice(0,3);
    return [...document.querySelectorAll('#rc-settings-overlay input[type=range]')].map(n=>{
      const r=n.getBoundingClientRect(),y=r.top+r.height/2,x=r.left+r.width*.1;
      const fraction=(Number(n.value)-Number(n.min))/(Number(n.max)-Number(n.min));
      const thumbX=r.left+10+(r.width-20)*fraction;
      return {id:n.id,surface:pixel(x,y-12),track:Array.from({length:11},(_,i)=>pixel(x,y-5+i)),thumb:Array.from({length:23},(_,i)=>pixel(thumbX,y-11+i))};
    });
  })()`);
  const luminance = color => color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  assert.equal(pixels.length,3,'All three appearance sliders are rendered');
  for(const slider of pixels) {
    assert.ok(Math.max(...slider.track.map(p=>contrast(p,slider.surface)))>=3,`${theme}: ${slider.id} track is visible against the panel`);
    assert.ok(Math.max(...slider.thumb.map(p=>contrast(p,slider.surface)))>=3,`${theme}: ${slider.id} thumb has a visible boundary`);
  }
  await browser.click('#rc-dim');
  await browser.waitFor("document.querySelector('#rc-dim').value==='40'");
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});
  await browser.waitFor("document.querySelector('#rc-dim').value==='45'");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#rc-dim')).outlineStyle"),'solid','Keyboard focus stays visible');
}

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
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1200,height:1200,deviceScaleFactor:1,mobile:false});
  await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  await waitForDocument(browser,'#samples');
  const failures = [];
  // Opposite html/body themes exercise inheritance. Switching without a reload
  // catches computed custom properties that accidentally retain the root theme.
  for (const backgroundActive of [true, false]) {
    await browser.evaluate(`document.documentElement.toggleAttribute('data-rc-background-active',${backgroundActive})`);
    for (const theme of ['light','dark','light']) {
      await browser.evaluate(`document.documentElement.className='${theme==='light'?'dark':'light'}-theme';document.body.className='${theme}-theme'`);
      for (const wallpaper of theme==='light'?[[0,0,0],[255,255,255]]:[[15,18,25]]) {
        await browser.evaluate(`window.wallpaper=${JSON.stringify(wallpaper)};document.querySelector('#rc-background-layer').style.background='rgb(${wallpaper.join(' ')})'`);
        for (const [page,markup] of Object.entries(samples)) {
          await browser.evaluate(`document.documentElement.dataset.rcFrostPage=${JSON.stringify(page)};document.querySelector('#samples').innerHTML=${JSON.stringify(markup)}`);
          const rows = await browser.evaluate(contrastSnapshot);
          assert.ok(rows.length>=3,`${page}: fixture has readable elements`);
          for(const row of rows) {
            if(row.ratio<4.5)failures.push(`${theme} / background ${backgroundActive} / ${wallpaper} / ${page} / ${row.label}: contrast ${row.ratio.toFixed(2)}; ${row.color} on ${row.bg}`);
            if(row.primary)assert.equal(row.color,'rgb(255, 255, 255)',`${page}: blue actions retain white labels`);
          }
          if(page==='settings') {
            await browser.click('#background');
            const input=await browser.evaluate(`(()=>{const n=document.querySelector('#background');n.focus();const s=getComputedStyle(n);return {scheme:s.colorScheme,outline:s.outlineStyle,placeholder:getComputedStyle(n,'::placeholder').color,icon:getComputedStyle(document.querySelector('.rc-icon-button path')).fill,button:getComputedStyle(document.querySelector('.rc-icon-button')).color}})()`);
            assert.equal(input.scheme,theme);assert.equal(input.outline,'solid');assert.equal(input.icon,input.button);
            assert.notEqual(input.placeholder,theme==='light'?'rgb(255, 255, 255)':'rgb(0, 0, 0)');
            assert.equal(await browser.evaluate("document.querySelector('button[disabled]').disabled"),true);
            await assertVisibleSliders(browser, theme);
            if(process.env.THEME_SCREENSHOTS&&wallpaper[0]!==255) {
              const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
              fs.writeFileSync(path.join(workspace,`.tmp-theme-${theme}.png`),Buffer.from(shot.data,'base64'));
            }
          }
          if(page==='games')assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.native-art')).filter"),'none');
        }
      }
    }
  }
  // A theme supplied only by html also works, and settings survive a DOM remount.
  await browser.evaluate(`document.body.className='';document.documentElement.className='light-theme';document.querySelector('#samples').innerHTML=${JSON.stringify(samples.settings)}`);
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#background')).colorScheme"),'light');
  assert.deepEqual(failures,[],failures.join('\n'));
  assert.deepEqual(browser.errors,[]);
});
