const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function worker(pages) {
  const requests = [], handlers = [];
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout,
    chrome: { runtime: { onMessage: { addListener(handler) { handlers.push(handler); } } } },
    async fetch(url) {
      requests.push(new URL(url));
      const page = pages[Math.min(requests.length - 1, pages.length - 1)];
      return { ok: true, json: async () => page };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/shared/routes.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/background/service-worker.js'), 'utf8')
    + '\nglobalThis.lookup = getPublicServerStatuses;', context);
  return { requests, handlers, lookup: context.lookup };
}

const first = { id: '12345678-1234-4444-8888-000000000001', ping: 142, playing: 4 };
const second = { id: '12345678-5678-4444-8888-000000000002', ping: 63 };

test('public metadata recovers full UUIDs and numeric latency from native shortened labels across API pages', async () => {
  const env = worker([{ data: [first], nextPageCursor: 'page-2' }, { data: [second] }]);
  const result = JSON.parse(JSON.stringify(await env.lookup(4623386862, [], ['1234-4444', '5678-4444'])));
  assert.deepEqual(result.matches, [{ shortId: '1234-4444', id: first.id }, { shortId: '5678-4444', id: second.id }]);
  assert.deepEqual(result.servers.map(server => server.ping), [142, 63]);
  assert.equal(env.requests[1].searchParams.get('cursor'), 'page-2');
});

test('ambiguous short IDs never select either server, while full UUID queries still work', async () => {
  const duplicate = { ...first, id: '87654321-1234-4444-8888-999999999999', ping: 95 };
  const env = worker([{ data: [first], nextPageCursor: 'page-2' }, { data: [duplicate] }]);
  const result = await env.lookup(4623386862, [first.id], ['1234-4444']);
  assert.equal(result.matches.length, 0);
  assert.equal(result.servers.length, 1);
  assert.equal(result.servers[0].id, first.id);
});

test('an incomplete or expired inventory cannot resolve a shortened ID', async () => {
  const env = worker([{ data: [first], nextPageCursor: 'more' }]);
  const result = await env.lookup(4623386862, [], ['1234-4444', '9999-4444']);
  assert.equal(env.requests.length, 10);
  assert.equal(result.matches.length, 0);
  assert.equal(result.servers.length, 0);
});

test('completed inventories are reused when paging requests different native server IDs', async () => {
  const env = worker([{ data: [first, second] }]);
  await env.lookup(4623386862, [], ['1234-4444']);
  const next = await env.lookup(4623386862, [], ['5678-4444']);
  assert.equal(next.matches[0].id, second.id);
  assert.equal(next.servers[0].ping, second.ping);
  assert.equal(env.requests.length, 1, 'Paging does not repeat a completed server inventory');
});

test('localized requests validate the game, short IDs and request size before fetching', async () => {
  const env = worker([{ data: [first] }]);
  const sender = { url: 'https://www.roblox.com/id/games/4623386862/Piggy' };
  const request = { type: 'rc-public-server-status', placeId: 4623386862, serverIds: [], shortIds: ['1234-4444'] };
  for (const changes of [{ placeId: 999 }, { shortIds: ['invalid'] }, { shortIds: Array(101).fill('1234-4444') }, { shortIds: [] }]) {
    env.handlers[0]({ ...request, ...changes }, sender, () => assert.fail('Invalid requests cannot respond'));
  }
  assert.equal(env.requests.length, 0);
  const result = await new Promise(resolve => env.handlers[0](request, sender, resolve));
  assert.equal(result.matches[0].id, first.id);
});
