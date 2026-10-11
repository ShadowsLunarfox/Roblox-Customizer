const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const { test } = require('node:test');
const core = require('../src/home/pinned-games-core.js');
const source = fs.readFileSync(path.join(__dirname, '..', 'src/background/pinned-games-background.js'), 'utf8');
const clean = value => JSON.parse(JSON.stringify(value));
const record = id => ({ placeId: id, universeId: id + 1000, name: `Game ${id}`,
  iconUrl: `https://tr.rbxcdn.com/${id}.png`, updatedAt: Date.now() });

function worker(initial = [], options = {}) {
  let listener;
  let data = clean(initial);
  let folders = clean(options.folders || []);
  let writes = 0;
  const requests = [];
  const context = vm.createContext({
    RobloxCustomizerPinnedGames: core, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, crypto: webcrypto,
    chrome: {
      runtime: { id: 'test-extension', onMessage: { addListener(fn) { listener = fn; } } },
      storage: { local: {
        async get() { return { [core.STORAGE_KEY]: clean(data), [core.FOLDERS_KEY]: clean(folders) }; },
        async set(value) {
          if (options.storageError) throw new Error('Storage unavailable');
          data = clean(value[core.STORAGE_KEY]); folders = clean(value[core.FOLDERS_KEY]); writes++;
        }
      } }
    },
    async fetch(value, config) {
      const url = new URL(value); requests.push({ url: url.href, config });
      if (options.networkError) throw new Error('Network unavailable');
      let result;
      if (url.hostname === 'apis.roblox.com') {
        if (options.universeError) throw new Error('Universe unavailable');
        const id = Number(url.pathname.match(/\/places\/(\d+)\//)[1]);
        result = { universeId: options.sharedUniverse || id + 1000 };
      } else if (url.pathname === '/v1/games/multiget-place-details') {
        if (!options.privateGame || options.privateError) return { ok: false, status: 401 };
        const id = Number(url.searchParams.get('placeIds'));
        result = [{ placeId: id, universeId: id + 1000, universeRootPlaceId: id,
          name: 'Private project', isPlayable: false, reasonProhibited: 'UniverseRootPlaceIsNotActive', ...options.privateGame }];
      } else if (url.hostname === 'games.roblox.com') {
        result = { data: url.searchParams.get('universeIds').split(',').map(Number).map(id => ({
          id, rootPlaceId: id - 1000, name: options.name || `Game ${id - 1000}`
        })) };
        if (options.missingGame) result.data = [];
      } else if (url.hostname === 'thumbnails.roblox.com') {
        if (options.thumbnailError) throw new Error('Thumbnail unavailable');
        result = { data: url.searchParams.get('universeIds').split(',').map(Number).map(id => ({
          targetId: id, state: options.thumbnailState || 'Completed',
          imageUrl: options.iconUrl || `https://tr.rbxcdn.com/${id}.png`
        })) };
      } else throw new Error(`Unexpected host ${url.hostname}`);
      return { ok: true, async json() { return result; } };
    }
  });
  vm.runInContext(source, context);
  function send(action, extra = {}, pathname = '/home', senderExtra = {}) {
    return new Promise(resolve => {
      const handled = listener({ type: 'rc-pinned-games', action, ...extra },
        { id: 'test-extension', url: `https://www.roblox.com${pathname}`, ...senderExtra }, response => resolve(clean(response)));
      if (handled !== true) resolve(null);
    });
  }
  return { send, requests, get data() { return clean(data); }, get folders() { return clean(folders); }, get writes() { return writes; } };
}

test('pin records preserve large collections, deduplicate and accept only Roblox CDN icons', () => {
  const input = [null, {}, { ...record(1), placeId: '1' }, record(1), record(1),
    { ...record(2), iconUrl: 'https://rbxcdn.com.attacker.test/image.png' },
    { ...record(3), iconUrl: 'javascript:alert(1)' }, ...Array.from({ length: 15 }, (_, index) => record(index + 4))];
  const games = core.normalize(input);
  assert.equal(games.length, 18);
  assert.equal(new Set(games.map(game => game.universeId)).size, 18);
  assert.equal(core.normalize(Array.from({ length: 1500 }, (_, i) => record(i + 1))).length, 1500);
  assert.equal(games[1].iconUrl, ''); assert.equal(games[2].iconUrl, '');
  assert.equal(core.iconUrl('http://tr.rbxcdn.com/test.png'), '');
  assert.equal(core.iconUrl('https://user:pass@tr.rbxcdn.com/test.png'), '');
  assert.equal(core.iconUrl('https://tr.rbxcdn.com/test.png'), 'https://tr.rbxcdn.com/test.png');
});

test('pin resolves an official game name, root place and icon and persists it', async () => {
  const env = worker([], { name: '<img onerror=alert(1)> Adventure' });
  const response = await env.send('pin', { placeId: 1 }, '/games/1/Adventure');
  assert.equal(response.status, 'pinned'); assert.equal(env.data.length, 1);
  assert.equal(env.data[0].name, '<img onerror=alert(1)> Adventure');
  assert.equal(env.data[0].universeId, 1001); assert.equal(env.data[0].placeId, 1);
  assert.equal(env.data[0].iconUrl, 'https://tr.rbxcdn.com/1001.png');
  assert.equal(env.requests.length, 3);
  assert.ok(env.requests.every(request => request.config.credentials === 'omit'));
  const restarted = worker(env.data);
  assert.deepEqual((await restarted.send('list')).games, env.data);
  assert.equal(restarted.requests.length, 0, 'Fresh pins load from extension storage');
});

test('non-public games resolve using authenticated details even when they are not playable', async () => {
  for (const universeError of [false, true]) {
    const env = worker([], { missingGame: true, universeError, privateGame: { universeRootPlaceId: 1 } });
    const response = await env.send('pin', { placeId: 2 }, '/games/2/Private');
    assert.equal(response.status, 'pinned');
    assert.equal(env.data[0].name, 'Private project');
    assert.equal(env.data[0].placeId, 1, 'The authenticated root place is preserved');
    assert.equal(env.data[0].universeId, 1002);
    const authenticated = env.requests.filter(request => request.config.credentials === 'include');
    assert.equal(authenticated.length, 1);
    assert.equal(new URL(authenticated[0].url).pathname, '/v1/games/multiget-place-details');
    assert.equal(new URL(authenticated[0].url).hostname, 'games.roblox.com');
    assert.equal((await env.send('pin', { placeId: 2 }, '/games/2')).status, 'already-pinned');
    assert.equal(env.data.length, 1);
  }
});

test('private metadata can fall back to the verified current page without requiring a public listing', async () => {
  const pageInfo = { universeId: 1001, name: ' 私人测试 <img onerror=alert(1)> ',
    rootPlaceId: 999, iconUrl: 'https://tr.rbxcdn.com/private.png' };
  const env = worker([], { missingGame: true, thumbnailError: true });
  assert.equal((await env.send('pin', { placeId: 1, pageInfo }, '/games/1')).status, 'pinned');
  assert.equal(env.data[0].placeId, 1, 'A page hint cannot replace the verified current place');
  assert.equal(env.data[0].name, pageInfo.name.trim());
  assert.equal(env.data[0].iconUrl, pageInfo.iconUrl);
  const restarted = worker([{ ...env.data[0], updatedAt: 0 }], { missingGame: true, thumbnailState: 'Blocked' });
  assert.deepEqual((await restarted.send('list')).games, restarted.data, 'Unavailable public metadata keeps the saved private pin');
  assert.equal(restarted.data[0].name, pageInfo.name.trim());
  assert.equal(restarted.data[0].iconUrl, pageInfo.iconUrl);
  assert.equal((await restarted.send('unpin', { universeId: 1001 })).status, 'unpinned');
  assert.equal(restarted.data.length, 0);
});

test('private page fallback cannot create unverified pins or trust mismatched IDs and arbitrary images', async () => {
  for (const [options, pageInfo] of [
    [{ networkError: true }, { universeId: 1001, name: 'Offline fake' }],
    [{ universeError: true }, { universeId: 1001, name: 'Unverified' }],
    [{}, { universeId: 1002, name: 'Other game' }],
    [{}, { universeId: '1001', name: 'Wrong ID type' }],
    [{}, { universeId: 1001, name: '  ' }],
    [{ privateGame: { placeId: 2 } }, undefined],
    [{ privateGame: { universeId: 1002 } }, undefined],
    [{ privateGame: { universeRootPlaceId: 0 } }, undefined]
  ]) {
    const env = worker([], { missingGame: true, ...options });
    assert.equal((await env.send('pin', { placeId: 1, pageInfo }, '/games/1')).ok, false);
    assert.equal(env.data.length, 0);
  }
  const env = worker([], { missingGame: true, thumbnailError: true });
  await env.send('pin', { placeId: 1, pageInfo: { universeId: 1001, name: 'Private', iconUrl: 'https://evil.test/image.png' } }, '/games/1');
  assert.equal(env.data[0].iconUrl, '');
});

test('concurrent pins from multiple tabs pass ten without a lost update', async () => {
  const env = worker(Array.from({ length: 9 }, (_, index) => record(index + 1)));
  const results = await Promise.all([env.send('pin', { placeId: 10 }, '/games/10'), env.send('pin', { placeId: 11 }, '/games/11')]);
  assert.equal(results[0].status, 'pinned'); assert.equal(results[1].status, 'pinned');
  assert.equal(env.data.length, 11); assert.equal(env.writes, 2);
  assert.equal(env.requests.length, 6);
});

test('duplicates and subplaces share one pin, and unpinning makes space', async () => {
  const env = worker([record(1)], { sharedUniverse: 1001 });
  assert.equal((await env.send('pin', { placeId: 1 }, '/games/1')).status, 'already-pinned');
  assert.equal((await env.send('pin', { placeId: 999 }, '/games/999')).status, 'already-pinned');
  assert.equal(env.data.length, 1); assert.equal(env.writes, 0);
  assert.equal((await env.send('unpin', { universeId: 1001 })).status, 'unpinned');
  assert.equal(env.data.length, 0);
  assert.equal((await env.send('pin', { placeId: 1 }, '/games/1')).status, 'pinned');
});

test('a large list still permits unpinning and adding another game', async () => {
  const env = worker(Array.from({ length: 10 }, (_, index) => record(index + 1)));
  assert.equal((await env.send('pin', { placeId: 11 }, '/games/11')).status, 'pinned');
  await env.send('unpin', { universeId: 1005 });
  assert.equal((await env.send('pin', { placeId: 12 }, '/games/12')).status, 'pinned');
  assert.equal(env.data.length, 11); assert.equal(env.data.some(game => game.placeId === 5), false);
});

test('missing thumbnails retain a usable pin and stale icons refresh in a single batch', async () => {
  const pending = worker([], { thumbnailState: 'Pending' });
  assert.equal((await pending.send('pin', { placeId: 1 }, '/games/1')).ok, true);
  assert.equal(pending.data[0].iconUrl, ''); assert.equal(pending.data[0].updatedAt, 0);
  const env = worker([1, 2, 3].map(id => ({ ...record(id), name: 'Old name', updatedAt: 0 })));
  const response = await env.send('list');
  assert.equal(env.requests.length, 2); assert.equal(env.writes, 1);
  assert.equal(response.games[0].name, 'Game 1');
  assert.ok(response.games.every(game => game.updatedAt > 0));
  await env.send('list'); assert.equal(env.requests.length, 2);
});

test('failed metadata or storage never adds a phantom pin; offline refresh retains pins', async () => {
  for (const options of [{ networkError: true }, { missingGame: true }, { storageError: true }]) {
    const env = worker([], options);
    assert.equal((await env.send('pin', { placeId: 1 }, '/games/1')).ok, false);
    assert.equal(env.data.length, 0);
  }
  const existing = [{ ...record(1), updatedAt: 0 }];
  const offline = worker(existing, { networkError: true });
  assert.deepEqual((await offline.send('list')).games, existing);
  const count = offline.requests.length;
  await offline.send('list'); assert.equal(offline.requests.length, count, 'Refresh failures back off');
});

test('worker rejects mismatched place IDs, invalid IDs, unrelated pages and other origins', async () => {
  const env = worker();
  for (const id of [-1, 0, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) assert.equal(await env.send('pin', { placeId: id }, '/games/1'), null);
  assert.equal(await env.send('pin', { placeId: 2 }, '/games/1'), null);
  assert.equal(await env.send('pin', { placeId: 1 }), null);
  assert.equal(await env.send('list', {}, '/catalog/1'), null);
  assert.equal(await env.send('list', {}, '/home', { id: 'other-extension' }), null);
  assert.equal(await env.send('list', {}, '/home', { url: 'https://evil.test/home' }), null);
  assert.equal(await env.send('list', {}, '/home', { url: 'http://www.roblox.com/home' }), null);
  assert.equal(await env.send('unpin', { universeId: '1001' }), null);
  assert.equal(env.requests.length, 0); assert.equal(env.writes, 0);
});

test('old pins migrate without data loss and invalid folder records and memberships are sanitized', () => {
  const games = [record(1), { ...record(2), folderId: 'folder-1' }, { ...record(3), folderId: 'missing' }];
  assert.deepEqual(core.state([games[0]], undefined), { games: [games[0]], folders: [] });
  const state = core.state(games, [null, {}, { id: 'folder-1', name: ' Search ' },
    { id: 'folder-1', name: 'Duplicate' }, { id: '<script>', name: 'Invalid ID' }, { id: 'empty', name: '  ' }]);
  assert.deepEqual(state.folders, [{ id: 'folder-1', name: 'Search' }]);
  assert.equal(state.games[1].folderId, 'folder-1');
  assert.equal(state.games[2].folderId, undefined);
  assert.equal(core.folderName('x'.repeat(100)).length, 80);
});

test('folders create, rename and persist; moving and deleting folders never unpins games', async () => {
  const env = worker([record(1), record(2)]);
  const first = await env.send('create-folder', { name: '  收藏 <img onerror=alert(1)>  ' });
  const second = await env.send('create-folder', { name: 'Private projects' });
  assert.equal(first.ok, true); assert.equal(second.ok, true);
  assert.notEqual(first.folderId, second.folderId);
  assert.equal(env.folders[0].name, '收藏 <img onerror=alert(1)>');
  assert.equal((await env.send('move', { universeId: 1001, folderId: first.folderId })).ok, true);
  assert.equal((await env.send('move', { universeId: 1002, folderId: second.folderId })).ok, true);
  await env.send('rename-folder', { folderId: first.folderId, name: 'Search' });
  const restarted = worker(env.data, { folders: env.folders });
  assert.deepEqual((await restarted.send('list')).folders, env.folders);
  await restarted.send('delete-folder', { folderId: first.folderId });
  assert.equal(restarted.data.length, 2);
  assert.equal(restarted.data[0].folderId, undefined);
  assert.equal(restarted.data[1].folderId, second.folderId);
  assert.deepEqual(restarted.folders, [{ id: second.folderId, name: 'Private projects' }]);
  await restarted.send('move', { universeId: 1002, folderId: '' });
  assert.equal(restarted.data[1].folderId, undefined);
  assert.equal(env.requests.length, 0, 'Folder changes need no Roblox network requests');
});

test('concurrent folder edits and pins serialize without losing category changes', async () => {
  const env = worker([record(1)], { folders: [{ id: 'friends', name: 'Friends' }] });
  await Promise.all([
    env.send('move', { universeId: 1001, folderId: 'friends' }),
    env.send('pin', { placeId: 2 }, '/games/2'),
    env.send('rename-folder', { folderId: 'friends', name: 'Together' })
  ]);
  assert.equal(env.data.length, 2);
  assert.equal(env.data[0].folderId, 'friends');
  assert.equal(env.folders[0].name, 'Together');
  await Promise.all([env.send('delete-folder', { folderId: 'friends' }), env.send('move', { universeId: 1002, folderId: 'friends' })]);
  assert.equal(env.data.length, 2);
  assert.equal(env.data.every(game => !game.folderId), true, 'Deleted folders cannot be resurrected by a late move');
});

test('folder actions reject invalid input, unrelated routes and missing targets without losing data', async () => {
  const env = worker([record(1)], { folders: [{ id: 'one', name: 'One' }] });
  for (const [action, input] of [
    ['create-folder', { name: '  ' }], ['create-folder', { name: {} }],
    ['rename-folder', { folderId: 'one', name: '' }], ['delete-folder', { folderId: '../one' }],
    ['move', { universeId: '1001', folderId: 'one' }], ['move', { universeId: 1001, folderId: null }]
  ]) assert.equal(await env.send(action, input), null);
  assert.equal(await env.send('create-folder', { name: 'No' }, '/games/1'), null);
  assert.equal(await env.send('delete-folder', { folderId: 'one' }, '/catalog/1'), null);
  for (const [action, input] of [
    ['rename-folder', { folderId: 'missing', name: 'Other' }],
    ['delete-folder', { folderId: 'missing' }], ['move', { universeId: 1001, folderId: 'missing' }],
    ['move', { universeId: 9000, folderId: 'one' }]
  ]) assert.equal((await env.send(action, input)).ok, false);
  assert.equal(env.writes, 0);
  const failing = worker([record(1)], { storageError: true });
  assert.equal((await failing.send('create-folder', { name: 'Test' })).ok, false);
  assert.deepEqual(failing.folders, []);
  assert.equal(failing.data.length, 1);
});

test('large metadata refreshes use small batches and preserve all pins and folder membership', async () => {
  const games = Array.from({ length: 125 }, (_, i) => ({ ...record(i + 1), updatedAt: 0, folderId: 'all' }));
  const env = worker(games, { folders: [{ id: 'all', name: 'Large library' }] });
  const response = await env.send('list');
  assert.equal(response.games.length, 125);
  assert.equal(response.games.every(game => game.folderId === 'all'), true);
  assert.equal(env.requests.length, 2);
  assert.equal(env.requests.every(request => new URL(request.url).searchParams.get('universeIds').split(',').length <= 10), true);
  assert.equal(response.games.filter(game => game.updatedAt > 0).length, 10);
});

test('unavailable thumbnails cannot starve later pins after a worker restart', async () => {
  const games = Array.from({ length: 35 }, (_, i) => ({ ...record(i + 1), updatedAt: 0 }));
  const first = worker(games, { thumbnailState: 'Blocked' });
  await first.send('list');
  assert.equal(first.data.filter(game => game.checkedAt > 0).length, 10);
  assert.equal(first.data.every(game => game.updatedAt === 0), true);
  const restarted = worker(first.data, { thumbnailState: 'Blocked' });
  await restarted.send('list');
  assert.equal(new URL(restarted.requests[0].url).searchParams.get('universeIds'),
    Array.from({ length: 10 }, (_, i) => String(1011 + i)).join(','));
  assert.equal(restarted.data.length, 35);
  assert.equal(restarted.data.filter(game => game.checkedAt > 0).length, 20);
});

test('game page pins save their selected folder in the same write, including private experiences', async () => {
  for (const options of [{}, { missingGame: true, privateGame: {} }]) {
    const env = worker([], { ...options, folders: [{ id: 'projects', name: 'Projects' }] });
    const response = await env.send('pin', { placeId: 1, folderId: 'projects' }, '/games/1');
    assert.equal(response.ok, true);
    assert.equal(env.data[0].folderId, 'projects');
    assert.equal(env.writes, 1, 'The pin and its category are saved atomically');
    assert.equal((await env.send('pin', { placeId: 1, folderId: '' }, '/games/1')).status, 'already-pinned');
    assert.equal(env.data[0].folderId, 'projects', 'A duplicate pin never overwrites an existing category');
  }
  const env = worker([], { folders: [{ id: 'other', name: 'Other' }] });
  assert.equal((await env.send('pin', { placeId: 1, folderId: 'deleted' }, '/games/1')).ok, false);
  assert.equal(env.requests.length, 0);
  assert.equal(env.writes, 0);
  for (const folderId of [null, 1, {}, '../projects']) {
    assert.equal(await env.send('pin', { placeId: 1, folderId }, '/games/1'), null);
  }
});

test('game pages move the current pin and verified subplaces without allowing unrelated games', async () => {
  const folders = [{ id: 'projects', name: 'Projects' }];
  const env = worker([record(1), record(2)], { folders });
  assert.equal((await env.send('move', { placeId: 1, universeId: 1001, folderId: 'projects' }, '/games/1')).ok, true);
  assert.equal(env.data[0].folderId, 'projects');
  assert.equal(env.requests.length, 0, 'Moving a root place needs no metadata request');
  assert.equal((await env.send('move', { placeId: 1, universeId: 1001, folderId: '' }, '/games/1')).ok, true);
  assert.equal(env.data[0].folderId, undefined);
  assert.equal(await env.send('move', { placeId: 2, universeId: 1001, folderId: 'projects' }, '/games/1'), null);
  assert.equal(await env.send('move', { universeId: 1001, folderId: 'projects' }, '/games/1'), null);
  assert.equal((await env.send('move', { placeId: 1, universeId: 1002, folderId: 'projects' }, '/games/1')).ok, false);
  assert.equal(env.data[1].folderId, undefined);
  const subplace = worker([record(1)], { folders, sharedUniverse: 1001 });
  assert.equal((await subplace.send('move', { placeId: 999, universeId: 1001, folderId: 'projects' }, '/games/999')).ok, true);
  assert.equal(subplace.data[0].folderId, 'projects');
  const offline = worker([record(1)], { folders, networkError: true });
  assert.equal((await offline.send('move', { placeId: 999, universeId: 1001, folderId: 'projects' }, '/games/999')).ok, false);
  assert.equal(offline.writes, 0);
});

test('a folder deleted in another tab cannot leave a new pin with dangling membership', async () => {
  const env = worker([], { folders: [{ id: 'projects', name: 'Projects' }] });
  const results = await Promise.all([
    env.send('delete-folder', { folderId: 'projects' }),
    env.send('pin', { placeId: 1, folderId: 'projects' }, '/games/1')
  ]);
  assert.equal(results[0].ok, true); assert.equal(results[1].ok, false);
  assert.equal(env.data.length, 0);
});
