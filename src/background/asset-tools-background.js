(function(root){
  'use strict';
  const core=root.RobloxCustomizerAssetCore;
  let csrf='',mutation=Promise.resolve();
  const metadataCache=new Map();
  function senderURL(sender){try{const u=new URL(sender.url);return sender.id===chrome.runtime.id&&(sender.frameId??0)===0&&u.protocol==='https:'&&['www.roblox.com','roblox.com','create.roblox.com'].includes(u.hostname)?u:null;}catch{return null;}}
  async function request(url,options={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.raw?60000:20000);
    try{
      const response=await fetch(url,{credentials:'include',...options,signal:controller.signal});
      if(options.method==='POST'&&response.status===403&&response.headers.get('x-csrf-token')){
        const token=response.headers.get('x-csrf-token');csrf=token;
        const retry=await fetch(url,{credentials:'include',...options,headers:{...options.headers,'x-csrf-token':token},signal:controller.signal});
        return await finish(retry);
      }
      return await finish(response);
    }finally{clearTimeout(timer);}
    async function finish(response){
      if(!response.ok){const error=new Error(response.status===401?'Sign in to Roblox to use this tool.':response.status===403?'Roblox did not allow access to this resource.':`Roblox request failed (${response.status}).`);error.status=response.status;throw error;}
      return options.raw?readBytes(response):response.json();
    }
  }
  async function readBytes(response){
    if(Number(response.headers.get('content-length'))>core.MAX_BYTES){await response.body?.cancel().catch(()=>{});throw Error('Resource exceeds the 32 MB preview limit.');}
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>core.MAX_BYTES)throw Error('Resource exceeds the 32 MB preview limit.');chunks.push(value);}}
    catch(error){await reader.cancel().catch(()=>{});throw error;}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
  }
  const post=(url,value)=>request(url,{method:'POST',headers:{'Content-Type':'application/json',...(csrf?{'x-csrf-token':csrf}:{})},body:JSON.stringify(value)});
  async function details(assetId,itemType){
    const key=`${itemType}:${assetId}`,cached=metadataCache.get(key);if(cached&&Date.now()-cached.time<60000)return cached.value;
    const data=await request(itemType==='Bundle'?`https://catalog.roblox.com/v1/bundles/${assetId}/details`:`https://economy.roblox.com/v2/assets/${assetId}/details`);
    const value={id:assetId,itemType,name:data.Name??data.name??String(assetId),description:data.Description??data.description??'',
      created:data.Created??null,updated:data.Updated??null,creator:data.Creator?.Name??data.creator?.name??'',typeId:data.AssetTypeId??null,
      sales:Number.isFinite(data.Sales)?data.Sales:null,supply:Number.isFinite(data.CollectiblesItemDetails?.TotalQuantity)?data.CollectiblesItemDetails.TotalQuantity:null,
      remaining:data.IsLimitedUnique===true&&Number.isFinite(data.Remaining)?data.Remaining:null,
      items:itemType==='Bundle'?(data.items||[]).filter(i=>i.type==='Asset'&&core.id(i.id)).map(i=>({id:i.id,name:i.name})):[]};
    metadataCache.set(key,{value,time:Date.now()});if(metadataCache.size>100)metadataCache.delete(metadataCache.keys().next().value);return value;
  }
  function trustedCDN(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='rbxcdn.com'||u.hostname.endsWith('.rbxcdn.com')||u.hostname==='contentdelivery.roblox.com'&&/^\/v1\/bytes\/sc\d+\/[a-f0-9]{32,64}$/.test(u.pathname))?u.href:null;}catch{return null;}}
  async function content(assetId){
    const result=await request(`https://assetdelivery.roblox.com/v2/assetId/${assetId}`);
    const url=trustedCDN(result.locations?.[0]?.location);
    if(!url)throw Error('Roblox did not provide downloadable content for this resource.');
    // CDN requests never receive Roblox account credentials.
    const bytes=await request(url,{raw:true,credentials:'omit',redirect:'error'});
    let encoded='';for(let i=0;i<bytes.length;i+=0x6000)encoded+=String.fromCharCode(...bytes.subarray(i,i+0x6000));
    return {base64:btoa(encoded),size:bytes.length};
  }
  async function avatar(){
    const [current,rules,user]=await Promise.all([request('https://avatar.roblox.com/v2/avatar/avatar'),request('https://avatar.roblox.com/v1/avatar-rules',{credentials:'omit'}),request('https://users.roblox.com/v1/users/authenticated')]);
    if(!Array.isArray(current.assets)||!current.bodyColor3s)throw Error('This avatar format is not supported by the editor.');
    return {userId:user.id,bodyColors:core.colors(current.bodyColor3s),assets:current.assets.map(a=>({id:a.id,name:a.name,typeId:a.assetType?.id,meta:a.meta||{},bounds:core.boundsFor(rules,a.assetType?.id)}))};
  }
  async function editAvatar(message){
    const user=await request('https://users.roblox.com/v1/users/authenticated');
    if(!core.id(message.userId)||user.id!==message.userId)throw Error('Your Roblox account changed. Reload the editor.');
    // Read again immediately before a write; preserve other wearables and metadata.
    const current=await request('https://avatar.roblox.com/v2/avatar/avatar');
    if(message.action==='colors'){
      const patch=core.colors(message.colors),colors=core.colors(current.bodyColor3s);
      if(core.colorKeys.some(key=>!colors[key]))throw Error('This avatar format is not supported by the editor.');
      const result=await post('https://avatar.roblox.com/v2/avatar/set-body-colors',Object.fromEntries(Object.entries({...colors,...patch}).map(([key,value])=>[key,value.slice(1)])));
      if(result.success===false)throw Error('Roblox could not apply the avatar changes.');
    }else if(message.action==='accessory'){
      const assets=current.assets;if(!Array.isArray(assets))throw Error('This avatar format is not supported by the editor.');
      const target=assets.find(a=>a.id===message.assetId);if(!target)throw Error('The accessory is no longer equipped. Reload the editor.');
      const rules=await request('https://avatar.roblox.com/v1/avatar-rules',{credentials:'omit'}),patch=core.refinement(message.values,core.boundsFor(rules,target.assetType?.id));
      const wearing=assets.map(a=>({id:a.id,...(a.meta?{meta:a.meta}:{})}));
      const item=wearing.find(a=>a.id===message.assetId);item.meta={...item.meta,...patch};
      const result=await post('https://avatar.roblox.com/v2/avatar/set-wearing-assets',{assets:wearing});
      if(result.success===false)throw Error('Roblox could not apply the avatar changes.');
    }else throw Error('Invalid avatar action.');
    return {ok:true};
  }
  function handle(message,sender,resolved=false){
    const source=senderURL(sender);if(!source)return null;
    const route=root.RobloxCustomizerRoutes?.pathname(source.pathname)||source.pathname;
    if(message.type==='rc-asset-tools'){
      if(message.itemType!==undefined&&!['Asset','Bundle'].includes(message.itemType))return null;
      const match=route.match(/^\/(?:catalog|bundles|library)\/(\d+)(?:\/|$)/)||route.match(/^\/store\/asset\/(\d+)(?:\/|$)/);
      const itemType=route.startsWith('/bundles/')?'Bundle':'Asset';
      if(!match||core.id(message.assetId)!==Number(match[1])||message.itemType!==undefined&&message.itemType!==itemType){
        if(!resolved&&['details','content'].includes(message.action)&&root.RobloxCustomizerPageContext?.canResolve(sender)){
          return root.RobloxCustomizerPageContext.resolve(sender).then(current=>{
            const result=current&&handle(message,{...sender,url:current.href},true);
            if(!result)throw Error('This request does not match the current item page.');
            return result;
          });
        }
        return null;
      }
      if(message.action==='details')return details(message.assetId,itemType);
      if(message.action==='content'&&itemType==='Asset')return content(message.assetId);
      return null;
    }
    if(message.type==='rc-avatar-tools'&&/^\/my\/avatar(?:\/|$)/.test(route)){
      if(message.action==='load')return avatar();
      if(!['colors','accessory'].includes(message.action))return null;
      if(message.action==='colors')core.colors(message.colors);
      if(message.action==='accessory'&&!core.id(message.assetId))return null;
      const work=mutation.then(()=>editAvatar(message));mutation=work.catch(()=>{});return work;
    }
    return null;
  }
  chrome.runtime.onMessage.addListener((message,sender,respond)=>{
    if(!['rc-asset-tools','rc-avatar-tools'].includes(message?.type))return;
    let result;try{result=handle(message,sender);}catch(error){respond({error:error.message});return;}
    if(!result){respond({error:'This request does not match the current item page.',code:'page-changed'});return;}
    Promise.resolve(result).then(respond,error=>respond({error:error.message||'This tool is unavailable.'}));return true;
  });
  root.RobloxCustomizerAssetToolsBackground=Object.freeze({handle,trustedCDN});
})(globalThis);
