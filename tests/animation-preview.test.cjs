const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {test}=require('node:test');
const bundleId=13847677942977;
const sender={id:'ext',frameId:2,url:`chrome-extension://ext/src/assets/animation-preview/renderer.html?bundleId=${bundleId}`,tab:{url:`https://www.roblox.com/ko/bundles/${bundleId}/Animation-Pack`}};
function worker(fetch){const context=vm.createContext({URL,AbortController,setTimeout,clearTimeout,TextDecoder,Uint8Array,btoa,fetch,chrome:{runtime:{id:'ext',onMessage:{addListener(){}}}}});vm.runInContext(fs.readFileSync('src/shared/routes.js','utf8'),context);vm.runInContext(fs.readFileSync('src/background/animation-preview-background.js','utf8'),context);return context.RobloxCustomizerAnimationPreviewBackground;}

test('animation preview is limited to its extension frame inside the matching Roblox bundle',async()=>{
  const w=worker(()=>assert.fail('Invalid senders cannot fetch'));
  assert.equal(w.context({bundleId},sender).id,bundleId);
  for(const source of [{...sender,id:'other'},{...sender,frameId:0},{...sender,url:sender.url.replace('ext/src','other/src')},{...sender,tab:{url:'https://www.roblox.com/home'}},{...sender,tab:{url:`https://attacker.invalid/bundles/${bundleId}`}}])assert.equal(await w.handle({bundleId,action:'load'},source),null);
  assert.equal(await w.handle({bundleId:201,action:'load'},sender),null);
});

test('avatar preview loads fresh account data and only animation assets from the requested bundle',async()=>{
  const calls=[];let switched=false,authCalls=0;
  const w=worker(async url=>{calls.push(url);if(url.endsWith('/authenticated'))return Response.json({id:switched&&++authCalls>1?456:123});if(url.includes('/v4/avatar'))return Response.json({avatarModel:{name:'Private avatar',assets:[]}});return Response.json({items:[{id:11,name:'Idle',type:'Asset',assetType:51},{id:12,name:'Hat',type:'Asset',assetType:8},{id:13,type:'UserOutfit'},{id:14,name:'Walk',type:'Asset',assetType:55}]});});
  const result=await w.handle({bundleId,action:'load'},sender);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{userId:123,avatar:{avatarModel:{name:'Private avatar',assets:[]}},animations:[{id:11,assetType:51,name:'Idle'},{id:14,assetType:55,name:'Walk'}]});
  assert.equal(calls.filter(url=>url.includes('/v4/avatar')).length,1);assert.ok(calls.includes(`https://catalog.roblox.com/v1/bundles/${bundleId}/details`));
  switched=true;authCalls=0;await assert.rejects(w.handle({bundleId,action:'load'},sender),/account changed/);
});

test('individual animation previews bind the exact asset page, frame parameter and message identity',async()=>{
  const assetId=130836074181150,assetSender={...sender,url:sender.url.replace(`bundleId=${bundleId}`,`assetId=${assetId}`),tab:{url:`https://www.roblox.com/ja/catalog/${assetId}/Body-Tornado`}};
  const w=worker(()=>assert.fail('Invalid identities cannot fetch'));
  assert.equal(w.context({assetId},assetSender).itemType,'Asset');
  for(const source of [
    {...assetSender,url:assetSender.url+`&bundleId=${assetId}`},
    {...assetSender,url:assetSender.url+`&assetId=${assetId}`},
    {...assetSender,url:assetSender.url.replace(String(assetId),'123')},
    {...assetSender,tab:{url:`https://www.roblox.com/bundles/${assetId}/Bundle`}},
    {...assetSender,tab:{url:`https://www.roblox.com/catalog/123/Other`}},
    {...assetSender,frameId:0}
  ])assert.equal(await w.handle({assetId,action:'load'},source),null);
  for(const message of [{bundleId:assetId},{assetId,bundleId:assetId},{assetId:123}])assert.equal(await w.handle({...message,action:'load'},assetSender),null);
});

test('individual previews accept verified animation/emote types and reject unrelated assets and changed accounts',async()=>{
  for(const [assetId,assetType]of [[130836074181150,61],[124765145869332,53],[105381637724646,61]]){
    const calls=[];let type=assetType,returnedId=assetId,auth=0,changed=false;
    const w=worker(async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith('/authenticated'))return Response.json({id:changed&&++auth>1?456:123});
      if(url.includes('/v4/avatar'))return Response.json({avatarModel:{name:'Current player',assets:[]}});
      return Response.json({AssetId:returnedId,AssetTypeId:type,Name:'Requested animation'});
    });
    const source={...sender,url:sender.url.replace(`bundleId=${bundleId}`,`assetId=${assetId}`),tab:{url:`https://www.roblox.com/catalog/${assetId}/Animation`}};
    const result=await w.handle({assetId,action:'load'},source);
    assert.deepEqual(JSON.parse(JSON.stringify(result.animations)),[{id:assetId,assetType,name:'Requested animation'}]);
    assert.ok(calls.some(call=>call.url===`https://economy.roblox.com/v2/assets/${assetId}/details`));
    assert.ok(calls.every(call=>!call.options.method),'Preview loading never equips or saves an outfit');
    type=8;await assert.rejects(w.handle({assetId,action:'load'},source),/no supported animations/);
    type=assetType;returnedId=123;await assert.rejects(w.handle({assetId,action:'load'},source),/no supported animations/);
    returnedId=assetId;changed=true;auth=0;await assert.rejects(w.handle({assetId,action:'load'},source),/account changed/);
  }
});

test('renderer transport allows resource reads and metadata queries, rejects equip writes, and strips credentials from CDN requests',async()=>{
  const calls=[],w=worker(async(url,options)=>{calls.push({url,options});return new Response('asset bytes',{headers:{'content-type':'application/octet-stream'}});});
  const body=JSON.stringify({items:[{id:123,itemType:'Asset'}]});
  for(const [url,method,content]of [
    ['https://avatar.roblox.com/v4/avatar','PATCH','{}'],['https://avatar.roblox.com/v2/avatar/set-wearing-assets','POST','{}'],
    ['https://catalog.roblox.com/v1/catalog/items/details','POST',JSON.stringify({items:[{id:123,itemType:'Bundle'}]})],
    ['https://rbxcdn.com.attacker.invalid/file','GET'],['http://c1.rbxcdn.com/file','GET'],['https://user:pass@c1.rbxcdn.com/file','GET']
  ])await assert.rejects(w.handle({bundleId,action:'fetch',url,method,body:content},sender),/not supported/);
  assert.equal(calls.length,0);
  const content=await w.handle({bundleId,action:'fetch',url:'https://c1.rbxcdn.com/model',headers:{Authorization:'secret',Cookie:'secret','roblox-assetformat':'rbxm'}},sender);
  assert.equal(Buffer.from(content.base64,'base64').toString(),'asset bytes');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[0].options.headers.Cookie,undefined);
  await w.handle({bundleId,action:'fetch',url:'https://catalog.roblox.com/v1/catalog/items/details',method:'POST',body},sender);
  assert.equal(calls[1].options.body,body);assert.equal(calls[1].options.credentials,'include');
});

test('oversized preview resources are cancelled before decoding',async()=>{
  let cancelled=false;
  const w=worker(async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-length':String(32*1024*1024+1)}}));
  await assert.rejects(w.handle({bundleId,action:'fetch',url:'https://c1.rbxcdn.com/model'},sender),/32 MB/);assert.equal(cancelled,true);
});

test('animation mesh and texture bytes accept the official content delivery host without account credentials',async()=>{
  const calls=[],url='https://contentdelivery.roblox.com/v1/bytes/sc4/cbc7336f6bc94ef9284fd8dd772c8245?__token__=fixture-signed-token';
  const w=worker(async(url,options)=>{calls.push({url,options});return new Response('mesh bytes');});
  const result=await w.handle({bundleId,action:'fetch',url},sender);
  assert.equal(Buffer.from(result.base64,'base64').toString(),'mesh bytes');
  assert.equal(calls[0].url,url,'Preserve the signed resource query');
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.redirect,'error');
  for(const url of [
    'https://contentdelivery.roblox.com.attacker.invalid/v1/bytes/sc4/cbc7336f6bc94ef9284fd8dd772c8245',
    'http://contentdelivery.roblox.com/v1/bytes/sc4/cbc7336f6bc94ef9284fd8dd772c8245',
    'https://contentdelivery.roblox.com/v1/users/authenticated',
    'https://contentdelivery.roblox.com/v1/bytes/../../users',
  ])await assert.rejects(w.handle({bundleId,action:'fetch',url},sender),/not supported/);
  await assert.rejects(w.handle({bundleId,action:'fetch',url,method:'POST',body:'{}'},sender),/not supported/);
  assert.equal(calls.length,1,'Only the validated asset read is sent');
  const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8'));
  assert.ok(manifest.host_permissions.includes('https://contentdelivery.roblox.com/v1/bytes/*'),'The unpacked extension can read the new asset host');
});

test('vendored animation renderer stays unmodified and includes corresponding source and licenses',()=>{
  const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
  assert.equal(hash('src/assets/animation-preview/vendor/roavatar-renderer-1.9.12.mjs'),'61e470ff1e071907039d5dec36b1d101a871b63b99b7734d86ab167c5d71a40a');
  assert.equal(hash('third_party/roavatar-renderer-1.9.12-source.tar.gz'),'a158ccffcf308619eca67ca1b90f7ce6ace0b37b1d3cfc94108b8a2f5ff89cc3');
  for(const name of ['roavatar-renderer','three','postprocessing','n8ao','react','react-dom','fflate','fzstd','draco'])assert.ok(fs.readFileSync(`src/assets/animation-preview/vendor/${name}.LICENSE`,'utf8').length>500);
  const data=JSON.parse(fs.readFileSync('src/assets/animation-preview/vendor/asset-data.json','utf8'));
  assert.equal(data.files.length,20);for(const file of data.files)assert.equal(hash('src/assets/animation-preview/vendor/asset-data/'+file.file),file.sha256,'Bundled rig and compositing assets retain their source hashes');
});
