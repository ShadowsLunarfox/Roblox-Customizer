/* Read-only model explorer. UI and interaction code are independently implemented. */
(() => {
  'use strict';
  if(globalThis.RobloxCustomizerResourceExplorer)return;
  const U=globalThis.RobloxCustomizerToolsUI,ROW_HEIGHT=28;
  const format=value=>globalThis.RobloxCustomizerModelReader?.format(value)??String(value??'');
  const set=(node,text)=>{if(node.textContent!==String(text))node.textContent=String(text);};
  function icon(parent,kind){
    const span=U.el('span','rc-object-icon',parent),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 20 20');svg.setAttribute('aria-hidden','true');span.append(svg);
    span.dataset.kind=/script/i.test(kind)?'script':/attachment|bone/i.test(kind)?'attachment':/mesh/i.test(kind)?'mesh':/folder/i.test(kind)?'folder':/model|accessory|tool/i.test(kind)?'model':'part';
    const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',span.dataset.kind==='folder'?'M2 5h6l2 2h8v10H2z':span.dataset.kind==='script'?'M5 2h7l4 4v12H5z M12 2v5h4 M7 10h6 M7 13h6':span.dataset.kind==='attachment'?'M10 2v16 M2 10h16 M6 6h8v8H6z':'M10 2 18 6v8l-8 4-8-4V6z M2 6l8 4 8-4 M10 10v8');svg.append(path);return span;
  }
  function groupFor(name){
    if(/^(?:Color|Color3|BrickColor|Material|Transparency|Reflectance|Texture|TextureID|TextureId|MeshId|MeshContent|TextureContent|CastShadow|DoubleSided|VertexColor)/i.test(name))return 'Appearance';
    if(/Pivot|WorldPivot/i.test(name))return 'Pivot';
    if(/CFrame|Position|Orientation|Rotation|Size|Scale|Offset/i.test(name))return 'Transform';
    if(/Collision|CanCollide|CanTouch|CanQuery/i.test(name))return 'Collision';
    if(/Anchored|Disabled|Enabled|Massless|Locked|Archivable/i.test(name))return 'Behavior';
    return 'Data';
  }
  function create(parent){
    const root=U.el('div','rc-model-explorer',parent);root.hidden=true;
    let entries=[],roots=[],byId=new Map(),selected=null,expanded=new Set(),visible=[],model=null,filter='',propertyFilter='',dialog=null,renderedSelection=null;
    const closedGroups=new Set();
    const left=U.el('section','rc-explorer-pane rc-explorer-objects',root),leftHeader=U.el('div','rc-explorer-pane-header',left);
    U.el('h4','',leftHeader,'Explorer');const total=U.el('span','rc-explorer-count',leftHeader);total.dataset.rcI18nIgnore='';
    const collapse=U.button(leftHeader,'−',()=>{expanded.clear();refreshTree();});collapse.title='Collapse all';collapse.setAttribute('aria-label','Collapse all');
    const expand=U.button(leftHeader,'+',()=>{expanded=new Set(entries.filter(e=>e.children.length).map(e=>e.key));refreshTree();});expand.title='Expand all';expand.setAttribute('aria-label','Expand all');
    const search=U.el('input','rc-explorer-filter',left);search.type='search';search.placeholder='Filter model';search.setAttribute('aria-label','Filter model');search.maxLength=100;
    const tree=U.el('div','rc-resource-tree rc-object-tree',left);tree.setAttribute('role','tree');tree.setAttribute('aria-label','Model objects');tree.tabIndex=0;
    const divider=U.el('div','rc-explorer-divider',root);divider.setAttribute('role','separator');divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-label','Resize explorer');divider.setAttribute('aria-valuemin','25');divider.setAttribute('aria-valuemax','70');divider.tabIndex=0;
    const right=U.el('section','rc-explorer-pane rc-explorer-properties',root),rightHeader=U.el('div','rc-explorer-pane-header',right);U.el('h4','',rightHeader,'Properties');U.el('span','rc-explorer-readonly',rightHeader,'Read only');
    const selection=U.el('div','rc-explorer-selection',right);selection.dataset.rcI18nIgnore='';
    const propertySearch=U.el('input','rc-explorer-filter',right);propertySearch.type='search';propertySearch.placeholder='Filter properties';propertySearch.setAttribute('aria-label','Filter properties');propertySearch.maxLength=100;
    const properties=U.el('div','rc-properties-list',right),notice=U.el('p','rc-tools-hint rc-explorer-notice',root);notice.setAttribute('role','status');
    let ratio=38;
    function resize(value){ratio=Math.max(25,Math.min(70,value));root.style.setProperty('--rc-tree-width',`${ratio}%`);divider.setAttribute('aria-valuenow',String(Math.round(ratio)));}
    resize(ratio);
    divider.addEventListener('pointerdown',event=>{if(event.button!==0)return;divider.setPointerCapture(event.pointerId);event.preventDefault();});
    divider.addEventListener('pointermove',event=>{if(!divider.hasPointerCapture(event.pointerId))return;const r=root.getBoundingClientRect();resize((event.clientX-r.left)/r.width*100);});
    divider.addEventListener('pointerup',event=>{if(divider.hasPointerCapture(event.pointerId))divider.releasePointerCapture(event.pointerId);});
    divider.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home'].includes(event.key))return;event.preventDefault();resize(event.key==='Home'?38:ratio+(event.key==='ArrowLeft'?-5:5));});
    function select(entry,focus=false){
      if(!entry)return;const previous=selected;selected=entry;let changed=false,p=entry.parent;while(p){if(!expanded.has(p.key)){expanded.add(p.key);changed=true;}p=p.parent;}
      if(filter&&!visible.includes(entry)){filter='';search.value='';changed=true;}
      if(changed)refreshTree();else{for(const row of tree.querySelectorAll('[role=treeitem]'))row.setAttribute('aria-selected',String(row.dataset.nodeKey===entry.key));if(tree.querySelector(`#rc-model-node-${entry.key}`))tree.setAttribute('aria-activedescendant',`rc-model-node-${entry.key}`);}
      if(previous!==entry||renderedSelection!==selected)renderProperties();
      if(focus){const index=visible.indexOf(entry);if(index>=0){const top=index*ROW_HEIGHT;if(top<tree.scrollTop)tree.scrollTop=top;else if(top+ROW_HEIGHT>tree.scrollTop+tree.clientHeight)tree.scrollTop=top+ROW_HEIGHT-tree.clientHeight;renderRows();}tree.focus({preventScroll:true});}
    }
    function refreshTree(){
      const included=new Set();
      if(filter)for(const entry of entries)if(`${entry.node.name} ${entry.node.className}`.toLocaleLowerCase().includes(filter)){let e=entry;while(e){included.add(e.key);e=e.parent;}}
      visible=[];const walk=entry=>{if(filter&&!included.has(entry.key))return;visible.push(entry);if(filter||expanded.has(entry.key))entry.children.forEach(walk);};roots.forEach(walk);
      if(selected&&!visible.includes(selected)&&filter){selected=visible[0]||null;renderProperties();}
      renderRows();
    }
    function renderRows(){
      const scroll=tree.scrollTop,height=tree.clientHeight||360,fragment=document.createDocumentFragment();tree.removeAttribute('aria-activedescendant');
      if(!visible.length){tree.replaceChildren();U.el('p','rc-tools-hint rc-explorer-empty',tree,filter?'No matches':'No objects found.');U.localize(tree);return;}
      // Keep expanded models bounded to the viewport instead of mounting 5,000 rows.
      const start=Math.max(0,Math.floor(scroll/ROW_HEIGHT)-6),end=Math.min(visible.length,start+Math.max(30,Math.ceil(height/ROW_HEIGHT)+12));
      const before=U.el('div','rc-tree-space',fragment);before.style.height=`${start*ROW_HEIGHT}px`;before.setAttribute('role','presentation');
      for(let i=start;i<end;i++){
        const entry=visible[i],row=U.el('div','rc-object-row',fragment);row.id=`rc-model-node-${entry.key}`;row.dataset.nodeKey=entry.key;row.dataset.rcI18nIgnore='';row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(entry.depth+1));row.setAttribute('aria-selected',String(entry===selected));row.style.setProperty('--rc-node-depth',String(entry.depth));
        if(entry.children.length)row.setAttribute('aria-expanded',String(!!filter||expanded.has(entry.key)));
        const twist=U.el('span','rc-object-twist',row,entry.children.length?(filter||expanded.has(entry.key)?'▾':'▸'):'');twist.setAttribute('aria-hidden','true');
        twist.addEventListener('click',event=>{event.stopPropagation();if(entry.children.length){expanded.has(entry.key)?expanded.delete(entry.key):expanded.add(entry.key);refreshTree();}});
        icon(row,entry.node.className);const label=U.el('span','rc-object-name',row);label.dataset.rcI18nIgnore='';label.textContent=entry.node.name;row.title=`${entry.node.name} (${entry.node.className})`;
        row.addEventListener('click',()=>select(entry,true));row.addEventListener('dblclick',()=>{if(entry.children.length){expanded.has(entry.key)?expanded.delete(entry.key):expanded.add(entry.key);refreshTree();}});
        if(entry===selected)tree.setAttribute('aria-activedescendant',row.id);
      }
      const after=U.el('div','rc-tree-space',fragment);after.style.height=`${(visible.length-end)*ROW_HEIGHT}px`;after.setAttribute('role','presentation');tree.replaceChildren(fragment);tree.scrollTop=scroll;
    }
    async function copy(value){try{await navigator.clipboard.writeText(String(value));notice.textContent=U.t('Copied');}catch{notice.textContent=U.t('Copy failed');}}
    function showValue(name,value){
      dialog?.remove();dialog=U.el('dialog','rc-value-dialog rc-asset-owned',document.body);dialog.dataset.rcToolsRoot='';
      const currentDialog=dialog,header=U.el('div','rc-tools-actions',dialog),title=U.el('strong','',header);title.id='rc-property-value-title';dialog.setAttribute('aria-labelledby',title.id);U.literal(title,`${selected?.node.name||''} · ${name}`);
      U.button(header,'Copy value',()=>copy(value));U.button(header,'Download text',()=>U.download(new Blob([value],{type:'text/plain'}),`resource-${name.replace(/[^a-z0-9_-]/gi,'_')}.${/source/i.test(name)?'lua':'txt'}`));U.button(header,'Close',()=>dialog.close());
      if(value.length>131072)U.el('p','rc-tools-hint',dialog,'Showing the first 131072 characters.');
      const area=U.el('textarea','',dialog);area.readOnly=true;area.spellcheck=false;area.wrap='off';area.value=value.slice(0,131072);area.setAttribute('aria-label','Property value');
      dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();currentDialog.close();}});
      globalThis.RobloxCustomizerDialogs?.dismissOnOutside(dialog);
      dialog.addEventListener('close',()=>{currentDialog.remove();if(dialog===currentDialog)dialog=null;});U.localize(dialog);dialog.showModal();
    }
    function propertyRow(parent,name,labelValue,info,child=false){
      if(typeof info.value==='string'&&!info.unsupported)labelValue=info.value;
      if(info.type==='Enum')labelValue=globalThis.RobloxCustomizerModelSchema?.enumName(selected.node.className,name,info.value)??labelValue;
      if(/Color3/.test(info.type||'')&&info.value&&typeof info.value==='object'){const rgb=['R','G','B'].map(k=>Number(info.value[k]??info.value[k.toLowerCase()]));if(rgb.every(Number.isFinite))labelValue=`[${rgb.map(v=>Math.round(v*255)).join(', ')}]`;}
      const row=U.el('div',child?'rc-property-row rc-property-component':'rc-property-row',parent);row.dataset.propertyName=name;
      const nameCell=U.el('div','rc-property-name',row),valueCell=U.el('div','rc-property-value',row);
      const structured=info.value&&typeof info.value==='object',button=structured?U.button(nameCell,'▸',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));button.textContent=open?'▾':'▸';componentBox.hidden=!open;}):null;
      if(button){button.className='rc-property-toggle';button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Expand property');}
      U.literal(nameCell,name);nameCell.title=info.type||'string';
      const referent=info.referent??(info.value&&typeof info.value==='object'?info.value.Referent:null),target=referent===null?null:byId.get(String(referent));
      if(target){const link=U.button(valueCell,'',()=>select(target,true));link.className='rc-property-reference';link.dataset.rcI18nIgnore='';link.textContent=target.node.name;link.title=target.path;}
      else if(typeof info.value==='boolean'){const check=U.el('input','',valueCell);check.dataset.rcI18nIgnore='';check.type='checkbox';check.checked=info.value;check.disabled=true;check.setAttribute('aria-label',name);}
      else{
        if(/Color3/.test(info.type||'')&&info.value&&typeof info.value==='object'){
          const rgb=['R','G','B'].map(k=>Number(info.value[k]??info.value[k.toLowerCase()]));if(rgb.every(Number.isFinite)){const swatch=U.el('span','rc-property-swatch',valueCell);swatch.style.backgroundColor=`rgb(${rgb.map(n=>Math.max(0,Math.min(255,Math.round(n*255)))).join(' ')})`;}
        }
        const input=U.el('input','rc-property-input',valueCell);input.dataset.rcI18nIgnore='';input.type='text';input.readOnly=true;input.value=String(labelValue).slice(0,160);input.setAttribute('aria-label',name);input.title=String(labelValue).slice(0,1000);input.addEventListener('focus',()=>input.select());
      }
      const full=String(labelValue),asset=full.match(/(?:rbxassetid:\/\/|[?&]id=)(\d+)/i);
      if(asset){const a=U.el('a','rc-property-asset',valueCell,'↗');a.href=`https://www.roblox.com/catalog/${asset[1]}`;a.target='_blank';a.rel='noopener noreferrer';a.title='Open resource';a.setAttribute('aria-label','Open resource');}
      if(full.length>160||full.includes('\n')||/Source/i.test(name)){const view=U.button(valueCell,'…',()=>showValue(name,full));view.className='rc-property-view';view.title='View value';view.setAttribute('aria-label','View value');}
      const copyButton=U.button(valueCell,'⧉',()=>copy(full));copyButton.className='rc-property-copy';copyButton.title='Copy value';copyButton.setAttribute('aria-label','Copy value');
      const componentBox=structured?U.el('div','rc-property-components',parent):null;
      if(componentBox){componentBox.hidden=true;const componentEntries=Object.entries(info.value).slice(0,32);for(const [key,value]of componentEntries)propertyRow(componentBox,key,format(value),{type:typeof value,value:typeof value==='object'?format(value):value},true);}
    }
    function renderProperties(){
      properties.replaceChildren();renderedSelection=selected;selection.replaceChildren();
      if(!selected){U.el('p','rc-tools-hint rc-explorer-empty',properties,'Select an object to view its properties.');U.localize(root);return;}
      icon(selection,selected.node.className);U.literal(selection,`${selected.node.className} · ${selected.node.name}`);selection.title=selected.path;
      const node=selected.node,all=[['ClassName',node.className,{type:'string',value:node.className}],...node.properties.map(([name,value])=>[name,value,node.propertyInfo?.[name]||{type:'string',value}])];
      if(!all.some(p=>p[0]==='Name'))all.unshift(['Name',node.name,{type:'string',value:node.name}]);
      if(!all.some(p=>p[0]==='Parent'))all.push(['Parent',selected.parent?.node.name||'null',{type:'Instance',value:selected.parent?.node.id??null,referent:selected.parent?.node.id??null}]);
      const groups=new Map();for(const [name,value,info]of all){const enumValue=info.type==='Enum'?globalThis.RobloxCustomizerModelSchema?.enumName(node.className,name,info.value)||'':'';if(propertyFilter&&!`${name} ${value.slice(0,2000)} ${enumValue}`.toLocaleLowerCase().includes(propertyFilter))continue;const title=globalThis.RobloxCustomizerModelSchema?.property(node.className,name)?.[0]||groupFor(name);if(!groups.has(title))groups.set(title,[]);groups.get(title).push([name,value,info]);}
      const order=['Appearance','Data','Transform','Pivot','Behavior','Collision','Part'];
      for(const title of [...order,...[...groups.keys()].filter(g=>!order.includes(g)).sort()]){
        const rows=groups.get(title);if(!rows)continue;const details=U.el('details','rc-property-group',properties);details.open=!closedGroups.has(title);U.el('summary','',details,title);const body=U.el('div','',details);
        for(const [name,value,info]of rows.sort((a,b)=>a[0].localeCompare(b[0])))propertyRow(body,name,value,info);
        details.addEventListener('toggle',()=>{details.open?closedGroups.delete(title):closedGroups.add(title);});
      }
      if(!groups.size)U.el('p','rc-tools-hint rc-explorer-empty',properties,'No matches');U.localize(root);
    }
    search.addEventListener('input',()=>{filter=search.value.trim().toLocaleLowerCase();tree.scrollTop=0;refreshTree();});
    propertySearch.addEventListener('input',()=>{propertyFilter=propertySearch.value.trim().toLocaleLowerCase();renderProperties();});
    tree.addEventListener('scroll',renderRows,{passive:true});
    tree.addEventListener('keydown',event=>{
      if(!visible.length||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key))return;event.preventDefault();
      const i=Math.max(0,visible.indexOf(selected)),entry=visible[i];
      if(event.key==='ArrowDown')select(visible[Math.min(visible.length-1,i+1)],true);
      else if(event.key==='ArrowUp')select(visible[Math.max(0,i-1)],true);
      else if(event.key==='Home'||event.key==='End')select(event.key==='Home'?visible[0]:visible.at(-1),true);
      else if(event.key==='ArrowRight'){if(entry.children.length&&!expanded.has(entry.key)){expanded.add(entry.key);refreshTree();}else if(entry.children.length)select(entry.children[0],true);}
      else if(event.key==='ArrowLeft'){if(expanded.has(entry.key)){expanded.delete(entry.key);refreshTree();}else if(entry.parent)select(entry.parent,true);}
      else if(entry.children.length){expanded.has(entry.key)?expanded.delete(entry.key):expanded.add(entry.key);refreshTree();}
    });
    const sizeObserver=new ResizeObserver(()=>{if(!root.hidden)renderRows();});sizeObserver.observe(tree);
    const stopLocale=globalThis.RobloxCustomizerI18n?.onChange(()=>{if(model){set(total,U.t('{count} objects',{count:entries.length}));U.localize(root);}});
    function load(resource){
      dialog?.remove();dialog=null;model=resource;entries=[];roots=[];byId=new Map();expanded=new Set();selected=null;filter='';propertyFilter='';search.value='';propertySearch.value='';notice.textContent='';tree.scrollTop=0;
      const add=(node,parent,depth)=>{if(entries.length>=5000||depth>128)return null;const entry={node,parent,depth,key:String(entries.length),children:[],path:parent?`${parent.path}.${node.name}`:node.name};entries.push(entry);if(node.id!==undefined&&!byId.has(String(node.id)))byId.set(String(node.id),entry);for(const child of node.children||[]){const c=add(child,entry,depth+1);if(c)entry.children.push(c);}return entry;};
      for(const node of resource.nodes||[]){const e=add(node,null,0);if(e){roots.push(e);expanded.add(e.key);}}
      set(total,U.t('{count} objects',{count:entries.length}));root.hidden=false;selected=roots[0]||null;refreshTree();renderProperties();
      if(resource.partial)notice.textContent=U.t('Some binary properties are shown as raw type information.');
    }
    U.localize(root);
    return {root,load,destroy(){dialog?.remove();sizeObserver.disconnect();stopLocale?.();entries=[];roots=[];byId.clear();model=null;root.remove();}};
  }
  globalThis.RobloxCustomizerResourceExplorer=Object.freeze({create});
})();
