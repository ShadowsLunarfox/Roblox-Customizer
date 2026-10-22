/* Independent, bounded reader for Roblox binary model files.
   Format references: github.com/rojo-rbx/rbx-dom/blob/master/docs/binary.md
   Zstandard implementation: fzstd 0.1.1 (MIT), see vendor/fzstd.LICENSE. */
(function(root){
  'use strict';
  const MAX_BYTES=32*1024*1024,MAX_EXPANDED=128*1024*1024,MAX_NODES=5000,MAX_PROPERTIES=128;
  const zstd=root.fzstd||(typeof module==='object'&&module.exports?require('./vendor/fzstd-0.1.1.js'):null);
  const utf8=new TextDecoder(),bad=message=>{throw Error(message||'Unsupported or damaged resource.');};
  const types=['Unknown','string','bool','int','float','double','UDim','UDim2','Ray','Faces','Axes','BrickColor','Color3','Vector2','Vector3','Vector2int16','CFrame','Quaternion','Enum','Instance','Vector3int16','NumberSequence','ColorSequence','NumberRange','Rect','PhysicalProperties','Color3uint8','int64','SharedString','Bytecode','OptionalCFrame','UniqueId','Font','SecurityCapabilities','Content'];
  function reader(bytes){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=0;
    const take=n=>{if(!Number.isSafeInteger(n)||n<0||p+n>bytes.length)bad();const result=bytes.subarray(p,p+n);p+=n;return result;};
    const number=(size,method)=>{take(size);return view[method](p-size,true);};
    return {get left(){return bytes.length-p;},take,u8:()=>number(1,'getUint8'),u16:()=>number(2,'getUint16'),i16:()=>number(2,'getInt16'),u32:()=>number(4,'getUint32'),f32:()=>number(4,'getFloat32'),f64:()=>number(8,'getFloat64'),
      string(){return utf8.decode(take(this.u32()));},
      uints(n,width=4){const b=take(n*width);return Array.from({length:n},(_,i)=>{let value=0n;for(let lane=0;lane<width;lane++)value=(value<<8n)|BigInt(b[lane*n+i]);return width===4?Number(value):value;});},
      ints(n){return this.uints(n).map(v=>(v>>>1)^-(v&1));},
      refs(n){let sum=0;return this.ints(n).map(v=>sum+=v);},
      floats(n){const temp=new DataView(new ArrayBuffer(4));return this.uints(n).map(v=>{temp.setUint32(0,(v>>>1)|(v<<31));return temp.getFloat32(0);});}
    };
  }
  function count(r){const n=r.u32();if(n>MAX_NODES)bad('This model contains too many instances to explore.');return n;}
  function lz4(input,size){
    if(size<0||size>MAX_EXPANDED)bad('Resource is too large to explore.');const out=new Uint8Array(size);let p=0,q=0;
    const length=n=>{if(n===15){let b;do{if(p>=input.length)bad();b=input[p++];n+=b;}while(b===255);}return n;};
    while(p<input.length){const token=input[p++],literal=length(token>>>4);if(p+literal>input.length||q+literal>size)bad();out.set(input.subarray(p,p+literal),q);p+=literal;q+=literal;if(p===input.length)break;
      if(p+2>input.length)bad();const distance=input[p++]|(input[p++]<<8),n=length(token&15)+4;if(!distance||distance>q||q+n>size)bad();for(let i=0;i<n;i++,q++)out[q]=out[q-distance];}
    if(q!==size)bad();return out;
  }
  function decompressZstd(bytes,size){
    // Validate the entire frame before a third-party decoder allocates its window.
    const r=reader(bytes);if(r.u32()!==0xfd2fb528)bad();const flags=r.u8(),single=!!(flags&32),sizeFlag=flags>>>6;
    if(flags&8)bad();let window=0;if(!single){const wd=r.u8(),base=2**(10+(wd>>>3));window=base*(1+(wd&7)/8);}
    const dict=r.take([0,1,2,4][flags&3]);if(dict.some(v=>v!==0))bad('Unsupported or damaged resource.');
    const fieldSize=sizeFlag?[0,2,4,8][sizeFlag]:single?1:0,b=r.take(fieldSize);let content=0n;
    for(let i=b.length-1;i>=0;i--)content=(content<<8n)|BigInt(b[i]);if(fieldSize===2)content+=256n;
    if(single)window=Number(content);if(window>MAX_EXPANDED||content>BigInt(MAX_EXPANDED))bad('Resource is too large to explore.');
    if(fieldSize&&content!==BigInt(size))bad();
    let last=false,blocks=0;while(!last){if(++blocks>65536)bad();const h=r.take(3),bits=h[0]|(h[1]<<8)|(h[2]<<16),type=(bits>>>1)&3,n=bits>>>3;last=!!(bits&1);if(type===3||n>131072)bad();r.take(type===1?1:n);}
    if(flags&4)r.take(4);if(r.left)bad();if(!zstd)bad('This tool is unavailable.');
    const out=new Uint8Array(size);let written=0;
    const stream=new zstd.Decompress(chunk=>{if(written+chunk.length>size)bad('Resource is too large to explore.');out.set(chunk,written);written+=chunk.length;});
    try{stream.push(bytes,true);}catch(error){if(/too large/.test(error.message))throw error;bad();}
    if(written!==size)bad();return out;
  }
  const text=value=>typeof value==='bigint'?String(value):Array.isArray(value)?value.map(text).join(', '):value&&typeof value==='object'?Object.entries(value).map(([k,v])=>`${k}: ${text(v)}`).join('; '):typeof value==='number'&&Number.isFinite(value)?String(Number(value.toPrecision(8))):String(value??'');
  function values(r,n,type,shared,depth=0){
    if(depth>3)bad();const each=fn=>Array.from({length:n},fn),components=(names,float=true)=>{const lanes=names.map(()=>float?r.floats(n):r.ints(n));return each((_,i)=>Object.fromEntries(names.map((name,k)=>[name,lanes[k][i]])));};
    switch(type){
      case 1:return each(()=>r.string());
      case 2:return each(()=>r.u8()!==0);
      case 3:return r.ints(n);
      case 4:return r.floats(n);
      case 5:return each(()=>r.f64());
      case 6:{const scales=r.floats(n),offsets=r.ints(n);return each((_,i)=>({Scale:scales[i],Offset:offsets[i]}));}
      case 7:{const x=r.floats(n),y=r.floats(n),ox=r.ints(n),oy=r.ints(n);return each((_,i)=>({X:{Scale:x[i],Offset:ox[i]},Y:{Scale:y[i],Offset:oy[i]}}));}
      case 8:return each(()=>({Origin:eachXYZ(()=>r.f32()),Direction:eachXYZ(()=>r.f32())}));
      case 9:case 10:{const labels=type===9?['Right','Top','Back','Left','Bottom','Front']:['X','Y','Z'];return each(()=>{const bits=r.u8();return Object.fromEntries(labels.map((name,i)=>[name,!!(bits&(1<<i))]));});}
      case 11:case 18:return r.uints(n);
      case 12:return components(['R','G','B']);
      case 13:return components(['X','Y']);
      case 14:return components(['X','Y','Z']);
      case 16:{const axes=[[1,0,0],[0,1,0],[0,0,1],[-1,0,0],[0,-1,0],[0,0,-1]],rotations=each(()=>{const key=r.u8();if(!key)return Array.from({length:9},()=>r.f32());const right=axes[Math.floor((key-1)/6)],up=axes[(key-1)%6];if(!right||!up||right.reduce((a,v,i)=>a+v*up[i],0)!==0)bad();const back=[right[1]*up[2]-right[2]*up[1],right[2]*up[0]-right[0]*up[2],right[0]*up[1]-right[1]*up[0]];return [0,1,2].flatMap(i=>[right[i],up[i],back[i]]);});const positions=components(['X','Y','Z']);return each((_,i)=>({Position:positions[i],Rotation:rotations[i]}));}
      case 19:return r.refs(n).map(v=>v===-1?null:String(v));
      case 20:return each(()=>eachXYZ(()=>r.i16()));
      case 21:case 22:return each(()=>Array.from({length:count(r)},()=>{const Time=r.f32(),Value=type===21?r.f32():{R:r.f32(),G:r.f32(),B:r.f32()},Envelope=r.f32();return type===21?{Time,Value,Envelope}:{Time,Value};}));
      case 23:return each(()=>({Min:r.f32(),Max:r.f32()}));
      case 24:{const lanes=components(['MinX','MinY','MaxX','MaxY']);return lanes;}
      case 25:return each(()=>{const flag=r.u8();if(flag===0||flag===2)return null;if(flag!==1&&flag!==3)bad();const keys=['Density','Friction','Elasticity','FrictionWeight','ElasticityWeight'];if(flag===3)keys.push('AcousticAbsorption');return Object.fromEntries(keys.map(k=>[k,r.f32()]));});
      case 26:{const b=r.take(n*3);return each((_,i)=>({R:b[i]/255,G:b[n+i]/255,B:b[n*2+i]/255}));}
      case 27:case 33:return r.uints(n,8).map(v=>String((v>>1n)^-(v&1n)));
      case 28:return r.uints(n).map(i=>{if(i>=shared.length)bad();return shared[i];});
      case 29:return each(()=>{const b=r.take(r.u32());return `[Bytecode: ${b.length} bytes]`;});
      case 30:{const inner=r.u8(),items=values(r,n,inner,shared,depth+1);if(r.u8()!==2)bad();return items.map(v=>r.u8()?v:null);}
      case 31:{const b=r.take(n*16);return each((_,i)=>Array.from({length:16},(_,j)=>b[j*n+i].toString(16).padStart(2,'0')).join(''));}
      case 32:return each(()=>({Family:r.string(),Weight:r.u16(),Style:r.u8(),CachedFaceId:r.string()}));
      case 34:{const sources=r.uints(n),uris=Array.from({length:count(r)},()=>r.string()),refs=r.refs(count(r));r.refs(count(r));let u=0,f=0;return sources.map(source=>{if(source===0)return '';if(source===1){if(u>=uris.length)bad();return uris[u++];}if(source===2){if(f>=refs.length)bad();return {Referent:String(refs[f++])};}bad();});}
      default:return null;
    }
    function eachXYZ(fn){return Object.fromEntries(['X','Y','Z'].map(k=>[k,fn()]));}
  }
  function parse(bytes){
    if(bytes.length>MAX_BYTES)bad('Resource exceeds the 32 MB preview limit.');if(bytes.length<32)bad();
    const header=reader(bytes.subarray(16,24));header.u32();if(header.u32()>MAX_NODES)bad('This model contains too many instances to explore.');
    const r=reader(bytes.subarray(32)),classes=new Map(),nodes=new Map(),parents=new Map(),props=[],shared=[],chunks=[],warnings=new Set();let expanded=0;
    while(r.left){if(chunks.length>=1000)bad('Resource is too large to explore.');const kind=utf8.decode(r.take(4)),compressed=r.u32(),size=r.u32();r.u32();expanded+=size;if(expanded>MAX_EXPANDED)bad('Resource is too large to explore.');
      const raw=r.take(compressed||size);chunks.push({kind:kind.replace(/\0/g,''),compressed,size});if(kind==='END\0')break;
      const z=compressed&&raw[0]===0x28&&raw[1]===0xb5&&raw[2]===0x2f&&raw[3]===0xfd,c=reader(compressed?(z?decompressZstd(raw,size):lz4(raw,size)):raw);
      if(kind==='INST'){const classId=c.u32(),className=c.string().slice(0,200);c.u8();const n=count(c);if(nodes.size+n>MAX_NODES||classes.has(classId))bad('This model contains too many instances to explore.');const refs=c.refs(n);classes.set(classId,refs);for(const ref of refs){if(nodes.has(ref))bad();nodes.set(ref,{id:String(ref),name:className,className,properties:[],propertyInfo:Object.create(null),children:[]});}}
      else if(kind==='SSTR'){if(c.u32()!==0)bad();for(let i=0,n=count(c);i<n;i++){c.take(16);const b=c.take(c.u32()),value=utf8.decode(b);shared.push(value.includes('\0')||value.includes('\ufffd')?`[Binary: ${b.length} bytes]`:value);}}
      else if(kind==='PRNT'){if(c.u8()!==0)bad();const n=count(c),children=c.refs(n),refs=c.refs(n);children.forEach((id,i)=>parents.set(id,refs[i]));}
      else if(kind==='PROP')props.push(c);
    }
    for(const c of props){const refs=classes.get(c.u32()),name=c.string().slice(0,200),type=c.u8();if(!refs){warnings.add('Unknown instance class.');continue;}const data=values(c,refs.length,type,shared);
      if(!data)warnings.add(`Unsupported property type ${type}.`);
      refs.forEach((ref,i)=>{const node=nodes.get(ref);if(node.properties.length>=MAX_PROPERTIES){warnings.add('Some properties were omitted.');return;}const value=data?data[i]:`[Type ${type}: ${c.left} bytes]`,typeName=types[type]||`Type ${type}`,formatted=text(value).slice(0,131072);node.properties.push([name,formatted]);node.propertyInfo[name]={type:typeName,value,unsupported:!data};if(name==='Name'&&typeof value==='string')node.name=value.slice(0,2000);});
    }
    const roots=[];for(const [ref,node]of nodes){let p=parents.get(ref),depth=0;const seen=new Set([ref]);while(nodes.has(p)){if(seen.has(p)||++depth>128)bad('Invalid model hierarchy.');seen.add(p);p=parents.get(p);}const parent=nodes.get(parents.get(ref));node.parentId=parent?.id??null;if(parent)parent.children.push(node);else roots.push(node);}
    // Resolve references only to text and IDs; the public result stays acyclic.
    for(const node of nodes.values())for(const [name,info]of Object.entries(node.propertyInfo))if(info.type==='Instance'){info.referent=info.value;const target=info.value===null?null:nodes.get(Number(info.value));const pair=node.properties.find(p=>p[0]===name);pair[1]=target?target.name:info.value===null?'null':String(info.value);}
    return {kind:'RBXM',extension:'rbxm',mime:'application/octet-stream',nodes:roots,partial:warnings.size>0,warnings:[...warnings],chunks};
  }
  const api=Object.freeze({parse,lz4,decompressZstd,format:text,types});root.RobloxCustomizerModelReader=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
