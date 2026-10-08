// Run with CHROME_BIN set to a Chrome executable. Uses an isolated local fixture and browser profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { test } = require('node:test');
const { waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/settings/settings.css"><link rel="stylesheet" href="/src/currency/robux-currency.css">
  <style>body{background:linear-gradient(115deg,#655966,#804631,#6d7767);color:#fff;font:16px Arial;margin:0;padding:24px}header{display:flex;justify-content:space-between;align-items:center;min-height:40px}a{color:inherit;text-decoration:none}button{cursor:pointer}.icon-robux-16x16:before{content:'⬡';margin-right:4px}.cards{display:flex;flex-wrap:wrap;gap:12px}.item-card{width:125px;border:1px solid #ffffff22;border-radius:12px;padding:12px;background:#ffffff0b}.item-card-price{display:flex;align-items:center;gap:2px}.panel{padding:20px;border:1px solid #ffffff22;border-radius:12px;background:#22242a66;margin:20px 0}.purchase{font-size:24px;font-weight:bold}#creator-price{max-width:100px}h2{font-size:20px}.item-card h3{font-size:15px;height:38px}#dynamic{margin-top:20px}#native-numeric{white-space:nowrap}</style></head>
  <style>
    /* Roblox's fixed-height header and floated native controls. */
    #header { display: block; height: 40px; width: calc(100% + 48px); margin-inline: -24px; padding-inline: 12px; box-sizing: border-box; }
    #header .container-fluid { width: 100%; height: 40px; }
    .rbx-header .rbx-navbar-header { float: left; width: 62px; line-height: 40px; }
    .rbx-header .rbx-navbar-icon-group { float: right; margin: 0; padding: 0; line-height: 28px; list-style: none; }
    .rbx-header .rbx-navbar-icon-group .age-bracket-label { float: left; align-items: center; margin-right: 6px; padding-top: 6px; display: inline-flex; }
    .rbx-header .rbx-navbar-icon-group .dynamic-overflow-container { display: inline-flex; align-items: center; }
    .rbx-header .rbx-navbar-icon-group .avatar-headshot-xs { flex-shrink: 0; width: 28px; height: 28px; margin-right: 6px; border-radius: 50%; background: #aaa; }
    .rbx-header .rbx-navbar-icon-group .age-bracket-label-username { margin-right: 6px; display: inline-block; font-size: 12px; }
    .rbx-header .rbx-navbar-icon-group > li { float: left; padding: 2px; }
    .rbx-header .rbx-navbar-icon-group > li > button { display: inline-block; padding: 4px; height: 36px; border: 0; background: transparent; color: inherit; font: inherit; white-space: nowrap; }
    .rbx-header .rbx-navbar-icon-group > li > button:not(.btn-navigation-nav-robux-md) { width: 28px; }
    .rbx-header .rbx-navbar-icon-group > li > button > .rbx-menu-item { float: left; position: relative; }
    .rbx-header .rbx-navbar-icon-group > li > button > .nav-robux-icon { display: inline-flex; align-items: center; }
    @media (max-width: 1199px) { .rbx-header .rbx-navbar-icon-group .age-bracket-label-username { display: none; } }
    @media (max-width: 991px) { .rbx-header .rbx-navbar-icon-group > li > button span[class^="rbx-text"] { display: none; } .rbx-header .rbx-navbar-icon-group .age-bracket-label-username { display: inline; } }
    @media (max-width: 543px) { .rbx-header .rbx-navbar-icon-group .age-bracket-label-username { display: none; } }
  </style>
  <body class="dark-theme"><header id="header" class="rbx-header"><div class="container-fluid"><div class="rbx-navbar-header"><strong>Roblox</strong></div><div id="right-navigation-header"><ul class="navbar-right rbx-navbar-icon-group"><div class="age-bracket-label text-header"><a href="#profile" class="text-link dynamic-overflow-container"><span id="header-avatar" class="avatar avatar-headshot-xs"></span><span id="header-username" class="text-overflow age-bracket-label-username font-caption-header">Shadows_Lunarfox</span></a></div><li><button id="header-search" aria-label="Search">⌕</button></li><li><button id="header-notifications" aria-label="Notifications">♧</button></li><li id="navbar-robux"><button id="header-balance" class="btn-navigation-nav-robux-md" aria-label="Robux: 250"><span class="nav-robux-icon rbx-menu-item"><span class="icon-robux-16x16"></span><span id="nav-robux-amount" class="rbx-text-navbar-right">250</span></span><span class="caret"> ▾</span></button></li><li><button id="header-settings" aria-label="Settings">⚙</button></li></ul></div></div></header>
  <p><button class="rc-settings-menu-entry">Roblox Customizer settings</button></p>
  <section class="panel"><h2>Purchase</h2><div class="purchase"><span class="icon-robux-16x16"></span><span class="text-robux-lg" id="purchase-price">26,498</span></div></section>
  <h2>Recommendations</h2><div class="cards"><div class="item-card"><h3>Black 8-bit Royal Crown</h3><div class="item-card-price"><span class="icon-robux-16x16"></span><span class="text-robux" id="card-price">70</span></div></div><div class="item-card"><h3>Violet Valkyrie</h3><div class="item-card-price"><span class="icon-robux-16x16"></span><span class="text-robux">50,000</span></div></div></div>
  <section class="panel" id="cart"><h2>Shopping cart (0)</h2><p>Total: 0 items <span class="icon-robux-16x16"></span><span class="text-robux" id="cart-total">0</span></p><p>Your balance after this transaction will be <span class="icon-robux-16x16"></span>250.</p></section>
  <section class="panel"><h2>Transactions / Creator Hub</h2><p><span class="icon-robux-16x16"></span><span class="text-robux">−1,000</span></p><label>Robux price <span class="icon-robux-16x16"></span><input id="creator-price" type="number" value="500"></label><div id="native-numeric" class="text-robux"><span class="icon-robux-16x16"></span>100</div><p id="unrelated">464.6K favorites · $4.99</p></section>
  <div id="dynamic"></div><div id="price-chart"><svg width="200" height="40"><g class="highcharts-yaxis-labels highcharts-yaxis-labels-0"><text id="price-axis" x="0" y="20">25,000</text></g><g class="highcharts-xaxis-labels"><text id="date-axis" x="90" y="20">2022</text></g></svg></div>
  <script>
    const listeners=[]; let rateRequests=0; let mutations=0;
    new MutationObserver(records=>mutations+=records.length).observe(document,{subtree:true,childList:true,characterData:true});
    const rateResponse={ok:true,date:'2026-10-04',rates:{USD:1,CNY:7.1,MYR:4.1,KWD:.306},stale:false};
    const emit=changes=>listeners.forEach(fn=>fn(changes,'local'));
    window.chrome={runtime:{getURL:path=>'/'+path,async sendMessage(){rateRequests++;return rateResponse}},storage:{local:{async get(key){return {[key]:JSON.parse(localStorage.getItem(key)||'null')}},async set(value){const changes={};for(const[key,data]of Object.entries(value)){changes[key]={oldValue:JSON.parse(localStorage.getItem(key)||'null'),newValue:data};localStorage.setItem(key,JSON.stringify(data))}emit(changes)}},onChanged:{addListener:fn=>listeners.push(fn)}}};
    addEventListener('storage',event=>{if(event.key)emit({[event.key]:{newValue:JSON.parse(event.newValue)}})});
  </script><script src="/src/currency/robux-currency-core.js"></script><script src="/src/currency/robux-currency.js"></script><script src="/src/settings/settings.js"></script></body></html>`;
}

class CDP {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.pending = new Map(); this.next = 1; this.errors = [];
    this.ready = new Promise((resolve, reject) => { this.socket.addEventListener('open', resolve); this.socket.addEventListener('error', reject, { once: true }); });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') this.errors.push(message.params.exceptionDetails);
      if (message.id) { const request = this.pending.get(message.id); this.pending.delete(message.id); message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result); }
    });
  }
  async send(method, params = {}) {
    await this.ready;
    const id = this.next++;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.socket.send(JSON.stringify({ id, method, params })); });
  }
  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text + ': ' + response.exceptionDetails.exception?.description);
    return response.result.value;
  }
  close() { this.socket.close(); }
}

test('live DOM conversions, settings persistence, page synchronization, and responsive layout', { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
  const temporary = fs.mkdtempSync(path.join(workspace, '.tmp-currency-browser-'));
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control','no-store');
    const name = new URL(request.url, 'http://localhost').pathname.slice(1);
    if (['src/settings/settings.js', 'src/shared/theme.css','src/settings/settings.css', 'src/currency/robux-currency.js', 'src/currency/robux-currency-core.js', 'src/currency/robux-currency.css'].includes(name)) {
      response.setHeader('Content-Type', name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8');
      response.end(fs.readFileSync(path.join(workspace, name)));
    } else if (name.startsWith('icons/')) { response.end(fs.readFileSync(path.join(workspace, name))); }
    else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture()); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const child = spawn(process.env.CHROME_BIN, ['--headless=new', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${temporary}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  const tabs = [];
  t.after(async () => {
    if (tabs[0]) await Promise.race([tabs[0].send('Browser.close').catch(() => {}), pause(1000)]);
    for (const tab of tabs) tab.close();
    if (child.exitCode === null) await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(1000)]);
    if (child.exitCode === null) child.kill();
    await new Promise(resolve => server.close(resolve));
    await pause(300);
    // Verify the absolute target before deleting the isolated profile recursively.
    assert.equal(path.dirname(path.resolve(temporary)), workspace);
    fs.rmSync(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  const portFile = path.join(temporary, 'DevToolsActivePort');
  for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await pause(50);
  assert.ok(fs.existsSync(portFile), 'Chrome should start its isolated debugging endpoint');
  const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
  const endpoint = `http://127.0.0.1:${port}`;
  const firstInfo = (await (await fetch(`${endpoint}/json/list`)).json()).find(tab => tab.type === 'page');
  const first = new CDP(firstInfo.webSocketDebuggerUrl); tabs.push(first);
  await first.send('Runtime.enable');
  await first.send('Page.enable');
  await first.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 850, deviceScaleFactor: 1, mobile: false });
  await first.send('Page.navigate', { url: `${url}/catalog/10159600649/8-Bit-Royal-Crown` });
  await waitForDocument(first, '#purchase-price');
  await pause(500);
  let info = await first.evaluate(`({count:document.querySelectorAll('.rc-robux-equivalent').length,header:document.querySelector('#header-balance .rc-robux-equivalent')?.textContent,native:document.querySelector('#native-numeric').textContent,unrelated:document.querySelector('#unrelated .rc-robux-equivalent'),axis:document.querySelector('#price-axis title')?.textContent,date:document.querySelector('#date-axis title'),amount:document.querySelector('#nav-robux-amount').textContent})`);
  assert.equal(info.count, 10, await first.evaluate(`JSON.stringify([...document.querySelectorAll('.rc-robux-equivalent')].map(node=>node.parentElement.outerHTML))`));
  assert.match(info.header, /2\.50 USD/);
  assert.equal(info.amount, '250');
  assert.equal(info.native, '100');
  assert.equal(info.unrelated, null);
  assert.match(info.axis, /249\.50 USD/);
  assert.equal(info.date, null);
  const headerGeometry = `(() => {
    const rect = selector => { const r=document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; };
    return {header:rect('#header'),avatar:rect('#header-avatar'),username:rect('#header-username'),search:rect('#header-search'),notifications:rect('#header-notifications'),balance:rect('#header-balance'),currency:rect('#header-balance .rc-robux-equivalent'),settings:rect('#header-settings'),logo:rect('.rbx-navbar-header')};
  })()`;
  const assertIdentityCentered = header => {
    const center = rect => rect.y + rect.height / 2;
    assert.ok(Math.abs(center(header.avatar) - center(header.header)) < 1, 'Avatar must stay vertically centered in the header');
    if (header.username.width) assert.ok(Math.abs(center(header.username) - center(header.header)) < 1, 'Username must stay vertically centered in the header');
  };
  let header = await first.evaluate(headerGeometry);
  assertIdentityCentered(header);
  assert.ok(header.currency.y >= header.header.y && header.currency.bottom <= header.header.bottom, 'Conversion must stay inside the header');
  assert.ok(Math.abs((header.currency.y + header.currency.height / 2) - (header.balance.y + header.balance.height / 2)) < 1, 'Conversion must align with the balance');
  assert.ok(header.currency.right < header.settings.x, 'Conversion must leave the settings button unobstructed');
  assert.ok(await first.evaluate(`document.querySelector('#header-balance .rc-robux-equivalent').nextElementSibling.matches('.caret')`));
  await first.evaluate(`document.querySelector('.rc-settings-menu-entry').click()`);
  await first.evaluate(`document.querySelector('[data-currency-enabled]').checked=false;document.querySelector('[data-currency-enabled]').dispatchEvent(new Event('change',{bubbles:true}))`);
  await pause(150);
  const disabledSearchX = await first.evaluate(`document.querySelector('#header-search').getBoundingClientRect().x`);
  assertIdentityCentered(await first.evaluate(headerGeometry.replace("currency:rect('#header-balance .rc-robux-equivalent')", 'currency:null')));
  await first.evaluate(`document.querySelector('[data-currency-enabled]').checked=true;document.querySelector('[data-currency-enabled]').dispatchEvent(new Event('change',{bubbles:true}))`);
  await pause(150);
  header = await first.evaluate(headerGeometry);
  assertIdentityCentered(header);
  assert.ok(header.search.x < disabledSearchX - 30, 'Controls must shift left to reserve space when conversions are enabled');
  assert.ok(await first.evaluate(`document.querySelector('#rc-currency-select').options.length >= 150`));
  await first.evaluate(`document.querySelector('#rc-currency-select').value='MYR';document.querySelector('#rc-currency-select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await pause(150);
  assert.equal(await first.evaluate(`JSON.parse(localStorage.getItem('robuxCurrency')).currency`), 'MYR');
  assert.match(await first.evaluate(`document.querySelector('#header-balance .rc-robux-equivalent').textContent`), /11\.95 MYR/);
  assert.match(await first.evaluate(`document.querySelector('[data-currency-preview]').textContent`), /Your balance.*11\.95 MYR/);
  await first.evaluate(`document.querySelector('#rc-currency-search').value='yen';document.querySelector('#rc-currency-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.ok(await first.evaluate(`document.querySelector('#rc-currency-select option[value="JPY"]') !== null`));
  assert.equal(await first.evaluate(`document.querySelector('#rc-currency-select').value`), 'MYR');
  assert.ok(await first.evaluate(`document.querySelector('#rc-currency-select').options.length < 10`));
  await first.evaluate(`document.querySelector('#rc-currency-search').value='';document.querySelector('#rc-currency-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  if (process.env.CURRENCY_SCREENSHOTS) {
    fs.mkdirSync(process.env.CURRENCY_SCREENSHOTS, { recursive: true });
    const capture = await first.send('Page.captureScreenshot');
    fs.writeFileSync(path.join(process.env.CURRENCY_SCREENSHOTS, 'settings-desktop.png'), Buffer.from(capture.data, 'base64'));
  }
  await first.evaluate(`document.querySelector('#rc-close').click()`);
  await pause(80);
  if (process.env.CURRENCY_SCREENSHOTS) {
    const capture = await first.send('Page.captureScreenshot');
    fs.writeFileSync(path.join(process.env.CURRENCY_SCREENSHOTS, 'header-desktop.png'), Buffer.from(capture.data, 'base64'));
  }
  const secondInfo = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(`${url}/transactions`)}`, { method: 'PUT' })).json();
  const second = new CDP(secondInfo.webSocketDebuggerUrl); tabs.push(second);
  await second.send('Runtime.enable');
  await waitForDocument(second, '#header-balance .rc-robux-equivalent');
  assert.match(await second.evaluate(`document.querySelector('#header-balance .rc-robux-equivalent').textContent`), /11\.95 MYR/);
  await first.evaluate(`document.querySelector('.rc-settings-menu-entry').click();document.querySelector('#rc-currency-select').value='CNY';document.querySelector('#rc-currency-select').dispatchEvent(new Event('change',{bubbles:true}))`);
  await pause(150);
  assert.match(await second.evaluate(`document.querySelector('#header-balance .rc-robux-equivalent').textContent`), /17\.71 CNY/);
  await first.evaluate(`document.querySelector('#rc-close').click();document.querySelector('#nav-robux-amount').textContent='750';document.querySelector('#creator-price').value='1000';document.querySelector('#creator-price').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#dynamic').innerHTML='<p><span class="icon-robux-16x16"></span><span class="text-robux" id="dynamic-price">12.5K</span></p>'`);
  await pause(200);
  assert.match(await first.evaluate(`document.querySelector('#header-balance .rc-robux-equivalent').textContent`), /53\.14 CNY/);
  assert.match(await first.evaluate(`document.querySelector('#creator-price').nextElementSibling.textContent`), /70\.86 CNY/);
  assert.match(await first.evaluate(`document.querySelector('#dynamic-price').nextElementSibling.textContent`), /885\.73 CNY/);
  const mutations = await first.evaluate('mutations');
  await pause(350);
  assert.equal(await first.evaluate('mutations'), mutations, 'Idle pages should settle without an observer loop');
  await first.evaluate(`document.querySelector('#dynamic').innerHTML='<span class="icon-robux-16x16"></span><span class="text-robux" id="dynamic-price">0</span>';document.querySelector('#header-balance .rc-robux-equivalent').remove()`);
  await pause(150);
  // A removed annotation is restored on the next native update.
  await first.evaluate(`document.querySelector('#nav-robux-amount').textContent='250'`);
  await pause(150);
  assert.equal(await first.evaluate(`document.querySelectorAll('#header-balance .rc-robux-equivalent').length`), 1);
  assert.match(await first.evaluate(`document.querySelector('#dynamic-price').nextElementSibling.textContent`), /0\.00 CNY/);
  await first.send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 850, deviceScaleFactor: 1, mobile: false });
  assertIdentityCentered(await first.evaluate(headerGeometry));
  await first.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 1, mobile: true });
  await first.evaluate(`document.querySelector('.rc-settings-menu-entry').click()`);
  await pause(150);
  assert.equal(await first.evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  assert.equal(await first.evaluate(`document.querySelector('.rc-settings-dialog').scrollWidth <= document.querySelector('.rc-settings-dialog').clientWidth`), true);
  header = await first.evaluate(headerGeometry);
  assertIdentityCentered(header);
  assert.ok(header.currency.y >= header.header.y && header.currency.bottom <= header.header.bottom, 'Phone conversion must stay inside the header');
  assert.ok(header.search.x >= header.logo.right, 'Phone controls must leave room for the logo');
  assert.ok(header.settings.right <= header.header.right, 'Phone settings button must remain on screen');
  if (process.env.CURRENCY_SCREENSHOTS) {
    const capture = await first.send('Page.captureScreenshot');
    fs.writeFileSync(path.join(process.env.CURRENCY_SCREENSHOTS, 'settings-phone.png'), Buffer.from(capture.data, 'base64'));
    await first.evaluate(`document.querySelector('#rc-close').click()`);
    await pause(100);
    const page = await first.send('Page.captureScreenshot');
    fs.writeFileSync(path.join(process.env.CURRENCY_SCREENSHOTS, 'page-phone.png'), Buffer.from(page.data, 'base64'));
    await first.evaluate(`document.querySelector('.rc-settings-menu-entry').click()`);
  }
  await first.evaluate(`document.querySelector('#rc-currency-select').value='VND';document.querySelector('#rc-currency-select').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#card-price').textContent='1,000,000,000'`);
  await pause(150);
  assert.equal(await first.evaluate(`document.querySelector('#card-price').closest('.item-card').scrollWidth <= document.querySelector('#card-price').closest('.item-card').clientWidth`), true);
  await first.evaluate(`document.querySelector('[data-currency-enabled]').checked=false;document.querySelector('[data-currency-enabled]').dispatchEvent(new Event('change',{bubbles:true}))`);
  await pause(150);
  assert.equal(await first.evaluate(`document.querySelectorAll('.rc-robux-equivalent').length`), 0);
  assert.equal(await second.evaluate(`document.querySelectorAll('.rc-robux-equivalent').length`), 0);
  assert.equal(await first.evaluate(`document.querySelectorAll('[data-rc-currency-stack], [data-rc-currency-balance]').length`), 0);
  assert.deepEqual(first.errors, []);
  assert.deepEqual(second.errors, []);
});
