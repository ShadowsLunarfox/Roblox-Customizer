/* Run in both extension and page contexts, before any native UI enhancements. */
(() => {
  'use strict';
  if (globalThis.RobloxCustomizerCompatibility) return;
  const STORAGE_KEY = 'robloxCustomizerUnsupportedLanguage';
  const features = new Set();
  const beforeReload = new Set();
  const storage = globalThis.chrome?.storage?.local;
  let state = 'pending';
  let reloadQueued = false;
  let storedLanguage;
  let persistence = storage ? storage.get(STORAGE_KEY).then(result => {
    storedLanguage = result[STORAGE_KEY];
  }).catch(() => {}) : Promise.resolve();

  function persist(language) {
    if (!storage || globalThis.top && globalThis.top !== globalThis) return persistence;
    persistence = persistence.then(async () => {
      if (language === storedLanguage) return;
      if (language) await storage.set({ [STORAGE_KEY]: language });
      else if (storedLanguage) await storage.remove(STORAGE_KEY);
      storedLanguage = language;
    }).catch(error => console.warn('Roblox Customizer: Could not save language compatibility.', error));
    return persistence;
  }

  function sync() {
    const root = document.documentElement;
    if (!root) return;
    const metadata = document.querySelector('meta[name="locale-data"]')?.getAttribute('data-language-code')?.trim();
    // Roblox can emit html lang="en" before its actual locale metadata arrives.
    const language = metadata || (document.body || document.readyState !== 'loading' ? root.lang?.trim() : '');
    const next = !language && document.readyState === 'loading' ? 'pending'
      : language && !/^(?:en|zh|id|ja|th|ko)(?:-|$)/i.test(language.replaceAll('_', '-')) ? 'fallback' : 'full';
    const previous = state;
    const changed = root.getAttribute('data-rc-compatibility') !== next;
    state = next;
    if (changed) root.setAttribute('data-rc-compatibility', next);
    if (next !== 'pending') persist(next === 'fallback' ? language : undefined);
    if (previous !== 'pending' && next !== 'pending' && previous !== next) {
      // React hooks, moved native elements and inline layout changes require a
      // fresh Roblox document to restore the original UI completely.
      root.setAttribute('data-rc-compatibility-reloading', '');
      if (storage && !reloadQueued) {
        reloadQueued = true;
        void Promise.allSettled([...beforeReload].map(callback => Promise.resolve().then(callback)))
          .then(() => persistence).then(() => location.reload());
      }
    }
    if (next !== 'full' || root.hasAttribute('data-rc-compatibility-reloading')) root.setAttribute('data-rc-features-disabled', '');
    else root.removeAttribute('data-rc-features-disabled');
    if (changed) document.dispatchEvent(new CustomEvent('rc-compatibility-changed'));
    if (next === 'full' && !root.hasAttribute('data-rc-compatibility-reloading')) {
      for (const initialize of features) {
        features.delete(initialize);
        initialize();
      }
    }
  }

  globalThis.RobloxCustomizerCompatibility = Object.freeze({
    enabled: () => state === 'full' && !document.documentElement?.hasAttribute('data-rc-compatibility-reloading'),
    fallback: () => state === 'fallback',
    reloading: () => !!document.documentElement?.hasAttribute('data-rc-compatibility-reloading'),
    onBeforeReload(callback) { beforeReload.add(callback); return () => beforeReload.delete(callback); },
    runFeature(initialize) {
      features.add(initialize);
      sync();
    }
  });
  new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' && (record.target === document.documentElement
      || record.target.matches('meta[name="locale-data"]'))
      || record.type === 'childList' && [...record.addedNodes, ...record.removedNodes].some(node =>
        node.nodeType === 1 && (node.matches('html, body, meta[name="locale-data"]')
          || node.querySelector('meta[name="locale-data"]'))))) sync();
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['lang', 'data-language-code'] });
  document.addEventListener('DOMContentLoaded', sync, { once: true });
  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) storedLanguage = changes[STORAGE_KEY].newValue;
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
  addEventListener('pageshow', sync);
  addEventListener('focus', sync);
  sync();
})();
