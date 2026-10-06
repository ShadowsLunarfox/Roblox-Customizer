// Local native-class fixtures cover legacy and server-driven Charts layouts.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {test}=require('node:test');
const {isolatedChrome,pause}=require('./helpers/chrome.cjs');
const workspace=path.resolve(__dirname,'..');

function fixture(layout) {
  const names=['A long game title with room for two readable lines','Island Adventure','Racing Club','Forest Escape','City Builder','Another Adventure'];
  const image='<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#507c9f"/><circle cx="45" cy="40" r="24" fill="#f0c461"/><path d="M0 150L50 65L85 100L120 45L150 150Z" fill="#356c58"/></svg>';
  const img=`<img src="data:image/svg+xml,${encodeURIComponent(image)}" alt="">`;
  const cards=names.map((name,i)=>layout==='legacy'
    ? `<li class="list-item game-card game-tile"><div class="game-card-container" data-testid="game-tile"><a class="game-card-link" href="/games/${100+i}/Game?country=my&device=computer"><div class="game-card-thumb-container"><span class="thumbnail-2d-container game-card-thumb">${img}</span></div><div class="game-card-name game-name-title">${name}</div><div class="game-card-info" data-testid="game-tile-stats"><span class="info-label">95%</span> <span class="info-label">123.6K</span></div></a></div></li>`
    : `<a data-testid="sdui-game-tile" class="sdui-game-tile-wrapper" href="/games/${100+i}/Game?country=my&device=computer"><div data-testid="sdui-tile-main-content"><div data-testid="sdui-tile-image-container" class="sdui-tile-image-container" style="aspect-ratio:16/9">${img}<div data-testid="sdui-tile-overlay-container" class="sdui-tile-overlay-container"><span class="foundation-web-badge bg-over-media-0">${i+1}</span></div></div><div data-sdui-text="true">${name}</div></div><div data-testid="sdui-tile-footer-content">95% · 123.6K</div></a>`).join('');
  const filters='<div class="filters-container"><div class="filter-items-container"><div><button id="device" class="filter-select btn-primary-md" aria-expanded="false">Computer</button></div><div><button id="country" class="filter-select btn-primary-md" aria-expanded="false">Malaysia</button></div></div></div>';
  const legacy=`<div class="games-page-container"><div class="section"><div class="games-list-header"><h1>Charts</h1></div>${filters}<div class="games-list-container"><div class="game-sort-header-container"><div class="container-header games-filter-changer"><h2 class="sort-header">Top Trending</h2><a class="see-all-link-icon" href="/charts/top-trending?device=computer&country=my">See All</a></div></div><div class="horizontal-scroller games-list"><div class="horizontal-scroll-window"><div class="horizontally-scrollable" style="left:0px"><ul class="hlist games game-cards games-page-carousel">${cards}</ul></div><button id="next" class="scroller">›</button></div></div></div><div class="game-card-container invisible" data-testid="sentinel-tile"></div></div></div>`;
  const sdui=`<div class="charts-sdui-page"><h1>Charts</h1>${filters}<div class="sdui-grid">${cards}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${process.env.CHARTS_NATIVE_CSS?'<link rel="stylesheet" href="/native.css">':''}
  <style>body{--color-extended-white-90:rgba(255,255,255,.9);--light-mode-content-emphasis:#202227;margin:0;background:#24262b;color:#f4f4f5;font:16px/1.4 Arial}body.light-theme{color:#202227;background:#f4f4f4}#content{margin:24px auto;width:calc(100% - 24px);max-width:1200px}h1{margin:0;font-size:32px}a{color:inherit;text-decoration:none}button{color:inherit;font:inherit;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.4}.filters-container{display:flex;flex-direction:column;margin:0 10px 20px}.filter-items-container{display:flex;gap:4px}.filter-select{background:#555;border:0;border-radius:999px;height:32px;padding:0 12px}.filters-modal-container{position:absolute;z-index:6;min-width:300px;max-width:360px;background:#25272b;padding:24px 0}.header-container,.action-buttons-container{padding:0 24px}.header-container{display:flex;justify-content:space-between}.header-container h3{margin:0}.filter-options-container{display:flex;flex-direction:column}.filter-option{padding:12px 24px;background:inherit;color:inherit;border:0;text-align:left}.selected-option{font-weight:bold}.apply-button{padding:10px 20px}.container-header{display:flex;justify-content:space-between;align-items:center}.horizontal-scroll-window{position:relative;overflow:hidden}.horizontally-scrollable{position:relative;height:270px}.game-cards{margin:0;padding:0;white-space:nowrap;list-style:none}.game-card{display:inline-block;vertical-align:top;padding:0 7px;width:164px;box-sizing:border-box}.game-card-container{width:100%;height:240px}.game-card-link{display:flex;flex-direction:column;justify-content:space-between;height:100%}.game-card-thumb-container{width:150px;height:150px}.game-card-thumb{display:block;width:150px;height:150px}.game-card-thumb img{display:block;width:100%;height:100%}.game-card-name{white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:14px}.game-card-info{font-size:12px;white-space:normal}.scroller{position:absolute;right:0;top:70px;width:28px;height:110px;border:0}.sdui-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}.sdui-game-tile-wrapper{display:flex;flex-direction:column;gap:12px;height:100%}.sdui-tile-image-container{position:relative;overflow:hidden}.sdui-tile-image-container img{width:100%;height:100%;object-fit:cover}.sdui-tile-overlay-container{position:absolute;top:8px;left:8px}.foundation-web-badge{background:#fff;color:#202227;padding:4px 8px;border-radius:6px}.sdui-game-tile-wrapper [data-sdui-text]{margin-top:8px;font-size:14px}.sdui-game-tile-wrapper [data-testid=sdui-tile-footer-content]{font-size:12px}.invisible{visibility:hidden}@media(max-width:543px){.game-card{width:104px}.game-card-container{height:150px}.game-card-thumb-container,.game-card-thumb{width:90px;height:90px}.horizontally-scrollable{height:162px}.game-card-name{-webkit-line-clamp:1}.filters-modal-container{left:10px;right:10px;min-width:0;max-width:calc(100vw - 20px)}}</style>
  <link rel="stylesheet" href="/settings.css"><link rel="stylesheet" href="/site-pages.css"><link rel="stylesheet" href="/charts-page.css">
  <script>localStorage.setItem('roblox-customizer-visuals-v1',JSON.stringify({version:1,backgroundActive:true,glassBlur:24,glassOpacity:70}));</script><script src="/startup.js"></script>
  </head><body class="dark-theme"><main id="container-main"><div id="content"><div id="game-carousel-web-app">${layout==='legacy'?legacy:sdui}</div><div hidden id="native-hidden">Hidden native content</div></div></main><script>
    window.activations=0;document.querySelectorAll('a').forEach(n=>n.onclick=e=>{e.preventDefault();window.activations++});
    const close=()=>{document.querySelector('.filters-modal-container')?.remove();document.querySelectorAll('.filter-select').forEach(n=>n.setAttribute('aria-expanded','false'))};
    document.querySelectorAll('.filter-select').forEach(button=>button.onclick=()=>{if(button.getAttribute('aria-expanded')==='true'){close();return}close();button.setAttribute('aria-expanded','true');const menu=document.createElement('div');menu.className='filters-modal-container';menu.setAttribute('role','dialog');menu.innerHTML='<div class="header-container"><h3>Country</h3><button class="header-close-button" aria-label="Close">×</button></div><div class="filter-options-container"><button class="filter-option selected-option" data-value="my">Malaysia</button><button id="worldwide" class="filter-option" data-value="all">Worldwide</button></div><div class="action-buttons-container"><button id="apply" class="apply-button" disabled>Apply</button></div>';button.parentElement.append(menu);menu.querySelector('.header-close-button').onclick=close;menu.querySelectorAll('.filter-option').forEach(option=>option.onclick=()=>{menu.querySelectorAll('.filter-option').forEach(n=>n.classList.remove('selected-option'));option.classList.add('selected-option');menu.querySelector('#apply').disabled=false});menu.querySelector('#apply').onclick=()=>{const selected=menu.querySelector('.selected-option');document.querySelector('#country').textContent=selected.textContent;const url=new URL(location.href);url.searchParams.set('country',selected.dataset.value);history.replaceState({},'',url);close()}});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
    if(document.querySelector('#next'))document.querySelector('#next').onclick=()=>{const row=document.querySelector('.horizontally-scrollable');row.style.left=-2*document.querySelector('.game-card').getBoundingClientRect().width+'px'};
  </script></body></html>`;
}

test('Charts preserves carousel controls, native filters, and tile media across themes, widths, and remounts', {skip:!process.env.CHROME_BIN,timeout:30000}, async t=>{
  const server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://localhost'),file=url.pathname.slice(1);
    if(['settings.css','site-pages.css','charts-page.css','startup.js'].includes(file)){response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)))}
    else if(file==='native.css'&&process.env.CHARTS_NATIVE_CSS){response.setHeader('Content-Type','text/css');response.end(fs.readFileSync(process.env.CHARTS_NATIVE_CSS))}
    else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixture(url.searchParams.get('layout')||'legacy'))}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await isolatedChrome(t,'charts');
  for(const layout of ['legacy','sdui']){
    await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/charts?layout=${layout}&device=computer&country=my`});
    await browser.waitFor("!!document.querySelector('#country') && document.documentElement.dataset.rcFrostPage==='charts'");
    const selector=layout==='legacy'?'.game-card-container[data-testid="game-tile"]':'[data-testid="sdui-game-tile"]';
    const imageSelector=layout==='legacy'?'.game-card-thumb-container':'[data-testid="sdui-tile-image-container"]';
    for(const theme of ['dark','light']){
      await browser.evaluate(`document.body.className='${theme}-theme'`);
      for(const width of [1360,768,390,320]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width<600});await pause(30);
        const tiles=await browser.evaluate(`(()=>{return [...document.querySelectorAll(${JSON.stringify(selector)})].map(node=>{const image=node.querySelector(${JSON.stringify(imageSelector)}),rect=node.getBoundingClientRect(),media=image.getBoundingClientRect(),style=getComputedStyle(node);return {width:rect.width,bottom:rect.bottom,imageWidth:media.width,imageHeight:media.height,imageBottom:media.bottom,blur:style.backdropFilter,radius:style.borderRadius}})})()`);
        assert.equal(tiles.length,6);
        for(const tile of tiles){assert.match(tile.blur,/blur\(24px\)/);assert.equal(tile.radius,'14px');assert.ok(tile.width>=140);assert.ok(Math.abs(tile.imageWidth/tile.imageHeight-(layout==='legacy'?1:16/9))<.01);assert.ok(tile.imageBottom<=tile.bottom)}
        assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,`${layout} ${theme} ${width}: viewport fits`);
        if(layout==='legacy'){
          assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.game-card')).backdropFilter"),'none','Only the inner card has blur');
          assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.game-card-name')).webkitLineClamp"),'2');
          assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[data-testid=sentinel-tile]')).backdropFilter"),'none','Loading sentinel stays native');
        }else assert.match(await browser.evaluate("getComputedStyle(document.querySelector('.foundation-web-badge')).backgroundColor"),/rgba?\(255, 255, 255(?:, 0\.9)?\)/,'Rank badges preserve native backing');
        await browser.click('#country');await browser.waitFor("!!document.querySelector('.filters-modal-container')");
        const menu=await browser.evaluate("(()=>{const n=document.querySelector('.filters-modal-container'),r=n.getBoundingClientRect();return {left:r.left,right:r.right,blur:getComputedStyle(n).backdropFilter}})()");
        assert.ok(menu.left>=0&&menu.right<=width,'Filter menus fit narrow screens');assert.match(menu.blur,/blur\(24px\)/);
        assert.equal(await browser.evaluate("document.querySelector('#apply').disabled"),true,'Apply remains disabled until a choice changes');
        await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await browser.waitFor("!document.querySelector('.filters-modal-container')");
      }
    }
    await browser.click('#country');await browser.click('#worldwide');await browser.click('#apply');
    assert.equal(await browser.evaluate("document.querySelector('#country').textContent"),'Worldwide');
    assert.equal(await browser.evaluate("new URL(location.href).searchParams.get('country')"),'all');
    assert.equal(await browser.evaluate("new URL(location.href).searchParams.get('device')"),'computer');
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1360,height:950,deviceScaleFactor:1,mobile:false});
    await browser.click(layout==='legacy'?'.game-card-link':'[data-testid="sdui-game-tile"]');
    assert.equal(await browser.evaluate('window.activations'),1,'Native game link handler remains usable');
    if(layout==='legacy'){await browser.click('#next');assert.equal(await browser.evaluate("parseFloat(document.querySelector('.horizontally-scrollable').style.left)<0"),true,'Carousel arrow handler still moves the row')}
    await browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).hidden=true`);
    assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).display`),'none','Native hidden tiles stay hidden');
    await browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).hidden=false`);
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture',glassBlur:32,glassOpacity:83})");
    assert.match(await browser.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backdropFilter`),/blur\(32px\)/);
    await browser.evaluate(`document.querySelector(${JSON.stringify(selector)}).outerHTML=document.querySelector(${JSON.stringify(selector)}).outerHTML`);
    assert.match(await browser.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backdropFilter`),/blur\(32px\)/,'Remounted tiles retain styling');
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none'})");
    assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backdropFilter`),'none');
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture'});history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
    assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backdropFilter`),'none','Charts styles are limited to their route');
  }
  assert.deepEqual(browser.errors,[]);
});
