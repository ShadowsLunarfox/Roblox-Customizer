(function (root) {
  'use strict';
  const STORAGE_KEY = 'pinnedGames';
  const LIMIT = 10;
  const validId = value => Number.isSafeInteger(value) && value > 0;

  function iconUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /^(?:[a-z0-9-]+\.)?rbxcdn\.com$/i.test(url.hostname)
        && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function normalize(value) {
    const games = [];
    const universes = new Set();
    for (const item of Array.isArray(value) ? value : []) {
      if (!item || !validId(item.placeId) || !validId(item.universeId)
        || typeof item.name !== 'string' || !item.name.trim() || universes.has(item.universeId)) continue;
      games.push({
        placeId: item.placeId, universeId: item.universeId,
        name: item.name.trim().slice(0, 200), iconUrl: iconUrl(item.iconUrl),
        updatedAt: Number.isFinite(item.updatedAt) && item.updatedAt > 0 ? item.updatedAt : 0
      });
      universes.add(item.universeId);
      if (games.length === LIMIT) break;
    }
    return games;
  }

  const core = Object.freeze({ STORAGE_KEY, LIMIT, validId, iconUrl, normalize });
  root.RobloxCustomizerPinnedGames = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(globalThis);
