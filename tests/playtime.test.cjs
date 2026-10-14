const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const core = require('../src/playtime/playtime-core.js');
const user = { id: 123, name: 'Player', displayName: 'Player Display' };
const presence = { userId: 123, userPresenceType: 2, universeId: 456, rootPlaceId: 789, placeId: 790, lastLocation: 'First game' };
const start = 1800000000000;
const sample = (state, offset, p = presence, u = user, session = 'browser-a') => core.observe(state, u, p, start + offset, session);
const game = state => state.accounts[0].games[0];

test('only consecutive in-game presence samples add time; duplicate polls do not double count', () => {
  let state = sample(null, 0);
  assert.equal(game(state).totalMs, 0);
  state = sample(state, 60000);
  state = sample(state, 60000);
  state = sample(state, 120000);
  assert.equal(game(state).totalMs, 120000);
  assert.equal(game(state).sessions, 1);
  assert.equal(core.snapshot(state, true).totalMs, 120000);
});
test('subplace teleports remain one experience and changes do not credit unknown transition time', () => {
  let state = sample(null, 0);
  state = sample(state, 60000, { ...presence, placeId: 800 });
  assert.equal(state.accounts[0].games.length, 1);
  assert.equal(game(state).placeId, 789);
  state = sample(state, 120000, { ...presence, universeId: 999, rootPlaceId: 1000 });
  assert.equal(game(state).totalMs, 60000);
  assert.equal(state.accounts[0].games[1].totalMs, 0);
  state = sample(state, 180000);
  assert.equal(game(state).sessions, 2);
  assert.equal(game(state).totalMs, 60000);
});
test('browsing, Studio, offline, missing presence and hidden universe IDs never count as playtime', () => {
  for (const p of [null, { ...presence, userPresenceType: 0 }, { ...presence, userPresenceType: 1 },
    { ...presence, userPresenceType: 3 }, { ...presence, universeId: null }, { ...presence, userId: 999 }]) {
    let state = sample(null, 0);
    state = sample(state, 60000, p);
    assert.equal(state.active, null);
    state = sample(state, 120000);
    assert.equal(game(state).totalMs, 0);
  }
});
test('sleep gaps, backwards clocks and browser restarts start fresh timing cursors', () => {
  for (const [offset, session] of [[120001, 'browser-a'], [-1, 'browser-a'], [60000, 'browser-b']]) {
    const state = sample(sample(null, 0), offset, presence, user, session);
    assert.equal(game(state).totalMs, 0);
    assert.equal(game(state).sessions, 2);
  }
  assert.equal(game(sample(sample(null, 0), 120000)).totalMs, 120000);
});
test('pause and account switching retain separate totals and never bridge gaps', () => {
  let state = sample(sample(null, 0), 60000);
  state = core.pause(state, 'unavailable', start + 90000);
  state = sample(state, 120000);
  const second = { id: 321, name: 'Other' };
  state = sample(state, 180000, { ...presence, userId: 321 }, second);
  state = sample(state, 240000, { ...presence, userId: 321 }, second);
  assert.equal(state.accounts.length, 2);
  assert.equal(core.snapshot(state, true).account.userId, 321);
  assert.equal(core.snapshot(state, true).totalMs, 60000);
  state = sample(state, 300000);
  assert.equal(core.snapshot(state, true).account.userId, 123);
  assert.equal(core.snapshot(state, true).totalMs, 60000);
  assert.equal(core.snapshot(state, false).activeUniverseId, 0);
});
test('normalization rejects corrupt state, duplicate IDs and unsafe artwork without trusting extra properties', () => {
  const state = sample(null, 0);
  Object.assign(game(state), { totalMs: Infinity, sessions: -2, iconUrl: 'https://evil.test/x', unknown: 'secret' });
  state.accounts.push(state.accounts[0], { userId: '__proto__', games: [] });
  state.accounts[0].games.push({ ...game(state) }, { universeId: -1 });
  const clean = core.normalize(state);
  assert.equal(clean.accounts.length, 1);
  assert.equal(clean.accounts[0].games.length, 1);
  assert.equal(game(clean).totalMs, 0);
  assert.equal(game(clean).sessions, 0);
  assert.equal(game(clean).iconUrl, '');
  assert.equal('unknown' in game(clean), false);
  for (const url of ['javascript:alert(1)', 'http://tr.rbxcdn.com/x', 'https://rbxcdn.com.evil.test/x', 'https://a:b@tr.rbxcdn.com/x']) assert.equal(core.iconUrl(url), '');
  assert.equal(core.iconUrl('https://tr.rbxcdn.com/x'), 'https://tr.rbxcdn.com/x');
  assert.equal(core.normalize({ ...state, version: 200 }).accounts.length, 0);
});

function harness(options = {}) {
  const local = options.local || { [core.ENABLED_KEY]: true };
  const session = options.session || {};
  const events = {};
  const listeners = [];
  const requests = [];
  const alarms = new Map(options.alarms || []);
  let now = start;
  let nextUser = user;
  let nextPresence = presence;
  let fail = '';
  let csrf = false;
  let hold;
  const event = name => ({ addListener(listener) { (events[name] ||= []).push(listener); } });
  const area = data => ({
    async get(keys) { return Object.fromEntries((Array.isArray(keys) ? keys : [keys]).map(key => [key, structuredClone(data[key])])); },
    async set(patch) {
      const changes = {};
      for (const [key, value] of Object.entries(patch)) { changes[key] = { oldValue: data[key], newValue: value }; data[key] = structuredClone(value); }
      if (data === local) for (const listener of listeners) listener(changes, 'local');
    }
  });
  const chrome = { runtime: { id: 'test-extension', onMessage: event('message'), onStartup: event('startup'), onInstalled: event('installed') },
    storage: { local: area(local), session: area(session), onChanged: { addListener(listener) { listeners.push(listener); } } },
    alarms: { onAlarm: event('alarm'), async get(name) { return alarms.get(name); }, async create(name, value) { alarms.set(name, value); }, async clear(name) { return alarms.delete(name); } } };
  const context = vm.createContext({ chrome, URL, AbortController, setTimeout, clearTimeout, crypto: { randomUUID: () => options.runId || 'run-a' },
    Date: class extends Date { static now() { return now; } },
    async fetch(url, init) {
      requests.push({ url, ...init });
      if (hold && url.includes('presence.roblox.com')) await hold;
      if (fail === 'network' || (fail === 'metadata' && !url.includes('users/authenticated') && !url.includes('presence.roblox.com'))) throw new TypeError('Network');
      let status = 200, token = null, body;
      if (url.includes('users/authenticated')) { body = nextUser; if (fail === 'signed-out') status = 401; }
      else if (url.includes('presence.roblox.com')) {
        if (csrf && !init.headers['x-csrf-token']) { status = 403; token = 'in-memory-token'; }
        body = { userPresences: nextPresence ? [nextPresence] : [] };
      } else if (url.includes('thumbnails.roblox.com')) body = { data: [{ targetId: nextPresence.universeId, state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/icon' }] };
      else body = { data: [{ id: nextPresence.universeId, name: 'Official game', rootPlace: { id: 789 } }] };
      return { ok: status === 200, status, headers: { get: () => token }, async json() { return body; } };
    } });
  for (const file of ['src/playtime/playtime-core.js', 'src/background/playtime-background.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  const sender = { id: 'test-extension', url: 'https://www.roblox.com/home', frameId: 0 };
  function message(action, values = {}, source = sender) {
    return new Promise(resolve => { const keep = events.message[0]({ type: 'rc-playtime', action, ...values }, source, value => resolve(JSON.parse(JSON.stringify(value)))); if (!keep) resolve(undefined); });
  }
  return { local, session, requests, alarms, message, events, chrome,
    advance(ms = 60000) { now += ms; }, user(value) { nextUser = value; }, presence(value) { nextPresence = value; },
    fail(value) { fail = value; }, csrf(value) { csrf = value; }, hold(value) { hold = value; },
    async alarm() { for (const listener of events.alarm) listener({ name: 'rc-playtime-poll' }); return message('snapshot'); } };
}

test('Unsupported language pauses background tracking without erasing history or the saved opt-in', async () => {
  const h = harness();
  await h.message('refresh');
  h.advance(30000);
  const before = await h.alarm();
  assert.equal(before.totalMs, 30000);
  await h.chrome.storage.local.set({ robloxCustomizerUnsupportedLanguage: 'fr' });
  const paused = await h.message('snapshot');
  assert.equal(paused.enabled, false);
  assert.equal(paused.totalMs, before.totalMs);
  assert.equal(h.local[core.ENABLED_KEY], true);
  assert.equal(h.alarms.size, 0);
  const requests = h.requests.length;
  h.advance(120000);
  await h.message('refresh');
  assert.equal(h.requests.length, requests);
  await h.chrome.storage.local.set({ robloxCustomizerUnsupportedLanguage: undefined });
  await h.message('refresh');
  assert.equal((await h.message('snapshot')).totalMs, before.totalMs, 'Fallback time is not added on resume');
  h.advance(30000);
  assert.equal((await h.alarm()).totalMs, before.totalMs + 30000);
});
test('background enables tracking by default, uses one 30-second alarm and honors saved opt-outs', async () => {
  const fresh = harness({ local: {} });
  assert.equal((await fresh.message('snapshot')).enabled, true);
  assert.equal(fresh.alarms.get('rc-playtime-poll').periodInMinutes, 0.5);
  assert.equal(fresh.requests.length, 0, 'Worker initialization still avoids eager network requests');
  assert.equal((await fresh.message('refresh')).enabled, true);
  fresh.advance(30000);
  assert.equal((await fresh.alarm()).totalMs, 30000, 'A missing preference records time without an enable action');
  const off = harness({ local: { [core.ENABLED_KEY]: false } });
  for (const name of ['installed', 'startup']) for (const listener of off.events[name]) listener();
  assert.equal((await off.message('snapshot')).enabled, false);
  assert.equal((await off.message('refresh')).enabled, false);
  assert.equal(off.alarms.size, 0); assert.equal(off.requests.length, 0);
  const on = harness({ alarms: [['rc-playtime-poll', { delayInMinutes: 1, periodInMinutes: 1 }]] });
  await on.message('snapshot');
  assert.equal(on.requests.length, 0);
  assert.equal(on.alarms.size, 1);
  assert.equal(on.alarms.get('rc-playtime-poll').periodInMinutes, 0.5);
  await on.alarm();
  assert.equal(on.requests.filter(r => r.url.includes('presence.roblox.com')).length, 1);
  on.alarms.clear(); await on.message('refresh');
  assert.equal(on.alarms.get('rc-playtime-poll').periodInMinutes, 0.5, 'A dropped alarm is restored on refresh');
});
test('background authenticates the own player, retries CSRF, enriches games and deduplicates tab refreshes', async () => {
  const h = harness(); h.csrf(true);
  const first = await h.message('refresh');
  assert.equal(first.games[0].name, 'Official game');
  assert.equal(first.games[0].iconUrl, 'https://tr.rbxcdn.com/icon');
  const presenceRequests = h.requests.filter(r => r.url.includes('presence.roblox.com'));
  assert.equal(presenceRequests.length, 2);
  assert.equal(presenceRequests[0].credentials, 'include');
  assert.deepEqual(JSON.parse(presenceRequests[0].body), { userIds: [123] });
  assert.equal(presenceRequests[1].headers['x-csrf-token'], 'in-memory-token');
  assert.equal(JSON.stringify(h.local).includes('in-memory-token'), false);
  h.advance();
  const results = await Promise.all([h.message('refresh'), h.message('refresh'), h.message('refresh')]);
  assert.ok(results.every(r => r.totalMs === 60000));
  assert.equal(h.requests.filter(r => r.url.includes('presence.roblox.com')).length, 3);
  assert.equal(h.requests.filter(r => r.url.includes('games.roblox.com')).length, 1);
});
test('short network failures recover confirmed time; signed-out accounts and sleep do not add gaps', async () => {
  const h = harness(); await h.message('refresh');
  h.advance(); h.fail('network');
  assert.equal((await h.alarm()).status.kind, 'unavailable');
  assert.equal((await h.message('snapshot')).totalMs, 0, 'Failed requests do not advance totals');
  h.fail(''); h.advance(); assert.equal((await h.alarm()).totalMs, 120000);
  h.advance(); assert.equal((await h.alarm()).totalMs, 180000);
  h.advance(600000); assert.equal((await h.alarm()).totalMs, 180000);
  h.fail('signed-out'); h.advance(); assert.equal((await h.alarm()).status.kind, 'signed-out');
  h.fail(''); h.advance(30000); assert.equal((await h.alarm()).totalMs, 180000);
});

test('half-minute samples retain seconds separately for each game and tolerate a delayed check', async () => {
  const h = harness(); await h.message('refresh');
  h.advance(30000); assert.equal((await h.alarm()).totalMs, 30000);
  // The old 90-second cutoff discarded this entire interval.
  h.advance(95000); assert.equal((await h.alarm()).totalMs, 125000);
  h.presence({ ...presence, universeId: 999, rootPlaceId: 1000 });
  h.advance(30000); await h.alarm();
  h.advance(45000); const result = await h.alarm();
  assert.deepEqual(result.games.map(g => g.totalMs), [125000, 45000]);
  assert.equal(result.totalMs, 170000);
  assert.deepEqual(h.local[core.STORAGE_KEY].accounts[0].games.map(g => g.totalMs), [125000, 45000]);
});

test('unavailable intervals cannot bridge different games, accounts, long outages or browser sessions', () => {
  for (const [p, u, offset, session] of [
    [{ ...presence, universeId: 999 }, user, 60000, 'browser-a'],
    [{ ...presence, userId: 321 }, { id: 321, name: 'Other' }, 60000, 'browser-a'],
    [presence, user, 120001, 'browser-a'],
    [presence, user, 60000, 'browser-b']
  ]) {
    const interrupted = core.pause(sample(null, 0), 'unavailable', start + 30000, true);
    assert.equal(core.snapshot(interrupted, true).activeUniverseId, 0);
    const result = sample(interrupted, offset, p, u, session);
    assert.ok(result.accounts.every(a => a.games.every(g => g.totalMs === 0)));
  }
});
test('metadata failures do not discard presence timing', async () => {
  const h = harness(); h.fail('metadata'); await h.message('refresh'); h.advance();
  const result = await h.alarm();
  assert.equal(result.totalMs, 60000); assert.equal(result.games[0].name, 'First game');
});
test('worker restarts continue via storage.session while browser restarts clear the active cursor', async () => {
  const h = harness(); await h.message('refresh'); h.advance(); await h.alarm();
  const worker = harness({ local: h.local, session: h.session }); worker.advance(120000);
  assert.equal((await worker.message('refresh')).totalMs, 120000);
  const browser = harness({ local: h.local, session: {}, runId: 'run-b' }); browser.advance(180000);
  assert.equal((await browser.message('snapshot')).activeUniverseId, 0);
  assert.equal((await browser.message('refresh')).totalMs, 120000);
});
test('disabled tracking stops requests and keeps totals; clearing affects only the selected account', async () => {
  const h = harness(); await h.message('refresh'); h.advance(); await h.alarm();
  h.user({ id: 321, name: 'Other' }); h.presence({ ...presence, userId: 321 }); h.advance(); await h.alarm();
  h.advance(); await h.alarm();
  const paused = await h.message('set-enabled', { enabled: false });
  assert.equal(paused.totalMs, 60000); assert.equal(paused.activeUniverseId, 0); assert.equal(h.alarms.size, 0);
  const count = h.requests.length; h.advance(); await h.message('refresh'); assert.equal(h.requests.length, count);
  assert.equal((await h.message('clear', { userId: 123 })).ok, false);
  assert.equal((await h.message('clear', { userId: 321 })).totalMs, 0);
  assert.equal(h.local[core.STORAGE_KEY].accounts[0].userId, 123);
  assert.equal(h.local[core.STORAGE_KEY].accounts[0].games[0].totalMs, 60000);
  h.user(user); h.presence(presence);
  assert.equal((await h.message('set-enabled', { enabled: true })).totalMs, 60000);
});
test('untrusted senders, subframes and unknown actions cannot read or modify history', async () => {
  const h = harness();
  for (const sender of [{ id: 'other', url: 'https://www.roblox.com/home' }, { id: 'test-extension', url: 'http://www.roblox.com/home' },
    { id: 'test-extension', url: 'https://evil.test' }, { id: 'test-extension', url: 'https://www.roblox.com/home', frameId: 2 }]) {
    assert.equal(await h.message('set-enabled', { enabled: true }, sender), undefined);
  }
  assert.equal((await h.message('unknown')).ok, false);
});
test('turning off during an in-flight poll discards that sample', async () => {
  const h = harness(); await h.message('refresh'); h.advance();
  let release; h.hold(new Promise(resolve => { release = resolve; }));
  const pending = h.message('refresh');
  await new Promise(resolve => setImmediate(resolve));
  await h.chrome.storage.local.set({ [core.ENABLED_KEY]: false }); release();
  const result = await pending;
  assert.equal(result.enabled, false); assert.equal(result.totalMs, 0); assert.equal(result.activeUniverseId, 0);
});
