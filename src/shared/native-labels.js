/* Fallbacks for native controls without stable IDs. Keep matching scoped to
   headings and controls; game titles and user content are not UI labels. */
(() => {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC')
    .replace(/[\u200e\u200f\u200b\ufeff]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
  const groups = {
    home: {
      favorites: ['favorites', '收藏', '收藏夹', '收藏夾', '最爱', '最愛', '我的最爱', '我的最愛'],
      standout: ['standout games', '精选游戏', '精選遊戲', '精选体验', '精選體驗', '特色游戏', '特色遊戲', '特色体验', '特色體驗'],
      recommended: ['recommended for you', 'recommended games', '为你推荐', '為你推薦', '为您推荐', '為您推薦', '推荐给您', '推薦給您', '推荐给你', '推薦給你', '推荐游戏', '推薦遊戲', '推荐体验', '推薦體驗', '推荐', '推薦']
    },
    profile: {
      wearing: ['currently wearing', '当前穿戴', '目前穿戴', '正在穿戴', '当前穿着', '目前穿著', '目前造型'],
      store: ['store', '商店'], experiences: ['experiences', '体验', '體驗', '游戏', '遊戲'],
      favorites: ['favorites', '收藏', '收藏夹', '收藏夾', '最爱', '最愛'],
      collections: ['collections', '收藏品', '收藏集'], friends: ['friends', '好友', '朋友'],
      communities: ['communities', 'groups', '社区', '社區', '群组', '群組', '社群'],
      badges: ['badge', 'badges', '徽章']
    },
    store: {
      subscriptions: ['subscriptions', '订阅', '訂閱'],
      passes: ['passes', 'game passes', 'gamepasses', '通行证', '通行證', '游戏通行证', '遊戲通行證'],
      products: ['products', 'developer products', '商品', '产品', '產品', '开发者商品', '開發者商品', '开发者产品', '開發者產品']
    },
    avatar: {
      recent: ['recent', '最近', '近期'], avatars: ['avatars', '虚拟形象', '虛擬形象', '虚拟人偶', '虛擬人偶', '化身'],
      body: ['body', '身体', '身體'], makeup: ['makeup', '妆容', '妝容', '化妆', '化妝'],
      clothing: ['clothing', '服装', '服裝', '服饰', '服飾', '衣服'],
      accessories: ['accessories', '配件', '饰品', '飾品', '配饰', '配飾'], backgrounds: ['backgrounds', '背景'],
      animations: ['animations', '动画', '動畫'],
      'recently added': ['recently added', '最近添加', '最近新增', '新增内容', '新增內容'],
      'currently wearing': ['currently wearing', '当前穿戴', '目前穿戴', '正在穿戴', '当前穿着', '目前穿著'],
      purchased: ['purchased', '已购买', '已購買'], creations: ['creations', '创作', '創作', '作品'],
      heads: ['heads', '头部', '頭部'], 'skin tone': ['skin tone', '肤色', '膚色'], hair: ['hair', '头发', '頭髮', '发型', '髮型'],
      torso: ['torso', '躯干', '軀幹'], 'left arms': ['left arms', '左臂', '左手臂'], 'right arms': ['right arms', '右臂', '右手臂'],
      'left legs': ['left legs', '左腿'], 'right legs': ['right legs', '右腿'], scale: ['scale', '比例', '体型', '體型'],
      hats: ['hats', '帽子'], face: ['face', '脸部', '臉部'], neck: ['neck', '颈部', '頸部'],
      shoulders: ['shoulder', 'shoulders', '肩部', '肩膀'], front: ['front', '正面', '前方'], back: ['back', '背部', '背面'],
      waist: ['waist', '腰部'], gear: ['gear', '装备', '裝備'], tops: ['tops', '上装', '上裝', '上衣'],
      outerwear: ['outerwear', '外套', '外衣'], bottoms: ['bottoms', '下装', '下裝', '下身'],
      shirts: ['shirts', '衬衫', '襯衫'], 't-shirts': ['t-shirts', 't恤', 't恤衫'], pants: ['pants', '裤子', '褲子'],
      jackets: ['jackets', '夹克', '夾克'], sweaters: ['sweaters', '毛衣'], shorts: ['shorts', '短裤', '短褲'],
      'dresses & skirts': ['dresses & skirts', 'dresses and skirts', '连衣裙和半身裙', '連衣裙和半身裙', '洋装与裙子', '洋裝與裙子'],
      shoes: ['shoes', '鞋子', '鞋'], classic: ['classic', '经典', '經典'],
      'left shoe': ['left shoe', 'left shoes', '左鞋'], 'right shoe': ['right shoe', 'right shoes', '右鞋'],
      'classic shirts': ['classic shirts', '经典衬衫', '經典襯衫'], 'classic t-shirts': ['classic t-shirts', '经典t恤', '經典t恤'],
      'classic pants': ['classic pants', '经典裤子', '經典褲子'], looks: ['looks', '造型'],
      eyes: ['eyes', '眼睛'], lips: ['lips', '嘴唇'], eyelashes: ['eyelashes', '睫毛'], eyebrows: ['eyebrows', '眉毛'],
      faces: ['faces', '面孔', '表情'], emotes: ['emotes', '表情动作', '表情動作'],
      idle: ['idle', '待机', '待機', '闲置', '閒置'], walk: ['walk', '行走', '走路'], run: ['run', '奔跑', '跑步'],
      jump: ['jump', '跳跃', '跳躍'], fall: ['fall', '下落', '坠落', '墜落'], climb: ['climb', '攀爬'], swim: ['swim', '游泳'],
      bundles: ['bundles', '套装', '套裝'], characters: ['characters', '角色'], costumes: ['costumes', '装扮', '裝扮']
    }
  };
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

  function classify(group, text) {
    let label = normalize(text);
    if (label.length > 200) return '';
    if (group === 'home' || group === 'profile') label = label
      .replace(/\s*[→›»>]\s*$/, '')
      .replace(/\s*(?:see all|view all|查看全部|查看所有|檢視全部|显示全部|顯示全部|查看更多|显示更多|顯示更多)\s*$/, '')
      .replace(/\s*\([\d,]+\)\s*$/, '').trim();
    if (group === 'avatar') label = label.replace(/[⌄⌃▾▴▼▲]+$/, '').trim()
      .replace(/\s*(?: menu| tab|菜单|選單|选项卡|索引標籤)$/, '').trim();
    const exact = indexes[group]?.get(label);
    if (exact) return exact;
    if (group === 'home') {
      for (const [alias, key] of indexes.home) {
        if (key === 'standout' && (label.startsWith(alias + ':') || label.startsWith(alias + ' '))) return key;
      }
    }
    return '';
  }

  function matches(kind, text) { return patterns[kind]?.test(normalize(text).replace(/[→›»>]\s*$/, '').trim()) || false; }
  function previewMode(text) {
    const label = normalize(text);
    return label.match(/^(?:(?:switch to|view in)\s*|(?:切换至|切換至|切换到|切換到|切换为|切換為|以)\s*)?([23])\s*d(?:\s*(?:view|视图|視圖|模式|查看|检视|檢視))?$/)?.[1] || '';
  }
  function playerCount(text) {
    const label = normalize(text);
    const pair = label.match(/(\d[\d,]*)\s*(?:of|\/)\s*(\d[\d,]*)(?:\s*(?:people max|人|位玩家|名玩家))?/i)
      || label.match(/(\d[\d,]*)\s*(?:人|位玩家|名玩家)?\s*[,，(]?\s*(?:最多|上限|最大)\s*(\d[\d,]*)\s*(?:人|位玩家|名玩家)/);
    const count = pair || label.match(/(\d[\d,]*)\s*(?:players?\b|people\b|位玩家|名玩家|人)/);
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
