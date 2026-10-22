const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const workspace = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(workspace, 'manifest.json'), 'utf8'));
const extensionURL = new URL('https://extension.invalid/');

function assetFile(url) {
  assert.equal(url.origin, extensionURL.origin, 'Extension assets are local');
  const file = path.resolve(workspace, '.' + decodeURIComponent(url.pathname));
  const relative = path.relative(workspace, file);
  assert.ok(relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative),
    'Extension assets stay inside the package');
  assert.ok(fs.statSync(file).isFile(), `${relative} is a packaged file`);
  return file;
}

test('Manifest assets exist and declared JavaScript parses from the unpacked package', () => {
  const icons = value => typeof value === 'string' ? [value] : Object.values(value || {});
  const scripts = manifest.content_scripts.flatMap(entry => entry.js || []);
  const resources = [manifest.background.service_worker, ...scripts,
    ...manifest.content_scripts.flatMap(entry => entry.css || []),
    ...icons(manifest.icons), ...icons(manifest.action.default_icon),
    ...manifest.web_accessible_resources.flatMap(entry => entry.resources)];
  for (const resource of new Set(resources)) {
    const file = assetFile(new URL(resource, extensionURL));
    if (resource.endsWith('.js')) new vm.Script(fs.readFileSync(file, 'utf8'), { filename: resource });
  }
});

test('The first top-level document-start entry gates native UI before heavier enhancements', () => {
  const first = manifest.content_scripts[0];
  assert.equal(first.run_at, 'document_start');
  assert.notEqual(first.all_frames, true);
  assert.deepEqual(first.css, ['src/shared/startup.css']);
  assert.deepEqual(first.js, ['src/shared/routes.js', 'src/shared/compatibility.js',
    'src/shared/dialogs.js', 'src/shared/avatar-diagnostics.js', 'src/shared/startup.js']);
  assert.equal(manifest.content_scripts.flatMap(entry => entry.js || []).filter(file => file === 'src/shared/startup.js').length, 1);
});

test('Service worker is bundled from current sources without startup script imports', () => {
  const workerURL = new URL(manifest.background.service_worker, extensionURL);
  const source = fs.readFileSync(assetFile(workerURL), 'utf8');
  assert.equal(source, require('../scripts/build-service-worker.cjs').build());
  assert.doesNotMatch(source, /\bimportScripts\s*\(/);
  for (let reload = 0; reload < 10; reload++) {
    const handlers = [];
    const context = vm.createContext({
      URL, URLSearchParams, AbortController, TextDecoder, TextEncoder, atob, btoa,
      setTimeout, clearTimeout,
      fetch() { assert.fail('Worker startup must not fetch data'); },
      chrome: { runtime: { id: 'extension-test', onMessage: {
        addListener(handler) { assert.equal(typeof handler, 'function'); handlers.push(handler); }
      } } }
    });
    context.importScripts = () => assert.fail('Bundled worker should not import scripts at startup');
    vm.runInContext(source, context, { filename: workerURL.pathname });
    assert.equal(typeof context.RobloxCustomizerCurrencyCore.convert, 'function');
    assert.equal(typeof context.RobloxCustomizerPinnedGames.normalize, 'function');
    assert.equal(typeof context.RobloxCustomizerBackup.validate, 'function');
    assert.equal(typeof context.RobloxCustomizerPlaytimeBackground.withStorageLock, 'function');
    assert.equal(typeof context.RobloxCustomizerPinnedGamesBackground.withStorageLock, 'function');
    assert.ok(handlers.length >= 3, 'Currency, pinned games, and Roblox data handlers initialize');
  }
});

test('MAIN bridge packages its own route and compatibility dependencies', () => {
  const entry = manifest.content_scripts.find(entry => entry.world === 'MAIN');
  assert.deepEqual(entry.js, ['src/shared/page-bridge-bundle.js']);
  const source = fs.readFileSync(assetFile(new URL(entry.js[0], extensionURL)), 'utf8');
  assert.equal(source, require('../scripts/build-page-bridge.cjs').build());
  const isolated = new Set(manifest.content_scripts.filter(entry => entry.world !== 'MAIN').flatMap(entry => entry.js || []));
  assert.ok(entry.js.every(file => !isolated.has(file)), 'Chrome de-duplicates shared files across worlds');
  const context = vm.createContext({ window: {}, location: { pathname: '/id/games/4623386862/Piggy' },
    document: { documentElement: null, querySelector() { return null; }, addEventListener() {} },
    MutationObserver: class { observe() {} }, addEventListener() {}, URL, setTimeout, clearTimeout });
  vm.runInContext(source, context);
  assert.equal(context.RobloxCustomizerRoutes.pathname(), '/games/4623386862/Piggy');
  assert.equal(typeof context.RobloxCustomizerCompatibility.runFeature, 'function');
});
