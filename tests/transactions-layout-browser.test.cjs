// Run with CHROME_BIN set. The local fixture uses Roblox's summary wrapper/table classes.
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
  const rows = ['Robux Stipends', 'Currency Purchases', 'Sales of Goods', 'Creator Rewards', 'Community Payouts', 'Roblox Adjustments', 'Total', 'Pending Robux']
    .map(label => `<tr><td>${label}</td><td><span class="icon-robux-16x16">⬡</span> <span class="text-robux">0</span><span class="rc-robux-equivalent">≈ RM 0.00 MYR</span></td></tr>`).join('');
  const summary = (id, className) => `<table id="${id}" class="${className}"><tbody><tr><th>Incoming Robux</th><th>Amount</th></tr>${rows}<tr><th>Outgoing Robux</th><th>Amount</th></tr><tr><td>Purchases</td><td>−⬡ 36<span class="rc-robux-equivalent">≈ RM 1.72 MYR</span></td></tr></tbody></table>`;
  return `<!doctype html><html data-rc-background-active data-rc-frost-page="transactions"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:0;color:#fff;background:#25272c;font:14px Arial}#content{margin:24px auto}.rc-background-media{background:repeating-linear-gradient(45deg,#a44034 0 48px,#798572 48px 96px,#635476 96px 144px)}.summary,.transaction-summary,.transactions-summary{background:#25272c}table{width:100%;border-collapse:collapse}td,th{background:#25272c;padding:8px;text-align:left}h2{padding:16px;margin:0;font-size:20px}.container-header{padding:20px}.input-dropdown{position:relative}.dropdown-menu{display:none;position:absolute;list-style:none;background:#25272c;margin:0;top:100%;left:0}.open>.dropdown-menu{display:block}.dropdown-menu button{width:100%}.native-toggle{min-height:42px}#inactive[hidden]{display:none}</style>
    <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/settings/settings.css"><link rel="stylesheet" href="/src/shared/site-pages.css"><link rel="stylesheet" href="/src/currency/robux-currency.css"><link rel="stylesheet" href="/src/pages/account/transactions-page.css">
    </head><body class="dark-theme"><div id="rc-background-layer"><div class="rc-background-media"></div></div><main id="container-main" class="container-main"><div id="content"><div id="transactions-page-container">
    <div class="container-header"><h1>My Transactions</h1><div class="input-dropdown"><button id="filter" class="native-toggle input-dropdown-btn" aria-expanded="false">Summary ▾</button><ul class="dropdown-menu"><li><button id="summary-option">Summary</button></li><li><button>Purchases</button></li></ul></div></div>
    <div id="summary-card" class="summary"><h2>Summary</h2>${summary('nested-summary', 'summary')}</div>
    ${summary('standalone-summary', 'summary')}${summary('standalone-transaction-summary', 'transaction-summary')}${summary('standalone-transactions-summary', 'transactions-summary')}
    <div id="alias-card" class="transaction-summary"><h2>Summary</h2>${summary('nested-alias', 'transactions-summary')}</div>
    <table id="history" class="table transactions"><thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>Oct 05, 2026</td><td><a href="#item">White Comfy Neko Hood</a></td><td>⬡ 100<span class="rc-robux-equivalent">≈ RM 4.78 MYR</span></td></tr></tbody></table>
    <div id="inactive" class="summary" hidden>${summary('hidden-summary', 'summary')}</div>
    </div></div></main><script>document.querySelector('#filter').onclick=event=>{const open=event.currentTarget.parentElement.classList.toggle('open');event.currentTarget.setAttribute('aria-expanded',String(open));};document.querySelector('#summary-option').onclick=()=>{document.querySelector('#filter').click();};</script></body></html>`;
}

class Browser {
  constructor(url) {
    this.socket = new WebSocket(url); this.pending = new Map(); this.next = 1;
    this.ready = new Promise((resolve,reject)=>{this.socket.addEventListener('open',resolve);this.socket.addEventListener('error',reject,{once:true});});
    this.socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=this.pending.get(message.id);this.pending.delete(message.id);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result);}});
  }
  async send(method,params={}) {
    await this.ready; const id=this.next++;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}));});
  }
  async evaluate(expression) {
    const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  }
}

test('Transactions summary and history retain visible frost across layout and filter changes', {skip:!process.env.CHROME_BIN,timeout:30000}, async t => {
  const profile = fs.mkdtempSync(path.join(workspace,'.tmp-transactions-browser-'));
  const server = http.createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');
    const file=new URL(request.url,'http://localhost').pathname.slice(1);
    if(['src/shared/theme.css','src/settings/settings.css','src/shared/site-pages.css','src/currency/robux-currency.css','src/pages/account/transactions-page.css'].includes(file)){
      response.setHeader('Content-Type','text/css');response.end(fs.readFileSync(path.join(workspace,file)));
    }else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixture());}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const child=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let browser;
  t.after(async()=>{
    if(browser){await Promise.race([browser.send('Browser.close').catch(()=>{}),pause(1000)]);browser.socket.close();}
    if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(1000)]);
    if(child.exitCode===null)child.kill();
    await new Promise(resolve=>server.close(resolve));await pause(300);
    assert.equal(path.dirname(path.resolve(profile)),workspace);
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  });
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await pause(50);
  assert.ok(fs.existsSync(portFile),'Isolated Chrome should start');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab=>tab.type==='page');
  browser=new Browser(target.webSocketDebuggerUrl);await browser.send('Page.enable');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1360,height:950,deviceScaleFactor:1,mobile:false});
  await browser.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/transactions`});
  await waitForDocument(browser, '#summary-card');await pause(250);
  assert.match(await browser.evaluate("getComputedStyle(document.querySelector('.rc-background-media')).backgroundImage"),/repeating-linear-gradient/,'The fixture must render a wallpaper behind the panels');
  const surfaces = `(() => {const ids=['summary-card','alias-card','nested-summary','nested-alias','standalone-summary','standalone-transaction-summary','standalone-transactions-summary','history'];return Object.fromEntries(ids.map(id=>{const node=document.getElementById(id),style=getComputedStyle(node);return [id,{background:style.backgroundColor,blur:style.backdropFilter,radius:style.borderRadius}];}));})()`;
  const assertFrost = (surface,label,blur=18) => {
    assert.match(surface.background,/rgba\(.+, 0\.31\)/,label);
    assert.match(surface.blur,new RegExp(`blur\\(${blur}px\\)`),label);
    assert.equal(surface.radius,'14px',label);
  };
  for(const width of [1360,768,360]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:width===360});
    const panels=await browser.evaluate(surfaces);
    for(const id of ['summary-card','alias-card','standalone-summary','standalone-transaction-summary','standalone-transactions-summary','history'])assertFrost(panels[id],`${width}: ${id}`);
    for(const id of ['nested-summary','nested-alias']){
      assert.equal(panels[id].blur,'none','Nested tables share the summary card blur');
      assert.equal(panels[id].background,'rgba(0, 0, 0, 0)');
    }
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'The page must fit its viewport');
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#inactive')).display"),'none');
    if(process.env.TRANSACTIONS_SCREENSHOTS){
      fs.mkdirSync(process.env.TRANSACTIONS_SCREENSHOTS,{recursive:true});
      const screenshot=await browser.send('Page.captureScreenshot');
      fs.writeFileSync(path.join(process.env.TRANSACTIONS_SCREENSHOTS,`summary-${width}.png`),Buffer.from(screenshot.data,'base64'));
    }
  }
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1360,height:950,deviceScaleFactor:1,mobile:false});
  await browser.evaluate("document.querySelector('#filter').click()");
  const dropdown=await browser.evaluate(`(() => {const option=document.querySelector('#summary-option');const rect=option.getBoundingClientRect();return {blur:getComputedStyle(option.closest('.dropdown-menu')).backdropFilter,hit:document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)===option};})()`);
  assert.match(dropdown.blur,/blur\(18px\)/);assert.equal(dropdown.hit,true,'Open filters remain above the summary');
  await browser.evaluate("document.querySelector('#summary-option').click();document.documentElement.style.setProperty('--rc-glass-blur','32px');document.documentElement.style.setProperty('--rc-page-panel-opacity','.4');");
  const changed=await browser.evaluate(surfaces);
  assert.match(changed['summary-card'].blur,/blur\(32px\)/);assert.match(changed['summary-card'].background,/0\.4\)/);
  assert.match(changed['standalone-summary'].blur,/blur\(32px\)/);
  await browser.evaluate("document.querySelector('#nested-summary').outerHTML=document.querySelector('#nested-summary').outerHTML");
  assert.equal((await browser.evaluate(surfaces))['nested-summary'].blur,'none','Native remounts use the same single glass layer');
  await browser.evaluate("document.documentElement.removeAttribute('data-rc-background-active')");
  for(const surface of Object.values(await browser.evaluate(surfaces)))assert.equal(surface.blur,'none','Disabling wallpaper restores native rendering');
  await browser.evaluate("document.documentElement.setAttribute('data-rc-background-active','');document.documentElement.dataset.rcFrostPage='profile'");
  for(const surface of Object.values(await browser.evaluate(surfaces)))assert.equal(surface.blur,'none','Transactions frost is scoped to its route');
});
