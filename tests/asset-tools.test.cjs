const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const C=require('../src/assets/asset-core.js');
const fixture=require('./fixtures/resource-model.cjs');
const uint=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const str=s=>Buffer.concat([uint(Buffer.byteLength(s)),Buffer.from(s)]);
const refs=values=>{let last=0;const list=values.map(n=>{const d=n-last;last=n;return ((d<<1)^(d>>31))>>>0;});return Buffer.from([24,16,8,0].flatMap(shift=>list.map(n=>(n>>>shift)&255)));};
const chunk=(kind,bytes)=>Buffer.concat([Buffer.from(kind),uint(0),uint(bytes.length),uint(0),bytes]);
const bounds={position:{X:{min:-.25,max:.25},Y:{min:-.25,max:.25},Z:{min:-.25,max:.25}},rotation:{X:{min:-30,max:30},Y:{min:-30,max:30},Z:{min:-30,max:30}},scale:{X:{min:.8,max:1.2},Y:{min:.8,max:1.2},Z:{min:.8,max:1.2}}};
const rules={accessoryRefinementTypes:[8],wearableAssetTypes:[{id:8,name:'Hat'}],accessoryRefinementLowerBounds:{Hat:{}},accessoryRefinementUpperBounds:{Hat:{}}};
for(const[group,axes]of Object.entries(bounds))for(const[axis,value]of Object.entries(axes)){rules.accessoryRefinementLowerBounds.Hat[group]||={};rules.accessoryRefinementUpperBounds.Hat[group]||={};rules.accessoryRefinementLowerBounds.Hat[group][axis.toLowerCase()+group]=value.min;rules.accessoryRefinementUpperBounds.Hat[group][axis.toLowerCase()+group]=value.max;}
const values={position:{X:.1,Y:0,Z:0},rotation:{X:0,Y:0,Z:0},scale:{X:1,Y:1,Z:1}};
test('RBXM explorer reconstructs real referent parents and literal names; malformed and oversized input is bounded',()=>{
  const header=Buffer.alloc(32);header.write('<roblox!');header.set([137,255,13,10,26,10],8);header.writeUInt32LE(1,16);header.writeUInt32LE(2,20);
  const file=Buffer.concat([header,chunk('INST',Buffer.concat([uint(0),str('Folder'),Buffer.from([0]),uint(2),refs([0,1])])),chunk('PROP',Buffer.concat([uint(0),str('Name'),Buffer.from([1]),str('Root'),str('<script>literal</script>')])),chunk('PRNT',Buffer.concat([Buffer.from([0]),uint(2),refs([0,1]),refs([-1,0])])),chunk('END\0',Buffer.from('</roblox>'))]);
  const model=C.inspect(file);assert.equal(model.nodes.length,1);assert.equal(model.nodes[0].name,'Root');assert.equal(model.nodes[0].children[0].name,'<script>literal</script>');
  assert.equal(model.extension,'rbxm');assert.throws(()=>C.inspect(file.subarray(0,60)),/resource/i);
  assert.throws(()=>C.inspect(new Uint8Array(C.MAX_BYTES+1)),/32 MB/);
  assert.deepEqual([...C.lz4(Uint8Array.from([0x40,65,66,67,68]),4)],[65,66,67,68]);
  assert.throws(()=>C.lz4(Uint8Array.from([0,0,0]),4));
  assert.equal(C.inspect(Buffer.from('{"parts":[{"Name":"Part"}]}')).nodes[0].children[0].className,'Array');
  assert.equal(C.inspect(Uint8Array.from([137,80,78,71,13,10,26,10])).mime,'image/png');
  const inst=(index,start)=>chunk('INST',Buffer.concat([uint(index),str('Folder'),Buffer.from([0]),uint(3000),refs(Array.from({length:3000},(_,i)=>start+i))]));
  assert.throws(()=>C.inspect(Buffer.concat([header,inst(0,0),inst(1,3000)])),/too many instances/,'A dishonest header cannot bypass the total instance bound');
});
test('full RGB colors and accessory limits reject invalid input instead of clamping it silently',()=>{
  assert.deepEqual(C.colors({headColor3:'aabbcc'}),{headColor3:'#AABBCC'});
  assert.throws(()=>C.colors({headColor3:'#abc'}));assert.throws(()=>C.colors({unknown:'#ffffff'}));
  assert.deepEqual(C.boundsFor(rules,8),bounds);assert.equal(C.boundsFor(rules,41),null);
  assert.deepEqual(C.refinement(values,bounds),values);
  assert.throws(()=>C.refinement({...values,position:{...values.position,X:1}},bounds));
});

test('Zstandard models expose nested instances, typed properties, shared source and reference targets without synthetic chunk nodes',()=>{
  const result=C.inspect(fixture.model()),root=result.nodes[0],handle=root.children.find(n=>n.name==='Handle'),decor=root.children.find(n=>n.name==='Decoration');
  assert.equal(result.partial,false);assert.deepEqual(result.warnings,[]);assert.equal(result.nodes.length,1);
  assert.equal(handle.children[0].className,'SpecialMesh');assert.equal(handle.children[0].propertyInfo.MeshId.value,'rbxassetid://1234');
  assert.deepEqual(handle.propertyInfo.Size.value,{X:2,Y:3,Z:4});assert.deepEqual(decor.propertyInfo.Size.value,{X:5,Y:6,Z:7});
  assert.equal(handle.propertyInfo.Transparency.value,.25);assert.equal(decor.propertyInfo.Transparency.value,.5);
  assert.equal(handle.propertyInfo.CustomInteger.value,-123);assert.equal(decor.propertyInfo.CustomInteger.value,456);
  assert.equal(handle.propertyInfo.CustomDouble.value,1.25);assert.equal(decor.propertyInfo.CustomDouble.value,-2.5);
  assert.deepEqual(handle.propertyInfo.CFrame.value,{Position:{X:1,Y:2,Z:3},Rotation:[1,0,0,0,1,0,0,0,1]});
  assert.equal(handle.propertyInfo.Color.value.R,51/255);
  assert.equal(root.children.find(n=>n.className==='Script').propertyInfo.Source.value,fixture.source);
  const ref=root.children.find(n=>n.className==='ObjectValue');assert.equal(ref.propertyInfo.Value.referent,handle.id);assert.equal(ref.properties.find(p=>p[0]==='Value')[1],'Handle');
  assert.doesNotThrow(()=>JSON.stringify(result),'Instance references remain acyclic');
  const partial=C.inspect(fixture.model({unknown:true}));assert.equal(partial.nodes.length,1);assert.equal(partial.partial,true);assert.equal(partial.nodes[0].propertyInfo.FutureProperty.unsupported,true);
});

test('Zstandard parsing rejects oversized windows, output size lies and concatenated frames before unbounded allocation',()=>{
  const reader=require('../src/assets/model-reader.js'),zlib=require('node:zlib');
  assert.throws(()=>reader.decompressZstd(Uint8Array.from([0x28,0xb5,0x2f,0xfd,0,0xf8,1,0,0]),10),/too large/);
  const data=zlib.zstdCompressSync(Buffer.from('small model'));
  assert.throws(()=>reader.decompressZstd(data,1),/resource/i);
  assert.throws(()=>reader.decompressZstd(Buffer.concat([data,data]),11),/resource/i);
});

test('large models load above the previous file and expansion limits while retaining the complete source',()=>{
  for(const [compression,size]of [['none',9*1024*1024],['zstd',25*1024*1024]]){
    const sourceText='-- Large read-only source\n'+'x'.repeat(size),file=fixture.model({compression,sourceText});
    if(compression==='none')assert.ok(file.length>8*1024*1024);
    const result=C.inspect(file),script=result.nodes[0].children.find(n=>n.className==='Script');
    assert.equal(result.partial,false);assert.equal(script.propertyInfo.Source.value,sourceText);
    assert.equal(script.properties.find(([name])=>name==='Source')[1].length,131072,'Large values retain a bounded display preview');
  }
  const header=Buffer.alloc(32);header.write('<roblox!');
  const advertised=Buffer.concat([header,Buffer.from('META'),uint(0),uint(128*1024*1024+1),uint(0)]);
  assert.throws(()=>C.inspect(advertised),/too large/,'The expanded binary limit still applies before allocation');
});
function worker(fetch){const context=vm.createContext({RobloxCustomizerAssetCore:C,URL,AbortController,setTimeout,clearTimeout,btoa,TextDecoder,Uint8Array,fetch,chrome:{runtime:{id:'ext',onMessage:{addListener(){}}}}});vm.runInContext(fs.readFileSync('src/shared/routes.js','utf8'),context);vm.runInContext(fs.readFileSync('src/background/asset-tools-background.js','utf8'),context);return context.RobloxCustomizerAssetToolsBackground;}
const sender={id:'ext',frameId:0,url:'https://www.roblox.com/my/avatar'};
test('avatar edits preserve other assets and metadata, recheck the account, and retry only a CSRF challenge',async()=>{
  const calls=[],colors=Object.fromEntries(C.colorKeys.map(k=>[k,'FFFFFF']));const assets=[{id:10,name:'Hat',assetType:{id:8},meta:{order:3,version:1,position:{X:0,Y:0,Z:0}}},{id:20,meta:{order:7,puffiness:.5}}];let challenge=true;
  const w=worker(async(url,options)=>{calls.push({url,options});if(url.includes('/authenticated'))return Response.json({id:123});if(url.endsWith('/avatar/avatar'))return Response.json({bodyColor3s:colors,assets});if(url.endsWith('/avatar-rules'))return Response.json(rules);
    if(challenge){challenge=false;return new Response('',{status:403,headers:{'x-csrf-token':'fixture-token'}});}return Response.json({success:true});});
  await w.handle({type:'rc-avatar-tools',action:'accessory',userId:123,assetId:10,values},sender);
  const posts=calls.filter(c=>c.options.method==='POST');assert.equal(posts.length,2);assert.equal(posts[1].options.headers['x-csrf-token'],'fixture-token');
  const sent=JSON.parse(posts[1].options.body).assets;assert.deepEqual(sent[1],{id:20,meta:assets[1].meta});assert.equal(sent[0].meta.order,3);assert.deepEqual(sent[0].meta.position,values.position);
  await w.handle({type:'rc-avatar-tools',action:'colors',userId:123,colors:{headColor3:'#123456'}},sender);
  const body=JSON.parse(calls.at(-1).options.body);assert.equal(body.headColor3,'123456');assert.equal(body.torsoColor3,'FFFFFF');
  const before=calls.filter(c=>c.options.method==='POST').length;
  await assert.rejects(w.handle({type:'rc-avatar-tools',action:'colors',userId:456,colors:{headColor3:'#ffffff'}},sender),/account changed/);
  assert.equal(calls.filter(c=>c.options.method==='POST').length,before);
});
test('resource access checks sender and item identity, rejects unsafe CDN hosts and never sends credentials to CDN',async()=>{
  const calls=[];const w=worker(async(url,options)=>{calls.push({url,options});return url.includes('assetdelivery')?Response.json({locations:[{location:'https://c1.rbxcdn.com/fixture'}]}):new Response('payload');});
  const assetSender={...sender,url:'https://www.roblox.com/ko/catalog/123/Item'};
  assert.equal(w.handle({type:'rc-asset-tools',assetId:124,action:'content'},assetSender),null);
  assert.equal(w.handle({type:'rc-avatar-tools',action:'load'},assetSender),null);
  assert.equal(w.handle({type:'rc-asset-tools',assetId:123,action:'content'},{...assetSender,id:'other'}),null);
  assert.equal(w.trustedCDN('https://rbxcdn.com.attacker.invalid/test'),null);assert.equal(w.trustedCDN('http://c1.rbxcdn.com/a'),null);
  const content=await w.handle({type:'rc-asset-tools',assetId:123,action:'content'},assetSender);
  assert.equal(Buffer.from(content.base64,'base64').toString(),'payload');assert.equal(calls[1].options.credentials,'omit');assert.equal(calls[1].options.redirect,'error');
});

test('resource transfer accepts files above 8 MB and enforces the 32 MB limit with and without a length header',async()=>{
  const assetSender={...sender,url:'https://www.roblox.com/catalog/123/Item'},message={type:'rc-asset-tools',assetId:123,action:'content'};
  const piece=new Uint8Array(1024*1024).fill(65);let mode='valid',cancelled=false;
  const w=worker(async url=>{
    if(url.includes('assetdelivery'))return Response.json({locations:[{location:'https://c1.rbxcdn.com/fixture'}]});
    let remaining=mode==='valid'?9:34;
    const body=new ReadableStream({pull(controller){if(remaining-- >0)controller.enqueue(piece);else controller.close();},cancel(){cancelled=true;}});
    return new Response(body,{headers:mode==='header'?{'content-length':String(C.MAX_BYTES+1)}:{}});
  });
  const content=await w.handle(message,assetSender),decoded=Buffer.from(content.base64,'base64');
  assert.equal(content.size,9*1024*1024);assert.equal(decoded.length,content.size);assert.equal(decoded[0],65);assert.equal(decoded.at(-1),65);
  mode='stream';await assert.rejects(w.handle(message,assetSender),/32 MB/);assert.equal(cancelled,true);
  mode='header';cancelled=false;await assert.rejects(w.handle(message,assetSender),/32 MB/);assert.equal(cancelled,true);
});

test('resource explorer accepts official content delivery URLs returned by asset delivery',async()=>{
  const location='https://contentdelivery.roblox.com/v1/bytes/sc1/4db0aaa63d1572b7322911b0de74bd95?__token__=fixture';
  const calls=[],w=worker(async(url,options)=>{calls.push({url,options});return url.includes('assetdelivery')?Response.json({locations:[{location}]}):new Response('model bytes');});
  const result=await w.handle({type:'rc-asset-tools',assetId:123,action:'content'},{...sender,url:'https://www.roblox.com/catalog/123/Item'});
  assert.equal(Buffer.from(result.base64,'base64').toString(),'model bytes');
  assert.equal(calls[1].url,location);assert.equal(calls[1].options.credentials,'omit');
  assert.equal(w.trustedCDN(location.replace('contentdelivery.roblox.com','contentdelivery.roblox.com.attacker.invalid')),null);
  assert.equal(w.trustedCDN('https://contentdelivery.roblox.com/v1/users/authenticated'),null);
});
module.exports={rules,values};
