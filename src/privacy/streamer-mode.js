(() => {
  'use strict';
  if (globalThis.RobloxCustomizerStreamer) return;
  const cacheKey = 'roblox-customizer-streamer-v1';
  const controls = [
    ['streamerMode','Streamer mode'],
    ['streamerHideRobux','Hide Robux balance'],
    ['streamerHideFriends','Hide friends'],
    ['streamerHideMessages','Hide messages and notifications']
  ];
  const defaults = {streamerMode:false,streamerHideRobux:true,streamerHideFriends:true,streamerHideMessages:true};
  let state = {...defaults}, mounted = null, revision = 0;
  function apply(value) {
    revision++;
    state = Object.fromEntries(controls.map(([key])=>[key,typeof value?.[key]==='boolean'?value[key]:defaults[key]]));
    const root=document.documentElement;
    if(root)for(const [key,part]of [['streamerMode','active'],['streamerHideRobux','robux'],['streamerHideFriends','friends'],['streamerHideMessages','messages']])
      root.toggleAttribute(`data-rc-streamer-${part}`,state.streamerMode&&state[key]);
    try {localStorage.setItem(cacheKey,JSON.stringify(state));} catch {}
    if(mounted?.isConnected)for(const [key]of controls){const n=mounted.querySelector(`[name="${key}"]`);n.checked=state[key];n.disabled=key!=='streamerMode'&&!state.streamerMode;}
  }
  function mountSettings(host, {get,onChange}) {
    mounted=host;host.replaceChildren();
    const heading=document.createElement('h3');heading.textContent='Streamer mode';host.append(heading);
    const hint=document.createElement('p');hint.className='rc-settings-hint';hint.textContent='Hides sensitive website content while sharing your screen.';host.append(hint);
    for(const [key,title]of controls){
      const label=document.createElement('label');label.className='rc-streamer-setting';
      const input=document.createElement('input');input.type='checkbox';input.name=key;
      const text=document.createElement('span');text.textContent=title;label.append(input,text);host.append(label);
      input.addEventListener('change',()=>onChange({[key]:input.checked}));
    }
    apply(get());globalThis.RobloxCustomizerI18n?.localize(host);
  }
  try {apply(JSON.parse(localStorage.getItem(cacheKey)||'null'));} catch {apply(null);}
  if(!document.documentElement)document.addEventListener('DOMContentLoaded',()=>apply(state),{once:true});
  const initial=revision;
  const initialRead=chrome.storage?.local?.get?.('customBackground');
  initialRead?.then(saved=>{if(initial===revision)apply(saved.customBackground);}).catch(()=>{});
  chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.customBackground){revision++;apply(changes.customBackground.newValue);}});
  globalThis.RobloxCustomizerStreamer=Object.freeze({apply,mountSettings,state:()=>({...state})});
})();
