(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPinnedGames;
  const DAY = 86400000;
  let queue = Promise.resolve();
  let refreshRetryAfter = 0;

  // Serialize mutations so simultaneous changes in different tabs cannot overwrite each other.
  function serial(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }

  async function json(url, credentials = 'omit') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, { credentials, signal: controller.signal });
      if (!response.ok) throw new Error('Game information unavailable. Please try again.');
      return await response.json();
    } finally { clearTimeout(timeout); }
  }

  async function stored() {
    const value = await chrome.storage.local.get([core.STORAGE_KEY, core.FOLDERS_KEY]);
    return core.state(value[core.STORAGE_KEY], value[core.FOLDERS_KEY]);
  }

  async function save(state) {
    // One storage write keeps folder membership and the folder list consistent in every tab.
    await chrome.storage.local.set({ [core.STORAGE_KEY]: state.games, [core.FOLDERS_KEY]: state.folders });
  }

  async function details(ids) {
    return (await json(`https://games.roblox.com/v1/games?universeIds=${ids.join(',')}`))?.data || [];
  }

  async function icons(ids) {
    const url = new URL('https://thumbnails.roblox.com/v1/games/icons');
    url.search = new URLSearchParams({ universeIds: ids.join(','), returnPolicy: 'PlaceHolder',
      size: '150x150', format: 'Png', isCircular: 'false' });
    return (await json(url.href))?.data || [];
  }

  function validGame(game) {
    return core.validId(Number(game?.id)) && core.validId(Number(game?.rootPlaceId))
      && typeof game?.name === 'string' && !!game.name.trim();
  }

  async function signedInDetails(placeId) {
    // This read uses the current Roblox session; private games need not be playable to be bookmarked.
    const data = await json(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`, 'include');
    const place = Array.isArray(data) ? data.find(item => Number(item?.placeId) === placeId) : null;
    return place && { id: Number(place.universeId), rootPlaceId: Number(place.universeRootPlaceId), name: place.name };
  }

  async function pin(placeId, pageInfo, folderId = '') {
    const state = await stored();
    const { games } = state;
    if (folderId && !state.folders.some(folder => folder.id === folderId)) {
      return { ok: false, ...state, error: 'The game or folder no longer exists.' };
    }
    if (games.some(game => game.placeId === placeId)) return { ok: true, ...state, status: 'already-pinned' };
    let universeId;
    let game;
    try {
      universeId = Number((await json(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`))?.universeId);
      if (core.validId(universeId)) {
        if (games.some(item => item.universeId === universeId)) return { ok: true, ...state, status: 'already-pinned' };
        game = (await details([universeId])).find(item => Number(item.id) === universeId);
      }
    } catch { /* The authenticated endpoint can still resolve a non-public experience. */ }
    if (!validGame(game)) {
      try {
        const info = await signedInDetails(placeId);
        if (validGame(info) && (!core.validId(universeId) || info.id === universeId)) game = info;
      } catch { /* A verified game page can supply the display name when Roblox omits private metadata. */ }
    }
    const verifiedPage = core.validId(universeId) && pageInfo?.universeId === universeId;
    if (!validGame(game) && verifiedPage && typeof pageInfo.name === 'string' && pageInfo.name.trim()) {
      // Only the API-confirmed current place is used; page hints cannot redirect a pin to another place.
      game = { id: universeId, rootPlaceId: placeId, name: pageInfo.name };
    }
    if (!validGame(game)) throw new Error('This game cannot be pinned right now.');
    universeId = Number(game.id);
    if (games.some(item => item.universeId === universeId)) return { ok: true, ...state, status: 'already-pinned' };
    let thumbnail;
    try { thumbnail = (await icons([universeId])).find(item => Number(item.targetId) === universeId); }
    catch { /* Keep the pin usable while Roblox's thumbnail service is unavailable. */ }
    const image = (thumbnail?.state === 'Completed' ? core.iconUrl(thumbnail.imageUrl) : '')
      || (pageInfo?.universeId === universeId ? core.iconUrl(pageInfo.iconUrl) : '');
    const pin = { placeId: Number(game.rootPlaceId), universeId, name: game.name.trim().slice(0, 200),
      iconUrl: image, updatedAt: image ? Date.now() : 0 };
    if (folderId) pin.folderId = folderId;
    games.push(pin);
    await save(state);
    return { ok: true, ...state, status: 'pinned' };
  }

  async function list() {
    const state = await stored();
    const { games } = state;
    const stale = games.filter(game => Date.now() - game.updatedAt >= DAY
      && Date.now() - (game.checkedAt || 0) >= 5 * 60000);
    if (!stale.length || Date.now() < refreshRetryAfter) return { ok: true, ...state };
    // Refresh a small rotating batch; a large library must not create oversized API URLs
    // or hold up the mutation queue while every saved game is refreshed.
    // Persist each check time so blocked private thumbnails cannot starve later pins,
    // including when Chrome restarts the worker between visits.
    const batch = stale.sort((a, b) => (a.checkedAt || 0) - (b.checkedAt || 0)).slice(0, 10);
    try {
      const ids = batch.map(game => game.universeId);
      const [data, thumbnails] = await Promise.all([details(ids), icons(ids)]);
      for (const game of batch) {
        const info = data.find(item => Number(item.id) === game.universeId);
        const thumbnail = thumbnails.find(item => Number(item.targetId) === game.universeId);
        if (typeof info?.name === 'string' && info.name.trim()) game.name = info.name.trim().slice(0, 200);
        if (core.validId(Number(info?.rootPlaceId))) game.placeId = Number(info.rootPlaceId);
        const image = thumbnail?.state === 'Completed' ? core.iconUrl(thumbnail.imageUrl) : '';
        if (image) { game.iconUrl = image; game.updatedAt = Date.now(); }
        game.checkedAt = Date.now();
      }
      await save(state);
      refreshRetryAfter = Date.now() + 5 * 60000;
    } catch { refreshRetryAfter = Date.now() + 5 * 60000; }
    return { ok: true, ...state };
  }

  async function unpin(universeId) {
    const state = await stored();
    state.games = state.games.filter(game => game.universeId !== universeId);
    await save(state);
    return { ok: true, ...state, status: 'unpinned' };
  }

  async function editFolders(message, currentPlaceId = 0) {
    const state = await stored();
    const folder = state.folders.find(item => item.id === message.folderId);
    if (message.action === 'create-folder') {
      const id = crypto.randomUUID();
      state.folders.push({ id, name: core.folderName(message.name) });
      await save(state);
      return { ok: true, ...state, folderId: id };
    }
    if (message.action === 'move') {
      const game = state.games.find(item => item.universeId === message.universeId);
      if (!game || message.folderId && !folder) return { ok: false, ...state, error: 'The game or folder no longer exists.' };
      if (currentPlaceId && game.placeId !== currentPlaceId) {
        // A subplace is allowed only when the official API confirms the same universe.
        const universe = await json(`https://apis.roblox.com/universes/v1/places/${currentPlaceId}/universe`);
        if (Number(universe?.universeId) !== game.universeId) return { ok: false, ...state, error: 'The game or folder no longer exists.' };
      }
      if (folder) game.folderId = folder.id;
      else delete game.folderId;
    } else {
      if (!folder) return { ok: false, ...state, error: 'The game or folder no longer exists.' };
      if (message.action === 'rename-folder') folder.name = core.folderName(message.name);
      else {
        state.folders = state.folders.filter(item => item.id !== folder.id);
        for (const game of state.games) if (game.folderId === folder.id) delete game.folderId;
      }
    }
    await save(state);
    return { ok: true, ...state };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'rc-pinned-games') return;
    let source;
    try { source = new URL(sender.url); } catch { return; }
    if (source.protocol !== 'https:' || !['www.roblox.com', 'roblox.com'].includes(source.hostname)
      || sender.id && sender.id !== chrome.runtime.id) return;
    const home = /^\/home\/?$/i.test(source.pathname);
    const placeId = Number(source.pathname.match(/^\/games\/(\d+)(?:\/|$)/i)?.[1]);
    let task;
    if (message.action === 'list' && (home || core.validId(placeId))) task = list;
    else if (message.action === 'pin' && core.validId(message.placeId) && message.placeId === placeId
      && (message.folderId === undefined || message.folderId === '' || core.validFolderId(message.folderId))) {
      task = () => pin(placeId, message.pageInfo, message.folderId);
    } else if (message.action === 'unpin' && (home || core.validId(placeId)) && core.validId(message.universeId)) {
      task = () => unpin(message.universeId);
    } else if (home && message.action === 'create-folder' && core.folderName(message.name)) {
      task = () => editFolders(message);
    } else if (home && ['rename-folder', 'delete-folder'].includes(message.action)
      && core.validFolderId(message.folderId) && (message.action !== 'rename-folder' || core.folderName(message.name))) {
      task = () => editFolders(message);
    } else if ((home || core.validId(placeId) && message.placeId === placeId)
      && message.action === 'move' && core.validId(message.universeId)
      && (message.folderId === '' || core.validFolderId(message.folderId))) {
      task = () => editFolders(message, home ? 0 : placeId);
    } else return;
    serial(task).then(sendResponse, () => sendResponse({ ok: false, error: 'Could not update pinned games. Please try again.' }));
    return true;
  });
})();
