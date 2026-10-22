(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPinnedFriends;
  const ERROR = 'Could not load friends. Please try again.';
  const CHANGED = 'Your Roblox account changed. Please reload this page.';
  let queue = Promise.resolve();
  const rosters = new Map();
  const activities = new Map();
  function serial(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }
  globalThis.RobloxCustomizerPinnedFriendsBackground = Object.freeze({ withStorageLock: serial, account, roster, avatars,
    invalidate(userId) { rosters.delete(userId); for (const key of activities.keys()) if (key.startsWith(`${userId}:`)) activities.delete(key); } });
  async function json(url, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { credentials: 'include', ...options, signal: controller.signal });
      if (!response.ok) throw new Error(ERROR);
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  async function account() {
    const user = await json('https://users.roblox.com/v1/users/authenticated');
    if (!core.validId(user?.id)) throw new Error('Sign in to manage pinned friends.');
    return user.id;
  }
  async function roster(userId) {
    const cached = rosters.get(userId);
    if (cached && Date.now() - cached.at < 60000) return cached.friends;
    const entries = new Map(), cursors = new Set(), deadline = Date.now() + 35000;
    let cursor = '';
    for (let page = 0; page < 40; page++) {
      const url = new URL(`https://friends.roblox.com/v1/users/${userId}/friends/find`);
      url.search = new URLSearchParams({ limit: '50', userSort: '0', ...(cursor ? { cursor } : {}) });
      const data = await json(url.href);
      if (!Array.isArray(data?.PageItems)) throw new Error(ERROR);
      for (const item of data.PageItems) if (core.validId(item?.id) && item.id !== userId) {
        entries.set(item.id, { userId: item.id, name: item.name || '', displayName: item.displayName || '', imageUrl: '' });
      }
      cursor = data.NextCursor;
      if (!cursor) break;
      if (typeof cursor !== 'string' || cursors.has(cursor) || page === 39 || Date.now() > deadline) throw new Error(ERROR);
      cursors.add(cursor);
    }
    // The current friends API may return only IDs. Resolve names using Roblox's user service.
    const missing = [...entries.values()].filter(item => !item.name);
    for (let index = 0; index < missing.length; index += 100) {
      if (Date.now() > deadline) throw new Error(ERROR);
      const result = await json('https://users.roblox.com/v1/users', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: missing.slice(index, index + 100).map(item => item.userId), excludeBannedUsers: false }) });
      if (!Array.isArray(result?.data)) throw new Error(ERROR);
      for (const user of result.data) if (entries.has(user.id)) {
        Object.assign(entries.get(user.id), { name: user.name, displayName: user.displayName });
      }
    }
    const friends = core.friends([...entries.values()]);
    if (rosters.size >= 3) rosters.delete(rosters.keys().next().value);
    rosters.set(userId, { friends, at: Date.now() });
    return friends;
  }
  async function avatars(ids) {
    if (!ids.length) return [];
    const url = new URL('https://thumbnails.roblox.com/v1/users/avatar-headshot');
    url.search = new URLSearchParams({ userIds: ids.join(','), size: '150x150', format: 'Png', isCircular: 'false' });
    const data = await json(url.href, { credentials: 'omit' });
    return (Array.isArray(data?.data) ? data.data : []).filter(item => ids.includes(item.targetId)
      && item.state === 'Completed' && core.imageUrl(item.imageUrl))
      .map(item => ({ userId: item.targetId, imageUrl: core.imageUrl(item.imageUrl) }));
  }
  async function activity(accountId, userId) {
    const key = `${accountId}:${userId}`, cached = activities.get(key);
    if (cached && Date.now() - cached.at < 15000) return cached.value;
    const response = await json('https://presence.roblox.com/v1/presence/users', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [userId] }) });
    const presence = response?.userPresences?.find(item => item.userId === userId);
    if (!presence || ![0, 1, 2, 3].includes(presence.userPresenceType)) throw new Error('Could not load friend activity. Please try again.');
    const value = { userId, status: presence.userPresenceType,
      placeId: core.validId(presence.placeId) ? presence.placeId : 0,
      universeId: core.validId(presence.universeId) ? presence.universeId : 0,
      gameId: typeof presence.gameId === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(presence.gameId) ? presence.gameId : '',
      location: typeof presence.lastLocation === 'string' ? presence.lastLocation.slice(0, 200) : '', iconUrl: '' };
    if (value.status === 2 && value.universeId) {
      try {
        const url = new URL('https://thumbnails.roblox.com/v1/games/icons');
        url.search = new URLSearchParams({ universeIds: String(value.universeId), size: '150x150', format: 'Png', isCircular: 'false' });
        const thumbnails = await json(url.href, { credentials: 'omit' });
        const icon = thumbnails?.data?.find(item => item.targetId === value.universeId && item.state === 'Completed');
        value.iconUrl = core.imageUrl(icon?.imageUrl);
      } catch { /* Activity remains usable if a game thumbnail is unavailable. */ }
    }
    return value;
  }
  async function handle(message) {
    const userId = await account();
    if (message.action !== 'list' && message.accountId !== userId) throw new Error(CHANGED);
    const saved = await chrome.storage.local.get(core.STORAGE_KEY);
    const state = core.normalize(saved[core.STORAGE_KEY]);
    let owner = state.accounts.find(item => item.userId === userId);
    const pins = owner?.friends || [];
    if (message.action === 'list') return { ok: true, accountId: userId, pins };
    if (message.action === 'activity') {
      if (!pins.some(friend => friend.userId === message.userId)) throw new Error('This friend is no longer pinned.');
      const info = await activity(userId, message.userId);
      if (await account() !== userId) throw new Error(CHANGED);
      const key = `${userId}:${message.userId}`;
      if (activities.get(key)?.value !== info) {
        if (activities.size >= 30) activities.delete(activities.keys().next().value);
        activities.set(key, { value: info, at: Date.now() });
      }
      return { ok: true, accountId: userId, activity: info };
    }
    if (message.action === 'roster') {
      const friends = await roster(userId);
      if (await account() !== userId) throw new Error(CHANGED);
      return { ok: true, accountId: userId, friends, pins };
    }
    if (message.action === 'avatars') {
      const allowed = new Set([...pins, ...(rosters.get(userId)?.friends || [])].map(item => item.userId));
      const images = await avatars(message.userIds.filter(id => allowed.has(id)));
      if (await account() !== userId) throw new Error(CHANGED);
      return { ok: true, accountId: userId, images };
    }
    if (message.action === 'set') {
      const friends = message.pinned ? await roster(userId) : [];
      const friend = friends.find(item => item.userId === message.userId);
      if (message.pinned && !friend) throw new Error('This user is no longer in your friends list.');
      // Recheck after network reads; account switches must never modify the previous account's pins.
      if (await account() !== userId) throw new Error(CHANGED);
      if (!owner) { owner = { userId, friends: [] }; state.accounts.push(owner); }
      if (message.pinned && !owner.friends.some(item => item.userId === message.userId)) {
        owner.friends.push({ ...friend, imageUrl: core.imageUrl(message.imageUrl) });
      } else if (!message.pinned) owner.friends = owner.friends.filter(item => item.userId !== message.userId);
      await chrome.storage.local.set({ [core.STORAGE_KEY]: state });
      return { ok: true, accountId: userId, pins: owner.friends };
    }
    throw new Error(ERROR);
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rc-pinned-friends') return;
    let url;
    try { url = new URL(sender.url); } catch { return; }
    if (sender.id !== chrome.runtime.id || (sender.frameId ?? 0) !== 0 || url.protocol !== 'https:'
      || !['www.roblox.com', 'roblox.com'].includes(url.hostname)) return;
    const actions = ['list', 'roster', 'avatars', 'set', 'activity'];
    const valid = actions.includes(message.action) && (message.action === 'list' || core.validId(message.accountId))
      && (message.action !== 'set' || core.validId(message.userId) && typeof message.pinned === 'boolean')
      && (message.action !== 'activity' || core.validId(message.userId))
      && (message.action !== 'avatars' || Array.isArray(message.userIds) && message.userIds.length <= 50
        && message.userIds.every(core.validId));
    if (!valid) { respond({ ok: false, error: ERROR }); return; }
    serial(() => handle(message)).then(respond, error => respond({ ok: false, error: error.message || ERROR }));
    return true;
  });
})();
