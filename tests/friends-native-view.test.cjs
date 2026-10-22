const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
function environment() {
  const listeners = new Map(), updates = [], pages = [];
  const location = { pathname: '/users/friends', hash: '#!/friends', href: 'https://www.roblox.com/users/friends#!/friends' };
  const document = { documentElement: { hasAttribute() { return false; } },
    addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(listener); },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); }, querySelector() { return null; } };
  const context = vm.createContext({ window: {}, document, location, URL, console, setTimeout, clearTimeout,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  for (const file of ['src/shared/friends-native-view.js', 'src/shared/page-bridge.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context);
  const nativeContext = { paginatedFriends: [], setPaginatedFriends() {}, friendsSort: 'native-sort', untouched: true };
  const pageSetter = value => pages.push(value);
  context.window.React = { createElement: (type, props) => ({ type, props }), useState: initial => [initial, pageSetter], useContext: () => nativeContext };
  const original = [{ id: 1, name: 'First', displayName: 'One', presence: { userPresenceType: 2, isPlayable: true }, nativeOnly: 'retained' }, { id: 2, name: 'Second', displayName: 'Two' }];
  const props = { friends: original, metadata: { profileUserId: 100, isMyProfile: true }, currentTab: 'friends', title: 'Connections',
    setFriends: value => updates.push(value), loadMoreFriends() {}, enableTabLoader() {}, disableTabLoader() {}, originalHandler() {} };
  function NativeController(props) { const state = context.window.React.useState(1); return { props, state, context: context.window.React.useContext({}) }; }
  const render = (value = props) => { const element = context.window.React.createElement(NativeController, value); return element.type(element.props); };
  const configure = data => document.dispatchEvent({ type: 'rc-friends-native-view', detail: JSON.stringify({ enabled: true, route: '/users/friends#!/friends', accountId: 100,
    kind: 'friends', apply: true, sort: 'name', filterKey: 'initial', ids: [65, 1], records: [{ id: 1 }, { id: 65, name: 'Last', displayName: 'Last' }], presences: { 65: 0 }, removedIds: [], ...data }) });
  return { context, props, original, configure, render, updates, pages, nativeContext, pageSetter, document, location };
}
test('friend filters reuse the original native controller, callbacks, metadata and pagination hooks', () => {
  const e = environment(), initial = e.render();
  assert.equal(initial.props, e.props); assert.equal(initial.props.friends, e.original);
  e.configure();
  assert.equal(e.pages.at(-1), 1); assert.equal(e.updates.at(-1).length, 2, 'Refresh retains the original Redux data');
  const next = e.render();
  assert.deepEqual(Array.from(next.props.friends, item => item.id), [65, 1]);
  assert.equal(next.props.originalHandler, e.props.originalHandler); assert.equal(next.props.metadata, e.props.metadata);
  assert.equal(next.props.friends[1].nativeOnly, 'retained'); assert.equal(next.props.friends[1].presence, e.original[0].presence);
  assert.equal(next.state[1], e.pageSetter, 'Original pagination setter remains mounted');
  assert.equal(next.context.friendsSort, null); assert.equal(next.context.untouched, true);
  assert.equal(e.context.window.React.useContext({}), e.nativeContext, 'Unrelated components retain the native context');
  assert.deepEqual(e.original.map(item => item.id), [1, 2], 'Filtering never mutates original records');
  const pages = e.pages.length;
  e.configure({ presences: { 65: 1 } });
  assert.equal(e.pages.length, pages, 'Background status changes preserve the current native page');
  e.configure({ filterKey: 'online' });
  assert.equal(e.pages.length, pages + 1, 'Changing a filter starts at the first native page');
  e.configure({ enabled: false });
  assert.equal(e.render().props.friends, e.original);
});
test('other profiles, routes and unrecognized components keep the native data unchanged', () => {
  const e = environment(); e.configure();
  const other = { ...e.props, metadata: { profileUserId: 999, isMyProfile: false } };
  assert.equal(e.render(other).props.friends, e.original);
  e.location.pathname = '/home';
  assert.equal(e.render().props.friends, e.original);
  const view = e.context.window.RobloxCustomizerFriendsNativeView;
  assert.equal(view.matches({ ...e.props, id: 1 }), false);
  assert.equal(view.matches({ ...e.props, isMyProfile: true }), false, 'Headers and individual cards are not list controllers');
  assert.equal(view.matches({ friends: [], setFriends() {} }), false);
});
test('native write observation reports only successful matching native requests and preserves their promises', async () => {
  const e = environment(); e.render(); e.configure();
  const events = [];
  e.document.addEventListener('rc-friends-native-write', event => events.push(JSON.parse(event.detail)));
  const view = e.context.window.RobloxCustomizerFriendsNativeView, response = { data: {} };
  assert.equal(await view.observeWrite({ url: 'https://friends.roblox.com/v1/users/1/unfriend' }, Promise.resolve(response)), response);
  assert.equal(events[0].userId, 1); assert.equal(events[0].accountId, 100);
  await assert.rejects(view.observeWrite({ url: 'https://friends.roblox.com/v1/users/2/unfriend' }, Promise.reject(new Error('Failed'))));
  assert.equal(events.length, 1);
  const unrelated = Promise.resolve(response);
  assert.equal(view.observeWrite({ url: 'https://games.roblox.com/v1/games' }, unrelated), unrelated);
});
