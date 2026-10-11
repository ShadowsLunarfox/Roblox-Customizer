const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/shared/page-bridge.js'), 'utf8');

function environment(pathname = '/home', overrides = {}) {
  const listeners = {};
  const window = {};
  const context = vm.createContext({
    window, URL, setTimeout, clearTimeout, console: { warn() {} },
    location: { pathname, href: `https://www.roblox.com${pathname}` },
    document: { addEventListener(name, callback) { listeners[name] = callback; } },
    ...overrides,
  });
  vm.runInContext(source, context);
  return { window, listeners };
}

function runtime(window) {
  const setter = () => {};
  window.React = {
    createElement: (type, props) => ({ type, props }),
    useState: initial => [Array.isArray(initial) ? initial.slice(0, 20) : initial, setter],
  };
  window.ReactJSX = {
    jsx: (type, props) => ({ type, props }),
    jsxs: (type, props) => ({ type, props }),
  };
  return { react: window.React, setter };
}

test('native home state exposes the full list while retaining its React setter', () => {
  const { window } = environment();
  const { react, setter } = runtime(window);
  const friends = Array.from({ length: 167 }, (_, id) => ({ id: id + 1 }));
  function FriendsList(props) {
    return { friends: react.useState(props.friendsList), unrelated: react.useState(false) };
  }
  for (const factory of [react.createElement, window.ReactJSX.jsx, window.ReactJSX.jsxs]) {
    const element = factory(FriendsList, { friendsList: friends, carouselName: 'WebHomeFriendsCarousel' });
    const result = element.type(element.props);
    assert.strictEqual(result.friends[0], friends);
    assert.strictEqual(result.friends[1], setter);
    assert.equal(result.unrelated[0], false);
    const repeated = factory(FriendsList, element.props);
    assert.strictEqual(repeated.type, element.type);
  }
  assert.equal(react.useState(friends)[0].length, 20);
  const profile = react.createElement(FriendsList, { friendsList: friends, carouselName: 'WebProfileFriendsCarousel' });
  assert.strictEqual(profile.type, FriendsList);
  assert.equal(profile.type(profile.props).friends[0].length, 20);
});

test('memo and forwardRef keep their wrappers and receive updated native data', () => {
  const { window } = environment();
  const { react } = runtime(window);
  const render = props => react.useState(props.friendsList)[0];
  const forwarded = { $$typeof: Symbol.for('react.forward_ref'), render };
  const compare = () => false;
  const memo = { $$typeof: Symbol.for('react.memo'), type: forwarded, compare };
  const friends = Array.from({ length: 80 }, (_, id) => ({ id }));
  const element = window.ReactJSX.jsx(memo, { friendsList: friends, carouselName: 'WebHomeFriendsCarousel' });
  assert.strictEqual(element.type.compare, compare);
  assert.strictEqual(element.type.type.render(element.props), friends);
  const updated = friends.slice(0, 60);
  assert.strictEqual(element.type.type.render({ ...element.props, friendsList: updated }), updated);
  assert.strictEqual(memo.type.render, render);
});

function attachHttp(window, get) {
  const http = { get };
  window.Roblox = { 'core-scripts': { http: { http } } };
  return http;
}

test('loads enough native data for three rows and stops after 51 friends', async () => {
  const { window } = environment();
  const calls = [];
  const http = attachHttp(window, async function(config) {
    assert.strictEqual(this, http);
    assert.equal(config.withCredentials, true);
    const url = new URL(config.url);
    assert.equal(url.searchParams.get('userSort'), '1');
    const page = Number(url.searchParams.get('cursor') || 0);
    if (page > 0) assert.equal(url.searchParams.get('limit'), '50');
    calls.push(config);
    const items = Array.from({ length: 50 }, (_, index) => ({ id: page * 50 + index + 1 }));
    return { status: 200, data: { PageItems: items, NextCursor: page < 3 ? String(page + 1) : null } };
  });
  const config = { url: 'https://friends.roblox.com/v1/users/123/friends/find?userSort=1', withCredentials: true, retryable: true };
  const result = await http.get(config);
  assert.equal(calls.length, 2);
  assert.equal(result.status, 200);
  assert.equal(result.data.PageItems.length, 51);
  assert.equal(result.data.PageItems.at(-1).id, 51);
  assert.equal(result.data.NextCursor, '2');
  assert.equal(config.url.includes('cursor'), false);
});

test('later page failure keeps the original loaded friends', async () => {
  const { window } = environment();
  let calls = 0;
  const http = attachHttp(window, async () => {
    if (++calls > 1) throw new Error('429');
    return { data: { PageItems: [{ id: 7 }], NextCursor: 'next' } };
  });
  const result = await http.get({ url: 'https://friends.roblox.com/v1/users/123/friends/find' });
  assert.equal(result.data.PageItems.length, 1);
  assert.equal(result.data.PageItems[0].id, 7);
  assert.equal(calls, 2);
});

test('a stalled extra friends page releases the native first page without a click', async () => {
  const timers = new Map();
  let id = 0;
  const { window } = environment('/home', {
    setTimeout(callback, delay) { timers.set(++id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  });
  let calls = 0;
  let finishLate;
  const http = attachHttp(window, () => ++calls === 1
    ? Promise.resolve({ status: 200, data: { PageItems: [{ id: 7 }], NextCursor: 'next' } })
    : new Promise(resolve => { finishLate = resolve; }));
  const pending = http.get({ url: 'https://friends.roblox.com/v1/users/123/friends/find' });
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  assert.equal(timers.size, 1);
  const timeout = [...timers.values()][0];
  assert.ok(timeout.delay <= 4000);
  timeout.callback();
  const result = await pending;
  assert.equal(result.status, 200);
  assert.deepEqual(Array.from(result.data.PageItems, item => item.id), [7]);
  assert.equal(result.data.NextCursor, 'next', 'The native loader can still request remaining friends');
  finishLate({ data: { PageItems: [{ id: 8 }], NextCursor: null } });
  await Promise.resolve();
  assert.deepEqual(Array.from(result.data.PageItems, item => item.id), [7]);
  assert.equal(timers.size, 0);
});

test('repeated cursor stops and requests outside the home friends endpoint pass through', async () => {
  const { window } = environment();
  let calls = 0;
  const response = { data: { PageItems: [{ id: 1 }], NextCursor: 'same' } };
  const http = attachHttp(window, async () => { calls += 1; return response; });
  await http.get({ url: 'https://friends.roblox.com/v1/users/123/friends/find' });
  assert.equal(calls, 2);
  assert.strictEqual(await http.get({ url: 'https://friends.roblox.com/v1/users/123/friends/count' }), response);
  assert.equal(calls, 3);
  const profile = environment('/users/123/profile');
  const profileHttp = attachHttp(profile.window, async () => response);
  assert.strictEqual(await profileHttp.get({ url: 'https://friends.roblox.com/v1/users/123/friends/find' }), response);
});

test('native server data exposes player counts and ping without replacing Join actions', () => {
  const { window } = environment('/games/123/Test');
  const { react } = runtime(window);
  const id = '12345678-1234-1234-1234-123456789012';
  const join = () => 'joined';
  function ServerCard() {
    return { type: 'button', props: { className: 'game-server-join-btn', onClick: join } };
  }
  function ServerList(props) {
    return react.createElement(ServerCard, { id, gameServerStatus: 'Running' });
  }
  const list = react.createElement(ServerList, {
    headerTitle: 'Public Servers', loadMoreGameInstances() {},
    gameInstances: [{ id, playing: 0, ping: 87 }],
  });
  const card = list.type(list.props);
  assert.equal(card.props.playing, 0);
  const button = card.type(card.props);
  assert.equal(button.props['data-rc-instance-id'], id);
  assert.equal(button.props['data-rc-playing'], 0);
  assert.equal(button.props['data-rc-ping'], 87);
  assert.strictEqual(button.props.onClick, join);
});

test('server player counts are exposed even when Roblox has no ping value', () => {
  const { window } = environment('/games/123/Test');
  const { react } = runtime(window);
  const id = '12345678-1234-1234-1234-123456789012';
  function ServerCard() { return { type: 'button', props: { className: 'game-server-join-btn' } }; }
  function ServerList() { return react.createElement(ServerCard, { id, gameServerStatus: 'Running' }); }
  const list = react.createElement(ServerList, {
    headerTitle: 'Public Servers', loadMoreGameInstances() {}, gameInstances: [{ id, playing: 12 }],
  });
  const card = list.type(list.props);
  const button = card.type(card.props);
  assert.equal(button.props['data-rc-playing'], 12);
  assert.equal(button.props['data-rc-ping'], undefined);
});

test('current private cards expose their numeric ID without replacing native children or callbacks', () => {
  const { window } = environment('/games/893973440/Flee-the-Facility');
  const { react } = runtime(window);
  const nativeChildren = { type: 'div', props: { className: 'card-item', children: 'Native controls' } };
  const join = () => 'native join';
  const original = { type: 'li', key: 'native-key', props: {
    className: 'rbx-private-game-server-item col-md-3', children: nativeChildren, onClick: join
  } };
  function Card() { return original; }
  for (const factory of [react.createElement, window.ReactJSX.jsx, window.ReactJSX.jsxs]) {
    for (const [vipServerId, id] of [[111, null], [222, '12345678-1234-1234-1234-123456789012']]) {
      const element = factory(Card, { placeId: 893973440, serverListType: 'private', vipServerId, id,
        gameServerStatus: 'Running', accessCode: 'must-stay-private' });
      const result = element.type(element.props);
      assert.equal(result.props['data-private-server-id'], String(vipServerId));
      assert.strictEqual(result.props.children, nativeChildren);
      assert.strictEqual(result.props.onClick, join);
      assert.equal(result.key, 'native-key');
      assert.equal(JSON.stringify(result).includes('must-stay-private'), false);
    }
  }
});

test('private identity discovery ignores wrong routes, other games and unfamiliar native structures', () => {
  for (const pathname of ['/home', '/games/893973440/Flee-the-Facility']) {
    const { window } = environment(pathname);
    const { react } = runtime(window);
    const original = { type: 'li', props: { className: 'rbx-private-game-server-item' } };
    function Card() { return original; }
    if (pathname === '/home') {
      const element = react.createElement(Card, { placeId: 893973440, serverListType: 'private',
        vipServerId: 111, id: null, gameServerStatus: 'Running' });
      assert.strictEqual(element.type(element.props), original);
    }
    for (const changes of [{ placeId: 999 }, { vipServerId: 0 }, { serverListType: 'public' }]) {
      const element = react.createElement(Card, { placeId: 893973440, serverListType: 'private',
        vipServerId: 111, id: null, gameServerStatus: 'Running', ...changes });
      assert.strictEqual(element.type(element.props), original);
    }
    const different = { type: 'section', props: { children: 'A new native deployment' } };
    const element = react.createElement(() => different, { placeId: 893973440,
      serverListType: 'private', vipServerId: 111, id: null, gameServerStatus: 'Running' });
    assert.strictEqual(element.type(element.props), different);
  }
});

test('compact VIP rows expose identity without requiring legacy card props or exposing access codes', () => {
  for (const pathname of ['/home', '/games/893973440/Flee-the-Facility']) {
    const { window } = environment(pathname);
    const { react } = runtime(window);
    const children = [{ type: 'div', props: { children: 'Native summary' } }, { type: 'button', props: {} }];
    const original = { type: 'div', key: 'native-row', props: {
      className: 'flex items-center justify-between padding-y-medium width-full', children
    } };
    const onJoinClick = () => 'native join';
    const props = { name: 'Same server name', playerCountStatus: '0 of 5 people max',
      thumbnailTargetId: 500, onJoinClick, isJoinDisabled: false, vipServerId: 111,
      showEditIcon: true, joinLabel: '加入', accessCode: 'must-stay-private' };
    for (const factory of [react.createElement, window.ReactJSX.jsx, window.ReactJSX.jsxs]) {
      const card = factory(() => original, props);
      const result = card.type(card.props);
      if (pathname === '/home') assert.strictEqual(result, original);
      else {
        assert.equal(result.props['data-private-server-id'], '111');
        assert.equal(result.props['data-rc-private-server-compact'], '');
        assert.strictEqual(result.props.children, children);
        assert.strictEqual(card.props.onJoinClick, onJoinClick);
        assert.equal(result.key, original.key);
        assert.equal(JSON.stringify(result).includes('must-stay-private'), false);
      }
      for (const changes of [{ vipServerId: undefined }, { vipServerId: 0 },
        { placeId: 999 }, { onJoinClick: undefined }, { playerCountStatus: undefined }]) {
        const other = factory(() => original, { ...props, ...changes });
        assert.strictEqual(other.type(other.props), original, 'Ignore Create, friends and public rows');
      }
    }
  }
});
