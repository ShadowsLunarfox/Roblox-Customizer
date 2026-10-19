const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const core = require('../src/servers/server-history-core.js');
const start = 1800000000000;
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const presence = { userId: 123, userPresenceType: 2, placeId: 789, rootPlaceId: 700, universeId: 456, gameId: id(1), lastLocation: 'My game' };
test('server history records confirmed sessions, preserves subplaces and separates accounts', () => {
  let state = core.observe(null, { id: 123 }, presence, start);
  state = core.observe(state, { id: 123 }, presence, start + 30000);
  assert.equal(state.accounts[0].servers.length, 1);
  assert.equal(state.accounts[0].servers[0].visitedAt, start + 30000);
  assert.equal(state.accounts[0].servers[0].placeId, 789, 'Join targets the actual subplace, not the root place');
  state = core.observe(state, { id: 321 }, { ...presence, userId: 321, gameId: id(2) }, start + 60000);
  assert.equal(state.accounts.length, 2);
  assert.equal(state.accounts[0].userId, 321);
  assert.equal(core.joinUrl(state.accounts[1].servers[0]), `roblox://experiences/start?placeId=789&gameInstanceId=${id(1)}`);
  assert.equal(core.joinUrl({ placeId: 'javascript:alert(1)', serverId: id(1) }), '');
});
test('hidden, offline, corrupt and foreign-account presence never creates a visit; history stays bounded', () => {
  for (const patch of [{ userPresenceType: 0 }, { userPresenceType: 3 }, { userId: 321 }, { gameId: '' }, { placeId: null }, { universeId: null }]) {
    assert.equal(core.observe(null, { id: 123 }, { ...presence, ...patch }, start).accounts.length, 0);
  }
  let state;
  for (let n = 1; n <= 70; n++) state = core.observe(state, { id: 123 }, { ...presence, gameId: id(n) }, start + n);
  assert.equal(state.accounts[0].servers.length, 6);
  assert.deepEqual(state.accounts[0].servers.map(entry => entry.serverId), [70, 69, 68, 67, 66, 65].map(id));
  assert.equal(state.accounts[0].servers[0].serverId, id(70));
  const bad = structuredClone(state); bad.accounts[0].servers.push({ ...bad.accounts[0].servers[0], serverId: 'bad' });
  assert.deepEqual(core.normalize(bad), state);
});

test('a seventh server evicts the oldest visit, while rejoining refreshes recency without creating duplicates', () => {
  let state;
  for (let n = 1; n <= 6; n++) state = core.observe(state, { id: 123 }, { ...presence, gameId: id(n) }, start + n);
  state = core.observe(state, { id: 123 }, presence, start + 10);
  assert.equal(state.accounts[0].servers.length, 6);
  state = core.observe(state, { id: 123 }, { ...presence, gameId: id(7) }, start + 11);
  assert.deepEqual(state.accounts[0].servers.map(entry => entry.serverId), [7, 1, 6, 5, 4, 3].map(id));
  state = core.observe(state, { id: 321 }, { ...presence, userId: 321, gameId: id(8) }, start + 12);
  assert.equal(state.accounts.find(account => account.userId === 123).servers.length, 6);
  assert.equal(state.accounts.find(account => account.userId === 321).servers.length, 1);
});

test('each game retains six servers independently, with subplaces sharing their experience list', () => {
  let state;
  for (let n = 1; n <= 6; n++) {
    state = core.observe(state, { id: 123 }, { ...presence, gameId: id(n), placeId: n % 2 ? 789 : 790 }, start + n);
    state = core.observe(state, { id: 123 }, { ...presence, universeId: 654, placeId: 987, gameId: id(100 + n) }, start + 10 + n);
  }
  assert.equal(state.accounts[0].servers.length, 12, 'The six-entry cap belongs to each game, not the whole account');
  state = core.observe(state, { id: 123 }, { ...presence, gameId: id(7) }, start + 30);
  const servers = state.accounts[0].servers;
  assert.deepEqual(servers.filter(entry => entry.universeId === 456).map(entry => entry.serverId), [7, 6, 5, 4, 3, 2].map(id));
  assert.deepEqual(servers.filter(entry => entry.universeId === 654).map(entry => entry.serverId), [106, 105, 104, 103, 102, 101].map(id));
  assert.equal(servers.find(entry => entry.serverId === id(6)).placeId, 790, 'Rejoin still targets the actual subplace');
});

function harness(initial = {}) {
  const local = { playtimeTrackingEnabled: false, ...initial }, events = {}, alarms = new Map(), requests = [];
  let now = start, user = { id: 123 }, currentPresence = presence, pages = [{ data: [{ id: id(1), playing: 1, maxPlayers: 10 }], nextPageCursor: null }], publicCalls = 0, fail = false, hold;
  const event = name => ({ addListener(fn) { (events[name] ||= []).push(fn); } });
  const area = data => ({ async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(data[key])])); },
    async set(patch) { const changes = {}; for (const [key, value] of Object.entries(patch)) { changes[key] = { oldValue: data[key], newValue: structuredClone(value) }; data[key] = structuredClone(value); }
      if (data === local) for (const fn of events.changed || []) fn(changes, 'local'); } });
  const chrome = { runtime: { id: 'extension', onMessage: event('message'), onStartup: event('startup'), onInstalled: event('installed') },
    storage: { local: area(local), session: area({}), onChanged: event('changed') },
    alarms: { onAlarm: event('alarm'), async get(key) { return alarms.get(key); }, async create(key, value) { alarms.set(key, value); }, async clear(key) { alarms.delete(key); } } };
  const context = vm.createContext({ chrome, URL, AbortController, setTimeout, clearTimeout, crypto: { randomUUID: () => 'session' },
    Date: class extends Date { static now() { return now; } }, async fetch(url, init) {
      requests.push({ url, ...init });
      if (url.includes('users/authenticated')) return { ok: !!user, status: user ? 200 : 401, headers: { get() {} }, async json() { return user; } };
      if (url.includes('presence.roblox.com')) { if (hold) await hold; return { ok: true, headers: { get() {} }, async json() { return { userPresences: [currentPresence] }; } }; }
      if (url.includes('/universes/v1/places/')) return { ok: true, async json() { return { universeId: 456 }; } };
      if (url.includes('/servers/Public')) { if (fail) throw new TypeError('Offline'); const body = pages[Math.min(publicCalls++, pages.length - 1)]; return { ok: true, async json() { return body; } }; }
      return { ok: true, headers: { get() {} }, async json() { return { data: [] }; } };
    } });
  for (const file of ['src/shared/routes.js', 'src/servers/server-history-core.js', 'src/playtime/playtime-core.js', 'src/background/playtime-background.js', 'src/background/server-history-background.js']) vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context);
  const sender = { id: 'extension', url: 'https://www.roblox.com/home', frameId: 0 };
  const message = (type, action, extra = {}, source = sender) => new Promise(resolve => {
    for (const fn of events.message) if (fn({ type, action, ...extra }, source, value => resolve(JSON.parse(JSON.stringify(value))))) return;
    resolve(undefined);
  });
  return { local, requests, alarms, chrome, context, message,
    poll: () => message('rc-playtime', 'refresh'), history: (action = 'snapshot', extra = {}, source = sender) => message('rc-server-history', action, extra, source),
    advance() { now += 30000; }, user(value) { user = value; }, presence(value) { currentPresence = value; },
    pages(value) { pages = value; publicCalls = 0; }, fail(value) { fail = value; }, hold(value) { hold = value; } };
}
test('startup trims each saved game to its newest six even while tracking is paused', async () => {
  const servers = Array.from({ length: 10 }, (_, n) => ({ serverId: id(n + 1), placeId: 789,
    universeId: 456, name: 'Saved game', visitedAt: start + n, public: false }));
  const otherGame = servers.map(entry => ({ ...entry, universeId: 654, placeId: 987 }));
  const h = harness({ serverHistoryEnabled: false, rcServerHistory: { version: 1, currentUserId: 123,
    accounts: [{ userId: 123, servers: [...servers, ...otherGame] }, { userId: 321, servers: [...otherGame, ...servers].reverse() }] } });
  await h.message('rc-playtime', 'snapshot');
  for (const account of h.local.rcServerHistory.accounts) {
    assert.equal(account.servers.length, 12);
    for (const universeId of [456, 654]) {
      assert.deepEqual(account.servers.filter(entry => entry.universeId === universeId).map(entry => entry.serverId), [10, 9, 8, 7, 6, 5].map(id));
    }
  }
  assert.equal(h.requests.length, 0, 'Enforcing storage retention requires no Roblox request');
});
test('history and playtime share one poll, with independent opt-outs and no recording after an in-flight opt-out', async () => {
  const h = harness(); await h.poll();
  assert.equal((await h.history()).servers.length, 1);
  assert.equal(h.local.rcPlaytimeHistory.accounts.length, 0, 'History works with playtime disabled');
  assert.equal(h.alarms.size, 1);
  await h.chrome.storage.local.set({ playtimeTrackingEnabled: true });
  h.advance(); await h.poll();
  assert.equal(h.local.rcPlaytimeHistory.accounts.length, 1);
  assert.equal(h.requests.filter(r => r.url.includes('presence.roblox.com')).length, 2);
  await h.history('set-enabled', { userId: 123, enabled: false });
  const last = h.local.rcServerHistory.accounts[0].servers[0].visitedAt;
  h.advance(); await h.poll();
  assert.equal(h.local.rcServerHistory.accounts[0].servers[0].visitedAt, last);
  await h.chrome.storage.local.set({ playtimeTrackingEnabled: false }); await h.poll();
  assert.equal(h.alarms.size, 0, 'Both disabled stops the shared poll');
  await h.history('set-enabled', { userId: 123, enabled: true }); h.advance();
  let release; h.hold(new Promise(resolve => { release = resolve; }));
  const pending = h.poll(); await new Promise(resolve => setImmediate(resolve));
  await h.chrome.storage.local.set({ serverHistoryEnabled: false }); release(); await pending;
  assert.equal(h.local.rcServerHistory.accounts[0].servers[0].visitedAt, last);
});

test('recent-server refresh records confirmed joins with playtime off and shares its throttle and opt-out', async () => {
  const h = harness();
  let result = await h.history('refresh');
  assert.equal(result.servers[0].serverId, id(1));
  assert.equal(h.local.rcPlaytimeHistory.accounts.length, 0);
  await h.history('refresh');
  assert.equal(h.requests.filter(request => request.url.includes('presence.roblox.com')).length, 1);
  h.presence({ ...presence, gameId: id(2) }); h.advance();
  result = await h.history('refresh');
  assert.deepEqual(result.servers.map(server => server.serverId), [id(2), id(1)]);
  await h.history('set-enabled', { userId: 123, enabled: false });
  h.presence({ ...presence, gameId: id(3) }); h.advance();
  result = await h.history('refresh');
  assert.equal(result.enabled, false);
  assert.deepEqual(result.servers.map(server => server.serverId), [id(2), id(1)]);
  assert.equal(h.requests.filter(request => request.url.includes('presence.roblox.com')).length, 2);
});
test('history always checks account ownership before reads, deletion and availability requests', async () => {
  const h = harness(); await h.poll(); h.user({ id: 321 });
  assert.deepEqual((await h.history()).servers, []);
  assert.equal((await h.history('clear', { userId: 123 })).ok, false);
  h.user(null); assert.equal((await h.history()).ok, false);
  h.user({ id: 123 });
  assert.equal(await h.history('snapshot', {}, { id: 'other', url: 'https://www.roblox.com/home' }), undefined);
  assert.equal(await h.history('snapshot', {}, { id: 'extension', url: 'https://www.roblox.com/home', frameId: 1 }), undefined);
  assert.equal((await h.history()).servers.length, 1);
  await h.history('remove', { userId: 123, placeId: 789, serverId: id(1) });
  assert.equal((await h.history()).servers.length, 0);
});
test('clearing one game preserves other games and other accounts and rejects invalid scopes', async () => {
  const first = core.observe(null, { id: 123 }, presence, start).accounts[0].servers[0];
  const second = { ...first, universeId: 654, placeId: 987, serverId: id(2) };
  const h = harness({ serverHistoryEnabled: false, rcServerHistory: { version: 1,
    accounts: [{ userId: 123, servers: [first, second] }, { userId: 321, servers: [first] }] } });
  assert.equal((await h.history('clear', { userId: 123, universeId: 0 })).ok, false);
  assert.equal((await h.history()).servers.length, 2);
  const result = await h.history('clear', { userId: 123, universeId: 456 });
  assert.deepEqual(result.servers.map(entry => entry.universeId), [654]);
  assert.equal(h.local.rcServerHistory.accounts.find(account => account.userId === 321).servers.length, 1);
});
test('game lookup resolves root places without exposing history to other routes', async () => {
  const h = harness();
  assert.equal(await h.history('resolve-game', { placeId: 700 }), undefined, 'Home cannot request game-page lookups');
  const sender = { id: 'extension', url: 'https://www.roblox.com/id/games/700/Test', frameId: 0 };
  const result = await h.history('resolve-game', { placeId: 700 }, sender);
  assert.equal(result.universeId, 456);
  assert.equal(await h.history('resolve-game', { placeId: 701 }, sender), undefined);
  assert.equal(h.local.rcServerHistory, undefined, 'Resolving a game does not invent a visited server');
});
test('availability distinguishes full/closed servers from incomplete scans, private servers and network failures', async () => {
  const h = harness(); await h.poll();
  const check = () => h.history('check', { userId: 123, placeId: 789, serverId: id(1) });
  h.pages([{ data: [], nextPageCursor: null }]); assert.equal((await check()).status, 'unlisted');
  h.pages([{ data: [{ id: id(1), playing: 10, maxPlayers: 10 }], nextPageCursor: null }]); assert.equal((await check()).status, 'full');
  h.pages([{ data: [], nextPageCursor: 'more' }]); assert.equal((await check()).status, 'unknown');
  h.fail(true); assert.equal((await check()).status, 'unknown'); h.fail(false);
  h.pages([{ data: [], nextPageCursor: null }]); assert.equal((await check()).status, 'closed');
  h.pages([{ data: [{ id: id(1), playing: 1, maxPlayers: 10 }], nextPageCursor: null }]); assert.equal((await check()).status, 'available');
});
