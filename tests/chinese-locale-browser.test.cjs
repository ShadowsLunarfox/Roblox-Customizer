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
const locales = {
  'zh-cn': { favorites: '收藏夹', standout: '精选游戏', recommended: '推荐给您', lower: '推荐游戏',
    settings: '设置', public: '其他服务器', sort: '排序方式', exclude: '排除已满的服务器', more: '加载更多',
    configure: '配置', join: '加入', passes: '通行证', products: '开发者商品', subscriptions: '订阅', active: '活跃玩家',
    avatar: ['最近', '虚拟形象', '身体', '服装', '配饰', '动画'], hair: '头发', preview: '切换至 2D 视图', tryOn: '试戴',
    profile: ['当前穿戴', '体验', '好友', '社区', '徽章'], about: '关于', creations: '创作' },
  'zh-tw': { favorites: '最愛', standout: '精選遊戲', recommended: '推薦給您', lower: '推薦遊戲',
    settings: '設定', public: '其他伺服器', sort: '排序依據', exclude: '排除已滿的伺服器', more: '載入更多',
    configure: '設定', join: '加入', passes: '通行證', products: '開發者商品', subscriptions: '訂閱', active: '活躍玩家',
    avatar: ['最近', '虛擬形象', '身體', '服裝', '配飾', '動畫'], hair: '頭髮', preview: '切換至 2D 視圖', tryOn: '試戴',
    profile: ['目前穿戴', '體驗', '好友', '社區', '徽章'], about: '介紹', creations: '作品' }
};
const setup = `
  const listeners=[];window.privateRequests=[];window.nativeJoins=0;window.nativeClicks=0;
  window.nativeCatalogToggle=button=>{
    nativeClicks++;
    const holder=document.querySelector('.thumbnail-holder');const canvas=holder.querySelector('canvas');
    holder.innerHTML=canvas?'<img src="/image.svg">':'<canvas width="300" height="300"></canvas>';
    button.setAttribute('aria-label',canvas?button.dataset.mode3:button.dataset.mode2);
  };
  window.chrome={storage:{local:{async get(){return {customBackground:{source:'none',hideFavorites:true,hideRecommendedUpper:true,hideRecommendedLower:false,hideXFeed:true,hideYouTubeFeed:true}}},async set(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
    if(message.type==='rc-private-server-details'){privateRequests.push(callback);return}
    const response=message.type==='rc-home-user'?{id:1,name:'Player',displayName:'Player',imageUrl:location.origin+'/image.svg'}
      :message.type==='rc-currency-rates'?{ok:true,date:'2026-10-10',rates:{USD:1,MYR:4.1}}
      :message.type==='rc-pinned-games'?{ok:true,games:[]}: {error:'No optional fixture data'};
    setTimeout(()=>callback(response),10);
  }}};
`;
const card = (id, name) => `<li class="game-card-container"><a class="game-card-link" href="https://www.roblox.com/games/${id}/Game"><img src="/image.svg"><div class="game-card-name">${name}</div></a></li>`;
function html(route, locale) {
  const l = locales[locale];
  let content;
  if (route === '/home') content = `<main id="HomeContainer"><h1>Home</h1>${['favorites', 'standout', 'recommended', 'lower'].map((key, i) => `<section id="${key}"><h2>${l[key]}</h2><ul>${card(i + 100, i === 2 ? l.favorites : '推荐游戏大冒险')}</ul></section>`).join('')}<section id="continue"><h2>Continue</h2><ul>${card(200, l.recommended)}</ul></section></main>`;
  else if (route.startsWith('/games/')) content = `<main id="game-detail-page" data-place-id="4623386862"><section id="about"><ul class="game-stat-container"><li class="game-stat"><span class="text-label">${l.active}</span><span>1.2万</span></li></ul></section><section id="game-instances"><section id="private-server-container"><h2>Private Servers</h2><div id="private-list"><div id="private-row"><div><div class="text-title-medium">私人伺服器</div><img src="/image.svg"><div class="text-body-medium">1/6人</div></div><div><button id="private-join" onclick="nativeJoins++">${l.join}</button><a aria-label="${l.configure}" href="/private-server/configure/${locale === 'zh-cn' ? '111' : '111?source=servers'}">${l.configure}</a></div></div></div><button id="private-more">${l.more}</button></section><section id="running-game-instances-container"><h2>${l.public}</h2><div id="native-controls"><label>${l.sort}<select id="native-sort"><option value="Desc">由多到少</option><option value="Asc">由少到多</option></select></label><label>${l.exclude}<input type="checkbox"></label></div><div class="card-list">${[0, 8, 12].map((count, i) => `<div class="card-item" id="server-${i}"><div class="game-server-status">${count}人（最多20人）</div><button onclick="nativeJoins++">${l.join}</button></div>`).join('')}</div><button id="public-more">${l.more}</button></section></section><section id="store">${['subscriptions', 'passes', 'products'].map(key => `<section id="store-${key}"><h2>${l[key]}</h2><div class="store-cards"><a class="store-card" href="/game-pass/1/Item">商品</a></div></section>`).join('')}</section></main>`;
  else if (route === '/my/avatar') content = `<main id="content"><div class="avatar-editor"><div id="avatar-preview" style="width:300px;height:300px"><canvas width="300" height="300"></canvas><button id="preview-mode" aria-label="${l.preview}"></button></div><div><nav id="avatar-categories"><div id="main-categories">${l.avatar.map((name, i) => `<button id="category-${i}">${name}</button>`).join('')}</div><div class="avatar-subcategories"><button id="hair">${l.hair}</button></div></nav><div class="avatar-items-container"><a class="avatar-item-card" href="/catalog/1/Item"><img src="/image.svg">物品</a></div></div></div></main>`;
  else if (route.startsWith('/catalog/')) content = `<main id="content"><div><div id="item-thumbnail-container-frontend" data-target-id="123" data-show-3d-mode-button="true"><div class="item-details-thumbnail-container"><div class="thumbnail-holder"><img src="/image.svg"></div><div class="thumbnail-ui-container"><button id="catalog-mode" aria-label="${l.preview.replace('2D', '3D')}" data-mode2="${l.preview}" data-mode3="${l.preview.replace('2D', '3D')}" onclick="nativeCatalogToggle(this)"></button><button id="catalog-try-on">${l.tryOn}</button></div></div></div><div id="item-info-container-frontend" data-target-id="123"><h1>物品</h1><button id="catalog-buy" onclick="nativeJoins++">购买</button></div></div></main>`;
  else if (route.startsWith('/users/')) content = `<main id="content"><div id="profile-container"><h1>Player</h1><nav id="profile-tabs"><button>${l.about}</button><button>${l.creations}</button></nav>${l.profile.map((name, i) => `<section id="profile-${i}"><h2>${name}</h2><ul><li>${card(100 + i, '样例体验')}</li></ul></section>`).join('')}</div></main>`;
  else content = `<main id="content"><div id="settings-container"><header><h1>${l.settings}</h1></header><aside><nav><a href="#!/info">账号信息</a><a href="#!/security">安全</a><a href="#!/privacy">隐私</a></nav></aside><div id="plain-settings"><div id="short-copy">管理你的账号。</div><div class="form-group"><label for="native-field">社交网络</label><div><input id="native-field" value="保留我的编辑"></div></div><label><input id="native-radio" type="radio" name="visibility" checked>好友</label><button id="native-save" onclick="nativeClicks++">保存</button></div></div></main>`;
  return `<!doctype html><html lang="${locale}" class="dark-theme"><head><meta charset="utf-8"><meta name="locale-data" data-language-code="${locale.replace('-', '_')}"><style>body{font:16px/1.5 Arial;margin:20px;background:#24252c;color:white}main{max-width:1000px;margin:auto}img{width:100px;height:100px}button{padding:8px}a{color:inherit}h2{font-size:22px}#settings-popover-menu{position:fixed;right:0;top:0}#settings-popover-menu a{display:block;padding:12px}#chat-root{position:fixed;right:0;bottom:0;width:270px}.react-chat-root section{height:180px;border-radius:12px;background:#30343b}#settings-container>aside{width:220px}#plain-settings{margin-left:240px}.ng-hide{display:none!important}</style>${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body><header><span id="nav-robux-amount">1.25${locale === 'zh-cn' ? '万' : '萬'}</span></header><ul role="menu" id="settings-popover-menu"><li><a href="/my/account">${l.settings}</a></li></ul>${content}<div id="chat-root" class="react-chat-root"><section id="native-chat" aria-label="聊天"><button>聊天</button><input data-testid="chat-search-input" placeholder="${locale === 'zh-cn' ? '搜索好友' : '搜尋好友'}"></section></div><div hidden id="native-hidden">隐藏内容</div></body></html>`;
}

test('Chinese native sections, controls and live locale updates work with all content scripts',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...styles, ...scripts, 'icons/icon-48.png']);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'); const file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      if (files.has(file)) { response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/png'); response.end(fs.readFileSync(path.join(workspace, file))); }
      else if (file === 'image.svg') { response.setHeader('Content-Type', 'image/svg+xml'); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#647abb"/></svg>'); }
      else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html(url.pathname, url.searchParams.get('locale') || 'zh-cn')); }
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_SERVER_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'chinese-locale');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file });
    for (const locale of Object.keys(locales)) for (const route of ['/home', '/games/4623386862/Piggy', '/my/avatar', '/catalog/123/Item', '/users/123/profile', '/my/account#!/info']) {
      const target = new URL(route, `http://127.0.0.1:${server.address().port}`); target.searchParams.set('locale', locale);
      await browser.send('Page.navigate', { url: target.href }); await waitForDocument(browser, 'main', target.href);
      await browser.waitFor("!!document.querySelector('#native-chat[data-rc-chat-panel]') && !!document.querySelector('header .rc-robux-equivalent')");
      assert.equal(await browser.evaluate("document.querySelector('#native-hidden').checkVisibility()"), false);
      assert.equal(await browser.evaluate("document.querySelector('header .rc-robux-equivalent').textContent.includes('124.75')"), true, 'Chinese compact Robux converts to the correct amount');
      if (route === '/home') {
        await browser.waitFor("document.querySelector('#lower').dataset.rcRecommendedSection==='lower'");
        assert.deepEqual(await browser.evaluate("['favorites','recommended','lower','continue'].map(id=>document.getElementById(id).checkVisibility())"), [false, false, true, true]);
        assert.equal(await browser.evaluate("document.querySelector('#continue .rc-hide-recommended-game')===null"), true, 'A game title cannot be mistaken for a section');
        const other = locales[locale === 'zh-cn' ? 'zh-tw' : 'zh-cn'];
        await browser.evaluate(`document.querySelector('#lower h2').firstChild.data=${JSON.stringify(other.lower)};document.querySelector('#favorites h2').firstChild.data=${JSON.stringify(other.favorites)};document.documentElement.lang=${JSON.stringify(locale === 'zh-cn' ? 'zh-tw' : 'zh-cn')}`);
        await browser.waitFor("document.querySelector('#favorites').dataset.rcHomeSection==='favorites' && document.querySelector('#lower').dataset.rcRecommendedSection==='lower'");
        await browser.evaluate("document.querySelector('#lower h2').textContent='';document.querySelector('#lower h2').setAttribute('aria-label','等待加载')");
        await browser.waitFor("!document.querySelector('#lower').hasAttribute('data-rc-recommended-section')");
        await browser.evaluate("document.querySelector('#lower h2').setAttribute('aria-label','為你推薦')");
        await browser.waitFor("document.querySelector('#lower').dataset.rcRecommendedSection==='lower'");
      } else if (route.startsWith('/games/')) {
        await browser.waitFor('privateRequests.length===1');
        assert.equal(await browser.evaluate("document.querySelector('#private-row').checkVisibility()"), false);
        await browser.evaluate("privateRequests[0]({servers:[{id:111,name:'私人伺服器',ownerName:'拥有者',playing:1,maxPlayers:6,playerImages:[]}],uniqueNames:['私人伺服器']})");
        await browser.waitFor("document.querySelector('#private-row').hasAttribute('data-rc-private-server-ready')");
        assert.equal(await browser.evaluate("document.querySelector('#private-row').checkVisibility()"), true);
        await browser.click('#private-join'); assert.equal(await browser.evaluate('nativeJoins'), 1);
        await browser.waitFor("document.querySelectorAll('[data-rc-store-section-title]').length===3 && !!document.querySelector('[data-rc-live-players]')");
        assert.equal(await browser.evaluate("document.querySelector('#private-more').checkVisibility()"), false);
        assert.equal(await browser.evaluate("document.querySelector('#native-controls').checkVisibility()"), false);
        await browser.evaluate("const input=document.querySelector('[data-rc-server-filter=\"minPlayers\"]');input.value='8';input.dispatchEvent(new Event('input',{bubbles:true}))");
        await browser.waitFor("document.querySelector('#server-0').hasAttribute('data-rc-server-filtered')");
        assert.deepEqual(await browser.evaluate("[0,1,2].map(i=>document.querySelector('#server-'+i).checkVisibility())"), [false, true, true]);
        assert.equal(await browser.evaluate("document.querySelector('#native-sort').hasAttribute('data-rc-native-server-sort')"), true);
      } else if (route === '/my/avatar') {
        await browser.waitFor("document.querySelectorAll('[data-rc-avatar-main-control]').length===6 && document.querySelector('#hair').hasAttribute('data-rc-avatar-sub-control')");
        assert.equal(await browser.evaluate("document.querySelector('#preview-mode').hasAttribute('data-rc-avatar-native-2d-toggle')"), true);
        await browser.evaluate("document.querySelector('#category-3').firstChild.data='未知分类'");
        await browser.waitFor("!document.querySelector('#category-3').hasAttribute('data-rc-avatar-main-control')");
        await browser.evaluate("document.querySelector('#category-3').setAttribute('aria-label','服裝選單')");
        await browser.waitFor("document.querySelector('#category-3').hasAttribute('data-rc-avatar-main-control')");
      } else if (route.startsWith('/catalog/')) {
        await browser.waitFor("!!document.querySelector('.thumbnail-holder canvas') && !!document.querySelector('#catalog-try-on[data-rc-item-native-try-on]') && !document.querySelector('#rc-catalog-item-3d-refresh').disabled");
        assert.equal(await browser.evaluate('nativeClicks'), 1);
        await browser.click('#rc-catalog-item-3d-refresh');
        await browser.waitFor("nativeClicks===3 && !!document.querySelector('.thumbnail-holder canvas') && !document.querySelector('#rc-catalog-item-3d-refresh').disabled");
        await browser.click('#catalog-buy'); assert.equal(await browser.evaluate('nativeJoins'), 1);
      } else if (route.startsWith('/users/')) {
        await browser.waitFor("document.querySelectorAll('[data-rc-profile-section]').length===5");
        assert.equal(await browser.evaluate("document.querySelector('#profile-tabs').hasAttribute('data-rc-profile-native-tabs')"), true);
        assert.deepEqual(await browser.evaluate("[0,1,2,3,4].map(i=>document.querySelector('#profile-'+i).dataset.rcProfileSection)"), ['wearing', 'experiences', 'friends', 'communities', 'badges']);
        await browser.evaluate("document.querySelector('#profile-2 h2').firstChild.data='好友（200）'");
        await pause(200); assert.equal(await browser.evaluate("document.querySelector('#profile-2').dataset.rcProfileSection"), 'friends');
      } else {
        await browser.waitFor("document.querySelector('#plain-settings').hasAttribute('data-rc-settings-body')");
        assert.equal(await browser.evaluate("document.querySelectorAll('[data-rc-settings-surface]').length"), 1);
        assert.equal(await browser.evaluate("document.querySelector('#native-field').getBoundingClientRect().width>200"), true);
        await browser.click('#native-save'); assert.equal(await browser.evaluate('nativeClicks'), 1);
        assert.equal(await browser.evaluate("document.querySelector('#native-field').value"), '保留我的编辑');
      }
      // The shared runtime must notify features for a metadata-only locale change.
      await browser.evaluate("window.localeSyncs=0;RobloxCustomizerRuntime.onResume(()=>localeSyncs++);document.querySelector('meta[name=locale-data]').setAttribute('data-language-code','en_us')");
      await browser.waitFor('localeSyncs===1');
    }
    assert.deepEqual(browser.errors, []);
  });
