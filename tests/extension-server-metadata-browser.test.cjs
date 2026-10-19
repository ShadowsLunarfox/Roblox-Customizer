const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { Browser, isolatedChrome, pause } = require('./helpers/chrome.cjs');

const workspace = path.resolve(__dirname, '..');
const reactBundle = process.env.SERVER_VIEW_REACT_BUNDLE;
const firstId = '12345678-1234-4444-8888-000000000001';
const secondId = '12345678-5678-4444-8888-000000000002';

// Requires Chrome for Testing or Chromium, which supports --load-extension.
// This deliberately lets Chrome load manifest scripts: manually injecting them
// cannot reproduce Chrome's cross-world content-script file de-duplication.
test('real Chrome package injects MAIN dependencies and resolves Indonesian server metadata', {
  skip: !process.env.CHROME_EXTENSION_TESTS || !process.env.CHROME_BIN || !reactBundle,
  timeout: 30000
}, async t => {
  const browser = await isolatedChrome(t, 'extension-server-metadata', { args: [`--load-extension=${workspace}`] });
  let workerTarget;
  const debugOrigin = new URL(browser.socket.url);
  for (let i = 0; i < 50 && !workerTarget; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${debugOrigin.port}/json/list`)).json();
    workerTarget = targets.find(target => target.url.endsWith('/src/background/service-worker-bundle.js'));
    if (!workerTarget) await pause(50);
  }
  assert.ok(workerTarget, 'Chrome must load the actual workspace extension');
  const worker = new Browser(workerTarget.webSocketDebuggerUrl);
  t.after(() => worker.socket.close());
  await worker.send('Runtime.enable');
  await worker.evaluate("chrome.storage.local.set({robloxCustomizerTermsAccepted:true,customBackground:{source:'none',hideXFeed:true,hideYouTubeFeed:true}})");

  const countryRequests = [];
  const heldStatuses = [];
  const failures = [];
  const fulfill = (client, requestId, body, mime = 'application/json') => client.send('Fetch.fulfillRequest', {
    requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: mime }],
    body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64')
  });
  worker.socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    const url = new URL(request.url);
    let response = {};
    if (url.hostname === 'games.roblox.com' && url.pathname.includes('/servers/Public')) {
      heldStatuses.push(requestId);
      return;
    }
    if (url.hostname === 'gamejoin.roblox.com') {
      countryRequests.push(JSON.parse(request.postData));
      response = { joinScript: { UdmuxEndpoints: [{ Address: '8.8.8.8' }] } };
    } else if (url.hostname === 'ipwho.is') response = { success: true, country_code: 'SG' };
    fulfill(worker, requestId, response).catch(error => failures.push(error.message));
  });
  await worker.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });

  const markup = `<!doctype html><html lang="id"><head><meta charset="utf-8">
    <meta name="locale-data" data-language-code="id_id"><script src="https://js.rbxcdn.com/fixture-React.js"></script></head><body>
    <main id="game-detail-page" data-place-id="4623386862"><section id="game-instances"><div id="running-game-instances-container"><div id="native-root"></div></div></section></main>
    <script>
      const h=React.createElement;
      function Button(p){return h('button',{className:p.className,onClick:p.onClick,disabled:p.isDisabled},p.children)}
      function Card(p){return h('li',{className:'rbx-public-game-server-item'},h('div',{className:'card-item card-item-public-server'},
        h('div',{className:'game-server-status'},p.gameServerStatus),h(Button,{className:'game-server-join-btn',onClick:()=>window.lastJoined=p.id},'Bergabung'),
        h('div',{className:'server-id-text'},'ID: '+p.id.substring(9,18))))}
      function List(p){return h('section',{id:'rbx-public-running-games',className:'server-list-section'},h('h2',{},'Layanan Lainnya'),
        h('ul',{className:'card-list'},p.gameInstances.map(s=>h(Card,{key:s.id,id:s.id,serverListType:'public',currentPlayersCount:s.playing,
          gameServerStatus:s.playing+' dari maksimal 6 pemain',pingSignalLevel:s.pingSignalLevel}))))}
      ReactDOM.render(h(List,{headerTitle:'Layanan Lainnya',loadMoreGameInstances(){},gameInstances:[
        {id:'${firstId}',playing:4,ping:55,countryCode:'SG'},
        {id:'${secondId}',playing:3,pingSignalLevel:'High'}
      ]}),document.getElementById('native-root'));
    </script></body></html>`;
  browser.socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    const react = request.url.startsWith('https://js.rbxcdn.com/');
    fulfill(browser, requestId, react ? fs.readFileSync(reactBundle, 'utf8') : markup,
      react ? 'text/javascript' : 'text/html; charset=utf-8').catch(error => failures.push(error.message));
  });
  await browser.send('Fetch.enable', { patterns: [
    { urlPattern: 'https://www.roblox.com/*', requestStage: 'Request' },
    { urlPattern: 'https://js.rbxcdn.com/*', requestStage: 'Request' }
  ] });
  await browser.send('Page.navigate', { url: 'https://www.roblox.com/id/games/4623386862/Fixture' });
  await browser.waitFor("document.querySelector('.card-item')?.dataset.rcServerCountry==='SG'");
  assert.equal(await browser.evaluate("RobloxCustomizerRoutes.pathname()"), '/games/4623386862/Fixture');
  assert.equal(await browser.evaluate('RobloxCustomizerCompatibility.enabled()'), true);
  assert.equal(await browser.evaluate("document.querySelector('.rc-server-latency').textContent"), 'Latensi rendah \u00b7 55 ms');
  await browser.waitFor("document.querySelectorAll('.card-item')[1]?.dataset.rcServerCountry==='SG'");
  assert.deepEqual(countryRequests, [{ placeId: 4623386862, gameId: secondId }], 'Country lookup receives the full native UUID');
  assert.equal(await browser.evaluate("document.querySelectorAll('.rc-server-latency')[1].textContent"), 'Latensi tinggi');
  assert.ok(heldStatuses.length > 0, 'Numeric latency is requested for that full UUID');
  for (const requestId of heldStatuses.splice(0)) await fulfill(worker, requestId, { data: [{ id: secondId, ping: 142 }] });
  await browser.waitFor("document.querySelectorAll('.rc-server-latency')[1]?.textContent.includes('142')");
  await browser.evaluate("document.querySelectorAll('.game-server-join-btn')[1].click()");
  assert.equal(await browser.evaluate('window.lastJoined'), secondId);
  assert.deepEqual([...browser.errors, ...worker.errors, ...failures], []);
});
