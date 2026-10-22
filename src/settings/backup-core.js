(function (root) {
  'use strict';
  const FORMAT = 'roblox-customizer-backup';
  const VERSION = 1;
  const MAX_BYTES = 256 * 1024 * 1024;
  const KEYS = Object.freeze(['customBackground', 'robuxCurrency', 'pinnedGames',
    'pinnedGameFolders', 'playtimeTrackingEnabled', 'rcPlaytimeHistory', 'rcGameNotes', 'rcPinnedFriends']);
  const fail = () => { throw new Error('Invalid backup file. No data was imported.'); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const count = value => Number.isSafeInteger(value) && value >= 0;
  function jsonValue(value, depth = 0) {
    if (depth > 32) fail();
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) { value.forEach(item => jsonValue(item, depth + 1)); return; }
    if (!object(value)) fail();
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
      jsonValue(item, depth + 1);
    }
  }
  function background(value) {
    if (!object(value)) fail();
    const settings = { ...value };
    delete settings._writer;
    for (const key of ['streamerMode', 'streamerHideRobux', 'streamerHideFriends', 'streamerHideMessages']) delete settings[key];
    const options = { source: ['none', 'file', 'url'], fit: ['cover', 'contain'],
      urlType: ['auto', 'image', 'video'], uiLanguage: ['auto', 'en', 'zh-CN', 'zh-TW', 'id', 'ja', 'th', 'ko'] };
    for (const [key, allowed] of Object.entries(options)) {
      if (key in settings && !allowed.includes(settings[key])) fail();
    }
    // Preserve row counts saved by older versions; the current UI bounds them.
    for (const [key, min, max] of [['dim',0,80], ['glassBlur',0,40], ['glassOpacity',25,90], ['friendRows',1,100]]) {
      if (key in settings && (!Number.isFinite(settings[key]) || settings[key] < min || settings[key] > max)) fail();
    }
    for (const [key, item] of Object.entries(settings)) {
      if (/^(?:hide|show|disable|clockShow|clockHour)|^(?:experimentalCustomColors|customFontEnabled)$/.test(key)
        && key !== 'hiddenRecommendedGames' && typeof item !== 'boolean') fail();
      if (/^custom(?:Text|Background|Accent)Color$/.test(key) && !/^#[0-9a-f]{6}$/i.test(item)) fail();
      if (['url','fileKey','fileName','fontFileKey','fontFileName','greetingMorning','greetingAfternoon','greetingEvening'].includes(key)
        && typeof item !== 'string') fail();
    }
    if (settings.fileKey && settings.fileKey.length > 100) fail();
    if (settings.source === 'file' && !settings.fileKey) fail();
    if (settings.fontFileKey && (!/^[\w-]{1,100}$/.test(settings.fontFileKey)
      || settings.fontFileKey === settings.fileKey || typeof settings.fontFileName !== 'string'
      || settings.fontFileName.length > 255 || !/\.(?:ttf|otf|woff2?)$/i.test(settings.fontFileName))) fail();
    if (settings.customFontEnabled === true && !settings.fontFileKey) fail();
    if (settings.source === 'url') {
      try { if (!['http:', 'https:'].includes(new URL(settings.url).protocol)) fail(); } catch { fail(); }
    }
    if ('hiddenRecommendedGames' in settings && (!Array.isArray(settings.hiddenRecommendedGames)
      || settings.hiddenRecommendedGames.some(game => !object(game) || !/^\d+$/.test(String(game.placeId))
        || typeof game.name !== 'string'))) fail();
    return settings;
  }
  function data(value) {
    jsonValue(value);
    // Notes and friend pins were added later; older version 1 files contain neither.
    if (!object(value) || KEYS.some(key => !['rcGameNotes', 'rcPinnedFriends'].includes(key) && !Object.hasOwn(value, key))
      || Object.keys(value).some(key => !KEYS.includes(key) && key !== 'rcServerLocation')) fail();
    if (typeof value.playtimeTrackingEnabled !== 'boolean' || !object(value.robuxCurrency)
      || typeof value.robuxCurrency.enabled !== 'boolean'
      || !root.RobloxCustomizerCurrencyCore.CURRENCIES.includes(value.robuxCurrency.currency)) fail();
    if (!Array.isArray(value.pinnedGames) || !Array.isArray(value.pinnedGameFolders)) fail();
    const pins = root.RobloxCustomizerPinnedGames.state(value.pinnedGames, value.pinnedGameFolders);
    if (pins.games.length !== value.pinnedGames.length || pins.folders.length !== value.pinnedGameFolders.length
      || value.pinnedGames.some(game => game.folderId && !pins.folders.some(folder => folder.id === game.folderId))) fail();
    const history = value.rcPlaytimeHistory;
    if (!object(history) || history.version !== 1 || !Array.isArray(history.accounts)) fail();
    const cleanHistory = root.RobloxCustomizerPlaytime.normalize(history);
    if (history.accounts.length !== cleanHistory.accounts.length) fail();
    for (const account of history.accounts) {
      const clean = cleanHistory.accounts.find(item => item.userId === account.userId);
      if (!Array.isArray(account.games) || clean.games.length !== account.games.length) fail();
      for (const game of account.games) {
        if (!count(game.totalMs) || !count(game.sessions)
          || ['firstPlayedAt','lastPlayedAt','metadataCheckedAt'].some(key => !count(game[key]) || game[key] > 8640000000000000)) fail();
      }
    }
    // A backup is history, never permission to continue an old timing sample.
    cleanHistory.active = null;
    cleanHistory.status = { kind: value.playtimeTrackingEnabled ? 'idle' : 'disabled', checkedAt: 0 };
    let notes;
    try { notes = value.rcGameNotes === undefined ? root.RobloxCustomizerGameNotes.normalize(null)
      : root.RobloxCustomizerGameNotes.validate(value.rcGameNotes); } catch { fail(); }
    let friendPins;
    try { friendPins = value.rcPinnedFriends === undefined ? root.RobloxCustomizerPinnedFriends.normalize(null)
      : root.RobloxCustomizerPinnedFriends.validate(value.rcPinnedFriends); } catch { fail(); }
    // Ignore legacy saved server selections; filters now exist only on the page.
    return { customBackground: background(value.customBackground),
      robuxCurrency: root.RobloxCustomizerCurrencyCore.normalizeSettings(value.robuxCurrency),
      pinnedGames: pins.games, pinnedGameFolders: pins.folders,
      playtimeTrackingEnabled: value.playtimeTrackingEnabled, rcPlaytimeHistory: cleanHistory,
      rcGameNotes: notes, rcPinnedFriends: friendPins };
  }
  function snapshot(saved) {
    const pins = root.RobloxCustomizerPinnedGames.state(saved.pinnedGames, saved.pinnedGameFolders);
    return data({ customBackground: saved.customBackground || {},
      robuxCurrency: root.RobloxCustomizerCurrencyCore.normalizeSettings(saved.robuxCurrency),
      pinnedGames: pins.games,
      pinnedGameFolders: pins.folders,
      playtimeTrackingEnabled: saved.playtimeTrackingEnabled !== false,
      rcPlaytimeHistory: root.RobloxCustomizerPlaytime.normalize(saved.rcPlaytimeHistory),
      rcGameNotes: root.RobloxCustomizerGameNotes.normalize(saved.rcGameNotes),
      rcPinnedFriends: root.RobloxCustomizerPinnedFriends.normalize(saved.rcPinnedFriends) });
  }
  function validate(value) {
    if (!object(value) || value.format !== FORMAT) fail();
    if (value.version !== VERSION) throw new Error('This backup version is not supported. No data was imported.');
    const clean = data(value.data);
    const media = value.media;
    if (clean.customBackground.fileKey) {
      if (!object(media) || media.key !== clean.customBackground.fileKey || typeof media.name !== 'string'
        || !/^(?:image\/[a-z0-9.+-]+|video\/mp4)$/i.test(media.type)
        || typeof media.base64 !== 'string' || media.base64.length % 4
        || !/^[A-Za-z0-9+/]*={0,2}$/.test(media.base64) || !count(media.size)
        || media.size !== media.base64.length / 4 * 3 - (media.base64.endsWith('==') ? 2 : media.base64.endsWith('=') ? 1 : 0)
        || !count(media.lastModified)) fail();
    } else if (media !== null) fail();
    const font = value.font ?? null;
    if (clean.customBackground.fontFileKey) {
      if (!object(font) || font.key !== clean.customBackground.fontFileKey || typeof font.name !== 'string'
        || font.name !== clean.customBackground.fontFileName || !/^font\/(?:ttf|otf|woff2?)$/.test(font.type)
        || typeof font.base64 !== 'string' || font.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(font.base64)
        || !count(font.size) || !font.size || font.size > 32 * 1024 * 1024
        || font.size !== font.base64.length / 4 * 3 - (font.base64.endsWith('==') ? 2 : font.base64.endsWith('=') ? 1 : 0)
        || !count(font.lastModified)) fail();
    } else if (font !== null) fail();
    return { format: FORMAT, version: VERSION, createdAt: value.createdAt,
      extensionVersion: value.extensionVersion, data: clean, media, font };
  }
  const api = Object.freeze({ FORMAT, VERSION, MAX_BYTES, KEYS, data, snapshot, validate });
  root.RobloxCustomizerBackup = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
