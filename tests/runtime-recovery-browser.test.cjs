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
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#647abb"/></svg>';

const setup = `
  const NativeDate=Date;
  window.clockOffset=0;
  window.Date=class extends NativeDate {static now(){return NativeDate.now()+clockOffset}};
  const listeners=[];
  window.heldRates=[];window.ratesAvailable=false;window.fixtureClicks=0;window.fixtureNavigations=0;
  window.chrome={storage:{local:{
    async get(){return {customBackground:{source:new URLSearchParams(location.search).get('appearance')==='light'?'none':'url',url:location.origin+'/image.svg',hideXFeed:true,hideYouTubeFeed:true}}},
    async set(){}
  },onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{getURL:file=>'/'+file,lastError:null,
    sendMessage(message,callback){
      if(message.type==='rc-currency-rates'&&!ratesAvailable){heldRates.push(callback);return}
      const response=message.type==='rc-home-user'?{id:1,name:'Player',displayName:'Player',imageUrl:location.origin+'/image.svg'}
        :message.type==='rc-pinned-games'?{ok:true,games:[]}
        :message.type==='rc-currency-rates'?{ok:true,date:'2026-10-10',rates:{USD:1,MYR:4.1}}
        :{error:'No optional data in this fixture'};
      setTimeout(()=>callback(response),10);
    }
  }};
  addEventListener('click',()=>fixtureClicks++);
  addEventListener('beforeunload',()=>fixtureNavigations++);
`;

function html(route, appearance) {
  const cards = Array.from({ length: 24 }, (_, index) => `<li class="game-card-container"><a class="game-card-link" href="https://www.roblox.com/games/${index + 10}/Game"><img src="/image.svg"><div class="game-card-name">Game ${index}</div></a></li>`).join('');
  const content = route === '/home'
    ? `<main id="HomeContainer"><h1>Home</h1><section><h2>Continue</h2><ul>${cards}</ul></section><section><h2>Recommended For You</h2><ul>${cards}</ul></section></main>`
    : route === '/my/account'
      ? '<main id="content"><h1>Settings</h1><div id="account-settings"><nav><a href="#!/info">Account info</a><a href="#!/security">Security</a></nav><section id="native-section"><h2>Security</h2><p>Keep your account safe</p></section></div></main>'
      : route.startsWith('/private-server/configure')
        ? '<main id="content"><h1>Configure Private Server</h1><img src="/image.svg"><h2>Server Name</h2><p>My server</p></main>'
        : `<main id="content"><h1>Native page</h1><section id="native-section"><p>Existing content</p></section>${route === '/charts' ? '<ul>' + cards + '</ul>' : ''}</main>`;
  return `<!doctype html><html class="${appearance === 'light' ? 'light' : 'dark'}-theme"><head><meta charset="utf-8">
    <style>body{font:16px Arial;margin:20px;background:#24252c;color:white}main{max-width:1000px;margin:auto;min-height:600px}li{display:inline-block;width:120px}img{width:100px;height:100px}#chat-main{position:fixed;bottom:0;right:0;width:260px;height:180px}.ng-hide{display:none!important}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
    <header><span id="nav-robux-amount">250</span></header>
    <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>${content}
    <div id="chat-container"><div id="chat-main"><button>Chat</button><input placeholder="Search for friends"></div></div>
    <div id="hidden-native" class="ng-hide">An inactive native section</div>
    <script>
      window.fixtureReady=true;
      setTimeout(()=>{
        const panel=document.createElement('section');panel.id='late-content';
        panel.innerHTML='<h2>Content loaded while idle</h2><label for="native-draft">Draft</label><input id="native-draft" value="Keep my unsaved text"><button id="native-action">Native action</button>';
        panel.querySelector('button').onclick=()=>panel.dataset.clicked='true';
        document.querySelector('main').append(panel);
      },250);
    </script></body></html>`;
}

test('all content scripts handle idle mounts, missing wallpaper and tab suspension without refreshing or clicking',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...styles, ...scripts, 'icons/icon-48.png']);
    const server = http.createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      const requested = new URL(request.url, 'http://localhost');
      const route = requested.pathname;
      const file = route.slice(1);
      if (files.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/png');
        response.end(fs.readFileSync(path.join(workspace, file)));
      } else if (route === '/image.svg') {
        response.setHeader('Content-Type', 'image/svg+xml'); response.end(svg);
      } else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html(route, requested.searchParams.get('appearance'))); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'runtime-recovery');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
    // Load the manifest order, including the bridge, to exercise interactions
    // between all shared observers rather than testing each in isolation.
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file
    });
    const routes = ['/home', '/charts', '/my/account#!/security', '/private-server/configure/123',
      '/upgrades/robux', '/game-pass/123/Pass', '/badges/123/Badge', '/report-abuse', '/transactions', '/my/messages'];
    for (const route of routes) for (const appearance of ['dark', 'light']) {
      const target = new URL(route, `http://127.0.0.1:${server.address().port}`);
      target.searchParams.set('appearance', appearance);
      const url = target.href;
      const wallpaper = appearance === 'dark';
      await browser.send('Page.navigate', { url });
      await waitForDocument(browser, 'main', url);
      await browser.waitFor(`!!document.querySelector('#late-content') && heldRates.length===1 && !!document.querySelector('#rc-background-layer')${wallpaper ? " && !!document.querySelector('#rc-background-layer img')" : ''}`);
      await browser.evaluate(`(()=>{
        window.originalDraft=document.querySelector('#native-draft');
        originalDraft.value='Unsaved edits survive';
        const panel=document.createElement('aside');panel.id='currency-test';document.body.append(panel);
        RobloxCustomizerCurrency.mountSettings(panel);
        window.originalLayer=document.getElementById('rc-background-layer');originalLayer.remove();
      })()`);
      await browser.waitFor(`!!document.querySelector('#rc-background-layer') && document.getElementById('rc-background-layer')!==originalLayer${wallpaper ? " && !!document.querySelector('#rc-background-layer img')" : ''}`);
      assert.equal(await browser.evaluate("document.querySelector('[data-currency-refresh]').disabled"), true, route);
      // Freeze real browser tasks, then resume without a page navigation or an
      // input event. Advancing the wall clock simulates a long suspended tab.
      await browser.evaluate('clockOffset+=90_000');
      await browser.send('Emulation.setFocusEmulationEnabled', { enabled: false });
      await browser.send('Page.setWebLifecycleState', { state: 'frozen' });
      await pause(100);
      await browser.send('Page.setWebLifecycleState', { state: 'active' });
      await browser.send('Page.bringToFront');
      await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
      try { await browser.waitFor("!document.querySelector('[data-currency-refresh]').disabled"); }
      catch (error) {
        const detail = JSON.stringify(await browser.evaluate(`({route:location.href,hidden:document.hidden,
          now:Date.now(),offset:clockOffset,runtime:!!RobloxCustomizerRuntime,held:heldRates.length,
          status:document.querySelector('[data-currency-status]').textContent,errors:${JSON.stringify(browser.errors)}})`));
        throw new Error(error.message + ' ' + detail);
      }
      await browser.waitFor("document.documentElement.hasAttribute('data-rc-ui-active') && !!document.querySelector('#chat-main[data-rc-chat-panel]')");
      const state = await browser.evaluate(`({
        late:document.getElementById('late-content').checkVisibility(),
        wallpaper:document.getElementById('rc-background-layer').checkVisibility(),
        sameDraft:originalDraft===document.getElementById('native-draft'),
        draft:document.getElementById('native-draft').value,
        hidden:document.getElementById('hidden-native').checkVisibility(),
        clicks:fixtureClicks,navigations:fixtureNavigations,url:location.href,
        layers:document.querySelectorAll('#rc-background-layer').length,
        menus:document.querySelectorAll('.rc-settings-menu-entry').length
      })`);
      assert.deepEqual(state, { late: true, wallpaper, sameDraft: true, draft: 'Unsaved edits survive',
        hidden: false, clicks: 0, navigations: 0, url, layers: 1, menus: 1 }, `${route} (${appearance})`);
      await browser.evaluate("heldRates[0]({ok:true,date:'old',rates:{USD:1}})");
      assert.equal(await browser.evaluate("document.querySelector('[data-currency-refresh]').disabled"), false, 'Late callbacks cannot relock recovered controls');
      // A real feature retry and the original native handler still work.
      await browser.evaluate("ratesAvailable=true;document.querySelector('[data-currency-refresh]').click();document.getElementById('native-action').click()");
      await browser.waitFor("!document.querySelector('[data-currency-refresh]').disabled");
      assert.equal(await browser.evaluate("document.getElementById('late-content').dataset.clicked"), 'true');
    }
    assert.deepEqual(browser.errors, []);
  });
