const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const early = manifest.content_scripts[0].js;
const late = ['src/shared/native-labels.js', 'src/shared/i18n.js', 'src/pages/avatar/avatar-page.js',
  'src/assets/asset-core.js', 'src/assets/tools-ui.js', 'src/assets/avatar-tools.js'];
const styles = ['src/shared/startup.css', 'src/shared/theme.css', 'src/pages/avatar/avatar-page.css', 'src/assets/tools.css'];
const source = file => fs.readFileSync(path.join(workspace, file), 'utf8');
const nativePreview = '<div class="preview-column"><div id="avatar-preview"><canvas id="native-model" width="300" height="300"></canvas></div></div>';
const nativeInventory = '<div class="inventory-column"><nav id="avatar-categories"><ul>'
  + ['Recent', 'Avatars', 'Body', 'Clothing', 'Accessories', 'Animations'].map(label => `<li><button data-native-action>${label}</button></li>`).join('')
  + '</ul></nav><div class="avatar-items-container"><a class="avatar-item-card" href="/catalog/1/Head">Head</a></div></div>';
const japaneseInventory = '<div class="inventory-column"><nav id="avatar-categories"><ul>'
  + ['最近', 'アバター', 'ボディ', 'メイク', '服装', 'アクセサリ', '背景', 'アニメ'].map(label => `<li><button data-native-action>${label}</button></li>`).join('')
  + '</ul></nav><div class="avatar-items-container"><a class="avatar-item-card" href="/catalog/1/Head">頭</a></div></div>';
test('The Avatar Editor stays visible during native startup, renderer loading, and navigation',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      if (styles.includes(file)) { response.setHeader('Content-Type', 'text/css'); response.end(source(file)); return; }
      if (!url.pathname.endsWith('/my/avatar')) { response.writeHead(404); response.end(); return; }
      const language = url.searchParams.get('language') || 'en';
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="${language==='pending'?'':language}"><head><meta charset="utf-8">
        ${language==='pending'?'':`<meta name="locale-data" data-language-code="${language}">`}
        <style>body{margin:0;font:16px Arial;background:linear-gradient(120deg,#4a2233,#487681);color:#eee}
        header{height:64px}#content{margin:24px}#avatar-preview{width:300px;height:300px}ul{list-style:none;margin:0;padding:0}
        .avatar-item-card{display:block;height:150px}button{padding:8px}</style>
        ${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head>
        <body class="dark-theme"><header><button id="header-action" onclick="headerClicks++">Header</button></header>
        <main id="content"><div class="avatar-editor">${nativePreview}${nativeInventory}</div></main>
        <script>
          window.headerClicks=0;window.nativeClicks=0;window.modelInputs=0;window.nativePaints=0;window.nativeTicks=0;
          window.originalCanvas=document.querySelector('#native-model');
          originalCanvas.addEventListener('pointerdown',()=>modelInputs++);
          document.addEventListener('click',event=>{if(event.target.closest('[data-native-action]'))nativeClicks++});
          function draw(){nativeTicks++;const c=document.querySelector('#native-model');if(c){c.getContext('2d').fillRect(0,0,30,30);nativePaints++}requestAnimationFrame(draw)}draw();
        </script></body></html>`);
    });
    await new Promise(resolve=>server.listen(0, '127.0.0.1', resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser = await isolatedChrome(t, 'avatar-startup');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.chrome={i18n:{getUILanguage:()=> 'en'},storage:{local:{async get(){return{}},async set(){},async remove(){}},onChanged:{addListener(){}}},
        runtime:{lastError:null,sendMessage(message,callback){ /* Keep thumbnail fetch pending. */ }}};
    ` });
    for (const file of early) await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: source(file)+'\n//# sourceURL='+file });
    const base = `http://127.0.0.1:${server.address().port}`;
    const navigate = async (query, prefix='') => {
      const url=base+prefix+'/my/avatar'+query;
      await browser.send('Page.navigate',{url});
      await waitForDocument(browser, '#native-model', url);
    };
    const enhance = async () => { for(const file of late) await browser.evaluate(source(file)+'\n//# sourceURL='+file); };
    const ready = "!!document.querySelector('[data-rc-avatar-studio] > #rc-avatar-2d') && !!document.querySelector('[data-rc-avatar-main-control]')";
    const assertVisible = async () => {
      assert.equal(await browser.evaluate("document.querySelector('.avatar-editor').checkVisibility({visibilityProperty:true})"), true);
      assert.equal(await browser.evaluate("!!document.querySelector('[data-rc-avatar-boot], #rc-avatar-loading, #rc-avatar-diagnostics, .rc-avatar-diagnostics-open')"), false);
    };

    await navigate('');
    await assertVisible();
    await browser.waitFor('nativePaints>10');
    await browser.click('#header-action');
    await browser.click('[data-native-action]');
    assert.equal(await browser.evaluate('headerClicks'), 1);
    assert.equal(await browser.evaluate('nativeClicks'), 1, 'Native controls work before the enhancement mounts');
    await browser.evaluate(`(() => {
      const canvas = document.getElementById('native-model');
      canvas.height = 150;
      window.nativeResizeCalls = 0;
      addEventListener('resize', event => {
        if (!event.isTrusted) nativeResizeCalls++;
        if (canvas.width === canvas.clientWidth && canvas.height === canvas.clientHeight) return;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      });
      window.rendererLayoutWrites = 0;
      window.timerDuringModelLoad = false;
      window.framesDuringModelLoad = 0;
      // Model renderers can reapply their loading class in response to sizing.
      const renderer = new MutationObserver(() => {
        rendererLayoutWrites++;
        if (rendererLayoutWrites < 100) canvas.classList.toggle('native-model-rendering');
      });
      window.rendererLayoutObserver = renderer;
      renderer.observe(canvas, { attributes: true, attributeFilter: ['data-rc-avatar-3d-square'] });
      setTimeout(() => { timerDuringModelLoad = true; }, 60);
      requestAnimationFrame(function render() {
        if (++framesDuringModelLoad < 12) {
          canvas.classList.toggle('native-model-frame');
          requestAnimationFrame(render);
        }
      });
    })()`);
    await enhance();
    await browser.waitFor(ready);
    await browser.waitFor('timerDuringModelLoad && framesDuringModelLoad===12');
    await browser.evaluate('rendererLayoutObserver.disconnect()');
    assert.equal(await browser.evaluate('rendererLayoutWrites'), 1, 'The canvas is sized once even if the native renderer reacts to that write');
    assert.equal(await browser.evaluate('nativeResizeCalls'), 1, 'The native renderer receives a single resize request');
    assert.equal(await browser.evaluate('originalCanvas.width === originalCanvas.clientWidth && originalCanvas.height === originalCanvas.clientHeight'),
      true, 'Roblox retains control of the backing buffer and can redraw it at the full viewport size');
    await assertVisible();
    await browser.waitFor("!!document.querySelector('#rc-avatar-enhancements')");
    await browser.evaluate('RobloxCustomizerStartup.setPreferences({source:"none",glassOpacity:62})');
    await assertVisible();
    assert.equal(await browser.evaluate("document.querySelector('#native-model')===originalCanvas"), true);
    await browser.click('#native-model');
    assert.equal(await browser.evaluate('modelInputs'), 1);

    // A local model refresh leaves the item controls available.
    await browser.evaluate("originalCanvas.remove()");
    await assertVisible();
    await browser.click('[data-native-action]');
    assert.equal(await browser.evaluate('nativeClicks'), 2);
    await browser.evaluate("document.querySelector('#avatar-preview').append(originalCanvas)");
    await browser.click('#native-model');
    assert.equal(await browser.evaluate('modelInputs'), 2);
    await browser.evaluate(`(() => {
      const next = originalCanvas.cloneNode();
      next.height = 72;
      originalCanvas.replaceWith(next);
    })()`);
    await browser.waitFor("document.querySelector('#native-model').hasAttribute('data-rc-avatar-3d-square')");
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await browser.evaluate('nativeResizeCalls'), 1, 'A native canvas remount cannot start a resize loop');

    // The native preview may mount before the inventory, including after a route change.
    await browser.evaluate(`history.pushState({},'', '/home');document.getElementById('content').innerHTML='<h1>Home</h1>';dispatchEvent(new PopStateEvent('popstate'))`);
    await browser.waitFor("!document.querySelector('#rc-avatar-2d')");
    await browser.evaluate(`history.pushState({},'', '/ja/my/avatar');document.getElementById('content').innerHTML='<div class="avatar-editor">'+${JSON.stringify(nativePreview)}+'</div>';dispatchEvent(new PopStateEvent('popstate'))`);
    await assertVisible();
    await browser.evaluate(`document.querySelector('.avatar-editor').insertAdjacentHTML('beforeend',${JSON.stringify(japaneseInventory)})`);
    await browser.waitFor(ready);
    await assertVisible();
    await browser.click('[data-native-action]');
    assert.equal(await browser.evaluate('nativeClicks'), 3, 'Remounted controls retain their native handlers');
    await browser.evaluate("document.querySelector('#rc-avatar-2d').remove()");
    await browser.waitFor(ready);
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-avatar-2d').length"), 1);

    // Switching to Roblox's native 3D renderer can replace its initial image.
    await navigate('?language=ja', '/ja');
    await browser.evaluate(`(() => {
      document.querySelector('#avatar-preview').innerHTML='<img width="300" height="300"><button id="native-mode-3d">3D</button>';
      window.modeClicks=0;
      document.querySelector('#native-mode-3d').addEventListener('click',()=>modeClicks++);
    })()`);
    await enhance();
    await browser.waitFor('modeClicks===1');
    await assertVisible();
    await browser.evaluate(`document.querySelector('.preview-column').outerHTML=${JSON.stringify(nativePreview)}`);
    await browser.waitFor(ready);
    await assertVisible();
    assert.equal(await browser.evaluate('modeClicks'), 1);

    // Some editors mount the category list, resize controls and inventory separately.
    await navigate('?language=ja', '/ja');
    await browser.evaluate(`(() => {
      const editor = document.querySelector('.avatar-editor');
      editor.querySelector('.inventory-column').outerHTML = ${JSON.stringify(japaneseInventory)};
      const inventory = editor.querySelector('.inventory-column');
      const nav = inventory.querySelector('nav');
      inventory.before(nav);
      inventory.prepend(Object.assign(document.createElement('section'), {
        id: 'resize-options',
        innerHTML: '<label><span>R6</span><input type="checkbox"><span>R15</span></label>'
      }));
      inventory.querySelector('.avatar-items-container').replaceChildren();
      const canvas = document.querySelector('#native-model');
      canvas.style.height = '72px';
      canvas.height = 72;
      const context = canvas.getContext('2d');
      context.save();
      context.fillStyle = '#ff00ff';
      context.fillRect(142, 28, 16, 16);
      context.restore();
      window.nativeInventory = inventory;
    })()`);
    await enhance();
    await browser.waitFor(ready);
    assert.equal(await browser.evaluate("nativeInventory.parentElement.matches('.avatar-editor')"), true,
      'An empty inventory and its native mount stay in the right column');
    await browser.evaluate(`nativeInventory.querySelector('.avatar-items-container').innerHTML =
      '<a class="item-card-container">Item</a>'.repeat(7)`);
    await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const [canvas, first, second, categories, items] = await browser.evaluate(`
      ['#native-model', '.preview-column', '#rc-avatar-2d', '#avatar-categories', '.avatar-items-container']
        .map(selector => document.querySelector(selector).getBoundingClientRect().toJSON())`);
    assert.ok(Math.abs(canvas.width - canvas.height) < 2 && canvas.width > 180, JSON.stringify(canvas));
    assert.ok(first.right <= categories.left && first.right <= items.left, JSON.stringify({ first, categories, items }));
    assert.ok(categories.bottom <= items.top && items.top < second.top, JSON.stringify({ categories, items, second }));
    assert.equal(await browser.evaluate("document.querySelectorAll('.avatar-items-container .item-card-container').length"), 7);
    const { data } = await browser.send('Page.captureScreenshot', { format: 'png', clip: {
      x: Math.floor(canvas.left), y: Math.floor(canvas.top), width: Math.ceil(canvas.width), height: Math.ceil(canvas.height), scale: 1
    } });
    const painted = await browser.evaluate(`(async () => {
      const image = new Image();
      image.src = 'data:image/png;base64,${data}';
      await image.decode();
      const reader = document.createElement('canvas');
      reader.width = image.width;
      reader.height = image.height;
      const context = reader.getContext('2d');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, reader.width, reader.height).data;
      let left = reader.width, top = reader.height, right = -1, bottom = -1;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] < 230 || pixels[i + 1] > 40 || pixels[i + 2] < 230) continue;
        const x = (i / 4) % reader.width, y = Math.floor(i / 4 / reader.width);
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
      return { width: right - left + 1, height: bottom - top + 1 };
    })()`);
    assert.ok(painted.width >= 8 && Math.abs(painted.width - painted.height) <= 2,
      `A square rendered into the short native drawing buffer keeps its proportions: ${JSON.stringify(painted)}`);

    await navigate('?language=pending');
    await assertVisible();
    await browser.evaluate("document.documentElement.lang='ja'");
    await enhance();
    await browser.waitFor(ready);
    await assertVisible();

    await navigate('?language=fr');
    await assertVisible();
    assert.deepEqual(browser.errors, []);
  });
