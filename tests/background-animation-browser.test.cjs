const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const animatedGif = require('./helpers/animated-gif.cjs');
const animatedVideo = require('./helpers/animated-video.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/runtime.js',
  'src/shared/native-labels.js', 'src/shared/startup.js', 'src/settings/settings.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];

function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <style>body{font:16px Arial;margin:32px;background:#222}#settings-popover-menu{position:fixed;right:0;top:0;z-index:1000}</style>
    </head><body><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>
    <main id="HomeContainer"><section><h2>Recommended For You</h2>
    ${Array.from({ length: 60 }, (_, i) => `<div class="game-card-container"><a href="https://www.roblox.com/games/${i + 100}/Game">Game ${i}</a></div>`).join('')}
    </section></main><script>
      const listeners=[];
      const read=()=>JSON.parse(localStorage.getItem('customBackground')||'null')||{source:'none',clockShowSeconds:false,hideRecommendedUpper:true};
      window.blobCreates=0;const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{blobCreates++;return create(blob)};
      window.chrome={storage:{local:{async get(){return {customBackground:read()}},async set(patch){const previous=read();localStorage.setItem('customBackground',JSON.stringify(patch.customBackground));listeners.forEach(fn=>fn({customBackground:{oldValue:previous,newValue:patch.customBackground}},'local'))},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
      window.patchSettings=patch=>chrome.storage.local.set({customBackground:{...read(),...patch}});
      window.storeBackground=async kind=>{
        let file;
        if(kind==='gif')file=new File([await(await fetch('/animation.gif')).blob()],'animation.gif',{type:'image/gif'});
        else file=new File([await (${animatedVideo})()],'animation.mp4',{type:'video/mp4'});
        await new Promise((resolve,reject)=>{
          const open=indexedDB.open('roblox-customizer-media',1);
          open.onupgradeneeded=()=>open.result.createObjectStore('backgrounds');open.onerror=()=>reject(open.error);
          open.onsuccess=()=>{const db=open.result,tx=db.transaction('backgrounds','readwrite');tx.objectStore('backgrounds').put(file,kind);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)};
        });
        await patchSettings({source:'file',fileKey:kind,fileName:file.name});
      };
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

for (const kind of ['gif', 'video']) test(`${kind} background keeps animating after reload and unrelated preference updates`,
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const assets = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.gif') ? 'image/gif' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(file === 'animation.gif' ? animatedGif() : assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'background-animation');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const url = `http://127.0.0.1:${server.address().port}/home`;
    const ready = kind === 'gif'
      ? "document.querySelector('#rc-background-layer img')?.naturalWidth===2"
      : "document.querySelector('#rc-background-layer video')?.readyState>=2";
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
    if (kind === 'video') assert.equal(await browser.evaluate("MediaRecorder.isTypeSupported('video/mp4')"), true);
    await browser.evaluate(`storeBackground('${kind}')`);
    await browser.waitFor(ready);
    await browser.send('Page.reload');
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.waitFor(ready);
    await browser.evaluate("window.originalMedia=document.querySelector('.rc-background-media');window.initialBlobCreates=blobCreates");
    if (kind === 'video') {
      for (const event of ['focus', 'pageshow', 'visibilitychange']) {
        const target = event === 'visibilitychange' ? 'document' : 'window';
        await browser.evaluate(`originalMedia.pause();${target}.dispatchEvent(new Event('${event}'))`);
        await browser.waitFor('!originalMedia.paused');
      }
    }
    await browser.evaluate("(async()=>{for(let i=0;i<4;i++){await patchSettings({glassOpacity:50+i,hideFavorites:i%2===0});await new Promise(resolve=>setTimeout(resolve,80))}})()");
    assert.equal(await browser.evaluate("document.querySelector('.rc-background-media')===originalMedia"), true,
      'Appearance and Home changes must not repeatedly restart the saved animation');
    assert.equal(await browser.evaluate('blobCreates-initialBlobCreates'), 0, 'Unchanged media is not read from IndexedDB again');
    if (kind === 'gif') {
      const frames = new Set();
      for (let i = 0; i < 5; i++) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', clip: { x: 2, y: 2, width: 8, height: 8, scale: 1 } });
        frames.add(shot.data);
        await browser.evaluate('new Promise(resolve=>setTimeout(resolve,65))');
      }
      assert.ok(frames.size > 1, 'The rendered GIF advances frames after a real page reload');
    } else {
      assert.equal(await browser.evaluate("new Promise(resolve=>{const timeout=setTimeout(()=>resolve(false),1500);originalMedia.requestVideoFrameCallback(()=>{clearTimeout(timeout);resolve(true)})})"), true,
        'The restored MP4 presents another decoded frame');
    }
    assert.deepEqual(browser.errors, []);
  });
