(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPinnedFriends;
  const shared = globalThis.RobloxCustomizerPinnedFriendsBackground;
  const ERROR = 'Could not load friends. Please try again.';
  const CHANGED = 'Your Roblox account changed. Please reload this page.';
  const collections = new Map(), presences = new Map(), nextWrite = new Map(), followerCounts = new Map();
  const kinds = ['friends', 'following', 'requests'];
  const operations = { unfriend: 'friends', unfollow: 'following', accept: 'requests', decline: 'requests' };
  let csrf = '', csrfAccount = 0;
  async function assertAccount(owner) {
    if (await shared.account() !== owner) throw new Error(CHANGED);
  }
  async function json(url, options = {}, owner = 0, retry = true) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { credentials: 'include', ...options, signal: controller.signal });
      const challenge = response.headers?.get('rblx-challenge-id');
      if (challenge) throw new Error('Roblox requires verification. Complete it on Roblox, then try again.');
      const token = response.headers?.get('x-csrf-token');
      if (owner && retry && response.status === 403 && token) {
        csrf = token; csrfAccount = owner;
        await response.body?.cancel(); await assertAccount(owner);
        return await json(url, { ...options, headers: { ...options.headers, 'x-csrf-token': csrf } }, owner, false);
      }
      if (response.status === 429) throw new Error('Roblox asked you to wait. Try again later.');
      if (response.status === 401) throw new Error(CHANGED);
      if (!response.ok) throw new Error(options.method === 'POST' && owner
        ? 'Roblox could not complete this action. Refresh the list before trying again.' : ERROR);
      if (response.status === 204) return {};
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  async function names(items) {
    const missing = items.filter(item => !item.name);
    for (let index = 0; index < missing.length; index += 100) {
      const result = await json('https://users.roblox.com/v1/users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: missing.slice(index, index + 100).map(item => item.userId), excludeBannedUsers: false }) });
      if (!Array.isArray(result?.data)) throw new Error(ERROR);
      for (const user of result.data) {
        const item = items.find(item => item.userId === user.id);
        if (item) Object.assign(item, { name: user.name, displayName: user.displayName });
      }
    }
    return core.friends(items);
  }
  async function collection(owner, kind, refresh = false) {
    const key = `${owner}:${kind}`, cached = collections.get(key);
    if (!refresh && cached && Date.now() - cached.at < 60000) return cached.items;
    let items, nativeItems;
    if (kind === 'friends') {
      if (refresh) shared.invalidate(owner);
      items = await shared.roster(owner);
    } else {
      const records = new Map(), nativeRecords = new Map(), cursors = new Set(), deadline = Date.now() + 40000;
      let cursor = '';
      for (let page = 0; page < 100; page++) {
        const url = new URL(kind === 'following' ? `https://friends.roblox.com/v1/users/${owner}/followings` : 'https://friends.roblox.com/v1/my/friends/requests');
        url.search = new URLSearchParams({ limit: kind === 'following' ? '100' : '50', ...(cursor ? { cursor } : {}) });
        const result = await json(url.href);
        if (!Array.isArray(result?.data)) throw new Error(ERROR);
        for (const item of result.data) {
          const id = item.id ?? item.friendRequest?.senderId;
          if (core.validId(id) && id !== owner) {
            records.set(id, { userId: id, name: item.name || '', displayName: item.displayName || '', imageUrl: '' });
            if (kind === 'requests') nativeRecords.set(id, { friendRequest: {
              senderId: id, sentAt: typeof item.friendRequest?.sentAt === 'string' ? item.friendRequest.sentAt : null,
              sourceUniverseId: core.validId(item.friendRequest?.sourceUniverseId) ? item.friendRequest.sourceUniverseId : null,
              originSourceType: item.friendRequest?.originSourceType === 2 ? 'QrCode' : item.friendRequest?.originSourceType ?? null },
              mutualFriendsList: (Array.isArray(item.mutualFriendsList) ? item.mutualFriendsList : []).filter(name => typeof name === 'string') });
          }
        }
        cursor = result.nextPageCursor;
        if (!cursor) break;
        if (typeof cursor !== 'string' || cursors.has(cursor) || page === 99 || Date.now() > deadline) throw new Error(ERROR);
        cursors.add(cursor);
      }
      items = await names([...records.values()]);
      nativeItems = items.map(item => ({ id: item.userId, name: item.name, displayName: item.displayName, ...nativeRecords.get(item.userId) }));
    }
    await assertAccount(owner);
    if (collections.size >= 9) collections.delete(collections.keys().next().value);
    collections.set(key, { items, nativeItems: nativeItems || items.map(item => ({ id: item.userId, name: item.name, displayName: item.displayName })), at: Date.now() });
    return items;
  }
  async function followerCount(sender, refresh) {
    let url = new URL(sender.url);
    if (globalThis.RobloxCustomizerPageContext?.canResolve(sender)) {
      url = await globalThis.RobloxCustomizerPageContext.resolve(sender);
      if (!url) throw new Error(CHANGED);
    }
    const path = globalThis.RobloxCustomizerRoutes?.pathname(url.pathname) || url.pathname;
    const match = path.match(/^\/users\/(?:(\d+)\/)?friends\/?$/i);
    if (!match) throw new Error(ERROR);
    const userId = match[1] ? Number(match[1]) : await shared.account();
    if (!core.validId(userId)) throw new Error(ERROR);
    const cached = followerCounts.get(userId);
    let count;
    if (!refresh && cached && Date.now() - cached.at < 60000) count = cached.count;
    else {
      const result = await json(`https://friends.roblox.com/v1/users/${userId}/followers/count`, { credentials: 'omit' });
      if (!Number.isSafeInteger(result?.count) || result.count < 0) throw new Error(ERROR);
      count = result.count;
      if (followerCounts.size >= 10) followerCounts.delete(followerCounts.keys().next().value);
      followerCounts.set(userId, { count, at: Date.now() });
    }
    if (!match[1]) await assertAccount(userId);
    return { ok: true, userId, count };
  }
  async function state(owner) {
    const saved = await chrome.storage.local.get(core.STORAGE_KEY);
    const value = core.normalize(saved[core.STORAGE_KEY]);
    let account = value.accounts.find(item => item.userId === owner);
    if (!account) { account = { userId: owner, friends: [] }; value.accounts.push(account); }
    return { value, account };
  }
  async function handle(message, sender) {
    const owner = await shared.account();
    if (message.accountId && message.accountId !== owner) throw new Error(CHANGED);
    let url = new URL(sender.url);
    if (globalThis.RobloxCustomizerPageContext?.canResolve(sender)) {
      url = await globalThis.RobloxCustomizerPageContext.resolve(sender);
      if (!url) throw new Error(CHANGED);
    }
    const pathname = globalThis.RobloxCustomizerRoutes?.pathname(url.pathname) || url.pathname;
    const match = pathname.match(/^\/users\/(?:(\d+)\/)?friends\/?$/i);
    if (!match) throw new Error(CHANGED);
    if (match[1] && Number(match[1]) !== owner) {
      if (message.action === 'list') return { ok: true, accountId: owner, items: [], pins: [] };
      throw new Error(CHANGED);
    }
    if (message.action === 'list') {
      const items = await collection(owner, message.kind, message.refresh === true);
      const { account } = await state(owner);
      return { ok: true, accountId: owner, items, nativeItems: collections.get(`${owner}:${message.kind}`)?.nativeItems || [], pins: account.friends };
    }
    if (message.accountId !== owner) throw new Error(CHANGED);
    if (message.action === 'avatars' || message.action === 'presence') {
      const items = await collection(owner, message.action === 'presence' ? 'friends' : message.kind);
      const allowed = new Set(items.map(item => item.userId));
      if (message.userIds.some(id => !allowed.has(id))) throw new Error(ERROR);
      if (message.action === 'avatars') {
        const images = await shared.avatars(message.userIds); await assertAccount(owner);
        return { ok: true, accountId: owner, images };
      }
      const key = `${owner}:${message.userIds.join(',')}`, cached = presences.get(key);
      if (cached && Date.now() - cached.at < 30000) return { ok: true, accountId: owner, presences: cached.items };
      const result = await json('https://presence.roblox.com/v1/presence/users', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: message.userIds }) });
      if (!Array.isArray(result?.userPresences)) throw new Error(ERROR);
      const allowedIds = new Set(message.userIds);
      const values = result.userPresences.filter(item => allowedIds.has(item.userId) && [0, 1, 2, 3].includes(item.userPresenceType))
        .map(item => ({ userId: item.userId, status: item.userPresenceType }));
      await assertAccount(owner);
      if (presences.size >= 30) presences.delete(presences.keys().next().value);
      presences.set(key, { items: values, at: Date.now() });
      return { ok: true, accountId: owner, presences: values };
    }
    if (message.action === 'relationship') {
      const kind = operations[message.operation];
      const items = await collection(owner, kind);
      if (!items.some(item => item.userId === message.userId)) throw new Error('This person is no longer in this list. Refresh and try again.');
      const wait = Math.max(0, (nextWrite.get(owner) || 0) - Date.now());
      if (wait) await new Promise(resolve => setTimeout(resolve, wait));
      await assertAccount(owner);
      const endpoint = { unfriend: 'unfriend', unfollow: 'unfollow', accept: 'accept-friend-request', decline: 'decline-friend-request' }[message.operation];
      nextWrite.set(owner, Date.now() + 6500);
      await json(`https://friends.roblox.com/v1/users/${message.userId}/${endpoint}`, { method: 'POST', headers: {
        'Content-Type': 'application/json', ...(csrfAccount === owner && csrf ? { 'x-csrf-token': csrf } : {}) }, body: '{}' }, owner);
      // Once Roblox confirms a write, never retry it because local cleanup or a later account read failed.
      const cached = collections.get(`${owner}:${kind}`);
      if (cached) { cached.items = cached.items.filter(item => item.userId !== message.userId); cached.nativeItems = cached.nativeItems.filter(item => item.id !== message.userId); }
      let cleanupFailed = false;
      if (message.operation === 'unfriend') {
        shared.invalidate(owner);
        try {
          const { value, account } = await state(owner);
          account.friends = account.friends.filter(item => item.userId !== message.userId);
          await chrome.storage.local.set({ [core.STORAGE_KEY]: value });
        } catch { cleanupFailed = true; }
      } else if (message.operation === 'accept') { shared.invalidate(owner); collections.delete(`${owner}:friends`); }
      presences.clear();
      return { ok: true, accountId: owner, userId: message.userId, cleanupFailed };
    }
    throw new Error(ERROR);
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rc-friends-manager') return;
    let url;
    try { url = new URL(sender.url); } catch { return; }
    if (sender.id !== chrome.runtime.id || (sender.frameId ?? 0) !== 0 || url.protocol !== 'https:' || !['www.roblox.com', 'roblox.com'].includes(url.hostname)) return;
    const ids = value => Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(core.validId) && new Set(value).size === value.length;
    const countRequest = message.action === 'follower-count' && message.accountId === 0
      && (message.refresh === undefined || typeof message.refresh === 'boolean');
    const valid = countRequest || (message.accountId === 0 && message.action === 'list' || core.validId(message.accountId)) && (
      message.action === 'list' && kinds.includes(message.kind)
      || message.action === 'avatars' && kinds.includes(message.kind) && ids(message.userIds) && message.userIds.length <= 50
      || message.action === 'presence' && ids(message.userIds)
      || message.action === 'relationship' && Object.hasOwn(operations, message.operation) && core.validId(message.userId));
    if (!valid) { respond({ ok: false, error: ERROR }); return; }
    const task = countRequest ? followerCount(sender, message.refresh === true) : shared.withStorageLock(() => handle(message, sender));
    task.then(respond, failure => respond({ ok: false, error: failure.message || ERROR }));
    return true;
  });
})();
