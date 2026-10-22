// Current GameSearch / ReactPlayerSearch native classes, with CSS-only customization.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/runtime.js', 'src/shared/startup.js'];

function fixture(pathname, wide, top) {
  const users = pathname.startsWith('/search/users');
  const art = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#386e8b"/><circle cx="70" cy="55" r="30" fill="#e5b55b"/><path d="M0 180L100 85L180 140L250 55L320 180Z" fill="#345544"/></svg>';
  const img = `<img src="data:image/svg+xml,${encodeURIComponent(art)}" alt="">`;
  const featured = top ? `<div class="featured-grid-item-container game-card-container wide-featured-tile" data-testid="game-tile-featured"><a class="game-card-link" href="/games/142823291/Murder-Mystery-2"><div class="game-card-thumb-container"><span class="thumbnail-2d-container brief-game-icon">${img}</span></div><div class="game-card-name-info"><div><div class="game-card-name game-name-title">Murder Mystery 2</div><div class="game-card-info"><span class="info-label">90%</span> · 544K</div></div><button class="btn-common-play-game-lg btn-primary-md play-button" aria-label="Play">▶</button></div><div class="game-card-creator-name"><span class="creator-name-label">By </span><a class="creator-name" href="/users/1848960/profile">Nikilis</a></div><div class="game-card-description-info">Can you solve the Mystery and survive each round?</div></a></div>` : '';
  const games = Array.from({ length: 8 }, (_, i) => wide
    ? `<div class="hover-game-tile grid-tile"><div class="featured-game-container game-card-container"><a class="game-card-link" href="/games/${i+1}/Game"><div class="featured-game-icon-container">${img}</div><div class="info-container"><div class="game-card-name">${i===0?'Murder Mystery 2 — a longer title':'Mystery '+i}</div><div class="info-metadata-container"><div class="game-card-info"><span class="info-label">95%</span> · 123K</div></div></div></a></div></div>`
    : `<div class="game-tile"><div class="game-card-container"><a class="game-card-link" href="/games/${i+1}/Game"><div class="game-card-thumb-container"><span class="thumbnail-2d-container game-card-thumb">${img}</span></div><div class="game-card-name game-name-title">${i===0?'Murder Mystery 2 — a longer title':'Mystery '+i}</div><div class="game-card-info"><span class="info-label">95%</span> · 123K</div></a></div></div>`).join('');
  const players = Array.from({ length: 8 }, (_, i) => `<article class="player-search-card relative flex width-full min-height-2000 flex-col bg-surface-100 radius-medium" data-testid="player-card-${i}"><div class="player-search-card-body flex width-full grow cursor-pointer items-start gap-large padding-large" role="button" tabindex="0"><span class="player-search-avatar shrink-0"><span class="player-search-avatar-clip">${img}</span></span><div class="player-search-card-caption flex flex-col justify-start gap-xsmall"><div class="player-search-card-name text-body-large content-emphasis">${i===0?'Blue with a very long display name':'Blue '+i}</div><p class="text-body-small content-muted">@blue_${i}</p><p class="text-body-small content-muted"><a class="player-search-card-line text-link" href="/communities/123">A community</a></p></div></div><div class="player-search-actions padding-x-large padding-bottom-large"><button class="foundation-web-button width-full ${i===1?'bg-action-standard':'bg-action-emphasis'}" ${i===2?'disabled':''}>Add connection</button></div></article>`).join('');
  const content = users
    ? `<div id="react-player-search-web-app"><div class="page-layout"><div class="flex flex-col gap-medium"><h1 class="content-emphasis">Search users</h1><div class="foundation-web-input flex width-full"><span aria-hidden="true">⌕</span><input id="query" placeholder="Search" value="blue'"></div></div><div class="flex width-full flex-col gap-medium"><div class="player-search-results-grid">${players}</div><div id="sentinel"></div></div><div class="bg-surface-100 content-muted radius-medium stroke-standard stroke-muted padding-large" hidden>No matches</div></div></div>`
    : `<div id="game-search-web-app">${top?'':'<div class="header-section"><h1>Explore “mm2” on Roblox</h1><p>Search through thousands of Roblox games.</p></div>'}<div id="games-search-page"><div class="games-search-search-text-content" hidden>No matches</div><div class="game-search-feed-container ${wide?'wide-tile-search-feed':''}"><div><div class="game-grid search-game-grid ${wide?'wide-game-tile-game-grid dynamic-layout-sizing':''}">${featured}${games}</div><div id="sentinel" class="game-card-container invisible" data-testid="sentinel-tile"></div><div class="load-more-btn-container"><button>Load more</button></div></div></div></div></div>`;
  return `<!doctype html><html lang="en" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{box-sizing:border-box}body{margin:0;background:#202227;font:16px/1.5 Arial;color:#fff}.light-theme body{background:#f2f4f5;color:#191a1f}
    html[data-rc-background-active] body{background:linear-gradient(135deg,#984b58,#327e88)}#content{width:min(1100px,calc(100% - 32px));margin:24px auto}
    h1,h2,h3,h4,h5{margin:0;padding:5px 0;line-height:1.4em}button,input{font:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:default}img{width:100%;height:100%;object-fit:cover}a{color:inherit;text-decoration:none}
    .game-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px}.wide-game-tile-game-grid{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
    .featured-grid-item-container{grid-area:span 2 / span 2;display:flex;flex-direction:column;width:100%;height:auto}.featured-grid-item-container>a{width:100%}.featured-grid-item-container .game-card-thumb-container{position:relative;float:none;width:100%;height:0;padding-bottom:56.25%}.featured-grid-item-container .brief-game-icon{position:absolute;inset:0;display:block}.game-card-name-info{display:flex;align-items:start}.game-card-name-info .play-button{flex:none;width:44px;height:44px;margin-left:auto;background:#335fff;color:#fff;border:0;border-radius:8px}.game-card-creator-name{display:flex;gap:4px;font-size:12px;color:#555}.game-card-description-info{font-size:14px;color:#555}.game-tile{height:240px}.game-card-container{height:100%}.game-card-thumb-container,.game-card-thumb{display:block;width:150px;height:150px}.game-card-name{font-weight:700}.game-name-title{max-height:45px}.featured-game-icon-container{aspect-ratio:16/9;overflow:hidden;border-radius:8px}.info-container{padding:8px}.game-card-info{font-size:12px}.load-more-btn-container{display:flex}.load-more-btn-container button{margin:12px auto;padding:8px 32px}.invisible{visibility:hidden;height:0}
    .flex{display:flex}.flex-col{flex-direction:column}.width-full{width:100%}.gap-medium{gap:12px}.gap-large{gap:16px}.gap-xsmall{gap:4px}.grow{flex-grow:1}.shrink-0{flex-shrink:0}.items-start{align-items:flex-start}.padding-large{padding:12px}.padding-x-large{padding-inline:12px}.padding-bottom-large{padding-bottom:12px}.page-layout{display:flex;flex-direction:column;gap:20px;max-width:970px;margin:auto}.bg-surface-100{background:#303236}.light-theme .bg-surface-100{background:#fff}.radius-medium{border-radius:8px}.content-emphasis{color:#fff}.content-muted{color:#b7bbc4}.light-theme .content-emphasis{color:#191a1f}.light-theme .content-muted{color:#555}
    .foundation-web-input{align-items:center;background:#303236;padding-inline:12px}.foundation-web-input input{width:100%;border:0;outline:0}.player-search-results-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 10px;width:100%;padding-inline:6px}.player-search-card{overflow:hidden;min-height:180px}.player-search-avatar{width:96px;height:96px;display:block;position:relative}.player-search-avatar-clip{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;background:#c9ccd1}.player-search-card-caption{flex:1 1 0;min-width:0}.player-search-card-name,.player-search-card-caption>p{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.player-search-card-name{font-weight:700}.player-search-card-caption p{margin:0;font-size:12px}.player-search-actions{height:57px}.foundation-web-button{height:36px;padding:4px 12px;border:0}.bg-action-emphasis{background:#335fff;color:#fff}.bg-action-standard{background:#ddd;color:#191a1f}
    @media(max-width:600px){.featured-grid-item-container{grid-area:auto}}@media(max-width:991px){.player-search-results-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.player-search-results-grid{grid-template-columns:1fr}}
  </style>${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><main id="content">${content}</main>
  ${scripts.map(file=>`<script src="/${file}"></script>`).join('')}<script>
    window.activations={profile:0,action:0,game:0,load:0,search:0,play:0};
    RobloxCustomizerStartup.setPreferences({source:'none',glassBlur:24,glassOpacity:62});
    document.addEventListener('click',event=>{const node=event.target.closest('a,button,[role=button]');if(!node)return;event.preventDefault();if(node.matches('button.play-button'))activations.play++;else if(node.matches('a.game-card-link'))activations.game++;else if(node.matches('.player-search-card-body'))activations.profile++;else if(node.matches('button.foundation-web-button'))activations.action++;else if(node.matches('.load-more-btn-container button')){activations.load++;const grid=document.querySelector('.game-grid');grid.append(grid.querySelector('.game-tile,.hover-game-tile').cloneNode(true))}});
    document.querySelector('#query')?.addEventListener('keyup',event=>{if(event.key==='Enter')activations.search++});
  </script></body></html>`;
}

test('Search pages theme native game/player results, preserve actions and style newly loaded cards without scanning',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const assets = new Set([...styles, ...scripts]);
    const server = http.createServer((request,response)=>{
      const url=new URL(request.url,'http://localhost'),file=url.pathname.slice(1);
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
      response.end(assets.has(file)?fs.readFileSync(path.join(workspace,file)):fixture(url.pathname,url.searchParams.has('wide')||url.searchParams.get('searchType')==='top',url.searchParams.get('searchType')==='top'));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser=await isolatedChrome(t,'search-pages'),origin=`http://127.0.0.1:${server.address().port}`;
    for(const [route,page,selector] of [
      ['/discover/?keyword=mm2','game-search','.game-card-container:not(.invisible)'],
      ['/discover/?keyword=mm2&wide','game-search','.game-card-container:not(.invisible)'],
      ['/discover/?searchType=top&keyword=mm2','game-search','.game-card-container:not(.invisible)'],
      ['/search/users?keyword=blue%27','user-search','.player-search-card']
    ]){
      await browser.send('Page.navigate',{url:origin+route});
      await waitForDocument(browser,selector);
      assert.equal(await browser.evaluate('document.documentElement.dataset.rcFrostPage'),page);
      for(const theme of ['dark','light'])for(const width of [1280,768,390,320])for(const locale of ['en','zh-CN','zh-TW']){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
        await browser.evaluate(`document.documentElement.className='${theme}-theme';document.body.className='${theme}-theme';document.documentElement.lang='${locale}';(document.querySelector('h1')||document.createElement('h1')).textContent=${JSON.stringify(locale==='en'?'Search results':locale==='zh-CN'?'搜索结果':'搜尋結果')}`);
        const state=await browser.evaluate(`(()=>{const cards=[...document.querySelectorAll(${JSON.stringify(selector)})];return{
          overflow:document.documentElement.scrollWidth>innerWidth,
          cards:cards.map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return{blur:s.backdropFilter,radius:s.borderRadius,color:s.color,width:r.width,right:r.right}}),
          header:document.querySelector('h1')?getComputedStyle(document.querySelector('${page==='user-search'?'#react-player-search-web-app > div > div:first-child':'.header-section'}')).backdropFilter:null,
          panel:document.querySelector('#games-search-page')?{bg:getComputedStyle(document.querySelector('#games-search-page')).backgroundColor,blur:getComputedStyle(document.querySelector('#games-search-page')).backdropFilter}:null,
          outer:getComputedStyle(document.querySelector('${page==='user-search'?'.player-search-results-grid':'.game-grid'}')).backdropFilter}})()`);
        assert.equal(state.overflow,false,`${route}/${theme}/${width}/${locale}: viewport fits`);
        if(state.header!==null)assert.match(state.header,/blur\(24px\)/);
        if(state.panel){assert.notEqual(state.panel.bg,'rgba(0, 0, 0, 0)');assert.equal(state.panel.blur,'none','The results backing does not add a full-feed blur')}
        assert.equal(state.outer,'none','Only the card has blur, not the whole grid');
        assert.equal(state.cards.length,route.includes('searchType=top')?9:8);
        for(const card of state.cards){assert.match(card.blur,/blur\(24px\)/);assert.equal(card.radius,'14px');assert.ok(card.width>100&&card.right<=width)}
        const text=await browser.evaluate(`getComputedStyle(document.querySelector('${page==='user-search'?'.player-search-card-name':'.game-card-name'}')).color`);
        assert.equal(text,theme==='light'?'rgb(27, 35, 48)':'rgb(244, 246, 251)');
        if(route.includes('searchType=top')){
          const featured=await browser.evaluate(`(()=>{const card=document.querySelector('[data-testid="game-tile-featured"]'),r=card.getBoundingClientRect(),img=card.querySelector('img').getBoundingClientRect(),button=card.querySelector('.play-button').getBoundingClientRect();return{creator:getComputedStyle(card.querySelector('.creator-name')).color,description:getComputedStyle(card.querySelector('.game-card-description-info')).color,inset:img.left-r.left,imageRight:r.right-img.right,buttonRight:button.right<=r.right,innerBlur:getComputedStyle(card.querySelector('.game-card-name-info')).backdropFilter}})()`);
          assert.equal(featured.creator,theme==='light'?'rgb(23, 76, 181)':'rgb(170, 202, 255)');
          assert.equal(featured.description,theme==='light'?'rgb(65, 76, 94)':'rgb(195, 202, 214)');
          assert.ok(featured.inset>=8&&featured.imageRight>=8&&featured.buttonRight,'Featured media and play button fit inside the backing');
          assert.equal(featured.innerBlur,'none');
        }
      }
      await browser.send('Emulation.setDeviceMetricsOverride',{width:1280,height:950,deviceScaleFactor:1,mobile:false});
      if(page==='user-search'){
        await browser.click('.player-search-card-body');await browser.click('.foundation-web-button');
        await browser.click('.player-search-card:nth-child(3) .foundation-web-button');
        await browser.click('#query');await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
        const actions=await browser.evaluate('activations');
        assert.equal(actions.profile,1);assert.equal(actions.action,1,'Disabled actions stay disabled');assert.equal(actions.search,1);
      }else{
        if(route.includes('searchType=top')){
          await browser.click('.play-button');assert.equal(await browser.evaluate('activations.play'),1,'Native featured Play stays clickable');
        }
        await browser.click('.game-card-link');await browser.click('.load-more-btn-container button');
        assert.equal(await browser.evaluate('activations.game'),1);assert.equal(await browser.evaluate('activations.load'),1);
        assert.match(await browser.evaluate('getComputedStyle(document.querySelector(".game-grid").lastElementChild.querySelector(".game-card-container")).backdropFilter'),/blur\(24px\)/);
        assert.equal(await browser.evaluate('getComputedStyle(document.querySelector("[data-testid=sentinel-tile]")).backdropFilter'),'none');
      }
      await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture',glassBlur:24,glassOpacity:62,disableBlur:true,disableTransparency:true})");
      const opaque=await browser.evaluate(`(()=>{const s=getComputedStyle(document.querySelector(${JSON.stringify(selector)}));return{bg:s.backgroundColor,blur:s.backdropFilter}})()`);
      assert.equal(opaque.blur,'none');assert.match(opaque.bg,/^rgb\(/);
      if(page==='game-search')assert.match(await browser.evaluate('getComputedStyle(document.querySelector("#games-search-page")).backgroundColor'),/^rgb\(/,'Disabling transparency also makes the results backing opaque');
      await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none',glassBlur:24,glassOpacity:62,experimentalCustomColors:true,customTextColor:'#ffeecc',customBackgroundColor:'#153040',customAccentColor:'#aadd99'})");
      assert.equal(await browser.evaluate('getComputedStyle(document.querySelector("h1,.game-card-name")).color'),'rgb(255, 238, 204)');
      if(process.env.SEARCH_PAGE_SCREENSHOT){const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(workspace,`.tmp-search-${page}${route.includes('searchType=top')?'-top':route.includes('wide')?'-wide':''}.png`),Buffer.from(shot.data,'base64'))}
      await browser.evaluate("history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
      assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backdropFilter`),'none','Search styling clears off-route');
    }
    assert.deepEqual(browser.errors,[]);
  });
