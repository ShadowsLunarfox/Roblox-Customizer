const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const testFont = require('./helpers/font.cjs');
const animatedGif = require('./helpers/animated-gif.cjs');
const animatedVideo = require('./helpers/animated-video.cjs');
const workspace = path.resolve(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8')).content_scripts;
const scripts = [...new Set(entries.filter(entry => entry.world !== 'MAIN').flatMap(entry => entry.js || []))];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];
const loadingFeatures = ['src/shared/runtime.js', 'src/settings/settings.js', 'src/shared/frosted-ui.js', 'src/shared/i18n.js',
  'src/currency/robux-currency.js'];
const cards = (start, count) => Array.from({length:count}, (_, i) => '<div class="grid-item-container hover-game-tile"><div class="game-card-container"><a href="https://www.roblox.com/games/'+(start+i+100)+'/Game"><div class="featured-game-icon-container"><img src="/thumbnail.svg"></div><div class="info-container"><h3 class="game-card-name">Game '+(start+i)+'</h3><div class="game-card-info"><span>95%</span><span>100 Players</span></div></div></a></div></div>').join('');

const setup = kind => `
  window.work={};
  const owner=()=>new Error().stack.match(/src\\/[^\\s:()]+\\.js/)?.[0]||'fixture';
  const measure=(name,callback,args)=>{const start=performance.now();try{return callback(...args)}finally{const elapsed=performance.now()-start;const item=work[name]||(work[name]={calls:0,total:0,max:0});item.calls++;item.total+=elapsed;if(elapsed>item.max){item.max=elapsed;item.callback=callback.name||callback.toString().slice(0,90)}}};
  const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>{const name=owner();return raf(time=>measure(name,callback,[time]))};
  const timeout=setTimeout.bind(window);window.setTimeout=(callback,delay,...args)=>{if(typeof callback!=='function')return timeout(callback,delay,...args);const name=owner();return timeout(()=>measure(name,callback,args),delay)};
  const NativeObserver=MutationObserver;window.MutationObserver=class extends NativeObserver{constructor(callback){const name=owner();super((records,observer)=>measure(name,callback,[records,observer]))}};
  const listeners=[];const preferences={source:'url',url:location.origin+'/animation.${kind === 'gif' ? 'gif' : 'mp4'}',urlType:'${kind === 'gif' ? 'image' : 'video'}',glassBlur:40,glassOpacity:51,clockShowSeconds:false,hideFavorites:true,hideStandoutGames:true,hideRecommendedUpper:true,hideRecommendedLower:false,...${JSON.stringify(testFont && kind === 'video' ? { customFontEnabled: true, fontFileKey: 'test-font', fontFileName: 'Test.ttf' } : {})}};
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return {robloxCustomizerTermsAccepted:true,robloxCustomizerSettingsGuideSeen:true,customBackground:preferences,pinnedGames:[],pinnedGameFolders:[]}},async set(){},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:1,name:'Player',displayName:'Player'}:message.type==='rc-playtime'?{ok:true,enabled:false,account:null,games:[],status:{kind:'disabled',checkedAt:0}}:{ok:true,games:[],folders:[]}))}}};
`;

for (const kind of ['gif', 'video']) test(`${kind} background remains animated while a slow document progressively streams Home cards`,
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    let documentResponse;
    let timer;
    let nextCard = 0;
    let video;
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      if (file === 'start') {
        timer = setInterval(() => {
          if (nextCard === 500) { clearInterval(timer); return; }
          documentResponse.write(cards(nextCard,25));
          nextCard += 25;
        }, 50);
        response.end('started');return;
      }
      if (file === 'burst') { documentResponse.write(cards(500,500)); response.end('added'); return; }
      if (file === 'finish') { documentResponse.end('</div></section></main></body></html>');response.end('finished');return; }
      if (file === 'seed') { response.setHeader('Content-Type','text/html');response.end('<html><body>Font setup</body></html>');return; }
      if (file === 'test-font.ttf' && testFont) { response.setHeader('Content-Type','font/ttf');response.end(fs.readFileSync(testFont));return; }
      if (styles.includes(file)) { response.setHeader('Content-Type','text/css');response.end(fs.readFileSync(path.join(workspace,file)));return; }
      if (file.startsWith('icons/')) { response.setHeader('Content-Type','image/png');response.end(fs.readFileSync(path.join(workspace,file)));return; }
      if (file === 'animation.gif') { response.setHeader('Content-Type','image/gif');response.end(animatedGif());return; }
      if (file === 'animation.mp4') { response.setHeader('Content-Type','video/mp4');response.end(video);return; }
      if (file === 'thumbnail.svg') { response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="36"><rect width="64" height="36" fill="#84a"/></svg>');return; }
      if (file !== 'home') { response.writeHead(404);response.end();return; }
      documentResponse = response;
      response.setHeader('Content-Type','text/html; charset=utf-8');
      response.write('<!doctype html><html lang="en"><head><meta charset="utf-8">'+styles.map(file=>'<link rel="stylesheet" href="/'+file+'">').join('')+'<style>body{margin:32px;font:16px Arial;background:#222}.game-card-container{display:inline-block;width:160px}#grid{display:grid;grid-template-columns:repeat(6,160px)}#settings-popover-menu{position:fixed;right:0;top:0}</style></head><body><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="HomeContainer"><section><h2>Recommended For You</h2></section><section><h2>Recommended Games</h2><div id="grid">');
    });
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    t.after(() => {clearInterval(timer);return new Promise(resolve=>{server.closeAllConnections();server.close(resolve)})});
    const browser = await isolatedChrome(t,'background-loading');
    const origin = `http://127.0.0.1:${server.address().port}`;
    await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
    if (kind === 'video') {
      const base64 = await browser.evaluate(`(async()=>{const blob=await (${animatedVideo})();return btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))})()`);
      video = Buffer.from(base64, 'base64');
      if (testFont) {
        await browser.send('Page.navigate',{url:origin+'/seed'});
        await waitForDocument(browser,'body',origin+'/seed');
        await browser.evaluate(`(async()=>{const file=new File([await(await fetch('/test-font.ttf')).arrayBuffer()],'Test.ttf',{type:'font/ttf'});await new Promise((resolve,reject)=>{const request=indexedDB.open('roblox-customizer-media',1);request.onupgradeneeded=()=>request.result.createObjectStore('backgrounds');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,transaction=db.transaction('backgrounds','readwrite');transaction.objectStore('backgrounds').put(file,'test-font');transaction.oncomplete=()=>{db.close();resolve()};transaction.onerror=()=>reject(transaction.error)}})})()`);
      }
    }
    await browser.send('Emulation.setCPUThrottlingRate',{rate:4});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:setup(kind)});
    for(const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')+'\n//# sourceURL='+file});
    await browser.send('Page.navigate',{url:origin+'/home'});
    await browser.waitFor(kind === 'gif' ? "document.querySelector('#rc-background-layer img')?.naturalWidth===2"
      : "document.querySelector('#rc-background-layer video')?.readyState>=2");
    if (kind === 'video' && testFont) await browser.waitFor("document.documentElement.hasAttribute('data-rc-custom-font')");
    assert.equal(await browser.evaluate('document.readyState'),'loading');
    await browser.evaluate('window.originalMedia=document.querySelector(".rc-background-media");window.work={}');
    await fetch(origin+'/start');
    const frames = new Set();
    for(let i=0;i<10;i++) {
      const shot=await browser.send('Page.captureScreenshot',{format:'png',clip:{x:2,y:2,width:8,height:8,scale:1}});
      frames.add(shot.data);
      await browser.evaluate('new Promise(resolve=>setTimeout(resolve,65))');
    }
    await browser.waitFor("document.querySelectorAll('#grid .game-card-container').length===500");
    await browser.waitFor("document.querySelectorAll('#grid .rc-hide-recommended-game').length===500");
    // Add another 500 cards in one burst, matching a large native component
    // mount rather than only testing the parser's small progressive batches.
    await fetch(origin+'/burst');
    const burstFrames = new Set();
    for(let i=0;i<10 && burstFrames.size<2;i++) {
      burstFrames.add((await browser.send('Page.captureScreenshot',{format:'png',clip:{x:2,y:2,width:8,height:8,scale:1}})).data);
      // Avoid sampling exactly at the fixture GIF's 80 ms frame period.
      await browser.evaluate(`new Promise(resolve=>setTimeout(resolve,${[37,91,53,113,67][i%5]}))`);
    }
    await browser.waitFor("document.querySelectorAll('#grid .rc-hide-recommended-game').length===1000");
    const work = await browser.evaluate('work');
    t.diagnostic(JSON.stringify(Object.fromEntries(loadingFeatures.map(source => [source, {
      calls: work[source]?.calls, max: Math.round(work[source]?.max || 0), callback: work[source]?.callback
    }]))));
    assert.ok(frames.size>1,'Background frames change before the document finishes loading');
    assert.ok(burstFrames.size>1,'Wallpaper frames keep advancing during a large native mount');
    assert.equal(await browser.evaluate('document.readyState'),'loading');
    assert.equal(await browser.evaluate('document.querySelector(".rc-background-media")===originalMedia'),true);
    for (const source of loadingFeatures) {
      assert.ok((work[source]?.max||0)<100,`${source} must not monopolize a loading frame for 100 ms at 4× CPU slowdown`);
    }
    if (kind === 'video') assert.equal(await browser.evaluate('originalMedia.paused'), false);
    await fetch(origin+'/finish');
    await browser.waitFor('document.readyState===\'complete\'');
    await browser.waitFor("document.querySelectorAll('#grid .rc-hide-recommended-game').length===1000");
    assert.deepEqual(browser.errors,[]);
  });
