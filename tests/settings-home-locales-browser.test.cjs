const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/runtime.js', 'src/shared/native-labels.js', 'src/shared/startup.js', 'src/settings/settings.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];

function fixture() {
  const card = id => `<li class="game-card-container"><a href="https://www.roblox.com/games/${id}/Game"><h3 class="game-card-name">推薦給您</h3></a></li>`;
  return `<!doctype html><html lang="zh-tw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>*{box-sizing:border-box}body{margin:16px;font:16px Arial;background:#24252c;color:white}a{color:inherit}section{margin:12px 0;padding:12px}ul{list-style:none;padding:0}h2,h3{margin:8px 0}#settings-popover-menu{position:fixed;top:0;right:0;z-index:1000}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme">
    <ul id="settings-popover-menu" role="menu"><li><a href="/my/account">設定</a></li></ul>
    <main id="HomeContainer"><div id="shared-sorts">
      <section id="favorites"><h2><span data-title="favorites">最愛（１２）</span><a href="#all">查看全部 →</a></h2><ul>${card(100)}</ul></section>
      <section id="standout"><h2 data-title="standout">精選遊戲</h2><ul>${card(101)}</ul></section>
      <section id="upper"><h2><span data-title="recommended">推薦給您</span><a href="#all">查看全部 →</a></h2><ul>${card(102)}</ul></section>
      <section id="lower" class="game-grid-container"><h2><span data-title="recommended">推薦給您</span><button aria-label="展開清單">⋯</button></h2><ul>${card(103)}</ul></section>
      <section id="continue"><h2>Continue</h2><ul>${card(104)}</ul></section>
    </div><section class="friend-carousel-container" id="friends"><h2>推薦給您</h2>${card(105)}</section>
    <section id="rc-pinned-games"><h2>推薦給您</h2>${card(106)}</section></main>
    <script>
      const listeners=[];
      const read=()=>JSON.parse(localStorage.getItem('customBackground')||'null')||{source:'none',glassBlur:22,glassOpacity:62,hideFavorites:true,hideStandoutGames:true,hideRecommendedUpper:true,hideRecommendedLower:false};
      window.chrome={storage:{local:{async get(){return {customBackground:read()}},async set(value){localStorage.setItem('customBackground',JSON.stringify(value.customBackground));listeners.forEach(fn=>fn({customBackground:{newValue:value.customBackground}},'local'))}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
      window.setLocale=locale=>{
        const labels=locale==='zh-tw'?{favorites:'最愛（１２）',standout:'精選遊戲',recommended:'推薦給您'}:locale==='zh-cn'?{favorites:'收藏夹（１２）',standout:'精选游戏',recommended:'推荐给您'}:{favorites:'Favorites (12)',standout:'Standout Games',recommended:'Recommended For You'};
        document.querySelectorAll('[data-title]').forEach(node=>node.textContent=labels[node.dataset.title]);
        document.querySelectorAll('h2>a').forEach(node=>node.textContent=locale==='en'?'See All →':'查看全部 →');
        document.documentElement.lang=locale;
      };
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Settings sliders align with their labels and Chinese Home switches persist independently',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const files = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(files.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'settings-home-locales');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const url = `http://127.0.0.1:${server.address().port}/home`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#HomeContainer', url);
    const ready = "document.querySelector('#upper').dataset.rcRecommendedSection==='upper' && document.querySelector('#lower').dataset.rcRecommendedSection==='lower' && !!document.querySelector('.rc-settings-menu-entry')";
    await browser.waitFor(ready);
    const visibility = async (upper, lower) => {
      assert.deepEqual(await browser.evaluate("['favorites','standout','upper','lower','continue','friends','rc-pinned-games','shared-sorts'].map(id=>document.getElementById(id).checkVisibility())"), [false, false, upper, lower, true, true, true, true]);
      assert.equal(await browser.evaluate("!!document.querySelector('#continue .rc-hide-recommended-game')"), false, 'A translated game title cannot classify Continue as recommendations');
    };
    await visibility(false, true);
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay .rc-settings-glass')");
    assert.equal(await browser.evaluate("document.documentElement.hasAttribute('data-rc-background-active')"), false, 'No wallpaper is needed');
    for (const theme of ['light', 'dark']) for (const width of [1280, 390, 320]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await browser.evaluate(`document.body.className='${theme}-theme'`);
      const layout = await browser.evaluate(`(()=>{
        const glass=document.querySelector('.rc-settings-glass'),dialog=document.querySelector('.rc-settings-dialog');
        const rect=n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,center:r.top+r.height/2}};
        return {glass:rect(glass),hint:rect(glass.querySelector('.rc-settings-hint')),rows:['rc-glass-blur','rc-glass-opacity'].map(id=>({label:rect(glass.querySelector('label[for="'+id+'"]')),slider:rect(document.getElementById(id))})),overflow:glass.scrollWidth>glass.clientWidth+1||dialog.scrollWidth>dialog.clientWidth+1||document.documentElement.scrollWidth>innerWidth};
      })()`);
      assert.ok(Math.abs(layout.hint.width - layout.glass.width) < 2, `${theme}/${width}: the hint spans both columns`);
      for (const row of layout.rows) {
        assert.ok(row.label.right < row.slider.left, `${theme}/${width}: the slider is right of its label`);
        assert.ok(Math.abs(row.label.center - row.slider.center) < 2, `${theme}/${width}: the label and slider share a row`);
        assert.ok(row.label.top >= layout.hint.bottom, 'Controls follow the hint');
      }
      assert.ok(layout.rows[0].slider.bottom < layout.rows[1].slider.top, 'Blur precedes opacity');
      assert.equal(layout.overflow, false, `${theme}/${width}: no horizontal overflow`);
    }
    const key = async name => {
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name });
    };
    await browser.click('#rc-glass-blur'); await key('End'); await key('ArrowLeft');
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground'))?.glassBlur===39");
    await browser.click('#rc-glass-opacity'); await key('Home'); await key('ArrowRight');
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).glassOpacity===26");
    assert.deepEqual(await browser.evaluate("[document.querySelector('#rc-glass-blur-value').value,document.querySelector('#rc-glass-opacity-value').value,document.documentElement.style.getPropertyValue('--rc-glass-blur'),document.documentElement.style.getPropertyValue('--rc-glass-opacity')]"), ['39px', '26%', '39px', '0.26']);
    await browser.click('#rc-hide-recommended-upper'); await visibility(true, true);
    await browser.click('#rc-hide-recommended-lower'); await visibility(true, false);
    await browser.click('#rc-hide-recommended-upper'); await visibility(false, false);
    await browser.click('#rc-hide-recommended-lower'); await visibility(false, true);
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).hideRecommendedUpper===true && JSON.parse(localStorage.getItem('customBackground')).hideRecommendedLower===false");
    await browser.click('#rc-done');
    for (const locale of ['zh-cn', 'en', 'zh-tw']) {
      await browser.evaluate(`setLocale('${locale}');document.querySelector('#upper').outerHTML=document.querySelector('#upper').outerHTML;document.querySelector('#lower').outerHTML=document.querySelector('#lower').outerHTML`);
      await browser.waitFor(ready); await visibility(false, true);
    }
    await browser.send('Page.reload'); await waitForDocument(browser, '#HomeContainer', url);
    await browser.waitFor(ready); await visibility(false, true);
    await browser.click('.rc-settings-menu-entry');
    assert.deepEqual(await browser.evaluate("[document.querySelector('#rc-glass-blur').value,document.querySelector('#rc-glass-opacity').value,document.querySelector('#rc-hide-recommended-upper').checked,document.querySelector('#rc-hide-recommended-lower').checked]"), ['39', '26', true, false]);
    assert.deepEqual(browser.errors, []);
  });
