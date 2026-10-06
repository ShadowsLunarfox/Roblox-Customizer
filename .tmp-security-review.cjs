const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const workspace = __dirname;
const observations = {};

async function workerChecks() {
  const listeners = [];
  const calls = [];
  let simulateRedirect = false;
  const context = vm.createContext({
    URL, URLSearchParams, AbortSignal, Uint8Array, btoa,
    chrome: { runtime: { id: 'audit-extension', onMessage: { addListener(fn) { listeners.push(fn); } } },
      storage: { local: { async get() { return {}; }, async set() {} } } },
    async fetch(url, options) {
      calls.push({ url: String(url), options });
      return { ok: true, url: simulateRedirect ? 'https://outside-allowlist.invalid/pixel.png' : String(url),
        headers: new Headers({ 'content-type': 'image/png' }),
        async arrayBuffer() { if (simulateRedirect) return new ArrayBuffer(3); observations.bytesAllocatedBeforeImageRejection = 2 * 1024 * 1024 + 1; return new ArrayBuffer(observations.bytesAllocatedBeforeImageRejection); },
        async text() { return '<meta itemprop="channelId" content="UC1234567890123456789012">'; },
        async json() { return { data: [] }; } };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(workspace, 'badge-background.js'), 'utf8'), context);
  await assert.rejects(vm.runInContext("getXImage('https://evil.invalid/test.png')", context), /Image host unavailable/);
  assert.equal(calls.length, 0);
  observations.disallowedImageHostRejected = true;
  await assert.rejects(vm.runInContext("getXImage('https://pbs.twimg.com/media/test.png')", context), /Image too large/);
  observations.imageRequestHasTimeout = !!calls.at(-1).options.signal;
  await vm.runInContext("resolveYouTubeChannelId('https://www.youtube.com/redirect?q=https%3A%2F%2Fevil.invalid')", context);
  observations.workerAcceptsNonChannelYouTubePath = calls.at(-1).url;
  observations.youtubeRequestHasTimeout = !!calls.at(-1).options.signal;
  observations.youtubeRedirectPolicy = calls.at(-1).options.redirect || 'follow (default)';
  simulateRedirect = true;
  observations.imageAcceptsResponseOutsideAllowlist = (await vm.runInContext("getXImage('https://mosaic.fxtwitter.com/test.png')", context)).startsWith('data:image/png;base64,');
  observations.offOriginSenderRejected = listeners[0]({ type: 'rc-home-user' }, { url: 'https://evil.invalid/' }, () => {}) === undefined;
}

async function browserChecks() {
  const profile = fs.mkdtempSync(path.join(workspace, '.tmp-security-chrome-'));
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><body><main></main></body></html>');
  });
  let child, socket;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    child = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
      '--headless=new', '--disable-gpu', '--disable-background-networking', '--no-first-run',
      '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${profile}`, 'about:blank'
    ], { windowsHide: true, stdio: 'ignore' });
    const spawnError = new Promise((_, reject) => child.once('error', reject));
    const portFile = path.join(profile, 'DevToolsActivePort');
    await Promise.race([spawnError, (async () => {
      for (let i = 0; !fs.existsSync(portFile) && i < 100; i++) await pause(50);
      assert.ok(fs.existsSync(portFile), 'Isolated Chrome starts');
    })()]);
    const port = fs.readFileSync(portFile, 'utf8').split('\n')[0];
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const pending = new Map(); let nextId = 0;
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      if (!data.id) return;
      const request = pending.get(data.id); pending.delete(data.id);
      if (data.error) request.reject(new Error(JSON.stringify(data.error))); else request.resolve(data.result);
    });
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject, { once: true }); });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expression, contextId) => {
      const result = await send('Runtime.evaluate', { expression, contextId, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/audit` });
    await pause(150);
    const { frameTree } = await send('Page.getFrameTree');
    const { executionContextId } = await send('Page.createIsolatedWorld', { frameId: frameTree.frame.id, worldName: 'security-audit' });
    const settings = fs.readFileSync(path.join(workspace, 'settings.js'), 'utf8').replace(/\}\)\(\);\s*$/, 'globalThis.audit = { writeFile, readFile, deleteFile }; })();');
    await evaluate("globalThis.auditSaves=[];globalThis.chrome={storage:{local:{async get(){return {}},async set(value){auditSaves.push(value)}},onChanged:{addListener(){}}},runtime:{getURL:file=>'/'+file}};" + settings, executionContextId);
    await evaluate("audit.writeFile('audit-file',new File(['AUDIT_ONLY_FAKE_PRIVATE_DATA'],'private-photo.png',{type:'image/png'}))", executionContextId);
    observations.pageCanReadOriginalLocalFile = await evaluate(`(async()=>{
      const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('roblox-customizer-media',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      const files=await new Promise((resolve,reject)=>{const request=db.transaction('backgrounds').objectStore('backgrounds').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      db.close();return Promise.all(files.map(async file=>({name:file.name,type:file.type,text:await file.text()})));
    })()`);
    assert.equal(observations.pageCanReadOriginalLocalFile[0].text, 'AUDIT_ONLY_FAKE_PRIVATE_DATA');
    await evaluate("const entry=document.createElement('a');entry.className='rc-settings-menu-entry';document.body.append(entry);entry.click();const control=document.querySelector('#rc-hide-recommended');control.checked=true;control.dispatchEvent(new Event('change',{bubbles:true}));");
    await pause(350);
    observations.syntheticPageEventCanPersistSettings = await evaluate('auditSaves.some(value=>value.customBackground?.hideRecommended===true)', executionContextId);
    const before = requests.length;
    await evaluate(`globalThis.auditParsed=new DOMParser().parseFromString('<img src="http://127.0.0.1:${server.address().port}/parser-probe"><iframe src="http://127.0.0.1:${server.address().port}/frame-probe"></iframe><script>globalThis.auditUnexpectedExecution=true</script>', 'text/html')`, executionContextId);
    await pause(250);
    observations.inertParserSubrequests = requests.slice(before);
    observations.inertParserExecutedScript = await evaluate('globalThis.auditUnexpectedExecution===true', executionContextId);
    await send('Browser.close').catch(() => {});
  } finally {
    socket?.close();
    if (child?.pid && child.exitCode === null) {
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(700)]);
      if (child.exitCode === null) child.kill();
    }
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(profile)), path.resolve(workspace));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

(async () => {
  await workerChecks();
  console.log('Worker security observations: ' + JSON.stringify(observations));
  if (!process.argv.includes('--worker-only')) await browserChecks();
  console.log('All security observations: ' + JSON.stringify(observations));
})().catch(error => { console.error(error); process.exitCode = 1; });
