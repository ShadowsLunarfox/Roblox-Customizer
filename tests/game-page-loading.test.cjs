const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/pages/games/game-page.js'), 'utf8');
const labels = fs.readFileSync(path.join(__dirname, '..', 'src/shared/native-labels.js'), 'utf8');
const exposed = source.replace(/  syncPrivateServers\(\);\s*  schedule\(\);\s*\}\)\(\);\s*$/, `
  globalThis.gameLoading = { initialize, waitForServerContent, syncServerPaneLoading,
    bind(state) {
      currentPage = () => state;
      aboutReady = () => state.about.loaded;
      syncPrivateServers = () => {};
      publicServerCards = container => container?.loaded ? [{}] : [];
      moveRecommendations = () => {};
      schedule = () => {};
    }
  };
})();`);
assert.notEqual(exposed, source, 'Exercise the actual content script');

function environment(readyState = 'interactive') {
  let time = 0;
  let timerId = 0;
  const timers = new Map();
  const observers = new Set();
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe(root) { this.root = root; observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const pane = () => ({ isConnected: true, loaded: true, textContent: '',
    active: false, rect: { top: 2000, bottom: 2200, height: 200 },
    classList: { contains() { return this.owner.active; } },
    getBoundingClientRect() { return this.rect; },
    querySelector(selector) {
      if (selector.includes('#running-game-instances-container')) return this.publicList ? this : null;
      if (selector.includes('.card-item')) return this.loaded ? {} : null;
      if (selector.includes('/private-server/configure')) return this.configure ? {} : null;
      return null;
    }
  });
  const about = pane();
  const store = pane();
  const servers = pane();
  servers.publicList = true;
  about.active = true;
  for (const node of [about, store, servers]) node.classList.owner = node;
  const page = { isConnected: true, getAttribute: name => name === 'data-place-id' ? '123' : null,
    querySelector: selector => ({ '#about': about, '#store': store, '#game-instances': servers })[selector] || null };
  const document = { readyState, querySelector: () => null, addEventListener() {} };
  const location = { pathname: '/games/123/Test', href: 'https://www.roblox.com/games/123/Test' };
  const clicks = [];
  const restored = [];
  const state = { page, about, placeId: '123', links: ['about', 'store', 'servers'].map(name => ({
    click() {
      clicks.push({ name, time }); about.loaded = name === 'about';
      for (const [key, node] of Object.entries({ about, store, servers })) node.active = key === name;
    }
  })) };
  const context = vm.createContext({ document, location, URL, Intl,
    Date: class extends Date { static now() { return time; } },
    MutationObserver: Observer, ResizeObserver: Observer, window: { addEventListener() {} },
    history: { state: { native: true }, replaceState(...args) { restored.push(args); } }, innerHeight: 800,
    setTimeout(callback, delay) { timers.set(++timerId, { callback, due: time + delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(exposed, context);
  vm.runInContext(labels, context);
  const api = context.gameLoading;
  api.bind(state);
  return { api, document, page, about, store, servers, state, location, clicks, restored, timers,
    update(node, changes) {
      Object.assign(node, changes);
      for (const observer of [...observers]) if (observer.root === node) observer.callback([]);
    },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!next) break;
        timers.delete(next[0]); time = next[1].due; next[1].callback();
      }
      time = end;
    }
  };
}

test('game panes initialize before slow image loads finish', async () => {
  const env = environment();
  await env.api.initialize();
  assert.deepEqual(env.clicks.map(({ name }) => name), ['store', 'servers', 'about']);
  assert.equal(env.document.readyState, 'interactive');
  assert.equal(env.restored[0][2], env.location.href);
  await env.api.initialize();
  assert.equal(env.clicks.length, 3, 'The same page is initialized only once');
});

test('initialization waits for About content before opening the other native tabs', async () => {
  const env = environment();
  env.about.loaded = false;
  const loading = env.api.initialize();
  assert.deepEqual(env.clicks, []);
  env.advance(100);
  env.update(env.about, { loaded: true });
  await loading;
  assert.deepEqual(env.clicks.map(({ name }) => name), ['store', 'servers', 'about']);
  assert.equal(env.clicks[0].time, 100);
});

test('a rendered Store advances to Servers immediately instead of waiting 1500 ms', async () => {
  const env = environment();
  env.store.loaded = false;
  const loading = env.api.initialize();
  await Promise.resolve();
  assert.deepEqual(env.clicks.map(({ name }) => name), ['store']);
  env.advance(100);
  env.update(env.store, { loaded: true });
  await loading;
  assert.deepEqual(env.clicks.map(({ name }) => name), ['store', 'servers', 'about']);
  assert.equal(env.clicks[1].time, 100);
});

test('public cards complete server loading when private servers are unavailable', async () => {
  const env = environment();
  assert.equal(await env.api.waitForServerContent(env.page), true);
  assert.equal(env.timers.size, 0);
});

test('native server arrivals do not wait for unrelated DOM activity to settle', async () => {
  const env = environment();
  env.servers.loaded = false;
  const loading = env.api.waitForServerContent(env.page);
  env.advance(80);
  env.update(env.servers, { loaded: true });
  for (let i = 0; i < 20; i++) env.update(env.servers, { textContent: `Country lookup ${i}` });
  assert.equal(await loading, true);
  assert.equal(env.timers.size, 0);
});

test('an exhausted public list completes loading without a private-server heading', async () => {
  const env = environment();
  env.servers.loaded = false;
  env.servers.textContent = 'Other Servers. No public servers available.';
  assert.equal(await env.api.waitForServerContent(env.page), true);
  env.servers.textContent = 'There are currently no running experiences.';
  assert.equal(await env.api.waitForServerContent(env.page), true);
});

test('navigation cancels a pending pane wait instead of blocking the next page', async () => {
  const env = environment();
  env.servers.loaded = false;
  const loading = env.api.waitForServerContent(env.page);
  env.location.pathname = '/games/456/Next';
  env.advance(200);
  assert.equal(await loading, false);
  assert.equal(env.timers.size, 0);
});

test('initialization leaves the native tabs alone while HTML is still parsing', async () => {
  const env = environment('loading');
  await env.api.initialize();
  assert.deepEqual(env.clicks, []);
});

test('private content cannot finish loading while public servers are still pending', async () => {
  const env = environment();
  env.servers.loaded = false;
  env.servers.configure = true;
  const loading = env.api.waitForServerContent(env.page);
  let finished = false;
  loading.then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  env.update(env.servers, { loaded: true });
  assert.equal(await loading, true);
});

test('only public empty-state messages finish server loading across languages', async () => {
  for (const text of ['No private servers found', '没有私人服务器', '尚無私人伺服器']) {
    const env = environment();
    env.servers.loaded = false;
    env.servers.textContent = text;
    const loading = env.api.waitForServerContent(env.page, 100);
    env.advance(100);
    assert.equal(await loading, false, text);
  }
  for (const text of ['No public servers available.', '没有可用的公共服务器', '暫無伺服器']) {
    const env = environment();
    env.servers.loaded = false;
    env.servers.textContent = text;
    assert.equal(await env.api.waitForServerContent(env.page), true, text);
  }
});

test('a timed-out offscreen server list recovers on approach and stays active until leaving', async () => {
  const env = environment();
  env.servers.loaded = false;
  const loading = env.api.initialize();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  assert.deepEqual(env.clicks.map(({ name }) => name), ['store', 'servers']);
  env.advance(15_000);
  await loading;
  assert.equal(env.about.active, true);
  env.api.syncServerPaneLoading();
  assert.equal(env.clicks.length, 3, 'No offscreen retry loop');

  env.servers.rect = { top: 900, bottom: 1100, height: 200 };
  env.api.syncServerPaneLoading();
  assert.deepEqual(env.clicks.map(({ name }) => name), ['store', 'servers', 'about', 'servers']);
  assert.equal(env.restored.at(-1)[2], env.location.href);
  env.advance(60_000);
  env.api.syncServerPaneLoading();
  assert.equal(env.servers.active, true, 'A second slow load stays selected while nearby');
  assert.equal(env.clicks.length, 4, 'No repeated tab clicks while loading');
  env.update(env.servers, { loaded: true });
  env.api.syncServerPaneLoading();
  assert.equal(env.clicks.length, 4, 'Loaded content remains untouched');

  env.servers.rect = { top: 2000, bottom: 2200, height: 200 };
  env.api.syncServerPaneLoading();
  assert.equal(env.about.active, true, 'About is restored when scrolling back up');
  env.servers.rect = { top: 400, bottom: 600, height: 200 };
  env.api.syncServerPaneLoading();
  assert.equal(env.clicks.length, 5, 'Revisiting an intact list does not reload it');
});

test('native content discarded after initialization recovers without replaying Store', async () => {
  const env = environment();
  await env.api.initialize();
  env.servers.loaded = false;
  env.servers.rect = { top: 400, bottom: 600, height: 200 };
  env.api.syncServerPaneLoading();
  assert.deepEqual(env.clicks.map(({ name }) => name), ['store', 'servers', 'about', 'servers']);
  env.servers.loaded = true;
  env.api.syncServerPaneLoading();
  env.document.hidden = true;
  env.servers.rect = { top: 2000, bottom: 2200, height: 200 };
  env.api.syncServerPaneLoading();
  assert.equal(env.clicks.length, 4, 'Hidden documents cannot change native tabs');
  env.document.hidden = false;
  env.api.syncServerPaneLoading();
  assert.equal(env.clicks.length, 5);
});

test('recovery never clicks stale tabs after game navigation', async () => {
  const env = environment();
  await env.api.initialize();
  env.servers.loaded = false;
  env.servers.rect = { top: 400, bottom: 600, height: 200 };
  env.state.placeId = '456';
  env.location.pathname = '/games/456/Next';
  env.api.syncServerPaneLoading();
  assert.equal(env.clicks.length, 3);
});
