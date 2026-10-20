/* Load one user-selected font without walking or rewriting page text. */
(() => {
  'use strict';
  if (globalThis.RobloxCustomizerFonts) return;
  const CACHE_KEY = 'roblox-customizer-font-v1';
  const FAMILY = 'Roblox Customizer Local';
  const MAX_BYTES = 32 * 1024 * 1024;
  const listeners = new Set();
  let preferences = { customFontEnabled: false, fontFileKey: '', fontFileName: '' };
  let signature = '';
  let generation = 0;
  let activeFace = null;
  let cachedFace = null;
  let loading = false;
  let error = '';
  let preferenceVersion = 0;

  function normalize(value = {}) {
    value = value && typeof value === 'object' ? value : {};
    const key = typeof value.fontFileKey === 'string' && /^[\w-]{1,100}$/.test(value.fontFileKey) ? value.fontFileKey : '';
    return { customFontEnabled: value.customFontEnabled === true && !!key, fontFileKey: key,
      fontFileName: typeof value.fontFileName === 'string' ? value.fontFileName.slice(0, 255) : '' };
  }
  function state() { return { ...preferences, loading, error }; }
  function notify() { for (const listener of listeners) listener(state()); }
  function render() {
    const root = document.documentElement;
    if (!root) return;
    const enabled = preferences.customFontEnabled && !!activeFace;
    root.toggleAttribute('data-rc-custom-font', enabled);
    const family = enabled ? `"${FAMILY}", system-ui, sans-serif` : '';
    if (root.style.getPropertyValue('--rc-website-font') !== family) {
      if (enabled) root.style.setProperty('--rc-website-font', family);
      else root.style.removeProperty('--rc-website-font');
    }
  }
  async function readFile(key) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('roblox-customizer-media', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('backgrounds');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('backgrounds', 'readonly');
        const read = transaction.objectStore('backgrounds').get(key);
        read.onsuccess = () => resolve(read.result);
        read.onerror = () => reject(read.error);
        transaction.oncomplete = transaction.onabort = () => db.close();
      };
    });
  }
  async function prepareFile(file) {
    if (!file || !/\.(?:ttf|otf|woff2?)$/i.test(file.name || '') || !file.size || file.size > MAX_BYTES) {
      throw new Error('Choose a TTF, OTF, WOFF, or WOFF2 font file up to 32 MB.');
    }
    try {
      const face = new FontFace(FAMILY, await file.arrayBuffer(), { display: 'swap' });
      return await face.load();
    } catch {
      throw new Error('This font file could not be loaded. Try another font file.');
    }
  }
  async function apply(value, force = false) {
    preferences = normalize(value);
    const next = JSON.stringify(preferences);
    if (!force && signature === next) { render(); return; }
    signature = next;
    const current = ++generation;
    error = '';
    try { localStorage.setItem(CACHE_KEY, next); } catch { /* Optional metadata cache. */ }
    if (!preferences.customFontEnabled) {
      loading = false;
      if (activeFace) document.fonts.delete(activeFace);
      activeFace = null;
      if (cachedFace?.key !== preferences.fontFileKey) cachedFace = null;
      render();
      notify();
      return;
    }
    loading = true;
    notify();
    const key = preferences.fontFileKey;
    try {
      let face = cachedFace?.key === key ? cachedFace.face : null;
      if (!face) {
        const file = await readFile(key);
        if (!file) throw new Error('Your saved font file is unavailable. Choose it again.');
        face = await prepareFile(file);
      }
      if (current !== generation) return;
      if (activeFace && activeFace !== face) document.fonts.delete(activeFace);
      activeFace = face;
      cachedFace = { key, face };
      document.fonts.add(face);
    } catch (failure) {
      if (current !== generation) return;
      error = failure.message || 'This font file could not be loaded. Try another font file.';
      if (activeFace) document.fonts.delete(activeFace);
      activeFace = null;
    }
    if (current !== generation) return;
    loading = false;
    render();
    notify();
  }

  globalThis.RobloxCustomizerFonts = Object.freeze({ normalize, prepareFile,
    apply(value) { preferenceVersion++; return apply(value); }, state, MAX_BYTES,
    cacheFile(key, face) { cachedFace = { key, face }; },
    onChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  });
  try { void apply(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')); } catch { /* Storage is optional. */ }
  const version = preferenceVersion;
  chrome.storage.local.get('customBackground').then(saved => {
    if (version === preferenceVersion) void apply(saved.customBackground || {});
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.customBackground) return;
    preferenceVersion++;
    void apply(changes.customBackground.newValue || {});
  });
  if (!document.documentElement) {
    const observer = new MutationObserver(() => {
      if (document.documentElement) { observer.disconnect(); render(); }
    });
    observer.observe(document, { childList: true });
  }
  document.addEventListener('DOMContentLoaded', render, { once: true });
  globalThis.RobloxCustomizerRuntime?.onResume(() => {
    if (error && preferences.customFontEnabled) void apply(preferences, true);
    else render();
  });
})();
