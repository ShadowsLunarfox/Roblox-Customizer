(() => {
  'use strict';
  const sendMessage = globalThis.RobloxCustomizerRuntime?.sendMessage
    || ((...args) => chrome.runtime.sendMessage(...args));
  const core = globalThis.RobloxCustomizerPinnedGames;
  const HOME_PATH = /^\/home\/?$/i;
  const GAME_PATH = /^\/games\/(\d+)(?:\/|$)/i;
  const OBSERVE = { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-place-id', 'data-universe-id', 'id'] };
  let games = [];
  let folders = [];
  let selectedFolder = '*';
  let visibleLimit = 24;
  let homeBusy = false;
  let editingFolder = null;
  let ready = false;
  let queued = false;
  let pinControl = null;
  let pinFolderControl = null;
  let gameFolderPlaceId = 0;
  let gameFolder = '';
  let pinPromptPlaceId = 0;
  let focusPinPrompt = false;
  const folderSelects = new WeakMap();
  let homeSection = null;
  let rendered = '';
  let busy = false;
  let loadedRoute = '';
  let toastTimer = 0;
  let storageVersion = 0;

  function request(action, data = {}) {
    return new Promise((resolve, reject) => {
      sendMessage({ type: 'rc-pinned-games', action, ...data }, response => {
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
    if (version === storageVersion && Array.isArray(response?.games)) {
      const state = core.state(response.games, response.folders ?? folders);
      games = state.games; folders = state.folders;
    }
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
    return { page, placeId, universeId: Number(meta?.dataset.universeId),
      name: meta?.dataset.placeName || page.querySelector('.game-name, .game-title-container h1, h1')?.textContent || '',
      iconUrl: core.iconUrl(page.querySelector('#game-details-carousel-container img, .game-thumbnail img')?.src) };
  }

  function pinned(context) {
    return games.find(game => game.universeId === context.universeId || game.placeId === context.placeId);
  }

  function togglePin() {
    const context = gameContext();
    if (!context || busy || !ready) return;
    const existing = pinned(context);
    if (existing) { updatePin(context, existing); return; }
    pinPromptPlaceId = context.placeId;
    focusPinPrompt = true;
    queueSync();
  }

  function cancelPinPrompt() {
    if (busy) return;
    pinPromptPlaceId = 0; focusPinPrompt = false;
    queueSync();
    pinControl?.querySelector('button')?.focus();
  }

  async function updatePin(context, existing) {
    busy = true;
    const version = storageVersion;
    queueSync();
    try {
      const response = await request(existing ? 'unpin' : 'pin', existing
        ? { universeId: existing.universeId } : { placeId: context.placeId,
          folderId: gameFolder,
          pageInfo: { universeId: context.universeId, name: context.name, iconUrl: context.iconUrl } });
      accept(response, version);
      if (!response.ok) notify(response.error || 'Could not update pinned games. Please try again.');
      else {
        if (pinPromptPlaceId === context.placeId) pinPromptPlaceId = 0;
        notify(existing ? 'Game unpinned' : 'Game pinned to Home');
      }
    } catch (error) { notify(error.message); }
    finally { busy = false; queueSync(); }
  }

  function populateFolderSelect(select) {
    const signature = JSON.stringify(folders);
    if (folderSelects.get(select) !== signature) {
      const uncategorized = document.createElement('option');
      uncategorized.value = ''; uncategorized.textContent = 'Uncategorized';
      const options = folders.map(folder => {
        const option = document.createElement('option');
        option.value = folder.id; option.textContent = folder.name;
        option.dataset.rcI18nIgnore = '';
        return option;
      });
      select.replaceChildren(uncategorized, ...options);
      folderSelects.set(select, signature);
    }
    const label = select.firstElementChild;
    if (!(globalThis.RobloxCustomizerI18n?.matches(label, 'Uncategorized') ?? label.textContent === 'Uncategorized')) label.textContent = 'Uncategorized';
  }

  async function changeGameFolder() {
    const context = gameContext();
    const select = pinFolderControl?.querySelector('select');
    if (!context || !select || context.placeId !== gameFolderPlaceId || busy || !ready) return;
    const previous = gameFolder;
    gameFolder = select.value;
    const existing = pinned(context);
    // For a new pin the selection is saved atomically when Pin Game is clicked.
    if (!existing) return;
    busy = true;
    const version = storageVersion;
    queueSync();
    try {
      const response = await request('move', { placeId: context.placeId,
        universeId: existing.universeId, folderId: gameFolder });
      accept(response, version);
      if (!response.ok) throw new Error(response.error || 'Could not update pinned games. Please try again.');
      notify('Pinned game moved.');
    } catch (error) {
      if (gameFolderPlaceId === context.placeId) gameFolder = previous;
      notify(error.message);
    } finally { busy = false; queueSync(); }
  }

  function syncGameFolder(context, row, existing) {
    if (gameFolderPlaceId !== context.placeId) {
      gameFolderPlaceId = context.placeId;
      gameFolder = existing?.folderId || '';
      pinPromptPlaceId = 0; focusPinPrompt = false;
    }
    if (existing && pinPromptPlaceId === context.placeId) pinPromptPlaceId = 0;
    if (!busy && existing) gameFolder = existing.folderId || '';
    if (gameFolder && !folders.some(folder => folder.id === gameFolder)) gameFolder = '';
    if (!pinFolderControl) {
      pinFolderControl = document.createElement('form');
      pinFolderControl.id = 'rc-game-pin-folder-panel';
      pinFolderControl.className = 'rc-game-pin-folder';
      pinFolderControl.innerHTML = '<label for="rc-pin-game-folder">Pinned game folder</label><select id="rc-pin-game-folder" aria-describedby="rc-pin-game-folder-help"></select><p id="rc-pin-game-folder-help"></p><div class="rc-game-pin-folder-actions"><button type="submit" id="rc-confirm-pin-game">Pin Game</button><button type="button" class="rc-cancel-pin-game">Cancel</button></div>';
      pinFolderControl.querySelector('select').addEventListener('change', changeGameFolder);
      pinFolderControl.querySelector('.rc-cancel-pin-game').addEventListener('click', cancelPinPrompt);
      pinFolderControl.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !busy) { event.preventDefault(); cancelPinPrompt(); }
      });
      pinFolderControl.addEventListener('submit', event => {
        event.preventDefault();
        const current = gameContext();
        if (current?.placeId === pinPromptPlaceId && !pinned(current) && ready && !busy) updatePin(current, null);
      });
    }
    // Keep the icon row at its original size; place the selector directly below it.
    const anchor = row || (/^(UL|OL)$/.test(pinControl.parentElement.tagName) ? pinControl.parentElement : pinControl);
    if (pinFolderControl.parentElement !== anchor.parentElement || anchor.nextElementSibling !== pinFolderControl) anchor.after(pinFolderControl);
    const select = pinFolderControl.querySelector('select');
    const label = pinFolderControl.querySelector('label');
    if (!(globalThis.RobloxCustomizerI18n?.matches(label, 'Pinned game folder') ?? label.textContent === 'Pinned game folder')) label.textContent = 'Pinned game folder';
    populateFolderSelect(select);
    select.value = gameFolder;
    select.disabled = !ready || busy;
    const promptOpen = pinPromptPlaceId === context.placeId;
    pinFolderControl.hidden = !existing && !promptOpen;
    pinFolderControl.querySelector('.rc-game-pin-folder-actions').hidden = !!existing;
    for (const button of pinFolderControl.querySelectorAll('button')) button.disabled = !ready || busy;
    const pinButton = pinControl.querySelector('button');
    if (existing) {
      pinButton.removeAttribute('aria-expanded'); pinButton.removeAttribute('aria-controls');
    } else {
      pinButton.setAttribute('aria-expanded', String(promptOpen));
      pinButton.setAttribute('aria-controls', pinFolderControl.id);
    }
    const help = pinFolderControl.querySelector('p');
    const text = !folders.length ? 'Create folders in Pinned Games on Home.'
      : existing ? 'Changing this folder moves the pinned game.' : 'Choose a folder, then pin this game.';
    if (!(globalThis.RobloxCustomizerI18n?.matches(help, text) ?? help.textContent === text)) help.textContent = text;
    // A remounted form may have lost its translation bindings while detached.
    for (const [selector, text] of [['#rc-confirm-pin-game', 'Pin Game'], ['.rc-cancel-pin-game', 'Cancel']]) {
      const button = pinFolderControl.querySelector(selector);
      if (!(globalThis.RobloxCustomizerI18n?.matches(button, text) ?? button.textContent === text)) button.textContent = text;
    }
    if (focusPinPrompt && promptOpen && !busy) { select.focus(); focusPinPrompt = false; }
  }

  function syncPin() {
    const context = gameContext();
    const favorite = context?.page.querySelector('#toggle-game-favorite');
    const favoriteAnchor = favorite?.closest('.game-favorite-button-container') || favorite?.closest('li');
    const row = context?.page.querySelector('.favorite-follow-vote-share');
    const parent = favoriteAnchor?.parentElement || row
      || context?.page.querySelector('.game-buttons-container, .game-calls-to-action') || context?.page;
    if (!parent) {
      pinControl?.remove(); pinControl = null;
      pinFolderControl?.remove(); pinFolderControl = null;
      gameFolderPlaceId = 0; gameFolder = '';
      pinPromptPlaceId = 0; focusPinPrompt = false;
      return;
    }
    const anchor = favoriteAnchor || row?.querySelector(':scope > :not(.rc-game-pin-control)');
    const tag = /^(UL|OL)$/.test(parent.tagName) ? 'LI' : 'DIV';
    if (pinControl && pinControl.tagName !== tag) { pinControl.remove(); pinControl = null; }
    if (!pinControl) {
      pinControl = document.createElement(tag);
      pinControl.className = 'rc-game-pin-control';
      pinControl.innerHTML = '<button type="button" id="rc-pin-game" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 3 6 6-3 1-4 4v4l-2 2-4-4-5 5 5-5-4-4 2-2h4l4-4z"/></svg><span class="icon-label">Pin Game</span></button>';
      pinControl.querySelector('button').addEventListener('click', togglePin);
    }
    pinControl.classList.toggle('rc-game-pin-standalone', !favoriteAnchor && !row);
    if (anchor && (pinControl.parentElement !== parent || pinControl.nextElementSibling !== anchor)) {
      anchor.before(pinControl);
    } else if (!anchor && (pinControl.parentElement !== parent || parent.lastElementChild !== pinControl
      && !(pinControl.nextElementSibling === pinFolderControl && parent.lastElementChild === pinFolderControl))) parent.append(pinControl);
    const button = pinControl.querySelector('button');
    const existing = pinned(context);
    const isPinned = !!existing;
    button.disabled = !ready || busy;
    button.setAttribute('aria-pressed', String(isPinned));
    const title = isPinned ? 'Unpin game from Home' : 'Pin game to Home';
    if (globalThis.RobloxCustomizerI18n) globalThis.RobloxCustomizerI18n.attribute(button, 'title', title);
    else button.title = title;
    const label = isPinned ? 'Unpin Game' : 'Pin Game';
    if (!(globalThis.RobloxCustomizerI18n?.matches(button.lastElementChild, label)
      ?? button.lastElementChild.textContent === label)) button.lastElementChild.textContent = label;
    syncGameFolder(context, row, existing);
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
    const moveLabel = document.createElement('label');
    moveLabel.className = 'rc-pinned-game-folder';
    const caption = document.createElement('span');
    caption.textContent = 'Folder';
    const move = document.createElement('select');
    move.className = 'rc-pinned-game-move';
    move.setAttribute('aria-label', `Folder for ${game.name}`);
    populateFolderSelect(move);
    move.value = game.folderId || '';
    move.addEventListener('change', async () => {
      const response = await changeFolders('move', { universeId: game.universeId, folderId: move.value });
      if (!response?.ok) move.value = game.folderId || '';
      else if (selectedFolder !== '*') homeSection?.querySelector('.rc-pinned-folder-filter[aria-pressed="true"]')?.focus();
    });
    moveLabel.append(caption, move);
    node.append(link, join, moveLabel, remove);
    return node;
  }

  async function changeFolders(action, data) {
    if (homeBusy) return null;
    homeBusy = true;
    const version = storageVersion;
    queueSync();
    try {
      const response = await request(action, data);
      accept(response, version);
      if (!response.ok) notify(response.error || 'Could not update pinned games. Please try again.');
      return response;
    } catch (error) { notify(error.message); return null; }
    finally { homeBusy = false; queueSync(); }
  }

  function closeEditor() {
    editingFolder = null;
    if (homeSection) homeSection.querySelector('.rc-pinned-folder-editor').hidden = true;
  }

  function openEditor(folder = null) {
    editingFolder = folder?.id || '';
    const form = homeSection.querySelector('.rc-pinned-folder-editor');
    form.hidden = false;
    form.elements.name.value = folder?.name || '';
    form.elements.name.focus();
    form.elements.name.select();
  }

  function createHomeSection() {
    const section = document.createElement('section');
    section.id = 'rc-pinned-games';
    section.setAttribute('aria-labelledby', 'rc-pinned-games-title');
    section.innerHTML = '<div class="rc-pinned-games-heading"><div><h2 id="rc-pinned-games-title">Pinned Games</h2><span class="rc-pinned-games-count"></span></div><button type="button" class="rc-pinned-folder-new">New folder</button></div>'
      + '<div class="rc-pinned-folder-toolbar"><div class="rc-pinned-folder-filters" role="group" aria-label="Game folders"></div><div class="rc-pinned-folder-actions" hidden><button type="button" class="rc-pinned-folder-rename">Rename folder</button><button type="button" class="rc-pinned-folder-delete">Delete folder</button></div></div>'
      + '<form class="rc-pinned-folder-editor" hidden><label for="rc-pinned-folder-name">Folder name</label><input id="rc-pinned-folder-name" name="name" type="text" maxlength="80" required autocomplete="off"><button type="submit">Save folder</button><button type="button" class="rc-pinned-folder-cancel">Cancel</button></form>'
      + '<div class="rc-pinned-games-grid"></div><p class="rc-pinned-games-empty">Use Pin Game on a game page to add public or private games here.</p>'
      + '<p class="rc-pinned-folder-empty" hidden>No games in this folder. Choose a folder on a pinned game to move it here.</p><button type="button" class="rc-pinned-games-more" hidden>Show more games</button>';
    section.querySelector('.rc-pinned-folder-new').addEventListener('click', () => openEditor());
    section.querySelector('.rc-pinned-folder-rename').addEventListener('click', () => {
      const folder = folders.find(item => item.id === selectedFolder);
      if (folder) openEditor(folder);
    });
    section.querySelector('.rc-pinned-folder-delete').addEventListener('click', async () => {
      const folderId = selectedFolder;
      const response = await changeFolders('delete-folder', { folderId });
      if (response?.ok) {
        selectedFolder = ''; visibleLimit = 24; closeEditor();
        notify('Folder deleted. Its games are now Uncategorized.');
        queueSync();
      }
    });
    section.querySelector('.rc-pinned-folder-cancel').addEventListener('click', () => {
      closeEditor(); section.querySelector('.rc-pinned-folder-new').focus();
    });
    section.querySelector('.rc-pinned-folder-editor').addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault(); closeEditor(); section.querySelector('.rc-pinned-folder-new').focus();
      }
    });
    section.querySelector('.rc-pinned-folder-editor').addEventListener('submit', async event => {
      event.preventDefault();
      const input = event.currentTarget.elements.name;
      const name = core.folderName(input.value);
      if (!name) { input.focus(); return; }
      const folderId = editingFolder;
      const response = await changeFolders(folderId ? 'rename-folder' : 'create-folder', { folderId, name });
      if (response?.ok) {
        selectedFolder = response.folderId || folderId;
        visibleLimit = 24; closeEditor(); queueSync();
        section.querySelector('.rc-pinned-folder-new').focus();
      }
    });
    section.querySelector('.rc-pinned-games-more').addEventListener('click', () => {
      visibleLimit += 24; queueSync();
    });
    return section;
  }

  function folderFilter(id, name, count, custom = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'rc-pinned-folder-filter';
    button.dataset.folderId = id;
    button.setAttribute('aria-pressed', String(selectedFolder === id));
    const label = document.createElement('span');
    label.textContent = name;
    if (custom) label.dataset.rcI18nIgnore = '';
    const total = document.createElement('span');
    total.className = 'rc-pinned-folder-count'; total.textContent = String(count);
    button.append(label, total);
    button.addEventListener('click', () => {
      selectedFolder = id; visibleLimit = 24; closeEditor(); queueSync();
    });
    return button;
  }

  function syncHome() {
    const home = HOME_PATH.test(location.pathname)
      ? document.querySelector('#HomeContainer, .home-container, [data-testid="home-page"]') : null;
    const friends = home?.querySelector('.friend-carousel-container');
    if (!friends?.parentElement || !ready) {
      homeSection?.remove(); homeSection = null; rendered = ''; editingFolder = null;
      return;
    }
    if (!homeSection) homeSection = createHomeSection();
    // Keep native friends and game carousels in their existing React-owned parents.
    if (homeSection.parentElement !== friends.parentElement || friends.nextElementSibling !== homeSection) {
      friends.after(homeSection);
    }
    if (selectedFolder && selectedFolder !== '*' && !folders.some(folder => folder.id === selectedFolder)) {
      selectedFolder = '*'; visibleLimit = 24;
    }
    if (editingFolder && !folders.some(folder => folder.id === editingFolder)) closeEditor();
    const filtered = selectedFolder === '*' ? games : games.filter(game => (game.folderId || '') === selectedFolder);
    const signature = JSON.stringify([games, folders, selectedFolder, visibleLimit]);
    if (signature !== rendered) {
      const filters = homeSection.querySelector('.rc-pinned-folder-filters');
      const focusedId = filters.contains(document.activeElement) ? document.activeElement.dataset.folderId : null;
      const counts = new Map();
      for (const game of games) counts.set(game.folderId || '', (counts.get(game.folderId || '') || 0) + 1);
      const entries = [['*', 'All games', games.length, false], ['', 'Uncategorized', counts.get('') || 0, false],
        ...folders.map(folder => [folder.id, folder.name, counts.get(folder.id) || 0, true])];
      const existing = new Map([...filters.children].map(button => [button.dataset.folderId, button]));
      const keep = new Set(entries.map(([id]) => id));
      for (const [id, button] of existing) if (!keep.has(id)) button.remove();
      // Keep filter buttons mounted during card updates so quick clicks and keyboard
      // focus are not lost when another tab changes a folder or a game is moved.
      entries.forEach(([id, name, total, custom], index) => {
        const button = existing.get(id) || folderFilter(id, name, total, custom);
        const label = button.firstElementChild;
        const matches = custom ? label.textContent === name
          : (globalThis.RobloxCustomizerI18n?.matches(label, name) ?? label.textContent === name);
        if (!matches) label.textContent = name;
        if (button.lastElementChild.textContent !== String(total)) button.lastElementChild.textContent = String(total);
        const pressed = String(selectedFolder === id);
        if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
        if (filters.children[index] !== button) filters.insertBefore(button, filters.children[index] || null);
      });
      if (focusedId !== null && !keep.has(focusedId)) [...filters.children].find(button => button.dataset.folderId === selectedFolder)?.focus();
      homeSection.querySelector('.rc-pinned-games-grid').replaceChildren(...filtered.slice(0, visibleLimit).map(card));
      rendered = signature;
    }
    const count = `${games.length} games`;
    const counter = homeSection.querySelector('.rc-pinned-games-count');
    if (!(globalThis.RobloxCustomizerI18n?.matches(counter, count) ?? counter.textContent === count)) counter.textContent = count;
    homeSection.querySelector('.rc-pinned-games-empty').hidden = games.length > 0;
    homeSection.querySelector('.rc-pinned-folder-empty').hidden = filtered.length > 0 || selectedFolder === '*' || !games.length;
    homeSection.querySelector('.rc-pinned-games-more').hidden = filtered.length <= visibleLimit;
    homeSection.querySelector('.rc-pinned-folder-actions').hidden = !selectedFolder || selectedFolder === '*';
    for (const control of homeSection.querySelectorAll('.rc-pinned-game-move, .rc-pinned-folder-new, .rc-pinned-folder-actions button, .rc-pinned-folder-editor input, .rc-pinned-folder-editor button')) control.disabled = homeBusy;
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
      '#rc-pinned-games, .rc-game-pin-control, .rc-game-pin-folder, #rc-pinned-games-notification, #rc-home-greeting'))) queueSync();
  });
  observer.observe(document, OBSERVE);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[core.STORAGE_KEY] && !changes[core.FOLDERS_KEY]) return;
    storageVersion++;
    const state = core.state(changes[core.STORAGE_KEY] ? changes[core.STORAGE_KEY].newValue : games,
      changes[core.FOLDERS_KEY] ? changes[core.FOLDERS_KEY].newValue : folders);
    games = state.games; folders = state.folders;
    ready = true;
    queueSync();
  });
  const initialVersion = storageVersion;
  chrome.storage.local.get([core.STORAGE_KEY, core.FOLDERS_KEY]).then(result => {
    if (initialVersion === storageVersion) {
      const state = core.state(result[core.STORAGE_KEY], result[core.FOLDERS_KEY]);
      games = state.games; folders = state.folders;
    }
    ready = true; queueSync();
  }).catch(() => { ready = true; queueSync(); });
  document.addEventListener('rc-pinned-game-launch-error', () => notify('Could not join this game. Open its page and try again.'));
  addEventListener('popstate', queueSync);
  addEventListener('hashchange', queueSync);
  globalThis.RobloxCustomizerRuntime?.onResume(queueSync);
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
  queueSync();
})();
