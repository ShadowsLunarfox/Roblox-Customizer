/* Fallbacks for native controls without stable IDs. Keep matching scoped to
   headings and controls; game titles and user content are not UI labels. */
(() => {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC')
    .replace(/[๐-๙]/g, digit => String(digit.charCodeAt(0) - 0x0e50))
    .replace(/[\u200e\u200f\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const groups = {
    home: {
      favorites: ['favorites', '收藏', '收藏夹', '收藏夾', '最爱', '最愛', '我的最爱', '我的最愛'],
      standout: ['standout games', '精选游戏', '精選遊戲', '精选体验', '精選體驗', '特色游戏', '特色遊戲', '特色体验', '特色體驗'],
      recommended: ['recommended for you', 'recommended games', 'recommended', '为你推荐', '為你推薦', '为您推荐', '為您推薦', '推荐给您', '推薦給您', '推荐给你', '推薦給你', '推荐游戏', '推薦遊戲', '推荐体验', '推薦體驗', '推荐', '推薦']
    },
    profile: {
      wearing: ['currently wearing', '当前穿戴', '目前穿戴', '正在穿戴', '当前穿着', '目前穿著', '目前造型'],
      store: ['store', '商店'], experiences: ['games', 'experiences', 'creations', '体验', '體驗', '游戏', '遊戲', '作品', '创作', '創作'],
      favorites: ['favorites', '收藏夹', '收藏夾', '最爱', '最愛'],
      collections: ['collections', '收藏', '收藏品', '收藏集'], friends: ['friends', '好友', '朋友'],
      communities: ['communities', 'groups', '社区', '社區', '群组', '群組', '社群'],
      badges: ['badge', 'badges', '徽章']
    },
    store: {
      subscriptions: ['subscription', 'subscriptions', '订阅', '訂閱'],
      passes: ['passes', 'game passes', 'gamepasses', '通行证', '通行證', '游戏通行证', '遊戲通行證'],
      products: ['products', 'developer products', '商品', '产品', '產品', '开发者商品', '開發者商品', '开发者产品', '開發者產品']
    },
    avatar: {
      recent: ['recent', 'recently worn', '最近', '近期', '最近穿戴', '最近穿着', '最近穿著'],
      avatars: ['avatars', '虚拟形象', '虛擬形象', '虚拟人偶', '虛擬人偶', '化身'],
      body: ['body', 'body parts', '身体', '身體', '身体部位', '身體部位'], makeup: ['makeup', '妆容', '妝容', '化妆', '化妝'],
      clothing: ['clothing', '服装', '服裝', '服饰', '服飾', '衣服'],
      accessories: ['accessories', '配件', '饰品', '飾品', '配饰', '配飾'], backgrounds: ['backgrounds', '背景'],
      animations: ['animations', '动画', '動畫'],
      expired: ['expired', '已过期', '已過期'],
      'recently added': ['recently added', '最近添加', '最近新增', '新增内容', '新增內容'],
      'currently wearing': ['currently wearing', '当前穿戴', '目前穿戴', '正在穿戴', '当前穿着', '目前穿著'],
      purchased: ['purchased', '已购买', '已購買'], creations: ['creations', '创作', '創作', '作品'],
      heads: ['head', 'heads', '头部', '頭部'], 'skin tone': ['skin tone', '肤色', '膚色'], hair: ['hair', '头发', '頭髮', '发型', '髮型'],
      torso: ['torso', '躯干', '軀幹'], 'left arms': ['left arms', '左臂', '左手臂'], 'right arms': ['right arms', '右臂', '右手臂'],
      'left legs': ['left legs', '左腿'], 'right legs': ['right legs', '右腿'], scale: ['scale', '比例', '体型', '體型'],
      hats: ['hats', '帽子'], face: ['face', '脸部', '臉部'], neck: ['neck', '颈部', '頸部'],
      shoulders: ['shoulder', 'shoulders', '肩部', '肩膀'], front: ['front', '正面', '前方'], back: ['back', '背部', '背面'],
      waist: ['waist', '腰部'], gear: ['gear', '装备', '裝備'], tops: ['tops', '上装', '上裝', '上衣'],
      outerwear: ['outerwear', '外套', '外衣'], bottoms: ['bottoms', '下装', '下裝', '下身', '裤裙', '褲裙'],
      shirts: ['shirts', '衬衫', '襯衫'], 't-shirts': ['t-shirts', 't恤', 't 恤', 't恤衫'], pants: ['pants', '裤子', '褲子'],
      jackets: ['jackets', '夹克', '夾克'], sweaters: ['sweaters', '毛衣', '织衫', '織衫'], shorts: ['shorts', '短裤', '短褲'],
      'dresses & skirts': ['dresses & skirts', 'dresses and skirts', '连衣裙和半身裙', '連衣裙和半身裙', '洋装与裙子', '洋裝與裙子', '裙子'],
      shoes: ['shoes', '鞋子', '鞋'], classic: ['classic', '经典', '經典'],
      'left shoe': ['left shoe', 'left shoes', '左鞋'], 'right shoe': ['right shoe', 'right shoes', '右鞋'],
      'classic shirts': ['classic shirts', '经典衬衫', '經典襯衫', '经典上衣', '經典上衣'],
      'classic t-shirts': ['classic t-shirts', '经典t恤', '經典t恤', '经典 t 恤', '經典 t 恤'],
      'classic pants': ['classic pants', '经典裤子', '經典褲子'], looks: ['looks', '造型'],
      eyes: ['eyes', '眼睛'], lips: ['lips', '嘴唇'], eyelashes: ['eyelashes', '睫毛'], eyebrows: ['eyebrows', '眉毛'],
      faces: ['faces', '面孔', '表情'], emotes: ['emotes', 'actions', '表情动作', '表情動作', '动作', '動作'],
      idle: ['idle', '待机', '待機', '闲置', '閒置'], walk: ['walk', 'walking', '行走', '走路', '步行'], run: ['run', '奔跑', '跑步'],
      jump: ['jump', '跳跃', '跳躍'], fall: ['fall', 'falling', '下落', '坠落', '墜落', '跌落'], climb: ['climb', '攀爬'], swim: ['swim', '游泳'],
      bundles: ['bundles', '套装', '套裝'], characters: ['characters', '角色'], costumes: ['costumes', '装扮', '裝扮']
    }
  };
  const indonesian = {
    home: {
      favorites: ['favorit'], standout: ['game unggulan', 'pengalaman virtual unggulan', 'pilihan unggulan'],
      recommended: ['direkomendasikan untukmu', 'direkomendasikan', 'direkomendasikan untuk anda', 'rekomendasi untuk anda', 'disarankan untuk anda', 'rekomendasi game', 'game yang direkomendasikan']
    },
    profile: {
      wearing: ['sedang dipakai', 'saat ini dipakai', 'saat ini dikenakan', 'sedang dikenakan', 'saat ini memakai'],
      store: ['toko'], experiences: ['pengalaman virtual', 'pengalaman', 'kreasi'], favorites: ['favorit'],
      collections: ['koleksi'], friends: ['teman', 'koneksi'], communities: ['komunitas', 'grup'], badges: ['lencana']
    },
    store: { subscriptions: ['langganan'], passes: ['pas', 'pass', 'pas game', 'pass game', 'tiket game'], products: ['produk', 'produk developer', 'produk pengembang'] },
    avatar: {
      recent: ['terbaru', 'baru dipakai', 'baru dikenakan', 'terakhir dipakai'], avatars: ['avatar'],
      body: ['tubuh', 'bagian tubuh'], makeup: ['riasan'], clothing: ['pakaian'], accessories: ['aksesori', 'aksesoris'],
      backgrounds: ['latar belakang'], animations: ['animasi'], expired: ['kedaluwarsa'],
      'recently added': ['baru ditambahkan'], 'currently wearing': ['sedang dipakai', 'saat ini dipakai', 'sedang dikenakan'],
      purchased: ['dibeli', 'telah dibeli'], creations: ['kreasi'], heads: ['kepala'], 'skin tone': ['warna kulit'], hair: ['rambut'],
      torso: ['batang tubuh', 'badan'], 'left arms': ['lengan kiri'], 'right arms': ['lengan kanan'],
      'left legs': ['kaki kiri'], 'right legs': ['kaki kanan'], scale: ['skala'], hats: ['topi'], face: ['wajah'], neck: ['leher'],
      shoulders: ['bahu'], front: ['depan'], back: ['belakang', 'punggung'], waist: ['pinggang'], gear: ['perlengkapan'],
      tops: ['atasan'], outerwear: ['pakaian luar'], bottoms: ['bawahan'], shirts: ['kemeja', 'baju'],
      't-shirts': ['kaus', 'kaos'], pants: ['celana'], jackets: ['jaket'], sweaters: ['sweter'], shorts: ['celana pendek'],
      'dresses & skirts': ['gaun & rok', 'gaun dan rok'], shoes: ['sepatu'], classic: ['klasik'],
      'left shoe': ['sepatu kiri'], 'right shoe': ['sepatu kanan'], 'classic shirts': ['kemeja klasik', 'baju klasik'],
      'classic t-shirts': ['kaus klasik', 'kaos klasik'], 'classic pants': ['celana klasik'], looks: ['penampilan', 'tampilan'],
      eyes: ['mata'], lips: ['bibir'], eyelashes: ['bulu mata'], eyebrows: ['alis'], faces: ['wajah'],
      emotes: ['emote', 'aksi'], idle: ['diam', 'siaga'], walk: ['berjalan', 'jalan'], run: ['berlari', 'lari'],
      jump: ['melompat', 'lompat'], fall: ['jatuh'], climb: ['memanjat', 'panjat'], swim: ['berenang', 'renang'],
      bundles: ['bundel'], characters: ['karakter'], costumes: ['kostum']
    }
  };
  const japanese = {
    home: {
      favorites: ['お気に入り', 'お気に入りのゲーム', 'お気に入りの体験', 'お気に入りのバーチャル空間'],
      standout: ['注目のゲーム', '注目の体験', '注目のバーチャル空間', '注目'],
      recommended: ['おすすめ', 'あなたへのおすすめ', 'あなたにおすすめ', 'おすすめのゲーム', 'おすすめの体験', 'おすすめのバーチャル空間']
    },
    profile: {
      wearing: ['現在着用中', '現在装着中', '着用中', '装備中', '現在のアバター'],
      store: ['ストア', 'ショップ'], experiences: ['体験', 'バーチャル空間', 'ゲーム', '作品', '制作', '制作物'],
      favorites: ['お気に入り'], collections: ['コレクション'], friends: ['フレンド', '友達', 'つながり'],
      communities: ['コミュニティ', 'グループ'], badges: ['バッジ']
    },
    store: { subscriptions: ['サブスクリプション', '定期購入'], passes: ['パス', 'ゲームパス'], products: ['商品', '製品', '開発者製品', '開発者商品'] },
    avatar: {
      recent: ['最近', '最近のアイテム', '最近着用したもの'], avatars: ['アバター'], body: ['ボディ', '体', '体のパーツ', 'ボディパーツ'],
      makeup: ['メイク'], clothing: ['服', '衣装', '服装'], accessories: ['アクセサリー', 'アクセサリ'], backgrounds: ['背景'],
      animations: ['アニメーション', 'アニメ'], expired: ['期限切れ', '有効期限切れ'], 'recently added': ['最近追加', '最近追加したもの', '最近、追加されたもの'],
      'currently wearing': ['現在着用中', '現在装着中', '着用中', '装備中', '最近の装備'], purchased: ['購入済み'], creations: ['作品', '制作物'],
      heads: ['頭', '頭部', 'ヘッド'], 'skin tone': ['肌の色', 'スキンのトーン'], hair: ['髪', '髪型', 'ヘア'], torso: ['胴体'],
      'left arms': ['左腕'], 'right arms': ['右腕'], 'left legs': ['左脚', '左足'], 'right legs': ['右脚', '右足'],
      scale: ['スケール', 'サイズ', '体型', '拡大/縮小'], hats: ['帽子'], face: ['顔', 'フェイス'], neck: ['首'], shoulders: ['肩'],
      front: ['前面', '前'], back: ['背中', '背面'], waist: ['腰'], gear: ['ギア', '装備'], tops: ['トップス'],
      outerwear: ['アウター', 'アウターウェア', '上着'], bottoms: ['ボトムス'], shirts: ['シャツ'], 't-shirts': ['tシャツ', 't シャツ'],
      pants: ['パンツ', 'ズボン'], jackets: ['ジャケット'], sweaters: ['セーター'], shorts: ['ショートパンツ', '短パン'],
      'dresses & skirts': ['ワンピースとスカート', 'ドレスとスカート', 'ワンピース＆スカート', 'ドレス＆スカート'],
      shoes: ['靴', 'シューズ'], classic: ['クラシック', '定番'], 'left shoe': ['左の靴', '左靴', '靴（左）'], 'right shoe': ['右の靴', '右靴', '靴（右）'],
      'classic shirts': ['クラシックシャツ', '定番のシャツ'], 'classic t-shirts': ['クラシックtシャツ', 'クラシック tシャツ', '定番のTシャツ'],
      'classic pants': ['クラシックパンツ', '定番のズボン'], looks: ['ルックス', 'コーデ'], eyes: ['目'], lips: ['唇', 'リップ'],
      eyelashes: ['まつげ'], eyebrows: ['眉毛', 'まゆげ'], faces: ['表情'], emotes: ['エモート', 'アクション', 'リアクション'],
      idle: ['待機', 'アイドル'], walk: ['歩行', '歩く'], run: ['走行', '走る'], jump: ['ジャンプ'], fall: ['落下'],
      climb: ['登る', 'クライム'], swim: ['泳ぐ', '水泳'], bundles: ['バンドル'], characters: ['キャラクター'], costumes: ['コスチューム']
    }
  };
  const thai = {
    home: {
      favorites: ['รายการโปรด', 'เกมโปรด', 'เกมที่ชื่นชอบ', 'ประสบการณ์โปรด'],
      standout: ['เกมที่โดดเด่น', 'เกมเด่น', 'ประสบการณ์ที่โดดเด่น', 'ประสบการณ์เด่น'],
      recommended: ['แนะนำสำหรับคุณ', 'แนะนำให้คุณ', 'ที่แนะนำสำหรับคุณ', 'เกมที่แนะนำ', 'ประสบการณ์ที่แนะนำ', 'แนะนำ']
    },
    profile: {
      wearing: ['กำลังสวมใส่', 'สวมอยู่ตอนนี้', 'สวมใส่อยู่', 'สวมใส่ในขณะนี้', 'สวมใส่อยู่ในขณะนี้', 'สวมใส่ปัจจุบัน'],
      store: ['ร้านค้า'], experiences: ['ประสบการณ์', 'ผลงาน', 'การสร้างสรรค์', 'เกม'], favorites: ['รายการโปรด'],
      collections: ['คอลเลกชัน', 'คอลเลคชั่น', 'คอลเล็กชัน'], friends: ['เพื่อน', 'การเชื่อมต่อ'],
      communities: ['ชุมชน', 'กลุ่ม'], badges: ['เหรียญตรา', 'แบดจ์']
    },
    store: { subscriptions: ['การสมัครสมาชิก', 'สมาชิก'], passes: ['พาส', 'บัตรผ่าน', 'บัตรผ่านเกม', 'ใบผ่านเกม'], products: ['ผลิตภัณฑ์', 'สินค้า', 'ผลิตภัณฑ์ผู้พัฒนา', 'ผลิตภัณฑ์นักพัฒนา'] },
    avatar: {
      recent: ['ล่าสุด', 'สวมใส่ล่าสุด'], avatars: ['อวาตาร์', 'อวาทาร์'], body: ['ร่างกาย', 'ส่วนของร่างกาย'],
      makeup: ['แต่งหน้า', 'การแต่งหน้า', 'เครื่องสำอาง'], clothing: ['เสื้อผ้า', 'เครื่องแต่งกาย'], accessories: ['เครื่องประดับ', 'อุปกรณ์เสริม', 'ไอเท็มเสริม'],
      backgrounds: ['พื้นหลัง'], animations: ['แอนิเมชัน', 'แอนิเมชั่น', 'ภาพเคลื่อนไหว'], expired: ['หมดอายุ', 'หมดอายุแล้ว'],
      'recently added': ['เพิ่มล่าสุด', 'เพิ่มเข้ามาล่าสุด', 'เพิ่มเมื่อเร็ว ๆ นี้'], 'currently wearing': ['กำลังสวมใส่', 'สวมอยู่ตอนนี้', 'สวมใส่อยู่'],
      purchased: ['ซื้อแล้ว', 'ที่ซื้อ'], creations: ['ผลงาน', 'การสร้างสรรค์', 'ผลงานสร้างสรรค์'], heads: ['ศีรษะ', 'หัว'], 'skin tone': ['สีผิว'], hair: ['ผม', 'ทรงผม'],
      torso: ['ลำตัว'], 'left arms': ['แขนซ้าย'], 'right arms': ['แขนขวา'], 'left legs': ['ขาซ้าย'], 'right legs': ['ขาขวา'],
      scale: ['สัดส่วน', 'ขนาด', 'การปรับขนาด'], hats: ['หมวก'], face: ['ใบหน้า', 'หน้า'], neck: ['คอ'], shoulders: ['ไหล่'],
      front: ['ด้านหน้า'], back: ['ด้านหลัง', 'หลัง'], waist: ['เอว'], gear: ['อุปกรณ์'], tops: ['เสื้อท่อนบน', 'ท่อนบน', 'เสื้อผ้าท่อนบน'],
      outerwear: ['เสื้อคลุม', 'เสื้อผ้าชั้นนอก', 'เสื้อชั้นนอก'], bottoms: ['ท่อนล่าง', 'เสื้อผ้าท่อนล่าง'], shirts: ['เสื้อเชิ้ต'], 't-shirts': ['เสื้อยืด'],
      pants: ['กางเกง', 'กางเกงขายาว'], jackets: ['แจ็กเก็ต', 'เสื้อแจ็กเก็ต', 'เสื้อแจ็คเก็ต'], sweaters: ['เสื้อสเวตเตอร์', 'เสื้อกันหนาว'], shorts: ['กางเกงขาสั้น'],
      'dresses & skirts': ['ชุดเดรสและกระโปรง', 'เดรสและกระโปรง'], shoes: ['รองเท้า'], classic: ['คลาสสิก'],
      'left shoe': ['รองเท้าซ้าย', 'รองเท้าข้างซ้าย'], 'right shoe': ['รองเท้าขวา', 'รองเท้าข้างขวา'], 'classic shirts': ['เสื้อเชิ้ตคลาสสิก', 'เสื้อเชิ้ตแบบคลาสสิก'],
      'classic t-shirts': ['เสื้อยืดคลาสสิก', 'เสื้อยืดแบบคลาสสิก'], 'classic pants': ['กางเกงคลาสสิก', 'กางเกงขายาวแบบคลาสสิก'], looks: ['ลุค', 'รูปลักษณ์'],
      eyes: ['ดวงตา', 'ตา'], lips: ['ริมฝีปาก'], eyelashes: ['ขนตา'], eyebrows: ['คิ้ว'], faces: ['การแสดงสีหน้า'],
      emotes: ['อีโมต', 'ท่าทาง'], idle: ['ยืนนิ่ง', 'อยู่นิ่ง'], walk: ['เดิน'], run: ['วิ่ง'], jump: ['กระโดด'], fall: ['ตก', 'ร่วง', 'หล่น'],
      climb: ['ปีน', 'ปีนป่าย'], swim: ['ว่ายน้ำ'], bundles: ['บันเดิล', 'ชุดรวม'], characters: ['ตัวละคร'], costumes: ['ชุดแต่งกาย']
    }
  };
  const korean = {
    home: {
      favorites: ['즐겨찾기', '즐겨찾는 게임', '즐겨찾는 체험'],
      standout: ['주목할 게임', '주목할 만한 게임', '주목할 만한 체험', '주목받는 게임', '주목받는 체험', '눈에 띄는 게임'],
      recommended: ['이런 건 어떠세요', '추천', '추천 게임', '추천 체험', '추천 콘텐츠', '맞춤 추천', '회원님을 위한 추천', '나를 위한 추천', '추천 항목']
    },
    profile: {
      wearing: ['현재 착용 중', '현재 착용중', '현재 착용', '지금 착용 중', '착용 중', '착용중', '현재 장착 중', '현재 장착중'],
      store: ['상점', '스토어'], experiences: ['체험', '게임', '작품', '창작물', '제작물'], favorites: ['즐겨찾기'],
      collections: ['컬렉션', '모음'], friends: ['친구', '인맥', '연결'], communities: ['커뮤니티', '그룹'], badges: ['배지']
    },
    store: { subscriptions: ['구독', '정기 구독'], passes: ['패스', '게임 패스'], products: ['상품', '제품', '개발자 상품', '개발자 제품'] },
    avatar: {
      recent: ['최근', '최근 착용', '최근 착용한 항목', '최근 장착'], avatars: ['아바타'], body: ['신체', '몸', '신체 부위'],
      makeup: ['메이크업', '화장'], clothing: ['의상', '의류', '옷', '복장'], accessories: ['액세서리', '악세사리', '장신구'],
      backgrounds: ['배경'], animations: ['애니메이션'], expired: ['만료', '만료됨', '만료된 항목'],
      'recently added': ['최근 추가', '최근 추가됨', '최근에 추가됨', '새로 추가된 아이템'],
      'currently wearing': ['현재 착용 중', '현재 착용중', '현재 착용', '지금 착용 중', '착용 중', '착용중', '현재 장착 중', '현재 장착중'],
      purchased: ['구매함', '구매한 항목', '구매 완료'], creations: ['창작물', '작품', '제작물'],
      heads: ['머리', '머리 부위'], 'skin tone': ['피부색', '피부 색', '피부 톤'], hair: ['헤어', '머리카락'], torso: ['몸통'],
      'left arms': ['왼팔', '왼쪽 팔', '왼 팔'], 'right arms': ['오른팔', '오른쪽 팔', '오른 팔'],
      'left legs': ['왼다리', '왼쪽 다리', '왼 다리'], 'right legs': ['오른다리', '오른쪽 다리', '오른 다리'],
      scale: ['크기', '크기 조정', '크기 조절', '비율', '배율'], hats: ['모자'], face: ['얼굴'], neck: ['목'], shoulders: ['어깨'],
      front: ['앞', '앞면', '전면'], back: ['등', '뒤', '뒷면', '후면'], waist: ['허리'], gear: ['장비'], tops: ['상의'],
      outerwear: ['겉옷', '아우터'], bottoms: ['하의'], shirts: ['셔츠'], 't-shirts': ['티셔츠', '티 셔츠'],
      pants: ['바지', '긴바지', '긴 바지'], jackets: ['재킷', '자켓'], sweaters: ['스웨터'], shorts: ['반바지'],
      'dresses & skirts': ['드레스 및 스커트', '드레스와 스커트', '드레스 및 치마', '드레스와 치마', '드레스 & 스커트', '원피스 및 치마'],
      shoes: ['신발'], classic: ['클래식'], 'left shoe': ['왼쪽 신발', '왼발 신발'], 'right shoe': ['오른쪽 신발', '오른발 신발'],
      'classic shirts': ['클래식 셔츠'], 'classic t-shirts': ['클래식 티셔츠', '클래식 티 셔츠'], 'classic pants': ['클래식 바지'],
      looks: ['룩', '외형', '스타일'], eyes: ['눈'], lips: ['입술'], eyelashes: ['속눈썹'], eyebrows: ['눈썹'], faces: ['표정'],
      emotes: ['감정 표현', '이모트', '동작'], idle: ['대기', '대기 동작', '서 있기', '빈둥대기'], walk: ['걷기'], run: ['달리기'],
      jump: ['점프', '점프하기'], fall: ['낙하', '떨어지기'], climb: ['오르기', '등반'], swim: ['수영', '수영하기'],
      bundles: ['번들', '묶음'], characters: ['캐릭터'], costumes: ['코스튬', '의상 세트']
    }
  };
  for (const language of [indonesian, japanese, thai, korean]) for (const [group, entries] of Object.entries(language)) {
    for (const [key, aliases] of Object.entries(entries)) groups[group][key].push(...aliases);
  }
  const indexes = Object.fromEntries(Object.entries(groups).map(([group, entries]) =>
    [group, new Map(Object.entries(entries).flatMap(([key, aliases]) => aliases.map(alias => [normalize(alias), key])))]));
  const patterns = {
    settings: /^(?:(?:my )?settings|设置|設定|设定|我的设置|我的設定)$/,
    chat: /^(?:chat|聊天|聊天功能)$/,
    seeAll: /^(?:see all|view all|查看全部|查看所有|显示全部|顯示全部|檢視全部)$/,
    about: /^(?:about|关于|關於|简介|簡介|介绍|介紹)$/,
    creations: /^(?:creations|创作|創作|作品)$/,
    more: /^(?:more|see more|show more|更多|查看更多|显示更多|顯示更多)$/,
    noBio: /^(?:no bio yet\.?|暂无简介[。.]?|尚无简介[。.]?|尚無簡介[。.]?|尚未新增簡介[。.]?)$/,
    followers: /\bfollowers?\b|粉丝|粉絲|追踪者|追蹤者|关注者|關注者/,
    tryOn: /^(?:try on|take off|试穿|試穿|试戴|試戴|穿上|脱下|脫下|卸下)$/,
    join: /\bjoin\b|加入(?:游戏|遊戲|体验|體驗|服务器|伺服器)?/,
    livePlayers: /^(?:active|playing|currently playing|current players|active players|players online|活跃|活躍|正在游戏|正在遊戲|当前玩家|目前玩家|活跃玩家|活躍玩家|在线玩家|線上玩家|正在体验|正在體驗)$/,
    loadMore: /^(?:load more(?: (?:private )?servers)?|加载更多(?:服务器)?|加載更多(?:伺服器)?|載入更多(?:伺服器)?|显示更多(?:服务器)?|顯示更多(?:伺服器)?|查看更多(?:服务器|伺服器)?)$/,
    sortBy: /^(?:sort by|排序|排序方式|排序依据|排序依據)[:]?$/,
    excludeFull: /^(?:exclude full servers|排除已满服务器|排除已滿伺服器|排除满员服务器|排除滿員伺服器|排除已满的服务器|排除已滿的伺服器)$/,
    emptyServers: /no private servers found|you don.t have any private servers|no (?:public |running )?servers (?:found|available)|no running experiences|没有(?:可用的?)?(?:私人|公共)?服务器|沒有(?:可用的?)?(?:私人|公共)?伺服器|未找到(?:私人|公共)?服务器|找不到(?:私人|公共)?伺服器|尚无私人服务器|尚無私人伺服器/,
    publicEmptyServers: /no (?:public |running )?servers (?:found|available)|no running experiences|(?:没有|暂无|未找到)(?:可用的?)?(?:公共)?服务器|(?:沒有|暫無|找不到)(?:可用的?)?(?:公共)?伺服器/,
    createPrivate: /create\s+(?:a\s+)?private server|创建私人服务器|建立私人伺服器|創建私人伺服器/,
    emptyStore: /no (?:passes|game passes|products|subscriptions)|does not (?:have|sell)|没有(?:任何|可用的?)?(?:通行证|商品|产品|订阅)|沒有(?:任何|可用的?)?(?:通行證|商品|產品|訂閱)|不(?:出售|销售|販售)/
  };
  const indonesianPatterns = {
    settings: /^(?:pengaturan|pengaturan saya|setelan)$/,
    chat: /^(?:obrolan|chat)$/,
    seeAll: /^(?:lihat semua|tampilkan semua)$/,
    about: /^tentang$/,
    creations: /^kreasi$/,
    more: /^(?:lainnya|selengkapnya|lihat selengkapnya|tampilkan lainnya|lihat lainnya)$/,
    noBio: /^(?:belum ada bio|belum ada biografi)[.!]?$/,
    followers: /\bpengikut\b/,
    tryOn: /^(?:coba|coba pakai|lepas|lepaskan)$/,
    join: /^(?:gabung|bergabung)(?:\s+(?:ke|dengan|game|server|pengalaman virtual)\b.*)?$/,
    livePlayers: /^(?:aktif|sedang bermain|pemain aktif|pemain saat ini|pemain online)$/,
    loadMore: /^(?:load|muat|tampilkan) (?:lebih banyak(?: server(?: privat)?)?|lainnya|server lainnya|server privat lainnya)$/,
    sortBy: /^(?:urutkan berdasarkan|urutkan menurut|urutkan)[:]?$/,
    excludeFull: /^(?:mengecualikan|kecualikan|sembunyikan) server (?:yang )?(?:sudah )?penuh$/,
    emptyServers: /tidak (?:ada|ditemukan|menemukan) server(?: publik| privat)?|anda (?:belum|tidak) memiliki server privat|tidak ada pengalaman virtual yang berjalan/,
    publicEmptyServers: /tidak (?:ada|ditemukan|menemukan) server(?: publik)?(?: yang)? (?:tersedia|ditemukan|berjalan)\b|tidak (?:ada|ditemukan|menemukan) server(?: publik)?[.!]?\s*$|tidak ada pengalaman virtual yang berjalan/,
    createPrivate: /buat(?: sebuah)? server privat/,
    emptyStore: /tidak (?:ada|memiliki|menjual) (?:pass|produk|langganan)|belum (?:ada|menjual) (?:pass|produk|langganan)/
  };
  const japanesePatterns = {
    settings: /^(?:設定|マイ設定|アカウント設定)$/,
    chat: /^チャット$/,
    seeAll: /^(?:すべて表示|全て表示|すべて見る|全て見る)$/,
    about: /^(?:概要|紹介|詳細|について)$/,
    creations: /^(?:作品|制作|制作物)$/,
    more: /^(?:もっと見る|もっと表示|さらに表示|詳細|その他)$/,
    noBio: /^(?:自己紹介(?:はまだ|が)?ありません|まだ自己紹介はありません|紹介文はまだありません)[。.]?$/,
    followers: /フォロワー/,
    tryOn: /^(?:試着|試着する|外す|脱ぐ|着用|着用する)$/,
    join: /^(?:(?:ゲーム|体験|バーチャル空間|サーバー)に)?(?:参加|参加する)$/,
    livePlayers: /^(?:プレイ中|現在プレイ中|プレイヤー数|アクティブ|アクティブなプレイヤー|オンラインのプレイヤー)$/,
    loadMore: /^(?:(?:サーバー|プライベートサーバー)を)?(?:さらに読み込む|もっと読み込む|もっと表示|さらに表示)$/,
    sortBy: /^(?:並び替え|並べ替え|並び順|ソート)[:：]?$/,
    excludeFull: /^(?:満員のサーバーを(?:除外|非表示)(?:にする)?|満員のサーバーを表示しない)$/,
    emptyServers: /(?:(?:プライベート|公開)?サーバー|稼働中の(?:ゲーム|体験|バーチャル空間))(?:は|が)(?:見つかりません|ありません|ない)|プライベートサーバーを(?:所有|保有)していません/,
    publicEmptyServers: /^(?!.*プライベート).*(?:(?:公開)?サーバー|稼働中の(?:ゲーム|体験|バーチャル空間))(?:は|が)(?:見つかりません|ありません|ない)/,
    createPrivate: /プライベートサーバー(?:を)?作成/,
    emptyStore: /(?:パス|ゲームパス|商品|製品|サブスクリプション|定期購入)(?:は|が)(?:ありません|見つかりません)|販売していません/
  };
  // NFKC also decomposes Thai SARA AM. Normalize the pattern sources just as we
  // normalize native labels, so words such as กำลัง still match both forms.
  const thaiPatterns = Object.fromEntries(Object.entries({
    settings: /^(?:การตั้งค่า|ตั้งค่า|การตั้งค่าของฉัน)$/,
    chat: /^(?:แชท|แชต|สนทนา)$/,
    seeAll: /^(?:ดูทั้งหมด|แสดงทั้งหมด)$/,
    about: /^(?:เกี่ยวกับ|ข้อมูล|รายละเอียด)$/,
    creations: /^(?:ผลงาน|การสร้างสรรค์)$/,
    more: /^(?:เพิ่มเติม|ดูเพิ่มเติม|แสดงเพิ่มเติม)$/,
    noBio: /^(?:ยังไม่มีประวัติส่วนตัว|ยังไม่มีคำแนะนำตัว|ยังไม่มีข้อมูลส่วนตัว)[.!]?$/,
    followers: /ผู้ติดตาม/,
    tryOn: /^(?:ลองสวม|ลองสวมใส่|ลองใส่|ถอด|ถอดออก)$/,
    join: /^(?:เข้าร่วม|เข้าร่วมเกม|เข้าร่วมเซิร์ฟเวอร์)$/,
    livePlayers: /^(?:กำลังเล่น|ผู้เล่นที่กำลังเล่น|ผู้เล่นออนไลน์|ผู้เล่นปัจจุบัน|ผู้เล่นที่ใช้งานอยู่|ใช้งานอยู่)$/,
    loadMore: /^(?:โหลดเพิ่มเติม|โหลดเซิร์ฟเวอร์เพิ่มเติม|แสดงเพิ่มเติม|ดูเพิ่มเติม)$/,
    sortBy: /^(?:เรียงตาม|จัดเรียงตาม|เรียงลำดับ|จัดเรียง)[:]?$/,
    excludeFull: /^(?:ยกเว้น|ไม่รวม|ซ่อน)เซิร์ฟเวอร์ที่เต็ม$/,
    emptyServers: /(?:ไม่มี|ไม่พบ)เซิร์ฟเวอร์(?:ส่วนตัว|สาธารณะ)?|คุณไม่มีเซิร์ฟเวอร์ส่วนตัว|ไม่มีประสบการณ์ที่กำลังทำงาน/,
    publicEmptyServers: /^(?!.*ส่วนตัว).*(?:(?:ไม่มี|ไม่พบ)เซิร์ฟเวอร์(?:สาธารณะ)?|ไม่มีประสบการณ์ที่กำลังทำงาน)/,
    createPrivate: /สร้างเซิร์ฟเวอร์ส่วนตัว/,
    emptyStore: /(?:ไม่มี|ไม่พบ|ไม่ได้ขาย)(?:พาส|บัตรผ่าน|ใบผ่านเกม|ผลิตภัณฑ์|สินค้า|การสมัครสมาชิก)/
  }).map(([key, pattern]) => [key, new RegExp(pattern.source.normalize('NFKC'), pattern.flags)]));
  const koreanPatterns = {
    settings: /^(?:설정|내 설정|계정 설정)$/,
    chat: /^채팅$/,
    seeAll: /^(?:모두 보기|전체 보기|모두 표시|전체 표시)$/,
    about: /^(?:소개|정보|상세 정보)$/,
    creations: /^(?:창작물|작품|제작물)$/,
    more: /^(?:더 보기|더보기|더 표시|더 불러오기|추가로 보기)$/,
    noBio: /^(?:아직 소개가 없습니다|소개가 없습니다|아직 자기소개가 없습니다)[.!]?$/,
    followers: /팔로워/,
    tryOn: /^(?:착용|착용하기|착용해 보기|착용해보기|입어 보기|벗기|벗기기|착용 해제)$/,
    join: /^(?:(?:게임|체험|서버)(?:에)?\s*)?(?:참가|참여|접속)(?:하기)?$/,
    livePlayers: /^(?:활성|플레이 중|현재 플레이 중|활성 플레이어|접속 중인 플레이어|현재 플레이어)$/,
    loadMore: /^(?:(?:비공개 |공개 )?서버\s*)?(?:더 보기|더보기|더 불러오기|추가로 불러오기)$/,
    sortBy: /^(?:정렬|정렬 기준|정렬 방식)[:]?$/,
    excludeFull: /^(?:가득 찬 서버 (?:제외|숨기기)|인원이 가득 찬 서버 제외|만원 서버 제외)$/,
    emptyServers: /(?:(?:비공개 |공개 |실행 중인 )?서버|실행 중인 체험)(?:가|이|를)?\s*(?:없습니다|찾을 수 없습니다)|비공개 서버를 (?:보유|소유)하고 있지 않습니다/,
    publicEmptyServers: /^(?!.*비공개).*(?:(?:공개 |실행 중인 )?서버|실행 중인 체험)(?:가|이|를)?\s*(?:없습니다|찾을 수 없습니다)/,
    createPrivate: /비공개 서버(?:를)?\s*(?:만들기|생성)/,
    emptyStore: /(?:패스|상품|제품|구독)(?:가|이|을|를)?\s*(?:없습니다|찾을 수 없습니다|판매하지 않습니다)/
  };

  function classify(group, text) {
    let label = normalize(text);
    if (label.length > 200) return '';
    if (group === 'home' || group === 'profile') label = label
      .replace(/\s*[→›»>]\s*$/, '')
      .replace(/\s*(?:see all|view all|lihat semua|tampilkan semua|lihat selengkapnya|查看全部|查看所有|檢視全部|显示全部|顯示全部|查看更多|显示更多|顯示更多|すべて表示|全て表示|すべて見る|全て見る|ดูทั้งหมด|แสดงทั้งหมด|모두 보기|전체 보기|모두 표시|전체 표시)\s*$/, '')
      .replace(/\s*\([\d,.]+\)\s*$/, '').trim();
    if (group === 'avatar') label = label.replace(/[⌄⌃▾▴▼▲]+$/, '').trim()
      .replace(/\s*(?: menu| tab|菜单|選單|选项卡|索引標籤|メニュー|タブ|เมนู|แท็บ| 메뉴| 탭)$/, '').trim();
    const exact = indexes[group]?.get(label);
    if (exact) return exact;
    if (group === 'home') {
      for (const [alias, key] of indexes.home) {
        if (key === 'standout' && (label.startsWith(alias + ':') || label.startsWith(alias + ' '))) return key;
      }
    }
    return '';
  }

  function matches(kind, text) {
    const label = normalize(text).replace(/[→›»>]\s*$/, '').trim();
    return patterns[kind]?.test(label) || indonesianPatterns[kind]?.test(label) || japanesePatterns[kind]?.test(label) || thaiPatterns[kind]?.test(label) || koreanPatterns[kind]?.test(label) || false;
  }
  function previewMode(text) {
    const label = normalize(text);
    return label.match(/^(?:(?:switch to|view in|beralih ke|alih ke|lihat dalam|tampilkan dalam)\s*|(?:切换至|切換至|切换到|切換到|切换为|切換為|以)\s*)?([23])\s*d(?:\s*(?:view|tampilan|视图|視圖|模式|查看|检视|檢視))?$/)?.[1]
      || label.match(/^([23])\s*d(?:表示|ビュー|プレビュー)?(?:に切り替え(?:る)?|で表示|を表示)$/)?.[1]
      || label.match(/^(?:เปลี่ยนเป็น|สลับเป็น|สลับไปยัง|ดูแบบ|ดูในแบบ|แสดงแบบ|แสดงในรูปแบบ)\s*([23])\s*d$/)?.[1]
      || label.match(/^([23])\s*d(?:\s*(?:미리 보기|미리보기|보기|모드))?(?:(?:로|으로)?\s*(?:전환|보기|표시))?$/)?.[1] || '';
  }
  function playerCount(text) {
    const label = normalize(text).replace(/\b\d{1,3}(?:\.\d{3})+\b/g, value => value.replaceAll('.', ''));
    const korean = label.match(/(?:최대\s*)?(\d[\d,]*)\s*명\s*중\s*(\d[\d,]*)\s*명/);
    if (korean) {
      const playing = Number(korean[2].replaceAll(',', ''));
      const maxPlayers = Number(korean[1].replaceAll(',', ''));
      return Number.isSafeInteger(playing) && Number.isSafeInteger(maxPlayers) && maxPlayers >= playing
        ? { playing, maxPlayers, text: korean[0] } : null;
    }
    const japanese = label.match(/(?:最大)?(\d[\d,]*)\s*人中\s*(\d[\d,]*)\s*人/);
    if (japanese) {
      const playing = Number(japanese[2].replaceAll(',', ''));
      const maxPlayers = Number(japanese[1].replaceAll(',', ''));
      return Number.isSafeInteger(playing) && Number.isSafeInteger(maxPlayers) && maxPlayers >= playing
        ? { playing, maxPlayers, text: japanese[0] } : null;
    }
    const pair = label.match(/(\d[\d,]*)\s*(?:of|dari|จาก|\/)\s*(?:(?:maksimal|maksimum|สูงสุด)\s*)?(\d[\d,]*)(?:\s*(?:people max|orang|pemain|คน|ผู้เล่น|人|位玩家|名玩家))?/i)
      || label.match(/(\d[\d,]*)\s*(?:人|位玩家|名玩家)?\s*[,，(]?\s*(?:最多|上限|最大)\s*(\d[\d,]*)\s*(?:人|位玩家|名玩家)/);
    const count = pair || label.match(/(\d[\d,]*)\s*(?:players?\b|people\b|pemain\b|orang\b|คน|ผู้เล่น|位玩家|名玩家|人|명)/);
    if (!count) return null;
    const playing = Number(count[1].replaceAll(',', ''));
    const maxPlayers = pair ? Number(pair[2].replaceAll(',', '')) : null;
    return Number.isSafeInteger(playing) && playing >= 0
      && (maxPlayers === null || Number.isSafeInteger(maxPlayers) && maxPlayers >= playing)
      ? { playing, maxPlayers, text: count[0] } : null;
  }
  const api = Object.freeze({ normalize, classify, matches, previewMode, playerCount });
  globalThis.RobloxCustomizerNativeLabels = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
