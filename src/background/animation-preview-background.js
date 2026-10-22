(function(root){
  'use strict';
  const MAX_BYTES=32*1024*1024,ANIMATIONS=new Set([48,50,51,52,53,54,55]),ASSET_ANIMATIONS=new Set([...ANIMATIONS,61]);
  const positive=n=>Number.isSafeInteger(Number(n))&&Number(n)>0;
  let csrf='';
  function context(message,sender){
    try{
      if(sender.id!==chrome.runtime.id||!(sender.frameId>0))return null;
      const frame=new URL(sender.url),page=new URL(sender.tab?.url);
      if(frame.protocol!=='chrome-extension:'||frame.hostname!==chrome.runtime.id||frame.pathname!=='/src/assets/animation-preview/renderer.html')return null;
      if(page.protocol!=='https:'||!['www.roblox.com','roblox.com'].includes(page.hostname))return null;
      const pathname=root.RobloxCustomizerRoutes?.pathname(page.pathname)||page.pathname;
      const match=pathname.match(/^\/(bundles|catalog)\/(\d+)(?:\/|$)/),id=Number(match?.[2]);
      const itemType=match?.[1]==='catalog'?'Asset':'Bundle',key=itemType==='Asset'?'assetId':'bundleId',other=itemType==='Asset'?'bundleId':'assetId';
      return positive(id)&&id===message[key]&&message[other]===undefined&&frame.searchParams.getAll(key).length===1
        &&Number(frame.searchParams.get(key))===id&&!frame.searchParams.has(other)?{id,itemType}:null;
    }catch{return null;}
  }
  function allowedRequest(value,method='GET',body){
    try{
      const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.hash)return null;
      const host=url.hostname,path=url.pathname;
      if(method==='GET'){
        if(host==='rbxcdn.com'||host.endsWith('.rbxcdn.com'))return {url:url.href,cdn:true};
        if(host==='contentdelivery.roblox.com'&&/^\/v1\/bytes\/sc\d+\/[a-f0-9]{32,64}$/.test(path))return {url:url.href,cdn:true};
        if(host==='assetdelivery.roblox.com'&&(/^\/v2\/asset\/?$/.test(path)&&positive(url.searchParams.get('id'))||/^\/v2\/assetId\/\d+$/.test(path)))return {url:url.href};
        if(host==='economy.roblox.com'&&/^\/v2\/assets\/\d+\/details$/.test(path))return {url:url.href};
        if(host==='avatar.roblox.com'&&path==='/v1/avatar-rules')return {url:url.href};
      }
      if(method==='POST'&&typeof body==='string'&&body.length<65536){
        const data=JSON.parse(body);
        if(host==='catalog.roblox.com'&&path==='/v1/catalog/items/details'&&Array.isArray(data.items)&&data.items.length<=100
          &&data.items.every(item=>positive(item.id)&&item.itemType==='Asset'))return {url:url.href,json:true};
        if(host==='develop.roblox.com'&&path==='/v1/assets/latest-versions'&&Array.isArray(data.assetIds)&&data.assetIds.length<=100
          &&data.assetIds.every(positive))return {url:url.href,json:true};
      }
    }catch{}
    return null;
  }
  async function request(url,options={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
    try{
      const init={credentials:'include',redirect:'error',...options,signal:controller.signal};
      let response=await fetch(url,init);
      if(options.method==='POST'&&response.status===403&&response.headers.get('x-csrf-token')){
        csrf=response.headers.get('x-csrf-token');await response.body?.cancel().catch(()=>{});
        response=await fetch(url,{...init,headers:{...init.headers,'x-csrf-token':csrf}});
      }
      if(Number(response.headers.get('content-length'))>MAX_BYTES){await response.body?.cancel().catch(()=>{});throw Error('Resource exceeds the 32 MB preview limit.');}
      const reader=response.body?.getReader(),chunks=[];let size=0;
      if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw Error('Resource exceeds the 32 MB preview limit.');chunks.push(value);}}
      catch(error){await reader.cancel().catch(()=>{});throw error;}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      return {status:response.status,bytes,mime:response.headers.get('content-type')||'application/octet-stream'};
    }finally{clearTimeout(timer);}
  }
  async function json(url){const result=await request(url);if(result.status===401)throw Error('Sign in to Roblox to use this tool.');if(result.status!==200)throw Error('Could not load the avatar preview. Try again.');return JSON.parse(new TextDecoder().decode(result.bytes));}
  async function load(id,itemType){
    const user=await json('https://users.roblox.com/v1/users/authenticated');if(!positive(user.id))throw Error('Sign in to Roblox to use this tool.');
    const [avatar,details]=await Promise.all([
      json('https://avatar.roblox.com/v4/avatar?selectionTypes=0&selectionTypes=1&selectionTypes=2&selectionTypes=3&selectionTypes=4&selectionTypes=5&selectionTypes=6'),
      json(itemType==='Asset'?`https://economy.roblox.com/v2/assets/${id}/details`:`https://catalog.roblox.com/v1/bundles/${id}/details`)
    ]);
    const current=await json('https://users.roblox.com/v1/users/authenticated');if(current.id!==user.id)throw Error('Your Roblox account changed. Reload the editor.');
    if(itemType==='Asset'){
      if(details.AssetId!==id||!ASSET_ANIMATIONS.has(details.AssetTypeId))throw Error('This item has no supported animations.');
      return {userId:user.id,avatar,animations:[{id,assetType:details.AssetTypeId,name:String(details.Name||'').slice(0,500)}]};
    }
    const animations=(details.items||[]).filter(item=>item.type==='Asset'&&positive(item.id)&&ANIMATIONS.has(item.assetType)).slice(0,50)
      .map(item=>({id:item.id,assetType:item.assetType,name:String(item.name||'').slice(0,500)}));
    if(!animations.length)throw Error('This bundle has no supported animations.');
    return {userId:user.id,avatar,animations};
  }
  async function handle(message,sender){
    const source=context(message,sender);if(!source)return null;
    if(message.action==='load')return load(source.id,source.itemType);
    if(message.action!=='fetch')return null;
    const method=message.method||'GET',rule=allowedRequest(message.url,method,message.body);if(!rule)throw Error('This preview request is not supported.');
    const headers={};for(const [name,value]of Object.entries(message.headers||{}))if(/^(?:accept|roblox-assetformat)$/i.test(name)&&typeof value==='string'&&value.length<200)headers[name]=value;
    if(rule.json){headers['content-type']='application/json';if(csrf)headers['x-csrf-token']=csrf;}
    const result=await request(rule.url,{method,credentials:rule.cdn?'omit':'include',headers,...(rule.json?{body:message.body}:{})});
    let text='';for(let i=0;i<result.bytes.length;i+=0x6000)text+=String.fromCharCode(...result.bytes.subarray(i,i+0x6000));
    return {status:result.status,mime:result.mime,base64:btoa(text)};
  }
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='rc-animation-preview')return;
    if(!context(message,sender))return;
    handle(message,sender).then(respond,error=>respond({error:error.message||'Could not load the avatar preview. Try again.'}));return true;
  });
  root.RobloxCustomizerAnimationPreviewBackground=Object.freeze({handle,allowedRequest,context});
})(globalThis);
