const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts.flatMap(entry => entry.js || []);
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const setup = `
  const listeners=[];window.privateRequests=[];
  const games=[{placeId:4623386862,universeId:123,name:'Search',iconUrl:''}];
  const read=()=>({customBackground:{source:'none',glassBlur:22,glassOpacity:62},pinnedGames:games,...JSON.parse(localStorage.getItem('preferences')||'{}')});
  window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{
    async get(){return read()},async set(value){const previous=read();localStorage.setItem('preferences',JSON.stringify({...previous,...value}));listeners.forEach(fn=>fn(Object.fromEntries(Object.entries(value).map(([key,newValue])=>[key,{oldValue:previous[key],newValue}])),'local'))}
  },onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
    if(message.type==='rc-private-server-details'){privateRequests.push(callback);return}
    const response=message.type==='rc-home-user'?{id:1,name:'Refresh',displayName:'Favorites',imageUrl:location.origin+'/image.svg'}
      :message.type==='rc-currency-rates'?{ok:true,date:'2026-10-10',rates:{USD:1,MYR:4.1,CNY:7,HKD:7.8}}
      :message.type==='rc-pinned-games'?{ok:true,games}
      :message.type==='rc-profile-details'?{id:123,name:'Refresh',description:'Search',created:'2020-01-01',verified:true,formerNames:['Refresh','Store','Country'],socialChannels:{twitter:'https://x.com/Refresh'}}
      :message.type==='rc-profile-limiteds'?{items:[{assetId:456,name:'Store',rap:100,quantity:2}],totalRap:200,copies:2,unpricedCopies:0}
      :message.type==='rc-x-posts'?{posts:[{id:'123456',text:'Refresh',createdAt:'2026-10-10T00:00:00Z'}]}
      :message.type==='rc-catalog-item-2d'||message.type==='rc-avatar-2d'?{state:'Completed',imageUrl:location.origin+'/image.svg'}
      :{error:'No optional fixture data'};
    setTimeout(()=>callback(response),10);
  }}};
  window.catalogToggle=button=>{
    const holder=document.querySelector('.thumbnail-holder');const was3D=!!holder.querySelector('canvas');
    holder.innerHTML=was3D?'<img src="/image.svg">':'<canvas width="300" height="300"></canvas>';
    button.setAttribute('aria-label',was3D?'Switch to 3D view':'Switch to 2D view');
  };
`;
const card = id => `<li class="game-card-container"><a class="game-card-link" href="https://www.roblox.com/games/${id}/Search"><img src="/image.svg"><div class="game-card-name">Search</div></a></li>`;
function fixture(route, lang) {
  let content;
  if (route === '/home') content = `<main id="HomeContainer"><h1>Home</h1><section class="friend-carousel-container"><h2>Friends</h2></section><section id="recommendations"><h2>Recommended For You</h2><ul>${card(100)}</ul></section></main>`;
  else if (route.startsWith('/games/')) content = `<main id="game-detail-page" data-place-id="4623386862"><div id="game-detail-meta-data" data-place-id="4623386862" data-universe-id="123"></div><h1>Search</h1><ul><li><button id="toggle-game-favorite">Favorite</button></li></ul><section id="about"><div class="social-links"><a href="https://x.com/Refresh">X</a></div></section><section id="game-instances"><section id="private-server-container"><h2>Private Servers</h2><div id="private-list"><div id="private-row"><div><div class="text-title-medium">Search</div><img src="/image.svg"><div class="text-body-medium">1/6 people</div></div><div><button>Join</button><a href="/private-server/configure/111">Configure</a></div></div></div></section><section id="running-game-instances-container"><h2>Other Servers</h2><div class="card-list">${[0, 8, 12].map((count, i) => `<div class="card-item" id="server-${i}"><div class="game-server-status">${count} of 20 people max</div><button>Join</button></div>`).join('')}</div></section></section></main>`;
  else if (route.startsWith('/users/')) content = `<main id="content"><div id="profile-container"><h1>Refresh</h1><div id="bio"><pre class="description-content">Search</pre><button class="more-btn">More</button></div><nav><button>About</button><button>Creations</button></nav><section><h2>Friends</h2></section><section><h2>Badges</h2></section></div></main>`;
  else content = `<main id="content"><div><div id="item-thumbnail-container-frontend" data-target-id="123" data-show-3d-mode-button="true"><div class="item-details-thumbnail-container"><div class="thumbnail-holder"><img src="/image.svg"></div><div class="thumbnail-ui-container"><button id="catalog-mode" aria-label="Switch to 3D view" onclick="catalogToggle(this)"></button><button>Try On</button></div></div></div><div id="item-info-container-frontend" data-target-id="123"><h1>Store</h1><button>Buy</button></div></div></main>`;
  return `<!doctype html><html lang="${lang}" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="locale-data" data-language-code="${lang}"><style>body{margin:20px;font:16px/1.5 Arial;background:#24252c;color:white}main{max-width:1000px;margin:auto}a{color:inherit}button{padding:8px}img{width:100px;height:100px}#settings-popover-menu{position:fixed;right:0;top:0;z-index:1000}#settings-popover-menu a{display:block;padding:12px}.ng-hide{display:none!important}</style>${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body><header><span id="nav-robux-amount">12500</span></header><ul id="settings-popover-menu" role="menu"><li><a href="/my/account">Settings</a></li></ul><p id="native-copy">Refresh</p>${content}</body></html>`;
}

test('Extension UI switches between English and both Chinese variants without losing controls or translating user content',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      if (files.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'image/png');
        response.end(fs.readFileSync(path.join(workspace, file)));
      } else if (file === 'image.svg') {
        response.setHeader('Content-Type', 'image/svg+xml'); response.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#647abb"/></svg>');
      } else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture(url.pathname, url.searchParams.get('lang') || 'en')); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'ui-languages');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file });
    const navigate = async (route, lang = 'en') => {
      const url = `http://127.0.0.1:${server.address().port}${route}?lang=${lang}`;
      await browser.send('Page.navigate', { url }); await waitForDocument(browser, 'main', url);
      await browser.waitFor("!!document.querySelector('.rc-settings-menu-entry')");
    };
    const change = async (selector, value, event = 'change') => {
      await browser.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('${event}',{bubbles:true}))})()`);
    };
    const text = selector => browser.evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent.trim()`);
    const locale = async value => {
      await change('#rc-ui-language', value);
      await browser.waitFor(`RobloxCustomizerI18n.preference()===${JSON.stringify(value)}`);
    };
    await navigate('/home');
    await browser.waitFor("!!document.querySelector('#rc-pinned-games .rc-pinned-game-details') && !!document.querySelector('.rc-hide-recommended-game')");
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-currency-select option[value=\"CNY\"]')");
    await change('#rc-greeting-morning', 'Hide', 'input');
    await change('#rc-currency-select', 'CNY');
    await change('#rc-currency-search', 'CNY', 'input');
    await change('#rc-glass-blur', '32', 'input');
    const labels = {
      'zh-CN': ['Roblox 自定义工具', '扩展语言', '关闭', '隐藏上方推荐游戏', '货币名称或代码', '置顶游戏', '隐藏'],
      'zh-TW': ['Roblox 自訂工具', '擴充功能語言', '關閉', '隱藏上方推薦遊戲', '貨幣名稱或代碼', '釘選遊戲', '隱藏'],
      en: ['Roblox Customizer', 'Extension language', 'Close', 'Hide upper Recommended Games', 'Currency name or code', 'Pinned Games', 'Hide']
    };
    for (const language of ['zh-CN', 'zh-TW', 'en', 'zh-TW']) {
      await locale(language);
      await browser.waitFor(`document.querySelector('#rc-settings-title').textContent===${JSON.stringify(labels[language][0])}`);
      assert.deepEqual(await browser.evaluate(`[
        document.querySelector('#rc-settings-title').textContent,
        document.querySelector('label[for="rc-ui-language"]').textContent,
        document.querySelector('#rc-close').getAttribute('aria-label'),
        document.querySelector('label[for="rc-hide-recommended-upper"]').textContent.trim(),
        document.querySelector('#rc-currency-search').placeholder,
        document.querySelector('#rc-pinned-games-title').textContent,
        document.querySelector('.rc-hide-recommended-game').textContent
      ]`), labels[language]);
      assert.deepEqual(await browser.evaluate("[document.querySelector('#rc-greeting-morning').value,document.querySelector('#rc-currency-select').value,document.querySelector('#rc-currency-search').value,document.querySelector('#rc-glass-blur').value]"), ['Hide', 'CNY', 'CNY', '32']);
      assert.equal(await text('#rc-pinned-games .rc-pinned-game-details h3'), 'Search');
      assert.equal(await text('#native-copy'), 'Refresh');
      assert.equal(await text('.game-card-name'), 'Search');
      assert.equal(await browser.evaluate("document.querySelector('#rc-currency-select option:checked').textContent"), await browser.evaluate(`'CNY — '+new Intl.DisplayNames('${language}',{type:'currency'}).of('CNY')`));
      for (const theme of language === 'en' ? [] : ['dark', 'light']) for (const width of [1280, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.documentElement.className='${theme}-theme'`);
        const layout = await browser.evaluate(`(()=>{
          const dialog=document.querySelector('.rc-settings-dialog'), language=document.querySelector('.rc-settings-language');
          const rows=['rc-glass-blur','rc-glass-opacity'].map(id=>{const a=document.querySelector('label[for="'+id+'"]').getBoundingClientRect(),b=document.getElementById(id).getBoundingClientRect();return [a.right<b.left,Math.abs(a.top+a.height/2-b.top-b.height/2)<2]});
          return {overflow:dialog.scrollWidth>dialog.clientWidth+1||language.scrollWidth>language.clientWidth+1,rows};
        })()`);
        assert.equal(layout.overflow, false, `${language}/${theme}/${width}: labels and fields fit`);
        assert.deepEqual(layout.rows, [[true, true], [true, true]], 'Translated slider labels stay beside their sliders');
      }
      // Native updates (including the Home clock) must not rewrite settled
      // currency text back to English and start another translation cycle.
      await pause(250);
      await browser.evaluate(`window.currencyWrites=[];window.currencyObserver=new MutationObserver(records=>{
        for(const record of records){const element=record.target.nodeType===1?record.target:record.target.parentElement;
          if(element?.closest('.rc-settings-currency,.rc-robux-equivalent'))currencyWrites.push({type:record.type,target:element.outerHTML});}
      });currencyObserver.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title']})`);
      await pause(1300);
      const currencyWrites = await browser.evaluate('currencyObserver.disconnect();currencyWrites');
      assert.equal(currencyWrites.length, 0, `${language}: currency displays stay stable while the page updates: ${JSON.stringify(currencyWrites.slice(0, 5))}`);
      await browser.evaluate("document.querySelector('#nav-robux-amount').textContent='12600'");
      await browser.waitFor("document.querySelector('header .rc-robux-equivalent').textContent.endsWith('880.24 CNY') && document.querySelector('[data-currency-preview]').textContent.endsWith('880.24 CNY')");
      await browser.evaluate("chrome.storage.local.set({robuxCurrencyRates:{date:'2026-10-11',rates:{USD:1,CNY:8,MYR:4.1}}})");
      await browser.waitFor("document.querySelector('header .rc-robux-equivalent').textContent.endsWith('1,005.98 CNY') && document.querySelector('[data-currency-preview]').textContent.endsWith('1,005.98 CNY')");
      assert.equal(await text('[data-currency-status]'), await browser.evaluate("RobloxCustomizerI18n.t('Exchange rates: 2026-10-11')"));
      assert.equal(await browser.evaluate("document.querySelectorAll('header .rc-robux-equivalent').length"), 1, 'A real rate update keeps the existing currency label');
      await browser.evaluate("document.querySelector('#nav-robux-amount').textContent='12500';chrome.storage.local.set({robuxCurrencyRates:{date:'2026-10-10',rates:{USD:1,CNY:7,MYR:4.1}}})");
      await browser.waitFor("document.querySelector('[data-currency-preview]').textContent.endsWith('873.25 CNY')");
    }
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.reload'); await waitForDocument(browser, '#HomeContainer');
    await browser.waitFor("RobloxCustomizerI18n.locale()==='zh-TW' && !!document.querySelector('.rc-settings-menu-entry')");
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate("document.querySelector('#rc-ui-language').value"), 'zh-TW', 'Manual language persists across reloads');
    assert.equal(await browser.evaluate("document.querySelector('#rc-greeting-morning').value"), 'Hide');
    assert.equal(await browser.evaluate("document.querySelector('#rc-currency-select').value"), 'CNY');
    await browser.evaluate("document.querySelector('meta[name=locale-data]').setAttribute('data-language-code','zh_cn')");
    assert.equal(await text('#rc-settings-title'), 'Roblox 自訂工具', 'A manual choice takes precedence over Roblox');
    await locale('auto');
    await browser.waitFor("document.querySelector('#rc-settings-title').textContent==='Roblox 自定义工具'");
    await browser.evaluate("document.querySelector('meta[name=locale-data]').remove();document.documentElement.lang='zh-TW'");
    await browser.waitFor("document.querySelector('#rc-settings-title').textContent==='Roblox 自訂工具'");
    await browser.evaluate("const meta=document.createElement('meta');meta.name='locale-data';meta.setAttribute('data-language-code','zh-cn');document.head.append(meta)");
    await browser.waitFor("document.querySelector('#rc-settings-title').textContent==='Roblox 自定义工具'");
    await locale('zh-TW'); await browser.click('#rc-done');

    await navigate('/games/4623386862/Piggy');
    await browser.waitFor("!!document.querySelector('.rc-public-server-filter-search') && !!document.querySelector('.rc-game-pin-control') && privateRequests.length===1");
    await browser.waitFor("document.querySelector('.rc-public-server-filter-search').textContent==='搜尋'");
    assert.equal(await text('.rc-game-pin-control'), '取消釘選');
    await browser.evaluate("document.querySelector('#about').insertAdjacentHTML('afterbegin','<div class=\"game-description-container\"><p class=\"game-description\">Search</p></div>')");
    await browser.waitFor("document.querySelector('.rc-rolimons-heading h3')?.textContent==='遊戲資料'");
    assert.equal(await text('.rc-private-server-loading'), '正在載入私人伺服器詳細資料…');
    await browser.evaluate("privateRequests[0]({servers:[{id:111,name:'Search',ownerName:'Hide',playing:1,maxPlayers:6,playerImages:[]}],uniqueNames:['Search']})");
    await browser.waitFor("document.querySelector('#private-row').hasAttribute('data-rc-private-server-ready')");
    assert.equal(await text('.rc-private-server-title'), 'Search');
    assert.equal(await text('.rc-private-server-owner'), 'Hide');
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-server-filter=\"maxPing\"]').getAttribute('aria-label')"), '最高延遲（毫秒）');
    await change('[data-rc-server-filter="minPlayers"]', '8', 'input');
    await browser.waitFor("document.querySelector('#server-0').hasAttribute('data-rc-server-filtered')");
    await browser.click('.rc-public-server-filter-search');
    await browser.waitFor("document.querySelector('.rc-public-server-filter-count').textContent.includes('已載入 2')");
    assert.deepEqual(await browser.evaluate("[0,1,2].map(i=>document.getElementById('server-'+i).checkVisibility())"), [false, true, true]);
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('zh-CN')");
    await browser.waitFor("document.querySelector('.rc-public-server-filter-search').textContent==='搜索'");
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-server-filter=\"minPlayers\"]').value"), '8');
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");
    await browser.waitFor("document.querySelector('.rc-public-server-filter-search').textContent==='Search'");
    assert.equal(await text('.rc-game-pin-control'), 'Unpin Game');
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('zh-TW')");
    await browser.waitFor("document.querySelector('#rc-x-feed-panel .rc-x-feed-post-text')?.textContent==='Refresh'");
    assert.equal(await text('#rc-x-feed-panel .rc-x-feed-retry'), '重新載入貼文');
    assert.equal(await text('#rc-x-feed-panel time'), await browser.evaluate("new Intl.DateTimeFormat('zh-TW',{dateStyle:'medium',timeStyle:'short'}).format(new Date('2026-10-10T00:00:00Z'))"));
    await pause(1200);
    await browser.evaluate(`window.uiWrites=0;window.uiObserver=new MutationObserver(records=>{uiWrites+=records.filter(r=>(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('.rc-public-server-filters,.rc-public-server-pagination,.rc-private-server-summary,.rc-server-metrics,.rc-game-pin-control,#rc-x-feed-panel')).length});uiObserver.observe(document,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label']})`);
    await pause(1500);
    assert.ok(await browser.evaluate('uiWrites<20'), 'Translated features settle without observer feedback loops');
    await browser.evaluate('uiObserver.disconnect()');

    await navigate('/users/123/profile');
    await browser.waitFor("document.querySelector('#rc-profile-details')?.dataset.loaded==='true' && !!document.querySelector('.rc-limited-item-text > strong')");
    await browser.waitFor("document.querySelector('#rc-profile-details h2').textContent==='個人檔案詳細資料'");
    assert.equal(await text('.rc-limited-item-text > strong'), 'Store');
    assert.equal(await text('.description-content'), 'Search');
    assert.equal(await text('#rc-profile-details [data-rc-i18n-ignore]'), 'Refresh, Store, Country');
    assert.equal(await text('.rc-limiteds-summary'), '總 RAP：R$ 200  |  2 件  |  1 種');
    assert.equal(await text('.rc-limited-item-text > span:last-child'), '擁有：2 | 合計 R$ 200');
    assert.equal(await text('#rc-profile-details [data-rc-joined-date]'), await browser.evaluate("new Intl.DateTimeFormat('zh-TW',{year:'numeric',month:'short',day:'numeric'}).format(new Date('2020-01-01'))"));
    await browser.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(value){window.copiedId=value}}})");
    await browser.click('.rc-profile-copy-id');
    await browser.waitFor("document.querySelector('.rc-profile-copy-id').textContent==='已複製'");
    assert.equal(await browser.evaluate('copiedId'), '123');
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('zh-CN')");
    assert.equal(await text('.rc-profile-copy-id'), '已复制');
    await browser.waitFor("document.querySelector('.rc-profile-copy-id').textContent==='复制 ID'");
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");
    assert.equal(await text('#rc-profile-details h2'), 'Profile details');
    assert.equal(await text('.rc-limiteds-refresh'), 'Refresh');
    assert.equal(await text('#rc-profile-details [data-rc-joined-date]'), await browser.evaluate("new Intl.DateTimeFormat('en',{year:'numeric',month:'short',day:'numeric'}).format(new Date('2020-01-01'))"));

    await navigate('/catalog/123/Item');
    await browser.waitFor("!!document.querySelector('.thumbnail-holder canvas') && !document.querySelector('#rc-catalog-item-3d-refresh').disabled");
    await browser.waitFor("document.querySelector('#rc-catalog-item-3d-refresh').textContent==='重新整理'");
    assert.equal(await browser.evaluate("document.querySelector('#rc-catalog-item-3d-refresh').title"), '重新載入 3D 模型');
    await browser.click('#rc-catalog-item-3d-refresh');
    await browser.waitFor("!document.querySelector('#rc-catalog-item-3d-refresh').disabled");
    await browser.waitFor("document.querySelector('#rc-catalog-item-3d-refresh').textContent==='重新整理'");
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");
    assert.equal(await text('#rc-catalog-item-3d-refresh'), 'Refresh');
    assert.equal(await text('#item-info-container-frontend h1'), 'Store');
    assert.deepEqual(browser.errors, []);
  });
