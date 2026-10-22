const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry=>entry.css || []))];
const scripts = ['src/shared/routes.js','src/shared/compatibility.js','src/shared/runtime.js','src/shared/native-labels.js',
  'src/shared/i18n.js','src/shared/startup.js','src/settings/settings.js','src/servers/server-globe.js','src/pages/games/game-page.js'];
function fixture() {
  return `<!doctype html><html lang="en" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*{box-sizing:border-box}body{margin:0;background:linear-gradient(125deg,#976b74,#234b64);font:14px/1.5 Arial;color:white;min-height:100vh}#content{width:min(1050px,calc(100% - 32px));margin:24px auto}.card-list{display:flex;flex-wrap:wrap;gap:12px}.card-item{width:230px;padding:14px;border:1px solid #8886;border-radius:12px;background:#151b2a88}button{font:inherit;padding:8px 12px}#settings-popover-menu{display:none}#running-game-instances-container input[type=search]{box-sizing:content-box;min-width:360px;padding-inline:18px}</style>
  ${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="content"><div id="game-detail-page" data-place-id="123"><input type="hidden" id="game-detail-meta-data" data-place-id="123" data-universe-id="1123"><h1 class="game-name">Server browser</h1><section id="game-instances"><section id="running-game-instances-container"><h2>Other Servers</h2><div class="native-options"><div><span>Sort By</span><select><option value="Desc">Descending</option><option value="Asc">Ascending</option></select></div><div><span>Exclude Full Servers</span><input id="native-exclude" type="checkbox" onchange="nativeExcludes.push(this.checked)"></div></div><div class="card-list"></div></section></section></div></main>
  <script>window.nativeJoins=[];window.nativeExcludes=[];const changes=[];
  window.saved=JSON.parse(localStorage.getItem('filter-options-fixture')||'null')||{customBackground:{source:'none',glassBlur:23,glassOpacity:62},rcServerLocation:{country:'SG',city:'Singapore',locationMode:'nearest',latitude:1.35,longitude:103.8}};
  window.nativeMarkup=()=>Array.from({length:12},(_,i)=>{const id='12345678-0000-4444-8888-'+String(i).padStart(12,'0');return '<div class="card-item" data-rc-instance-id="'+id+'" data-playing="'+(i===11?20:i)+'" data-max-players="20" data-ping="'+(180-i*10)+'" data-country-code="'+(i%3===0?'US':i%3===1?'SG':'MY')+'"><div class="text-title-medium">Server '+i+'</div><div class="game-server-status">'+(i===11?20:i)+' of 20 people max</div><button class="game-server-join-btn" onclick="nativeJoins.push('+i+')">Join</button></div>'}).join('');
  document.querySelector('.card-list').innerHTML=nativeMarkup();
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(){return structuredClone(saved)},async set(patch){const delta={};for(const[key,value]of Object.entries(patch)){delta[key]={oldValue:saved[key],newValue:value};saved[key]=structuredClone(value)}localStorage.setItem('filter-options-fixture',JSON.stringify(saved));changes.forEach(fn=>fn(delta,'local'))}},onChanged:{addListener:fn=>changes.push(fn)}},runtime:{getURL:file=>'/'+file,lastError:null,sendMessage(message,callback){queueMicrotask(()=>{
  if(message.type==='rc-public-server-country'){const n=Number(message.serverId.slice(-12)),city=n%3===0?'Seattle':n%3===1?'Singapore':'Kuala Lumpur';callback({countryCode:n%3===0?'US':n%3===1?'SG':'MY',city,latitude:n%3===0?47.6:n%3===1?1.35:3.1,longitude:n%3===0?-122.3:n%3===1?103.8:101.7,estimated:true});return}
  callback({error:'Optional data is not used in this fixture'});
  })}}};
  window.serverSelectionWrites=[];
  const fixtureSet=chrome.storage.local.set;
  chrome.storage.local.set=async patch=>{if(Object.hasOwn(patch,'rcServerLocation'))serverSelectionWrites.push(patch.rcServerLocation);return fixtureSet(patch)};
  chrome.storage.local.remove=async keys=>{const delta={};for(const key of [].concat(keys)){if(Object.hasOwn(saved,key))delta[key]={oldValue:saved[key]};delete saved[key]}localStorage.setItem('filter-options-fixture',JSON.stringify(saved));changes.forEach(fn=>fn(delta,'local'))};
  </script>${scripts.map(file=>`<script src="/${file}"></script>`).join('')}</body></html>`;
}
test('page-only server filters, city fallback, country search sizing, age sorting and native Join work across seven languages',
  {skip:!process.env.CHROME_BIN,timeout:60000},async t=>{
    const files=new Set([...styles,...scripts,...manifest.web_accessible_resources.flatMap(entry=>entry.resources)]);
    const server=http.createServer((request,response)=>{
      const file=new URL(request.url,'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':/\.m?js$/.test(file)?'text/javascript':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');
      response.end(files.has(file)?fs.readFileSync(path.join(workspace,file)):fixture());
    });
    await new Promise(resolve=>server.listen(Number(process.env.SERVER_OPTIONS_TEST_PORT)||0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser=await isolatedChrome(t,'server-filter-options');
    await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
    const url=`http://127.0.0.1:${server.address().port}/games/123/Game`;
    await browser.send('Page.navigate',{url});
    try { await waitForDocument(browser,'.rc-public-server-filters',url); }
    catch(error) { throw new Error(JSON.stringify({errors:browser.errors,state:await browser.evaluate("({ready:document.readyState,html:document.querySelector('#game-detail-page')?.innerHTML.slice(-500),flags:document.documentElement.getAttributeNames()})")}),{cause:error}); }
    const visible=()=>browser.evaluate("[...document.querySelectorAll('.card-item')].filter(n=>n.checkVisibility()).sort((a,b)=>Number(a.style.order||0)-Number(b.style.order||0)).map(n=>Number(n.dataset.playing))");
    const edit=async(key,value)=>browser.evaluate(`(()=>{const n=document.querySelector('[data-rc-server-filter="${key}"]');n.value=${JSON.stringify(value)};n.dispatchEvent(new Event('change',{bubbles:true}))})()`);
    assert.equal(await browser.evaluate("document.querySelector('.rc-public-server-filter-fields').hidden"),true);
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-server-filter=country]').value"),'all','Legacy country choices are not restored');
    assert.equal(await browser.evaluate("Object.hasOwn(saved,'rcServerLocation')"),false,'Legacy stored choices are removed');
    await browser.click('[data-rc-server-preset="ping"]');
    await browser.waitFor("document.querySelector('[data-rc-server-filter=\"playerSort\"]').value==='ping'");
    assert.equal((await visible())[0],20);
    await browser.click('[data-rc-server-preset="not-full"]');
    await browser.waitFor("document.querySelector('#native-exclude').checked");
    await browser.waitFor("!document.querySelector('.card-item[data-playing=\"20\"]').checkVisibility()");
    assert.equal((await visible()).includes(20),false);
    assert.equal((await visible())[0],10);
    await browser.click('.rc-public-server-filter-toggle');
    await browser.waitFor("!document.querySelector('.rc-public-server-filter-fields').hidden");
    await browser.waitFor("document.querySelectorAll('[data-rc-server-city]').length===12 && document.querySelector('[data-rc-server-filter=\"city\"]').options.length===4");
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-server-filter=\"playerSort\"] option[value=newest]').disabled"),true);
    await edit('city','Singapore'); await edit('locationMode','nearest');
    await browser.waitFor("document.querySelector('[data-rc-server-filter=country]').value==='SG'");
    assert.equal((await visible())[0],10,'The preferred city wins before ping');
    await edit('locationMode','exact');
    await browser.waitFor("document.querySelector('.rc-public-server-filter-count').textContent.includes('4 matches')");
    assert.deepEqual(await visible(),[10,7,4,1]);
    await edit('locationMode','nearest');
    await pause(650);
    await browser.click('.rc-public-server-random-join');
    assert.equal(await browser.evaluate('nativeJoins.at(-1)%3'),1,'Random join respects the preferred city');
    await browser.evaluate("document.querySelectorAll('.card-item[data-country-code=\"SG\"] button').forEach(n=>n.disabled=true)");
    await browser.click('.rc-public-server-random-join');
    assert.equal(await browser.evaluate('nativeJoins.at(-1)%3'),2,'Random join falls back to the nearest city with joinable servers');
    await browser.evaluate('nativeJoins=[]');
    assert.equal(await browser.evaluate("performance.getEntriesByType('resource').filter(n=>n.name.endsWith('.mjs')).length"),0,'Geographic assets stay lazy until the map is opened');
    await browser.evaluate("document.querySelector('.rc-public-server-map').open=true");
    try {await browser.waitFor("document.querySelectorAll('.rc-public-server-city-marker').length===1");}
    catch(error){throw new Error(JSON.stringify({errors:browser.errors,state:await browser.evaluate("({hidden:document.hidden,markers:document.querySelectorAll('.rc-public-server-city-marker').length,map:document.querySelector('.rc-public-server-map-canvas').innerHTML.slice(0,400),selected:saved.rcServerLocation,flags:[...document.documentElement.attributes].map(a=>[a.name,a.value])})")}),{cause:error});}
    await browser.waitFor("document.querySelectorAll('[data-rc-globe-country]').length>230");
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-globe-code=SG] .rc-server-globe-count').textContent"),'4');
    // Click the actual country shape using an interior point, rather than invoking its callback.
    const countryPoint=await browser.evaluate(`(()=>{
      const p=document.querySelector('[data-rc-globe-country=MY]');p.closest('svg').scrollIntoView({block:'center'});
      const b=p.getBBox(),m=p.getScreenCTM();
      for(let x=b.x;x<b.x+b.width;x+=2)for(let y=b.y;y<b.y+b.height;y+=2){
        if(!p.isPointInFill(new DOMPoint(x,y)))continue;
        const s=new DOMPoint(x,y).matrixTransform(m);if(document.elementFromPoint(s.x,s.y)===p)return{x:s.x,y:s.y};
      }return null;
    })()`);
    assert.ok(countryPoint,'Malaysia has a clickable geographic outline');
    await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...countryPoint});
    await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...countryPoint});
    await browser.waitFor("document.querySelector('[data-rc-server-filter=country]').value==='MY' && document.querySelector('[data-rc-server-filter=city]').value==='all' && document.querySelector('[data-rc-server-filter=locationMode]').value==='exact'");
    await browser.waitFor("document.querySelector('[data-rc-server-filter=\"country\"]').value==='MY'");
    assert.deepEqual(await visible(),[8,5,2],'A globe click applies the existing country and not-full filters');
    const rotation=await browser.evaluate("document.querySelector('.rc-server-globe svg').dataset.rcGlobeRotation");
    const dragPoint=await browser.evaluate("(()=>{const n=document.querySelector('.rc-server-globe svg');n.scrollIntoView({block:'center'});const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',...dragPoint});
    await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:dragPoint.x+70,y:dragPoint.y+20});
    await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',x:dragPoint.x+70,y:dragPoint.y+20});
    await browser.waitFor(`document.querySelector('.rc-server-globe svg').dataset.rcGlobeRotation!==${JSON.stringify(rotation)}`);
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-server-filter=country]').value"),'MY','Dragging does not accidentally select a country');
    await browser.click('.rc-server-globe-controls button[aria-label="Zoom in"]');
    await browser.waitFor("document.querySelector('.rc-server-globe svg').dataset.rcGlobeZoom==='1.25'");
    await browser.click('.rc-server-globe-controls button[aria-label="Reset globe view"]');
    await browser.waitFor("document.querySelector('.rc-server-globe svg').dataset.rcGlobeZoom==='1.00'");
    await browser.evaluate("(()=>{const n=document.querySelector('.rc-server-globe-search');n.value='Japan';n.dispatchEvent(new Event('input',{bubbles:true}))})()");
    assert.equal(await browser.evaluate("[...document.querySelectorAll('[data-rc-globe-code]')].filter(n=>!n.hidden).map(n=>n.dataset.rcGlobeCode).join()"),'JP');
    await browser.click('[data-rc-globe-code=JP]');
    await browser.waitFor("document.querySelector('[data-rc-server-filter=\"country\"]').value==='JP'");
    assert.deepEqual(await visible(),[],'Countries with no loaded servers remain selectable');
    assert.equal(await browser.evaluate("document.querySelector('.rc-server-globe-selection').textContent.includes('No loaded servers')"),true);
    await browser.evaluate("(()=>{const n=document.querySelector('.rc-server-globe-search');n.value='SG';n.dispatchEvent(new Event('input',{bubbles:true}))})()");
    await browser.click('[data-rc-globe-code=SG]');
    await browser.waitFor("document.querySelector('[data-rc-server-filter=\"country\"]').value==='SG'");
    await browser.waitFor("document.querySelectorAll('.rc-public-server-city-marker').length===1");
    await browser.click('.rc-public-server-city-marker');
    await browser.waitFor("document.querySelector('[data-rc-server-filter=city]').value==='Singapore' && document.querySelector('[data-rc-server-filter=locationMode]').value==='nearest'");
    await edit('minPlayers','2'); await edit('maxPlayers','9'); await edit('maxPing','160');
    assert.deepEqual(await browser.evaluate('serverSelectionWrites'),[],'Changing dropdowns and clicking the globe never writes selections');
    assert.equal(await browser.evaluate("Object.hasOwn(saved,'rcServerLocation')"),false);
    await browser.send('Page.reload');await waitForDocument(browser,'.rc-public-server-filters',url);
    await browser.waitFor("document.querySelector('[data-rc-server-filter=country]').value==='all'");
    assert.deepEqual(await browser.evaluate("Object.fromEntries([...document.querySelectorAll('[data-rc-server-filter]')].map(n=>[n.dataset.rcServerFilter,n.type==='checkbox'?n.checked:n.value]))"),
      {country:'all',city:'all',locationMode:'exact',minLatency:'',maxPing:'',minPlayers:'',maxPlayers:'',playerSort:'default',excludeFull:false},'Reload resets every filter');
    await browser.click('.rc-public-server-filter-toggle');
    await browser.waitFor("document.querySelectorAll('[data-rc-server-city]').length===12");
    await browser.click('.rc-public-server-filter-reset');
    await browser.evaluate("document.querySelector('.rc-public-server-map').open=true");
    await browser.waitFor("document.querySelectorAll('[data-rc-globe-country]').length>230");
    await browser.waitFor("document.querySelector('[data-rc-server-filter=\"country\"]').value==='all'");
    await browser.click('.rc-public-server-random-join');assert.equal((await browser.evaluate('nativeJoins')).length,1);
    assert.equal((await browser.evaluate('nativeJoins'))[0]===11,false,'Random join excludes known full servers');
    await browser.click('[data-rc-server-preset="random"]');await pause(650);
    const shuffled=await visible();await browser.evaluate("document.querySelector('.game-name').append(' ')");await pause(650);
    assert.deepEqual(await visible(),shuffled,'Repainting leaves shuffle stable');
    await browser.evaluate("document.querySelectorAll('.card-item').forEach((n,i)=>n.setAttribute('data-server-started-at',String(Date.now()-i*10000-1000)));document.querySelector('.game-name').append(' ')");
    await browser.waitFor("!document.querySelector('[data-rc-server-filter=\"playerSort\"] option[value=oldest]').disabled");
    await edit('playerSort','newest');await pause(650);assert.equal((await visible())[0],0);
    await edit('playerSort','oldest');await pause(650);assert.equal((await visible())[0],20);
    await browser.click('.rc-public-server-filter-reset');
    const titles={en:'Server filters','zh-CN':'服务器筛选','zh-TW':'伺服器篩選',id:'Filter server',ja:'サーバーフィルター',th:'ตัวกรองเซิร์ฟเวอร์',ko:'서버 필터'};
    for(const locale of Object.keys(titles))for(const theme of ['dark','light'])for(const width of [1280,941,700,390,320]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1200,deviceScaleFactor:1,mobile:false});
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)});document.documentElement.className='${theme}-theme';document.body.className='${theme}-theme'`);
      await browser.waitFor(`document.querySelector('.rc-public-server-filter-header strong').textContent===${JSON.stringify(titles[locale])}`);
      const geometry=await browser.evaluate("(()=>{const p=document.querySelector('.rc-public-server-filters'),r=p.getBoundingClientRect(),s=p.querySelector('.rc-server-globe-search'),a=s.getBoundingClientRect(),b=s.closest('label').getBoundingClientRect(),sidebar=s.closest('.rc-server-globe-sidebar');return{overflow:p.scrollWidth>p.clientWidth+1||document.documentElement.scrollWidth>innerWidth+1,fields:[...p.querySelectorAll('input,select')].every(n=>{const a=n.getBoundingClientRect();return a.width>0&&a.left>=r.left&&a.right<=r.right}),search:a.width>0&&a.left>=b.left-1&&a.right<=b.right+1&&sidebar.scrollWidth<=sidebar.clientWidth+1}})()");
      assert.deepEqual(geometry,{overflow:false,fields:true,search:true},`${locale}/${theme}/${width}`);
      const color=await browser.evaluate("getComputedStyle(document.querySelector('.rc-public-server-filters')).color");
      assert.equal(color,theme==='light'?'rgb(27, 35, 48)':'rgb(244, 246, 251)',`${locale}/${theme}: readable filter text`);
      if(process.env.SERVER_OPTIONS_SCREENSHOT_DIR&&locale==='zh-CN'&&[1280,390].includes(width)){
        const image=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        fs.writeFileSync(path.join(process.env.SERVER_OPTIONS_SCREENSHOT_DIR,`server-options-${theme}-${width}.png`),Buffer.from(image.data,'base64'));
      }
      if(process.env.SERVER_OPTIONS_SCREENSHOT_DIR&&['en','zh-CN'].includes(locale)&&[941,390].includes(width)){
        await browser.evaluate("document.querySelector('.rc-public-server-map').open=false");
        const clip=await browser.evaluate("(()=>{const r=document.querySelector('.rc-public-server-filters').getBoundingClientRect();return{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
        const preview=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
        fs.writeFileSync(path.join(process.env.SERVER_OPTIONS_SCREENSHOT_DIR,`server-filter-layout-${locale}-${theme}-${width}.png`),Buffer.from(preview.data,'base64'));
        await browser.evaluate("document.querySelector('.rc-public-server-map').open=true");
      }
    }
    await browser.evaluate("document.querySelector('[data-rc-server-filter=\"minPlayers\"]').focus()");
    await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    assert.equal(await browser.evaluate("document.activeElement.classList.contains('rc-public-server-filter-toggle') && document.querySelector('.rc-public-server-filter-fields').hidden"),true);
    // After closing, a page mutation must not start a render loop or change the projection.
    await pause(650);
    await browser.evaluate("window.globeMutations=0;window.globeObserver=new MutationObserver(r=>globeMutations+=r.length);globeObserver.observe(document.querySelector('.rc-server-globe svg'),{subtree:true,childList:true,attributes:true});document.querySelector('.game-name').append(' ')");
    await pause(1100);
    assert.equal(await browser.evaluate('globeMutations'),0,'Closed globe stays idle');
    assert.deepEqual(browser.errors,[]);
  });
