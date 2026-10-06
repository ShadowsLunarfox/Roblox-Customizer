if (typeof importScripts === 'function') {
  importScripts('robux-currency-core.js', 'robux-currency-background.js',
    'pinned-games-core.js', 'pinned-games-background.js');
}

const BADGE_QUERY = 'rc-badge-ownership';
const PRIVATE_SERVER_QUERY = 'rc-private-server-details';
const PUBLIC_SERVER_STATUS_QUERY = 'rc-public-server-status';
const PUBLIC_SERVER_COUNTRY_QUERY = 'rc-public-server-country';
const GAME_X_LINK_QUERY = 'rc-game-x-link';
const GAME_YOUTUBE_LINK_QUERY = 'rc-game-youtube-link';
const COMMUNITY_SOCIAL_LINKS_QUERY = 'rc-community-social-links';
const SOCIAL_FEED_PATH = /^(?:\/(?:games|communities|groups)\/\d+|\/users\/\d+\/profile)(?:\/|$)/i;
const X_POSTS_QUERY = 'rc-x-posts';
const X_IMAGE_QUERY = 'rc-x-image';
const YOUTUBE_VIDEOS_QUERY = 'rc-youtube-videos';
const YOUTUBE_IMAGE_QUERY = 'rc-youtube-image';
const PROFILE_DETAILS_QUERY = 'rc-profile-details';
const PROFILE_LIMITEDS_QUERY = 'rc-profile-limiteds';
const AVATAR_2D_QUERY = 'rc-avatar-2d';
const CATALOG_ITEM_2D_QUERY = 'rc-catalog-item-2d';
const HOME_USER_QUERY = 'rc-home-user';
const ROLIMONS_GAME_QUERY = 'rc-rolimons-game-page';
const ROBLOX_GAME_DATA_QUERY = 'rc-roblox-game-data';
const BATCH_SIZE = 50;
const limitedInventoryCache = new Map();
const rolimonsGameCache = new Map();
const youtubeFeedCache = new Map();
const publicServerCountryCache = new Map();
const publicAddressCountryCache = new Map();
let joinHeaderReady;

async function readJson(url) {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) throw new Error(`Roblox returned ${response.status}`);
  return response.json();
}

async function getAvatar2D() {
  const account = await readJson('https://users.roblox.com/v1/users/authenticated');
  const userId = Number(account?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Sign in to view your avatar.');
  const url = new URL('https://thumbnails.roblox.com/v1/users/avatar');
  url.searchParams.set('userIds', String(userId));
  url.searchParams.set('size', '420x420');
  url.searchParams.set('format', 'Png');
  url.searchParams.set('isCircular', 'false');
  const result = await readJson(url.href);
  const thumbnail = result?.data?.find(item => Number(item?.targetId) === userId);
  if (!thumbnail) throw new Error('Avatar preview unavailable.');
  if (thumbnail.state !== 'Completed' || !thumbnail.imageUrl) {
    return { state: 'Pending' };
  }
  const image = new URL(thumbnail.imageUrl);
  if (image.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)?rbxcdn\.com$/i.test(image.hostname)) {
    throw new Error('Avatar preview unavailable.');
  }
  return { state: 'Completed', imageUrl: image.href };
}

async function getCatalogItem2D(assetId, itemType) {
  const isBundle = itemType === 'Bundle';
  const url = new URL(isBundle ? 'https://thumbnails.roblox.com/v1/bundles/thumbnails'
    : 'https://thumbnails.roblox.com/v1/assets');
  url.searchParams.set(isBundle ? 'bundleIds' : 'assetIds', String(assetId));
  url.searchParams.set('size', '420x420');
  url.searchParams.set('format', 'Png');
  url.searchParams.set('isCircular', 'false');
  const result = await readJson(url.href);
  const thumbnail = result?.data?.find(item => Number(item?.targetId) === assetId);
  if (!thumbnail) throw new Error('Item preview unavailable.');
  if (thumbnail.state !== 'Completed') return { state: thumbnail.state };
  const image = new URL(thumbnail.imageUrl);
  if (image.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)?rbxcdn\.com$/i.test(image.hostname)) {
    throw new Error('Item preview unavailable.');
  }
  return { state: 'Completed', imageUrl: image.href };
}

async function getHomeUser() {
  const account = await readJson('https://users.roblox.com/v1/users/authenticated');
  const userId = Number(account?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('No signed-in Roblox user');

  let imageUrl = '';
  try {
    const url = new URL('https://thumbnails.roblox.com/v1/users/avatar-headshot');
    url.searchParams.set('userIds', String(userId));
    url.searchParams.set('size', '150x150');
    url.searchParams.set('format', 'Png');
    url.searchParams.set('isCircular', 'false');
    const result = await readJson(url.href);
    const thumbnail = result?.data?.find(item => Number(item?.targetId) === userId);
    if (thumbnail?.state === 'Completed' && thumbnail.imageUrl) {
      const image = new URL(thumbnail.imageUrl);
      if (image.protocol === 'https:' && /^(?:[a-z0-9-]+\.)?rbxcdn\.com$/i.test(image.hostname)) {
        imageUrl = image.href;
      }
    }
  } catch { /* The greeting can still show the signed-in player's name. */ }

  return {
    id: userId,
    name: typeof account.name === 'string' ? account.name : '',
    displayName: typeof account.displayName === 'string' ? account.displayName : '',
    imageUrl
  };
}

async function getRolimonsGamePage(placeId) {
  const cached = rolimonsGameCache.get(placeId);
  if (cached && Date.now() - cached.fetchedAt < 5 * 60_000) return cached;

  const response = await fetch(`https://www.rolimons.com/game/${placeId}`, {
    credentials: 'omit',
    headers: { Accept: 'text/html' }
  });
  if (!response.ok) throw new Error(`Rolimons returned ${response.status}`);
  const html = await response.text();
  if (html.length < 1000 || html.length > 4_000_000
    || !html.toLowerCase().includes('charts &amp; more') && !html.toLowerCase().includes('charts & more')) {
    throw new Error('Rolimons game data unavailable');
  }
  const gamepassIds = [...new Set([...html.matchAll(/\/gamepass\/(\d+)(?:\/|["'?\s])/gi)]
    .map(match => Number(match[1])).filter(id => Number.isSafeInteger(id) && id > 0))].slice(0, 500);
  const gamepassThumbnails = await getRobloxThumbnailMap('gamepasses', gamepassIds);
  const result = { html, gamepassThumbnails, fetchedAt: Date.now() };
  rolimonsGameCache.set(placeId, result);
  return result;
}

async function readPublicRobloxJson(url) {
  const response = await fetch(url, {
    credentials: 'omit',
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Roblox returned ${response.status}`);
  return response.json();
}

async function getRobloxThumbnailMap(kind, ids) {
  const config = {
    gamepasses: { path: '/v1/game-passes', key: 'gamePassIds' },
    badges: { path: '/v1/badges/icons', key: 'badgeIds', circular: false },
    places: { path: '/v1/places/gameicons', key: 'placeIds', circular: false }
  }[kind];
  const thumbnails = {};
  if (!config || !Array.isArray(ids) || !ids.length) return thumbnails;

  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const url = new URL(`https://thumbnails.roblox.com${config.path}`);
    url.searchParams.set(config.key, ids.slice(start, start + BATCH_SIZE).join(','));
    url.searchParams.set('size', '150x150');
    url.searchParams.set('format', 'Png');
    if (config.circular !== undefined) url.searchParams.set('isCircular', String(config.circular));
    try {
      const result = await readPublicRobloxJson(url.href);
      for (const item of Array.isArray(result?.data) ? result.data : []) {
        const id = Number(item?.targetId);
        if (!Number.isSafeInteger(id) || id <= 0 || item?.state !== 'Completed' || typeof item?.imageUrl !== 'string') continue;
        try {
          const image = new URL(item.imageUrl);
          if (image.protocol === 'https:' && /^(?:[a-z0-9-]+\.)*rbxcdn\.com$/i.test(image.hostname)) {
            thumbnails[id] = image.href;
          }
        } catch { /* Keep cards usable when Roblox has no thumbnail for an item. */ }
      }
    } catch { /* Thumbnail failures should not prevent the game data from loading. */ }
  }
  return thumbnails;
}

async function getRobloxGameData({ placeId, universeId, section, cursor = '' }) {
  if (section === 'charts') {
    const [gameResult, voteResult] = await Promise.all([
      readPublicRobloxJson(`https://games.roblox.com/v1/games?universeIds=${universeId}`),
      readPublicRobloxJson(`https://games.roblox.com/v1/games/votes?universeIds=${universeId}`)
    ]);
    const game = gameResult?.data?.find(entry => Number(entry?.id) === universeId);
    const votes = voteResult?.data?.find(entry => Number(entry?.id) === universeId);
    if (!game) throw new Error('Roblox game stats are unavailable');
    const upvotes = Number(votes?.upVotes);
    const downvotes = Number(votes?.downVotes);
    const totalVotes = (Number.isFinite(upvotes) ? upvotes : 0) + (Number.isFinite(downvotes) ? downvotes : 0);
    const rating = totalVotes > 0
      ? `${((Number.isFinite(upvotes) ? upvotes : 0) / totalVotes * 100).toFixed(2)}%`
      : '—';
    const values = [
      ['Players', game.playing],
      ['Visits', game.visits],
      ['Rating', rating],
      ['Upvotes', votes?.upVotes],
      ['Downvotes', votes?.downVotes],
      ['Favorites', game.favoritedCount],
      ['Max Players', game.maxPlayers]
    ].filter(([, value]) => value !== undefined && value !== null);
    if (typeof game.updated === 'string') {
      const date = new Date(game.updated);
      if (!Number.isNaN(date.valueOf())) values.push(['Last Updated', date.toLocaleDateString()]);
    }
    return { items: values.map(([label, value]) => ({
      label,
      value: typeof value === 'number' ? value.toLocaleString() : String(value)
    })) };
  }

  if (section === 'badges') {
    const url = new URL(`https://badges.roblox.com/v1/universes/${universeId}/badges`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sortOrder', 'Asc');
    if (cursor) url.searchParams.set('cursor', cursor);
    const result = await readPublicRobloxJson(url.href);
    const items = (Array.isArray(result?.data) ? result.data : []).map(badge => {
      const id = Number(badge?.id || badge?.badgeId);
      const awarded = badge?.statistics?.awardedCount;
      return {
        id,
        href: `https://www.roblox.com/badges/${id}`,
        title: typeof badge?.name === 'string' ? badge.name : `Badge ${id}`,
        details: [badge?.enabled === false ? 'Disabled' : 'Enabled',
          Number.isFinite(Number(awarded)) ? `Awarded ${Number(awarded).toLocaleString()}` : '']
          .filter(Boolean).join(' · '),
        group: badge?.enabled === false ? 'Disabled Badges' : 'Badges'
      };
    }).filter(item => Number.isSafeInteger(item.id) && item.id > 0);
    const thumbnails = await getRobloxThumbnailMap('badges', items.map(item => item.id));
    for (const item of items) item.imageUrl = thumbnails[item.id] || '';
    return { items, nextCursor: result?.nextPageCursor || '' };
  }

  if (section === 'places') {
    const url = new URL(`https://develop.roblox.com/v1/universes/${universeId}/places`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sortOrder', 'Asc');
    if (cursor) url.searchParams.set('cursor', cursor);
    const result = await readPublicRobloxJson(url.href);
    const items = (Array.isArray(result?.data) ? result.data : []).map(place => {
      const id = Number(place?.id || place?.placeId);
      const isRootPlace = place?.isRootPlace === true || id === placeId;
      return {
        id,
        href: `https://www.roblox.com/games/${id}`,
        title: typeof place?.name === 'string' && place.name ? place.name : `Place ${id}`,
        details: isRootPlace ? 'Start place' : '',
        group: isRootPlace ? 'Start Place' : 'Other Places'
      };
    }).filter(item => Number.isSafeInteger(item.id) && item.id > 0);
    const thumbnails = await getRobloxThumbnailMap('places', items.map(item => item.id));
    for (const item of items) item.imageUrl = thumbnails[item.id] || '';
    return { items, nextCursor: result?.nextPageCursor || '' };
  }

  if (section === 'servers') {
    const url = new URL(`https://games.roblox.com/v1/games/${placeId}/servers/Public`);
    url.searchParams.set('sortOrder', 'Asc');
    url.searchParams.set('limit', '50');
    if (cursor) url.searchParams.set('cursor', cursor);
    const result = await readPublicRobloxJson(url.href);
    const items = (Array.isArray(result?.data) ? result.data : []).map((server, index) => {
      const count = Number(server?.playing);
      const max = Number(server?.maxPlayers);
      const details = [`${Number.isFinite(count) ? count : '?'} / ${Number.isFinite(max) ? max : '?'} players`,
        Number.isFinite(Number(server?.ping)) ? `Ping ${Number(server.ping).toFixed(0)} ms` : '',
        Number.isFinite(Number(server?.fps)) ? `FPS ${Number(server.fps).toFixed(1)}` : '']
        .filter(Boolean).join(' · ');
      return {
        id: typeof server?.id === 'string' ? server.id : `${cursor || 'page'}-${index}`,
        href: '',
        title: typeof server?.id === 'string' ? `Public server ${server.id.slice(-6)}` : `Public server ${index + 1}`,
        details,
        group: 'Live Roblox Servers'
      };
    });
    return { items, nextCursor: result?.nextPageCursor || '' };
  }

  throw new Error('Unknown Roblox game data section');
}

async function getBadgeOwnership(badgeIds) {
  const account = await readJson('https://users.roblox.com/v1/users/authenticated');
  const userId = Number(account?.id);
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error('No signed-in Roblox user');
  }

  const awarded = new Map();
  for (let start = 0; start < badgeIds.length; start += BATCH_SIZE) {
    const batch = badgeIds.slice(start, start + BATCH_SIZE);
    const url = `https://badges.roblox.com/v1/users/${userId}/badges/awarded-dates?badgeIds=${batch.join(',')}`;
    const result = await readJson(url);
    if (!Array.isArray(result?.data)) throw new Error('Invalid badge response');
    for (const entry of result.data) {
      const id = Number(entry?.badgeId);
      if (Number.isSafeInteger(id) && id > 0) {
        awarded.set(id, typeof entry.awardedDate === 'string' ? entry.awardedDate : null);
      }
    }
  }
  return {
    ownedBadgeIds: [...awarded.keys()],
    awardedBadges: [...awarded].map(([badgeId, awardedDate]) => ({ badgeId, awardedDate }))
  };
}

async function getProfileDetails(userId) {
  let formerNames = null;
  let socialChannels = null;
  const [userResult, historyResult, channelsResult] = await Promise.allSettled([
    readJson(`https://users.roblox.com/v1/users/${userId}`),
    readJson(`https://users.roblox.com/v1/users/${userId}/username-history?limit=10&sortOrder=Desc`),
    readJson(`https://accountinformation.roblox.com/v1/users/${userId}/promotion-channels`)
  ]);
  if (userResult.status === 'rejected') throw userResult.reason;
  const user = userResult.value;
  if (historyResult.status === 'fulfilled' && Array.isArray(historyResult.value?.data)) {
    formerNames = historyResult.value.data.map(entry => entry?.name)
      .filter(name => typeof name === 'string' && name.length > 0).slice(0, 5);
  }
  if (channelsResult.status === 'fulfilled') {
    const channels = channelsResult.value?.data || channelsResult.value;
    if (channels && typeof channels === 'object') {
      socialChannels = {};
      for (const key of ['facebook', 'twitter', 'youtube', 'twitch', 'guilded', 'discord', 'tiktok', 'instagram']) {
        if (typeof channels[key] === 'string' && channels[key].trim()) {
          socialChannels[key] = channels[key].trim().slice(0, 2048);
        }
      }
    }
  }
  return {
    id: user?.id,
    name: typeof user?.name === 'string' ? user.name : '',
    description: typeof user?.description === 'string' ? user.description : '',
    created: typeof user?.created === 'string' ? user.created : '',
    verified: user?.hasVerifiedBadge === true,
    formerNames,
    socialChannels
  };
}

async function readLimitedInventory(userId) {
  const copies = [];
  const seenCursors = new Set();
  let cursor = '';
  for (let page = 0; page < 1000; page++) {
    const url = new URL(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles`);
    url.searchParams.set('sortOrder', 'Asc');
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await fetch(url.href, { credentials: 'include' });
    if (response.status === 403) throw new Error('This inventory is private or unavailable.');
    if (response.status === 429) throw new Error('Roblox rate limit reached. Try again later.');
    if (!response.ok) throw new Error(`Could not load Limited items (${response.status}).`);
    const result = await response.json();
    if (!Array.isArray(result?.data)) throw new Error('Invalid Limited inventory response.');
    for (const entry of result.data) {
      const assetId = Number(entry?.assetId);
      if (!Number.isSafeInteger(assetId) || assetId <= 0) continue;
      const rap = Number(entry.recentAveragePrice);
      copies.push({
        assetId,
        name: typeof entry.name === 'string' && entry.name ? entry.name : `Item ${assetId}`,
        rap: entry.recentAveragePrice != null && Number.isSafeInteger(rap) && rap >= 0 ? rap : null
      });
    }
    if (copies.length > 100000) throw new Error('Limited inventory is too large to display.');
    const next = typeof result.nextPageCursor === 'string' ? result.nextPageCursor : '';
    if (!next || !result.data.length) {
      cursor = '';
      break;
    }
    if (seenCursors.has(next)) throw new Error('Roblox returned a repeated inventory page.');
    seenCursors.add(next);
    cursor = next;
  }
  if (cursor) throw new Error('Limited inventory pagination did not finish.');

  const grouped = new Map();
  let totalRap = 0;
  let unpricedCopies = 0;
  for (const copy of copies) {
    let item = grouped.get(copy.assetId);
    if (!item) {
      item = { assetId: copy.assetId, name: copy.name, quantity: 0, rap: copy.rap, imageUrl: '' };
      grouped.set(copy.assetId, item);
    }
    item.quantity++;
    if (copy.rap == null) unpricedCopies++;
    else totalRap += copy.rap;
    if (item.rap == null && copy.rap != null) item.rap = copy.rap;
  }
  const items = [...grouped.values()].sort((a, b) =>
    (b.rap ?? -1) * b.quantity - (a.rap ?? -1) * a.quantity);

  for (let start = 0; start < Math.min(items.length, 300); start += BATCH_SIZE) {
    const batch = items.slice(start, start + BATCH_SIZE);
    const url = new URL('https://thumbnails.roblox.com/v1/assets');
    url.searchParams.set('assetIds', batch.map(item => item.assetId).join(','));
    url.searchParams.set('size', '150x150');
    url.searchParams.set('format', 'Png');
    url.searchParams.set('isCircular', 'false');
    try {
      const result = await readJson(url.href);
      const byId = new Map(batch.map(item => [item.assetId, item]));
      for (const thumb of result?.data || []) {
        const item = byId.get(Number(thumb?.targetId));
        if (item && typeof thumb?.imageUrl === 'string'
          && /^https:\/\/[\w.-]+\.rbxcdn\.com\//i.test(thumb.imageUrl)) {
          item.imageUrl = thumb.imageUrl;
        }
      }
    } catch { /* Keep the inventory usable without thumbnails. */ }
  }
  return { items, copies: copies.length, totalRap, unpricedCopies, fetchedAt: Date.now() };
}

async function getLimitedInventory(userId, force) {
  const cached = limitedInventoryCache.get(userId);
  if (cached && Date.now() - cached.at < (force ? 30000 : 5 * 60000)) return cached.promise;
  const promise = readLimitedInventory(userId);
  limitedInventoryCache.set(userId, { at: Date.now(), promise });
  try { return await promise; }
  catch (error) {
    if (limitedInventoryCache.get(userId)?.promise === promise) limitedInventoryCache.delete(userId);
    throw error;
  }
}

async function getPlayerImages(servers) {
  const tokens = [...new Set(servers.flatMap(server =>
    Array.isArray(server.playerTokens) ? server.playerTokens.slice(0, 30) : []
  ))].filter(token => typeof token === 'string' && token.length > 0).slice(0, 100);
  if (!tokens.length) return new Map();

  const images = new Map();
  for (let start = 0; start < tokens.length; start += BATCH_SIZE) {
    const batch = tokens.slice(start, start + BATCH_SIZE);
    const response = await fetch('https://thumbnails.roblox.com/v1/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.map((token, index) => ({
        requestId: String(start + index),
        type: 'AvatarHeadShot',
        targetId: 0,
        token,
        size: '150x150',
        format: 'Png',
        isCircular: false
      })))
    });
    if (!response.ok) break;
    const result = await response.json();
    for (const item of result?.data || []) {
      const index = Number(item?.requestId);
      if (Number.isInteger(index) && index >= 0 && index < tokens.length
        && typeof item?.imageUrl === 'string' && item.imageUrl.startsWith('https://')) {
        images.set(tokens[index], item.imageUrl);
      }
    }
  }
  return images;
}

async function getPrivateServerDetails(placeId, serverIds, serverNames) {
  const wanted = new Set(serverIds);
  const wantedNames = new Set(serverNames.map(name => name.trim().toLowerCase()));
  const found = new Map();
  const byName = new Map();
  let cursor = '';
  for (let page = 0; page < 5 && (found.size < wanted.size || wantedNames.size); page++) {
    const url = new URL(`https://games.roblox.com/v1/games/${placeId}/private-servers`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sortOrder', 'Desc');
    url.searchParams.set('excludeFullGames', 'false');
    if (cursor) url.searchParams.set('cursor', cursor);
    let result;
    try { result = await readJson(url.href); }
    catch (error) {
      if (page === 0) throw error;
      break;
    }
    if (!Array.isArray(result?.data)) break;
    for (const server of result.data) {
      const id = Number(server?.vipServerId ?? server?.privateServerId);
      if (!Number.isSafeInteger(id) || id <= 0) continue;
      if (wanted.has(id)) found.set(id, server);
      const name = typeof server?.name === 'string' ? server.name.trim().toLowerCase() : '';
      if (wantedNames.has(name)) byName.set(name, byName.has(name) ? null : server);
    }
    cursor = typeof result.nextPageCursor === 'string' ? result.nextPageCursor : '';
    if (!cursor) break;
  }

  for (const server of byName.values()) {
    if (!server) continue;
    const id = Number(server.vipServerId ?? server.privateServerId);
    found.set(id, server);
  }
  let images = new Map();
  try { images = await getPlayerImages([...found.values()]); } catch { /* Keep the server details. */ }
  return {
    uniqueNames: [...byName].filter(([, server]) => !!server).map(([name]) => name),
    servers: [...found].map(([id, server]) => {
      const owner = server?.owner;
      const ownerName = (typeof owner?.name === 'string' && owner.name)
        || (typeof owner?.displayName === 'string' && owner.displayName) || '';
      const playing = Number(server?.playing);
      const maxPlayers = Number(server?.maxPlayers);
      return {
        id,
        name: typeof server.name === 'string' ? server.name.trim() : '',
        ownerName,
        playing: Number.isInteger(playing) && playing >= 0 ? playing : null,
        maxPlayers: Number.isInteger(maxPlayers) && maxPlayers > 0 ? maxPlayers : null,
        ping: server ? serverPing(server) : null,
        countryCode: server ? serverCountryCode(server) : '',
        playerImages: Array.isArray(server?.playerTokens)
          ? server.playerTokens.slice(0, 30).map(token => images.get(token)).filter(Boolean)
          : []
      };
    })
  };
}

function serverPing(server) {
  const value = server?.ping;
  const ping = typeof value === 'number' ? value : NaN;
  return Number.isFinite(ping) && ping > 0 && ping <= 10_000 ? Math.round(ping) : null;
}

function serverCountryCode(server) {
  // Only use a country explicitly attached to the server, never the owner's locale.
  const code = server?.serverLocation?.countryCode
    ?? server?.location?.countryCode ?? server?.countryCode;
  return typeof code === 'string' && /^[A-Z]{2}$/i.test(code) ? code.toUpperCase() : '';
}

async function getPublicServerStatuses(placeId, serverIds) {
  const wanted = new Set(serverIds);
  const servers = new Map();
  let cursor = '';
  for (let page = 0; page < 10 && servers.size < wanted.size; page++) {
    const url = new URL(`https://games.roblox.com/v1/games/${placeId}/servers/Public`);
    url.searchParams.set('limit', '100');
    url.searchParams.set('sortOrder', 'Asc');
    if (cursor) url.searchParams.set('cursor', cursor);
    const result = await readJson(url.href);
    if (!Array.isArray(result?.data)) break;
    for (const server of result.data) {
      const id = typeof server?.id === 'string' ? server.id.toLowerCase() : '';
      if (wanted.has(id)) {
        servers.set(id, {
          id,
          ping: serverPing(server),
          countryCode: serverCountryCode(server)
        });
      }
    }
    cursor = typeof result.nextPageCursor === 'string' ? result.nextPageCursor : '';
    if (!cursor) break;
  }
  return { servers: [...servers.values()] };
}

function publicIpv4(address) {
  if (typeof address !== 'string') return '';
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part)
    || Number(part) > 255)) return '';
  const [a, b, c] = parts.map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224
    || a === 100 && b >= 64 && b <= 127
    || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
    || a === 192 && (b === 0 || b === 168)
    || a === 198 && (b === 18 || b === 19)
    || a === 192 && b === 0 && c === 2
    || a === 198 && b === 51 && c === 100
    || a === 203 && b === 0 && c === 113) return '';
  return parts.map(Number).join('.');
}

async function enableJoinRequestHeader() {
  if (!joinHeaderReady) {
    joinHeaderReady = chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [9010],
      addRules: [{
        id: 9010,
        action: { type: 'modifyHeaders', requestHeaders: [{
          header: 'User-Agent', operation: 'set', value: 'Roblox/WinInet'
        }] },
        condition: {
          urlFilter: '|https://gamejoin.roblox.com/v1/join-game-instance',
          requestMethods: ['post'],
          initiatorDomains: [chrome.runtime.id]
        }
      }]
    }).catch(error => {
      joinHeaderReady = null;
      throw error;
    });
  }
  return joinHeaderReady;
}

async function getPublicServerCountry(placeId, serverId) {
  const cached = publicServerCountryCache.get(serverId);
  if (cached && Date.now() - cached.fetchedAt < 60 * 60_000) {
    return { countryCode: cached.countryCode, estimated: true };
  }
  await enableJoinRequestHeader();
  const join = await fetch('https://gamejoin.roblox.com/v1/join-game-instance', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ placeId, gameId: serverId }),
    signal: AbortSignal.timeout(10_000)
  });
  if (!join.ok) throw new Error('Roblox could not locate this server.');
  const result = await join.json();
  const address = result?.joinScript?.UdmuxEndpoints?.[0]?.Address
    ?? result?.joinScript?.MachineAddress;
  const ip = publicIpv4(address);
  if (!ip) throw new Error(result?.status === 22
    ? 'This server is full.' : 'Roblox did not provide a server address.');

  const cachedAddress = publicAddressCountryCache.get(ip);
  if (cachedAddress && Date.now() - cachedAddress.fetchedAt < 24 * 60 * 60_000) {
    publicServerCountryCache.set(serverId, cachedAddress);
    return { countryCode: cachedAddress.countryCode, estimated: true };
  }

  const lookup = await fetch(`https://ipwho.is/${ip}`, {
    credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000)
  });
  if (!lookup.ok) throw new Error('Country lookup is unavailable.');
  const location = await lookup.json();
  const countryCode = location?.success === true && typeof location.country_code === 'string'
    && /^[A-Z]{2}$/i.test(location.country_code) ? location.country_code.toUpperCase() : '';
  if (!countryCode) throw new Error('Country lookup is unavailable.');
  const cacheEntry = { countryCode, fetchedAt: Date.now() };
  publicAddressCountryCache.set(ip, cacheEntry);
  publicServerCountryCache.set(serverId, cacheEntry);
  return { countryCode, estimated: true };
}

async function getGameXLink(placeId, hintedUniverseId) {
  let universeId = hintedUniverseId;
  if (!Number.isSafeInteger(universeId) || universeId <= 0) {
    const places = await readJson(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
    universeId = Number(places?.[0]?.universeId);
  }
  if (!Number.isSafeInteger(universeId) || universeId <= 0) {
    throw new Error('Universe ID unavailable');
  }
  const links = await readJson(`https://games.roblox.com/v1/games/${universeId}/social-links/list`);
  if (!Array.isArray(links?.data)) throw new Error('Social links unavailable');
  const link = links.data.find(entry => {
    if (typeof entry?.url !== 'string') return false;
    try {
      const host = new URL(entry.url).hostname.toLowerCase();
      return ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com',
        'www.twitter.com', 'mobile.twitter.com'].includes(host);
    } catch { return false; }
  });
  return { url: link?.url || null };
}

async function getGameYouTubeLink(placeId, hintedUniverseId) {
  let universeId = hintedUniverseId;
  if (!Number.isSafeInteger(universeId) || universeId <= 0) {
    const places = await readJson(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
    universeId = Number(places?.[0]?.universeId);
  }
  if (!Number.isSafeInteger(universeId) || universeId <= 0) throw new Error('Universe ID unavailable');
  const links = await readJson(`https://games.roblox.com/v1/games/${universeId}/social-links/list`);
  if (!Array.isArray(links?.data)) throw new Error('Social links unavailable');
  const link = links.data.find(entry => {
    if (typeof entry?.url !== 'string') return false;
    try {
      const url = new URL(entry.url);
      return url.protocol === 'https:'
        && ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname.toLowerCase());
    } catch { return false; }
  });
  return { url: link?.url || null };
}

async function getCommunitySocialLinks(groupId) {
  const links = await readJson(`https://groups.roblox.com/v1/groups/${groupId}/social-links`);
  if (!Array.isArray(links?.data)) throw new Error('Community social links unavailable');
  let xUrl = null;
  let youtubeUrl = null;
  for (const entry of links.data) {
    if (typeof entry?.url !== 'string' || entry.url.length > 2048) continue;
    try {
      const url = new URL(entry.url);
      if (url.protocol !== 'https:') continue;
      if (!xUrl && ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(url.hostname)) xUrl = url.href;
      if (!youtubeUrl && ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) youtubeUrl = url.href;
    } catch { /* Ignore malformed social links. */ }
  }
  return { xUrl, youtubeUrl };
}

function decodeXml(value) {
  return String(value || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (entity, number, named) => {
      if (number) {
        const code = number[0].toLowerCase() === 'x'
          ? Number.parseInt(number.slice(1), 16) : Number.parseInt(number, 10);
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }
      return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[named.toLowerCase()] || entity;
    }).trim();
}

function youtubeChannelIdFromUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid YouTube channel URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
    throw new Error('Invalid YouTube channel URL');
  }
  const direct = url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/);
  return direct?.[1] || null;
}

async function resolveYouTubeChannelId(channelUrl) {
  const directId = youtubeChannelIdFromUrl(channelUrl);
  if (directId) return directId;
  const response = await fetch(channelUrl, {
    credentials: 'omit',
    headers: { Accept: 'text/html' }
  });
  if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
  let finalUrl;
  try { finalUrl = new URL(response.url); } catch { throw new Error('Invalid YouTube redirect'); }
  if (finalUrl.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(finalUrl.hostname)) {
    throw new Error('Invalid YouTube redirect');
  }
  const html = await response.text();
  if (html.length > 8_000_000) throw new Error('YouTube channel page too large');
  const candidates = [
    html.match(/<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{22})["']/i)?.[1],
    html.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/i)?.[1],
    html.match(/<link[^>]+href=["']https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})["']/i)?.[1]
  ];
  const channelId = candidates.find(candidate => candidate && /^UC[A-Za-z0-9_-]{22}$/.test(candidate));
  if (!channelId) throw new Error('Could not resolve YouTube channel ID');
  return channelId;
}

async function getYouTubeVideos(channelUrl, force = false) {
  const channelId = await resolveYouTubeChannelId(channelUrl);
  const cached = youtubeFeedCache.get(channelId);
  if (!force && cached && Date.now() - cached.fetchedAt < 10 * 60_000) return cached;
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const response = await fetch(feedUrl, {
    credentials: 'omit',
    headers: { Accept: 'application/atom+xml, application/xml, text/xml' }
  });
  if (!response.ok) throw new Error(`YouTube feed returned ${response.status}`);
  const xml = await response.text();
  if (xml.length > 512_000 || !/<feed(?:\s|>)/i.test(xml)) throw new Error('YouTube feed unavailable');
  const readTag = (source, tag) => decodeXml(source.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1]);
  const entries = [...xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)].slice(0, 10);
  const videos = entries.map(([, entry]) => {
    const id = readTag(entry, 'yt:videoId');
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
    return {
      id,
      title: readTag(entry, 'title').slice(0, 300),
      published: readTag(entry, 'published'),
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    };
  }).filter(Boolean);
  const channelTitle = decodeXml(xml.match(/<author(?:\s[^>]*)?>\s*<name(?:\s[^>]*)?>([\s\S]*?)<\/name>/i)?.[1])
    || channelId;
  const result = { channelId, channelTitle, videos, fetchedAt: Date.now() };
  youtubeFeedCache.set(channelId, result);
  return result;
}

async function getXPosts(handle, force) {
  const cacheKey = `rc-x-posts-v2-${handle.toLowerCase()}`;
  let cached = null;
  try { cached = (await chrome.storage.local.get(cacheKey))[cacheKey]; }
  catch { /* Fetch live posts without a cache. */ }
  const age = Date.now() - Number(cached?.fetchedAt || 0);
  if (!force && Number(cached?.retryAfter || 0) > Date.now()) {
    if (Array.isArray(cached.posts) && cached.posts.length && age >= 0
      && age < 24 * 60 * 60_000) {
      return { posts: cached.posts, stale: true };
    }
    throw new Error('X posts temporarily unavailable');
  }
  if (!force && Array.isArray(cached?.posts) && age >= 0 && age < 10 * 60_000) {
    return { posts: cached.posts, stale: false };
  }

  try {
    const response = await fetch(`https://api.fxtwitter.com/2/profile/${handle}/statuses?count=10`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`FxEmbed returned ${response.status}`);
    const result = await response.json();
    if (result?.code !== 200 || !Array.isArray(result.results)) {
      throw new Error('FxEmbed timeline unavailable');
    }
    const posts = result.results.filter(post => post?.type === 'status'
      && /^\d{5,25}$/.test(String(post.id || '')))
      .sort((a, b) => Number(b.created_timestamp || 0) - Number(a.created_timestamp || 0))
      .slice(0, 5)
      .map(post => {
        const media = post.media || {};
        const candidates = [
          ...(Array.isArray(media.photos) ? media.photos.map(item => item?.url) : []),
          ...(Array.isArray(media.videos) ? media.videos.map(item => item?.thumbnail_url) : [])
        ];
        if (!candidates.some(Boolean) && Array.isArray(media.all)) {
          candidates.push(...media.all.map(item => item?.thumbnail_url || item?.url
            || item?.formats?.webp || item?.formats?.jpeg));
        }
        if (!candidates.some(Boolean)) candidates.push(media.external?.thumbnail_url);
        const images = [...new Set(candidates.flatMap(value => {
          if (typeof value !== 'string') return [];
          try {
            const url = new URL(value);
            return url.protocol === 'https:' ? [url.href] : [];
          } catch { return []; }
        }))].slice(0, 4);
        return {
          id: String(post.id),
          text: String(post.text || '').slice(0, 2000),
          createdAt: typeof post.created_at === 'string' ? post.created_at : null,
          images
        };
      });
    try { await chrome.storage.local.set({ [cacheKey]: { posts, fetchedAt: Date.now() } }); }
    catch { /* Display fetched posts even if caching is unavailable. */ }
    return { posts, stale: false };
  } catch {
    try {
      await chrome.storage.local.set({
        [cacheKey]: {
          posts: Array.isArray(cached?.posts) ? cached.posts : [],
          fetchedAt: Number(cached?.fetchedAt || 0),
          retryAfter: Date.now() + 2 * 60_000
        }
      });
    } catch { /* Backoff still applies in this request. */ }
    if (Array.isArray(cached?.posts) && cached.posts.length && age >= 0
      && age < 24 * 60 * 60_000) {
      return { posts: cached.posts, stale: true };
    }
    throw new Error('X posts unavailable');
  }
}

async function getXImage(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Invalid image URL');
  const url = new URL(value);
  const isYouTubeThumbnail = url.hostname === 'i.ytimg.com'
    && /^\/vi\/[A-Za-z0-9_-]{11}\/hqdefault\.jpg$/.test(url.pathname);
  if (url.protocol !== 'https:'
    || !['pbs.twimg.com', 'mosaic.fxtwitter.com'].includes(url.hostname) && !isYouTubeThumbnail) {
    throw new Error('Image host unavailable');
  }
  if (url.hostname === 'pbs.twimg.com') {
    if (!url.pathname.startsWith('/media/')) throw new Error('Invalid image path');
    url.searchParams.set('name', 'small');
  }
  const response = await fetch(url.href, { credentials: 'omit' });
  if (!response.ok) throw new Error(`Image returned ${response.status}`);
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) {
    throw new Error('Unsupported image type');
  }
  const limit = 2 * 1024 * 1024;
  if (Number(response.headers.get('content-length') || 0) > limit) throw new Error('Image too large');
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > limit) throw new Error('Image too large');
  let binary = '';
  for (let offset = 0; offset < data.length; offset += 32768) {
    binary += String.fromCharCode(...data.subarray(offset, offset + 32768));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== BADGE_QUERY && message?.type !== PRIVATE_SERVER_QUERY
    && message?.type !== PUBLIC_SERVER_STATUS_QUERY
    && message?.type !== PUBLIC_SERVER_COUNTRY_QUERY
    && message?.type !== GAME_X_LINK_QUERY && message?.type !== GAME_YOUTUBE_LINK_QUERY
    && message?.type !== COMMUNITY_SOCIAL_LINKS_QUERY
    && message?.type !== X_POSTS_QUERY && message?.type !== X_IMAGE_QUERY
    && message?.type !== YOUTUBE_VIDEOS_QUERY && message?.type !== YOUTUBE_IMAGE_QUERY
    && message?.type !== PROFILE_DETAILS_QUERY
    && message?.type !== PROFILE_LIMITEDS_QUERY && message?.type !== AVATAR_2D_QUERY
    && message?.type !== CATALOG_ITEM_2D_QUERY
    && message?.type !== HOME_USER_QUERY && message?.type !== ROLIMONS_GAME_QUERY
    && message?.type !== ROBLOX_GAME_DATA_QUERY) return;

  let source;
  try { source = new URL(sender.url); } catch { return; }
  if (source.protocol !== 'https:' || !['www.roblox.com', 'roblox.com'].includes(source.hostname)) return;

  if (message.type === HOME_USER_QUERY) {
    getHomeUser()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message || 'Player details unavailable.' }));
  } else if (message.type === ROLIMONS_GAME_QUERY) {
    const sourcePlaceId = Number(source.pathname.match(/^\/games\/(\d+)/)?.[1]);
    const placeId = message.placeId;
    if (!Number.isSafeInteger(placeId) || placeId <= 0 || sourcePlaceId !== placeId) return;
    getRolimonsGamePage(placeId)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message || 'Rolimons data unavailable.' }));
  } else if (message.type === PUBLIC_SERVER_STATUS_QUERY) {
    const sourcePlaceId = Number(source.pathname.match(/^\/games\/(\d+)/)?.[1]);
    const placeId = Number(message.placeId);
    const serverIds = message.serverIds;
    if (!Number.isSafeInteger(placeId) || placeId <= 0 || sourcePlaceId !== placeId
      || !Array.isArray(serverIds) || !serverIds.length || serverIds.length > 100
      || !serverIds.every(id => typeof id === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return;
    getPublicServerStatuses(placeId, [...new Set(serverIds)])
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message || 'Server status unavailable' }));
  } else if (message.type === PUBLIC_SERVER_COUNTRY_QUERY) {
    const sourcePlaceId = Number(source.pathname.match(/^\/games\/(\d+)/)?.[1]);
    const placeId = Number(message.placeId);
    const serverId = message.serverId;
    if (!Number.isSafeInteger(placeId) || placeId <= 0 || sourcePlaceId !== placeId
      || typeof serverId !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serverId)) return;
    getPublicServerCountry(placeId, serverId.toLowerCase())
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message || 'Country lookup unavailable.' }));
  } else if (message.type === ROBLOX_GAME_DATA_QUERY) {
    const sourcePlaceId = Number(source.pathname.match(/^\/games\/(\d+)/)?.[1]);
    const placeId = Number(message.placeId);
    const universeId = Number(message.universeId);
    const section = message.section;
    const cursor = typeof message.cursor === 'string' ? message.cursor : '';
    const universeRequired = section !== 'servers';
    if (!Number.isSafeInteger(placeId) || placeId <= 0 || sourcePlaceId !== placeId
      || universeRequired && (!Number.isSafeInteger(universeId) || universeId <= 0)
      || !['badges', 'places'].includes(section)
      || cursor.length > 2048) return;
    getRobloxGameData({ placeId, universeId, section, cursor })
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message || 'Roblox game data unavailable.' }));
  } else if (message.type === CATALOG_ITEM_2D_QUERY) {
    const sourceItem = source.pathname.match(/^\/(catalog|bundles)\/(\d+)(?:\/|$)/i);
    const sourceAssetId = Number(sourceItem?.[2]);
    const sourceItemType = sourceItem?.[1].toLowerCase() === 'bundles' ? 'Bundle' : 'Asset';
    const assetId = message.assetId;
    const itemType = message.itemType ?? 'Asset';
    if (!Number.isSafeInteger(assetId) || assetId <= 0 || assetId !== sourceAssetId
      || itemType !== sourceItemType) return;
    getCatalogItem2D(assetId, itemType)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'Item preview unavailable.' }));
  } else if (message.type === AVATAR_2D_QUERY) {
    if (!/^\/my\/avatar(?:\/|$)/i.test(source.pathname)) return;
    getAvatar2D()
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message || 'Avatar preview unavailable.' }));
  } else if (message.type === PROFILE_LIMITEDS_QUERY) {
    const sourceUserId = Number(source.pathname.match(/^\/users\/(\d+)\/profile(?:\/|$)/)?.[1]);
    if (!Number.isSafeInteger(sourceUserId) || sourceUserId <= 0
      || message.userId !== sourceUserId) return;
    getLimitedInventory(sourceUserId, message.force === true)
      .then(sendResponse)
      .catch(error => sendResponse({ error: error.message || 'Limited inventory unavailable.' }));
  } else if (message.type === PROFILE_DETAILS_QUERY) {
    const sourceUserId = Number(source.pathname.match(/^\/users\/(\d+)\/profile(?:\/|$)/)?.[1]);
    if (!Number.isSafeInteger(sourceUserId) || sourceUserId <= 0
      || message.userId !== sourceUserId) return;
    getProfileDetails(sourceUserId)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'Profile details unavailable' }));
  } else if (message.type === BADGE_QUERY) {
    const badgeIds = message.badgeIds;
    if (!Array.isArray(badgeIds) || badgeIds.length === 0 || badgeIds.length > 100
      || !badgeIds.every(id => Number.isSafeInteger(id) && id > 0)) return;
    getBadgeOwnership([...new Set(badgeIds)])
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'Badge ownership unavailable' }));
  } else if (message.type === GAME_X_LINK_QUERY) {
    const sourcePlaceId = Number(source.pathname.match(/^\/games\/(\d+)/)?.[1]);
    const placeId = message.placeId;
    if (!Number.isSafeInteger(placeId) || placeId <= 0 || sourcePlaceId !== placeId) return;
    const universeId = Number(message.universeId);
    getGameXLink(placeId, universeId)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'Game social link unavailable' }));
  } else if (message.type === GAME_YOUTUBE_LINK_QUERY) {
    const sourcePlaceId = Number(source.pathname.match(/^\/games\/(\d+)/)?.[1]);
    const placeId = Number(message.placeId);
    if (!Number.isSafeInteger(placeId) || placeId <= 0 || sourcePlaceId !== placeId) return;
    getGameYouTubeLink(placeId, Number(message.universeId))
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'Game YouTube link unavailable' }));
  } else if (message.type === COMMUNITY_SOCIAL_LINKS_QUERY) {
    const groupId = Number(message.groupId);
    const sourceGroupId = Number(source.pathname.match(/^\/(?:communities|groups)\/(\d+)(?:\/|$)/i)?.[1]);
    if (!Number.isSafeInteger(groupId) || groupId <= 0 || sourceGroupId !== groupId) return;
    getCommunitySocialLinks(groupId)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'Community social links unavailable' }));
  } else if (message.type === X_POSTS_QUERY) {
    if (!SOCIAL_FEED_PATH.test(source.pathname)) return;
    const handle = message.handle;
    if (typeof handle !== 'string' || !/^[A-Za-z0-9_]{1,15}$/.test(handle)) return;
    getXPosts(handle, message.force === true)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'X posts unavailable' }));
  } else if (message.type === X_IMAGE_QUERY) {
    if (!SOCIAL_FEED_PATH.test(source.pathname)) return;
    getXImage(message.url)
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(() => sendResponse({ error: 'Image unavailable' }));
  } else if (message.type === YOUTUBE_VIDEOS_QUERY) {
    if (!SOCIAL_FEED_PATH.test(source.pathname)
      || typeof message.channelUrl !== 'string' || message.channelUrl.length > 2048) return;
    getYouTubeVideos(message.channelUrl, message.force === true)
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'YouTube videos unavailable' }));
  } else if (message.type === YOUTUBE_IMAGE_QUERY) {
    if (!SOCIAL_FEED_PATH.test(source.pathname)
      || typeof message.videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(message.videoId)) return;
    getXImage(`https://i.ytimg.com/vi/${message.videoId}/hqdefault.jpg`)
      .then(dataUrl => sendResponse({ dataUrl }))
      .catch(() => sendResponse({ error: 'YouTube thumbnail unavailable' }));
  } else {
    const sourcePlaceId = Number(source.pathname.match(/^\/games\/(\d+)/)?.[1]);
    const placeId = Number(message.placeId);
    const serverIds = message.serverIds;
    const serverNames = message.serverNames;
    if (!Number.isSafeInteger(placeId) || placeId <= 0
      || sourcePlaceId !== placeId
      || !Array.isArray(serverIds)
      || !Array.isArray(serverNames)
      || serverIds.length + serverNames.length === 0
      || serverIds.length > 100 || serverNames.length > 100
      || !serverIds.every(id => Number.isSafeInteger(id) && id > 0)
      || !serverNames.every(name => typeof name === 'string' && name.trim()
        && name.length <= 100)) return;
    getPrivateServerDetails(placeId, [...new Set(serverIds)], [...new Set(serverNames)])
      .then(sendResponse)
      .catch(() => sendResponse({ error: 'Private server details unavailable' }));
  }
  return true;
});
