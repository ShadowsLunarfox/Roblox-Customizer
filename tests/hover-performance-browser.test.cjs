const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const entries = manifest.content_scripts.filter(entry => entry.world !== 'MAIN');
const scripts = [...new Set(entries.flatMap(entry => entry.js || []))];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];

function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <style>body{font:14px Arial;margin:20px;background:#34465a;color:white}.game-card-container{display:inline-block;width:120px;padding:8px}.friend-tile-dropdown{position:fixed;top:100px;left:20px;z-index:1000}.friend-tile-dropdown button{display:block}</style></head><body class="dark-theme">
    <nav><button id="hover-trigger">Hover</button><button id="native-action">Native action</button><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul></nav>
    <main id="HomeContainer"><div class="friend-carousel-container"><div class="react-friends-carousel-container"><div><div class="friends-carousel-list-container">
      ${Array.from({length:51}, (_,i) => `<div class="friends-carousel-tile">Friend ${i}</div>`).join('')}
    </div></div></div></div><section id="recommendations"><h2>Recommended For You</h2><div class="game-grid">
      ${Array.from({length:500}, (_,i) => `<div class="game-card-container"><a href="https://www.roblox.com/games/${1000+i}/Test"><span class="game-card-name">Game ${i}</span></a><div class="item-card-price"><span class="icon-robux-16x16"></span><span class="text-robux">${100+i}</span></div><div><span>Stats</span><button>Details</button><div><span>About this game</span><p>Description</p></div></div></div>`).join('')}
    </div></section></main>
    <script>
      const listeners=[];window.saved={customBackground:{source:'none',clockShowSeconds:false}};
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,saved[key]]))},async set(values){Object.assign(saved,values)}},onChanged:{addListener(fn){listeners.push(fn)}}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:123,name:'Player',displayName:'Player'}:message.type==='rc-playtime'?{ok:true,enabled:false,account:null,games:[],status:{kind:'disabled',checkedAt:0}}:{ok:true,games:[],folders:[]}))}}};
      window.resetWork=()=>window.work={currencyScans:0,homeScans:0,formats:0,friendWrites:0,chatScans:0,accountScans:0,gameScans:0};resetWork();
      const query=Element.prototype.querySelectorAll;
      Element.prototype.querySelectorAll=function(selector){if(this===document.body&&selector.includes('icon-robux'))work.currencyScans++;if(this.id==='HomeContainer'&&selector.includes('/games/'))work.homeScans++;if(this.id==='HomeContainer'&&selector.includes('Search for friends'))work.chatScans++;return query.call(this,selector)};
      const documentQuery=Document.prototype.querySelectorAll;Document.prototype.querySelectorAll=function(selector){if(selector.includes('data-rc-settings-panel'))work.accountScans++;if(selector.includes('#rc-community-social-feeds'))work.gameScans++;return documentQuery.call(this,selector)};
      const set=Element.prototype.setAttribute;Element.prototype.setAttribute=function(name,value){if(name==='data-rc-native-friend-cell')work.friendWrites++;return set.call(this,name,value)};
      const Format=Intl.NumberFormat;Intl.NumberFormat=class extends Format{constructor(...args){super(...args);work.formats++}};
      window.openHover=()=>{document.querySelector('.friend-tile-dropdown')?.remove();const menu=document.createElement('div');menu.className='friend-tile-dropdown';menu.innerHTML='<button>Chat</button><button>View Profile</button><span role="tooltip">Details</span>';document.body.append(menu)};
      document.querySelector('#hover-trigger').addEventListener('mouseenter',openHover);
      window.nativeClicks=0;document.querySelector('#native-action').addEventListener('click',()=>{nativeClicks++;document.querySelector('#HomeContainer').classList.toggle('clicked')});
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Hover portals do not rescan the page or reformat unrelated prices; live content still updates',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const assets = new Set([...styles, ...scripts]);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'hover-performance');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    for (const route of ['/home', '/catalog']) {
      await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}${route}` });
      await waitForDocument(browser, '.rc-settings-menu-entry');
      await browser.waitFor("document.querySelectorAll('.text-robux + .rc-robux-equivalent').length===500");
      // Let startup discovery settle before measuring native hover activity.
      await browser.evaluate('new Promise(resolve=>setTimeout(resolve,650))');
      await browser.evaluate('resetWork()');
      const point = await browser.evaluate("(()=>{const r=document.querySelector('#hover-trigger').getBoundingClientRect();return {x:r.left+5,y:r.top+5}})()");
      await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
      await browser.waitFor("!!document.querySelector('.friend-tile-dropdown')");
      await browser.evaluate(`(async()=>{for(let i=0;i<6;i++){const menu=document.querySelector('.friend-tile-dropdown');menu.classList.toggle('hovered');menu.querySelector('[role=tooltip]').textContent='Details '+i;await new Promise(resolve=>setTimeout(resolve,100))}document.querySelector('.friend-tile-dropdown').remove();await new Promise(resolve=>setTimeout(resolve,150))})()`);
      const work = await browser.evaluate('work');
      assert.deepEqual(work, { currencyScans:0, homeScans:0, formats:0, friendWrites:0, chatScans:0, accountScans:0, gameScans:0 }, `${route}: hover work must stay inside the popup`);
      await browser.click('#native-action');
      assert.equal(await browser.evaluate('nativeClicks'),1,'Native click handlers remain immediate');
      await browser.evaluate(`(async()=>{for(let i=0;i<6;i++){const page=document.querySelector('#HomeContainer');page.classList.toggle('hovering');page.style.opacity=i%2?'1':'.99';await new Promise(resolve=>setTimeout(resolve,30))}})()`);
      assert.equal(await browser.evaluate('work.chatScans'),0,'Container hover/animation changes never rediscover chat across the page');
      assert.equal(await browser.evaluate('work.accountScans'),0,'Account cleanup never scans an unrelated page');
      assert.equal(await browser.evaluate('work.gameScans'),0,'The game controller ignores unrelated pages and portals');
      // Root-level :has() combined with the other loaded page styles previously
      // caused hundreds of ms of style work each time a small portal was replaced.
      await browser.send('Emulation.setCPUThrottlingRate',{rate:4});
      await browser.send('Performance.enable');
      const before=await browser.send('Performance.getMetrics');
      await browser.evaluate(`(async()=>{for(let i=0;i<6;i++){openHover();document.body.offsetHeight;await new Promise(requestAnimationFrame)}})()`);
      const after=await browser.send('Performance.getMetrics');
      const metric=(result,name)=>result.metrics.find(entry=>entry.name===name).value;
      const styleMs=(metric(after,'RecalcStyleDuration')-metric(before,'RecalcStyleDuration'))*1000;
      assert.ok(styleMs<250,`${route}: six popup replacements cost ${styleMs.toFixed(1)} ms of style work at 4× CPU slowdown`);
      await browser.send('Emulation.setCPUThrottlingRate',{rate:1});
      await browser.evaluate(`openHover();const price=document.createElement('div');price.className='item-card-price';price.innerHTML='<span class="icon-robux-16x16"></span><span class="text-robux">500</span>';document.querySelector('.friend-tile-dropdown').append(price)`);
      await browser.waitFor("!!document.querySelector('.friend-tile-dropdown .rc-robux-equivalent')");
      await browser.evaluate("window.beforePrice=document.querySelector('.friend-tile-dropdown .rc-robux-equivalent').textContent;document.querySelector('.friend-tile-dropdown .text-robux').firstChild.nodeValue='900'");
      await browser.waitFor("document.querySelector('.friend-tile-dropdown .rc-robux-equivalent').textContent!==beforePrice");
      await browser.evaluate("document.querySelector('.friend-tile-dropdown .rc-robux-equivalent').remove()");
      await browser.waitFor("!!document.querySelector('.friend-tile-dropdown .rc-robux-equivalent')");
      assert.equal(await browser.evaluate("document.querySelectorAll('#HomeContainer .rc-robux-equivalent').length"), 500);
      if (route === '/home') {
        await browser.evaluate("const tile=document.createElement('div');tile.className='friends-carousel-tile';tile.textContent='New friend';document.querySelector('.friends-carousel-list-container').append(tile)");
        await browser.waitFor("document.querySelector('.friends-carousel-list-container').lastElementChild.hasAttribute('data-rc-native-friend-cell')");
        await browser.evaluate("const card=document.createElement('div');card.className='game-card-container';card.innerHTML='<a href=\"https://www.roblox.com/games/9999/New\"><span class=\"game-card-name\">New game</span></a>';document.querySelector('.game-grid').append(card)");
        await browser.waitFor("!!document.querySelector('.game-grid').lastElementChild.querySelector('.rc-hide-recommended-game')");
      }
      await browser.evaluate(`(()=>{const menu=document.createElement('div');menu.id='native-header-menu';menu.setAttribute('role','menu');
        menu.style.cssText='position:fixed;top:150px;right:20px;z-index:2000';
        menu.innerHTML='<div role="menuitem"><a href="/my/account" id="native-menu-link">Settings</a></div><div role="menuitem" tabindex="0" id="native-menu-action">Menu action</div>';
        menu.querySelector('#native-menu-action').addEventListener('click',()=>nativeClicks++);document.body.append(menu)})()`);
      await browser.waitFor("document.querySelector('#native-header-menu').hasAttribute('data-rc-header-menu') && document.querySelector('#native-menu-action').hasAttribute('data-rc-menu-action')");
      assert.deepEqual(await browser.evaluate("['#native-menu-link','#native-menu-action'].map(selector=>getComputedStyle(document.querySelector(selector)).padding)"),['10px 12px','10px 12px'],
        'Generated header menus retain styling for links and standalone actions');
      assert.equal(await browser.evaluate("document.querySelector('#native-menu-link').parentElement.hasAttribute('data-rc-menu-action')"),false,
        'A wrapper with its own link is not padded as a second action');
      await browser.click('#native-menu-action');
      assert.equal(await browser.evaluate('nativeClicks'),2,'Marked menu actions keep their native handlers');
      assert.deepEqual(browser.errors, []);
    }
  });
