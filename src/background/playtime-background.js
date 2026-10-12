(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPlaytime;
  const ALARM = 'rc-playtime-poll';
  const POLL_MINUTES = 0.5;
  const SESSION_KEY = 'rcPlaytimeBrowserSession';
  let queue = Promise.resolve();
  let sessionId;
  let csrfToken = '';
  let lastAttempt = 0;
  const serialize = operation => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  async function browserSession() {
    if (sessionId) return sessionId;
    const session = chrome.storage.session;
    const saved = session ? await session.get(SESSION_KEY) : {};
    sessionId = typeof saved[SESSION_KEY] === 'string' ? saved[SESSION_KEY] : crypto.randomUUID();
    if (session) await session.set({ [SESSION_KEY]: sessionId });
    return sessionId;
  }
  async function read() {
    const saved = await chrome.storage.local.get([core.STORAGE_KEY, core.ENABLED_KEY]);
    return { state: core.normalize(saved[core.STORAGE_KEY]), enabled: saved[core.ENABLED_KEY] === true };
  }
  async function save(state) { await chrome.storage.local.set({ [core.STORAGE_KEY]: state }); }
  async function ensureAlarm() {
    if (!chrome.alarms) return;
    const alarm = await chrome.alarms.get(ALARM);
    // Replace the old one-minute alarm as well as recreating missing alarms.
    if (alarm?.periodInMinutes !== POLL_MINUTES) {
      await chrome.alarms.create(ALARM, { delayInMinutes: POLL_MINUTES, periodInMinutes: POLL_MINUTES });
    }
  }
  async function json(url, options = {}, retry = true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      const token = response.headers.get('x-csrf-token');
      if (response.status === 403 && options.method === 'POST' && token && retry) {
        csrfToken = token;
        return await json(url, { ...options, headers: { ...options.headers, 'x-csrf-token': token } }, false);
      }
      if (!response.ok) {
        const error = new Error('Roblox request failed'); error.status = response.status; throw error;
      }
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  async function enrich(state, now) {
    const account = state.accounts.find(a => a.userId === state.currentUserId);
    const game = account?.games.find(g => g.universeId === state.active?.universeId);
    if (!game || now - game.metadataCheckedAt < 86400000) return;
    // Failed metadata is retried later; it must never discard a timing sample.
    game.metadataCheckedAt = now;
    const id = game.universeId;
    const results = await Promise.allSettled([
      json(`https://games.roblox.com/v1/games?universeIds=${id}`, { credentials: 'omit' }),
      json(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${id}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`, { credentials: 'omit' })
    ]);
    const details = results[0].status === 'fulfilled' ? results[0].value?.data?.find(g => g.id === id) : null;
    const icon = results[1].status === 'fulfilled' ? results[1].value?.data?.find(g => g.targetId === id && g.state === 'Completed') : null;
    if (typeof details?.name === 'string' && details.name.trim()) game.name = details.name.trim().slice(0, 200);
    if (core.validId(details?.rootPlace?.id)) game.placeId = details.rootPlace.id;
    if (core.iconUrl(icon?.imageUrl)) game.iconUrl = core.iconUrl(icon.imageUrl);
    if (results.some(r => r.status === 'rejected') || !details || !icon) game.metadataCheckedAt = now - 86400000 + 300000;
  }
  async function configure() {
    if (!chrome.storage?.local || !chrome.alarms) return;
    const { enabled, state } = await read();
    if (enabled) {
      if (state.active && state.active.browserSessionId !== await browserSession()) {
        await save(core.pause(state, 'idle', Date.now()));
      }
      await ensureAlarm();
    } else {
      await chrome.alarms.clear(ALARM);
      if (state.active || state.status.kind !== 'disabled') await save(core.pause(state, 'disabled', Date.now()));
    }
  }
  async function poll() {
    const { enabled, state } = await read();
    if (!enabled) return core.snapshot(state, false);
    await ensureAlarm();
    const now = Date.now();
    // Alarms and visible Roblox tabs share this throttle, so multiple tabs do not multiply requests.
    if (now >= lastAttempt && now - lastAttempt < 25000) return core.snapshot(state, true);
    lastAttempt = now;
    let next;
    try {
      const user = await json('https://users.roblox.com/v1/users/authenticated', { credentials: 'include' });
      if (!core.validId(user?.id)) throw new Error('Invalid account');
      const response = await json('https://presence.roblox.com/v1/presence/users', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) }, body: JSON.stringify({ userIds: [user.id] })
      });
      const presence = Array.isArray(response?.userPresences) ? response.userPresences.find(p => p?.userId === user.id) : null;
      next = core.observe(state, user, presence, Date.now(), await browserSession());
      await enrich(next, Date.now());
    } catch (error) {
      const recoverable = ['AbortError', 'TypeError'].includes(error.name) || error.status === 429 || error.status >= 500;
      next = core.pause(state, error.status === 401 ? 'signed-out' : 'unavailable', Date.now(), recoverable);
    }
    // The user can disable tracking while an HTTP request is in flight.
    const current = await chrome.storage.local.get(core.ENABLED_KEY);
    if (current[core.ENABLED_KEY] !== true) next = core.pause(state, 'disabled', Date.now());
    await save(next);
    return core.snapshot(next, current[core.ENABLED_KEY] === true);
  }
  async function handle(message) {
    if (message.action === 'snapshot') { const { state, enabled } = await read(); return core.snapshot(state, enabled); }
    if (message.action === 'refresh') return poll();
    if (message.action === 'set-enabled' && typeof message.enabled === 'boolean') {
      await chrome.storage.local.set({ [core.ENABLED_KEY]: message.enabled });
      lastAttempt = 0;
      await configure();
      return poll();
    }
    if (message.action === 'clear' && core.validId(message.userId)) {
      const { state, enabled } = await read();
      if (state.currentUserId !== message.userId) return { ok: false, error: 'account-changed' };
      state.accounts = state.accounts.filter(a => a.userId !== message.userId);
      state.currentUserId = 0; state.active = null;
      state.status = { kind: enabled ? 'idle' : 'disabled', checkedAt: Date.now() };
      await save(state);
      return core.snapshot(state, enabled);
    }
    return { ok: false, error: 'invalid-action' };
  }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rc-playtime') return;
    let url;
    try { url = new URL(sender.url); } catch { return; }
    if (sender.id !== chrome.runtime.id || url.protocol !== 'https:'
      || !['www.roblox.com', 'roblox.com'].includes(url.hostname) || (sender.frameId ?? 0) !== 0) return;
    serialize(() => handle(message)).then(respond, () => respond({ ok: false, error: 'storage-unavailable' }));
    return true;
  });
  chrome.alarms?.onAlarm.addListener(alarm => {
    if (alarm.name === ALARM) serialize(poll).catch(() => {});
  });
  chrome.storage?.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[core.ENABLED_KEY]) serialize(configure).catch(() => {});
  });
  const start = () => serialize(async () => { await configure(); await poll(); }).catch(() => {});
  chrome.runtime.onStartup?.addListener(start);
  chrome.runtime.onInstalled?.addListener(start);
  // Register listeners synchronously. Recreate missing alarms without fetching on worker startup.
  serialize(configure).catch(() => {});
})();
