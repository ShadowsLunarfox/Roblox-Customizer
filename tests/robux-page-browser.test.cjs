const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');

function fixture(personalized = false) {
  const prices = ['949.90', '479.90', '239.90', '149.90', '94.90', '69.90', '44.90', '23.90', '13.90'];
  const amounts = ['24,000', '11,000', '5,250', '3,625', '2,000', '1,500', '1,000', '500', '270'];
  const packages = prices.map((price, i) => `<div data-product-id="${3000+i}" class="self-stretch flex flex-row justify-between items-center gap-small"><div class="flex flex-col num-badges-1 justify-start gap-small wrap"><div class="flex gap-small items-center"><div data-testid="robux-amount-column" class="flex flex-row items-center gap-small wrap"><span class="text-heading-large">${amounts[i]}</span><span class="content-muted strike-through">${i===0?'22,500':'240'}</span></div></div><div data-testid="bonus-pill" class="hidden large:block"><span class="foundation-web-badge">+ 30 more</span></div></div><button id="buy-${i}" type="button" class="foundation-web-button bg-action-standard content-action-standard min-width-[200px] shrink-0" ${i===8?'disabled':''}><span class="text-no-wrap robux-price-tag">MYR ${price}</span></button></div>`).join('');
  const banner = `<div id="personalized-banner" class="dark-theme self-stretch flex flex-row items-center" style="background:#16171c;padding:16px;gap:12px;border-radius:16px 16px 0 0"><img class="bonus-art" alt="Hang Glider" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='50'%3E%3Crect width='100' height='50' fill='gold'/%3E%3C/svg%3E"><div>Work at a Pizza Place<br>Hang Glider</div></div>`;
  const tiers = [0, 1, 2, 3].map(i => `<div class="carousel-item shrink-0 flex flex-col"><div data-testid="subscription-tile-${9000+i}" data-subscription-product-id="${9000+i}" class="radius-large padding-medium flex flex-col height-full bg-surface-100"><h3>${i?'Plus '+i*500:'Roblox Plus'}</h3><ul><li>Free private servers</li><li>Robux every month</li></ul><a id="subscribe-${i}" class="foundation-web-button width-full ${i?'bg-action-standard':'bg-action-emphasis'}" aria-disabled="false" href="https://www.roblox.com/upgrades/paymentmethods?ctx=subscription&type=RobloxPlus&id=${9000+i}">$${i?'8.99':'4.99'}/month</a></div></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${process.env.ROBUX_NATIVE_CSS?'<link rel="stylesheet" href="/native.css">':''}
  <style>
    *{box-sizing:border-box}body{margin:0;font:16px/1.4 Arial;background:#24262b;color:#f7f7f8}body.light-theme{background:#f4f4f4;color:#202227}#content{width:100%;max-width:1200px;margin:20px auto}.flex{display:flex}.flex-col{flex-direction:column}.flex-row{flex-direction:row}.items-center{align-items:center}.items-start{align-items:flex-start}.self-stretch{align-self:stretch}.justify-between{justify-content:space-between}.shrink-0{flex-shrink:0}.gap-small{gap:8px}.gap-medium{gap:12px}.width-full{width:100%}.height-full{height:100%}.text-no-wrap{white-space:nowrap}.hidden,[hidden]{display:none}.strike-through{text-decoration:line-through}.content-muted{opacity:.7}.text-heading-large{font-size:28px;font-weight:700}h1,h3,p{margin:0}a{color:inherit}button{font:inherit;cursor:pointer}.foundation-web-button{display:flex;align-items:center;justify-content:center;min-height:40px;padding:8px 12px;border:0;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;background:#484a50;color:inherit}.foundation-web-button:disabled{opacity:.4;cursor:not-allowed}.bg-action-emphasis{background:#335fff;color:#fff}.bg-surface-100{background:#303238}.radius-large{border-radius:16px}.padding-medium{padding:12px}.stroke-standard{border:1px solid #888}.buy-robux-content{display:flex;flex-direction:column;max-width:792px;width:100%;padding:40px 24px;gap:40px}.buy-robux-section-header{font-size:28px;font-weight:700}.text-section-title{font-size:56px}.robux-section{padding:24px;gap:24px}.carousel-root{position:relative;overflow:hidden;width:100%}.carousel-track{display:flex;gap:12px;width:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none}.carousel-item{width:242px;scroll-snap-align:start}.carousel-item ul{padding-left:20px;flex:1}.carousel-next{position:absolute;right:0;top:50%;border-radius:50%;width:40px;height:40px}.foundation-web-badge{font-size:12px;background:#484a50;border-radius:999px;padding:4px 8px}body.light-theme .bg-surface-100{background:#ededed}.legal-disclosure-container{font-size:14px}.bonus-art{width:100px;height:50px;object-fit:contain}@media(min-width:1024px){[data-testid=bonus-pill].hidden{display:block}}@media(max-width:600px){.carousel-item{width:313px}}
  </style>
  <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/settings/settings.css"><link rel="stylesheet" href="/src/shared/site-pages.css"><link rel="stylesheet" href="/src/pages/robux/robux-page.css">
  <script>localStorage.setItem('roblox-customizer-visuals-v1',JSON.stringify({version:1,backgroundActive:false,glassBlur:24,glassOpacity:70}));</script><script src="/src/shared/startup.js"></script></head>
  <body class="dark-theme"><main id="container-main"><div id="content"><div id="robux-redesign-page"><div class="flex flex-col items-center"><div class="buy-robux-background"></div><div data-section-type="PAYMENTS_PRODUCT_SECTION_TYPE_TRANSFERS"><div><button id="send" class="foundation-web-button">Send</button></div></div><div class="buy-robux-content">
  <div><h1 class="text-section-title" style="margin-inline:120px">Enjoy up to 25% more Robux</h1><p class="text-section-subtitle">Computer, web and gift cards</p></div>
  <div data-slot="card" data-section-type="PAYMENTS_PRODUCT_SECTION_TYPE_SUBSCRIPTION_V2" class="self-stretch"><div class="buy-robux-section-header"><div class="flex justify-between"><span>New on Roblox</span><a href="/plus">Learn more</a></div></div><div class="carousel-root" data-testid="carousel-root"><div class="carousel-track" data-testid="carousel-track">${tiers}</div><button class="carousel-next foundation-web-icon-button" id="next" aria-label="Next tier">›</button></div></div>
  <div data-slot="card" data-section-type="${personalized?'PAYMENTS_PRODUCT_SECTION_TYPE_PERSONALIZED_BONUS':'PAYMENTS_PRODUCT_SECTION_TYPE_PRODUCTS_LIST'}" class="self-stretch"><div><div class="buy-robux-section-header">${personalized?'Bonus item we picked for you':'Robux packages'}</div></div>${personalized?`<div class="radius-large bg-surface-100 self-stretch flex flex-col items-start">${banner}`:''}<div class="robux-section radius-large stroke-standard flex flex-col items-start self-stretch">${packages}<div data-product-id="hidden" hidden><button>Hidden package</button></div><div data-product-id="collapsed" class="hidden"><button>Collapsed package</button></div><button id="show-more" class="foundation-web-button self-stretch">Show more</button></div>${personalized?'</div>':''}</div>
  <div data-slot="card" class="self-stretch"><div class="buy-robux-section-header">FAQ</div><div><div class="stroke-standard"><div id="faq" role="button" tabindex="0" aria-expanded="false" aria-controls="faq-panel-example">Where are my Robux?</div><div id="faq-panel-example" hidden role="region">Example help text. <a href="/transactions">Transactions</a></div></div></div></div>
  <div class="robux-section self-stretch" id="bonus-offer"><img class="bonus-art" alt="Native bonus item" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='50'%3E%3Crect width='100' height='50' fill='gold'/%3E%3C/svg%3E"><div class="legal-disclosure-container">Example billing disclosure: monthly subscription renews until canceled. <a href="/info/terms">Terms</a></div></div>
  </div></div></div></div></main><script>
    window.purchases=[];window.subscriptions=[];window.transfers=0;
    document.querySelectorAll('[data-product-id] button').forEach(button=>button.onclick=()=>window.purchases.push({id:button.parentElement.dataset.productId,price:button.textContent}));
    document.querySelectorAll('[data-subscription-product-id] a').forEach(link=>link.onclick=e=>{e.preventDefault();window.subscriptions.push(link.href)});
    document.querySelector('#send').onclick=()=>window.transfers++;
    document.querySelector('#next').onclick=()=>document.querySelector('[data-testid=carousel-track]').scrollBy({left:250});
    const faq=document.querySelector('#faq'),toggle=()=>{const open=faq.getAttribute('aria-expanded')!=='true';faq.setAttribute('aria-expanded',open);document.querySelector('#faq-panel-example').hidden=!open};faq.onclick=toggle;faq.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}};
  </script></body></html>`;
}

for (const personalized of [false, true]) test(`Robux ${personalized?'bonus-item':'regular'} layout preserves visible package details, billing terms, controls, and hidden states across themes and widths`, {skip:!process.env.CHROME_BIN,timeout:30000}, async t => {
  const files=['src/shared/theme.css','src/settings/settings.css','src/shared/site-pages.css','src/pages/robux/robux-page.css','src/shared/startup.js'];
  const server=http.createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');
    const file=new URL(request.url,'http://localhost').pathname.slice(1);
    if(files.includes(file)){response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)))}
    else if(file==='native.css'&&process.env.ROBUX_NATIVE_CSS){response.setHeader('Content-Type','text/css');response.end(fs.readFileSync(process.env.ROBUX_NATIVE_CSS))}
    else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixture(personalized))}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await isolatedChrome(t,'robux');
  await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/upgrades/robux?ctx=navpopover`});
  await waitForDocument(browser, '#buy-0');
  await browser.waitFor("document.documentElement.dataset.rcFrostPage==='robux' && document.documentElement.hasAttribute('data-rc-ui-active') && !document.documentElement.hasAttribute('data-rc-background-active')");
  const snapshot="JSON.stringify([...document.querySelectorAll('[data-product-id],[data-subscription-product-id],.legal-disclosure-container')].map(n=>({id:n.dataset.productId||n.dataset.subscriptionProductId,text:n.textContent,links:[...n.querySelectorAll('a')].map(a=>a.getAttribute('href'))})))";
  const original=await browser.evaluate(snapshot);
  for(const theme of ['dark','light']){
    await browser.evaluate(`document.body.className='${theme}-theme'`);
    for(const width of [1360,768,390,320]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});await pause(30);
      const layout=await browser.evaluate(`(()=>{const grid=document.querySelector('.robux-section:has(> [data-product-id])'),s=getComputedStyle(grid);return {overflow:document.documentElement.scrollWidth>innerWidth,columns:s.gridTemplateColumns.split(' ').length,gridBlur:s.backdropFilter,gridBorder:s.borderWidth,gridBackground:s.backgroundColor,rows:[...grid.querySelectorAll('[data-product-id]:not([hidden]):not(.hidden)')].map(n=>{const r=n.getBoundingClientRect(),b=n.querySelector('button').getBoundingClientRect(),a=n.querySelector('[data-testid=robux-amount-column]').getBoundingClientRect();return {left:r.left,right:r.right,buttonWithin:b.left>=r.left&&b.right<=r.right,amountVisible:a.width>0&&a.height>0&&a.left>=r.left&&a.right<=r.right&&a.bottom<=b.top,blur:getComputedStyle(n).backdropFilter}})}})()`);
      for(const row of layout.rows) assert.ok(row.amountVisible,`${theme} ${width}: Robux amounts fit above their price buttons`);
      assert.equal(layout.overflow,false,`${theme} ${width}: no viewport overflow`);
      assert.equal(layout.columns,width<680?1:2);assert.equal(layout.gridBlur,'none');assert.equal(layout.gridBorder,'0px');assert.equal(layout.gridBackground,'rgba(0, 0, 0, 0)');
      for(const row of layout.rows){assert.ok(row.left>=0&&row.right<=width&&row.buttonWithin);assert.match(row.blur,/blur\(24px\)/)}
      assert.equal(await browser.evaluate("(()=>{const pill=document.querySelector('[data-testid=bonus-pill]'),p=pill.getBoundingClientRect(),r=pill.closest('[data-product-id]').getBoundingClientRect();return p.width>0&&p.height>0&&p.left>=r.left&&p.right<=r.right})()"),width>=1024,'Native bonus badges remain visible at their intended breakpoint');
      assert.equal(await browser.evaluate(snapshot),original,'Product IDs, prices, recurring terms, and checkout URLs remain unchanged');
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[data-product-id=hidden]')).display"),'none');
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[data-product-id=collapsed]')).display"),'none');
      assert.equal(await browser.evaluate("(()=>{const button=document.querySelector('#show-more'),grid=button.parentElement,b=button.getBoundingClientRect(),g=grid.getBoundingClientRect();return b.width>0&&b.left>=g.left&&b.right<=g.right})()"),true,'Native Show more stays reachable');
      if(personalized) assert.equal(await browser.evaluate("(()=>{const banner=document.querySelector('#personalized-banner'),r=banner.getBoundingClientRect();return r.width>0&&r.height>0&&banner.innerText.includes('Hang Glider')})()"),true,'Personalized item banner stays visible');
      assert.equal(await browser.evaluate("document.querySelector('#buy-8').disabled"),true);
      assert.notEqual(await browser.evaluate("getComputedStyle(document.querySelector('#buy-8')).backgroundColor"),'rgb(51, 95, 255)','Unavailable purchases keep the native disabled appearance');
      assert.equal(await browser.evaluate("(()=>{const r=document.querySelector('.bonus-art').getBoundingClientRect();return r.width/r.height})()"),2,'Native bonus art keeps its aspect ratio');
    }
  }
  await browser.click('#buy-0');assert.deepEqual(await browser.evaluate('window.purchases'),[{id:'3000',price:'MYR 949.90'}]);
  await browser.click('#buy-8');assert.equal(await browser.evaluate('window.purchases.length'),1,'Disabled packages cannot activate');
  await browser.click('#subscribe-0');assert.deepEqual(await browser.evaluate('window.subscriptions'),['https://www.roblox.com/upgrades/paymentmethods?ctx=subscription&type=RobloxPlus&id=9000']);
  await browser.click('#send');assert.equal(await browser.evaluate('window.transfers'),1,'Native transfer control is still reachable');
  await browser.click('#next');await browser.waitFor("document.querySelector('[data-testid=carousel-track]').scrollLeft>0");
  await browser.evaluate("document.querySelector('#faq').focus()");
  await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await browser.waitFor("!document.querySelector('#faq-panel-example').hidden");
  assert.equal(await browser.evaluate("document.querySelector('#faq').getAttribute('aria-expanded')"),'true');
  await browser.click('#faq');assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#faq-panel-example')).display"),'none');
  await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture',glassBlur:32,glassOpacity:85});const row=document.querySelector('[data-product-id=\"3001\"]');row.outerHTML=row.outerHTML");
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('[data-product-id=\"3001\"]')).backdropFilter"),/blur\(32px\)/,'Native remounts and changed appearance settings remain styled');
  await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none',glassBlur:32,glassOpacity:85})");
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('[data-product-id=\"3001\"]')).backdropFilter"),/blur\(32px\)/,'Removing the wallpaper keeps package layout and glass settings');
  await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture'});history.pushState({},'', '/upgrades/paymentmethods?ctx=subscription');dispatchEvent(new PopStateEvent('popstate'))");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[data-product-id=\"3001\"]')).backdropFilter"),'none','The overview redesign does not carry into checkout');
  assert.deepEqual(browser.errors,[]);
});
