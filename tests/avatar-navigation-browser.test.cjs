const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/native-labels.js', 'src/pages/avatar/avatar-page.js'];
const locales = {
  en: {
    main: ['Recently Worn', 'Accessories', 'Clothing', 'Body Parts', 'Animations', 'Expired', 'Recently Added', 'Characters'],
    accessories: ['Head', 'Face', 'Neck', 'Shoulders', 'Front', 'Back', 'Waist', 'Gear'],
    clothing: [['Tops', 'T-Shirts', 'Sweaters', 'Outerwear'], ['Outerwear', 'Jackets'],
      ['Bottoms', 'Dresses & Skirts', 'Pants', 'Shorts'], ['Shoes', 'Left Shoe', 'Right Shoe'],
      ['Classic', 'Classic Shirts', 'Classic T-Shirts', 'Classic Pants']],
    animations: ['Actions', 'Walking', 'Falling', 'Run', 'Jump', 'Swim', 'Climb', 'Idle'],
    recent: ['Currently Wearing', 'Recently Added', 'Characters']
  },
  'zh-cn': {
    main: ['最近穿戴', '饰品', '服装', '身体部位', '动画', '已过期', '最近新增', '角色'],
    accessories: ['头部', '脸部', '颈部', '肩部', '正面', '背部', '腰部', '装备'],
    clothing: [['上衣', 'T 恤', '织衫', '外套'], ['外衣', '夹克'],
      ['裤裙', '裙子', '裤子', '短裤'], ['鞋子', '左鞋', '右鞋'], ['经典', '经典上衣', '经典 T 恤', '经典裤子']],
    animations: ['动作', '步行', '跌落', '奔跑', '跳跃', '游泳', '攀爬', '闲置'],
    recent: ['目前穿戴', '最近新增', '角色']
  },
  'zh-tw': {
    main: ['最近穿戴', '飾品', '服裝', '身體部位', '動畫', '已過期', '最近新增', '角色'],
    accessories: ['頭部', '臉部', '頸部', '肩部', '正面', '背部', '腰部', '裝備'],
    clothing: [['上衣', 'T 恤', '織衫', '外套'], ['外衣', '夾克'],
      ['褲裙', '裙子', '褲子', '短褲'], ['鞋子', '左鞋', '右鞋'], ['經典', '經典上衣', '經典 T 恤', '經典褲子']],
    animations: ['動作', '步行', '跌落', '奔跑', '跳躍', '游泳', '攀爬', '閒置'],
    recent: ['目前穿戴', '最近新增', '角色']
  }
};
const escape = text => text.replaceAll('&', '&amp;');
// Native row and link both carry handlers in some menus. Other options have
// only a text label and a delegated row handler. Both must remain operable.
const action = (name, key, plain = false) => `<li data-native-key="${key}" ${plain ? '' : 'ng-click="select()"'}>
  ${plain ? `<span id="${key}">${escape(name)}</span>` : `<a id="${key}" href="#" ng-click="select()"><span>${escape(name)}</span></a>`}</li>`;
function fixture(locale) {
  const l = locales[locale];
  const previewHeight = locale === 'en' ? 220 : 300;
  return `<!doctype html><html lang="${locale}" data-rc-ui-active data-rc-background-active data-rc-frost-page="avatar"><head><meta charset="utf-8">
    <style>
      *{box-sizing:border-box}body{margin:0;font:16px/1.4 Arial;background:linear-gradient(120deg,#4a2233,#487681);color:#eee}
      ul{margin:0;padding:0;list-style:none}a{color:inherit;text-decoration:none}button{font:inherit}
      #avatar-preview{width:300px;height:${previewHeight}px}#avatar-categories{height:80px;overflow:hidden}
      .native-scene{position:relative;width:100%;height:${previewHeight}px;background:#789 url('/image.svg?scene=one') center/cover no-repeat}
      .native-preview-host{position:relative;background:#975 url('/image.svg?wrapper') repeat;background-size:300px 300px}
      .native-scene::before,.native-scene::after,.native-preview-host::before,.native-preview-host::after{content:'';position:absolute;inset:0;background:#975 url('/image.svg?tiles') repeat;background-size:300px 300px;pointer-events:none}
      .native-backdrop{position:absolute;inset:0;background:#975 url('/image.svg?backdrop') repeat;background-size:300px 300px;pointer-events:none}
      .native-tile{position:absolute;width:50%;height:50%;background:#975 url('/image.svg?tile') no-repeat;pointer-events:none}
      .native-late-backdrop{position:absolute;inset:0;pointer-events:none}.native-late-backdrop.loaded{background:url('/image.svg?late') repeat}
      #native-model{position:relative;z-index:1}.native-control-icon{display:inline-block;width:16px;height:16px;background:url('/image.svg?icon') no-repeat}
      #main-row>li{float:left;padding:8px;width:12.5%}.avatar-subcategories{position:absolute;inset:55px 0 auto}
      .avatar-subcategories li{float:left;width:33.333%;padding:12px}
      .clothing-row{display:flex;height:70px;border:1px solid #888;border-radius:12px;padding:12px;background:#8885}
      .native-heading{width:33%;padding:10px}.native-options{width:67%}.native-options a{display:block;width:180px}
      .ng-hide,.hidden,[hidden]{display:none!important}.avatar-items-container{padding:16px}
      .avatar-item-card{display:block;width:150px;height:170px;background:#555}
    </style>${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    </head><body class="dark-theme"><main id="content"><div class="avatar-editor">
    <div class="preview-column"><div class="native-preview-host"><div class="native-backdrop" aria-hidden="true"></div><div id="late-inline" class="native-late-backdrop" aria-hidden="true"></div><div id="avatar-preview"><div class="native-scene"><div class="native-backdrop" aria-hidden="true"></div><div class="native-late-backdrop" aria-hidden="true"></div>${[0,1,2,3].map(i=>`<div class="native-tile" aria-hidden="true" style="left:${i%2*50}%;top:${Math.floor(i/2)*50}%"></div>`).join('')}<canvas id="native-model" width="300" height="${previewHeight}"></canvas></div><button id="native-background" type="button"><span class="native-control-icon"></span>Background</button></div></div></div>
    <div class="inventory-column"><nav id="avatar-categories"><ul id="main-row">
      ${l.main.map((name, i) => action(name, `main-${i}`, i === 0)).join('')}
    </ul><ul id="accessories" class="avatar-subcategories">${l.accessories.map((name, i) => action(name, `accessory-${i}`, i === 0)).join('')}</ul>
    <div id="clothing" class="avatar-subcategories" hidden>${l.clothing.map((row, i) => `<div id="clothing-row-${i}" class="clothing-row"><div class="native-heading" data-native-key="heading-${i}"><span id="heading-${i}">${escape(row[0])}</span></div><ul class="native-options">${row.slice(1).map((name, j) => action(name, `clothing-${i}-${j}`)).join('')}</ul></div>`).join('')}</div>
    <ul id="animations" class="avatar-subcategories" hidden>${l.animations.map((name, i) => action(name, `animation-${i}`, i < 3)).join('')}</ul>
    <ul id="recent" class="avatar-subcategories" hidden>${l.recent.map((name, i) => action(name, `recent-${i}`)).join('')}</ul></nav>
    <div class="avatar-items-container"><a id="inventory-card" class="avatar-item-card" href="/catalog/1/Head"><img src="/image.svg"><span>Head</span></a><p id="native-result">All items</p></div></div></div></main>
    <script>
      window.chrome={runtime:{lastError:null,sendMessage(message,callback){setTimeout(()=>callback({state:'Completed',imageUrl:location.origin+'/image.svg'}),0)}}};
      window.nativeCalls=[];window.originalActions=[...document.querySelectorAll('[data-native-key]')];
      window.originalCanvas=document.getElementById('native-model');
      window.modelInputs=0;originalCanvas.addEventListener('pointerdown',()=>modelInputs++);
      document.getElementById('native-background').addEventListener('click',()=>{
        document.querySelector('.native-scene').style.backgroundImage='url("/image.svg?scene=two")';
      });
      document.addEventListener('click',event=>{
        const action=event.target.closest('[data-native-key]');if(!action)return;event.preventDefault();
        const key=action.dataset.nativeKey;nativeCalls.push(key);
        action.parentElement.querySelectorAll(':scope > .active').forEach(node=>node.classList.remove('active'));action.classList.add('active');
        if(key.startsWith('main-')){
          document.querySelectorAll('.avatar-subcategories').forEach(node=>node.hidden=true);
          const menu=({'main-1':'accessories','main-2':'clothing','main-4':'animations'})[key]||'recent';
          document.getElementById(menu).hidden=false;
        }
        document.getElementById('native-result').textContent=key;
      });
    </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

const layout = `(() => {
  const bounds=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const row=document.querySelector('[data-rc-avatar-main-row]');
  const controls=[...document.querySelectorAll('[data-rc-avatar-main-control], [data-rc-avatar-sub-control]')].filter(node=>node.checkVisibility());
  return {
    mainCount:document.querySelectorAll('[data-rc-avatar-main-control]').length,
    nested:controls.some(node=>node.querySelector('[data-rc-avatar-main-control], [data-rc-avatar-sub-control]')),
    unchanged:originalActions.every(node=>node.isConnected),
    controls:controls.map(node=>({id:node.id,...bounds(node),border:getComputedStyle(node).borderTopWidth,background:getComputedStyle(node).backgroundColor})),
    row:bounds(row),inventory:bounds(document.querySelector('.avatar-items-container')),
    menu:bounds([...document.querySelectorAll('.avatar-subcategories')].find(node=>node.checkVisibility())),
    headings:[...document.querySelectorAll('[data-rc-avatar-clothing-heading]')].map(node=>node.id),
    sections:[...document.querySelectorAll('[data-rc-avatar-clothing-section]')].map(bounds),
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    overflowNodes:[...document.querySelectorAll('body *')].filter(node=>node.checkVisibility() && node.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(node=>({tag:node.tagName,id:node.id,classes:node.className,...bounds(node)})),
    inventoryMarked:!!document.querySelector('#inventory-card [data-rc-avatar-sub-control]')
  };
})()`;

test('avatar filters stay aligned, localized, and native across menu changes and screen sizes',
  { skip: !process.env.CHROME_BIN }, async t => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/my/avatar') { response.setHeader('Content-Type', 'text/html; charset=utf-8');response.end(fixture(url.searchParams.get('locale') || 'en'));return; }
      if (url.pathname === '/image.svg') { response.setHeader('Content-Type', 'image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#789"/></svg>');return; }
      const file = url.pathname.slice(1);
      if (![...styles, ...scripts].includes(file)) { response.writeHead(404);response.end();return; }
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');response.end(fs.readFileSync(path.join(workspace, file)));
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_SERVER_TEST_PORT || 0), '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const browser = await isolatedChrome(t, 'avatar-navigation');
    for (const locale of Object.keys(locales)) {
      const url = `http://127.0.0.1:${server.address().port}/my/avatar?locale=${locale}`;
      await browser.send('Page.navigate', { url });await waitForDocument(browser, '#main-row', url);
      await browser.waitFor("document.querySelectorAll('[data-rc-avatar-main-control]').length===8");
      // Frost replaces the native CSS backdrop while the original canvas and
      // its input handlers remain intact, including already-square previews.
      await browser.click('#native-background');
      assert.ok(await browser.evaluate("document.querySelector('.native-scene').style.backgroundImage.endsWith('/image.svg?scene=two\")')"), 'native scene state is retained');
      await browser.click('#native-model');assert.equal(await browser.evaluate('modelInputs'), 1, 'model remains interactive');
      await browser.evaluate("document.querySelector('.native-scene .native-late-backdrop').classList.add('loaded');document.querySelector('#late-inline').style.backgroundImage='url(/image.svg?late-inline)'");
      await browser.waitFor("document.querySelector('.native-scene .native-late-backdrop').hasAttribute('data-rc-avatar-backdrop') && document.querySelector('#late-inline').hasAttribute('data-rc-avatar-backdrop')");
      await browser.evaluate("const layer=document.createElement('div');layer.className='native-backdrop';layer.id='redrawn-backdrop';document.querySelector('.native-scene').prepend(layer)");
      await browser.waitFor("document.querySelector('#redrawn-backdrop').hasAttribute('data-rc-avatar-backdrop')");
      for (const theme of ['dark-theme', 'light-theme']) for (const width of [1360, 700, 390]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.body.className=${JSON.stringify(theme)}`);
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const preview = await browser.evaluate(`(() => {
          const three=document.querySelector('[data-rc-avatar-view-column]'),two=document.querySelector('#rc-avatar-2d');
          const surface=document.querySelector('[data-rc-avatar-3d-surface]'),stage=two.querySelector('.rc-avatar-image-wrap');
          return {three:getComputedStyle(three).backgroundImage,two:getComputedStyle(two).backgroundImage,
            threeBlur:getComputedStyle(three).backdropFilter,twoBlur:getComputedStyle(two).backdropFilter,
            threeStage:getComputedStyle(surface).backgroundImage,twoStage:getComputedStyle(stage).backgroundImage,
            nativeBackdrop:getComputedStyle(document.querySelector('.native-scene')).backgroundImage,
            wrapperBackdrop:getComputedStyle(document.querySelector('.native-preview-host')).backgroundImage,
            tiledLayers:['::before','::after'].map(pseudo=>getComputedStyle(document.querySelector('.native-scene'),pseudo).backgroundImage)
              .concat(['::before','::after'].map(pseudo=>getComputedStyle(document.querySelector('.native-preview-host'),pseudo).backgroundImage))
              .concat([...document.querySelectorAll('.native-backdrop,.native-late-backdrop,.native-tile')].map(node=>getComputedStyle(node).backgroundImage)),
            icon:getComputedStyle(document.querySelector('.native-control-icon')).backgroundImage,
            modelFilter:getComputedStyle(originalCanvas).filter,cardFilter:getComputedStyle(three).filter,
            originalCanvas:originalCanvas===document.getElementById('native-model')};
        })()`);
        assert.equal(preview.three, preview.two, '3D and 2D use matching glass cards');
        assert.equal(preview.threeBlur, preview.twoBlur, '3D and 2D blur strength matches');
        assert.match(preview.threeBlur, /blur\(18px\)/, 'background blur is enabled');
        assert.equal(preview.threeStage, preview.twoStage, 'stage backgrounds match');
        assert.doesNotMatch(preview.nativeBackdrop, /url\(/, 'native backdrop does not cover the frost');
        assert.equal(preview.wrapperBackdrop, 'none', 'native wrapper backdrop is removed');
        assert.ok(preview.tiledLayers.every(image=>image==='none'), 'all repeated images and pseudo-element backdrops are removed');
        assert.match(preview.icon, /url\(/, 'native control icons are preserved');
        assert.equal(preview.modelFilter, 'none');assert.equal(preview.cardFilter, 'none');
        assert.equal(preview.originalCanvas, true, 'native 3D model stays mounted');
        for (const [tab, menu, count, key] of [[1, 'accessories', 8, 'accessory-0'], [2, 'clothing', 17, 'clothing-0-2'], [4, 'animations', 8, 'animation-1'], [0, 'recent', 3, 'recent-1']]) {
          await browser.click(`#main-${tab}`);
          await browser.waitFor(`document.querySelector('#${menu}').checkVisibility()`);
          const state = await browser.evaluate(layout);
          const label = `${locale}/${theme}/${width}/${menu}`;
          assert.equal(state.mainCount, 8, label);
          assert.equal(state.nested, false, `${label}: no nested button borders`);
          assert.equal(state.unchanged, true, `${label}: native action nodes remain mounted`);
          assert.equal(state.controls.length, 8 + count, `${label}: every filter has a styled control`);
          assert.equal(state.overflow, false, `${label}: no page overflow ${JSON.stringify(state.overflowNodes)}`);
          assert.equal(state.inventoryMarked, false, `${label}: inventory titles are not filters`);
          assert.ok(state.inventory.top >= state.menu.bottom - 1, `${label}: inventory follows the filters`);
          for (const control of state.controls) {
            assert.ok(control.width > 20 && control.height >= 42, `${label}: usable control ${control.id}`);
            assert.equal(control.border, '1px', `${label}: consistent border ${control.id}`);
            assert.ok(control.left >= state.row.left - 1 && control.right <= state.row.right + 1, `${label}: contained control ${control.id}`);
          }
          const mainRows = new Map();
          for (const control of state.controls.filter(node => node.id.startsWith('main-'))) {
            const top = Math.round(control.top);
            if (mainRows.has(top)) assert.ok(Math.abs(mainRows.get(top) - control.height) < 1, `${label}: equal button heights within each row`);
            else mainRows.set(top, control.height);
          }
          assert.deepEqual(state.headings, [0, 1, 2, 3, 4].map(i => `heading-${i}`), `${label}: Outerwear option is not a section heading`);
          assert.equal(state.sections.length, 5, label);
          await browser.click(`#${key}`);
          assert.equal(await browser.evaluate('nativeCalls.at(-1)'), key, `${label}: native filtering still fires`);
          assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('#${key}')).backgroundColor`), 'rgb(51, 95, 255)', `${label}: selected option is visible`);
          if (process.env.AVATAR_SCREENSHOT_DIR && locale === 'zh-tw' && theme === 'dark-theme' && menu === 'clothing' && width !== 700) {
            const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            fs.writeFileSync(path.join(process.env.AVATAR_SCREENSHOT_DIR, `avatar-${width}.png`), Buffer.from(shot.data, 'base64'));
          }
        }
      }
      // A keyboard-generated native click must work, too.
      await browser.click('#main-1');await browser.evaluate("document.querySelector('#accessory-2').focus()");
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      assert.equal(await browser.evaluate('nativeCalls.at(-1)'), 'accessory-2');
      await browser.evaluate("document.querySelector('#accessories').classList.add('ng-hide')");
      assert.equal(await browser.evaluate("document.querySelector('#accessories').checkVisibility()"), false, 'native hidden state wins');
    }
    assert.deepEqual(browser.errors, []);
  });
