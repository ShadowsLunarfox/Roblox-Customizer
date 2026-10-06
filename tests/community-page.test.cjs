const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'startup.js'), 'utf8');

function harness(pathname, script = source) {
  const attributes = new Map();
  const root = {
    dataset: {}, style: { setProperty() {} },
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
  const location = { pathname, hash: '#!/about' };
  const context = {
    location, document: { documentElement: root, readyState: 'complete',
      addEventListener() {}, querySelector() { return null; } },
    localStorage: { getItem() { return null; }, setItem() {} },
    MutationObserver: class { observe() {} },
    addEventListener(name, callback) { events.set(name, callback); },
    setTimeout() { return 1; }, clearTimeout() {}
  };
  vm.runInNewContext(script, context, { filename: 'community route bootstrap' });
  return { root, location, events, startup: context.RobloxCustomizerStartup };
}

test('the Badimo community route is marked before page widgets render', () => {
  const { root, startup } = harness('/communities/3059674/Badimo');
  assert.equal(root.dataset.rcFrostPage, 'community');
  startup.setPreferences({ source: 'url', url: 'https://example.com/wallpaper.jpg',
    glassOpacity: 62, glassBlur: 18 });
  assert.equal(root.hasAttribute('data-rc-background-active'), true);
});

test('legacy group links and community hash-tab navigation keep the same styling', () => {
  const { root, location, events } = harness('/groups/3059674/Badimo');
  assert.equal(root.dataset.rcFrostPage, 'community');
  location.pathname = '/communities/3059674/Badimo';
  for (const hash of ['#!/about', '#!/store', '#!/affiliates']) {
    location.hash = hash;
    events.get('hashchange')();
    assert.equal(root.dataset.rcFrostPage, 'community');
  }
});

test('leaving a community removes its marker and community directories stay unmarked', () => {
  const { root, location, events } = harness('/communities/3059674/Badimo');
  location.pathname = '/home';
  events.get('popstate')();
  assert.equal(root.hasAttribute('data-rc-frost-page'), false);
  for (const route of ['/communities', '/communities/search', '/groups/search']) {
    assert.equal(harness(route).root.dataset.rcFrostPage, undefined);
  }
});

test('community search and creation routes receive separate appearance markers before rendering', () => {
  for (const route of ['/search/communities', '/search/communities/', '/search/groups']) {
    const { root, startup } = harness(route);
    assert.equal(root.dataset.rcFrostPage, 'community-search');
    startup.setPreferences({ source: 'url', url: 'https://example.com/wallpaper.jpg' });
    assert.equal(root.hasAttribute('data-rc-background-active'), true);
  }
  for (const route of ['/communities/create', '/communities/create/', '/groups/create']) {
    assert.equal(harness(route).root.dataset.rcFrostPage, 'community-create');
  }
});

test('navigation updates search, creation, and community-detail styling without stale page markers', () => {
  const { root, location, events } = harness('/search/communities');
  for (const [route, marker] of [
    ['/communities/create', 'community-create'],
    ['/communities/3059674/Badimo', 'community'],
    ['/search/communities', 'community-search'],
    ['/home', undefined]
  ]) {
    location.pathname = route;
    events.get('popstate')();
    assert.equal(root.dataset.rcFrostPage, marker);
  }
  for (const route of ['/search/users', '/search/communities-extra', '/search/communities/other',
    '/communities/create-extra', '/communities/create/other', '/communities/configure']) {
    assert.equal(harness(route).root.dataset.rcFrostPage, undefined);
  }
});

test('the settings fallback recognizes the same search and creation routes when startup is unavailable', () => {
  const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'settings.js'), 'utf8');
  const start = settingsSource.indexOf('  function syncFrostPage()');
  const end = settingsSource.indexOf('  function openDatabase()', start);
  assert.ok(start >= 0 && end > start);
  const fallback = settingsSource.slice(start, end);
  for (const route of ['/search/communities', '/search/groups', '/communities/create', '/groups/create',
    '/communities/3059674/Badimo', '/search/users']) {
    assert.equal(harness(route, fallback).root.dataset.rcFrostPage, harness(route).root.dataset.rcFrostPage);
  }
});
