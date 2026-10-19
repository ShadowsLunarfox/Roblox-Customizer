const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/routes.js', 'src/shared/runtime.js', 'src/shared/native-labels.js',
  'src/shared/startup.js', 'src/settings/settings.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];

function fixture() {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body{margin:16px;background:#24252c;color:white;font:16px Arial}a{color:inherit}#settings-popover-menu{position:fixed;top:0;right:0;z-index:1000}.game-card-container{position:relative;padding:20px;margin:10px}.game-sort-carousel-wrapper,[data-testid=home-page-game-grid]{padding:12px}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
    <ul id="settings-popover-menu" role="menu"><li><a href="/id/my/account">Pengaturan</a></li></ul>
    <main id="HomeContainer"><div id="shared-sorts"></div>
    <div id="friends" class="friend-carousel-container"><h2>Direkomendasikan untukmu</h2></div>
    <section id="rc-pinned-games"><h2>Direkomendasikan</h2></section></main>
    <script>
      const listeners=[];
      const read=()=>JSON.parse(localStorage.getItem('customBackground')||'null')||{source:'none',hideRecommendedUpper:false,hideRecommendedLower:true,hiddenRecommendedGames:[{placeId:'202',name:'Saved hidden game'}]};
      window.chrome={storage:{local:{async get(){return {customBackground:read()}},async set(value){localStorage.setItem('customBackground',JSON.stringify(value.customBackground));listeners.forEach(fn=>fn({customBackground:{newValue:value.customBackground}},'local'))}},onChanged:{addListener:fn=>listeners.push(fn)}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
      // Native GameCarousel uses these wrappers and a non-heading SectionHeader
      // with an accessible title. Its older renderer uses container-header/h2.
      window.header=(title,modern=true)=>modern?'<div class="home-sort-header-container"><div data-testid="section-header"><a data-testid="section-header-title-subtitle-container" aria-label="'+title+'" href="#all"><span>'+title+'</span><span aria-hidden="true">›</span></a></div></div>':'<div class="container-header"><h2>'+title+'</h2></div>';
      window.card=(id,title)=>'<div class="grid-item-container game-card-container" data-testid="wide-game-tile"><a href="https://www.roblox.com/id/games/'+id+'/Game"><div class="game-card-name">'+title+'</div></a></div>';
      window.renderLower=(modern=true)=>{
        const old=document.getElementById('lower'),node=document.createElement('div');node.id='lower';node.dataset.testid='home-page-game-grid';
        node.innerHTML=header('Direkomendasikan',modern)+'<div class="game-grid home-game-grid" data-testid="game-grid"></div>';
        old?old.replaceWith(node):document.getElementById('shared-sorts').append(node);
      };
      window.renderUpper=(modern=true)=>{
        const old=document.getElementById('upper'),node=document.createElement('div');node.id='upper';node.className='game-sort-carousel-wrapper';
        node.innerHTML=header('Direkomendasikan untukmu',modern)+'<div class="game-carousel" data-testid="game-carousel"></div>';
        old?old.replaceWith(node):document.getElementById('shared-sorts').prepend(node);
      };
      const other=document.createElement('div');other.id='continue';other.className='game-sort-carousel-wrapper';
      other.innerHTML=header('Lanjutkan')+'<div data-testid="game-carousel">'+card(301,'Direkomendasikan untukmu')+'</div>';
      document.getElementById('shared-sorts').append(other);
      renderLower();
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('Indonesian recommendations hide independently with native headers, late grids, and remounts',
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
    const browser = await isolatedChrome(t, 'home-recommendations');
    const url = `http://127.0.0.1:${server.address().port}/id/home`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.waitFor("document.querySelector('#lower').dataset.rcRecommendedSection==='upper' && !!document.querySelector('.rc-settings-menu-entry')");
    assert.equal(await browser.evaluate("document.querySelector('#lower').checkVisibility()"), true,
      'The first mounted recommendation area uses the upper switch until another section is prepended');
    const unaffected = async () => {
      assert.deepEqual(await browser.evaluate("['continue','friends','rc-pinned-games','shared-sorts'].map(id=>document.getElementById(id).checkVisibility())"), [true, true, true, true]);
      assert.equal(await browser.evaluate("!!document.querySelector('#continue .rc-hide-recommended-game')"), false,
        'A recommendation label used as a game title cannot classify Continue');
    };
    const visibility = async (upper, lower) => {
      assert.deepEqual(await browser.evaluate("['upper','lower'].map(id=>document.getElementById(id).checkVisibility())"), [upper, lower]);
      await unaffected();
    };
    await unaffected();
    await browser.evaluate("renderUpper();document.querySelector('#upper [data-testid=game-carousel]').innerHTML=card(101,'Upper game');document.querySelector('#lower [data-testid=game-grid]').innerHTML=card(201,'Lower game')+card(202,'Saved hidden game')");
    await browser.waitFor("document.querySelector('#upper').dataset.rcRecommendedSection==='upper' && !!document.querySelector('#lower [data-rc-recommended-place-id=\"202\"]')");
    await visibility(true, false);
    await browser.click('.rc-settings-menu-entry');
    for (const [selector, key, upper, lower] of [
      ['#rc-hide-recommended-lower', 'hideRecommendedLower', true, true],
      ['#rc-hide-recommended-upper', 'hideRecommendedUpper', false, true],
      ['#rc-hide-recommended-lower', 'hideRecommendedLower', false, false]
    ]) {
      await browser.click(selector);
      await browser.waitFor(`JSON.parse(localStorage.getItem('customBackground')).${key}===${key.endsWith('Upper') ? !upper : !lower}`);
      await visibility(upper, lower);
    }
    await browser.click('#rc-done');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
    for (const modern of [false, true]) {
      await browser.evaluate(`renderUpper(${modern});renderLower(${modern})`);
      await browser.waitFor("document.querySelector('#upper').dataset.rcRecommendedSection==='upper' && document.querySelector('#lower').dataset.rcRecommendedSection==='lower'");
      await visibility(false, false);
    }
    // Native sections may change their accessible titles in place.
    await browser.evaluate("const a=document.querySelector('#upper [aria-label]');a.setAttribute('aria-label','Lanjutkan');a.querySelector('span').firstChild.data='Lanjutkan'");
    await browser.waitFor("!document.querySelector('#upper').hasAttribute('data-rc-recommended-section')");
    assert.equal(await browser.evaluate("document.querySelector('#upper').checkVisibility()"), true);
    await browser.evaluate("renderUpper();document.querySelector('#upper [data-testid=game-carousel]').innerHTML=card(101,'Upper game')");
    await browser.waitFor("document.querySelector('#upper').dataset.rcRecommendedSection==='upper'");
    await browser.send('Page.reload');
    await waitForDocument(browser, '#HomeContainer', url);
    await browser.evaluate("renderUpper();document.querySelector('#upper [data-testid=game-carousel]').innerHTML=card(101,'Upper game');document.querySelector('#lower [data-testid=game-grid]').innerHTML=card(201,'Lower game')+card(202,'Saved hidden game')");
    await browser.waitFor("!!document.querySelector('#lower [data-rc-recommended-place-id=\"202\"][data-rc-recommended-hidden]')");
    await visibility(false, false);
    await browser.click('.rc-settings-menu-entry');
    assert.equal(await browser.evaluate("document.querySelector('#rc-hide-recommended-upper').checked && document.querySelector('#rc-hide-recommended-lower').checked"), true);
    await browser.click('#rc-hide-recommended-upper');
    await browser.click('#rc-hide-recommended-lower');
    await browser.click('#rc-done');
    await browser.waitFor("!document.querySelector('#rc-settings-overlay') && !document.documentElement.hasAttribute('data-rc-hide-recommended-lower')");
    await visibility(true, true);
    assert.equal(await browser.evaluate("document.querySelector('#lower [data-rc-recommended-place-id=\"202\"]').checkVisibility()"), false);
    await browser.click('#upper .rc-hide-recommended-game');
    await browser.waitFor("JSON.parse(localStorage.getItem('customBackground')).hiddenRecommendedGames.some(game=>game.placeId==='101')");
    assert.equal(await browser.evaluate("document.querySelector('#upper [data-rc-recommended-place-id=\"101\"]').checkVisibility()"), false);
    assert.deepEqual(browser.errors, []);
  });
