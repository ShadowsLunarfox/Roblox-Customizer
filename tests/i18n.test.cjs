const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/shared/i18n.js'), 'utf8');

function environment({ lang = '', metadata = '', browser = 'en-US', stored } = {}) {
  let deliver;
  const listeners = [];
  const document = {
    documentElement: { lang }, querySelector: () => metadata ? { getAttribute: () => metadata } : null,
    querySelectorAll: () => [], addEventListener() {}
  };
  const context = vm.createContext({ document, navigator: { language: browser }, console,
    MutationObserver: class { observe() {} }, setTimeout, clearTimeout, addEventListener() {},
    chrome: { i18n: { getUILanguage: () => browser }, storage: {
      onChanged: { addListener: fn => listeners.push(fn) },
      local: { get: () => new Promise(resolve => { deliver = resolve; }) }
    } }
  });
  vm.runInContext(source.replace('const exact =', 'globalThis.messages = messages; const exact ='), context);
  return { api: context.RobloxCustomizerI18n, messages: context.messages,
    deliver: () => deliver({ customBackground: stored }), listeners };
}

test('UI language follows Roblox metadata, Chinese script/region tags, and browser fallback', () => {
  for (const [options, expected] of [
    [{ lang: 'en', metadata: 'zh_tw' }, 'zh-TW'], [{ lang: 'zh-Hant-HK' }, 'zh-TW'],
    [{ lang: 'zh-Hans-SG' }, 'zh-CN'], [{ lang: 'zh-CN' }, 'zh-CN'],
    [{ lang: 'zh-MO' }, 'zh-TW'], [{ browser: 'zh-TW' }, 'zh-TW'], [{ lang: 'fr', browser: 'zh-CN' }, 'en']
  ]) assert.equal(environment(options).api.locale(), expected);
});

test('Chinese UI catalogs cover the same messages and preserve every placeholder', () => {
  const { api, messages } = environment();
  const keys = new Set();
  for (const row of messages) {
    assert.equal(row.length, 3); assert.equal(keys.has(row[0]), false, `Duplicate key: ${row[0]}`); keys.add(row[0]);
    const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const text of row.slice(1)) {
      assert.ok(text.trim()); assert.deepEqual(placeholders(text), placeholders(row[0]), row[0]);
    }
  }
  for (const locale of ['en', 'zh-CN', 'zh-TW']) {
    api.setLanguage(locale);
    assert.equal(api.t('An unknown error.'), 'An unknown error.');
    const name = '<img src=x onerror=alert(1)> $1';
    assert.ok(api.t('Hide {name} from recommendations', { name }).includes(name), 'Parameters remain plain text');
    assert.ok(api.t('1–8 of 18 matches loaded').includes('18'), 'Dynamic counts retain their values');
  }
});

test('Manual language selection survives late storage reads and can return to automatic mode', async () => {
  const { api, deliver, listeners } = environment({ lang: 'zh-TW', stored: { uiLanguage: 'en' } });
  api.setLanguage('zh-CN'); deliver(); await Promise.resolve();
  assert.equal(api.locale(), 'zh-CN'); assert.equal(api.t('Refresh'), '刷新');
  listeners[0]({ customBackground: { newValue: { uiLanguage: 'zh-TW' } } }, 'local');
  assert.equal(api.t('Refresh'), '重新整理');
  api.setLanguage('auto'); assert.equal(api.locale(), 'zh-TW');
  api.setLanguage('invalid'); assert.equal(api.preference(), 'auto');
});

test('Manifest translations provide complete English and both Chinese Chrome locales', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  const references = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map(match => match[1]);
  for (const locale of ['en', 'zh_CN', 'zh_TW']) {
    const messages = JSON.parse(fs.readFileSync(path.join(root, '_locales', locale, 'messages.json'), 'utf8'));
    for (const key of references) assert.ok(messages[key]?.message?.trim(), `${locale}/${key}`);
  }
});
