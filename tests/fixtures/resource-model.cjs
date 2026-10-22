const zlib=require('node:zlib');
const uint=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const str=s=>Buffer.concat([uint(Buffer.byteLength(s)),Buffer.from(s)]);
const interleave=(values,width=4)=>Buffer.from(Array.from({length:width},(_,lane)=>values.map(v=>Number((BigInt(v)>>BigInt((width-1-lane)*8))&255n))).flat());
const ints=values=>interleave(values.map(v=>((v<<1)^(v>>31))>>>0));
const refs=values=>{let last=0;return ints(values.map(v=>{const delta=v-last;last=v;return delta}));};
const floats=values=>interleave(values.map(v=>{const b=Buffer.alloc(4);b.writeFloatLE(v);const u=b.readUInt32LE();return ((u<<1)|(u>>>31))>>>0;}));
const doubles=values=>Buffer.concat(values.map(v=>{const b=Buffer.alloc(8);b.writeDoubleLE(v);return b}));
const vector=values=>Buffer.concat([0,1,2].map(i=>floats(values.map(v=>v[i]))));
const source='globalThis.resourceExecuted = true;\n-- Read only fixture; must never execute\n'+('print("<img src=x onerror=alert(1)>")\n'.repeat(6));
function chunk(kind,bytes,compression='zstd'){
  const data=compression==='zstd'?zlib.zstdCompressSync(bytes):bytes;
  return Buffer.concat([Buffer.from(kind),uint(compression==='none'?0:data.length),uint(bytes.length),uint(0),data]);
}
const inst=(index,name,ids,compression)=>chunk('INST',Buffer.concat([uint(index),str(name),Buffer.from([0]),uint(ids.length),refs(ids)]),compression);
const prop=(index,name,type,bytes,compression)=>chunk('PROP',Buffer.concat([uint(index),str(name),Buffer.from([type]),bytes]),compression);
function model({compression='zstd',unknown=false,wide=0,sourceText=source}={}){
  const header=Buffer.alloc(32);header.write('<roblox!');header.set([137,255,13,10,26,10],8);header.writeUInt32LE(6,16);header.writeUInt32LE(7+wide,20);
  const chunks=[chunk('SSTR',Buffer.concat([uint(0),uint(1),Buffer.alloc(16),str(sourceText)]),compression),
    inst(0,'Accessory',[0],compression),inst(1,'Part',[1,6],compression),inst(2,'SpecialMesh',[2],compression),inst(3,'Attachment',[3],compression),inst(4,'Script',[4],compression),inst(5,'ObjectValue',[5],compression),
    prop(0,'Name',1,str('Test accessory'),compression),prop(1,'Name',1,Buffer.concat([str('Handle'),str('Decoration')]),compression),
    prop(1,'Anchored',2,Buffer.from([0,1]),compression),prop(1,'Transparency',4,floats([.25,.5]),compression),prop(1,'CustomInteger',3,ints([-123,456]),compression),prop(1,'CustomDouble',5,doubles([1.25,-2.5]),compression),
    prop(1,'Size',14,vector([[2,3,4],[5,6,7]]),compression),prop(1,'Color',26,Buffer.from([51,100,153,120,255,140]),compression),prop(1,'Material',18,interleave([256,512]),compression),
    prop(1,'CFrame',16,Buffer.concat([Buffer.from([2,2]),vector([[1,2,3],[4,5,6]])]),compression),
    prop(2,'Name',1,str('Mesh'),compression),prop(2,'MeshId',34,Buffer.concat([interleave([1]),uint(1),str('rbxassetid://1234'),uint(0),uint(0)]),compression),prop(2,'TextureId',1,str('rbxassetid://5678'),compression),
    prop(3,'Name',1,str('HatAttachment'),compression),prop(3,'CFrame',16,Buffer.concat([Buffer.from([2]),vector([[0,.5,0]])]),compression),
    prop(4,'Name',1,str('Read only script'),compression),prop(4,'Source',28,interleave([0]),compression),prop(5,'Name',1,str('HandleReference'),compression),prop(5,'Value',19,refs([1]),compression)];
  if(unknown)chunks.push(prop(0,'FutureProperty',255,Buffer.from([1,2,3]),compression));
  const all=[0,1,2,3,4,5,6],parents=[-1,0,1,1,0,0,0];
  if(wide){const ids=Array.from({length:wide},(_,i)=>7+i);chunks.push(inst(6,'Folder',ids,compression),prop(6,'Name',1,Buffer.concat(ids.map(i=>str('Child '+i))),compression));all.push(...ids);parents.push(...ids.map(()=>0));}
  chunks.push(chunk('PRNT',Buffer.concat([Buffer.from([0]),uint(all.length),refs(all),refs(parents)]),compression),chunk('END\0',Buffer.from('</roblox>'),'none'));
  return Buffer.concat([header,...chunks]);
}
module.exports={model,source,uint,str,interleave,ints,refs,floats,chunk,prop};
