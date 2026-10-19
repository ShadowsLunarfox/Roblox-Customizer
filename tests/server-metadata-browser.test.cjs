const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts.filter(entry => entry.world !== 'MAIN').flatMap(entry => entry.js || []);
const bridge = manifest.content_scripts.find(entry => entry.world === 'MAIN').js;
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const realReact = process.env.SERVER_VIEW_REACT_BUNDLE;
const nativeBundle = process.env.SERVER_METADATA_NATIVE_BUNDLE;
const nativeCard = nativeBundle && (() => {
  const source = fs.readFileSync(nativeBundle, 'utf8');
  const start = source.indexOf('function ig(e)');
  const end = source.indexOf('function iw(', start);
  assert.ok(start > 0 && end > start, 'The native server-card component exists in the supplied bundle');
  return `(function(){
    const F=React,L=ReactJSX,eL={authenticatedUser:{id:1}},rJ={public:{key:'public'},friend:{key:'friends'},Vip:{key:'private'}},rY={serverIdText:'id',joinServerText:'join'};
    const id=()=>['Ping.Medium'],iy=()=>({}),nS=()=> (...args)=>args.filter(v=>typeof v==='string').join(' ');
    const ng={Button:p=>React.createElement('button',{className:p.className,disabled:p.isDisabled,onClick:p.onClick},p.children)};
    const nD=(placeId,{instanceId})=>()=>actions.push(instanceId),im=()=>null;
    const ib=()=>React.createElement('div',{className:'server-player-count-gauge'});
    const iv=()=>React.createElement('span',{className:'server-meta-badge-tip'},'Native latency badge');
    ${source.slice(start,end)}
    window.NativeCard=ig;
  })();`;
})();
const setup = `
  window.statusRequests=[];window.actions=[];
  window.chrome={storage:{local:{async get(){return {robloxCustomizerTermsAccepted:true,customBackground:{source:'none',hideXFeed:true,hideYouTubeFeed:true}}},async set(){}},onChanged:{addListener(){}}},
    runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
      if(message.type==='rc-public-server-status'){statusRequests.push({message,callback});return}
      setTimeout(()=>callback(message.type==='rc-public-server-country'?{countryCode:'SG'}
        :message.type==='rc-pinned-games'?{games:[],folders:[]}:message.type==='rc-currency-rates'?{rates:{USD:1}}:{error:'Unused fixture request'}),10);
    }}};
`;
function html() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="locale-data" data-language-code="id_id">
    <style>body{margin:20px;font:16px Arial;background:#343344;color:white}#game-detail-page{max-width:1000px;margin:auto}.card-list{display:flex;flex-wrap:wrap;padding:0;list-style:none}.rbx-public-game-server-item{width:25%}.card-item{padding:16px;margin:8px;background:#53516a}button{padding:8px}.server-list-options{display:flex}</style>
    ${styles.map(file => '<link rel="stylesheet" href="/'+file+'">').join('')}${realReact ? '<script src="/react.js"></script>' : ''}${nativeCard ? '<script src="/native-card.js"></script>' : ''}</head><body>
    <main id="game-detail-page" data-place-id="4623386862"><h1>Piggy</h1><section id="game-instances"><div id="native-root"></div></section></main>
    <script>
      window.nativeServers=Array.from({length:8},(_,i)=>({id:'12345678-'+String(i).padStart(4,'0')+'-4444-8888-'+String(i).padStart(12,'0'),playing:i%6,maxPlayers:6,pingSignalLevel:'Medium'}));
      const h=window.React?.createElement; // Captured before the extension's factory hooks attach.
      function Card(p){if(window.NativeCard)return h(NativeCard,{...p,cssKey:'public-',players:[],maxPlayers:6,isLoading:p.currentPlayersCount===2,translate:(key,args)=>key==='id'?'ID: '+args.serverId:'Bergabung'});return h('li',{className:'rbx-public-game-server-item'},h('div',{className:'card-item'},
        h('div',{className:'game-server-status'},p.gameServerStatus),h('button',{className:'game-server-join-btn',disabled:p.currentPlayersCount===2,onClick:()=>actions.push(p.id)},'Bergabung'),h('div',{className:'server-id-text'},'ID: '+p.id.substring(9,18))))}
      function List(p){return h('section',{id:'rbx-public-running-games',className:'stack server-list-section'},
        h('div',{className:'container-header'},h('h2',{},'Layanan Lainnya'),h('div',{className:'server-list-options'},
          h('label',{},'Urutkan Berdasarkan',h('select',{},h('option',{},'Direkomendasikan Untukmu'))),h('label',{},h('input',{type:'checkbox',defaultChecked:true}),'Mengecualikan Server Penuh'))),
        h('ul',{className:'card-list'},p.gameInstances.map(s=>h(Card,{...s,key:s.id,serverListType:'public',gameServerStatus:s.playing+' dari maksimal 6 pemain',currentPlayersCount:s.playing}))),
        p.gameInstances.length===8&&h('div',{className:'rbx-public-running-games-footer'},h('button',{className:'rbx-running-games-load-more',onClick:loadMore},'Load Lebih Banyak')))}
      function loadMore(){actions.push('load-more');nativeServers.push(...Array.from({length:4},(_,i)=>({...nativeServers[0],id:'12345678-'+String(i+8).padStart(4,'0')+'-4444-8888-'+String(i+8).padStart(12,'0')})));renderNative()}
      function renderNative(){
        if(h){ReactDOM.render(h(List,{gameInstances:nativeServers}),document.getElementById('native-root'));return}
        const markup='<section id="rbx-public-running-games" class="server-list-section"><h2>Layanan Lainnya</h2><div class="server-list-options"><label><input type="checkbox">Mengecualikan Server Penuh</label></div><ul class="card-list">'+nativeServers.map(s=>'<li class="rbx-public-game-server-item"><div class="card-item"><div class="game-server-status">'+s.playing+' dari maksimal 6 pemain</div><button class="game-server-join-btn">Bergabung</button><div class="server-id-text">ID: '+s.id.substring(9,18)+'</div></div></li>').join('')+'</ul>'+(nativeServers.length===8?'<button class="rbx-running-games-load-more">Load Lebih Banyak</button>':'')+'</section>';
        const existing=document.getElementById('rbx-public-running-games');
        if(existing){
          const template=document.createElement('div');template.innerHTML=markup;
          existing.querySelector('.card-list').replaceChildren(...template.querySelector('.card-list').childNodes);
          existing.querySelector('.rbx-running-games-load-more')?.remove();
          const more=template.querySelector('.rbx-running-games-load-more');if(more)existing.append(more);
        }else document.getElementById('native-root').innerHTML=markup;
        [...document.querySelectorAll('.card-item')].forEach((card,i)=>{
          card.__reactFiber$fixture={memoizedProps:{},return:{memoizedProps:{...nativeServers[i],gameServerStatus:'Native count',serverListType:'public'},return:{memoizedProps:{gameInstances:nativeServers}}}};
          card.querySelector('button').disabled=nativeServers[i].playing===2;
          card.querySelector('button').onclick=()=>actions.push(nativeServers[i].id);
        });
        const more=document.querySelector('.rbx-running-games-load-more');if(more)more.onclick=loadMore;
      }
      renderNative();
      window.hiddenBeforeObservers=document.querySelector('.server-list-options').checkVisibility()===false&&document.querySelector('.rbx-running-games-load-more').checkVisibility()===false;
      window.fixtureReady=true;
    </script></body></html>`;
}
for (const useBridge of [true, false]) test(`Piggy metadata recovers ${useBridge ? 'after late hooks' : 'with no MAIN bridge'} and Indonesian controls never flash`,
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const assets = new Set([...scripts, ...bridge, ...styles]);
    const server = http.createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      if (file === 'react.js' && realReact) { response.setHeader('Content-Type', 'text/javascript'); response.end(fs.readFileSync(realReact)); }
      else if (file === 'native-card.js' && nativeCard) { response.setHeader('Content-Type', 'text/javascript'); response.end(nativeCard); }
      else if (assets.has(file)) { response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript'); response.end(fs.readFileSync(path.join(workspace, file))); }
      else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html()); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'server-metadata');
    await browser.send('Network.setBlockedURLs', { urls: ['https://*'] });
    const worldName = 'roblox-customizer-test';
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.actions=[]' });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup, worldName });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(workspace, file), 'utf8'), worldName });
    const url = `http://127.0.0.1:${server.address().port}/id/games/4623386862/Piggy`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#rbx-public-running-games', url);
    const { frameTree } = await browser.send('Page.getFrameTree');
    const { executionContextId } = await browser.send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName });
    const evaluateExtension = async expression => {
      const result = await browser.send('Runtime.evaluate', { expression, contextId: executionContextId, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    assert.equal(await browser.evaluate('typeof chrome.storage'), 'undefined', 'Page scripts cannot access the extension API');
    assert.equal(await evaluateExtension("Object.keys(document.querySelector('.card-item')).some(key=>key.startsWith('__react'))"), false,
      'The isolated content script cannot read native React properties');
    assert.equal(await browser.evaluate('hiddenBeforeObservers'), true, 'Native controls are hidden by CSS before mutation observers run');
    assert.equal(await browser.evaluate("document.querySelector('.card-item').hasAttribute('data-rc-instance-id')"), false, 'Native cards mounted before the bridge');
    const finishStatuses = () => evaluateExtension(`statusRequests.splice(0).forEach(({message,callback})=>{
      const matches=(message.shortIds||[]).map(shortId=>({shortId,id:'12345678-'+shortId+'-8888-'+String(Number(shortId.slice(0,4))).padStart(12,'0')}));
      callback({matches,servers:[...(message.serverIds||[]),...matches.map(m=>m.id)].map(id=>({id,ping:142}))});
    })`);
    if (useBridge) for (const file of bridge) await browser.evaluate(fs.readFileSync(path.join(workspace, file), 'utf8'));
    await browser.waitFor("document.querySelector('.rc-server-latency')?.checkVisibility()");
    assert.equal(await browser.evaluate("document.querySelector('.rc-server-country').checkVisibility()&&document.querySelector('.rc-server-latency').checkVisibility()"), true);
    assert.equal(await browser.evaluate("document.querySelector('.rc-server-latency').textContent"), useBridge ? 'Latensi sedang' : 'Memeriksa latensi...');
    assert.ok(await evaluateExtension('statusRequests.length>0'));
    await finishStatuses();
    await browser.waitFor("document.querySelector('.rc-server-latency')?.textContent.includes('142')");
    await browser.waitFor("document.querySelector('.card-item')?.dataset.rcServerCountry==='SG'");
    assert.equal(await browser.evaluate("document.querySelectorAll('.card-item')[2].querySelector('button').disabled"), true);
    await browser.click('.rc-public-server-next');
    try {
      await browser.waitFor("[...document.querySelectorAll('.card-item')].filter(card=>card.checkVisibility()).length===4");
    } catch (error) {
      throw new Error(JSON.stringify(await browser.evaluate("({actions,count:nativeServers.length,shown:[...document.querySelectorAll('.card-item:not([data-rc-server-page-hidden])')].map(card=>card.dataset),page:document.querySelector('.rc-public-server-page-number')?.textContent,message:document.querySelector('.rc-public-server-page-message')?.textContent})")), { cause: error });
    }
    assert.equal(await browser.evaluate("actions.filter(value=>value==='load-more').length"), 1, 'Custom Next uses the hidden native loader');
    await browser.waitFor("!!document.querySelectorAll('.card-item')[8]?.querySelector('.rc-server-latency')");
    if (!useBridge) await finishStatuses();
    await browser.waitFor("document.querySelectorAll('.card-item')[8]?.dataset.rcServerCountry==='SG'");
    await browser.click('.rbx-public-game-server-item:nth-child(9) .game-server-join-btn');
    assert.equal(await browser.evaluate('actions.at(-1)'), '12345678-0008-4444-8888-000000000008');
    assert.equal(await browser.evaluate("document.querySelector('.server-list-options').checkVisibility()"), false);
    if (!useBridge) {
      await browser.evaluate("document.querySelectorAll('.server-id-text')[8].textContent=''");
      await browser.waitFor("document.querySelectorAll('.card-item')[8]?.querySelector('.rc-server-latency')?.textContent==='Latensi tidak tersedia'");
      assert.equal(await browser.evaluate("document.querySelectorAll('.card-item')[8].querySelector('.rc-server-country').textContent"), 'Negara tidak diketahui');
    }
    if (process.env.SERVER_METADATA_SCREENSHOT) {
      const screenshot = await browser.send('Page.captureScreenshot');
      fs.writeFileSync(process.env.SERVER_METADATA_SCREENSHOT, Buffer.from(screenshot.data, 'base64'));
    }
    assert.deepEqual(browser.errors, []);
  });
