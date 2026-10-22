const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const binaryFixture=require('./fixtures/resource-model.cjs');
const scripts = ['src/shared/dialogs.js', 'src/privacy/streamer-mode.js', 'src/shared/routes.js', 'src/shared/runtime.js',
  'src/shared/native-labels.js', 'src/shared/i18n.js', 'src/shared/startup.js', 'src/settings/settings.js',
  'src/pages/catalog/catalog-item-page.js', 'src/pages/avatar/avatar-page.js',
  'src/assets/vendor/fzstd-0.1.1.js','src/assets/model-reader.js','src/assets/asset-core.js', 'src/assets/tools-ui.js', 'src/assets/model-schema.js', 'src/assets/resource-explorer.js', 'src/assets/asset-tools.js', 'src/assets/avatar-tools.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css', 'src/privacy/streamer-mode.css', 'src/assets/tools.css',
  'src/pages/catalog/catalog-item-page.css','src/pages/avatar/avatar-page.css'];
const xml = '<roblox version="4"><Item class="Model" referent="RBX0"><Properties><string name="Name">&lt;img src=x onerror=alert(1)&gt;</string></Properties><Item class="Animation" referent="RBX1"><Properties><string name="Name">Dance</string><Content name="AnimationId"><url>rbxassetid://1234</url></Content></Properties></Item></Item></roblox>';
const setup = `
  const listeners=[];window.requests=[];window.nativeClicks=[];
  const failedDetails=new Set();window.failFirstItemDetails=false;
  const read=()=>({source:'none',glassBlur:22,glassOpacity:62,...JSON.parse(localStorage.getItem('preferences')||'{}')});
  const colors=Object.fromEntries(['head','torso','rightArm','leftArm','rightLeg','leftLeg'].map(k=>[k+'Color3','#FFFFFF']));
  const bounds=Object.fromEntries(['position','rotation','scale'].map(g=>[g,Object.fromEntries(['X','Y','Z'].map(a=>[a,{min:g==='scale'?.8:g==='rotation'?-30:-.25,max:g==='scale'?1.2:g==='rotation'?30:.25}]))]));
  window.chrome={i18n:{getUILanguage:()=> 'en'},storage:{local:{async get(){return {customBackground:read(),robloxCustomizerTermsAccepted:true}},async set(value){if(value.customBackground){localStorage.setItem('preferences',JSON.stringify(value.customBackground));listeners.forEach(fn=>fn({customBackground:{newValue:value.customBackground}},'local'))}},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
    requests.push(message);
    if(message.type==='rc-asset-tools'&&message.action==='details'&&window.failFirstItemDetails&&!failedDetails.has(message.assetId)){
      failedDetails.add(message.assetId);setTimeout(()=>{chrome.runtime.lastError={message:'The message port closed before a response was received.'};callback();chrome.runtime.lastError=null},5);return;
    }
    let response;
    if(message.type==='rc-asset-tools') response=message.action==='details'?{id:message.assetId,itemType:'Asset',name:'Test item',creator:'Search',created:'2020-01-02T00:00:00Z',updated:'2026-10-21T00:00:00Z',sales:0,supply:null,remaining:null}: {base64:window.resourceFixture||(new URL(location.href).searchParams.get('resource')==='binary'?${JSON.stringify(binaryFixture.model().toString('base64'))}:${JSON.stringify(Buffer.from(xml).toString('base64'))})};
    else if(message.type==='rc-avatar-tools') response=message.action==='load'?{userId:77,bodyColors:colors,assets:[{id:123,name:'Search',typeId:8,bounds,meta:{position:{X:0,Y:0,Z:0},rotation:{X:0,Y:0,Z:0},scale:{X:1,Y:1,Z:1}}}]}:{ok:true};
    else response={error:'Optional fixture data unavailable'};
    setTimeout(()=>callback(response),5);
  }}};
`;
function fixture(url) {
  const avatar=url.pathname.includes('/my/avatar');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*{box-sizing:border-box}body{margin:12px;font:15px/1.5 Arial;background:#24252c;color:white}main{max-width:1000px;margin:auto}button{font:inherit;padding:8px}#settings-popover-menu{position:fixed;right:0;top:0;z-index:1000}#settings-popover-menu a{display:block;padding:12px}a{color:inherit}</style>
  ${styles.map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}</head><body class="dark-theme">
  <header><span id="nav-robux-amount">1200 Robux</span></header><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>
  <section class="friend-carousel-container">Private friends</section><div id="chat-container">Private chat</div><div id="messages-web-app">Private messages</div>
  <main id="content">${avatar?'<div id="avatar-container"><h1>Native avatar editor</h1><button id="native-avatar-button">Native editor control</button></div>':`<div id="item-thumbnail-container-frontend" data-target-id="123" data-show-3d-mode-button="true"><div class="item-details-thumbnail-container"><div class="thumbnail-holder"><canvas width="200" height="100"></canvas></div><div class="thumbnail-ui-container"><button id="native-mode" aria-label="Switch to 3D view" onclick="nativeClicks.push('3d');this.setAttribute('aria-label','Switch to 2D view')">3D</button><button id="native-try" onclick="nativeClicks.push('try')">Try On</button></div></div></div>
  <div id="item-info-container-frontend" data-target-id="123"><div class="item-details-info-header"><div class="item-details-name-row"><h1>Native item</h1></div><div class="item-details-creator-container">By <a href="#creator">Search</a></div></div>
  <div class="item-details-section"><div class="item-info-row-container"><div class="row-label">Description</div><div class="row-content"><p class="description-content">A native description preserved by the extension.</p></div></div>
  <div class="price-row-container"><div class="item-info-row-container"><div class="row-label">Price</div><div class="row-content"><span class="text-robux-lg">70</span></div></div><button class="btn-primary-lg" id="native-buy" onclick="nativeClicks.push('buy')">Buy</button><button class="btn-secondary-lg" id="native-cart" onclick="nativeClicks.push('cart')">Add to cart</button></div>
  <div class="item-info-row-container" id="native-type"><div class="row-label">Type</div><div class="row-content">Head Accessories</div></div>
  <div class="item-info-row-container" id="native-created"><div class="row-label">Created</div><div class="row-content">Jan 2, 2020</div></div></div></div>
  <div id="favorites-button"><button id="native-favorite" onclick="nativeClicks.push('favorite')">Favorite</button></div>`}</main></body></html>`;
}
async function launch(t,name,route) {
  const files=new Set([...scripts,...styles,'icons/icon-48.png','icons/icon-128.png']);
  const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=url.pathname.slice(1);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');res.end(files.has(file)?fs.readFileSync(path.join(workspace,file)):fixture(url));});
  await new Promise(resolve=>server.listen(Number(process.env.ASSET_TOOLS_TEST_PORT)||0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  const browser=await isolatedChrome(t,name);
  await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:setup});
  for(const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')+'\n//# sourceURL='+file});
  const url=`http://127.0.0.1:${server.address().port}${route}`;
  await browser.send('Page.navigate',{url});await waitForDocument(browser,'main',url);
  return {browser,url};
}

test('new shop items recover closed metadata ports across SPA navigation without refreshing or painting stale details',
  {skip:!process.env.CHROME_BIN,timeout:20000},async t=>{
    const {browser}=await launch(t,'item-message-recovery','/catalog/123/First');
    await browser.waitFor("!!document.querySelector('[data-rc-asset-field=sales]')");
    await browser.evaluate(`window.fixtureNavigations=0;window.failFirstItemDetails=true;
      addEventListener('beforeunload',()=>fixtureNavigations++);
      window.switchItem=id=>{history.pushState({},'','/catalog/'+id+'/Item');
        document.querySelector('#item-info-container-frontend').setAttribute('data-target-id',id);
        document.querySelector('#item-thumbnail-container-frontend').setAttribute('data-target-id',id);
        document.querySelector('h1').textContent='Native item '+id;dispatchEvent(new PopStateEvent('popstate'))};`);
    for(const id of [456,789,2623795]){
      await browser.evaluate(`switchItem(${id})`);
      await browser.waitFor(`!!document.querySelector('[data-rc-asset-field=sales]')&&document.querySelector('#rc-asset-tools .rc-tools-status').textContent===''`);
      assert.equal(await browser.evaluate(`requests.filter(n=>n.type==='rc-asset-tools'&&n.action==='details'&&n.assetId===${id}).length`),2,'Retry the interrupted read once, without user refresh');
      assert.equal(await browser.evaluate("document.querySelector('[data-rc-asset-field=id] .rc-asset-field-value > span').textContent"),String(id));
      assert.equal(await browser.evaluate("document.querySelectorAll('#rc-asset-tools').length"),1);
    }
    await browser.evaluate('switchItem(111)');
    await browser.waitFor("requests.some(n=>n.type==='rc-asset-tools'&&n.assetId===111)");
    await browser.evaluate('switchItem(222)');
    await browser.waitFor("document.querySelector('[data-rc-asset-field=id] .rc-asset-field-value > span')?.textContent==='222'&&!!document.querySelector('[data-rc-asset-field=sales]')");
    await pause(200);
    assert.equal(await browser.evaluate("requests.filter(n=>n.type==='rc-asset-tools'&&n.assetId===111).length"),1,'A departed item is not retried');
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-asset-field=id] .rc-asset-field-value > span').textContent"),'222');
    assert.equal(await browser.evaluate('fixtureNavigations'),0);
    assert.deepEqual(browser.errors,[]);
  });
async function button(browser,root,label) {
  const selector=await browser.evaluate(`(()=>{const b=[...document.querySelectorAll('${root} button')].find(n=>n.textContent===RobloxCustomizerI18n.t(${JSON.stringify(label)}));if(!b)throw Error('Button missing: '+${JSON.stringify(label)});b.dataset.testAction='selected';return '${root} button[data-test-action=selected]'})()`);
  await browser.click(selector);await browser.evaluate("document.querySelector('[data-test-action=selected]')?.removeAttribute('data-test-action')");
}
async function fit(browser,root) {
  for(const locale of ['en','zh-CN','zh-TW','id','ja','th','ko']) {
    await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
    await browser.evaluate(`(()=>{const labels={en:'Created','zh-CN':'创建日期','zh-TW':'建立日期',id:'Dibuat',ja:'作成日',th:'วันที่สร้าง',ko:'생성일'};const label=document.querySelector('#native-created .row-label');if(label)label.textContent=labels['${locale}']})()`);
    for(const theme of ['dark','light','custom']) for(const width of [1200,390,320]) {
      await browser.evaluate(`document.body.className='${theme==='light'?'light':'dark'}-theme';RobloxCustomizerStartup.setPreferences({source:'none',experimentalCustomColors:${theme==='custom'},customTextColor:'#ffffff',customBackgroundColor:'#394b84',customAccentColor:'#fc33ff'})`);
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await pause(15);
      const bad=await browser.evaluate(`(()=>{const r=document.querySelector('${root}').getBoundingClientRect();return [...document.querySelectorAll('${root} button,${root} input,${root} select,${root} fieldset,${root} .rc-tools-metadata>div')].filter(n=>n.getBoundingClientRect().width>0).filter(n=>{const b=n.getBoundingClientRect();return b.left<r.left||b.right>r.right+1}).map(n=>n.outerHTML)})()`);
      assert.deepEqual(bad,[],`${root} ${locale}/${width}: controls fit`);
      assert.equal(await browser.evaluate('document.documentElement.scrollWidth>innerWidth'),false,`${locale}/${width}: page fits`);
      assert.notEqual(await browser.evaluate(`getComputedStyle(document.querySelector('${root} button')).backgroundColor`),'rgba(0, 0, 0, 0)',`${locale}/${width}: controls have a readable surface`);
    }
  }
  await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");
}
async function screenshot(browser,root,name) {
  if(!process.env.ASSET_TOOLS_SCREENSHOTS)return;
  for(const width of [1200,390]) {
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
    await browser.evaluate(`RobloxCustomizerI18n.setLanguage('zh-CN');document.querySelector('#settings-popover-menu').hidden=true;document.querySelector('${root}').scrollIntoView({block:'start'})`);
    await pause(50);
    const result=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(path.join(process.env.ASSET_TOOLS_SCREENSHOTS,`${name}-${width}.png`),Buffer.from(result.data,'base64'));
  }
}

test('Streamer settings hide late sensitive content, persist on reload, and restore native UI', {skip:!process.env.CHROME_BIN,timeout:45000},async t=>{
  const {browser,url}=await launch(t,'streamer-tools','/home');
  await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#nav-robux-amount')).visibility"),'visible');
  await browser.click('.rc-settings-menu-entry');
  await browser.waitFor("!!document.querySelector('#rc-streamer-settings input')");
  await browser.click('[data-rc-settings-category=privacy]');
  assert.equal(await browser.evaluate("document.querySelector('[name=streamerHideFriends]').disabled"),true);
  await browser.click('[name=streamerMode]');
  const hidden="['#nav-robux-amount','.friend-carousel-container','#chat-container','#messages-web-app'].map(s=>getComputedStyle(document.querySelector(s)).visibility)";
  await browser.waitFor("document.documentElement.hasAttribute('data-rc-streamer-active')");
  assert.deepEqual(await browser.evaluate(hidden),['hidden','hidden','hidden','hidden']);
  await browser.evaluate("document.querySelector('.friend-carousel-container').outerHTML='<section class=friend-carousel-container>Late private friends</section>';document.querySelector('#chat-container').outerHTML='<div id=chat-container>Late chat</div>'");
  assert.deepEqual(await browser.evaluate(hidden),['hidden','hidden','hidden','hidden']);
  await browser.click('[name=streamerHideFriends]');
  assert.deepEqual(await browser.evaluate(hidden),['hidden','visible','hidden','hidden']);
  await browser.send('Page.reload');await waitForDocument(browser,'main',url);
  assert.deepEqual(await browser.evaluate(hidden),['hidden','visible','hidden','hidden']);
  await browser.click('.rc-settings-menu-entry');await browser.click('[data-rc-settings-category=privacy]');await browser.click('[name=streamerMode]');
  assert.deepEqual(await browser.evaluate(hidden),['visible','visible','visible','visible']);
  assert.equal(await browser.evaluate("document.querySelector('#messages-web-app').textContent"),'Private messages');
  assert.deepEqual(browser.errors,[]);
});

test('Item tools extend native details without a submenu, preserve purchases, and inspect accessible resources on demand', {skip:!process.env.CHROME_BIN,timeout:60000},async t=>{
  const {browser}=await launch(t,'asset-tools','/catalog/123/Test');
  await browser.waitFor("!!document.querySelector('#rc-asset-tools')");
  await browser.waitFor("!!document.querySelector('[data-rc-asset-field=sales]')");
  await browser.evaluate(fs.readFileSync(path.join(workspace,'src/assets/asset-tools.js'),'utf8'));
  assert.equal(await browser.evaluate("document.querySelectorAll('#rc-asset-tools').length"),1,'Repeated content-script initialization cannot create competing layouts');
  assert.equal(await browser.evaluate("requests.filter(n=>n.type==='rc-asset-tools'&&n.action==='details').length"),1);
  assert.equal(await browser.evaluate("document.querySelector('#rc-asset-tools').tagName"),'SECTION');
  assert.equal(await browser.evaluate("!!document.querySelector('#rc-asset-tools>summary,.rc-resource-explorer>summary')"),false,'No outer or nested tools menu');
  assert.equal(await browser.evaluate("document.querySelector('#rc-asset-tools').parentElement.className"),'item-details-section');
  assert.equal(await browser.evaluate("!!document.querySelector('[data-rc-asset-field=created]')"),false,'Native creation date is not duplicated');
  assert.equal(await browser.evaluate("document.querySelector('#native-created .row-content').textContent"),'Jan 2, 2020');
  assert.equal(await browser.evaluate("document.querySelector('[data-rc-asset-field=sales] .row-content').textContent"),'0');
  assert.equal(await browser.evaluate("!!document.querySelector('[data-rc-asset-field=supply],[data-rc-asset-field=remaining]')"),false,'Unavailable counts do not add empty rows');
  assert.equal(await browser.evaluate("document.querySelector('.rc-asset-copy').closest('[data-rc-asset-field]').dataset.rcAssetField"),'id');
  await browser.evaluate("window.nativeBuy=document.querySelector('#native-buy');window.nativeCanvas=document.querySelector('canvas');nativeClicks.length=0");
  await browser.click('#native-try');await browser.click('#native-buy');await browser.click('#native-cart');await browser.click('#native-favorite');
  assert.deepEqual(await browser.evaluate('nativeClicks'),['try','buy','cart','favorite'],'The actual native controls keep their handlers');
  assert.equal(await browser.evaluate("document.querySelector('#native-buy')===nativeBuy&&document.querySelector('canvas')===nativeCanvas"),true,'Native nodes are preserved');
  await browser.evaluate("nativeBuy.disabled=true");await browser.click('#native-buy');
  assert.equal(await browser.evaluate('nativeClicks.length'),4,'Disabled purchase stays disabled');
  await browser.evaluate("nativeBuy.disabled=false");
  assert.equal(await browser.evaluate("requests.filter(n=>n.action==='content').length"),0);
  await button(browser,'#rc-asset-tools','Load resource');
  await browser.waitFor("!!document.querySelector('.rc-object-row')");
  assert.equal(await browser.evaluate("document.querySelector('.rc-object-name').textContent"),'<img src=x onerror=alert(1)>');
  assert.equal(await browser.evaluate("!!document.querySelector('.rc-resource-tree img')"),false,'Resource names cannot insert markup');
  await browser.click('.rc-object-row[data-node-key="1"]');
  await browser.waitFor("!!document.querySelector('.rc-properties-list a')");
  assert.equal(await browser.evaluate("document.querySelector('.rc-properties-list a').href"),'https://www.roblox.com/catalog/1234');
  await browser.evaluate("const search=document.querySelector('.rc-explorer-objects input');search.value='Dance';search.dispatchEvent(new Event('input'))");
  assert.equal(await browser.evaluate("[...document.querySelectorAll('.rc-object-name')].at(-1).textContent"),'Dance');
  const downloads=fs.mkdtempSync(path.join(workspace,'.tmp-asset-download-'));
  t.after(()=>{assert.equal(path.dirname(path.resolve(downloads)),workspace);fs.rmSync(downloads,{recursive:true,force:true})});
  await browser.send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
  await button(browser,'#rc-asset-tools','Download file');
  const target=path.join(downloads,'roblox-asset-123.rbxmx');
  for(let n=0;!fs.existsSync(target)&&n<60;n++)await pause(50);
  assert.equal(fs.readFileSync(target,'utf8'),xml);
  await fit(browser,'#item-info-container-frontend');
  assert.equal(await browser.evaluate("!!document.querySelector('[data-rc-asset-field=created]')"),false,'Native labels in every supported language deduplicate');
  await screenshot(browser,'#item-info-container-frontend','item');
  await browser.evaluate(`(()=>{const row=document.createElement('div');row.id='native-updated';row.className='item-info-row-container';row.innerHTML='<div class="row-label">Updated</div><div class="row-content">Native update date</div>';document.querySelector('.item-details-section').append(row)})()`);
  await browser.waitFor("!document.querySelector('[data-rc-asset-field=updated]')");
  assert.equal(await browser.evaluate("document.querySelector('#native-updated .row-content').textContent"),'Native update date','Late native fields replace only the added duplicate');
  await browser.evaluate(`(()=>{const row=document.createElement('div');row.id='native-id';row.className='item-info-row-container';row.innerHTML='<div class="row-label">Asset ID</div><div class="row-content">123</div>';document.querySelector('.item-details-section').append(row)})()`);
  await browser.waitFor("!!document.querySelector('#native-id .rc-asset-copy')&&!document.querySelector('[data-rc-asset-field=id]')");
  const count=await browser.evaluate("requests.filter(n=>n.type==='rc-asset-tools').length");
  await browser.evaluate(`(()=>{const section=document.querySelector('.item-details-section'),replacement=document.createElement('div');replacement.className='item-details-section';replacement.innerHTML=[...section.children].filter(n=>!n.hasAttribute('data-rc-tools-root')).map(n=>n.outerHTML).join('');replacement.querySelectorAll('[data-rc-tools-root]').forEach(n=>n.remove());section.replaceWith(replacement)})()`);
  await browser.waitFor("!!document.querySelector('.item-details-section>#rc-asset-tools .rc-object-row')");
  assert.equal(await browser.evaluate("requests.filter(n=>n.type==='rc-asset-tools').length"),count,'Native rerenders reuse the loaded resource');
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-asset-copy').length"),1);
  await browser.evaluate("history.pushState({},'','/home');dispatchEvent(new PopStateEvent('popstate'))");
  await browser.waitFor("!document.querySelector('#rc-asset-tools,.rc-asset-copy,[data-rc-asset-field]')");assert.deepEqual(browser.errors,[]);
});

test('Binary explorer selects typed properties, follows references, keeps source inert, and virtualizes large models', {skip:!process.env.CHROME_BIN,timeout:60000},async t=>{
  const {browser}=await launch(t,'model-explorer','/catalog/123/Test?resource=binary');
  await browser.waitFor("!!document.querySelector('#rc-asset-tools')");
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1200,height:950,deviceScaleFactor:1,mobile:false});
  await button(browser,'#rc-asset-tools','Load resource');
  await browser.waitFor("document.querySelector('.rc-explorer-count').textContent==='7 objects'");
  assert.equal(await browser.evaluate("document.querySelector('.rc-explorer-notice').textContent"),'');
  assert.equal(await browser.evaluate("document.querySelector('.rc-object-tree').textContent.includes('File chunks')"),false);
  const key=async name=>{await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name});await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name});};
  const filter=async text=>browser.evaluate(`(()=>{const n=document.querySelector('.rc-explorer-objects input');n.value=${JSON.stringify(text)};n.dispatchEvent(new Event('input'))})()`);
  const node=async name=>{const key=await browser.evaluate(`(()=>{const n=[...document.querySelectorAll('.rc-object-row')].find(n=>n.querySelector('.rc-object-name').textContent===${JSON.stringify(name)});if(!n)throw Error('Object not found');return n.dataset.nodeKey})()`);await browser.click(`.rc-object-row[data-node-key="${key}"]`);};
  await node('Handle');
  assert.equal(await browser.evaluate("document.querySelector('.rc-explorer-selection').textContent"),'Part · Handle');
  assert.equal(await browser.evaluate("document.querySelector('[data-property-name=Transparency] input').value"),'0.25');
  assert.equal(await browser.evaluate("document.querySelector('[data-property-name=Material] input').value"),'Plastic');
  assert.equal(await browser.evaluate("document.querySelector('[data-property-name=Anchored] input').disabled"),true);
  assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('[data-property-name=Color] .rc-property-swatch')).backgroundColor"),'rgb(51, 153, 255)');
  await browser.click('[data-property-name=Size] .rc-property-toggle');
  assert.equal(await browser.evaluate("document.querySelector('[data-property-name=Size]').nextElementSibling.hidden"),false);
  await browser.evaluate("document.querySelector('.rc-object-tree').focus()");await key('ArrowRight');
  await node('Mesh');
  assert.equal(await browser.evaluate("document.querySelector('[data-property-name=MeshId] a').href"),'https://www.roblox.com/catalog/1234');
  await filter('HandleReference');await node('HandleReference');
  await browser.click('[data-property-name=Value] .rc-property-reference');
  assert.equal(await browser.evaluate("document.querySelector('.rc-explorer-selection').textContent"),'Part · Handle');
  assert.equal(await browser.evaluate("document.querySelector('.rc-explorer-objects input').value"),'','Reference navigation reveals the target outside the previous filter');
  await filter('Read only script');await node('Read only script');
  await browser.click('[data-property-name=Source] .rc-property-view');
  await browser.waitFor("!!document.querySelector('.rc-value-dialog[open]')");
  assert.equal(await browser.evaluate("document.querySelector('.rc-value-dialog textarea').value"),binaryFixture.source);
  assert.equal(await browser.evaluate("document.querySelector('.rc-value-dialog textarea').readOnly"),true);
  assert.equal(await browser.evaluate('typeof resourceExecuted'),'undefined','Script text cannot execute during inspection');
  await browser.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(text){window.copiedText=text}}})");
  await button(browser,'.rc-value-dialog','Copy value');
  assert.equal(await browser.evaluate('copiedText'),binaryFixture.source);
  await key('Escape');await browser.waitFor("!document.querySelector('.rc-value-dialog')");
  await browser.click('[data-property-name=Source] .rc-property-view');
  await browser.waitFor("!!document.querySelector('.rc-value-dialog[open]')");
  await browser.clickAt({ x: 5, y: 5 });
  await browser.waitFor("!document.querySelector('.rc-value-dialog')");
  assert.equal(await browser.evaluate("!!document.querySelector('.rc-model-explorer')"),true,'Outside dismissal closes the value window and keeps the explorer');
  await browser.evaluate("document.querySelector('.rc-explorer-divider').focus()");await key('ArrowRight');
  assert.equal(await browser.evaluate("document.querySelector('.rc-explorer-divider').getAttribute('aria-valuenow')"),'43');
  await filter('');await node('Handle');
  await fit(browser,'#item-info-container-frontend');
  await screenshot(browser,'.rc-model-explorer','explorer');
  const largeSource='-- Larger than the old file limit\n'+'x'.repeat(9*1024*1024),largeModel=binaryFixture.model({wide:1000,compression:'none',sourceText:largeSource});
  assert.ok(largeModel.length>8*1024*1024);
  await browser.evaluate(`resourceFixture=${JSON.stringify(largeModel.toString('base64'))};RobloxCustomizerI18n.setLanguage('en')`);
  await button(browser,'#rc-asset-tools','Load resource');
  await browser.waitFor("document.querySelector('.rc-explorer-count').textContent==='1007 objects'");
  assert.ok(await browser.evaluate("document.querySelectorAll('[role=treeitem]').length")<60,'Large models mount only the visible tree rows');
  await browser.evaluate("document.querySelector('.rc-object-tree').scrollTop=document.querySelector('.rc-object-tree').scrollHeight");
  await browser.waitFor("[...document.querySelectorAll('.rc-object-name')].at(-1).textContent==='Child 1006'");
  assert.ok(await browser.evaluate("document.querySelector('.rc-object-tree').scrollTop")>10000,'Virtual rows preserve scroll position');
  await filter('Child 1006');assert.equal(await browser.evaluate("document.querySelectorAll('[role=treeitem]').length"),2,'Filtering retains the ancestor path');
  await browser.evaluate("document.querySelector('.rc-object-tree').focus()");await key('End');
  assert.equal(await browser.evaluate("document.querySelector('[role=treeitem][aria-selected=true] .rc-object-name').textContent"),'Child 1006');
  await filter('Read only script');await node('Read only script');
  await browser.click('[data-property-name=Source] .rc-property-view');
  assert.equal(await browser.evaluate("document.querySelector('.rc-value-dialog textarea').value.length"),131072);
  assert.equal(await browser.evaluate("document.querySelector('.rc-value-dialog .rc-tools-hint').textContent"),'Showing the first 131072 characters.');
  await button(browser,'.rc-value-dialog','Copy value');
  assert.equal(await browser.evaluate('copiedText.length'),largeSource.length,'Large source copying retains the full value');
  await key('Escape');
  await browser.evaluate("history.pushState({},'','/home');dispatchEvent(new PopStateEvent('popstate'))");
  await browser.waitFor("!document.querySelector('#rc-asset-tools,.rc-value-dialog')");assert.deepEqual(browser.errors,[]);
});

test('Avatar tools preview locally, apply only changed colors, and validate accessory bounds', {skip:!process.env.CHROME_BIN,timeout:60000},async t=>{
  const {browser}=await launch(t,'avatar-tools','/ko/my/avatar');
  await browser.waitFor("!!document.querySelector('#rc-avatar-enhancements')");
  assert.equal(await browser.evaluate("requests.filter(n=>n.type==='rc-avatar-tools').length"),0);
  assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-enhancements').nextElementSibling.id"),'avatar-container');
  await browser.click('#rc-avatar-enhancements>summary');
  await browser.waitFor("document.querySelectorAll('.rc-avatar-refinement input').length===9");
  await browser.evaluate("const h=document.querySelector('.rc-color-inputs input[type=text]');h.value='#123ABC';h.dispatchEvent(new Event('input'))");
  assert.equal(await browser.evaluate("document.querySelector('.rc-avatar-color-figure rect').getAttribute('fill')"),'#123ABC');
  assert.equal(await browser.evaluate("requests.filter(n=>n.type==='rc-avatar-tools'&&n.action!=='load').length"),0,'Preview edits do not write to account');
  await button(browser,'#rc-avatar-enhancements','Apply colors');
  await browser.waitFor("requests.some(n=>n.action==='colors')");
  assert.deepEqual(await browser.evaluate("requests.find(n=>n.action==='colors')"),{type:'rc-avatar-tools',action:'colors',userId:77,colors:{headColor3:'#123ABC'}});
  await browser.waitFor("document.querySelector('.rc-tools-status').textContent.includes('Saved')");
  await button(browser,'#rc-avatar-enhancements','Apply colors');
  assert.equal(await browser.evaluate("requests.filter(n=>n.action==='colors').length"),1,'Repeated apply with no change does not write');
  await browser.evaluate("document.querySelector('.rc-avatar-refinement input').value='5'");
  await button(browser,'#rc-avatar-enhancements','Apply accessory');
  assert.equal(await browser.evaluate("requests.filter(n=>n.action==='accessory').length"),0,'Out of range adjustment cannot submit');
  await browser.evaluate("document.querySelector('.rc-avatar-refinement input').value='.1'");
  await button(browser,'#rc-avatar-enhancements','Apply accessory');
  await browser.waitFor("requests.some(n=>n.action==='accessory')");
  assert.equal(await browser.evaluate("requests.find(n=>n.action==='accessory').values.position.X"),.1);
  assert.equal(await browser.evaluate("requests.find(n=>n.action==='accessory').userId"),77);
  await fit(browser,'#rc-avatar-enhancements');
  await screenshot(browser,'#rc-avatar-enhancements','avatar');
  assert.equal(await browser.evaluate("document.querySelector('#native-avatar-button').parentElement.id"),'avatar-container');
  assert.deepEqual(browser.errors,[]);
});
