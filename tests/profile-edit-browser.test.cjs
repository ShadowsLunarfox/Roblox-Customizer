const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(workspace, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/routes.js', 'src/shared/runtime.js', 'src/shared/startup.js'];

test('Profile editing has an exact localized route in startup and the settings fallback', () => {
  const settings = read('src/settings/settings.js');
  const fallback = settings.slice(settings.indexOf('  function syncFrostPage()'), settings.indexOf('  function openDatabase()'));
  for (const source of [read('src/shared/startup.js'), fallback]) {
    const attributes = new Map(), events = new Map();
    const root = {dataset:{},style:{setProperty(){}},setAttribute:(k,v)=>attributes.set(k,v),getAttribute:k=>attributes.get(k)??null,
      removeAttribute:k=>{attributes.delete(k);if(k==='data-rc-frost-page')delete root.dataset.rcFrostPage},
      hasAttribute:k=>k==='data-rc-frost-page'?root.dataset.rcFrostPage!==undefined:attributes.has(k),toggleAttribute:(k,on)=>on?attributes.set(k,''):attributes.delete(k)};
    const context = {location:new URL('https://www.roblox.com/users/profile/edit'),document:{documentElement:root,readyState:'loading',addEventListener(){},querySelector(){return null}},localStorage:{getItem(){return null},setItem(){}},addEventListener:(k,v)=>events.set(k,v),MutationObserver:class{observe(){}},setTimeout(){return 1},clearTimeout(){},enhancementsEnabled:()=>true};
    vm.runInNewContext(read('src/shared/routes.js'),context);
    context.routePath=()=>context.RobloxCustomizerRoutes.pathname(context.location.pathname);
    vm.runInNewContext(source,context);
    assert.equal(root.dataset.rcFrostPage,'profile-edit');
    for(const locale of ['','en/','zh-CN/','zh-TW/','ja/','ko/','th/','id/'])for(const suffix of ['','/','?from=profile','#!/about']){
      context.location.href=`https://www.roblox.com/${locale}users/profile/edit${suffix}`;events.get('popstate')();assert.equal(root.dataset.rcFrostPage,'profile-edit');
    }
    for(const [route,expected] of [['/users/123/profile','profile'],['/users/profile/edit-extra',undefined],['/users/profile/edit/extra',undefined],['/users/profile',undefined],['/my/account','account-settings'],['/NewLogin',undefined],['/home',undefined]]){
      context.location.href='https://www.roblox.com'+route;events.get('popstate')();assert.equal(root.dataset.rcFrostPage,expected,route);
    }
  }
});

// Screenshot-based local fixture: #content and shared Roblox utility classes,
// with native-style buttons, links, a role=button row and both dialog variants.
// The authenticated production editor is not accessible in the test profile.
const labels = {
  en:['Back to Profile','Display Name','Username','About','Edit avatar','Profile frame','No bio yet'],
  'zh-CN':['返回个人资料','显示名称','用户名','简介','编辑虚拟形象','个人资料头像框','暂无简介'],
  'zh-TW':['返回個人資料','顯示名稱','使用者名稱','簡介','編輯虛擬人偶','個人資料頭像框','暫無簡介'],
  ja:['プロフィールに戻る','表示名','ユーザーネーム','自己紹介','アバターを編集','プロフィールフレーム','自己紹介はまだありません'],
  ko:['프로필로 돌아가기','표시 이름','사용자 이름','소개','아바타 편집','프로필 프레임','아직 소개가 없습니다'],
  th:['กลับไปที่โปรไฟล์','ชื่อที่แสดง','ชื่อผู้ใช้','เกี่ยวกับ','แก้ไขอวาตาร์','กรอบโปรไฟล์','ยังไม่มีประวัติ'],
  id:['Kembali ke Profil','Nama Tampilan','Nama Pengguna','Tentang','Edit avatar','Bingkai profil','Belum ada bio']
};
function fixture(bootstrap) {
  const arrow='<svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20"><path d="m7 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  const row=(key,label,value,tag='button')=>`<${tag} ${tag==='a'?'href="/my/avatar"':tag==='div'?'role="button" tabindex="0"':'type="button"'} data-edit="${key}" class="native-row width-full flex items-center justify-between"><span data-label="${label}" class="content-emphasis">${labels.en[label]}</span><span class="row-value flex items-center min-width-0"><span class="content-default text-truncate-end" ${key==='about'?'data-label="6"':''}>${value}</span>${arrow}</span></${tag}>`;
  const form='<form id="edit-form"><h2 class="content-emphasis" id="dialog-title">Display Name</h2><label class="content-default" for="native-input">Name</label><input id="native-input" value="Sample Display Name"><textarea id="native-bio" hidden></textarea><div class="dialog-actions"><button type="button" id="cancel">Cancel</button><button type="submit" id="save" class="foundation-web-button width-full bg-action-emphasis" disabled>Save</button></div></form>';
  const modal=bootstrap?`<div class="modal" role="dialog" aria-modal="true" hidden><div class="modal-dialog"><div class="modal-content">${form}</div></div></div>`:`<div class="native-dialog" role="dialog" aria-modal="true" hidden>${form}</div>`;
  return `<!doctype html><html class="dark-theme" lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(135deg,#984b58,#327e88);font:16px/1.45 Arial;color:white}#container-main{width:100%;max-width:1200px;margin:auto}#content{width:970px;margin:auto;padding:16px;background:transparent}.flex{display:flex}.items-center{align-items:center}.justify-between{justify-content:space-between}.min-width-0{min-width:0}.width-full{width:100%}.content-emphasis{color:#fff}.content-default{color:#bbb}.light-theme .content-emphasis{color:#191a1f}.light-theme .content-default{color:#555}.text-truncate-end{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}a{color:inherit;text-decoration:none}.content::before,.content::after{content:" ";display:table}.content::after{clear:both}button,input,textarea{font:inherit}.native-row{border:0;border-bottom:1px solid #9996;padding:16px 12px;background:transparent;color:inherit;cursor:pointer;text-align:left;gap:12px}.row-value{gap:6px;max-width:62%;text-align:right}.row-value svg{flex:none}.portrait{width:96px;height:96px;margin:18px auto 24px;border-radius:50%;overflow:hidden;background:#599ac5}.portrait img{width:100%;height:100%}.native-dialog{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 32px));padding:24px;z-index:100;background:#333}.modal{position:fixed;inset:0;z-index:100;overflow:auto;background:transparent}.modal-dialog{width:min(440px,calc(100% - 32px));margin:15vh auto}.modal-content{padding:24px;background:#333}.dialog-actions{display:flex;gap:12px}.dialog-actions button{padding:10px 16px;border-radius:8px;border:1px solid #888;cursor:pointer}.bg-action-emphasis{background:#335fff;color:white}.bg-action-emphasis:disabled{opacity:.5;cursor:default}#edit-form{display:grid;gap:12px}#native-input,#native-bio{width:100%}h2{margin:0}textarea{height:120px;resize:vertical}[hidden]{display:none!important}
  </style>${styles.map(file=>`<link rel="stylesheet" href="/${file}">`).join('')}</head><body class="dark-theme"><main id="container-main"><div id="content" class="content"><div id="native-editor"><a id="back" data-label="0" href="/users/123/profile">Back to Profile</a><div class="portrait"><img id="native-headshot" alt="" src="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="42" fill="#8ed1d7"/><rect x="30" y="26" width="36" height="48" rx="12" fill="#fff"/></svg>')}"></div><div id="native-rows">${row('display',1,'Sample Display Name')}${row('username',2,'@averylongsampleusernameforlayoutverification')}${row('about',3,labels.en[6],'div')}${row('avatar',4,'','a')}${row('frame',5,'◯')}<button class="native-row width-full" id="hidden-row" hidden>Hidden entry</button></div></div></div></main>${modal}${scripts.map(file=>`<script src="/${file}"></script>`).join('')}<script>
    RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture',glassBlur:24,glassOpacity:62});window.actions={open:0,cancel:0,avatar:0,back:0,save:0};
    document.addEventListener('click',event=>{const n=event.target.closest('[data-edit],#back,#cancel');if(!n)return;if(n.id==='back'){event.preventDefault();actions.back++;return}if(n.id==='cancel'){document.querySelector('[role=dialog]').hidden=true;actions.cancel++;return}if(n.dataset.edit==='avatar'){event.preventDefault();actions.avatar++;return}actions.open++;document.querySelector('#dialog-title').textContent=n.querySelector('[data-label]').textContent;document.querySelector('#native-bio').hidden=n.dataset.edit!=='about';document.querySelector('[role=dialog]').hidden=false});
    document.querySelector('#edit-form').addEventListener('submit',event=>{event.preventDefault();actions.save++});document.querySelector('[role=button]').addEventListener('keydown',event=>{if(event.key==='Enter')event.currentTarget.click()});
  </script></body></html>`;
}

test('Profile edit shell and rows fit long values, preserve original controls and theme native dialogs',
  {skip:!process.env.CHROME_BIN,timeout:45000},async t=>{
    const assets=new Set([...styles,...scripts]);const server=http.createServer((request,response)=>{const u=new URL(request.url,'http://localhost'),file=u.pathname.slice(1);response.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');response.end(assets.has(file)?fs.readFileSync(path.join(workspace,file)):fixture(u.searchParams.has('bootstrap')))});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const b=await isolatedChrome(t,'profile-edit'),origin=`http://127.0.0.1:${server.address().port}`;
    for(const suffix of ['', '?bootstrap']){
      await b.send('Page.navigate',{url:origin+'/users/profile/edit'+suffix});await waitForDocument(b,'#native-rows');assert.equal(await b.evaluate('document.documentElement.dataset.rcFrostPage'),'profile-edit');
      const original=await b.evaluate(`JSON.stringify({links:[...document.querySelectorAll('#content a')].map(n=>n.getAttribute('href')),image:document.querySelector('#native-headshot').getAttribute('src'),value:document.querySelector('#native-input').value,disabled:document.querySelector('#save').disabled})`);
      for(const theme of ['dark','light','custom'])for(const width of [1360,1024,768,390,320])for(const [locale,text] of Object.entries(labels)){
        await b.send('Emulation.setDeviceMetricsOverride',{width,height:1050,deviceScaleFactor:1,mobile:false});await b.evaluate(`document.documentElement.className='${theme==='light'?'light':'dark'}-theme';document.body.className=document.documentElement.className;document.documentElement.lang='${locale}';document.querySelectorAll('[data-label]').forEach(n=>n.textContent=${JSON.stringify(text)}[n.dataset.label]);RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture',glassBlur:24,glassOpacity:62,experimentalCustomColors:${theme==='custom'},customTextColor:'#ffeecc',customBackgroundColor:'#153040',customAccentColor:'#aadd99'})`);
        const s=await b.evaluate(`(()=>{const shell=document.querySelector('#content'),r=shell.getBoundingClientRect(),p=getComputedStyle(shell,'::before'),rows=[...document.querySelectorAll('[data-edit]')];return{overflow:document.documentElement.scrollWidth>innerWidth,panel:{bg:p.backgroundColor,blur:p.backdropFilter,width:parseFloat(p.width),height:parseFloat(p.height)},shell:{width:r.width,height:r.height},rows:rows.map(n=>{const s=getComputedStyle(n),a=n.getBoundingClientRect();return{radius:s.borderRadius,bg:s.backgroundColor,blur:s.backdropFilter,inside:a.left>=r.left&&a.right<=r.right&&a.bottom<=r.bottom,childrenFit:[...n.children,...n.querySelectorAll('.row-value>*')].every(x=>{const c=x.getBoundingClientRect();return c.left>=a.left&&c.right<=a.right+1})}}),text:getComputedStyle(document.querySelector('[data-label="1"]')).color,hidden:getComputedStyle(document.querySelector('#hidden-row')).display}})()`);
        assert.equal(s.overflow,false,`${suffix}/${theme}/${width}/${locale}`);assert.match(s.panel.blur,/blur\(24px\)/);assert.notEqual(s.panel.bg,'rgba(0, 0, 0, 0)');assert.ok(s.panel.width>=s.shell.width-3&&s.panel.height>=s.shell.height-3);assert.equal(s.rows.length,5);
        for(const row of s.rows){assert.equal(row.radius,'12px');assert.notEqual(row.bg,'rgba(0, 0, 0, 0)');assert.equal(row.blur,'none');assert.equal(row.inside,true);assert.equal(row.childrenFit,true)}
        assert.equal(s.text,theme==='custom'?'rgb(255, 238, 204)':theme==='light'?'rgb(27, 35, 48)':'rgb(244, 246, 251)');assert.equal(s.hidden,'none');
      }
      assert.equal(await b.evaluate(`JSON.stringify({links:[...document.querySelectorAll('#content a')].map(n=>n.getAttribute('href')),image:document.querySelector('#native-headshot').getAttribute('src'),value:document.querySelector('#native-input').value,disabled:document.querySelector('#save').disabled})`),original,'Appearance preserves native links, portrait and editor state');
      if(process.env.PROFILE_EDIT_SCREENSHOT){for(const width of [1024,390]){await b.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});const shot=await b.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(workspace,`.tmp-profile-edit-${width}.png`),Buffer.from(shot.data,'base64'))}}
      for(const key of ['display','username','about','frame']){
        await b.click(`[data-edit="${key}"]`);assert.equal(await b.evaluate('document.querySelector("[role=dialog]").hidden'),false);
        const dialog=await b.evaluate(`(()=>{const d=document.querySelector('.modal-content')||document.querySelector('[role=dialog]'),s=getComputedStyle(d);return{bg:s.backgroundColor,blur:s.backdropFilter,width:d.getBoundingClientRect().width,outer:document.querySelector('.modal')?getComputedStyle(document.querySelector('.modal')).backgroundColor:null,disabled:document.querySelector('#save').disabled}})()`);
        assert.notEqual(dialog.bg,'rgba(0, 0, 0, 0)');assert.match(dialog.blur,/blur\(24px\)/);assert.ok(dialog.width<=1024);assert.equal(dialog.disabled,true);if(dialog.outer!==null)assert.equal(dialog.outer,'rgba(0, 0, 0, 0)','Bootstrap overlay does not become a full-screen glass card');
        await b.click('#cancel');assert.equal(await b.evaluate('document.querySelector("[role=dialog]").hidden'),true);
      }
      await b.click('[data-edit="avatar"]');await b.click('#back');assert.deepEqual(await b.evaluate('actions'),{open:4,cancel:4,avatar:1,back:1,save:0});
      await b.evaluate("RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture',glassBlur:24,glassOpacity:62,disableBlur:true,disableTransparency:true})");
      const opaque=await b.evaluate(`(()=>{const s=getComputedStyle(document.querySelector('#content'),'::before');return{bg:s.backgroundColor,blur:s.backdropFilter}})()`);assert.match(opaque.bg,/^rgb\(/);assert.equal(opaque.blur,'none');
      await b.evaluate("document.querySelector('#content').setAttribute('data-rc-features-disabled','')");assert.equal(await b.evaluate('getComputedStyle(document.querySelector("#content"),"::before").backgroundColor'),'rgba(0, 0, 0, 0)');
      await b.evaluate("document.querySelector('#content').removeAttribute('data-rc-features-disabled');history.pushState({},'', '/users/123/profile');dispatchEvent(new PopStateEvent('popstate'))");assert.equal(await b.evaluate('getComputedStyle(document.querySelector("#content"),"::before").position'),'static','Edit panel clears and native clearfix returns when leaving the route');
    }
    assert.deepEqual(b.errors,[]);
  });
