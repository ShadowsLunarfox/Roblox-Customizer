const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const startup = fs.readFileSync(path.join(__dirname, '..', 'startup.js'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '..', 'settings.js'), 'utf8');
const fallbackStart = settings.indexOf('  function syncFrostPage()');
const fallbackEnd = settings.indexOf('  function openDatabase()', fallbackStart);
assert.ok(fallbackStart >= 0 && fallbackEnd > fallbackStart);
const fallback = settings.slice(fallbackStart, fallbackEnd);

function harness(url, script, cached = null) {
  const attributes = new Map();
  const properties = new Map();
  const root = {
    dataset: {}, style: { setProperty(name, value) { properties.set(name, value); } },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    hasAttribute(name) {
      return name === 'data-rc-frost-page' ? root.dataset.rcFrostPage !== undefined : attributes.has(name);
    },
    removeAttribute(name) {
      if (name === 'data-rc-frost-page') delete root.dataset.rcFrostPage;
      else attributes.delete(name);
    },
    toggleAttribute(name, enabled) {
      if (enabled) root.setAttribute(name, '');
      else root.removeAttribute(name);
    }
  };
  const events = new Map();
  const location = new URL(url, 'https://www.roblox.com');
  const context = {
    location,
    document: { documentElement: root, readyState: 'loading',
      addEventListener() {}, querySelector() { return null; } },
    localStorage: { getItem() { return cached && JSON.stringify(cached); }, setItem() {} },
    MutationObserver: class { observe() {} },
    addEventListener(name, callback) { events.set(name, callback); },
    setTimeout() { return 1; }, clearTimeout() {}
  };
  vm.runInNewContext(script, context);
  return { root, properties, location, events, startup: context.RobloxCustomizerStartup };
}

for (const [name, script] of [['startup', startup], ['settings fallback', fallback]]) {
  test(`${name} applies the product style to bundle routes and clears it after navigation`, () => {
    const env = harness('/bundles/33230277606065/R6', script);
    assert.equal(env.root.dataset.rcFrostPage, 'catalog');
    for (const url of ['/catalog/10159600649/Crown', '/bundles/123', '/bundles/123/']) {
      env.location.href = new URL(url, 'https://www.roblox.com').href;
      env.events.get('popstate')();
      assert.equal(env.root.dataset.rcFrostPage, 'catalog', url);
    }
    for (const url of ['/home', '/bundles', '/bundles-extra/123', '/bundles/nope', '/bundles/-123', '/bundles/123oops']) {
      env.location.href = new URL(url, 'https://www.roblox.com').href;
      env.events.get('popstate')();
      assert.equal(env.root.dataset.rcFrostPage, undefined, url);
    }
  });

  test(`${name} marks own and user-specific friends and inventory URLs before content renders`, () => {
    for (const [url, expected] of [
      ['/users/friends#!/friend-requests', 'friends'],
      ['/users/156/friends#!/friends', 'friends'],
      ['/users/123456789/friends/', 'friends'],
      ['/users/inventory#!/accessories', 'inventory'],
      ['/users/156/inventory/#!/accessories', 'inventory'],
      ['/users/123456789/inventory/?category=accessories', 'inventory'],
      ['/my/messages/#!/inbox', 'messages'],
      ['/trades?tab=Inbound', 'trades'],
      ['/transactions?transactionType=Purchase', 'transactions'],
      ['/transactions/', 'transactions']
    ]) {
      assert.equal(harness(url, script).root.dataset.rcFrostPage, expected, url);
    }
  });

  test(`${name} retains page styling across native account tabs`, () => {
    for (const [url, expected, hashes] of [
      ['/users/156/friends', 'friends', ['#!/friends', '#!/followers', '#!/friend-requests']],
      ['/users/156/inventory/', 'inventory', ['#!/accessories', '#!/clothing', '#!/badges']],
      ['/my/messages/', 'messages', ['#!/inbox', '#!/sent', '#!/archive']],
      ['/transactions', 'transactions', ['#summary', '#purchases', '#sales']]
    ]) {
      const env = harness(url, script);
      for (const hash of hashes) {
        env.location.hash = hash;
        env.events.get('hashchange')();
        assert.equal(env.root.dataset.rcFrostPage, expected);
      }
    }
  });

  test(`${name} changes account markers during navigation and removes them on unrelated pages`, () => {
    const env = harness('/users/156/inventory/', script);
    for (const [url, expected] of [
      ['/users/156/friends', 'friends'],
      ['/trades?tab=Outbound', 'trades'],
      ['/my/messages/', 'messages'],
      ['/transactions', 'transactions'],
      ['/users/156/profile', 'profile'],
      ['/home', undefined]
    ]) {
      env.location.href = new URL(url, 'https://www.roblox.com').href;
      env.events.get('popstate')();
      assert.equal(env.root.dataset.rcFrostPage, expected, url);
    }
  });

  test(`${name} excludes malformed user IDs and similarly named routes`, () => {
    for (const url of ['/users/abc/inventory', '/users/-156/inventory',
      '/users/1.5/friends', '/users/156/friends-extra', '/users/156/inventory-extra',
      '/users/friends-extra', '/users/inventory-extra', '/trades-extra', '/my/messages-extra',
      '/transactions-extra', '/transactions/purchase', '/my/transactions']) {
      assert.equal(harness(url, script).root.dataset.rcFrostPage, undefined, url);
    }
  });
}

test('user-specific routes honor cached visual preferences and wallpaper can still be disabled', () => {
  const env = harness('/users/156/inventory/', startup, {
    version: 1, backgroundActive: true, glassBlur: 24, glassOpacity: 75
  });
  assert.equal(env.root.hasAttribute('data-rc-background-active'), true);
  assert.equal(env.properties.get('--rc-glass-blur'), '24px');
  assert.equal(env.properties.get('--rc-glass-opacity'), '0.75');
  env.startup.setPreferences({ source: 'none', glassBlur: 18, glassOpacity: 62 });
  assert.equal(env.root.hasAttribute('data-rc-background-active'), false);
  assert.equal(env.root.dataset.rcFrostPage, 'inventory');
});

test('Home visibility preferences are cached independently and missing flags remain visible', () => {
  const oldCache = harness('/home', startup, { version: 1, hideRecommended: true });
  assert.equal(oldCache.root.hasAttribute('data-rc-hide-recommended'), true);
  assert.equal(oldCache.root.hasAttribute('data-rc-hide-favorites'), false);
  assert.equal(oldCache.root.hasAttribute('data-rc-hide-standout-games'), false);
  const env = harness('/home', startup, {
    version: 1, hideFavorites: true, hideStandoutGames: false, hideRecommended: true
  });
  assert.equal(env.root.hasAttribute('data-rc-hide-favorites'), true);
  assert.equal(env.root.hasAttribute('data-rc-hide-standout-games'), false);
  env.startup.setPreferences({ hideFavorites: false, hideStandoutGames: true, hideRecommended: false });
  assert.equal(env.root.hasAttribute('data-rc-hide-favorites'), false);
  assert.equal(env.root.hasAttribute('data-rc-hide-standout-games'), true);
  assert.equal(env.root.hasAttribute('data-rc-hide-recommended'), false);
});
