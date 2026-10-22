const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname,'..');
test('packaged globe includes small countries, valid region codes and correctly wound geometry',async()=>{
  const {default:data}=await import(pathToFileURL(path.join(root,'src/servers/globe/countries.mjs')));
  const {geoOrthographic,geoPath}=await import(pathToFileURL(path.join(root,'src/servers/globe/geo-engine.mjs')));
  assert.ok(data.features.length>230);
  const codes=new Set();
  for(const feature of data.features){
    assert.match(feature.id,/^[A-Z]{2}$/);assert.ok(!codes.has(feature.id));codes.add(feature.id);
    const [lon,lat]=feature.properties.center;assert.ok(Math.abs(lon)<=180&&Math.abs(lat)<=90);
    const projection=geoOrthographic().rotate([-lon,-lat]).scale(200);
    const p=geoPath(projection);const area=p.area(feature);
    assert.ok(Number.isFinite(area)&&area>=0&&area<Math.PI*200**2*.9,`${feature.id} must not fill the globe's complement`);
    assert.doesNotMatch(p(feature)||'',/NaN|Infinity/);
  }
  for(const code of ['SG','HK','MY','JP','TH','KR','US','FR','NO'])assert.ok(codes.has(code));
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
  const entry=manifest.content_scripts.find(s=>s.js?.includes('src/pages/games/game-page.js'));
  assert.ok(entry.js.indexOf('src/servers/server-globe.js')<entry.js.indexOf('src/pages/games/game-page.js'));
  const exposed=manifest.web_accessible_resources.flatMap(e=>e.resources);
  for(const asset of ['geo-engine.mjs','countries.mjs'])assert.ok(exposed.includes(`src/servers/globe/${asset}`));
});
