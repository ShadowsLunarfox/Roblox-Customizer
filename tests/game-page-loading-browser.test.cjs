// CHROME_BIN enables loading checks with native tab events and a held image response.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const source = fs.readFileSync(path.join(workspace, 'src/pages/games/game-page.js'), 'utf8');
const helpers = ['src/shared/routes.js', 'src/shared/native-labels.js'];
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#6575a0"/></svg>';

function fixture(url) {
  const mode = url.searchParams.get('mode');
  const localized = ['localized', 'late-native', 'discarded-store'].includes(mode);
  const placeId = localized ? '1537690962' : '4623386862';
  const about = '<div class="game-description-container"><p class="game-description">Native game description</p></div>'
    + (localized ? '<div class="social-links"><a href="https://x.com/OnettDev">X</a><a href="https://www.youtube.com/@BeeSwarm">YouTube</a></div>' : '');
  const privateRow = `<section id="private-server-container"><h2>Private Servers</h2><div>
    <div id="private-row" data-private-server-id="111"><div><div class="text-title-medium">Private server</div>
      <img src="/avatar.svg"><div class="text-body-medium">1 of 6 people max</div></div>
      <div><button onclick="window.privateJoins++">Join</button><a aria-label="Configure" href="https://www.roblox.com/private-server/configure?privateServerId=111">Configure</a></div>
    </div></div></section>`;
  const publicRow = '<div class="card-list"><div class="card-item" data-playing="3"><div class="game-server-status">3 of 6 people max</div><button onclick="window.publicJoins++">Join</button></div></div>';
  const privateIntro = `<section id="private-server-intro"><h2>Your private servers</h2>
    <p>Play in your own space, solo or with people you invite</p>
    <div id="plus-banner">Get free servers with Plus <button onclick="window.subscriptions++">Subscribe</button></div>
    <div id="create-row"><strong>Create a private server</strong><span>Free private server limit reached</span>
      <button onclick="window.creates++">Create</button></div></section>`;
  const servers = privateIntro + (mode === 'private' || localized ? privateRow : '') + '<section id="running-game-instances-container"><h2>Other Servers</h2>'
    + (mode === 'empty' ? '<p>No public servers available.</p>' : publicRow) + '</section>';
  const store = localized ? ['Langganan', 'Pass', 'Produk Developer'].map(label => '<section><h2>'+label+'</h2><div class="store-cards"><div class="card-item store-card">Native item <button onclick="window.purchases++">Beli</button></div></div></section>').join('')
    : '<div class="card-item">Native pass <button onclick="window.purchases++">Buy</button></div>';
  return `<!doctype html><html lang="${localized ? 'id' : 'en'}" ${localized ? 'data-rc-ui-active' : 'data-rc-hide-x-feed data-rc-hide-youtube-feed'}><head><meta charset="utf-8">
    <meta name="locale-data" data-language-code="${localized ? 'id_id' : 'en_us'}">
    <style>body{background:#24252c;color:white;font:14px Arial}#game-detail-page{width:900px;margin:20px auto}#game-detail-page header{height:1400px}.tab-pane{display:none}.tab-pane.active{display:block}button{padding:8px}</style>
    <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/pages/games/game-page.css"></head><body>
    <main id="game-detail-page" data-place-id="${placeId}"><header><h1>${localized ? 'Bee Swarm Simulator' : 'Piggy'}</h1><img src="/slow-image" width="80" height="80"></header>
      <div id="game-detail-meta-data" data-place-id="${placeId}" data-universe-id="601130232"></div>
      <ul id="horizontal-tabs"><li id="tab-about"><a href="#about">About</a></li>
        <li id="tab-store"><a href="#store">Store</a></li><li id="tab-game-instances"><a href="#game-instances">Servers</a></li></ul>
      <div class="tab-content"><section id="about" class="tab-pane active">${about}</section>
        <section id="store" class="tab-pane"></section><section id="game-instances" class="tab-pane"></section></div>
    </main><script>
      window.fixtureStarted=performance.now();window.tabEvents=[];window.privateRequests=[];window.renderedAt={};
      window.privateJoins=0;window.publicJoins=0;window.purchases=0;window.subscriptions=0;window.creates=0;
      window.chrome={runtime:{lastError:null,sendMessage(message,callback){
        if(message.type==='rc-private-server-details')privateRequests.push(callback);
        else if(message.type==='rc-x-posts')callback({posts:[{id:'123456',text:'Public game update',createdAt:'2026-10-19T00:00:00Z'}]});
        else if(message.type==='rc-youtube-videos')callback({channelTitle:'Bee Swarm',videos:[{id:'abcdefghijk',title:'Public game video',published:'2026-10-19T00:00:00Z'}]});
        else callback({error:'Unused fixture request'});
      }}};
      const content={about:${JSON.stringify(about)},store:${JSON.stringify(store)},
        'game-instances':${JSON.stringify(servers)}};
      function renderNativePane(){
        const name=location.hash.startsWith('#!/')?location.hash.slice(3):'';
        if(!['about','store','game-instances'].includes(name))return;
        if(name!=='about')document.getElementById('about').replaceChildren();
        if(${mode === 'discarded-store'} && name!=='store')document.getElementById('store').replaceChildren();
        const pane=document.getElementById(name);
        if(!pane.childElementCount){
          pane.innerHTML='<div class="spinner">Loading...</div>';
          setTimeout(()=>{
            if(${mode === 'discarded-store'} && name==='store' && location.hash!=='#!/store')return;
            pane.innerHTML=content[name];renderedAt[name]=performance.now()-fixtureStarted;
          },name==='about'?50:name==='store'?${mode === 'slow-store' ? 4000 : 100}:200);
        }
      }
      function bindNativeTabs(){
      for(const name of ['about','store','game-instances']){
        document.querySelector('#tab-'+name+' a').onclick=event=>{
          event.preventDefault();tabEvents.push({tab:name,elapsed:performance.now()-fixtureStarted});
          for(const pane of document.querySelectorAll('.tab-pane'))pane.classList.toggle('active',pane.id===name);
          location.hash='!/'+name;
        };
      }
      // Roblox's renderer reads the URL in an asynchronous hashchange event.
      addEventListener('hashchange',renderNativePane);
      window.nativeTabsReady=true;
      }
      ${mode === 'late-native' ? 'setTimeout(bindNativeTabs,900)' : 'bindNativeTabs()'};
      window.finishPrivate=()=>privateRequests[0]({servers:[{id:111,name:'Private server',ownerName:'Server owner',playing:1,maxPlayers:6,playerImages:[]}],uniqueNames:['private server']});
      window.fixtureReady=true;
    </script>${localized ? helpers.map(file => '<script src="/'+file+'"></script>').join('') : ''}</body></html>`;
}

class Browser {
  constructor(url) {
    this.socket = new WebSocket(url); this.pending = new Map(); this.next = 0; this.errors = [];
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve);
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = this.pending.get(message.id); this.pending.delete(message.id);
        message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      } else if (message.method === 'Fetch.requestPaused') {
        this.send('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
      }
    });
  }
  async send(method, params = {}) {
    await this.ready; const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async waitFor(expression) {
    for (let i = 0; i < 120; i++) {
      if (await this.evaluate(expression)) return;
      await pause(30);
    }
    assert.fail(`Timed out: ${expression}`);
  }
}

test('lower game panes load before images finish and slow private details do not block About',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const profile = fs.mkdtempSync(path.join(workspace, '.tmp-game-page-loading-'));
    const images = new Set();
    const finishImages = () => { for (const response of images) response.end(svg); images.clear(); };
    const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control','no-store');
      const url = new URL(request.url, 'http://localhost');
      if (helpers.some(file => url.pathname === '/'+file)) {
        response.setHeader('Content-Type', 'text/javascript'); response.end(fs.readFileSync(path.join(workspace, url.pathname.slice(1))));
      } else if (['/src/shared/theme.css', '/src/pages/games/game-page.css'].includes(url.pathname)) {
        response.setHeader('Content-Type', 'text/css'); response.end(fs.readFileSync(path.join(workspace, url.pathname.slice(1))));
      } else if (url.pathname === '/slow-image' || url.pathname === '/avatar.svg') {
        response.setHeader('Content-Type', 'image/svg+xml');
        if (url.pathname === '/slow-image') images.add(response);
        else response.end(svg);
      } else {
        response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture(url));
      }
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_SERVER_TEST_PORT) || 0, '127.0.0.1', resolve));
    const child = spawn(process.env.CHROME_BIN, ['--headless=new', '--disable-gpu', '--disable-background-networking',
      '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
    let browser;
    t.after(async () => {
      finishImages();
      if (browser) { await Promise.race([browser.send('Browser.close').catch(() => {}), pause(1000)]); browser.socket.close(); }
      if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(1000)]);
      if (child.exitCode === null) child.kill();
      await pause(300);
      await new Promise(resolve => server.close(resolve));
      assert.equal(path.dirname(path.resolve(profile)), workspace);
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    });
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await pause(50);
    assert.ok(fs.existsSync(portFile), 'Isolated Chrome starts');
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab => tab.type === 'page');
    browser = new Browser(target.webSocketDebuggerUrl);
    await browser.send('Page.enable'); await browser.send('Runtime.enable');
    await browser.send('Network.enable');
    await browser.send('Network.setCacheDisabled', { cacheDisabled: true });
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source });
    for (const mode of ['public', 'empty', 'private', 'slow-store', 'localized', 'late-native', 'discarded-store']) {
      const localized = ['localized', 'late-native', 'discarded-store'].includes(mode);
      const route = localized ? '/id/games/1537690962/Bee-Swarm-Simulator' : '/games/4623386862/Piggy';
      const url = `http://127.0.0.1:${server.address().port}${route}?mode=${mode}`;
      await browser.send('Page.navigate', { url });
      await browser.waitFor("window.fixtureReady && document.readyState==='interactive'");
      assert.equal(await browser.evaluate("document.querySelector('#horizontal-tabs').checkVisibility()"), false, 'Combined panes keep the native tab strip hidden, including during loading');
      if (mode === 'late-native') {
        assert.equal(await browser.evaluate('scrollY'), 0, 'Unbound anchors cannot jump to an empty section');
      }
      await browser.waitFor("!!document.querySelector('#private-server-intro h2')");
      assert.equal(await browser.evaluate("document.querySelector('#private-server-intro h2').checkVisibility()&&document.querySelector('#private-server-intro p').checkVisibility()&&document.querySelector('#plus-banner button').checkVisibility()&&document.querySelector('#create-row button').checkVisibility()"), true, 'The screenshot heading, description, Plus banner and Create controls render together');
      assert.equal(await browser.evaluate('tabEvents[0].tab'), 'game-instances');
      if (mode !== 'late-native') assert.ok(await browser.evaluate("renderedAt['game-instances']<700"), 'Servers starts at document readiness without the old 500 ms scheduling delay');
      if (mode === 'slow-store') assert.equal(await browser.evaluate("!!document.querySelector('#store .card-item')"), false, 'The screenshot controls appear before the four-second Store response');
      await browser.evaluate("document.querySelector('#plus-banner button').click();document.querySelector('#create-row button').click()");
      assert.deepEqual(await browser.evaluate('({subscriptions,creates})'), { subscriptions: 1, creates: 1 }, 'Original Subscribe and Create handlers work immediately');
      await browser.waitFor("tabEvents.some(event=>event.tab==='about') && !!document.querySelector('#about .game-description') && !location.hash");
      assert.equal(await browser.evaluate('document.readyState'), 'interactive', 'A pending image must not hold up the lower interface');
      assert.deepEqual(await browser.evaluate('tabEvents.map(event=>event.tab)'), ['game-instances', 'store', 'about'], mode);
      assert.ok(await browser.evaluate(`tabEvents.at(-1).elapsed<${mode === 'late-native' ? 3000 : 2000}`), 'Native content must not incur the old minimum three-second wait');
      if (mode === 'slow-store') await browser.waitFor("!!document.querySelector('#store .card-item')");
      assert.equal(await browser.evaluate("document.querySelector('#horizontal-tabs').checkVisibility()"), false, 'Loaded content does not bring back the native tab strip');
      if (mode === 'discarded-store') {
        assert.equal(await browser.evaluate("document.querySelector('#about .game-description').checkVisibility()"), true);
        assert.equal(await browser.evaluate("!!document.querySelector('#store .card-item')"), false, 'The native renderer discarded the inactive Store');
        await browser.evaluate("document.querySelector('#store').scrollIntoView({block:'center'})");
        await browser.waitFor("!!document.querySelector('#store .card-item') && !location.hash");
      }
      assert.equal(await browser.evaluate("document.querySelector('#store .card-item').checkVisibility()"), true);
      if (mode !== 'discarded-store') assert.equal(await browser.evaluate("document.querySelector('#about .game-description').checkVisibility()"), true);
      await browser.evaluate("document.querySelector('#store button').click()");
      assert.equal(await browser.evaluate('purchases'), 1, 'Native Store actions still work');
      if (mode !== 'empty') {
        assert.equal(await browser.evaluate("document.querySelector('#running-game-instances-container .card-item').checkVisibility()"), true);
        await browser.evaluate("document.querySelector('#running-game-instances-container .card-item button').click()");
        assert.equal(await browser.evaluate('publicJoins'), 1);
      }
      if (mode === 'private' || localized) {
        await browser.waitFor('privateRequests.length===1');
        assert.equal(await browser.evaluate("document.getElementById('private-row').checkVisibility()"), true);
        assert.equal(await browser.evaluate("!!document.querySelector('.rc-private-server-loading')"), false);
        await browser.evaluate('finishPrivate()');
        await browser.waitFor("document.getElementById('private-row').hasAttribute('data-rc-private-server-ready')");
        assert.equal(await browser.evaluate("document.getElementById('private-row').checkVisibility()"), true);
        await browser.evaluate("document.querySelector('#private-row button').click()");
        assert.equal(await browser.evaluate('privateJoins'), 1);
      }
      if (localized) {
        await browser.waitFor("document.querySelectorAll('[data-rc-store-section-title]').length===3 && !!document.querySelector('.rc-public-server-filters')");
        if (mode === 'discarded-store') {
          await browser.evaluate('scrollTo(0,0)');
          await browser.waitFor("!!document.querySelector('#about .game-description') && !location.hash");
        }
        await browser.waitFor("!!document.querySelector('#rc-x-feed-panel .rc-x-feed-post') && !!document.querySelector('#rc-youtube-feed-panel .rc-x-feed-post')");
        assert.equal(await browser.evaluate('location.pathname'), '/id/games/1537690962/Bee-Swarm-Simulator');
      }
      finishImages();
      await browser.waitFor("document.readyState==='complete'");
      await pause(600);
      if (mode !== 'discarded-store') assert.equal(await browser.evaluate('tabEvents.length'), 3, 'The load event cannot restart completed initialization');
    }
    assert.deepEqual(browser.errors, []);
  });
