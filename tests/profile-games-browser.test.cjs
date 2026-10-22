const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const entries = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8')).content_scripts;
const scripts = [...new Set(entries.filter(entry => entry.world !== 'MAIN').flatMap(entry => entry.js || []))];
const styles = [...new Set(entries.flatMap(entry => entry.css || []))];
const gameName = '[HISHI AMAZON + SKILL BUILDER] Uma';
const game = name => `<li class="native-tile"><div class="game-card-container"><a class="game-card-link" href="/games/123/Uma">
  <div class="game-card-thumb-container"><img src="/game.svg" alt=""></div><div class="game-card-name"><h3>${name}</h3></div>
  <div class="game-card-info"><span>95%</span> <span>206</span></div></a></div></li>`;

test('English Games sections use the profile theme for sparse and remounted native game cards',
  { skip: !process.env.CHROME_BIN, timeout: 45000 }, async t => {
    const assets = new Set([...scripts, ...styles, 'icons/icon-48.png', 'icons/icon-128.png']);
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost'), file = url.pathname.slice(1);
      if (assets.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/javascript');
        response.end(fs.readFileSync(path.join(workspace, file)));return;
      }
      if (file.endsWith('.svg')) {
        response.setHeader('Content-Type', 'image/svg+xml');
        response.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g"><stop stop-color="#6171a4"/><stop offset="1" stop-color="#b4617d"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>');return;
      }
      const theme = url.searchParams.get('theme') || 'dark';
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>*{box-sizing:border-box}body{margin:24px;font:16px/1.4 Arial;color:#eee;background:#24252c}h3{font:inherit;margin:0}
        .light-theme{color:#222;background:#fafafa}.game-cards{margin:0;padding:0;list-style:none;display:flex;gap:16px}
        .native-tile{width:146px;flex-shrink:0}.game-card-container{background:#485889;overflow:hidden;border-radius:5px}
        .game-card-thumb-container img{display:block;width:146px;height:146px}.game-card-name{height:38px;overflow:hidden;font-weight:bold}
        .game-card-info{font-size:12px}a{color:inherit;text-decoration:none}#profile-sections{display:flex;flex-direction:column;gap:18px}</style>
        ${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="${theme==='light'?'light':'dark'}-theme">
        <main id="content"><div id="profile-container"><h1>Player</h1><div id="profile-sections">
          <div id="games"><div class="container-header"><h2>Games</h2></div><ul class="game-cards">${game(gameName)}</ul></div>
          <div id="favorites"><h2>Favorites</h2></div></div></div></main>
        <script>window.gameClicks=0;window.originalGame=document.querySelector('.game-card-container');
        document.querySelector('#games').addEventListener('click',event=>{if(event.target.closest('a')){event.preventDefault();gameClicks++}});</script></body></html>`);
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser = await isolatedChrome(t,'profile-games');
    await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:`
      window.chrome={i18n:{getUILanguage:()=> 'en-US'},storage:{local:{async get(){return {robloxCustomizerTermsAccepted:true,robloxCustomizerSettingsGuideSeen:true,
        customBackground:{source:'url',url:location.origin+'/wallpaper.svg',urlType:'image',glassOpacity:51,
          experimentalCustomColors:location.search.includes('custom'),customTextColor:'#ffffff',customBackgroundColor:'#394b84',customAccentColor:'#fc33ff'}}},
        async set(){},async remove(){}},onChanged:{addListener(){}}},runtime:{lastError:null,getURL:file=>'/'+file,
        sendMessage(message,callback){setTimeout(()=>callback?.({error:'No optional fixture data'}),0)}}};
    `});
    for(const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')+'\n//# sourceURL='+file});
    const ready = "document.querySelector('#games')?.dataset.rcProfileSection==='experiences' && !!document.querySelector('#games [data-rc-profile-card=game]')";
    for(const theme of ['dark','light','custom']) {
      const url=`http://127.0.0.1:${server.address().port}/users/91943429/profile?theme=${theme}`;
      await browser.send('Page.navigate',{url});await waitForDocument(browser,'#games',url);await browser.waitFor(ready);
      for(const width of [1400,390,320]) {
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        const state=await browser.evaluate(`(()=>{const section=document.querySelector('#games'),card=section.querySelector('[data-rc-profile-card]'),title=card.querySelector('.game-card-name'),img=card.querySelector('img');
          const s=section.getBoundingClientRect(),c=card.getBoundingClientRect();return {section:section.dataset.rcProfileSection,count:section.dataset.rcProfileCardCount,
            background:getComputedStyle(section).backgroundColor,border:getComputedStyle(section).borderRadius,cardBackground:getComputedStyle(card).backgroundColor,
            title:title.textContent,clipped:title.scrollHeight>title.clientHeight+1,thumbnail:img.dataset.rcProfileCardThumb,
            inside:c.left>=s.left&&c.right<=s.right+1,overflow:document.documentElement.scrollWidth>innerWidth,preserved:card===originalGame}})()`);
        assert.equal(state.section,'experiences');assert.equal(state.count,'1');assert.equal(state.title,gameName);
        assert.notEqual(state.background,'rgba(0, 0, 0, 0)',`${theme}/${width}: section has a themed surface`);
        assert.notEqual(state.cardBackground,'rgba(0, 0, 0, 0)');assert.notEqual(state.border,'0px');
        assert.equal(state.thumbnail,'game');assert.equal(state.clipped,false);assert.equal(state.inside,true);assert.equal(state.overflow,false);assert.equal(state.preserved,true);
        if(process.env.PROFILE_GAMES_SCREENSHOTS) {
          const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
          fs.writeFileSync(path.join(process.env.PROFILE_GAMES_SCREENSHOTS,`${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
        }
      }
      await browser.click('.game-card-link');assert.equal(await browser.evaluate('gameClicks'),1);
      // Existing names, count/See All adornments, and native replacement mounts
      // all retain the same section; a game title of "Games" stays inside its card.
      for(const heading of ['Experiences','Creations','Games (1) See All →','Games']) {
        await browser.evaluate(`document.querySelector('#games h2').textContent=${JSON.stringify(heading)};document.querySelector('#games .game-cards').innerHTML=${JSON.stringify(game('Games'))}`);
        await browser.waitFor(ready);
        assert.equal(await browser.evaluate("document.querySelectorAll('#games [data-rc-profile-section]').length"),0);
        assert.equal(await browser.evaluate("document.querySelectorAll('#games [data-rc-profile-card=game]').length"),1);
      }
    }
    assert.deepEqual(browser.errors,[]);
  });
