// Local fixtures exercise native fixed-size tiles without contacting an account.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');

function fixture(layout) {
  const square = `<div class="game-card" style="width:164px"><div id="square" class="game-card-container"><a class="game-card-link" href="https://www.roblox.com/games/101/Sample"><div class="game-card-thumb-container"><span class="thumbnail-2d-container game-card-thumb"><img src="/square.svg" width="150" height="150" alt="Sample square game"></span></div><div class="game-card-name" title="🎃 [HATCH WARS] Pet Adventure With An Extra Long Name">🎃 [HATCH WARS] Pet Adventure With An Extra Long Name</div><div class="game-card-info"><span class="info-label icon-votes-gray">👍</span><span class="info-label vote-percentage-label">94%</span><span class="info-label icon-playing-counts-gray">♟</span><span class="info-label playing-counts-label">58.6K</span><span class="info-label hidden" hidden>Hidden stat</span></div></a></div></div>`;
  // Matches the featured-game-container hierarchy in Roblox's GameCarousel.js.
  // Its widths come from the page width; max-height excludes our added padding.
  const wideLayout=layout==='grid'?'game-grid home-game-grid wide-game-tile-game-grid dynamic-layout-sizing':'game-carousel wide-game-tile-carousel dynamic-layout-sizing';
  const wide = `<div class="native-wide-layout ${wideLayout}"><div class="hover-game-tile grid-tile old-hover" data-testid="wide-game-tile"><div class="featured-game-container game-card-container" id="wide"><a class="game-card-link" href="https://www.roblox.com/games/102/Sample"><div class="featured-game-icon-container"><span class="thumbnail-2d-container brief-game-icon"><img src="/wide.svg" width="576" height="324" alt="Sample wide game"></span><span class="game-card-image-pill hover-only" hidden>Hidden hover pill</span></div><div class="info-container"><div class="info-metadata-container"><div class="game-card-name game-name-title" data-testid="game-tile-game-title">Stream A Cheese Pull! A Long Example Title That Must Fit Inside The Card</div><div class="wide-game-tile-metadata"><div class="base-metadata"><div class="game-card-info"><span class="info-label icon-votes-gray">👍</span><span class="info-label vote-percentage-label">89% Rating</span><span class="info-avatar"><span class="avatar-card"><span class="avatar-headshot-xs" style="width:24px;height:24px;padding:2px;display:flex"><span class="thumbnail-2d-container"><img class="avatar-card-image" src="/square.svg" width="20" height="20" alt="Sample friend"></span></span></span></span></div></div><div class="hover-metadata" hidden>Native hover details</div></div></div></div></a></div></div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${process.env.HOME_NATIVE_CSS ? '<link rel="stylesheet" href="/native.css">' : ''}
  <style>
  *{box-sizing:border-box}body{margin:0;font:16px/1.4 Arial;background:#34383e;color:#f7f7f8}main{max-width:1040px;width:calc(100% - 32px);margin:24px auto}h1,h2{margin:0 0 14px}.game-cards{display:flex;align-items:flex-start;flex-wrap:wrap;gap:20px;white-space:normal}.game-card{display:inline-block;width:164px;height:240px;padding:0 14px 0 0}.game-card-container{position:relative;float:left;width:100%;height:100%}.game-card-link{display:flex;flex-direction:column;width:100%;height:100%;color:inherit;text-decoration:none}.game-card-thumb-container,.game-card-thumb{display:inline-block;width:150px;height:150px}.game-card-thumb img{width:150px;height:150px}.game-card-name,[data-testid="game-title"]{font-size:18px;font-weight:700;line-height:24px;height:48px;max-height:48px;white-space:nowrap;overflow:visible}.game-card-info{position:absolute;bottom:6px;width:100%;margin:0 6px}.info-label{font-size:14px;line-height:20px}.vote-percentage-label{padding-right:12px}.hidden,[hidden]{display:none!important}#native-card{width:150px;height:240px}#native-card img{width:150px;height:150px}#rc-home-greeting{display:none!important}
  @media(max-width:600px){#wide{width:min(360px,100%)!important}.game-card{width:150px!important;padding:0 6px 0 0}}
  .native-wide-layout{--home-feed-width:min(1040px,calc(100vw - 32px));--items-per-row:3;--native-tile-width:calc((var(--home-feed-width) - 1px - 16px*(var(--items-per-row) - 1))/var(--items-per-row));--native-tile-height:calc(var(--native-tile-width)*.5625 + 61px);width:100%;display:flex;gap:16px;overflow-x:auto}
  .native-wide-layout .hover-game-tile.grid-tile{flex:0 0 auto;width:var(--native-tile-width);height:min-content;max-height:var(--native-tile-height)}
  .native-wide-layout .hover-game-tile.grid-tile .featured-game-container{width:100%;height:auto;max-height:var(--native-tile-height)}
  .native-wide-layout .hover-game-tile.grid-tile .featured-game-container .featured-game-icon-container,.native-wide-layout .hover-game-tile.grid-tile .featured-game-container .featured-game-icon-container .brief-game-icon{width:var(--native-tile-width);height:calc(var(--native-tile-width)*.5625)}
  .brief-game-icon img{width:100%;height:100%}
  .native-wide-layout .hover-game-tile.grid-tile .featured-game-container .info-metadata-container{float:left;width:var(--native-tile-width);margin-top:8px}
  .wide-game-tile-metadata{display:flex;width:100%}.base-metadata{flex:1;min-width:0}.info-avatar{display:flex;align-items:center}
  @media(max-width:767px){.native-wide-layout{--items-per-row:1}}
  </style><link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/settings/settings.css"></head><body class="dark-theme"><main id="content"><div id="HomeContainer"><h1>Home</h1><section id="recommended"><h2>Recommended For You</h2><div class="game-cards">${square}${wide}</div></section><section><h2>Continue</h2><div class="game-cards" id="late"></div></section><section id="rc-pinned-games"><div id="native-card"><img src="/square.svg" alt="Separate pinned card">Pinned card</div></section></div></main>
  <script>
  window.selected=[];document.querySelectorAll('.game-card-link').forEach(link=>link.onclick=event=>{event.preventDefault();selected.push(link.getAttribute('href'))});
  const listeners=[];localStorage.setItem('customBackground',JSON.stringify({source:'none'}));
  window.chrome={storage:{local:{async get(){return {customBackground:JSON.parse(localStorage.getItem('customBackground'))}},async set(data){localStorage.setItem('customBackground',JSON.stringify(data.customBackground));listeners.forEach(fn=>fn({customBackground:{newValue:data.customBackground}},'local'))}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{getURL:file=>'/'+file,lastError:null,sendMessage(message,callback){callback({id:1,name:'Sample',displayName:'Sample',imageUrl:'/square.svg'})}}};
  </script><script src="/src/shared/startup.js"></script><script src="/src/settings/settings.js"></script></body></html>`;
}

test('Home card rows align short and long titles and contain all content after resize and remount', {skip:!process.env.CHROME_BIN,timeout:30000}, async t => {
  const server=http.createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');
    const url=new URL(request.url,'http://localhost'),file=url.pathname.slice(1);
    if(['src/shared/theme.css','src/settings/settings.css','src/shared/startup.js','src/settings/settings.js'].includes(file)){response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)))}
    else if(file==='native.css'&&process.env.HOME_NATIVE_CSS){response.setHeader('Content-Type','text/css');response.end(fs.readFileSync(process.env.HOME_NATIVE_CSS))}
    else if(file.endsWith('.svg')){const width=file==='wide.svg'?640:300;response.setHeader('Content-Type','image/svg+xml');response.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width===640?360:300}" viewBox="0 0 ${width} ${width===640?360:300}"><rect width="100%" height="100%" fill="#476ab7"/><circle cx="${width/2}" cy="150" r="95" fill="#ffd978"/><path d="M${width/2-100} 240h200" stroke="#7fe4c7" stroke-width="24"/></svg>`)}
    else if(file.startsWith('icons/')){response.setHeader('Content-Type','image/png');response.end(fs.readFileSync(path.join(workspace,file)))}
    else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixture(url.searchParams.get('layout')))}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await isolatedChrome(t,'home-card-layout');
  for(const layout of ['carousel','grid']){
  const fixtureUrl=`http://127.0.0.1:${server.address().port}/home?layout=${layout}`;
    await browser.send('Page.navigate',{url:fixtureUrl});
    await waitForDocument(browser, '#HomeContainer', fixtureUrl);
  await browser.waitFor("!!document.querySelector('#wide[data-rc-recommended-card]') && [...document.querySelectorAll('#recommended img')].every(n=>n.complete)");
  await browser.evaluate(`(()=>{for(const [id,name,place] of [['square','Shipping Lanes','103'],['wide','Hamster Village','104']]){const source=document.querySelector('#'+id).closest('.game-card,.hover-game-tile'),clone=source.cloneNode(true),card=clone.querySelector('.game-card-container');card.id=id+'-peer';card.classList.remove('rc-home-game-card');card.querySelector('.game-card-name').textContent=name;card.querySelector('a').href='https://www.roblox.com/games/'+place+'/Sample';card.querySelector('.rc-hide-recommended-game')?.remove();card.querySelector('.info-avatar')?.remove();for(const attr of [...card.attributes])if(attr.name.startsWith('data-rc-recommended'))card.removeAttribute(attr.name);source.after(clone)}})()`);
  await browser.waitFor("!!document.querySelector('#wide-peer[data-rc-recommended-card]')");
  const names=await browser.evaluate("[...document.querySelectorAll('.game-card-name,[data-testid=game-title]')].map(n=>n.textContent)");
  const check=async({align=true}={})=>{
    const results=await browser.evaluate(`(()=>[...document.querySelectorAll('.rc-home-game-card')].map(card=>{const c=card.getBoundingClientRect(),style=getComputedStyle(card),left=c.left+parseFloat(style.borderLeftWidth)+parseFloat(style.paddingLeft),right=c.right-parseFloat(style.borderRightWidth)-parseFloat(style.paddingRight),bottom=c.bottom-parseFloat(style.borderBottomWidth)-parseFloat(style.paddingBottom),title=card.querySelector('.game-card-name,[data-testid="game-title"]'),stats=card.querySelector('.game-card-info,[data-testid="game-tile-stats"]'),art=card.querySelector('img'),nodes=[art,title,stats,...stats.querySelectorAll(':not(.hidden):not([hidden])')];return {id:card.id,fits:nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=left-1&&r.right<=right+1&&r.bottom<=bottom+1}),separate:title.getBoundingClientRect().bottom<=stats.getBoundingClientRect().top,ratio:art.getBoundingClientRect().width/art.getBoundingClientRect().height,lines:title.getBoundingClientRect().height/parseFloat(getComputedStyle(title).lineHeight),hideVisible:card.hasAttribute('data-rc-recommended-card')?getComputedStyle(card.querySelector('.rc-hide-recommended-game')).display!=='none':true}}))()`);
    assert.ok(results.length>=2);
    for(const result of results){assert.equal(result.fits,true,`${result.id}: art, title and stats fit the inner card`);assert.equal(result.separate,true,`${result.id}: title does not overlap stats`);assert.ok(result.lines<=2.01);assert.ok(result.hideVisible);assert.ok(Math.abs(result.ratio-(result.id.startsWith('wide')?16/9:1))<.01,'Thumbnail keeps its aspect ratio');}
    const alignment=align?await browser.evaluate(`['square','wide'].map(id=>{const a=document.querySelector('#'+id),b=document.querySelector('#'+id+'-peer'),ar=a.getBoundingClientRect(),br=b.getBoundingClientRect();return {id,heights:[ar.height,br.height],ratings:[a.querySelector('.game-card-info').getBoundingClientRect().top-ar.top,b.querySelector('.game-card-info').getBoundingClientRect().top-br.top]}})`):[];
    for(const pair of alignment){assert.ok(Math.abs(pair.heights[0]-pair.heights[1])<=1,`${pair.id}: short and long titles have equal card heights ${JSON.stringify(pair)}`);assert.ok(Math.abs(pair.ratings[0]-pair.ratings[1])<=1,`${pair.id}: rating rows line up ${JSON.stringify(pair)}`);}
    const clipped=await browser.evaluate(`(()=>[...document.querySelectorAll('.rc-home-game-card')].some(card=>{const stats=card.querySelector('.game-card-info,[data-testid="game-tile-stats"]'),r=stats.getBoundingClientRect();for(let parent=stats.parentElement;parent&&parent.id!=='HomeContainer';parent=parent.parentElement){const s=getComputedStyle(parent),p=parent.getBoundingClientRect();if(['hidden','clip','auto','scroll'].includes(s.overflowY)&&r.bottom>p.top+parent.clientTop+parent.clientHeight+1)return true;}return false}))()`);
    assert.equal(clipped,false,'Grid rows and scrolling wrappers reveal the complete rating row');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.info-label.hidden')).display"),'none');
    assert.equal(await browser.evaluate("document.querySelector('#native-card').classList.contains('rc-home-game-card')"),false);
    assert.equal(await browser.evaluate("document.documentElement.scrollWidth>innerWidth"),false);
  };
  for(const theme of ['dark','light']){
  await browser.evaluate(`document.body.className='${theme}-theme'`);
  for(const width of [2190,1360,768,390,320]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(30);await check();
    if(process.env.HOME_CARD_PREVIEWS&&layout==='grid'&&theme==='dark'&&[1360,390].includes(width)){
      fs.mkdirSync(path.join(workspace,'previews'),{recursive:true});const metrics=await browser.send('Page.getLayoutMetrics');const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.min(metrics.cssContentSize.height,1000),scale:1}});fs.writeFileSync(path.join(workspace,`previews/home-cards-demo-${width}.png`),Buffer.from(shot.data,'base64'));
    }
  }
  }
  assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.game-card-name,[data-testid=game-title]')].map(n=>n.textContent)"),names,'Full native titles remain available to assistive technology');
  await browser.click('#square .game-card-link');assert.equal((await browser.evaluate('selected')).length,1,'Native card link stays clickable');
  await browser.evaluate("(()=>{const card=document.querySelector('#square');card.outerHTML=card.outerHTML.replace('rc-home-game-card','')})()");
  await browser.waitFor("document.querySelector('#square').classList.contains('rc-home-game-card')");
  await browser.evaluate("(()=>{const clone=document.querySelector('#square').cloneNode(true);clone.id='late-card';clone.className='game-card-container';clone.querySelector('.rc-hide-recommended-game').remove();for(const attr of [...clone.attributes])if(attr.name.startsWith('data-rc-recommended'))clone.removeAttribute(attr.name);clone.querySelector('.game-card-name').textContent='AnExtremelyLongUnbrokenGameNameThatMustStayWithinItsOwnCard';const parent=document.createElement('div');parent.className='game-card';parent.append(clone);document.querySelector('#late').append(parent)})()");
  await browser.waitFor("document.querySelector('#late-card').classList.contains('rc-home-game-card')");await check();
  // Native focused tiles deliberately pop out with extra padding. Check their
  // bounds, then check row alignment again after the native expansion ends.
  await browser.evaluate("document.querySelector('.hover-game-tile').classList.add('focused')");await pause(350);await check({align:false});
  await browser.evaluate("document.querySelector('.hover-game-tile').classList.remove('focused')");await pause(350);await check();
  assert.equal(await browser.evaluate("document.querySelector('.hover-metadata').hidden"),true,'Native hidden hover content stays hidden');
  await browser.click('#wide .rc-hide-recommended-game');await browser.waitFor("getComputedStyle(document.querySelector('#wide')).display==='none'");
  assert.equal(await browser.evaluate('selected.length'),1,'Hide does not open the game');
  }
  assert.deepEqual(browser.errors,[]);
});
