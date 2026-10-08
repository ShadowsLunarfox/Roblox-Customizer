// Local account fixtures use sample values and never send account changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');

function fixture(layout) {
  const tabs = ['Account Info', 'Security', 'Privacy & content restrictions', 'Parental Controls', 'Payment methods', 'Notifications', 'Robux', 'Subscriptions', 'App permissions', 'Browser preferences'];
  const names = ['info','security','privacy','parental-controls','billing','notifications','robux','subscriptions','app-permissions','browser-preferences'];
  const navigation = `<nav class="settings-left-navigation" aria-label="Settings"><ul class="menu-vertical">${tabs.map((label,i)=>`<li class="menu-option ${i===0?'active':''}"><a id="tab-${i}" class="menu-option-content" href="#!/${names[i]}">${label}</a></li>`).join('')}</ul></nav>`;
  const row = (label,value,id) => `<div class="form-group account-row"><div><label>${label}</label><div class="text-lead text-overflow">${value}</div></div><button id="${id}" type="button" class="btn-control-sm" aria-label="Edit ${label}">Edit</button></div>`;
  const content = `<div class="rbx-tab-content"><div id="info" class="tab-pane active">
    <section id="rbx-account-info-header" class="setting-section"><div class="container-header"><h2>Account Info</h2></div><div class="section-content">
      ${row('Display Name','Sample Player','edit-display')}${row('Username','SamplePlayer123','edit-username')}${row('Password','••••••••','edit-password')}${row('Email Address','s••••@example.invalid','edit-email')}
      <p class="text-description text-success">Email verified</p>
    </div></section>
    <section class="setting-section"><div class="section-header"><h2>Personal</h2></div><div class="section-content"><form id="native-account-form">
      <div class="form-group"><label for="display-name">Display Name</label><input class="input-field" id="display-name" name="displayName" value="Sample Player" required maxlength="20"><p id="validation" class="text-error" hidden role="alert">Please enter a display name.</p></div>
      <div class="form-group birthday-container"><label>Birthday</label><div class="birthday-fields"><div class="rbx-select-group month"><select aria-label="Month" class="input-field" disabled><option>January</option></select></div><div class="rbx-select-group day"><select aria-label="Day" class="input-field" disabled><option>1</option></select></div><div class="rbx-select-group year"><select aria-label="Year" class="input-field" disabled><option>2000</option></select></div></div></div>
      <div id="account-country-id" class="form-group account-country-container"><label for="country">Account Location</label><div class="rbx-select-group"><select id="country" name="country" class="input-field"><option value="my">Malaysia</option><option value="sg">Singapore</option></select></div></div>
      <div class="form-group"><label for="language">Language</label><div class="input-dropdown"><button type="button" id="language" class="input-dropdown-btn" aria-expanded="false">English <span aria-hidden="true">⌄</span></button><ul class="dropdown-menu"><li><button id="language-choice" type="button">Bahasa Melayu</button></li></ul></div></div>
      <div class="form-group choices"><label><input name="updates" id="updates" type="checkbox" checked> Receive updates</label><label><input name="theme" type="radio" value="system" checked> System theme</label></div>
      <input type="hidden" name="token" value="fixture-token"><div class="form-group save-settings-container"><button id="save" type="submit" class="btn-primary-md" disabled>Save</button><span class="text-description">Your settings apply to this account.</span></div>
    </form></div></section>
    <section id="inactive" class="setting-section ng-hide" hidden><p>Hidden native content</p></section>
  </div><div id="security" class="tab-pane" hidden><section class="setting-section"><h2>Security</h2><p class="text-description">Example security controls</p><button id="danger" type="button" class="btn-alert-md">Log out of other sessions</button><button id="disabled-link" type="button" class="btn-primary-md" aria-disabled="true" disabled>Unavailable</button></section></div></div>`;
  const selfMenu=navigation.replace('<nav class="settings-left-navigation" aria-label="Settings"><ul class="menu-vertical">','<ul class="menu-vertical settings-left-navigation" aria-label="Settings" style="width:1040px;min-height:720px">').replace('</ul></nav>','</ul>');
  const nestedContent=`<div class="account-content-shell"><div class="native-view-wrapper" style="width:80%;margin-left:20%">${content}</div></div>`;
  const structure=layout==='wrapped'?`<div class="settings-content-container">${navigation}${content}</div>`
    :layout==='self-menu'?selfMenu+nestedContent
    :layout==='nested'?`<div class="native-settings-layout"><div class="navigation-shell"><div style="width:1040px;min-height:720px">${selfMenu}</div></div>${nestedContent}</div>`
    :navigation+content;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  ${process.env.ACCOUNT_NATIVE_CSS?'<link rel="stylesheet" href="/native.css">':''}
  <style>
    *{box-sizing:border-box}body{margin:0;font:16px/1.5 Arial;background:#24262b;color:#f7f7f8}body.light-theme{background:#f4f4f4;color:#202227}main{padding-top:30px}#content{width:970px;margin:auto;padding:12px}.preview-label{max-width:1040px;margin:0 auto 10px;padding:0 16px;color:#fff;font-size:13px}.settings-left-navigation{float:left;width:200px}.rbx-tab-content{margin-left:220px}.container-header h1{margin:0 0 20px;font-size:32px}.menu-vertical{list-style:none;margin:0;padding:0;background:#303238}.menu-option-content{display:block;padding:12px;color:inherit;text-decoration:none}.menu-option.active{box-shadow:4px 0 0 #fff inset}.setting-section{margin-bottom:20px}.section-content{padding:18px;background:#303238}.light-theme .section-content,.light-theme .menu-vertical{background:#fff}h2{font-size:22px;margin:0 0 12px}.text-description{font-size:14px}.text-success{color:#58c995}.text-error{color:#ef7676}label{display:block;color:#c4c8d0;font-size:14px;margin-bottom:6px}.light-theme label{color:#555b65}.text-lead{font-size:16px;font-weight:600}.account-row{display:flex;gap:16px;align-items:center;justify-content:space-between;border-bottom:1px solid #7775}.account-row>div{min-width:0}.form-group{margin-bottom:12px}input,select,button{font:inherit;color:inherit}.input-field{width:100%;border:1px solid #777;border-radius:4px;padding:8px;background:#383b43}.light-theme .input-field{background:#fff}button{cursor:pointer;padding:8px 14px;border:1px solid #777;background:#383b43;border-radius:4px}.light-theme button{background:#eee}.btn-primary-md{background:#335fff;color:#fff}.btn-primary-md:disabled{background:#555;opacity:.4;cursor:not-allowed}.btn-alert-md{background:#b52332;color:#fff}.birthday-fields{display:flex;gap:8px}.birthday-fields .rbx-select-group{flex:1;min-width:0}.choices label{display:flex;gap:8px;align-items:center}.choices input{width:auto}.input-dropdown{position:relative}.input-dropdown-btn{width:100%;text-align:left}.input-dropdown-btn span{float:right}.dropdown-menu{display:none;list-style:none;position:absolute;top:100%;left:0;width:100%;margin:4px 0;z-index:1000;background:#383b43}.open .dropdown-menu{display:block}.dropdown-menu button{width:100%;border:0;text-align:left;background:transparent}.ng-hide,[hidden]{display:none!important}#rc-background-layer{background:radial-gradient(ellipse at 12% 10%,#326a69,transparent 55%),radial-gradient(ellipse at 85% 10%,#463d7d,transparent 55%),linear-gradient(145deg,#151b2b,#312e49 65%,#163c42)}
  </style>
  <link rel="stylesheet" href="/src/shared/theme.css"><link rel="stylesheet" href="/src/settings/settings.css"><link rel="stylesheet" href="/src/shared/site-pages.css"><link rel="stylesheet" href="/src/pages/account/account-settings-page.css">
  <script>localStorage.setItem('roblox-customizer-visuals-v1',JSON.stringify({version:1,backgroundActive:false,glassBlur:24,glassOpacity:75}));</script><script src="/src/shared/startup.js"></script><script src="/src/pages/account/account-settings-page.js"></script></head>
  <body class="dark-theme"><div id="rc-background-layer" style="background:radial-gradient(ellipse at 12% 10%,#326a69,transparent 55%),radial-gradient(ellipse at 85% 10%,#463d7d,transparent 55%),linear-gradient(145deg,#151b2b,#312e49 65%,#163c42)"></div><main id="container-main"><div class="preview-label">Local layout preview · sample account</div><div id="content"><div id="settings-container" class="page-content settings-container"><div class="container-header"><h1>My Settings</h1></div>${structure}</div></div></main><script>
    window.edits=[];window.saves=0;document.querySelectorAll('.account-row button').forEach(button=>button.onclick=()=>window.edits.push(button.id));
    document.querySelectorAll('.menu-option-content').forEach(link=>link.onclick=()=>{document.querySelectorAll('.menu-option').forEach(n=>n.classList.remove('active'));link.parentElement.classList.add('active');document.querySelector('#info').hidden=link.id!=='tab-0';document.querySelector('#security').hidden=link.id!=='tab-1'});
    const form=document.querySelector('#native-account-form'),input=document.querySelector('#display-name');form.oninput=()=>{document.querySelector('#save').disabled=!form.checkValidity();input.setAttribute('aria-invalid',!input.validity.valid);document.querySelector('#validation').hidden=input.validity.valid};form.onchange=form.oninput;
    form.onsubmit=e=>{e.preventDefault();window.saves++;window.saved=Object.fromEntries(new FormData(form))};
    document.querySelector('#language').onclick=()=>{const button=document.querySelector('#language'),open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',open);button.parentElement.classList.toggle('open',open)};
    document.querySelector('#language-choice').onclick=()=>{document.querySelector('#language').textContent='Bahasa Melayu';document.querySelector('#language').setAttribute('aria-expanded','false');document.querySelector('.input-dropdown').classList.remove('open')};
  </script></body></html>`;
}

test('Account settings keep native tabs, edit/save behavior, field validation, and hidden controls across layouts and themes', {skip:!process.env.CHROME_BIN,timeout:30000}, async t => {
  const files=['src/shared/theme.css','src/settings/settings.css','src/shared/site-pages.css','src/pages/account/account-settings-page.css','src/pages/account/account-settings-page.js','src/shared/startup.js'];
  const server=http.createServer((request,response)=>{
    response.setHeader('Cache-Control','no-store');
    const url=new URL(request.url,'http://localhost'),file=url.pathname.slice(1);
    if(files.includes(file)){response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)))}
    else if(file==='native.css'&&process.env.ACCOUNT_NATIVE_CSS){response.setHeader('Content-Type','text/css');response.end(fs.readFileSync(process.env.ACCOUNT_NATIVE_CSS))}
    else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(fixture(url.searchParams.get('layout')))}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await isolatedChrome(t,'account-settings');
  for(const layout of ['direct','wrapped','self-menu','nested']){
    const fixtureUrl=`http://127.0.0.1:${server.address().port}/my/account?layout=${layout}#!/info`;
    await browser.send('Page.navigate',{url:fixtureUrl});
    await waitForDocument(browser, '#save', fixtureUrl);
    await browser.waitFor("!!document.querySelector('#save') && !!document.querySelector('[data-rc-settings-layout]') && document.documentElement.dataset.rcFrostPage==='account-settings'");
    const snapshot="JSON.stringify([...document.querySelectorAll('input,select')].map(n=>({name:n.name,value:n.value,disabled:n.disabled,checked:n.checked})))";
    const values=await browser.evaluate(snapshot);
    for(const theme of ['dark','light']){
      await browser.evaluate(`document.body.className='${theme}-theme'`);
      for(const width of [1360,768,390,320]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<600});await pause(30);
        const result=await browser.evaluate("(()=>{const section=document.querySelector('#rbx-account-info-header'),rect=section.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,left:rect.left,right:rect.right,blur:getComputedStyle(section,'::before').backdropFilter,fields:[...document.querySelectorAll('#info input:not([type=hidden]),#info select,#info button')].map(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}),hidden:getComputedStyle(document.querySelector('#inactive')).display,saveDisabled:document.querySelector('#save').disabled}})()");
        assert.equal(result.overflow,false,`${layout} ${theme} ${width}: fits viewport`);assert.ok(result.left>=0&&result.right<=width);assert.ok(result.fields.every(Boolean));assert.match(result.blur,/blur\(24px\)/);assert.equal(result.hidden,'none');assert.equal(result.saveDisabled,true);
        const navigation=await browser.evaluate("(()=>{const menu=document.querySelector('.menu-vertical'),items=[...menu.querySelectorAll('.menu-option')];return {width:menu.clientWidth,scrollWidth:menu.scrollWidth,items:items.map(n=>({display:getComputedStyle(n).display,width:n.getBoundingClientRect().width}))}})()");
        assert.ok(navigation.items.every(n=>n.display!=='none'&&n.width>0),'Every native settings tab remains reachable');
        if(width>=768){
          const positions=await browser.evaluate("(()=>{const nav=document.querySelector('[data-rc-settings-nav]').getBoundingClientRect(),body=document.querySelector('[data-rc-settings-body]').getBoundingClientRect();return {navRight:nav.right,bodyLeft:body.left,navTop:nav.top,bodyTop:body.top,bodyWidth:body.width,sectionWidth:document.querySelector('#rbx-account-info-header').getBoundingClientRect().width,menuWidth:document.querySelector('[data-rc-settings-menu]').getBoundingClientRect().width,minHeight:getComputedStyle(document.querySelector('[data-rc-settings-menu]')).minHeight}})()");
          assert.ok(positions.navRight+12<=positions.bodyLeft,`${layout}: navigation sits beside account sections`);assert.ok(Math.abs(positions.navTop-positions.bodyTop)<=1,`${layout}: columns start together`);assert.ok(positions.menuWidth<=232);assert.equal(positions.minHeight,'0px');
          assert.ok(Math.abs(positions.bodyWidth-positions.sectionWidth)<=1,`${layout}: account panels fill their column`);
        }
        if(width<768){assert.ok(navigation.scrollWidth>navigation.width);assert.ok(navigation.items.every(n=>n.width<navigation.width),'Mobile tabs use compact widths');}
        if(process.env.ACCOUNT_NATIVE_CSS){assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.container-header h1')).color"),theme==='dark'?'rgb(247, 247, 248)':'rgb(32, 34, 39)','Native theme tokens keep headings readable');}
        assert.equal(await browser.evaluate(snapshot),values,'Appearance never changes native values or disabled fields');
        if(process.env.ACCOUNT_PREVIEWS&&layout==='nested'&&theme==='dark'&&[1360,390].includes(width)){
          fs.mkdirSync(path.join(workspace,'previews'),{recursive:true});await browser.evaluate('scrollTo(0,0)');
          const metrics=await browser.send('Page.getLayoutMetrics');await browser.evaluate(`document.querySelector('#rc-background-layer').style.position='absolute';document.querySelector('#rc-background-layer').style.height='${metrics.cssContentSize.height}px'`);
          const height=width<600?metrics.cssContentSize.height:Math.min(1000,metrics.cssContentSize.height);
          const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}});fs.writeFileSync(path.join(workspace,`previews/account-settings-demo-${width}.png`),Buffer.from(shot.data,'base64'));
          await browser.evaluate("document.querySelector('#rc-background-layer').style.position='fixed';document.querySelector('#rc-background-layer').style.height='auto'");
        }
      }
    }
    await browser.click('#edit-display');assert.deepEqual(await browser.evaluate('window.edits'),['edit-display']);
    await browser.click('#language');const menu=await browser.evaluate("(()=>{const n=document.querySelector('.dropdown-menu'),r=n.getBoundingClientRect();return {left:r.left,right:r.right,blur:getComputedStyle(n).backdropFilter}})()");assert.ok(menu.left>=0&&menu.right<=320);assert.match(menu.blur,/blur\(24px\)/);
    await browser.click('#language-choice');assert.equal(await browser.evaluate("document.querySelector('#language').textContent"),'Bahasa Melayu');
    await browser.evaluate("(()=>{const field=document.querySelector('#display-name');field.value='';field.dispatchEvent(new Event('input',{bubbles:true}))})()");assert.equal(await browser.evaluate("document.querySelector('#save').disabled"),true);assert.equal(await browser.evaluate("document.querySelector('#validation').hidden"),false);
    assert.notEqual(await browser.evaluate("getComputedStyle(document.querySelector('#display-name')).borderColor"),await browser.evaluate("getComputedStyle(document.querySelector('#country')).borderColor"),'Validation keeps its error border');
    await browser.evaluate("document.querySelector('#display-name').value='Updated Sample';document.querySelector('#country').value='sg';document.querySelector('#country').dispatchEvent(new Event('change',{bubbles:true}))");
    await browser.click('#save');assert.equal(await browser.evaluate('window.saves'),1);assert.deepEqual(await browser.evaluate('window.saved'),{displayName:'Updated Sample',country:'sg',updates:'on',theme:'system',token:'fixture-token'});
    await browser.click('#tab-1');await browser.waitFor("location.hash==='#!/security'");assert.equal(await browser.evaluate("document.querySelector('#info').hidden"),true);assert.equal(await browser.evaluate("document.documentElement.dataset.rcFrostPage"),'account-settings');
    assert.notEqual(await browser.evaluate("getComputedStyle(document.querySelector('#danger')).backgroundColor"),'rgb(51, 95, 255)','Dangerous account actions retain native alert styling');assert.equal(await browser.evaluate("document.querySelector('#disabled-link').disabled"),true);
    await browser.click('#tab-0');await browser.waitFor("location.hash==='#!/info'");
    await browser.evaluate("(()=>{const navigation=document.querySelector('.menu-vertical');navigation.removeAttribute('data-rc-settings-menu');navigation.outerHTML=navigation.outerHTML})()");
    await browser.waitFor("!!document.querySelector('.menu-vertical[data-rc-settings-menu]')");
    await browser.evaluate("(()=>{RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture',glassBlur:32,glassOpacity:85});const section=document.querySelector('#rbx-account-info-header');section.outerHTML=section.outerHTML})()");
    assert.match(await browser.evaluate("getComputedStyle(document.querySelector('#rbx-account-info-header'),'::before').backdropFilter"),/blur\(32px\)/);
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'none',glassBlur:32,glassOpacity:85})");assert.match(await browser.evaluate("getComputedStyle(document.querySelector('#rbx-account-info-header'),'::before').backdropFilter"),/blur\(32px\)/,'Account layout and appearance survive removing the wallpaper');
    await browser.evaluate("RobloxCustomizerStartup.setPreferences({source:'url',url:'fixture'});history.pushState({},'', '/NewLogin?ReturnUrl=%2Fmy%2Faccount');dispatchEvent(new PopStateEvent('popstate'))");assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#rbx-account-info-header'),'::before').backdropFilter"),'none','Sign-in retains native layout');
    await browser.waitFor("!document.querySelector('[data-rc-settings-layout]')");
  }
  assert.deepEqual(browser.errors,[]);
});
