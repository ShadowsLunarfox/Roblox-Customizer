(() => {
  'use strict';
  if(globalThis.RobloxCustomizerToolsUI)return;
  const t=(key,values)=>globalThis.RobloxCustomizerI18n?.t(key,values)||key.replace(/\{(\w+)\}/g,(_,name)=>values?.[name]??`{${name}}`);
  const el=(tag,className,parent,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;parent?.append(n);return n;};
  const button=(parent,label,action)=>{const b=el('button','',parent,label);b.type='button';b.addEventListener('click',()=>void action(b));return b;};
  const send=async message=>{const response=await(globalThis.RobloxCustomizerRuntime?.sendMessage(message)||new Promise(resolve=>chrome.runtime.sendMessage(message,resolve)));
    if(!response||response.error)throw Error(response?.error||t('This tool is unavailable.'));return response;};
  const literal=(parent,value)=>{const n=el('span','',parent,String(value));n.dataset.rcI18nIgnore='';return n;};
  const panel=(id,title,parent)=>{const root=el('details','rc-enhancement-tools',parent);root.id=id;root.dataset.rcToolsRoot='';
    el('summary','',root,title);const body=el('div','rc-tools-body',root),status=el('p','rc-tools-status',body);status.setAttribute('role','status');return {root,body,status};};
  const localize=node=>globalThis.RobloxCustomizerI18n?.localize(node);
  const busy=async(b,status,work)=>{b.disabled=true;status.textContent=t('Loading…');try{await work();}catch(error){status.textContent=t(error.message);}finally{b.disabled=false;localize(b.closest('[data-rc-tools-root]'));}};
  function download(blob,name){const url=URL.createObjectURL(blob),link=el('a','',document.body);link.href=url;link.download=name;link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
  globalThis.RobloxCustomizerToolsUI=Object.freeze({t,el,button,send,literal,panel,localize,busy,download});
})();
