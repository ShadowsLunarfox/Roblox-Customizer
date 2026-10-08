(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPinnedGames;
  const HOME_PATH = /^\/home\/?$/i;
  const GAME_PATH = /^\/games\/(\d+)(?:\/|$)/i;
  const OBSERVE = { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-place-id', 'data-universe-id', 'id'] };
  let games = [];
  let ready = false;
  let queued = false;
  let pinControl = null;
  let homeSection = null;
  let rendered = '';
  let busy = false;
  let loadedRoute = '';
  let toastTimer = 0;
  let storageVersion = 0;

  function request(action, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'rc-pinned-games', action, ...data }, response => {
        if (chrome.runtime.lastError || !response) reject(new Error('Could not update pinned games. Please try again.'));
        else resolve(response);
      });
    });
  }

  function notify(text) {
    let toast = document.getElementById('rc-pinned-games-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'rc-pinned-games-notification';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
  }

  function accept(response, version = storageVersion) {
    if (version === storageVersion && Array.isArray(response?.games)) games = core.normalize(response.games);
    ready = true;
    queueSync();
  }

  function gameContext() {
    const placeId = Number(location.pathname.match(GAME_PATH)?.[1]);
    if (!core.validId(placeId)) return null;
    const page = document.getElementById('game-detail-page');
    const meta = page?.querySelector('#game-detail-meta-data');
    const renderedId = Number(meta?.dataset.placeId || page?.dataset.placeId);
    if (renderedId !== placeId) return null;
    return { page, placeId, universeId: Number(meta?.dataset.universeId) };
  }

  function pinned(context) {
    return games.find(game => game.universeId === context.universeId || game.placeId === context.placeId);
  }

  async function togglePin() {
    const context = gameContext();
    if (!context || busy || !ready) return;
    const existing = pinned(context);
    busy = true;
    const version = storageVersion;
    queueSync();
    try {
      const response = await request(existing ? 'unpin' : 'pin', existing
        ? { universeId: existing.universeId } : { placeId: context.placeId });
      accept(response, version);
      if (response.status === 'full') notify('List Full');
      else if (!response.ok) notify(response.error || 'Could not update pinned games. Please try again.');
      else notify(existing ? 'Game unpinned' : 'Game pinned to Home');
    } catch (error) { notify(error.message); }
    finally { busy = false; queueSync(); }
  }

  function syncPin() {
    const context = gameContext();
    const favorite = context?.page.querySelector('#toggle-game-favorite');
    const anchor = favorite?.closest('.game-favorite-button-container') || favorite?.closest('li');
    if (!anchor?.parentElement) {
      pinControl?.remove(); pinControl = null;
      return;
    }
    if (!pinControl) {
      pinControl = document.createElement(anchor.tagName === 'LI' ? 'li' : 'div');
      pinControl.className = 'rc-game-pin-control';
      pinControl.innerHTML = '<button type="button" id="rc-pin-game" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 3 6 6-3 1-4 4v4l-2 2-4-4-5 5 5-5-4-4 2-2h4l4-4z"/></svg><span class="icon-label">Pin Game</span></button>';
      pinControl.querySelector('button').addEventListener('click', togglePin);
    }
    if (pinControl.parentElement !== anchor.parentElement || pinControl.nextElementSibling !== anchor) {
      anchor.before(pinControl);
    }
    const button = pinControl.querySelector('button');
    const isPinned = !!pinned(context);
    button.disabled = !ready || busy;
    button.setAttribute('aria-pressed', String(isPinned));
    button.title = isPinned ? 'Unpin game from Home' : 'Pin game to Home';
    const label = isPinned ? 'Unpin Game' : 'Pin Game';
    if (button.lastElementChild.textContent !== label) button.lastElementChild.textContent = label;
  }

  function card(game) {
    const node = document.createElement('article');
    node.className = 'rc-pinned-game-card';
    node.dataset.universeId = String(game.universeId);
    const link = document.createElement('a');
    link.className = 'rc-pinned-game-details';
    link.href = `/games/${game.placeId}`;
    const art = document.createElement('span');
    art.className = 'rc-pinned-game-art';
    const initial = document.createElement('span');
    initial.textContent = [...game.name][0];
    initial.setAttribute('aria-hidden', 'true');
    art.append(initial);
    if (game.iconUrl) {
      const image = document.createElement('img');
      image.alt = ''; image.src = game.iconUrl;
      image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => image.remove(), { once: true });
      art.append(image);
    }
    const name = document.createElement('h3');
    name.textContent = game.name; name.title = game.name;
    link.append(art, name);
    const join = document.createElement('a');
    join.className = 'rc-pinned-game-join';
    join.href = `/games/${game.placeId}`;
    join.textContent = 'Join Game';
    join.dataset.rcPinnedPlaceId = String(game.placeId);
    join.setAttribute('aria-label', `Join ${game.name}`);
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'rc-pinned-game-remove';
    remove.textContent = '×'; remove.title = 'Unpin game';
    remove.setAttribute('aria-label', `Unpin ${game.name}`);
    remove.addEventListener('click', async () => {
      if (remove.disabled) return;
      remove.disabled = true;
      const version = storageVersion;
      try {
        const response = await request('unpin', { universeId: game.universeId });
        if (!response.ok) throw new Error(response.error);
        accept(response, version);
      } catch (error) { notify(error.message); remove.disabled = false; }
    });
    node.append(link, join, remove);
    return node;
  }

  function syncHome() {
    const home = HOME_PATH.test(location.pathname)
      ? document.querySelector('#HomeContainer, .home-container, [data-testid="home-page"]') : null;
    const friends = home?.querySelector('.friend-carousel-container');
    if (!friends?.parentElement || !ready) {
      homeSection?.remove(); homeSection = null; rendered = '';
      return;
    }
    if (!homeSection) {
      homeSection = document.createElement('section');
      homeSection.id = 'rc-pinned-games';
      homeSection.setAttribute('aria-labelledby', 'rc-pinned-games-title');
      homeSection.innerHTML = '<div class="rc-pinned-games-heading"><h2 id="rc-pinned-games-title">Pinned Games</h2><span class="rc-pinned-games-count"></span></div><div class="rc-pinned-games-grid"></div><p class="rc-pinned-games-empty">Pin games using the button beside Favorite on a game page.</p>';
    }
    // Keep native friends and game carousels in their existing React-owned parents.
    if (homeSection.parentElement !== friends.parentElement || friends.nextElementSibling !== homeSection) {
      friends.after(homeSection);
    }
    const signature = JSON.stringify(games);
    if (signature !== rendered) {
      homeSection.querySelector('.rc-pinned-games-grid').replaceChildren(...games.map(card));
      rendered = signature;
    }
    const count = `${games.length} / ${core.LIMIT}`;
    const counter = homeSection.querySelector('.rc-pinned-games-count');
    if (counter.textContent !== count) counter.textContent = count;
    homeSection.querySelector('.rc-pinned-games-empty').hidden = games.length > 0;
  }

  function sync() {
    syncPin();
    syncHome();
    const route = HOME_PATH.test(location.pathname) || GAME_PATH.test(location.pathname) ? location.pathname : '';
    if (route !== loadedRoute) {
      loadedRoute = route;
      if (route) {
        const version = storageVersion;
        request('list').then(response => {
          if (version === storageVersion) accept(response);
        }).catch(() => {});
      }
    }
  }

  function queueSync() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      observer.disconnect();
      try { sync(); }
      finally { observer.observe(document, OBSERVE); }
    });
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => !record.target.parentElement?.closest(
      '#rc-pinned-games, .rc-game-pin-control, #rc-pinned-games-notification, #rc-home-greeting'))) queueSync();
  });
  observer.observe(document, OBSERVE);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[core.STORAGE_KEY]) return;
    storageVersion++;
    games = core.normalize(changes[core.STORAGE_KEY].newValue);
    ready = true;
    queueSync();
  });
  const initialVersion = storageVersion;
  chrome.storage.local.get(core.STORAGE_KEY).then(result => {
    if (initialVersion === storageVersion) games = core.normalize(result[core.STORAGE_KEY]);
    ready = true; queueSync();
  }).catch(() => { ready = true; queueSync(); });
  document.addEventListener('rc-pinned-game-launch-error', () => notify('Could not join this game. Open its page and try again.'));
  addEventListener('popstate', queueSync);
  addEventListener('hashchange', queueSync);
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
  queueSync();
})();
