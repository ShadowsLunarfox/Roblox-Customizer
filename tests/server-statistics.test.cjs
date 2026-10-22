const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/background/service-worker.js'), 'utf8');
const first = '12345678-1234-4444-8888-000000000001';
const second = '12345678-5678-4444-8888-000000000002';
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
function worker(fetchResponse) {
  const requests = [], handlers = [], rules = [];
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout,
    chrome: { runtime: { id: 'test-extension', onMessage: { addListener: fn => handlers.push(fn) } },
      declarativeNetRequest: { async updateSessionRules(value) { rules.push(value); } } },
    async fetch(url, options) {
      requests.push({ url: new URL(url), options });
      const data = await fetchResponse(new URL(url), options);
      return { ok: data.status ? data.status === 200 : true, status: data.status || 200, json: async () => data.body ?? data };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared/routes.js'), 'utf8'), context);
  vm.runInContext(source + '\nglobalThis.api={getPublicServerStatuses,getPublicServerCountry,getPublicServerJoinInfo,serverExtraMetrics};', context);
  return { api: context.api, requests, handlers, rules };
}

test('server metrics preserve zero, reject invalid values and never invent missing counts', () => {
  const { api } = worker(() => ({}));
  assert.deepEqual(plain(api.serverExtraMetrics({ fps: 0, languageMatchCount: 0, playing: 0 })), { fps: 0, languageMatchCount: 0 });
  for (const bad of [null, '60', -1, Infinity, NaN]) assert.deepEqual(plain(api.serverExtraMetrics({ fps: bad })), {});
  for (const bad of [null, '3', -1, 2.5, Infinity]) assert.deepEqual(plain(api.serverExtraMetrics({ languageMatchCount: bad })), {});
  assert.deepEqual(plain(api.serverExtraMetrics({ languageMatchCount: 4, playing: 3 })), {});
});

test('v2 language matches merge by full UUID, resume pages, reuse caches and separate account/language scopes', async () => {
  let otherAccount = false;
  const env = worker(url => {
    if (url.pathname.startsWith('/v1/')) return { data: [{ id: first, ping: 112, fps: 59.997505, playing: 4 }, { id: second, ping: 80, fps: 30, playing: 3 }] };
    assert.equal(url.searchParams.get('orderBy'), 'OccupancyAsc');
    return url.searchParams.has('cursor') ? { data: [{ id: second, playing: 3, languageMatchCount: 0 }] }
      : { data: [{ id: first, playing: 4, fps: 60, languageMatchCount: otherAccount ? 1 : 3 }], nextPageCursor: 'next' };
  });
  const initial = await env.api.getPublicServerStatuses(123, [first], [], '42:en');
  assert.deepEqual(plain(initial.servers[0]), { id: first, ping: 112, countryCode: '', fps: 60, playing: 4, languageMatchCount: 3 });
  assert.equal(env.requests.length, 2, 'Only the needed first v2 page is loaded');
  const next = await env.api.getPublicServerStatuses(123, [second], [], '42:en');
  assert.equal(next.servers[0].languageMatchCount, 0);
  assert.equal(next.servers[0].fps, 30);
  assert.equal(env.requests.length, 3, 'Next cards reuse v1 and resume the v2 cursor');
  await env.api.getPublicServerStatuses(123, [first], [], '42:en');
  assert.equal(env.requests.length, 3);
  otherAccount = true;
  assert.equal((await env.api.getPublicServerStatuses(123, [first], [], '99:en')).servers[0].languageMatchCount, 1);
  assert.equal((await env.api.getPublicServerStatuses(123, [first], [], '42:en')).servers[0].languageMatchCount, 3);
  await env.api.getPublicServerStatuses(123, [first], [], '42:ja');
  assert.equal(env.requests.length, 7, 'Roblox language changes use a separate inventory');
});

test('a missing or rejected v2 response retains numeric latency and server FPS', async () => {
  for (const body of [{ status: 403 }, { data: [{ id: first }] }]) {
    const env = worker(url => url.pathname.startsWith('/v1/') ? { data: [{ id: first, ping: 90, fps: 30 }] } : body);
    const result = await env.api.getPublicServerStatuses(123, [first], [], '42:en');
    assert.equal(result.servers[0].fps, 30);
    assert.equal(result.servers[0].ping, 90);
    assert.equal(Object.hasOwn(result.servers[0], 'languageMatchCount'), false);
    await env.api.getPublicServerStatuses(123, [first], [], '42:en');
    assert.equal(env.requests.length, 2, 'Unavailable language metadata is not repeatedly requested');
  }
});

test('version-only requests share a bounded join queue, deduplicate servers and skip geolocation', async () => {
  const releases = [];
  let active = 0, peak = 0;
  const env = worker(async (url, options) => {
    assert.equal(url.hostname, 'gamejoin.roblox.com');
    const body = JSON.parse(options.body);
    assert.equal(options.credentials, 'include');
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => releases.push(resolve)); active--;
    return { joinScript: { GameId: body.gameId, PlaceId: body.placeId, PlaceVersion: 15077, MachineAddress: '8.8.8.8', ClientTicket: 'SECRET' } };
  });
  const ids = [first, second, '12345678-9999-4444-8888-000000000003'];
  const pending = ids.map(id => env.api.getPublicServerCountry(123, id, false));
  pending.push(env.api.getPublicServerCountry(123, first, false));
  await tick();
  assert.equal(env.requests.length, 2);
  releases.splice(0).forEach(resolve => resolve()); await tick();
  assert.equal(env.requests.length, 3);
  releases.splice(0).forEach(resolve => resolve());
  const result = plain(await Promise.all(pending));
  assert.equal(peak, 2);
  assert.deepEqual(result, Array(4).fill({ placeVersion: 15077 }));
  assert.equal(env.rules.length, 1);
  assert.deepEqual(plain(await env.api.getPublicServerCountry(123, first, false)), { placeVersion: 15077 });
  assert.equal(env.requests.length, 3, 'Cached metadata sends no further join requests');
});

test('country and version share one join result and geolocation failure cannot discard a valid version', async () => {
  const env = worker(url => url.hostname === 'gamejoin.roblox.com'
    ? { joinScript: { GameId: first, PlaceId: 123, PlaceVersion: 15077, UdmuxEndpoints: [{ Address: '8.8.8.8' }], ClientTicket: 'SECRET' } }
    : { status: 503 });
  const result = plain(await env.api.getPublicServerCountry(123, first));
  assert.equal(result.placeVersion, 15077);assert.ok(result.countryError);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal(Object.hasOwn(result, 'ip'), false);
  assert.deepEqual(plain(await env.api.getPublicServerCountry(123, first, false)), { placeVersion: 15077 });
  assert.equal(env.requests.filter(request => request.url.hostname === 'gamejoin.roblox.com').length, 1);
});

test('versions from a different server or invalid version fields are never displayed', async () => {
  const mismatch = worker(() => ({ joinScript: { GameId: second, PlaceId: 123, PlaceVersion: 15077 } }));
  await assert.rejects(mismatch.api.getPublicServerCountry(123, first, false), /different server/);
  for (const PlaceVersion of [undefined, null, 0, -1, '15077', Infinity, 2.5]) {
    const env = worker(() => ({ joinScript: { GameId: first, PlaceVersion } }));
    assert.deepEqual(plain(await env.api.getPublicServerCountry(123, first, false)), {});
  }
});
