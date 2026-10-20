const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/runtime.js',
  'src/shared/native-labels.js', 'src/shared/i18n.js', 'src/shared/startup.js', 'src/settings/settings.js'];
const styles = [...new Set(JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'))
  .content_scripts.flatMap(entry => entry.css || []))];
const locales = {
  en: ['Favorites', 'Standout Games', 'Recommended For You', 'Recommended Games', 'Settings'],
  'zh-cn': ['收藏夹', '精选游戏', '推荐给您', '推荐游戏', '设置'],
  'zh-tw': ['最愛', '精選遊戲', '推薦給您', '推薦遊戲', '設定'],
  id: ['Favorit', 'Game Unggulan', 'Direkomendasikan untukmu', 'Direkomendasikan', 'Pengaturan'],
  ko: ['즐겨찾기', '주목할 게임', '이런 건 어떠세요', '이런 건 어떠세요', '설정']
};

function fixture(locale) {
  const labels = locales[locale];
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
    <meta name="locale-data" data-language-code="${locale.replace('-', '_')}">
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <style>body{font:16px Arial;margin:16px}#settings-popover-menu{position:fixed;right:0;top:0;z-index:1000}#HomeContainer .game-sort-carousel-wrapper{display:block!important}</style>
    </head><body><ul id="settings-popover-menu"><li><a href="/${locale}/my/account">${labels[4]}</a></li></ul>
    <main id="HomeContainer"><div id="sorts"></div><section id="continue"><h2>Continue</h2><a class="game-card-container" href="https://www.roblox.com/${locale}/games/900/Game">${labels[2]}</a></section></main>
    <script>
      const listeners=[];
      const read=()=>JSON.parse(localStorage.getItem('customBackground')||'null')||{source:'none',hideFavorites:true,hideStandoutGames:true,hideRecommendedUpper:true,hideRecommendedLower:false};
      window.chrome={i18n:{getUILanguage:()=> '${locale}'},storage:{local:{async get(){return {customBackground:read()}},async set(patch){localStorage.setItem('customBackground',JSON.stringify(patch.customBackground));listeners.forEach(fn=>fn({customBackground:{newValue:patch.customBackground}},'local'))},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
      const labels=${JSON.stringify(labels)};
      const card=id=>'<div class="hover-game-tile grid-item-container"><div class="game-card-container"><a href="https://www.roblox.com/${locale}/games/'+id+'/Game"><h3 class="game-card-name">'+labels[2]+'</h3></a></div></div>';
      const row=(id,title,marker,grid)=>'<div id="'+id+'" class="game-sort-carousel-wrapper" '+(marker?'data-testid="home-page-game-grid"':'')+'><div class="container-header"><div data-testid="section-header-title-subtitle-container"><h2>'+title+'</h2>'+(${JSON.stringify(locale)}==='ko'&&id==='standout'?'<p>Roblox의 미래를 만들어가는 선별된 게임</p>':'')+'</div></div><div class="'+(grid?'game-grid home-game-grid wide-game-tile-game-grid':'game-carousel')+'">'+card(id==='upper'?101:id==='lower'?201:301)+'</div></div>';
      window.render=(marker=true,lowerFirst=false,sharedTitle=false)=>{
        const upper=row('upper',sharedTitle?labels[3]:labels[2],marker,true),lower=row('lower',labels[3],marker,true);
        document.getElementById('sorts').innerHTML=row('favorites',labels[0],false,false)+row('standout',labels[1],false,false)+(lowerFirst?lower+upper:upper+lower);
      };render();
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

for (const locale of Object.keys(locales)) test(`${locale}: upper recommendations can be a multi-row grid without changing any Home switch`,
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(files.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture(locale));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'home-visibility-locales');
    const url = `http://127.0.0.1:${server.address().port}/${locale}/home`;
    const ready = "!!document.querySelector('.rc-settings-menu-entry') && !!document.querySelector('#upper .rc-hide-recommended-game') && !!document.querySelector('#lower .rc-hide-recommended-game')";
    const visibility = () => browser.evaluate("['favorites','standout','upper','lower','continue'].map(id=>document.getElementById(id).checkVisibility())");
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.waitFor(ready);
    assert.deepEqual(await visibility(), [false, false, false, true, true],
      'The existing upper preference hides Recommended For You even with native grid wrappers');
    for (const marker of [false, true]) for (const lowerFirst of [true, false]) {
      await browser.evaluate(`render(${marker},${lowerFirst})`);
      await browser.waitFor(ready);
      assert.deepEqual(await visibility(), [false, false, lowerFirst, !lowerFirst, true],
        'Upper and lower follow page order even when titles or native wrapper IDs are reused');
    }
    await browser.evaluate('render(true,false,true)');
    await browser.waitFor(ready);
    assert.deepEqual(await visibility(), [false, false, false, true, true],
      'Identical generic recommendation titles must not send both regions to the lower switch');
    await browser.click('.rc-settings-menu-entry');
    for (const control of ['#rc-hide-favorites', '#rc-hide-standout-games', '#rc-hide-recommended-upper', '#rc-hide-recommended-lower']) {
      await browser.click(control);
    }
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).hideRecommendedUpper===false && JSON.parse(localStorage.getItem('customBackground')).hideRecommendedLower===true");
    assert.deepEqual(await visibility(), [true, true, true, false, true]);
    await browser.click('#rc-hide-recommended-upper');
    assert.deepEqual(await visibility(), [true, true, false, false, true], 'Both recommendation regions can be hidden together');
    await browser.click('#rc-hide-recommended-lower');
    assert.deepEqual(await visibility(), [true, true, false, true, true], 'The upper switch stays independent of the lower switch');
    await browser.click('#rc-hide-recommended-upper');
    assert.deepEqual(await visibility(), [true, true, true, true, true], 'Both regions restore when both switches are off');
    await browser.click('#rc-hide-recommended-lower');
    assert.deepEqual(await visibility(), [true, true, true, false, true]);
    await browser.click('#rc-done');
    await browser.send('Page.reload');
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.waitFor(ready);
    assert.deepEqual(await visibility(), [true, true, true, false, true]);
    assert.equal(await browser.evaluate("!!document.querySelector('#continue .rc-hide-recommended-game')"), false);
    assert.deepEqual(browser.errors, []);
  });
