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
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><circle cx="40" cy="40" r="40" fill="#6575a0"/></svg>';
const setup = `
  window.privateRequests=[];
  window.chrome={storage:{local:{async get(){return {customBackground:{source:'none',hideXFeed:true,hideYouTubeFeed:true}}},async set(){}},onChanged:{addListener(){}}},
    runtime:{lastError:null,getURL:file=>'/'+file,sendMessage(message,callback){
      if(message.type==='rc-private-server-details'){privateRequests.push({message,callback});return}
      setTimeout(()=>callback(message.type==='rc-pinned-games'?{ok:true,games:[],folders:[]}
        :message.type==='rc-currency-rates'?{ok:true,date:'2026-10-11',rates:{USD:1}}:{error:'No optional fixture data'}),10);
    }}};
`;

function html(url) {
  const locale = url.searchParams.get('locale') || 'en';
  return `<!doctype html><html lang="${locale}" class="${url.searchParams.get('theme') || 'dark'}-theme"><head><meta charset="utf-8">
    <style>*{box-sizing:border-box}body{margin:16px;font:16px Arial;background:#24252c;color:white}.light-theme body{background:#eee;color:#202227}#game-detail-page{max-width:1000px;margin:auto}.card-list{padding:0;list-style:none}.rbx-private-game-server-item{float:left;width:25%}.card-item{padding:12px;background:#555}.owner-avatar img{width:56px;height:56px}.player-avatar img{width:48px;height:48px}button{padding:8px;font:inherit}.native-menu-panel{background:#45495a;padding:12px}.native-menu-panel a{color:inherit}</style>
    ${styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}</head><body>
    <main id="game-detail-page" data-place-id="893973440"><h1>Flee the Facility</h1><section id="game-instances">
      <section id="rbx-private-running-games"><h2>Private Servers</h2><button id="native-refresh">Refresh</button>
        <ul id="rbx-private-game-server-item-container" class="card-list"></ul></section>
      <section id="rbx-public-running-games"><h2>Other Servers</h2><div class="card-item" id="public-card">Native public card</div></section>
    </section></main><script>
      window.actions=[];window.nativeNodes={};window.ownerAvatarReady=false;
      window.React={createElement:(type,props,...children)=>({type,props:{...props,...(children.length?{children:children.length===1?children[0]:children}:{})}}),cloneElement:(node,props)=>({...node,props:{...node.props,...props}})};
      window.ReactJSX={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
      const h=(...args)=>React.createElement(...args);
      const Button=props=>h('button',{className:props.className,disabled:props.isDisabled,onClick:props.onClick},props.children);
      function Owner(props){return h('div',{className:'rbx-private-owner'},
        h('a',{className:'avatar owner-avatar',href:'/users/'+props.ownerUserId+'/profile'},h('span',{className:'thumbnail-2d-container'},h('img',{src:${JSON.stringify(locale === 'en' && (url.searchParams.get('theme') || 'dark') === 'dark')}&&!ownerAvatarReady&&props.ownerUserId===500?null:'/owner-'+props.ownerUserId+'.svg'}))),
        h('a',{className:'text-name',href:'/users/'+props.ownerUserId+'/profile'},props.ownerName))}
      function Menu(props){return h('button',{className:'native-menu',onClick:event=>{
        actions.push({name:'menu',id:props.vipServerId});
        const panel=document.createElement('div');panel.className='native-menu-panel';
        const configure=document.createElement('a');configure.href='/private-server/configure/'+props.vipServerId;configure.textContent='Configure';panel.append(configure);
        event.target.parentElement.append(panel);
      }},'⋯')}
      function Subscription(props){return props.expired?h('button',{className:'native-renew',onClick:()=>actions.push({name:'renew',id:props.vipServerId})},'Renew'):null}
      function Card(props){return h('li',{className:'rbx-private-game-server-item col-md-3 col-sm-4 col-xs-6'},
        h('div',{className:'card-item card-item-private-server'},
          h('div',{className:'player-thumbnails-container'},h('a',{className:'player-avatar'},h('span',{className:'thumbnail-2d-container'},h('img',{src:'/player.svg'})))),
          h('div',{className:'rbx-private-game-server-details game-server-details border-right'},
            h('div',{className:'section-header'},h('span',{className:'font-bold'},props.name),h(Menu,props)),
            h(Owner,{ownerUserId:props.owner.id,ownerName:props.owner.displayName}),
            h('div',{className:'text-info rbx-game-status rbx-private-game-server-status text-overflow'},props.gameServerStatus),
            h(Subscription,props),
            !props.expired&&h('span',{'data-placeid':props.placeId},h(Button,{className:'game-server-join-btn',isDisabled:props.isLoading,
              onClick:()=>actions.push({name:'join',id:props.vipServerId})},${JSON.stringify(locale === 'en' ? 'Join' : '加入')}))))) }
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
      window.serverProps=Array.from({length:7},(_,index)=>({placeId:893973440,vipServerId:111+index,serverListType:'private',id:null,
        name:index<2?'Same server name':'Server '+(111+index),owner:{id:500+index,displayName:'Owner '+(111+index)},
        gameServerStatus:index+' of 12 people max',currentPlayersCount:index,maxPlayers:12,isLoading:index===2,expired:index===3}));
      window.renderCard=props=>{
        const row=mount(ReactJSX.jsx(Card,props));nativeNodes[props.vipServerId]={row,join:row.querySelector('.game-server-join-btn'),menu:row.querySelector('.native-menu')};return row;
      };
      const list=document.getElementById('rbx-private-game-server-item-container');list.append(...serverProps.map(renderCard));
      window.completeDetails=index=>privateRequests[index].callback({servers:serverProps.map(props=>({id:props.vipServerId,name:props.name,ownerName:props.owner.displayName,
        playing:props.currentPlayersCount,maxPlayers:12,ping:80,countryCode:'MY',playerImages:[]})),uniqueNames:[]});
      document.getElementById('native-refresh').onclick=()=>{
        actions.push({name:'refresh'});serverProps[0]={...serverProps[0],name:'Updated server',currentPlayersCount:4,gameServerStatus:'4 of 12 people max'};
        list.firstElementChild.replaceWith(renderCard(serverProps[0]));
      };
      window.fixtureReady=true;
    </script></body></html>`;
}

test('Flee native private cards receive the previous layout with IDs, native menus, inactive servers and Show More',
  { skip: !process.env.CHROME_BIN, timeout: 60000 }, async t => {
    const files = new Set([...styles, ...scripts, 'icons/icon-48.png']);
    const server = http.createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      const url = new URL(request.url, 'http://localhost');
      const file = url.pathname.slice(1);
      if (files.has(file)) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
        response.end(fs.readFileSync(path.join(workspace, file)));
      } else if (file.endsWith('.svg')) {
        response.setHeader('Content-Type', 'image/svg+xml'); response.end(svg);
      } else { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end(html(url)); }
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_SERVER_TEST_PORT) || 0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'private-server-modern');
    const scriptErrors=[];
    browser.socket.addEventListener('message',event=>{
      const message=JSON.parse(event.data);
      if(message.method==='Runtime.exceptionThrown')scriptErrors.push(message.params.exceptionDetails.exception?.description||JSON.stringify(message.params.exceptionDetails));
    });
    await browser.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await browser.send('Network.setBlockedURLs', { urls: ['https://*'] });
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: setup });
    for (const file of scripts) await browser.send('Page.addScriptToEvaluateOnNewDocument', {
      source: fs.readFileSync(path.join(workspace, file), 'utf8') + '\n//# sourceURL=' + file
    });
    for (const locale of ['en', 'zh-cn', 'zh-tw']) for (const theme of ['dark', 'light']) {
      const url = `http://127.0.0.1:${server.address().port}/games/893973440/Flee-the-Facility?locale=${locale}&theme=${theme}`;
      await browser.send('Page.navigate', { url });
      await waitForDocument(browser, '#rbx-private-game-server-item-container', url);
      await browser.waitFor('privateRequests.length===1');
      assert.deepEqual(await browser.evaluate('privateRequests[0].message.serverIds'), [111,112,113,114,115,116,117]);
      assert.deepEqual(await browser.evaluate('privateRequests[0].message.serverNames'), []);
      assert.equal(await browser.evaluate("document.querySelector('.rc-private-server-summary')===null"), true);
      await browser.evaluate('completeDetails(0)');
      if(locale==='en'&&theme==='dark') {
        await browser.waitFor("document.querySelectorAll('.rc-private-server-modern-card[data-rc-private-server-ready]').length===6");
        assert.equal(await browser.evaluate("document.querySelector('[data-private-server-id=\"111\"] .rc-private-server-avatar')===null"), true, 'A loading owner avatar cannot be replaced with a player photo');
        await browser.evaluate("ownerAvatarReady=true;nativeNodes[111].row.querySelector('.owner-avatar img').src='/owner-500.svg'");
        await browser.waitFor('privateRequests.length===2');
        await browser.evaluate('completeDetails(1)');
      }
      await browser.waitFor("document.querySelectorAll('.rc-private-server-modern-card[data-rc-private-server-ready]').length===7");
      await browser.waitFor("[...document.querySelectorAll('.rc-private-server-card')].filter(node=>node.checkVisibility()).length===5");
      assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.rc-private-server-owner')].slice(0,2).map(node=>node.textContent)"), ['Owner 111','Owner 112']);
      assert.equal(await browser.evaluate("new URL(document.querySelector('.rc-private-server-avatar').src).pathname"), '/owner-500.svg', 'Owner avatar comes from owner, not first player thumbnail');
      assert.equal(await browser.evaluate("document.querySelector('.rc-private-server-summary .rc-server-latency').textContent.includes('80')"), true);
      assert.equal(await browser.evaluate("[...document.querySelectorAll('.rc-private-server-card')].filter(node=>node.checkVisibility()).length"), 5);
      await browser.click('.rc-private-server-more button');
      await browser.waitFor("[...document.querySelectorAll('.rc-private-server-card')].filter(node=>node.checkVisibility()).length===7");
      assert.equal(await browser.evaluate("document.querySelector('[data-private-server-id=\"111\"] .game-server-join-btn')===nativeNodes[111].join"), true);
      await browser.click('[data-private-server-id="111"] .game-server-join-btn');
      assert.deepEqual(await browser.evaluate('actions.at(-1)'), {name:'join',id:111});
      await browser.click('[data-private-server-id="111"] .native-menu');
      await pause(600);
      assert.equal(await browser.evaluate("document.querySelector('.native-menu-panel a').checkVisibility()"), true, 'Native configuration remains visible after opening');
      assert.equal(await browser.evaluate("document.querySelectorAll('.rc-private-server-summary').length"), 7, 'Opening Configure cannot identify a dropdown as another server row');
      assert.equal(await browser.evaluate("nativeNodes[113].join.disabled"), true);
      assert.equal(await browser.evaluate("nativeNodes[114].join===null"), true);
      await browser.click('[data-private-server-id="114"] .native-renew');
      assert.deepEqual(await browser.evaluate('actions.at(-1)'), {name:'renew',id:114});
      for (const width of [1280,320]) {
        await browser.send('Emulation.setDeviceMetricsOverride', {width,height:1000,deviceScaleFactor:1,mobile:false});
        assert.equal(await browser.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), true, `${locale}/${theme}/${width}`);
        if (process.env.PRIVATE_SERVER_MODERN_SCREENSHOTS && locale === 'en') {
          await browser.evaluate("document.querySelector('.rc-private-server-card').scrollIntoView({block:'start'})");
          fs.mkdirSync(process.env.PRIVATE_SERVER_MODERN_SCREENSHOTS, {recursive:true});
          const shot=await browser.send('Page.captureScreenshot');
          fs.writeFileSync(path.join(process.env.PRIVATE_SERVER_MODERN_SCREENSHOTS, `private-${theme}-${width}.png`), Buffer.from(shot.data,'base64'));
        }
      }
      await browser.click('#native-refresh');
      await browser.waitFor('privateRequests.length==='+ (locale==='en'&&theme==='dark'?3:2));
      await browser.evaluate('completeDetails(privateRequests.length-1)');
      await browser.waitFor("document.querySelector('.rc-private-server-title').textContent==='Updated server'");
      assert.equal(await browser.evaluate("document.querySelectorAll('.rc-private-server-summary').length"), 7);
      assert.equal(await browser.evaluate("document.querySelector('#public-card').checkVisibility()"), true, 'Public cards remain native');
    }
    assert.deepEqual(scriptErrors, []);
  });
