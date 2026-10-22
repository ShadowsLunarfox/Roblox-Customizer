import {FLAGS,Authentication,OutfitModel,OutfitRenderer,RBXRenderer,AvatarType,AnimatorWrapper} from './vendor/roavatar-renderer-1.9.12.mjs';
import {builtinAssets} from './vendor/assets.mjs';

const params=new URL(location.href).searchParams,assetId=Number(params.get('assetId')),bundleId=Number(params.get('bundleId'));
const identity=assetId?{assetId}:{bundleId};
const types={idle:51,walk:55,run:53,jump:52,fall:50,climb:48,swim:54};
const parentOrigin=new URL(document.referrer||'https://www.roblox.com').origin;
let model=null,animations=[],selected=assetId?'asset':'idle',playing=true,active=true,disposed=false,frame=0,last=0,loading=false,ready=false,rigReady=false,usesR15=false,emoteLoad=null;
let renderedAt=0,interactionUntil=0,interacting=false,appliedSelection=null,selectionTask=null,lastStatus=null;
let sizeObserver=null,resizeFrame=0,renderWidth=0,renderHeight=0;
const objectURLs=new Set(),pending=new Set();
let watchdog;
function status(code){if(!disposed&&lastStatus!==code){lastStatus=code;parent.postMessage({type:'rc-animation-preview-status',...identity,code},parentOrigin);}}
function send(action,extra={}){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(cancel);reject(Error('Request timed out. Please try again.'));},65000);
    const cancel=()=>{clearTimeout(timer);reject(Error('Preview closed.'));};pending.add(cancel);
    chrome.runtime.sendMessage({type:'rc-animation-preview',...identity,action,...extra},result=>{
      clearTimeout(timer);pending.delete(cancel);const error=chrome.runtime.lastError;
      if(error||!result||result.error)reject(Error(result?.error||error?.message||'Could not load the avatar preview. Try again.'));else resolve(result);
    });
  });
}
async function fetchResource(url,options={}){
  if(disposed)throw Error('Preview closed.');
  const resourceURL=new URL(String(url),location.href),localRoot=new URL('./vendor/asset-data/',import.meta.url);
  if(resourceURL.protocol===localRoot.protocol&&resourceURL.host===localRoot.host&&resourceURL.pathname.startsWith(localRoot.pathname))return fetch(resourceURL.href);
  const builtin=resourceURL.hostname==='assetdelivery.roblox.com'&&Object.hasOwn(builtinAssets,resourceURL.searchParams.get('id'))?builtinAssets[resourceURL.searchParams.get('id')]:null;
  if(builtin&&(options.method||'GET')==='GET')return Response.json({locations:[{location:new URL(builtin,new URL('./vendor/',import.meta.url)).href}]});
  const result=await send('fetch',{url:String(url),method:options.method||'GET',body:options.body,headers:Object.fromEntries(new Headers(options.headers))});
  // Decode large meshes/textures in bounded slices so incoming assets cannot
  // monopolize the same thread that handles orbit controls.
  const encoded=result.base64,padding=encoded.endsWith('==')?2:encoded.endsWith('=')?1:0;
  const bytes=new Uint8Array(encoded.length/4*3-padding);let offset=0,start=performance.now();
  for(let index=0;index<encoded.length;index+=131072){
    if(disposed)throw Error('Preview closed.');
    const text=atob(encoded.slice(index,index+131072));
    for(let i=0;i<text.length;i++)bytes[offset++]=text.charCodeAt(i);
    if(index+131072<encoded.length&&performance.now()-start>=4){await new Promise(resolve=>setTimeout(resolve,0));start=performance.now();}
  }
  return new Response(bytes,{status:result.status,headers:{'content-type':result.mime}});
}
FLAGS.ONLINE_ASSETS=true;FLAGS.USE_WORKERS=false;FLAGS.FETCH_FUNC=fetchResource;FLAGS.API_REQUEST_RETRY=false;FLAGS.GEAR_ENABLED=false;
FLAGS.IMAGE_FUNC=async url=>{const response=await fetchResource(url);if(!response.ok)throw Error('Texture unavailable.');const objectURL=URL.createObjectURL(await response.blob());objectURLs.add(objectURL);return objectURL;};
function tick(time){
  frame=0;if(disposed||!active||document.hidden||!model)return;
  const elapsed=time-last;
  if(elapsed>=1000/30-.5){if(playing)model.animateOnce(Math.min(elapsed/1000,.1));last=time;}
  // Camera input follows display frames, independently of the cheaper 30 Hz
  // avatar pose update. Unattended previews retain the lower rendering rate.
  if(interacting||time<interactionUntil||time-renderedAt>=1000/30-.5){RBXRenderer.animateAll(false);renderedAt=time;}
  frame=requestAnimationFrame(tick);
}
function resume(){if(!frame&&!disposed&&active&&!document.hidden&&model){last=renderedAt=performance.now();frame=requestAnimationFrame(tick);}}
async function select(type){
  if(assetId?type!=='asset':!Object.hasOwn(types,type))return;selected=type;if(!model||!rigReady&&!ready)return;
  if(selectionTask)return selectionTask;
  if(appliedSelection===selected){if(ready)status(usesR15?'ready-r15':'ready');return;}
  // Native initialization and iframe readiness can report the same selection
  // together. Apply it once; rapid changes wait for the current load, then use
  // the latest choice without rebuilding the avatar or restarting older tracks.
  selectionTask=(async()=>{
    while(!disposed&&appliedSelection!==selected){
      const choice=selected,item=assetId?animations.find(item=>item.id===assetId):animations.find(item=>item.assetType===types[choice]);
      if(!item){status('animation-unavailable');return;}
      const name=assetId?(item.assetType===61?`emote.${item.id}`:Object.keys(types).find(key=>types[key]===item.assetType)):choice;
      if(!name){status('animation-unavailable');return;}
      if(item.assetType===61){
        const animator=model.currentRig?.FindFirstChildOfClass('Humanoid')?.FindFirstChildOfClass('Animator');
        if(!animator)return;
        if(!emoteLoad){const wrapper=new AnimatorWrapper(animator);emoteLoad=wrapper.loadAvatarAnimation(BigInt(item.id),true,true).then(()=>{
          const reference=wrapper.data.emotes.get(BigInt(item.id))?.id,track=reference?.match(/^rbxassetid:\/\/(\d+)$/)?.[1];
          if(!track||!wrapper.data.animationTracks.has(BigInt(track)))throw Error('Animation unavailable.');
        });}
        await emoteLoad;if(disposed)return;
      }
      await model.setMainAnimation(name);if(disposed)return;appliedSelection=choice;
      if(!playing){model.animateOnce(0);RBXRenderer.animateAll(false);}
    }
    if(ready)status(usesR15?'ready-r15':'ready');
  })().catch(()=>{if(!disposed)status('error');}).finally(()=>{selectionTask=null;});
  return selectionTask;
}
async function load(){
  if(loading||disposed)return;loading=true;status('loading');
  try{
    const data=await send('load');if(disposed)return;animations=data.animations;
    RBXRenderer.createLoadingIcon=false;
    if(!await RBXRenderer.fullSetup(true,true,false))throw Error('WebGL unavailable.');
    if(disposed)return;
    RBXRenderer.setBackgroundTransparent(true);
    // A small embedded viewport does not need an unrestricted high-DPI buffer.
    RBXRenderer.renderer?.setPixelRatio?.(Math.min(globalThis.devicePixelRatio||1,1.5));
    const controls=RBXRenderer.firstScene.controls;
    controls?.addEventListener('start',()=>{interacting=true;interactionUntil=performance.now()+180;resume();});
    controls?.addEventListener('change',()=>{interactionUntil=performance.now()+180;resume();});
    controls?.addEventListener('end',()=>{interacting=false;interactionUntil=performance.now()+180;});
    RBXRenderer.firstScene.wellLitDirectionalLightIntensity*=2.5;
    const outfitModel=new OutfitModel().fromJson(data.avatar),outfit=outfitModel.outfit;
    usesR15=outfit.playerAvatarType!==AvatarType.R15;outfit.playerAvatarType=AvatarType.R15;
    for(const type of Object.values(types))outfit.removeAssetType(type);
    for(const item of animations)if(item.assetType!==61)outfit.addAsset(item.id,item.assetType,item.name);
    // Play the selected emote directly; keep unrelated background/emote slots out.
    outfitModel.background=undefined;outfitModel.emotes.clear();
    document.querySelector('#viewport').append(RBXRenderer.getRendererElement());
    model=new OutfitRenderer(new Authentication(),outfitModel);model.forceAnimationLoop=true;
    watchdog=setTimeout(()=>{if(!ready)status(rigReady?'partial':'error');},90000);
    model.onRenderSuccess.Connect(()=>{if(disposed)return;ready=true;clearTimeout(watchdog);select(selected);resume();});
    model.onError.Connect(()=>status('error'));model.onRenderError.Connect(()=>status('partial'));
    model.onSuccess.Connect(()=>{rigReady=true;select(selected);resume();});
    const resize=()=>{if(disposed||resizeFrame)return;resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(disposed)return;
      const box=document.querySelector('#viewport').getBoundingClientRect(),width=Math.max(1,Math.round(box.width)),height=Math.max(1,Math.round(box.height));
      if(width!==renderWidth||height!==renderHeight){renderWidth=width;renderHeight=height;RBXRenderer.setRendererSize(width,height);}
    });};
    sizeObserver=new ResizeObserver(resize);sizeObserver.observe(document.querySelector('#viewport'));resize();resume();
  }catch(error){status(/Sign in/.test(error.message)?'sign-in':'error');}
  finally{loading=false;}
}
addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==parentOrigin||event.data?.type!=='rc-animation-preview-control'
    ||(assetId?event.data.assetId!==assetId||event.data.bundleId!==undefined:event.data.bundleId!==bundleId||event.data.assetId!==undefined))return;
  const data=event.data;
  if(data.action==='select')select(data.animationType);
  else if(data.action==='playing')playing=data.playing===true;
  else if(data.action==='active'){active=data.active===true;if(!active){cancelAnimationFrame(frame);frame=0;}else resume();}
  else if(data.action==='camera')model?.centerCamera();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else resume();});
addEventListener('pagehide',()=>{disposed=true;clearTimeout(watchdog);cancelAnimationFrame(frame);cancelAnimationFrame(resizeFrame);sizeObserver?.disconnect();model?.destroy();for(const scene of [...RBXRenderer.scenes])scene.destroy();RBXRenderer.renderer?.dispose();for(const url of objectURLs)URL.revokeObjectURL(url);for(const cancel of pending)cancel();pending.clear();},{once:true});
status('boot');void load();
