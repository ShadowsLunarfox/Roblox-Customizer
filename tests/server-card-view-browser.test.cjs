const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {test}=require('node:test');
const {isolatedChrome,waitForDocument,pause}=require('./helpers/chrome.cjs');
const workspace=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(workspace,'manifest.json'),'utf8'));
const scripts=manifest.content_scripts.flatMap(entry=>entry.js||[]);
const styles=[...new Set(manifest.content_scripts.flatMap(entry=>entry.css||[]))];
// Optionally run the same cases with Roblox's real React/ReactDOM bundle, served
// locally. The regular fixture needs no network or third-party dependencies.
const reactBundle=process.env.SERVER_VIEW_REACT_BUNDLE;
const setup=`
  window.actions=[];window.privateRequests=[];window.serverStatusRequests=[];
  window.chrome={storage:{local:{async get(){return {robloxCustomizerTermsAccepted:true,robloxCustomizerSettingsGuideSeen:true,customBackground:{source:'none',hideXFeed:true,hideYouTubeFeed:true}}},async set(){}},onChanged:{addListener(){}}},
    runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
      if(message.type==='rc-private-server-details'){privateRequests.push({message,callback});return}
      if(message.type==='rc-public-server-status'){serverStatusRequests.push({message,callback});return}
      setTimeout(()=>callback(message.type==='rc-public-server-country'?(message.serverId.endsWith('000000000011')?{error:'Country unavailable'}:{countryCode:'MY'}):message.type==='rc-pinned-games'?{games:[],folders:[]}
        :message.type==='rc-currency-rates'?{date:'2026-10-11',rates:{USD:1}}:{error:'Unused fixture data'}),10);
    }}};
`;
function html(url){
  const locale=url.searchParams.get('locale');const real=url.searchParams.has('react');
  return `<!doctype html><html lang="${locale}" class="${url.searchParams.get('theme')}-theme"><head><meta charset="utf-8">
    <style>*{box-sizing:border-box}body{margin:16px;font:16px Arial;background:#24252c;color:white}.light-theme body{background:#eee;color:#202227}#game-detail-page{max-width:1000px;margin:auto}.flex{display:flex}.flex-col{flex-direction:column}.items-center{align-items:center}.justify-between{justify-content:space-between}.width-full{width:100%}.card-list{padding:0;list-style:none}.player-avatar{display:inline-block}.player-avatar img{width:48px;height:48px}.owner-avatar img{width:40px;height:40px}.card-item{padding:10px;background:#555}button{padding:8px;font:inherit}.height-40{height:40px}a{color:inherit}.native-menu-panel{padding:8px;background:#555}</style>
    ${styles.map(file=>'<link rel="stylesheet" href="/'+file+'">').join('')}${real?'<script src="/fixture-react.js"></script>':''}</head><body>
    <main id="game-detail-page" data-place-id="${url.pathname.match(/games\/(\d+)/)?.[1] || '893973440'}"><h1>Game</h1><section id="game-instances"><div id="fixture-root"></div></section></main><script>
    window.lateAvatar=false;window.nativeNodes={};
    if(!window.React?.version){window.React={Fragment:Symbol.for('fragment'),createElement:(type,props,...children)=>({type,props:{...props,...(children.length?{children:children.length===1?children[0]:children}:{})}}),cloneElement:(node,props)=>({...node,props:{...node.props,...props}})};window.ReactJSX={jsx:(type,props)=>({type,props})}}
    const real=!!React.version;const h=(...args)=>React.createElement(...args);
    const placeId=Number(document.getElementById('game-detail-page').dataset.placeId);const join=${JSON.stringify(locale==='id'?'Gabung':locale==='en'?'Join':'加入')};
    const count=(n,max=5)=>${JSON.stringify(locale==='id'?'PLAYING dari MAX pemain':locale==='en'?'PLAYING of MAX people max':locale==='zh-cn'?'PLAYING/MAX 名玩家':'PLAYING/MAX 位玩家')}.replace('PLAYING',n).replace('MAX',max);
    // Native control components need not forward arbitrary data attributes.
    function Button(p){return h('button',{className:p.className,onClick:p.onClick,disabled:p.isDisabled},p.children)}
    function Owner(p){return h('div',{className:'rbx-private-owner'},h('a',{className:'owner-avatar',href:'/users/'+p.ownerUserId+'/profile'},h('img',{src:!lateAvatar&&p.ownerUserId===500?null:'/avatar.svg'})),h('a',{className:'text-name'},p.ownerName))}
    function Menu(p){const state=real?React.useState(false):[false,()=>{}];return h('div',{},h('button',{className:'native-menu',onClick:()=>{
      actions.push('menu');if(real)state[1](!state[0]);else{const node=document.createElement('a');node.className='native-menu-panel';node.href='/private-server/configure/'+p.vipServerId;node.textContent='Configure';document.querySelector('[data-private-server-id="'+p.vipServerId+'"]').querySelector('.native-menu').after(node)}
    }},'Menu'),state[0]&&h('a',{className:'native-menu-panel',href:'/private-server/configure/'+p.vipServerId},'Configure'))}
    function Renew(p){const state=real?React.useState(0):[0,()=>{}];return p.expired?h('button',{className:'native-renew',onClick:()=>{state[1](state[0]+1);actions.push('renew')}},'Renew '+state[0]):null}
    function Card(p){return h('li',{className:'rbx-'+p.serverListType+'-game-server-item col-md-3'},h('div',{className:'card-item'},
      h('div',{className:'player-thumbnails-container'},h('a',{className:'player-avatar'},h('img',{src:'/avatar.svg'}))),
      h('div',{className:'game-server-details'},h('div',{className:'section-header'},h('span',{className:'font-bold'},p.name),p.serverListType==='private'&&h(Menu,p)),
        p.serverListType==='private'&&h(Owner,{ownerUserId:p.owner.id,ownerName:p.owner.name}),h('div',{className:'rbx-game-status'},p.gameServerStatus),
        h('div',{className:'native-warning'},p.expired?'Inactive subscription':''),h(Renew,p),p.serverListType==='friends'&&h('a',{href:'/users/600/profile',className:'native-friend'},'Friend name'),
        !p.expired&&h(Button,{className:'game-server-join-btn',isDisabled:p.isLoading,onClick:()=>actions.push(p.serverListType+':'+p.id)},join))))}
    function Compact(p){return h('div',{className:'flex items-center justify-between padding-y-medium width-full'},
      h('div',{className:'flex items-center'},h('div',{className:'height-40'},h('div',{},p.thumbnailTargetId==null?h('div',{className:'native-avatar-placeholder'}):h('img',{src:!lateAvatar&&p.thumbnailTargetId===500?null:'/avatar.svg'}))),h('div',{},h('span',{className:'text-title-medium'},p.name),h('span',{className:'text-body-medium'},p.playerCountStatus))),
      h('div',{className:'flex'},p.isOwner&&h('a',{href:'/private-server/configure/'+p.vipServerId},'Edit'),h('div',{className:'large:width-[200px]'},h(Button,{onClick:p.onJoinClick,isDisabled:p.isJoinDisabled},join))))}
    window.servers={private:[0,1].map(i=>({placeId,serverListType:'private',vipServerId:111+i,id:null,name:'中文服务器 '+i,owner:{id:500+i,name:'Owner '+i},players:[],gameServerStatus:count(i),currentPlayersCount:i,maxPlayers:5,expired:i===1,
      thumbnailTargetId:500+i,playerCountStatus:count(i),onJoinClick:()=>actions.push('compact:'+i),isJoinDisabled:i===1,isOwner:i===1})),
      friends:[{placeId,serverListType:'friends',id:'22222222-2222-2222-2222-222222222222',gameServerStatus:count(1),currentPlayersCount:1,playing:1,ping:70,maxPlayers:5,players:[{id:600}],name:''}],
      public:Array.from({length:12},(_,i)=>({placeId,serverListType:'public',id:'33333333-3333-3333-3333-'+String(i).padStart(12,'0'),gameServerStatus:count(i,20),currentPlayersCount:i,playing:i,ping:40+i*10,maxPlayers:20,players:[],name:'',isLoading:i===2}))};
    window.completeDetails=i=>privateRequests[i].callback({servers:servers.private.map(p=>({id:p.vipServerId,name:p.name,ownerName:p.owner.name,playing:p.currentPlayersCount,maxPlayers:5,ping:80,countryCode:'MY',playerImages:[]})),uniqueNames:[]});
    if(${locale === 'id'})for(const server of servers.public){delete server.ping;server.pingSignalLevel=server.id.endsWith('000000000011')?undefined:'High'};
    window.completePublicStatuses=()=>serverStatusRequests.splice(0).forEach(({message,callback})=>callback({servers:message.serverIds.filter(id=>!id.endsWith('000000000011')).map(id=>({id,ping:185}))}));
    const loadMore=()=>{actions.push('load-more');const i=servers.public.length;servers.public.push({...servers.public[0],id:'33333333-3333-3333-3333-'+String(i).padStart(12,'0'),playing:i,currentPlayersCount:i,gameServerStatus:count(i,20)});renderServers()};
    function List(p){return h('section',{id:'rbx-'+p.type+'-running-games',className:'server-list-section'},h('h2',{},p.headerTitle),
      h('button',{className:'native-refresh',onClick:()=>{actions.push('refresh');renderServers()}},'Refresh'),
      p.gameInstances.length?h('ul',{className:'card-list'},p.gameInstances.map(s=>h(Card,{...s,key:s.vipServerId||s.id}))):h('p',{className:'no-servers-message'},'No servers found.'),p.type==='public'&&h('button',{className:'native-load-more',onClick:loadMore},'Load More'))}
    function All(){return h(React.Fragment,{},${url.searchParams.get('layout')==='compact'?
      "h('section',{id:'native-private'},h('h2',{},'Your private servers'),h('div',{id:'private-list'},h('div',{id:'plus-banner'},h('button',{onClick:()=>actions.push('subscribe')},'Subscribe')),h('div',{id:'create-row'},h('span',{className:'text-title-medium'},'Create a private server'),h('button',{onClick:()=>actions.push('create')},'Create')),servers.private.map(p=>h(Compact,{...p,placeId:undefined,serverListType:undefined,gameServerStatus:undefined,key:p.vipServerId}))))":
      "h(List,{type:'private',placeId,headerTitle:'Private Servers',gameInstances:servers.private,loadMoreGameInstances:loadMore})"},
      h(List,{type:'friends',placeId,headerTitle:'Friends Servers',gameInstances:servers.friends,loadMoreGameInstances:loadMore}),
      h(List,{type:'public',placeId,headerTitle:'Other Servers',gameInstances:servers.public,loadMoreGameInstances:loadMore}))}
    function mount(n){if(n==null||n===false)return document.createTextNode('');if(Array.isArray(n)){const f=document.createDocumentFragment();n.forEach(c=>f.append(mount(c)));return f}if(typeof n!=='object')return document.createTextNode(String(n));if(typeof n.type==='function')return mount(n.type(n.props));if(typeof n.type==='symbol')return mount(n.props.children);const e=document.createElement(n.type);for(const[k,v]of Object.entries(n.props||{})){if(k==='children'||k==='key'||v==null)continue;if(k==='onClick')e.addEventListener('click',v);else if(k==='disabled')e.disabled=v;else e.setAttribute(k==='className'?'class':k,String(v))}e.append(mount(n.props.children));return e}
    window.renderServers=()=>{if(real)ReactDOM.render(h(All,{}),document.querySelector('#fixture-root'));else document.querySelector('#fixture-root').replaceChildren(mount(h(All,{})))};
    renderServers();
    </script></body></html>`;
}
test('private rendering covers games and layouts while public and friends cards keep native presentation and actions',
  {skip:!process.env.CHROME_BIN,timeout:120000},async t=>{
    const files=new Set([...scripts,...styles]);
    const server=http.createServer((request,response)=>{
      response.setHeader('Cache-Control','no-store');const url=new URL(request.url,'http://localhost');const file=url.pathname.slice(1);
      if(file==='fixture-react.js'&&reactBundle){response.setHeader('Content-Type','text/javascript');response.end(fs.readFileSync(reactBundle))}
      else if(files.has(file)){response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)))}
      else if(file.endsWith('.svg')){response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#6575a0"/></svg>')}
      else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html(url))}
    });
    await new Promise(resolve=>server.listen(Number(process.env.GAME_SERVER_TEST_PORT)||0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser=await isolatedChrome(t,'server-card-view');
    const errors=[];browser.socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)});
    await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});await browser.send('Network.setBlockedURLs',{urls:['https://*']});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:setup});
    for(const file of scripts)await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')+'\n//# sourceURL='+file});
    for(const real of reactBundle?[false,true]:[false])for(const layout of ['compact','card'])for(const locale of ['en','zh-cn','zh-tw','id']){
      const theme=locale==='zh-cn'?'light':'dark';const placeId=layout==='compact'?893973440:4623386862;
      const url='http://127.0.0.1:'+server.address().port+(locale==='id'?'/id':'')+'/games/'+placeId+'/Game?layout='+layout+'&locale='+locale+'&theme='+theme+(real?'&react=1':'');
      await browser.send('Page.navigate',{url});await waitForDocument(browser,'#rbx-public-running-games',url);
      await browser.waitFor('privateRequests.length===1');
      assert.equal(await browser.evaluate("document.querySelectorAll('[data-rc-server-view=private][data-rc-private-server-ready]').length"),2,'Both React cards are ready before the supplemental response');
      assert.equal(await browser.evaluate("document.querySelector('[data-private-server-id=\"111\"]').checkVisibility()"),true,'A lazy avatar does not delay the first paint');
      await browser.evaluate('completeDetails(0)');
      await browser.evaluate('lateAvatar=true;renderServers()');
      await browser.waitFor("document.querySelectorAll('[data-rc-server-view=private][data-rc-private-server-ready]').length===2");
      assert.equal(await browser.evaluate("document.querySelectorAll('[data-rc-server-view]').length"),2,'Only private servers use the custom renderer');
      assert.deepEqual(await browser.evaluate("['friends','public'].map(type=>document.querySelectorAll('#rbx-'+type+'-running-games .rbx-'+type+'-game-server-item > .card-item > .game-server-details').length)"),[1,12],'Public and friends cards retain their native structure');
      assert.equal(await browser.evaluate("document.querySelectorAll('[data-rc-server-section], #rbx-public-running-games .rc-server-view, #rbx-friends-running-games .rc-server-view').length"),0);
      await browser.waitFor("document.querySelector('#rbx-public-running-games .card-item')?.dataset.rcServerCountry==='MY'");
      assert.equal(await browser.evaluate("document.querySelector('#rbx-public-running-games .rc-server-country').checkVisibility()"),true,'Country is visible even when Join drops all metric props');
      assert.equal(await browser.evaluate("document.querySelector('#rbx-public-running-games .rc-server-latency').checkVisibility()"),true,'Latency is visible on the native public card');
      if(locale==='id'){
        assert.equal(await browser.evaluate("document.querySelector('#rbx-public-running-games .rc-server-latency').textContent"),'Latensi tinggi','Native v2 categories render without inventing milliseconds');
        await browser.waitFor('serverStatusRequests.length>0');await browser.evaluate('completePublicStatuses()');
        await browser.waitFor("document.querySelector('#rbx-public-running-games .card-item')?.dataset.rcServerPing==='185'");
      }
      assert.equal(await browser.evaluate("document.querySelectorAll('[data-rc-server-view=private] .rc-private-server-summary').length"),2,'Only one summary per private server');
      assert.equal(await browser.evaluate("document.querySelector('.native-friend').checkVisibility()"),true);
      assert.equal(await browser.evaluate("document.querySelector('#rbx-friends-running-games .rc-server-metrics')"),null,'Friends cards retain their previous presentation');
      await browser.click('#rbx-friends-running-games .game-server-join-btn');assert.equal(await browser.evaluate('actions.at(-1)'), 'friends:22222222-2222-2222-2222-222222222222');
      if(layout==='compact'){
        await browser.click('#create-row button');assert.equal(await browser.evaluate('actions.at(-1)'),'create');
        await browser.click('#plus-banner button');assert.equal(await browser.evaluate('actions.at(-1)'),'subscribe');
        await browser.click('[data-private-server-id="111"] .rc-server-view-actions button');assert.equal(await browser.evaluate('actions.at(-1)'),'compact:0');
      }else{
        await browser.click('[data-private-server-id="111"] .native-menu');await browser.waitFor("!!document.querySelector('.native-menu-panel')");
        assert.equal(await browser.evaluate("document.querySelector('.native-menu-panel').checkVisibility()"),true);
        await browser.click('[data-private-server-id="112"] .native-renew');assert.equal(await browser.evaluate('actions.at(-1)'),'renew');
        if(real)assert.equal(await browser.evaluate("document.querySelector('.native-renew').textContent"),'Renew 1','Native subscription state survives the renderer');
      }
      await browser.waitFor("!!document.querySelector('[data-rc-server-filter=minPlayers]')");
      await browser.evaluate("const input=document.querySelector('[data-rc-server-filter=minPlayers]');input.value='9';input.dispatchEvent(new Event('input',{bubbles:true}))");
      await browser.waitFor("[...document.querySelectorAll('#rbx-public-running-games .card-item')].filter(n=>n.checkVisibility()).length===3");
      assert.equal(await browser.evaluate("document.querySelector('#rbx-friends-running-games .card-item').checkVisibility()"),true,'Public filters never hide friends');
      await browser.click('.rc-public-server-filter-reset');await browser.waitFor("[...document.querySelectorAll('#rbx-public-running-games .card-item')].filter(n=>n.checkVisibility()).length===8");
      assert.equal(await browser.evaluate("document.querySelector('#rbx-public-running-games .card-item[data-rc-playing=\"2\"] .game-server-join-btn').disabled"),true);
      await browser.click('.rc-public-server-next');await browser.waitFor("[...document.querySelectorAll('#rbx-public-running-games .card-item')].filter(n=>n.checkVisibility()).length===4");
      await browser.waitFor("document.querySelector('#rbx-public-running-games .card-item[data-rc-instance-id$=\"000000000011\"]')?.dataset.rcServerCountryState==='unknown'");
      assert.equal(await browser.evaluate("document.querySelector('#rbx-public-running-games .card-item[data-rc-instance-id$=\"000000000011\"] .rc-server-country').checkVisibility()"),true,'Failed country detection remains visible as unknown');
      if(locale==='id'){
        assert.equal(await browser.evaluate("document.querySelector('#rbx-public-running-games .card-item[data-rc-instance-id$=\"000000000011\"] .rc-server-country').textContent"),'Negara tidak diketahui');
        assert.equal(await browser.evaluate("document.querySelector('#rbx-public-running-games .card-item[data-rc-instance-id$=\"000000000011\"] .rc-server-latency').textContent"),'Latensi tidak tersedia');
      }
      await browser.click('.rc-public-server-next');await browser.waitFor('servers.public.length>12');
      assert.equal(await browser.evaluate("actions.includes('load-more')"),true,'Pagination uses the native next-page action');
      await browser.waitFor("document.querySelector('.rc-public-server-next')?.disabled===false");
      await browser.click('#rbx-public-running-games .native-refresh');await pause(600);
      assert.equal(await browser.evaluate("document.querySelectorAll('.rc-public-server-filters').length"),1);
      await browser.evaluate("servers.private[0]={...servers.private[0],name:'Changed server',currentPlayersCount:2,gameServerStatus:count(2),playerCountStatus:count(2)};renderServers()");
      await browser.waitFor('privateRequests.length===2');await browser.evaluate('completeDetails(1)');
      await browser.waitFor("document.querySelector('[data-private-server-id=\"111\"] .rc-private-server-title')?.textContent==='Changed server'");
      for(const width of [1280,320]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
        assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,layout+'/'+locale+'/'+width+'/'+real);
        if(process.env.SERVER_VIEW_SCREENSHOTS&&locale!=='zh-tw'&&layout==='compact'){
          fs.mkdirSync(process.env.SERVER_VIEW_SCREENSHOTS,{recursive:true});await browser.evaluate("document.querySelector('[data-rc-server-view=private]').scrollIntoView({block:'start'})");
          const shot=await browser.send('Page.captureScreenshot');fs.writeFileSync(path.join(process.env.SERVER_VIEW_SCREENSHOTS,(real?'react-':'fixture-')+theme+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
        }
      }
      await browser.evaluate("window.emptyOwner={...servers.private[0],vipServerId:999,name:'Owner unavailable',owner:{id:null,name:''},thumbnailTargetId:null};servers.private=[];servers.friends=[];servers.public=[];renderServers()");
      await browser.waitFor("document.querySelectorAll('[data-rc-server-view]').length===0");
      await pause(600);
      assert.equal(await browser.evaluate("[...document.querySelectorAll('.no-servers-message')].every(node=>node.checkVisibility())"),true);
      if(layout==='compact'){
        assert.equal(await browser.evaluate("document.querySelector('#create-row').checkVisibility()&&document.querySelector('#plus-banner').checkVisibility()"),true,'Empty private lists retain Create and Plus');
        await browser.evaluate('servers.private=[emptyOwner];renderServers()');
        await browser.waitFor('privateRequests.length===3');await browser.evaluate('completeDetails(2)');
        await browser.waitFor("document.querySelector('[data-private-server-id=\"999\"]')?.hasAttribute('data-rc-private-server-ready')");
        assert.equal(await browser.evaluate("document.querySelector('[data-private-server-id=\"999\"]').checkVisibility()"),true,'An intentional missing-owner placeholder cannot stall rendering');
      }
    }
    assert.deepEqual(errors,[]);
  });
