
(() => {
  'use strict';

  const ROOT_SELECTOR = '#HomeContainer .friend-carousel-container';
  const LIST_SELECTOR = '.react-friends-carousel-container :is(.friends-carousel-list-container, .friends-carousel-list-container-not-full)';
  const STORAGE_KEY = 'customBackground';
  const ROW_CACHE_KEY = 'roblox-customizer-friend-rows';
  const COLUMNS = 17;
  const boundedRows = value => {
    if (value == null || value === '') return 3;
    const rows = Number(value);
    return Number.isInteger(rows) ? Math.max(1, Math.min(3, rows)) : 3;
  };
  let maxRows = 3;
  try { maxRows = boundedRows(localStorage.getItem(ROW_CACHE_KEY)); } catch { /* Optional cache. */ }
  let current = null;
  let queued = false;

  function nativeTiles(list) {
    return Array.from(list.children).filter(child => child.matches('.friends-carousel-tile')
      || child.querySelector('.friends-carousel-tile'));
  }

  function clearCurrent() {
    if (!current) return;
    current.root.removeAttribute('data-rc-native-friends');
    current.list.removeAttribute('data-rc-native-friends-list');
    current.list.parentElement?.removeAttribute('data-rc-native-friends-viewport');
    for (const tile of nativeTiles(current.list)) {
      tile.removeAttribute('data-rc-native-friends-hidden');
      tile.removeAttribute('data-rc-native-friend-cell');
    }
    current = null;
  }

  function showFriends() {
    if (!current) return;
    const tiles = nativeTiles(current.list);
    tiles.forEach((tile, index) => {
      tile.setAttribute('data-rc-native-friend-cell', '');
      tile.toggleAttribute('data-rc-native-friends-hidden', index >= COLUMNS * maxRows);
    });
  }

  function setMaxRows(value) {
    const rows = boundedRows(value);
    if (rows === maxRows) return;
    maxRows = rows;
    try { localStorage.setItem(ROW_CACHE_KEY, String(rows)); } catch { /* Optional cache. */ }
    queueSync();
  }

  function sync() {
    const root = document.querySelector(ROOT_SELECTOR);
    const list = root?.querySelector(LIST_SELECTOR);
    if (!root || !list?.parentElement) {
      clearCurrent();
      return;
    }
    if (!current || current.root !== root || current.list !== list) {
      clearCurrent();
      current = { root, list };
      root.setAttribute('data-rc-native-friends', '');
      list.setAttribute('data-rc-native-friends-list', '');
      list.parentElement.setAttribute('data-rc-native-friends-viewport', '');
    }
    showFriends();
  }

  function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }

  new MutationObserver(records => {
    if (records.some(record =>
      !(record.target instanceof Element && record.target.closest('#rc-home-greeting')))) {
      queueSync();
    }
  }).observe(document, { childList: true, subtree: true });
  document.addEventListener('rc-friend-rows-changed', event => setMaxRows(event.detail?.rows));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      setMaxRows(changes[STORAGE_KEY].newValue?.friendRows);
    }
  });
  chrome.storage.local.get(STORAGE_KEY).then(result => {
    setMaxRows(result[STORAGE_KEY]?.friendRows);
  }).catch(() => {});
  queueSync();
})();
