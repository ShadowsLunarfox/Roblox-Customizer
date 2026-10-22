const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const entries = manifest.content_scripts.filter(entry => entry.world !== 'MAIN');
const scripts = [...new Set(entries.flatMap(entry => entry.js || []))];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];

function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <style>body{font:14px Arial;margin:20px;background:#34465a;color:white}.game-card-container{display:inline-block;width:120px;padding:8px}#settings-popover-menu{position:fixed;top:0;right:0}</style></head><body class="dark-theme">
    <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>
    <main id="HomeContainer"><section><h2>Recommended For You</h2><div class="game-grid">
      ${Array.from({length:500}, (_,i) => `<div class="game-card-container"><a href="https://www.roblox.com/games/${1000+i}/Test"><span class="game-card-name">Game ${i}</span></a><div class="item-card-price"><span class="icon-robux-16x16"></span><span class="text-robux">${100+i}</span></div><div><span>Stats</span><button>Details</button><div><span>About this game</span><p>Description</p></div></div></div>`).join('')}
    </div></section></main><script>
      const listeners=[];window.saved={robloxCustomizerTermsAccepted:true,robloxCustomizerSettingsGuideSeen:true,customBackground:{source:'none',clockShowSeconds:false,experimentalCustomColors:true}};
      window.saves=0;window.cacheWrites=0;
      const write=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='roblox-customizer-visuals-v1')cacheWrites++;return write.call(this,key,value)};
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,saved[key]]))},async set(values){saves++;const changes=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{oldValue:saved[key],newValue:value}]));Object.assign(saved,values);listeners.forEach(fn=>fn(changes,'local'))}},onChanged:{addListener(fn){listeners.push(fn)}}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:123,name:'Player',displayName:'Player'}:message.type==='rc-playtime'?{ok:true,enabled:false,account:null,games:[],status:{kind:'disabled',checkedAt:0}}:{ok:true,games:[],folders:[]}))}}};
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Continuous settings input stays responsive on a busy page and commits the final value',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const assets = new Set([...styles, ...scripts, 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'settings-performance');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/home` });
    await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.waitFor("document.querySelectorAll('.text-robux + .rc-robux-equivalent').length===500");
    await browser.evaluate("document.querySelector('.rc-settings-menu-entry').click()");
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay #rc-dim')");
    await browser.evaluate('new Promise(resolve=>setTimeout(resolve,350))');
    await browser.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await browser.send('Performance.enable');
    for (const [id, key, final] of [['dim','dim','75'], ['glass-blur','glassBlur','31'], ['glass-opacity','glassOpacity','77'],
      ['custom-text-color','customTextColor','#ddeeff'], ['custom-background-color','customBackgroundColor','#28394a'], ['custom-accent-color','customAccentColor','#aa3399']]) {
      const before = await browser.send('Performance.getMetrics');
      const result = await browser.evaluate(`(async()=>{
        const input=document.getElementById('rc-${id}');input.scrollIntoView({block:'center'});input.focus();
        await new Promise(requestAnimationFrame);cacheWrites=0;saves=0;
        const handlers=[],frames=[];let last=performance.now();
        for(let frame=0;frame<12;frame++){
          await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-last);last=now;
          const start=performance.now();
          for(let i=0;i<8;i++){input.value=input.type==='color'?'#'+(0x123456+frame*256+i).toString(16):String(input.min*1+(frame*8+i)%(input.max*1-input.min*1+1));input.dispatchEvent(new Event('input',{bubbles:true}));}
          handlers.push(performance.now()-start);
        }
        input.value=${JSON.stringify(final)};input.dispatchEvent(new Event('input',{bubbles:true}));
        const writesDuringDrag=cacheWrites,savesDuringDrag=saves;
        const readout=document.getElementById('rc-${id.replace(/-color$/, '')}-value').value;
        input.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(resolve=>setTimeout(resolve,400));
        return {handlers,frames,writesDuringDrag,savesDuringDrag,readout,cacheWrites,saves,value:input.value,saved:saved.customBackground.${key},cache:JSON.parse(localStorage.getItem('roblox-customizer-visuals-v1'))};
      })()`);
      const after = await browser.send('Performance.getMetrics');
      const metric = (data, name) => data.metrics.find(entry => entry.name === name).value;
      t.diagnostic(`${id}: handler max ${Math.max(...result.handlers).toFixed(1)} ms; frame max ${Math.max(...result.frames).toFixed(1)} ms; style ${((metric(after,'RecalcStyleDuration')-metric(before,'RecalcStyleDuration'))*1000).toFixed(1)} ms; cache writes during drag ${result.writesDuringDrag}`);
      assert.equal(String(result.saved), final, 'The final value is saved');
      assert.equal(result.value, final, 'The control keeps the final value');
      assert.equal(result.readout, id.includes('color') ? final.toUpperCase() : final+(id==='glass-blur'?'px':'%'), 'Readouts update during dragging');
      if (key !== 'dim') assert.equal(String(result.cache[key]), final, 'The startup cache has the committed appearance');
      assert.equal(result.writesDuringDrag, 0, 'Continuous input must not synchronously write the appearance cache');
      assert.equal(result.savesDuringDrag, 0, 'Continuous input does not write settings until committed or paused');
      assert.ok(Math.max(...result.handlers) < 50, 'Input handlers must stay below a long task at 4× CPU slowdown');
      assert.ok(Math.max(...result.frames) < 200, 'Dragging must not trigger page-wide rendering stalls at 4× CPU slowdown');
    }
    // Exercise a real mouse drag, including native change on release.
    const rect = await browser.evaluate(`(()=>{const input=document.getElementById('rc-glass-blur');input.scrollIntoView({block:'center'});const r=input.getBoundingClientRect();return {x:r.left,y:r.top+r.height/2,width:r.width}})()`);
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: rect.x+rect.width*.2, y: rect.y });
    for (const fraction of [.35,.5,.65,.8]) {
      await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', button: 'left', buttons: 1, x: rect.x+rect.width*fraction, y: rect.y });
    }
    const dragged = await browser.evaluate("document.getElementById('rc-glass-blur').value");
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: rect.x+rect.width*.8, y: rect.y });
    await browser.waitFor(`saved.customBackground.glassBlur===${Number(dragged)}`);
    assert.equal(await browser.evaluate("document.documentElement.style.getPropertyValue('--rc-glass-blur')"), `${dragged}px`);
    // Pausing and closing must also flush edits without requiring a change event.
    await browser.evaluate("(()=>{const n=document.getElementById('rc-glass-blur');n.value='27';n.dispatchEvent(new Event('input',{bubbles:true}))})()");
    await browser.waitFor("saved.customBackground.glassBlur===27&&document.documentElement.style.getPropertyValue('--rc-glass-blur')==='27px'");
    await browser.evaluate("(()=>{const n=document.getElementById('rc-custom-accent-color');n.value='#7744aa';n.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('rc-done').click()})()");
    await browser.waitFor("!document.getElementById('rc-settings-overlay')&&saved.customBackground.customAccentColor==='#7744aa'");
    assert.equal(await browser.evaluate("JSON.parse(localStorage.getItem('roblox-customizer-visuals-v1')).customAccentColor"), '#7744aa');
    assert.deepEqual(browser.errors, []);
  });
