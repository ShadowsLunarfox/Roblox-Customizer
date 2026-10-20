const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8')).content_scripts;
const scripts = [...new Set(entries.filter(entry => entry.world !== 'MAIN').flatMap(entry => entry.js || []))];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];
const titles = { en: 'Currently Wearing', 'zh-cn': '当前穿戴', 'zh-tw': '目前穿戴', id: 'Saat Ini Memakai', ja: '装備中', th: 'สวมอยู่ตอนนี้', ko: '현재 장착 중' };
const names = ['Rubah Kemono Putih (Mata Berwarna)', 'Ekor Rubah Arktik Fluffy', 'Kantong Modular (Hitam)',
  'Ekor Wag Senang Idle', 'Kanji | PANTALON KANJI', "Kanji | Kanji’s Sweatshirt (Creature)", 'Paket Animasi Rthro'];
const thaiNames = ['แพ็คแอนิเมชันที่มีสไตล์', 'Frosty Flair - ทอมมี่ ฮิลฟิเกอร์', 'กระโปรงจีบสีชมพู',
  'กระเป๋าสะพายหลัง กระต่ายสีขาว', 'สัตว์เลี้ยง Axolotl Shoulder!', 'โบว์สีขาว', 'หูแมวน่ารักพร้อมโบว์'];
const koreanNames = ['즐거운 애니메이션 팩', '귀여운 고양이 카와이 배경', 'Sticker(스티커) 댄스 무브 - NCT 127',
  '회색 플라이츠 스커트', '흰색 편안한 네코 후드', '돌고래 댄스', '영웅의 착지'];
const namesFor = locale => locale === 'th' ? thaiNames : locale === 'ko' ? koreanNames : names;
const pricesFor = locale => locale === 'th' ? [300, 170, 120, 105, 99, 70, 70]
  : locale === 'ko' ? [216, 154, 150, 120, 100, 100, 80] : [75, 65, 55, 45, 35, 25, 'Gratis'];
const prefixFor = locale => ['id', 'ja', 'th', 'ko'].includes(locale) ? '/' + locale : '';

function cards(locale) {
  const prefix = prefixFor(locale);
  const itemNames = namesFor(locale);
  const prices = pricesFor(locale);
  return itemNames.map((name, i) => `<div id="collection-carousel-item" class="native-tile"><li class="item-card" data-item="${i}">
    <div class="item-card-container" style="background:#485889"><a class="item-card-link" href="${prefix}/${i === 6 ? 'bundles' : 'catalog'}/${1000 + i}/Item">
      <div class="item-card-thumb-container" style="background:#6171a4"><div class="thumbnail-2d-container" style="background:#6171a4"><img src="/asset.svg" alt="${name}"></div></div></a>
      <div class="item-card-caption" style="background:#485889"><a class="item-card-name" href="${prefix}/${i === 6 ? 'bundles' : 'catalog'}/${1000 + i}/Item">${name}</a>
      <div class="item-card-price">${typeof prices[i] === 'number' ? '<span class="icon-robux-16x16"></span>' : ''}${prices[i]}</div></div></div></li></div>`).join('');
}

function fixture(locale) {
  return `<!doctype html><html lang="${locale}" class="dark-theme"><head><meta charset="utf-8"><meta name="locale-data" data-language-code="${locale}">
    <style>body{margin:32px;font:14px/1.4 Arial;color:white;background:#373544}main{max-width:1240px;margin:auto}h1{font-size:24px}h2{font-size:18px}.profile-carousel{position:relative}.carousel-items{display:flex;gap:16px;overflow:hidden}.native-tile{flex:0 0 150px;width:150px}.item-card{list-style:none}.item-card img{display:block;width:100%;height:150px;object-fit:contain}.item-card-name{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}a{color:inherit;text-decoration:none}[data-testid="carousel-scroll-arrow"]{position:absolute;right:0;top:100px;border:0;border-radius:50%;width:36px;height:36px;color:white;background:#272930}.item-card-price{padding-top:6px}.icon-robux-16x16:before{content:'⬡'}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body><main id="content"><div id="profile-container"><h1>Player</h1>
      <section id="wearing"><div class="container-header"><h2>${titles[locale]}</h2></div><div class="profile-carousel"><div class="carousel-items">${cards(locale)}</div>
      <button data-testid="carousel-scroll-arrow" aria-label="Next" onclick="arrowClicks++">❯</button></div></section></div></main>
      <script>window.arrowClicks=0;window.itemClicks=0;document.querySelector('#wearing').addEventListener('click',event=>{if(event.target.closest('a')){event.preventDefault();itemClicks++}});window.originalCards=[...document.querySelectorAll('.item-card')];</script></body></html>`;
}

test('native wearing cards share transparent thumbnail and caption surfaces in every supported locale',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const assets = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      const file = url.pathname.slice(1);
      if (assets.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/javascript');
        response.end(fs.readFileSync(path.join(workspace, file)));
      } else if (file === 'asset.svg' || file === 'wallpaper.svg') {
        response.setHeader('Content-Type', 'image/svg+xml');
        response.end(file === 'asset.svg' ? '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><g fill="#d7dce6" stroke="#a4adbf" stroke-width="2"><circle cx="75" cy="34" r="15"/><rect x="51" y="51" width="48" height="47"/><rect x="30" y="51" width="19" height="47"/><rect x="101" y="51" width="19" height="47"/><rect x="51" y="100" width="22" height="42"/><rect x="77" y="100" width="22" height="42"/></g></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="600"><defs><linearGradient id="wall"><stop stop-color="#b56655"/><stop offset="1" stop-color="#d6c7a3"/></linearGradient></defs><rect width="1400" height="600" fill="url(#wall)"/><path d="M0 400L600 0L1400 600" fill="none" stroke="#762e42" stroke-width="180"/></svg>');
      } else {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(fixture(url.searchParams.get('locale') || 'en'));
      }
    });
    await new Promise(resolve => server.listen(Number(process.env.PROFILE_WEARING_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'profile-wearing');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 700, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(){return {robloxCustomizerTermsAccepted:true,customBackground:{source:'url',url:location.origin+'/wallpaper.svg',urlType:'image',experimentalCustomColors:true,customTextColor:'#ffffff',customBackgroundColor:'#394b84',customAccentColor:'#fc33ff',glassBlur:40,glassOpacity:51}}},async set(){},async remove(){}},onChanged:{addListener(){}}},runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){setTimeout(()=>callback?.({error:'No optional fixture data'}),0)}}};
    ` });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file });
    const profiles = Object.keys(titles).flatMap(locale => (locale === 'th' ? [2950704295, 671910625] : [7366396729])
      .map(userId => ({ locale, userId })));
    // URL prefixes and the language actually rendered by Roblox can differ.
    profiles.push({ locale: 'ko', userId: 2950704295, prefix: '/th' });
    for (const { locale, userId, prefix = prefixFor(locale) } of profiles) {
      const url = `http://127.0.0.1:${server.address().port}${prefix}/users/${userId}/profile?locale=${locale}`;
      await browser.send('Page.navigate', { url });
      await waitForDocument(browser, '#wearing', url);
      await browser.waitFor("document.querySelectorAll('#wearing [data-rc-profile-card]').length===7");
      if (process.env.PROFILE_WEARING_SCREENSHOT) {
        const shot = await browser.send('Page.captureScreenshot', { format: 'png', clip: { x: 32, y: 32, width: 1300, height: 430, scale: 1 } });
        fs.writeFileSync(process.env.PROFILE_WEARING_SCREENSHOT, Buffer.from(shot.data, 'base64'));
      }
      const result = await browser.evaluate(`(()=>{const section=document.querySelector('#wearing');return {
        section:section.dataset.rcProfileSection, names:[...section.querySelectorAll('.item-card-name')].map(n=>n.textContent),
        preserved:originalCards.every(n=>n.isConnected),
        backgrounds:[...section.querySelectorAll('.item-card-container,.item-card-thumb-container,.thumbnail-2d-container,.item-card-caption')].map(n=>getComputedStyle(n).backgroundColor),
        surfaces:[...section.querySelectorAll('[data-rc-profile-card]')].map(n=>getComputedStyle(n).backgroundColor),
        clipped:[...section.querySelectorAll('.item-card-name')].some(n=>n.scrollHeight>n.clientHeight+1),
        price:[...section.querySelector('[data-item="6"] .item-card-price').childNodes]
          .filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim()
      }})()`);
      assert.equal(result.section, 'wearing', locale);
      assert.deepEqual(result.names, namesFor(locale), 'Native item names remain unchanged');
      assert.equal(result.preserved, true, 'Native cards and their handlers are preserved');
      assert.equal(result.clipped, false, 'Long item names are readable');
      assert.equal(result.price, String(pricesFor(locale).at(-1)));
      assert.ok(result.backgrounds.every(color => color === 'rgba(0, 0, 0, 0)'), `${locale}: opaque native thumbnail and caption backgrounds must clear`);
      assert.ok(result.surfaces.every(color => {
        const opacity = Number(color.match(/[\d.]+/g)?.[3]);
        return opacity > 0 && opacity < 1;
      }), 'Each asset keeps a translucent outer card');
      await browser.click('#wearing [data-testid="carousel-scroll-arrow"]');
      await browser.click('#wearing [data-item="0"] .item-card-link');
      assert.deepEqual(await browser.evaluate('[arrowClicks,itemClicks]'), [1, 1]);
      await browser.evaluate(`document.querySelector('#wearing h2').textContent='${locale === 'th' ? 'สวมอยู่ตอนนี้' : 'Saat Ini Memakai'}';document.querySelector('.carousel-items').innerHTML=${JSON.stringify(cards(locale === 'th' ? 'th' : 'id'))}`);
      await browser.waitFor("document.querySelectorAll('#wearing [data-rc-profile-card]').length===7 && document.querySelector('#wearing').dataset.rcProfileSection==='wearing'");
    }
    assert.deepEqual(browser.errors, []);
  });
