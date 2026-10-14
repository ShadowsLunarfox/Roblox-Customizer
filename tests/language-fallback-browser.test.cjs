const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const scripts = [...new Set(manifest.content_scripts.flatMap(entry => entry.js || []))];
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const nativeSelectors = ['#header', '#navigation', '#content', '#native-input',
  '#HomeContainer', '#favorites', '#standout', '#recommendations', '.friend-carousel-container',
  '#native-game-card', '#game-detail-page', '.game-main-content', '#avatar-container', '#chat-main', '#native-buy'];
const nativeState = `(()=>{
  const properties=['display','position','visibility','color','backgroundColor','backgroundImage','borderRadius',
    'padding','margin','opacity','backdropFilter','gridTemplateColumns','fontSize','fontWeight'];
  return ${JSON.stringify(nativeSelectors)}.map(selector=>{
    const node=document.querySelector(selector),style=getComputedStyle(node),r=node.getBoundingClientRect();
    return {selector,rect:[r.x,r.y,r.width,r.height],...Object.fromEntries(properties.map(key=>[key,style[key]]))};
  });
})()`;

test('Unsupported languages preserve native UI, allow only image backgrounds and colors, and recover across language switches',
  { skip: !process.env.CHROME_BIN, timeout: 90000 }, async t => {
    let language = 'fr-FR';
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      if (files.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/png');
        response.end(fs.readFileSync(path.join(workspace, file)));
        return;
      }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="en" class="${url.searchParams.get('theme') === 'light' ? 'light' : 'dark'}-theme"><head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="locale-data" data-language-code="${language}">
        <style>
          *{box-sizing:border-box}body{margin:0;background:rgb(235,236,238);color:rgb(28,30,35);font:16px/1.5 Arial}
          #header{height:56px;padding:8px;background:rgb(40,43,48);color:white;border-radius:0}
          #navigation{width:100px;height:160px;padding:9px;background:rgb(220,222,225)}
          #content{margin:12px;padding:16px;background:rgb(248,248,249)}section{margin:8px 0;padding:6px;background:rgb(224,226,230)}
          #settings-popover-menu{position:absolute;top:0;right:0;margin:0;padding:12px;background:rgb(210,212,215);list-style:none}
          #settings-popover-menu a{color:rgb(30,32,36)}button,input{font:inherit;border:1px solid rgb(90,95,105);border-radius:3px;padding:5px}
          .game-main-content{display:block;padding:5px}.friend-carousel-container{display:block;height:90px;overflow:hidden}
          #native-game-card{display:block;width:100px;height:60px;padding:5px;border-radius:2px;background:rgb(190,195,205)}
          #chat-main{padding:10px;position:relative;background:rgb(214,216,220)}h1,h2,h3{margin:8px 0;font-size:18px}
        </style>
        ${url.searchParams.has('extension') ? styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('') : ''}
        </head><body>
        <header id="header" class="rbx-header"><div class="container-fluid">Roblox <span id="nav-robux-amount">500</span></div></header>
        <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>
        <nav id="navigation" class="rbx-left-col">Navigation</nav>
        <main id="content"><input id="native-input" placeholder="Search"><div id="HomeContainer">
          <section id="favorites"><h2>Favorites</h2></section><section id="standout"><h2>Standout Games</h2></section>
          <section id="recommendations"><h2>Recommended For You</h2><div id="native-game-card" class="game-card-container"><a href="/games/123">Game</a></div></section>
          <section class="friend-carousel-container"><h2>Friends</h2><div class="react-friends-carousel-container"><div class="friends-carousel-list-container">Friend</div></div></section>
        </div><div id="game-detail-page"><div class="game-main-content"><div id="game-details-carousel-container">Cover</div>
          <div class="game-calls-to-action"><div class="game-title-container">Game title</div><div class="game-buttons-container"><button id="native-buy">Play</button></div></div></div></div>
        <div id="avatar-container">Avatar</div><div id="chat-container"><div id="chat-main">Chat</div></div></main>
        <script>window.React={createElement:function nativeCreateElement(){},useState:function nativeUseState(){}};window.nativeCreateElement=React.createElement;</script>
        </body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const imageFile = path.join(workspace, '.tmp-fallback-image.svg');
    fs.writeFileSync(imageFile, '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#ae68ff"/></svg>');
    t.after(() => fs.rmSync(imageFile, { force: true }));
    const browser = await isolatedChrome(t, 'language-fallback');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      if(location.search.includes('extension=1')){
        const listeners=[],messages=[];window.featureRequests=[];
        const defaults={source:'none',uiLanguage:'en',hideFavorites:true,hideStandoutGames:true,hideRecommendedUpper:true,hideRecommendedLower:true,
          friendRows:1,glassBlur:40,glassOpacity:25,showGameXFeed:false,showGameYouTubeFeed:false};
        const read=()=>({robloxCustomizerTermsAccepted:true,customBackground:defaults,...JSON.parse(localStorage.getItem('preferences')||'{}')});
        window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{
          local:{async get(){return read()},async set(patch){const old=read();localStorage.setItem('preferences',JSON.stringify({...old,...patch}));listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(patch).map(([key,newValue])=>[key,{oldValue:old[key],newValue}])),'local'))},
            async remove(key){const old=read(),next={...old};delete next[key];localStorage.setItem('preferences',JSON.stringify(next));listeners.forEach(fn=>fn({[key]:{oldValue:old[key]}},'local'))}},
          onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{id:'test-extension',lastError:null,getURL:file=>'/'+file,
          onMessage:{addListener:fn=>messages.push(fn)},sendMessage(message,callback){featureRequests.push(message.type);
            callback(message.type==='rc-home-user'?{id:1,name:'Player',displayName:'Player'}:message.type==='rc-pinned-games'?{ok:true,games:[],folders:[]}
              :message.type==='rc-playtime'?{ok:true,enabled:false,games:[],totalMs:0,status:{kind:'disabled'}}:{ok:false,error:'No fixture data'});}}};
        window.openCustomizer=()=>messages.forEach(fn=>fn({type:'rc-open-settings'},{id:'test-extension'}));
        window.patchAppearance=patch=>chrome.storage.local.set({customBackground:{...read().customBackground,...patch,_writer:'fixture-external'}});
      }
    ` });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `if(location.search.includes('extension=1')){\n${fs.readFileSync(path.join(workspace, file), 'utf8')}\n}\n//# sourceURL=${file}`
    });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: "if(location.search.includes('openEarly=1'))openCustomizer()"
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const navigate = async (route, extension, theme = 'dark') => {
      const url = `${origin}${route}?theme=${theme}${extension ? '&extension=1' : ''}`;
      await browser.send('Page.navigate', { url });
      await waitForDocument(browser, '#native-buy', url);
      if (extension) await browser.waitFor("document.documentElement.dataset.rcCompatibility==='fallback'");
      if (extension) await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
    };
    for (const route of ['/home', '/games/123', '/my/avatar', '/users/123/profile', '/my/account', '/catalog/123', '/charts', '/report-abuse']) {
      for (const [width, theme] of [[1280, 'dark'], [320, 'light']]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await navigate(route, false, theme);
        const native = await browser.evaluate(nativeState);
        await navigate(route, true, theme);
        assert.deepEqual(await browser.evaluate(nativeState), native, `${route}/${width}/${theme}: native layout and appearance are unchanged`);
        assert.deepEqual(await browser.evaluate('featureRequests'), [], 'No feature API calls in fallback');
        assert.equal(await browser.evaluate("!!document.querySelector('#rc-home-greeting,#rc-pinned-games,.rc-robux-equivalent')"), false);
        assert.equal(await browser.evaluate("document.querySelectorAll('.rc-settings-menu-entry').length"), 1, 'The settings entry remains available without duplicates in fallback');
        assert.equal(await browser.evaluate("document.querySelector('#settings-popover-menu').hasAttribute('data-rc-header-menu')"), false, 'Restoring settings access does not enable header restyling');
        assert.equal(await browser.evaluate("document.querySelector('#settings-popover-menu a[href=\"/my/account\"]').textContent"), 'Settings', 'Native account settings remain intact');
        assert.equal(await browser.evaluate("React.createElement===nativeCreateElement && !Object.getOwnPropertyDescriptor(window,'React').get"), true, 'Native React is not patched');
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate('/home', true);
    const before = await browser.evaluate(nativeState);
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-language-warning-dialog:modal')");
    assert.match(await browser.evaluate("document.querySelector('#rc-language-warning-message').textContent"), /all other features are disabled/);
    await browser.click('#rc-language-warning-dialog button');
    await browser.waitFor("!document.querySelector('#rc-language-warning-dialog')");
    const notice = '#rc-settings-language-notice';
    assert.equal(await browser.evaluate(`document.querySelector('${notice}').checkVisibility()`), true, 'The explanation remains visible after dismissing the one-time pop-up');
    assert.equal(await browser.evaluate(`document.querySelector('${notice} a').getAttribute('href')`), '/my/account#!/info');
    for (const [locale, title, features, supported] of [
      ['en', 'Your Roblox language is not supported yet', 'Only image backgrounds and custom colors', 'English, Simplified Chinese, or Traditional Chinese'],
      ['zh-CN', '当前 Roblox 语言暂未支持', '目前仅可使用图片背景和自定义颜色', '英语、简体中文或繁体中文'],
      ['zh-TW', '目前的 Roblox 語言暫未支援', '目前僅可使用圖片背景和自訂色彩', '英語、簡體中文或繁體中文']
    ]) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
      await browser.waitFor(`document.querySelector('${notice} strong').textContent===${JSON.stringify(title)}`);
      const text = await browser.evaluate(`document.querySelector('${notice}').textContent`);
      assert.ok(text.includes(features));
      assert.ok(text.includes(supported));
      for (const width of [1280, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        assert.equal(await browser.evaluate(`(()=>{
          const note=document.querySelector('${notice}'),r=note.getBoundingClientRect();
          const heading=document.querySelector('.rc-settings-heading').getBoundingClientRect(),layout=document.querySelector('.rc-settings-layout').getBoundingClientRect();
          return note.scrollWidth<=note.clientWidth+1 && r.left>=0 && r.right<=innerWidth && r.top>=heading.bottom && r.bottom<=layout.top;
        })()`), true, `${locale}/${width}: explanation fits at the top of settings`);
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");
    await browser.click('#rc-close');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate(`document.querySelector('${notice}').checkVisibility()`), true, 'Every settings opening retains the explanation in fallback');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-language-warning-dialog')"), false, 'Reopening settings does not repeat the dismissed pop-up');
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.rc-settings-nav-button')].filter(n=>n.checkVisibility()).map(n=>n.dataset.rcSettingsCategory)"), ['appearance']);
    assert.equal(await browser.evaluate("document.querySelector('.rc-settings-glass').checkVisibility()"), false);
    assert.equal(await browser.evaluate("document.querySelector('#rc-file').accept"), 'image/*');
    const dom = await browser.send('DOM.getDocument');
    const input = await browser.send('DOM.querySelector', { nodeId: dom.root.nodeId, selector: '#rc-file' });
    await browser.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [imageFile] });
    await browser.waitFor("!!document.querySelector('#rc-background-layer img[src^=\"blob:\"]') && document.documentElement.hasAttribute('data-rc-background-active')");
    await browser.click('#rc-custom-colors-enabled');
    await browser.evaluate("const input=document.querySelector('#rc-custom-text-color');input.value='#ddeeaa';input.dispatchEvent(new Event('change',{bubbles:true}))");
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-colors') && document.documentElement.style.getPropertyValue('--rc-custom-text')==='#ddeeaa'");
    await browser.click('#rc-close');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    assert.deepEqual((await browser.evaluate(nativeState)).map(item => item.rect), before.map(item => item.rect), 'Images and colors preserve all native geometry');
    assert.deepEqual(await browser.evaluate('featureRequests'), []);
    await browser.evaluate("patchAppearance({source:'url',url:'https://example.invalid/background.mp4',urlType:'video'})");
    await browser.waitFor("!document.documentElement.hasAttribute('data-rc-background-active')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-background-layer video')"), false, 'Video backgrounds are disabled in image-only fallback');
    await browser.evaluate("patchAppearance({source:'none',experimentalCustomColors:false,uiLanguage:'zh-TW'})");
    assert.equal(await browser.evaluate("RobloxCustomizerCompatibility.fallback() && !RobloxCustomizerCompatibility.enabled()"), true, 'An extension language override cannot bypass fallback');
    language = 'en';
    await browser.evaluate("document.querySelector('meta[name=locale-data]').setAttribute('data-language-code','en')");
    await browser.waitFor("document.readyState==='complete' && document.documentElement.dataset.rcCompatibility==='full' && !RobloxCustomizerCompatibility.reloading() && !!document.querySelector('#rc-home-greeting')");
    assert.ok((await browser.evaluate('featureRequests')).length > 0, 'Supported languages restore the saved enhancements');
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
    assert.equal(await browser.evaluate(`document.querySelector('${notice}').checkVisibility()`), false, 'Supported Roblox languages do not show the fallback explanation');
    await browser.click('#rc-close');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    language = 'fr-FR';
    await browser.evaluate("document.querySelector('meta[name=locale-data]').setAttribute('data-language-code','fr-FR')");
    await browser.waitFor("document.readyState==='complete' && document.documentElement.dataset.rcCompatibility==='fallback' && !RobloxCustomizerCompatibility.reloading() && !!document.querySelector('#rc-language-warning-dialog:modal')");
    await browser.click('#rc-language-warning-dialog button');
    await browser.waitFor("!document.querySelector('#rc-language-warning-dialog')");
    assert.deepEqual(await browser.evaluate(nativeState), before, 'Reload removes prior supported-language layout changes completely');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-home-greeting,#rc-pinned-games')"), false);
    assert.equal(await browser.evaluate("document.querySelectorAll('.rc-settings-menu-entry').length"), 1, 'The settings entry returns after switching back to fallback');
    assert.deepEqual(await browser.evaluate('featureRequests'), []);
    await browser.evaluate("localStorage.removeItem('preferences')");
    const earlyUrl = `${origin}/home?extension=1&openEarly=1`;
    await browser.send('Page.navigate', { url: earlyUrl });
    await waitForDocument(browser, '#rc-settings-overlay', earlyUrl);
    await browser.waitFor("!!document.querySelector('#rc-language-warning-dialog:modal')");
    assert.equal(await browser.evaluate("document.querySelector('.rc-settings-glass').checkVisibility()"), false, 'Opening from the toolbar before locale detection waits for the correct fallback controls');
    assert.deepEqual(browser.errors, []);
  });
