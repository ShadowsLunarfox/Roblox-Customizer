const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const core = require('../src/home/pinned-friends-core.js');
const copy = value => JSON.parse(JSON.stringify(value));
function worker() {
  const saved = {}, listeners = [], requests = [];
  let current = 100, fail = false, switchAfterRoster = false, switchAfterActivity = false, now = Date.now();
  const context = vm.createContext({ URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return now; } },
    chrome: { runtime: { id: 'test', onMessage: { addListener: callback => listeners.push(callback) } },
      storage: { local: { async get(key) { return { [key]: copy(saved[key] || null) }; },
        async set(data) { if (fail) throw new Error('Storage full'); Object.assign(saved, copy(data)); } } } },
    async fetch(value, options) {
      const url = new URL(value); requests.push({ url: url.href, options });
      let data;
      if (url.pathname === '/v1/users/authenticated') data = { id: current };
      else if (url.hostname === 'friends.roblox.com') {
        if (url.searchParams.has('cursor')) data = { PageItems: [{ id: 3, name: 'Third', displayName: '第三位' }], NextCursor: null };
        else data = { PageItems: [{ id: 1, name: 'First', displayName: '第一位' }, { id: 2 }], NextCursor: 'next' };
        if (switchAfterRoster) current = 200;
      } else if (url.hostname === 'presence.roblox.com') {
        data = { userPresences: [{ userId: 1, userPresenceType: 2, placeId: 10, universeId: 20,
          gameId: '11111111-2222-3333-4444-555555555555', lastLocation: '<Game name>' }] };
        if (switchAfterActivity) current = 200;
      } else if (url.pathname === '/v1/users') data = { data: [{ id: 2, name: 'Second', displayName: '第二位' }] };
      else if (url.hostname === 'thumbnails.roblox.com') data = { data: [
        { targetId: 1, state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/head.png' },
        { targetId: 999, state: 'Completed', imageUrl: 'https://evil.example/steal' }] };
      else throw new Error('Unexpected request');
      return { ok: true, async json() { return data; } };
    } });
  for (const file of ['src/home/pinned-friends-core.js', 'src/background/pinned-friends-background.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context);
  }
  const sender = { id: 'test', url: 'https://www.roblox.com/ja/home', frameId: 0 };
  return { saved, requests, context,
    user(value) { current = value; }, fail(value) { fail = value; }, switchDuringRoster() { switchAfterRoster = true; },
    switchDuringActivity() { switchAfterActivity = true; },
    advance(ms) { now += ms; },
    message(action, data = {}, source = sender) {
      return new Promise(resolve => {
        const pending = listeners[0]({ type: 'rc-pinned-friends', action, accountId: current, ...data }, source, result => resolve(copy(result)));
        if (!pending) resolve(undefined);
      });
    } };
}
test('pinned friend storage removes duplicates, unsafe IDs and image URLs without mutating input', () => {
  const value = { version: 1, accounts: [{ userId: 100, friends: [
    { userId: 1, name: ' A ', displayName: '<img onerror=alert(1)>', imageUrl: 'javascript:alert(1)' },
    { userId: 1 }, { userId: -2 }, { userId: '3' }] }, { userId: 100, friends: [] }] };
  const before = copy(value), clean = core.normalize(value);
  assert.equal(clean.accounts.length, 1); assert.equal(clean.accounts[0].friends.length, 1);
  assert.equal(clean.accounts[0].friends[0].name, 'A');
  assert.equal(clean.accounts[0].friends[0].imageUrl, '');
  assert.equal(clean.accounts[0].friends[0].displayName, '<img onerror=alert(1)>');
  assert.deepEqual(value, before);
  assert.throws(() => core.validate(value));
  assert.deepEqual(core.validate(clean), clean);
});
test('worker paginates friends, resolves ID-only entries and stores only chosen friends locally per account', async () => {
  const w = worker();
  assert.deepEqual(await w.message('list'), { ok: true, accountId: 100, pins: [] });
  assert.equal(w.requests.length, 1, 'No full friend fetch on an empty Home group');
  const roster = await w.message('roster');
  assert.equal(roster.friends.length, 3); assert.equal(roster.friends[1].name, 'Second');
  await Promise.all([w.message('set', { userId: 1, pinned: true }), w.message('set', { userId: 2, pinned: true })]);
  assert.deepEqual((await w.message('list')).pins.map(item => item.userId), [1, 2]);
  assert.equal(w.requests.filter(item => item.url.includes('friends/find')).length, 2, 'Roster is reused for adjacent toggles');
  assert.deepEqual((await w.message('avatars', { userIds: [1, 999] })).images, [{ userId: 1, imageUrl: 'https://tr.rbxcdn.com/head.png' }]);
  assert.equal(w.requests.at(-2).url.includes('userIds=1&'), true, 'Unknown users are never requested');
  w.user(200);
  assert.deepEqual((await w.message('list')).pins, []);
  await w.message('set', { userId: 3, pinned: true });
  w.user(100);
  await w.message('set', { userId: 1, pinned: false });
  assert.deepEqual((await w.message('list')).pins.map(item => item.userId), [2]);
  assert.deepEqual(w.saved.rcPinnedFriends.accounts.map(account => account.userId), [100, 200]);
  assert.equal(w.saved.rcPinnedFriends.accounts[0].friends.length, 1, 'Full roster is not persisted');
  assert.ok(w.requests.every(item => !['DELETE', 'PATCH'].includes(item.options.method)), 'No relationship updates');
});
test('worker rejects account switches, non-friends, untrusted senders and malformed messages', async () => {
  const w = worker();
  assert.equal((await w.message('set', { userId: 999, pinned: true })).ok, false);
  assert.equal((await w.message('set', { userId: 1, pinned: true, accountId: 200 })).ok, false);
  assert.equal((await w.message('avatars', { userIds: Array(51).fill(1) })).ok, false);
  assert.equal((await w.message('set', { userId: '1', pinned: true })).ok, false);
  for (const source of [{ id: 'evil', url: 'https://www.roblox.com/home' },
    { id: 'test', url: 'https://evil.example/home' }, { id: 'test', url: 'http://www.roblox.com/home' },
    { id: 'test', url: 'https://www.roblox.com/home', frameId: 2 }]) assert.equal(await w.message('list', {}, source), undefined);
  assert.deepEqual(w.saved, {});
  const other = worker(); other.switchDuringRoster();
  assert.equal((await other.message('set', { userId: 1, pinned: true })).ok, false);
  assert.deepEqual(other.saved, {});
});
test('failed storage writes preserve existing pins and unpin does not require a roster fetch', async () => {
  const w = worker();
  await w.message('set', { userId: 1, pinned: true });
  const saved = copy(w.saved); w.fail(true);
  assert.equal((await w.message('set', { userId: 1, pinned: false })).ok, false);
  assert.deepEqual(w.saved, saved);
  w.fail(false); w.requests.length = 0;
  await w.message('set', { userId: 1, pinned: false });
  assert.deepEqual((await w.message('list')).pins, []);
  assert.ok(w.requests.every(item => !item.url.includes('friends.roblox.com')));
});

test('friend activity is read only for current-account pins, cached briefly and excluded from persistent storage', async () => {
  const w = worker();
  assert.equal((await w.message('activity', { userId: 1 })).ok, false);
  assert.equal(w.requests.some(request => request.url.includes('presence.roblox.com')), false);
  await w.message('set', { userId: 1, pinned: true });
  const saved = copy(w.saved);
  const result = await w.message('activity', { userId: 1 });
  assert.deepEqual(result.activity, { userId: 1, status: 2, placeId: 10, universeId: 20,
    gameId: '11111111-2222-3333-4444-555555555555', location: '<Game name>', iconUrl: '' });
  assert.deepEqual(await w.message('activity', { userId: 1 }), result);
  assert.equal(w.requests.filter(request => request.url.includes('presence.roblox.com')).length, 1);
  w.advance(10000); await w.message('activity', { userId: 1 });
  w.advance(6000); await w.message('activity', { userId: 1 });
  assert.equal(w.requests.filter(request => request.url.includes('presence.roblox.com')).length, 2, 'Repeated viewing does not extend a stale status indefinitely');
  assert.deepEqual(w.saved, saved, 'Activity and server identities never enter backups');
  w.user(200);
  assert.equal((await w.message('activity', { userId: 1 })).ok, false);
  const other = worker(); await other.message('set', { userId: 1, pinned: true }); other.switchDuringActivity();
  assert.equal((await other.message('activity', { userId: 1 })).ok, false, 'An account switch during fetch discards the result');
});
