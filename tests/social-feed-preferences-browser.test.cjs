const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/runtime.js', 'src/shared/i18n.js', 'src/shared/startup.js',
  'src/settings/settings.js', 'src/pages/games/game-page.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css', 'src/pages/games/game-page.css'];

function fixture() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>*{box-sizing:border-box}body{margin:16px;font:16px Arial;background:#24252c;color:white}
    main{width:min(700px,100%);margin:auto;padding:20px}h1{font-size:24px}a{color:inherit}
    #settings-popover-menu{position:fixed;top:0;right:0;z-index:1000;list-style:none}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head>
    <body class="dark-theme"><ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul>
    <div id="content"></div><script>
      const listeners=[];
      const read=()=>JSON.parse(localStorage.getItem('customBackground')||'null')||{source:'none',hideXFeed:true,hideYouTubeFeed:false};
      window.requests=[];
      window.externalSettings=value=>{
        localStorage.setItem('customBackground',JSON.stringify(value));
        listeners.forEach(fn=>fn({customBackground:{newValue:value}},'local'));
      };
      window.chrome={storage:{local:{async get(){return {customBackground:read()}},
        async set(value){externalSettings(value.customBackground)}},onChanged:{addListener:fn=>listeners.push(fn)}},
        runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
          requests.push(message);
          setTimeout(()=>callback(message.type==='rc-community-social-links'
            ?{xUrl:'https://x.com/creator_test',youtubeUrl:'https://www.youtube.com/@CreatorTest'}
            :message.type==='rc-x-posts'?{posts:[]}
            :message.type==='rc-youtube-videos'?{videos:[],channelTitle:'Creator Test'}:{error:'Unavailable in fixture'}),0);
        }}};
      window.goPage=kind=>{
        const routes={game:'/games/71/Test',community:'/communities/72/Test',profile:'/users/73/profile'};
        history.pushState(null,'',routes[kind]);
        document.getElementById('content').innerHTML=kind==='game'
          ?'<main id="game-detail-page" data-place-id="71"><h1>Game</h1><div id="about"><div class="social-links"><a href="https://x.com/creator_test">X</a><a href="https://www.youtube.com/@CreatorTest">YouTube</a></div></div></main>'
          :kind==='community'?'<main id="group-container"><div class="group-details"><div class="group-profile-header"><h1>Community</h1></div><div class="rbx-tabs-horizontal">About</div></div></main>'
          :'<main id="profile-container" data-rc-profile-social-user-id="73" data-rc-profile-x-url="https://x.com/creator_test" data-rc-profile-youtube-url="https://www.youtube.com/@CreatorTest"><div class="profile-header"><h1>Profile</h1></div><div data-rc-profile-section="collections">Collections</div></main>';
        dispatchEvent(new PopStateEvent('popstate'));
      };
      goPage(location.pathname.startsWith('/users/')?'profile':location.pathname.startsWith('/communities/')?'community':'game');
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Social feed switches persist independently by page, update live, and fit English and Chinese settings',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js')
        ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(files.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(Number(process.env.SOCIAL_FEEDS_TEST_PORT || 0), '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'social-feed-preferences');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    await browser.send('Page.navigate', { url: `${origin}/games/71/Test` });
    await browser.send('Page.bringToFront');
    await waitForDocument(browser, '#game-detail-page', `${origin}/games/71/Test`);
    const state = async (kind, x, youtube) => browser.waitFor(`(()=>{
      const panels=['rc-x-feed-panel','rc-youtube-feed-panel'].map(id=>document.getElementById(id));
      return !!panels[0]===${x} && !!panels[1]===${youtube}
        && panels.filter(Boolean).every(panel=>panel.dataset.contextKey.startsWith('${kind}:'));
    })()`);
    const navigate = async (kind, x, youtube) => {
      await browser.evaluate(`goPage('${kind}')`); await state(kind, x, youtube);
    };
    const toggle = async (kind, platform, x, youtube) => {
      await browser.click(`#rc-show-${kind}-${platform}-feed`); await state(kind, x, youtube);
    };
    await state('game', false, true);
    await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("document.querySelectorAll('.rc-settings-feed-group input').length===6");
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.rc-settings-feed-group input')].map(input=>input.checked)"),
      [true, false, true, false, true, false], 'Existing global visibility migrates to each page type');
    assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-background-active')"), false);
    await toggle('game', 'x', true, true);
    await toggle('game', 'youtube', true, false);
    await navigate('community', false, true);
    await toggle('community', 'x', true, true);
    await toggle('community', 'youtube', true, false);
    await toggle('community', 'youtube', true, true);
    await navigate('profile', false, true);
    await toggle('profile', 'x', true, true);
    await toggle('profile', 'x', false, true);
    await toggle('profile', 'youtube', false, false);
    const expected = {showGameYouTubeFeed:false,showGameXFeed:true,
      showCommunityYouTubeFeed:true,showCommunityXFeed:true,showProfileYouTubeFeed:false,showProfileXFeed:false};
    await browser.waitFor(`Object.entries(${JSON.stringify(expected)}).every(([key,value])=>JSON.parse(localStorage.getItem('customBackground'))[key]===value)`);
    assert.equal(await browser.evaluate("Object.hasOwn(JSON.parse(localStorage.getItem('customBackground')),'hideXFeed')"), false);
    assert.equal(await browser.evaluate("Object.hasOwn(JSON.parse(localStorage.getItem('customBackground')),'hideYouTubeFeed')"), false);
    assert.equal(await browser.evaluate("document.querySelector('#profile-container').hasAttribute('data-rc-profile-feed-layout')"), false);

    const legends = {en:['Game pages','Community pages','Profile pages'],
      'zh-CN':['游戏页面','社群页面','个人资料页面'],'zh-TW':['遊戲頁面','社群頁面','個人檔案頁面']};
    for (const [locale, labels] of Object.entries(legends)) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage('${locale}')`);
      await browser.waitFor(`JSON.stringify([...document.querySelectorAll('.rc-settings-feed-group legend')].map(node=>node.textContent))===${JSON.stringify(JSON.stringify(labels))}`);
      const enable = locale==='en'?'Enable X feed':locale==='zh-CN'?'启用 X 动态':'啟用 X 動態';
      assert.equal(await browser.evaluate("document.querySelector('label[for=rc-show-game-x-feed]').textContent.trim()"), enable);
      for (const theme of ['light', 'dark']) for (const width of [1280, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.body.className='${theme}-theme'`);
        const layout = await browser.evaluate(`(()=>{
          const dialog=document.querySelector('.rc-settings-dialog'),section=document.querySelector('.rc-settings-social');
          return {overflow:dialog.scrollWidth>dialog.clientWidth+1||section.scrollWidth>section.clientWidth+1||document.documentElement.scrollWidth>innerWidth,
            controls:[...section.querySelectorAll('input')].map(input=>{
              const r=input.getBoundingClientRect(),label=input.parentElement.getBoundingClientRect(),group=input.closest('fieldset').getBoundingClientRect();
              return r.width>=12&&r.height>=12&&label.left>=group.left&&label.right<=group.right+1;
            }),color:getComputedStyle(section).color};
        })()`);
        assert.equal(layout.overflow, false, `${locale}/${theme}/${width}: no overflow`);
        assert.ok(layout.controls.every(Boolean), `${locale}/${theme}/${width}: six visible controls fit their groups`);
        assert.notEqual(layout.color, 'rgba(0, 0, 0, 0)');
      }
    }
    await browser.click('#rc-done');
    await browser.send('Page.reload'); await browser.send('Page.bringToFront');
    await waitForDocument(browser, '#profile-container', `${origin}/users/73/profile`);
    await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')"); await pause(700);
    await state('profile', false, false);
    assert.equal(await browser.evaluate("requests.some(message=>['rc-x-posts','rc-youtube-videos','rc-community-social-links'].includes(message.type))"), false,
      'The startup cache prevents disabled profile feeds from loading after a reload');
    await navigate('game', true, false);
    await navigate('community', true, true);
    await navigate('profile', false, false);
    await browser.click('.rc-settings-menu-entry');
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.rc-settings-feed-group input')].map(input=>input.checked)"),
      [false, true, true, true, false, false]);
    await browser.evaluate("externalSettings({...JSON.parse(localStorage.getItem('customBackground')),showProfileXFeed:true,showCommunityYouTubeFeed:false,_writer:'another-tab'})");
    await state('profile', true, false);
    assert.deepEqual(await browser.evaluate("[document.querySelector('#rc-show-profile-x-feed').checked,document.querySelector('#rc-show-community-youtube-feed').checked]"), [true, false]);
    await navigate('community', true, false);
    assert.deepEqual(browser.errors, []);
  });
