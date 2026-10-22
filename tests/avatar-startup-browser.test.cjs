const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const early = manifest.content_scripts[0].js;
const late = ['src/shared/native-labels.js', 'src/shared/i18n.js', 'src/pages/avatar/avatar-page.js',
  'src/assets/asset-core.js', 'src/assets/tools-ui.js', 'src/assets/avatar-tools.js'];
const styles = ['src/shared/startup.css', 'src/shared/theme.css', 'src/pages/avatar/avatar-page.css', 'src/assets/tools.css'];
const source = file => fs.readFileSync(path.join(workspace, file), 'utf8');
const nativePreview = '<div class="preview-column"><div id="avatar-preview"><canvas id="native-model" width="300" height="300"></canvas></div></div>';
const nativeInventory = '<div class="inventory-column"><nav id="avatar-categories"><ul>'
  + ['Recent', 'Avatars', 'Body', 'Clothing', 'Accessories', 'Animations'].map(label => `<li><button data-native-action>${label}</button></li>`).join('')
  + '</ul></nav><div class="avatar-items-container"><a class="avatar-item-card" href="/catalog/1/Head">Head</a></div></div>';
const japaneseInventory = '<div class="inventory-column"><nav id="avatar-categories"><ul>'
  + ['最近', 'アバター', 'ボディ', 'メイク', '服装', 'アクセサリ', '背景', 'アニメ'].map(label => `<li><button data-native-action>${label}</button></li>`).join('')
  + '</ul></nav><div class="avatar-items-container"><a class="avatar-item-card" href="/catalog/1/Head">頭</a></div></div>';
const state = `(() => {
  const editor=document.querySelector('.avatar-editor'),canvas=document.querySelector('#native-model');
  const rect=canvas?.getBoundingClientRect();
  return {boot:document.documentElement.getAttribute('data-rc-avatar-boot'),
    hidden:!!editor && getComputedStyle(editor).visibility==='hidden',
    width:rect?.width,height:rect?.height,ticks:nativeTicks,painted:nativePaints,
    loading:!!document.querySelector('#rc-avatar-loading'),
    pendingImage:!!document.querySelector('#rc-avatar-2d img')&&!document.querySelector('#rc-avatar-2d img').src,
    tools:!!document.querySelector('#rc-avatar-enhancements'),rawFrames:[...rawFrames]};
})()`;

test('Avatar startup hides native frames during slow initialization, remounts and SPA navigation while native handlers keep working',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    let navigations = 0;
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      if (styles.includes(file)) { response.setHeader('Content-Type', 'text/css'); response.end(source(file)); return; }
      if (!url.pathname.endsWith('/my/avatar')) { response.writeHead(404); response.end(); return; }
      navigations++;
      const language = url.searchParams.get('language') || 'en';
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="${language==='pending'?'':language}"><head><meta charset="utf-8">
        ${language==='pending'?'':`<meta name="locale-data" data-language-code="${language}">`}
        <style>body{margin:0;font:16px Arial;background:linear-gradient(120deg,#4a2233,#487681);color:#eee}
        header{height:64px}#content{margin:24px}#avatar-preview{width:300px;height:300px}ul{list-style:none;margin:0;padding:0}
        .avatar-item-card{display:block;height:150px}button{padding:8px}</style>
        ${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head>
        <body class="dark-theme"><header><button id="header-action" onclick="headerClicks++">Header</button></header>
        <main id="content"><div class="avatar-editor">${nativePreview}${nativeInventory}</div></main>
        <script>
          window.headerClicks=0;window.nativeClicks=0;window.modelInputs=0;window.nativePaints=0;window.nativeTicks=0;
          window.originalCanvas=document.querySelector('#native-model');
          originalCanvas.addEventListener('pointerdown',()=>modelInputs++);
          document.addEventListener('click',event=>{if(event.target.closest('[data-native-action]'))nativeClicks++});
          function draw(){nativeTicks++;const c=document.querySelector('#native-model');if(c){c.getContext('2d').fillRect(0,0,30,30);nativePaints++}requestAnimationFrame(draw)}draw();
        </script></body></html>`);
    });
    await new Promise(resolve=>server.listen(0, '127.0.0.1', resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser = await isolatedChrome(t, 'avatar-startup');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.chrome={i18n:{getUILanguage:()=> 'en'},storage:{local:{async get(){return{}},async set(){},async remove(){}},onChanged:{addListener(){}}},
        runtime:{lastError:null,sendMessage(message,callback){ /* Keep thumbnail fetch pending. */ }}};
      window.rawFrames=[];
      function audit(){const node=document.querySelector('.avatar-editor');
        if(node&&getComputedStyle(node).visibility!=='hidden'&&!node.hasAttribute('data-rc-avatar-studio')
          &&document.documentElement.getAttribute('data-rc-compatibility')!=='fallback')rawFrames.push(performance.now());
        requestAnimationFrame(audit)}requestAnimationFrame(audit);
    ` });
    for (const file of early) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: source(file)+'\n//# sourceURL='+file });
    const base = `http://127.0.0.1:${server.address().port}`;
    const navigate = async (query, prefix='') => {
      const url=base+prefix+'/my/avatar'+query;
      await browser.send('Page.navigate',{url});
      await waitForDocument(browser, '#native-model', url);
    };
    const enhance = async () => { for(const file of late) await browser.evaluate(source(file)+'\n//# sourceURL='+file); };
    const ready = "document.documentElement.getAttribute('data-rc-avatar-boot')==='ready'";

    // The native editor can arrive long before the enhancement scripts or settings.
    await navigate('');
    await pause(2200);
    let s = await browser.evaluate(state);
    assert.equal(s.hidden, true); assert.equal(s.boot, 'pending'); assert.equal(s.loading, true);
    assert.ok(s.width>=300 && s.height>=300, 'Hidden canvas retains layout dimensions');
    assert.ok(s.ticks>10 && s.painted>10, 'Native animation and drawing run behind the gate');
    assert.deepEqual(s.rawFrames, [], 'No original editor frame is painted before enhancement');
    await browser.click('#header-action');
    assert.equal(await browser.evaluate('headerClicks'),1,'Navigation remains usable while the editor loads');
    await enhance();
    await browser.waitFor("!!document.querySelector('#rc-avatar-enhancements')");
    assert.equal((await browser.evaluate(state)).hidden,true,'Finished layout still waits for appearance settings');
    await browser.evaluate('RobloxCustomizerStartup.setPreferences({source:"none",glassOpacity:62})');
    await browser.waitFor(ready);
    s = await browser.evaluate(state);
    assert.equal(s.hidden,false); assert.equal(s.loading,false); assert.equal(s.pendingImage,true); assert.equal(s.tools,true);
    assert.equal(await browser.evaluate("document.querySelector('#native-model')===originalCanvas"),true);
    await browser.click('#native-model');await browser.click('[data-native-action]');
    assert.equal(await browser.evaluate('modelInputs'),1);assert.equal(await browser.evaluate('nativeClicks'),1);

    // The reported production sequence keeps the exact same preview/layout
    // nodes while its renderer temporarily removes the canvas or hides its slot.
    // A local model refresh must not send our already visible editor back to boot.
    await browser.evaluate(`(() => {
      window.previewRefreshTransitions=[];
      new MutationObserver(records=>{for(const record of records)previewRefreshTransitions.push(record.oldValue)})
        .observe(document.documentElement,{attributes:true,attributeOldValue:true,attributeFilter:['data-rc-avatar-boot']});
      window.savedCanvas=document.querySelector('#native-model');savedCanvas.remove();
      document.querySelector('#avatar-preview').insertAdjacentHTML('beforeend','<span id="native-model-loading" role="status">Loading model...</span>');
    })()`);
    await pause(900);
    s = await browser.evaluate(state);
    assert.equal(s.boot,'ready','A temporary missing canvas keeps the already enhanced editor ready');
    assert.equal(s.hidden,false);assert.equal(s.loading,false);
    assert.ok(await browser.evaluate("RobloxCustomizerAvatarDiagnostics.snapshot().entries.some(e=>e.event==='layout'&&e.reason==='native-preview-refresh')"));
    await browser.evaluate("document.querySelector('#avatar-preview').append(savedCanvas);document.querySelector('#native-model-loading').remove()");
    await browser.evaluate(`document.querySelector('.preview-column').style.display='none';
      document.querySelector('#avatar-preview').insertAdjacentHTML('beforeend','<span id="native-model-loading">Loading model...</span>')`);
    await pause(250);
    assert.equal((await browser.evaluate(state)).boot,'ready','A temporarily hidden native preview slot keeps its surrounding UI visible');
    await browser.evaluate("document.querySelector('.preview-column').style.removeProperty('display');document.querySelector('#native-model-loading').remove()");
    await pause(100);
    assert.deepEqual(await browser.evaluate('previewRefreshTransitions'),[],'Renderer refresh never toggles whole-page loading');
    await browser.click('#native-model');
    assert.equal(await browser.evaluate('modelInputs'),2,'The original model and its handlers survive the refresh');

    // Roblox replaces only its inner editor, then mounts the category component later.
    await browser.evaluate(`document.querySelector('.avatar-editor').replaceWith(Object.assign(document.createElement('div'),{className:'avatar-editor',innerHTML:${JSON.stringify(nativePreview)}}))`);
    await pause(2200);
    s = await browser.evaluate(state);
    assert.equal(s.hidden,true);assert.equal(s.boot,'pending');assert.deepEqual(s.rawFrames,[]);
    await browser.evaluate(`document.querySelector('.avatar-editor').insertAdjacentHTML('beforeend',${JSON.stringify(nativeInventory)})`);
    await browser.waitFor(ready);
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-avatar-2d').length"),1,'Own panel is reused on remount');
    await browser.click('[data-native-action]');
    assert.equal(await browser.evaluate('nativeClicks'),2,'New native controls retain their handlers');
    await browser.evaluate("document.querySelector('#rc-avatar-2d').remove()");
    await browser.waitFor(ready+' && !!document.querySelector("#rc-avatar-2d")');
    assert.deepEqual((await browser.evaluate(state)).rawFrames,[]);

    // Pending work is cancelled on route exit; a fresh mount on return is gated again.
    await browser.evaluate(`history.pushState({},'','/home');document.getElementById('content').innerHTML='<h1>Home</h1>';dispatchEvent(new PopStateEvent('popstate'))`);
    await browser.waitFor("!document.documentElement.hasAttribute('data-rc-avatar-boot') && !document.querySelector('#rc-avatar-loading')");
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#content')).visibility"),'visible');
    await browser.evaluate(`history.pushState({},'','/ja/my/avatar');document.getElementById('content').innerHTML='<div class="avatar-editor">'+${JSON.stringify(nativePreview)}+'</div>';dispatchEvent(new PopStateEvent('popstate'))`);
    await pause(100);
    assert.equal((await browser.evaluate(state)).hidden,true);
    await browser.evaluate(`document.querySelector('.avatar-editor').insertAdjacentHTML('beforeend',${JSON.stringify(nativeInventory)})`);
    await browser.waitFor(ready);
    assert.deepEqual((await browser.evaluate(state)).rawFrames,[]);

    // Native 2D-to-3D initialization can rebuild the entire editor much later
    // than its first complete layout. That intermediate enhanced UI stays hidden.
    await navigate('?language=ja','/ja');
    await browser.evaluate(`(() => {
      const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="skyblue"/></svg>');
      document.querySelector('.avatar-editor').innerHTML='<div class="preview-column"><div id="avatar-preview"><img src="'+image+'" width="300" height="300"><button id="native-mode-3d">3D</button></div></div>'+${JSON.stringify(japaneseInventory)};
      window.native3DDone=false;window.early3DReveal=false;window.modeClicks=0;window.modeBootTransitions=[];
      new MutationObserver(records=>{
        const boot=document.documentElement.getAttribute('data-rc-avatar-boot');
        for(const record of records)modeBootTransitions.push([record.oldValue,boot]);
        if(boot==='ready'&&!native3DDone)early3DReveal=true;
      }).observe(document.documentElement,{attributes:true,attributeOldValue:true,attributeFilter:['data-rc-avatar-boot']});
      document.querySelector('#native-mode-3d').addEventListener('click',event=>{
        modeClicks++;event.currentTarget.setAttribute('aria-pressed','true');
        setTimeout(()=>document.querySelector('.avatar-editor').replaceWith(Object.assign(document.createElement('div'),{className:'avatar-editor',innerHTML:${JSON.stringify(nativePreview)}})),900);
        setTimeout(()=>{document.querySelector('.avatar-editor').insertAdjacentHTML('beforeend',${JSON.stringify(japaneseInventory)});native3DDone=true;},1050);
      },{once:true});
    })()`);
    await enhance();
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none'})");
    await browser.waitFor(ready+' && native3DDone');
    assert.equal(await browser.evaluate('early3DReveal'),false,'Do not reveal our intermediate 2D layout while native 3D is still starting');
    assert.equal(await browser.evaluate("modeBootTransitions.filter(([,next])=>next==='ready').length"),1,'Native renderer initialization reveals the enhanced editor only once');
    assert.equal(await browser.evaluate('modeClicks'),1,'Native 3D initialization is requested once');

    // Japanese category hydration arrives in several tasks. The first complete
    // shell must not flash before a later native pass replaces its navigation.
    await navigate('?language=ja','/ja');
    await browser.evaluate(`document.querySelector('.inventory-column').outerHTML=${JSON.stringify(japaneseInventory)}`);
    await enhance();
    await browser.waitFor("!!document.querySelector('[data-rc-avatar-main-control]')");
    await browser.evaluate(`(() => {
      window.hydrated=false;window.earlyReveal=false;window.bootTransitions=[];
      new MutationObserver(records=>{
        const boot=document.documentElement.getAttribute('data-rc-avatar-boot');
        for(const record of records)bootTransitions.push([record.oldValue,boot]);
        if(boot==='ready'&&!hydrated)earlyReveal=true;
      }).observe(document.documentElement,{attributes:true,attributeOldValue:true,attributeFilter:['data-rc-avatar-boot']});
      const nav=document.querySelector('#avatar-categories'),markup=nav.outerHTML,parent=nav.parentElement;
      RobloxCustomizerStartup.setPreferences({source:'none'});
      setTimeout(()=>nav.remove(),40);
      setTimeout(()=>{parent.insertAdjacentHTML('afterbegin',markup);hydrated=true;},110);
    })()`);
    await browser.waitFor(ready+' && hydrated');
    assert.equal(await browser.evaluate('earlyReveal'),false,'Wait for the native category hydration before the first reveal');
    assert.equal(await browser.evaluate("bootTransitions.filter(([old,next])=>next==='ready').length"),1,'One transition out of the initial loading state');

    // Once the shell is usable, refreshing its category list must not put the
    // entire editor back behind the startup message or interrupt native inputs.
    await browser.evaluate(`(() => {
      bootTransitions.length=0;window.categoriesUpdated=false;
      const nav=document.querySelector('#avatar-categories'),markup=nav.outerHTML,parent=nav.parentElement;
      nav.remove();setTimeout(()=>{parent.insertAdjacentHTML('afterbegin',markup);categoriesUpdated=true;},180);
    })()`);
    await browser.waitFor('categoriesUpdated && !!document.querySelector("[data-rc-avatar-main-control]")');
    assert.deepEqual(await browser.evaluate('bootTransitions'),[],'Updating categories keeps the ready editor visible');
    assert.equal((await browser.evaluate(state)).loading,false);
    const clicks=await browser.evaluate('nativeClicks');
    await browser.click('[data-native-action]');
    assert.equal(await browser.evaluate('nativeClicks'),clicks+1);

    // Unknown locale metadata must not expose the initial native frame either.
    await navigate('?language=pending');
    assert.equal((await browser.evaluate(state)).hidden,true);
    await browser.evaluate("document.documentElement.lang='ja'");
    await enhance();
    await browser.evaluate('RobloxCustomizerStartup.setPreferences({source:"none"})');
    await browser.waitFor(ready);

    // A genuine failure remains on a themed recovery message rather than native UI.
    await navigate('?language=zh-CN');
    await browser.evaluate(source('src/shared/i18n.js'));
    await pause(15500);
    assert.equal((await browser.evaluate(state)).hidden,true);
    assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-loading button').checkVisibility()"),true);
    assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-loading button').textContent"),'刷新页面');
    assert.match(await browser.evaluate("document.querySelector('#rc-avatar-loading p').textContent"),/加载时间较长/);
    const before=navigations;
    await browser.click('#rc-avatar-loading button');
    for(let i=0;i<50 && navigations===before;i++)await pause(30);
    assert.equal(navigations,before+1,'Refresh is explicitly initiated by the user');

    // Existing unsupported-language behavior remains native and usable.
    await navigate('?language=fr');
    s = await browser.evaluate(state);
    assert.equal(s.boot,null);assert.equal(s.hidden,false);assert.equal(s.loading,false);
    assert.deepEqual(browser.errors,[]);
  });
