const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const assets = ['src/shared/theme.css', 'src/shared/site-pages.css',
  'src/pages/games/item-details-page.css', 'src/shared/startup.js'];
const artwork = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'%3E%3Crect width='600' height='400' rx='30' fill='%235f77dd'/%3E%3Cpath d='M180 300V160l80 60 40-100 40 100 80-60v140z' fill='%23ffce44'/%3E%3C/svg%3E";

function fixture(badge) {
  const id = badge ? '2526706651131685' : '1903230850';
  const title = badge ? 'You played! An exceptionally long badge title for a narrow screen' : 'Admin Commands — a long game pass title that should wrap inside its panel';
  const type = badge ? 'Badge' : 'Game Pass';
  const description = 'Native description with multiple lines.\n' + 'UnbrokenDescription'.repeat(14);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${process.env.ITEM_DETAILS_NATIVE_CSS ? '<link rel="stylesheet" href="/native.css">' : ''}
  <style>
    *{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:#232527;color:#f7f7f8}body.light-theme{background:#f4f4f4;color:#202227}#content{max-width:1154px;margin:24px auto;padding:0 12px}h1,p{margin:0}h1{font-size:32px}a{color:inherit}button{font:inherit;cursor:pointer;border:1px solid #777;border-radius:6px;padding:8px 12px}.btn-primary-md{background:#335fff;color:white}.btn-primary-md:disabled{background:#555;color:#aaa;cursor:not-allowed}button:not(.btn-primary-md){background:transparent;color:inherit}.hidden,.hide,.ng-hide,[hidden]{display:none!important}.clearfix::before,.clearfix::after,.section-content::before,.section-content::after{content:'';display:table}.clearfix::after,.section-content::after{clear:both}.section-content{position:relative;padding:12px;background:#303236}.light-theme .section-content{background:white}.item-name-container{float:right;width:calc(100% - 467px);margin-bottom:12px;margin-right:35px;padding-bottom:12px;overflow-wrap:break-word}.item-name-container h1{text-overflow:ellipsis;overflow:hidden}.item-thumbnail-container{float:left}.thumbnail-holder{position:relative;width:420px;height:420px;background:#8883}.thumbnail-span{display:inline-block;width:100%;height:100%;text-align:center}.thumbnail-Small .thumbnail-span>img{width:150px;height:150px;margin-top:104px}.related-asset-container{position:absolute;bottom:0;left:0;right:0;background:#19191940}.asset-info{float:left;max-width:calc(100% - 68px);margin:12px 0 0 6px;text-align:left}.preview-text{font-size:12px}.asset-thumbnail{float:right;margin:6px}.asset-thumbnail img{width:50px;height:50px}.item-details{float:right;width:calc(100% - 420px);padding-left:12px}.item-field-container{margin-top:12px}.field-label{float:left;width:120px;font-weight:600;white-space:nowrap}.field-content{float:left;width:calc(100% - 120px)}.description-content{white-space:pre-line}.item-mobile-description{display:none}.price-container{margin-bottom:12px}.price-container-text{float:left;width:calc(100% - 190px)}.action-button{float:right;max-width:190px}.action-button button{width:100%}.text-robux-lg{font-size:28px;font-weight:700}.item-social-container{width:420px;padding:0;list-style:none}.item-social-container li{float:left;width:50%}#item-context-menu{position:absolute;top:12px;right:12px}.rbx-popover-content{display:none;position:absolute;right:0;z-index:10;background:#ddd;color:#111;border:1px solid #777;border-radius:8px;min-width:140px;padding:8px}.rbx-popover-content.open{display:block}.dropdown-menu{list-style:none;margin:0;padding:0}.dropdown-menu a{display:block;padding:8px}.purchase-modal{display:none}
    @media(max-width:970px){.thumbnail-holder{width:300px;height:300px}.thumbnail-Small .thumbnail-span>img{margin-top:44px}.item-name-container{width:calc(100% - 347px)}.item-details{width:calc(100% - 300px)}.item-social-container{width:300px}}
    @media(max-width:767px){.item-name-container{float:none;width:calc(100% - 35px);margin:0;border:0}.item-thumbnail-container{float:none}.thumbnail-holder{width:420px;height:420px}.thumbnail-Small .thumbnail-span>img{margin-top:135px}.related-asset-container{position:relative;background:none;color:inherit}.asset-info{width:100%;max-width:none;text-align:center;margin:10px 0 0}.asset-thumbnail{display:none}.item-details{float:left;width:100%;padding-left:0;margin:12px 0}.item-mobile-description{display:block;float:left;width:100%}.toggle-target{display:none}.price-container-text,.action-button{float:none;width:100%;max-width:100%}.action-button{margin-top:12px}.item-social-container{width:auto;margin-inline:-12px}}
    @media(max-width:543px){.thumbnail-holder{width:200px;height:200px}.thumbnail-Small .thumbnail-span>img{margin-top:25px}}
  </style>
  ${assets.filter(file => file.endsWith('.css')).map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
  <script>localStorage.setItem('roblox-customizer-visuals-v1',JSON.stringify({version:1,backgroundActive:false,glassBlur:24,glassOpacity:70}));</script><script src="/src/shared/startup.js"></script></head>
  <body class="dark-theme"><main><div id="content"><div id="item-container" class="page-content" data-item-id="${id}" data-item-type="${type}" data-is-purchase-enabled="${!badge}" data-product-id="700001" data-expected-price="150">
    <div class="system-feedback"><div class="alert-system-feedback hidden">Purchase Completed</div></div>
    <div class="section-content top-section">
      <div class="border-bottom item-name-container"><h1>${title}</h1><div><span class="text-label">By <a class="text-name" href="https://www.roblox.com/communities/35758109">${'LongCreatorName'.repeat(6)}</a></span></div></div>
      <div class="item-thumbnail-container"><div id="AssetThumbnail" class="asset-thumb-container thumbnail-holder thumbnail-Small three-dee-static" has-related-info>
        <span class="thumbnail-span"><img alt="${type} artwork" src="${artwork}"></span><span class="thumbnail-span-original hidden"><img alt="Hidden original" src="${artwork}"></span>
        <div class="related-asset-container"><div class="asset-info"><p class="preview-text">${badge ? 'Earn this Badge in:' : 'Use this Pass in:'} <a class="text-name text-overflow" href="https://www.roblox.com/games/122298649618543">${'RelatedExperienceName'.repeat(4)}</a></p></div><div class="asset-thumbnail"><a href="https://www.roblox.com/games/122298649618543"><img alt="Related experience" src="${artwork}"></a></div></div>
      </div></div>
      <div id="item-details" class="item-details">
        ${badge ? '' : '<div class="price-container clearfix"><div class="price-container-text"><span class="text-label">Price</span><span class="text-robux-lg price-info">150</span></div><div class="action-button"><button class="PurchaseButton btn-primary-md" data-product-id="700001">Buy</button></div></div><div id="off-sale" class="item-field-container hidden">This item is not currently for sale.</div><div id="owned" class="item-field-container hidden">Item Owned</div>'}
        <div class="clearfix item-mobile-description item-field-container"><p class="description-content">${description}</p></div>
        <div class="clearfix item-type-field-container"><div class="field-label text-label">Type</div><span id="type-content">${type}</span></div>
        <div class="clearfix item-field-container"><div class="field-label text-label">Updated</div><div class="field-content"><span>Jul. 21, 2026</span></div></div>
        ${badge ? '<div class="clearfix item-field-container" id="badge-stat"><div class="field-label text-label">Won Yesterday</div><span class="field-content">1,234</span></div>' : ''}
        <div class="clearfix toggle-target item-field-container"><div class="field-label text-label">Description</div><p id="item-details-description" class="field-content description-content">${description}</p><span class="field-content toggle-content" style="display:none">Read More</span></div>
        <button class="toggle-content" style="display:none">Read More</button>
      </div>
      <ul class="item-social-container clearfix"><li><button id="favorite" aria-pressed="false">Favorite</button></li><li><span id="favorite-count">123 favorites</span></li></ul>
      <div id="item-context-menu"><button class="item-context-menu" aria-expanded="false" aria-label="Item actions">···</button><div class="rbx-popover-content"><ul class="dropdown-menu"><li><a id="report-item" href="https://www.roblox.com/report-abuse/?targetId=${id}&abuseVector=${badge ? 'badge' : 'gamepass'}">Report Item</a></li></ul></div></div>
    </div><div class="purchase-modal">Native purchase dialog</div>
  </div></div></main><script>
    window.purchases=[];window.navigations=[];
    document.querySelector('.PurchaseButton')?.addEventListener('click',event=>window.purchases.push({product:event.currentTarget.dataset.productId,price:document.querySelector('#item-container').dataset.expectedPrice}));
    document.querySelectorAll('a').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();window.navigations.push(link.href)}));
    document.querySelector('.item-context-menu').onclick=event=>{const open=event.currentTarget.getAttribute('aria-expanded')!=='true';event.currentTarget.setAttribute('aria-expanded',open);document.querySelector('.rbx-popover-content').classList.toggle('open',open)};
    document.querySelector('#favorite').onclick=event=>event.currentTarget.setAttribute('aria-pressed',event.currentTarget.getAttribute('aria-pressed')!=='true');
  </script></body></html>`;
}

for (const badge of [false, true]) test(`${badge ? 'Badge' : 'Game pass'} details fit their panels and preserve native controls without a wallpaper`, { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    if (assets.includes(file)) {
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.end(fs.readFileSync(path.join(workspace, file)));
    } else if (file === 'native.css' && process.env.ITEM_DETAILS_NATIVE_CSS) {
      response.setHeader('Content-Type', 'text/css');
      response.end(fs.readFileSync(process.env.ITEM_DETAILS_NATIVE_CSS));
    } else {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(fixture(badge));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await isolatedChrome(t, 'item-details');
  await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/${badge ? 'badges/2526706651131685/You-played' : 'game-pass/1903230850/Admin-Commands'}` });
  await waitForDocument(browser, '#item-details');
  assert.equal(await browser.evaluate('document.documentElement.dataset.rcFrostPage'), badge ? 'badge' : 'game-pass');
  assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-background-active')"), false);
  const snapshot = `JSON.stringify({data:{...document.querySelector('#item-container').dataset},text:document.querySelector('#item-container').textContent,links:[...document.querySelectorAll('#item-container a')].map(n=>n.href)})`;
  const original = await browser.evaluate(snapshot);
  for (const background of [false, true]) {
    await browser.evaluate(`RobloxCustomizerStartup.setPreferences({source:'${background ? 'url' : 'none'}',url:'fixture',glassBlur:24,glassOpacity:70})`);
    for (const theme of ['light', 'dark', 'light']) {
      await browser.evaluate(`document.body.className='${theme}-theme'`);
      for (const width of [1360, 970, 768, 767, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 950, deviceScaleFactor: 1, mobile: width < 600 });
        await pause(20);
        const layout = await browser.evaluate(`(()=>{
          const section=document.querySelector('.top-section'),panel=section.getBoundingClientRect(),image=document.querySelector('.thumbnail-span>img').getBoundingClientRect(),art=document.querySelector('.thumbnail-span').getBoundingClientRect(),heading=document.querySelector('.item-name-container').getBoundingClientRect(),related=document.querySelector('.related-asset-container').getBoundingClientRect(),details=document.querySelector('#item-details').getBoundingClientRect();
          const nodes=[...section.querySelectorAll('h1,.item-name-container,.item-thumbnail-container,.thumbnail-span,.thumbnail-span>img,.asset-info,.asset-thumbnail,#item-details,.field-content,.field-label,.description-content,.price-container,.price-container-text,.action-button,button')].filter(n=>n.getBoundingClientRect().width>0);
          return {overflow:document.documentElement.scrollWidth>innerWidth,display:getComputedStyle(section).display,blur:getComputedStyle(section).backdropFilter,color:getComputedStyle(section).color,bounds:nodes.map(n=>{const r=n.getBoundingClientRect();return {name:n.className||n.id,within:r.left>=panel.left&&r.right<=panel.right+.5,overflow:n.scrollWidth>n.clientWidth+1}}),imageFits:image.left>=art.left&&image.right<=art.right&&image.top>=art.top&&image.bottom<=art.bottom+.5,relatedBelow:related.top>=art.bottom-.5,headingAbove:heading.bottom<=art.top,sideBySide:details.left>=art.right,mobileDescription:getComputedStyle(document.querySelector('.item-mobile-description')).display,desktopDescription:getComputedStyle(document.querySelector('.toggle-target')).display,objectFit:getComputedStyle(document.querySelector('.thumbnail-span>img')).objectFit};
        })()`);
        const label = `${badge ? 'badge' : 'pass'} ${theme} ${width} background ${background}`;
        assert.equal(layout.overflow, false, label);
        assert.equal(layout.display, 'grid', label);
        assert.match(layout.blur, /blur\(24px\)/, label);
        assert.equal(layout.color, theme === 'light' ? 'rgb(27, 35, 48)' : 'rgb(244, 246, 251)', label);
        assert.equal(layout.imageFits, true, `${label}: artwork fits`);
        assert.equal(layout.objectFit, 'contain', `${label}: artwork retains its proportions`);
        assert.equal(layout.relatedBelow, true, `${label}: experience link does not overlap artwork`);
        assert.equal(width < 768 ? layout.headingAbove : layout.sideBySide, true, `${label}: responsive layout`);
        assert.equal(layout.mobileDescription === 'none', width >= 768, `${label}: native mobile visibility`);
        assert.equal(layout.desktopDescription === 'none', width < 768, `${label}: native description visibility`);
        for (const node of layout.bounds) {
          assert.equal(node.within, true, `${label}: ${node.name} within panel`);
          assert.equal(node.overflow, false, `${label}: ${node.name} has no internal overflow`);
        }
        assert.equal(await browser.evaluate(snapshot), original, `${label}: native metadata, descriptions, and links unchanged`);
        assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.thumbnail-span-original')).display"), 'none');
        assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.purchase-modal')).display"), 'none');
      }
    }
  }
  await browser.click('#favorite');
  assert.equal(await browser.evaluate("document.querySelector('#favorite').getAttribute('aria-pressed')"), 'true');
  await browser.click('.item-context-menu');
  assert.equal(await browser.evaluate("document.querySelector('.item-context-menu').getAttribute('aria-expanded')"), 'true');
  assert.equal(await browser.evaluate("(()=>{const menu=document.querySelector('.rbx-popover-content'),r=menu.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.rbx-popover-content')===menu})()"), true, 'Item menu is reachable and not clipped');
  await browser.click('#report-item');
  await browser.click('.related-asset-container .asset-thumbnail img');
  assert.deepEqual(await browser.evaluate('window.navigations'), [
    `https://www.roblox.com/report-abuse/?targetId=${badge ? '2526706651131685' : '1903230850'}&abuseVector=${badge ? 'badge' : 'gamepass'}`,
    'https://www.roblox.com/games/122298649618543'
  ]);
  await browser.click('.item-context-menu');
  if (!badge) {
    await browser.click('.PurchaseButton');
    assert.deepEqual(await browser.evaluate('window.purchases'), [{ product: '700001', price: '150' }]);
    await browser.evaluate("document.querySelector('.PurchaseButton').disabled=true");
    await browser.click('.PurchaseButton');
    assert.equal(await browser.evaluate('window.purchases.length'), 1, 'Disabled purchase cannot activate');
    for (const state of ['owned', 'off-sale']) {
      await browser.evaluate(`document.querySelector('.price-container').classList.add('hidden');document.querySelector('#${state}').classList.remove('hidden');document.querySelector('#item-container').dataset.isPurchaseEnabled='false'`);
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.price-container')).display"), 'none');
      assert.equal(await browser.evaluate(`document.querySelector('#${state}').getBoundingClientRect().height>0`), true);
      await browser.evaluate(`document.querySelector('#${state}').classList.add('hidden')`);
    }
    await browser.evaluate("document.querySelector('.price-container').classList.remove('hidden');document.querySelector('.price-container').style.display='none'");
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.price-container')).display"), 'none', 'Inline native visibility also wins');
    await browser.evaluate("document.querySelector('.price-container').style.display='';document.querySelector('.PurchaseButton').disabled=false");
  }
  await browser.evaluate("document.querySelector('.item-thumbnail-container').outerHTML=document.querySelector('.item-thumbnail-container').outerHTML;RobloxCustomizerStartup.setPreferences({source:'none',glassBlur:32,glassOpacity:85})");
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('.top-section')).backdropFilter"), /blur\(32px\)/);
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.thumbnail-span')).display"), 'grid', 'Late thumbnail mounts remain styled');
  await browser.evaluate("history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.top-section')).display"), 'block', 'Detail layout is confined to its routes');
  assert.deepEqual(browser.errors, []);
  if (process.env.ITEM_DETAILS_SCREENSHOT) {
    await browser.evaluate(`history.pushState({},'', '/${badge ? 'badges/2526706651131685/You-played' : 'game-pass/1903230850/Admin-Commands'}');dispatchEvent(new PopStateEvent('popstate'));document.body.className='dark-theme'`);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 950, deviceScaleFactor: 1, mobile: false });
    const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(workspace, `.tmp-${badge ? 'badge' : 'pass'}-fixture.png`), Buffer.from(shot.data, 'base64'));
  }
});
