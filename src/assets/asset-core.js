(function(root){
  'use strict';
  const MAX_BYTES=32*1024*1024, MAX_NODES=5000;
  const fail=message=>{throw new Error(message||'Unsupported or damaged resource.');};
  const id=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):0;
  const decoder=new TextDecoder();
  const cut=value=>String(value??'').slice(0,2000);
  const models=root.RobloxCustomizerModelReader||(typeof module==='object'&&module.exports?require('./model-reader.js'):null);
  const lz4=(input,size)=>{if(!models)fail('This tool is unavailable.');return models.lz4(input,size);};
  const binary=bytes=>{if(!models)fail('This tool is unavailable.');return models.parse(bytes);};
  function xml(text){
    if(typeof DOMParser!=='function')fail('XML parsing is unavailable.');
    if(/<!DOCTYPE|<!ENTITY/i.test(text))fail('Unsupported XML declarations.');
    const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))fail();let count=0;
    const item=(element,depth)=>{
      if(++count>MAX_NODES||depth>128)fail('This model contains too many instances to explore.');
      const properties=[...element.children].find(n=>n.tagName==='Properties');
      const values=[],propertyInfo=Object.create(null);
      for(const n of properties?[...properties.children].slice(0,128):[]){
        const key=cut(n.getAttribute('name')||n.tagName),type=n.tagName,raw=n.textContent;let value=raw;
        if(type==='bool')value=raw.trim()==='true';
        else if(['int','float','double','token'].includes(type)&&Number.isFinite(Number(raw)))value=Number(raw);
        else if(type==='Color3uint8'&&Number.isFinite(Number(raw))){const rgb=Number(raw);value={R:((rgb>>>16)&255)/255,G:((rgb>>>8)&255)/255,B:(rgb&255)/255};}
        else if(['Vector2','Vector3','Color3','CoordinateFrame','UDim','UDim2','PhysicalProperties'].includes(type)&&n.children.length)value=Object.fromEntries([...n.children].map(c=>[c.tagName,Number.isFinite(Number(c.textContent))?Number(c.textContent):cut(c.textContent)]));
        propertyInfo[key]={type:type==='CoordinateFrame'?'CFrame':type==='Ref'?'Instance':type==='token'?'Enum':type,value,...(type==='Ref'?{referent:raw.trim()==='null'?null:raw.trim()}:{})};
        values.push([key,(typeof value==='object'?Object.entries(value).map(([k,v])=>`${k}: ${v}`).join('; '):String(value)).slice(0,131072)]);
      }
      const nodeId=element.getAttribute('referent')||`xml-${count}`;
      return {id:nodeId,name:cut(values.find(([name])=>name==='Name')?.[1]||element.getAttribute('class')||element.tagName),
        className:cut(element.getAttribute('class')||element.tagName),properties:values,propertyInfo,
        children:[...element.children].filter(n=>n.tagName==='Item').map(n=>item(n,depth+1))};
    };
    const nodes=[...doc.documentElement.children].filter(n=>n.tagName==='Item').map(n=>item(n,0));
    const model=doc.documentElement.tagName==='roblox';
    return {kind:model?'RBXMX':'XML',extension:model?'rbxmx':'xml',mime:'application/xml',nodes:nodes.length?nodes:[{name:doc.documentElement.tagName,className:'XML',properties:[['Content',cut(text)]],children:[]}],partial:false};
  }
  function json(value){
    let count=0;const build=(name,value,depth)=>{
      if(++count>MAX_NODES||depth>64)fail('Resource is too large to explore.');
      const object=value!==null&&typeof value==='object';
      return {name,className:Array.isArray(value)?'Array':object?'Object':typeof value,properties:object?[]:[['Value',cut(value)]],
        children:object?Object.entries(value).map(([key,item])=>build(key,item,depth+1)):[]};
    };
    return {kind:'JSON',extension:'json',mime:'application/json',nodes:[build('Resource',value,0)],partial:false};
  }
  function inspect(input){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length>MAX_BYTES)fail('Resource exceeds the 32 MB preview limit.');
    const start=decoder.decode(bytes.subarray(0,200)).trimStart();
    if(start.startsWith('<roblox!'))return binary(bytes);
    if(start.startsWith('<'))return xml(decoder.decode(bytes));
    if(/^[{\[]/.test(start)){try{return json(JSON.parse(decoder.decode(bytes)));}catch(error){if(error.message.includes('too large'))throw error;}}
    const prefix=Array.from(bytes.subarray(0,12));
    const formats=[
      [prefix[0]===137&&prefix[1]===80,'PNG','png','image/png'],
      [prefix[0]===255&&prefix[1]===216,'JPEG','jpg','image/jpeg'],
      [start.startsWith('GIF8'),'GIF','gif','image/gif'],
      [start.startsWith('RIFF')&&decoder.decode(bytes.subarray(8,12))==='WEBP','WebP','webp','image/webp'],
      [start.startsWith('OggS'),'Ogg','ogg','audio/ogg'],
      [start.startsWith('ID3')||(prefix[0]===255&&(prefix[1]&224)===224),'MP3','mp3','audio/mpeg'],
      [start.startsWith('RIFF')&&decoder.decode(bytes.subarray(8,12))==='WAVE','WAV','wav','audio/wav'],
      [decoder.decode(bytes.subarray(4,8))==='ftyp','MP4','mp4','video/mp4']
    ];
    const format=formats.find(f=>f[0]);
    return {kind:format?.[1]||'Binary',extension:format?.[2]||'bin',mime:format?.[3]||'application/octet-stream',
      nodes:[{name:format?.[1]||'Binary resource',className:'File',properties:[['Size',`${bytes.length} bytes`]],children:[]}],partial:!format};
  }
  const colorKeys=['headColor3','torsoColor3','rightArmColor3','leftArmColor3','rightLegColor3','leftLegColor3'];
  function colors(value){if(!value||typeof value!=='object'||Object.keys(value).some(k=>!colorKeys.includes(k)))fail('Invalid body colors.');
    const result={};for(const [key,color]of Object.entries(value)){if(typeof color!=='string'||!/^#?[0-9a-f]{6}$/i.test(color))fail('Invalid body colors.');result[key]='#'+color.replace(/^#/,'').toUpperCase();}return result;}
  function boundsFor(rules,typeId){
    if(!rules?.accessoryRefinementTypes?.includes(typeId))return null;
    const name=rules.wearableAssetTypes?.find(t=>t.id===typeId)?.name?.replace(/\s/g,'');
    const lower=rules.accessoryRefinementLowerBounds?.[name],upper=rules.accessoryRefinementUpperBounds?.[name];if(!lower||!upper)return null;
    const result={};for(const group of ['position','rotation','scale']){result[group]={};for(const axis of ['X','Y','Z']){
      const key=Object.keys(lower[group]||{}).find(k=>k[0].toUpperCase()===axis),min=lower[group]?.[key],max=upper[group]?.[key];
      if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)return null;result[group][axis]={min,max};}}
    return result;
  }
  function refinement(value,bounds){if(!value||!bounds)fail('This accessory cannot be adjusted.');const result={};
    for(const group of ['position','rotation','scale']){result[group]={};for(const axis of ['X','Y','Z']){const number=value[group]?.[axis],limit=bounds[group][axis];
      if(typeof number!=='number'||!Number.isFinite(number)||number<limit.min||number>limit.max)fail('Accessory values are outside Roblox limits.');result[group][axis]=number;}}return result;}
  const api=Object.freeze({MAX_BYTES,MAX_NODES,id,inspect,lz4,colors,colorKeys,boundsFor,refinement});
  root.RobloxCustomizerAssetCore=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
