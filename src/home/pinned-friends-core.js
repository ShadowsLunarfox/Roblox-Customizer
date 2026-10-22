(function (root) {
  'use strict';
  const STORAGE_KEY = 'rcPinnedFriends';
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const text = value => typeof value === 'string' ? value.trim().slice(0, 100) : '';
  function imageUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /^(?:[a-z0-9-]+\.)?rbxcdn\.com$/i.test(url.hostname)
        && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function friends(value) {
    const result = [], seen = new Set();
    for (const item of Array.isArray(value) ? value : []) {
      if (!validId(item?.userId) || seen.has(item.userId)) continue;
      seen.add(item.userId);
      result.push({ userId: item.userId, name: text(item.name), displayName: text(item.displayName),
        imageUrl: imageUrl(item.imageUrl) });
    }
    return result;
  }
  function filter(items, options = {}) {
    const query = String(options.query || '').trim().toLocaleLowerCase();
    const pins = new Set((options.pins || []).map(item => item.userId));
    const presence = id => options.presences?.[id];
    const result = items.filter(item => (!query || `${item.displayName} ${item.name} ${item.userId}`.toLocaleLowerCase().includes(query))
      && (!options.status || options.status === 'all' || (options.status === 'pinned' ? pins.has(item.userId)
        : options.status === 'online' ? presence(item.userId) > 0
        : options.status === 'ingame' ? presence(item.userId) === 2
        : options.status === 'offline' ? presence(item.userId) === 0 : presence(item.userId) === 3)));
    const name = (a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name, undefined, { numeric: true }) || a.userId - b.userId;
    if (options.sort === 'name') result.sort(name);
    else if (options.sort === 'username') result.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }) || a.userId - b.userId);
    else if (options.sort === 'online') result.sort((a, b) => (presence(b.userId) > 0 ? 1 : 0) - (presence(a.userId) > 0 ? 1 : 0) || name(a, b));
    else if (options.sort === 'pinned') result.sort((a, b) => Number(pins.has(b.userId)) - Number(pins.has(a.userId)) || name(a, b));
    return result;
  }
  function normalize(value) {
    const accounts = [], seen = new Set();
    for (const account of value?.version === 1 && Array.isArray(value.accounts) ? value.accounts : []) {
      if (!validId(account?.userId) || seen.has(account.userId)) continue;
      seen.add(account.userId);
      accounts.push({ userId: account.userId, friends: friends(account.friends) });
    }
    return { version: 1, accounts };
  }
  function validate(value) {
    const clean = normalize(value);
    if (value?.version !== 1 || !Array.isArray(value.accounts) || clean.accounts.length !== value.accounts.length
      || value.accounts.some((account, index) => !Array.isArray(account.friends)
        || account.friends.length !== clean.accounts[index].friends.length
        || account.friends.some(item => typeof item.name !== 'string' || typeof item.displayName !== 'string'
          || typeof item.imageUrl !== 'string' || item.imageUrl !== imageUrl(item.imageUrl)))) {
      throw new Error('Invalid backup file. No data was imported.');
    }
    return clean;
  }
  const api = Object.freeze({ STORAGE_KEY, validId, imageUrl, friends, filter, normalize, validate });
  root.RobloxCustomizerPinnedFriends = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
