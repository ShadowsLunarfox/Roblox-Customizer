const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/shared/compatibility.js'), 'utf8');

function environment({ lang = 'en', metadata = '', complete = false, saved = {} } = {}) {
  let observer;
  let reloads = 0;
  const events = new Map(), attributes = new Map(), writes = [];
  const root = { lang, getAttribute: key => attributes.get(key), hasAttribute: key => attributes.has(key),
    setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key), matches: () => true };
  const meta = { getAttribute: () => metadata, matches: () => true };
  const document = { documentElement: root, readyState: complete ? 'complete' : 'loading',
    querySelector: () => metadata ? meta : null, addEventListener: (key, fn) => events.set(key, fn), dispatchEvent() {} };
  const storage = { async get() { return { ...saved }; }, async set(patch) { writes.push(patch); Object.assign(saved, patch); },
    async remove(key) { writes.push({ removed: key }); delete saved[key]; } };
  const context = vm.createContext({ document, console, chrome: { storage: { local: storage } },
    CustomEvent: class {}, addEventListener() {}, MutationObserver: class { constructor(fn) { observer = fn; } observe() {} },
    location: { reload() { reloads++; } } });
  vm.runInContext(source, context);
  return { api: context.RobloxCustomizerCompatibility, writes, saved,
    get reloads() { return reloads; },
    async settle() { for (let i = 0; i < 50; i++) await Promise.resolve(); },
    metadata(value) { metadata = value; observer([{ type: 'attributes', target: meta }]); },
    complete() { document.readyState = 'complete'; events.get('DOMContentLoaded')(); }
  };
}

test('Native enhancements wait for Roblox metadata instead of trusting an early English HTML tag', async () => {
  const env = environment();
  let started = 0;
  env.api.runFeature(() => started++);
  assert.equal(env.api.enabled(), false);
  env.metadata('fr-FR');
  env.complete();
  await env.settle();
  assert.equal(env.api.fallback(), true);
  assert.equal(started, 0);
  assert.equal(env.saved.robloxCustomizerUnsupportedLanguage, 'fr-FR');
  assert.equal(env.reloads, 0, 'An initial unsupported page needs no reload');
});

test('Supported locales start deferred features once and fresh installations do not write flags', async () => {
  for (const metadata of ['en-US', 'zh_CN', 'zh-Hant-HK']) {
    const env = environment();
    let started = 0;
    env.api.runFeature(() => started++);
    env.metadata(metadata);
    env.metadata(metadata);
    env.complete();
    await env.settle();
    assert.equal(env.api.enabled(), true);
    assert.equal(started, 1);
    assert.equal(env.writes.length, 0);
  }
});

test('Crossing the support boundary saves pending work and reloads once to clear native UI changes', async () => {
  const env = environment({ metadata: 'en' });
  let savedBeforeReload = false;
  env.api.onBeforeReload(async () => { savedBeforeReload = true; });
  env.metadata('ja');
  env.metadata('ja');
  await env.settle();
  assert.equal(savedBeforeReload, true);
  assert.equal(env.api.reloading(), true);
  assert.equal(env.api.enabled(), false);
  assert.equal(env.reloads, 1);
  assert.equal(env.saved.robloxCustomizerUnsupportedLanguage, 'ja');
});

test('Returning to a supported language clears fallback tracking without starting stale page hooks', async () => {
  const env = environment({ metadata: 'de', saved: { robloxCustomizerUnsupportedLanguage: 'de' } });
  let started = 0;
  env.api.runFeature(() => started++);
  env.metadata('zh-TW');
  await env.settle();
  assert.equal(started, 0);
  assert.equal(env.reloads, 1);
  assert.equal(env.saved.robloxCustomizerUnsupportedLanguage, undefined);
});

test('The browser toolbar opens settings without needing permission to read the tab URL', async () => {
  let click;
  const sent = [];
  const worker = fs.readFileSync(path.join(__dirname, '../src/background/service-worker.js'), 'utf8');
  vm.runInNewContext(worker, { URL, AbortController, setTimeout, clearTimeout, chrome: {
    action: { onClicked: { addListener(fn) { click = fn; } } },
    tabs: { async sendMessage(id, message, options) { sent.push({ id, message: { ...message }, options: { ...options } }); } },
    runtime: { onMessage: { addListener() {} } }
  } });
  click({ id: 42 });
  await Promise.resolve();
  assert.deepEqual(sent, [{ id: 42, message: { type: 'rc-open-settings' }, options: { frameId: 0 } }]);
});
