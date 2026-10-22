const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {test}=require('node:test');
const {isolatedChrome,waitForDocument,pause}=require('./helpers/chrome.cjs');
const workspace=path.resolve(__dirname,'..');
const styles=[...new Set(JSON.parse(fs.readFileSync(path.join(workspace,'manifest.json'),'utf8')).content_scripts.flatMap(entry=>entry.css||[]))];
const names=['Headless Horseman Left Arm','Headless Horseman Right Arm','Headless Horseman Left Leg','Headless Horseman Right Leg',
  'Headless Horseman Torso',"Headless Horseman's New Head",'Headless Head','Anime - Mood'];
const types=['Left Arm','RightArm','Left Leg','Right Leg','Torso','Gear','Dynamic Head','Mood Animation'];

// Roblox ItemList puts the translated type and ownership outside the nested ItemCard.
function cards(count=names.length){return names.slice(0,count).map((name,i)=>`<div class="item-list-item-card" data-item="${i}"><div style="display:contents">
  <div class="list-item item-card grid-item-container"><div class="item-card-container"><a class="item-card-link" href="/catalog/${100+i}/Item">
    <div class="item-card-link"><div class="item-card-thumb-container"><div class="item-card-thumb-container-inner"><div>
      <span class="thumbnail-2d-container"><img src="/figure.svg" alt=""></span></div></div></div></div>
    <div class="item-card-caption"><div class="item-card-name-link"><div class="item-card-name">${name}</div></div>
      ${i===5?'<div class="text-overflow item-card-price font-header-2 text-subheader"><span class="text text-label text-robux-tile">Off Sale</span></div>':''}</div>
  </a></div></div></div><div class="xsmall font-caption-body text-label">${types[i]}</div>
  ${i===0?'<div class="item-owned"><span class="item-owned-icon"></span><span class="item-owned-text">Owned</span></div>':''}</div>`).join('');}

function fixture(){return `<!doctype html><html lang="en" data-rc-ui-active data-rc-frost-page="catalog"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:24px;font:14px/1.4 Arial;background:#292b33;color:#f4f6fb}main{max-width:980px;margin:auto}a{color:inherit;text-decoration:none}h1{font-size:20px}
  .item-list-cards{display:flex}.item-list-item-card{position:relative}.item-card-container{background:#393b40}.item-card{padding:2px;width:125px}
  .item-card-link{display:block;width:125px}.item-card-thumb-container{height:0;padding-bottom:100%;position:relative}.item-card-thumb-container-inner{position:absolute;inset:0}
  .thumbnail-2d-container{display:block;width:100%;height:100%}.item-card-name{white-space:nowrap;overflow:hidden;height:20px}.item-card-price{height:20px;overflow:hidden;white-space:nowrap}
  .text-robux-tile{font-size:17px;line-height:22.4px}.xsmall{font-size:12px}.item-owned-icon{display:inline-block;width:12px;height:12px;background:#3c8;border-radius:50%;vertical-align:middle}
  .item-owned-text{margin-left:6px}</style>${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><main id="content">
  <div id="item-container"><section id="item-list-container-included-items"><div class="item-list wrap-items"><div class="item-list-container">
  <div class="item-list-carousel-title"><h1>Included Items</h1></div><div class="item-list-carousel"><div class="item-list-cards">${cards()}</div></div></div></div></section></div>
  <section id="item-list-container-recommendations"><div class="item-list-container"><div class="item-list-cards">${cards(1)}</div></div></section>
  </main><script>window.itemClicks=0;window.originalItems=[...document.querySelectorAll('#item-list-container-included-items a')];document.querySelector('#content').addEventListener('click',event=>{if(event.target.closest('a[href]')){event.preventDefault();itemClicks++}})</script></body></html>`;}

test('bundle item cards contain full names, sibling types, ownership and sale status across themes and narrow layouts',
  {skip:!process.env.CHROME_BIN,timeout:30000},async t=>{
    const assets=new Set(styles),server=http.createServer((req,res)=>{
      const file=new URL(req.url,'http://localhost').pathname.slice(1);
      if(assets.has(file)){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(path.join(workspace,file)));}
      else if(file==='figure.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><g fill="#d7dce6"><rect x="58" y="12" width="44" height="40" rx="8"/><rect x="46" y="56" width="68" height="52"/><rect x="22" y="56" width="20" height="52"/><rect x="118" y="56" width="20" height="52"/><rect x="46" y="112" width="30" height="44"/><rect x="84" y="112" width="30" height="44"/></g></svg>');}
      else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture());}
    });
    await new Promise(resolve=>server.listen(Number(process.env.BUNDLE_ITEMS_TEST_PORT)||0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser=await isolatedChrome(t,'bundle-items'),url=`http://127.0.0.1:${server.address().port}/bundles/201/Headless-Horseman`;
    await browser.send('Page.navigate',{url});await waitForDocument(browser,'#item-list-container-included-items',url);
    for(const theme of ['dark','light','custom']){
      await browser.evaluate(`(()=>{const root=document.documentElement;document.body.className='${theme==='light'?'light':'dark'}-theme';root.toggleAttribute('data-rc-custom-colors',${theme==='custom'});root.style.setProperty('--rc-custom-background-rgb','57 75 132');root.style.setProperty('--rc-custom-text','#ffffff');root.style.setProperty('--rc-custom-text-secondary','#dce4ff');root.style.setProperty('--rc-glass-opacity','.51')})()`);
      for(const width of [1100,390,320]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        await pause(20);
        const result=await browser.evaluate(`(()=>{const root=document.querySelector('#item-list-container-included-items'),tiles=[...root.querySelectorAll('.item-list-item-card')],bad=[];
          for(const tile of tiles){const box=tile.getBoundingClientRect();for(const n of tile.querySelectorAll('.item-card-name,.item-card-price,.text-robux-tile,.item-owned,:scope > .text-label')){const r=n.getBoundingClientRect();if(r.left<box.left||r.right>box.right+1||r.top<box.top||r.bottom>box.bottom+1||n.scrollHeight>n.clientHeight+1&&getComputedStyle(n).overflow==='hidden')bad.push(n.outerHTML);}}
          return {bad,overflow:document.documentElement.scrollWidth>innerWidth,names:tiles.map(t=>t.querySelector('.item-card-name').textContent),
            surfaces:tiles.map(t=>getComputedStyle(t).backgroundColor),nested:tiles.map(t=>getComputedStyle(t.querySelector('.item-card-container')).backgroundColor),
            recommendation:getComputedStyle(document.querySelector('#item-list-container-recommendations .item-card-container')).backgroundColor,
            prices:[...root.querySelectorAll('.item-card-price')].map(n=>({scroll:n.scrollHeight,height:n.clientHeight})),preserved:originalItems.every(n=>n.isConnected)};})()`);
        assert.deepEqual(result.bad,[],`${theme}/${width}: every label stays inside its tile`);
        assert.equal(result.overflow,false,`${theme}/${width}: page fits`);assert.deepEqual(result.names,names);assert.equal(result.preserved,true);
        assert.ok(result.surfaces.every(c=>c!=='rgba(0, 0, 0, 0)'),`${theme}: entire tile owns the background`);
        assert.ok(result.nested.every(c=>c==='rgba(0, 0, 0, 0)'),`${theme}: no double background`);
        assert.notEqual(result.recommendation,'rgba(0, 0, 0, 0)','Recommendation tile keeps its own background');
        assert.ok(result.prices.every(p=>p.height>=p.scroll-1),'Sale status is not clipped');
        if(process.env.BUNDLE_ITEMS_SCREENSHOTS&&theme==='custom'){
          fs.mkdirSync(process.env.BUNDLE_ITEMS_SCREENSHOTS,{recursive:true});const shot=await browser.send('Page.captureScreenshot',{format:'png'});
          fs.writeFileSync(path.join(process.env.BUNDLE_ITEMS_SCREENSHOTS,`bundle-${width}.png`),Buffer.from(shot.data,'base64'));
        }
      }
    }
    const labels={en:'Left Arm','zh-CN':'左臂','zh-TW':'左手臂',id:'Lengan Kiri',ja:'左腕',th:'แขนซ้าย',ko:'왼팔'};
    for(const [lang,label]of Object.entries(labels)){
      const fits=await browser.evaluate(`(()=>{document.documentElement.lang=${JSON.stringify(lang)};const n=document.querySelector('#item-list-container-included-items [data-item="0"] > .text-label');n.textContent=${JSON.stringify(label)};const r=n.getBoundingClientRect(),box=n.parentElement.getBoundingClientRect();return r.bottom<=box.bottom&&r.right<=box.right&&n.scrollHeight<=n.clientHeight+1})()`);
      assert.equal(fits,true,`${lang}: translated type stays within the tile`);
    }
    await browser.click('#item-list-container-included-items [data-item="0"] a[href]');assert.equal(await browser.evaluate('itemClicks'),1);
    await browser.evaluate("document.documentElement.setAttribute('data-rc-features-disabled','')");
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#item-list-container-included-items .item-list-item-card')).backgroundColor"),'rgba(0, 0, 0, 0)','Compatibility fallback restores native surfaces');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#item-list-container-included-items .item-card-price')).height"),'20px');
    assert.deepEqual(browser.errors,[]);
  });
