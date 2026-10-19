const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/routes.js', 'src/shared/compatibility.js', 'src/shared/runtime.js',
  'src/shared/native-labels.js', 'src/shared/startup.js', 'src/settings/settings.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];

function fixture() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
    <style>body{font:16px Arial;margin:20px}#settings-popover-menu{position:fixed;right:0;top:0;z-index:1000}.game-card-container{padding:20px}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
    <ul id="settings-popover-menu"><li><a href="/id/my/account">Pengaturan</a></li></ul>
    <main id="HomeContainer"><div id="shared-sorts"></div>
      <section id="continue"><h2>Lanjutkan</h2><a class="game-card-container" href="https://www.roblox.com/id/games/301/Game">Favorit</a></section>
    </main><script>
      const listeners=[];
      const read=()=>JSON.parse(localStorage.getItem('customBackground')||'null')||{source:'none',hideFavorites:true,hideRecommendedUpper:false,hideRecommendedLower:true};
      window.chrome={storage:{local:{async get(){return {customBackground:read()}},async set(value){localStorage.setItem('customBackground',JSON.stringify(value.customBackground));listeners.forEach(fn=>fn({customBackground:{newValue:value.customBackground}},'local'))},async remove(){}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
      window.card=id=>'<a class="game-card-container" href="https://www.roblox.com/id/games/'+id+'/Game">Game '+id+'</a>';
      window.render=(legacyGrid=false)=>{
        document.getElementById('shared-sorts').innerHTML=
          '<div id="favorites" class="game-sort-carousel-wrapper" style="display:flow-root"><div class="home-sort-header-container"><div data-testid="section-header"><button>Favorit</button><button aria-label="Lihat Semua">→</button></div></div><div class="game-carousel">'+card(101)+'</div></div>'+
          (legacyGrid?'<div id="lower" class="game-sort-carousel-wrapper"><div class="container-header"><h2>Direkomendasikan</h2></div><div class="game-grid home-game-grid wide-game-tile-game-grid dynamic-layout-sizing">'+card(201)+card(202)+'</div></div>':
          '<div id="lower" data-testid="home-page-game-grid"><div class="game-grid-container"><div class="container-header"><h2>Direkomendasikan</h2></div><div data-testid="game-grid">'+card(201)+'</div></div></div>');
      };
      window.addUpper=()=>{
        const node=document.createElement('div');node.id='upper';node.className='game-sort-carousel-wrapper';
        node.innerHTML='<div class="game-sort-carousel-container"><div class="home-sort-header-container"><div data-testid="section-header"><a href="/id/charts">Direkomendasikan untukmu</a></div></div><div class="game-carousel">'+card(102)+'</div></div>';
        document.getElementById('lower').before(node);
      };render();
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Home hides complete native sections with button titles and nested grid wrappers',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const assets = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8');
      response.end(assets.has(file) ? fs.readFileSync(path.join(workspace, file)) : fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'home-section-controls');
    const url = `http://127.0.0.1:${server.address().port}/id/home`;
    const ready = "!!document.querySelector('.rc-settings-menu-entry') && !!document.querySelector('#continue .rc-home-game-card')";
    const visible = id => browser.evaluate(`document.getElementById('${id}').checkVisibility()`);
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.waitFor(ready);
    assert.equal(await visible('favorites'), false, 'A button title hides the entire Favorites section');
    assert.equal(await visible('lower'), true, 'A nested grid alone occupies the first recommendation position');
    await browser.evaluate('render(true)');
    await browser.waitFor("!!document.querySelector('#lower .rc-hide-recommended-game')");
    assert.equal(await visible('lower'), true,
      'A generic title does not force the first recommendation area onto the lower switch');
    await browser.evaluate('addUpper()');
    await browser.waitFor("!!document.querySelector('#upper .rc-home-game-card')");
    assert.equal(await visible('upper'), true);
    assert.equal(await visible('lower'), false, 'The second recommendation area uses the saved lower switch');
    const unaffected = async () => {
      assert.equal(await visible('continue'), true);
      assert.equal(await visible('shared-sorts'), true);
      assert.equal(await browser.evaluate("!!document.querySelector('#continue .rc-hide-recommended-game')"), false);
    };
    await unaffected();
    await browser.click('.rc-settings-menu-entry');
    await browser.waitFor("!!document.querySelector('#rc-hide-recommended-upper')");
    await browser.click('#rc-hide-recommended-upper');
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).hideRecommendedUpper===true");
    assert.equal(await visible('upper'), false, 'The outer carousel wrapper disappears with its content');
    await browser.click('#rc-hide-favorites');
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).hideFavorites===false");
    assert.equal(await visible('favorites'), true);
    await browser.click('#rc-hide-recommended-lower');
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).hideRecommendedLower===false");
    assert.equal(await visible('lower'), true);
    await browser.click('#rc-done');
    await browser.evaluate('render();addUpper()');
    await browser.waitFor("!!document.querySelector('#upper .rc-home-game-card')");
    assert.deepEqual(await Promise.all(['favorites', 'upper', 'lower'].map(visible)), [true, false, true]);
    await unaffected();
    await browser.send('Page.reload');
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.evaluate('addUpper()');
    await browser.waitFor(ready + " && !!document.querySelector('#upper .rc-home-game-card')");
    assert.deepEqual(await Promise.all(['favorites', 'upper', 'lower'].map(visible)), [true, false, true]);
    await unaffected();
    await browser.click('.rc-settings-menu-entry');
    await browser.click('#rc-hide-favorites');
    await browser.click('#rc-hide-recommended-lower');
    await browser.waitFor("document.documentElement.hasAttribute('data-rc-hide-favorites') && document.documentElement.hasAttribute('data-rc-hide-recommended-upper') && document.documentElement.hasAttribute('data-rc-hide-recommended-lower')");
    await browser.click('#rc-done');
    await browser.evaluate("const favorites=document.getElementById('favorites');favorites.replaceWith(favorites.cloneNode(true))");
    await browser.evaluate("const nativeStyle=document.createElement('style');nativeStyle.textContent='#HomeContainer #shared-sorts > div {display:block!important}';document.head.append(nativeStyle)");
    assert.deepEqual(await Promise.all(['favorites', 'upper', 'lower'].map(visible)), [false, false, false],
      'Both recommendation switches and Favorites stay hidden when a more specific page style sets display');
    await browser.evaluate("document.getElementById('lower').style.setProperty('display','grid')");
    await browser.waitFor("document.getElementById('lower').style.getPropertyValue('display')==='none' && document.getElementById('lower').style.getPropertyPriority('display')==='important'");
    assert.equal(await visible('lower'), false, 'A native style update cannot reveal a hidden section');
    await browser.evaluate("history.pushState({},'', '/id/charts');dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("!document.querySelector('[data-rc-home-section],[data-rc-recommended-section]')");
    assert.deepEqual(await Promise.all(['favorites', 'upper', 'lower'].map(visible)), [true, true, true]);
    assert.equal(await browser.evaluate("document.getElementById('favorites').style.getPropertyValue('display')"), 'flow-root',
      'Leaving Home restores the exact native inline display value');
    await browser.evaluate("history.pushState({},'', '/id/home');dispatchEvent(new PopStateEvent('popstate'))");
    await browser.waitFor("document.getElementById('lower').style.getPropertyValue('display')==='none'");
    await browser.click('.rc-settings-menu-entry');
    for (const control of ['#rc-hide-favorites', '#rc-hide-recommended-upper', '#rc-hide-recommended-lower']) {
      await browser.click(control);
    }
    await browser.waitFor("!document.documentElement.hasAttribute('data-rc-hide-recommended-lower')");
    assert.deepEqual(await Promise.all(['favorites', 'upper', 'lower'].map(visible)), [true, true, true]);
    assert.deepEqual(await browser.evaluate("['favorites','upper','lower'].map(id=>document.getElementById(id).style.getPropertyValue('display'))"), ['flow-root', '', '']);
    await browser.click('#rc-hide-recommended-lower');
    await browser.waitFor("document.getElementById('lower').style.getPropertyValue('display')==='none'");
    await browser.evaluate("window.RobloxCustomizerCompatibility={enabled:()=>false,fallback:()=>true};document.dispatchEvent(new CustomEvent('rc-compatibility-changed'))");
    assert.equal(await browser.evaluate("document.getElementById('lower').style.getPropertyValue('display')"), '',
      'Compatibility fallback restores the native display before disabling features');
    assert.deepEqual(browser.errors, []);
  });
