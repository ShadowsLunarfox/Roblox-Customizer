(globalThis.RobloxCustomizerCompatibility?.runFeature||(fn=>fn()))(()=>{
  'use strict';
  if(globalThis.RobloxCustomizerAnimationBundle)return;
  const U=globalThis.RobloxCustomizerToolsUI;
  const kinds={idle:'Idle',walk:'Walk',run:'Run',jump:'Jump',fall:'Fall',climb:'Climb',swim:'Swim'};
  let state=null,queued=false;
  const route=()=>globalThis.RobloxCustomizerRoutes?.pathname()||location.pathname;
  const context=()=>{const match=route().match(/^\/(bundles|catalog)\/(\d+)(?:\/|$)/);return match?{id:Number(match[2]),itemType:match[1]==='catalog'?'Asset':'Bundle'}:null;};
  const identity=s=>s.itemType==='Asset'?{assetId:s.id}:{bundleId:s.id};
  const t=label=>globalThis.RobloxCustomizerI18n?.t(label)||label;
  const el=(tag,className,parent,text)=>U.el(tag,className,parent,text);
  const attribute=(node,name,value)=>{if(node.getAttribute(name)!==value)node.setAttribute(name,value);};
  const active=()=>document.documentElement?.getAttribute('data-rc-frost-page')==='catalog'&&globalThis.RobloxCustomizerCompatibility?.enabled?.()!==false;
  function send(s,action,extra={}){s.frame?.contentWindow?.postMessage({type:'rc-animation-preview-control',...identity(s),action,...extra},s.origin);}
  function close(){
    if(!state)return;const s=state;state=null;clearTimeout(s.timer);s.visibility?.disconnect();s.frame?.remove();s.root.remove();
    if(s.itemType==='Bundle'){s.host.removeAttribute('data-rc-animation-studio');s.preview.removeAttribute('data-rc-animation-preview');s.preview.removeAttribute('data-rc-animation-title');s.info.removeAttribute('data-rc-animation-info');}
    for(const n of s.marked){n.removeAttribute('data-rc-animation-label');n.removeAttribute('data-rc-animation-playback');if(n.getAttribute('data-rc-animation-owned-label')==='true'){n.removeAttribute('aria-label');n.removeAttribute('data-rc-animation-owned-label');}}
  }
  function load(s){
    if(state!==s)return;clearTimeout(s.timer);s.frame?.remove();s.status.textContent=t('Loading your avatar animation...');s.load.textContent=t('Reload avatar');s.load.disabled=true;s.camera.disabled=true;
    const url=new URL(chrome.runtime.getURL('src/assets/animation-preview/renderer.html'));url.searchParams.set(s.itemType==='Asset'?'assetId':'bundleId',s.id);
    const frame=document.createElement('iframe');frame.className='rc-animation-frame';frame.title=t('Your avatar animation');frame.src=url.href;
    frame.addEventListener('load',()=>{if(state===s)configure(s);});s.frame=frame;s.origin=url.protocol==='chrome-extension:'?`${url.protocol}//${url.host}`:url.origin;s.viewport.append(frame);
    s.placeholder.hidden=true;
    s.timer=setTimeout(()=>{if(state===s&&s.frame===frame){s.status.textContent=t('Could not load the avatar preview. Try again.');s.load.disabled=false;}},95000);
  }
  function configure(s){send(s,'select',{animationType:s.kind});send(s,'playing',{playing:s.playing});send(s,'active',{active:s.inView&&!document.hidden});}
  function nativeControls(s){
    const controls=s.itemType==='Bundle'?[...s.preview.querySelectorAll('.bundle-animation-button')]:[];let kind=s.itemType==='Asset'?'asset':'idle';
    for(const button of controls){
      const icon=button.querySelector('.animation-icon'),key=Object.keys(kinds).find(k=>icon?.classList.contains(`icon-animation-${k}`));if(!key)continue;
      s.marked.add(button);attribute(button,'data-rc-animation-label',t(kinds[key]));
      if(!button.hasAttribute('aria-label')||button.getAttribute('data-rc-animation-owned-label')==='true'){attribute(button,'aria-label',t(kinds[key]));attribute(button,'data-rc-animation-owned-label','true');}
      if(button.classList.contains('selected'))kind=key;
    }
    const play=s.preview.querySelector('.thumbnail-button-container button:has(.icon-bigstop, .icon-bigplay)');
    const playing=play?!!play.querySelector('.icon-bigstop'):s.playing;
    if(play&&s.itemType==='Bundle'){s.marked.add(play);const label=t(playing?'Pause animation':'Play animation');attribute(play,'data-rc-animation-label',label);attribute(play,'data-rc-animation-playback','');
      if(!play.hasAttribute('aria-label')||play.getAttribute('data-rc-animation-owned-label')==='true'){attribute(play,'aria-label',label);attribute(play,'data-rc-animation-owned-label','true');}}
    if(s.kind!==kind){s.kind=kind;send(s,'select',{animationType:kind});}
    if(s.playing!==playing){s.playing=playing;send(s,'playing',{playing});}
    const label=(s.itemType==='Asset'?s.info.querySelector('h1'):s.preview.querySelector('.bundle-animation-label'))?.textContent||'';if(s.selection.textContent!==label)s.selection.textContent=label;
  }
  function mount(id,itemType,preview,host,info){
    const root=el('aside','rc-animation-user-preview',null);root.id='rc-animation-user-preview';root.dataset.rcToolsRoot='';
    const heading=el('div','rc-animation-heading',root);el('h2','',heading,'Your avatar animation');
    const s={id,itemType,preview,host,info,root,frame:null,kind:itemType==='Asset'?'asset':'idle',playing:true,inView:true,marked:new Set()};state=s;
    s.load=U.button(heading,'Preview on my avatar',()=>load(s));
    s.viewport=el('div','rc-animation-viewport',root);s.placeholder=el('p','rc-animation-placeholder',s.viewport,'Preview this animation on your avatar.');
    s.selection=el('p','rc-animation-selection',root);s.selection.dataset.rcI18nIgnore='';
    const actions=el('div','rc-animation-actions',root);s.camera=U.button(actions,'Reset camera',()=>send(s,'camera'));s.camera.disabled=true;
    s.status=el('p','rc-animation-status',root);s.status.setAttribute('role','status');
    el('p','rc-animation-hint',root,'Preview only. Your equipped avatar is not changed.');
    if(itemType==='Bundle'){host.setAttribute('data-rc-animation-studio','');preview.setAttribute('data-rc-animation-preview','');info.setAttribute('data-rc-animation-info','');preview.setAttribute('data-rc-animation-title',t('Animation preview'));}
    preview.after(root);
    if(typeof IntersectionObserver==='function'){s.visibility=new IntersectionObserver(entries=>{if(state!==s)return;s.inView=entries[0]?.isIntersecting!==false;send(s,'active',{active:s.inView&&!document.hidden});});s.visibility.observe(root);}
    U.localize(root);nativeControls(s);
  }
  function sync(){
    const target=context(),id=target?.id,itemType=target?.itemType,preview=id?document.querySelector('#item-thumbnail-container-frontend'):null;
    if(!id||!active()||!preview||Number(preview.getAttribute('data-target-id'))!==id
      ||(itemType==='Bundle'?preview.getAttribute('data-is-animation-bundle')!=='true'
        :preview.getAttribute('data-is-bundle')==='true'||!preview.querySelector('.thumbnail-animation-container')&&!preview.hasAttribute('data-rc-item-animation'))){close();return;}
    const host=preview.parentElement,info=host?.querySelector('#item-info-container-frontend');if(!info||info.parentElement!==host||Number(info.getAttribute('data-target-id'))!==id){close();return;}
    if(state&&(state.id!==id||state.itemType!==itemType||state.preview!==preview||state.host!==host||state.info!==info))close();
    if(!state)mount(id,itemType,preview,host,info);
    else{if(itemType==='Bundle')attribute(preview,'data-rc-animation-title',t('Animation preview'));if(state.root.parentElement!==host||state.root.previousElementSibling!==preview)preview.after(state.root);nativeControls(state);}
  }
  const options={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-target-id','data-is-bundle','data-is-animation-bundle','data-rc-frost-page','class']};
  function queue(){if(queued)return;queued=true;const run=()=>{queued=false;observer.disconnect();try{sync();}finally{observer.observe(document,options);}};
    // First mounts are styled before paint; subsequent control updates share a frame.
    if(state&&!document.hidden)requestAnimationFrame(run);else queueMicrotask(run);
  }
  const controlSelector='.bundle-animation-button,.bundle-animation-label,.thumbnail-button-container';
  const mountSelector='#item-thumbnail-container-frontend,#item-info-container-frontend';
  function relevant(record){
    const target=record.target instanceof Element?record.target:record.target.parentElement;
    if(!target||target.closest('#rc-animation-user-preview'))return false;
    if(target===document.documentElement)return record.attributeName==='data-rc-frost-page';
    if(record.type==='attributes'){
      if(record.attributeName!=='class')return target.matches(mountSelector);
      return !!state?.preview.contains(target)&&!!target.closest(controlSelector);
    }
    if(record.type==='characterData')return !!state&&(!!target.closest('.bundle-animation-label')
      ||state.itemType==='Asset'&&state.info.contains(target)&&!!target.closest('h1'));
    if(state?.preview.contains(target)){
      if(target.closest(controlSelector))return true;
      // Canvas/loading/drag updates do not change the animation controls.
      return [...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element
        &&(node.matches(controlSelector)||node.querySelector(controlSelector)));
    }
    if(state?.info.contains(target))return state.itemType==='Asset'&&(!!target.closest('h1')
      ||[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element&&(node.matches('h1')||node.querySelector('h1'))));
    return target===state?.host||[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element
      &&(node.matches(mountSelector)||node.querySelector(mountSelector)||state&&(node.contains(state.preview)||node.contains(state.root)||node.contains(state.info))));
  }
  const observer=new MutationObserver(records=>{const target=context();if(!target){if(state)queue();return;}
    if(state&&(state.id!==target.id||state.itemType!==target.itemType||!state.preview.isConnected||!state.info.isConnected||!state.root.isConnected)){queue();return;}
    if(records.some(relevant))queue();
  });
  observer.observe(document,options);
  addEventListener('message',event=>{
    const s=state;if(!s?.frame||event.source!==s.frame.contentWindow||event.origin!==s.origin||event.data?.type!=='rc-animation-preview-status'
      ||(s.itemType==='Asset'?event.data.assetId!==s.id||event.data.bundleId!==undefined:event.data.bundleId!==s.id||event.data.assetId!==undefined))return;
    const code=event.data.code;if(code==='boot'){configure(s);return;}
    const messages={loading:'Loading your avatar animation...',ready:'', 'ready-r15':'This animation is previewed using an R15 rig.',partial:'Some avatar items could not be displayed.',error:'Could not load the avatar preview. Try again.', 'sign-in':'Sign in to Roblox to use this tool.', 'animation-unavailable':'This animation is not available in this bundle.'};
    if(Object.hasOwn(messages,code))s.status.textContent=messages[code]?t(messages[code]):'';
    if(Object.hasOwn(messages,code)&&code!=='loading'){clearTimeout(s.timer);s.load.disabled=false;}
    s.camera.disabled=!['ready','ready-r15','partial'].includes(code);
  });
  document.addEventListener('visibilitychange',()=>{if(state)send(state,'active',{active:state.inView&&!document.hidden});});
  for(const event of ['popstate','hashchange','load'])addEventListener(event,queue);
  document.addEventListener('DOMContentLoaded',queue,{once:true});globalThis.RobloxCustomizerI18n?.onChange(()=>{if(state)U.localize(state.root);queue();});
  globalThis.RobloxCustomizerRuntime?.onResume(queue);
  globalThis.RobloxCustomizerAnimationBundle=Object.freeze({refresh:queue});queue();
});
