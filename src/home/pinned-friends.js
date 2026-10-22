(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPinnedFriends;
  const send = globalThis.RobloxCustomizerRuntime?.sendMessage || ((message, callback) => chrome.runtime.sendMessage(message, callback));
  const nativeRoots = '#friends-web-app, #friends-container, .friends-content, .friends-list-container';
  const nativeHeaders = '.container-header, .content-header, .section-header';
  const profileRoots = '#profile-header-container, #user-profile-header-bg, .user-profile-header';
  const profileActions = '.profile-header-buttons, .user-profile-header .button-container';
  let accountId = 0, pins = [], friends = [], rosterReady = false, loading = false, busy = false;
  let section, dialog, list, search, status, more, opener, queued = false, route = '', epoch = 0, revision = 0;
  let error = '', limit = 48, signature = '', lastLoad = 0;
  const images = new Map(), requestedImages = new Set();
  const controls = new Map();
  const profileControls = new Map();
  const controlNodes = new WeakSet();
  const path = () => globalThis.RobloxCustomizerRoutes?.pathname() || location.pathname;
  const hidden = () => document.documentElement.hasAttribute('data-rc-features-disabled');
  const home = () => /^\/home\/?$/i.test(path());
  const profileId = () => Number(path().match(/^\/users\/(\d+)\/profile\/?$/i)?.[1]) || 0;
  const friendsRoute = () => /^\/users\/(?:\d+\/)?friends\/?$/i.test(path())
    && !/(?:followers|following|requests)/i.test(location.hash);
  function ownFriends() {
    const match = path().match(/^\/users\/(\d+\/)?friends\/?$/i);
    return !!match && (!accountId || !match[1] || Number(match[1].slice(0, -1)) === accountId)
      && !/(?:followers|following|requests)/i.test(location.hash);
  }
  const active = () => home() || ownFriends() || !!profileId();
  const friendMenu = globalThis.RobloxCustomizerPinnedFriendMenu?.create({ request,
    canShow: () => home() && !hidden() && !dialog?.open,
    context: () => `${accountId}:${epoch}`,
    getFriend: id => pins.find(friend => friend.userId === id),
    getAnchor: id => section?.querySelector(`.rc-pinned-friend[data-user-id="${id}"] > .rc-pinned-friend-profile`) });
  const localize = node => globalThis.RobloxCustomizerI18n?.localize(node);
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function button(text, callback, className = '') {
    const node = el('button', className, text);
    node.type = 'button'; node.addEventListener('click', callback);
    return node;
  }
  function literal(tag, text) {
    const node = el(tag, '', text); node.dataset.rcI18nIgnore = ''; return node;
  }
  function request(action, data = {}) {
    return new Promise((resolve, reject) => send({ type: 'rc-pinned-friends', action, accountId, ...data }, response => {
      const failure = chrome.runtime.lastError;
      if (failure || !response?.ok) reject(new Error(response?.error || 'Could not load friends. Please try again.'));
      else resolve(response);
    }));
  }
  function accept(response) {
    if (response.accountId !== accountId) {
      friendMenu?.close();
      closeDialog(); friends = []; rosterReady = false; images.clear(); requestedImages.clear();
      accountId = response.accountId;
    }
    pins = core.friends(response.pins);
    for (const friend of pins) if (friend.imageUrl && !images.has(friend.userId)) images.set(friend.userId, friend.imageUrl);
    queue();
  }
  async function load(force = false) {
    if (loading || hidden() || !home() && !friendsRoute() && !profileId() || !force && Date.now() - lastLoad < 60000) return;
    loading = true; lastLoad = Date.now();
    const token = epoch, version = revision;
    try {
      const response = await request('list');
      if (token !== epoch) return;
      if (version !== revision) {
        const saved = await chrome.storage.local.get(core.STORAGE_KEY);
        response.pins = core.normalize(saved[core.STORAGE_KEY]).accounts.find(item => item.userId === response.accountId)?.friends || [];
        if (token !== epoch) return;
      }
      accept(response); error = '';
      if (ownFriends() || profileId() && profileId() !== accountId) await loadRoster();
    } catch (failure) { if (token === epoch) error = failure.message; }
    finally { loading = false; queue(); }
  }
  async function loadRoster() {
    const token = epoch, owner = accountId, version = revision;
    const response = await request('roster');
    if (token !== epoch || owner !== accountId || response.accountId !== owner) return;
    friends = core.friends(response.friends); rosterReady = true;
    if (version === revision) pins = core.friends(response.pins);
    signature = ''; renderDialog(); queue();
  }
  async function toggle(friend) {
    if (busy || !accountId || hidden()) return;
    busy = true; error = ''; const token = epoch, owner = accountId;
    const pinned = !pins.some(item => item.userId === friend.userId);
    const version = ++revision; signature = ''; queue(); renderDialog();
    try {
      const response = await request('set', { userId: friend.userId, pinned, imageUrl: images.get(friend.userId) || friend.imageUrl });
      if (token === epoch && owner === accountId && version === revision) accept(response);
    } catch (failure) { if (token === epoch) error = failure.message; }
    finally { busy = false; signature = ''; queue(); renderDialog(); }
  }
  function pinButton(friend, compact = false) {
    const pinned = pins.some(item => item.userId === friend.userId);
    const node = button(pinned ? 'Unpin friend' : 'Pin friend', event => {
      event.preventDefault(); event.stopPropagation(); toggle(friend);
    }, `rc-friend-pin${compact ? ' rc-friend-pin-compact' : ''}`);
    node.dataset.userId = String(friend.userId);
    node.setAttribute('aria-pressed', String(pinned)); node.disabled = busy;
    // Inline icon stays visible in long translations and on touch screens.
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS(icon.namespaceURI, 'path');
    shape.setAttribute('d', 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z');
    icon.append(shape); node.prepend(icon);
    return node;
  }
  function card(friend) {
    const card = el('li', 'rc-pinned-friend'); card.dataset.userId = String(friend.userId);
    const link = el('a', 'rc-pinned-friend-profile'); link.href = `/users/${friend.userId}/profile`;
    const image = images.get(friend.userId) || friend.imageUrl;
    if (image) {
      const img = el('img'); img.src = image; img.alt = ''; img.width = img.height = 72;
      img.loading = 'lazy'; img.decoding = 'async'; link.append(img);
    } else link.append(literal('span', (friend.displayName || friend.name || '?').slice(0, 2)));
    const name = literal('strong', friend.displayName || friend.name || String(friend.userId));
    name.title = friend.displayName || friend.name; link.append(name);
    if (friend.name) link.append(literal('small', `@${friend.name}`));
    card.append(link, pinButton(friend));
    return card;
  }
  function refreshImages(items) {
    const ids = items.map(item => item.userId).filter(id => !requestedImages.has(id)).slice(0, 50);
    if (!ids.length || !accountId || hidden()) return;
    ids.forEach(id => requestedImages.add(id));
    const token = epoch, owner = accountId;
    request('avatars', { userIds: ids }).then(response => {
      if (token !== epoch || owner !== accountId || hidden()) return;
      let changed = false;
      for (const item of response.images || []) if (core.imageUrl(item.imageUrl) && images.get(item.userId) !== item.imageUrl) {
        images.set(item.userId, item.imageUrl); changed = true;
      }
      if (changed) { queue(); renderDialog(); }
    }).catch(() => { /* Keep initials and saved thumbnails usable; retry on the next visit. */ });
  }
  function renderSection() {
    const isHome = home();
    const view = isHome ? 'home' : 'manage';
    const anchor = isHome ? document.querySelector('#HomeContainer .friend-carousel-container')
      : document.querySelector(nativeRoots);
    // Validate against the same parent used by anchor.before(), including native nested layouts.
    const container = isHome ? anchor?.parentElement || document.getElementById('HomeContainer')
      : anchor?.querySelector('.friends-content > .container-header') || anchor?.querySelector(nativeHeaders);
    if (!container) { section?.remove(); section = null; return; }
    if (!section || section.dataset.rcPinnedFriendsView !== view) {
      section?.remove();
      signature = '';
      section = el(isHome ? 'section' : 'div', isHome ? '' : 'rc-pinned-friends-manage-only');
      section.id = 'rc-pinned-friends'; section.dataset.rcPinnedFriendsView = view;
      const header = el('div', 'rc-pinned-friends-header');
      if (isHome) {
        const title = el('h2', '', 'Pinned friends'); title.id = 'rc-pinned-friends-title';
        header.append(title); section.setAttribute('aria-labelledby', title.id);
      }
      header.append(button('Manage pinned friends', openDialog));
      section.append(header);
      if (isHome) section.append(el('p', 'rc-pinned-friends-message'), el('ul', 'rc-pinned-friends-list'));
      localize(section);
    }
    if (isHome && anchor && section.nextElementSibling !== anchor) anchor.before(section);
    else if (section.parentElement !== container) {
      if (isHome) container.prepend(section);
      else container.append(section);
    }
    if (!isHome) return;
    const key = JSON.stringify([pins, busy, error, [...images]]);
    if (signature === key) return;
    signature = key;
    const message = section.querySelector('p');
    message.textContent = error || (!pins.length ? 'Choose friends to keep them together here, including when they are offline.' : '');
    message.setAttribute('role', error ? 'alert' : 'status'); message.hidden = !message.textContent;
    const group = section.querySelector('ul');
    const avatarFocused = document.activeElement?.matches('.rc-pinned-friend-profile');
    const focusId = group.contains(document.activeElement) ? document.activeElement.closest('[data-user-id]')?.dataset.userId : '';
    group.replaceChildren(...pins.map(card));
    if (home()) for (const item of group.children) friendMenu?.bind(item.querySelector('.rc-pinned-friend-profile'), Number(item.dataset.userId));
    if (focusId) (avatarFocused ? group.querySelector(`li[data-user-id="${focusId}"] > a`) : group.querySelector(`button[data-user-id="${focusId}"]`))?.focus();
    friendMenu?.sync();
    localize(section); refreshImages(pins.slice(0, 50));
  }
  function closeDialog() {
    if (!dialog?.open) return;
    dialog.close(); opener?.focus();
  }
  async function openDialog(event) {
    if (hidden()) return;
    friendMenu?.close();
    opener = event?.currentTarget;
    if (!dialog) {
      dialog = el('dialog'); dialog.id = 'rc-pinned-friends-dialog';
      const header = el('div', 'rc-pinned-friends-header');
      const title = el('h2', '', 'Manage pinned friends'); title.id = 'rc-pinned-friends-dialog-title';
      dialog.setAttribute('aria-labelledby', title.id);
      header.append(title, button('Close', closeDialog));
      const hint = el('p', '', 'Pins are saved on this browser for each Roblox account.');
      search = el('input'); search.type = 'search'; search.placeholder = 'Search friends';
      search.setAttribute('aria-label', 'Search friends'); search.addEventListener('input', () => { limit = 48; renderDialog(); });
      status = el('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
      list = el('ul', 'rc-pinned-friends-list');
      more = button('Show more', () => { limit += 48; renderDialog(); });
      dialog.append(header, hint, search, status, list, more);
      dialog.addEventListener('close', () => opener?.focus());
      globalThis.RobloxCustomizerDialogs?.dismissOnOutside(dialog);
      document.body.append(dialog);
    }
    dialog.showModal(); search.focus(); limit = 48;
    status.textContent = 'Loading friends…'; localize(dialog);
    if (!accountId) { lastLoad = 0; await load(true); }
    if (!accountId || hidden()) return;
    try { await loadRoster(); error = ''; }
    catch (failure) { error = failure.message; }
    renderDialog();
  }
  function renderDialog() {
    if (!dialog?.open) return;
    const query = search.value.trim().toLocaleLowerCase();
    const pinnedIds = new Set(pins.map(item => item.userId));
    const all = [...pins, ...friends.filter(friend => !pinnedIds.has(friend.userId))];
    const shown = all.filter(friend => `${friend.displayName} ${friend.name}`.toLocaleLowerCase().includes(query));
    status.textContent = error || (!rosterReady ? 'Loading friends…' : !shown.length ? 'No friends found.' : '');
    status.setAttribute('role', error ? 'alert' : 'status');
    const focusId = list.contains(document.activeElement) ? document.activeElement.closest('[data-user-id]')?.dataset.userId : '';
    list.replaceChildren(...shown.slice(0, limit).map(card));
    if (focusId) list.querySelector(`button[data-user-id="${focusId}"]`)?.focus();
    more.hidden = shown.length <= limit; localize(dialog);
    refreshImages(shown.slice(0, limit));
  }
  function nativeControls() {
    for (const [card, node] of controls) if (!card.isConnected || !active() || profileId() || hidden()) {
      node.remove(); controls.delete(card);
    }
    if (!rosterReady || !ownFriends() || hidden()) return;
    const root = document.querySelector(nativeRoots);
    if (!root) return;
    const byId = new Map(friends.map(friend => [friend.userId, friend]));
    const matched = new Set();
    for (const link of root.querySelectorAll('a[href*="/users/"]')) {
      if (link.closest('#rc-pinned-friends')) continue;
      let url;
      try { url = new URL(link.href); } catch { continue; }
      if (url.origin !== location.origin) continue;
      const id = Number(url.pathname.match(/\/users\/(\d+)\/profile\/?$/)?.[1]);
      const friend = byId.get(id);
      const card = link.closest('.avatar-card-container, .avatar-card, .list-item, [data-testid="friend-card"]');
      if (!friend || !card || !root.contains(card) || card.closest('a, button')) continue;
      matched.add(card);
      const old = controls.get(card);
      if (old?.dataset.userId !== String(id) || old.getAttribute('aria-pressed') !== String(pins.some(item => item.userId === id))) {
        old?.remove(); const node = pinButton(friend, true); card.append(node); controls.set(card, node); controlNodes.add(node); localize(node);
      }
      const node = controls.get(card);
      node.disabled = busy;
      if (!node.isConnected) card.append(node);
    }
    for (const [card, node] of controls) if (!matched.has(card)) { node.remove(); controls.delete(card); }
  }
  function profileButtons() {
    const id = profileId();
    const friend = rosterReady && id !== accountId && friends.find(item => item.userId === id);
    const containers = friend && !hidden() ? new Set(document.querySelectorAll(profileActions)) : new Set();
    for (const [container, control] of profileControls) if (!container.isConnected || !containers.has(container)) {
      control.button.remove(); control.status.remove(); container.removeAttribute('data-rc-profile-pin-actions');
      profileControls.delete(container);
    }
    for (const container of containers) {
      const pinned = pins.some(item => item.userId === id);
      let control = profileControls.get(container);
      if (!control || control.button.dataset.userId !== String(id)) {
        // Reuse the native Standard/outlined button classes in both profile versions.
        const native = container.querySelector('#unfriend-button') || [...container.querySelectorAll('button, a')]
          .reverse().find(item => !item.matches('.rc-friend-pin-profile, .profile-header-dropdown') && !item.closest('[role="menu"]'));
        if (!native) { control?.button.remove(); control?.status.remove(); profileControls.delete(container); continue; }
        control?.button.remove(); control?.status.remove();
        const node = pinButton(friend);
        node.className = `${native.className} rc-friend-pin-profile`;
        const label = el('span', '', pinned ? 'Unpin friend' : 'Pin friend');
        node.lastChild.replaceWith(label);
        const message = el('p', 'text-error rc-profile-pin-error'); message.setAttribute('role', 'alert'); message.hidden = true;
        control = { button: node, label, status: message, pinned }; profileControls.set(container, control);
        controlNodes.add(node); controlNodes.add(message);
      }
      if (control.pinned !== pinned) {
        control.label.textContent = pinned ? 'Unpin friend' : 'Pin friend';
        control.button.setAttribute('aria-pressed', String(pinned)); control.pinned = pinned;
      }
      control.button.disabled = busy;
      if (control.status.textContent !== error) control.status.textContent = error;
      control.status.hidden = !error;
      container.setAttribute('data-rc-profile-pin-actions', '');
      if (control.button.parentElement !== container) container.append(control.button);
      if (control.status.parentElement !== container) container.append(control.status);
      localize(control.button); localize(control.status);
    }
  }
  function sync() {
    const next = `${path()}${location.hash}`;
    if (next !== route) {
      friendMenu?.close();
      route = next; epoch++; lastLoad = 0; error = ''; requestedImages.clear(); closeDialog();
      if (profileId()) rosterReady = false;
    }
    if (!active() || hidden()) {
      friendMenu?.close();
      section?.remove(); section = null; closeDialog(); nativeControls(); profileButtons(); load(); return;
    }
    if (home() || ownFriends()) { if (accountId || home()) renderSection(); }
    else { section?.remove(); section = null; }
    nativeControls(); profileButtons(); load();
  }
  function queue() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => { queued = false; sync(); });
  }
  const owned = '#rc-pinned-friends, #rc-pinned-friends-dialog, #rc-pinned-friend-menu, .rc-friend-pin, .rc-friend-pin-profile, .rc-profile-pin-error';
  new MutationObserver(records => {
    if (`${path()}${location.hash}` !== route || records.some(record => [...record.removedNodes].some(node => node === section || controlNodes.has(node))
      || record.type === 'attributes' && (record.target === document.documentElement
      || record.attributeName === 'href' && record.target.closest(nativeRoots))
      || record.type === 'characterData' && record.target.parentElement?.closest(profileRoots) && !record.target.parentElement.closest(owned)
      || record.type === 'childList' && record.target.closest?.(profileActions)
        && [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && !node.matches(owned))
      || !record.target.closest?.(owned) && [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof Element && !node.matches(owned) && (node.matches(`${nativeRoots}, ${nativeHeaders}, ${profileRoots}, ${profileActions}, #HomeContainer, .friend-carousel-container, .avatar-card, .avatar-card-container, a[href*="/users/"]`)
          || node.querySelector(`${nativeRoots}, ${nativeHeaders}, ${profileRoots}, ${profileActions}, #HomeContainer, .friend-carousel-container, a[href*="/users/"]`))))) queue();
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-rc-features-disabled', 'data-userid', 'href'] });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[core.STORAGE_KEY]) return;
    revision++;
    pins = core.normalize(changes[core.STORAGE_KEY].newValue).accounts.find(item => item.userId === accountId)?.friends || [];
    signature = ''; queue(); renderDialog();
  });
  addEventListener('popstate', queue); addEventListener('hashchange', queue);
  globalThis.RobloxCustomizerRuntime?.onResume(() => { lastLoad = 0; if (profileId()) rosterReady = false; queue(); });
  queue();
});
