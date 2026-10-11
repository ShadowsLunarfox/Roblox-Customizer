const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const workspace = path.resolve(__dirname, '..');
function environment(pathname='/games/893973440/Flee-the-Facility') {
  const window={};
  const context=vm.createContext({window,location:{pathname},document:{addEventListener(){}},URL,setTimeout,clearTimeout,console});
  for(const file of ['src/shared/server-card-view.js','src/shared/page-bridge.js'])vm.runInContext(fs.readFileSync(path.join(workspace,file),'utf8'),context);
  window.React={createElement:(type,props,...children)=>({type,props:{...props,...(children.length?{children:children.length===1?children[0]:children}:{})}}),cloneElement:(node,props)=>({...node,props:{...node.props,...props}})};
  window.ReactJSX={jsx:(type,props)=>({type,props})};
  return {window,h:window.React.createElement,render:window.RobloxCustomizerServerView.render};
}
const propsFor=type=>({placeId:893973440,id:'12345678-1234-1234-1234-123456789012',serverListType:type,
  vipServerId:type==='private'?111:0,name:type==='private'?'Owner server':'',owner:{id:500,name:'Owner'},
  currentPlayersCount:3,maxPlayers:5,gameServerStatus:'3 of 5 people max',ping:80,
  players:[{id:600,playerToken:'player-token'}],accessCode:'secret-access-code'});
function nativeCard(h,type) {
  const onClick=()=>type;
  const join=h(function Button(){},{className:'game-server-join-btn',onClick,isDisabled:true});
  const menu=h(function Menu(){},{onClick,subscription:{active:false}});
  const renew=h(function Renew(){},{onClick});
  const owner=h(function Owner(){},{ownerUserId:500,ownerName:'Owner'});
  const roster=h('div',{className:'player-thumbnails-container'},h(function Thumbnail(){},{playerToken:'player-token'}));
  const warning=h('div',{className:'native-warning'},'Permission required');
  const card=h('li',{className:'rbx-'+type+'-game-server-item col-md-3',ref:{current:null}},
    h('div',{className:'card-item'},roster,h('div',{className:'game-server-details'},
      h('div',{className:'section-header'},h('span',{className:'font-bold'},'Native name'),menu),
      type==='private'&&owner,h('div',{className:'rbx-game-status'},'3 of 5 people max'),warning,renew,join)));
  return {card,join,menu,renew,owner,roster,warning};
}
function nodes(value) {
  if(Array.isArray(value))return value.flatMap(nodes);
  if(!value||typeof value!=='object')return [];
  return [value,...nodes(value.props?.children)];
}
test('private-server rendering retains native callbacks, warnings, refs and subscriptions',()=>{
  const {h,render}=environment();
  const native=nativeCard(h,'private');const result=render(native.card,propsFor('private'));const tree=nodes(result);
  assert.equal(result.props['data-rc-server-view'],'private');
  assert.strictEqual(result.props.ref,native.card.props.ref);
  for(const node of [native.join,native.menu,native.renew,native.warning])assert.ok(tree.includes(node));
  assert.equal(native.join.props.onClick(),'private');
  assert.equal(native.join.props.isDisabled,true);
  assert.equal(tree.filter(node=>node.props?.className==='rc-server-view-body').length,1);
  assert.equal(JSON.stringify(result).includes('secret-access-code'),false);
  assert.equal(result.props['data-rc-server-source'].includes('player-token'),false);
  assert.equal(result.props['data-rc-playing'],'3');
  assert.equal(result.props['data-rc-ping'],'80');
  assert.equal(result.props['data-private-server-id'],'111');
  assert.equal(result.props['data-rc-instance-id'],undefined);
});

test('public and friends cards bypass the private renderer without changing their presentation',()=>{
  const {h,render}=environment();
  for(const type of ['public','friends']){
    const {card}=nativeCard(h,type);
    assert.strictEqual(render(card,propsFor(type)),card);
    assert.strictEqual(render(card,{...propsFor(type),vipServerId:111,onJoinClick(){},playerCountStatus:'3 of 5 people max'}),card);
  }
});
test('compact private rows render directly without old classes or Configure links and retain their native actions',()=>{
  const {h,render}=environment();const avatar=h(function Thumbnail(){},{targetId:500});const action=h(function Join(){},{onClick:()=>42,isDisabled:true});
  const native=h('div',{className:'flex items-center justify-between padding-y-medium width-full'},
    h('div',{},h('div',{},avatar),h('div',{},'Server','0 of 5 people max')),h('div',{},action));
  const result=render(native,{name:'中文服务器',vipServerId:111,thumbnailTargetId:500,playerCountStatus:'0 of 5 people max',onJoinClick:()=>42});
  assert.equal(result.props['data-rc-server-view'],'private');
  assert.equal(result.props['data-rc-server-name'],'中文服务器');
  assert.ok(nodes(result).includes(action));assert.ok(nodes(result).includes(avatar));
  assert.equal(result.props['data-rc-server-avatar-placeholder'],undefined);
  const placeholder=render(native,{name:'Owner unavailable',vipServerId:111,thumbnailTargetId:null,playerCountStatus:'0 of 5 people max',onJoinClick:()=>42});
  assert.equal(placeholder.props['data-rc-server-avatar-placeholder'],'','An intentional native placeholder does not wait for an image');
});
test('bridge leaves public and friends presentation native while preserving existing list metrics',()=>{
  const {window,h}=environment();let customRenders=0;
  window.RobloxCustomizerServerView={render(){customRenders++;throw new Error('Private renderer must not run')}};
  for(const type of ['public','friends']){
    const native=nativeCard(h,type);
    function Card(){return native.card}
    function List(){return h('section',{className:'server-list-section'},h(Card,{...propsFor(type),playing:undefined,ping:undefined}))}
    const list=h(List,{type,headerTitle:'Servers',loadMoreGameInstances(){},gameInstances:[{id:propsFor(type).id,playing:12,ping:44}]});
    const section=list.type(list.props);assert.equal(section.props['data-rc-server-section'],undefined);
    const card=section.props.children;const result=card.type(card.props);const tree=nodes(result);
    assert.equal(result.props.className,native.card.props.className);
    assert.equal(result.props['data-rc-server-view'],undefined);
    assert.equal(result.props.children.props.className,'card-item');
    for(const node of [native.roster,native.menu,native.renew,native.warning])assert.ok(tree.includes(node));
    const join=tree.find(node=>node.props?.className==='game-server-join-btn');
    assert.equal(join.props['data-rc-playing'],12);assert.equal(join.props['data-rc-ping'],44);
    assert.strictEqual(join.props.onClick,native.join.props.onClick);
    assert.equal(join.props.isDisabled,true);
    const updated=window.ReactJSX.jsx(Card,{...propsFor(type),playing:1});
    const updatedJoin=nodes(updated.type(updated.props)).find(node=>node.props?.className==='game-server-join-btn');
    assert.equal(updatedJoin.props['data-rc-playing'],1);
  }
  assert.equal(customRenders,0);
});

test('bridge renders private cards and updates their presentation from current native props',()=>{
  const {window,h}=environment();const native=nativeCard(h,'private');
  function Card(){return native.card}
  const first=h(Card,propsFor('private'));
  assert.equal(first.type(first.props).props['data-rc-server-view'],'private');
  const updated=window.ReactJSX.jsx(Card,{...propsFor('private'),name:'Updated server',currentPlayersCount:1});
  const result=updated.type(updated.props);
  assert.equal(result.props['data-rc-server-name'],'Updated server');
  assert.equal(result.props['data-rc-playing'],'1');
});
test('direct rendering leaves unsupported routes, games, structures and server identities native',()=>{
  for(const pathname of ['/home','/games/893973440/Flee-the-Facility']){
    const {h,render}=environment(pathname);const {card}=nativeCard(h,'private');
    if(pathname==='/home')assert.strictEqual(render(card,propsFor('private')),card);
    for(const changes of [{placeId:999},{vipServerId:0},{vipServerId:'111'},{serverListType:'unknown'}])assert.strictEqual(render(card,{...propsFor('private'),...changes}),card);
    const publicCard=nativeCard(h,'public').card;
    assert.strictEqual(render(publicCard,propsFor('private')),publicCard);
    const unknown=h('section',{},'Unknown deployment');assert.strictEqual(render(unknown,propsFor('private')),unknown);
  }
});
