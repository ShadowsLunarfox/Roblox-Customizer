const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../src/background/service-worker-bundle.js'),'utf8');
function environment(){
  const listeners=[],queries=[],fetches=[];
  let current={origin:'https://www.roblox.com',pathname:'/catalog/456/New'};
  const chrome={runtime:{id:'ext',onMessage:{addListener:fn=>listeners.push(fn)}},tabs:{async sendMessage(id,message,options){queries.push({id,message,options});return current;}}};
  const context=vm.createContext({chrome,URL,URLSearchParams,AbortController,TextDecoder,TextEncoder,Uint8Array,atob,btoa,setTimeout,clearTimeout,
    async fetch(value){const url=new URL(value);fetches.push(url.href);
      if(url.hostname==='thumbnails.roblox.com')return Response.json({data:[{targetId:Number(url.searchParams.get('assetIds')||url.searchParams.get('bundleIds')),state:'Completed',imageUrl:'https://tr.rbxcdn.com/fixture.png'}]});
      return Response.json({Name:'Current item',Created:'2025-06-07T00:00:00Z'});
    }});
  vm.runInContext(source,context);
  return {queries,fetches,context,setCurrent:value=>{current=value},async send(message,sender){
    return new Promise(resolve=>{let claimed=false,responded=false;
      for(const listener of listeners){const result=listener(message,sender,value=>{responded=true;resolve(value)});if(result===true)claimed=true;}
      if(!claimed&&!responded)resolve(undefined);
    });
  }};
}
const sender={id:'ext',frameId:0,documentId:'original-document',url:'https://www.roblox.com/catalog/123/First',tab:{id:7,url:'https://www.roblox.com/catalog/456/New'}};

test('the packaged worker resolves stale sender URLs through the exact current document for item details and thumbnails',async()=>{
  const env=environment();
  const details=await env.send({type:'rc-asset-tools',action:'details',assetId:456,itemType:'Asset'},sender);
  assert.equal(details.id,456);assert.equal(details.created,'2025-06-07T00:00:00Z');
  assert.match(env.fetches[0],/assets\/456\/details$/);
  assert.deepEqual(JSON.parse(JSON.stringify(env.queries[0].options)),{frameId:0,documentId:'original-document'});
  assert.equal(env.queries[0].message.type,'rc-current-page-context');
  const thumbnail=await env.send({type:'rc-catalog-item-2d',assetId:456,itemType:'Asset'},sender);
  assert.equal(thumbnail.state,'Completed');assert.match(env.fetches.at(-1),/assetIds=456/);
  env.setCurrent({origin:'https://www.roblox.com',pathname:'/ja/bundles/456/Bundle'});
  const bundleSender={...sender,url:'https://www.roblox.com/catalog/456/Asset'};
  const bundle=await env.send({type:'rc-asset-tools',action:'details',assetId:456,itemType:'Bundle'},bundleSender);
  assert.equal(bundle.itemType,'Bundle');assert.match(env.fetches.at(-1),/bundles\/456\/details$/);
});

test('a delayed item request cannot use a different page, origin, subframe, or caller-supplied URL to bypass validation',async()=>{
  for(const current of [{origin:'https://www.roblox.com',pathname:'/catalog/789/Other'},
    {origin:'https://attacker.invalid',pathname:'/catalog/456/Other'},
    {origin:'https://www.roblox.com',pathname:'//attacker.invalid/catalog/456'},
    {origin:'https://www.roblox.com',pathname:'/catalog/456/Item?private=token'}]){
    const env=environment();env.setCurrent(current);
    const result=await env.send({type:'rc-asset-tools',action:'details',assetId:456,itemType:'Asset',pageUrl:'https://www.roblox.com/catalog/456/Claim'},sender);
    assert.match(result.error,/current item page/);assert.equal(env.fetches.length,0);
  }
  for(const invalid of [{...sender,id:'other'},{...sender,frameId:2},{...sender,url:'https://attacker.invalid/catalog/123'}]){
    const env=environment();await env.send({type:'rc-asset-tools',action:'details',assetId:456},invalid);
    assert.equal(env.queries.length,0);assert.equal(env.fetches.length,0);
  }
});

test('page-context recovery is restricted to reads and never replays an avatar mutation on another route',async()=>{
  const env=environment();
  const result=await env.send({type:'rc-avatar-tools',action:'colors',userId:123,colors:{headColor3:'#abcdef'}},sender);
  assert.match(result.error,/current item page/);assert.equal(env.queries.length,0);assert.equal(env.fetches.length,0);
});
