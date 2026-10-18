(function (root) {
  'use strict';
  const STORAGE_KEY = 'rcServerHistory', ENABLED_KEY = 'serverHistoryEnabled';
  const MAX_SERVERS = 6, MAX_ACCOUNTS = 10;
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const serverId = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value) ? value.toLowerCase() : '';
  function retainByGame(servers) {
    const counts = new Map();
    return [...servers].sort((a, b) => b.visitedAt - a.visitedAt).filter(entry => {
      const count = counts.get(entry.universeId) || 0;
      counts.set(entry.universeId, count + 1);
      return count < MAX_SERVERS;
    });
  }
  function normalize(value) {
    const accounts = [], seen = new Set();
    for (const account of Array.isArray(value?.accounts) ? value.accounts : []) {
      if (!validId(account?.userId) || seen.has(account.userId)) continue;
      seen.add(account.userId);
      const servers = [], ids = new Set();
      for (const entry of Array.isArray(account.servers) ? account.servers : []) {
        const id = serverId(entry?.serverId), key = `${entry?.placeId}:${id}`;
        if (!id || !validId(entry.placeId) || !validId(entry.universeId) || ids.has(key)
          || !Number.isSafeInteger(entry.visitedAt) || entry.visitedAt <= 0 || entry.visitedAt > 8640000000000000) continue;
        ids.add(key);
        servers.push({ serverId: id, placeId: entry.placeId, universeId: entry.universeId,
          name: typeof entry.name === 'string' ? entry.name.slice(0, 200) : '', visitedAt: entry.visitedAt, public: entry.public === true });
      }
      accounts.push({ userId: account.userId, servers: retainByGame(servers) });
      if (accounts.length === MAX_ACCOUNTS) break;
    }
    return { version: 1, currentUserId: validId(value?.currentUserId) ? value.currentUserId : 0, accounts };
  }
  function observe(value, user, presence, now) {
    const state = normalize(value);
    state.currentUserId = validId(user?.id) ? user.id : 0;
    if (!validId(user?.id) || presence?.userId !== user.id || presence.userPresenceType !== 2
      || !validId(presence.placeId) || !validId(presence.universeId) || !serverId(presence.gameId)
      || !Number.isSafeInteger(now) || now <= 0) return state;
    let account = state.accounts.find(item => item.userId === user.id);
    if (!account) { account = { userId: user.id, servers: [] }; state.accounts.unshift(account); }
    const id = serverId(presence.gameId);
    const previous = account.servers.find(item => item.placeId === presence.placeId && item.serverId === id);
    account.servers = account.servers.filter(item => item !== previous);
    account.servers.unshift({ serverId: id, placeId: presence.placeId, universeId: presence.universeId,
      name: typeof presence.lastLocation === 'string' ? presence.lastLocation.slice(0, 200) : previous?.name || '',
      visitedAt: now, public: previous?.public === true });
    // Recently used accounts retain their own bounded history.
    state.accounts = [account, ...state.accounts.filter(item => item !== account)].slice(0, MAX_ACCOUNTS);
    // Each experience has its own six-entry list, including its subplaces.
    account.servers = retainByGame(account.servers);
    return state;
  }
  function joinUrl(entry) {
    if (!validId(entry?.placeId) || !serverId(entry?.serverId)) return '';
    return `roblox://experiences/start?placeId=${entry.placeId}&gameInstanceId=${serverId(entry.serverId)}`;
  }
  const api = Object.freeze({ STORAGE_KEY, ENABLED_KEY, MAX_SERVERS, MAX_ACCOUNTS, validId, serverId, normalize, observe, joinUrl });
  root.RobloxCustomizerServerHistory = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
