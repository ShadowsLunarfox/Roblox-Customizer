const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/shared/i18n.js'), 'utf8');

function environment({ lang = '', metadata = '', browser = 'en-US' } = {}) {
  let observe;
  const meta = { getAttribute: () => metadata, matches: () => true };
  const document = {
    documentElement: { lang }, querySelector: () => metadata ? meta : null,
    querySelectorAll: () => [], addEventListener() {}
  };
  const context = vm.createContext({ document, navigator: { language: browser }, console,
    MutationObserver: class { constructor(callback) { observe = callback; } observe() {} },
    setTimeout, clearTimeout, addEventListener() {}, chrome: {
      i18n: { getUILanguage: () => browser },
      storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } }
    }
  });
  vm.runInContext(source, context);
  return { api: context.RobloxCustomizerI18n,
    changeLanguage(value) {
      metadata = value;
      observe([{ type: 'attributes', target: meta }]);
    }
  };
}

test('Language support recognizes English and both Chinese variants without treating fallback English as support', () => {
  for (const language of ['en', 'en-US', ' EN_gb ', 'zh', 'zh_CN', 'zh-TW', 'zh-Hans-SG', 'zh-Hant-HK', 'zh-MO', 'id', 'id-ID', ' ID_id ']) {
    const { api } = environment({ lang: language });
    assert.equal(api.isSupportedLanguage(api.robloxLanguage()), true, language);
  }
  for (const language of ['fr', 'pt-BR', 'es_ES', 'de-DE', 'ja', 'ko-KR', 'ms', 'english', 'zhongwen']) {
    const { api } = environment({ lang: language, browser: 'zh-CN' });
    assert.equal(api.locale(), 'en', language);
    assert.equal(api.isSupportedLanguage(api.robloxLanguage()), false, language);
    api.setLanguage('zh-TW');
    assert.equal(api.isSupportedLanguage(api.robloxLanguage()), false, `${language}: manual UI override`);
  }
});

test('Roblox language uses page metadata before HTML and never substitutes the browser language', () => {
  assert.equal(environment({ lang: 'en', metadata: ' fr_FR ', browser: 'zh-CN' }).api.robloxLanguage(), 'fr_FR');
  assert.equal(environment({ lang: 'zh-TW', metadata: ' ' }).api.robloxLanguage(), 'zh-TW');
  const { api } = environment({ browser: 'fr-FR' });
  assert.equal(api.robloxLanguage(), '');
  assert.equal(api.isSupportedLanguage(''), false);
});

test('Roblox language changes are observable even while the extension UI stays in English', () => {
  const { api, changeLanguage } = environment({ lang: 'en', metadata: 'fr' });
  api.setLanguage('en');
  const changes = [];
  let uiChanges = 0;
  api.onChange(() => uiChanges++);
  const unsubscribe = api.onRobloxLanguageChange(language => changes.push(language));
  changeLanguage('es');
  changeLanguage('es');
  changeLanguage('zh-CN');
  changeLanguage('');
  assert.deepEqual(changes, ['es', 'zh-CN', 'en']);
  assert.equal(uiChanges, 0);
  unsubscribe();
  changeLanguage('ja');
  assert.equal(changes.length, 3);
});
