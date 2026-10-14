const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const policies = JSON.parse(fs.readFileSync(path.join(workspace, 'src/legal/content.json'), 'utf8'));
const scripts = ['src/shared/compatibility.js', 'src/shared/runtime.js', 'src/shared/native-labels.js',
  'src/shared/i18n.js', 'src/shared/startup.js', 'src/settings/terms-acceptance.js', 'src/settings/language-warning.js', 'src/settings/settings.js'];
const styles = ['src/shared/theme.css', 'src/settings/settings.css'];
const legalFiles = ['src/legal/index.html', 'src/legal/legal.js', 'src/legal/legal.css', 'src/legal/content.json'];

test('Published policies match the packaged documents and packaged page dependencies exist', () => {
  for (const [file, source] of Object.entries(require('../scripts/build-legal-docs.cjs').build())) {
    assert.equal(fs.readFileSync(path.join(workspace, file), 'utf8'), source, `${file} is current`);
  }
  assert.ok(manifest.web_accessible_resources.some(entry => entry.resources.includes('src/legal/index.html')
    && entry.matches.includes('https://www.roblox.com/*')), 'Roblox can open the packaged legal page');
  for (const file of legalFiles) assert.ok(fs.statSync(path.join(workspace, file)).isFile(), file);
});

test('Settings legal buttons and first-opening acceptance work in all languages and fallback mode; policies load locally',
  { skip: !process.env.CHROME_BIN, timeout: 90000 }, async t => {
    const files = new Set([...scripts, ...styles, ...legalFiles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      const file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      const types = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
      response.setHeader('Content-Type', (types[path.extname(file)] || 'text/html') + '; charset=utf-8');
      if (files.has(file)) { response.end(fs.readFileSync(path.join(workspace, file))); return; }
      if (!['/home', '/games/123'].includes(url.pathname)) { response.writeHead(404); response.end(); return; }
      const language = url.searchParams.get('robloxLanguage') || 'en';
      const firstRun = url.searchParams.has('firstRun');
      const lateRead = url.searchParams.has('lateRead');
      response.end(`<!doctype html><html lang="${language}" class="dark-theme"><head><meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <meta name="locale-data" data-language-code="${language}">
        <style>*{box-sizing:border-box}body{margin:0;background:#20222a;color:#f7f7fa;font:16px Arial}#content{padding:20px}</style>
        ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
        <ul id="settings-popover-menu"><li><a href="/my/account">Settings</a></li></ul><main id="content">Roblox fixture</main>
        <script>
          const changed=[],messages=[];let settings={customBackground:{source:'none',uiLanguage:'en'},
            ...(${firstRun} ? JSON.parse(localStorage.getItem('terms-fixture')||'{}') : {robloxCustomizerTermsAccepted:true,robloxCustomizerLanguageWarning:{opened:true,language:${JSON.stringify(language)}}})};
          window.readSavedTerms=()=>settings.robloxCustomizerTermsAccepted;
          window.chrome={i18n:{getUILanguage:()=> 'en'},storage:{local:{async get(key){
            if(${lateRead} && key==='robloxCustomizerTermsAccepted')return new Promise(resolve=>{window.releaseTermsRead=()=>resolve({})});
            return settings},async set(patch){
            if(window.failTermsWrite&&patch.robloxCustomizerTermsAccepted===true)throw new Error('Storage unavailable');
            const old=settings;settings={...settings,...patch};changed.forEach(fn=>fn(Object.fromEntries(Object.entries(patch).map(([key,newValue])=>[key,{oldValue:old[key],newValue}])),'local'))},
            async remove(key){delete settings[key]}},onChanged:{addListener:fn=>changed.push(fn)}},runtime:{id:'test-extension',lastError:null,
              getURL:file=>'/'+file,onMessage:{addListener:fn=>messages.push(fn)},sendMessage(message,callback){callback({id:1,name:'Player',displayName:'Player'})}}};
          window.openCustomizer=()=>messages.forEach(fn=>fn({type:'rc-open-settings'},{id:'test-extension'}));
          const set=chrome.storage.local.set;chrome.storage.local.set=async patch=>{await set(patch);if(${firstRun})localStorage.setItem('terms-fixture',JSON.stringify(settings))};
        </script>${scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'legal');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    // A local fixture supplies only packaged assets. Any external request fails the check below.
    await browser.send('Network.setBlockedURLs', { urls: ['https://*', 'http://www.*'] });

    const buttonState = `(()=>[...document.querySelectorAll('[data-rc-legal-document]')].map(link=>{
      const r=link.getBoundingClientRect();return {text:link.textContent,href:link.href,visible:link.checkVisibility(),
        withinViewport:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,target:link.target,rel:link.rel};
    }))()`;
    for (const robloxLanguage of ['en', 'fr-FR']) {
      const url = `${origin}/home?robloxLanguage=${robloxLanguage}`;
      await browser.send('Page.navigate', { url });
      await waitForDocument(browser, '#content', url);
      await browser.evaluate('openCustomizer()');
      await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
      assert.equal(await browser.evaluate('RobloxCustomizerCompatibility.fallback()'), robloxLanguage === 'fr-FR');
      for (const language of ['en', 'zh-CN', 'zh-TW']) {
        await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(language)})`);
        await browser.waitFor(`document.querySelector('[data-rc-legal-document="privacy"]').textContent===${JSON.stringify(policies.locales[language].privacy.title)}`);
        for (const width of [1280, 320]) {
          await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          for (const [index, button] of (await browser.evaluate(buttonState)).entries()) {
            const type = index === 0 ? 'terms' : 'privacy';
            assert.equal(button.text, policies.locales[language][type].title);
            assert.equal(button.href, `${origin}/src/legal/index.html?document=${type}&lang=${language}`);
            assert.ok(button.visible && button.withinViewport, `${robloxLanguage}/${language}/${width}: legal button is available`);
            assert.equal(button.target, '_blank');
            assert.match(button.rel, /noopener/); assert.match(button.rel, /noreferrer/);
          }
        }
      }
      // Tab wrapping includes legal links and skips hidden/disabled fallback controls.
      await browser.evaluate("document.querySelector('#rc-close').focus()");
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, modifiers: 8 });
      assert.equal(await browser.evaluate("document.activeElement.closest('.rc-settings-footer')!==null"), true);
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
      assert.equal(await browser.evaluate('document.activeElement.id'), 'rc-close');
      await browser.click('[data-rc-legal-document="privacy"]');
      let target;
      for (let attempt = 0; attempt < 50 && !target; attempt++) {
        target = (await browser.send('Target.getTargets')).targetInfos.find(info => info.url === `${origin}/src/legal/index.html?document=privacy&lang=zh-TW`);
        if (!target) await pause(30);
      }
      assert.ok(target, 'Click opens the privacy policy in a new tab');
      await browser.send('Target.closeTarget', { targetId: target.targetId });
      assert.equal(await browser.evaluate("document.querySelector('#rc-settings-overlay').checkVisibility()"), true, 'Settings remain open');
    }

    for (const type of ['terms', 'privacy']) {
      for (const language of ['en', 'zh-CN', 'zh-TW']) {
        const url = `${origin}/src/legal/index.html?document=${type}&lang=${language}`;
        await browser.send('Page.navigate', { url });
        await waitForDocument(browser, '#legal-content .contact', url);
        assert.equal(await browser.evaluate('document.documentElement.lang'), language);
        assert.equal(await browser.evaluate("document.querySelector('h1').textContent"), policies.locales[language][type].title);
        assert.match(await browser.evaluate("document.querySelector('.metadata').textContent"), /Lunarfox 月狐/);
        assert.equal(await browser.evaluate("document.querySelector('.contact a').href"), 'mailto:lunar@lunarfox.my');
        assert.equal(await browser.evaluate(`document.querySelector('nav [aria-current="page"]').id`), `${type}-link`);
        const requests = await browser.evaluate('performance.getEntriesByType("resource").map(entry=>entry.name)');
        assert.ok(requests.length >= 3 && requests.every(url => url.startsWith(origin + '/')), 'Policy loading contacts only the local package');
        assert.equal(await browser.evaluate("document.documentElement.scrollWidth<=innerWidth"), true, 'No horizontal overflow at 320px');
        await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
        assert.equal(await browser.evaluate('getComputedStyle(document.documentElement).backgroundColor'), 'rgb(18, 21, 28)');
        await browser.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
        assert.equal(await browser.evaluate('getComputedStyle(document.documentElement).backgroundColor'), 'rgb(244, 246, 250)');
      }
    }
    // Changing the legal page's language updates both its document and navigation without storage access.
    await browser.evaluate("document.querySelector('#language').value='en';document.querySelector('#language').dispatchEvent(new Event('change'))");
    assert.equal(await browser.evaluate("document.querySelector('h1').textContent"), 'Privacy Policy');
    assert.equal(await browser.evaluate("document.querySelector('#terms-link').search"), '?document=terms&lang=en');
    assert.equal(await browser.evaluate('location.search'), '?document=privacy&lang=en');
    const invalid = `${origin}/src/legal/index.html?document=unknown&lang=fr&extra=1`;
    await browser.send('Page.navigate', { url: invalid });
    await waitForDocument(browser, '#legal-content .contact', invalid);
    assert.equal(await browser.evaluate("document.querySelector('h1').textContent"), 'Privacy Policy');
    assert.equal(await browser.evaluate('document.documentElement.lang'), 'en');

    // A fresh visit starts onboarding automatically, after checking storage and without opening settings.
    await browser.evaluate("localStorage.removeItem('terms-fixture')");
    const fresh = `${origin}/home?firstRun=1&lateRead=1`;
    await browser.send('Page.navigate', { url: fresh });
    await waitForDocument(browser, '#content', fresh);
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay,#rc-terms-dialog')"), false, 'Waits for the saved acceptance read');
    await browser.evaluate('releaseTermsRead()');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), false, 'First-visit prompt appears without opening settings');
    await browser.evaluate('openCustomizer();openCustomizer();openCustomizer()');
    assert.equal(await browser.evaluate("document.querySelectorAll('#rc-terms-dialog').length"), 1, 'Repeated opening requests share one prompt');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), false, 'Settings wait for acceptance');
    for (const [language, title] of [['en','Welcome to Roblox Customizer'], ['zh-CN','欢迎使用 Roblox Customizer'], ['zh-TW','歡迎使用 Roblox Customizer']]) {
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(language)})`);
      await browser.waitFor(`document.querySelector('#rc-terms-title').textContent===${JSON.stringify(title)}`);
      for (const width of [1280, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        const geometry = await browser.evaluate(`(()=>{const r=document.querySelector('#rc-terms-dialog').getBoundingClientRect();
          return {centerX:r.x+r.width/2,centerY:r.y+r.height/2,viewport:[innerWidth,innerHeight],fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}})()`);
        assert.ok(geometry.fits && Math.abs(geometry.centerX-geometry.viewport[0]/2)<1 && Math.abs(geometry.centerY-geometry.viewport[1]/2)<1, 'Prompt is centered and fits the screen');
      }
      assert.equal(await browser.evaluate("document.querySelector('#rc-terms-dialog [data-rc-legal-document=terms]').search"), `?document=terms&lang=${language}`);
    }
    await browser.evaluate("document.querySelector('#rc-terms-dialog a').focus()");
    await browser.send('Input.dispatchKeyEvent', { type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8 });
    await browser.send('Input.dispatchKeyEvent', { type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8 });
    assert.equal(await browser.evaluate('document.activeElement.id'), 'rc-terms-accept');
    await browser.send('Input.dispatchKeyEvent', { type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9 });
    await browser.send('Input.dispatchKeyEvent', { type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9 });
    assert.equal(await browser.evaluate('document.activeElement.dataset.rcLegalDocument'), 'terms');
    await browser.click('#rc-terms-dialog [data-rc-legal-document=terms]');
    let termsTarget;
    for (let attempt=0;attempt<50&&!termsTarget;attempt++) {
      termsTarget=(await browser.send('Target.getTargets')).targetInfos.find(info=>info.url===`${origin}/src/legal/index.html?document=terms&lang=zh-TW`);
      if(!termsTarget)await pause(30);
    }
    assert.ok(termsTarget, 'User can read the terms in a separate tab before accepting');
    await browser.send('Target.closeTarget', { targetId:termsTarget.targetId });
    await browser.click('#rc-terms-later');
    await browser.waitFor("!document.querySelector('#rc-terms-dialog')");
    assert.equal(await browser.evaluate('readSavedTerms()===true'), false, 'Not now does not record acceptance');
    await browser.evaluate('openCustomizer()');
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    await browser.send('Input.dispatchKeyEvent', { type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27 });
    await browser.send('Input.dispatchKeyEvent', { type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27 });
    await browser.waitFor("!document.querySelector('#rc-terms-dialog')");
    assert.equal(await browser.evaluate('readSavedTerms()===true'), false, 'Escape does not record acceptance');
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('en');openCustomizer();failTermsWrite=true");
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    await browser.click('#rc-terms-accept');
    await browser.waitFor("document.querySelector('#rc-terms-status').textContent.includes('Could not save')");
    assert.equal(await browser.evaluate('readSavedTerms()===true'), false, 'Failed storage is not acceptance');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), false);
    assert.equal(await browser.evaluate("document.querySelector('#rc-terms-accept').disabled"), false, 'Storage failure allows retry');
    await browser.evaluate('failTermsWrite=false');
    await browser.click('#rc-terms-accept');
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')&&!document.querySelector('#rc-terms-dialog')");
    assert.equal(await browser.evaluate('readSavedTerms()'), true);
    for (const language of ['en','zh-CN','zh-TW']) {
      const url=`${origin}/home?firstRun=1&robloxLanguage=${language}`;
      await browser.send('Page.navigate',{url});await waitForDocument(browser,'#content',url);
      await browser.waitFor('RobloxCustomizerTerms.accepted()');
      assert.equal(await browser.evaluate("!!document.querySelector('#rc-terms-dialog,#rc-settings-overlay')"), false, 'Accepted users visit Roblox without any onboarding UI');
      await browser.evaluate('openCustomizer()');await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
      assert.equal(await browser.evaluate("!!document.querySelector('#rc-terms-dialog')"), false, 'Reload and language changes do not repeat an accepted prompt');
      await browser.click('#rc-done');await browser.waitFor("!document.querySelector('#rc-settings-overlay')");
      await browser.evaluate('openCustomizer()');await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
      assert.equal(await browser.evaluate("!!document.querySelector('#rc-terms-dialog')"), false);
    }
    // A fresh fallback installation agrees first, then receives its existing language warning.
    await browser.evaluate("localStorage.removeItem('terms-fixture')");
    const unsupported=`${origin}/games/123?firstRun=1&robloxLanguage=fr-FR`;
    await browser.send('Page.navigate',{url:unsupported});await waitForDocument(browser,'#content',unsupported);
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), false, 'Direct game visits also show the terms without settings');
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-language-warning-dialog')"), false, 'The opening notices do not overlap');
    await browser.click('#rc-terms-accept');await browser.waitFor("!document.querySelector('#rc-terms-dialog')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay')"), false, 'Accepting an automatic prompt leaves the user on Roblox');
    await browser.evaluate('openCustomizer()');await browser.waitFor("!!document.querySelector('#rc-language-warning-dialog:modal')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-terms-dialog')"), false);
    await browser.click('#rc-language-warning-dialog button');
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-legal-document=privacy]').checkVisibility()"), true);
    // An existing language-change warning waits for onboarding without being marked as shown early.
    await browser.evaluate(`localStorage.setItem('terms-fixture',JSON.stringify({robloxCustomizerLanguageWarning:{opened:true,language:'en'}}))`);
    await browser.send('Page.navigate',{url:unsupported});await waitForDocument(browser,'#content',unsupported);
    await browser.waitFor("!!document.querySelector('#rc-terms-dialog:modal')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-language-warning-dialog')"), false);
    await browser.click('#rc-terms-accept');
    await browser.waitFor("!!document.querySelector('#rc-language-warning-dialog:modal')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-settings-overlay,#rc-terms-dialog')"), false, 'The language notice follows onboarding without opening settings');
    await browser.click('#rc-language-warning-dialog button');
    // A saved acceptance arriving from another tab wins over an older, delayed initial read.
    await browser.evaluate("localStorage.removeItem('terms-fixture')");
    await browser.send('Page.navigate',{url:fresh});await waitForDocument(browser,'#content',fresh);
    await browser.evaluate("openCustomizer();chrome.storage.local.set({robloxCustomizerTermsAccepted:true});releaseTermsRead()");
    await browser.waitFor("!!document.querySelector('#rc-settings-overlay')");
    assert.equal(await browser.evaluate("!!document.querySelector('#rc-terms-dialog')"), false, 'Cross-tab acceptance avoids a stale prompt');
    assert.deepEqual(browser.errors, [], 'No script errors');
  });
