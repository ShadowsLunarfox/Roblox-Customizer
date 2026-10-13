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
