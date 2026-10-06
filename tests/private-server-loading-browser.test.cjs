// CHROME_BIN enables local rendering checks with delayed mock server details.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const source = fs.readFileSync(path.join(workspace, 'game-page.js'), 'utf8');

function fixture(url) {
  const shared = url.searchParams.has('shared');
  const lateImage = url.searchParams.has('late-image');
  return `<!doctype html><html><head><meta charset="utf-8">
    <style>body{background:#24252c;color:white;font:14px Arial}#game-detail-page{max-width:900px;margin:20px auto}button{padding:8px}</style>
    <link rel="stylesheet" href="/game-page.css"></head><body>
    <main id="game-detail-page" data-place-id="4623386862"><section id="game-instances">
      <section id="private-server-container"><h2>Private Servers</h2><div id="private-list">
        <div id="native-server" class="${shared ? 'card-item' : 'server-row'}" ${shared ? '' : 'data-private-server-id="111"'}>
          <div><div class="text-title-medium">Private server</div><img id="native-avatar" ${lateImage ? '' : 'src="/avatar.svg"'}>
          <div class="text-body-medium">1 of 6 people max</div></div>
          <div><button id="native-join" onclick="window.nativeJoins++">Join</button>${shared ? '' : '<a aria-label="Configure" href="https://www.roblox.com/private-server/configure?privateServerId=111">Configure</a>'}</div>
        </div>
      </div></section>
      <section id="running-game-instances-container"><h2>Public Servers</h2></section>
    </section></main><script>
    window.nativeJoins=0;window.privateRequests=[];
    window.chrome={runtime:{lastError:null,sendMessage(message,callback){
      if(message.type==='rc-private-server-details')privateRequests.push({message,callback});
      else callback({error:'Unused fixture request'});
    }}};
    window.completePrivate=index=>privateRequests[index].callback({servers:[{
      id:111,name:'Private server',ownerName:'Server owner',playing:1,maxPlayers:6,
      playerImages:['https://tr.rbxcdn.com/fixture-player.png']
    }],uniqueNames:['private server']});
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
        this.send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
          responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }],
          body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#6575a0"/></svg>').toString('base64') }).catch(() => {});
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
    for (let i = 0; i < 100; i++) {
      if (await this.evaluate(expression)) return;
      await pause(30);
    }
    assert.fail(`Timed out: ${expression}`);
  }
}

test('private cards stay hidden before startup and reveal complete data together', { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const profile = fs.mkdtempSync(path.join(workspace, '.tmp-private-server-loading-'));
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/game-page.css') {
      response.setHeader('Content-Type', 'text/css'); response.end(fs.readFileSync(path.join(workspace, 'game-page.css')));
    } else if (url.pathname === '/avatar.svg') {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#6575a0"/></svg>');
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
  for (const query of ['', '?shared=1', '?late-image=1']) {
    await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/games/4623386862/Piggy${query}` });
    await browser.waitFor("document.readyState==='complete' && !!document.getElementById('native-server')");
    assert.equal(await browser.evaluate("getComputedStyle(document.getElementById('native-server')).display"), 'none', 'Native UI cannot flash before the content script runs');
    await browser.evaluate(source);
    await browser.waitFor('privateRequests.length===1');
    assert.equal(await browser.evaluate("!!document.querySelector('.rc-private-server-summary')"), false);
    assert.equal(await browser.evaluate("getComputedStyle(document.getElementById('native-server')).display"), 'none');
    await browser.evaluate('completePrivate(0)');
    if (query.includes('late-image')) {
      assert.equal(await browser.evaluate("document.getElementById('native-server').hasAttribute('data-rc-private-server-ready')"), false);
      assert.equal(await browser.evaluate("!!document.querySelector('.rc-private-server-summary')"), false);
      await browser.evaluate("document.getElementById('native-avatar').src='/avatar.svg'");
      await browser.waitFor('privateRequests.length===2');
      await browser.evaluate('completePrivate(1)');
    }
    await browser.waitFor("document.getElementById('native-server').hasAttribute('data-rc-private-server-ready')");
    assert.equal(await browser.evaluate("getComputedStyle(document.getElementById('native-server')).display"), 'grid');
    assert.deepEqual(await browser.evaluate(`({
      title:document.querySelector('.rc-private-server-title').textContent,
      owner:document.querySelector('.rc-private-server-owner').textContent,
      count:document.querySelector('.rc-private-server-count').textContent,
      avatar:new URL(document.querySelector('.rc-private-server-avatar').src).pathname,
      players:document.querySelectorAll('.rc-private-server-roster img').length,
      loading:!!document.querySelector('.rc-private-server-loading')
    })`), { title: 'Private server', owner: 'Server owner', count: '1 of 6 people max', avatar: '/avatar.svg', players: 1, loading: false });
    await browser.evaluate("document.getElementById('native-join').click()");
    assert.equal(await browser.evaluate('nativeJoins'), 1, 'Native Join still works after the reveal');
  }
  assert.deepEqual(browser.errors, []);
});
