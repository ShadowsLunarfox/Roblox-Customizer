(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerServerHistory;
  const LANGUAGE_KEY = 'robloxCustomizerUnsupportedLanguage';
  async function json(url, credentials = 'omit') {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { credentials, signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in to Roblox to view recent servers.' : 'Could not load recent servers. Please try again.');
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  // Called under the shared presence/storage lock, after confirmed own-account presence.
  async function observe(user, presence, now) {
    const saved = await chrome.storage.local.get([core.STORAGE_KEY, core.ENABLED_KEY, LANGUAGE_KEY]);
    if (saved[core.ENABLED_KEY] === false || saved[LANGUAGE_KEY]) return;
    const state = core.observe(saved[core.STORAGE_KEY], user, presence, now);
    if (JSON.stringify(state) !== JSON.stringify(saved[core.STORAGE_KEY])) await chrome.storage.local.set({ [core.STORAGE_KEY]: state });
  }
  globalThis.RobloxCustomizerServerHistoryBackground = Object.freeze({ observe });
  async function compactSavedHistory() {
    const saved = await chrome.storage.local.get(core.STORAGE_KEY);
    if (!saved[core.STORAGE_KEY]) return;
    const state = core.normalize(saved[core.STORAGE_KEY]);
    if (JSON.stringify(state) !== JSON.stringify(saved[core.STORAGE_KEY])) {
      await chrome.storage.local.set({ [core.STORAGE_KEY]: state });
    }
  }
  async function handle(message) {
    const user = await json('https://users.roblox.com/v1/users/authenticated', 'include');
    if (!core.validId(user?.id)) throw new Error('Sign in to Roblox to view recent servers.');
    const saved = await chrome.storage.local.get([core.STORAGE_KEY, core.ENABLED_KEY, LANGUAGE_KEY]);
    const state = core.normalize(saved[core.STORAGE_KEY]);
    const account = state.accounts.find(item => item.userId === user.id);
    const result = () => ({ ok: true, userId: user.id, enabled: saved[core.ENABLED_KEY] !== false,
      servers: account?.servers || [] });
    if (message.action === 'snapshot') return result();
    if (message.action === 'resolve-game' && core.validId(message.placeId)) {
      const game = await json(`https://apis.roblox.com/universes/v1/places/${message.placeId}/universe`);
      if (!core.validId(game?.universeId)) throw new Error('Could not load recent servers. Please try again.');
      return { ok: true, universeId: game.universeId };
    }
    if (message.userId !== user.id) throw new Error('Your Roblox account changed. Refresh recent servers.');
    if (message.action === 'set-enabled' && typeof message.enabled === 'boolean') {
      await chrome.storage.local.set({ [core.ENABLED_KEY]: message.enabled });
      saved[core.ENABLED_KEY] = message.enabled; return result();
    }
    if (message.action === 'clear') {
      if (Object.hasOwn(message, 'universeId') && !core.validId(message.universeId)) return { ok: false, error: 'invalid-action' };
      if (account) account.servers = core.validId(message.universeId)
        ? account.servers.filter(entry => entry.universeId !== message.universeId) : [];
      await chrome.storage.local.set({ [core.STORAGE_KEY]: state }); return result();
    }
    const entry = account?.servers.find(item => item.placeId === message.placeId && item.serverId === core.serverId(message.serverId));
    if (!entry) throw new Error('This server is no longer in your history.');
    if (message.action === 'remove') {
      account.servers = account.servers.filter(item => item !== entry);
      await chrome.storage.local.set({ [core.STORAGE_KEY]: state }); return result();
    }
    if (message.action !== 'check') return { ok: false, error: 'invalid-action' };
    // A bounded scan must never label a server closed just because it was not on the first pages.
    let cursor = '';
    for (let page = 0; page < 5; page++) {
      const url = new URL(`https://games.roblox.com/v1/games/${entry.placeId}/servers/Public`);
      url.searchParams.set('limit', '100'); url.searchParams.set('sortOrder', 'Desc');
      if (cursor) url.searchParams.set('cursor', cursor);
      let response;
      try { response = await json(url.href); } catch { return { ok: true, status: 'unknown' }; }
      if (!Array.isArray(response?.data)) return { ok: true, status: 'unknown' };
      const server = response.data.find(item => core.serverId(item?.id) === entry.serverId);
      if (server) {
        entry.public = true; await chrome.storage.local.set({ [core.STORAGE_KEY]: state });
        return { ok: true, status: Number.isFinite(server.playing) && Number.isFinite(server.maxPlayers)
          && server.maxPlayers > 0 && server.playing >= server.maxPlayers ? 'full' : 'available' };
      }
      cursor = typeof response.nextPageCursor === 'string' ? response.nextPageCursor : '';
      if (!cursor) return { ok: true, status: entry.public ? 'closed' : 'unlisted' };
    }
    return { ok: true, status: 'unknown' };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rc-server-history') return;
    let url; try { url = new URL(sender.url); } catch { return; }
    if (sender.id !== chrome.runtime.id || url.protocol !== 'https:'
      || !['www.roblox.com', 'roblox.com'].includes(url.hostname) || (sender.frameId ?? 0) !== 0) return;
    if (message.action === 'resolve-game'
      && Number(url.pathname.match(/^\/games\/(\d+)(?:\/|$)/)?.[1]) !== message.placeId) return;
    globalThis.RobloxCustomizerPlaytimeBackground.withStorageLock(() => handle(message))
      .then(respond, error => respond({ ok: false, error: error.message || 'Could not load recent servers. Please try again.' }));
    return true;
  });
  // Apply the current retention limit to existing accounts even when both
  // trackers are paused. Share the write lock with presence samples and resets.
  if (chrome.storage?.local) {
    globalThis.RobloxCustomizerPlaytimeBackground.withStorageLock(compactSavedHistory).catch(() => {});
  }
})();
