const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts.flatMap(entry => entry.js || []);
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#647abb"/></svg>';
const words = {
  en: { private: 'Private Servers', public: 'Other Servers', join: 'Join', empty: 'No public servers available.' },
  'zh-cn': { private: '私人服务器', public: '其他服务器', join: '加入', empty: '没有可用的公共服务器' },
  'zh-tw': { private: '私人伺服器', public: '其他伺服器', join: '加入', empty: '沒有可用的公共伺服器' }
};
const setup = `
  // Compress the production pane timeout while retaining the actual loader,
  // native events, IntersectionObserver, and all manifest content scripts.
  const nativeTimeout=window.setTimeout;
  window.setTimeout=(callback,delay,...args)=>nativeTimeout(callback,delay===15000?250:delay,...args);
  window.chrome={storage:{local:{async get(){return {customBackground:{source:'none',hideXFeed:true,hideYouTubeFeed:true}}},async set(){}},onChanged:{addListener(){}}},
    runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
      const response=message.type==='rc-pinned-games'?{ok:true,games:[],folders:[]}
        :message.type==='rc-currency-rates'?{ok:true,date:'2026-10-11',rates:{USD:1,MYR:4.1}}
        :message.type==='rc-private-server-details'?{servers:[{id:111,name:'My server',ownerName:'Owner',playing:1,maxPlayers:12,playerImages:[]}],uniqueNames:['my server']}
        :{error:'No optional data in this fixture'};
      nativeTimeout(()=>callback(response),10);
    }}};
`;

function html(url) {
  const locale = url.searchParams.get('locale') || 'en';
  const w = words[locale];
  const publicId = url.searchParams.get('mode') === 'discarded' ? 'rbx-public-running-games' : 'running-game-instances-container';
  return `<!doctype html><html lang="${locale}" class="dark-theme"><head><meta charset="utf-8">
    <style>body{margin:0;font:16px Arial;background:#24252c;color:white}#game-detail-page{max-width:1000px;margin:20px auto}#native-hero{height:1400px}#store{min-height:160px}#${publicId}{min-height:150px}.tab-pane{display:none}.tab-pane.active{display:block}button,input{font:inherit;padding:8px}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
    <main id="game-detail-page" data-place-id="893973440"><header id="native-hero"><h1>Flee the Facility</h1></header>
      <div id="game-detail-meta-data" data-place-id="893973440"></div>
      <ul id="horizontal-tabs"><li id="tab-about"><a href="#!/about">About</a></li><li id="tab-store"><a href="#!/store">Store</a></li><li id="tab-game-instances"><a href="#!/game-instances">Servers</a></li></ul>
      <div class="tab-content"><section id="about" class="tab-pane active"><div class="game-description-container"><p class="game-description">Native description</p></div></section>
        <section id="store" class="tab-pane"><div class="card-item">Native pass <button onclick="nativeActions.buy++">Buy</button></div></section>
        <section id="game-instances" class="tab-pane"><section id="private-server-container"><h2>${w.private}</h2><div class="card-list"><div data-private-server-id="111"><div><div class="text-title-medium">My server</div><img src="/image.svg"><div class="text-body-medium">1 of 12 people max</div></div><div><button onclick="nativeActions.join++">${w.join}</button><a href="https://www.roblox.com/private-server/configure/111">Configure</a></div></div></div></section>
          <section id="${publicId}"><h2>${w.public}</h2><button id="native-refresh" onclick="nativeActions.refresh++">Refresh</button><div class="native-public-content"><div class="spinner">Loading...</div></div></section>
        </section></div></main>
    <script>
      window.nativeActions={join:0,buy:0,refresh:0};window.tabEvents=[];window.publicLoads=0;
      window.allowPublic=${JSON.stringify(url.searchParams.get('mode') !== 'timeout')};
      const servers=document.getElementById('game-instances');
      const publicList=document.getElementById('${publicId}');
      const content=publicList.querySelector('.native-public-content');
      window.renderPublic=()=>{
        if(!allowPublic||!servers.classList.contains('active')||content.querySelector('.card-item,.native-empty'))return;
        publicLoads++;
        content.innerHTML=${JSON.stringify(url.searchParams.get('mode') === 'empty'
          ? `<p class="native-empty">${w.empty}</p>`
          : `<div class="card-list">${Array.from({ length: 12 }, (_, i) => `<div class="card-item" data-playing="${i}"><div class="game-server-status">${i} of 12 people max</div><button class="game-server-join-btn" onclick="nativeActions.join++">${w.join}</button></div>`).join('')}</div>`)};
      };
      for(const name of ['about','store','game-instances'])document.querySelector('#tab-'+name+' a').onclick=event=>{
        event.preventDefault();tabEvents.push(name);history.replaceState(history.state,'','#!/'+name);
        for(const pane of document.querySelectorAll('.tab-pane'))pane.classList.toggle('active',pane.id===name);
        // A discarded or initially lazy list waits for both native tab activation
        // and visibility. This is the failure a one-time offscreen visit misses.
        if(name==='game-instances'&&(publicLoads===0&&allowPublic||publicList.getBoundingClientRect().top<innerHeight+240))renderPublic();
      };
      new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))renderPublic()},{rootMargin:'240px 0px'}).observe(publicList);
      window.discardServers=()=>{content.innerHTML='<div class="spinner">Loading...</div>'};
      window.fixtureReady=true;
    </script></body></html>`;
}

test('server lists recover after idle at the top, timeout, native eviction and tab suspension in every UI language',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...styles, ...scripts, 'icons/icon-48.png']);
    const server = http.createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      const url = new URL(request.url, 'http://localhost');
      const file = url.pathname.slice(1);
      if (files.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/png');
        response.end(fs.readFileSync(path.join(workspace, file)));
      } else if (url.pathname === '/image.svg') {
        response.setHeader('Content-Type', 'image/svg+xml'); response.end(svg);
      } else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html(url)); }
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_SERVER_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'game-server-idle');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Network.setBlockedURLs', { urls: ['https://*'] });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file
    });
    for (const locale of Object.keys(words)) for (const mode of ['timeout', 'discarded', 'empty']) {
      const url = `http://127.0.0.1:${server.address().port}/games/893973440/Flee-the-Facility?locale=${locale}&mode=${mode}#!/game-instances`;
      await browser.send('Page.navigate', { url });
      await waitForDocument(browser, '#game-detail-page', url);
      await browser.waitFor("tabEvents.at(-1)==='about' && document.querySelector('#about').classList.contains('active')");
      assert.deepEqual(await browser.evaluate('tabEvents'), ['store', 'game-instances', 'about']);
      if (mode === 'discarded') await browser.evaluate('discardServers()');
      await browser.evaluate('allowPublic=true');
      // Wait without scrolling, then freeze and resume the native browser tab.
      await pause(800);
      assert.equal(await browser.evaluate('tabEvents.length'), 3, 'No hidden retry loop');
      assert.equal(await browser.evaluate('scrollY'), 0, 'Priming cannot scroll the page');
      await browser.send('Page.setWebLifecycleState', { state: 'frozen' });
      await pause(100);
      await browser.send('Page.setWebLifecycleState', { state: 'active' });
      await browser.send('Page.bringToFront');
      await browser.evaluate("document.getElementById('game-instances').scrollIntoView({block:'start'})");
      await browser.waitFor(mode === 'empty' ? "!!document.querySelector('.native-empty')" : "document.querySelectorAll(':is(#running-game-instances-container, #rbx-public-running-games) .card-item').length===12");
      if (mode !== 'empty') {
        await browser.waitFor("!!document.querySelector('.rc-public-server-filters') && document.querySelectorAll(':is(#running-game-instances-container, #rbx-public-running-games) .card-item:not([data-rc-server-page-hidden])').length===8");
        assert.equal(await browser.evaluate("document.querySelector('#game-instances').classList.contains('active')"), true);
        assert.equal(await browser.evaluate('tabEvents.at(-1)'), 'game-instances');
        await browser.evaluate(`(()=>{const input=document.querySelector('[data-rc-server-filter="minPlayers"]');window.filterInput=input;input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
        await browser.waitFor("document.querySelectorAll(':is(#running-game-instances-container, #rbx-public-running-games) .card-item:not([data-rc-server-filtered]):not([data-rc-server-page-hidden])').length===4");
        await pause(800);
        assert.equal(await browser.evaluate('tabEvents.length'), 4, 'Ready lists and filters never reopen the tab');
      } else assert.equal(await browser.evaluate('tabEvents.length'), 3, 'A real empty state needs no recovery');
      assert.equal(await browser.evaluate('location.href'), url, 'Native activation preserves the deep link');
      assert.deepEqual(await browser.evaluate('nativeActions'), { join: 0, buy: 0, refresh: 0 });
      await browser.evaluate('scrollTo(0,0)');
      await browser.waitFor("document.querySelector('#about').classList.contains('active')");
      if (mode !== 'empty') {
        assert.equal(await browser.evaluate("filterInput===document.querySelector('[data-rc-server-filter=\"minPlayers\"]') && filterInput.value==='8'"), true, 'Recovering native tabs preserves filter controls');
        await browser.evaluate("document.querySelector('#game-instances').scrollIntoView({block:'start'})");
        await pause(800);
        assert.equal(await browser.evaluate('tabEvents.length'), 5, 'Intact cached lists do not reload on revisit');
        await browser.click(':is(#running-game-instances-container, #rbx-public-running-games) .card-item:not([data-rc-server-filtered]) button');
        assert.equal(await browser.evaluate('nativeActions.join'), 1, 'The original Join handler still works');
      }
    }
    assert.deepEqual(browser.errors, []);
  });
