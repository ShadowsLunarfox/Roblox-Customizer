const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument, pause } = require('./helpers/chrome.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const scripts = manifest.content_scripts.flatMap(entry => entry.js || []);
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const setup = `
  window.privateRequests=[];
  window.chrome={storage:{local:{async get(){return {customBackground:{source:'none',hideXFeed:true,hideYouTubeFeed:true}}},async set(){}},onChanged:{addListener(){}}},
    runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
      if(message.type==='rc-private-server-details'){privateRequests.push({message,callback});return}
      setTimeout(()=>callback(message.type==='rc-pinned-games'?{ok:true,games:[],folders:[]}
        :message.type==='rc-currency-rates'?{ok:true,date:'2026-10-11',rates:{USD:1}}:{error:'Unused fixture data'}),10);
    }}};
`;

function html(url) {
  const locale = url.searchParams.get('locale') || 'en';
  const join = locale === 'en' ? 'Join' : '加入';
  const count = locale === 'en' ? '0 of 5 people max' : locale === 'zh-cn' ? '0/5 名玩家' : '0/5 位玩家';
  // The compact row's props and host tree follow cO in Roblox's public
  // b56a0d79...-ServerList.js, fetched 2026-10-11. No legacy classes/container IDs,
  // placeId, serverListType, gameServerStatus, or owner-only Configure are needed.
  return `<!doctype html><html lang="${locale}" class="${url.searchParams.get('theme')}-theme"><head><meta charset="utf-8">
    <style>*{box-sizing:border-box}body{margin:16px;font:16px Arial;background:#24252c;color:white}.light-theme body{background:#eee;color:#202227}#game-detail-page{max-width:1000px;margin:auto}.flex{display:flex}.flex-col{flex-direction:column}.items-center{align-items:center}.justify-between{justify-content:space-between}.width-full{width:100%}.min-width-0{min-width:0}.grow-0{flex-grow:0}.shrink-0{flex-shrink:0}.gap-medium{gap:12px}.gap-small{gap:8px}.padding-y-medium{padding-top:12px;padding-bottom:12px}.thumbnail img{width:40px;height:40px;border-radius:50%}button{padding:8px;font:inherit}.text-truncate-end{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}@media(min-width:1024px){.large\\:width-\\[200px\\]{width:200px}}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
    <main id="game-detail-page" data-place-id="893973440"><h1>Flee the Facility</h1><section id="game-instances"><h2>Servers</h2>
      <div class="flex flex-col gap-medium width-full"><h3>Your private servers</h3><p>Play in your own space, solo or with people you invite</p>
        <div id="compact-list" class="flex flex-col width-full">
          <div id="plus-banner"><span>Get free servers with Plus</span><button onclick="actions.push('subscribe')">Subscribe</button></div>
          <div id="create-row" class="flex items-center justify-between padding-y-medium width-full"><div><span class="text-title-medium">Create a private server</span><span class="text-body-medium">Limited to 1 server</span></div><div><button onclick="actions.push('create')">Create</button></div></div>
          <div id="native-load-more"><button onclick="addServer()">${locale === 'en' ? 'Load More' : '載入更多'}</button></div>
        </div>
      </div><section id="rbx-public-running-games"><div id="public-card" class="card-item">Native public card</div></section>
    </section></main><script>
      window.actions=[];window.nativeNodes={};
      window.React={cloneElement:(node,props)=>({...node,props:{...node.props,...props}})};
      window.ReactJSX={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
      const h=(...args)=>ReactJSX.jsxs(...args);
      const Thumbnail=props=>h('span',{className:'thumbnail radius-circle clip',children:h('img',{src:props.targetId===500?null:'/owner-'+props.targetId+'.svg'})});
      const Button=props=>h('button',{className:props.className,disabled:props.isDisabled,onClick:props.onClick,children:props.children});
      function CompactRow(e){return h('div',{className:'flex items-center justify-between padding-y-medium width-full',children:[
        h('div',{className:'flex items-center gap-medium min-width-0',children:[
          h('div',{className:'grow-0 shrink-0 basis-auto relative height-[40px] width-[40px]',children:h('div',{className:'width-[40px] height-[40px]',children:h(Thumbnail,{targetId:e.thumbnailTargetId,type:e.thumbnailType})})}),
          h('div',{className:'flex flex-col min-width-0',children:[h('span',{className:'text-title-medium content-emphasis text-truncate-end',children:e.name}),h('span',{className:'text-body-medium content-muted',children:e.playerCountStatus})]})]}),
        h('div',{className:'flex items-center gap-small grow-0 shrink-0 basis-auto',children:[
          e.showEditIcon&&e.isOwner&&h('a',{href:'/private-server/configure/'+e.vipServerId,'aria-label':'Configure',children:'Edit'}),
          h('div',{className:'[min-width:63px] large:width-[200px]',children:h(Button,{className:'width-full',onClick:e.onJoinClick,isDisabled:e.isJoinDisabled,children:e.joinLabel})})]})]})}
      function mount(node){
        if(node==null||node===false)return document.createTextNode('');
        if(Array.isArray(node)){const fragment=document.createDocumentFragment();node.forEach(child=>fragment.append(mount(child)));return fragment}
        if(typeof node!=='object')return document.createTextNode(String(node));
        if(typeof node.type==='function')return mount(node.type(node.props));
        const element=document.createElement(node.type);
        for(const [key,value] of Object.entries(node.props||{})){
          if(key==='children'||value==null)continue;
          if(key==='onClick')element.addEventListener('click',value);
          else if(key==='disabled')element.disabled=value;
          else element.setAttribute(key==='className'?'class':key,String(value));
        }
        element.append(mount(node.props.children));return element;
      }
      window.serverProps=Array.from({length:7},(_,i)=>({name:i<2?'相同的服务器':'Server '+(111+i),playerCountStatus:${JSON.stringify(count)},
        thumbnailTargetId:500+i,thumbnailType:'AvatarHeadshot',onJoinClick:()=>actions.push(111+i),isJoinDisabled:i===2,
        vipServerId:111+i,universeId:372226183,isOwner:i===1,showEditIcon:true,joinLabel:${JSON.stringify(join)},buttonVariant:'SoftEmphasis',isWebview:false}));
      window.insertServer=props=>{const row=mount(h(CompactRow,props));nativeNodes[props.vipServerId]={row,join:row.querySelector('button')};document.querySelector('#native-load-more').before(row);return row};
      serverProps.forEach(insertServer);
      window.addServer=()=>{const props={...serverProps[1],vipServerId:118,name:'Last server',onJoinClick:()=>actions.push(118)};serverProps.push(props);insertServer(props)};
      window.completeDetails=index=>privateRequests[index].callback({servers:serverProps.map(props=>({id:props.vipServerId,name:props.name,ownerName:'Owner '+props.vipServerId,playing:0,maxPlayers:5,playerImages:[],ping:80,countryCode:'MY'})),uniqueNames:[]});
      window.refreshServer=()=>{const previous=nativeNodes[112].row;serverProps[1]={...serverProps[1],name:'Updated server',playerCountStatus:'2 of 5 people max'};const next=insertServer(serverProps[1]);previous.replaceWith(next)};
    </script></body></html>`;
}

test('compact private rows restore cards while keeping Create, Plus, pagination and native Join',
  {skip:!process.env.CHROME_BIN,timeout:60000},async t=>{
    const files=new Set([...scripts,...styles]);
    const server=http.createServer((request,response)=>{
      response.setHeader('Cache-Control','no-store');const url=new URL(request.url,'http://localhost');const file=url.pathname.slice(1);
      if(files.has(file)){response.setHeader('Content-Type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(path.join(workspace,file)))}
      else if(file.endsWith('.svg')){response.setHeader('Content-Type','image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#6575a0"/></svg>')}
      else{response.setHeader('Content-Type','text/html; charset=utf-8');response.end(html(url))}
    });
    await new Promise(resolve=>server.listen(Number(process.env.GAME_SERVER_TEST_PORT)||0,'127.0.0.1',resolve));
    t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
    const browser=await isolatedChrome(t,'private-server-compact');
    await browser.send('Emulation.setFocusEmulationEnabled',{enabled:true});
    await browser.send('Network.setBlockedURLs',{urls:['https://*']});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:setup});
    for(const file of scripts)await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:fs.readFileSync(path.join(workspace,file),'utf8')+'\n//# sourceURL='+file});
    for(const locale of ['en','zh-cn','zh-tw'])for(const theme of ['dark','light']){
      const url='http://127.0.0.1:'+server.address().port+'/games/893973440/Flee-the-Facility?locale='+locale+'&theme='+theme;
      await browser.send('Page.navigate',{url});await waitForDocument(browser,'#compact-list',url);
      await browser.waitFor('privateRequests.length===1');
      assert.deepEqual(await browser.evaluate('privateRequests[0].message.serverIds'),[111,112,113,114,115,116,117]);
      assert.deepEqual(await browser.evaluate('privateRequests[0].message.serverNames'),[],'Duplicate names resolve by VIP ID');
      assert.equal(await browser.evaluate("document.querySelectorAll('.rc-private-server-summary').length"),0);
      await browser.evaluate('completeDetails(0)');
      await browser.waitFor("document.querySelectorAll('[data-rc-private-server-ready]').length===6");
      assert.equal(await browser.evaluate("nativeNodes[111].row.checkVisibility()"),false,'Wait for the owner image');
      assert.equal(await browser.evaluate("document.querySelector('#create-row').checkVisibility()&&document.querySelector('#plus-banner').checkVisibility()"),true);
      await browser.evaluate("nativeNodes[111].row.querySelector('img').src='/owner-500.svg'");
      await browser.waitFor('privateRequests.length===2');await browser.evaluate('completeDetails(1)');
      await browser.waitFor("document.querySelectorAll('.rc-private-server-card').length===7&&[...document.querySelectorAll('.rc-private-server-card')].filter(node=>node.checkVisibility()).length===5");
      assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.rc-private-server-owner')].slice(0,2).map(node=>node.textContent)"),['Owner 111','Owner 112']);
      assert.equal(await browser.evaluate("document.querySelector('#create-row').hasAttribute('data-rc-private-server-pending')"),false);
      assert.equal(await browser.evaluate("document.querySelector('.rc-private-server-summary .rc-server-latency').textContent.includes('80')"),true);
      await browser.click('.rc-private-server-more button');
      await browser.waitFor("[...document.querySelectorAll('.rc-private-server-card')].filter(node=>node.checkVisibility()).length===7");
      assert.equal(await browser.evaluate("nativeNodes[111].join===nativeNodes[111].row.querySelector('.rc-private-server-actions button')"),true);
      await browser.click('[data-private-server-id="111"] .rc-private-server-actions button');
      assert.equal(await browser.evaluate('actions.at(-1)'),111);
      assert.equal(await browser.evaluate('nativeNodes[113].join.disabled'),true);
      assert.equal(await browser.evaluate("nativeNodes[112].row.querySelector('a[href]').checkVisibility()"),true);
      await browser.click('#create-row button');assert.equal(await browser.evaluate('actions.at(-1)'),'create');
      await browser.click('#plus-banner button');assert.equal(await browser.evaluate('actions.at(-1)'),'subscribe');
      assert.equal(await browser.evaluate("document.querySelector('#native-load-more button').checkVisibility()"),true);
      await browser.click('#native-load-more button');
      await browser.waitFor('privateRequests.length===3');await browser.evaluate('completeDetails(2)');
      await browser.waitFor("document.querySelectorAll('.rc-private-server-card').length===8");
      await browser.evaluate('refreshServer()');await browser.waitFor('privateRequests.length===4');await browser.evaluate('completeDetails(3)');
      await browser.waitFor("nativeNodes[112].row.querySelector('.rc-private-server-title')?.textContent==='Updated server'");
      await pause(600);
      assert.equal(await browser.evaluate("document.querySelectorAll('.rc-private-server-summary').length"),8);
      assert.equal(await browser.evaluate("document.querySelector('#public-card').checkVisibility()"),true);
      for(const width of [1280,320]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
        assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,locale+'/'+theme+'/'+width);
        if(process.env.PRIVATE_SERVER_COMPACT_SCREENSHOTS&&locale==='en'){
          fs.mkdirSync(process.env.PRIVATE_SERVER_COMPACT_SCREENSHOTS,{recursive:true});
          await browser.evaluate("nativeNodes[111].row.scrollIntoView({block:'start'})");
          const shot=await browser.send('Page.captureScreenshot');fs.writeFileSync(path.join(process.env.PRIVATE_SERVER_COMPACT_SCREENSHOTS,theme+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
        }
      }
      await browser.evaluate("document.querySelectorAll('[data-rc-private-server-compact]').forEach(row=>row.remove())");
      await pause(600);
      assert.equal(await browser.evaluate("document.querySelector('#create-row').checkVisibility()&&!document.querySelector('#create-row').hasAttribute('data-rc-private-server-pending')"),true,'An empty refresh cannot hide or convert Create');
      assert.equal(await browser.evaluate("document.querySelector('.rc-private-server-more')===null&&document.querySelector('.rc-private-server-loading')===null"),true);
      await browser.click('#native-load-more button');
      await browser.waitFor('privateRequests.length===5');await browser.evaluate('completeDetails(4)');
      await browser.waitFor("document.querySelector('[data-private-server-id=\"118\"] .rc-private-server-summary')!==null");
      assert.equal(await browser.evaluate("document.querySelector('#create-row').checkVisibility()&&document.querySelector('#plus-banner').checkVisibility()"),true);
    }
    assert.deepEqual(browser.errors,[]);
  });
