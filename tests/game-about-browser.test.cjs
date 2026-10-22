const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {test} = require('node:test');
const {isolatedChrome,waitForDocument} = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname,'..');
const styles = ['src/shared/theme.css','src/pages/games/game-page.css'];
const scripts = ['src/shared/routes.js','src/shared/compatibility.js','src/shared/native-labels.js','src/pages/games/game-page.js'];
const description = 'Discover the mystery and explore with your friends.\n\nControls:\nUse items with a mouse, touch screen, or controller.\nCrouch to hide from danger.\n\nCredits:\nThanks to the builders and community.\nhttps://example.invalid/'+ 'long-link-'.repeat(22);
const labels = {
  en:['Active','Favorites','Visits','Voice Chat','Camera','Created','Updated','Server Size','Genre'],
  'zh-CN':['活跃','收藏','访问次数','语音聊天','摄像头','创建日期','更新日期','服务器人数','类型'],
  'zh-TW':['活躍','最愛','造訪次數','語音聊天','攝影機','建立日期','更新日期','伺服器人數','類型'],
  id:['Aktif','Favorit','Kunjungan','Obrolan suara','Kamera','Dibuat','Diperbarui','Ukuran server','Genre'],
  ja:['アクティブ','お気に入り','訪問数','ボイスチャット','カメラ','作成日','更新日','サーバーの人数','ジャンル'],
  th:['ผู้เล่นที่ใช้งานอยู่','รายการโปรด','จำนวนการเข้าชม','แชทด้วยเสียง','กล้อง','สร้างเมื่อ','อัปเดต','ขนาดเซิร์ฟเวอร์','แนวเกม'],
  ko:['활성','즐겨찾기','방문 수','음성 채팅','카메라','생성일','업데이트','서버 크기','장르']
};
const stats = labels.en.map((label,i)=>`<li class="game-stat"><p class="text-label text-overflow font-caption-header">${label}</p><p class="text-lead font-caption-body">${['11,870','12,278,366','14.4B+','Supported','Not Supported','1/23/2020','10/20/2026','6','Survival'][i]}</p></li>`).join('');
const socialTitles = {en:'Social Links','zh-CN':'社交链接','zh-TW':'社群連結',id:'Tautan Sosial',ja:'ソーシャルリンク',th:'ลิงก์โซเชียล',ko:'소셜 링크'};
const socialSprite = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="180"><path fill="#5865f2" d="M0 0h60v60H0z"/><path fill="#f34" d="M0 60h60v60H0z"/><path fill="#16191e" d="M0 120h60v60H0z"/><g fill="white" font-family="Arial" font-size="32" text-anchor="middle"><text x="30" y="42">D</text><text x="30" y="102">▶</text><text x="30" y="162">X</text></g></svg>');
function fixture() {
  return `<!doctype html><html lang="en" data-rc-ui-active><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*{box-sizing:border-box}body{margin:0;font:15px/1.5 Arial;color:white;background:linear-gradient(120deg,#8a626e,#294760)}#content{width:min(1000px,calc(100% - 24px));margin:20px auto}h2,h3{font-size:20px;margin:0 0 12px}.game-stat-container{display:flex;padding:12px 0}.game-stat{display:flex;flex-direction:column;align-items:center;gap:12px;flex:1 0}.text-overflow{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.game-stat p{margin:0}.game-description{white-space:pre-wrap;overflow:hidden}.game-details-page-events-grid{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:265px;gap:16px}.experience-events-tile,.featured-game-container,.experience-events-tile .info-container{background:#272930}.experience-events-tile{list-style:none;border-radius:8px;max-height:265px}#legacy-stats[hidden]{display:none!important}.featured-game-container{height:270px;margin-right:14px}.featured-game-icon-container{position:relative;height:150px}.brief-game-icon{display:block;height:100%}.brief-game-icon img{width:100%;height:100%;object-fit:cover}.game-card-link{text-decoration:none;color:white}.game-card-text-pill{position:absolute;top:10px;left:10px;background:#fff;color:#222;border-radius:20px;padding:5px 10px}.info-container{padding:12px}.game-card-name{font-weight:bold}.info-label{font-size:12px}.wide-event-play-button,.notify-button{width:100%;border:0;border-radius:8px;background:#f4f4f8;color:#222;padding:7px;font:inherit;cursor:pointer}.wide-event-play-button{background:#fc33df;color:white}.age-rating-details{background:#394b84;padding:12px}.game-description-footer{text-align:right}.game-description-footer a{color:#e04f59}
  .game-social-links{display:flex;flex-wrap:wrap;padding:0}.game-social-links>.btn-secondary-lg{display:flex;align-items:center;height:100px;width:calc(33% - 15px);padding:15px;margin:7.5px;background:#272930;color:white;border:1px solid #60646d;border-radius:6px;cursor:pointer}.game-social-links .social-icon,.social-links .type-img{background-image:url('${socialSprite}');background-size:100% auto;flex:0 0 auto;width:60px;height:60px}.icon-social-media-youtube{background-position:0 -60px}.icon-social-media-twitter{background-position:0 -120px}.padding-left-small{padding-left:8px}.social-links .medallion{height:100px;margin:.5em;padding:1em;border:1px solid #60646d;border-radius:6px;background:#272930}.social-links .contents{height:60px;margin:.2em 0 0}.social-links .type-img{position:absolute;float:left}.social-links .title-wrapper{padding-left:4.5em;position:relative;margin-left:.5em;top:50%;transform:translateY(-50%)}.social-links .title{display:block;width:100%;word-wrap:break-word}.col-xs-12{float:left;width:100%}.col-md-4{width:33.33%}.social-links .section-content:after{content:'';display:table;clear:both}.social-link{cursor:pointer}.native-social-dialog{border:1px solid #777;border-radius:12px;padding:24px}
  @media(max-width:991px){.game-social-links>.btn-secondary-lg{width:calc(50% - 15px)}}@media(max-width:767px){.game-social-links>.btn-secondary-lg{width:calc(100% - 15px)}}
  body[data-palette=custom]{--rc-glass-color:57 75 132;--rc-text:#fff;--rc-text-secondary:#e3e6f3;--rc-control-bg:#40578c;--rc-control-hover:#5068a1;--rc-control-border:#91a4d5;--rc-accent:#fc33ff;--rc-inset-bg:#ffffff10;--rc-focus:#fc83ff}
  </style>${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><main id="content"><div id="game-detail-page" data-place-id="4623386862"><div class="tab-content"><section id="about" class="tab-pane active"><div id="game-details-about-tab-container"><div class="game-about-tab-container">
  <div class="virtual-event-game-details-container"><div class="container-header"><h3>Events</h3></div><div class="stack"><div class="game-grid wide-game-tile-game-grid game-details-page-events-grid" style="--items-per-row:3">
  ${['Season celebration','Content update with a longer title','New location'].map((name,i)=>{
    const art='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="384" height="216"><rect width="384" height="216" fill="${['#39234c','#352e53','#183e50'][i]}"/><circle cx="260" cy="80" r="64" fill="${['#d789be','#dc9c67','#80bbcc'][i]}"/><text x="24" y="180" fill="white" font-family="Arial" font-size="28">EVENT ${i+1}</text></svg>`);
    return `<li class="list-item hover-game-tile experience-events-tile image-overlay contained-tile" data-testid="wide-game-tile"><div class="featured-game-container game-card-container"><a class="game-card-link" href="https://www.roblox.com/events/${100+i}"><div class="featured-game-icon-container"><span class="thumbnail-2d-container brief-game-icon"><img src="${art}" alt="${name}"></span><div class="game-card-text-pill"><div class="game-card-info">${i===2?'Sun, Oct 25, 1:00 AM':'New content'}</div></div></div><div class="info-container"><div class="info-metadata-container"><div class="game-card-name game-name-title" title="${name}">${name}</div><div class="wide-game-tile-metadata"><div class="base-metadata"><div class="game-card-info"><span class="info-label">A new adventure for everyone.</span></div><button class="${i===2?'notify-button':'wide-event-play-button'}" onclick="event.preventDefault();nativeClicks[${i}]++">${i===2?'Notify Me':'Join Event'}</button></div></div></div></div></a></div></li>`;
  }).join('')}</div></div></div>
  <div class="game-description-container"><div class="container-header"><h2>Description</h2></div><pre class="text game-description"></pre><div class="game-age-recommendation-details-container"><div class="age-rating-details section-content col-xs-12"><a class="age-rating-age-bracket text-lead text-link" href="#maturity">Maturity: Mild</a><span class="age-rating-display-name">Fear (Repeated/Mild), Violence (Repeated/Mild)</span></div></div><ul class="border-top border-bottom game-stat-container">${stats}</ul><div class="game-description-footer"><a href="#report">Report Abuse</a></div></div>
  <div id="legacy-stats" class="game-stat-container" hidden><ul>${stats}</ul></div>
  <div class="section" id="current-social-section"><div class="container-header"><h3>Social Links</h3></div><ul class="game-social-links">${['Mega Mansion Community','Watch community videos','Community updates '+ '長い名前'.repeat(18)].map((title,i)=>`<a class="btn-secondary-lg border" role="link" tabindex="0" onclick="openNativeSocial(${i})" onkeydown="if(event.key==='Enter'){event.preventDefault();openNativeSocial(${i})}"><span class="social-icon icon-social-media-${['discord','youtube','twitter'][i]}"></span><span class="text-body-large text-wrap text-align-x-start padding-left-small">${title}</span></a>`).join('')}</ul></div>
  <div class="stack social-links" id="legacy-social-section"><div class="container-header"><h2>Social Links</h2></div><div class="section-content remove-panel"><social-link-card><div id="social-link-card"><div class="col-xs-12 col-md-4 col-sm-6"><a class="social-link" href="#native-social" onclick="event.preventDefault();openNativeSocial(3)"><div class="medallion border"><div class="contents"><span class="type-img Discord"></span><div class="title-wrapper"><span class="title">Legacy community link</span></div></div></div></a></div></div></social-link-card></div></div>
  </div></div></section></div></div><div id="outside" class="experience-events-tile">Unrelated card</div></main>
  <dialog id="native-social-confirm" class="native-social-dialog"><p>You are leaving Roblox.</p><button onclick="this.closest('dialog').close()">Cancel</button></dialog>
  <script>window.nativeClicks=[0,0,0];window.socialClicks=[0,0,0,0];window.openNativeSocial=index=>{socialClicks[index]++;document.getElementById('native-social-confirm').showModal()};document.querySelector('.game-description').textContent=${JSON.stringify(description)};window.chrome={runtime:{lastError:null,sendMessage(m,cb){cb?.({error:'Optional fixture data unavailable'})}}};</script>
  ${scripts.map(file=>`<script src="/${file}"></script>`).join('')}</body></html>`;
}
test('About themes native event bodies and fits descriptions and both native stat layouts without replacing actions',
  {skip:!process.env.CHROME_BIN,timeout:60000},async t=>{
    const files=new Set([...styles,...scripts]);
    const server=http.createServer((request,response)=>{
      const file=new URL(request.url,'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
      response.end(files.has(file)?fs.readFileSync(path.join(workspace,file)):fixture());
    });
    await new Promise(resolve=>server.listen(Number(process.env.GAME_ABOUT_TEST_PORT)||0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const b=await isolatedChrome(t,'game-about');
    await b.send('Emulation.setFocusEmulationEnabled',{enabled:true});
    await b.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/games/4623386862/Piggy`});
    await waitForDocument(b,'.game-description');
    await b.evaluate("window.originalNative=[...document.querySelectorAll('.experience-events-tile img,.experience-events-tile button,.game-description,.game-stat-container li,.game-social-links > a,.social-links a,.social-icon,.type-img')];window.nativeParents=originalNative.map(n=>n.parentElement)");
    for(const [locale,translated] of Object.entries(labels))for(const palette of ['dark','light','custom'])for(const width of [1280,967,700,390,320]){
      await b.send('Emulation.setDeviceMetricsOverride',{width,height:1400,deviceScaleFactor:1,mobile:false});
      await b.evaluate(`document.documentElement.lang=${JSON.stringify(locale)};document.documentElement.className='${palette==='light'?'light':'dark'}-theme';document.body.className=document.documentElement.className;document.body.dataset.palette=${JSON.stringify(palette)};document.querySelectorAll('.game-description-container .game-stat .text-label').forEach((n,i)=>n.textContent=${JSON.stringify(translated)}[i]);document.querySelector('.game-description-container').style.fontFamily='Arial'`);
      const state=await b.evaluate(`(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height}};const about=document.querySelector('#about'),grid=document.querySelector('ul.game-stat-container'),cards=[...document.querySelectorAll('.experience-events-tile')].filter(n=>n.id!=='outside');return{overflow:document.documentElement.scrollWidth>innerWidth+1||about.scrollWidth>about.clientWidth+1,display:getComputedStyle(grid).display,columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,cards:cards.map(n=>({box:rect(n),body:rect(n.querySelector('.info-container')),button:rect(n.querySelector('button')),image:rect(n.querySelector('img')),bg:getComputedStyle(n).backgroundColor,inner:getComputedStyle(n.querySelector('.info-container')).backgroundColor})),text:document.querySelector('.game-description').textContent,stats:[...grid.children].every(n=>n.scrollWidth<=n.clientWidth+1),preserved:originalNative.every((n,i)=>n.isConnected&&n.parentElement===nativeParents[i]),outside:getComputedStyle(document.querySelector('#outside')).backgroundColor}})()`);
      const name=`${locale}/${palette}/${width}`;
      assert.equal(state.overflow,false,name);assert.equal(state.display,'grid',name);assert.equal(state.stats,true,name);
      assert.equal(state.preserved,true,name);assert.equal(state.text,description,name);assert.equal(state.outside,'rgb(39, 41, 48)',name);
      if(width<=390)assert.equal(state.columns,2,name);
      for(const card of state.cards){
        assert.notEqual(card.bg,'rgb(39, 41, 48)',`${name}: native dark card is themed`);
        assert.equal(card.inner,'rgba(0, 0, 0, 0)',`${name}: inner dark plate is removed`);
        assert.ok(card.button.x>=card.box.x&&card.button.right<=card.box.right&&card.button.bottom<=card.box.bottom+1,name);
        assert.ok(Math.abs(card.image.width/card.image.height-16/9)<.02,`${name}: artwork keeps its aspect ratio`);
      }
      await b.evaluate(`document.querySelectorAll('#current-social-section h3,#legacy-social-section h2').forEach(n=>n.textContent=${JSON.stringify(socialTitles[locale])})`);
      const social=await b.evaluate(`(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{x:r.x,right:r.right,width:r.width,height:r.height}},nodes=[...document.querySelectorAll('.game-social-links > a,.social-links .medallion')];return{nativeLinks:nodes.slice(0,3).every(n=>!n.hasAttribute('href')),cards:nodes.map(n=>{const icon=n.querySelector('.social-icon,.type-img'),title=n.querySelector('.text-body-large,.title');return{box:rect(n),icon:rect(icon),sprite:getComputedStyle(icon).backgroundImage,offset:getComputedStyle(icon).backgroundPosition,textFits:title.scrollWidth<=title.clientWidth+1,bg:getComputedStyle(n).backgroundColor}}),grids:[...document.querySelectorAll('.game-social-links,.social-links > .section-content')].map(n=>getComputedStyle(n).display),headings:[...document.querySelectorAll('#current-social-section h3,#legacy-social-section h2')].map(n=>getComputedStyle(n).fontSize)}})()`);
      assert.equal(social.nativeLinks,true,`${name}: current links retain native confirmation handlers without href`);
      assert.deepEqual(social.grids,['grid','grid'],`${name}: both native social layouts are covered`);
      assert.deepEqual(social.headings,['18px','18px'],`${name}: section headings match About`);
      for(const [index,card] of social.cards.entries()){
        assert.notEqual(card.bg,'rgb(39, 41, 48)',`${name}: social card is themed`);
        assert.ok(card.icon.width===60&&card.icon.height===60&&card.sprite.startsWith('url("data:image/svg+xml,'),`${name}: native platform sprite is preserved`);
        assert.ok(card.icon.x>=card.box.x&&card.icon.right<=card.box.right&&card.textFits,`${name}: icon and long title fit`);
        if(index===1)assert.equal(card.offset,'0px -60px',`${name}: sprite offsets remain intact`);
      }
      if(process.env.GAME_ABOUT_SCREENSHOT_DIR&&locale==='en'&&[967,390].includes(width)){
        const shot=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
        fs.writeFileSync(path.join(process.env.GAME_ABOUT_SCREENSHOT_DIR,`game-about-${palette}-${width}.png`),Buffer.from(shot.data,'base64'));
      }
    }
    await b.evaluate("document.querySelector('#legacy-stats').hidden=false");
    assert.equal(await b.evaluate("getComputedStyle(document.querySelector('#legacy-stats > ul')).display"),'grid');
    for(let i=0;i<3;i++)await b.click(`.game-details-page-events-grid > li:nth-child(${i+1}) button`);
    assert.deepEqual(await b.evaluate('nativeClicks'),[1,1,1]);
    for(const selector of ['.game-social-links > a','.social-links .social-link']){
      await b.click(selector);assert.equal(await b.evaluate("document.querySelector('#native-social-confirm').open"),true);
      await b.click('#native-social-confirm button');
    }
    await b.evaluate("document.querySelector('.game-social-links > a:nth-child(2)').focus()");
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    assert.equal(await b.evaluate("document.querySelector('#native-social-confirm').open"),true);
    await b.click('#native-social-confirm button');
    assert.deepEqual(await b.evaluate('socialClicks'),[1,1,0,1]);
    await b.evaluate("document.querySelector('.game-social-links > a').focus()");
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    assert.equal(await b.evaluate("getComputedStyle(document.activeElement).outlineWidth"),'2px','Keyboard focus remains visible');
    await b.evaluate("[...document.querySelector('.game-social-links').children].slice(1).forEach(n=>n.hidden=true)");
    assert.equal(await b.evaluate("[...document.querySelector('.game-social-links').children].filter(n=>n.checkVisibility()).length"),1,'Native hidden links stay hidden');
    if(process.env.GAME_ABOUT_SCREENSHOT_DIR){
      await b.send('Emulation.setDeviceMetricsOverride',{width:967,height:1400,deviceScaleFactor:1,mobile:false});
      await b.evaluate("document.querySelector('#current-social-section h3').textContent='Social Links';document.body.dataset.palette='custom';document.querySelector('#current-social-section').scrollIntoView()");
      const clip=await b.evaluate("(()=>{const r=document.querySelector('#current-social-section').getBoundingClientRect();return{x:r.x,y:r.y+scrollY,width:r.width,height:r.height,scale:1}})()");
      const shot=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip});
      fs.writeFileSync(path.join(process.env.GAME_ABOUT_SCREENSHOT_DIR,'social-single-custom-967.png'),Buffer.from(shot.data,'base64'));
    }
    await b.evaluate("document.documentElement.setAttribute('data-rc-disable-transparency','')");
    assert.equal(await b.evaluate("getComputedStyle(document.querySelector('.experience-events-tile')).backgroundColor.startsWith('rgb(')"),true);
    await b.evaluate("document.querySelector('#current-social-section').setAttribute('data-rc-features-disabled','')");
    assert.equal(await b.evaluate("getComputedStyle(document.querySelector('.game-social-links > a')).backgroundColor"),'rgb(39, 41, 48)','Unsupported-language fallback keeps the native social style');
    assert.deepEqual(b.errors,[]);
  });
