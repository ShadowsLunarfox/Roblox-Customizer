const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const root = path.resolve(__dirname, '..');

test('globe dragging uses a bounded frame budget, preserves markers and becomes idle after updates',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const files = new Set(['src/servers/server-globe.js','src/servers/server-globe.css',
      'src/servers/globe/geo-engine.mjs','src/servers/globe/countries.mjs']);
    const server = http.createServer((req,res)=>{
      const file = new URL(req.url,'http://localhost').pathname.slice(1);
      res.setHeader('Content-Type', /\.m?js$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');
      if(files.has(file)){res.end(fs.readFileSync(path.join(root,file)));return}
      res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/servers/server-globe.css">
        <style>body{margin:20px;background:#515b78;color:white;font:14px Arial}#host{width:min(950px,100%)}button,input{font:inherit}button{color:inherit}</style></head>
        <body><div class="rc-public-server-filters"><div class="rc-public-server-map"><div id="host" class="rc-public-server-map-canvas"></div></div></div>
        <script>
        window.frameCosts=[];const nativeFrame=requestAnimationFrame;
        window.requestAnimationFrame=callback=>nativeFrame(time=>{const start=performance.now();try{callback(time)}finally{frameCosts.push(performance.now()-start)}});
        window.chrome={runtime:{getURL:file=>'/'+file}};
        window.chosen=[];window.cityChoices=[];window.echoTimer=0;
        window.state={visible:true,country:'all',city:'all',total:8,counts:{SG:4,US:2,AU:1,GB:1},cities:[
          {name:'Singapore',country:'SG',latitude:1.35,longitude:103.8,count:4},
          {name:'Sydney',country:'AU',latitude:-33.86,longitude:151.2,count:1},
          {name:'Chicago',country:'US',latitude:41.88,longitude:-87.63,count:1},
          {name:'Slough',country:'GB',latitude:51.51,longitude:-.59,count:1},
          {name:'Seattle',country:'US',latitude:47.6,longitude:-122.3,count:1}],
          onCountry(code){chosen.push(code);state={...state,country:code};sync()},onCity(city){cityChoices.push(city.name)}};
        window.sync=()=>RobloxCustomizerServerGlobe.sync(document.getElementById('host'),state);
        </script><script src="/src/servers/server-globe.js"></script><script>
        sync();
        // Page enhancement observers resync filters after globe child changes.
        new MutationObserver(()=>{if(!echoTimer)echoTimer=setTimeout(()=>{echoTimer=0;sync()},50)})
          .observe(document.getElementById('host'),{childList:true,subtree:true});
        </script></body></html>`);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser = await isolatedChrome(t,'server-globe-drag');
    await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1120,height:900,deviceScaleFactor:1,mobile:false});
    await browser.send('Emulation.setCPUThrottlingRate',{rate:4});
    const url=`http://127.0.0.1:${server.address().port}/`;
    await browser.send('Page.navigate',{url});await waitForDocument(browser,'.rc-server-globe',url);
    await browser.waitFor("document.querySelectorAll('[data-rc-globe-country]').length>230&&!!document.querySelector('[data-rc-globe-country=MY]').getAttribute('d')");
    await pause(650);
    await browser.evaluate("frameCosts=[];window.markerChanges=0;window.sideChanges=0;new MutationObserver(r=>markerChanges+=r.filter(n=>n.type==='childList').length).observe(document.querySelector('.rc-server-globe-cities'),{subtree:true,childList:true});new MutationObserver(r=>sideChanges+=r.length).observe(document.querySelector('.rc-server-globe-sidebar'),{subtree:true,childList:true,attributes:true,characterData:true})");
    await pause(600);
    const idleDraws=await browser.evaluate('frameCosts.length');
    const point=await browser.evaluate("(()=>{const r=document.querySelector('.rc-server-globe svg').getBoundingClientRect();return{x:r.x+r.width*.5,y:r.y+r.height*.5}})()");
    await browser.evaluate('frameCosts=[]');
    if(process.env.GLOBE_DRAG_PROFILE){await browser.send('Profiler.enable');await browser.send('Profiler.start');}
    await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',...point});
    for(let i=1;i<=30;i++){
      await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',buttons:1,x:point.x+i*4,y:point.y+Math.sin(i/8)*25});
      if(i===15)await browser.evaluate("state={...state,total:9,counts:{...state.counts,SG:5},cities:state.cities.map(city=>city.country==='SG'?{...city,count:5}:city)};sync()");
      await pause(14);
    }
    const moving=await browser.evaluate('({costs:[...frameCosts],markerChanges,sideChanges})');
    if(process.env.GLOBE_DRAG_PROFILE){const {profile}=await browser.send('Profiler.stop');fs.writeFileSync(process.env.GLOBE_DRAG_PROFILE,JSON.stringify(profile));}
    const movingShot=await browser.send('Page.captureScreenshot',{format:'png'});
    if(process.env.GLOBE_DRAG_SCREENSHOT)fs.writeFileSync(process.env.GLOBE_DRAG_SCREENSHOT.replace(/\.png$/, '-moving.png'),Buffer.from(movingShot.data,'base64'));
    await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',x:point.x+120,y:point.y+Math.sin(30/8)*25});
    await pause(650);
    const sorted=moving.costs.sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||0;
    t.diagnostic(JSON.stringify({idleDraws,dragFrames:sorted.length,p95Ms:+p95.toFixed(2),maxMs:+(sorted.at(-1)||0).toFixed(2),markerChanges:moving.markerChanges,sideChanges:moving.sideChanges}));
    assert.deepEqual(await browser.evaluate('chosen'),[],'Dragging cannot select a country');
    if(!process.env.GLOBE_DRAG_BASELINE){
      assert.equal(idleDraws,0,'An unchanged filter sync cannot start an idle redraw loop');
      assert.ok(sorted.length>=12,'Dragging continues to present frames');
      assert.ok(p95<35,`Drag JS budget at 4x CPU: ${p95.toFixed(1)} ms`);
      assert.equal(moving.markerChanges,0,'Dragging reuses city markers');
      assert.equal(moving.sideChanges,0,'Dragging never rebuilds the country sidebar');
      assert.equal(await browser.evaluate("document.querySelector('.rc-server-globe-drag-canvas').hidden"),true,'Fine SVG geometry returns after release');
      assert.equal(await browser.evaluate("document.querySelector('[data-rc-globe-code=SG] .rc-server-globe-count').textContent"),'5','Server updates received during dragging appear after release');
      const stillShot=await browser.send('Page.captureScreenshot',{format:'png'});
      const mismatch=await browser.evaluate(`(async()=>{
        const read=async data=>{const image=await createImageBitmap(await(await fetch('data:image/png;base64,'+data)).blob());const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);image.close();return context.getImageData(0,0,canvas.width,canvas.height)};
        const a=await read(${JSON.stringify(movingShot.data)}),b=await read(${JSON.stringify(stillShot.data)}),r=document.querySelector('.rc-server-globe svg').getBoundingClientRect(),scale=r.width/600;
        const land=(data,x,y)=>{const i=(Math.round(y)*a.width+Math.round(x))*4;return Math.abs(data[i]-37)<4&&Math.abs(data[i+1]-60)<4&&Math.abs(data[i+2]-86)<4||Math.abs(data[i]-43)<4&&Math.abs(data[i+1]-104)<4&&Math.abs(data[i+2]-120)<4};
        let total=0,different=0;
        for(let y=-170;y<=170;y+=5)for(let x=-170;x<=170;x+=5){if(x*x+y*y>170*170)continue;const px=r.left+(300+x)*scale,py=r.top+(248+y)*scale;total++;if(land(a.data,px,py)!==land(b.data,px,py))different++;}
        return different/total;
      })()`);
      assert.ok(mismatch<.08,`Preview and fine map disagree on ${(mismatch*100).toFixed(1)}% of sampled land`);
      await browser.evaluate('frameCosts=[];for(let i=0;i<40;i++)sync()');await pause(200);
      assert.equal(await browser.evaluate('frameCosts.length'),0);
    }
    await browser.click('[data-rc-globe-code=SG]');
    await browser.waitFor("document.querySelector('[data-rc-globe-country=SG]').classList.contains('rc-is-selected')");
    await browser.waitFor("!!document.querySelector('[data-rc-globe-city=Singapore]')");
    await browser.click('[data-rc-globe-city=Singapore]');
    assert.deepEqual(await browser.evaluate('cityChoices'),['Singapore']);
    if(process.env.GLOBE_DRAG_SCREENSHOT){const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.GLOBE_DRAG_SCREENSHOT,Buffer.from(shot.data,'base64'))}
    assert.deepEqual(browser.errors,[]);
  });
