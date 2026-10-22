const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const core = require('../src/home/pinned-friends-core.js');
const copy = value => JSON.parse(JSON.stringify(value));

function worker() {
  const saved = {}, listeners = [], requests = [];
  let current = 100, now = 1800000000000, csrf = false, blocked = '', failStorage = false, switchAfterList = false, switchOnCsrf = false, switchOnCount = false;
  const followerTotals = { 100: 16810358, 200: 0, 999: 2345 };
  const friends = new Set([1, 2, 3]), following = new Set([4, 5]), incoming = new Set([6, 7]);
  const response = (data, status = 200, headers = {}) => ({ ok: status < 400, status, headers: { get: name => headers[name] || null },
    body: { async cancel() {} }, async json() { return data; } });
  const user = id => ({ id, name: `User${id}`, displayName: `Person ${id}` });
  const context = vm.createContext({ URL, URLSearchParams, AbortController, crypto,
    Date: class extends Date { static now() { return now; } },
    setTimeout(callback, ms) { if (ms <= 6500) { now += ms; queueMicrotask(callback); return 0; } return setTimeout(callback, ms); }, clearTimeout,
    chrome: { runtime: { id: 'test', onMessage: { addListener: callback => listeners.push(callback) } }, storage: { local: {
      async get(key) { return { [key]: copy(saved[key] || null) }; },
      async set(value) { if (failStorage) throw new Error('Disk full'); Object.assign(saved, copy(value)); }
    } } },
    async fetch(value, options = {}) {
      const url = new URL(value); requests.push({ url: url.href, options, at: now });
      if (url.pathname === '/v1/users/authenticated') return response({ id: current });
      const followerCount = url.pathname.match(/^\/v1\/users\/(\d+)\/followers\/count$/);
      if (followerCount) {
        if (blocked === 'rate') return response({}, 429);
        if (switchOnCount) current = 200;
        return response({ count: followerTotals[followerCount[1]] });
      }
      if (url.pathname.endsWith('/friends/find')) {
        if (switchAfterList) current = 200;
        return response({ PageItems: [...friends].map(user), NextCursor: null });
      }
      if (url.pathname.endsWith('/followings')) return response({ data: [...following].map(user), nextPageCursor: null });
      if (url.pathname === '/v1/my/friends/requests') return response({ data: [...incoming].map(id => ({ friendRequest: { senderId: id } })), nextPageCursor: null });
      if (url.hostname === 'presence.roblox.com') return response({ userPresences: JSON.parse(options.body).userIds
        .filter(id => id !== 3).map(id => ({ userId: id, userPresenceType: id === 1 ? 2 : 0 })) });
      if (url.hostname === 'thumbnails.roblox.com') return response({ data: [] });
      if (url.pathname === '/v1/users') return response({ data: JSON.parse(options.body).userIds.map(user) });
      const match = url.pathname.match(/^\/v1\/users\/(\d+)\/(unfriend|unfollow|accept-friend-request|decline-friend-request)$/);
      if (match) {
        if (blocked === 'challenge') return response({}, 403, { 'rblx-challenge-id': 'verification', 'x-csrf-token': 'csrf-value' });
        if (blocked === 'rate') return response({}, 429, { 'retry-after': '60' });
        if (!csrf || options.headers['x-csrf-token'] !== 'csrf-value') {
          csrf = true; if (switchOnCsrf) current = 200;
          return response({}, 403, { 'x-csrf-token': 'csrf-value' });
        }
        const id = Number(match[1]);
        if (match[2] === 'unfriend') friends.delete(id);
        else if (match[2] === 'unfollow') following.delete(id);
        else { incoming.delete(id); if (match[2] === 'accept-friend-request') friends.add(id); }
        return response({});
      }
      throw new Error('Unexpected API ' + url.href);
    }
  });
  for (const file of ['src/shared/routes.js', 'src/home/pinned-friends-core.js', 'src/background/pinned-friends-background.js', 'src/background/friends-manager-background.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context);
  }
  const sender = { id: 'test', url: 'https://www.roblox.com/zh-cn/users/friends', frameId: 0 };
  return { saved, requests, friends, following, incoming, followerTotals, context,
    account(id) { current = id; }, block(value) { blocked = value; }, storageFails(value) { failStorage = value; },
    switchDuringList() { switchAfterList = true; }, switchDuringCsrf() { switchOnCsrf = true; },
    switchDuringCount() { switchOnCount = true; },
    message(action, data = {}, source = sender) {
      return new Promise(resolve => {
        for (const listener of listeners) {
          const pending = listener({ type: 'rc-friends-manager', action, accountId: current, ...data }, source, value => resolve(copy(value)));
          if (pending) return;
        }
        resolve(undefined);
      });
    }
  };
}

test('official follower totals are exact, account isolated, cached only in memory and refreshable', async () => {
  const w = worker(), read = refresh => w.message('follower-count', { accountId: 0, refresh });
  assert.deepEqual(await read(false), { ok: true, userId: 100, count: 16810358 });
  w.followerTotals[100] = 16810400;
  assert.equal((await read(false)).count, 16810358);
  assert.equal(w.requests.filter(item => item.url.endsWith('/followers/count')).length, 1);
  assert.equal((await read(true)).count, 16810400);
  assert.equal(w.requests.filter(item => item.url.endsWith('/followers/count')).length, 2);
  w.account(200); assert.deepEqual(await read(false), { ok: true, userId: 200, count: 0 });
  assert.deepEqual(w.saved, {}, 'Follower counts and credentials are never persisted');
});

test('public follower totals follow the trusted current page without requiring the profile owner to sign in', async () => {
  const w = worker();
  const source = { id: 'test', frameId: 0, url: 'https://www.roblox.com/zh-cn/users/999/friends#!/followers' };
  assert.deepEqual(await w.message('follower-count', { accountId: 0, userId: 100 }, source), { ok: true, userId: 999, count: 2345 });
  assert.equal(w.requests.length, 1); assert.equal(w.requests[0].options.credentials, 'omit');
  w.context.RobloxCustomizerPageContext = { canResolve: () => true, resolve: async () => new URL('https://www.roblox.com/users/200/friends') };
  assert.deepEqual(await w.message('follower-count', { accountId: 0 }, source), { ok: true, userId: 200, count: 0 }, 'SPA navigation takes precedence over the original sender URL');
});

test('invalid follower totals, account changes, rate limits and unrelated pages never produce a fake total', async () => {
  const w = worker();
  for (const count of [-1, 1.5, '1200', undefined]) {
    w.followerTotals[100] = count;
    assert.equal((await w.message('follower-count', { accountId: 0, refresh: true })).ok, false);
  }
  w.block('rate'); assert.equal((await w.message('follower-count', { accountId: 0, refresh: true })).ok, false);
  const changed = worker(); changed.switchDuringCount();
  assert.equal((await changed.message('follower-count', { accountId: 0 })).ok, false);
  const page = worker();
  assert.equal((await page.message('follower-count', { accountId: 0 }, { id: 'test', frameId: 0, url: 'https://www.roblox.com/home' })).ok, false);
  assert.equal(page.requests.length, 0);
  assert.equal(await page.message('follower-count', { accountId: 0 }, { id: 'other', url: 'https://www.roblox.com/users/friends' }), undefined);
});

test('legacy group fields are ignored without losing friend pins, and filtering does not mutate the list', () => {
  const pins = { version: 1, accounts: [{ userId: 100, friends: [{ userId: 1, name: 'Zed', displayName: 'Alpha', imageUrl: '' }] }] };
  const legacy = copy(pins); legacy.accounts[0].groups = [{ id: 'team', name: 'Team', color: '#648bff', userIds: [1, 2] }];
  assert.deepEqual(core.normalize(legacy), pins);
  assert.deepEqual(core.validate(legacy), pins);
  const items = [{ userId: 1, name: 'Zed', displayName: 'Alpha' }, { userId: 2, name: 'Amy', displayName: 'Zulu' }, { userId: 3, name: 'Other', displayName: 'Unknown' }];
  const before = copy(items), presences = { 1: 2, 2: 0 };
  assert.deepEqual(core.filter(items, { status: 'offline', presences }).map(item => item.userId), [2], 'Unknown is not offline');
  assert.deepEqual(core.filter(items, { query: 'amy' }).map(item => item.userId), [2]);
  assert.deepEqual(core.filter(items, { sort: 'username' }).map(item => item.userId), [2, 3, 1]);
  assert.deepEqual(core.filter(items, { sort: 'pinned', pins: [{ userId: 2 }] }).map(item => item.userId), [2, 1, 3]);
  assert.deepEqual(items, before);
});

test('removed friend group actions are rejected without writing storage', async () => {
  const w = worker();
  for (const action of ['group-save', 'group-members', 'group-delete']) {
    assert.equal((await w.message(action, { groupId: 'team', name: 'Team', color: '#648bff', userIds: [1, 2], mode: 'add' })).ok, false);
  }
  assert.deepEqual(w.saved, {});
});

test('following and request lists resolve names, and presence only returns current-friend statuses without persisting them', async () => {
  const w = worker();
  assert.deepEqual((await w.message('list', { kind: 'following' })).items.map(item => item.userId), [4, 5]);
  assert.deepEqual((await w.message('list', { kind: 'requests' })).items.map(item => item.name), ['User6', 'User7']);
  assert.deepEqual((await w.message('list', { kind: 'requests' })).nativeItems[0].friendRequest,
    { senderId: 6, sentAt: null, sourceUniverseId: null, originSourceType: null }, 'Native request cards retain their source metadata');
  assert.equal((await w.message('presence', { userIds: [1, 2, 3] })).presences.length, 2);
  assert.equal((await w.message('presence', { userIds: [4] })).ok, false);
  assert.equal((await w.message('avatars', { kind: 'following', userIds: [999] })).ok, false);
  assert.deepEqual(w.saved, {}, 'Lists and presence remain in memory');
});

test('relationship operations only target members of their exact list, refresh CSRF and pace consecutive operations', async () => {
  const w = worker();
  w.saved.rcPinnedFriends = { version: 1, accounts: [{ userId: 100, friends: [{ userId: 1, name: 'User1', displayName: 'Person 1', imageUrl: '' }] }] };
  assert.equal((await w.message('relationship', { operation: 'unfriend', userId: 4 })).ok, false);
  assert.equal(w.requests.filter(request => request.url.endsWith('/unfriend')).length, 0);
  assert.equal((await w.message('relationship', { operation: 'unfriend', userId: 1 })).ok, true);
  assert.equal(w.friends.has(1), false); assert.equal(w.saved.rcPinnedFriends.accounts[0].friends.length, 0);
  assert.equal((await w.message('relationship', { operation: 'unfollow', userId: 4 })).ok, true);
  assert.equal(w.following.has(4), false);
  const writes = w.requests.filter(request => /\/(unfriend|unfollow)$/.test(request.url));
  assert.equal(writes.length, 3, 'Only CSRF failure gets one automatic retry');
  assert.ok(writes[2].at - writes[1].at >= 6500);
  assert.equal((await w.message('relationship', { operation: 'accept', userId: 6 })).ok, true);
  assert.equal(w.friends.has(6), true); assert.equal(w.incoming.has(6), false);
  assert.equal((await w.message('relationship', { operation: 'decline', userId: 7 })).ok, true);
  assert.equal(w.incoming.has(7), false);
  assert.equal((await w.message('relationship', { operation: 'accept', userId: 7 })).ok, false);
});

test('account switches, verification and rate limits stop writes and successful remote writes survive local storage failure', async () => {
  for (const reason of ['challenge', 'rate']) {
    const w = worker(); w.block(reason);
    const response = await w.message('relationship', { operation: 'unfriend', userId: 1 });
    assert.equal(response.ok, false); assert.equal(w.friends.has(1), true);
    assert.equal(w.requests.filter(request => request.url.endsWith('/unfriend')).length, 1, 'No challenge or rate retry');
  }
  const switched = worker(); switched.switchDuringList();
  assert.equal((await switched.message('relationship', { operation: 'unfriend', userId: 1 })).ok, false);
  assert.equal(switched.requests.some(request => request.url.endsWith('/unfriend')), false);
  const csrfSwitch = worker(); csrfSwitch.switchDuringCsrf();
  assert.equal((await csrfSwitch.message('relationship', { operation: 'unfriend', userId: 1 })).ok, false);
  assert.equal(csrfSwitch.friends.has(1), true, 'CSRF retry rechecks the account');
  const storage = worker(); storage.storageFails(true);
  const success = await storage.message('relationship', { operation: 'unfriend', userId: 1 });
  assert.equal(success.ok, true); assert.equal(success.cleanupFailed, true); assert.equal(storage.friends.has(1), false);
});

test('manager rejects malformed IDs, duplicate targets, foreign origins and other users pages', async () => {
  const w = worker();
  for (const data of [{ operation: 'unfriend', userId: '1' }, { operation: '__proto__', userId: 1 }, { operation: 'delete-all', userId: 1 }]) {
    assert.equal((await w.message('relationship', data)).ok, false);
  }
  assert.equal((await w.message('presence', { userIds: [1, 1] })).ok, false);
  assert.equal((await w.message('presence', { userIds: Array.from({ length: 101 }, (_, index) => index + 1) })).ok, false);
  for (const sender of [{ id: 'bad', url: 'https://www.roblox.com/users/friends' },
    { id: 'test', url: 'https://evil.example/users/friends' }, { id: 'test', url: 'http://www.roblox.com/users/friends' },
    { id: 'test', url: 'https://www.roblox.com/users/friends', frameId: 1 }]) {
    assert.equal(await w.message('relationship', { operation: 'unfriend', userId: 1 }, sender), undefined);
  }
  for (const url of ['https://www.roblox.com/home', 'https://www.roblox.com/users/999/friends']) {
    assert.equal((await w.message('relationship', { operation: 'unfriend', userId: 1 }, { id: 'test', url, frameId: 0 })).ok, false);
  }
  assert.equal(w.requests.some(request => request.options.method === 'POST'), false);
});
