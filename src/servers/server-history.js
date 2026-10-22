(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  const routePath = value => globalThis.RobloxCustomizerRoutes?.pathname(value) ?? value ?? location.pathname;
  const core = globalThis.RobloxCustomizerServerHistory;
  const i18n = globalThis.RobloxCustomizerI18n;
  const t = (source, values) => i18n?.t(source, values) || source;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (label, action, className = '') => {
    const node = el('button', `rc-server-button ${className}`, t(label)); node.type = 'button';
    node.addEventListener('click', action); return node;
  };
  let data = { userId: 0, enabled: true, servers: [] }, error = '', dialog = null, dialogGame = null, game = null;
  let queued = false, loading = null, refreshTimer = 0;
  const settingsMounts = new Set(), statuses = new Map(), games = new Map(), pendingGames = new Set();
  const key = entry => `${data.userId}:${entry.placeId}:${entry.serverId}`;
  async function request(action, extra = {}) {
    const send = globalThis.RobloxCustomizerRuntime?.sendMessage || (message => chrome.runtime.sendMessage(message));
    const result = await send({ type: 'rc-server-history', action, userId: data.userId, ...extra });
    if (!result?.ok) throw new Error(result?.error || 'Could not load recent servers. Please try again.');
    return result;
  }
  function accept(result) {
    const clean = core.normalize({ accounts: [{ userId: result.userId, servers: result.servers }] });
    data = { userId: result.userId, enabled: result.enabled !== false, servers: clean.accounts[0]?.servers || [] };
    error = ''; render();
  }
  async function load(action = 'snapshot') {
    if (loading) return loading;
    loading = (async () => {
      try { accept(await request(action)); }
      catch (failure) { data = { ...data, userId: 0, servers: [] }; error = failure.message; render(); }
      finally { loading = null; }
    })();
    return loading;
  }
  function row(entry) {
    const item = el('article', 'rc-server-history-row'); item.dataset.rcI18nIgnore = '';
    const info = el('div', 'rc-server-history-info');
    const name = el('a', 'rc-server-history-name', entry.name || t('Game {id}', { id: entry.placeId }));
    name.href = `https://www.roblox.com/games/${entry.placeId}`; name.translate = false;
    const date = new Intl.DateTimeFormat(i18n?.locale() || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(entry.visitedAt);
    const id = el('span', 'rc-server-history-id', `${date} · ${entry.serverId.slice(0, 8)}`); id.title = entry.serverId;
    const message = el('span', 'rc-server-history-status'); message.setAttribute('role', 'status');
    info.append(name, id, message);
    const actions = el('div', 'rc-server-history-actions');
    const join = el('a', 'rc-server-button', t('Rejoin')); join.href = core.joinUrl(entry);
    const check = button('Check availability', async () => {
      const requestKey = key(entry);
      check.disabled = true; message.textContent = t('Checking server…');
      try {
        const result = await request('check', { placeId: entry.placeId, serverId: entry.serverId });
        statuses.set(requestKey, { status: result.status, checkedAt: Date.now() }); sync();
      } catch (failure) { message.textContent = t(failure.message); }
      finally { check.disabled = false; }
    });
    const sync = () => {
      const saved = statuses.get(key(entry));
      const state = saved && Date.now() - saved.checkedAt < 30000 ? saved.status : '';
      message.textContent = t({ available: 'Server available.', full: 'Server full. Check again later.',
        closed: 'This public server is no longer available.', unlisted: 'Not listed publicly. The server may be private or closed.',
        unknown: 'Availability could not be confirmed. You can try rejoining.' }[state] || 'Availability not checked.');
      if (state === 'full' || state === 'closed') { join.removeAttribute('href'); join.setAttribute('aria-disabled', 'true'); }
      else { join.href = core.joinUrl(entry); join.removeAttribute('aria-disabled'); }
    };
    join.addEventListener('click', event => { if (!join.hasAttribute('href')) event.preventDefault(); });
    actions.append(join, check, button('Remove', async () => {
      try { accept(await request('remove', { placeId: entry.placeId, serverId: entry.serverId })); }
      catch (failure) { message.textContent = t(failure.message); }
    }));
    sync(); item.append(info, actions); return item;
  }
  function list(container, entries, limit = core.MAX_SERVERS) {
    container.replaceChildren();
    for (const entry of entries.slice(0, limit)) container.append(row(entry));
    if (!entries.length) container.append(el('p', 'rc-server-history-note', t(error || 'No recent servers yet. Play a game while tracking is enabled.')));
  }
  function mountSettings(mount) {
    if (!mount || settingsMounts.has(mount)) return;
    mount.className = 'rc-server-history-settings';
    const toggle = el('label', 'rc-server-history-toggle'), input = el('input'); input.type = 'checkbox';
    input.addEventListener('change', async () => {
      const enabled = input.checked; input.disabled = true;
      try { accept(await request('set-enabled', { enabled })); if (enabled) void load('refresh'); }
      catch (failure) { error = failure.message; render(); }
      finally { input.disabled = false; input.checked = data.enabled; }
    });
    toggle.append(input, el('span'));
    const note = el('p', 'rc-server-history-note');
    const status = el('p', 'rc-server-history-status'); status.setAttribute('role', 'status');
    mount.append(el('h3'), toggle, note, status, button('View recent servers', () => open()));
    settingsMounts.add(mount); updateSettings(); void load();
  }
  function updateSettings() {
    for (const mount of settingsMounts) {
      if (!mount.isConnected) { settingsMounts.delete(mount); continue; }
      mount.querySelector('h3').textContent = t('Recent servers');
      mount.querySelector('input').checked = data.enabled;
      mount.querySelector('input').disabled = !data.userId;
      mount.querySelector('label span').textContent = t('Remember recent servers');
      mount.querySelector('.rc-server-history-note').textContent = t('Keeps a separate list of up to 6 servers for each game and account, removing that game’s oldest entry when full. Checks Roblox presence while your browser runs, independently of playtime tracking.');
      mount.querySelector('[role=status]').textContent = t(error || (data.enabled ? 'Server history is enabled.' : 'Server history is paused. Saved servers are kept.'));
      mount.querySelector('button').textContent = t('View recent servers');
    }
  }
  function gameContext() {
    const placeId = Number(routePath().match(/^\/games\/(\d+)(?:\/|$)/i)?.[1]);
    if (!core.validId(placeId)) return null;
    const page = document.querySelector('#game-detail-page'), meta = page?.querySelector('#game-detail-meta-data');
    const renderedPlaceId = Number(page?.getAttribute('data-place-id') || meta?.getAttribute('data-place-id'));
    if (core.validId(renderedPlaceId) && renderedPlaceId !== placeId) return null;
    const nativeUniverse = Number(meta?.getAttribute('data-universe-id') || page?.getAttribute('data-universe-id'));
    if (core.validId(nativeUniverse)) games.set(placeId, nativeUniverse);
    const universeId = games.get(placeId) || data.servers.find(entry => entry.placeId === placeId)?.universeId || 0;
    if (!universeId && !games.has(placeId) && !pendingGames.has(placeId)) {
      pendingGames.add(placeId);
      void request('resolve-game', { placeId }).then(result => {
        games.set(placeId, core.validId(result.universeId) ? result.universeId : 0);
      }).catch(() => games.set(placeId, 0)).finally(() => { pendingGames.delete(placeId); queue(); });
    }
    return { placeId, universeId };
  }
  function entriesForGame(context) {
    const universeId = context.universeId || games.get(context.placeId)
      || data.servers.find(entry => entry.placeId === context.placeId)?.universeId;
    return data.servers.filter(entry => universeId ? entry.universeId === universeId : entry.placeId === context.placeId);
  }
  function syncPages() {
    const context = gameContext();
    if (game && (!game.isConnected || !context)) { game.remove(); game = null; }
    const target = context && document.querySelector('#game-instances');
    if (target) {
      if (!game) { game = el('section', 'rc-server-history-panel'); game.id = 'rc-server-history-game';
        game.append(el('h2'), el('div', 'rc-server-history-list'), button('View recent servers', () => open(gameContext()))); target.prepend(game); }
      game.querySelector('h2').textContent = t('Recent servers');
      game.dataset.universeId = String(context.universeId || 0);
      list(game.querySelector('.rc-server-history-list'), entriesForGame(context));
    }
  }
  function groupedList(container, entries) {
    container.replaceChildren();
    const groups = new Map();
    for (const entry of entries) {
      if (!groups.has(entry.universeId)) groups.set(entry.universeId, []);
      groups.get(entry.universeId).push(entry);
    }
    for (const [universeId, servers] of groups) {
      const section = el('section', 'rc-server-history-group'); section.dataset.universeId = String(universeId);
      const title = el('h3', '', servers[0].name || t('Game {id}', { id: universeId }));
      title.translate = false;
      const rows = el('div', 'rc-server-history-list'); list(rows, servers);
      section.append(title, rows); container.append(section);
    }
    if (!entries.length) list(container, []);
  }
  function renderDialog() {
    if (!dialog) return;
    dialog.querySelector('h2').textContent = t('Recent servers');
    const query = dialog.querySelector('input[type=search]').value.toLocaleLowerCase();
    const context = gameContext();
    if (dialogGame && context?.placeId === dialogGame.placeId && context.universeId) dialogGame = context;
    const entries = dialogGame ? entriesForGame(dialogGame) : data.servers;
    const matching = entries.filter(entry => `${entry.name} ${entry.placeId} ${entry.universeId} ${entry.serverId}`.toLocaleLowerCase().includes(query));
    const container = dialog.querySelector('.rc-server-dialog-list');
    if (dialogGame) list(container, matching); else groupedList(container, matching);
    dialog.querySelector('.rc-server-history-note').textContent = t(error || 'Rejoin opens Roblox. Closed, full, or restricted servers may reject the join.');
    const clear = dialog.querySelector('.rc-server-clear');
    clear.disabled = !data.userId || !entries.length || !!dialogGame && !core.validId(dialogGame.universeId || games.get(dialogGame.placeId));
    clear.textContent = t(dialogGame ? 'Clear this game' : 'Clear this account');
    dialog.querySelector('.rc-server-clear-confirmation p').textContent = t(dialogGame
      ? 'Delete recent servers for this game?' : 'Delete recent servers for this account?');
  }
  function open(context = null) {
    if (dialog) { dialog.focus(); return; }
    dialogGame = context;
    const opener = document.activeElement;
    dialog = el('dialog', 'rc-server-history-panel'); dialog.id = 'rc-server-history-dialog';
    dialog.setAttribute('aria-labelledby', 'rc-server-history-title');
    const heading = el('div', 'rc-server-history-heading'), title = el('h2'); title.id = 'rc-server-history-title';
    heading.append(title, button('Close', () => dialog.close()));
    const search = el('input'); search.type = 'search'; search.placeholder = t('Search recent servers'); search.setAttribute('aria-label', t('Search recent servers'));
    search.addEventListener('input', renderDialog);
    const confirmation = el('div', 'rc-server-clear-confirmation'); confirmation.hidden = true;
    let clearTarget = null;
    const clear = button('Delete recent servers', async () => {
      if (!clearTarget) return;
      clear.disabled = true;
      try { accept(await request('clear', clearTarget)); confirmation.hidden = true; }
      catch (failure) { error = failure.message; renderDialog(); }
      finally { clear.disabled = false; }
    });
    confirmation.append(el('p', '', t('Delete recent servers for this account?')), clear, button('Cancel', () => { confirmation.hidden = true; }));
    const actions = el('div', 'rc-server-history-actions');
    actions.append(button('Refresh', () => {
      for (const [placeId, universeId] of games) if (!universeId) games.delete(placeId);
      void load('refresh');
    }), button('Clear this account', () => {
      clearTarget = { userId: data.userId, ...(dialogGame ? { universeId: dialogGame.universeId || games.get(dialogGame.placeId) } : {}) };
      confirmation.hidden = false; clear.focus();
    }, 'rc-server-clear'));
    dialog.append(heading, el('p', 'rc-server-history-note'), search, el('div', 'rc-server-dialog-list'), actions, confirmation);
    dialog.addEventListener('close', () => { dialog.remove(); dialog = null; dialogGame = null; if (opener?.isConnected) opener.focus(); });
    globalThis.RobloxCustomizerDialogs?.dismissOnOutside(dialog);
    document.body.append(dialog); renderDialog(); dialog.showModal(); search.focus(); void load('refresh');
  }
  function render() { updateSettings(); syncPages(); renderDialog(); }
  function queue() { if (queued) return; queued = true; setTimeout(() => { queued = false; syncPages(); renderDialog(); }, 0); }
  let observedPath = routePath();
  new MutationObserver(records => {
    if (observedPath !== routePath()) { observedPath = routePath(); queue(); void load(); return; }
    if (records.some(record => !record.target.closest?.('[id^="rc-server-history"], #rc-settings-overlay, .rc-playtime-panel')
      && (record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element
        && (node.matches('#game-detail-page, #game-detail-meta-data, #game-instances, #rc-server-history-game')
          || node.querySelector('#game-detail-page, #game-detail-meta-data, #game-instances')))))) queue();
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-place-id', 'data-universe-id'] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[core.STORAGE_KEY] && !changes[core.ENABLED_KEY]) return;
    clearTimeout(refreshTimer); refreshTimer = setTimeout(load, 60);
  });
  addEventListener('popstate', () => { queue(); void load(); });
  addEventListener('pageshow', () => void load('refresh'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void load('refresh'); });
  i18n?.onChange(render);
  globalThis.RobloxCustomizerRuntime?.onResume(() => load('refresh'));
  setInterval(() => { if (data.enabled && document.visibilityState === 'visible') void load('refresh'); }, 30000);
  globalThis.RobloxCustomizerServerHistoryUI = Object.freeze({ mountSettings });
  void load('refresh');
});
