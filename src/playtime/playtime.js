(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPlaytime;
  const i18n = globalThis.RobloxCustomizerI18n;
  const t = (source, values = {}) => i18n?.t(source, values)
    || source.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  let data = core.snapshot(null, false);
  let homeSection = null;
  let homeSignature = '';
  let homeResizeObserver = null;
  let homeAccountId = 0;
  let gameSection = null;
  let gameSignature = '';
  let dialog = null;
  let limit = 20;
  let busy = false;
  let pendingEnabled = null;
  let queued = false;
  let loadTimer;
  let lastError = '';
  const settingsMounts = new Set();
  const statusText = () => {
    if (lastError) return t(lastError);
    if (!data.enabled) return t('Tracking is paused. Saved totals are kept.');
    if (!data.status.checkedAt) return t('Waiting for Roblox status.');
    return t({ tracking: 'Playing now', idle: 'No game detected. Waiting for your next session.',
      'signed-out': 'Sign in to Roblox to track playtime.',
      unavailable: 'Roblox status is unavailable. Timing is paused until it returns.' }[data.status.kind]
      || 'Waiting for Roblox status.');
  };
  const duration = ms => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60), seconds = totalSeconds % 60;
    if (!minutes) return t('{seconds}s', { seconds });
    if (minutes < 60) return seconds ? t('{minutes}m {seconds}s', { minutes, seconds }) : t('{minutes}m', { minutes });
    const values = { hours: Math.floor(minutes / 60), minutes: minutes % 60, seconds };
    return t(seconds ? '{hours}h {minutes}m {seconds}s' : '{hours}h {minutes}m', values);
  };
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function button(label, action, className = '') {
    const node = element('button', `rc-playtime-button ${className}`, t(label));
    node.type = 'button'; node.addEventListener('click', action); return node;
  }
  async function request(action, extra = {}) {
    const send = globalThis.RobloxCustomizerRuntime?.sendMessage || (message => chrome.runtime.sendMessage(message));
    const response = await send({ type: 'rc-playtime', action, ...extra });
    if (!response?.ok) throw new Error('Could not update playtime. Please try again.');
    return response;
  }
  function accept(response) {
    lastError = '';
    // Normalize again at the content-script boundary; never trust names or URLs as markup.
    const account = response.account;
    const state = { version: 1, currentUserId: account?.userId || 0,
      accounts: account ? [{ ...account, games: response.games }] : [], status: response.status,
      active: response.activeUniverseId && account ? { userId: account.userId, universeId: response.activeUniverseId,
        observedAt: response.status.checkedAt, browserSessionId: 'view' } : null };
    data = core.snapshot(state, response.enabled);
    render();
  }
  function showError() {
    lastError = 'Could not update playtime. Please try again.';
    const message = t('Could not update playtime. Please try again.');
    for (const mount of settingsMounts) mount.querySelector('[role="status"]').textContent = message;
    if (dialog) dialog.querySelector('.rc-playtime-status').textContent = message;
    syncGamePage();
  }
  async function load(action = 'snapshot') {
    try { accept(await request(action)); } catch { showError(); }
  }
  async function enable(value) {
    if (busy) return;
    busy = true; pendingEnabled = value; updateSettings(); syncGamePage();
    try { accept(await request('set-enabled', { enabled: value })); }
    catch { showError(); }
    finally { busy = false; pendingEnabled = null; updateSettings(); syncGamePage(); }
  }
  function savedAccount() {
    return data.account ? t('Saved for {name}', { name: data.account.name || data.account.displayName || data.account.userId }) : '';
  }
  function updateSettings() {
    for (const mount of settingsMounts) {
      if (!mount.isConnected) { settingsMounts.delete(mount); continue; }
      const toggle = mount.querySelector('input');
      toggle.checked = pendingEnabled ?? data.enabled; toggle.disabled = busy;
      mount.querySelector('.rc-playtime-toggle-text').textContent = t('Enable playtime tracking');
      mount.querySelector('h3').textContent = t('Playtime tracking');
      mount.querySelector('.rc-playtime-hint').textContent = t('Estimates playtime from Roblox presence while your browser is running. Stored only on this computer, separately for each account.');
      mount.querySelector('[role="status"]').textContent = statusText();
      mount.querySelector('button').textContent = t('View playtime history');
    }
  }
  function mountSettings(mount) {
    if (!mount || settingsMounts.has(mount)) return;
    mount.classList.add('rc-playtime-settings');
    const toggle = element('label', 'rc-playtime-toggle');
    const input = element('input'); input.type = 'checkbox';
    input.addEventListener('change', () => enable(input.checked));
    toggle.append(input, element('span', 'rc-playtime-toggle-text'));
    const status = element('p', 'rc-playtime-status'); status.setAttribute('role', 'status');
    mount.append(element('h3'), toggle, element('p', 'rc-playtime-hint'), status,
      button('View playtime history', openHistory));
    settingsMounts.add(mount); updateSettings(); load();
  }
  function gameRow(game) {
    const row = element('article', 'rc-playtime-game');
    row.dataset.rcI18nIgnore = '';
    const art = element('div', 'rc-playtime-art');
    if (game.iconUrl) {
      const img = element('img'); img.src = game.iconUrl; img.alt = ''; img.loading = 'lazy';
      img.addEventListener('error', () => img.remove(), { once: true }); art.append(img);
    }
    const info = element('div', 'rc-playtime-game-info');
    const name = element(game.placeId ? 'a' : 'span', 'rc-playtime-game-name', game.name);
    if (game.placeId) name.href = `https://www.roblox.com/games/${game.placeId}`;
    info.append(name);
    const date = game.lastPlayedAt ? new Intl.DateTimeFormat(i18n?.locale() || 'en',
      { dateStyle: 'medium', timeStyle: 'short' }).format(game.lastPlayedAt) : '';
    info.append(element('span', 'rc-playtime-game-detail',
      `${t('{count} sessions', { count: game.sessions })}${date ? ` · ${t('Last played')}: ${date}` : ''}`));
    if (game.universeId === data.activeUniverseId) info.append(element('span', 'rc-playtime-playing', t('Playing now')));
    const time = element('strong', 'rc-playtime-duration', duration(game.totalMs));
    row.append(art, info, time); return row;
  }
  function syncGamePage() {
    const placeId = Number(location.pathname.match(/^\/games\/(\d+)(?:\/|$)/)?.[1]);
    const page = core.validId(placeId) ? document.getElementById('game-detail-page') : null;
    const meta = page?.querySelector('#game-detail-meta-data');
    const renderedId = Number(meta?.dataset.placeId || page?.dataset.placeId);
    // During SPA navigation the previous game's DOM can outlive its URL.
    if (!page || renderedId !== placeId) {
      gameSection?.remove(); gameSection = null; gameSignature = ''; return;
    }
    const universeId = Number(meta?.dataset.universeId || page.dataset.universeId);
    // Subplaces share an experience's total. Fall back to the exact place only
    // when Roblox has not supplied a universe ID; never guess from a game name.
    const game = data.games.find(item => core.validId(universeId)
      ? item.universeId === universeId : item.placeId === placeId);
    // Keep our summary out of the native action column so it can use the header's
    // full width. Native title, carousel and button nodes stay in their own trees.
    const parent = page.querySelector('.game-main-content:has(> #game-details-carousel-container)')
      || page.querySelector('.game-calls-to-action, .game-details-info') || page;
    if (!gameSection) {
      gameSection = element('section', 'rc-playtime-panel'); gameSection.id = 'rc-playtime-game-page';
      gameSection.dataset.rcI18nIgnore = '';
      gameSection.setAttribute('aria-labelledby', 'rc-playtime-game-title');
      const header = element('div', 'rc-playtime-header');
      const title = element('h2'); title.id = 'rc-playtime-game-title';
      header.append(title, element('span', 'rc-playtime-playing'));
      const intro = element('div', 'rc-playtime-intro');
      intro.append(header, element('p', 'rc-playtime-hint'));
      const stats = element('dl', 'rc-playtime-game-stats');
      const total = element('div');
      total.append(element('dt', 'rc-playtime-total-label'), element('dd', 'rc-playtime-game-total'));
      const last = element('div'), lastValue = element('dd');
      lastValue.append(element('time', 'rc-playtime-game-last'));
      last.append(element('dt', 'rc-playtime-last-label'), lastValue); stats.append(total, last);
      gameSection.append(intro, stats,
        button('Enable playtime tracking', () => enable(true), 'rc-playtime-game-enable'));
      gameSignature = '';
    }
    if (gameSection.parentElement !== parent) {
      // A native remount may copy the old markup, but only our live node has handlers.
      parent.querySelector('#rc-playtime-game-page')?.remove();
      parent.append(gameSection);
    }
    const signature = JSON.stringify([placeId, universeId || 0, data.account?.userId,
      game?.totalMs, game?.lastPlayedAt, data.activeUniverseId, data.enabled, busy, lastError, i18n?.locale()]);
    if (signature === gameSignature) return;
    gameSignature = signature;
    gameSection.lang = i18n?.locale() || 'en';
    gameSection.querySelector('h2').textContent = t('Your playtime');
    gameSection.querySelector('.rc-playtime-total-label').textContent = t('Total playtime');
    gameSection.querySelector('.rc-playtime-last-label').textContent = t('Last played');
    gameSection.querySelector('.rc-playtime-game-total').textContent = game ? duration(game.totalMs) : t('Not recorded yet');
    const date = gameSection.querySelector('time');
    date.textContent = game?.lastPlayedAt ? new Intl.DateTimeFormat(i18n?.locale() || 'en',
      { dateStyle: 'medium', timeStyle: 'short' }).format(game.lastPlayedAt) : t('Not recorded yet');
    if (game?.lastPlayedAt) date.dateTime = new Date(game.lastPlayedAt).toISOString();
    else date.removeAttribute('datetime');
    const playing = gameSection.querySelector('.rc-playtime-playing');
    playing.hidden = !game || game.universeId !== data.activeUniverseId;
    playing.textContent = t('Playing now');
    gameSection.querySelector('.rc-playtime-hint').textContent = t(lastError || (!data.enabled
      ? game ? 'Tracking is paused. Saved totals are kept.' : 'Enable playtime tracking to start recording this game.'
      : !game ? 'No playtime recorded yet. Join a game with tracking enabled to start.' : 'Local estimate for this game.'));
    const toggle = gameSection.querySelector('button');
    toggle.textContent = t('Enable playtime tracking'); toggle.hidden = data.enabled; toggle.disabled = busy;
  }
  function updateCarouselNavigation() {
    if (!homeSection?.isConnected) return;
    const viewport = homeSection.querySelector('.rc-playtime-carousel');
    const end = viewport.scrollWidth - viewport.clientWidth;
    homeSection.querySelector('.rc-playtime-previous').disabled = viewport.scrollLeft <= 2;
    homeSection.querySelector('.rc-playtime-next').disabled = end - viewport.scrollLeft <= 2;
  }
  function scrollCarousel(direction) {
    const viewport = homeSection?.querySelector('.rc-playtime-carousel');
    if (!viewport) return;
    const gap = parseFloat(getComputedStyle(viewport).columnGap) || 0;
    viewport.scrollBy({ left: direction * (viewport.clientWidth + gap),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function mountCarousel() {
    const section = element('section', 'rc-playtime-panel'); section.id = 'rc-playtime-home';
    section.setAttribute('aria-labelledby', 'rc-playtime-home-title');
    const header = element('div', 'rc-playtime-header');
    const title = element('h2'); title.id = 'rc-playtime-home-title';
    const summary = element('span', 'rc-playtime-home-summary'); summary.dataset.rcI18nIgnore = '';
    header.append(title, summary, button('View history', openHistory, 'rc-playtime-history'));
    const shell = element('div', 'rc-playtime-carousel-shell');
    const viewport = element('div', 'rc-playtime-carousel'); viewport.id = 'rc-playtime-carousel';
    viewport.tabIndex = 0; viewport.dir = 'ltr'; viewport.setAttribute('role', 'list');
    const previous = button('', () => scrollCarousel(-1), 'rc-playtime-previous');
    const next = button('', () => scrollCarousel(1), 'rc-playtime-next');
    for (const control of [previous, next]) control.setAttribute('aria-controls', viewport.id);
    previous.append(element('span', '', '‹')); next.append(element('span', '', '›'));
    previous.lastElementChild.setAttribute('aria-hidden', 'true'); next.lastElementChild.setAttribute('aria-hidden', 'true');
    viewport.addEventListener('scroll', updateCarouselNavigation, { passive: true });
    viewport.addEventListener('keydown', event => {
      if (event.target !== viewport) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault(); scrollCarousel(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); viewport.scrollLeft = event.key === 'Home' ? 0 : viewport.scrollWidth;
      }
    });
    // Touch and trackpads use native horizontal scrolling. Add dragging for a mouse.
    let drag = null;
    let suppressClick = false;
    viewport.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button === 0) drag = {
        id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, moved: false
      };
    });
    viewport.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (event.buttons !== 1) { drag = null; viewport.classList.remove('rc-playtime-dragging'); return; }
      const dx = event.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(event.clientY - drag.y)) {
        drag.moved = true; viewport.setPointerCapture(event.pointerId); viewport.classList.add('rc-playtime-dragging');
      }
      if (drag.moved) { event.preventDefault(); viewport.scrollLeft = drag.left - dx; }
    });
    const endDrag = event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (drag.moved) {
        suppressClick = true;
        setTimeout(() => { suppressClick = false; }, 0);
      }
      drag = null; viewport.classList.remove('rc-playtime-dragging');
    };
    viewport.addEventListener('pointerup', endDrag); viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('dragstart', event => event.preventDefault());
    viewport.addEventListener('click', event => {
      if (suppressClick) { event.preventDefault(); event.stopPropagation(); }
    }, true);
    shell.append(previous, viewport, next);
    section.append(header, shell, element('p', 'rc-playtime-empty'));
    homeResizeObserver = new ResizeObserver(updateCarouselNavigation);
    homeResizeObserver.observe(viewport);
    return section;
  }
  function updateHomeTile(tile, game) {
    if (!tile) {
      tile = element('article', 'rc-playtime-tile'); tile.dataset.universeId = String(game.universeId);
      tile.dataset.rcI18nIgnore = ''; tile.setAttribute('role', 'listitem');
      const link = element('a', 'rc-playtime-tile-link'); link.draggable = false;
      const art = element('span', 'rc-playtime-tile-art'); art.setAttribute('aria-hidden', 'true');
      art.append(element('span', 'rc-playtime-tile-initial'));
      const name = element('span', 'rc-playtime-tile-name'); name.dir = 'auto';
      link.append(art, name, element('strong', 'rc-playtime-tile-duration')); tile.append(link);
    }
    const link = tile.querySelector('a');
    if (game.placeId) link.href = `https://www.roblox.com/games/${game.placeId}`;
    else link.removeAttribute('href');
    const name = tile.querySelector('.rc-playtime-tile-name');
    if (name.textContent !== game.name) name.textContent = game.name;
    link.title = game.name;
    const time = tile.querySelector('.rc-playtime-tile-duration');
    if (time.textContent !== duration(game.totalMs)) time.textContent = duration(game.totalMs);
    const art = tile.querySelector('.rc-playtime-tile-art');
    const initial = art.querySelector('.rc-playtime-tile-initial');
    const letter = Array.from(game.name)[0] || '?';
    if (initial.textContent !== letter) initial.textContent = letter;
    if (art.dataset.iconUrl !== game.iconUrl) {
      art.dataset.iconUrl = game.iconUrl; art.querySelector('img')?.remove();
      if (game.iconUrl) {
        const image = element('img'); image.src = game.iconUrl; image.alt = ''; image.loading = 'lazy'; image.draggable = false;
        image.addEventListener('error', () => image.remove(), { once: true }); art.append(image);
      }
    }
    return tile;
  }
  function syncHome() {
    const home = /^\/home\/?$/i.test(location.pathname)
      ? document.querySelector('#HomeContainer, .home-container, [data-testid="home-page"]') : null;
    const clock = home?.querySelector('#rc-home-greeting .rc-home-greeting-clock');
    if (!clock || (!data.enabled && !data.games.length)) {
      homeSection?.remove(); homeSection = null; homeSignature = '';
      homeResizeObserver?.disconnect(); homeResizeObserver = null; homeAccountId = 0;
      // Restore the original clock layout when the summary is absent.
      for (const widgets of document.querySelectorAll('.rc-home-greeting-widgets')) {
        widgets.replaceWith(...widgets.childNodes);
      }
      return;
    }
    if (!homeSection?.isConnected) {
      homeResizeObserver?.disconnect(); homeSection = mountCarousel(); homeSignature = '';
    }
    let widgets = clock.parentElement;
    if (!widgets.classList.contains('rc-home-greeting-widgets')) {
      widgets = element('div', 'rc-home-greeting-widgets');
      clock.before(widgets); widgets.append(clock);
    }
    if (homeSection.parentElement !== widgets) widgets.append(homeSection);
    const signature = JSON.stringify([data.account?.userId, data.games, i18n?.locale()]);
    if (signature === homeSignature) return;
    homeSignature = signature;
    homeSection.querySelector('h2').textContent = t('Your most played');
    const summary = homeSection.querySelector('.rc-playtime-home-summary');
    summary.textContent = `${duration(data.totalMs)} · ${t('{count} games', { count: data.games.length })}`;
    summary.title = savedAccount();
    homeSection.querySelector('.rc-playtime-history').textContent = t('View history');
    const viewport = homeSection.querySelector('.rc-playtime-carousel');
    viewport.setAttribute('aria-label', t('Your most played'));
    for (const [selector, label] of [['.rc-playtime-previous', 'Previous games'], ['.rc-playtime-next', 'Next games']]) {
      const control = homeSection.querySelector(selector);
      // The chevrons remain decoration; their accessible names follow the UI language.
      control.setAttribute('aria-label', t(label)); control.title = t(label);
    }
    const ordered = [...data.games].sort((a, b) => b.totalMs - a.totalMs || b.lastPlayedAt - a.lastPlayedAt || a.universeId - b.universeId);
    const existing = new Map([...viewport.children].map(tile => [Number(tile.dataset.universeId), tile]));
    const keep = new Set(ordered.map(game => game.universeId));
    for (const [id, tile] of existing) if (!keep.has(id)) tile.remove();
    ordered.forEach((game, index) => {
      const tile = updateHomeTile(existing.get(game.universeId), game);
      if (viewport.children[index] !== tile) viewport.insertBefore(tile, viewport.children[index] || null);
    });
    if (homeAccountId !== data.account?.userId) viewport.scrollLeft = 0;
    homeAccountId = data.account?.userId || 0;
    homeSection.querySelector('.rc-playtime-empty').textContent = data.games.length ? ''
      : t('No playtime recorded yet. Join a game with tracking enabled to start.');
    updateCarouselNavigation();
  }
  function renderHistory() {
    if (!dialog) return;
    dialog.querySelector('h2').textContent = t('Playtime history');
    dialog.querySelector('.rc-playtime-status').textContent = statusText();
    dialog.querySelector('.rc-playtime-summary').textContent =
      `${duration(data.totalMs)} · ${t('{count} games', { count: data.games.length })}${data.account ? ` · ${savedAccount()}` : ''}`;
    const search = dialog.querySelector('input[type="search"]');
    search.placeholder = t('Search games'); search.setAttribute('aria-label', t('Search games'));
    const sort = dialog.querySelector('select'); sort.setAttribute('aria-label', t('Sort playtime'));
    sort.options[0].textContent = t('Most time played'); sort.options[1].textContent = t('Recently played');
    const query = search.value.trim().toLocaleLowerCase(i18n?.locale() || 'en');
    const filtered = data.games.filter(game => game.name.toLocaleLowerCase(i18n?.locale() || 'en').includes(query))
      .sort((a, b) => sort.value === 'recent' ? b.lastPlayedAt - a.lastPlayedAt : b.totalMs - a.totalMs || b.lastPlayedAt - a.lastPlayedAt);
    dialog.querySelector('.rc-playtime-list').replaceChildren(...filtered.slice(0, limit).map(game => gameRow(game)));
    dialog.querySelector('.rc-playtime-empty').textContent = !data.games.length
      ? t('No playtime recorded yet. Join a game with tracking enabled to start.') : !filtered.length ? t('No matching games.') : '';
    const more = dialog.querySelector('.rc-playtime-more'); more.hidden = filtered.length <= limit; more.textContent = t('Show more games');
    dialog.querySelector('.rc-playtime-export').disabled = !data.games.length;
    dialog.querySelector('.rc-playtime-clear').disabled = !data.games.length || busy;
    for (const [selector, label] of [['.rc-playtime-close', 'Close'], ['.rc-playtime-export', 'Export JSON'],
      ['.rc-playtime-clear', 'Clear this account'], ['.rc-playtime-confirm', 'Delete saved playtime'], ['.rc-playtime-cancel', 'Cancel']]) {
      dialog.querySelector(selector).textContent = t(label);
    }
    dialog.querySelector('.rc-playtime-confirmation p').textContent = t('Delete all saved playtime for this account? This cannot be undone.');
    dialog.querySelector('.rc-playtime-note').textContent = t('Estimates playtime from Roblox presence while your browser is running. Stored only on this computer, separately for each account.')
      + ' ' + t('Hidden game status may prevent tracking. Past sessions, long connection gaps, and time while your browser is closed cannot be recovered.');
  }
  function exportHistory() {
    if (!data.account) return;
    const payload = { version: 1, exportedAt: new Date().toISOString(), account: data.account,
      totalMs: data.totalMs, games: data.games };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = element('a'); link.href = url; link.download = `roblox-playtime-${data.account.userId}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function openHistory() {
    if (dialog) { dialog.focus(); return; }
    limit = 20;
    const opener = document.activeElement;
    dialog = element('dialog', 'rc-playtime-panel'); dialog.id = 'rc-playtime-dialog';
    dialog.setAttribute('aria-labelledby', 'rc-playtime-title');
    const header = element('div', 'rc-playtime-header');
    const title = element('h2'); title.id = 'rc-playtime-title';
    header.append(title, button('Close', () => dialog.close(), 'rc-playtime-close'));
    const summary = element('p', 'rc-playtime-summary'); summary.dataset.rcI18nIgnore = '';
    const status = element('p', 'rc-playtime-status'); status.setAttribute('role', 'status');
    const tools = element('div', 'rc-playtime-tools');
    const search = element('input'); search.type = 'search'; search.autocomplete = 'off';
    const sort = element('select');
    for (const value of ['time', 'recent']) { const option = element('option'); option.value = value; sort.append(option); }
    search.addEventListener('input', () => { limit = 20; renderHistory(); });
    sort.addEventListener('change', () => { limit = 20; renderHistory(); }); tools.append(search, sort);
    const actions = element('div', 'rc-playtime-actions');
    let clearUserId = 0;
    const confirmation = element('div', 'rc-playtime-confirmation'); confirmation.hidden = true;
    const confirm = button('Delete saved playtime', async () => {
      if (busy) return;
      busy = true; confirm.disabled = true;
      try {
        accept(await request('clear', { userId: clearUserId })); confirmation.hidden = true;
      } catch { showError(); }
      finally { busy = false; confirm.disabled = false; renderHistory(); }
    }, 'rc-playtime-confirm');
    confirmation.append(element('p'), confirm, button('Cancel', () => { confirmation.hidden = true;
      dialog.querySelector('.rc-playtime-clear').focus(); }, 'rc-playtime-cancel'));
    actions.append(button('Export JSON', exportHistory, 'rc-playtime-export'), button('Clear this account', () => {
      clearUserId = data.account?.userId || 0; confirmation.hidden = false; confirm.focus();
    }, 'rc-playtime-clear'));
    dialog.append(header, summary, status, tools, element('div', 'rc-playtime-list'), element('p', 'rc-playtime-empty'),
      button('Show more games', () => { limit += 20; renderHistory(); }, 'rc-playtime-more'), actions,
      confirmation, element('p', 'rc-playtime-note'));
    // Backdrop events target the dialog too; distinguish them from its padding.
    // Require both ends outside so selecting text or dragging out keeps it open.
    const onBackdrop = event => {
      const panel = event.currentTarget, bounds = panel.getBoundingClientRect();
      return event.target === panel && (event.clientX < bounds.left || event.clientX >= bounds.right
        || event.clientY < bounds.top || event.clientY >= bounds.bottom);
    };
    let backdropPress = false;
    dialog.addEventListener('pointerdown', event => { backdropPress = event.button === 0 && onBackdrop(event); });
    dialog.addEventListener('pointercancel', () => { backdropPress = false; });
    dialog.addEventListener('click', event => {
      const dismiss = backdropPress && onBackdrop(event);
      backdropPress = false;
      if (dismiss) { event.stopPropagation(); event.currentTarget.close(); }
    });
    dialog.addEventListener('close', () => { dialog.remove(); dialog = null; opener?.isConnected && opener.focus(); });
    document.body.append(dialog); renderHistory(); dialog.showModal(); search.focus(); load('refresh');
  }
  function render() { updateSettings(); syncHome(); syncGamePage(); renderHistory(); }
  function queuePages() {
    if (queued) return;
    queued = true; setTimeout(() => { queued = false; syncHome(); syncGamePage(); }, 0);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes[core.STORAGE_KEY] && !changes[core.ENABLED_KEY])) return;
    clearTimeout(loadTimer); loadTimer = setTimeout(() => load(), 30);
  });
  let observedPath = location.pathname;
  new MutationObserver(records => {
    const routeChanged = observedPath !== location.pathname;
    observedPath = location.pathname;
    if (routeChanged) { queuePages(); return; }
    if (/^\/games\/\d+(?:\/|$)/.test(location.pathname)) {
      const mounts = '#game-detail-page, #game-detail-meta-data, .game-main-content, .game-calls-to-action, .game-details-info, #rc-playtime-game-page';
      if ((gameSection && !gameSection.isConnected) || records.some(record => {
        if (record.target.closest?.('#rc-playtime-game-page')) return false;
        if (record.type === 'attributes') return record.target.matches('#game-detail-page, #game-detail-meta-data')
          || ['game-detail-page', 'game-detail-meta-data'].includes(record.oldValue);
        return [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element
          && (node.matches(mounts) || node.querySelector(mounts)));
      })) queuePages();
    }
    // Once mounted, native hover portals cannot change the card's data or placement.
    // Resume, locale and storage handlers update those separately. React can still
    // replace the greeting, remove the clock, or navigate away from Home.
    if (homeSection?.isConnected && /^\/home\/?$/i.test(location.pathname)
      && homeSection.closest('#rc-home-greeting')?.querySelector('.rc-home-greeting-clock')) return;
    const mounts = '#HomeContainer, .home-container, [data-testid="home-page"], #rc-home-greeting, .rc-home-greeting-clock';
    if (homeSection || records.some(record => record.target.closest?.('#rc-home-greeting')
      || [...record.addedNodes || [], ...record.removedNodes || []].some(node => node instanceof Element
        && (node.matches(mounts) || node.querySelector(mounts))))) queuePages();
  }).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-place-id', 'data-universe-id', 'id'], attributeOldValue: true });
  addEventListener('popstate', queuePages);
  i18n?.onChange(() => { homeSignature = ''; render(); });
  globalThis.RobloxCustomizerRuntime?.onResume(() => { queuePages(); load('refresh'); });
  // Keep an open page up to date and restore a dropped background alarm. The worker
  // deduplicates these requests across tabs and still tracks while Roblox is in the background.
  setInterval(() => {
    if (data.enabled && document.visibilityState === 'visible') load('refresh');
  }, 30000);
  globalThis.RobloxCustomizerPlaytimeUI = Object.freeze({ mountSettings });
  load().then(() => { if (data.enabled) load('refresh'); });
});
