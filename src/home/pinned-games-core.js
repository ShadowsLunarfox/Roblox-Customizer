(function (root) {
  'use strict';
  const STORAGE_KEY = 'pinnedGames';
  const FOLDERS_KEY = 'pinnedGameFolders';
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const validFolderId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
  const folderName = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';

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
      const game = {
        placeId: item.placeId, universeId: item.universeId,
        name: item.name.trim().slice(0, 200), iconUrl: iconUrl(item.iconUrl),
        updatedAt: Number.isFinite(item.updatedAt) && item.updatedAt > 0 ? item.updatedAt : 0
      };
      if (validFolderId(item.folderId)) game.folderId = item.folderId;
      if (Number.isFinite(item.checkedAt) && item.checkedAt > 0) game.checkedAt = item.checkedAt;
      games.push(game);
      universes.add(item.universeId);
    }
    return games;
  }

  function normalizeFolders(value) {
    const folders = [];
    const ids = new Set();
    for (const item of Array.isArray(value) ? value : []) {
      if (!item || !validFolderId(item.id) || !folderName(item.name) || ids.has(item.id)) continue;
      folders.push({ id: item.id, name: folderName(item.name) });
      ids.add(item.id);
    }
    return folders;
  }

  function state(games, folders) {
    folders = normalizeFolders(folders);
    const ids = new Set(folders.map(folder => folder.id));
    games = normalize(games);
    for (const game of games) if (!ids.has(game.folderId)) delete game.folderId;
    return { games, folders };
  }

  const core = Object.freeze({ STORAGE_KEY, FOLDERS_KEY, validId, validFolderId, folderName,
    iconUrl, normalize, normalizeFolders, state });
  root.RobloxCustomizerPinnedGames = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(globalThis);
