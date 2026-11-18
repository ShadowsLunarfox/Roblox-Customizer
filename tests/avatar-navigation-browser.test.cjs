const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Browser, isolatedChrome, pause, waitForDocument } = require('./helpers/chrome.cjs');
const animatedVideo = require('./helpers/animated-video.cjs');
const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const styles = [...new Set(manifest.content_scripts.flatMap(entry => entry.css || []))];
const scripts = ['src/shared/routes.js', 'src/shared/native-labels.js', 'src/shared/i18n.js', 'src/pages/avatar/avatar-page.js',
  'src/assets/asset-core.js', 'src/assets/tools-ui.js', 'src/assets/avatar-tools.js'];
const locales = {
  id: {
    main: ['Terbaru', 'Aksesori', 'Pakaian', 'Bagian Tubuh', 'Animasi', 'Avatar', 'Riasan', 'Latar Belakang'],
    accessories: ['Kepala', 'Wajah', 'Leher', 'Bahu', 'Depan', 'Belakang', 'Pinggang', 'Perlengkapan'],
    clothing: [['Atasan', 'Kaus', 'Kemeja', 'Sweter'], ['Pakaian Luar', 'Jaket'],
      ['Bawahan', 'Celana', 'Celana Pendek', 'Gaun & Rok'], ['Sepatu', 'Sepatu Kiri', 'Sepatu Kanan'],
      ['Klasik', 'Kemeja Klasik', 'Celana Panjang Klasik', 'Kaus Klasik']],
    animations: ['Loncat', 'Emote', 'Jalan', 'Lari', 'Jatuh', 'Renang', 'Panjat', 'Diam'],
    recent: ['Baru Ditambahkan', 'Sedang Dipakai', 'Aksesori', 'Pakaian', 'Bagian Tubuh', 'Animasi', 'Karakter', 'Kedaluwarsa'],
    avatars: ['Dibeli', 'Kreasi'], bodyFilters: ['Warna Kulit', 'Kepala', 'Skala', 'Rambut', 'Batang Tubuh', 'Lengan Kiri', 'Lengan Kanan', 'Kaki Kiri', 'Kaki Kanan'],
    makeup: ['Alis', 'Penampilan', 'Mata', 'Bibir', 'Bulu Mata'],
    body: ['Tipe Tubuh', 'Tinggi', 'Lebar', 'Kepala', 'Proporsi']
  },
  en: {
    main: ['Recently Worn', 'Accessories', 'Clothing', 'Body Parts', 'Animations', 'Expired', 'Recently Added', 'Characters'],
    accessories: ['Head', 'Face', 'Neck', 'Shoulders', 'Front', 'Back', 'Waist', 'Gear'],
    clothing: [['Tops', 'T-Shirts', 'Sweaters', 'Outerwear'], ['Outerwear', 'Jackets'],
      ['Bottoms', 'Dresses & Skirts', 'Pants', 'Shorts'], ['Shoes', 'Left Shoe', 'Right Shoe'],
      ['Classic', 'Classic Shirts', 'Classic T-Shirts', 'Classic Pants']],
    animations: ['Actions', 'Walking', 'Falling', 'Run', 'Jump', 'Swim', 'Climb', 'Idle'],
    recent: ['Currently Wearing', 'Recently Added', 'Characters'],
    body: ['Body Type', 'Height', 'Width', 'Head', 'Proportions']
  },
  'zh-cn': {
    main: ['最近穿戴', '饰品', '服装', '身体部位', '动画', '已过期', '最近新增', '角色'],
    accessories: ['头部', '脸部', '颈部', '肩部', '正面', '背部', '腰部', '装备'],
    clothing: [['上衣', 'T 恤', '织衫', '外套'], ['外衣', '夹克'],
      ['裤裙', '裙子', '裤子', '短裤'], ['鞋', '左脚鞋子', '右脚鞋子'], ['经典', '经典上衣', '经典 T 恤', '经典裤子']],
    animations: ['动作', '步行', '跌落', '奔跑', '跳跃', '游泳', '攀爬', '闲置'],
    recent: ['目前穿戴', '最近新增', '角色'],
    body: ['体型', '身高', '宽度', '头部', '比例']
  },
  'zh-tw': {
    main: ['最近穿戴', '飾品', '服裝', '身體部位', '動畫', '已過期', '最近新增', '角色'],
    accessories: ['頭部', '臉部', '頸部', '肩部', '正面', '背部', '腰部', '裝備'],
    clothing: [['上衣', 'T 恤', '織衫', '外套'], ['外衣', '夾克'],
      ['褲裙', '裙子', '褲子', '短褲'], ['鞋子', '左腳鞋子', '右腳鞋子'], ['經典', '經典上衣', '經典 T 恤', '經典褲子']],
    animations: ['動作', '步行', '跌落', '奔跑', '跳躍', '游泳', '攀爬', '閒置'],
    recent: ['目前穿戴', '最近新增', '角色'],
    body: ['體型', '身高', '寬度', '頭部', '比例']
  },
  ja: {
    main: ['最近', 'アバター', 'ボディ', 'メイク', '服装', 'アクセサリ', '背景', 'アニメ'],
    tabs: {recent:0,avatars:1,body:2,makeup:3,clothing:4,accessories:5,animations:7},
    accessories: ['頭', '顔', '首', '肩', '前面', '背中', '腰', 'ギア'],
    clothing: [['トップス', 'Tシャツ', 'シャツ', 'セーター'], ['上着', 'ジャケット'],
      ['ボトムス', 'ズボン', '短パン', 'ワンピース＆スカート'], ['靴', '靴（左）', '靴（右）'],
      ['定番', '定番のシャツ', '定番のズボン', '定番のTシャツ']],
    animations: ['リアクション', '歩く', '走る', 'ジャンプ', '落下', '泳ぐ', '登る', '待機'],
    recent: ['最近、追加されたもの', '最近の装備', 'アクセサリ', '服装', 'ボディパーツ', 'アニメ', 'キャラクター', '有効期限切れ'],
    avatars: ['購入済み', '作品'],
    bodyFilters: ['スキンのトーン', '頭', '拡大/縮小', '髪', '胴体', '左腕', '右腕', '左足', '右足'],
    makeup: ['まゆげ', 'ルックス', '目', '唇', 'まつげ'],
    body: ['体型', '身長', '幅', '頭', '比率']
  },
  th: {
    main: ['ล่าสุด', 'ไอเท็มเสริม', 'เสื้อผ้า', 'ร่างกาย', 'แอนิเมชัน', 'อวาตาร์', 'การแต่งหน้า', 'พื้นหลัง'],
    accessories: ['ศีรษะ', 'ใบหน้า', 'คอ', 'ไหล่', 'ด้านหน้า', 'ด้านหลัง', 'เอว', 'อุปกรณ์'],
    clothing: [['เสื้อผ้าท่อนบน', 'เสื้อยืด', 'เสื้อเชิ้ต', 'เสื้อสเวตเตอร์'], ['เสื้อชั้นนอก', 'เสื้อแจ็คเก็ต'],
      ['เสื้อผ้าท่อนล่าง', 'กางเกงขายาว', 'กางเกงขาสั้น', 'เดรสและกระโปรง'],
      ['รองเท้า', 'รองเท้าข้างซ้าย', 'รองเท้าข้างขวา'],
      ['คลาสสิก', 'เสื้อเชิ้ตแบบคลาสสิก', 'กางเกงขายาวแบบคลาสสิก', 'เสื้อยืดแบบคลาสสิก']],
    animations: ['ท่าทาง', 'เดิน', 'หล่น', 'วิ่ง', 'กระโดด', 'ว่ายน้ำ', 'ปีน', 'อยู่นิ่ง'],
    recent: ['เพิ่มเข้ามาล่าสุด', 'สวมใส่ล่าสุด', 'ไอเท็มเสริม', 'เสื้อผ้า', 'ส่วนของร่างกาย', 'แอนิเมชัน', 'ตัวละคร', 'หมดอายุแล้ว'],
    avatars: ['ซื้อแล้ว', 'ผลงานสร้างสรรค์'],
    bodyFilters: ['การปรับขนาด', 'ศีรษะ', 'สีผิว'],
    body: ['ประเภทร่างกาย', 'ความสูง', 'ความกว้าง', 'ศีรษะ', 'สัดส่วน']
  },
  ko: {
    main: ['최근', '장신구', '복장', '신체', '애니메이션', '아바타', '메이크업', '배경'],
    accessories: ['머리', '얼굴', '목', '어깨', '전면', '후면', '허리', '장비'],
    clothing: [['상의', '티셔츠', '셔츠', '스웨터'], ['겉옷', '재킷'],
      ['하의', '바지', '반바지', '원피스 및 치마'], ['신발', '왼쪽 신발', '오른쪽 신발'],
      ['클래식', '클래식 셔츠', '클래식 바지', '클래식 티셔츠']],
    animations: ['감정 표현', '걷기', '낙하', '달리기', '점프', '수영', '오르기', '빈둥대기'],
    recent: ['새로 추가된 아이템', '최근 장착', '장신구', '복장', '신체 부위', '애니메이션', '캐릭터', '만료됨'],
    avatars: ['구매함', '창작물'], bodyFilters: ['왼 다리', '오른 다리', '배율', '머리', '피부색'],
    body: ['신체 유형', '키', '너비', '머리', '비율']
  }
};
const tabsFor = locale => ({recent:0,accessories:1,clothing:2,body:3,animations:4,avatars:5,makeup:6,...locale.tabs});
const previewTitles = {
  en: ['3D Preview', '2D Preview'], 'zh-cn': ['3D 预览', '2D 预览'], 'zh-tw': ['3D 預覽', '2D 預覽'],
  id: ['Pratinjau 3D', 'Pratinjau 2D'], ja: ['3Dプレビュー', '2Dプレビュー'],
  th: ['ตัวอย่าง 3D', 'ตัวอย่าง 2D'], ko: ['3D 미리 보기', '2D 미리 보기']
};
const escape = text => text.replaceAll('&', '&amp;');
const localeMetadata = {
  en: 'en_us', 'zh-cn': 'zh_cn', 'zh-tw': 'zh_tw', id: 'id_id', ja: 'ja_jp', th: 'th_th', ko: 'ko_kr'
};
// Native row and link both carry handlers in some menus. Other options have
// only a text label and a delegated row handler. Both must remain operable.
const action = (name, key, plain = false) => `<li data-native-key="${key}" ${plain ? '' : 'ng-click="select()"'}>
  ${plain ? `<span id="${key}">${escape(name)}</span>` : `<a id="${key}" href="#" ng-click="select()"><span>${escape(name)}</span></a>`}</li>`;
function fixture(locale, useExtension = false) {
  const l = locales[locale];
  const tabs=tabsFor(l);
  const menuByTab=Object.fromEntries(['accessories','clothing','animations',...(l.avatars?['avatars']:[]),...(l.bodyFilters?['body']:[]),...(l.makeup?['makeup']:[])].map(menu=>[`main-${tabs[menu]}`,menu==='body'?'body-filters':menu]));
  const previewHeight = locale === 'en' ? 220 : 300;
  const bodyControls = `<section id="body-controls"><h3>${l.body[0]}</h3><label class="native-body-toggle"><span>R6</span><input id="native-body-type" type="checkbox" checked><span>R15</span></label>
    <div id="native-body-scales">${l.body.slice(1).map((name,i)=>`<label>${name}<input id="native-scale-${i}" type="range" min="0" max="150" value="${i===3?0:100}"></label>`).join('')}</div></section>`;
  const htmlAttributes = useExtension ? 'lang="en"'
    : `lang="${locale}" data-rc-ui-active data-rc-background-active data-rc-frost-page="avatar"`;
  return `<!doctype html><html ${htmlAttributes}><head><meta charset="utf-8">
    ${useExtension ? `<meta name="locale-data" data-language-code="${localeMetadata[locale]}">` : ''}
    <style>
      *{box-sizing:border-box}body{margin:0;font:16px/1.4 Arial;background:linear-gradient(120deg,#4a2233,#487681);color:#eee}
      .native-editor-shell{width:100%;max-width:720px;margin-inline:auto}
      .left-nav{display:none;position:fixed;inset:0 auto 0 0;width:250px}
      @media(min-width:1024px){.left-nav{display:block}}
      ul{margin:0;padding:0;list-style:none}a{color:inherit;text-decoration:none}button{font:inherit}
      #avatar-preview{width:300px;height:${previewHeight}px}#avatar-categories{height:80px;overflow:hidden}
      .native-scene{position:relative;width:100%;height:${previewHeight}px;background:#789 url('/image.svg?scene=one') center/cover no-repeat}
      .native-preview-host{position:relative;background:#975 url('/image.svg?wrapper') repeat;background-size:300px 300px}
      .native-scene::before,.native-scene::after,.native-preview-host::before,.native-preview-host::after{content:'';position:absolute;inset:0;background:#975 url('/image.svg?tiles') repeat;background-size:300px 300px;pointer-events:none}
      .native-backdrop{position:absolute;inset:0;background:#975 url('/image.svg?backdrop') repeat;background-size:300px 300px;pointer-events:none}
      .native-tile{position:absolute;width:50%;height:50%;background:#975 url('/image.svg?tile') no-repeat;pointer-events:none}
      .native-late-backdrop{position:absolute;inset:0;pointer-events:none}.native-late-backdrop.loaded{background:url('/image.svg?late') repeat}
      #native-model{position:relative;z-index:1}.native-control-icon{display:inline-block;width:16px;height:16px;background:url('/image.svg?icon') no-repeat}
      #main-row>li{float:left;padding:8px;width:12.5%}.avatar-subcategories{position:absolute;inset:55px 0 auto}
      .avatar-subcategories li{float:left;width:33.333%;padding:12px}
      .clothing-row{display:flex;height:70px;border:1px solid #888;border-radius:12px;padding:12px;background:#8885}
      .native-heading{width:33%;padding:10px}.native-options{width:67%}.native-options a{display:block;width:180px}
      .ng-hide,.hidden,[hidden]{display:none!important}.avatar-items-container{padding:16px}
      .avatar-item-card{display:block;width:150px;height:170px;background:#555}
      #body-controls{padding:14px;background:#8885;border:1px solid #888;border-radius:12px}#body-controls h3{margin:0 0 8px}
      .native-body-toggle{display:flex;align-items:center;gap:8px}#native-body-scales label{display:block}#native-body-scales input{display:block;width:100%}
    </style>${useExtension ? '' : styles.map(file => `<link rel="stylesheet" href="/${file}">`).join('')}
    </head><body class="dark-theme"><div class="left-nav"><a id="sidebar-avatar" aria-current="page" href="/my/avatar">${escape(l.main[tabs.avatars])}</a></div><main id="content"><div class="native-editor-shell"><div class="avatar-editor">
    <div class="preview-column"><div class="native-preview-host"><div class="native-backdrop" aria-hidden="true"></div><div id="late-inline" class="native-late-backdrop" aria-hidden="true"></div><div id="avatar-preview"><div class="native-scene"><div class="native-backdrop" aria-hidden="true"></div><div class="native-late-backdrop" aria-hidden="true"></div>${[0,1,2,3].map(i=>`<div class="native-tile" aria-hidden="true" style="left:${i%2*50}%;top:${Math.floor(i/2)*50}%"></div>`).join('')}<canvas id="native-model" width="300" height="${previewHeight}"></canvas></div><button id="native-background" type="button"><span class="native-control-icon"></span>Background</button></div></div>${locale==='zh-tw'?bodyControls:''}</div>
    <div class="inventory-column"><nav id="avatar-categories"><ul id="main-row">
      ${l.main.map((name, i) => action(name, `main-${i}`, i === 0)).join('')}
    </ul><ul id="accessories" class="avatar-subcategories">${l.accessories.map((name, i) => action(name, `accessory-${i}`, i === 0 || locale === 'ko' && [4, 5].includes(i))).join('')}</ul>
    <div id="clothing" class="avatar-subcategories" hidden>${l.clothing.map((row, i) => `<div id="clothing-row-${i}" class="clothing-row"><div class="native-heading" data-native-key="heading-${i}"><span id="heading-${i}">${escape(row[0])}</span></div><ul class="native-options">${row.slice(1).map((name, j) => action(name, `clothing-${i}-${j}`, ['id','ko'].includes(locale) || ['zh-cn', 'zh-tw'].includes(locale) && i === 3)).join('')}</ul></div>`).join('')}</div>
    <ul id="animations" class="avatar-subcategories" hidden>${l.animations.map((name, i) => action(name, `animation-${i}`, i < 3 || locale === 'ko')).join('')}</ul>
    <ul id="recent" class="avatar-subcategories" hidden>${l.recent.map((name, i) => action(name, `recent-${i}`, true)).join('')}</ul>
    ${l.avatars ? `<ul id="avatars" class="avatar-subcategories" hidden>${l.avatars.map((name, i) => action(name, `avatar-${i}`, true)).join('')}</ul>` : ''}
    ${l.bodyFilters ? `<ul id="body-filters" class="avatar-subcategories" hidden>${l.bodyFilters.map((name, i) => action(name, `body-filter-${i}`, true)).join('')}</ul>` : ''}
    ${l.makeup ? `<ul id="makeup" class="avatar-subcategories" hidden>${l.makeup.map((name, i) => action(name, `makeup-${i}`, true)).join('')}</ul>` : ''}</nav>
    <div class="avatar-items-container"><a id="inventory-card" class="avatar-item-card" href="/catalog/1/Head"><img src="/image.svg"><span>Head</span></a><p id="native-result">All items</p></div>${locale!=='en'&&locale!=='zh-tw'?bodyControls:''}</div></div></div>${locale==='en'?`<div id="native-body-footer">${bodyControls}</div>`:''}</main>
    <script>
      ${useExtension ? '' : `window.thumbnailResponse={state:'Completed',imageUrl:location.origin+'/image.svg'};
      window.chrome={storage:{local:{async get(){return {}}},onChanged:{addListener(){}}},
        runtime:{lastError:null,sendMessage(message,callback){setTimeout(()=>callback(thumbnailResponse),0)}}};`}
      window.nativeCalls=[];window.originalActions=[...document.querySelectorAll('[data-native-key]')];
      window.lastInput=[];
      for(const name of ['pointerdown','pointerup','click'])document.addEventListener(name,event=>{
        lastInput.push([name,event.target.closest('[data-native-key]')?.dataset.nativeKey||event.target.id,event.clientX,event.clientY,scrollY]);
        if(lastInput.length>8)lastInput.shift();
      },true);
      window.originalCanvas=document.getElementById('native-model');
      window.originalBodyControls=document.getElementById('body-controls');window.originalBodyInputs=[...originalBodyControls.querySelectorAll('input')];
      window.originalBodyParents=[];for(let node=originalBodyControls;node.id!=='content';node=node.parentElement)originalBodyParents.push([node,node.parentElement]);
      window.bodyChanges=[];originalBodyControls.addEventListener('change',event=>bodyChanges.push([event.target.id,event.target.value]));
      document.getElementById('native-body-type').addEventListener('change',event=>document.getElementById('native-body-scales').hidden=!event.target.checked);
      window.modelInputs=0;originalCanvas.addEventListener('pointerdown',()=>modelInputs++);
      document.getElementById('native-background').addEventListener('click',()=>{
        document.querySelector('.native-scene').style.backgroundImage='url("/image.svg?scene=two")';
      });
      document.addEventListener('click',event=>{
        const action=event.target.closest('[data-native-key]');if(!action)return;event.preventDefault();
        const key=action.dataset.nativeKey;nativeCalls.push(key);
        action.parentElement.querySelectorAll(':scope > .active').forEach(node=>node.classList.remove('active'));action.classList.add('active');
        if(key.startsWith('main-')){
          document.querySelectorAll('.avatar-subcategories').forEach(node=>node.hidden=true);
          const menu=(${JSON.stringify(menuByTab)})[key]||'recent';
          document.getElementById(menu).hidden=false;
        }
        document.getElementById('native-result').textContent=key;
      });
    </script>${useExtension ? '' : scripts.map(file => `<script src="/${file}"></script>`).join('')}</body></html>`;
}

const layout = `(() => {
  const bounds=node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const row=document.querySelector('[data-rc-avatar-main-row]');
  const controls=[...document.querySelectorAll('[data-rc-avatar-main-control], [data-rc-avatar-sub-control]')].filter(node=>node.checkVisibility());
  return {
    mainCount:document.querySelectorAll('[data-rc-avatar-main-control]').length,
    nested:controls.some(node=>node.querySelector('[data-rc-avatar-main-control], [data-rc-avatar-sub-control]')),
    unchanged:originalActions.every(node=>node.isConnected),
    controls:controls.map(node=>({id:node.id,...bounds(node),border:getComputedStyle(node).borderTopWidth,background:getComputedStyle(node).backgroundColor})),
    row:bounds(row),inventory:bounds(document.querySelector('.avatar-items-container')),body:bounds(originalBodyControls),
    tools:bounds(document.querySelector('#rc-avatar-enhancements')),
    sidebar:bounds(document.querySelector('.left-nav')),
    previews:[...document.querySelectorAll('[data-rc-avatar-view-column],#rc-avatar-2d')].map(bounds),
    bodyUnchanged:originalBodyControls===document.getElementById('body-controls')&&originalBodyInputs.every(node=>node.isConnected),
    bodyMarkedAsFilter:!!originalBodyControls.querySelector('[data-rc-avatar-main-control], [data-rc-avatar-sub-control]'),
    menu:bounds([...document.querySelectorAll('.avatar-subcategories')].find(node=>node.checkVisibility())),
    menuBlur:getComputedStyle([...document.querySelectorAll('.avatar-subcategories')].find(node=>node.checkVisibility())).backdropFilter,
    headings:[...document.querySelectorAll('[data-rc-avatar-clothing-heading]')].map(node=>node.id),
    sections:[...document.querySelectorAll('[data-rc-avatar-clothing-section]')].map(bounds),
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    overflowNodes:[...document.querySelectorAll('body *')].filter(node=>node.checkVisibility() && node.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(node=>({tag:node.tagName,id:node.id,classes:node.className,...bounds(node)})),
    inventoryMarked:!!document.querySelector('#inventory-card [data-rc-avatar-sub-control]')
  };
})()`;

async function clickControl(browser, selector, label) {
  const before = await browser.evaluate('nativeCalls.length');
  for (let attempt = 0; attempt < 2; attempt++) {
    const { x, y, hit } = await browser.evaluate(`(async()=>{
      const control=document.querySelector(${JSON.stringify(selector)});
      control.scrollIntoView({block:'center',behavior:'instant'});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const rect=control.getBoundingClientRect(), x=Math.round(rect.x+rect.width/2), y=Math.round(rect.y+rect.height/2);
      return {x,y,hit:control.contains(document.elementFromPoint(x,y))};
    })()`);
    assert.ok(hit, `${label}: ${selector} receives pointer input`);
    await browser.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await browser.clickAt({ x, y });
    if (await browser.evaluate(`nativeCalls.length > ${before}`)) {
      assert.equal(await browser.evaluate('nativeCalls.at(-1)'), selector.slice(1), label);
      return;
    }
    // The compositor can deliver the first click to the old scroll position.
    // Only retry a miss that did not invoke any native action.
    await pause(50);
  }
  assert.fail(`${label}: ${selector} missed pointer input ${JSON.stringify(await browser.evaluate('lastInput'))}`);
}

test('avatar filters stay aligned, localized, and native across menu changes and screen sizes',
  { skip: !process.env.CHROME_BIN }, async t => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://localhost');
      if (['/my/avatar', '/id/my/avatar', '/ja/my/avatar', '/th/my/avatar', '/ko/my/avatar'].includes(url.pathname)) { response.setHeader('Content-Type', 'text/html; charset=utf-8');response.end(fixture(url.searchParams.get('locale') || 'en'));return; }
      if (url.pathname === '/image.svg') { response.setHeader('Content-Type', 'image/svg+xml');response.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#789"/></svg>');return; }
      const file = url.pathname.slice(1);
      if (![...styles, ...scripts].includes(file)) { response.writeHead(404);response.end();return; }
      response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');response.end(fs.readFileSync(path.join(workspace, file)));
    });
    await new Promise(resolve => server.listen(Number(process.env.GAME_SERVER_TEST_PORT || 0), '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const browser = await isolatedChrome(t, 'avatar-navigation');
    for (const locale of Object.keys(locales)) {
      const tabs=tabsFor(locales[locale]);
      const url = `http://127.0.0.1:${server.address().port}${['id','ja','th','ko'].includes(locale)?'/'+locale:''}/my/avatar?locale=${locale}`;
      await browser.send('Page.navigate', { url });await waitForDocument(browser, '#main-row', url);
      await browser.waitFor("document.querySelectorAll('[data-rc-avatar-main-control]').length===8");
      await browser.waitFor("!!document.querySelector('[data-rc-avatar-body-controls]')");
      const headerText = "[document.querySelector('.rc-avatar-3d-heading').textContent,document.querySelector('#rc-avatar-2d h2').textContent]";
      await browser.waitFor(`JSON.stringify(${headerText})===${JSON.stringify(JSON.stringify(previewTitles[locale]))}`);
      assert.equal(await browser.evaluate("document.querySelector('.rc-avatar-refresh').textContent===RobloxCustomizerI18n.t('Refresh')"), true, `${locale}: 2D refresh label is localized`);
      assert.equal(await browser.evaluate("document.querySelector('#rc-avatar-enhancements summary').textContent.startsWith(RobloxCustomizerI18n.t('Avatar tools'))"), true, `${locale}: avatar tools label is localized`);
      await browser.waitFor("document.querySelector('#rc-avatar-2d img').naturalWidth===300");
      await browser.evaluate("thumbnailResponse={error:'Request failed (503)'};document.querySelector('.rc-avatar-refresh').click()");
      await browser.waitFor("document.querySelector('.rc-avatar-status').textContent===RobloxCustomizerI18n.t('2D preview unavailable. Try Refresh.')");
      await browser.evaluate("thumbnailResponse={state:'Completed',imageUrl:location.origin+'/image.svg'};document.querySelector('.rc-avatar-refresh').click()");
      await browser.waitFor("document.querySelector('.rc-avatar-status').textContent==='' && !document.querySelector('#rc-avatar-2d img').hidden");
      if (locale !== 'en') {
        await browser.evaluate("RobloxCustomizerI18n.setLanguage('en')");
        assert.deepEqual(await browser.evaluate(headerText), previewTitles.en);
        await browser.evaluate("RobloxCustomizerI18n.setLanguage('auto')");
        assert.deepEqual(await browser.evaluate(headerText), previewTitles[locale]);
      }
      await browser.evaluate("document.querySelector('.avatar-items-container').style.minHeight='1800px'");
      await browser.click('#native-body-type');
      assert.equal(await browser.evaluate("document.getElementById('native-body-scales').checkVisibility()"),false,'R6 still hides native scaling controls');
      await browser.click('#native-body-type');
      assert.equal(await browser.evaluate("document.getElementById('native-body-scales').checkVisibility()"),true,'R15 still restores native scaling controls');
      await browser.evaluate("document.getElementById('native-scale-0').focus()");
      await browser.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
      await browser.send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
      assert.deepEqual(await browser.evaluate('bodyChanges.at(-1)'),['native-scale-0','99'],'Native scaling still receives keyboard changes');
      // Frost replaces the native CSS backdrop while the original canvas and
      // its input handlers remain intact, including already-square previews.
      await browser.click('#native-background');
      assert.ok(await browser.evaluate("document.querySelector('.native-scene').style.backgroundImage.endsWith('/image.svg?scene=two\")')"), 'native scene state is retained');
      await browser.click('#native-model');assert.equal(await browser.evaluate('modelInputs'), 1, 'model remains interactive');
      await browser.evaluate("document.querySelector('.native-scene .native-late-backdrop').classList.add('loaded');document.querySelector('#late-inline').style.backgroundImage='url(/image.svg?late-inline)'");
      await browser.waitFor("document.querySelector('.native-scene .native-late-backdrop').hasAttribute('data-rc-avatar-backdrop') && document.querySelector('#late-inline').hasAttribute('data-rc-avatar-backdrop')");
      await browser.evaluate("const layer=document.createElement('div');layer.className='native-backdrop';layer.id='redrawn-backdrop';document.querySelector('.native-scene').prepend(layer)");
      await browser.waitFor("document.querySelector('#redrawn-backdrop').hasAttribute('data-rc-avatar-backdrop')");
      for (const theme of ['dark-theme', 'light-theme']) for (const width of [1360, 700, 390]) {
        await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
        await browser.evaluate(`document.body.className=${JSON.stringify(theme)}`);
        await browser.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        const preview = await browser.evaluate(`(() => {
          const three=document.querySelector('[data-rc-avatar-view-column]'),two=document.querySelector('#rc-avatar-2d');
          const surface=document.querySelector('[data-rc-avatar-3d-surface]'),stage=two.querySelector('.rc-avatar-image-wrap');
          return {three:getComputedStyle(three).backgroundImage,two:getComputedStyle(two).backgroundImage,
            threeBlur:getComputedStyle(three).backdropFilter,twoBlur:getComputedStyle(two).backdropFilter,
            threeStage:getComputedStyle(surface).backgroundImage,twoStage:getComputedStyle(stage).backgroundImage,
            nativeBackdrop:getComputedStyle(document.querySelector('.native-scene')).backgroundImage,
            wrapperBackdrop:getComputedStyle(document.querySelector('.native-preview-host')).backgroundImage,
            tiledLayers:['::before','::after'].map(pseudo=>getComputedStyle(document.querySelector('.native-scene'),pseudo).backgroundImage)
              .concat(['::before','::after'].map(pseudo=>getComputedStyle(document.querySelector('.native-preview-host'),pseudo).backgroundImage))
              .concat([...document.querySelectorAll('.native-backdrop,.native-late-backdrop,.native-tile')].map(node=>getComputedStyle(node).backgroundImage)),
            icon:getComputedStyle(document.querySelector('.native-control-icon')).backgroundImage,
            modelFilter:getComputedStyle(originalCanvas).filter,cardFilter:getComputedStyle(three).filter,
            originalCanvas:originalCanvas===document.getElementById('native-model')};
        })()`);
        assert.equal(preview.three, preview.two, '3D and 2D use matching glass cards');
        assert.equal(preview.threeBlur, preview.twoBlur, '3D and 2D blur strength matches');
        assert.match(preview.threeBlur, /blur\(18px\)/, 'background blur is enabled');
        assert.equal(preview.threeStage, preview.twoStage, 'stage backgrounds match');
        assert.doesNotMatch(preview.nativeBackdrop, /url\(/, 'native backdrop does not cover the frost');
        assert.equal(preview.wrapperBackdrop, 'none', 'native wrapper backdrop is removed');
        assert.ok(preview.tiledLayers.every(image=>image==='none'), 'all repeated images and pseudo-element backdrops are removed');
        assert.match(preview.icon, /url\(/, 'native control icons are preserved');
        assert.equal(preview.modelFilter, 'none');assert.equal(preview.cardFilter, 'none');
        assert.equal(preview.originalCanvas, true, 'native 3D model stays mounted');
        const menus = [[tabs.accessories, 'accessories', 8, 'accessory-0'], [tabs.clothing, 'clothing', locales[locale].clothing.flat().length, 'clothing-0-2'],
          [tabs.animations, 'animations', 8, 'animation-1'], [tabs.recent, 'recent', locales[locale].recent.length, 'recent-1']];
        if (locales[locale].avatars) menus.push([tabs.avatars, 'avatars', locales[locale].avatars.length, 'avatar-1'],
          [tabs.body, 'body-filters', locales[locale].bodyFilters.length, 'body-filter-0']);
        if (locales[locale].makeup) menus.push([tabs.makeup, 'makeup', locales[locale].makeup.length, 'makeup-0']);
        for (const [tab, menu, count, key] of menus) {
          const label = `${locale}/${theme}/${width}/${menu}`;
          await clickControl(browser, `#main-${tab}`, label);
          try { await browser.waitFor(`document.querySelector('#${menu}').checkVisibility()`); }
          catch (error) { throw new Error(`${label}: ${JSON.stringify(await browser.evaluate('lastInput'))}`, {cause:error}); }
          const state = await browser.evaluate(layout);
          assert.equal(state.mainCount, 8, label);
          assert.equal(state.nested, false, `${label}: no nested button borders`);
          assert.equal(state.unchanged, true, `${label}: native action nodes remain mounted`);
          assert.equal(state.controls.length, 8 + count, `${label}: every filter has a styled control`);
          assert.match(state.menuBlur, /blur\(/, `${label}: the menu retains its frosted background`);
          assert.equal(state.overflow, false, `${label}: no page overflow ${JSON.stringify(state.overflowNodes)}`);
          assert.equal(state.inventoryMarked, false, `${label}: inventory titles are not filters`);
          assert.equal(state.bodyUnchanged,true,`${label}: native body controls remain mounted`);
          assert.equal(state.bodyMarkedAsFilter,false,`${label}: scale labels remain native labels`);
          const [three, two] = state.previews;
          assert.ok(state.previews.every(preview=>preview.bottom<=state.body.top+1),`${label}: body controls follow both previews`);
          assert.ok(state.body.bottom<=state.tools.top+1,`${label}: avatar tools follow body controls`);
          if (width >= 760) {
            assert.ok(Math.abs(three.left-two.left)<1 && three.bottom<=two.top, `${label}: both previews stack in the left column`);
            assert.ok(two.top-three.bottom<=20, `${label}: a tall item list does not separate the previews`);
            assert.ok(three.left>=state.sidebar.right && three.left-state.sidebar.right<=30, `${label}: the previews begin beside Roblox navigation`);
            assert.ok(three.right<=state.row.left && state.row.top<two.top, `${label}: inventory starts beside the 3D preview`);
            assert.ok(state.row.width>=720, `${label}: the original editor width limit no longer squeezes the right column`);
            assert.ok(state.body.right<=state.inventory.left && state.tools.right<=state.inventory.left, `${label}: editing tools stay in the preview column`);
          } else {
            assert.ok(state.tools.bottom<=state.row.top+1, `${label}: inventory follows the preview area on narrow screens`);
            if (width >= 520) assert.ok(three.right<=two.left && Math.abs(three.top-two.top)<1, `${label}: both previews fit in one row`);
            else assert.ok(Math.abs(three.left-two.left)<1 && three.bottom<=two.top, `${label}: previews stack on phones`);
          }
          assert.ok(state.inventory.top >= state.menu.bottom - 1, `${label}: inventory follows the filters`);
          for (const control of state.controls) {
            assert.ok(control.width > 20 && control.height >= 42, `${label}: usable control ${control.id}`);
            assert.equal(control.border, '1px', `${label}: consistent border ${control.id}`);
            assert.notEqual(control.background, 'rgba(0, 0, 0, 0)', `${label}: visible button background ${control.id}`);
            assert.ok(control.left >= state.row.left - 1 && control.right <= state.row.right + 1, `${label}: contained control ${control.id}`);
          }
          const mainRows = new Map();
          for (const control of state.controls.filter(node => node.id.startsWith('main-'))) {
            const top = Math.round(control.top);
            if (mainRows.has(top)) assert.ok(Math.abs(mainRows.get(top) - control.height) < 1, `${label}: equal button heights within each row`);
            else mainRows.set(top, control.height);
          }
          assert.deepEqual(state.headings, [0, 1, 2, 3, 4].map(i => `heading-${i}`), `${label}: Outerwear option is not a section heading`);
          assert.equal(state.sections.length, 5, label);
          await clickControl(browser, `#${key}`, label);
          assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('#${key}')).backgroundColor`), 'rgb(51, 95, 255)', `${label}: selected option is visible`);
          if (process.env.AVATAR_SCREENSHOT_DIR && theme === 'dark-theme' && width !== 700
            && (['id','ja','th','ko'].includes(locale) || locale === 'zh-tw' && menu === 'clothing')) {
            const shot = await browser.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
            fs.writeFileSync(path.join(process.env.AVATAR_SCREENSHOT_DIR, `avatar-${locale}-${menu}-${width}.png`), Buffer.from(shot.data, 'base64'));
          }
        }
      }
      // A keyboard-generated native click must work, too.
      await browser.click(`#main-${tabs.clothing}`);
      for (const id of ['clothing-3-0', 'clothing-3-1']) {
        await browser.click(`#${id}`);
        assert.equal(await browser.evaluate('nativeCalls.at(-1)'), id, 'Each original shoe option still runs its native action');
        assert.equal(await browser.evaluate(`document.querySelector('#${id}').hasAttribute('data-rc-avatar-sub-control')`), true);
      }
      await browser.click(`#main-${tabs.accessories}`);await browser.evaluate("document.querySelector('#accessory-2').focus()");
      await browser.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await browser.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      assert.equal(await browser.evaluate('nativeCalls.at(-1)'), 'accessory-2');
      await browser.evaluate("document.querySelector('#accessories').classList.add('ng-hide')");
      assert.equal(await browser.evaluate("document.querySelector('#accessories').checkVisibility()"), false, 'native hidden state wins');
      await browser.evaluate(`(()=>{const controls=document.createElement('section');controls.id='legacy-body-scales';
        controls.innerHTML=${JSON.stringify(locales[locale].body.slice(1, 3).map(name => `<span>${escape(name)}：100%</span><div class="legacy-slider" tabindex="0"></div>`).join(''))};
        document.getElementById('content').append(controls)})()`);
      await browser.waitFor("document.querySelector('#legacy-body-scales').hasAttribute('data-rc-avatar-body-controls')");
      assert.equal(await browser.evaluate("!!document.querySelector('[data-rc-avatar-preview-controls] > #legacy-body-scales')"),true,'Separate legacy scale panels also follow the previews');
      await browser.evaluate("history.pushState({},'', '/home');dispatchEvent(new PopStateEvent('popstate'))");
      await browser.waitFor("!document.querySelector('[data-rc-avatar-body-controls]')");
      assert.equal(await browser.evaluate('originalBodyParents.every(([node,parent])=>node.parentElement===parent)'),true,'Leaving avatar restores native control placement');
      assert.equal(await browser.evaluate("document.getElementById('legacy-body-scales').parentElement.id"),'content','Legacy panels return to their native parent');
    }
    assert.deepEqual(browser.errors, []);
  });

// This exercises the real manifest and requires Chrome with Extensions.loadUnpacked on its browser WebSocket.
test('the installed Avatar extension follows Roblox metadata and the separate extension language setting',
  { skip: !process.env.CHROME_BIN || !process.env.CHROME_EXTENSION_TESTS, timeout: 45000 }, async t => {
    const browser = await isolatedChrome(t, 'avatar-package', {
      args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost']
    });
    const debugPort = new URL(browser.socket.url).port;
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
    const devtools = new Browser(webSocketDebuggerUrl);
    t.after(() => devtools.socket.close());
    const { id } = await devtools.send('Extensions.loadUnpacked', { path: workspace });
    let workerTarget;
    for (let attempt = 0; !workerTarget && attempt < 100; attempt++) {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      workerTarget = targets.find(target => target.url === `chrome-extension://${id}/${manifest.background.service_worker}`);
      if (!workerTarget) await pause(30);
    }
    assert.ok(workerTarget, 'Chrome starts the extension service worker');
    const worker = new Browser(workerTarget.webSocketDebuggerUrl);
    t.after(() => worker.socket.close());
    await worker.send('Runtime.enable');
    await worker.waitFor("typeof chrome !== 'undefined' && !!chrome.storage?.local");
    const setLanguage = (uiLanguage, background = {}) => {
      const preferences = {
        robloxCustomizerTermsAccepted: true,
        customBackground: {
          uiLanguage, source: 'url', urlType: 'image', url: 'https://www.roblox.com/image.svg',
          experimentalCustomColors: true, customAccentColor: '#b53976', ...background
        }
      };
      return worker.evaluate(`chrome.storage.local.set(${JSON.stringify(preferences)})`);
    };
    await setLanguage('auto');
    const failures = [];
    browser.socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      const locale = url.searchParams.get('locale');
      const image = url.pathname === '/image.svg';
      const editor = Object.hasOwn(locales, locale) && url.pathname.endsWith('/my/avatar');
      const body = image ? '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"/>'
        : editor ? fixture(locale, true) : '{}';
      const responseHeaders = [{ name: 'Content-Type', value: image ? 'image/svg+xml' : editor ? 'text/html; charset=utf-8' : 'application/json' }];
      if (editor) responseHeaders.push({ name: 'Content-Security-Policy', value: "media-src 'none'; frame-src chrome-extension:" });
      browser.send('Fetch.fulfillRequest', {
        requestId, responseCode: 200,
        responseHeaders,
        body: Buffer.from(body).toString('base64')
      }).catch(error => failures.push(error.message));
    });
    await browser.send('Fetch.enable', { patterns: [{ urlPattern: 'https://www.roblox.com/*' }] });
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false });
    const titles = "JSON.stringify([...document.querySelectorAll('.rc-avatar-3d-heading, #rc-avatar-2d h2')].map(node=>node.textContent))";
    const assertTitles = locale => browser.waitFor(`${titles}===${JSON.stringify(JSON.stringify(previewTitles[locale]))}`);
    for (const locale of Object.keys(locales)) {
      const url = `https://www.roblox.com/${locale}/my/avatar?locale=${locale}`;
      await browser.send('Page.navigate', { url });
      await waitForDocument(browser, '#main-row', url);
      await assertTitles(locale);
      assert.equal(await browser.evaluate('document.documentElement.dataset.rcCompatibility'), 'full', locale);
      assert.equal(await browser.evaluate('document.documentElement.dataset.rcFrostPage'), 'avatar', locale);
      assert.equal(await browser.evaluate("document.querySelectorAll('[data-rc-avatar-main-control]').length"), 8, locale);
      await browser.waitFor("document.querySelector('.rc-background-media[data-rc-background-ready]')?.naturalWidth===300");
      assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#sidebar-avatar')).backgroundColor"), 'rgb(181, 57, 118)', locale);
      const state = await browser.evaluate(layout);
      const [three, two] = state.previews;
      assert.ok(three.bottom <= two.top && three.right <= state.row.left && state.row.top < two.top, locale);
      const clothing = `#main-${tabsFor(locales[locale]).clothing}`;
      await clickControl(browser, clothing, locale);
      await browser.waitFor("document.querySelector('#clothing').checkVisibility()");
      assert.equal(await browser.evaluate(`getComputedStyle(document.querySelector('${clothing}')).backgroundColor`), 'rgb(181, 57, 118)', locale);

      await setLanguage(locale === 'zh-cn' ? 'en' : 'zh-CN');
      await assertTitles(locale === 'zh-cn' ? 'en' : 'zh-cn');
      assert.equal(await browser.evaluate(`document.querySelector('${clothing}').textContent`),
        locales[locale].main[tabsFor(locales[locale]).clothing], locale);
      await setLanguage('auto');
      await assertTitles(locale);
    }
    await setLanguage('auto', { url: 'https://www.roblox.com/broken-image.svg' });
    await browser.waitFor("document.querySelector('.rc-background-media')?.src.endsWith('/broken-image.svg')");
    assert.equal(await browser.evaluate("document.querySelector('.rc-background-media').checkVisibility({visibilityProperty:true})"), false,
      'An invalid image stays hidden instead of painting a browser error');
    await browser.evaluate(`(async () => {
      const file = new File([await (${animatedVideo})()], 'wallpaper.mp4', {type:'video/mp4'});
      await new Promise((resolve, reject) => {
        const open = indexedDB.open('roblox-customizer-media', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('backgrounds');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const transaction = open.result.transaction('backgrounds', 'readwrite');
          transaction.objectStore('backgrounds').put(file, 'fixture-wallpaper');
          transaction.oncomplete = () => { open.result.close(); resolve(); };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    })()`);
    await setLanguage('auto', { source: 'file', fileKey: 'fixture-wallpaper', fileName: 'wallpaper.mp4' });
    await browser.waitFor("document.querySelector('.rc-background-frame[data-rc-background-ready]')?.checkVisibility({visibilityProperty:true})");
    // A site CSP can allow a frame inserted by the extension. Force a missing
    // extension resource in this fixture so no decoder can report readiness.
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      new MutationObserver(() => {
        const frame = document.querySelector('.rc-background-frame');
        if (frame && !frame.src.endsWith('/missing-wallpaper.html')) {
          frame.src = new URL('missing-wallpaper.html', frame.src).href;
        }
      }).observe(document, { childList: true, subtree: true });
    ` });
    const blocked = 'https://www.roblox.com/ja/my/avatar?locale=ja&brokenWallpaper=1';
    await browser.send('Page.navigate', { url: blocked });
    await waitForDocument(browser, '#main-row', blocked);
    await browser.waitFor("document.querySelector('.rc-background-frame')?.src.endsWith('/missing-wallpaper.html')");
    const blockedFrame = await browser.evaluate(`(() => {
      const frame = document.querySelector('.rc-background-frame');
      return { ready: frame.hasAttribute('data-rc-background-ready'),
        visibility: getComputedStyle(frame).visibility,
        visible: frame.checkVisibility({visibilityProperty:true}) };
    })()`);
    assert.equal(blockedFrame.visible, false,
      `A blocked frame cannot paint a browser error behind the editor: ${JSON.stringify(blockedFrame)}`);
    assert.deepEqual([...failures, ...browser.errors], []);
  });
