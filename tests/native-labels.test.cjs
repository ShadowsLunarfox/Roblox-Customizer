const assert = require('node:assert/strict');
const { test } = require('node:test');
const labels = require('../src/shared/native-labels.js');

test('native section labels recognize English and both Chinese scripts without classifying game titles', () => {
  const cases = [
    ['home', 'Recommended For You', 'recommended'], ['home', '为你推荐', 'recommended'],
    ['home', '為你推薦 →', 'recommended'], ['home', '收藏夹', 'favorites'], ['home', '最愛', 'favorites'],
    ['home', '推薦給您', 'recommended'], ['home', '推荐给您', 'recommended'],
    ['home', '推薦給您 查看全部 →', 'recommended'], ['home', '推荐给您查看更多', 'recommended'],
    ['home', '最愛（１２）顯示全部 →', 'favorites'],
    ['home', '精选游戏：岛屿探索', 'standout'], ['home', '精選遊戲：島嶼探索', 'standout'],
    ['profile', '好友（２００）查看全部 →', 'friends'], ['profile', '體驗', 'experiences'],
    ['profile', '目前穿戴', 'wearing'], ['profile', '社區', 'communities'], ['profile', '徽章', 'badges'],
    ['profile', '作品', 'experiences'], ['profile', '创作', 'experiences'], ['profile', '創作', 'experiences'],
    ['profile', 'Creations', 'experiences'], ['profile', 'Games', 'experiences'],
    ['profile', 'Games (1) See All →', 'experiences'], ['profile', '收藏 ›', 'collections'],
    ['profile', '收藏品', 'collections'], ['profile', '收藏集', 'collections'],
    ['profile', '收藏夹', 'favorites'], ['profile', '最愛', 'favorites'], ['home', '收藏', 'favorites'],
    ['store', '游戏通行证', 'passes'], ['store', '遊戲通行證', 'passes'],
    ['store', '开发者商品', 'products'], ['store', '開發者商品', 'products'], ['store', '訂閱', 'subscriptions'],
    ['avatar', '服装菜单', 'clothing'], ['avatar', '服裝選單', 'clothing'],
    ['avatar', '配飾', 'accessories'], ['avatar', '經典襯衫', 'classic shirts'], ['avatar', '表情动作', 'emotes']
  ];
  for (const [group, text, expected] of cases) assert.equal(labels.classify(group, text), expected, text);
  for (const text of ['My Favorites Simulator', '推荐游戏大冒险', '收藏夹模拟器', '为你推荐的私人服务器']) {
    assert.equal(labels.classify('home', text), '', text);
  }
  assert.equal(labels.classify('unknown', '推荐'), '');
  assert.equal(labels.classify('profile', 'Games Simulator'), '');
  assert.equal(labels.classify('home', 'Games'), '');
});

test('Chinese native controls and empty states do not depend on English copy', () => {
  for (const [kind, texts] of Object.entries({
    settings: ['设置', '設定'], chat: ['聊天'], seeAll: ['查看全部 →', '檢視全部'],
    about: ['关于', '關於', '介绍', '介紹'], creations: ['创作', '創作'], followers: ['125 位追蹤者', '125 粉丝'],
    tryOn: ['试戴', '試穿', '脫下'], join: ['加入', '加入體驗'],
    livePlayers: ['活跃玩家', '正在體驗'], loadMore: ['加载更多服务器', '載入更多伺服器'],
    sortBy: ['排序方式：', '排序依據'], excludeFull: ['排除已满的服务器', '排除已滿的伺服器'],
    emptyServers: ['没有可用的服务器', '沒有私人伺服器'], emptyStore: ['没有通行证', '沒有商品']
  })) for (const text of texts) assert.equal(labels.matches(kind, text), true, `${kind}: ${text}`);
  assert.equal(labels.matches('tryOn', '试戴游戏'), false);
  assert.equal(labels.matches('chat', '聊天模拟器'), false);
});

test('avatar navigation recognizes current English and Chinese filter names', () => {
  const cases = {
    recent: ['Recently Worn', '最近穿戴'], body: ['Body Parts', '身体部位', '身體部位'],
    expired: ['Expired', '已过期', '已過期'], heads: ['Head', '頭部'],
    't-shirts': ['T 恤'], sweaters: ['织衫', '織衫'], bottoms: ['裤裙', '褲裙'],
    'dresses & skirts': ['裙子'], 'classic shirts': ['经典上衣', '經典上衣'],
    'classic t-shirts': ['经典 T 恤', '經典 T 恤'],
    shoes: ['鞋', '鞋子'], 'left shoe': ['左鞋', '左脚鞋子', '左腳鞋子'],
    'right shoe': ['右鞋', '右脚鞋子', '右腳鞋子'],
    emotes: ['Actions', '动作', '動作'], walk: ['Walking', '步行'], fall: ['Falling', '跌落']
  };
  for (const [expected, names] of Object.entries(cases)) {
    for (const name of names) assert.equal(labels.classify('avatar', name), expected, name);
  }
  assert.equal(labels.classify('avatar', 'Recently Worn Simulator'), '');
});

test('Thai avatar filters recognize the native clothing, body, avatar and recent menu names', () => {
  const cases = {
    accessories: ['ไอเท็มเสริม'], makeup: ['การแต่งหน้า'],
    'recently added': ['เพิ่มเข้ามาล่าสุด'], recent: ['สวมใส่ล่าสุด'], expired: ['หมดอายุแล้ว'],
    creations: ['ผลงานสร้างสรรค์'], scale: ['การปรับขนาด'],
    tops: ['เสื้อผ้าท่อนบน'], outerwear: ['เสื้อชั้นนอก'], bottoms: ['เสื้อผ้าท่อนล่าง'],
    jackets: ['เสื้อแจ็คเก็ต'], pants: ['กางเกงขายาว'],
    'left shoe': ['รองเท้าข้างซ้าย'], 'right shoe': ['รองเท้าข้างขวา'],
    'classic shirts': ['เสื้อเชิ้ตแบบคลาสสิก'], 'classic pants': ['กางเกงขายาวแบบคลาสสิก'],
    'classic t-shirts': ['เสื้อยืดแบบคลาสสิก'], fall: ['หล่น']
  };
  for (const [expected, names] of Object.entries(cases)) for (const name of names) {
    assert.equal(labels.classify('avatar', name), expected, name);
    assert.equal(labels.classify('avatar', name.normalize('NFKC')), expected, `${name} (NFKC)`);
    assert.equal(labels.classify('avatar', `${name} Simulator`), '', `${name}: exact filter label only`);
  }
});

test('Japanese avatar filters recognize the current short and alternate labels shown by Roblox', () => {
  const cases = {
    animations: ['アニメ', 'アニメーション'], expired: ['有効期限切れ'], body: ['ボディパーツ'],
    'recently added': ['最近、追加されたもの'], 'currently wearing': ['最近の装備'],
    'skin tone': ['スキンのトーン'], scale: ['拡大/縮小'], outerwear: ['上着'],
    'dresses & skirts': ['ワンピース＆スカート'],
    'left shoe': ['靴（左）'], 'right shoe': ['靴（右）'], classic: ['定番'],
    'classic shirts': ['定番のシャツ'], 'classic pants': ['定番のズボン'],
    'classic t-shirts': ['定番のTシャツ'], eyebrows: ['まゆげ'], emotes: ['リアクション']
  };
  for (const [expected, names] of Object.entries(cases)) for (const name of names) {
    assert.equal(labels.classify('avatar', name), expected, name);
    assert.equal(labels.classify('avatar', name.normalize('NFKC')), expected, `${name} (NFKC)`);
    assert.equal(labels.classify('avatar', `${name} Simulator`), '', `${name}: exact filter label only`);
  }
});

test('localized accessible preview labels identify 2D and 3D controls', () => {
  for (const [text, expected] of [['3D', '3'], ['Switch to 2D', '2'], ['切换至３Ｄ视图', '3'],
    ['切換到 2D 模式', '2'], ['以 3D 檢視', '3']]) assert.equal(labels.previewMode(text), expected, text);
  for (const text of ['Try On', '3D model shop', '加入 3D 游戏']) assert.equal(labels.previewMode(text), '', text);
});

test('player filtering reads Chinese counts including zero and full-width numbers', () => {
  for (const [text, playing, maxPlayers] of [['8 of 20 people max', 8, 20], ['８／２０人', 8, 20],
    ['8人（最多20人）', 8, 20], ['0 位玩家', 0, null], ['1,234 名玩家', 1234, null]]) {
    const parsed = labels.playerCount(text);
    assert.equal(parsed?.playing, playing, text);
    assert.equal(parsed?.maxPlayers, maxPlayers, text);
  }
  for (const text of ['Private server 123', '20/8人', '没有服务器']) assert.equal(labels.playerCount(text), null, text);
});

test('Thai labels handle combining marks, Thai digits, control scope and private server empty states', () => {
  for (const [group, text, key] of [
    ['home', 'รายการโปรด (๑๒) ดูทั้งหมด →', 'favorites'], ['home', 'แนะนำสำหรับคุณ', 'recommended'],
    ['home', 'เกมที่โดดเด่น', 'standout'], ['home', 'เกมที่แนะนำ', 'recommended'],
    ['profile', 'กำลังสวมใส่', 'wearing'], ['profile', 'สวมอยู่ตอนนี้', 'wearing'],
    ['profile', 'สวมอยู่ตอนนี้ ดูทั้งหมด →', 'wearing'], ['profile', 'ประสบการณ์', 'experiences'], ['profile', 'เพื่อน (200)', 'friends'],
    ['profile', 'ชุมชน', 'communities'], ['profile', 'คอลเลกชัน', 'collections'],
    ['store', 'การสมัครสมาชิก', 'subscriptions'], ['store', 'พาส', 'passes'], ['store', 'ผลิตภัณฑ์ผู้พัฒนา', 'products'],
    ['avatar', 'เสื้อผ้า', 'clothing'], ['avatar', 'เสื้อยืดคลาสสิก', 'classic t-shirts'], ['avatar', 'ลำตัว', 'torso'],
    ['avatar', 'สวมอยู่ตอนนี้', 'currently wearing']
  ]) assert.equal(labels.classify(group, text), key, text);
  for (const [kind, text] of [
    ['settings', 'การตั้งค่า'], ['about', 'เกี่ยวกับ'], ['creations', 'ผลงาน'], ['chat', 'แชท'], ['seeAll', 'ดูทั้งหมด'],
    ['more', 'แสดงเพิ่มเติม'], ['noBio', 'ยังไม่มีคำแนะนำตัว'], ['followers', 'ผู้ติดตาม 12 คน'],
    ['tryOn', 'ลองสวมใส่'], ['join', 'เข้าร่วม'], ['livePlayers', 'กำลังเล่น'], ['loadMore', 'โหลดเพิ่มเติม'],
    ['sortBy', 'เรียงตาม:'], ['excludeFull', 'ยกเว้นเซิร์ฟเวอร์ที่เต็ม'], ['emptyServers', 'ไม่มีเซิร์ฟเวอร์ส่วนตัว'],
    ['publicEmptyServers', 'ไม่พบเซิร์ฟเวอร์สาธารณะ'], ['createPrivate', 'สร้างเซิร์ฟเวอร์ส่วนตัว'], ['emptyStore', 'ไม่มีพาสขาย']
  ]) {
    assert.equal(labels.matches(kind, text), true, text);
    assert.equal(labels.matches(kind, text.normalize('NFKC')), true, text + ' (NFKC)');
  }
  assert.equal(labels.matches('publicEmptyServers', 'ไม่มีเซิร์ฟเวอร์ส่วนตัว'), false);
  assert.equal(labels.classify('home', 'แนะนำสำหรับคุณ Simulator'), '');
  assert.equal(labels.classify('profile', 'สวมอยู่ตอนนี้ Simulator'), '');
  assert.equal(labels.matches('chat', 'แชท Simulator'), false);
  assert.equal(labels.previewMode('เปลี่ยนเป็น 2D'), '2');
  assert.equal(labels.previewMode('ดูแบบ 3D'), '3');
  for (const [text, playing, max] of [['8 จาก 20 คน', 8, 20], ['๘ จาก ๒๐ คน', 8, 20], ['0/20 คน', 0, 20], ['1,234 คน', 1234, null]]) {
    assert.equal(labels.playerCount(text)?.playing, playing, text);
    assert.equal(labels.playerCount(text)?.maxPlayers, max, text);
  }
  assert.equal(labels.playerCount('๒๐ จาก ๘ คน'), null);
});

test('Korean native labels, avatar filters and server counts preserve their scope', () => {
  for (const [group, text, key] of [
    ['home', '즐겨찾기 (１２) 모두 보기 →', 'favorites'], ['home', '회원님을 위한 추천', 'recommended'],
    ['home', '추천 게임', 'recommended'], ['home', '주목할 만한 게임', 'standout'],
    ['home', '이런 건 어떠세요', 'recommended'], ['home', '이런 건 어떠세요 모두 보기 →', 'recommended'],
    ['home', '주목할 게임', 'standout'], ['home', '주목할 게임 Roblox의 미래를 만들어가는 선별된 게임', 'standout'],
    ['profile', '현재 착용 중', 'wearing'], ['profile', '현재 착용 중 전체 보기', 'wearing'],
    ['profile', '현재 장착 중', 'wearing'], ['profile', '현재 장착 중 모두 보기 →', 'wearing'],
    ['profile', '친구 (200)', 'friends'], ['profile', '커뮤니티', 'communities'], ['profile', '체험', 'experiences'],
    ['profile', '컬렉션', 'collections'], ['store', '구독', 'subscriptions'], ['store', '패스', 'passes'], ['store', '개발자 상품', 'products'],
    ['avatar', '의상 메뉴', 'clothing'], ['avatar', '클래식 티셔츠', 'classic t-shirts'], ['avatar', '신체 부위', 'body'],
    ['avatar', '크기 조정', 'scale'], ['avatar', '왼쪽 신발', 'left shoe'], ['avatar', '낙하', 'fall'], ['avatar', '창작물', 'creations'],
    ['avatar', '현재 장착 중', 'currently wearing']
  ]) {
    assert.equal(labels.classify(group, text), key, text);
    assert.equal(labels.classify(group, text.normalize('NFD')), key, `${text} (decomposed Hangul)`);
  }
  for (const [kind, text] of [
    ['settings', '설정'], ['about', '소개'], ['creations', '창작물'], ['chat', '채팅'], ['seeAll', '모두 보기'],
    ['more', '더 보기'], ['noBio', '아직 소개가 없습니다.'], ['followers', '팔로워 12명'],
    ['tryOn', '착용해 보기'], ['join', '참가'], ['livePlayers', '플레이 중'], ['loadMore', '더 불러오기'],
    ['sortBy', '정렬 기준:'], ['excludeFull', '가득 찬 서버 제외'], ['emptyServers', '비공개 서버가 없습니다.'],
    ['publicEmptyServers', '현재 실행 중인 체험이 없습니다.'], ['createPrivate', '비공개 서버 만들기'], ['emptyStore', '패스가 없습니다.']
  ]) assert.equal(labels.matches(kind, text), true, text);
  assert.equal(labels.matches('publicEmptyServers', '비공개 서버가 없습니다.'), false);
  assert.equal(labels.matches('chat', '채팅 시뮬레이터'), false);
  for (const text of ['회원님을 위한 추천 시뮬레이터', '즐겨찾기 게임 시뮬레이터', '이런 건 어떠세요 시뮬레이터']) assert.equal(labels.classify('home', text), '', text);
  assert.equal(labels.classify('profile', '현재 장착 중 시뮬레이터'), '');
  assert.equal(labels.previewMode('2D로 전환'), '2');
  assert.equal(labels.previewMode('3D 미리 보기'), '3');
  assert.equal(labels.previewMode('3D 모델 상점'), '');
  for (const [text, playing, max] of [['최대 20명 중 8명', 8, 20], ['20명 중 0명', 0, 20], ['8/20명', 8, 20], ['1,234명', 1234, null]]) {
    assert.equal(labels.playerCount(text)?.playing, playing, text);
    assert.equal(labels.playerCount(text)?.maxPlayers, max, text);
  }
  assert.equal(labels.playerCount('최대 8명 중 20명'), null);
});

test('Korean avatar navigation recognizes the native labels shown in the editor menus', () => {
  const cases = {
    clothing: ['복장'], accessories: ['장신구'], idle: ['빈둥대기'],
    front: ['전면'], back: ['후면'], jackets: ['재킷'], 'dresses & skirts': ['원피스 및 치마'],
    'left legs': ['왼 다리'], 'right legs': ['오른 다리'], scale: ['배율'],
    'recently added': ['새로 추가된 아이템'], recent: ['최근 장착']
  };
  for (const [expected, names] of Object.entries(cases)) for (const name of names) {
    assert.equal(labels.classify('avatar', name), expected, name);
    assert.equal(labels.classify('avatar', name.normalize('NFD')), expected, `${name} (decomposed Hangul)`);
    assert.equal(labels.classify('avatar', `${name} 시뮬레이터`), '', `${name}: exact menu label only`);
  }
});

test('Japanese native headings and controls preserve scope, server counts and private empty-state distinctions', () => {
  for (const [group, text, key] of [
    ['home', 'お気に入り（１２）すべて表示 →', 'favorites'], ['home', 'あなたへのおすすめ', 'recommended'],
    ['home', '注目のゲーム', 'standout'], ['home', 'おすすめのバーチャル空間', 'recommended'],
    ['profile', '装備中', 'wearing'], ['profile', 'バーチャル空間', 'experiences'],
    ['profile', 'フレンド（200）', 'friends'], ['profile', 'コミュニティ', 'communities'], ['profile', 'コレクション', 'collections'],
    ['store', 'サブスクリプション', 'subscriptions'], ['store', 'パス', 'passes'], ['store', '開発者製品', 'products'],
    ['avatar', '服装メニュー', 'clothing'], ['avatar', 'クラシックTシャツ', 'classic t-shirts'], ['avatar', '顔', 'face']
  ]) assert.equal(labels.classify(group, text), key, text);
  for (const [kind, text] of [
    ['settings', '設定'], ['about', '概要'], ['creations', '作品'], ['chat', 'チャット'], ['seeAll', 'すべて表示'],
    ['more', 'もっと表示'], ['noBio', '自己紹介はまだありません。'], ['followers', 'フォロワー12人'],
    ['tryOn', '試着'], ['join', '参加'], ['livePlayers', 'プレイ中'], ['loadMore', 'さらに読み込む'],
    ['sortBy', '並び順：'], ['excludeFull', '満員のサーバーを除外'], ['emptyServers', 'プライベートサーバーがありません。'],
    ['publicEmptyServers', '公開サーバーが見つかりません。'], ['createPrivate', 'プライベートサーバーを作成'], ['emptyStore', 'パスはありません。']
  ]) assert.equal(labels.matches(kind, text), true, text);
  assert.equal(labels.matches('publicEmptyServers', 'プライベートサーバーがありません。'), false);
  for (const title of ['おすすめのゲームシミュレーター', 'お気に入りのゲームで遊ぼう']) assert.equal(labels.classify('home', title), '');
  assert.equal(labels.matches('chat', 'チャットシミュレーター'), false);
  assert.equal(labels.previewMode('2Dに切り替え'), '2');
  assert.equal(labels.previewMode('3Dで表示'), '3');
  for (const [text, playing, max] of [['8/20人', 8, 20], ['最大20人中8人', 8, 20], ['8人（最大20人）', 8, 20], ['1,234人', 1234, null]]) {
    assert.equal(labels.playerCount(text)?.playing, playing, text);
    assert.equal(labels.playerCount(text)?.maxPlayers, max, text);
  }
  assert.equal(labels.playerCount('最大8人中20人'), null);
});

test('Indonesian native sections, controls, preview modes and player counts are recognized', () => {
  for (const [group, text, key] of [
    ['home', 'Favorit (1.234) Lihat Semua →', 'favorites'],
    ['home', 'Direkomendasikan untuk Anda', 'recommended'], ['home', 'Game Unggulan', 'standout'],
    ['home', 'Direkomendasikan untukmu', 'recommended'], ['home', 'Direkomendasikan Lihat Semua →', 'recommended'],
    ['home', 'Recommended', 'recommended'],
    ['profile', 'Pengalaman Virtual', 'experiences'], ['profile', 'Sedang Dipakai', 'wearing'],
    ['profile', 'Saat Ini Memakai', 'wearing'], ['profile', 'Saat Ini Memakai Lihat Semua →', 'wearing'],
    ['profile', 'Teman (200)', 'friends'], ['profile', 'Komunitas', 'communities'], ['profile', 'Koleksi', 'collections'],
    ['store', 'Langganan', 'subscriptions'], ['store', 'Subscription', 'subscriptions'],
    ['store', 'Pas', 'passes'], ['store', 'Pass', 'passes'], ['store', 'Produk Developer', 'products'],
    ['avatar', 'Pakaian', 'clothing'], ['avatar', 'Aksesori', 'accessories'], ['avatar', 'Kemeja Klasik', 'classic shirts']
  ]) assert.equal(labels.classify(group, text), key, text);
  for (const [kind, text] of [
    ['settings', 'Pengaturan'], ['about', 'Tentang'], ['creations', 'Kreasi'], ['chat', 'Obrolan'],
    ['seeAll', 'Lihat Semua'], ['more', 'Selengkapnya'], ['noBio', 'Belum ada bio.'], ['followers', '12 pengikut'],
    ['tryOn', 'Coba Pakai'], ['join', 'Gabung'], ['livePlayers', 'Sedang Bermain'], ['loadMore', 'Muat Lebih Banyak'],
    ['sortBy', 'Urutkan Berdasarkan:'], ['excludeFull', 'Kecualikan Server Penuh'],
    ['loadMore', 'Load Lebih Banyak'], ['excludeFull', 'Mengecualikan Server Penuh'], ['publicEmptyServers', 'Tidak Menemukan Server.'],
    ['emptyServers', 'Tidak ada server privat.'], ['publicEmptyServers', 'Tidak ada pengalaman virtual yang berjalan saat ini.'],
    ['createPrivate', 'Buat Server Privat'], ['emptyStore', 'Tidak ada pass untuk dijual.']
  ]) assert.equal(labels.matches(kind, text), true, text);
  assert.equal(labels.previewMode('Beralih ke 3D'), '3');
  assert.equal(labels.previewMode('Lihat dalam 2D'), '2');
  for (const [text, playing, max] of [['8 dari 20 orang maksimal', 8, 20], ['0/20 pemain', 0, 20], ['1.234 pemain', 1234, null]]) {
    assert.equal(labels.playerCount(text)?.playing, playing, text);
    assert.equal(labels.playerCount(text)?.maxPlayers, max, text);
  }
  assert.equal(labels.classify('home', 'Favorit Simulator'), '');
  for (const title of ['Direkomendasikan Simulator', 'Direkomendasikan untukmu Adventure', 'Recommended Simulator']) {
    assert.equal(labels.classify('home', title), '', title);
  }
  assert.equal(labels.matches('chat', 'Obrolan Simulator'), false);
});
