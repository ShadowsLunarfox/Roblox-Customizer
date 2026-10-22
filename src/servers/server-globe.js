(() => {
  'use strict';
  if (globalThis.RobloxCustomizerServerGlobe) return;
  const instances = new WeakMap();
  const mounted = new Set();
  // A Roblox navigation may remove the entire page without another filter sync.
  new MutationObserver(records => {
    if (!mounted.size || !records.some(record => record.removedNodes.length)) return;
    for (const host of mounted) if (!host.isConnected) {
      instances.get(host)?.destroy(); instances.delete(host); mounted.delete(host);
    }
  }).observe(document, {childList:true,subtree:true});
  let assets, serial = 0;
  const loadAssets = () => assets ||= Promise.all([
    import(chrome.runtime.getURL('src/servers/globe/geo-engine.mjs')),
    import(chrome.runtime.getURL('src/servers/globe/countries.mjs'))
  ]).catch(error => { assets = null; throw error; });
  const t = (key, params) => globalThis.RobloxCustomizerI18n?.t(key, params)
    || key.replace(/\{(\w+)\}/g, (_, name) => params?.[name] ?? `{${name}}`);
  const locale = () => globalThis.RobloxCustomizerI18n?.locale() || document.documentElement.lang || 'en';
  const text = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const attr = (node, name, value) => { if (node.getAttribute(name) !== String(value)) node.setAttribute(name, value); };
  const element = (tag, className, parent) => {
    const node = document.createElement(tag); if (className) node.className = className; parent?.append(node); return node;
  };
  const svgElement = (tag, attributes, parent) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key,value] of Object.entries(attributes || {})) node.setAttribute(key, value);
    parent?.append(node); return node;
  };

  // Keep the full local geometry for clicking and the resting view. A second,
  // sub-pixel approximation avoids tracing every coastline while dragging.
  function dragRing(points, epsilon = .22) {
    if (points.length <= 4) return points;
    const keep = new Set([0, points.length - 1]), stack = [[0, points.length - 1]];
    while (stack.length) {
      const [a,b] = stack.pop(), start = points[a], end = points[b];
      const dx = end[0] - start[0], dy = end[1] - start[1], length = dx*dx + dy*dy;
      let far = -1, distance = epsilon*epsilon;
      for (let i=a+1;i<b;i++) {
        const t = length ? Math.max(0,Math.min(1,((points[i][0]-start[0])*dx+(points[i][1]-start[1])*dy)/length)) : 0;
        const d = (points[i][0]-start[0]-t*dx)**2 + (points[i][1]-start[1]-t*dy)**2;
        if (d > distance) { distance=d; far=i; }
      }
      if (far !== -1) { keep.add(far); stack.push([a,far],[far,b]); }
    }
    const result = [...keep].sort((a,b)=>a-b).map(i=>points[i]);
    return result.length >= 4 ? result : points;
  }

  function unitVectors(points) {
    const vectors=new Float64Array(points.length*3), view=new Float64Array(vectors.length);
    for(let i=0;i<points.length;i++){
      const lon=points[i][0]*Math.PI/180,lat=points[i][1]*Math.PI/180,cos=Math.cos(lat);
      vectors[i*3]=cos*Math.cos(lon);vectors[i*3+1]=cos*Math.sin(lon);vectors[i*3+2]=Math.sin(lat);
    }
    return {vectors,view};
  }

  function create(host) {
    let state, engine, features, dragFeatures, graticule, dragGrid, projection, path, context, frame = 0, active = false, destroyed = false;
    let loading = false, signature = '', selected = '', zoom = 1, drag = null, suppressClick = false;
    let rotation = [-105, -20, 0], query = '', hovered = '', countryNames = new Map();
    let preview = false, canvasScale = 0, selectedFill = '#3765ff';
    let geometrySignature = '', namesLocale = '', refreshPending = false;
    const bindings = [], countryNodes = new Map(), listNodes = new Map(), cityNodes = new Map();
    const root = element('div', 'rc-server-globe', host); root.dataset.rcI18nIgnore = '';
    const message = element('div', 'rc-server-globe-message', root); message.setAttribute('role', 'status');
    const retry = element('button', '', message); retry.type = 'button';
    const layout = element('div', 'rc-server-globe-layout', root); layout.hidden = true;
    const visual = element('div', 'rc-server-globe-visual', layout);
    const hud = element('div', 'rc-server-globe-hud', visual);
    const eyebrow = element('span', 'rc-server-globe-eyebrow', hud);
    const info = element('strong', '', hud), infoCount = element('span', '', hud);
    const id = `rc-server-globe-${++serial}`;
    const svg = svgElement('svg', {viewBox:'0 0 600 480', tabindex:'0', role:'group', 'aria-describedby':id}, visual);
    const defs = svgElement('defs', {}, svg);
    const ocean = svgElement('radialGradient', {id:`${id}-ocean`,cx:'.35',cy:'.3',r:'.8'}, defs);
    svgElement('stop', {offset:'0%', 'stop-color':'#183a65'}, ocean);
    svgElement('stop', {offset:'100%', 'stop-color':'#060f25'}, ocean);
    const atmosphere = svgElement('radialGradient', {id:`${id}-rim`}, defs);
    svgElement('stop', {offset:'88%', 'stop-color':'#55c9ff', 'stop-opacity':'0'}, atmosphere);
    svgElement('stop', {offset:'94%', 'stop-color':'#55c9ff', 'stop-opacity':'.24'}, atmosphere);
    svgElement('stop', {offset:'100%', 'stop-color':'#55c9ff', 'stop-opacity':'0'}, atmosphere);
    const rim = svgElement('circle', {cx:300,cy:248,r:213,fill:`url(#${id}-rim)`, 'pointer-events':'none'}, svg);
    const sphere = svgElement('path', {fill:`url(#${id}-ocean)`,class:'rc-server-globe-ocean'}, svg);
    const grid = svgElement('path', {class:'rc-server-globe-grid', 'pointer-events':'none'}, svg);
    const land = svgElement('g', {class:'rc-server-globe-land'}, svg);
    const markers = svgElement('g', {class:'rc-server-globe-cities'}, svg);
    const canvas = element('canvas', 'rc-server-globe-drag-canvas', visual);
    canvas.width=600; canvas.height=480; canvas.hidden=true; canvas.setAttribute('aria-hidden','true');
    const controls = element('div', 'rc-server-globe-controls', visual);
    const button = (parent, label, action, glyph) => {
      const node = element('button', '', parent); node.type = 'button';
      bindings.push(() => { text(node, glyph || t(label)); attr(node,'aria-label',t(label)); attr(node,'title',t(label)); });
      node.addEventListener('click', action); return node;
    };
    button(controls, 'Zoom in', () => setZoom(zoom * 1.25), '+');
    button(controls, 'Zoom out', () => setZoom(zoom / 1.25), '\u2212');
    button(controls, 'Reset globe view', () => { zoom = 1; focusCountry(state.country); requestDraw(); }, '\u21ba');
    const zoomLabel = element('span', '', controls);
    const help = element('p', 'rc-server-globe-help', visual); help.id = id;
    const sidebar = element('div', 'rc-server-globe-sidebar', layout);
    const sideHead = element('div', 'rc-server-globe-side-head', sidebar);
    const heading = element('strong', '', sideHead);
    button(sideHead, 'All countries', () => chooseCountry('all'));
    const searchLabel = element('label', 'rc-server-globe-search-label', sidebar);
    const searchText = element('span', '', searchLabel);
    const search = element('input', 'rc-server-globe-search', searchLabel); search.type = 'search'; search.maxLength = 100;
    const totals = element('p', 'rc-server-globe-totals', sidebar);
    const list = element('div', 'rc-server-globe-country-list', sidebar);
    const empty = element('p', 'rc-server-globe-empty', sidebar); empty.hidden = true;
    const selectedStatus = element('p', 'rc-server-globe-selection', sidebar); selectedStatus.setAttribute('role','status');

    function name(code) { return countryNames.get(code) || code; }
    function count(code) { return state.counts?.[code] || 0; }
    function refreshNames() {
      if(namesLocale===locale())return;
      namesLocale=locale();
      let display;
      try { display = new Intl.DisplayNames([locale()], {type:'region'}); } catch { /* Use dataset names. */ }
      countryNames = new Map(features.map(f => [f.id, display?.of(f.id) || f.properties.name]));
    }
    function focusCountry(code) {
      const center = features?.find(f => f.id === code)?.properties.center;
      rotation = center ? [-center[0], -center[1], 0] : [-105,-20,0];
    }
    function chooseCountry(code) {
      if (!active) return;
      drag=null;
      focusCountry(code); requestDraw(); state.onCountry(code);
    }
    function refreshInfo() {
      const code = hovered || (/^[A-Z]{2}$/.test(state.country) || state.country === 'unknown' ? state.country : '');
      text(eyebrow, t(hovered ? 'On the globe' : 'Selected location'));
      text(info, code === 'unknown' ? t('Unknown') : code ? name(code) : t('All countries'));
      const unknown = state.total - Object.values(state.counts || {}).reduce((sum, n) => sum + n, 0);
      text(infoCount, t('{count} loaded servers', {count:code === 'unknown' ? unknown : code ? count(code) : state.total}));
    }
    function refreshList() {
      const needle = query.trim().toLocaleLowerCase(locale());
      const sorted = [...features].sort((a,b) => (count(b.id)>0)-(count(a.id)>0) || count(b.id)-count(a.id)
        || name(a.id).localeCompare(name(b.id),locale()));
      let matches = 0;
      for (const feature of sorted) {
        const code = feature.id;
        let node = listNodes.get(code);
        if (!node) {
          node = element('button','rc-server-globe-country',list); node.type='button'; node.dataset.rcGlobeCode=code;
          element('span','rc-server-globe-code',node); element('span','rc-server-globe-name',node); element('span','rc-server-globe-count',node);
          node.addEventListener('click',()=>chooseCountry(code)); listNodes.set(code,node);
        }
        const match = !needle || `${code} ${name(code)} ${feature.properties.name}`.toLocaleLowerCase(locale()).includes(needle);
        node.hidden = !match; if(match) matches++;
        text(node.children[0],code); text(node.children[1],name(code)); text(node.children[2],String(count(code)));
        attr(node,'aria-pressed',state.country===code);
        attr(node,'aria-label',`${name(code)} · ${t('{count} loaded servers',{count:count(code)})}`);
        node.classList.toggle('rc-has-servers',count(code)>0);
      }
      const ordered = sorted.map(f=>listNodes.get(f.id));
      ordered.forEach((node,i)=>{if(list.children[i]!==node)list.insertBefore(node,list.children[i]||null);});
      empty.hidden = matches !== 0;
    }
    function setZoom(value) { zoom = Math.max(1,Math.min(3,value)); requestDraw(); }
    function canDraw() { return !destroyed && active && host.isConnected && !document.hidden; }
    function requestDraw() {
      if (!engine || frame || !canDraw()) return;
      frame = requestAnimationFrame(() => {
        frame=0;
        if(canDraw() && (!host.checkVisibility || host.checkVisibility())) draw();
      });
    }
    function draw() {
      const precision=drag && suppressClick ? 1.5 : .5;
      projection.rotate(rotation).scale(192*zoom).precision(precision);
      attr(svg,'data-rc-globe-rotation',rotation.slice(0,2).map(n=>n.toFixed(2)).join(','));
      attr(svg,'data-rc-globe-zoom',zoom.toFixed(2));
      text(zoomLabel,`${Math.round(zoom*100)}%`);
      if (drag && suppressClick && context) { drawPreview(); return; }
      const geometry=JSON.stringify([rotation,zoom,precision]);
      if(geometrySignature!==geometry){
        attr(rim,'r',213*zoom); attr(sphere,'d',path({type:'Sphere'})); attr(grid,'d',path(graticule));
        for(const feature of features) attr(countryNodes.get(feature.id),'d',path(feature)||'');
        geometrySignature=geometry;
      }
      drawMarkers();
      if (preview) { preview=false;canvas.hidden=true;root.classList.remove('rc-is-dragging'); }
    }
    function syncMarkers() {
      const wanted = new Set();
      for (const city of state.cities || []) {
        if (state.country!=='all' && state.country!==city.country) continue;
        if(city.latitude==null || city.longitude==null || city.latitude==='' || city.longitude==='') continue;
        const point=[Number(city.longitude),Number(city.latitude)];
        if(!point.every(Number.isFinite) || Math.abs(point[0])>180 || Math.abs(point[1])>90) continue;
        const key=JSON.stringify([city.country,city.name,...point]); wanted.add(key);
        let entry=cityNodes.get(key);
        if(!entry){
          const node=svgElement('circle',{r:5.5,class:'rc-public-server-city-marker',
            'data-rc-globe-city':city.name,role:'button'},markers);
          entry={node,title:svgElement('title',{},node),point,city};cityNodes.set(key,entry);
          node.addEventListener('click',event=>{if(!suppressClick){event.stopPropagation();state.onCity(entry.city);}});
        }
        entry.city=city;
        attr(entry.node,'aria-label',`${city.name} (${city.count})`);
        text(entry.title,`${city.name} (${city.count})`);
      }
      for(const [key,entry] of cityNodes)if(!wanted.has(key)){entry.node.remove();cityNodes.delete(key);}
    }
    function drawMarkers() {
      const center = projection.invert([300,248]);
      for(const {node,point} of cityNodes.values()) {
        const visible=engine.geoDistance(point,center)<=Math.PI/2-.025;
        attr(node,'visibility',visible?'visible':'hidden');
        if(visible){const [cx,cy]=projection(point);attr(node,'cx',cx);attr(node,'cy',cy);}
      }
    }
    function preparePreview(width) {
      try { context ||= canvas.getContext('2d'); } catch { /* SVG remains available if canvas is blocked. */ }
      if (!context) return;
      const size=Math.max(1,Math.round(width*Math.min(globalThis.devicePixelRatio||1,2)));
      if(canvas.width!==size){canvas.width=size;canvas.height=Math.round(size*.8);}
      canvasScale=canvas.width/600;
      selectedFill=getComputedStyle(root).getPropertyValue('--rc-accent').trim()||'#3765ff';
    }
    function drawPreview() {
      if(!preview){preview=true;canvas.hidden=false;root.classList.add('rc-is-dragging');}
      context.setTransform(canvasScale,0,0,canvasScale,0,0);
      context.clearRect(0,0,600,480);
      const lambda=rotation[0]*Math.PI/180,phi=rotation[1]*Math.PI/180;
      const sl=Math.sin(lambda),cl=Math.cos(lambda),sp=Math.sin(phi),cp=Math.cos(phi),radius=192*zoom;
      // Rotate cached unit vectors with one matrix per frame. Country clipping
      // uses the visible hemisphere; horizon crossings follow its circular rim.
      // No spherical resampling, SVG strings, or per-vertex trigonometry here.
      const trace=(ring,closed)=>{
        const {vectors,view}=ring,n=vectors.length/3;
        let first=-1;
        for(let i=0;i<n;i++){
          const k=i*3,x=vectors[k],y=vectors[k+1],z=vectors[k+2],a=cl*x-sl*y;
          view[k]=sl*x+cl*y;view[k+1]=-(cp*z+sp*a);view[k+2]=cp*a-sp*z;
          if(first<0&&view[k+2]>=0)first=i;
        }
        if(first<0)return;
        const start=closed?first:0,offset=start*3;
        let px=view[offset],py=view[offset+1],pz=view[offset+2],exit=0;
        if(pz>=0)context.moveTo(300+px*radius,248+py*radius);
        for(let i=1;i<n+(closed?1:0);i++){
          const k=((start+i)%n)*3,x=view[k],y=view[k+1],z=view[k+2];
          if((pz>=0)!==(z>=0)){
            const t=pz/(pz-z),ix=px+(x-px)*t,iy=py+(y-py)*t,length=Math.hypot(ix,iy)||1;
            const nx=ix/length,ny=iy/length,angle=Math.atan2(ny,nx);
            if(z>=0){
              if(closed)context.arc(300,248,radius,exit,angle,Math.atan2(Math.sin(angle-exit),Math.cos(angle-exit))<0);
              else context.moveTo(300+nx*radius,248+ny*radius);
            }else{context.lineTo(300+nx*radius,248+ny*radius);exit=angle;}
          }
          if(z>=0)context.lineTo(300+x*radius,248+y*radius);
          px=x;py=y;pz=z;
        }
        // The last segment already returns to the first point. Calling
        // closePath for every island repeatedly scans a growing native path.
      };
      context.beginPath();for(const line of dragGrid)trace(line,false);
      context.strokeStyle='#5b88ae30';context.lineWidth=.7;context.stroke();
      for(const group of [0,1,2]){
        context.beginPath();
        for(const feature of dragFeatures)if((selected===feature.id?2:count(feature.id)>0?1:0)===group)
          for(const polygon of feature.polygons)for(const ring of polygon)trace(ring,true);
        context.fillStyle=group===2?selectedFill:group===1?'#2b6878':'#253c56';
        context.strokeStyle=group===2?'#fff':group===1?'#79d9dc':'#6e93b3';
        context.lineWidth=group===2?1.3:.55;context.fill();context.stroke();
      }
      const center=projection.invert([300,248]);
      context.beginPath();
      for(const {point} of cityNodes.values())if(engine.geoDistance(point,center)<=Math.PI/2-.025){
        const [x,y]=projection(point);context.moveTo(x+5.5,y);context.arc(x,y,5.5,0,Math.PI*2);
      }
      context.fillStyle='#b8fff0';context.strokeStyle='#0b555a';context.lineWidth=2;context.fill();context.stroke();
    }
    function refresh() {
      if(!engine) return;
      if(drag&&suppressClick){refreshPending=true;requestDraw();return;}
      refreshPending=false;
      refreshNames(); bindings.forEach(fn=>fn());
      attr(svg,'aria-label',t('Interactive server globe'));
      text(help,t('Drag to rotate. Click a country to filter. Arrow keys rotate; + and − zoom.'));
      text(heading,t('Countries / regions')); text(searchText,t('Search countries'));
      text(empty,t('No countries found.'));
      text(totals,t('{count} countries with loaded servers',{count:Object.keys(state.counts||{}).length}));
      text(selectedStatus,/^[A-Z]{2}$/.test(state.country) && !count(state.country)
        ? t('No loaded servers here. Use Search to load more servers.') : '');
      if(selected!==state.country){selected=state.country;focusCountry(selected);}
      for(const [code,node] of countryNodes){
        node.classList.toggle('rc-has-servers',count(code)>0); node.classList.toggle('rc-is-selected',selected===code);
        attr(node,'aria-label',name(code));
      }
      syncMarkers(); refreshInfo(); refreshList(); requestDraw();
    }
    async function initialize() {
      if(loading || engine || destroyed) return;
      loading=true; text(message,t('Loading globe…')); message.hidden=false;
      try {
        const [geo,data]=await loadAssets(); if(destroyed)return;
        engine=geo; features=data.default.features;
        dragFeatures=features.map(feature=>({id:feature.id,
          polygons:feature.geometry.coordinates.map(polygon=>polygon.map(ring=>unitVectors(dragRing(ring))))}));
        graticule=engine.geoGraticule10();
        dragGrid=graticule.coordinates.map(unitVectors);
        projection=engine.geoOrthographic().translate([300,248]).clipAngle(90).precision(.5);
        path=engine.geoPath(projection).digits(1);
        for(const feature of features) {
          const node=svgElement('path',{'data-rc-globe-country':feature.id},land); countryNodes.set(feature.id,node);
          node.addEventListener('pointerenter',()=>{if(!drag||!suppressClick){hovered=feature.id;refreshInfo();}});
          node.addEventListener('pointerleave',()=>{if(!drag||!suppressClick){hovered='';refreshInfo();}});
        }
        message.hidden=true; layout.hidden=false; refresh();
      } catch {
        text(message,t('Could not load the globe. Country filters still work.'));
        text(retry,t('Try again'));message.append(retry);
      } finally {loading=false;}
    }
    retry.addEventListener('click',initialize);
    search.addEventListener('input',()=>{query=search.value;refreshList();});
    search.addEventListener('keydown',event=>{
      if(event.key!=='Enter')return;
      event.preventDefault();event.stopPropagation();
      [...list.children].find(node=>!node.hidden)?.click();
    });
    svg.addEventListener('click',event=>{
      if(suppressClick)return;
      const code=event.target.closest('[data-rc-globe-country]')?.getAttribute('data-rc-globe-country');
      if(code)chooseCountry(code);
    });
    svg.addEventListener('pointerdown',event=>{
      if(event.button!==0 || !active)return;
      const width=svg.getBoundingClientRect().width||600;
      preparePreview(width);
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,rotation:[...rotation],scale:240/width/zoom};suppressClick=false;
      // Capture after moving so an ordinary tap still targets its country/city.
    });
    svg.addEventListener('pointermove',event=>{
      if(!drag || drag.id!==event.pointerId)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(!suppressClick && Math.hypot(dx,dy)<5)return;
      if(!suppressClick){suppressClick=true;svg.setPointerCapture(event.pointerId);hovered='';refreshInfo();}
      rotation=[drag.rotation[0]+dx*drag.scale,Math.max(-85,Math.min(85,drag.rotation[1]-dy*drag.scale)),0];
      requestDraw();
    });
    const endDrag=()=>{const moved=suppressClick&&!!drag;drag=null;if(moved){if(refreshPending)refresh();else requestDraw();}};
    svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);svg.addEventListener('lostpointercapture',endDrag);
    svg.addEventListener('keydown',event=>{
      if(event.ctrlKey || event.metaKey || event.altKey)return;
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;
      event.preventDefault();
      if(['+','='].includes(event.key))setZoom(zoom*1.25);
      else if(event.key==='-')setZoom(zoom/1.25);
      else if(event.key==='Home'){zoom=1;focusCountry(state.country);}
      else {rotation[0]+=event.key==='ArrowLeft'?-12:event.key==='ArrowRight'?12:0;
        rotation[1]=Math.max(-85,Math.min(85,rotation[1]+(event.key==='ArrowUp'?-12:event.key==='ArrowDown'?12:0)));}
      requestDraw();
    });
    const visibility=()=>{if(document.hidden){if(frame)cancelAnimationFrame(frame);frame=0;drag=null;}else if(refreshPending)refresh();else requestDraw();};
    document.addEventListener('visibilitychange',visibility);
    return {
      update(next) {
        const wasActive=active;state=next; active=!!next.visible;
        if(!active){if(frame)cancelAnimationFrame(frame);frame=0;drag=null;}
        if(active&&!engine)void initialize();
        const nextSignature=JSON.stringify([locale(),next.country,next.city,next.counts,next.cities,next.total]);
        if(nextSignature!==signature || refreshPending&&!drag&&active){signature=nextSignature;refresh();}else if(active&&!wasActive)requestDraw();
      },
      destroy() {destroyed=true;if(frame)cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);root.remove();}
    };
  }
  globalThis.RobloxCustomizerServerGlobe = Object.freeze({
    sync(host,state){let instance=instances.get(host);if(!instance){instance=create(host);instances.set(host,instance);mounted.add(host);}instance.update(state);},
    destroy(host){instances.get(host)?.destroy();instances.delete(host);mounted.delete(host);}
  });
})();
