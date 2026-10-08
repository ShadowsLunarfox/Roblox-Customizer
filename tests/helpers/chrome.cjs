const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const workspace = path.resolve(__dirname, '../..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

class Browser {
  constructor(url) {
    this.socket=new WebSocket(url);this.pending=new Map();this.next=1;this.errors=[];
    this.ready=new Promise((resolve,reject)=>{this.socket.addEventListener('open',resolve);this.socket.addEventListener('error',reject,{once:true})});
    this.socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id){const request=this.pending.get(message.id);this.pending.delete(message.id);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result)}else if(message.method==='Runtime.exceptionThrown')this.errors.push(message.params.exceptionDetails.text)});
  }
  async send(method,params={}) {
    await this.ready;const id=this.next++;
    return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.socket.send(JSON.stringify({id,method,params}))});
  }
  async evaluate(expression) {
    const result=await this.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  }
  async click(selector) {
    const point=await this.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});node.scrollIntoView({block:'center'});const rect=node.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}})()`);
    await this.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
    await this.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  }
  async waitFor(expression) {
    for(let i=0;i<100;i++){if(await this.evaluate(expression))return;await pause(30)}
    assert.fail(`Timed out: ${expression}`);
  }
}

async function waitForDocument(browser, selector, expectedUrl) {
  const ready = `document.readyState === 'complete' && !!document.querySelector(${JSON.stringify(selector)})${expectedUrl ? ` && location.href === ${JSON.stringify(expectedUrl)}` : ''}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await browser.evaluate(ready)) return;
    await pause(30);
  }
  assert.fail(`Fixture document and assets did not finish loading: ${selector}`);
}

async function isolatedChrome(t, name) {
  assert.match(name,/^[a-z-]+$/);
  const profile=fs.mkdtempSync(path.join(workspace,`.tmp-${name}-browser-`));
  const child=spawn(process.env.CHROME_BIN,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let browser;
  t.after(async()=>{
    if(browser){await Promise.race([browser.send('Browser.close').catch(()=>{}),pause(1000)]);browser.socket.close()}
    if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(1000)]);
    if(child.exitCode===null)child.kill();await pause(300);
    assert.equal(path.dirname(path.resolve(profile)),workspace);
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  });
  const portFile=path.join(profile,'DevToolsActivePort');
  for(let i=0;!fs.existsSync(portFile)&&i<100;i++)await pause(50);
  assert.ok(fs.existsSync(portFile),'Isolated Chrome should start');
  const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
  const target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(tab=>tab.type==='page');
  browser=new Browser(target.webSocketDebuggerUrl);
  await browser.send('Page.enable');await browser.send('Runtime.enable');
  // Serve fresh local assets for each fixture navigation and route case.
  await browser.send('Network.enable');
  await browser.send('Network.setCacheDisabled',{cacheDisabled:true});
  return browser;
}

module.exports={isolatedChrome,pause,waitForDocument};
