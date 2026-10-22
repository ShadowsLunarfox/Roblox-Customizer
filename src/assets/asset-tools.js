(globalThis.RobloxCustomizerCompatibility?.runFeature||(fn=>fn()))(()=>{
  'use strict';
  if(globalThis.RobloxCustomizerAssetTools)return;
  const U=globalThis.RobloxCustomizerToolsUI,C=globalThis.RobloxCustomizerAssetCore;
  let state=null,queued=false;
  const path=()=>globalThis.RobloxCustomizerRoutes?.pathname()||location.pathname;
  function context(){const p=path(),m=p.match(/^\/(catalog|bundles|library)\/(\d+)(?:\/|$)/)||p.match(/^\/(store\/asset)\/(\d+)(?:\/|$)/);return m?{id:C.id(m[2]),type:m[1]==='bundles'?'Bundle':'Asset'}:null;}
  const current=s=>state===s&&context()?.id===s.id&&context()?.type===s.type&&s.root.isConnected;
  const api=(s,action)=>U.send({type:'rc-asset-tools',action,assetId:s.id,itemType:s.type});
  const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s:：._-]/g,'');
  // Match only native field labels, never descriptions, titles or other user content.
  const aliases={
    id:['Asset ID','Item ID','资源 ID','物品 ID','資源 ID','ID aset','ID item','アセットID','アイテムID','รหัสแอสเซ็ต','ID แอสเซ็ต','รหัสไอเท็ม','에셋 ID','아이템 ID'],
    created:['Created','Creation date','创建时间','创建日期','已创建','創建日期','建立時間','建立日期','已建立','Dibuat','Tanggal dibuat','作成','作成日','作成日時','วันที่สร้าง','สร้างเมื่อ','생성','생성일','제작일'],
    updated:['Updated','Last updated','更新时间','更新日期','更新時間','已更新','Diperbarui','Terakhir diperbarui','更新','更新日','更新日時','อัปเดต','วันที่อัปเดต','อัปเดตล่าสุด','업데이트','업데이트됨','업데이트 날짜'],
    sales:['Sales','Sold','Reported sales','销量','銷量','销售数量','銷售數量','Penjualan','Terjual','販売数','売上','ยอดขาย','판매량','판매 수량'],
    supply:['Issued quantity','Original quantity','Quantity','发放数量','数量','發放數量','數量','Jumlah','Jumlah diterbitkan','発行数','数量','จำนวนที่แจก','จำนวน','발행 수량','수량'],
    remaining:['Remaining','剩余','剩余数量','剩餘','剩餘數量','Tersisa','残り','残数','คงเหลือ','จำนวนที่เหลือ','남은 수량','잔여 수량']
  };
  const fieldKeys=new Map(Object.entries(aliases).flatMap(([key,labels])=>labels.map(label=>[normalize(label),key])));
  function nativeFields(s){
    const result=new Map();
    for(const row of s.host.querySelectorAll('.item-info-row-container,.item-field-container')){
      if(row.closest('[data-rc-tools-root]'))continue;
      const label=row.querySelector(':scope > .row-label,:scope > .field-label');
      const key=fieldKeys.get(normalize(label?.textContent));if(key&&!result.has(key))result.set(key,row);
    }
    return result;
  }
  function clearMedia(s){s.media?.querySelectorAll('audio,video').forEach(media=>media.pause());s.media?.replaceChildren();for(const url of s.urls)URL.revokeObjectURL(url);s.urls=[];}
  function clear(){if(!state)return;state.explorer?.destroy();clearMedia(state);for(const field of state.fields.values())field.row.remove();state.copy.remove();state.root.remove();state=null;}
  function metadata(s){
    if(!current(s))return;const d=s.data||{},native=nativeFields(s),modern=!!s.section;
    const date=value=>{const n=new Date(value);return value&&!Number.isNaN(n.valueOf())?new Intl.DateTimeFormat(globalThis.RobloxCustomizerI18n?.locale()||'en',{dateStyle:'medium',timeStyle:'short'}).format(n):null;};
    const desired=new Set();
    for(const [key,label,value]of [['id','Asset ID',s.id],['created','Created',date(d.created)],['updated','Updated',date(d.updated)],
      ['sales','Reported sales',d.sales],['supply','Issued quantity',d.supply],['remaining','Remaining',d.remaining]]){
      if(native.has(key)||value===null||value===undefined)continue;desired.add(key);
      let field=s.fields.get(key);if(field&&field.modern!==modern){field.row.remove();s.fields.delete(key);field=null;}
      if(!field){
        const row=U.el('div',`rc-asset-owned ${modern?'item-info-row-container':'rc-asset-field'}`);row.dataset.rcToolsRoot='';row.dataset.rcAssetField=key;
        U.el(modern?'div':'dt',modern?'row-label':'',row,label);
        const content=U.el(modern?'div':'dd',modern?'row-content rc-asset-field-value':'rc-asset-field-value',row),text=U.literal(content,value);
        if(['sales','supply','remaining'].includes(key))row.title='Values are reported by Roblox. Unavailable sales and quantity fields are not estimated.';
        field={row,content,text,modern};s.fields.set(key,field);U.localize(row);
      }
      if(field.text.textContent!==String(value))field.text.textContent=String(value);
      const parent=s.section||s.info;if(field.row.parentElement!==parent){if(modern)parent.insertBefore(field.row,s.root);else parent.append(field.row);}
    }
    for(const [key,field]of s.fields)if(!desired.has(key)){field.row.remove();s.fields.delete(key);}
    const nativeId=native.get('id'),copyHost=nativeId?.querySelector(':scope > .row-content,:scope > .field-content')||nativeId||s.fields.get('id')?.content||s.actions;
    if(s.copy.parentElement!==copyHost)copyHost.append(s.copy);
    if(s.bundleData!==d.items){s.bundleData=d.items;s.bundle.replaceChildren();
      for(const item of d.items||[]){const a=U.el('a','',s.bundle);a.href=`https://www.roblox.com/catalog/${item.id}`;a.target='_blank';a.rel='noopener noreferrer';U.literal(a,item.name||item.id);}
    }
    U.localize(s.root);
  }
  async function loadDetails(s,b){await U.busy(b,s.status,async()=>{const data=await api(s,'details');if(!current(s))return;s.data=data;s.exportDetails.disabled=false;metadata(s);s.status.textContent='';});}
  async function loadContent(s,b){
    await U.busy(b,s.status,async()=>{
      const data=await api(s,'content');if(!current(s))return;
      const decoded=atob(data.base64),bytes=new Uint8Array(decoded.length);
      // Avoid the intermediate element list created by TypedArray.from on large strings.
      for(let i=0;i<decoded.length;i++)bytes[i]=decoded.charCodeAt(i);
      clearMedia(s);s.bytes=bytes;s.download.disabled=false;
      try{s.resource=C.inspect(bytes);}catch(error){s.resource={kind:'Binary',extension:String.fromCharCode(...bytes.subarray(0,8))==='<roblox!'?'rbxm':'bin',mime:'application/octet-stream'};s.explorer.load({nodes:[],partial:false});s.format.textContent=bytes.length.toLocaleString()+' bytes';throw error;}
      s.explorer.load(s.resource);
      s.format.textContent=`${s.resource.kind} · ${bytes.length.toLocaleString()} bytes`;
      const mime=s.resource.mime;if(/^(image|audio|video)\//.test(mime)){
        const url=URL.createObjectURL(new Blob([bytes],{type:mime}));s.urls.push(url);
        const media=U.el(mime.startsWith('image/')?'img':mime.startsWith('audio/')?'audio':'video','',s.media);media.src=url;
        if(media.tagName==='IMG')media.alt=s.data?.name||U.t('Resource preview');else{media.controls=true;media.preload='metadata';}
      }
      s.status.textContent='';
    });
  }
  function attach(s,host){
    s.host=host;s.section=host.querySelector('.item-details-section');
    const parent=s.section||host;
    if(s.root.parentElement!==parent||parent.lastElementChild!==s.root)parent.append(s.root);
    s.root.classList.toggle('rc-asset-native',!!s.section);s.info.hidden=!!s.section;
    metadata(s);
  }
  function mount(ctx,host){
    const root=U.el('section','rc-enhancement-tools rc-asset-inline',host);root.id='rc-asset-tools';root.dataset.rcToolsRoot='';
    const s={...ctx,root,urls:[],data:null,bytes:null,resource:null,fields:new Map()};state=s;
    s.info=U.el('dl','rc-tools-metadata',root);
    const actions=s.actions=U.el('div','rc-tools-actions',root);
    s.copy=U.button(null,'Copy ID',async b=>{await U.busy(b,s.status,async()=>{await navigator.clipboard.writeText(String(s.id));s.status.textContent=U.t('Copied');});});
    s.copy.className='rc-asset-owned rc-asset-copy';s.copy.dataset.rcToolsRoot='';s.copy.setAttribute('aria-label','Copy ID');U.localize(s.copy);
    const creator=U.el('a','',actions,'Creator Store');creator.href=`https://create.roblox.com/store/asset/${s.id}`;creator.target='_blank';creator.rel='noopener noreferrer';creator.hidden=s.type==='Bundle';
    s.refresh=U.button(actions,'Refresh details',b=>loadDetails(s,b));
    s.exportDetails=U.button(actions,'Export details',()=>{if(s.data)U.download(new Blob([JSON.stringify(s.data,null,2)],{type:'application/json'}),`roblox-${s.type.toLowerCase()}-${s.id}.json`);});s.exportDetails.disabled=true;
    s.status=U.el('p','rc-tools-status',root);s.status.setAttribute('role','status');s.bundle=U.el('div','rc-tools-actions',root);
    if(s.type==='Asset'){
      const resource=U.el('section','rc-resource-explorer',root),actions=U.el('div','rc-tools-actions rc-resource-heading',resource);U.el('h3','',actions,'Resource explorer');
      U.button(actions,'Load resource',b=>loadContent(s,b));
      s.download=U.button(actions,'Download file',()=>{if(s.bytes)U.download(new Blob([s.bytes],{type:s.resource.mime}),`roblox-asset-${s.id}.${s.resource.extension}`);});s.download.disabled=true;
      U.el('p','rc-tools-hint rc-resource-recovery-hint',resource,'If loading causes unexpected pop-ups, chat window issues, or other errors, refresh the page and try again.');
      s.format=U.el('p','rc-tools-hint',resource);s.format.dataset.rcI18nIgnore='';
      s.media=U.el('div','rc-resource-media',resource);s.explorer=globalThis.RobloxCustomizerResourceExplorer.create(resource);
      U.el('p','rc-tools-hint',resource,'Supports accessible XML, JSON and RBXM resources. File loading is limited to 32 MB.');
    }
    attach(s,host);U.localize(s.root);void loadDetails(s,s.refresh);
  }
  function sync(){const ctx=context();if(!ctx||!ctx.id){clear();return;}
    const host=document.querySelector('#item-info-container-frontend, #item-container .item-details, #item-details, [data-testid="asset-details"]')
      ||(location.hostname==='create.roblox.com'?document.querySelector('main'):null);
    if(!host)return;
    if(host.hasAttribute('data-target-id')&&Number(host.getAttribute('data-target-id'))!==ctx.id){clear();return;}
    if(state&&(state.id!==ctx.id||state.type!==ctx.type))clear();
    if(!state)mount(ctx,host);else attach(state,host);
  }
  function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;observer.disconnect();try{sync();}finally{observer.observe(document,observerOptions);}});}
  const observerOptions={childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-target-id','data-is-bundle']};
  const observer=new MutationObserver(records=>{if(records.some(r=>!(r.target instanceof Element?r.target:r.target.parentElement)?.closest('[data-rc-tools-root]')))queue();});
  observer.observe(document,observerOptions);addEventListener('popstate',queue);document.addEventListener('DOMContentLoaded',queue,{once:true});
  globalThis.RobloxCustomizerI18n?.onChange(()=>{if(state)metadata(state);});
  globalThis.RobloxCustomizerAssetTools=Object.freeze({refresh:queue});queue();
});
