const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const scripts = ['src/shared/runtime.js', 'src/shared/native-labels.js', 'src/shared/startup.js', 'src/pages/profile/profile-page.js'];
const styles = ['src/shared/theme.css', 'src/pages/profile/profile-page.css'];
const bio = '完整简介 / 完整介紹\n' + 'This is the complete public description. 保留所有文字、换行和链接。\n'.repeat(20)
  + 'https://example.com/' + 'long-path-'.repeat(25) + '\n最后一行 / 最後一行';
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function fixture(variant, locale) {
  const about = locale === 'en' ? 'About' : locale === 'zh-cn' ? '介绍' : '介紹';
  const creations = locale === 'en' ? 'Creations' : '作品';
  const placeholder = locale === 'en' ? 'No bio yet.' : locale === 'zh-cn' ? '暂无简介' : '尚無簡介';
  const description = variant === 'empty' ? placeholder : ['legacy', 'truncated'].includes(variant) ? escape(bio.slice(0, 65)) + '…' : escape(bio);
  return `<!doctype html><html lang="${locale}" class="dark-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <style>*{box-sizing:border-box}body{font:16px/1.5 Arial;margin:16px;background:#222;color:white}#content{max-width:1000px;margin:auto}.light-theme body{background:#fafafa;color:#222}#bio-box{max-height:65px;overflow:hidden}.description-content{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-overflow:ellipsis;white-space:pre-wrap;max-height:42px;margin:0}.profile-tabs{display:flex;list-style:none}.profile-tabs li{flex:1}.profile-tab{display:block;padding:15px;color:inherit}.active{border-bottom:2px solid white}.hidden,[hidden]{display:none!important}#bio-wrapper{height:65px;overflow:hidden}a{color:inherit}#profile-container>section{margin:20px 0}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body><main id="content"><div id="profile-container"><h1>Sample user</h1><div id="bio-wrapper"><div id="bio-box">${variant === 'legacy' ? `<p id="native-bio">${description}</p>` : `<pre id="native-bio" class="description-content text-overflow-2-lines">${description}</pre>`}<button class="more-btn" id="native-more" onclick="openAbout()">${locale === 'en' ? 'More' : '更多'}</button></div></div><div id="native-tabs-mount"><ul class="profile-tabs"><li><a id="tab-about" href="#about" class="profile-tab">${about}</a></li><li><a id="tab-creations" href="#creations" class="profile-tab active">${creations}</a></li></ul><div id="native-about-content" class="profile-tab-content hidden">About content</div><div id="native-creations-content" class="profile-tab-content">Creations content</div></div><section><h2>Friends</h2><ul></ul></section><section><h2>Badges</h2><ul></ul></section><div id="unrelated-controls"><button>介绍</button><button>作品</button><p>This is unrelated profile content.</p></div><div role="dialog" hidden><pre class="description-content">Hidden modal text</pre></div></div></main><script>
    window.aboutClicks=0;window.moreClicks=0;
    document.addEventListener('click',event=>{const target=event.target.closest('.profile-tab');if(!target)return;event.preventDefault();if(target.id==='tab-about')aboutClicks++;document.querySelectorAll('.profile-tab').forEach(node=>node.classList.toggle('active',node===target));document.querySelector('#native-about-content').classList.toggle('hidden',target.id!=='tab-about');document.querySelector('#native-creations-content').classList.toggle('hidden',target.id!=='tab-creations')});
    window.savedBio=document.querySelector('#native-bio');window.savedMore=document.querySelector('#native-more');
    window.openAbout=()=>{
      moreClicks++;
      const dialog=document.createElement('div');dialog.id='native-about-modal';dialog.setAttribute('role','dialog');
      dialog.style.cssText='position:fixed;inset:20px;z-index:10000;overflow:auto;background:#30343b;padding:20px';
      dialog.innerHTML='<button id="close-about">Close</button><div><span class="group-description-dialog-body-header">About @Player</span><pre class="description-content text-wrap"></pre></div><div id="native-socials"><span>Social links</span><a href="https://www.youtube.com/@Player">YouTube</a></div><div id="native-names">Previous names: OldPlayer</div><div id="native-joined">Join date: 1/1/2020</div>';
      dialog.querySelector('pre').textContent=${JSON.stringify(variant === 'empty' ? placeholder : bio)};
      dialog.querySelector('#close-about').onclick=()=>dialog.remove();
      ${variant === 'legacy' ? "document.querySelector('#bio-box').append(dialog)" : 'document.body.append(dialog)'};
    };
    </script></body></html>`;
}

test('profile bios expand fully and native About/Creations tabs stay hidden across languages and remounts',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const files = new Set([...scripts, ...styles]);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'); const file = url.pathname.slice(1);
      response.setHeader('Cache-Control', 'no-store');
      if (files.has(file)) { response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript'); response.end(fs.readFileSync(path.join(workspace, file))); }
      else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(fixture(url.searchParams.get('variant'), url.searchParams.get('locale'))); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'profile-description');
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.profileRequests=[];window.chrome={storage:{local:{async get(){return {customBackground:{source:'none'}}}},onChanged:{addListener(){}}},runtime:{lastError:null,sendMessage(message,callback){if(message.type==='rc-profile-details')profileRequests.push(callback);else setTimeout(()=>callback({error:'Unused optional fixture data'}),0)}}};
    ` });
    for (const variant of ['modern', 'empty', 'legacy', 'truncated']) for (const locale of ['en', 'zh-cn', 'zh-tw']) {
      const target = new URL('/users/1488540472/profile', `http://127.0.0.1:${server.address().port}`);
      target.searchParams.set('variant', variant); target.searchParams.set('locale', locale);
      await browser.send('Page.navigate', { url: target.href }); await waitForDocument(browser, '#native-bio', target.href);
      // Native React commits its complete subtree with handlers already bound.
      // Start the scripts after this fixture's equivalent mount is ready.
      for (const file of scripts) await browser.evaluate(fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file);
      await browser.waitFor("aboutClicks===1 && !!document.querySelector('.profile-tabs[data-rc-profile-native-tabs]')");
      if (variant !== 'legacy') {
        await browser.waitFor("document.querySelector('#native-bio').hasAttribute('data-rc-profile-native-description')");
        assert.equal(await browser.evaluate("document.querySelector('#rc-profile-inline-about')===null"), true, 'The native full bio is not replaced');
        assert.equal(await browser.evaluate("document.querySelector('#native-bio')===savedBio && document.querySelector('#native-more')===savedMore"), true);
      }
      await browser.waitFor('profileRequests.length===1');
      const details = ['legacy', 'truncated'].includes(variant) ? { description: bio, created: '2020-01-01' }
        : variant === 'modern' ? { description: 'Older API description', created: '2020-01-01' } : { error: 'API unavailable' };
      await browser.evaluate(`profileRequests[0](${JSON.stringify(details)})`);
      const selector = ['legacy', 'truncated'].includes(variant) ? '#rc-profile-inline-about .rc-profile-inline-bio' : '#native-bio';
      await browser.waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);
      for (const theme of ['dark', 'light']) for (const width of [1360, 390, 320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 600 });
        await browser.evaluate(`document.documentElement.className='${theme}-theme';new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
        const state = await browser.evaluate(`(()=>{const node=document.querySelector(${JSON.stringify(selector)}),rect=node.getBoundingClientRect(),box=document.querySelector('#bio-wrapper').getBoundingClientRect();return {text:node.textContent,height:rect.height,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,covered:rect.bottom<=box.bottom+.5,overflow:document.documentElement.scrollWidth>innerWidth,tabs:document.querySelector('.profile-tabs').checkVisibility(),about:document.querySelector('#native-about-content').checkVisibility(),creations:document.querySelector('#native-creations-content').checkVisibility(),unrelated:document.querySelector('#unrelated-controls').checkVisibility(),modal:document.querySelector('[role=dialog]').checkVisibility()}})()`);
        const label = `${variant} ${locale} ${theme} ${width}`;
        assert.equal(state.text, variant === 'empty' ? locale === 'en' ? 'No bio yet.' : locale === 'zh-cn' ? '暂无简介' : '尚無簡介' : bio, label);
        assert.ok(state.scrollHeight <= state.clientHeight + 1, `${label}: no clipped lines`);
        assert.equal(state.covered, true, `${label}: ancestor grows with the full bio`);
        assert.equal(state.overflow, false, `${label}: long links wrap`);
        assert.equal(state.tabs, false, label); assert.equal(state.about, true, label); assert.equal(state.creations, false, label);
        assert.equal(state.unrelated, true, label); assert.equal(state.modal, false, label);
      }
      // Recreate Roblox's tab strip, then remove only the extension's marker.
      // Stable native IDs must keep it hidden even before the next JS pass.
      await browser.evaluate("document.querySelector('.profile-tabs').outerHTML=document.querySelector('.profile-tabs').outerHTML.replace('data-rc-profile-native-tabs=\"\"','')");
      assert.equal(await browser.evaluate("document.querySelector('.profile-tabs').checkVisibility()"), false);
      await browser.waitFor("document.querySelector('.profile-tabs').hasAttribute('data-rc-profile-native-tabs')");
      assert.equal(await browser.evaluate("savedMore.checkVisibility() && document.querySelector('#native-more')===savedMore"), true, 'Native More is retained when using the API fallback');
      await browser.click('#native-more');
      await browser.waitFor("!!document.querySelector('#native-about-modal')");
      const modal = await browser.evaluate("(()=>{const node=document.querySelector('#native-about-modal pre');return {text:node.textContent,complete:node.scrollHeight<=node.clientHeight+1,visible:document.querySelector('#native-about-modal').checkVisibility(),details:['native-socials','native-names','native-joined'].map(id=>document.getElementById(id).checkVisibility()),overflow:document.querySelector('#native-about-modal').scrollWidth>document.querySelector('#native-about-modal').clientWidth}})()");
      assert.equal(modal.text, variant === 'empty' ? locale === 'en' ? 'No bio yet.' : locale === 'zh-cn' ? '暂无简介' : '尚無簡介' : bio);
      assert.equal(modal.complete, true, 'The More dialog has no clipped description lines');
      assert.equal(modal.visible, true); assert.deepEqual(modal.details, [true, true, true], 'More retains all native About details'); assert.equal(modal.overflow, false);
      await browser.click('#close-about');
      assert.equal(await browser.evaluate("document.querySelector('#native-about-modal')===null"), true);
      assert.equal(await browser.evaluate('moreClicks'), 1);
      if (variant === 'legacy' || variant === 'truncated') {
        // React upgrades an initially truncated preview after the API fallback
        // has mounted. Its newer native text must replace the older fallback.
        await browser.evaluate("const current=document.createElement('div');current.id='native-bio';current.className='description-content text-overflow-2-lines';current.textContent='Updated full native description / 更新后的完整简介\\n最後一行';savedBio.replaceWith(current)");
        await browser.waitFor("document.querySelector('#rc-profile-inline-about')===null && !!document.querySelector('#native-bio[data-rc-profile-native-description]')");
        assert.equal(await browser.evaluate("document.querySelector('#native-bio').checkVisibility() && savedMore.checkVisibility()"), true, 'Late native text and More stay visible');
        await pause(200);
        assert.equal(await browser.evaluate("document.querySelector('#native-bio').textContent"), 'Updated full native description / 更新后的完整简介\n最後一行', 'The older API response cannot restore the incomplete preview');
      } else {
        await browser.evaluate("savedBio.textContent='更新后的完整简介\\n最後一行';savedBio.className='description-content text-overflow-2-lines'");
        await pause(200); assert.equal(await browser.evaluate('savedBio.textContent'), '更新后的完整简介\n最後一行');
      }
    }
    assert.deepEqual(browser.errors, []);
  });
