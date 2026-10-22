(() => {
  'use strict';
  function create({ request, canShow, context, getFriend, getAnchor }) {
    let menu, ui, currentId = 0, anchor, activity, failure = '', sequence = 0;
    let hoverTimer, hoverFrame, leaveTimer, loadTimer, frame, animation;
    let sticky = false, reveal = false, geometryDirty = true, width = 0, height = 0;
    const cache = new Map(), pending = new Map();
    const core = globalThis.RobloxCustomizerPinnedFriends;
    const t = (source, values) => globalThis.RobloxCustomizerI18n?.t(source, values) || source;
    const opened = () => !!menu?.matches(':popover-open');
    function el(tag, text = '', literal = false) {
      const node = document.createElement(tag); node.textContent = text;
      if (literal) node.dataset.rcI18nIgnore = '';
      return node;
    }
    function text(node, value) { if (node.textContent !== value) node.textContent = value; }
    function attr(node, name, value) {
      if (value == null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
      else if (node.getAttribute(name) !== String(value)) node.setAttribute(name, String(value));
    }
    function style(name, value) { if (menu.style[name] !== value) menu.style[name] = value; }
    function cancelHover() { clearTimeout(hoverTimer); cancelAnimationFrame(hoverFrame); hoverFrame = 0; }
    function reset() {
      clearTimeout(leaveTimer); clearTimeout(loadTimer); sequence++;
      anchor && attr(anchor, 'aria-expanded', 'false');
      currentId = 0; anchor = null; activity = null; sticky = false; reveal = false;
      animation?.cancel(); animation = null;
    }
    function close() {
      cancelHover(); cancelAnimationFrame(frame); frame = 0;
      if (opened()) menu.hidePopover();
      reset();
    }
    function position() {
      frame = 0;
      if (!opened() || !anchor?.isConnected || !canShow()) { close(); return; }
      const bounds = anchor.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= innerHeight) { close(); return; }
      // Batch all geometry reads before writes. Cached hovers do not remeasure the menu.
      if (geometryDirty || !width || !height) {
        const size = menu.getBoundingClientRect(); width = size.width; height = size.height; geometryDirty = false;
      }
      const below = bounds.bottom + 8;
      style('left', `${Math.max(8, Math.min(innerWidth - width - 8, bounds.left + bounds.width / 2 - width / 2))}px`);
      style('top', `${Math.max(8, Math.min(innerHeight - height - 8,
        below + height <= innerHeight - 8 ? below : bounds.top - height - 8))}px`);
      if (reveal) {
        reveal = false; style('visibility', '');
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          animation = menu.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }],
            { duration: 90, easing: 'ease-out' });
        }
      }
    }
    function queuePosition() { if (opened() && !frame) frame = requestAnimationFrame(position); }
    function leave() {
      clearTimeout(leaveTimer);
      if (!sticky) leaveTimer = setTimeout(close, 140);
    }
    function ensureMenu() {
      if (menu) return;
      menu = el('div'); menu.id = 'rc-pinned-friend-menu'; menu.setAttribute('popover', 'auto');
      menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Friend actions');
      const header = el('div'); header.className = 'rc-friend-menu-summary';
      const thumbnail = el('span'); thumbnail.className = 'rc-friend-menu-thumbnail';
      const image = el('img'); image.alt = ''; image.width = image.height = 40; image.decoding = 'async'; image.hidden = true;
      const initial = el('span', '', true); thumbnail.append(image, initial);
      const info = el('div'), name = el('strong', '', true), presence = el('span', '', true), game = el('a', '', true);
      info.append(name, presence, game);
      const dismiss = el('button', '×'); dismiss.type = 'button'; dismiss.className = 'rc-friend-menu-close';
      dismiss.setAttribute('aria-label', 'Close'); dismiss.addEventListener('click', () => { const target = anchor; close(); target?.focus(); });
      header.append(thumbnail, info, dismiss);
      const join = el('a', 'Join'); join.className = 'rc-friend-menu-join'; join.dataset.rcFriendAction = 'join';
      join.addEventListener('click', event => { if (join.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
      const chat = el('button', 'Chat'); chat.type = 'button'; chat.dataset.rcFriendAction = 'chat';
      chat.addEventListener('click', () => {
        if (chat.dataset.rcActionHandled !== 'true') showActionError('chat');
        delete chat.dataset.rcActionHandled;
      });
      const profile = el('a', 'View Profile'); profile.className = 'rc-friend-menu-profile';
      const status = el('p', '', true); status.className = 'rc-friend-menu-status'; status.hidden = true;
      // Keep controls and handlers mounted while friends and live activity change.
      menu.append(header, join, chat, profile, status);
      ui = { thumbnail, image, initial, name, presence, game, join, chat, profile, status };
      menu.addEventListener('pointerenter', () => clearTimeout(leaveTimer));
      menu.addEventListener('pointerleave', leave);
      menu.addEventListener('focusout', event => {
        if (!menu.contains(event.relatedTarget) && event.relatedTarget !== anchor) leaveTimer = setTimeout(close, 140);
      });
      menu.addEventListener('beforetoggle', event => { if (event.newState === 'closed') reset(); });
      document.body.append(menu);
      globalThis.RobloxCustomizerI18n?.localize(menu);
      new ResizeObserver(entries => {
        const size = entries[0]?.borderBoxSize?.[0];
        if (!size || !opened() || size.inlineSize === width && size.blockSize === height) return;
        width = size.inlineSize; height = size.blockSize; geometryDirty = false; queuePosition();
      }).observe(menu);
      new MutationObserver(() => {
        if (!canShow()) close();
      }).observe(document.documentElement, { attributes: true,
        attributeFilter: ['data-rc-features-disabled'] });
    }
    function renderStatus(value, alert = false) {
      const label = t(value), changed = ui.status.hidden !== !label || ui.status.textContent !== label;
      text(ui.status, label); ui.status.hidden = !label; attr(ui.status, 'role', alert ? 'alert' : 'status');
      if (changed) { geometryDirty = true; queuePosition(); }
    }
    function render() {
      const friend = getFriend(currentId);
      if (!friend || !canShow()) { close(); return; }
      const name = friend.displayName || friend.name || String(currentId);
      const image = core.imageUrl(activity?.iconUrl || friend.imageUrl);
      attr(ui.image, 'src', image || null); ui.image.hidden = !image; ui.initial.hidden = !!image;
      text(ui.initial, name.slice(0, 2));
      text(ui.name, activity?.status === 2 ? t('{name} is playing', { name }) : name); attr(ui.name, 'title', ui.name.textContent);
      const game = activity?.status === 2 && activity.location || '';
      text(ui.game, game); ui.game.hidden = !game; attr(ui.game, 'title', game || null);
      attr(ui.game, 'href', game && activity.placeId ? `/games/${activity.placeId}` : null);
      ui.presence.hidden = !!game;
      text(ui.presence, !activity ? failure ? '' : t('Loading…')
        : t(activity.status === 0 ? 'Offline' : activity.status === 3 ? 'In Studio' : activity.status === 2 ? 'Playing now' : 'Online'));
      const joinable = activity?.status === 2 && activity.placeId > 0 && !!activity.gameId;
      attr(ui.join, 'aria-disabled', String(!joinable)); attr(ui.join, 'role', joinable ? null : 'button');
      attr(ui.join, 'href', joinable ? `/games/start?userID=${currentId}&joinAttemptId=${encodeURIComponent(activity.gameId)}&joinAttemptOrigin=JoinUser` : null);
      attr(menu, 'data-game-id', joinable ? activity.gameId : null);
      attr(ui.profile, 'href', `/users/${currentId}/profile`);
      renderStatus(failure || (activity?.status === 2 && !joinable ? 'Roblox has not shared a joinable game for this friend.' : ''), !!failure);
    }
    function showActionError(action) {
      if (!opened()) return;
      failure = action === 'chat' ? 'Roblox could not open chat. Try again after the page finishes loading.'
        : 'Roblox could not join this friend. Check their game status and try again.';
      renderStatus(failure, true);
    }
    async function load(userId, key, token, version) {
      if (token !== sequence || !opened() || !canShow()) return;
      let work = pending.get(key);
      if (!work) {
        work = request('activity', { userId }); pending.set(key, work);
        work.finally(() => pending.delete(key)).catch(() => {});
      }
      try {
        const response = await work;
        if (version !== context()) return;
        if (cache.size >= 30) cache.delete(cache.keys().next().value);
        cache.set(key, { value: response.activity, at: Date.now() });
        if (token !== sequence || userId !== currentId || !opened() || !canShow()) return;
        activity = response.activity; render();
      } catch {
        if (token !== sequence || !opened()) return;
        failure = 'Could not load friend activity. Please try again.'; render();
      }
    }
    function open(userId, clicked = false) {
      cancelHover(); clearTimeout(leaveTimer);
      if (!canShow() || !getFriend(userId)) return;
      ensureMenu();
      if (opened() && currentId === userId) { if (clicked) sticky = true; return; }
      clearTimeout(loadTimer);
      anchor && attr(anchor, 'aria-expanded', 'false');
      const token = ++sequence, version = context();
      currentId = userId; anchor = getAnchor(userId); sticky = clicked; failure = '';
      if (!anchor) return close();
      const key = `${version}:${userId}`, cached = cache.get(key);
      activity = cached && Date.now() - cached.at < 15000 ? cached.value : null;
      attr(menu, 'data-user-id', String(userId)); attr(anchor, 'aria-expanded', 'true');
      render();
      if (!opened()) { style('visibility', 'hidden'); reveal = true; geometryDirty = true; menu.showPopover(); }
      queuePosition();
      // Let the lightweight menu paint first. Fast flyovers never start a request.
      if (!activity) loadTimer = setTimeout(() => load(userId, key, token, version), 60);
    }
    function bind(link, userId) {
      attr(link, 'aria-haspopup', 'dialog'); attr(link, 'aria-controls', 'rc-pinned-friend-menu');
      attr(link, 'aria-expanded', String(currentId === userId && opened()));
      link.addEventListener('pointerenter', event => {
        if (event.pointerType !== 'mouse') return;
        clearTimeout(leaveTimer); cancelHover();
        if (opened()) hoverFrame = requestAnimationFrame(() => open(userId));
        else hoverTimer = setTimeout(() => open(userId), 70);
      });
      link.addEventListener('pointerleave', () => { cancelHover(); leave(); });
      link.addEventListener('click', event => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        if (currentId === userId && opened() && sticky) close();
        else { open(userId, true); if (!event.detail) ui?.chat.focus(); }
      });
    }
    function sync() {
      if (!canShow() || !getFriend(currentId)) { close(); return; }
      if (opened()) {
        anchor = getAnchor(currentId);
        if (!anchor) return close();
        attr(anchor, 'aria-expanded', 'true'); queuePosition();
      }
    }
    document.addEventListener('rc-pinned-friend-action-result', event => {
      let result; try { result = JSON.parse(event.detail); } catch { return; }
      if (result.userId === currentId && result.ok === false) showActionError(result.action);
    });
    addEventListener('resize', () => { geometryDirty = true; queuePosition(); });
    addEventListener('scroll', queuePosition, true); addEventListener('pagehide', close);
    document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
    globalThis.RobloxCustomizerI18n?.onChange(() => { if (opened()) { render(); geometryDirty = true; queuePosition(); } });
    return Object.freeze({ bind, close, sync });
  }
  globalThis.RobloxCustomizerPinnedFriendMenu = Object.freeze({ create });
})();
