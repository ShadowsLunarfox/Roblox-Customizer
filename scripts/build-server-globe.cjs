// Run with --download to refresh the pinned upstream inputs. Runtime uses local assets only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const cache = path.join(root, '.tmp-globe');
const output = path.join(root, 'src/servers/globe');
const sources = {
  countries: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson',
  array: 'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/dist/d3-array.min.js',
  geo: 'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/dist/d3-geo.min.js',
  arrayLicense: 'https://cdn.jsdelivr.net/npm/d3-array@3.2.4/LICENSE',
  geoLicense: 'https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/LICENSE',
  internmapLicense: 'https://raw.githubusercontent.com/mbostock/internmap/v2.0.3/LICENSE'
};
// Douglas-Peucker in longitude/latitude space. Retain small islands and ring winding.
function simplify(points, epsilon = .035) {
  if (points.length <= 4) return points;
  const keep = new Set([0, points.length - 1]), stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a,b] = stack.pop(), start=points[a], end=points[b];
    const dx=end[0]-start[0], dy=end[1]-start[1], length=dx*dx+dy*dy;
    let far=-1, distance=epsilon*epsilon;
    for(let i=a+1;i<b;i++) {
      const t=length ? Math.max(0,Math.min(1,((points[i][0]-start[0])*dx+(points[i][1]-start[1])*dy)/length)) : 0;
      const d=(points[i][0]-start[0]-t*dx)**2+(points[i][1]-start[1]-t*dy)**2;
      if(d>distance){distance=d;far=i;}
    }
    if(far!==-1){keep.add(far);stack.push([a,far],[far,b]);}
  }
  const result=[...keep].sort((a,b)=>a-b).map(i=>points[i]);
  return result.length>=4 ? result : points;
}
async function build() {
  fs.mkdirSync(cache,{recursive:true}); fs.mkdirSync(output,{recursive:true});
  if(process.argv.includes('--download')) for(const [key,url] of Object.entries(sources)) {
    const response=await fetch(url); if(!response.ok) throw Error(`${url}: ${response.status}`);
    fs.writeFileSync(path.join(cache,key),await response.text());
  }
  const read=key=>fs.readFileSync(path.join(cache,key),'utf8');
  const upstream=JSON.parse(read('countries'));
  const regions=new Map();
  upstream.features.forEach(feature=>{
    const p=feature.properties, code=p.ISO_A2_EH;
    if(!/^[A-Z]{2}$/.test(code)) return;
    const polygons=feature.geometry.type==='Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const coordinates=polygons.map(rings=>rings.map(ring=>simplify(ring).map(point=>point.map(n=>Math.round(n*1000)/1000))));
    const existing=regions.get(code);
    if(existing) existing.geometry.coordinates.push(...coordinates);
    else regions.set(code,{type:'Feature',id:code,properties:{name:p.NAME_EN||p.NAME,center:[p.LABEL_X,p.LABEL_Y]},
      geometry:{type:'MultiPolygon',coordinates}});
  });
  const features=[...regions.values()];
  fs.writeFileSync(path.join(output,'countries.mjs'),'// Natural Earth 5.1.2, 1:50m, public domain. See NOTICE.txt.\nexport default '+JSON.stringify({type:'FeatureCollection',features})+';\n');
  const engine='// Vendored d3-array 3.2.4 + d3-geo 3.1.1. See LICENSE-d3*.txt and NOTICE.txt.\nconst scope = {};\n'+
    ['array','geo'].map(key=>'(function(globalThis) {\n'+read(key)+'\n})(scope);\n').join('')+
    'export const {geoOrthographic, geoPath, geoGraticule10, geoDistance} = scope.d3;\n';
  fs.writeFileSync(path.join(output,'geo-engine.mjs'),engine);
  fs.writeFileSync(path.join(output,'LICENSE-d3-array.txt'),read('arrayLicense'));
  fs.writeFileSync(path.join(output,'LICENSE-d3-geo.txt'),read('geoLicense'));
  fs.writeFileSync(path.join(output,'LICENSE-internmap.txt'),read('internmapLicense'));
  fs.writeFileSync(path.join(output,'NOTICE.txt'),
    'Server globe: local, simplified geographic data and projection engine.\n'+
    'Natural Earth 5.1.2 countries (1:50m): public domain.\nhttps://www.naturalearthdata.com/about/terms-of-use/\n'+
    'Simplification tolerance 0.035 degrees; coordinates rounded to 0.001 degrees.\n'+
    'Map outlines are for server location selection, not precise boundary reference.\n'+
    'd3-array 3.2.4 and d3-geo 3.1.1: ISC; licenses accompany these files.\n'+
    'd3-array embeds internmap (InternMap/InternSet), also ISC; see LICENSE-internmap.txt.\n'+
    'Rebuild: node scripts/build-server-globe.cjs --download\n\nUpstream inputs (SHA-256):\n'+
    Object.entries(sources).map(([key,url])=>`${crypto.createHash('sha256').update(read(key)).digest('hex')}  ${url}`).join('\n')+'\n');
  console.log(`${features.length} countries/regions; geometry ${fs.statSync(path.join(output,'countries.mjs')).size} bytes`);
}
build().catch(error=>{console.error(error);process.exitCode=1;});
