const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {test}=require('node:test');
const {isolatedChrome,waitForDocument,pause}=require('./helpers/chrome.cjs');
const workspace=path.resolve(__dirname,'..'),bundleId=13847677942977;
const kinds=['idle','walk','run','jump','fall','climb','swim'];
const scripts=['src/shared/routes.js','src/shared/runtime.js','src/shared/i18n.js','src/assets/tools-ui.js','src/pages/catalog/catalog-item-page.js','src/assets/animation-bundle.js'];
const styles=['src/shared/theme.css','src/pages/catalog/catalog-item-page.css','src/assets/tools.css','src/assets/animation-bundle.css'];
const rendererRoot='src/assets/animation-preview/';
async function pixelAt(browser,x,y){
  const {data}=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  return browser.evaluate(`(async()=>{const image=await createImageBitmap(await(await fetch('data:image/png;base64,${data}')).blob());const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(image,-${Math.floor(x)},-${Math.floor(y)});return [...ctx.getImageData(0,0,1,1).data]})()`);
}
const mockRenderer=`
export const FLAGS={},API={},AvatarType={R15:'R15'};
window.playedAnimations=[];window.animationFrames=0;window.renderFrames=0;window.modelBuilds=0;window.selectionLoads=0;window.maxSelectionLoads=0;
window.previewControls=new EventTarget();window.fetchPreviewResource=(url)=>FLAGS.FETCH_FUNC(url);
export class Authentication{}
export class AnimatorWrapper{constructor(animator){this.data=animator.data;}async loadAvatarAnimation(id,isEmote,loop){if(window.fixtureFailEmote)throw Error('Fixture animation access denied');window.loadedEmote={id:String(id),isEmote,loop};this.data.emotes.set(id,{id:'rbxassetid://999'});this.data.animationTracks.set(999n,{});}}
export class OutfitModel{fromJson(data){this.outfit=structuredClone(data.avatarModel);this.outfit.removeAssetType=type=>{this.outfit.assets=this.outfit.assets.filter(a=>a.assetType.id!==type)};this.outfit.addAsset=(id,type,name)=>this.outfit.assets.push({id,name,assetType:{id:type}});this.emotes=new Map();return this;}}
const connection=()=>({Connect(fn){setTimeout(fn,50)}});
export class OutfitRenderer{constructor(auth,model){window.modelBuilds++;window.loadedModel=model;const animator={data:{emotes:new Map(),animationTracks:new Map()}};this.currentRig={FindFirstChildOfClass:()=>({FindFirstChildOfClass:()=>animator})};this.onSuccess=connection();this.onRenderSuccess=connection();this.onError={Connect(){}};this.onRenderError={Connect(){}};}async setMainAnimation(type){playedAnimations.push(type);window.selectionLoads++;window.maxSelectionLoads=Math.max(window.maxSelectionLoads,window.selectionLoads);if(window.fixtureSelectionDelay)await new Promise(resolve=>setTimeout(resolve,window.fixtureSelectionDelay));window.selectionLoads--;return true}animateOnce(){animationFrames++}centerCamera(){window.cameraReset=true}destroy(){window.destroyed=true}}
const element=document.createElement('div');element.append(document.createElement('canvas'));
export const RBXRenderer={firstScene:{wellLitDirectionalLightIntensity:1,controls:window.previewControls},scenes:[],renderer:{dispose(){},setPixelRatio(value){window.renderPixelRatio=value}},fullSetup:async()=>true,setBackgroundTransparent(){},getRendererElement:()=>element,setRendererSize(){window.rendererResizes=(window.rendererResizes||0)+1},animateAll(){window.renderFrames++}};
`;

const assets={130836074181150:{name:'[LIMITED] Body Tornado',type:61},124765145869332:{name:'adidas Community Animation Pack',type:53},105381637724646:{name:'Pumpkin King',type:61}};
function assetFixture(id){return `<!doctype html><html lang="en" data-rc-ui-active data-rc-frost-page="catalog"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;color:white;font:14px/1.5 Arial;background:linear-gradient(120deg,#9b8173,#4d647b);min-height:100vh}main{width:min(1100px,calc(100% - 24px));margin:20px auto}#item-container{padding:20px}.item-details-thumbnail-container{position:relative;float:left;width:420px;height:420px}.thumbnail-holder{position:relative;width:100%;height:100%;background:#eee}.thumbnail-animation-container{display:block;width:420px;height:420px}.thumbnail-animation-container>div{width:420px;height:420px}.thumbnail-animation-container canvas{display:block;width:420px;height:420px}.inner-thumbnail-ui-container{position:absolute;width:420px;left:0;display:flex;justify-content:space-between}.top-align-container{top:0}.bottom-align-container{bottom:0}.thumbnail-button-container{display:flex;padding:0 10px 10px 0;gap:10px}button{font:inherit}.icon-bigstop,.icon-bigplay{display:block;width:40px;height:40px;background:currentColor;clip-path:polygon(20% 15%,40% 15%,40% 85%,20% 85%,20% 15%,60% 15%,80% 15%,80% 85%,60% 85%,60% 15%)}.icon-bigplay{clip-path:polygon(20% 10%,90% 50%,20% 90%)}.restriction-icon{display:block;background:#40ba64;color:white;font-size:10px;padding:2px 5px}.item-details-info-header{padding-left:440px}#native-buy{padding:12px;width:100%;background:#fc33df;border:0;border-radius:8px;color:white}body[data-palette=custom]{--rc-glass-color:57 75 132;--rc-text:#fff;--rc-text-secondary:#e3e6f3;--rc-control-bg:#40578c;--rc-control-hover:#5068a1;--rc-control-border:#91a4d5;--rc-accent:#fc33ff;--rc-focus:#fc83ff}
@media(max-width:970px){.item-details-thumbnail-container{width:300px;height:300px}}@media(max-width:543px){.item-details-thumbnail-container{width:200px;height:200px}}</style>
${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><main id="content"><div id="item-container"><div id="asset-host" class="clearfix">
<div id="item-thumbnail-container-frontend" data-target-id="${id}" data-is-bundle="false" data-is-animation-bundle="false" data-show-3d-mode-button="true"><div class="item-details-thumbnail-container"><div class="thumbnail-holder"><span class="thumbnail-animation-container"><div><canvas id="native-asset-canvas" width="420" height="420"></canvas></div></span></div><div class="thumbnail-ui-container"><div class="top-align-container inner-thumbnail-ui-container"><div class="left-align-container"></div><div class="right-align-container"></div></div><div class="bottom-align-container inner-thumbnail-ui-container"><div class="left-align-container">${id===130836074181150?'<span class="restriction-icon">LIMITED U</span>':''}</div><div class="right-align-container"><div class="thumbnail-button-container"><button id="native-try-on" onclick="tryOnClicks++;this.textContent=this.textContent==='Try On'?'Take Off':'Try On'">Try On</button><button id="native-asset-play" onclick="const n=this.firstElementChild;n.className=n.className==='icon-bigstop'?'icon-bigplay':'icon-bigstop'"><div class="icon-bigstop"></div></button></div></div></div></div></div></div>
<div id="item-info-container-frontend" data-target-id="${id}" data-is-bundle="false"><div class="item-details-info-header"><h1>${assets[id].name}</h1><p>By Creator</p></div><div class="item-details-info-content"><p>Preview this animation with your current avatar.</p><button id="native-buy" onclick="purchaseClicks++">Buy</button></div></div></div></div></main>
<script>window.tryOnClicks=0;window.purchaseClicks=0;window.nativeCanvas=document.getElementById('native-asset-canvas');const ctx=nativeCanvas.getContext('2d');ctx.fillStyle='#f3a037';ctx.fillRect(155,155,110,130);ctx.fillStyle='#eee';ctx.fillRect(177,90,66,66);ctx.fillRect(100,160,50,115);ctx.fillRect(270,135,50,115);ctx.fillRect(160,290,45,100);ctx.fillRect(215,290,45,100);</script></body></html>`;}

test('individual catalog animations and emotes add a lazy player-avatar preview, retain native controls and fit all themes/locales',
 {skip:!process.env.CHROME_BIN,timeout:60000},async t=>{
  let failEmote=false;
  const files=new Set([...scripts,...styles,rendererRoot+'renderer.css',rendererRoot+'renderer.mjs',rendererRoot+'vendor/draco_decoder.js',rendererRoot+'vendor/assets.mjs']);
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost'),file=url.pathname.slice(1);
    if(file===rendererRoot+'vendor/roavatar-renderer-1.9.12.mjs'){res.setHeader('Content-Type','text/javascript');res.end(mockRenderer);}
    else if(file===rendererRoot+'renderer.html'){
      const id=Number(url.searchParams.get('assetId'));
      const setup=`<script>window.fixtureFailEmote=${failEmote};window.fixtureRequests=[];window.chrome={runtime:{lastError:null,sendMessage(message,callback){fixtureRequests.push(message);queueMicrotask(()=>callback({userId:123,avatar:{avatarModel:{playerAvatarType:'R15',assets:[{id:55,assetType:{id:8}},{id:60,assetType:{id:51}}]}},animations:[{id:${id},assetType:${assets[id].type},name:${JSON.stringify(assets[id].name)}}]}))}}};</script>`;
      res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(workspace,file),'utf8').replace('<body>',setup+'<body>'));
    }else if(files.has(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(path.join(workspace,file)));}
    else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(assetFixture(Number(url.pathname.match(/\/catalog\/(\d+)/)?.[1])||130836074181150));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  const browser=await isolatedChrome(t,'asset-animation-preview');await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.fixtureRequests=[];window.chrome={i18n:{getUILanguage:()=> 'en'},storage:{local:{async get(){return{}},async set(){}},onChanged:{addListener(){}}},runtime:{lastError:null,getURL:file=>location.origin+'/'+file,sendMessage(message){fixtureRequests.push(message)}}};"});
  for(const file of scripts)await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')});
  for(const [id,asset]of Object.entries(assets)){
    const url=`http://127.0.0.1:${server.address().port}/catalog/${id}/Animation`;
    await browser.send('Page.navigate',{url});await waitForDocument(browser,'#rc-animation-user-preview',url);
    assert.equal(await browser.evaluate("!!document.querySelector('.rc-animation-frame,#rc-catalog-item-2d,#rc-catalog-item-3d-refresh')"),false,'Player data loads only after the preview button is selected');
    await browser.evaluate("window.originalNative=[...document.querySelectorAll('#native-asset-canvas,#native-try-on,#native-asset-play,#native-buy')];window.nativeParents=originalNative.map(n=>n.parentElement)");
    for(const lang of ['en','zh-CN','zh-TW','id','ja','th','ko'])for(const palette of ['dark','light','custom'])for(const width of [1200,900,800,390,320]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:false});
      await browser.evaluate(`document.documentElement.className='${palette==='light'?'light':'dark'}-theme';document.body.className=document.documentElement.className;document.body.dataset.palette='${palette}';RobloxCustomizerI18n.setLanguage('${lang}')`);
      const state=await browser.evaluate(`(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height}},host=document.getElementById('asset-host'),native=document.querySelector('[data-rc-item-animation]'),own=document.getElementById('rc-animation-user-preview'),info=document.querySelector('[data-rc-item-info]'),canvas=document.getElementById('native-asset-canvas'),holder=native.querySelector('.thumbnail-holder');return{overflow:document.documentElement.scrollWidth>innerWidth+1,host:rect(host),native:rect(native),own:rect(own),info:rect(info),canvas:rect(canvas),holder:rect(holder),heading:native.getAttribute('data-rc-item-mode'),preserved:originalNative.every((n,i)=>n.isConnected&&n.parentElement===nativeParents[i]),buttons:[...host.querySelectorAll('button')].map(n=>({fits:n.scrollWidth<=n.clientWidth+1,box:rect(n)}))}})()`);
      const label=`${id}/${lang}/${palette}/${width}`;
      assert.equal(state.overflow,false,label);assert.equal(state.preserved,true,label);
      assert.ok(Math.abs(state.canvas.width-state.canvas.height)<1&&Math.abs(state.canvas.width-state.holder.width)<1,`${label}: native canvas stays square and fills its viewport`);
      assert.ok(state.buttons.every(n=>n.fits&&n.box.x>=state.host.x-1&&n.box.right<=state.host.right+1),`${label}: controls fit`);
      if(width>800){assert.ok(state.own.x>=state.native.right-1,label);assert.ok(state.info.y>=Math.max(state.native.bottom,state.own.bottom)-1,label);}
      else assert.ok(state.own.y>=state.native.bottom-1&&state.info.y>=state.own.bottom-1,label);
      if(process.env.ASSET_ANIMATION_SCREENSHOT_DIR&&lang==='en'&&palette==='custom'&&[1200,390].includes(width)){
        const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(process.env.ASSET_ANIMATION_SCREENSHOT_DIR,`asset-${id}-${width}.png`),Buffer.from(shot.data,'base64'));
      }
    }
    assert.deepEqual(await browser.evaluate('fixtureRequests'),[],'Layout alone does not read the player avatar');
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");await browser.send('Emulation.setDeviceMetricsOverride',{width:1200,height:1100,deviceScaleFactor:1,mobile:false});
    await browser.click('#rc-animation-user-preview .rc-animation-heading button');
    const expected=asset.type===61?`emote.${id}`:'run';
    await browser.waitFor(`document.querySelector('.rc-animation-frame')?.contentWindow.playedAnimations?.includes('${expected}')`);
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.rc-animation-placeholder')).display"),'none');
    assert.equal(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.fixtureRequests[0].assetId"),Number(id));
    const worn=await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.loadedModel.outfit.assets.map(n=>n.id)");
    assert.deepEqual(worn,asset.type===61?[55]:[55,Number(id)],'Keep the player accessories; emotes are played directly rather than worn as accessories');
    if(asset.type===61)assert.deepEqual(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.loadedEmote"),{id,isEmote:true,loop:true});
    await browser.click('#native-asset-play');await pause(100);
    const frames=await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.animationFrames");await pause(120);
    assert.equal(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.animationFrames"),frames,'Native pause stops player-avatar motion');
    await browser.click('#native-asset-play');await browser.waitFor(`document.querySelector('.rc-animation-frame').contentWindow.animationFrames>${frames}`);
    await browser.click('#native-try-on');await browser.click('#native-buy');
    assert.deepEqual(await browser.evaluate('[tryOnClicks,purchaseClicks]'),[1,1]);
    assert.equal(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.fixtureRequests.filter(n=>n.action==='load').length"),1);
    await browser.evaluate("history.pushState({},'','/home');dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("!document.querySelector('#rc-animation-user-preview,[data-rc-item-animation]')");
  }
  failEmote=true;
  const errorUrl=`http://127.0.0.1:${server.address().port}/catalog/130836074181150/Animation`;
  await browser.send('Page.navigate',{url:errorUrl});await waitForDocument(browser,'#rc-animation-user-preview',errorUrl);
  await browser.click('#rc-animation-user-preview .rc-animation-heading button');
  await browser.waitFor("document.querySelector('.rc-animation-status').textContent==='Could not load the avatar preview. Try again.'&&!document.querySelector('.rc-animation-heading button').disabled");
  failEmote=false;await browser.click('#rc-animation-user-preview .rc-animation-heading button');
  await browser.waitFor("document.querySelector('.rc-animation-frame')?.contentWindow.playedAnimations?.includes('emote.130836074181150')");
  assert.deepEqual(browser.errors,[]);
});
function buttons(){return kinds.map((k,i)=>`<button class="${i?'':'selected '}bundle-animation-button btn-control" onclick="selectAnimation('${k}',this)"><div class="animation-icon icon-animation-${k}"></div></button>`).join('');}
function fixture(){return `<!doctype html><html lang="en" data-rc-ui-active data-rc-frost-page="catalog"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:24px;background:#323441;color:white;font:14px/1.5 Arial}main{max-width:1000px;margin:auto}button{font:inherit}canvas{width:100%;height:100%;background:radial-gradient(ellipse,#859ac0,#465778)}.item-details-thumbnail-container{width:420px;height:420px;position:relative}.thumbnail-holder{height:100%}.thumbnail-ui-container{position:absolute;bottom:0}.inner-thumbnail-ui-container{display:flex;position:relative;width:420px}.bundle-animation-label{width:320px;white-space:nowrap;overflow:hidden}.bundle-animation-button{width:40px;height:40px}#native-buy{padding:8px}</style>
${styles.map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}</head><body class="dark-theme"><main id="content"><div id="item-container"><div class="clearfix" id="native-host">
<div id="item-thumbnail-container-frontend" data-target-id="${bundleId}" data-is-bundle="true" data-is-animation-bundle="true" data-show-3d-mode-button="true"><div class="item-details-thumbnail-container"><div class="thumbnail-holder"><span class="thumbnail-animation-container"><canvas id="native-animation"></canvas></span></div><div class="thumbnail-ui-container"><div class="bottom-align-container inner-thumbnail-ui-container"><div class="left-align-container"><div class="bundle-animation-btn-container"><h2 class="bundle-animation-label">Annoying Mini Me Animation Pack - Idle</h2>${buttons()}</div></div><div class="right-align-container"><div class="thumbnail-button-container"><button onclick="this.firstElementChild.className=this.firstElementChild.className==='icon-bigstop'?'icon-bigplay':'icon-bigstop'"><div class="icon-bigstop"></div></button></div></div></div></div></div></div>
<div id="item-info-container-frontend" data-target-id="${bundleId}" data-is-bundle="true"><h1>Annoying Mini Me Animation Pack</h1><button id="native-buy" onclick="purchaseClicks++">Buy</button></div></div></div></main>
<script>window.purchaseClicks=0;window.nativeCanvas=document.querySelector('#native-animation');window.selectAnimation=(kind,button)=>{document.querySelectorAll('.bundle-animation-button').forEach(n=>n.classList.toggle('selected',n===button));document.querySelector('.bundle-animation-label').textContent='Annoying Mini Me Animation Pack - '+kind};</script></body></html>`;}

test('animation packs keep native motion and purchase controls beside a lazy avatar preview, synchronize playback, and clean up',
 {skip:!process.env.CHROME_BIN,timeout:45000},async t=>{
  const files=new Set([...scripts,...styles,rendererRoot+'renderer.css',rendererRoot+'renderer.mjs',rendererRoot+'vendor/draco_decoder.js',rendererRoot+'vendor/assets.mjs']);
  const server=http.createServer((req,res)=>{
    const file=new URL(req.url,'http://localhost').pathname.slice(1);
    if(file===rendererRoot+'vendor/roavatar-renderer-1.9.12.mjs'){res.setHeader('Content-Type','text/javascript');res.end(mockRenderer);}
    else if(file===rendererRoot+'renderer.html'){
      const setup=`<script>window.fixtureRequests=[];window.chrome={runtime:{lastError:null,sendMessage(message,callback){fixtureRequests.push(message);queueMicrotask(()=>callback({userId:123,avatar:{avatarModel:{playerAvatarType:'R15',assets:[{id:55,assetType:{id:8}},{id:60,assetType:{id:51}}]}},animations:[51,55,53,52,50,48,54].map((assetType,i)=>({id:100+i,assetType,name:'Animation '+assetType}))}))}}};</script>`;
      res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(workspace,file),'utf8').replace('<body>',setup+'<body>'));
    }else if(files.has(file)){res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(path.join(workspace,file)));}
    else{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture());}
  });
  await new Promise(resolve=>server.listen(Number(process.env.ANIMATION_PREVIEW_TEST_PORT)||0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  const browser=await isolatedChrome(t,'animation-preview');await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.chrome={i18n:{getUILanguage:()=> 'en'},storage:{local:{async get(){return{}},async set(){}},onChanged:{addListener(){}}},runtime:{lastError:null,getURL:file=>location.origin+'/'+file,sendMessage(){}}};"});
  for(const file of scripts)await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')});
  const url=`http://127.0.0.1:${server.address().port}/bundles/${bundleId}/Animation-Pack`;await browser.send('Page.navigate',{url});await waitForDocument(browser,'#rc-animation-user-preview',url);
  assert.equal(await browser.evaluate("!!document.querySelector('#rc-catalog-item-2d')"),false,'Animation bundles bypass the static-thumbnail layout');
  assert.equal(await browser.evaluate("document.querySelector('#native-animation')===nativeCanvas"),true);assert.equal(await browser.evaluate("!!document.querySelector('.rc-animation-frame')"),false,'Loading the current avatar is explicit');
  for(const lang of ['en','zh-CN','zh-TW','id','ja','th','ko']){
    await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${lang}')`);
    for(const width of [1200,390,320]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await pause(15);
      const result=await browser.evaluate(`(()=>{const host=document.querySelector('#native-host').getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,bad:[...document.querySelectorAll('#native-host button')].filter(n=>{const b=n.getBoundingClientRect();return b.width>0&&(b.left<host.left||b.right>host.right+1)}).map(n=>n.outerHTML),labels:[...document.querySelectorAll('.bundle-animation-button')].map(n=>n.getAttribute('aria-label'))}})()`);
      assert.equal(result.overflow,false,`${lang}/${width}: no page overflow`);assert.deepEqual(result.bad,[]);assert.ok(result.labels.every(Boolean),'Native icon controls get accessible action names');
    }
  }
  await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");await browser.send('Emulation.setDeviceMetricsOverride',{width:1200,height:1000,deviceScaleFactor:1,mobile:false});
  await pause(50);
  await browser.evaluate(`(() => {
    window.motionScans=0;window.detailsScans=0;
    const preview=document.querySelector('#item-thumbnail-container-frontend'),scan=preview.querySelectorAll.bind(preview);
    preview.querySelectorAll=function(selector){if(selector==='.bundle-animation-button')motionScans++;return scan(selector)};
    const query=document.querySelector.bind(document);window.restoreCatalogQuery=()=>{document.querySelector=query};
    document.querySelector=function(selector){if(selector==='#item-info-container-frontend')detailsScans++;return query(selector)};
  })()`);
  await browser.evaluate(`new Promise(resolve=>{let step=0;const tick=()=>{document.querySelector('#native-animation').className='orbit-frame-'+step;
    document.body.classList.toggle('unrelated-hover');if(++step<16)requestAnimationFrame(tick);else resolve()};requestAnimationFrame(tick)})`);
  await pause(40);
  assert.deepEqual(await browser.evaluate('[motionScans,detailsScans]'),[0,0],'Camera and unrelated hover mutations do not rescan controls or catalog details');
  await browser.evaluate('restoreCatalogQuery()');
  await browser.click('#rc-animation-user-preview .rc-animation-heading button');
  await browser.waitFor("document.querySelector('.rc-animation-frame')?.contentWindow.playedAnimations?.includes('idle')");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.rc-animation-placeholder')).display"),'none','The loaded model is not covered by the placeholder');
  for(const scheme of ['dark','light']){
    await browser.evaluate(`document.documentElement.style.colorScheme='${scheme}';document.querySelector('.rc-animation-frame').scrollIntoView({block:'center'})`);
    const point=await browser.evaluate("(()=>{const b=document.querySelector('.rc-animation-frame').getBoundingClientRect();return {x:b.left+24,y:b.top+24}})()");
    const visible=await pixelAt(browser,point.x,point.y);
    await browser.evaluate("document.querySelector('.rc-animation-frame').style.visibility='hidden'");
    const backing=await pixelAt(browser,point.x,point.y);
    await browser.evaluate("document.querySelector('.rc-animation-frame').style.visibility=''");
    assert.deepEqual(visible,backing,`${scheme}: transparent preview exposes the same themed UI beneath the iframe`);
  }
  assert.deepEqual(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.loadedModel.outfit.assets.map(n=>n.id)"),[55,100,101,102,103,104,105,106],'Keep worn accessories and replace only animation types in the preview');
  assert.equal(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.playedAnimations.filter(n=>n==='idle').length"),1,'Initialization applies the selected animation once');
  const cameraAudit=await browser.evaluate(`new Promise(resolve=>{const w=document.querySelector('.rc-animation-frame').contentWindow;
    w.previewControls.dispatchEvent(new w.Event('start'));const start=w.renderFrames;let ticks=0;
    const audit=()=>{if(++ticks<20)w.requestAnimationFrame(audit);else{w.previewControls.dispatchEvent(new w.Event('end'));resolve({ticks,draws:w.renderFrames-start})}};w.requestAnimationFrame(audit)})`);
  assert.ok(cameraAudit.draws>=cameraAudit.ticks-1,'Camera dragging is drawn at display cadence instead of being limited to the avatar animation rate');
  await browser.evaluate(`const animationWindow=document.querySelector('.rc-animation-frame').contentWindow;
    animationWindow.fixtureSelectionDelay=80;animationWindow.postMessage({type:'rc-animation-preview-control',bundleId:${bundleId},action:'select',animationType:'run'},location.origin)`);
  await browser.waitFor("document.querySelector('.rc-animation-frame').contentWindow.playedAnimations.at(-1)==='run'");
  await browser.evaluate(`for(const animationType of ['jump','fall','swim'])animationWindow.postMessage({type:'rc-animation-preview-control',bundleId:${bundleId},action:'select',animationType},location.origin)`);
  await browser.waitFor("document.querySelector('.rc-animation-frame').contentWindow.playedAnimations.at(-1)==='swim'&&document.querySelector('.rc-animation-frame').contentWindow.selectionLoads===0");
  assert.equal(await browser.evaluate('animationWindow.maxSelectionLoads'),1,'Rapid changes serialize loading and apply the latest choice');
  assert.equal(await browser.evaluate('animationWindow.modelBuilds'),1,'Orbit and animation changes reuse the loaded model');
  const decoded=await browser.evaluate(`(async()=>{const w=animationWindow,original=w.chrome.runtime.sendMessage;
    const text='a'.repeat(2*1024*1024+2),base64=w.btoa(text);w.chrome.runtime.sendMessage=(message,callback)=>callback({base64,status:200,mime:'application/octet-stream'});
    let turns=0,done=false;const timer=w.setInterval(()=>{if(!done)turns++},0);
    try{const buffer=await(await w.fetchPreviewResource('https://c1.rbxcdn.com/performance-fixture')).arrayBuffer();
      return {length:buffer.byteLength,valid:new Uint8Array(buffer).every(byte=>byte===97),turns};}
    finally{done=true;w.clearInterval(timer);w.chrome.runtime.sendMessage=original}})()`);
  assert.equal(decoded.length,2*1024*1024+2);assert.equal(decoded.valid,true);
  assert.ok(decoded.turns>0,'Large resource decoding yields to the event loop');
  await browser.click('.bundle-animation-button:has(.icon-animation-swim)');await browser.waitFor("document.querySelector('.rc-animation-frame').contentWindow.playedAnimations.at(-1)==='swim'");
  await browser.click('[data-rc-animation-playback]');await pause(80);
  const frames=await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.animationFrames");await pause(120);
  assert.equal(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.animationFrames"),frames,'Pausing the native animation pauses avatar motion');
  await browser.click('[data-rc-animation-playback]');await browser.waitFor(`document.querySelector('.rc-animation-frame').contentWindow.animationFrames>${frames}`);
  await browser.click('.rc-animation-actions button');await browser.waitFor("document.querySelector('.rc-animation-frame').contentWindow.cameraReset===true");
  assert.equal(await browser.evaluate("document.querySelector('.rc-animation-frame').contentWindow.fixtureRequests.filter(n=>n.action==='load').length"),1);
  await browser.click('#native-buy');assert.equal(await browser.evaluate('purchaseClicks'),1);
  await browser.evaluate("history.pushState({},'','/home');dispatchEvent(new PopStateEvent('popstate'))");await browser.waitFor("!document.querySelector('#rc-animation-user-preview')");
  assert.equal(await browser.evaluate("document.querySelector('#native-host').hasAttribute('data-rc-animation-studio')"),false);assert.deepEqual(browser.errors,[]);
});
