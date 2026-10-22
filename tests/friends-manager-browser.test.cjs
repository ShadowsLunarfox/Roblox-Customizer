const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const reactBundle = process.env.SERVER_VIEW_REACT_BUNDLE;
const nativeStyleBundle = process.env.FRIENDS_MANAGER_STYLE_BUNDLE;
const before = ['src/shared/routes.js', 'src/shared/dialogs.js', 'src/home/pinned-friends-core.js', 'src/background/pinned-friends-background.js',
  'src/background/friends-manager-background.js', 'src/shared/friends-native-view.js', 'src/shared/page-bridge.js'];
const after = ['src/shared/i18n.js', 'src/home/pinned-friends.js', 'src/home/friends-manager.js', 'src/home/follower-count.js'];
const styles = ['src/shared/theme.css', 'src/home/pinned-friends.css', 'src/home/friends-manager.css', 'src/settings/settings.css', 'src/shared/site-pages.css', 'src/pages/account/account-pages.css'];
function fixture() {
  return `<!doctype html><html lang="zh-CN" data-rc-ui-active data-rc-frost-page="friends"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    ${nativeStyleBundle ? '<link rel="stylesheet" href="/native-styleguide.css">' : ''}
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    <style>*{box-sizing:border-box}body{font:14px Arial,sans-serif;margin:0;padding:24px;background:#788ca1;color:#eee}#content{margin:auto}.native-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.btn-control-xs,.input-field{font:inherit;padding:7px 10px;background:#343a47;color:inherit;border:1px solid #7e8aa2;border-radius:6px}.input-field{max-width:100%}.friends-filter-searchbar-input{background:none;border:0;color:inherit;max-width:100%;width:100%}.avatar-cards{list-style:none}.avatar-card-container{padding:12px;min-width:0}.avatar-card-image{width:64px;height:64px;border-radius:50%}.avatar-card-caption a{color:inherit;overflow-wrap:anywhere}.avatar-card-btns{display:flex;gap:8px;margin-top:8px}h2{font-size:20px}@media(max-width:600px){body{padding:12px}}</style>
    </head><body class="dark-theme"><main id="content"><nav class="native-tabs"><button class="btn-control-xs" onclick="go()">好友</button><button class="btn-control-xs" onclick="go('following')">关注</button><button class="btn-control-xs" onclick="go('friend-requests')">好友请求</button></nav><div id="friends-web-app"></div></main><script>
      window.account=100;window.calls=[];window.resume=[];window.saved=JSON.parse(localStorage.getItem('saved')||'{}');window.csrfReady=false;window.blockWrites='';window.holdWrite=false;window.nativeClicks={chat:[],join:[],menu:0};
      window.people={100:{friends:Array.from({length:65},(_,i)=>i+1),following:[201,202,203,204,205],requests:[301,302,303,304,305],followers:Array.from({length:36},(_,i)=>1001+i)},200:{friends:[80],following:[],requests:[],followers:Array.from({length:36},(_,i)=>2001+i)}};
      window.officialFollowerTotals={100:16810358,200:0,999:2345};window.failFollowerCount=false;
      window.info=id=>({id,name:'User'+id,displayName:id===1?'Friends':id===2?'这是一位名字非常长的好友用于测试原版卡片文字换行':'Player '+id});
      const messageListeners=[],storageListeners=[];
      window.chrome={runtime:{id:'fixture',lastError:null,onMessage:{addListener:fn=>messageListeners.push(fn)},sendMessage(message,callback){for(const listener of messageListeners){if(listener(message,{id:'fixture',url:'https://www.roblox.com'+location.pathname+location.hash,frameId:0},callback))return;}}},
        storage:{local:{async get(key){return {[key]:structuredClone(saved[key])}},async set(data){const changes={};for(const[key,value]of Object.entries(data))changes[key]={oldValue:saved[key],newValue:structuredClone(value)};Object.assign(saved,structuredClone(data));localStorage.setItem('saved',JSON.stringify(saved));storageListeners.forEach(fn=>fn(changes,'local'));}},onChanged:{addListener:fn=>storageListeners.push(fn)}}};
      window.RobloxCustomizerRuntime={sendMessage:(...args)=>chrome.runtime.sendMessage(...args),onResume:fn=>resume.push(fn)};
      const nativeNow=Date.now,nativeTimer=setTimeout;let offset=0;Date.now=()=>nativeNow()+offset;
      window.setTimeout=(fn,ms,...args)=>{if(ms>1000&&ms<=6500){offset+=ms;return nativeTimer(fn,0,...args)}return nativeTimer(fn,ms,...args)};
      const result=(data,status=200,headers={})=>({ok:status<400,status,headers:{get:key=>headers[key]||null},body:{async cancel(){}},json:async()=>data});
      window.fetch=async(value,options={})=>{const url=new URL(value);calls.push({url:url.href,options});const data=people[account];
        if(url.pathname==='/v1/users/authenticated')return result({id:account});
        const followerCount=url.pathname.match(/^\\/v1\\/users\\/(\\d+)\\/followers\\/count$/);
        if(followerCount)return failFollowerCount?result({},429):result({count:officialFollowerTotals[followerCount[1]]});
        if(url.pathname.endsWith('/friends/find'))return result({PageItems:(url.searchParams.has('cursor')?data.friends.slice(50):data.friends.slice(0,50)).map(info),NextCursor:!url.searchParams.has('cursor')&&data.friends.length>50?'next':null});
        if(url.pathname.endsWith('/followings'))return result({data:data.following.map(info),nextPageCursor:null});
        if(url.pathname==='/v1/my/friends/requests')return result({data:data.requests.map(id=>({friendRequest:{senderId:id,sentAt:'2026-10-22T00:00:00Z',sourceUniverseId:null}})),nextPageCursor:null});
        if(url.pathname==='/v1/users')return result({data:JSON.parse(options.body).userIds.map(info)});
        if(url.hostname==='thumbnails.roblox.com')return result({data:[]});
        if(url.hostname==='presence.roblox.com')return result({userPresences:JSON.parse(options.body).userIds.filter(id=>id!==3).map(id=>({userId:id,userPresenceType:id===1?2:id===2?1:id===4?3:0}))});
        const match=url.pathname.match(/^\\/v1\\/users\\/(\\d+)\\/(unfriend|unfollow|accept-friend-request|decline-friend-request)$/);
        if(match){if(blockWrites==='rate')return result({},429);if(!csrfReady||options.headers['x-csrf-token']!=='token'){csrfReady=true;return result({},403,{'x-csrf-token':'token'})}if(holdWrite)await new Promise(resolve=>window.releaseWrite=resolve);const id=Number(match[1]),operation=match[2],field=operation==='unfriend'?'friends':operation==='unfollow'?'following':'requests';data[field]=data[field].filter(value=>value!==id);if(operation==='accept-friend-request')data.friends.push(id);return result({});}
        throw new Error('Unexpected URL '+url.href);
      };
    </script>${before.map(file => `<script src="/${file}"></script>`).join('')}<script src="/react.js"></script><script>
      const NativeContext=React.createContext({paginatedFriends:[],setPaginatedFriends(){},friendsSort:'native'});
      const h=React.createElement;
      const picture='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#8ba5bc"/><circle cx="32" cy="24" r="13" fill="#e1c2a5"/><path d="M10 64 Q12 38 32 38 Q52 38 54 64" fill="#435768"/></svg>');
      function NativeFollowerHeader(props){const count=React.useContext(NativeContext).friendsCount;return h('div',{className:'friends-subtitle'},h('h2',{},props.title,' ','('+(count>=500?'500+':count)+')'),h('button',{className:'btn-control-xs native-followers-tooltip',onClick:()=>window.followerTooltipClicks=(window.followerTooltipClicks||0)+1},'?'));}
      function OriginalCard({friend}) {return h('li',{className:'avatar-card','data-user-id':friend.id},h('div',{className:'avatar-card-container'},h('a',{href:'/users/'+friend.id+'/profile'},h('img',{className:'avatar-card-image',src:picture,alt:''})),h('div',{className:'avatar-card-caption'},h('a',{href:'/users/'+friend.id+'/profile'},friend.displayName||info(friend.id).displayName),h('div',{},'@'+(friend.name||info(friend.id).name))),h('div',{className:'avatar-card-btns'},h('button',{className:'btn-control-xs native-chat',onClick:()=>nativeClicks.chat.push(friend.id)},'聊天'),h('button',{className:'btn-control-xs native-join',onClick:()=>nativeClicks.join.push(friend.id)},'加入'),h('button',{className:'btn-control-xs avatar-card-menu native-menu',style:{position:'absolute',top:6,right:6},onClick:()=>nativeClicks.menu++},'…'))))}
      function NativeController(props) {
        const[page,setPage]=React.useState(1);React.useContext(NativeContext);
        React.useLayoutEffect(()=>{if(!window.originalNodes)window.originalNodes={list:document.querySelector('.avatar-cards'),search:document.querySelector('.friends-filter input'),card:document.querySelector('.avatar-card'),image:document.querySelector('.avatar-card-image'),chat:document.querySelector('.native-chat'),pager:document.querySelector('.pager-holder')};},[]);
        const count=Math.max(1,Math.ceil(props.friends.length/18));if(page>count)setPage(count);
        const visible=props.friends.slice((page-1)*18,page*18);
        return h('section',{className:'friends-content section'},h('div',{className:'container-header'},props.currentTab==='followers'?h(NativeFollowerHeader,{...props,tooltipMsg:'Follower list information',isMyProfile:props.metadata.isMyProfile,translate:value=>value,declineAllFriendRequests(){},refreshFriendsList(){},updateFilter(){}}):h('div',{className:'friends-subtitle'},h('h2',{},'好友')),h('div',{className:'friends-filter'},h('div',{className:'friends-filter-searchbar-container form-control input-field'},h('input',{className:'friends-filter-searchbar-input',value:props.query,onChange:props.onSearch,placeholder:'搜索好友'})))),h('ul',{className:'avatar-cards'},visible.map(friend=>h(OriginalCard,{key:friend.id,friend}))),h('div',{className:'pager-holder'},h('button',{className:'btn-control-xs',id:'native-prev',disabled:page<=1,onClick:()=>setPage(page-1)},'上一页'),h('span',{'data-native-page':page},page+' / '+count),h('button',{className:'btn-control-xs',id:'native-next',disabled:page>=count,onClick:()=>setPage(page+1)},'下一页')));
      }
      function NativeApp(){
        const[tab,setTab]=React.useState('friends'),[owner,setOwner]=React.useState(null),[records,setRecords]=React.useState(people[account].friends.map(info)),[query,setQuery]=React.useState(''),[followerTotal,setFollowerTotal]=React.useState(16810358);
        const field=value=>value==='friend-requests'?'requests':value==='following'?'following':value==='followers'?'followers':'friends';
        const collection=()=>people[account][field(tab)].map(info);window.setFollowerTotal=setFollowerTotal;
        window.go=(next='friends',user=null)=>{history.pushState({},'','/zh-cn/users/'+(user?user+'/':'')+'friends#!/'+next);setTab(next);setOwner(user);setRecords(people[account][field(next)].map(info));setQuery('');dispatchEvent(new PopStateEvent('popstate'));};
        return h(NativeContext.Provider,{value:{paginatedFriends:[],setPaginatedFriends(){},friendsSort:'native',friendsCount:followerTotal}},h(NativeController,{key:tab+':'+(owner||account),currentTab:tab,metadata:{profileUserId:owner||account,isMyProfile:!owner||owner===account},friends:records.filter(friend=>(friend.name+' '+friend.displayName).toLowerCase().includes(query.toLowerCase())),setFriends:setRecords,loadMoreFriends(){},enableTabLoader(){},disableTabLoader(){},title:tab==='followers'?'Followers':'好友',query,onSearch:event=>{setQuery(event.target.value);setRecords(collection());}}));
      }
      if(ReactDOM.createRoot)ReactDOM.createRoot(document.querySelector('#friends-web-app')).render(h(NativeApp));else ReactDOM.render(h(NativeApp),document.querySelector('#friends-web-app'));
    </script>${after.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

test('filtering and bulk actions extend native React cards, search and pagination without friend groups',
  { skip: !process.env.CHROME_BIN || !reactBundle, timeout: 90000 }, async t => {
    const assets = new Set([...before, ...after, ...styles]);
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
      response.end(file==='react.js'?fs.readFileSync(reactBundle):file==='native-styleguide.css'&&nativeStyleBundle?fs.readFileSync(nativeStyleBundle):assets.has(file)?fs.readFileSync(path.join(workspace,file)):fixture());
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'friends-native-manager');
    await browser.send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/zh-cn/users/friends#!/friends` });
    await waitForDocument(browser, '#rc-friends-manager');
    assert.deepEqual(browser.errors, [], 'Native React fixture initializes');
    await browser.waitFor("document.querySelectorAll('[data-rc-native-friend]').length===18&&!document.querySelector('[data-rc-multi-select]').disabled");
    assert.equal(await browser.evaluate("originalNodes.list===document.querySelector('.avatar-cards')&&originalNodes.search===document.querySelector('.friends-filter input')&&originalNodes.card===document.querySelector('.avatar-card')&&originalNodes.image===document.querySelector('.avatar-card-image')&&originalNodes.chat===document.querySelector('.native-chat')&&originalNodes.pager===document.querySelector('.pager-holder')"), true, 'Native elements and handlers retain identity');
    assert.equal(await browser.evaluate("!document.querySelector('.rc-friends-grid,.rc-friends-card,#rc-friends-manager-toggle,[data-rc-friends-native]')&&getComputedStyle(document.querySelector('.avatar-cards')).display!=='none'&&document.querySelectorAll('.friends-filter input').length===1"), true, 'No replacement list, duplicate search or view switch');
    await browser.click('.native-chat'); await browser.click('.native-join'); await browser.click('.native-menu');
    assert.deepEqual(await browser.evaluate('nativeClicks'), { chat:[1], join:[1], menu:1 });
    const change = (selector,value,event='change')=>browser.evaluate(`(()=>{const n=document.querySelector(${JSON.stringify(selector)});n.value=${JSON.stringify(value)};n.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}))})()`);
    const check=async id=>{const selector=`.avatar-card[data-user-id="${id}"] .rc-friends-checkbox label`;await browser.waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);await browser.click(selector);};
    const confirm=()=>browser.click('#rc-friends-bulk-dialog .rc-friends-dialog-header:last-child > button:last-child');
    const palette = { '--rc-custom-color-scheme':'dark', '--rc-custom-background-rgb':'57 75 132', '--rc-custom-background':'#394b84',
        '--rc-custom-text':'#ffffff', '--rc-custom-text-rgb':'255 255 255', '--rc-custom-text-secondary':'#e1e8ff', '--rc-custom-text-muted':'#becaf0',
        '--rc-custom-control-bg':'#465d9e', '--rc-custom-control-hover':'#526bb2', '--rc-custom-control-border':'#91a4de',
        '--rc-custom-accent':'#bad3ff', '--rc-custom-accent-text':'#1b2330', '--rc-custom-accent-hover':'#a0c7ff', '--rc-custom-surface-floor':'0' };
    const dialogAppearance = async (selector, name) => {
      const appearance = () => browser.evaluate(`(()=>{const dialog=document.querySelector(${JSON.stringify(selector)}),style=getComputedStyle(dialog),rect=dialog.getBoundingClientRect();return {
        background:style.backgroundColor,color:style.color,blur:style.backdropFilter,backdrop:getComputedStyle(dialog,'::backdrop').backdropFilter,
        text:[...dialog.querySelectorAll('h2,p,li,button')].map(n=>({tag:n.tagName,color:getComputedStyle(n).color,danger:n.classList.contains('rc-friends-danger'),text:n.textContent.slice(0,40)})),buttons:[...dialog.querySelectorAll('button')].map(n=>({background:getComputedStyle(n).backgroundColor,danger:n.classList.contains('rc-friends-danger')})),
        tools:[...document.querySelectorAll('#rc-friends-manager .rc-friends-tool')].filter(n=>n.getClientRects().length).map(n=>({height:n.getBoundingClientRect().height,font:getComputedStyle(n).fontSize,color:getComputedStyle(n).color})),
        options:[...document.querySelectorAll('#rc-friends-manager select option')].map(n=>({background:getComputedStyle(n).backgroundColor,color:getComputedStyle(n).color})),
        sections:[...dialog.querySelectorAll('.modal-header,.modal-footer')].map(n=>getComputedStyle(n).backgroundColor),
        fits:rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight&&dialog.scrollWidth<=dialog.clientWidth+1}})()`);
      for (const [theme,background,color,control,opaque] of [
        ['dark','rgba(20, 22, 28, 0.6)','rgb(244, 246, 251)','rgb(41, 43, 53)','rgb(20, 22, 28)'],
        ['light','rgba(255, 255, 255, 0.82)','rgb(27, 35, 48)','rgb(240, 242, 246)','rgb(255, 255, 255)'],
        ['custom','rgba(57, 75, 132, 0.6)','rgb(255, 255, 255)','rgb(70, 93, 158)','rgb(57, 75, 132)']
      ]) {
        await browser.evaluate(`(()=>{const root=document.documentElement;document.body.className=${JSON.stringify(theme==='light'?'light-theme':'dark-theme')};root.toggleAttribute('data-rc-custom-colors',${theme==='custom'});root.style.setProperty('--rc-glass-blur','24px');root.style.setProperty('--rc-glass-opacity','.6');for(const [key,value] of Object.entries(${JSON.stringify(palette)}))root.style.setProperty(key,value)})()`);
        for(const width of [1280,320]) {
          await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
          await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});
          await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
          const actual = await appearance();
          assert.equal(actual.background,background,name+' follows '+theme+' surface'); assert.equal(actual.color,color);
          assert.ok(actual.text.every(value=>value.color===(value.danger?'rgb(255, 255, 255)':color)),name+' '+theme+' text and buttons remain readable: '+JSON.stringify(actual.text));
          assert.ok(actual.buttons.every(value=>value.background===(value.danger?'rgb(180, 35, 50)':control)),name+' controls follow the theme and the unfriend confirmation stays red');
          assert.ok(actual.tools.every(value=>value.height>=40&&value.font==='14px'&&value.color===color),theme+' toolbar buttons and selects use readable, consistent sizing');
          assert.ok(actual.options.every(value=>value.background===control&&value.color===color),theme+' native dropdown options have matching text and opaque backgrounds');
          assert.ok(actual.sections.every(value=>value==='rgba(0, 0, 0, 0)'),name+' header and footer have no white backing');
          assert.match(actual.blur,/blur\(24px\)/); assert.match(actual.backdrop,/blur\(8px\)/); assert.equal(actual.fits,true,name+' fits '+width);
          if(process.env.FRIENDS_MANAGER_SCREENSHOTS){const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(workspace,`.tmp-friends-dialog-${name}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));}
        }
        await browser.evaluate("document.documentElement.style.setProperty('--rc-glass-blur','32px')");
        assert.match((await appearance()).blur,/blur\(32px\)/,name+' blur updates live');
        await browser.evaluate("document.documentElement.setAttribute('data-rc-disable-blur','')");
        const disabled = await appearance(); assert.equal(disabled.blur,'none'); assert.equal(disabled.backdrop,'none');
        await browser.evaluate("document.documentElement.removeAttribute('data-rc-disable-blur');document.documentElement.setAttribute('data-rc-disable-transparency','')");
        assert.equal((await appearance()).background,opaque,name+' respects disabled transparency');
        await browser.evaluate("document.documentElement.removeAttribute('data-rc-disable-transparency')");
      }
      await browser.evaluate(`(()=>{const root=document.documentElement;root.removeAttribute('data-rc-custom-colors');root.style.removeProperty('--rc-glass-blur');root.style.removeProperty('--rc-glass-opacity');for(const key of Object.keys(${JSON.stringify(palette)}))root.style.removeProperty(key);document.body.className='dark-theme'})()`);
      await browser.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    };
    await browser.click('#rc-pinned-friends .rc-pinned-friends-header button');
    await browser.waitFor("document.querySelectorAll('#rc-pinned-friends-dialog li').length===48");
    await dialogAppearance('#rc-pinned-friends-dialog','pins');
    await browser.click('#rc-pinned-friends-dialog .rc-pinned-friends-header button');
    await browser.evaluate("(()=>{const input=document.querySelector('.friends-filter input');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'User65');input.dispatchEvent(new Event('input',{bubbles:true}))})()");
    await browser.waitFor("document.querySelectorAll('.avatar-card').length===1&&document.querySelector('.avatar-card').dataset.userId==='65'");
    await browser.evaluate("(()=>{const input=document.querySelector('.friends-filter input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'');input.dispatchEvent(new Event('input',{bubbles:true}))})()");
    await browser.waitFor("document.querySelectorAll('[data-rc-native-friend]').length===18");
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-multi-select]').textContent"), '选择用户');
    assert.equal(await browser.evaluate("[...document.querySelectorAll('.rc-friends-checkbox')].every(n=>n.hidden)"), true, 'Checkboxes appear only in selection mode');
    await browser.click('[data-rc-multi-select]');
    assert.equal(await browser.evaluate("[...document.querySelectorAll('.rc-friends-checkbox')].every(n=>!n.hidden)"), true);
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.avatar-card-menu')).visibility"), 'hidden', 'Selection mode uses the original top-right menu space');
    const checkPlacement = () => browser.evaluate("[...document.querySelectorAll('[data-rc-native-friend]')].every(card=>{const a=card.getBoundingClientRect(),b=card.querySelector('.rc-friends-checkbox label').getBoundingClientRect();return Math.abs(a.right-b.right-8)<=1&&b.top>=a.top+7&&b.top<=a.top+10})");
    assert.equal(await checkPlacement(), true, 'Checkboxes sit at the top right of original cards');
    if(nativeStyleBundle) assert.equal(await browser.evaluate("(()=>{const mark=getComputedStyle(document.querySelector('.rc-friends-checkbox label'),'::before');return getComputedStyle(document.querySelector('.rc-friends-checkbox input')).opacity==='0'&&mark.content!=='none'&&mark.borderTopStyle==='solid'&&parseFloat(mark.width)>=16})()"),true,'Original Roblox checkbox styling provides the visible, clickable checkmark');
    await check(1); await browser.click('#native-next');
    await browser.waitFor("document.querySelector('.avatar-card').dataset.userId==='19'"); await check(19);
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-selected-count').textContent"), '已选 2 人', 'Selection follows original pagination');
    await browser.click('#native-prev'); await browser.waitFor("!!document.querySelector('.avatar-card[data-user-id=\"1\"] .rc-friends-checkbox input')");
    assert.equal(await browser.evaluate("document.querySelector('.avatar-card[data-user-id=\"1\"] .rc-friends-checkbox input').checked"), true, 'First-page selection survives a round trip');
    await browser.click('#native-next'); await browser.waitFor("!!document.querySelector('.avatar-card[data-user-id=\"19\"] .rc-friends-checkbox input')");
    assert.equal(await browser.evaluate("document.querySelector('.avatar-card[data-user-id=\"19\"] .rc-friends-checkbox input').checked"), true, 'Second-page selection also survives a round trip');
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-selected-count').textContent"), '已选 2 人');
    await browser.click('#native-prev'); await browser.waitFor("!!document.querySelector('.avatar-card[data-user-id=\"1\"] .rc-friends-checkbox input')");
    if(process.env.FRIENDS_MANAGER_SCREENSHOTS){await browser.evaluate('scrollTo(0,0);new Promise(resolve=>requestAnimationFrame(resolve))');const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(workspace,'.tmp-friends-selected.png'),Buffer.from(shot.data,'base64'));}
    await browser.click('[data-rc-relationship="primary"]');
    assert.equal(await browser.evaluate("!document.querySelector('.rc-friends-review-warning').hidden&&document.querySelector('.rc-friends-review-warning').textContent.includes('无法撤销')&&document.querySelector('#rc-friends-bulk-dialog').getAttribute('aria-describedby').includes('rc-friends-bulk-warning')"),true,'Unfriend review clearly warns that restoring friendship requires a new request');
    await dialogAppearance('#rc-friends-bulk-dialog','confirm');
    await browser.click('#rc-friends-bulk-dialog .modal-footer button:first-child');
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-selected-count').textContent"), '已选 2 人', 'Appearance changes and cancelling the review preserve selection');
    if(process.env.FRIENDS_MANAGER_SCREENSHOTS){
      await browser.evaluate(`(()=>{const root=document.documentElement;root.setAttribute('data-rc-custom-colors','');for(const [key,value] of Object.entries(${JSON.stringify(palette)}))root.style.setProperty(key,value);scrollTo(0,0)})()`);
      for(const [menu,selector] of [['status','select[aria-label="筛选好友"]'],['sort','select[aria-label="好友排序"]']]){
        await browser.click('#rc-friends-manager '+selector);
        const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(workspace,`.tmp-friends-dropdown-${menu}.png`),Buffer.from(shot.data,'base64'));
        await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
        await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      }
      await browser.evaluate(`(()=>{const root=document.documentElement;root.removeAttribute('data-rc-custom-colors');for(const key of Object.keys(${JSON.stringify(palette)}))root.style.removeProperty(key)})()`);
    }
    await browser.click('[data-rc-multi-select]');
    assert.equal(await browser.evaluate("[...document.querySelectorAll('.rc-friends-checkbox')].every(n=>n.hidden)&&getComputedStyle(document.querySelector('.avatar-card-menu')).visibility==='visible'"), true, 'Leaving selection mode restores the native menu');
    await browser.click('.native-menu');
    assert.equal(await browser.evaluate('nativeClicks.menu'), 2, 'Restored native menu keeps its original handler');
    await browser.click('[data-rc-multi-select]');
    await browser.click('[data-rc-clear-selection]'); await browser.click('[data-rc-select-all]');
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-selected-count').textContent"), '已选 65 人');
    await browser.click('[data-rc-clear-selection]'); await browser.click('[data-rc-select-page]');
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-selected-count').textContent"), '已选 18 人');
    await browser.click('[data-rc-clear-selection]');
    assert.equal(await browser.evaluate("document.querySelector('[data-rc-relationship=primary]').disabled&&getComputedStyle(document.querySelector('[data-rc-relationship=primary]')).opacity==='0.55'"),true,'No selection keeps the unfriend action visibly disabled');
    assert.equal(await browser.evaluate("!document.querySelector('#rc-friends-group-dialog,[data-rc-group-action],.rc-friends-memberships,select[aria-label=\"好友分组\"]')"), true, 'Friend group controls and card labels are removed');
    await change('#rc-friends-manager select[aria-label="筛选好友"]','online');
    await browser.waitFor("document.querySelectorAll('.avatar-card').length===3");
    assert.equal(await browser.evaluate("[...document.querySelectorAll('.avatar-card')].map(n=>n.dataset.userId).join(',')"), '1,2,4', 'Status filters still use the original controller and cards');
    await change('#rc-friends-manager select[aria-label="筛选好友"]','all');
    await change('#rc-friends-manager select[aria-label="好友排序"]','username');
    assert.equal(await browser.evaluate("document.querySelector('select[aria-label=\"好友排序\"]').selectedOptions[0].textContent"),'按用户名排序');
    await browser.waitFor("document.querySelectorAll('.avatar-card').length===18");
    assert.equal(await browser.evaluate("[...document.querySelectorAll('.avatar-card')].slice(0,4).map(n=>n.dataset.userId).join(',')"),'1,2,3,4');
    for(const locale of ['zh-CN','ja','en']){
      await browser.evaluate(`RobloxCustomizerI18n.setLanguage(${JSON.stringify(locale)})`);
      for(const width of [1280,320]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        assert.equal(await browser.evaluate("document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('#rc-friends-manager,.avatar-card,.container-header')].every(n=>n.scrollWidth<=n.clientWidth+1)"),true,locale+' fits '+width);
        assert.equal(await checkPlacement(),true,locale+' checkboxes stay at the top right at '+width);
        if(process.env.FRIENDS_MANAGER_SCREENSHOTS){const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(workspace,`.tmp-friends-native-${locale}-${width}.png`),Buffer.from(shot.data,'base64'));}
      }
    }
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await browser.evaluate("RobloxCustomizerI18n.setLanguage('zh-CN');go('following')");
    await browser.waitFor("document.querySelectorAll('[data-rc-native-friend]').length===5&&!!document.querySelector('.avatar-card[data-user-id=\"201\"]')");
    await browser.click('[data-rc-multi-select]'); await check(201); await check(202); await browser.click('[data-rc-relationship="primary"]');
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-review-warning').hidden&&!document.querySelector('#rc-friends-bulk-dialog .rc-friends-danger')"),true,'Unfollow does not reuse the unfriend warning or red confirmation');
    assert.equal(await browser.evaluate("document.querySelectorAll('.rc-friends-review-list li').length"),2);
    await browser.evaluate("document.querySelector('#rc-friends-bulk-dialog .rc-friends-dialog-header:last-child > button:last-child').click()");
    assert.equal(await browser.evaluate('people[100].following.length'),5);
    await browser.click('#rc-friends-bulk-dialog .rc-friends-dialog-header:last-child > button:first-child');
    await browser.click('[data-rc-relationship="primary"]'); await confirm(); await browser.waitFor('people[100].following.length===3');
    await browser.evaluate("go('friend-requests')"); await browser.waitFor("document.querySelectorAll('[data-rc-native-friend]').length===5&&!!document.querySelector('.avatar-card[data-user-id=\"301\"]')");
    await browser.click('[data-rc-multi-select]'); await check(301); await check(302); await browser.click('[data-rc-relationship="primary"]'); await confirm();
    await browser.waitFor('people[100].friends.includes(301)&&people[100].friends.includes(302)');
    await browser.waitFor("document.querySelectorAll('.avatar-card').length===3"); await check(303); await browser.click('[data-rc-relationship="decline"]'); await confirm();
    await browser.waitFor('!people[100].requests.includes(303)'); assert.equal(await browser.evaluate('people[100].friends.includes(303)'),false);
    await browser.evaluate('go()'); await browser.waitFor("document.querySelectorAll('[data-rc-native-friend]').length===18");
    await browser.click('[data-rc-multi-select]'); await check(1); await check(2); await browser.evaluate('holdWrite=true;delete window.releaseWrite');
    await browser.click('[data-rc-relationship="primary"]'); await confirm(); await browser.waitFor("typeof releaseWrite==='function'");
    await browser.click('[data-rc-stop]'); await browser.evaluate('holdWrite=false;releaseWrite()');
    await browser.waitFor("document.querySelector('.rc-friends-selected-count').textContent==='已选 1 人'");
    assert.equal(await browser.evaluate('people[100].friends.includes(1)'),false); assert.equal(await browser.evaluate('people[100].friends.includes(2)'),true);
    await browser.evaluate("blockWrites='rate'"); await browser.click('[data-rc-relationship="primary"]'); await confirm();
    await browser.waitFor("!document.querySelector('.rc-friends-results').hidden");
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-results').textContent.includes('稍后')"),true);
    await browser.evaluate("blockWrites='';document.documentElement.setAttribute('data-rc-features-disabled','')");
    await browser.waitFor("!document.querySelector('#rc-friends-manager')&&!document.querySelector('.rc-friends-checkbox')");
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('.avatar-cards')).display==='none'"),false,'Native list is never replaced or suppressed');
    await browser.evaluate("document.documentElement.removeAttribute('data-rc-features-disabled');go('friends',999)");
    await browser.waitFor("!document.querySelector('#rc-friends-manager')");
    await browser.evaluate('account=200;go("friends",200);resume.forEach(fn=>fn())');
    await browser.waitFor("document.querySelectorAll('[data-rc-native-friend]').length===1&&document.querySelector('.avatar-card').dataset.userId==='80'");
    assert.equal(await browser.evaluate("document.querySelector('.rc-friends-selected-count').textContent"), '已选 0 人', 'Account changes clear selection');
    await browser.evaluate("account=100;go('followers');setFollowerTotal(16810358)");
    await browser.waitFor("document.querySelector('.friends-subtitle h2').textContent==='Followers (16,810,358)'");
    assert.equal(await browser.evaluate("!document.querySelector('#rc-friends-manager')&&document.querySelectorAll('.avatar-card').length===18"),true,'Full follower totals retain the native list');
    await browser.evaluate("window.nativeFollowerTooltip=document.querySelector('.native-followers-tooltip');void 0");
    await browser.click('.native-followers-tooltip'); assert.equal(await browser.evaluate('followerTooltipClicks'),1);
    await browser.click('#native-next'); await browser.waitFor("document.querySelector('[data-native-page]').dataset.nativePage==='2'");
    assert.equal(await browser.evaluate("document.querySelector('.friends-subtitle h2').textContent"),'Followers (16,810,358)','Pagination never replaces the total with a page size');
    const beforeCountUpdate=await browser.evaluate('calls.length');
    await browser.evaluate('officialFollowerTotals[100]=16810400;setFollowerTotal(16810400);resume.forEach(fn=>fn())');
    await browser.waitFor("document.querySelector('.friends-subtitle h2').textContent==='Followers (16,810,400)'");
    assert.equal(await browser.evaluate("nativeFollowerTooltip===document.querySelector('.native-followers-tooltip')&&document.querySelector('[data-native-page]').dataset.nativePage==='2'"),true,'Native count updates retain the tooltip and current page');
    assert.equal(await browser.evaluate("calls.slice("+beforeCountUpdate+").some(call=>/\\/followers(?:\\?|$)/.test(call.url))"),false,'Refreshing the total never downloads follower pages');
    await browser.evaluate("document.querySelector('.friends-subtitle h2').lastChild.nodeValue='(500+)'");
    await browser.waitFor("document.querySelector('.friends-subtitle h2').textContent==='Followers (16,810,400)'");
    for(const width of [1280,320]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await browser.evaluate('scrollTo(0,0);new Promise(resolve=>requestAnimationFrame(resolve))');
      assert.equal(await browser.evaluate("document.querySelector('.friends-subtitle').scrollWidth<=document.querySelector('.friends-subtitle').clientWidth+1"),true,'Full total fits '+width);
      if(process.env.FRIENDS_MANAGER_SCREENSHOTS){const shot=await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(workspace,`.tmp-followers-count-${width}.png`),Buffer.from(shot.data,'base64'));}
    }
    await browser.evaluate("account=200;go('followers',200);setFollowerTotal(0)");
    await browser.waitFor("document.querySelector('.friends-subtitle h2').textContent==='Followers (0)'");
    await browser.evaluate("go('followers',999);setFollowerTotal(2345)");
    await browser.waitFor("document.querySelector('.friends-subtitle h2').textContent==='Followers (2,345)'");
    await browser.evaluate("failFollowerCount=true;resume.forEach(fn=>fn());setFollowerTotal(500)");
    await browser.waitFor("document.querySelector('.friends-subtitle h2').textContent==='Followers (500+)'");
    assert.equal(await browser.evaluate("document.querySelector('.friends-subtitle h2').textContent.includes('(0)')"),false,'A failed API request never fabricates zero followers');
    await pause(150);
    const count=await browser.evaluate('calls.length');await browser.evaluate("for(let i=0;i<20;i++){const n=document.createElement('div');document.body.append(n);n.remove()}");
    await pause(150);assert.equal(await browser.evaluate('calls.length'),count);
    assert.deepEqual(browser.errors,[]);
  });
