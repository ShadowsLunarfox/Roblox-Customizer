(globalThis.RobloxCustomizerCompatibility?.runFeature||(fn=>fn()))(()=>{
  'use strict';
  const U=globalThis.RobloxCustomizerToolsUI,C=globalThis.RobloxCustomizerAssetCore;
  const parts=[['headColor3','Head'],['torsoColor3','Torso'],['leftArmColor3','Left arm'],['rightArmColor3','Right arm'],['leftLegColor3','Left leg'],['rightLegColor3','Right leg']];
  let state=null,queued=false;
  const onPage=()=>/^\/my\/avatar(?:\/|$)/i.test(globalThis.RobloxCustomizerRoutes?.pathname()||location.pathname);
  const current=s=>state===s&&s.root.isConnected&&onPage();
  function figure(parent){
    const holder=U.el('div','rc-avatar-color-figure',parent),svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 120 150');svg.setAttribute('role','img');svg.setAttribute('aria-label','Body color preview');holder.append(svg);
    const shapes={headColor3:[43,5,34,32],torsoColor3:[34,41,52,53],leftArmColor3:[6,41,23,53],rightArmColor3:[91,41,23,53],leftLegColor3:[34,99,23,46],rightLegColor3:[63,99,23,46]};
    const nodes={};for(const [key,box]of Object.entries(shapes)){const rect=document.createElementNS(svg.namespaceURI,'rect');['x','y','width','height'].forEach((attr,i)=>rect.setAttribute(attr,box[i]));rect.setAttribute('rx','5');svg.append(rect);nodes[key]=rect;}return nodes;
  }
  function colorValues(s){const values={};for(const [key]of parts)values[key]=s.colors[key].hex.value.trim();return C.colors(values);}
  function refreshFigure(s){for(const [key]of parts){const value=s.colors[key].hex.value;if(/^#[0-9a-f]{6}$/i.test(value)){s.colors[key].picker.value=value;s.figure[key].setAttribute('fill',value);s.colors[key].hex.setCustomValidity('');}else s.colors[key].hex.setCustomValidity(U.t('Invalid body colors.'));}}
  function accessoryFields(s){
    s.refinements.replaceChildren();const item=s.data?.assets.find(a=>String(a.id)===s.accessory.value);s.adjustments={};s.applyAccessory.disabled=!item?.bounds;
    if(!item?.bounds){U.el('p','rc-tools-hint',s.refinements,'No adjustable accessories are currently equipped.');return;}
    for(const [group,title]of [['position','Position'],['rotation','Rotation'],['scale','Scale']]){
      const fieldset=U.el('fieldset','',s.refinements);U.el('legend','',fieldset,title);s.adjustments[group]={};
      for(const axis of ['X','Y','Z']){const label=U.el('label','',fieldset);label.dataset.axis=axis;U.el('span','',label,axis);const input=U.el('input','',label),bound=item.bounds[group][axis];input.type='number';input.inputMode='decimal';input.step='any';input.min=String(bound.min);input.max=String(bound.max);input.title=`${bound.min} – ${bound.max}`;input.value=String(item.meta?.[group]?.[axis]??(group==='scale'?1:0));input.setAttribute('aria-label',`${U.t(title)} ${axis}`);s.adjustments[group][axis]=input;}
    }
    U.localize(s.root);
  }
  function loaded(s,data){
    if(!current(s))return;s.data=data;
    for(const [key]of parts){const value=data.bodyColors[key]||'#FFFFFF';s.colors[key].hex.value=value;s.colors[key].picker.value=value;}
    refreshFigure(s);s.accessory.replaceChildren();
    const items=data.assets.filter(a=>a.bounds);for(const item of items){const option=U.el('option','',s.accessory,`${item.name||item.id} (${item.id})`);option.value=String(item.id);option.dataset.rcI18nIgnore='';}
    s.accessory.disabled=!items.length;s.applyColors.disabled=false;accessoryFields(s);s.status.textContent='';
  }
  async function load(s,b){await U.busy(b,s.status,async()=>{const data=await U.send({type:'rc-avatar-tools',action:'load'});loaded(s,data);});}
  async function apply(s,b,action){
    await U.busy(b,s.status,async()=>{
      if(!s.data)throw Error('Load your avatar first.');const message={type:'rc-avatar-tools',action,userId:s.data.userId};
      if(action==='colors'){
        message.colors=Object.fromEntries(Object.entries(colorValues(s)).filter(([key,value])=>value!==s.data.bodyColors[key]));
        if(!Object.keys(message.colors).length){s.status.textContent=U.t('No changes');return;}
      }
      else{message.assetId=Number(s.accessory.value);const item=s.data.assets.find(a=>a.id===message.assetId);const values={};
        for(const [group,axes]of Object.entries(s.adjustments)){values[group]={};for(const [axis,input]of Object.entries(axes)){if(!input.reportValidity())throw Error('Accessory values are outside Roblox limits.');values[group][axis]=Number(input.value);}}
        message.values=C.refinement(values,item?.bounds);
      }
      await U.send(message);if(!current(s))return;
      if(action==='colors')s.data.bodyColors={...s.data.bodyColors,...message.colors};
      else{const item=s.data.assets.find(a=>a.id===message.assetId);item.meta={...item.meta,...message.values};}
      s.status.textContent=U.t('Saved. Refresh the Roblox page to update its preview.');s.refreshPage.hidden=false;
    });
  }
  function mount(host){
    const s={...U.panel('rc-avatar-enhancements','Avatar tools',host),colors:{},data:null};state=s;
    const summary=s.root.querySelector('summary');const hint=U.el('span','rc-avatar-tools-summary-hint',summary);
    U.el('span','',hint,'Body colors');U.el('span','',hint,'Accessory adjustments');
    const toolbar=U.el('div','rc-avatar-tools-toolbar',s.body);
    U.el('p','rc-tools-hint',toolbar,'Changes apply to your Roblox avatar only after you select Apply.');
    const actions=U.el('div','rc-tools-actions',toolbar);const reload=U.button(actions,'Load current avatar',b=>load(s,b));
    s.refreshPage=U.button(actions,'Refresh page',()=>location.reload());s.refreshPage.hidden=true;
    const workspace=U.el('div','rc-avatar-tools-workspace',s.body);
    const bodyCard=U.el('section','rc-avatar-tool-card rc-avatar-body-card',workspace);
    const bodyHeading=U.el('h3','',bodyCard,'Body colors');bodyHeading.id='rc-avatar-body-colors-title';bodyCard.setAttribute('aria-labelledby',bodyHeading.id);
    const bodyEditor=U.el('div','rc-avatar-color-editor',bodyCard);s.figure=figure(bodyEditor);const colors=U.el('div','rc-avatar-tool-grid',bodyEditor);
    for(const [key,title]of parts){const label=U.el('label','',colors);U.el('span','',label,title);const fields=U.el('div','rc-color-inputs',label);
      const picker=U.el('input','',fields);picker.type='color';picker.value='#FFFFFF';picker.setAttribute('aria-label',U.t(title));
      const hex=U.el('input','',fields);hex.type='text';hex.value='#FFFFFF';hex.maxLength=7;hex.pattern='#[0-9a-fA-F]{6}';hex.setAttribute('aria-label',`${U.t(title)} HEX`);s.colors[key]={picker,hex};
      picker.addEventListener('input',()=>{hex.value=picker.value.toUpperCase();refreshFigure(s);});hex.addEventListener('input',()=>refreshFigure(s));
    }
    const colorActions=U.el('div','rc-tools-actions rc-avatar-card-actions',bodyCard);s.applyColors=U.button(colorActions,'Apply colors',b=>apply(s,b,'colors'));s.applyColors.classList.add('rc-avatar-primary');s.applyColors.disabled=true;
    U.button(colorActions,'Reset preview',()=>{if(s.data)loaded(s,s.data);});
    const accessoryCard=U.el('section','rc-avatar-tool-card rc-avatar-accessory-card',workspace);
    const accessoryHeading=U.el('h3','',accessoryCard,'Accessory adjustments');accessoryHeading.id='rc-avatar-accessory-title';accessoryCard.setAttribute('aria-labelledby',accessoryHeading.id);
    const accessoryLabel=U.el('label','rc-avatar-accessory-label',accessoryCard);U.el('span','',accessoryLabel,'Equipped accessory');
    s.accessory=U.el('select','',accessoryLabel);s.accessory.setAttribute('aria-label','Equipped accessory');s.accessory.disabled=true;
    s.refinements=U.el('div','rc-avatar-refinement',accessoryCard);s.accessory.addEventListener('change',()=>accessoryFields(s));
    const accessoryActions=U.el('div','rc-tools-actions rc-avatar-card-actions',accessoryCard);s.applyAccessory=U.button(accessoryActions,'Apply accessory',b=>apply(s,b,'accessory'));s.applyAccessory.classList.add('rc-avatar-primary');s.applyAccessory.disabled=true;
    U.el('p','rc-tools-hint',s.body,'Available accessories and adjustment limits follow Roblox’s current rules.');
    s.body.append(s.status);
    s.root.addEventListener('toggle',()=>{if(s.root.open&&!s.data&&!reload.disabled)void load(s,reload);});U.localize(s.root);
  }
  function sync(){if(!onPage()){state?.root.remove();state=null;return;}
    const native=document.querySelector('#avatar-container, #avatar-editor, [data-testid="avatar-editor"], .avatar-container');
    const filters=document.querySelector('[data-rc-avatar-categories]')||document.querySelector('#avatar-categories, .avatar-categories, .avatar-tab-container, .avatar-editor-tabs');
    const before=document.querySelector('[data-rc-avatar-item-column]')||filters;
    const host=before?.parentElement||native?.parentElement||document.querySelector('#content');if(!host)return;
    if(state&&!state.root.isConnected)state=null;if(!state)mount(host);
    if(before){if(state.root.nextElementSibling!==before)before.before(state.root);}
    else if(native){if(state.root.nextElementSibling!==native)native.before(state.root);}
    else if(host.firstElementChild!==state.root)host.prepend(state.root);
  }
  function queue(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;observer.disconnect();try{sync();}finally{observer.observe(document,{childList:true,subtree:true});}});}
  const observer=new MutationObserver(records=>{if(records.some(r=>!(r.target instanceof Element?r.target:r.target.parentElement)?.closest('[data-rc-tools-root]')))queue();});
  observer.observe(document,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',queue,{once:true});addEventListener('popstate',queue);queue();
});
