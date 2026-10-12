(function (root) {
  'use strict';
  const STORAGE_KEY = 'rcPlaytimeHistory';
  const ENABLED_KEY = 'playtimeTrackingEnabled';
  // Allow a few late/missed 30-second checks without treating normal play as a new session.
  // Longer gaps remain uncredited because the device may have slept or disconnected.
  const MAX_GAP_MS = 120000;
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const timestamp = value => count(value) <= 8640000000000000 ? count(value) : 0;
  const text = value => typeof value === 'string' ? value.trim().slice(0, 200) : '';
  function iconUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && /^(?:[a-z0-9-]+\.)?rbxcdn\.com$/i.test(url.hostname)
        && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }
  function normalize(value) {
    const state = { version: 1, currentUserId: 0, accounts: [], active: null,
      status: { kind: 'idle', checkedAt: 0 } };
    // Unknown versions are never interpreted as valid timing cursors.
    if (value?.version !== 1) return state;
    const users = new Set();
    for (const item of Array.isArray(value.accounts) ? value.accounts : []) {
      if (!validId(item?.userId) || users.has(item.userId)) continue;
      const account = { userId: item.userId, name: text(item.name), displayName: text(item.displayName), games: [] };
      const universes = new Set();
      for (const entry of Array.isArray(item.games) ? item.games : []) {
        if (!validId(entry?.universeId) || universes.has(entry.universeId)) continue;
        account.games.push({ universeId: entry.universeId, placeId: validId(entry.placeId) ? entry.placeId : 0,
          name: text(entry.name) || `Game ${entry.universeId}`, iconUrl: iconUrl(entry.iconUrl),
          totalMs: count(entry.totalMs), sessions: count(entry.sessions), firstPlayedAt: timestamp(entry.firstPlayedAt),
          lastPlayedAt: timestamp(entry.lastPlayedAt), metadataCheckedAt: timestamp(entry.metadataCheckedAt) });
        universes.add(entry.universeId);
      }
      state.accounts.push(account); users.add(item.userId);
    }
    if (users.has(value.currentUserId)) state.currentUserId = value.currentUserId;
    const active = value.active;
    if (users.has(active?.userId) && validId(active.universeId) && timestamp(active.observedAt)
      && typeof active.browserSessionId === 'string' && active.browserSessionId.length <= 100
      && state.accounts.find(a => a.userId === active.userId).games.some(g => g.universeId === active.universeId)) {
      state.active = { userId: active.userId, universeId: active.universeId,
        observedAt: active.observedAt, browserSessionId: active.browserSessionId };
    }
    if (['idle', 'tracking', 'disabled', 'signed-out', 'unavailable'].includes(value.status?.kind)) {
      state.status = { kind: value.status.kind, checkedAt: timestamp(value.status.checkedAt) };
    }
    return state;
  }
  function pause(value, kind, now, recoverable = false) {
    const state = normalize(value);
    // A brief failed request is not evidence that the player left. Keep the last confirmed
    // cursor, but add nothing unless the same game/account is confirmed again within the limit.
    if (!recoverable || kind !== 'unavailable' || !state.active || now < state.active.observedAt
      || now - state.active.observedAt > MAX_GAP_MS) state.active = null;
    state.status = { kind, checkedAt: count(now) };
    return state;
  }
  function observe(value, user, presence, now, browserSessionId) {
    const state = normalize(value);
    if (!validId(user?.id) || !count(now) || typeof browserSessionId !== 'string' || !browserSessionId) {
      return pause(state, 'unavailable', now);
    }
    let account = state.accounts.find(a => a.userId === user.id);
    if (!account) {
      account = { userId: user.id, name: '', displayName: '', games: [] };
      state.accounts.push(account);
    }
    account.name = text(user.name); account.displayName = text(user.displayName);
    state.currentUserId = user.id;
    if (presence?.userId !== user.id || presence.userPresenceType !== 2 || !validId(presence.universeId)) {
      return pause(state, presence?.userId === user.id ? 'idle' : 'unavailable', now);
    }
    const universeId = presence.universeId;
    let game = account.games.find(g => g.universeId === universeId);
    if (!game) {
      game = { universeId, placeId: 0, name: text(presence.lastLocation) || `Game ${universeId}`,
        iconUrl: '', totalMs: 0, sessions: 0, firstPlayedAt: now, lastPlayedAt: now, metadataCheckedAt: 0 };
      account.games.push(game);
    }
    const placeId = validId(presence.rootPlaceId) ? presence.rootPlaceId : presence.placeId;
    if (validId(placeId)) game.placeId = placeId;
    const active = state.active;
    const elapsed = active ? now - active.observedAt : -1;
    const continuing = active?.userId === user.id && active.universeId === universeId
      && active.browserSessionId === browserSessionId && elapsed >= 0 && elapsed <= MAX_GAP_MS;
    if (continuing) game.totalMs = Math.min(Number.MAX_SAFE_INTEGER, game.totalMs + elapsed);
    else game.sessions = Math.min(Number.MAX_SAFE_INTEGER, game.sessions + 1);
    game.lastPlayedAt = now;
    state.active = { userId: user.id, universeId, observedAt: now, browserSessionId };
    state.status = { kind: 'tracking', checkedAt: now };
    return state;
  }
  function snapshot(value, enabled) {
    const state = normalize(value);
    const account = state.accounts.find(a => a.userId === state.currentUserId) || null;
    const games = account?.games || [];
    return { ok: true, enabled: enabled === true, account: account ? { userId: account.userId,
      name: account.name, displayName: account.displayName } : null, games,
      totalMs: games.reduce((sum, game) => Math.min(Number.MAX_SAFE_INTEGER, sum + game.totalMs), 0),
      activeUniverseId: enabled && state.status.kind === 'tracking' ? state.active?.universeId || 0 : 0,
      status: enabled ? state.status : { kind: 'disabled', checkedAt: state.status.checkedAt } };
  }
  const core = Object.freeze({ STORAGE_KEY, ENABLED_KEY, MAX_GAP_MS, validId, iconUrl, normalize, pause, observe, snapshot });
  root.RobloxCustomizerPlaytime = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
})(globalThis);
