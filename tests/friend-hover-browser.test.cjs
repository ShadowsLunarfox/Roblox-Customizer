const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const styles = ['src/shared/theme.css', 'src/home/friends.css'];
const scripts = ['src/shared/startup.js', 'src/home/friends.js'];

function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>
      *{box-sizing:border-box}body{margin:0;padding:24px;font:14px/1.4 Arial;background:#64758b;color:#ddd}button,a{font:inherit}button{cursor:pointer}ul{list-style:none;margin:0;padding:0}a{color:inherit}h1{font-size:20px}
      .dark-theme{--color-surface-300:#272930;--color-content-muted:#b8b8b8}.light-theme{--color-surface-300:#fff;--color-content-muted:#737373}
      #friend-tile-button{background:none;border:0}.avatar-card{width:48px;height:48px;border-radius:50%;background:#708bb5}.friend-tile-content{min-height:72px}.friend-tile-content>button{width:100%;padding:0;overflow-wrap:anywhere}
      /* Native rules/structure from Roblox's published FriendsCarousel CSS/JS:
         https://css.rbxcdn.com/3e77aa4c7a11c44d70d59835ca9faad3fa481f6b79bb61c8760a671af6951c3f-FriendsCarousel.css */
      .light-theme .friend-tile-dropdown,.dark-theme .friend-tile-dropdown{background-color:var(--color-surface-300);border-radius:5px}
      .friend-tile-dropdown-button{text-align:left;white-space:nowrap;text-overflow:ellipsis;width:100%;color:var(--color-content-muted);background-color:transparent;border:0;border-top:.5px solid #8884;padding:10px;overflow:hidden}
      .friend-tile-dropdown-button:hover{background-color:#8884}.friend-tile-non-styled-button{text-align:left;background-color:transparent;border:0;padding:0}
      .in-game-friend-card{cursor:default;display:flex;padding:10px}.friend-presence-info{display:flex;flex-direction:column;justify-content:space-between;width:100%}
      .friend-tile-game-card{border-radius:5px;width:100px;height:100px;margin-right:10px}.game-card-thumb{width:100%;height:100%}
      .flex{display:flex}.flex-col{flex-direction:column}.items-center{align-items:center}.self-stretch{align-self:stretch}.gap-small{gap:8px}.gap-medium{gap:12px}.width-full{width:100%}.height-full{height:100%}.min-width-0{min-width:0}.fill{flex:1}.shrink-0{flex-shrink:0}.clip{overflow:hidden}.radius-small{border-radius:4px}.radius-medium{border-radius:8px}.padding-x-large{padding-inline:16px}.padding-y-large{padding-block:16px}.stroke-standard{border:1px solid #8885}.bg-over-media-300{background:#202227dd}.bg-action-emphasis,.btn-growth-sm{background:#335fff;color:#fff}.bg-action-standard{background:#44464f;color:white}.content-default{color:#ccc}.content-emphasis{color:white}.content-action-standard{color:#eee}.text-no-wrap{white-space:nowrap}.text-truncate-end{overflow:hidden;text-overflow:ellipsis}.text-title-medium{font-weight:700}.height-600{height:24px}
      .icon-chat-gray,.icon-viewdetails{display:inline-block;width:24px;height:24px;background:linear-gradient(#999,#999);border-radius:4px}.native-primary{border:0;padding:8px;border-radius:8px;min-height:36px}.in-game-friend-card-actions a{display:flex;align-items:center;justify-content:center}
    </style>${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme">
    <main id="HomeContainer" class="content"><h1>Friends</h1><section class="friend-carousel-container"><div class="react-friends-carousel-container"><div class="friends-carousel-container"><div class="friends-carousel-list-container-not-full">
      ${['activity', 'compact', 'legacy'].map(kind => `<div class="friends-carousel-tile"><div class="friend-tile-content"><button id="${kind}-trigger" type="button" class="options-dropdown"><div class="avatar-card"></div>${kind}</button></div></div>`).join('')}
    </div></div></div></section></main>
    <script>
      const labels={en:['Mah is playing','Fabled Legacy: A Very Long Experience Title','Join','Chat','View Profile','Chat with Gunter'], 'zh-CN':['小明正在玩','这是一个很长的游戏名称，测试好友悬停窗口中的中文内容是否完整显示','加入','聊天','查看个人资料','与小明聊天'], 'zh-TW':['小明正在遊玩','這是一個很長的遊戲名稱，測試好友懸停視窗中的中文內容是否完整顯示','加入','聊天','檢視個人檔案','與小明聊天']};
      window.locale='en';window.actions={join:0,chat:0,profile:0,game:0};window.preferences={source:'none',glassBlur:23,glassOpacity:62};
      window.chrome={storage:{local:{async get(){return {customBackground:preferences}}},onChanged:{addListener(){}}}};
      const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#8138a8"/></svg>');
      const image=()=>'<img class="game-card-thumb width-full height-full" alt="Game icon" src="'+art+'">';
      const join=modern=>'<button type="button" data-action="join" class="native-primary '+(modern?'bg-action-emphasis':'btn-growth-sm')+'"><span class="text-truncate-end text-no-wrap">'+labels[locale][2]+'</span></button>';
      window.mountMenu=kind=>{
        document.querySelector('[data-native-portal]')?.remove();
        const t=labels[locale],portal=document.createElement('div');portal.setAttribute('data-native-portal','');
        portal.setAttribute('data-radix-popper-content-wrapper','');portal.style.cssText='position:fixed;left:24px;top:180px;z-index:1000';
        let content;
        if(kind==='activity') content='<div class="friend-tile-dropdown friend-tile-dropdown--iarc" style="background-color:transparent;border-radius:0"><div class="in-game-friend-card--iarc flex flex-col padding-y-large padding-x-large gap-medium radius-medium stroke-standard bg-over-media-300 width-full"><a data-action="game" href="/games/123/Test" class="flex items-center gap-small width-full min-width-0"><span class="shrink-0 radius-small clip" style="display:inline-block;width:40px;height:40px">'+image()+'</span><span class="friend-presence-info flex flex-col min-width-0 fill"><span class="friend-tile-is-playing content-default text-truncate-end text-no-wrap">'+t[0]+'</span><span class="friend-tile-game-name content-emphasis text-title-medium text-truncate-end text-no-wrap">'+t[1]+'</span></span></a><div class="in-game-friend-card-actions flex flex-col self-stretch gap-small">'+join(true)+'<button type="button" data-action="chat" class="native-primary bg-action-standard">'+t[3]+'</button><a href="/users/123/profile" data-action="profile" class="height-600 content-action-standard">'+t[4]+'</a></div></div></div>';
        else content='<div class="friend-tile-dropdown">'+(kind==='legacy'?'<div class="in-game-friend-card"><button type="button" class="friend-tile-non-styled-button" data-action="game"><div class="friend-tile-game-card">'+image()+'</div></button><div class="friend-presence-info"><button type="button" class="friend-tile-non-styled-button" data-action="game">'+t[1]+'</button>'+join(false)+'</div></div>':'')+'<ul><li><button type="button" data-action="chat" class="friend-tile-dropdown-button"><span class="icon-chat-gray"></span>'+t[5]+'</button></li><li><button type="button" data-action="profile" class="friend-tile-dropdown-button"><span class="icon-viewdetails"></span>'+t[4]+'</button></li></ul></div>';
        portal.innerHTML='<div class="foundation-web-portal-zindex" role="dialog" aria-label="Friend" data-state="open"><div style="width:'+(kind==='compact'?240:kind==='activity'?260:315)+'px">'+content+'</div></div>';
        portal.addEventListener('click',event=>{const action=event.target.closest('[data-action]');if(action){event.preventDefault();if(!action.disabled&&action.getAttribute('aria-disabled')!=='true')actions[action.dataset.action]++}});
        document.body.append(portal);
      };
      for(const kind of ['activity','compact','legacy']) {const trigger=document.getElementById(kind+'-trigger');trigger.addEventListener('mouseenter',()=>mountMenu(kind));trigger.addEventListener('focus',()=>mountMenu(kind))}
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Home friend activity cards and compact menus share glass, themes and controls in native portals',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const assets = new Set([...styles, ...scripts]);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'friend-hover');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/home` });
    await waitForDocument(browser, '#HomeContainer');
    assert.deepEqual(browser.errors, [], 'Fixture scripts initialize successfully');
    await browser.waitFor("!!document.querySelector('[data-rc-native-friends-list]')");
    await browser.evaluate('RobloxCustomizerStartup.setPreferences(preferences)');
    const hover = async selector => {
      const point = await browser.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    };
    const snapshot = () => browser.evaluate(`(()=>{const n=document.querySelector('.friend-tile-dropdown'),s=getComputedStyle(n),r=n.getBoundingClientRect();return {radius:s.borderRadius,background:s.backgroundColor,blur:s.backdropFilter,text:s.color,scheme:s.colorScheme,padding:s.padding,contained:r.left>=0&&r.right<=innerWidth,overflow:n.scrollWidth>n.clientWidth+1,inner:!!n.querySelector('.in-game-friend-card--iarc')&&getComputedStyle(n.querySelector('.in-game-friend-card--iarc')).backgroundColor,controls:[...n.querySelectorAll('.friend-tile-dropdown-button,.in-game-friend-card-actions > button,.in-game-friend-card-actions > a')].map(b=>({height:b.getBoundingClientRect().height,color:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor})),outsideHome:!n.closest('#HomeContainer'),image:!!n.querySelector('img')&&n.querySelector('img').getAttribute('src')}})()`);
    for (const theme of ['dark', 'light']) for (const width of [1280, 320]) for (const language of ['en', 'zh-CN', 'zh-TW']) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`locale=${JSON.stringify(language)};document.documentElement.lang=locale;document.documentElement.className='${theme==='dark'?'light':'dark'}-theme';document.body.className='${theme}-theme'`);
      const states = [];
      for (const kind of ['activity', 'compact', 'legacy']) {
        await hover(`#${kind}-trigger`);
        await browser.waitFor("!!document.querySelector('.friend-tile-dropdown')");
        const state = await snapshot();
        assert.equal(state.outsideHome, true, 'The fixture exercises a native body portal');
        assert.equal(state.radius, '14px');
        assert.equal(state.padding, '8px');
        assert.equal(state.scheme, theme);
        assert.equal(state.text, theme === 'dark' ? 'rgb(244, 246, 251)' : 'rgb(27, 35, 48)');
        assert.equal(state.background, theme === 'dark' ? 'rgba(20, 22, 28, 0.62)' : 'rgba(255, 255, 255, 0.82)');
        assert.equal(state.blur, 'blur(23px) saturate(1.2)');
        assert.equal(state.overflow, false, `${kind}/${theme}/${width}/${language}: long labels fit`);
        assert.equal(state.contained, true);
        assert.ok(state.controls.every(c => c.height >= 36), 'Actions have consistent usable heights');
        if (kind === 'activity') {
          assert.equal(state.inner, 'rgba(0, 0, 0, 0)', 'Foundation does not add a second opaque background');
          assert.equal(state.controls[0].background, 'rgb(51, 95, 255)');
          assert.equal(state.controls[0].color, 'rgb(255, 255, 255)');
          assert.ok(state.image.startsWith('data:image/svg+xml'), 'The original thumbnail remains intact');
        }
        if (process.env.FRIEND_HOVER_SCREENSHOTS && language === 'en' && width === 1280) {
          await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
          const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          fs.writeFileSync(path.join(workspace, `.tmp-friend-hover-${kind}-${theme}.png`), Buffer.from(shot.data, 'base64'));
        }
        states.push(state);
      }
      assert.equal(states[0].background, states[1].background, 'Both hover window types use the same surface');
    }
    // Live preference changes do not replace the native popup or its handlers.
    await browser.evaluate("locale='en';mountMenu('activity');window.originalMenu=document.querySelector('.friend-tile-dropdown')");
    for (const disableTransparency of [true, false]) for (const disableBlur of [true, false]) {
      await browser.evaluate(`RobloxCustomizerStartup.setPreferences({...preferences,disableTransparency:${disableTransparency},disableBlur:${disableBlur},source:'url',url:'https://example.com/wallpaper.png'})`);
      const state = await snapshot();
      assert.equal(state.blur, disableBlur ? 'none' : 'blur(23px) saturate(1.2)');
      assert.equal(state.background, disableTransparency ? 'rgb(255, 255, 255)' : 'rgba(255, 255, 255, 0.82)');
      assert.equal(await browser.evaluate("document.querySelector('.friend-tile-dropdown')===originalMenu"), true);
    }
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({...preferences,experimentalCustomColors:true,customBackgroundColor:'#eef2ff',customTextColor:'#123456',customAccentColor:'#facc15'})");
    assert.equal((await snapshot()).text, 'rgb(18, 52, 86)');
    assert.equal((await snapshot()).controls[0].background, 'rgb(250, 204, 21)');
    assert.equal((await snapshot()).controls[0].color, 'rgb(0, 0, 0)');
    for (const action of ['join', 'chat', 'profile', 'game']) await browser.click(`.friend-tile-dropdown [data-action="${action}"]`);
    assert.deepEqual(await browser.evaluate('actions'), { join: 1, chat: 1, profile: 1, game: 1 });
    await browser.evaluate("document.querySelector('[data-action=join]').disabled=true");
    await browser.click('.friend-tile-dropdown [data-action=join]');
    assert.equal(await browser.evaluate('actions.join'), 1, 'Disabled Join keeps its native behavior');
    await browser.evaluate("mountMenu('compact');document.querySelector('.friend-tile-dropdown-button').focus()");
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await browser.evaluate("getComputedStyle(document.activeElement).outlineStyle"), 'solid');
    await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
    await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.equal(await browser.evaluate('actions.profile'), 2, 'Keyboard activation remains native');
    await browser.evaluate("RobloxCustomizerStartup.setPreferences(preferences);document.querySelector('#HomeContainer').remove();history.pushState({},'', '/users/123/profile');dispatchEvent(new PopStateEvent('popstate'));mountMenu('compact')");
    assert.equal((await snapshot()).radius, '5px', 'The Home fix does not restyle friend menus on other pages');
    assert.deepEqual(browser.errors, []);
  });
