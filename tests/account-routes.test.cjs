const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const startup = fs.readFileSync(path.join(__dirname, '..', 'src/shared/startup.js'), 'utf8');
const settings = fs.readFileSync(path.join(__dirname, '..', 'src/settings/settings.js'), 'utf8');
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

  test(`${name} styles report-abuse routes without matching sign-in or unrelated report URLs`, () => {
    for (const url of ['/report-abuse', '/report-abuse/', '/report-abuse/?targetId=118155665728354&abuseVector=place']) {
      assert.equal(harness(url, script).root.dataset.rcFrostPage, 'report-abuse', url);
    }
    const env = harness('/report-abuse/', script);
    for (const url of ['/newlogin?ReturnUrl=%2Freport-abuse', '/report-abuse-extra', '/report-abuse/details', '/home']) {
      env.location.href = new URL(url, 'https://www.roblox.com').href;
      env.events.get('popstate')();
      assert.equal(env.root.dataset.rcFrostPage, undefined, url);
    }
  });

  test(`${name} limits the Robux redesign to the purchase overview`, () => {
    for (const url of ['/upgrades/robux', '/upgrades/robux/', '/upgrades/robux?ctx=navpopover', '/UPGRADES/ROBUX/']) {
      assert.equal(harness(url, script).root.dataset.rcFrostPage, 'robux', url);
    }
    const env = harness('/upgrades/robux?ctx=navpopover', script);
    for (const url of ['/upgrades/paymentmethods?ctx=subscription', '/upgrades/robux/checkout', '/upgrades/robux-extra', '/upgrades', '/newlogin', '/home']) {
      env.location.href = new URL(url, 'https://www.roblox.com').href;
      env.events.get('popstate')();
      assert.equal(env.root.dataset.rcFrostPage, undefined, url);
    }
  });

  test(`${name} styles account settings tabs without matching sign-in or other account URLs`, () => {
    for (const url of ['/my/account#!/info', '/my/account/', '/MY/ACCOUNT?tab=info', '/my/account#!/security', '/my/account#!/privacy', '/my/account#!/billing']) {
      assert.equal(harness(url, script).root.dataset.rcFrostPage, 'account-settings', url);
    }
    const env = harness('/my/account#!/info', script);
    env.location.hash = '#!/security';
    env.events.get('hashchange')();
    assert.equal(env.root.dataset.rcFrostPage, 'account-settings');
    for (const url of ['/NewLogin?ReturnUrl=%2Fmy%2Faccount', '/my/account-extra', '/my/account/security', '/account', '/home']) {
      env.location.href = new URL(url, 'https://www.roblox.com').href;
      env.events.get('popstate')();
      assert.equal(env.root.dataset.rcFrostPage, undefined, url);
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
  assert.equal(oldCache.root.hasAttribute('data-rc-hide-recommended-upper'), true);
  assert.equal(oldCache.root.hasAttribute('data-rc-hide-recommended-lower'), true);
  assert.equal(oldCache.root.hasAttribute('data-rc-hide-favorites'), false);
  assert.equal(oldCache.root.hasAttribute('data-rc-hide-standout-games'), false);
  const env = harness('/home', startup, {
    version: 1, hideFavorites: true, hideStandoutGames: false,
    hideRecommended: true, hideRecommendedUpper: false, hideRecommendedLower: true
  });
  assert.equal(env.root.hasAttribute('data-rc-hide-favorites'), true);
  assert.equal(env.root.hasAttribute('data-rc-hide-standout-games'), false);
  assert.equal(env.root.hasAttribute('data-rc-hide-recommended-upper'), false, 'An explicit upper preference overrides the legacy switch');
  assert.equal(env.root.hasAttribute('data-rc-hide-recommended-lower'), true);
  env.startup.setPreferences({ hideFavorites: false, hideStandoutGames: true,
    hideRecommendedUpper: true, hideRecommendedLower: false });
  assert.equal(env.root.hasAttribute('data-rc-hide-favorites'), false);
  assert.equal(env.root.hasAttribute('data-rc-hide-standout-games'), true);
  assert.equal(env.root.hasAttribute('data-rc-hide-recommended-upper'), true);
  assert.equal(env.root.hasAttribute('data-rc-hide-recommended-lower'), false);
  assert.equal(env.root.hasAttribute('data-rc-hide-recommended'), false);
  const defaults = harness('/home', startup, { version: 1 });
  assert.equal(defaults.root.hasAttribute('data-rc-hide-recommended-upper'), false);
  assert.equal(defaults.root.hasAttribute('data-rc-hide-recommended-lower'), false);
});

test('Saved recommendation preferences migrate without overriding independent choices', () => {
  const defaultsStart = settings.indexOf('  const DEFAULTS =');
  const defaultsEnd = settings.indexOf('  let settings =', defaultsStart);
  const normalizeStart = settings.indexOf('  function currentSettings(');
  const normalizeEnd = settings.indexOf('  function syncFrostPage()', normalizeStart);
  assert.ok(defaultsStart >= 0 && defaultsEnd > defaultsStart && normalizeStart >= 0 && normalizeEnd > normalizeStart);
  const normalize = vm.runInNewContext(`${settings.slice(defaultsStart, defaultsEnd)}\n${settings.slice(normalizeStart, normalizeEnd)}\ncurrentSettings`);
  for (const [saved, upper, lower] of [
    [undefined, false, false],
    [{ hideRecommended: true, hiddenRecommendedGames: [{ placeId: '102', name: 'Hidden game' }] }, true, true],
    [{ hideRecommended: false }, false, false],
    [{ hideRecommended: true, hideRecommendedUpper: false }, false, true],
    [{ hideRecommendedUpper: true, hideRecommendedLower: false }, true, false]
  ]) {
    const normalized = normalize(saved);
    assert.equal(normalized.hideRecommendedUpper, upper);
    assert.equal(normalized.hideRecommendedLower, lower);
    assert.equal(Object.hasOwn(normalized, 'hideRecommended'), false);
    if (saved?.hiddenRecommendedGames) assert.equal(normalized.hiddenRecommendedGames, saved.hiddenRecommendedGames);
  }
});
