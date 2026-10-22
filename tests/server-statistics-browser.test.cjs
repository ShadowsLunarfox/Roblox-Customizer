const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const root = path.resolve(__dirname, '..');
const scripts = ['src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/native-labels.js',
  'src/shared/runtime.js', 'src/shared/i18n.js', 'src/shared/startup.js', 'src/pages/games/game-page.js'];
const styles = ['src/shared/theme.css', 'src/pages/games/game-page.css'];
function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="locale-data" data-language-code="en_us"><meta name="user-data" data-userid="42">
  <style>*{box-sizing:border-box}body{margin:0;font:14px/1.5 Arial;background:linear-gradient(130deg,#6b758f,#50435c);color:#fff}main{width:min(1020px,calc(100% - 32px));margin:20px auto}.card-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:12px}.card-item{min-width:0;padding:14px;border:1px solid #8888;border-radius:12px;background:var(--rc-surface,#252731)}button{padding:8px 16px;font:inherit}.game-server-status{font-weight:bold}</style>
  ${styles.map(file=>'<link rel="stylesheet" href="/'+file+'">').join('')}</head><body class="dark-theme"><main id="game-detail-page" data-place-id="123"><h1>Server statistics</h1><section id="game-instances"><section id="running-game-instances-container" class="server-list-section"><h2>Other Servers</h2><div class="card-list"></div></section></section></main>
  <script>
  window.requests=[];window.joins=[];window.pendingVersions=[];window.holdVersions=false;
  window.nativeCard=(i)=>'<div class="card-item" data-rc-instance-id="12345678-0000-4444-8888-'+String(i).padStart(12,'0')+'" data-playing="5" data-max-players="12" data-ping="80" data-country-code="SG" '+(i===0?'data-rc-server-fps="59.997505" data-rc-language-match-count="3" data-rc-server-city="Singapore"':'')+'><div class="game-server-status">5 of 12 people max</div><button class="game-server-join-btn" onclick="joins.push('+i+')">Join</button></div>';
  document.querySelector('.card-list').innerHTML=Array.from({length:12},(_,i)=>nativeCard(i)).join('');
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(){return {customBackground:{source:'none'}}},async set(){},async remove(){}},onChanged:{addListener(){}}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){requests.push(message);
    const finish=()=>{
      if(message.type==='rc-public-server-status'){callback({servers:message.serverIds.map(id=>Number(id.slice(-12))===1?{id,fps:30,languageMatchCount:0}: {id})});return}
      if(message.type==='rc-public-server-country'){const i=Number(message.serverId.slice(-12));callback(i===2?{error:'Unavailable'}:{placeVersion:15077+i});return}
      callback({error:'Unused fixture request'});
    };
    if(holdVersions&&message.type==='rc-public-server-country')pendingVersions.push(finish);else setTimeout(finish,30);
  }}};
  </script>${scripts.map(file=>'<script src="/'+file+'"></script>').join('')}</body></html>`;
}

test('server statistics preserve native Join, hide unavailable fields and fit seven languages and three themes',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const files = new Set([...scripts, ...styles]);
    const server = http.createServer((req,res)=>{
      const file = new URL(req.url, 'http://localhost').pathname.slice(1);
      res.setHeader('Content-Type', file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
      res.end(files.has(file) ? fs.readFileSync(path.join(root,file)) : fixture());
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser = await isolatedChrome(t, 'server-statistics');
    await browser.send('Emulation.setFocusEmulationEnabled', {enabled:true});
    const url = `http://127.0.0.1:${server.address().port}/games/123/Game#!/game-instances`;
    await browser.send('Page.navigate', {url});
    await waitForDocument(browser, '.rc-server-performance', url);
    await browser.waitFor("document.querySelectorAll('.card-item')[1].querySelector('.rc-server-language')?.textContent.includes('0 English')");
    await browser.waitFor("document.querySelector('.rc-server-version')?.textContent==='Place version: 15,077'");
    await browser.waitFor("document.querySelectorAll('.card-item')[7].querySelector('.rc-server-version')?.textContent==='Place version: 15,084'");
    assert.equal(await browser.evaluate("document.querySelector('.rc-server-performance').textContent"), 'Server performance: 100%');
    assert.equal(await browser.evaluate("document.querySelectorAll('.card-item')[1].querySelector('.rc-server-performance').textContent"), 'Server performance: 50%');
    assert.equal(await browser.evaluate("document.querySelectorAll('.card-item')[2].querySelectorAll('.rc-server-performance,.rc-server-language,.rc-server-version').length"), 0);
    assert.match(await browser.evaluate("document.querySelector('.rc-server-performance').title"), /not CPU/);
    assert.match(await browser.evaluate("document.querySelector('.rc-server-language').title"), /does not verify/);
    assert.equal(await browser.evaluate("requests.filter(r=>r.type==='rc-public-server-country').every(r=>r.includeLocation===false)"), true, 'Known countries do not trigger IP lookups');
    assert.equal(await browser.evaluate("requests.filter(r=>r.type==='rc-public-server-country').some(r=>Number(r.serverId.slice(-12))>=8)"), false, 'Hidden cards do not preload versions');
    const initialRequests = await browser.evaluate('requests.length');
    for (const locale of ['en','zh-CN','zh-TW','id','ja','th','ko']) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      for (const theme of ['dark','light','custom']) {
        await browser.evaluate(`document.body.className='${theme==='light'?'light':'dark'}-theme';RobloxCustomizerStartup.setPreferences({source:'none',experimentalCustomColors:${theme==='custom'},customTextColor:'#ffffff',customBackgroundColor:'#394b84',customAccentColor:'#fc33ff'})`);
        for (const width of [1200,390,320]) {
          await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
          const result = await browser.evaluate(`(()=>{const card=document.querySelector('.card-item'),r=card.getBoundingClientRect(),locale=RobloxCustomizerI18n.locale(),language=new Intl.DisplayNames([locale],{type:'language'}).of('en');return {
            labels:[...card.querySelectorAll('.rc-server-performance,.rc-server-language,.rc-server-version')].map(n=>n.textContent),
            expected:[RobloxCustomizerI18n.t('Server performance: {value}%',{value:'100'}),RobloxCustomizerI18n.t('{count} {language} language matches',{count:'3',language}),RobloxCustomizerI18n.t('Place version: {value}',{value:new Intl.NumberFormat(locale).format(15077)})],
            fits:[...card.querySelectorAll('.rc-server-metrics>span')].every(n=>{const b=n.getBoundingClientRect();return n.hidden||b.left>=r.left-1&&b.right<=r.right+1&&n.scrollWidth<=n.clientWidth+1}),overflow:document.documentElement.scrollWidth>innerWidth+1}})()`);
          assert.deepEqual(result.labels,result.expected,`${locale}/${theme}/${width}`);
          assert.equal(result.fits,true);assert.equal(result.overflow,false);
          if(process.env.SERVER_STATISTICS_SCREENSHOTS && locale==='zh-CN' && theme==='custom' && [1200,320].includes(width)) {
            const shot=await browser.send('Page.captureScreenshot',{format:'png'});
            fs.writeFileSync(path.join(process.env.SERVER_STATISTICS_SCREENSHOTS,`statistics-${width}.png`),Buffer.from(shot.data,'base64'));
          }
        }
      }
    }
    assert.equal(await browser.evaluate('requests.length'), initialRequests, 'Changing extension UI language/theme does not refetch Roblox data');
    await browser.click('.card-item .game-server-join-btn');
    assert.deepEqual(await browser.evaluate('joins'),[0]);
    await browser.click('.rc-public-server-next');
    await browser.waitFor("document.querySelectorAll('.card-item')[8].querySelector('.rc-server-version')?.textContent.includes('15,085')");
    await browser.click('.card-item:nth-child(9) .game-server-join-btn');
    assert.deepEqual(await browser.evaluate('joins'),[0,8]);
    // Reusing a native DOM card for another server cannot retain its old stats.
    await browser.evaluate("const c=document.querySelectorAll('.card-item')[8];c.dataset.rcInstanceId='12345678-9999-4444-8888-999999999999'");
    await browser.waitFor("!document.querySelectorAll('.card-item')[8].querySelector('.rc-server-version')?.textContent.includes('15,085')");
    assert.deepEqual(browser.errors,[]);
  });
