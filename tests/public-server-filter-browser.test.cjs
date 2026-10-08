// CHROME_BIN enables real CSS/layout checks against localhost server fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const source = fs.readFileSync(path.join(workspace, 'src/pages/games/game-page.js'), 'utf8');

function card(playing) {
  return `<div class="card-item" data-playing="${playing}" data-ping="${40 + playing * 10}"
    data-country-code="${playing % 2 ? 'US' : 'MY'}"><div class="text-title-medium">Server ${playing}</div>
    <div class="game-server-status">${playing} of 20 people max</div>
    <button onclick="window.nativeJoins.push(${playing})">Join</button></div>`;
}

function fixture(url) {
  const mode = url.searchParams.get('mode');
  const cards = Array.from({ length: 16 }, (_, i) => card(i));
  const list = mode === 'late' ? '' : mode === 'grouped'
    ? `<div class="shared-group">${cards.slice(0, 8).join('')}</div><div class="shared-group">${cards.slice(8).join('')}</div>`
    : cards.join('');
  const sort = '<span>Sort By</span><select id="native-sort"><option value="Desc">Descending</option><option value="Asc">Ascending</option></select>';
  const exclude = '<span>Exclude Full Servers</span><input type="checkbox">';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <style>body{background:#24252c;color:white;font:14px Arial}#game-detail-page{width:950px;margin:20px auto}
      .card-list{display:flex;flex-wrap:wrap}.shared-group{display:flex;flex-wrap:wrap;width:100%}
      .card-item{box-sizing:border-box;width:210px;min-height:100px;padding:12px;margin:8px;border:1px solid #aaa}button{padding:6px}</style>
    <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/pages/games/game-page.css"></head><body>
    <main id="game-detail-page" data-place-id="4623386862"><section id="game-instances">
      <section id="running-game-instances-container" class="server-list-section"><h2>Other Servers</h2>
        <div id="native-group">${mode === 'colocated' ? sort + exclude : `<div>${sort}</div><div>${exclude}</div>`}
          <div id="server-grid" class="card-list">${list}</div>
        </div>
      </section>
    </section></main><script>
      window.nativeJoins=[];
      window.chrome={runtime:{lastError:null,sendMessage(message,callback){callback({error:'Unused fixture request'});}}};
      window.addInitialCards=()=>document.getElementById('server-grid').innerHTML=${JSON.stringify(cards.join(''))};
      window.fixtureCard=${card.toString()};
      window.renderedServers=()=>[...document.querySelectorAll('#running-game-instances-container .card-item')]
        .filter(node=>node.checkVisibility() && node.getBoundingClientRect().width>0)
        .sort((a,b)=>{const first=a.getBoundingClientRect(),second=b.getBoundingClientRect();return first.top-second.top||first.left-second.left;})
        .map(node=>Number(node.dataset.playing));
      window.editFilter=(key,value)=>{const node=document.querySelector('[data-rc-server-filter="'+key+'"]');
        node.value=value;node.dispatchEvent(new Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));};
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

test('public filter counts agree with rendered cards after typing, Search, paging and list replacement',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const profile = fs.mkdtempSync(path.join(workspace, '.tmp-public-server-filter-'));
    const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control','no-store');
      const url = new URL(request.url, 'http://localhost');
      if (['/src/shared/theme.css', '/src/pages/games/game-page.css'].includes(url.pathname)) {
        response.setHeader('Content-Type', 'text/css'); response.end(fs.readFileSync(path.join(workspace, url.pathname.slice(1))));
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
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] });
    const countIs = text => `document.querySelector('.rc-public-server-filter-count')?.textContent===${JSON.stringify(text)}`;
    const messageIs = text => `document.querySelector('.rc-public-server-page-message')?.textContent===${JSON.stringify(text)}`;
    for (const mode of ['flat', 'grouped', 'late', 'colocated']) {
      await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/games/4623386862/Piggy?mode=${mode}` });
      await browser.waitFor("document.readyState==='complete' && !!document.getElementById('server-grid')");
      await browser.evaluate(source);
      await browser.waitFor("!!document.querySelector('.rc-public-server-filters')");
      if (mode === 'late') await browser.evaluate('addInitialCards()');
      await browser.waitFor(countIs('1–8 of 16 matches loaded'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [0, 1, 2, 3, 4, 5, 6, 7], mode);
      await browser.evaluate("editFilter('maxPlayers','5')");
      await browser.waitFor(countIs('1–6 of 6 matches loaded'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [0, 1, 2, 3, 4, 5], `${mode}: automatic input`);
      await browser.evaluate("document.querySelector('.card-item[data-playing=\"3\"] button').click()");
      assert.deepEqual(await browser.evaluate('nativeJoins'), [3], 'Filtering preserves native Join');
      await browser.evaluate("editFilter('minPlayers','2');editFilter('maxPlayers','4');document.querySelector('.rc-public-server-filter-search').click()");
      await browser.waitFor(messageIs('Found 3 matching servers.'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [2, 3, 4], `${mode}: Search`);
      await browser.evaluate("editFilter('country','MY');editFilter('maxPing','80')");
      await browser.waitFor(countIs('1–2 of 2 matches loaded'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [2, 4], `${mode}: combined filters`);
      await browser.evaluate("document.querySelector('.rc-public-server-filter-reset').click()");
      await browser.waitFor(countIs('1–8 of 16 matches loaded'));
      await browser.evaluate("document.querySelector('.rc-public-server-next').click()");
      await browser.waitFor(countIs('9–16 of 16 matches loaded'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [8, 9, 10, 11, 12, 13, 14, 15], `${mode}: Next`);
      await browser.evaluate("editFilter('playerSort','desc')");
      await browser.waitFor(countIs('1–8 of 16 matches loaded'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [15, 14, 13, 12, 11, 10, 9, 8], `${mode}: sorted layout`);
      await browser.evaluate("document.querySelector('.rc-public-server-filter-reset').click()");
      await browser.waitFor("document.querySelector('[data-rc-server-filter=\"playerSort\"]').value==='default' && renderedServers()[0]===0");
      await browser.evaluate("editFilter('minPlayers','99');document.querySelector('.rc-public-server-filter-search').click()");
      await browser.waitFor(messageIs('No public servers match all your filters.'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [], `${mode}: no matches`);
      await browser.evaluate(`(() => {
        document.querySelector('.rc-public-server-filter-reset').click();
        const wrapper=document.createElement('div');wrapper.id='replacement-wrapper';
        wrapper.innerHTML=fixtureCard(20);document.getElementById('server-grid').replaceChildren(wrapper);
        editFilter('maxPlayers','5');
      })()`);
      await browser.waitFor("document.getElementById('replacement-wrapper').hasAttribute('data-rc-server-filtered')");
      await browser.evaluate("document.getElementById('replacement-wrapper').innerHTML='<div class=\"card-list\">'+fixtureCard(3)+fixtureCard(4)+'</div>'");
      await browser.waitFor(countIs('1–2 of 2 matches loaded'));
      assert.deepEqual(await browser.evaluate('renderedServers()'), [3, 4], `${mode}: replacement list`);
    }
    assert.deepEqual(browser.errors, []);
  });
