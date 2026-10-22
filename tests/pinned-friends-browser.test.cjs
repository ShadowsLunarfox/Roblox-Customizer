const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/routes.js', 'src/shared/dialogs.js', 'src/shared/i18n.js',
  'src/home/pinned-friends-core.js', 'src/background/pinned-friends-background.js',
  'src/shared/friend-actions.js', 'src/home/pinned-friend-menu.js', 'src/home/pinned-friends.js'];
const styles = ['src/shared/theme.css', 'src/home/pinned-friends.css',
  'src/shared/site-pages.css', 'src/pages/account/account-pages.css'];
const settingsScripts = ['src/shared/startup.js', 'src/settings/settings.js'];
const settingsStyles = ['src/shared/startup.css', 'src/settings/settings.css'];
function fixture({ nested = false, settings = false } = {}) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${[...styles, ...(settings ? settingsStyles : [])].map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <style>*{box-sizing:border-box}body{font:14px Arial;background:#7185a6;color:white;margin:20px}#friends-web-app{display:block}.avatar-card-container{display:inline-flex;flex-direction:column;vertical-align:top;width:150px;padding:12px;border:1px solid #aaa;border-radius:12px;margin:6px}.avatar-card-container a{color:inherit}#native-friends{padding:20px}#rc-pinned-friends-dialog{background:#35445a}#rc-pinned-friends-dialog li{max-width:100%}.native-profile-button{min-height:40px;padding:8px 12px;border:1px solid #aaa;border-radius:8px;background:#32445e;color:white;font:inherit}.user-profile-header .button-container,.profile-header-buttons{display:flex;gap:8px}.user-profile-header .buttons-show-on-desktop{width:331px}.user-profile-header .buttons-show-on-mobile{display:none}.button-container>button{width:100%;min-width:0}.profile-header-buttons>button{flex:1}@media(max-width:767px){.user-profile-header .buttons-show-on-desktop{display:none}.user-profile-header .buttons-show-on-mobile{display:block}}</style></head><body class="dark-theme">
    ${settings ? '<ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>' : ''}
    <main id="content"><div id="HomeContainer"><h1>Home</h1>${nested ? '<div id="native-friends-wrapper">' : ''}<section class="friend-carousel-container"><button id="native-friends">Native friends</button></section>${nested ? '</div>' : ''}</div></main>
    <script>
      const messageListeners=[],storageListeners=[],resume=[];
      window.account=100;window.nativeClicks=0;window.failure=false;window.requests=[];
      window.nativeActions={chat:[],join:[]};window.chatFails=false;
      window.CoreRobloxUtilities={chatService:{startDesktopAndMobileWebChat(value){if(chatFails)throw new Error('Native failure');nativeActions.chat.push(value)}}};
      window.Roblox={ProtocolHandlerClientInterface:{followPlayerIntoGame(value){nativeActions.join.push(value);return Promise.resolve()}}};
      window.presences={1:{userId:1,userPresenceType:2,placeId:10,universeId:20,gameId:'11111111-2222-3333-4444-555555555555',lastLocation:'be FAT!'},
        65:{userId:65,userPresenceType:2,placeId:null,gameId:null,lastLocation:'Private experience'}};
      window.saved=JSON.parse(localStorage.getItem('saved')||'{}');
      window.holdPreferences=location.search.includes('slow');window.pendingPreferences=[];
      window.releasePreferences=()=>{holdPreferences=false;pendingPreferences.splice(0).forEach(resolve=>resolve())};
      window.roster=Array.from({length:65},(_,i)=>({id:i+1,name:'Friend'+(i+1),displayName:i===0?'Friends':i===1?'日本語の非常に長いフレンド表示名がここに表示されます':'Player '+(i+1)}));
      window.chrome={runtime:{id:'fixture',lastError:null,getURL:file=>'/'+file,onMessage:{addListener:fn=>messageListeners.push(fn)},sendMessage(message,callback){for(const listener of messageListeners){const result=listener(message,{id:'fixture',url:'https://www.roblox.com/home',frameId:0},callback);if(result)return;}queueMicrotask(()=>callback(message.type==='rc-home-user'?{id:100,name:'Player',displayName:'Player'}:{ok:true,games:[],folders:[]}));}},
        storage:{local:{async get(key){if(key==='customBackground'&&holdPreferences)await new Promise(resolve=>pendingPreferences.push(resolve));return {[key]:structuredClone(saved[key])}},async set(data){if(window.storageFails)throw new Error('Could not load friends. Please try again.');const changes={};for(const [key,value]of Object.entries(data))changes[key]={oldValue:saved[key],newValue:structuredClone(value)};Object.assign(saved,structuredClone(data));localStorage.setItem('saved',JSON.stringify(saved));storageListeners.forEach(fn=>fn(changes,'local'));}},onChanged:{addListener:fn=>storageListeners.push(fn)}}};
      window.RobloxCustomizerRuntime={sendMessage:(...args)=>chrome.runtime.sendMessage(...args),onResume:fn=>resume.push(fn)};
      window.fetch=async(value,options={})=>{
        const url=new URL(value);requests.push(url.href);
        if(failure&&url.hostname==='friends.roblox.com')return {ok:false};
        if(url.hostname==='presence.roblox.com'){
          const id=JSON.parse(options.body).userIds[0];
          if(window.holdActivity)await new Promise(resolve=>{window.releaseActivity=resolve});
          return {ok:true,json:async()=>({userPresences:[presences[id]||{userId:id,userPresenceType:0}]})};
        }
        const data=url.pathname==='/v1/users/authenticated'?{id:account}:url.hostname==='friends.roblox.com'?{PageItems:url.searchParams.has('cursor')?roster.slice(50):roster.slice(0,50),NextCursor:url.searchParams.has('cursor')?null:'next'}:{data:[]};
        return {ok:true,json:async()=>data};
      };
      document.querySelector('#native-friends').onclick=()=>nativeClicks++;
      window.showFriends=(owner=100)=>{history.pushState({},'', '/ja/users/'+(owner?owner+'/':'')+'friends#!/friends');document.documentElement.setAttribute('data-rc-ui-active','');document.documentElement.setAttribute('data-rc-frost-page','friends');document.querySelector('#content').innerHTML='<div id="friends-web-app"><div class="friends-content"><div class="container-header"><div class="friends-subtitle"><h2>Friends</h2></div><div class="friends-filter"><input class="friends-filter-searchbar-container" aria-label="Filter friends" placeholder="Filter friends"></div></div><div class="friends-list-container">'+roster.slice(0,4).map(friend=>'<div class="avatar-card-container"><a href="/users/'+friend.id+'/profile">'+friend.displayName+'</a><button class="native-chat" onclick="nativeClicks++">Chat</button></div>').join('')+'</div></div></div>';dispatchEvent(new PopStateEvent('popstate'));};
      window.showHome=()=>{history.pushState({},'', '/ja/home');document.documentElement.removeAttribute('data-rc-ui-active');document.documentElement.removeAttribute('data-rc-frost-page');document.querySelector('#content').innerHTML='<div id="HomeContainer"><h1>Home</h1><section class="friend-carousel-container">Native friends</section></div>';dispatchEvent(new PopStateEvent('popstate'));};
      window.showProfile=(id,legacy=false)=>{history.pushState({},'', '/ja/users/'+id+'/profile');const actions='<button class="native-profile-button" onclick="nativeClicks++">Chat</button><button class="native-profile-button" onclick="nativeClicks++">Connections</button>';document.querySelector('#content').innerHTML=legacy?'<div id="profile-header-container"><h1>Player '+id+'</h1><div class="profile-header-buttons">'+actions+'</div></div>':'<div id="user-profile-header-bg"><div class="user-profile-header"><h1 id="profile-header-title-container-name">Player '+id+'</h1><div class="buttons-show-on-desktop"><div class="button-container">'+actions+'</div></div><div class="buttons-show-on-mobile"><div class="button-container">'+actions+'</div></div></div></div>';dispatchEvent(new PopStateEvent('popstate'));};
      const initialProfile=location.pathname.split('/'),userIndex=initialProfile.indexOf('users');if(userIndex>=0&&initialProfile[userIndex+2]==='profile')showProfile(Number(initialProfile[userIndex+1]));
    </script>${[...(settings ? settingsScripts : []), ...scripts].map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}
test('friends can be pinned from the Home picker and native list, with account isolation, localization and outside dismissal',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const assets = new Set([...scripts, ...styles]);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'pinned-friends');
    const url = `http://127.0.0.1:${server.address().port}/ja/home`;
    await browser.send('Page.navigate', { url }); await waitForDocument(browser, '#rc-pinned-friends');
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friends').nextElementSibling.matches('.friend-carousel-container')"), true);
    assert.equal(await browser.evaluate("requests.filter(url=>url.includes('friends.roblox.com')).length"), 0);
    await browser.click('#native-friends'); assert.equal(await browser.evaluate('nativeClicks'), 1);
    await browser.click('#rc-pinned-friends .rc-pinned-friends-header button');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends-dialog li').length===48");
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog h2').textContent"), 'ピン留めしたフレンドを管理');
    await browser.click('#rc-pinned-friends-dialog button[data-user-id="1"]');
    await browser.waitFor("document.querySelector('#rc-pinned-friends li')?.dataset.userId==='1'");
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friends strong').textContent"), 'Friends', 'User display names are never translated');
    await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog input').value='friend65';document.querySelector('#rc-pinned-friends-dialog input').dispatchEvent(new Event('input',{bubbles:true}))");
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends-dialog li').length===1");
    await browser.click('#rc-pinned-friends-dialog button[data-user-id="65"]');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===2");
    await browser.clickAt({ x: 2, y: 2 });
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog').open"), false, 'Blank area closes the picker');
    await browser.send('Page.reload'); await waitForDocument(browser, '#rc-pinned-friends');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===2");
    // The native service calls run only on real user clicks, never on hover or script-generated clicks.
    await browser.click('#rc-pinned-friends li[data-user-id="1"] > a');
    await browser.evaluate("window.liveChatControl=document.querySelector('#rc-pinned-friend-menu [data-rc-friend-action=chat]');liveChatControl.focus();window.liveSummaryHeight=document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-summary').getBoundingClientRect().height");
    await browser.waitFor("document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-join')?.getAttribute('aria-disabled')==='false'");
    assert.equal(await browser.evaluate('document.activeElement===liveChatControl&&liveChatControl.isConnected'), true, 'Live activity updates preserve the focused native action control');
    assert.equal(await browser.evaluate("Math.abs(document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-summary').getBoundingClientRect().height-liveSummaryHeight)<1"), true, 'Loading activity does not resize the avatar and summary row beyond fractional animation rounding');
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-summary a').textContent"), 'be FAT!');
    for (const width of [1280, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.equal(await browser.evaluate("(()=>{const n=document.querySelector('#rc-pinned-friend-menu'),r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&n.scrollWidth<=n.clientWidth+1})()"), true, 'Friend actions fit the viewport');
      if (process.env.PINNED_FRIENDS_SCREENSHOTS) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(path.join(workspace, `.tmp-pinned-friend-menu-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.deepEqual(await browser.evaluate('nativeActions'), { chat: [], join: [] });
    await browser.click('#rc-pinned-friend-menu [data-rc-friend-action="chat"]');
    assert.deepEqual(await browser.evaluate('nativeActions.chat'), [{ userId: 1 }]);
    await browser.click('#rc-pinned-friend-menu .rc-friend-menu-join');
    assert.deepEqual(await browser.evaluate('nativeActions.join'), [{ userId: 1, joinAttemptId: '11111111-2222-3333-4444-555555555555', joinAttemptOrigin: 'JoinUser' }]);
    await browser.evaluate("document.querySelector('#rc-pinned-friend-menu [data-rc-friend-action=chat]').click()");
    assert.equal(await browser.evaluate('nativeActions.chat.length'), 1);
    await browser.evaluate('chatFails=true');
    await browser.click('#rc-pinned-friend-menu [data-rc-friend-action="chat"]');
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-status').getAttribute('role')"), 'alert');
    await browser.evaluate('chatFails=false');
    await browser.clickAt({ x: 2, y: 2 });
    await browser.waitFor("!document.querySelector('#rc-pinned-friend-menu').matches(':popover-open')");
    await browser.click('#rc-pinned-friends li[data-user-id="65"] > a');
    await browser.waitFor("document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-summary a')?.textContent==='Private experience'");
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-join').hasAttribute('href')"), false, 'Hidden game info cannot launch a fabricated server');
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-profile').pathname"), '/users/65/profile');
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.waitFor("!document.querySelector('#rc-pinned-friend-menu').matches(':popover-open')");
    // Hover opens without launching anything; a rapid move cannot apply the previous friend's data.
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    await browser.evaluate("window.hoverPoint=(()=>{const r=document.querySelector('#rc-pinned-friends li[data-user-id=\"1\"] > a').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()");
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...await browser.evaluate('hoverPoint') });
    await browser.waitFor("document.querySelector('#rc-pinned-friend-menu').matches(':popover-open')&&document.querySelector('#rc-pinned-friend-menu').dataset.userId==='1'");
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2 });
    await browser.waitFor("!document.querySelector('#rc-pinned-friend-menu').matches(':popover-open')");
    await browser.evaluate("(()=>{holdActivity=true;const next=structuredClone(saved.rcPinnedFriends);next.accounts[0].friends.push({userId:3,name:'Friend3',displayName:'Offline friend',imageUrl:''});return chrome.storage.local.set({rcPinnedFriends:next})})()");
    await browser.waitFor("!!document.querySelector('#rc-pinned-friends li[data-user-id=\"3\"]')");
    await browser.click('#rc-pinned-friends li[data-user-id="3"] > a');
    await browser.waitFor("typeof releaseActivity==='function'");
    await browser.click('#rc-pinned-friends li[data-user-id="1"] > a');
    await browser.evaluate('holdActivity=false;releaseActivity()');
    await browser.waitFor("document.querySelector('#rc-pinned-friend-menu').dataset.userId==='1'&&document.querySelector('#rc-pinned-friend-menu .rc-friend-menu-summary a')?.textContent==='be FAT!'");
    await browser.evaluate("(()=>{const next=structuredClone(saved.rcPinnedFriends);next.accounts[0].friends=next.accounts[0].friends.filter(f=>f.userId!==3);return chrome.storage.local.set({rcPinnedFriends:next})})()");
    await browser.clickAt({ x: 2, y: 2 });
    await browser.evaluate('showFriends(null)');
    await browser.waitFor("document.querySelectorAll('.rc-friend-pin-compact').length===4");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-pinned-friends button').length===1&&!document.querySelector('#rc-pinned-friends h2, #rc-pinned-friends p, #rc-pinned-friends ul')"), true, 'Friends page only keeps the management button');
    assert.equal(await browser.evaluate("(()=>{const style=getComputedStyle(document.querySelector('#rc-pinned-friends'));return style.backgroundColor==='rgba(0, 0, 0, 0)'&&style.borderTopWidth==='0px'&&style.paddingTop==='0px'})()"), true, 'Management button has no surrounding panel');
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friends').parentElement.matches('.friends-content > .container-header')"), true, 'Management button belongs to the native title and search toolbar');
    for (const width of [1280, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.equal(await browser.evaluate("(()=>{const title=document.querySelector('.friends-subtitle').getBoundingClientRect(),button=document.querySelector('#rc-pinned-friends button').getBoundingClientRect(),filter=document.querySelector('.friends-filter').getBoundingClientRect();return title.left<button.left&&Math.min(title.bottom,button.bottom)>Math.max(title.top,button.top)&&button.right<=innerWidth&&document.documentElement.scrollWidth<=innerWidth&&(innerWidth>767||filter.top>=Math.max(title.bottom,button.bottom))})()"), true, 'Title and management stay together without crowding search at '+width+'px');
      if (process.env.PINNED_FRIENDS_SCREENSHOTS) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(path.join(workspace, `.tmp-pinned-friends-toolbar-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.evaluate("document.querySelector('.friends-content > .container-header').outerHTML='<div class=\"container-header\"><div class=\"friends-subtitle\"><h2>Friends</h2></div><div class=\"friends-filter\"><input class=\"friends-filter-searchbar-container\" aria-label=\"Filter friends\"></div></div>'");
    await browser.waitFor("document.querySelectorAll('.friends-content > .container-header > #rc-pinned-friends').length===1");
    await browser.click('.rc-friend-pin-compact[data-user-id="2"]');
    await browser.waitFor("document.querySelector('.rc-friend-pin-compact[data-user-id=\"2\"]').getAttribute('aria-pressed')==='true'");
    await browser.click('.native-chat'); assert.equal(await browser.evaluate('nativeClicks'), 1);
    await browser.click('.rc-friend-pin-compact[data-user-id="1"]');
    await browser.waitFor("document.querySelector('.rc-friend-pin-compact[data-user-id=\"1\"]').getAttribute('aria-pressed')==='false'");
    await browser.click('#rc-pinned-friends .rc-pinned-friends-header button');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends-dialog li').length===48");
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog button[data-user-id=\"2\"]').getAttribute('aria-pressed')"), 'true', 'Management still shows friends pinned from the native list');
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog button[data-user-id=\"1\"]').getAttribute('aria-pressed')"), 'false');
    await browser.click('#rc-pinned-friends-dialog button[data-user-id="3"]');
    await browser.waitFor("document.querySelector('#rc-pinned-friends-dialog button[data-user-id=\"3\"]').getAttribute('aria-pressed')==='true'");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-pinned-friends ul')"), false, 'Changing pins does not recreate the Friends page cards');
    await browser.click('#rc-pinned-friends-dialog button[data-user-id="3"]');
    await browser.waitFor("document.querySelector('#rc-pinned-friends-dialog button[data-user-id=\"3\"]').getAttribute('aria-pressed')==='false'");
    await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog').close()");
    await browser.evaluate("document.querySelector('.avatar-card-container').innerHTML='<a href=\"/users/1/profile\">Friends</a><button class=\"native-chat\">Chat</button>'");
    await browser.waitFor("document.querySelectorAll('.rc-friend-pin-compact').length===4");
    await browser.evaluate("document.documentElement.setAttribute('data-rc-features-disabled','')");
    await browser.waitFor("!document.querySelector('#rc-pinned-friends')&&!document.querySelector('.rc-friend-pin-compact')");
    await browser.evaluate("document.documentElement.removeAttribute('data-rc-features-disabled')");
    await browser.waitFor("!!document.querySelector('#rc-pinned-friends')");
    await browser.evaluate('showFriends(999)');
    await browser.waitFor("!document.querySelector('#rc-pinned-friends')&&!document.querySelector('.rc-friend-pin-compact')");
    await browser.evaluate('account=200;showHome();resume.forEach(fn=>fn())');
    await browser.waitFor("document.querySelector('#rc-pinned-friends')&&!document.querySelector('#rc-pinned-friends li')");
    await browser.evaluate('account=100;resume.forEach(fn=>fn())');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===2");
    await browser.evaluate('account=200;showFriends(200)');
    await browser.waitFor("document.querySelector('#rc-pinned-friends')&&!document.querySelector('#rc-pinned-friends li')");
    await browser.evaluate('account=100;showHome()');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===2");
    await browser.evaluate("window.beforeRemote=structuredClone(saved.rcPinnedFriends);const next=structuredClone(beforeRemote);next.accounts.find(a=>a.userId===100).friends.push({userId:3,name:'Friend3',displayName:'Remote pin',imageUrl:''});chrome.storage.local.set({rcPinnedFriends:next})");
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===3");
    await browser.evaluate('chrome.storage.local.set({rcPinnedFriends:beforeRemote})');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===2");
    await browser.evaluate("document.querySelector('#rc-pinned-friends').remove()");
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===2");
    for (const width of [1280, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.click('#rc-pinned-friends .rc-pinned-friends-header button');
      await browser.waitFor("document.querySelectorAll('#rc-pinned-friends-dialog li').length===48");
      assert.equal(await browser.evaluate("document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#rc-pinned-friends-dialog, #rc-pinned-friends, .rc-pinned-friend')].every(n=>n.scrollWidth<=n.clientWidth+1)"), true, 'Long Japanese names and controls fit');
      if (process.env.PINNED_FRIENDS_SCREENSHOTS) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(path.join(workspace, `.tmp-pinned-friends-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
      await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog').close()");
    }
    // Idle or native hover DOM updates do not fetch/rebuild the roster repeatedly.
    const count = await browser.evaluate('requests.length');
    await browser.evaluate("for(let i=0;i<50;i++){const n=document.createElement('div');n.textContent='tooltip';document.body.append(n);n.remove()}");
    await pause(250); assert.equal(await browser.evaluate('requests.length'), count);
    assert.deepEqual(browser.errors, []);
  });

test('Home settings hide native and pinned friends independently without deleting pins',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const assets = new Set([...scripts, ...styles, ...settingsScripts, ...settingsStyles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture({ nested: true, settings: true }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'home-friends-settings');
    const origin = `http://127.0.0.1:${server.address().port}`;
    await browser.send('Page.navigate', { url: origin+'/ja/home' });
    await waitForDocument(browser, '#rc-pinned-friends');
    await browser.click('#rc-pinned-friends .rc-pinned-friends-header button');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends-dialog li').length===48");
    await browser.click('#rc-pinned-friends-dialog button[data-user-id="1"]');
    await browser.waitFor("document.querySelector('#rc-pinned-friends li')?.dataset.userId==='1'");
    await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog').close();window.originalFriends=document.querySelector('.friend-carousel-container')");
    const pins = await browser.evaluate('JSON.stringify(saved.rcPinnedFriends)');
    await browser.click('#rc-pinned-friends li[data-user-id="1"] > a');
    await browser.waitFor("document.querySelector('#rc-pinned-friend-menu')?.matches(':popover-open')");
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-show-home-friends')");
    await browser.click('.rc-settings-nav-button[data-rc-settings-category="home"]');
    assert.equal(await browser.evaluate("document.querySelector('#rc-show-home-friends').checked&&document.querySelector('#rc-show-pinned-friends').checked"), true);
    await browser.click('#rc-show-pinned-friends');
    await browser.waitFor("saved.customBackground.showPinnedFriends===false&&!document.querySelector('#HomeContainer #rc-pinned-friends')");
    assert.equal(await browser.evaluate("originalFriends===document.querySelector('.friend-carousel-container')&&originalFriends.checkVisibility()"), true);
    assert.equal(await browser.evaluate("document.querySelector('#rc-pinned-friend-menu').matches(':popover-open')"), false);
    await browser.click('#rc-show-home-friends');
    await browser.waitFor("saved.customBackground.showHomeFriends===false&&!originalFriends.checkVisibility()");
    assert.equal(await browser.evaluate("document.querySelector('#rc-friend-rows').disabled"), true);
    assert.equal(await browser.evaluate('JSON.stringify(saved.rcPinnedFriends)'), pins);
    for (const locale of ['en','zh-CN','zh-TW','id','ja','th','ko']) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
      await browser.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      assert.equal(await browser.evaluate("document.querySelector('label[for=rc-show-pinned-friends]').textContent.trim()===RobloxCustomizerI18n.t('Show pinned friends')"), true);
      assert.equal(await browser.evaluate("(()=>{const n=document.querySelector('.rc-settings-friends');return n.scrollWidth<=n.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth})()"), true, 'Settings labels fit in '+locale);
    }
    if (process.env.HOME_FRIENDS_SCREENSHOT) {
      await browser.evaluate("RobloxCustomizerI18n.setLanguage('zh-CN');document.querySelector('.rc-settings-friends').scrollIntoView({block:'center'})");
      const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(process.env.HOME_FRIENDS_SCREENSHOT, Buffer.from(shot.data, 'base64'));
    }
    await browser.send('Page.navigate', { url: origin+'/ja/home?slow' });
    await waitForDocument(browser, '#HomeContainer');
    assert.equal(await browser.evaluate("holdPreferences&&!document.querySelector('#HomeContainer #rc-pinned-friends')&&!document.querySelector('.friend-carousel-container').checkVisibility()"), true, 'Startup cache hides both sections while extension storage is delayed');
    assert.equal(await browser.evaluate("requests.some(url=>url.includes('users/authenticated'))"), false, 'Hidden Home pins do not load friend data');
    await browser.evaluate('releasePreferences()');
    await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
    await browser.evaluate('showFriends(null)');
    await browser.waitFor("!!document.querySelector('#friends-web-app #rc-pinned-friends')");
    await browser.evaluate('showProfile(1)');
    await browser.waitFor("!!document.querySelector('.rc-friend-pin-profile')");
    await browser.evaluate('showHome()');
    await browser.waitFor("!document.querySelector('#HomeContainer #rc-pinned-friends')");
    await browser.evaluate('chrome.storage.local.set({customBackground:{...saved.customBackground,showPinnedFriends:true}})');
    await browser.waitFor("document.querySelector('#rc-pinned-friends li')?.dataset.userId==='1'");
    assert.equal(await browser.evaluate("document.querySelector('.friend-carousel-container').checkVisibility()"), false);
    await browser.evaluate('chrome.storage.local.set({customBackground:{...saved.customBackground,showHomeFriends:true}})');
    await browser.waitFor("document.querySelector('.friend-carousel-container').checkVisibility()");
    assert.equal(await browser.evaluate('JSON.stringify(saved.rcPinnedFriends)'), pins);
    assert.deepEqual(browser.errors, []);
  });

test('Home pins keep a stable position beside a nested native friends carousel',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const assets = new Set([...scripts, ...styles]);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture({ nested: true }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'home-pinned-friends-stability');
    await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/ja/home` });
    await waitForDocument(browser, '#rc-pinned-friends');
    await browser.click('#rc-pinned-friends .rc-pinned-friends-header button');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends-dialog li').length===48");
    await browser.click('#rc-pinned-friends-dialog button[data-user-id="1"]');
    await browser.waitFor("document.querySelector('#rc-pinned-friends li')?.dataset.userId==='1'");
    await browser.evaluate("document.querySelector('#rc-pinned-friends-dialog').close();window.nativeCarousel=document.querySelector('.friend-carousel-container')");
    for (const width of [1280, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false });
      const positions = await browser.evaluate(`(async()=>{
        await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
        const samples=[];
        for(let frame=0;frame<20;frame++){
          await new Promise(requestAnimationFrame);
          const section=document.querySelector('#rc-pinned-friends'),native=document.querySelector('.friend-carousel-container');
          samples.push({parent:section.parentElement.id,top:section.getBoundingClientRect().top,nativeTop:native.getBoundingClientRect().top,height:document.documentElement.scrollHeight});
        }
        return samples;
      })()`);
      assert.deepEqual([...new Set(positions.map(sample => sample.parent))], ['native-friends-wrapper'], 'Pins stay inside the native carousel parent');
      for (const key of ['top', 'nativeTop', 'height']) assert.ok(Math.max(...positions.map(sample => sample[key])) - Math.min(...positions.map(sample => sample[key])) < 1, key+' remains stable at '+width+'px');
    }
    const changes = await browser.evaluate(`(async()=>{
      const section=document.querySelector('#rc-pinned-friends');let moves=0;
      const observer=new MutationObserver(records=>{for(const record of records)if([...record.addedNodes,...record.removedNodes].includes(section))moves++});
      observer.observe(document.querySelector('#HomeContainer'),{childList:true,subtree:true});
      for(let frame=0;frame<12;frame++){
        const marker=document.createElement('div');marker.textContent='Native update';document.body.append(marker);marker.remove();
        resume.forEach(listener=>listener());await new Promise(requestAnimationFrame);
      }
      observer.disconnect();return {moves,nativePreserved:nativeCarousel===document.querySelector('.friend-carousel-container')};
    })()`);
    assert.equal(changes.moves, 0, 'Idle syncs and native updates do not move the Home section');
    assert.equal(changes.nativePreserved, true);
    assert.deepEqual(browser.errors, []);
  });

test('profile pin buttons use native actions and sync with Home across redraws, devices and accounts',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const assets = new Set([...scripts, ...styles]);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'profile-pinned-friends');
    await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/ja/users/1/profile` });
    const desktop = '.buttons-show-on-desktop .rc-friend-pin-profile', mobile = '.buttons-show-on-mobile .rc-friend-pin-profile';
    await waitForDocument(browser, desktop);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await browser.evaluate("document.querySelectorAll('.rc-friend-pin-profile').length"), 2, 'Both original responsive action rows get the control');
    assert.equal(await browser.evaluate(`document.querySelector('${desktop}').classList.contains('native-profile-button')`), true);
    assert.equal(await browser.evaluate(`document.querySelector('${desktop}').textContent`), 'フレンドをピン留め');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-pinned-friends')"), false, 'Profile uses its original action area');
    await browser.click(desktop);
    await browser.waitFor(`document.querySelector('${desktop}').getAttribute('aria-pressed')==='true'&&!document.querySelector('${desktop}').disabled`);
    assert.equal(await browser.evaluate(`document.activeElement===document.querySelector('${desktop}')`), true, 'Saving does not replace the focused profile button');
    assert.equal(await browser.evaluate(`document.querySelector('${desktop}').textContent`), 'ピン留めを解除');
    assert.deepEqual(await browser.evaluate('saved.rcPinnedFriends.accounts[0].friends.map(friend=>friend.userId)'), [1]);
    assert.equal(await browser.evaluate(`document.querySelector('${mobile}').getAttribute('aria-pressed')`), 'true');
    await browser.click('.buttons-show-on-desktop .native-profile-button:not(.rc-friend-pin-profile)');
    assert.equal(await browser.evaluate('nativeClicks'), 1, 'Original action handlers are preserved');
    await browser.send('Page.reload'); await waitForDocument(browser, desktop);
    await browser.waitFor(`document.querySelector('${desktop}').getAttribute('aria-pressed')==='true'`);
    await browser.evaluate('showHome()');
    await browser.waitFor("document.querySelector('#rc-pinned-friends li')?.dataset.userId==='1'");
    await browser.evaluate('showProfile(1)'); await browser.waitFor(`!!document.querySelector('${desktop}')`);
    await browser.evaluate("document.querySelector('.buttons-show-on-desktop .button-container').innerHTML='<button class=\"native-profile-button\">Chat</button>'");
    await browser.waitFor(`document.querySelectorAll('${desktop}').length===1&&document.querySelector('${desktop}').getAttribute('aria-pressed')==='true'`);
    for (const width of [1280, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      const selector = width === 320 ? mobile : desktop;
      assert.equal(await browser.evaluate(`(()=>{const n=document.querySelector('${selector}'),r=n.getBoundingClientRect();return r.width>0&&r.height>=40&&r.left>=0&&r.right<=innerWidth&&n.scrollWidth<=n.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth})()`), true, 'Native profile control fits at '+width+'px');
      if (process.env.PINNED_FRIENDS_SCREENSHOTS) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        fs.writeFileSync(path.join(workspace, `.tmp-profile-pinned-friend-${width}.png`), Buffer.from(shot.data, 'base64'));
      }
    }
    await browser.click(mobile);
    await browser.waitFor(`document.querySelector('${mobile}').getAttribute('aria-pressed')==='false'`);
    await browser.evaluate('storageFails=true');
    await browser.click(mobile);
    await browser.waitFor("!document.querySelector('.buttons-show-on-mobile .rc-profile-pin-error').hidden");
    assert.equal(await browser.evaluate(`document.querySelector('${mobile}').getAttribute('aria-pressed')`), 'false', 'A failed pin never appears saved');
    await browser.evaluate('storageFails=false');
    await browser.click(mobile);
    await browser.waitFor(`document.querySelector('${mobile}').getAttribute('aria-pressed')==='true'`);
    await browser.evaluate('account=200;resume.forEach(fn=>fn())');
    await browser.waitFor(`document.querySelector('${mobile}')?.getAttribute('aria-pressed')==='false'`);
    await browser.evaluate('account=100;resume.forEach(fn=>fn())');
    await browser.waitFor(`document.querySelector('${mobile}')?.getAttribute('aria-pressed')==='true'`);
    await browser.evaluate("document.documentElement.setAttribute('data-rc-features-disabled','')");
    await browser.waitFor("!document.querySelector('.rc-friend-pin-profile')");
    await browser.evaluate("document.documentElement.removeAttribute('data-rc-features-disabled')");
    await browser.waitFor(`!!document.querySelector('${mobile}')`);
    await browser.evaluate('showProfile(2,true)');
    await browser.waitFor("!!document.querySelector('.profile-header-buttons .rc-friend-pin-profile')");
    assert.equal(await browser.evaluate("(()=>{const n=document.querySelector('.profile-header-buttons .rc-friend-pin-profile'),r=n.getBoundingClientRect();return r.width>0&&r.right<=innerWidth&&n.scrollWidth<=n.clientWidth+1})()"), true, 'The legacy profile also fits a narrow screen');
    await browser.click('.profile-header-buttons .rc-friend-pin-profile');
    await browser.waitFor("document.querySelector('.profile-header-buttons .rc-friend-pin-profile').getAttribute('aria-pressed')==='true'");
    await browser.evaluate('showProfile(999)');
    await browser.waitFor("!document.querySelector('.rc-friend-pin-profile')");
    await browser.evaluate("history.pushState({},'', '/ja/users/2/profile');document.querySelector('#profile-header-title-container-name').textContent='Player 2';void 0");
    await browser.waitFor(`document.querySelector('${mobile}')?.dataset.userId==='2'&&document.querySelector('${mobile}').getAttribute('aria-pressed')==='true'`);
    await browser.evaluate('showProfile(100)');
    await browser.waitFor("!document.querySelector('.rc-friend-pin-profile')");
    await browser.evaluate('showHome()');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends li').length===2");
    const count = await browser.evaluate('requests.length');
    await browser.evaluate("for(let i=0;i<20;i++){const n=document.createElement('div');n.textContent='tooltip';document.body.append(n);n.remove()}");
    await pause(250); assert.equal(await browser.evaluate('requests.length'), count);
    assert.deepEqual(browser.errors, []);
  });
