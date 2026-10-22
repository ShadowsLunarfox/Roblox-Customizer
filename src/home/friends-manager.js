(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPinnedFriends;
  const send = globalThis.RobloxCustomizerRuntime?.sendMessage || ((message, callback) => chrome.runtime.sendMessage(message, callback));
  const ROOTS = '#friends-web-app, #friends-container, .friends-content, .friends-list-container';
  const HEADERS = '.container-header, .content-header, .section-header';
  const CARDS = '.avatar-card, .avatar-card-container, [data-testid="friend-card"]';
  const OWNED = '#rc-friends-manager, #rc-friends-bulk-dialog, .rc-friends-checkbox';
  const labels = { unfriend: 'Unfriend selected', unfollow: 'Unfollow selected', accept: 'Accept selected requests', decline: 'Ignore selected requests' };
  const descriptions = { unfriend: 'These people will be removed from your Roblox friends.', unfollow: 'You will stop following these people on Roblox.',
    accept: 'These people will be added to your Roblox friends.', decline: 'These friend requests will be ignored on Roblox.' };
  let accountId = 0, items = [], nativeItems = [], pins = [], presences = {}, selected = new Set();
  let manager, search, statusFilter, sort, bulk, notice, results;
  let review, reviewTitle, reviewDescription, reviewWarning, reviewList, reviewConfirm, reviewIds = [], reviewOperation = '', reviewOpener;
  let kind = '', route = '', epoch = 0, loaded = false, loading = false, queued = false;
  let selecting = false, working = false, batchRunning = false, stopped = false, presenceLoading = false, checkboxId = 0;
  let message = '', failure = false, presenceAt = 0, nativeConnected = false, viewSignature = '';
  const cards = new Map(), boundSearch = new WeakSet(), removedIds = new Set();
  const t = (source, values) => globalThis.RobloxCustomizerI18n?.t(source, values) || source.replace(/\{(\w+)\}/g, (_, key) => values?.[key] ?? '{' + key + '}');
  const localize = node => globalThis.RobloxCustomizerI18n?.localize(node);
  const pathname = () => globalThis.RobloxCustomizerRoutes?.pathname() || location.pathname;
  const hidden = () => document.documentElement.hasAttribute('data-rc-features-disabled');
  function pageKind(ignoreOwner = false) {
    const match = pathname().match(/^\/users\/(?:(\d+)\/)?friends\/?$/i);
    if (!match || !ignoreOwner && match[1] && accountId && Number(match[1]) !== accountId || /followers/i.test(location.hash)) return '';
    return /requests/i.test(location.hash) ? 'requests' : /following/i.test(location.hash) ? 'following' : 'friends';
  }
  function el(tag, className = '', text = '') { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
  function literal(tag, text, className = '') { const node = el(tag, className, text); node.dataset.rcI18nIgnore = ''; return node; }
  function setText(node, source, values) { node.dataset.rcI18nIgnore = ''; node.textContent = t(source, values); }
  function button(text, callback, className = 'btn-control-xs rc-friends-tool') {
    const node = el('button', className, text); node.type = 'button'; node.addEventListener('click', callback); return node;
  }
  function select(label, choices, onChange) {
    const node = el('select', 'input-field rc-friends-tool'); node.setAttribute('aria-label', label);
    for (const [value, name] of choices) { const option = el('option', '', name); option.value = value; node.append(option); }
    node.addEventListener('change', onChange); return node;
  }
  function request(action, data = {}) {
    return new Promise((resolve, reject) => {
      try { send({ type: 'rc-friends-manager', action, accountId, ...data }, response => {
        const error = chrome.runtime.lastError;
        if (error || !response?.ok) reject(new Error(response?.error || 'Could not load friends. Please try again.'));
        else resolve(response);
      }); } catch (error) { reject(error); }
    });
  }
  function resetSelection() { selected.clear(); render(); }
  function releaseCard(card, entry) {
    entry.checkbox.remove();
    card.removeAttribute('data-rc-native-friend'); card.removeAttribute('data-rc-friend-selected'); card.removeAttribute('data-rc-friend-selecting');
    card.removeAttribute('data-rc-friends-filtered');
    if (card.style.order !== entry.order) entry.order ? card.style.setProperty('order', entry.order, entry.orderPriority) : card.style.removeProperty('order');
    cards.delete(card);
  }
  function detach() {
    for (const [card, entry] of cards) releaseCard(card, entry);
    manager?.remove(); if (review?.open) review.close();
    if (viewSignature) { viewSignature = ''; document.dispatchEvent(new CustomEvent('rc-friends-native-view', { detail: JSON.stringify({ enabled: false }) })); }
    nativeConnected = false;
  }
  async function load(refresh = false) {
    if (loading || !kind || hidden()) return;
    let version = epoch; const requestedKind = kind;
    loading = true; message = 'Loading friends…'; failure = false; render();
    try {
      const response = await request('list', { kind: requestedKind, refresh, accountId: 0 });
      if (version !== epoch || requestedKind !== kind) return;
      if (accountId && accountId !== response.accountId) {
        epoch++; version = epoch; selected.clear(); presences = {}; presenceAt = 0; removedIds.clear();
        if (results) { results.replaceChildren(); results.hidden = true; }
        if (review?.open) review.close();
      }
      accountId = response.accountId; loaded = true;
      if (!pageKind()) { detach(); return; }
      items = core.friends(response.items); nativeItems = response.nativeItems || items.map(item => ({ id: item.userId, name: item.name, displayName: item.displayName }));
      pins = core.friends(response.pins);
      selected = new Set([...selected].filter(id => items.some(item => item.userId === id)));
      message = '';
    } catch (error) { if (version === epoch) { loaded = true; message = error.message; failure = true; } }
    finally { loading = false; if (version === epoch) render(); queue(); }
  }
  async function loadPresence(force = false) {
    if (kind !== 'friends' || !loaded || working || presenceLoading || hidden() || !force && Date.now() - presenceAt < 30000) return;
    const version = epoch, owner = accountId; presenceLoading = true; presenceAt = Date.now();
    if (force) presences = {};
    try {
      for (let index = 0; index < items.length; index += 100) {
        if (version !== epoch || hidden() || working) return;
        const response = await request('presence', { userIds: items.slice(index, index + 100).map(item => item.userId) });
        if (version !== epoch || owner !== accountId) return;
        for (const item of response.presences) presences[item.userId] = item.status;
        render();
      }
    } catch (error) { if (version === epoch && !working) { message = error.message; failure = true; } }
    finally { presenceLoading = false; if (version === epoch) render(); else queue(); }
  }
  function root() { return document.querySelector(ROOTS); }
  function mount() {
    const page = root();
    const header = page?.querySelector('.friends-content:not(.trusted-friend-requests-section) > .container-header') || page?.querySelector(HEADERS);
    if (!header) { detach(); return false; }
    if (!manager) build();
    if (manager.parentElement !== header || header.lastElementChild !== manager) header.append(manager);
    search = page.querySelector('.friends-filter input, input.friends-filter-searchbar-input');
    // React's delegated onChange must receive the original input before any data refresh.
    if (search && !boundSearch.has(search)) { search.addEventListener('input', () => { selected.clear(); queue(); }); boundSearch.add(search); }
    return true;
  }
  function build() {
    manager = el('div'); manager.id = 'rc-friends-manager'; manager.setAttribute('aria-label', 'Friend tools');
    statusFilter = select('Filter friends', [['all', 'All statuses'], ['online', 'Online'], ['ingame', 'In game'], ['offline', 'Offline'], ['studio', 'In Studio'], ['pinned', 'Pinned friends']], resetSelection);
    sort = select('Sort friends', [['default', 'Default order'], ['online', 'Online first'], ['name', 'Display name A–Z'], ['username', 'Username A–Z'], ['pinned', 'Pinned first']], resetSelection);
    const multi = button('Select users', () => { selecting = !selecting; selected.clear(); render(); }); multi.dataset.rcMultiSelect = '';
    const tools = el('div', 'rc-friends-native-tools'); tools.append(statusFilter, sort, multi);
    bulk = el('div', 'rc-friends-bulk');
    const selectAll = button('Select all filtered', () => { for (const item of filtered()) selected.add(item.userId); render(); }); selectAll.dataset.rcSelectAll = '';
    const pageAll = button('Select this page', () => { for (const entry of visibleCards()) selected.add(entry.userId); render(); }); pageAll.dataset.rcSelectPage = '';
    const clear = button('Clear selection', () => { selected.clear(); render(); }); clear.dataset.rcClearSelection = '';
    const count = literal('span', '', 'rc-friends-selected-count');
    const primary = button('Unfriend selected', event => openReview(event, kind === 'following' ? 'unfollow' : kind === 'requests' ? 'accept' : 'unfriend')); primary.dataset.rcRelationship = 'primary';
    const ignore = button('Ignore selected requests', event => openReview(event, 'decline')); ignore.dataset.rcRelationship = 'decline';
    const stop = button('Stop after current action', () => { stopped = true; render(); }); stop.dataset.rcStop = '';
    bulk.append(count, pageAll, selectAll, clear, primary, ignore, stop);
    notice = literal('span', '', 'rc-friends-notice'); notice.setAttribute('aria-live', 'polite');
    results = el('ul', 'rc-friends-results'); results.hidden = true; manager.append(tools, bulk, notice, results); localize(manager);
  }
  function filtered() {
    return core.filter(items, { query: search?.value, pins,
      status: kind === 'friends' ? statusFilter?.value : 'all', sort: sort?.value, presences });
  }
  function render() {
    if (!manager?.isConnected) return;
    for (const control of manager.querySelectorAll('.rc-friends-native-tools button, .rc-friends-native-tools select')) control.disabled = working || loading || !loaded;
    statusFilter.hidden = kind !== 'friends';
    for (const option of sort.options) option.hidden = kind !== 'friends' && ['online', 'pinned'].includes(option.value);
    if (kind !== 'friends' && ['online', 'pinned'].includes(sort.value)) sort.value = 'default';
    manager.querySelector('[data-rc-multi-select]').setAttribute('aria-pressed', String(selecting));
    bulk.hidden = !selecting;
    for (const control of bulk.querySelectorAll('button, select')) control.disabled = working || loading;
    setText(bulk.querySelector('.rc-friends-selected-count'), '{count} selected', { count: selected.size });
    setText(bulk.querySelector('[data-rc-select-all]'), 'Select all filtered ({count})', { count: filtered().length });
    const primary = bulk.querySelector('[data-rc-relationship="primary"]'); setText(primary, labels[kind === 'following' ? 'unfollow' : kind === 'requests' ? 'accept' : 'unfriend']); primary.disabled = working || !selected.size;
    const ignore = bulk.querySelector('[data-rc-relationship="decline"]'); ignore.hidden = kind !== 'requests'; ignore.disabled = working || !selected.size;
    const stop = bulk.querySelector('[data-rc-stop]'); stop.hidden = !batchRunning; stop.disabled = stopped;
    notice.textContent = message ? t(message) : ''; notice.hidden = !notice.textContent; notice.setAttribute('role', failure ? 'alert' : 'status');
    updateCards(); publish();
  }
  function cardId(card) {
    const link = card.querySelector('a[href*="/users/"]');
    const id = Number(link?.getAttribute('href')?.match(/\/users\/(\d+)\/profile(?:[/?#]|$)/)?.[1] || card.dataset.userId || card.getAttribute('id')?.match(/(?:^|[-_])(\d+)$/)?.[1]);
    return core.validId(id) ? id : 0;
  }
  function visibleCards() { return [...cards].filter(([card]) => card.isConnected && !card.hasAttribute('data-rc-friends-filtered') && card.getClientRects().length).map(([, entry]) => entry); }
  function updateCards() {
    const page = root(); if (!page) return;
    const allowed = new Map(items.map(item => [item.userId, item]));
    const ranked = new Map(filtered().map((item, index) => [item.userId, index]));
    for (const card of page.querySelectorAll(CARDS)) {
      if (card.closest(OWNED) || card.closest('.trusted-friend-requests-section')) continue;
      if (card.matches('.avatar-card-container') && card.closest('.avatar-card')) continue;
      const id = cardId(card); if (!id) continue;
      let entry = cards.get(card);
      if (entry && entry.userId !== id) { releaseCard(card, entry); entry = null; }
      if (!entry) {
        // Roblox draws its checkbox on the label following a hidden input.
        const checkbox = el('div', 'checkbox rc-friends-checkbox'), input = el('input'), label = el('label');
        input.type = 'checkbox'; input.id = 'rc-friends-select-' + ++checkboxId; label.htmlFor = input.id;
        checkbox.append(input, label);
        checkbox.addEventListener('click', event => event.stopPropagation());
        entry = { userId: id, checkbox, input, order: card.style.order, orderPriority: card.style.getPropertyPriority('order') };
        input.addEventListener('change', () => { input.checked ? selected.add(entry.userId) : selected.delete(entry.userId); render(); });
        cards.set(card, entry); card.setAttribute('data-rc-native-friend', String(id));
      }
      const friend = allowed.get(id);
      entry.checkbox.hidden = !selecting || !friend;
      entry.input.checked = selected.has(id); entry.input.disabled = working;
      entry.input.setAttribute('aria-label', t('Select {name}', { name: friend?.displayName || friend?.name || id }));
      if (!entry.checkbox.isConnected) card.prepend(entry.checkbox);
      card.toggleAttribute('data-rc-friend-selecting', !entry.checkbox.hidden);
      card.toggleAttribute('data-rc-friend-selected', selecting && selected.has(id));
      card.toggleAttribute('data-rc-friends-filtered', removedIds.has(id) || loaded && !nativeConnected && !ranked.has(id));
      if (!nativeConnected && sort.value !== 'default' && ranked.has(id)) card.style.order = String(ranked.get(id));
      else if (card.style.order !== entry.order) entry.order ? card.style.setProperty('order', entry.order, entry.orderPriority) : card.style.removeProperty('order');
    }
    for (const [card, entry] of cards) if (!card.isConnected || !page.contains(card)) releaseCard(card, entry);
  }
  function publish() {
    if (!loaded || !accountId || !pageKind()) return;
    const apply = kind === 'friends' && statusFilter.value !== 'all' || sort.value !== 'default';
    const next = { enabled: true, route, accountId, kind, apply, sort: sort.value, ids: filtered().map(item => item.userId),
      filterKey: JSON.stringify([statusFilter.value, sort.value, search?.value || '']),
      records: nativeItems, presences: apply ? presences : {}, removedIds: [...removedIds] };
    const signature = JSON.stringify(next); if (viewSignature === signature) return;
    viewSignature = signature; document.dispatchEvent(new CustomEvent('rc-friends-native-view', { detail: signature }));
  }
  function createDialog(id, title) {
    const dialog = el('dialog', 'modal-content rc-friends-dialog'); dialog.id = id;
    const header = el('div', 'modal-header rc-friends-dialog-header'), heading = el('h2', '', title); heading.id = `${id}-title`;
    dialog.setAttribute('aria-labelledby', heading.id); header.append(heading, button('Close', () => dialog.close())); dialog.append(header);
    globalThis.RobloxCustomizerDialogs?.dismissOnOutside(dialog); document.body.append(dialog); return dialog;
  }
  function openReview(event, operation) {
    if (!event.isTrusted || working || !selected.size || hidden()) return;
    if (!review) {
      review = createDialog('rc-friends-bulk-dialog', 'Review selected people');
      reviewTitle = literal('p', '', 'rc-friends-review-count'); reviewDescription = literal('p', ''); reviewList = el('ul', 'rc-friends-review-list');
      reviewDescription.id = 'rc-friends-bulk-description';
      reviewWarning = literal('p', '', 'rc-friends-review-warning'); reviewWarning.id = 'rc-friends-bulk-warning'; reviewWarning.setAttribute('role', 'note');
      const footer = el('div', 'modal-footer rc-friends-dialog-header');
      reviewConfirm = button('Confirm', event => { if (event.isTrusted) runBulk(); });
      footer.append(button('Cancel', () => review.close()), reviewConfirm); review.append(reviewTitle, reviewDescription, reviewWarning, reviewList, footer);
      review.addEventListener('close', () => reviewOpener?.focus());
    }
    reviewIds = [...selected].filter(id => items.some(item => item.userId === id)); reviewOperation = operation; reviewOpener = event.currentTarget;
    setText(reviewTitle, '{count} selected', { count: reviewIds.length }); setText(reviewDescription, descriptions[operation]); setText(reviewConfirm, labels[operation]);
    reviewConfirm.classList.toggle('rc-friends-danger', operation === 'unfriend'); reviewWarning.hidden = operation !== 'unfriend';
    setText(reviewWarning, 'This action cannot be undone. Restoring the friendship requires a new friend request and acceptance.');
    review.setAttribute('aria-describedby', reviewDescription.id + (reviewWarning.hidden ? '' : ' ' + reviewWarning.id));
    reviewList.replaceChildren(...reviewIds.map(id => { const friend = items.find(item => item.userId === id); return literal('li', `${friend.displayName || friend.name} (@${friend.name || id})`); }));
    localize(review); review.showModal();
  }
  async function runBulk() {
    if (working || !review?.open || hidden()) return;
    const ids = reviewIds.slice(), operation = reviewOperation, token = epoch, owner = accountId;
    review.close(); working = true; batchRunning = true; stopped = false; failure = false; results.replaceChildren(); results.hidden = true;
    let completed = 0, failed = 0;
    for (const id of ids) {
      if (stopped || token !== epoch || owner !== accountId || hidden()) break;
      message = t('Processed {done} of {total}. Roblox actions are paced.', { done: completed + failed, total: ids.length }); render();
      try {
        const response = await request('relationship', { operation, userId: id });
        if (token !== epoch || owner !== accountId) break;
        completed++; selected.delete(id); removedIds.add(id); items = items.filter(item => item.userId !== id); nativeItems = nativeItems.filter(item => item.id !== id);
        if (response.cleanupFailed) { const row = literal('li', t('The action succeeded, but local friend pins could not be updated.')); results.append(row); results.hidden = false; }
      } catch (error) {
        if (token !== epoch) break;
        failed++; const friend = items.find(item => item.userId === id);
        results.append(literal('li', `${friend?.displayName || friend?.name || id}: ${t(error.message)}`)); results.hidden = false;
        // Leave unsuccessful and unprocessed people selected; never automatically repeat an uncertain write.
        stopped = true;
      }
      render();
    }
    working = false; batchRunning = false;
    if (token === epoch) {
      failure = failed > 0;
      message = t('Finished: {done} succeeded; {remaining} still selected.', { done: completed, remaining: selected.size });
      render();
    } else queue();
  }
  function sync() {
    const nextRoute = pathname() + location.hash, nextKind = pageKind(true);
    if (route !== nextRoute || kind !== nextKind) {
      detach(); route = nextRoute; kind = nextKind; epoch++; stopped = true; loaded = false;
      items = []; nativeItems = []; pins = []; presences = {}; selected.clear(); selecting = false; presenceAt = 0;
      removedIds.clear(); message = ''; failure = false;
      if (results) { results.replaceChildren(); results.hidden = true; }
      if (statusFilter) statusFilter.value = 'all'; if (sort) sort.value = 'default';
    }
    if (!kind || hidden()) { stopped = true; detach(); return; }
    if (!pageKind()) { detach(); if (!loaded) load(); return; }
    if (!mount()) return;
    render(); if (!loaded) load(); else if (kind === 'friends' && !failure) loadPresence();
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; sync(); }); } }
  new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' && (record.target === document.documentElement || record.attributeName === 'href' && record.target.closest(ROOTS))
      || !record.target.closest?.(OWNED) && [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && !node.matches(OWNED)
        && (node.matches(ROOTS + ', ' + HEADERS + ', ' + CARDS + ', .friends-filter, input.friends-filter-searchbar-input, a[href*="/users/"]')
          || node.querySelector(ROOTS + ', ' + HEADERS + ', ' + CARDS + ', .friends-filter, a[href*="/users/"]'))))) queue();
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-rc-features-disabled', 'href'] });
  document.addEventListener('rc-friends-native-ready', event => {
    let value; try { value = JSON.parse(event.detail); } catch { return; }
    if (value.route !== route || nativeConnected === !!value.matched) return;
    nativeConnected = !!value.matched; queue();
  });
  document.addEventListener('rc-friends-native-write', event => {
    let value; try { value = JSON.parse(event.detail); } catch { return; }
    if (value.route !== route || value.accountId !== accountId || !core.validId(value.userId)) return;
    const affectedKind = value.operation === 'unfriend' ? 'friends' : value.operation === 'unfollow' ? 'following' : 'requests';
    if (kind !== affectedKind) return;
    selected.delete(value.userId); removedIds.add(value.userId);
    items = items.filter(item => item.userId !== value.userId); nativeItems = nativeItems.filter(item => item.id !== value.userId); render();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[core.STORAGE_KEY]) return;
    const account = core.normalize(changes[core.STORAGE_KEY].newValue).accounts.find(item => item.userId === accountId);
    pins = account?.friends || []; render();
  });
  globalThis.RobloxCustomizerI18n?.onChange(() => render());
  globalThis.RobloxCustomizerRuntime?.onResume(() => { if (kind && !working && !hidden()) { presenceAt = 0; load(true); } else queue(); });
  addEventListener('popstate', queue); addEventListener('hashchange', queue); queue();
});
