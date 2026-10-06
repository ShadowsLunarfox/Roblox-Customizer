// CHROME_BIN enables loading checks with native tab events and a held image response.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const source = fs.readFileSync(path.join(workspace, 'game-page.js'), 'utf8');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#6575a0"/></svg>';

function fixture(url) {
  const mode = url.searchParams.get('mode');
  const about = '<div class="game-description-container"><p class="game-description">Native game description</p></div>';
  const privateRow = `<section id="private-server-container"><h2>Private Servers</h2><div>
    <div id="private-row" data-private-server-id="111"><div><div class="text-title-medium">Private server</div>
      <img src="/avatar.svg"><div class="text-body-medium">1 of 6 people max</div></div>
      <div><button onclick="window.privateJoins++">Join</button><a aria-label="Configure" href="https://www.roblox.com/private-server/configure?privateServerId=111">Configure</a></div>
    </div></div></section>`;
  const publicRow = '<div class="card-list"><div class="card-item" data-playing="3"><div class="game-server-status">3 of 6 people max</div><button onclick="window.publicJoins++">Join</button></div></div>';
  const servers = (mode === 'private' ? privateRow : '') + '<section id="running-game-instances-container"><h2>Other Servers</h2>'
    + (mode === 'empty' ? '<p>No public servers available.</p>' : publicRow) + '</section>';
  return `<!doctype html><html lang="en" data-rc-hide-x-feed data-rc-hide-youtube-feed><head><meta charset="utf-8">
    <style>body{background:#24252c;color:white;font:14px Arial}#game-detail-page{width:900px;margin:20px auto}.tab-pane{display:none}.tab-pane.active{display:block}button{padding:8px}</style>
    <link rel="stylesheet" href="/game-page.css"></head><body>
    <main id="game-detail-page" data-place-id="4623386862"><header><h1>Piggy</h1><img src="/slow-image" width="80" height="80"></header>
      <div id="game-detail-meta-data" data-place-id="4623386862"></div>
      <ul id="horizontal-tabs"><li id="tab-about"><a href="#about">About</a></li>
        <li id="tab-store"><a href="#store">Store</a></li><li id="tab-game-instances"><a href="#game-instances">Servers</a></li></ul>
      <div class="tab-content"><section id="about" class="tab-pane active">${about}</section>
        <section id="store" class="tab-pane"></section><section id="game-instances" class="tab-pane"></section></div>
    </main><script>
      window.fixtureStarted=performance.now();window.tabEvents=[];window.privateRequests=[];
      window.privateJoins=0;window.publicJoins=0;window.purchases=0;
      window.chrome={runtime:{lastError:null,sendMessage(message,callback){
        if(message.type==='rc-private-server-details')privateRequests.push(callback);
        else callback({error:'Unused fixture request'});
      }}};
      const content={about:${JSON.stringify(about)},store:'<div class="card-item">Native pass <button onclick="window.purchases++">Buy</button></div>',
        'game-instances':${JSON.stringify(servers)}};
      for(const name of ['about','store','game-instances']){
        document.querySelector('#tab-'+name+' a').onclick=event=>{
          event.preventDefault();tabEvents.push({tab:name,elapsed:performance.now()-fixtureStarted});
          history.replaceState(history.state,'','#'+name);
          for(const pane of document.querySelectorAll('.tab-pane'))pane.classList.toggle('active',pane.id===name);
          if(name!=='about')document.getElementById('about').replaceChildren();
          const pane=document.getElementById(name);
          if(!pane.childElementCount){
            pane.innerHTML='<div class="spinner">Loading...</div>';
            setTimeout(()=>pane.innerHTML=content[name],name==='about'?50:name==='store'?100:200);
          }
        };
      }
      window.finishPrivate=()=>privateRequests[0]({servers:[{id:111,name:'Private server',ownerName:'Server owner',playing:1,maxPlayers:6,playerImages:[]}],uniqueNames:['private server']});
      window.fixtureReady=true;
    </script></body></html>`;
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
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/game-page.css') {
        response.setHeader('Content-Type', 'text/css'); response.end(fs.readFileSync(path.join(workspace, 'game-page.css')));
      } else if (url.pathname === '/slow-image' || url.pathname === '/avatar.svg') {
        response.setHeader('Content-Type', 'image/svg+xml');
        if (url.pathname === '/slow-image') images.add(response);
        else response.end(svg);
      } else {
        response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture(url));
      }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const child = spawn(process.env.CHROME_BIN, ['--headless=new', '--disable-gpu', '--disable-background-networking',
      '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
    { windowsHide: true, stdio: 'ignore' });
    let browser;
    t.after(async () => {
      finishImages();
      if (browser) { await Promise.race([browser.send('Browser.close').catch(() => {}), pause(1000)]); browser.socket.close(); }
      if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(1000)]);
      if (child.exitCode === null) child.kill();
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
    await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source });
    for (const mode of ['public', 'empty', 'private']) {
      const url = `http://127.0.0.1:${server.address().port}/games/4623386862/Piggy?mode=${mode}`;
      await browser.send('Page.navigate', { url });
      await browser.waitFor("window.fixtureReady && document.readyState==='interactive'");
      await browser.waitFor("tabEvents.some(event=>event.tab==='about') && !!document.querySelector('#about .game-description') && !location.hash");
      assert.equal(await browser.evaluate('document.readyState'), 'interactive', 'A pending image must not hold up the lower interface');
      assert.deepEqual(await browser.evaluate('tabEvents.map(event=>event.tab)'), ['store', 'game-instances', 'about'], mode);
      assert.ok(await browser.evaluate('tabEvents.at(-1).elapsed<2000'), 'Native content must not incur the old minimum three-second wait');
      assert.equal(await browser.evaluate("document.querySelector('#store .card-item').checkVisibility()"), true);
      assert.equal(await browser.evaluate("document.querySelector('#about .game-description').checkVisibility()"), true);
      await browser.evaluate("document.querySelector('#store button').click()");
      assert.equal(await browser.evaluate('purchases'), 1, 'Native Store actions still work');
      if (mode !== 'empty') {
        assert.equal(await browser.evaluate("document.querySelector('#running-game-instances-container .card-item').checkVisibility()"), true);
        await browser.evaluate("document.querySelector('#running-game-instances-container button').click()");
        assert.equal(await browser.evaluate('publicJoins'), 1);
      }
      if (mode === 'private') {
        await browser.waitFor('privateRequests.length===1');
        assert.equal(await browser.evaluate("document.getElementById('private-row').checkVisibility()"), false);
        assert.equal(await browser.evaluate("document.querySelector('.rc-private-server-loading').checkVisibility()"), true);
        await browser.evaluate('finishPrivate()');
        await browser.waitFor("document.getElementById('private-row').hasAttribute('data-rc-private-server-ready')");
        assert.equal(await browser.evaluate("document.getElementById('private-row').checkVisibility()"), true);
        await browser.evaluate("document.querySelector('#private-row button').click()");
        assert.equal(await browser.evaluate('privateJoins'), 1);
      }
      finishImages();
      await browser.waitFor("document.readyState==='complete'");
      await pause(600);
      assert.equal(await browser.evaluate('tabEvents.length'), 3, 'The load event cannot restart completed initialization');
    }
    assert.deepEqual(browser.errors, []);
  });
