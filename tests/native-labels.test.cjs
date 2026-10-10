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
