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
    [{ lang: 'zh-MO' }, 'zh-TW'], [{ browser: 'zh-TW' }, 'zh-TW'], [{ lang: 'fr', browser: 'zh-CN' }, 'en'],
    [{ lang: 'en', metadata: 'id_id' }, 'id'], [{ lang: 'id-ID' }, 'id'], [{ browser: 'id' }, 'id'],
    [{ lang: 'en', metadata: 'ja_jp' }, 'ja'], [{ lang: 'ja-JP' }, 'ja'], [{ browser: 'ja' }, 'ja'],
    [{ lang: 'en', metadata: 'th_th' }, 'th'], [{ lang: 'th-TH' }, 'th'], [{ browser: 'th' }, 'th'],
    [{ lang: 'en', metadata: 'ko_kr' }, 'ko'], [{ lang: 'ko-KR' }, 'ko'], [{ browser: 'ko' }, 'ko']
  ]) assert.equal(environment(options).api.locale(), expected);
});

test('Every supported UI catalog covers each message and preserves placeholders', () => {
  const { api, messages } = environment();
  const keys = new Set();
  for (const row of messages) {
    assert.equal(row.length, 7); assert.equal(keys.has(row[0]), false, `Duplicate key: ${row[0]}`); keys.add(row[0]);
    const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    for (const text of row.slice(1)) {
      assert.ok(text.trim()); assert.deepEqual(placeholders(text), placeholders(row[0]), row[0]);
    }
  }
  for (const locale of ['en', 'zh-CN', 'zh-TW', 'id', 'ja', 'th', 'ko']) {
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

test('Manifest translations provide every supported Chrome locale', () => {
  const root = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.equal(manifest.default_locale, 'en');
  const references = [...JSON.stringify(manifest).matchAll(/__MSG_(\w+)__/g)].map(match => match[1]);
  for (const locale of ['en', 'zh_CN', 'zh_TW', 'id', 'ja', 'th', 'ko']) {
    const messages = JSON.parse(fs.readFileSync(path.join(root, '_locales', locale, 'messages.json'), 'utf8'));
    for (const key of references) assert.ok(messages[key]?.message?.trim(), `${locale}/${key}`);
  }
});

test('Japanese, Thai and Korean legal documents cover every source section and generated documents are current', () => {
  const root = path.join(__dirname, '..');
  const content = JSON.parse(fs.readFileSync(path.join(root, 'src/legal/content.json'), 'utf8'));
  assert.equal(content.locales.ja.name, '日本語');
  assert.equal(content.locales.th.name, 'ไทย');
  assert.equal(content.locales.ko.name, '한국어');
  for (const locale of ['ja', 'th', 'ko']) for (const type of ['privacy', 'terms']) {
    const translated = content.locales[locale][type];
    assert.ok(translated.title && translated.intro);
    assert.equal(translated.sections.length, content.locales.en[type].sections.length);
    translated.sections.forEach((section, index) => {
      assert.ok(section.heading);
      for (const key of ['paragraphs', 'items']) {
        assert.equal((section[key] || []).length, (content.locales.en[type].sections[index][key] || []).length);
        for (const text of section[key] || []) assert.ok(text.trim());
      }
    });
  }
  for (const locale of ['zh-CN', 'zh-TW', 'ja', 'th', 'ko']) {
    assert.doesNotMatch(content.locales[locale].privacy.sections[1].paragraphs.at(-1), /\?{3,}/,
      'Friend tools policy text must retain its original Unicode characters');
  }
  for (const [file, expected] of Object.entries(require('../scripts/build-legal-docs.cjs').build())) {
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), expected, file);
  }
});
