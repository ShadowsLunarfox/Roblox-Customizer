(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerPinnedGames;
  const DAY = 86400000;
  let queue = Promise.resolve();
  let refreshRetryAfter = 0;

  // All reads and writes share one worker queue so two tabs cannot exceed the limit.
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
    return core.normalize((await chrome.storage.local.get(core.STORAGE_KEY))[core.STORAGE_KEY]);
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

  async function pin(placeId, pageInfo) {
    const games = await stored();
    if (games.some(game => game.placeId === placeId)) return { ok: true, games, status: 'already-pinned' };
    // A full list rejects immediately without fetching another game's metadata.
    if (games.length >= core.LIMIT) return { ok: false, games, status: 'full' };
    let universeId;
    let game;
    try {
      universeId = Number((await json(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`))?.universeId);
      if (core.validId(universeId)) {
        if (games.some(item => item.universeId === universeId)) return { ok: true, games, status: 'already-pinned' };
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
    if (games.some(item => item.universeId === universeId)) return { ok: true, games, status: 'already-pinned' };
    let thumbnail;
    try { thumbnail = (await icons([universeId])).find(item => Number(item.targetId) === universeId); }
    catch { /* Keep the pin usable while Roblox's thumbnail service is unavailable. */ }
    const image = (thumbnail?.state === 'Completed' ? core.iconUrl(thumbnail.imageUrl) : '')
      || (pageInfo?.universeId === universeId ? core.iconUrl(pageInfo.iconUrl) : '');
    games.push({ placeId: Number(game.rootPlaceId), universeId, name: game.name.trim().slice(0, 200),
      iconUrl: image, updatedAt: image ? Date.now() : 0 });
    await chrome.storage.local.set({ [core.STORAGE_KEY]: games });
    return { ok: true, games, status: 'pinned' };
  }

  async function list() {
    const games = await stored();
    const stale = games.filter(game => Date.now() - game.updatedAt >= DAY);
    if (!stale.length || Date.now() < refreshRetryAfter) return { ok: true, games };
    try {
      const ids = stale.map(game => game.universeId);
      const [data, thumbnails] = await Promise.all([details(ids), icons(ids)]);
      for (const game of stale) {
        const info = data.find(item => Number(item.id) === game.universeId);
        const thumbnail = thumbnails.find(item => Number(item.targetId) === game.universeId);
        if (typeof info?.name === 'string' && info.name.trim()) game.name = info.name.trim().slice(0, 200);
        if (core.validId(Number(info?.rootPlaceId))) game.placeId = Number(info.rootPlaceId);
        const image = thumbnail?.state === 'Completed' ? core.iconUrl(thumbnail.imageUrl) : '';
        if (image) { game.iconUrl = image; game.updatedAt = Date.now(); }
      }
      await chrome.storage.local.set({ [core.STORAGE_KEY]: games });
      refreshRetryAfter = Date.now() + 5 * 60000;
    } catch { refreshRetryAfter = Date.now() + 5 * 60000; }
    return { ok: true, games };
  }

  async function unpin(universeId) {
    const games = (await stored()).filter(game => game.universeId !== universeId);
    await chrome.storage.local.set({ [core.STORAGE_KEY]: games });
    return { ok: true, games, status: 'unpinned' };
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
    else if (message.action === 'pin' && core.validId(message.placeId) && message.placeId === placeId) {
      task = () => pin(placeId, message.pageInfo);
    } else if (message.action === 'unpin' && (home || core.validId(placeId)) && core.validId(message.universeId)) {
      task = () => unpin(message.universeId);
    } else return;
    serial(task).then(sendResponse, () => sendResponse({ ok: false, error: 'Could not update pinned games. Please try again.' }));
    return true;
  });
})();
