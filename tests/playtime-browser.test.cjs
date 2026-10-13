const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/runtime.js', 'src/shared/native-labels.js', 'src/shared/i18n.js', 'src/shared/startup.js',
  'src/settings/settings.js', 'src/playtime/playtime-core.js', 'src/playtime/playtime.js'];
function fixture(pathname = '/home') {
  const placeId = Number(pathname.match(/^\/games\/(\d+)(?:\/|$)/)?.[1]);
  const content = placeId ? `<main id="content" style="width:min(1100px,calc(100% - 32px));margin:24px auto">
    <div id="game-detail-page" data-place-id="${placeId}"><input type="hidden" id="game-detail-meta-data" data-place-id="${placeId}" data-universe-id="100">
    <div class="game-main-content"><div id="game-details-carousel-container" style="aspect-ratio:16/9;background:linear-gradient(135deg,#3a93ba,#436536)"></div>
    <div class="game-calls-to-action"><div class="game-title-container"><h1 class="game-name">[LIMITED 🏎️] Mega Mansion 2 🌴</h1>
    <div class="game-creator"><span class="text-label">By</span><a href="#creator" class="text-name">Wild Atelier ✓</a></div>
    <div id="game-age-recommendation-container"><span>Maturity: Minimal</span></div></div>
    <div class="game-buttons-container"><div id="game-details-play-button-container"><button type="button" class="btn-common-play-game-lg" onclick="window.nativePlayClicks=(window.nativePlayClicks||0)+1">Play</button></div>
    <ul class="favorite-follow-vote-share"><li class="rc-game-pin-control"><button id="rc-pin-game" type="button"><svg viewBox="0 0 24 24"><path d="m12 2 8 8-3 1-4 4v5l-5-5-4 1 4-4 1-3z"/></svg><span class="icon-label">Pin Game</span></button></li>
    <li class="game-favorite-button-container"><div class="favorite-button"><button id="toggle-game-favorite" type="button" onclick="window.nativeFavoriteClicks=(window.nativeFavoriteClicks||0)+1"><span class="icon-favorite">☆</span><span class="icon-label">Favorite</span></button></div></li>
    <li class="game-follow-button-container"><div class="follow-button"><button type="button"><span class="icon-notifications-bell">♧</span><span class="icon-label">Notify</span></button></div></li>
    <li class="voting-panel"><div class="users-vote"><button type="button" class="upvote">👍</button><div class="vote-details"><div class="vote-container"><div class="vote-percentage"></div></div><div class="vote-numbers"><span class="count-left">11K+</span><span class="count-right">598</span></div></div><button type="button" class="downvote">👎</button></div></li></ul>
    </div></div></div>
    <section id="about"><h2>Description</h2><p>Build the mansions of your dreams.</p></section></div></main>`
    : '<main id="HomeContainer"><div class="friend-carousel-container">Friends</div><section id="rc-pinned-games">Pinned games</section></main>';
  return `<!doctype html><html lang="en" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:0;font:16px/1.5 Arial;background:linear-gradient(120deg,#962743,#284e78);min-height:100vh;color:white}button{font:inherit}#HomeContainer{max-width:1100px;margin:auto;padding:20px}#settings-popover-menu{position:fixed;right:16px;top:0;z-index:1000}img{max-width:100%}
    /* Roblox StyleGuide headings include vertical padding, unlike dt labels. */
    h1,h2,h3,h4,h5{margin:0;padding:5px 0;line-height:1.4em}
    .vote-container{position:absolute;top:30px;left:0;right:0;background:#fff9}.vote-percentage{height:100%;width:92%;background:#4772ff}.vote-numbers{position:absolute;top:32px;left:0;right:0;transform:translateY(-6px)}
    .favorite-follow-vote-share{list-style:none}.favorite-follow-vote-share button{border:0;background:transparent;color:inherit;cursor:pointer}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme">
    <ul id="settings-popover-menu" role="menu"><li><a href="/my/account">Settings</a></li></ul>
    ${content}
    <script>
      const listeners=[];
      window.saved={customBackground:{source:'none',glassBlur:23,glassOpacity:62}};
      window.playtimeRequests=[];
      window.setSaved=async patch=>{const changes={};for(const [key,value] of Object.entries(patch)){changes[key]={oldValue:saved[key],newValue:value};saved[key]=structuredClone(value)}listeners.forEach(fn=>fn(changes,'local'))};
      window.makeHistory=()=>({version:1,currentUserId:123,accounts:[{userId:123,name:'Player',displayName:'Player',games:Array.from({length:27},(_,i)=>({universeId:100+i,placeId:200+i,name:i===0?'<img src=x onerror=alert(1)> English 简体中文 繁體中文 LongGameTitleLongGameTitleLongGameTitle':i===1?'中文冒险':'Game '+i,iconUrl:'https://tr.rbxcdn.com/playtime-fixture-'+i,totalMs:(i+1)*60000,sessions:i+1,firstPlayedAt:1800000000000,lastPlayedAt:1800000000000+i*60000,metadataCheckedAt:1800000000000}))}],active:null,status:{kind:'idle',checkedAt:1800000000000}});
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,structuredClone(saved[key])]))},set:setSaved},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){queueMicrotask(async()=>{
        if(message.type!=='rc-playtime'){callback({id:123,name:'Player',displayName:'Shadows_Lunarfox'});return}
        playtimeRequests.push(message.action);
        if(message.action==='set-enabled')await setSaved({playtimeTrackingEnabled:message.enabled});
        if(message.action==='clear'){if(message.userId!==saved.rcPlaytimeHistory?.currentUserId){callback({ok:false,error:'account-changed'});return}await setSaved({rcPlaytimeHistory:RobloxCustomizerPlaytime.normalize(null)})}
        callback(RobloxCustomizerPlaytime.snapshot(saved.rcPlaytimeHistory,saved.playtimeTrackingEnabled!==false));
      })}}};
      window.exported=null;
      const makeObjectURL=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.exportBlob=blob;return makeObjectURL(blob)};
      HTMLAnchorElement.prototype.click=function(){window.exported={download:this.download,href:this.href}};
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}
async function serve(t) {
  const assets = new Set([...styles, ...scripts, 'icons/icon-128.png']);
  const server = http.createServer((request, response) => {
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
    response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture(`/${file}`));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
async function icons(browser) {
  browser.socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method !== 'Fetch.requestPaused') return;
    const index = Number(message.params.request.url.match(/fixture-(\d+)/)?.[1] || 0);
    const art = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="hsl(${index * 47 % 360},65%,40%)"/><stop offset="1" stop-color="#151c36"/></linearGradient></defs><rect width="150" height="150" fill="url(#g)"/><circle cx="75" cy="65" r="36" fill="white" opacity=".12"/><text x="75" y="84" font-family="Arial" font-size="42" font-weight="bold" text-anchor="middle" fill="white">${index}</text></svg>`;
    browser.send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }], body: Buffer.from(art).toString('base64') }).catch(() => {});
  });
  await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://tr.rbxcdn.com/*' }] });
}

test('Game pages show only this experience’s local playtime and last-played time across updates, accounts and SPA remounts',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serve(t), browser = await isolatedChrome(t, 'playtime-game-page');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.navigate', { url: `${origin}/games/71394819414417/Mega-Mansion-2` });
    await waitForDocument(browser, '#rc-playtime-game-page');
    const panel = () => browser.evaluate(`(()=>{const p=document.querySelector('#rc-playtime-game-page');return p?{
      parent:p.parentElement.className,total:p.querySelector('.rc-playtime-game-total').textContent,
      last:p.querySelector('time').textContent,iso:p.querySelector('time').getAttribute('datetime'),
      playing:!p.querySelector('.rc-playtime-playing').hidden,enable:!p.querySelector('button').hidden,
      hint:p.querySelector('.rc-playtime-hint').textContent}:null})()`);
    let state = await panel();
    assert.equal(state.enable, false, 'A fresh install already has tracking enabled');
    await browser.evaluate('setSaved({playtimeTrackingEnabled:false})');
    await browser.waitFor('!document.querySelector(".rc-playtime-game-enable").hidden');
    state = await panel();
    assert.equal(state.parent, 'game-main-content');
    assert.equal(state.total, 'Not recorded yet'); assert.equal(state.last, 'Not recorded yet');
    assert.equal(state.iso, null); assert.equal(state.enable, true);
    await browser.click('.rc-playtime-game-enable');
    await browser.waitFor('saved.playtimeTrackingEnabled && document.querySelector(".rc-playtime-game-enable").hidden');
    assert.equal((await panel()).total, 'Not recorded yet', 'Opening a game page never creates a played session');
    await browser.evaluate(`(()=>{const h=makeHistory();h.accounts[0].games=h.accounts[0].games.slice(0,2);
      Object.assign(h.accounts[0].games[0],{placeId:71394819414417,totalMs:125000,lastPlayedAt:1800000125000});
      Object.assign(h.accounts[0].games[1],{totalMs:3600000,lastPlayedAt:1800003600000});
      h.accounts.push({userId:456,name:'Other account',games:[{...h.accounts[0].games[0],totalMs:7200000}]});
      h.active={userId:123,universeId:100,observedAt:1800000125000,browserSessionId:'test'};
      h.status={kind:'tracking',checkedAt:1800000125000};return setSaved({rcPlaytimeHistory:h})})()`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total").textContent==="2m 5s"');
    state = await panel();
    assert.equal(state.playing, true); assert.equal(state.iso, new Date(1800000125000).toISOString());
    assert.equal(state.last, await browser.evaluate("new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short'}).format(1800000125000)"));
    await browser.click('.btn-common-play-game-lg');
    assert.equal(await browser.evaluate('nativePlayClicks'), 1, 'Native play control keeps its original action');
    await browser.evaluate(`(()=>{window.originalGamePanel=document.querySelector('#rc-playtime-game-page');
      window.gamePanelWrites=0;window.gamePanelObserver=new MutationObserver(records=>gamePanelWrites+=records.length);
      gamePanelObserver.observe(originalGamePanel,{childList:true,subtree:true,attributes:true,characterData:true});
      const popup=document.createElement('div');popup.className='popover';popup.innerHTML='<span>Chat</span>';document.body.append(popup);
      return new Promise(resolve=>setTimeout(()=>{popup.firstChild.textContent='View Profile';popup.remove();setTimeout(resolve,80)},80))})()`);
    assert.equal(await browser.evaluate('gamePanelWrites'), 0, 'Hover portals do not rewrite playtime');
    await browser.evaluate(`(()=>{gamePanelObserver.disconnect();const h=structuredClone(saved.rcPlaytimeHistory);
      h.accounts[0].games[0].totalMs=185000;h.accounts[0].games[0].lastPlayedAt=1800000185000;return setSaved({rcPlaytimeHistory:h})})()`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total").textContent==="3m 5s"');
    assert.equal(await browser.evaluate("originalGamePanel===document.querySelector('#rc-playtime-game-page')"), true);
    assert.equal((await panel()).iso, new Date(1800000185000).toISOString());
    await browser.evaluate('setSaved({playtimeTrackingEnabled:false})');
    await browser.waitFor('!document.querySelector(".rc-playtime-game-enable").hidden');
    state = await panel(); assert.equal(state.total, '3m 5s'); assert.equal(state.playing, false); assert.match(state.hint, /paused/);
    for (const [locale, title, total] of [['zh-CN','您的游戏时长','3分5秒'],['zh-TW','您的遊戲時長','3分5秒'],['en','Your playtime','3m 5s']]) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      assert.equal(await browser.evaluate('document.querySelector("#rc-playtime-game-title").textContent'), title);
      assert.equal((await panel()).total, total);
      assert.equal((await panel()).last, await browser.evaluate(`new Intl.DateTimeFormat(${JSON.stringify(locale)},{dateStyle:'medium',timeStyle:'short'}).format(1800000185000)`));
    }
    // Changing only the route must not momentarily attribute the old game's record to a new page.
    await browser.evaluate("history.pushState({},'', '/games/201/Other');dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("!document.querySelector('#rc-playtime-game-page')");
    await browser.evaluate(`document.querySelector('#game-detail-page').dataset.placeId='201';
      Object.assign(document.querySelector('#game-detail-meta-data').dataset,{placeId:'201',universeId:'101'})`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total")?.textContent==="1h 0m"');
    assert.equal((await panel()).iso, new Date(1800003600000).toISOString());
    await browser.evaluate(`history.pushState({},'', '/games/999/Subplace');document.querySelector('#game-detail-page').dataset.placeId='999';
      Object.assign(document.querySelector('#game-detail-meta-data').dataset,{placeId:'999',universeId:'100'})`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total")?.textContent==="3m 5s"');
    await browser.evaluate(`(()=>{const h=structuredClone(saved.rcPlaytimeHistory);h.currentUserId=456;return setSaved({rcPlaytimeHistory:h})})()`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total").textContent==="2h 0m"');
    await browser.evaluate(`(()=>{const h=structuredClone(saved.rcPlaytimeHistory);h.currentUserId=123;return setSaved({rcPlaytimeHistory:h})})()`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total").textContent==="3m 5s"');
    await browser.evaluate("document.querySelector('#game-detail-page').replaceWith(document.querySelector('#game-detail-page').cloneNode(true))");
    await browser.waitFor('document.querySelectorAll("#rc-playtime-game-page").length===1 && document.querySelector(".rc-playtime-game-total").textContent==="3m 5s"');
    await browser.evaluate(`history.pushState({},'', '/games/71394819414417/Mega-Mansion-2');
      document.querySelector('#game-detail-page').dataset.placeId='71394819414417';
      Object.assign(document.querySelector('#game-detail-meta-data').dataset,{placeId:'71394819414417',universeId:''})`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total")?.textContent==="3m 5s"');
    await browser.evaluate("document.querySelector('#game-detail-meta-data').dataset.universeId='9999'");
    await browser.waitFor('document.querySelector(".rc-playtime-game-total").textContent==="Not recorded yet"');
    assert.equal((await panel()).iso, null, 'A different known universe cannot inherit a record by its place ID');
    await browser.evaluate("history.pushState({},'', '/home');document.body.append(document.createElement('div'))");
    await browser.waitFor("!document.querySelector('#rc-playtime-game-page')");
    assert.deepEqual(browser.errors, []);
  });

test('Game header balances title, media, native actions and a full-width playtime footer across themes and locales',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serve(t), browser = await isolatedChrome(t, 'playtime-game-themes');
    await browser.send('Page.navigate', { url: `${origin}/games/71394819414417/Mega-Mansion-2` });
    await waitForDocument(browser, '#rc-playtime-game-page');
    await browser.evaluate(`(()=>{const h=makeHistory();h.active={userId:123,universeId:100,
      observedAt:1800000000000,browserSessionId:'test'};h.status={kind:'tracking',checkedAt:1800000000000};
      return setSaved({rcPlaytimeHistory:h,playtimeTrackingEnabled:true})})()`);
    await browser.waitFor('document.querySelector(".rc-playtime-game-total").textContent==="1m" && !document.querySelector(".rc-playtime-playing").hidden');
    await browser.evaluate(`window.nativeTitle=document.querySelector('.game-title-container');
      window.nativeActions=document.querySelector('.game-buttons-container');window.nativeMedia=document.querySelector('#game-details-carousel-container')`);
    for (const active of [false,true]) {
      await browser.evaluate(`setSaved({rcPlaytimeHistory:{...saved.rcPlaytimeHistory,active:${active
        ? "{userId:123,universeId:100,observedAt:1800000000000,browserSessionId:'test'}" : 'null'}}})`);
      await browser.waitFor(`document.querySelector('.rc-playtime-playing').hidden===${!active}`);
      for (const theme of ['light','dark']) for (const width of [1280,900,820,801,760,320]) for (const locale of ['en','zh-CN','zh-TW']) {
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        await browser.evaluate(`document.documentElement.className='${theme}-theme';document.body.className='${theme}-theme';RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
        const state = await browser.evaluate(`(()=>{const p=document.querySelector('#rc-playtime-game-page'),s=getComputedStyle(p),r=p.getBoundingClientRect();
          const rect=node=>{const b=node.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
          return{
          overflow:p.scrollWidth>p.clientWidth+1,contained:r.left>=0&&r.right<=innerWidth+1,text:s.color,blur:s.backdropFilter,
          title:rect(nativeTitle),media:rect(nativeMedia),actions:rect(nativeActions),footer:rect(p),
          header:rect(document.querySelector('.game-main-content')),
          actionPadding:getComputedStyle(nativeActions).paddingLeft,
          play:rect(document.querySelector('#game-details-play-button-container')),
          row:rect(document.querySelector('.favorite-follow-vote-share')),
          items:[...document.querySelectorAll('.favorite-follow-vote-share > li')].map(rect),
          bar:rect(document.querySelector('.vote-container')),numbers:rect(document.querySelector('.vote-numbers')),
          labels:[p.querySelector('h2'),...p.querySelectorAll('dt')].map(node=>{const range=document.createRange();range.selectNodeContents(node);
            return{box:rect(node),text:rect(range),size:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight}}),
          playing:rect(p.querySelector('.rc-playtime-playing')),
          hint:rect(p.querySelector('.rc-playtime-hint')),
          values:[...p.querySelectorAll('dd')].map(node=>({box:rect(node),size:getComputedStyle(node).fontSize,line:getComputedStyle(node).lineHeight})),
          nativePreserved:nativeTitle.parentElement.classList.contains('game-calls-to-action')&&nativeActions.parentElement===nativeTitle.parentElement,
          grid:getComputedStyle(p.querySelector('dl')).gridTemplateColumns.split(' ').length}})()`);
        assert.equal(state.overflow,false,`${theme}/${width}/${locale}`); assert.equal(state.contained,true,`${theme}/${width}/${locale}`);
        assert.equal(state.nativePreserved,true,'Native React nodes keep their original parent');
        assert.ok(Math.abs(state.title.width-state.footer.width)<1,'Title and playtime span the same full width');
        assert.ok(Math.abs(state.title.x-state.media.x)<1,'Title starts above the cover instead of the right column');
        assert.ok(state.title.bottom<=state.media.y+1,'Title is above the cover');
        assert.ok(state.footer.y>=Math.max(state.media.bottom,state.actions.bottom)-1,'Playtime is below both the cover and actions');
        assert.ok(state.actions.right<=state.header.right-(width>800?19:15),`${theme}/${width}/${locale}: inset actions stay within the header`);
        assert.equal(state.actionPadding,width<=400?'8px':'16px',`${theme}/${width}/${locale}: the action panel has consistent inset spacing`);
        assert.ok(state.play.x>state.actions.x+4&&state.play.right<state.actions.right-4,'The Play button fits inside the action panel');
        assert.ok(state.items.every(item=>item.width>0&&item.x>=state.row.x-1&&item.right<=state.row.right+1),`${theme}/${width}/${locale}: action icons stay inside their row`);
        assert.ok(state.bar.bottom+4<=state.numbers.y,`${theme}/${width}/${locale}: vote line sits above the counts`);
        assert.ok(state.labels.every(label=>label.size==='14px'&&label.line==='20px'),
          `${theme}/${width}/${locale}: all three stat headings match`);
        if(active)assert.ok(Math.abs(state.playing.y-state.labels[0].box.y)<1,
          `${theme}/${width}/${locale}: the active badge starts level with the playtime title`);
        assert.ok(state.values.every(value=>value.size==='18px'&&value.line==='24px'),
          `${theme}/${width}/${locale}: playtime and last-played values match`);
        if(width>400){
          assert.ok(state.labels.every(label=>Math.abs(label.box.y-state.labels[0].box.y)<1),
            `${theme}/${width}/${locale}: heading boxes start at the same height`);
          assert.ok(state.labels.every(label=>Math.abs(label.text.y-state.labels[0].text.y)<1),
            `${theme}/${width}/${locale}: heading text stays level despite Roblox's native heading padding`);
          assert.ok(Math.abs(state.hint.y-state.values[0].box.y)<1,
            `${theme}/${width}/${locale}: the left note starts level with the right value`);
          assert.ok(state.values.every(value=>Math.abs(value.box.y-state.values[0].box.y)<1),
            `${theme}/${width}/${locale}: values share a baseline`);
        }else assert.ok(state.labels[0].box.y<state.labels[1].box.y&&state.labels[1].box.y<state.labels[2].box.y,
          'Narrow screens stack the three stat sections in reading order');
        if(width>800){
          assert.ok(state.actions.x>=state.media.right,'Actions sit beside the cover');
          assert.ok(state.media.width>state.actions.width,`${theme}/${width}/${locale}: cover is the dominant column`);
          if(width===900){
            assert.ok(state.media.width>=500,`${theme}/${locale}: the cover is visibly larger at the reported desktop width`);
            assert.ok(state.actions.width<=285,`${theme}/${locale}: the right column is narrower`);
          }
          assert.ok(Math.abs(state.actions.y+state.actions.height/2-state.media.y-state.media.height/2)<1,'Short controls are centered beside the media');
          assert.ok(state.footer.height<160,'The full-width footer stays compact');
        }else assert.ok(state.actions.y>=state.media.bottom,'Narrow screens stack actions below the cover');
        assert.equal(state.text,theme==='light'?'rgb(27, 35, 48)':'rgb(244, 246, 251)');
        assert.match(state.blur,/blur\(23px\)/);
        if(width===320)assert.equal(state.grid,1);
      }
    }
    await browser.click('#toggle-game-favorite');
    assert.equal(await browser.evaluate('nativeFavoriteClicks'),1,'Native action handlers still work after responsive changes');
    await browser.evaluate('setSaved({customBackground:{...saved.customBackground,disableBlur:true,disableTransparency:true}})');
    await browser.waitFor('getComputedStyle(document.querySelector("#rc-playtime-game-page")).backdropFilter==="none"');
    assert.match(await browser.evaluate('getComputedStyle(document.querySelector("#rc-playtime-game-page")).backgroundColor'), /^rgb\([^/]+\)$/);
    if(process.env.PLAYTIME_GAME_SCREENSHOT){
      await browser.evaluate("RobloxCustomizerI18n.setLanguage('en');setSaved({customBackground:{...saved.customBackground,disableBlur:false,disableTransparency:false}})");
      await browser.waitFor('getComputedStyle(document.querySelector("#rc-playtime-game-page")).backdropFilter!=="none"');
      for(const width of [1280,900,320]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
        const shot=await browser.send('Page.captureScreenshot',{format:'png'});
        fs.writeFileSync(path.join(workspace,`.tmp-playtime-game-${width}.png`),Buffer.from(shot.data,'base64'));
      }
    }
    assert.deepEqual(browser.errors, []);
  });

test('Playtime shows distinct seconds and refreshes an open page without navigation in all UI languages',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serve(t), browser = await isolatedChrome(t, 'playtime-seconds');
    const advance = budget => new Promise((resolve, reject) => {
      const expired = event => {
        if (JSON.parse(event.data).method !== 'Emulation.virtualTimeBudgetExpired') return;
        browser.socket.removeEventListener('message', expired); resolve();
      };
      browser.socket.addEventListener('message', expired);
      browser.send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget }).catch(reject);
    });
    await icons(browser);
    await browser.send('Page.navigate', { url: `${origin}/home` });
    await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.waitFor('!!window.RobloxCustomizerPlaytimeUI');
    await browser.evaluate(`(()=>{const history=makeHistory();history.accounts[0].games=history.accounts[0].games.slice(1,3);
      history.accounts[0].games[0].totalMs=15000;history.accounts[0].games[1].totalMs=45000;
      return setSaved({rcPlaytimeHistory:history,playtimeTrackingEnabled:true})})()`);
    await browser.waitFor("document.querySelectorAll('.rc-playtime-tile').length===2");
    await browser.click('.rc-playtime-history');
    const times = () => browser.evaluate(`({home:[...document.querySelectorAll('.rc-playtime-tile-duration')].map(n=>n.textContent),
      history:[...document.querySelectorAll('.rc-playtime-duration')].map(n=>n.textContent)})`);
    for (const locale of ['en', 'zh-CN', 'zh-TW']) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      const expected = locale === 'en' ? ['45s', '15s'] : ['45秒', '15秒'];
      assert.deepEqual(await times(), { home: expected, history: expected });
    }
    await browser.evaluate(`RobloxCustomizerI18n.setLanguage('en');const updated=structuredClone(saved.rcPlaytimeHistory);
      updated.accounts[0].games[0].totalMs=125000;setSaved({rcPlaytimeHistory:updated})`);
    await browser.waitFor("document.querySelector('.rc-playtime-tile-duration').textContent==='2m 5s'");
    assert.deepEqual(await times(), { home: ['2m 5s', '45s'], history: ['2m 5s', '45s'] });
    await browser.evaluate('window.beforeRefresh=playtimeRequests.filter(a=>a==="refresh").length');
    await advance(31000);
    assert.equal(await browser.evaluate('playtimeRequests.filter(a=>a==="refresh").length>beforeRefresh'), true);
    await browser.evaluate('setSaved({playtimeTrackingEnabled:false})');
    await advance(100);
    await browser.waitFor("document.querySelector('.rc-playtime-status').textContent.includes('paused')");
    await browser.evaluate('window.beforeRefresh=playtimeRequests.filter(a=>a==="refresh").length');
    await advance(31000);
    assert.equal(await browser.evaluate('playtimeRequests.filter(a=>a==="refresh").length'), await browser.evaluate('beforeRefresh'));
    assert.deepEqual(browser.errors, []);
  });
test('Playtime settings and Home history support search, sorting, export, clear confirmation and SPA changes',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serve(t), browser = await isolatedChrome(t, 'playtime-actions');
    await icons(browser);
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.navigate', { url: `${origin}/home` });
    await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.waitFor('!!window.RobloxCustomizerPlaytimeUI');
    await browser.waitFor('!!document.querySelector("#rc-playtime-home")');
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-playtime-settings input')");
    assert.equal(await browser.evaluate('document.querySelector("#rc-playtime-settings input").checked'),true,'Tracking is checked by default');
    await browser.click('#rc-playtime-settings input');
    await browser.waitFor('saved.playtimeTrackingEnabled===false && !document.querySelector("#rc-playtime-home")');
    await browser.click('#rc-playtime-settings input');
    await browser.waitFor("saved.playtimeTrackingEnabled && !!document.querySelector('#rc-playtime-home')");
    assert.equal(await browser.evaluate("document.querySelector('.rc-home-greeting-clock').parentElement===document.querySelector('#rc-playtime-home').parentElement"), true, 'The card shares the clock area');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-home-greeting #rc-playtime-home')"), true);
    await browser.evaluate('setSaved({rcPlaytimeHistory:makeHistory()})');
    await browser.waitFor("document.querySelectorAll('#rc-playtime-home .rc-playtime-tile').length===27");
    assert.equal(await browser.evaluate("document.querySelector('#rc-playtime-home .rc-playtime-home-summary').textContent"), '6h 18m · 27 games');
    assert.equal(await browser.evaluate("document.querySelector('#rc-playtime-home .rc-playtime-tile-name').textContent"), 'Game 26', 'Most played games appear first');
    await browser.click('#rc-playtime-settings button');
    await browser.waitFor("!!document.querySelector('#rc-playtime-dialog[open]')");
    assert.equal(await browser.evaluate("document.activeElement.type"), 'search');
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-playtime-dialog .rc-playtime-game').length"), 20);
    assert.equal(await browser.evaluate("document.querySelector('#rc-playtime-dialog .rc-playtime-game-name').textContent"), 'Game 26');
    await browser.click('.rc-playtime-more');
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-playtime-dialog .rc-playtime-game').length"), 27);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-playtime-dialog .rc-playtime-game-name img')"), false, 'Game names are text, not HTML');
    await browser.evaluate("const search=document.querySelector('#rc-playtime-dialog input');search.value='中文';search.dispatchEvent(new Event('input'))");
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-playtime-dialog .rc-playtime-game').length"), 2);
    await browser.evaluate("search.value='no-such-game';search.dispatchEvent(new Event('input'))");
    assert.equal(await browser.evaluate("document.querySelector('#rc-playtime-dialog .rc-playtime-empty').textContent"), 'No matching games.');
    await browser.evaluate("search.value='';search.dispatchEvent(new Event('input'));const sort=document.querySelector('#rc-playtime-dialog select');sort.value='recent';sort.dispatchEvent(new Event('change'))");
    assert.equal(await browser.evaluate("document.querySelector('#rc-playtime-dialog .rc-playtime-game-name').textContent"), 'Game 26');
    await browser.click('.rc-playtime-export');
    const exported = await browser.evaluate("(async()=>({download:exported.download,data:JSON.parse(await exportBlob.text())}))()");
    assert.equal(exported.download, 'roblox-playtime-123.json');
    assert.equal(exported.data.games.length, 27); assert.equal(exported.data.totalMs, 22680000);
    await browser.click('.rc-playtime-clear');
    assert.equal(await browser.evaluate("document.querySelector('.rc-playtime-confirmation').hidden"), false);
    await browser.click('.rc-playtime-cancel');
    assert.equal(await browser.evaluate('saved.rcPlaytimeHistory.accounts[0].games.length'), 27);
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await browser.waitFor("!document.querySelector('#rc-playtime-dialog')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), true, 'Escape closes history without closing settings');
    await browser.click('#rc-playtime-settings input');
    await browser.waitFor('!saved.playtimeTrackingEnabled');
    assert.equal(await browser.evaluate('saved.rcPlaytimeHistory.accounts[0].games.length'), 27);
    await browser.click('#rc-playtime-settings button'); await browser.click('.rc-playtime-clear'); await browser.click('.rc-playtime-confirm');
    await browser.waitFor("document.querySelectorAll('#rc-playtime-dialog .rc-playtime-game').length===0");
    await browser.waitFor("!document.querySelector('.rc-home-greeting-widgets')");
    assert.equal(await browser.evaluate("document.querySelector('.rc-home-greeting-clock').parentElement.id"), 'rc-home-greeting', 'The original clock layout returns when the card is absent');
    assert.equal(await browser.evaluate('saved.customBackground.source'), 'none');
    await browser.click('.rc-playtime-close');
    await browser.evaluate("history.pushState({},'', '/my/account');document.body.append(document.createElement('div'))");
    await browser.waitFor("!document.querySelector('#rc-playtime-home')");
    await browser.evaluate("setSaved({rcPlaytimeHistory:makeHistory()});history.pushState({},'', '/home');document.body.append(document.createElement('div'))");
    await browser.waitFor("document.querySelectorAll('#rc-playtime-home .rc-playtime-tile').length===27");
    // Replacing the greeting during a Home rerender restores the carousel in the clock panel.
    await browser.evaluate("document.querySelector('#rc-home-greeting').remove()");
    await browser.waitFor("!!document.querySelector('#rc-home-greeting #rc-playtime-home')");
    await browser.click('#rc-done');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    await browser.evaluate("document.querySelector('.rc-playtime-history').focus()");
    assert.equal(await browser.evaluate('document.activeElement.classList.contains("rc-playtime-history")'), true);
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await browser.waitFor("!!document.querySelector('#rc-playtime-dialog[open]')");
    assert.deepEqual(browser.errors, []);
  });
test('Playtime history dismisses on outside clicks, preserves inside gestures and restores its opener',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serve(t), browser = await isolatedChrome(t, 'playtime-dismiss');
    await icons(browser);
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.navigate', { url: `${origin}/home` });
    await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.evaluate('setSaved({rcPlaytimeHistory:makeHistory(),playtimeTrackingEnabled:true})');
    await browser.waitFor('!!document.querySelector(".rc-playtime-history")');
    await browser.evaluate(`const behind=document.createElement('button');behind.id='behind-history';
      behind.style.cssText='position:fixed;left:0;top:0;width:12px;height:12px;padding:0';
      window.behindClicks=0;behind.onclick=()=>behindClicks++;document.body.append(behind);
      const menu=document.querySelector('#settings-popover-menu');menu.style.top='auto';menu.style.bottom='0'`);
    const press = point => browser.send('Input.dispatchMouseEvent', { type:'mousePressed', button:'left', buttons:1, clickCount:1, ...point });
    const release = point => browser.send('Input.dispatchMouseEvent', { type:'mouseReleased', button:'left', clickCount:1, ...point });
    const outside = { x:5, y:5 };
    for (const width of [1280,390]) for (const locale of ['en','zh-CN','zh-TW']) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height:900, deviceScaleFactor:1, mobile:false });
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      await browser.click('.rc-playtime-history');
      await browser.waitFor('!!document.querySelector("#rc-playtime-dialog[open]")');
      const padding = await browser.evaluate(`(()=>{const r=document.querySelector('#rc-playtime-dialog').getBoundingClientRect();
        return{x:r.left+6,y:r.top+6}})()`);
      await press(padding); await release(padding);
      assert.equal(await browser.evaluate('document.querySelector("#rc-playtime-dialog").open'),true,'Blank space inside the window stays open');
      await browser.click('#rc-playtime-dialog input');
      assert.equal(await browser.evaluate('document.activeElement.type'),'search','Inside controls remain usable');
      await press(padding);
      await browser.send('Input.dispatchMouseEvent', { type:'mouseMoved', button:'left', buttons:1, ...outside });
      await release(outside);
      assert.equal(await browser.evaluate('document.querySelector("#rc-playtime-dialog").open'),true,'A drag starting inside does not dismiss the window');
      await press(outside);
      await browser.send('Input.dispatchMouseEvent', { type:'mouseMoved', button:'left', buttons:1, ...padding });
      await release(padding);
      assert.equal(await browser.evaluate('document.querySelector("#rc-playtime-dialog").open'),true,'Releasing inside does not dismiss the window');
      await browser.click('.rc-playtime-clear');
      await press(outside); await release(outside);
      await browser.waitFor('!document.querySelector("#rc-playtime-dialog")');
      assert.equal(await browser.evaluate('document.activeElement.classList.contains("rc-playtime-history")'),true,`${width}/${locale}: focus returns to the Home button`);
      assert.equal(await browser.evaluate('saved.rcPlaytimeHistory.accounts[0].games.length'),27,'Dismissing the confirmation preserves history');
      assert.equal(await browser.evaluate('behindClicks'),0,'The dismissing click does not activate the page behind the dialog');
    }
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor('!!document.querySelector("#rc-playtime-settings button")');
    await browser.click('#rc-playtime-settings button');
    await browser.waitFor('!!document.querySelector("#rc-playtime-dialog[open]")');
    await press(outside); await release(outside);
    await browser.waitFor('!document.querySelector("#rc-playtime-dialog")');
    assert.equal(await browser.evaluate('!!document.querySelector("#rc-settings-overlay")'),true,'Only the history dialog closes when opened above settings');
    assert.equal(await browser.evaluate('document.activeElement.matches("#rc-playtime-settings button")'),true);
    assert.deepEqual(browser.errors,[]);
  });

test('Playtime panels fit mobile, light/dark and Chinese locales, and honor custom colors and effect switches',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serve(t), browser = await isolatedChrome(t, 'playtime-themes');
    await icons(browser);
    await browser.send('Page.navigate', { url: `${origin}/home` }); await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.evaluate('setSaved({rcPlaytimeHistory:makeHistory(),playtimeTrackingEnabled:true})');
    await browser.waitFor("!!document.querySelector('#rc-playtime-home')"); await browser.click('.rc-playtime-history');
    const snapshot = () => browser.evaluate(`(()=>{const d=document.querySelector('#rc-playtime-dialog'),h=document.querySelector('#rc-playtime-home'),s=getComputedStyle(d);return {title:d.querySelector('h2').textContent,text:s.color,background:s.backgroundColor,blur:s.backdropFilter,scheme:s.colorScheme,overflow:d.scrollWidth>d.clientWidth+1,homeOverflow:h.scrollWidth>h.clientWidth+1,contained:d.getBoundingClientRect().right<=innerWidth&&d.getBoundingClientRect().left>=0,search:d.querySelector('input').placeholder,first:d.querySelector('.rc-playtime-game-name').textContent,duration:d.querySelector('.rc-playtime-duration').textContent}})()`);
    for (const theme of ['dark', 'light']) for (const width of [2200, 1280, 900, 760, 320]) for (const locale of ['en', 'zh-CN', 'zh-TW']) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`document.documentElement.className='${theme==='dark'?'light':'dark'}-theme';document.body.className='${theme}-theme';RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      await browser.evaluate(`document.querySelector('#HomeContainer').style.maxWidth=${width === 2200 ? "'none'" : "''"}`);
      const state = await snapshot();
      const card = await browser.evaluate(`(()=>{const c=document.querySelector('#rc-playtime-home'),r=c.getBoundingClientRect(),s=getComputedStyle(c);return {label:c.querySelector('h2').textContent,total:c.querySelector('.rc-playtime-home-summary').textContent.split(' · ')[0],background:s.backgroundColor,text:s.color,blur:s.backdropFilter,contained:r.left>=0&&r.right<=innerWidth,inClockArea:!!c.closest('#rc-home-greeting'),width:r.width,height:r.height,iconWidth:Math.max(...[...c.querySelectorAll('.rc-playtime-tile-art')].map(n=>n.getBoundingClientRect().width)),greetingOverflow:document.querySelector('#rc-home-greeting').scrollWidth>document.querySelector('#rc-home-greeting').clientWidth+1,previous:c.querySelector('.rc-playtime-previous').getAttribute('aria-label'),next:c.querySelector('.rc-playtime-next').getAttribute('aria-label')}})()`);
      assert.equal(card.label, locale === 'en' ? 'Your most played' : locale === 'zh-CN' ? '您最常玩的游戏' : '您最常玩的遊戲');
      assert.equal(card.total, locale === 'en' ? '6h 18m' : locale === 'zh-CN' ? '6小时 18分钟' : '6小時 18分鐘');
      assert.equal(card.contained && card.inClockArea, true, `${theme}/${width}/${locale}: carousel shares the greeting and clock panel`);
      assert.equal(card.previous, locale === 'en' ? 'Previous games' : locale === 'zh-CN' ? '上一组游戏' : '上一組遊戲');
      assert.equal(card.next, locale === 'en' ? 'Next games' : locale === 'zh-CN' ? '下一组游戏' : '下一組遊戲');
      assert.equal(card.greetingOverflow, false, `${theme}/${width}/${locale}: greeting and widgets fit`);
      const greeting = await browser.evaluate(`(()=>{const g=document.querySelector('#rc-home-greeting'),r=g.getBoundingClientRect(),nodes=['.rc-home-greeting-avatar','.rc-home-greeting-copy','.rc-home-greeting-clock','#rc-playtime-home'].map(s=>g.querySelector(s));const title=g.querySelector('.rc-home-greeting-title'),range=document.createRange();range.setStart(title.firstChild,0);range.setEnd(title.firstChild,'Shadows_Lunarfox'.length);return {
        title:parseFloat(getComputedStyle(g.querySelector('.rc-home-greeting-title')).fontSize),
        time:parseFloat(getComputedStyle(g.querySelector('.rc-home-greeting-time')).fontSize),
        avatar:nodes[0].getBoundingClientRect().width,
        nameLines:range.getClientRects().length,
        contained:nodes.every(n=>{const b=n.getBoundingClientRect();return b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom}),
        centers:nodes.map(n=>{const b=n.getBoundingClientRect();return b.top+b.height/2})}})()`);
      assert.equal(greeting.contained, true, `${width}/${locale}: identity, clock and carousel stay inside the banner`);
      assert.equal(greeting.nameLines, 1, `${width}/${locale}: the display name fits without splitting its final letters`);
      if (width === 2200) {
        assert.equal(greeting.title, 40); assert.equal(greeting.time, 38); assert.equal(greeting.avatar, 96);
        assert.ok(Math.max(...greeting.centers)-Math.min(...greeting.centers)<1, 'Wide-screen identity, clock and carousel align vertically');
      } else if (width === 320) {
        assert.equal(greeting.title, 18); assert.equal(greeting.time, 22); assert.equal(greeting.avatar, 52);
      } else assert.ok(greeting.title < 40 && greeting.time < 38, 'Typography responds to banner width');
      assert.ok(card.width <= 520 && card.height <= 220 && card.iconWidth <= 64, `${theme}/${width}/${locale}: panel and icons remain compact, including full-width wide screens`);
      assert.equal(card.background, theme === 'dark' ? 'rgba(20, 22, 28, 0.62)' : 'rgba(255, 255, 255, 0.82)');
      assert.equal(card.text, state.text); assert.equal(card.blur, state.blur);
      assert.equal(state.overflow, false, `${theme}/${width}/${locale}: dialog content fits`);
      assert.equal(state.homeOverflow, false); assert.equal(state.contained, true);
      assert.equal(state.text, theme === 'dark' ? 'rgb(244, 246, 251)' : 'rgb(27, 35, 48)');
      assert.equal(state.scheme, theme); assert.equal(state.blur, 'blur(23px) saturate(1.2)');
      assert.equal(state.title, locale === 'en' ? 'Playtime history' : locale === 'zh-CN' ? '游戏时长记录' : '遊戲時長記錄');
      assert.equal(state.search, locale === 'en' ? 'Search games' : locale === 'zh-CN' ? '搜索游戏' : '搜尋遊戲');
      assert.equal(state.duration, locale === 'en' ? '27m' : locale === 'zh-CN' ? '27分钟' : '27分鐘');
      assert.equal(state.first, 'Game 26', 'Language changes never translate game names');
    }
    if (process.env.PLAYTIME_SCREENSHOT) {
      await browser.click('.rc-playtime-close');
      await browser.evaluate("document.querySelector('#settings-popover-menu').style.display='none'");
      for (const [name, width, theme, locale] of [['mobile',320,'light','zh-TW'],['desktop',1100,'dark','en'],['wide',2200,'dark','en']]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 700, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.documentElement.className='${theme}-theme';document.body.className='${theme}-theme';RobloxCustomizerI18n.setLanguage('${locale}')`);
        await browser.evaluate(`document.querySelector('#HomeContainer').style.maxWidth=${width === 2200 ? "'none'" : "''"}`);
        const shot = await browser.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(workspace, `.tmp-playtime-${name}.png`), Buffer.from(shot.data, 'base64'));
      }
      await browser.click('.rc-playtime-history');
    }
    await browser.evaluate("setSaved({customBackground:{...saved.customBackground,disableTransparency:true,disableBlur:true,uiLanguage:'zh-TW',experimentalCustomColors:true,customTextColor:'#123456',customBackgroundColor:'#ffffff',customAccentColor:'#9a3377'}})");
    await browser.waitFor("getComputedStyle(document.querySelector('#rc-playtime-dialog')).backdropFilter==='none'");
    const state = await snapshot();
    assert.equal(state.text, 'rgb(18, 52, 86)'); assert.equal(state.background, 'rgb(255, 255, 255)');
    assert.deepEqual(browser.errors, []);
  });

test('Most-played carousel shows five cards, pages with arrows and keys, drags and swipes without losing live updates',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const origin = await serve(t), browser = await isolatedChrome(t, 'playtime-carousel');
    await icons(browser);
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.navigate', { url: `${origin}/home` }); await waitForDocument(browser, '.rc-settings-menu-entry');
    await browser.evaluate('setSaved({rcPlaytimeHistory:makeHistory(),playtimeTrackingEnabled:true})');
    await browser.waitFor("document.querySelectorAll('.rc-playtime-tile').length===27");
    await browser.waitFor("document.querySelector('.rc-playtime-tile img')?.naturalWidth===150");
    const snapshot = () => browser.evaluate(`(()=>{
      const v=document.querySelector('.rc-playtime-carousel'),r=v.getBoundingClientRect();
      return {left:v.scrollLeft,slots:Number(getComputedStyle(v).getPropertyValue('--rc-playtime-slots')),
        previous:document.querySelector('.rc-playtime-previous').disabled,next:document.querySelector('.rc-playtime-next').disabled,
        visible:[...v.children].filter(n=>{const b=n.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1}).map(n=>{
          const a=n.querySelector('.rc-playtime-tile-art').getBoundingClientRect(),name=n.querySelector('.rc-playtime-tile-name'),time=n.querySelector('.rc-playtime-tile-duration').getBoundingClientRect();
          return {name:name.textContent,time:n.querySelector('.rc-playtime-tile-duration').textContent,below:time.top>=name.getBoundingClientRect().bottom,nameHeight:name.getBoundingClientRect().height,square:Math.abs(a.width-a.height)<1,loaded:n.querySelector('img')?.naturalWidth===150,href:n.querySelector('a').href};})};})()`);
    let state = await snapshot();
    assert.equal(state.slots, 5); assert.equal(state.visible.length, 5);
    assert.deepEqual(state.visible.map(g => g.name), ['Game 26','Game 25','Game 24','Game 23','Game 22']);
    assert.deepEqual(state.visible.map(g => g.time), ['27m','26m','25m','24m','23m']);
    assert.ok(state.visible.every(g => g.below && g.nameHeight === 32 && g.square));
    assert.equal(state.visible[0].href, 'https://www.roblox.com/games/226');
    assert.equal(state.previous, true); assert.equal(state.next, false);
    await browser.click('.rc-playtime-next');
    await browser.waitFor("!document.querySelector('.rc-playtime-previous').disabled");
    state = await snapshot(); assert.equal(state.visible.length, 5); assert.equal(state.visible[0].name, 'Game 21');
    await browser.click('.rc-playtime-previous');
    await browser.waitFor("document.querySelector('.rc-playtime-previous').disabled");
    assert.equal((await snapshot()).visible[0].name, 'Game 26');
    const key = async (name, code) => {
      await browser.evaluate("document.querySelector('.rc-playtime-carousel').focus()");
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code });
    };
    await key('End', 35); await browser.waitFor("document.querySelector('.rc-playtime-next').disabled");
    state = await snapshot(); assert.equal(state.visible.length, 5); assert.equal(state.visible[0].name, 'Game 4');
    assert.equal(await browser.evaluate("document.querySelectorAll('.rc-playtime-tile-name img').length"), 0, 'Long titles stay text and cannot inject markup');
    await key('Home', 36); await browser.waitFor("document.querySelector('.rc-playtime-previous').disabled");
    await key('ArrowRight', 39); await browser.waitFor("document.querySelector('.rc-playtime-carousel').scrollLeft>0");
    await key('Home', 36); await browser.waitFor("document.querySelector('.rc-playtime-previous').disabled");
    const point = await browser.evaluate("(()=>{const r=document.querySelector('.rc-playtime-carousel').getBoundingClientRect();return {x:r.left+r.width*.75,y:r.top+40,width:r.width}})()");
    await browser.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, x: point.x, y: point.y });
    for (let step=1; step<=6; step++) await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', buttons: 1, x: point.x-point.width*.4*step/6, y: point.y });
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: point.x-point.width*.4, y: point.y });
    await browser.waitFor("document.querySelector('.rc-playtime-carousel').scrollLeft>0 && !document.querySelector('.rc-playtime-dragging')");
    assert.equal(await browser.evaluate('location.pathname'), '/home', 'Dragging an icon must not open the game');
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const offset = (await snapshot()).left;
    await browser.evaluate("window.originalViewport=document.querySelector('.rc-playtime-carousel');window.originalTile=document.querySelector('[data-universe-id=\"126\"]');const changed=structuredClone(saved.rcPlaytimeHistory);changed.accounts[0].games[26].name='Updated game';changed.accounts[0].games[26].totalMs+=60000;setSaved({rcPlaytimeHistory:changed})");
    await browser.waitFor("document.querySelector('[data-universe-id=\"126\"] .rc-playtime-tile-name').textContent==='Updated game'");
    assert.equal(await browser.evaluate("originalViewport===document.querySelector('.rc-playtime-carousel') && originalTile===document.querySelector('[data-universe-id=\"126\"]')"), true);
    assert.ok(Math.abs((await snapshot()).left-offset)<2, 'Live samples retain the scroll position and mounted cards');
    await browser.evaluate("const other=makeHistory();other.currentUserId=321;other.accounts[0].userId=321;other.accounts[0].games=other.accounts[0].games.slice(0,2);setSaved({rcPlaytimeHistory:other})");
    await browser.waitFor("document.querySelectorAll('.rc-playtime-tile').length===2 && document.querySelector('.rc-playtime-carousel').scrollLeft===0");
    await browser.waitFor("document.querySelector('.rc-playtime-next').disabled && document.querySelector('.rc-playtime-previous').disabled");
    await browser.evaluate('setSaved({rcPlaytimeHistory:makeHistory()})');
    await browser.waitFor("document.querySelectorAll('.rc-playtime-tile').length===27");
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await browser.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await browser.waitFor("getComputedStyle(document.querySelector('.rc-playtime-carousel')).getPropertyValue('--rc-playtime-slots').trim()==='3'");
    state = await snapshot(); assert.equal(state.visible.length, 3);
    const swipe = await browser.evaluate("(()=>{const r=document.querySelector('.rc-playtime-carousel').getBoundingClientRect();return {x:r.right-10,y:r.top+30,width:r.width}})()");
    await browser.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: swipe.x, y: swipe.y, id: 0 }] });
    for (let step=1; step<=6; step++) await browser.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: swipe.x-swipe.width*.8*step/6, y: swipe.y, id: 0 }] });
    await browser.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await browser.waitFor("document.querySelector('.rc-playtime-carousel').scrollLeft>0");
    assert.equal(await browser.evaluate('location.pathname'), '/home');
    await browser.evaluate('setSaved({rcPlaytimeHistory:RobloxCustomizerPlaytime.normalize(null)})');
    await browser.waitFor("document.querySelectorAll('.rc-playtime-tile').length===0");
    await browser.waitFor("document.querySelector('.rc-playtime-next').disabled && document.querySelector('.rc-playtime-previous').disabled");
    assert.ok(await browser.evaluate("!!document.querySelector('#rc-playtime-home .rc-playtime-empty').textContent"));
    assert.deepEqual(browser.errors, []);
  });
