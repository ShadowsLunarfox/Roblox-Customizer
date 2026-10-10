(() => {
  'use strict';

  const sendMessage = globalThis.RobloxCustomizerRuntime?.sendMessage
    || ((...args) => chrome.runtime.sendMessage(...args));

  const GAME_PATH = /^\/games\/\d+(?:\/|$)/;
  const COMMUNITY_PATH = /^\/(?:communities|groups)\/(\d+)(?:\/|$)/i;
  const PROFILE_PATH = /^\/users\/(\d+)\/profile(?:\/|$)/i;
  const TAB_IDS = ['tab-about', 'tab-store', 'tab-game-instances'];
  const PRIVATE_SERVER_CONFIGURE_SELECTOR = 'a[href*="/private-server/configure?"], a[href*="/private-server/configure/"]';
  const PRIVATE_SERVER_SECTION_SELECTOR = '#private-server-container, #private-game-instances-container, '
    + '[data-rc-private-server-list], .rc-private-server-more';
  const NON_PUBLIC_SERVER_SECTION_SELECTOR = PRIVATE_SERVER_SECTION_SELECTOR
    + ', #friends-game-instances-container';
  const PRIVATE_SERVER_RENDER_SELECTOR = '.rc-private-server-summary, .rc-private-server-roster, '
    + '.rc-private-server-proxy, .rc-private-server-more, .rc-private-server-loading, .rc-server-metrics';
  const initialized = new WeakMap();
  let timer = 0;
  let running = false;
  let badgeRequest = false;
  let badgeRetryAfter = 0;
  let privateRequest = false;
  let privateRetryAfter = 0;
  let privateFetchedAt = 0;
  let privatePlaceId = 0;
  let privateQueriedIds = new Set();
  let privateQueriedNames = new Set();
  let privateSourceVersion = 0;
  let privateFetchedSourceVersion = -1;
  const privateRowSources = new WeakMap();
  const privateSourcesById = new Map();
  let publicStatusRequest = false;
  let publicStatusFetchedAt = 0;
  let publicStatusRetryAfter = 0;
  let publicStatusPlaceId = 0;
  const privateVisibleCounts = new WeakMap();
  let recommendationSource = null;
  let recommendationMarkup = '';
  const recommendationObserver = new MutationObserver(() => schedule());
  const xFeedResizeObserver = new ResizeObserver(() => schedule());
  const youtubeFeedResizeObserver = new ResizeObserver(() => schedule());
  let xFeedAnchor = null;
  let youtubeFeedAnchor = null;
  let profileFeedLayoutRoot = null;
  const xAccountCache = new Map();
  const xAccountPending = new Set();
  const youtubeLinkCache = new Map();
  const youtubeLinkPending = new Set();
  const communitySocialCache = new Map();
  const communitySocialPending = new Set();
  const privateDetails = new Map();
  const privateDetailsByName = new Map();
  const publicStatuses = new Map();
  const publicCountries = new Map();
  const publicCountryQueue = [];
  let activePublicCountryRequests = 0;
  const PUBLIC_SERVER_PAGE_SIZE = 8;
  const publicServerFilter = {
    country: 'all', minLatency: '', maxPing: '', minPlayers: '', maxPlayers: '', playerSort: 'default'
  };
  const publicServerBrowsers = new WeakMap();
  const rolimonsPageData = new WeakMap();
  const robloxGamePageData = new WeakMap();
  let badgeDateFormatter = new Intl.DateTimeFormat(globalThis.RobloxCustomizerI18n?.locale() || 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
  let badgeDateTimeFormatter = new Intl.DateTimeFormat(globalThis.RobloxCustomizerI18n?.locale() || 'en-US', {
    dateStyle: 'medium', timeStyle: 'short'
  });

  function placeIdFromPath() {
    return location.pathname.match(/^\/games\/(\d+)(?:\/|$)/)?.[1] || null;
  }

  function pageMatchesPath(page) {
    const placeId = placeIdFromPath();
    if (!page || !placeId) return false;
    const renderedId = page.getAttribute('data-place-id')
      || page.querySelector('#game-detail-meta-data')?.getAttribute('data-place-id');
    return !renderedId || renderedId === placeId;
  }

  function socialFeedContext() {
    if (!PROFILE_PATH.test(location.pathname)) clearProfileFeedLayout();
    const placeId = placeIdFromPath();
    if (placeId) {
      const page = document.querySelector('#game-detail-page');
      return pageMatchesPath(page) ? { kind: 'game', id: placeId, key: `game:${placeId}`, page } : null;
    }
    const userId = location.pathname.match(PROFILE_PATH)?.[1];
    if (userId) {
      if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
        clearProfileFeedLayout();
        return null;
      }
      const page = document.querySelector('#profile-container, .profile-container, [data-testid="profile-page"]')
        || document.querySelector('#content')
        || document.querySelector('#container-main, main, [role="main"]');
      if (!page) {
        clearProfileFeedLayout();
        return null;
      }
      const socialLinks = page.dataset.rcProfileSocialUserId === String(Number(userId))
        ? { xUrl: page.dataset.rcProfileXUrl, youtubeUrl: page.dataset.rcProfileYoutubeUrl } : null;
      const context = { kind: 'profile', id: userId, key: `profile:${userId}`, page, socialLinks };
      syncProfileFeedLayout(context);
      return context;
    }
    const groupId = location.pathname.match(COMMUNITY_PATH)?.[1];
    const root = groupId && document.querySelector('#group-container');
    if (!root) return null;
    const page = root.querySelector('.group-details') || root;
    return { kind: 'community', id: groupId, key: `community:${groupId}`, page };
  }

  function fetchedCommunityLinks(groupId) {
    const cached = communitySocialCache.get(groupId);
    if (cached && Date.now() < cached.expiresAt) return cached;
    if (communitySocialPending.has(groupId)) return cached || null;
    communitySocialPending.add(groupId);
    sendMessage({ type: 'rc-community-social-links', groupId: Number(groupId) }, response => {
      communitySocialPending.delete(groupId);
      const failed = !!chrome.runtime.lastError || !response || !!response.error;
      communitySocialCache.set(groupId, {
        xUrl: failed ? null : response.xUrl,
        youtubeUrl: failed ? null : response.youtubeUrl,
        expiresAt: Date.now() + (failed ? 30_000 : 5 * 60_000)
      });
      schedule();
    });
    return cached || null;
  }

  function cleanupSocialFeedRows() {
    for (const row of document.querySelectorAll('#rc-community-social-feeds, #rc-profile-social-feeds')) {
      if (!row.childElementCount) row.remove();
    }
  }

  function profileFeedAnchor(page) {
    // Roblox's outer content wrapper can span the viewport while the avatar
    // and identity card are centered inside it. Measure the visible card.
    return page.querySelector('[data-rc-profile-hero], [data-rc-profile-banner]') || page;
  }

  function clearProfileFeedLayout() {
    if (!profileFeedLayoutRoot) return;
    profileFeedLayoutRoot.removeAttribute('data-rc-profile-feed-layout');
    profileFeedLayoutRoot.style.removeProperty('--rc-profile-feed-content-width');
    profileFeedLayoutRoot = null;
  }

  function syncProfileFeedLayout({ page, socialLinks }) {
    if (profileFeedLayoutRoot !== page) clearProfileFeedLayout();
    const active = (!document.documentElement.hasAttribute('data-rc-hide-x-feed')
      && xAccountFromUrl(socialLinks?.xUrl))
      || (!document.documentElement.hasAttribute('data-rc-hide-youtube-feed')
        && youtubeChannelUrlFrom(socialLinks?.youtubeUrl));
    let leftEdge = 0;
    for (const sidebar of document.querySelectorAll('#navigation, #left-navigation-container')) {
      const rect = sidebar.getBoundingClientRect();
      if (rect.width > 0 && rect.left <= 16 && rect.right < innerWidth / 2) {
        leftEdge = Math.max(leftEdge, rect.right);
      }
    }
    const available = innerWidth - leftEdge;
    // Keep a 760px center column, two 200px feeds, 12px gaps and 16px outer
    // margins. Smaller screens use the row below the profile identity.
    if (!active || available < 1216) {
      clearProfileFeedLayout();
      return;
    }
    const rect = profileFeedAnchor(page).getBoundingClientRect();
    if (!profileFeedLayoutRoot && rect.left - leftEdge - 28 >= 200
      && innerWidth - rect.right - 28 >= 200) return;
    const feedWidth = Math.min(350, Math.max(200, Math.floor((available - 960 - 56) / 2)));
    const width = `${Math.min(1280, available - feedWidth * 2 - 56)}px`;
    if (page.style.getPropertyValue('--rc-profile-feed-content-width') !== width) {
      page.style.setProperty('--rc-profile-feed-content-width', width);
    }
    if (!page.hasAttribute('data-rc-profile-feed-layout')) page.setAttribute('data-rc-profile-feed-layout', '');
    profileFeedLayoutRoot = page;
  }

  function aboutReady(page) {
    const about = page.querySelector('#about');
    const description = about?.querySelector('.game-description-container .game-description');
    const stats = about?.querySelector('.game-stat-container');
    return !!(description?.textContent.trim() || (stats?.textContent.trim().length || 0) > 40);
  }

  function currentPage() {
    if (!GAME_PATH.test(location.pathname)) return null;
    const page = document.querySelector('#game-detail-page');
    if (!pageMatchesPath(page)) return null;
    const tabs = page?.querySelector('#horizontal-tabs');
    const panes = page?.querySelector('.tab-content:has(> #about, > #store, > #game-instances)');
    if (!tabs || !panes || !['about', 'store', 'game-instances'].every(id => panes.querySelector(`:scope > #${id}`))) {
      return null;
    }
    const links = TAB_IDS.map(id => tabs.querySelector(`#${id} a`));
    return links.every(Boolean) ? { page, links, placeId: placeIdFromPath() } : null;
  }

  function moveRecommendations() {
    if (!GAME_PATH.test(location.pathname)) return;
    const page = document.querySelector('#game-detail-page');
    if (!pageMatchesPath(page) || !aboutReady(page) || document.body.classList.contains('btr-gamedetails')
      || page.querySelector('#btr-recommendations-wrapper')) return;

    const section = page.querySelector('#about .container-list.games-detail');
    if (!section) return;

    // Leave Roblox's About DOM in place. Moving a live section out of the tab
    // makes its renderer remove sibling content on the next update.
    if (!section.classList.contains('rc-recommendations-source')) {
      section.classList.add('rc-recommendations-source');
    }
    if (recommendationSource !== section) {
      recommendationObserver.disconnect();
      recommendationSource = section;
      recommendationMarkup = '';
      recommendationObserver.observe(section, {
        attributes: true, characterData: true, childList: true, subtree: true
      });
    }

    let destination = page.querySelector(':scope > #rc-people-also-join');
    if (!destination) {
      destination = document.createElement('div');
      destination.id = 'rc-people-also-join';
      destination.className = 'col-xs-12';
      page.append(destination);
    }
    const markup = section.innerHTML;
    if (markup !== recommendationMarkup || !destination.firstElementChild) {
      recommendationMarkup = markup;
      const copy = section.cloneNode(true);
      copy.classList.remove('rc-recommendations-source');
      copy.removeAttribute('id');
      for (const node of copy.querySelectorAll('[id]')) node.removeAttribute('id');
      destination.replaceChildren(copy);
    }
  }

  function syncLivePlayerStat() {
    if (!GAME_PATH.test(location.pathname)) return;
    const page = document.querySelector('#game-detail-page');
    if (!pageMatchesPath(page)) return;
    const stats = page.querySelector('#about .game-stat-container');
    if (!stats) return;
    const items = stats.querySelectorAll('.game-stat').length
      ? stats.querySelectorAll('.game-stat') : stats.querySelectorAll('li');
    for (const item of items) {
      const label = (item.querySelector('.text-label, [class*="stat-label"]')?.textContent
        || item.firstElementChild?.textContent || '').replace(/\s+/g, ' ').trim();
      const live = /^(?:active|playing|currently playing|current players|active players|players online)$/i.test(label)
        || globalThis.RobloxCustomizerNativeLabels?.matches('livePlayers', label);
      if (item.hasAttribute('data-rc-live-players') !== live) {
        item.toggleAttribute('data-rc-live-players', live);
      }
    }
  }

  function syncStoreSections() {
    const store = document.querySelector('#game-detail-page #store');
    if (!store) return;

    const labels = new Map([
      ['subscriptions', 'subscriptions'],
      ['passes', 'passes'],
      ['products', 'products'],
      ['developer products', 'products']
    ]);
    const normalize = node => (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const semanticHeadings = [...store.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')];
    const headings = [];

    const kind = node => globalThis.RobloxCustomizerNativeLabels?.classify('store', normalize(node))
      || labels.get(normalize(node));
    for (const key of ['subscriptions', 'passes', 'products']) {
      let heading = semanticHeadings.find(node => kind(node) === key);
      if (!heading) {
        heading = [...store.querySelectorAll('div, span, p')]
          .filter(node => kind(node) === key && !node.closest('.card-item, .store-card, .item-card-container'))
          .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
      }
      if (!heading) continue;
      heading.classList.add('rc-store-section-title');
      heading.dataset.rcStoreSectionTitle = key;
      headings.push({ node: heading, key });
    }

    for (const { node, key } of headings) {
      let section = null;
      for (let candidate = node.parentElement; candidate && candidate !== store; candidate = candidate.parentElement) {
        if (headings.some(other => other.node !== node && candidate.contains(other.node))) break;
        if (candidate.querySelector('button, [role="button"], a[href], img')) {
          section = candidate;
          break;
        }
      }
      if (section) {
        section.classList.add('rc-store-category');
        section.dataset.rcStoreSection = key;
      }
    }
  }

  function xAccountFromUrl(value) {
    let url;
    try { url = new URL(value, location.href); }
    catch { return null; }
    if (['www.roblox.com', 'roblox.com'].includes(url.hostname)) {
      const destination = url.searchParams.get('url') || url.searchParams.get('redirectUrl');
      if (!destination) return null;
      try { url = new URL(destination); } catch { return null; }
    }
    if (!['http:', 'https:'].includes(url.protocol) || !['x.com', 'www.x.com', 'mobile.x.com',
      'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(url.hostname)) return null;
    const handle = url.pathname.split('/').filter(Boolean)[0] || '';
    const reserved = new Set(['home', 'search', 'explore', 'intent', 'share', 'login', 'signup',
      'settings', 'messages', 'compose', 'i']);
    return /^[A-Za-z0-9_]{1,15}$/.test(handle) && !reserved.has(handle.toLowerCase())
      ? handle : null;
  }

  function linkedXAccount(page) {
    const social = page.querySelector('#about .social-links');
    if (!social) return null;
    for (const item of social.querySelectorAll('a[href], [data-url], [data-href], [data-link]')) {
      for (const value of [item.getAttribute('href'), item.dataset.url,
        item.dataset.href, item.dataset.link]) {
        if (!value) continue;
        const handle = xAccountFromUrl(value);
        if (handle) return handle;
      }
    }
    return null;
  }

  function youtubeChannelUrlFrom(value) {
    let url;
    try { url = new URL(value, location.href); }
    catch { return null; }
    if (['www.roblox.com', 'roblox.com'].includes(url.hostname)) {
      const destination = url.searchParams.get('url') || url.searchParams.get('redirectUrl');
      if (!destination) return null;
      try { url = new URL(destination); } catch { return null; }
    }
    if (url.protocol !== 'https:' || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const channelId = parts[0] === 'channel' ? parts[1] : '';
    if (channelId && /^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
      return `https://www.youtube.com/channel/${channelId}`;
    }
    const handle = parts[0]?.startsWith('@') ? parts[0] : '';
    const legacyName = ['user', 'c'].includes(parts[0]) ? parts[1] : parts.length === 1 ? parts[0] : '';
    const candidate = handle || legacyName;
    const reserved = new Set(['watch', 'shorts', 'live', 'playlist', 'feed', 'results', 'gaming', 'music', 'premium']);
    if (!candidate || reserved.has(candidate.toLowerCase())
      || !/^@?[A-Za-z0-9._-]{1,100}$/.test(candidate)) return null;
    const prefix = handle ? '' : parts[0] === 'user' || parts[0] === 'c' ? `/${parts[0]}` : '';
    return `https://www.youtube.com${prefix}/${candidate}`;
  }

  function linkedYouTubeChannel(page) {
    const social = page.querySelector('#about .social-links');
    if (!social) return null;
    for (const item of social.querySelectorAll('a[href], [data-url], [data-href], [data-link]')) {
      for (const value of [item.getAttribute('href'), item.dataset.url,
        item.dataset.href, item.dataset.link]) {
        if (!value) continue;
        const channelUrl = youtubeChannelUrlFrom(value);
        if (channelUrl) return channelUrl;
      }
    }
    return null;
  }

  function fetchedXAccount(placeId, page) {
    if (!page.querySelector('#game-detail-meta-data') && document.readyState === 'loading') return null;
    const cached = xAccountCache.get(placeId);
    if (cached && Date.now() < cached.expiresAt) return cached.handle;
    if (xAccountPending.has(placeId)) return cached?.handle || null;
    xAccountPending.add(placeId);
    const universeId = Number(page.querySelector('#game-detail-meta-data')?.getAttribute('data-universe-id'));
    sendMessage({ type: 'rc-game-x-link', placeId: Number(placeId), universeId }, response => {
      xAccountPending.delete(placeId);
      const failed = !!chrome.runtime.lastError || !response || !!response.error;
      const handle = !failed && typeof response.url === 'string'
        ? xAccountFromUrl(response.url) : null;
      xAccountCache.set(placeId, {
        handle,
        expiresAt: Date.now() + (failed ? 30_000 : 5 * 60_000)
      });
      schedule();
    });
    return cached?.handle || null;
  }

  function fetchedYouTubeChannel(placeId, page) {
    if (!page.querySelector('#game-detail-meta-data') && document.readyState === 'loading') return null;
    const cached = youtubeLinkCache.get(placeId);
    if (cached && Date.now() < cached.expiresAt) return cached.url;
    if (youtubeLinkPending.has(placeId)) return cached?.url || null;
    youtubeLinkPending.add(placeId);
    const universeId = Number(page.querySelector('#game-detail-meta-data')?.getAttribute('data-universe-id'));
    sendMessage({ type: 'rc-game-youtube-link', placeId: Number(placeId), universeId }, response => {
      youtubeLinkPending.delete(placeId);
      const failed = !!chrome.runtime.lastError || !response || !!response.error;
      const url = !failed && typeof response.url === 'string'
        ? youtubeChannelUrlFrom(response.url) : null;
      youtubeLinkCache.set(placeId, {
        url,
        expiresAt: Date.now() + (failed ? 30_000 : 5 * 60_000)
      });
      schedule();
    });
    return cached?.url || null;
  }

  function positionSocialFeed(panel, context, side) {
    const { page, kind } = context;
    const anchor = kind === 'game' ? page.querySelector('#about') || page
      : kind === 'profile' ? profileFeedAnchor(page) : page;
    const observer = side === 'left' ? youtubeFeedResizeObserver : xFeedResizeObserver;
    const previousAnchor = side === 'left' ? youtubeFeedAnchor : xFeedAnchor;
    if (previousAnchor !== anchor) {
      observer.disconnect();
      observer.observe(anchor);
      if (side === 'left') youtubeFeedAnchor = anchor;
      else xFeedAnchor = anchor;
    }
    const content = anchor.getBoundingClientRect();
    let leftEdge = 0;
    if (kind !== 'game' && (side === 'left' || kind === 'profile')) {
      // Leave the native navigation and communities sidebar accessible.
      for (const sidebar of document.querySelectorAll('#navigation, #left-navigation-container, #group-container .groups-list-sidebar')) {
        const rect = sidebar.getBoundingClientRect();
        if (rect.width > 0 && rect.right <= content.left) leftEdge = Math.max(leftEdge, rect.right);
      }
    }
    const room = Math.floor(side === 'left' ? content.left - leftEdge - 28 : innerWidth - content.right - 28);
    const bothProfileSidesFit = kind !== 'profile' || (content.left - leftEdge - 28 >= 200
      && innerWidth - content.right - 28 >= 200);
    const beside = content.width >= 420 && room >= (kind === 'game' ? 240 : 200) && bothProfileSidesFit;
    const inline = kind !== 'game' && !beside;
    panel.classList.toggle('rc-x-feed-floating', kind === 'game' && !beside);
    panel.classList.toggle('rc-community-feed-inline', inline && kind === 'community');
    panel.classList.toggle('rc-profile-feed-inline', inline && kind === 'profile');
    if (inline) {
      const rowId = kind === 'profile' ? 'rc-profile-social-feeds' : 'rc-community-social-feeds';
      let row = document.getElementById(rowId);
      if (!row || row.parentElement !== page) {
        row?.remove();
        row = document.createElement('div');
        row.id = rowId;
        let next = page.querySelector(kind === 'profile'
          ? '#rc-profile-enhancements, [data-rc-profile-section]' : '.rbx-tabs-horizontal');
        while (next && next.parentElement !== page) next = next.parentElement;
        if (next) next.before(row);
        else if (kind === 'profile') page.append(row);
        else page.prepend(row);
      }
      if (panel.parentElement !== row) row.append(panel);
    } else if (panel.parentElement !== document.body) document.body.append(panel);
    cleanupSocialFeedRows();
    if (beside) {
      const width = Math.min(350, room);
      panel.style.left = `${Math.round(scrollX + (side === 'left' ? content.left - width - 12 : content.right + 12))}px`;
      panel.style.top = `${Math.round(scrollY + (kind === 'profile' ? content.top : page.getBoundingClientRect().top))}px`;
      panel.style.width = `${width}px`;
    } else {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('width');
    }
    return beside;
  }

  function positionXFeed(panel, context) {
    return positionSocialFeed(panel, context, 'right');
  }

  function positionYouTubeFeed(panel, context) {
    return positionSocialFeed(panel, context, 'left');
  }

  function setXFeedExpanded(panel, expanded) {
    panel.classList.toggle('rc-x-feed-collapsed', !expanded);
    const toggle = panel.querySelector('.rc-x-feed-toggle');
    const label = expanded ? 'Collapse' : 'Preview';
    setText(toggle, label);
    toggle.setAttribute('aria-expanded', String(expanded));
  }

  function loadXPosts(panel, force = false) {
    const handle = panel.dataset.handle;
    const status = panel.querySelector('.rc-x-feed-status');
    const list = panel.querySelector('.rc-x-feed-posts');
    const retry = panel.querySelector('.rc-x-feed-retry');
    retry.disabled = true;
    status.textContent = 'Loading recent posts via FxEmbed...';
    sendMessage({ type: 'rc-x-posts', handle, force }, response => {
      if (!panel.isConnected || panel.dataset.handle !== handle) return;
      retry.disabled = false;
      if (chrome.runtime.lastError || !Array.isArray(response?.posts)) {
        status.textContent = 'Posts unavailable right now. Try again later or open X.';
        return;
      }
      list.replaceChildren();
      for (const post of response.posts) {
        if (!/^\d{5,25}$/.test(String(post.id || ''))) continue;
        const card = document.createElement('a');
        card.className = 'rc-x-feed-post';
        card.href = `https://x.com/${handle}/status/${post.id}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        const date = typeof post.createdAt === 'string' ? new Date(post.createdAt) : null;
        if (date && Number.isFinite(date.getTime())) {
          const time = document.createElement('time');
          time.dateTime = date.toISOString();
          time.textContent = badgeDateTimeFormatter.format(date);
          card.append(time);
        }
        const text = document.createElement('div');
        text.className = 'rc-x-feed-post-text';
        if (post.text) text.setAttribute('data-rc-i18n-ignore', '');
        text.textContent = post.text || 'View post on X';
        card.append(text);
        const imageUrls = Array.isArray(post.images) ? post.images : [post.imageUrl];
        const validImages = imageUrls.filter(url => typeof url === 'string' && url.startsWith('https://')).slice(0, 4);
        if (validImages.length) {
          const gallery = document.createElement('div');
          gallery.className = 'rc-x-feed-media';
          gallery.dataset.count = String(validImages.length);
          for (const [index, url] of validImages.entries()) {
            const frame = document.createElement('div');
            frame.className = 'rc-x-feed-media-item';
            frame.textContent = 'Loading image...';
            gallery.append(frame);
            sendMessage({ type: 'rc-x-image', url }, response => {
              if (!frame.isConnected) return;
              if (chrome.runtime.lastError || typeof response?.dataUrl !== 'string'
                || !/^data:image\/(?:jpeg|png|webp|gif);base64,/.test(response.dataUrl)) {
                frame.textContent = 'Image unavailable';
                return;
              }
              const image = document.createElement('img');
              image.alt = `Post image ${index + 1}`;
              image.loading = 'lazy';
              image.addEventListener('error', () => {
                frame.textContent = 'Image unavailable';
              }, { once: true });
              image.src = response.dataUrl;
              frame.replaceChildren(image);
            });
          }
          card.append(gallery);
        }
        list.append(card);
      }
      status.textContent = response.stale
        ? 'Showing saved posts; live updates are unavailable. Via FxEmbed.'
        : list.childElementCount ? 'Recent posts via FxEmbed.' : 'No public posts available.';
    });
  }

  function loadYouTubeVideos(panel, force = false) {
    const channelUrl = panel.dataset.channelUrl;
    const status = panel.querySelector('.rc-x-feed-status');
    const list = panel.querySelector('.rc-x-feed-posts');
    const retry = panel.querySelector('.rc-x-feed-retry');
    retry.disabled = true;
    status.textContent = 'Loading recent videos from YouTube...';
    sendMessage({ type: 'rc-youtube-videos', channelUrl, force }, response => {
      if (!panel.isConnected || panel.dataset.channelUrl !== channelUrl) return;
      retry.disabled = false;
      if (chrome.runtime.lastError || !Array.isArray(response?.videos)) {
        status.textContent = 'Videos unavailable right now. Try again later or open YouTube.';
        return;
      }
      const title = panel.querySelector('.rc-x-feed-title');
      if (response.channelTitle) title.textContent = `Latest on YouTube - ${response.channelTitle}`;
      const profile = panel.querySelector('.rc-x-feed-footer > a');
      if (response.channelId && /^UC[A-Za-z0-9_-]{22}$/.test(response.channelId)) {
        profile.href = `https://www.youtube.com/channel/${response.channelId}`;
      }
      list.replaceChildren();
      for (const video of response.videos) {
        if (!/^[A-Za-z0-9_-]{11}$/.test(String(video.id || ''))) continue;
        const card = document.createElement('a');
        card.className = 'rc-x-feed-post';
        card.href = `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        const gallery = document.createElement('div');
        gallery.className = 'rc-x-feed-media';
        gallery.dataset.count = '1';
        const frame = document.createElement('div');
        frame.className = 'rc-x-feed-media-item';
        frame.textContent = 'Loading thumbnail...';
        gallery.append(frame);
        card.append(gallery);
        const text = document.createElement('div');
        text.className = 'rc-x-feed-post-text';
        if (video.title) text.setAttribute('data-rc-i18n-ignore', '');
        text.textContent = video.title || 'Watch video on YouTube';
        card.append(text);
        const date = typeof video.published === 'string' ? new Date(video.published) : null;
        if (date && Number.isFinite(date.getTime())) {
          const time = document.createElement('time');
          time.dateTime = date.toISOString();
          time.textContent = badgeDateTimeFormatter.format(date);
          card.append(time);
        }
        list.append(card);
        sendMessage({ type: 'rc-youtube-image', videoId: video.id }, imageResponse => {
          if (!frame.isConnected) return;
          if (chrome.runtime.lastError || typeof imageResponse?.dataUrl !== 'string'
            || !/^data:image\/(?:jpeg|png|webp|gif);base64,/.test(imageResponse.dataUrl)) {
            frame.textContent = 'Thumbnail unavailable';
            return;
          }
          const image = document.createElement('img');
          image.alt = video.title || 'YouTube video thumbnail';
          if (video.title) image.setAttribute('data-rc-i18n-ignore', '');
          image.loading = 'lazy';
          image.addEventListener('error', () => { frame.textContent = 'Thumbnail unavailable'; }, { once: true });
          image.src = imageResponse.dataUrl;
          frame.replaceChildren(image);
        });
      }
      status.textContent = list.childElementCount ? 'Recent videos from YouTube.' : 'No public videos available.';
    });
  }

  function syncXFeed() {
    let panel = document.getElementById('rc-x-feed-panel');
    const context = socialFeedContext();
    if (!context || !document.body) {
      panel?.remove();
      cleanupSocialFeedRows();
      xFeedResizeObserver.disconnect();
      xFeedAnchor = null;
      return;
    }
    if (document.documentElement.hasAttribute('data-rc-hide-x-feed')) {
      panel?.remove();
      cleanupSocialFeedRows();
      xFeedResizeObserver.disconnect();
      xFeedAnchor = null;
      return;
    }
    if (panel && panel.dataset.contextKey !== context.key) {
      panel.remove();
      cleanupSocialFeedRows();
      panel = null;
      xFeedResizeObserver.disconnect();
      xFeedAnchor = null;
    }
    const handle = context.kind === 'community'
      ? xAccountFromUrl(fetchedCommunityLinks(context.id)?.xUrl)
      : context.kind === 'profile' ? xAccountFromUrl(context.socialLinks?.xUrl)
      : linkedXAccount(context.page) || fetchedXAccount(context.id, context.page);
    if (!handle) {
      if (context.kind !== 'game') {
        panel?.remove();
        panel = null;
        cleanupSocialFeedRows();
      }
      if (!panel) {
        xFeedResizeObserver.disconnect();
        xFeedAnchor = null;
      }
      return;
    }
    if (panel?.dataset.handle === handle) {
      positionXFeed(panel, context);
      return;
    }
    panel?.remove();

    panel = document.createElement('aside');
    panel.id = 'rc-x-feed-panel';
    panel.dataset.contextKey = context.key;
    panel.dataset[context.kind === 'game' ? 'placeId' : context.kind === 'profile' ? 'userId' : 'groupId'] = context.id;
    panel.dataset.handle = handle;
    panel.setAttribute('aria-label', `Latest posts from @${handle} on X`);

    const header = document.createElement('div');
    header.className = 'rc-x-feed-header';
    const title = document.createElement('div');
    title.className = 'rc-x-feed-title';
    title.textContent = `Latest on X - @${handle}`;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'rc-x-feed-toggle';
    header.append(title, toggle);

    const body = document.createElement('div');
    body.className = 'rc-x-feed-body';
    const status = document.createElement('p');
    status.className = 'rc-x-feed-status';
    status.setAttribute('role', 'status');
    const list = document.createElement('div');
    list.className = 'rc-x-feed-posts';
    const profile = document.createElement('a');
    profile.href = `https://x.com/${handle}`;
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    profile.textContent = `Open @${handle} on X`;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'rc-x-feed-retry';
    retry.textContent = 'Reload posts';
    retry.addEventListener('click', () => loadXPosts(panel, true));
    const footer = document.createElement('div');
    footer.className = 'rc-x-feed-footer';
    footer.append(profile, retry);
    body.append(status, list, footer);
    toggle.addEventListener('click', () => {
      panel.dataset.userToggled = 'true';
      setXFeedExpanded(panel, panel.classList.contains('rc-x-feed-collapsed'));
    });
    panel.append(header, body);
    document.body.append(panel);
    positionXFeed(panel, context);
    setXFeedExpanded(panel, true);
    loadXPosts(panel);
  }

  function syncYouTubeFeed() {
    let panel = document.getElementById('rc-youtube-feed-panel');
    const context = socialFeedContext();
    if (!context || !document.body) {
      panel?.remove();
      cleanupSocialFeedRows();
      youtubeFeedResizeObserver.disconnect();
      youtubeFeedAnchor = null;
      return;
    }
    if (document.documentElement.hasAttribute('data-rc-hide-youtube-feed')) {
      panel?.remove();
      cleanupSocialFeedRows();
      youtubeFeedResizeObserver.disconnect();
      youtubeFeedAnchor = null;
      return;
    }
    if (panel && panel.dataset.contextKey !== context.key) {
      panel.remove();
      cleanupSocialFeedRows();
      panel = null;
      youtubeFeedResizeObserver.disconnect();
      youtubeFeedAnchor = null;
    }
    const channelUrl = context.kind === 'community'
      ? youtubeChannelUrlFrom(fetchedCommunityLinks(context.id)?.youtubeUrl)
      : context.kind === 'profile' ? youtubeChannelUrlFrom(context.socialLinks?.youtubeUrl)
      : linkedYouTubeChannel(context.page) || fetchedYouTubeChannel(context.id, context.page);
    if (!channelUrl) {
      if (context.kind !== 'game') {
        panel?.remove();
        panel = null;
        cleanupSocialFeedRows();
      }
      if (!panel) {
        youtubeFeedResizeObserver.disconnect();
        youtubeFeedAnchor = null;
      }
      return;
    }
    if (panel?.dataset.channelUrl === channelUrl) {
      positionYouTubeFeed(panel, context);
      return;
    }
    panel?.remove();

    panel = document.createElement('aside');
    panel.id = 'rc-youtube-feed-panel';
    panel.dataset.contextKey = context.key;
    panel.dataset[context.kind === 'game' ? 'placeId' : context.kind === 'profile' ? 'userId' : 'groupId'] = context.id;
    panel.dataset.channelUrl = channelUrl;
    panel.setAttribute('aria-label', `Latest videos from this ${context.kind} on YouTube`);

    const header = document.createElement('div');
    header.className = 'rc-x-feed-header';
    const title = document.createElement('div');
    title.className = 'rc-x-feed-title';
    title.textContent = 'Latest on YouTube';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'rc-x-feed-toggle';
    header.append(title, toggle);

    const body = document.createElement('div');
    body.className = 'rc-x-feed-body';
    const status = document.createElement('p');
    status.className = 'rc-x-feed-status';
    status.setAttribute('role', 'status');
    const list = document.createElement('div');
    list.className = 'rc-x-feed-posts';
    const profile = document.createElement('a');
    profile.href = channelUrl;
    profile.target = '_blank';
    profile.rel = 'noopener noreferrer';
    profile.textContent = 'Open channel on YouTube';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'rc-x-feed-retry';
    retry.textContent = 'Reload videos';
    retry.addEventListener('click', () => loadYouTubeVideos(panel, true));
    const footer = document.createElement('div');
    footer.className = 'rc-x-feed-footer';
    footer.append(profile, retry);
    body.append(status, list, footer);
    toggle.addEventListener('click', () => {
      panel.dataset.userToggled = 'true';
      setXFeedExpanded(panel, panel.classList.contains('rc-x-feed-collapsed'));
    });
    panel.append(header, body);
    document.body.append(panel);
    positionYouTubeFeed(panel, context);
    setXFeedExpanded(panel, true);
    loadYouTubeVideos(panel);
  }

  function badgeIdFor(row) {
    const link = row.querySelector('.badge-image a[href]');
    if (!link) return null;
    try {
      const url = new URL(link.href, location.href);
      if (!['www.roblox.com', 'roblox.com'].includes(url.hostname)) return null;
      const match = url.pathname.match(/(?:^|\/)(?:catalog|badges)\/(\d+)(?:\/|$)/);
      const id = Number(match?.[1]);
      return Number.isSafeInteger(id) && id > 0 ? id : null;
    } catch {
      return null;
    }
  }

  function renderBadgeDate(row, awardedAt) {
    let label = row.querySelector('.rc-badge-earned-date');
    const date = typeof awardedAt === 'string' ? new Date(awardedAt) : null;
    if (!date || !Number.isFinite(date.getTime())) {
      label?.remove();
      return;
    }

    if (!label) {
      label = document.createElement('time');
      label.className = 'rc-badge-earned-date';
    }
    label.dateTime = date.toISOString();
    setText(label, `Earned ${badgeDateFormatter.format(date)}`);
    const title = `Earned ${badgeDateTimeFormatter.format(date)}`;
    if (globalThis.RobloxCustomizerI18n) globalThis.RobloxCustomizerI18n.attribute(label, 'title', title);
    else label.title = title;
    const name = row.querySelector('.badge-name');
    if (name && label.previousElementSibling !== name) name.insertAdjacentElement('afterend', label);
    else if (!label.isConnected) (row.querySelector('.badge-content') || row).append(label);
  }

  function syncBadges() {
    if (badgeRequest || Date.now() < badgeRetryAfter || !GAME_PATH.test(location.pathname)) return;
    const page = document.querySelector('#game-detail-page');
    if (!pageMatchesPath(page)) return;

    const pending = [];
    for (const row of page.querySelectorAll('.badge-row')) {
      const id = badgeIdFor(row);
      if (!id) continue;
      if (row.dataset.rcBadgeId !== String(id)) {
        row.dataset.rcBadgeId = String(id);
        row.removeAttribute('data-rc-badge-owned');
        row.removeAttribute('data-rc-badge-awarded-at');
        renderBadgeDate(row, null);
      }
      if (row.hasAttribute('data-rc-badge-owned')) {
        renderBadgeDate(row, row.dataset.rcBadgeAwardedAt);
      }
      if (!row.hasAttribute('data-rc-badge-owned')) pending.push({ row, id });
    }
    const ids = [...new Set(pending.map(item => item.id))].slice(0, 100);
    if (!ids.length) return;

    badgeRequest = true;
    sendMessage({ type: 'rc-badge-ownership', badgeIds: ids }, response => {
      badgeRequest = false;
      if (chrome.runtime.lastError || !Array.isArray(response?.ownedBadgeIds)) {
        badgeRetryAfter = Date.now() + 30_000;
        setTimeout(schedule, 30_000);
        return;
      }
      const requested = new Set(ids);
      const owned = new Set(response.ownedBadgeIds);
      const dates = new Map((Array.isArray(response.awardedBadges) ? response.awardedBadges : [])
        .filter(item => Number.isSafeInteger(item?.badgeId) && typeof item?.awardedDate === 'string')
        .map(item => [item.badgeId, item.awardedDate]));
      for (const { row, id } of pending) {
        if (row.isConnected && requested.has(id) && row.dataset.rcBadgeId === String(id)) {
          row.setAttribute('data-rc-badge-owned', owned.has(id) ? 'true' : 'false');
          const awardedAt = owned.has(id) ? dates.get(id) : null;
          if (awardedAt) row.dataset.rcBadgeAwardedAt = awardedAt;
          else row.removeAttribute('data-rc-badge-awarded-at');
          renderBadgeDate(row, awardedAt);
        }
      }
      schedule();
    });
  }

  function setText(node, value) {
    const matches = globalThis.RobloxCustomizerI18n?.matches(node, value) ?? node.textContent === value;
    if (!matches) node.textContent = value;
  }

  function renderServerMetrics(host, details, locationLookup = null) {
    let metrics = host.querySelector(':scope > .rc-server-metrics');
    const ping = details?.ping;
    const validPing = typeof ping === 'number' && Number.isFinite(ping)
      && ping > 0 && ping <= 10_000;
    const countryState = locationLookup ? publicCountries.get(locationLookup.id) : null;
    const code = details?.countryCode || countryState?.countryCode;
    const countryPending = countryState?.pending === true;
    let countryName = '';
    if (typeof code === 'string' && /^[A-Z]{2}$/i.test(code)) {
      try {
        countryName = new Intl.DisplayNames([globalThis.RobloxCustomizerI18n?.locale() || document.documentElement.lang || 'en'],
          { type: 'region' }).of(code.toUpperCase()) || '';
      } catch { countryName = code.toUpperCase(); }
    }
    if (!validPing && !countryName && !countryPending && !locationLookup) {
      metrics?.remove();
      return;
    }
    if (!metrics) {
      metrics = document.createElement('div');
      metrics.className = 'rc-server-metrics';
      const latency = document.createElement('span');
      latency.className = 'rc-server-latency';
      latency.title = 'Ping reported by Roblox; your connection may differ.';
      const country = document.createElement('span');
      country.className = 'rc-server-country';
      metrics.append(latency, country);
      host.append(metrics);
    }
    const latencyLevel = validPing ? ping <= 100 ? 'low' : ping <= 200 ? 'medium' : 'high' : 'unknown';
    if (metrics.dataset.rcLatency !== latencyLevel) metrics.dataset.rcLatency = latencyLevel;
    const levelLabel = { low: 'Low', medium: 'Moderate', high: 'High' }[latencyLevel];
    const latencyNode = metrics.querySelector('.rc-server-latency');
    latencyNode.hidden = !validPing;
    if (validPing) setText(latencyNode, `${levelLabel} latency · ${Math.round(ping)} ms`);
    const countryNode = metrics.querySelector('.rc-server-country');
    countryNode.hidden = !countryName && !countryPending;
    if (countryName) {
      setText(countryNode, `${countryState?.estimated && !details?.countryCode
        ? 'Approx. country' : 'Country'} ${countryName}`);
      const title = countryState?.estimated && !details?.countryCode
        ? 'Estimated from the server address; Roblox routing may differ.' : '';
      if (globalThis.RobloxCustomizerI18n) globalThis.RobloxCustomizerI18n.attribute(countryNode, 'title', title);
      else countryNode.title = title;
    } else if (countryPending) {
      setText(countryNode, 'Finding country...');
      if (globalThis.RobloxCustomizerI18n) globalThis.RobloxCustomizerI18n.attribute(countryNode, 'title', 'Detecting the server country automatically.');
      else countryNode.title = 'Detecting the server country automatically.';
    }
    metrics.querySelector('.rc-server-locate')?.remove();
  }

  function queuePublicServerCountry(placeId, id) {
    if (!id || publicCountries.has(id)) return;
    publicCountries.set(id, { pending: true });
    publicCountryQueue.push({ placeId, id });
    processPublicCountryQueue();
  }

  function processPublicCountryQueue() {
    while (activePublicCountryRequests < 2 && publicCountryQueue.length) {
      const request = publicCountryQueue.shift();
      if (request.placeId !== publicStatusPlaceId) continue;
      activePublicCountryRequests += 1;
      sendMessage({ type: 'rc-public-server-country',
        placeId: request.placeId, serverId: request.id }, response => {
        activePublicCountryRequests -= 1;
        if (publicStatusPlaceId === request.placeId) {
          const error = chrome.runtime.lastError?.message || response?.error;
          const countryCode = response?.countryCode;
          publicCountries.set(request.id, !error && typeof countryCode === 'string'
            && /^[A-Z]{2}$/i.test(countryCode)
            ? { countryCode: countryCode.toUpperCase(), estimated: true }
            : { error: error || 'Country unavailable.' });
          schedule();
        }
        processPublicCountryQueue();
      });
    }
  }

  function nativeServerMetrics(card) {
    const pingValue = card.getAttribute('data-rc-ping')
      || card.querySelector('[data-rc-ping]')?.getAttribute('data-rc-ping')
      || card.getAttribute('data-ping')
      || card.querySelector('[data-ping]')?.getAttribute('data-ping');
    const textNodes = [];
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement?.closest('.rc-server-metrics')) textNodes.push(node.textContent);
    }
    const labelledPing = textNodes.join(' ').match(
      /\b(?:ping|latency)\s*:?\s*(\d+(?:\.\d+)?)\s*ms\b/i)?.[1];
    const ping = Number(pingValue || labelledPing);
    const countryCode = card.getAttribute('data-country-code')
      || card.querySelector('[data-country-code]')?.getAttribute('data-country-code') || '';
    return {
      ping: (pingValue || labelledPing) && Number.isFinite(ping) && ping > 0 && ping <= 10_000
        ? Math.round(ping) : null,
      countryCode: /^[A-Z]{2}$/i.test(countryCode) ? countryCode.toUpperCase() : ''
    };
  }

  function combinedServerMetrics(card, details) {
    const native = nativeServerMetrics(card);
    return {
      ping: native.ping ?? details?.ping,
      countryCode: details?.countryCode || native.countryCode
    };
  }

  function publicServerIdFromCard(card) {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const names = ['data-rc-instance-id', 'data-btr-instance-id', 'data-game-id',
      'data-gameid', 'data-server-id', 'data-serverid', 'data-instance-id', 'data-job-id'];
    for (const node of [card, ...card.querySelectorAll(names.map(name => `[${name}]`).join(','))]) {
      for (const name of names) {
        const value = node.getAttribute(name);
        if (value && uuid.test(value)) return value.toLowerCase();
      }
    }
    for (const link of card.querySelectorAll('a[href]')) {
      try {
        const url = new URL(link.href, location.href);
        for (const name of ['gameId', 'gameInstanceId', 'jobId', 'serverId', 'instanceId']) {
          const value = url.searchParams.get(name);
          if (value && uuid.test(value)) return value.toLowerCase();
        }
      } catch { /* Other controls may have non-URL actions. */ }
    }
    return '';
  }

  function privateServerIdFromRow(row) {
    const names = ['data-private-server-id', 'data-vip-server-id',
      'data-server-id', 'data-serverid'];
    for (const node of [row, ...row.querySelectorAll(names.map(name => `[${name}]`).join(','))]) {
      for (const name of names) {
        const id = Number(node.getAttribute(name));
        if (Number.isSafeInteger(id) && id > 0) return id;
      }
    }
    for (const link of row.querySelectorAll('a[href]')) {
      try {
        const url = new URL(link.href, location.href);
        const pathId = Number(url.pathname.match(/^\/private-server\/configure\/(\d+)\/?$/)?.[1]);
        if (Number.isSafeInteger(pathId) && pathId > 0) return pathId;
        for (const name of ['privateServerId', 'vipServerId']) {
          const id = Number(url.searchParams.get(name));
          if (Number.isSafeInteger(id) && id > 0) return id;
        }
      } catch { /* Other controls may have non-URL actions. */ }
    }
    return 0;
  }

  function publicServerCards(container) {
    return [...container?.querySelectorAll('.card-item') || []].filter(card =>
      !card.closest(NON_PUBLIC_SERVER_SECTION_SELECTOR)
      && !card.matches('.rc-private-server-card, .rc-private-server-native-card')
      && !card.querySelector(PRIVATE_SERVER_CONFIGURE_SELECTOR)
      && !privateServerIdFromRow(card));
  }

  function publicServerPlayerCount(card) {
    for (const name of ['data-rc-playing', 'data-playing', 'data-player-count']) {
      const value = card.getAttribute(name) || card.querySelector(`[${name}]`)?.getAttribute(name);
      if (value == null || value === '') continue;
      const count = Number(value);
      if (Number.isSafeInteger(count) && count >= 0) return count;
    }
    const status = card.querySelector('.game-server-status, .server-player-count') || card;
    const localized = globalThis.RobloxCustomizerNativeLabels?.playerCount(status.textContent);
    if (localized) return localized.playing;
    const count = status.textContent.match(/\b([\d,]+)\s*(?:of|\/)\s*[\d,]+\b/i)?.[1]
      || status.textContent.match(/\b([\d,]+)\s+(?:players?|people)\b/i)?.[1];
    const value = Number(count?.replaceAll(',', ''));
    return count && Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  function publicServerFilterBound(key) {
    const value = Number(publicServerFilter[key]);
    return publicServerFilter[key] !== '' && Number.isFinite(value) && value >= 0 ? value : null;
  }

  function filteredPublicServerCards(cards) {
    const minLatency = publicServerFilterBound('minLatency');
    const maxPing = publicServerFilterBound('maxPing');
    const minPlayers = publicServerFilterBound('minPlayers');
    const maxPlayers = publicServerFilterBound('maxPlayers');
    const matching = cards.filter(card => {
      const ping = Number(card.dataset.rcServerPing);
      const hasPing = Number.isFinite(ping) && ping > 0;
      const countryMatch = publicServerFilter.country === 'all'
        || publicServerFilter.country === 'unknown' && card.dataset.rcServerCountryState === 'unknown'
        || card.dataset.rcServerCountry === publicServerFilter.country;
      const players = publicServerPlayerCount(card);
      return countryMatch
        && (minLatency === null || hasPing && ping >= minLatency)
        && (maxPing === null || hasPing && ping <= maxPing)
        && (minPlayers === null || players !== null && players >= minPlayers)
        && (maxPlayers === null || players !== null && players <= maxPlayers);
    });
    if (publicServerFilter.playerSort !== 'default') {
      const direction = publicServerFilter.playerSort === 'asc' ? 1 : -1;
      matching.sort((a, b) => {
        const first = publicServerPlayerCount(a);
        const second = publicServerPlayerCount(b);
        if (first === null || second === null) return first === second ? 0 : first === null ? 1 : -1;
        return (first - second) * direction;
      });
    }
    return matching;
  }

  function publicServerBrowser(container) {
    const placeId = placeIdFromPath();
    let state = publicServerBrowsers.get(container);
    if (!state || state.placeId !== placeId) {
      state = { placeId, page: 0, loading: false, searching: false, searchController: null,
        message: '', version: 0, filterSignature: '' };
      publicServerBrowsers.set(container, state);
    }
    const signature = JSON.stringify(publicServerFilter);
    if (state.filterSignature !== signature) {
      state.searchController?.abort();
      state.filterSignature = signature;
      state.page = 0;
      state.message = '';
      state.version += 1;
    }
    return state;
  }

  function publicServerLoadMore(container) {
    // A server-list-section ancestor may contain private and friends lists too.
    // Only controls owned by this public container can load its next page.
    return [...container.querySelectorAll('button, a[role="button"]')].find(button =>
      !button.closest(NON_PUBLIC_SERVER_SECTION_SELECTOR)
      && !button.closest('.rc-public-server-pagination, .rc-public-server-filters')
      && (/^Load More(?: Servers)?$/i.test(button.textContent.trim())
        || globalThis.RobloxCustomizerNativeLabels?.matches('loadMore', button.textContent))) || null;
  }

  function sortNativePublicServers(container, order) {
    const select = [...container.querySelectorAll('select[data-rc-native-server-sort]')]
      .find(node => !node.closest(NON_PUBLIC_SERVER_SECTION_SELECTOR));
    if (!select) return false;
    if (!('rcDefaultSort' in select.dataset)) select.dataset.rcDefaultSort = select.value;
    const option = order === 'default'
      ? [...select.options].find(item => item.value === select.dataset.rcDefaultSort)
      : [...select.options].find(item => new RegExp(order === 'asc'
        ? 'asc|fewest|lowest|low to high|升序|递增|遞增|从少到多|從少到多|由少到多'
        : 'desc|most|highest|high to low|降序|递减|遞減|从多到少|從多到少|由多到少', 'i')
        .test(`${item.value} ${item.textContent}`));
    if (!option || select.value === option.value) return false;
    // React owns this select. Use its native setter so the change reaches Roblox's loader.
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(select, option.value);
    else select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function waitForPublicServerBatch(container, button, signal = null, waitForCards = false) {
    return new Promise(resolve => {
      if (signal?.aborted) { resolve('cancelled'); return; }
      const before = publicServerCards(container);
      const ids = before.map(card => publicServerIdFromCard(card));
      const placeId = placeIdFromPath();
      let timeout;
      let finished = false;
      const finish = result => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        clearTimeout(timeout);
        signal?.removeEventListener('abort', cancel);
        resolve(result);
      };
      const cancel = () => finish('cancelled');
      const check = () => {
        if (!container.isConnected || placeIdFromPath() !== placeId) {
          finish('cancelled');
          return;
        }
        const cards = publicServerCards(container);
        if ((!waitForCards || cards.length) && (cards.length !== before.length || cards.some((card, index) =>
          ids[index] ? publicServerIdFromCard(card) !== ids[index] : card !== before[index]))) {
          finish('loaded');
        }
      };
      const observer = new MutationObserver(check);
      observer.observe(container,
        { childList: true, subtree: true, characterData: true });
      signal?.addEventListener('abort', cancel, { once: true });
      // Roblox may replace Load More with a spinner while its request is pending.
      // Its temporary disappearance must not be mistaken for the last page.
      timeout = setTimeout(() => finish(!container.isConnected || placeIdFromPath() !== placeId
        ? 'cancelled' : publicServerLoadMore(container) ? 'timeout' : 'end'), 15_000);
      try {
        if (button.click() === false) finish('unchanged');
        else check();
      }
      catch { finish('timeout'); }
    });
  }

  function publicServerSearchValidation() {
    for (const [key, label] of [['minLatency', 'Minimum latency'], ['maxPing', 'Maximum ping'],
      ['minPlayers', 'Minimum players'], ['maxPlayers', 'Maximum players']]) {
      if (publicServerFilter[key] === '') continue;
      const value = Number(publicServerFilter[key]);
      const players = key.endsWith('Players');
      if (!Number.isFinite(value) || value < 0 || (players ? !Number.isSafeInteger(value) : value > 10_000)) {
        return `${label} must be ${players ? 'a whole number of 0 or more' : 'between 0 and 10000 ms'}.`;
      }
    }
    for (const [min, max, label] of [['minPlayers', 'maxPlayers', 'players'], ['minLatency', 'maxPing', 'latency']]) {
      const minimum = publicServerFilterBound(min);
      const maximum = publicServerFilterBound(max);
      if (minimum !== null && maximum !== null && minimum > maximum) {
        return `Minimum ${label} cannot exceed the maximum.`;
      }
    }
    return '';
  }

  function pendingPublicServerSearchDetails(container) {
    const minPlayers = publicServerFilterBound('minPlayers');
    const maxPlayers = publicServerFilterBound('maxPlayers');
    const minLatency = publicServerFilterBound('minLatency');
    const maxPing = publicServerFilterBound('maxPing');
    return publicServerCards(container).some(card => {
      const players = publicServerPlayerCount(card);
      if (minPlayers !== null && (players === null || players < minPlayers)
        || maxPlayers !== null && (players === null || players > maxPlayers)) return false;
      const ping = Number(card.dataset.rcServerPing);
      if (ping > 0 && (minLatency !== null && ping < minLatency || maxPing !== null && ping > maxPing)) return false;
      if (publicServerFilter.country !== 'all' && publicServerFilter.country !== 'unknown'
        && card.dataset.rcServerCountry && card.dataset.rcServerCountry !== publicServerFilter.country) return false;
      return publicServerFilter.country !== 'all' && card.dataset.rcServerCountryState === 'pending'
        || (minLatency !== null || maxPing !== null) && !(ping > 0)
          && !!publicServerIdFromCard(card) && publicStatusRequest;
    });
  }

  function waitForPublicServerSearchDetails(container, signal, ready) {
    return new Promise(resolve => {
      if (signal.aborted) { resolve('cancelled'); return; }
      let timeout;
      let finished = false;
      const finish = result => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
        resolve(result);
      };
      const cancel = () => finish('cancelled');
      const check = () => {
        if (!container.isConnected) finish('cancelled');
        else if (ready()) finish('ready');
      };
      const observer = new MutationObserver(check);
      observer.observe(container, { childList: true, characterData: true, subtree: true, attributes: true,
        attributeFilter: ['disabled', 'aria-disabled', 'data-rc-server-ping', 'data-rc-server-country',
          'data-rc-server-country-state', 'data-rc-playing', 'data-playing', 'data-player-count'] });
      signal.addEventListener('abort', cancel, { once: true });
      timeout = setTimeout(() => finish('timeout'), 20_000);
      check();
    });
  }

  async function searchPublicServers(page, container) {
    const state = publicServerBrowser(container);
    if (state.loading) return;
    state.message = publicServerSearchValidation();
    if (state.message) {
      syncPublicServerFilters(page, container, publicServerCards(container));
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    state.searchController = controller;
    state.searching = true;
    state.loading = true;
    state.page = 0;
    state.message = 'Searching public servers...';
    syncPublicServerFilters(page, container, publicServerCards(container));
    const current = () => publicServerBrowser(container) === state
      && !signal.aborted && container.isConnected;
    try {
      // Search applies the selected native sort before scanning further pages.
      const sorted = await waitForPublicServerBatch(container,
        { click: () => sortNativePublicServers(container, publicServerFilter.playerSort) }, signal, true);
      if (!current() || sorted === 'cancelled') return;
      if (sorted === 'timeout') { state.message = 'Could not sort the servers. Try Search again.'; return; }
      syncPublicServerStatuses();
      const version = state.version;
      while (current() && state.version === version) {
        syncPublicServerStatuses();
        const cards = publicServerCards(container);
        const matching = filteredPublicServerCards(cards);
        if (matching.length) {
          state.message = `Found ${matching.length} matching ${matching.length === 1 ? 'server' : 'servers'}.`;
          return;
        }
        if (pendingPublicServerSearchDetails(container)) {
          state.message = `Checking country and ping for ${cards.length} loaded servers...`;
          syncPublicServerFilters(page, container, cards);
          const details = await waitForPublicServerSearchDetails(container, signal, () =>
            !current() || state.version !== version || !pendingPublicServerSearchDetails(container)
              || filteredPublicServerCards(publicServerCards(container)).length > 0);
          if (!current() || details === 'cancelled') return;
          if (details === 'timeout') {
            state.message = 'Some server details are still loading. Try Search again.';
            return;
          }
          continue;
        }
        const button = publicServerLoadMore(container);
        if (!button) { state.message = 'No public servers match all your filters.'; return; }
        if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
          const ready = await waitForPublicServerSearchDetails(container, signal, () => {
            const next = publicServerLoadMore(container);
            return !next || !next.disabled && next.getAttribute('aria-disabled') !== 'true';
          });
          if (!current() || ready === 'cancelled') return;
          if (ready === 'timeout') { state.message = 'Roblox is still loading. Try Search again.'; return; }
          continue;
        }
        state.message = `Searching beyond ${cards.length} loaded public servers...`;
        syncPublicServerFilters(page, container, cards);
        const loaded = await waitForPublicServerBatch(container, button, signal);
        if (!current() || loaded === 'cancelled') return;
        if (loaded === 'timeout') { state.message = 'Could not load more servers. Try Search again.'; return; }
      }
    } catch {
      if (current()) state.message = 'Could not complete the search. Try Search again.';
    } finally {
      if (state.searchController === controller) {
        state.searchController = null;
        state.searching = false;
        state.loading = false;
      }
      if (container.isConnected && publicServerBrowser(container) === state) {
        syncPublicServerFilters(page, container, publicServerCards(container));
      }
      schedule();
    }
  }

  async function navigatePublicServerPage(page, container, direction) {
    const state = publicServerBrowser(container);
    if (state.loading) return;
    let matching = filteredPublicServerCards(publicServerCards(container));
    const target = Math.max(0, state.page + direction);
    if (direction < 0 || target * PUBLIC_SERVER_PAGE_SIZE < matching.length) {
      state.page = target;
      state.message = '';
      syncPublicServerStatuses();
      return;
    }
    if (!publicServerLoadMore(container)) return;
    const version = state.version;
    // With no matches yet, Next searches for the first page of matching servers.
    const requestedPage = matching.length ? target : 0;
    state.loading = true;
    state.message = '';
    syncPublicServerFilters(page, container, publicServerCards(container));
    try {
      for (let batch = 0; batch < 5; batch += 1) {
        if (!container.isConnected || publicServerBrowser(container) !== state || state.version !== version) return;
        const button = publicServerLoadMore(container);
        if (!button) break;
        if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
          state.message = 'Roblox is loading servers. Try Next again in a moment.';
          break;
        }
        const result = await waitForPublicServerBatch(container, button);
        if (publicServerBrowser(container) !== state || state.version !== version || result === 'cancelled') return;
        if (result === 'timeout') {
          state.message = 'Could not load more servers. Try Next again.';
          break;
        }
        syncPublicServerStatuses();
        matching = filteredPublicServerCards(publicServerCards(container));
        if (requestedPage * PUBLIC_SERVER_PAGE_SIZE < matching.length) {
          state.page = requestedPage;
          break;
        }
        if (result === 'end') break;
      }
      if (!state.message && requestedPage * PUBLIC_SERVER_PAGE_SIZE >= matching.length) {
        state.message = publicServerLoadMore(container)
          ? 'No matching servers in these batches. Select Next to keep searching.'
          : 'No more servers match these filters.';
      }
    } finally {
      state.loading = false;
      schedule();
    }
  }

  function createPublicServerFilters(page, container) {
    const toolbar = document.createElement('div');
    toolbar.className = 'rc-public-server-filters';

    const addField = (labelText, control) => {
      const label = document.createElement('label');
      const text = document.createElement('span');
      text.textContent = labelText;
      label.append(text, control);
      toolbar.append(label);
    };

    const country = document.createElement('select');
    country.setAttribute('data-rc-server-filter', 'country');
    country.setAttribute('aria-label', 'Filter servers by country');
    addField('Country', country);

    for (const [name, labelText] of [
      ['minLatency', 'Minimum latency'], ['maxPing', 'Maximum ping'],
      ['minPlayers', 'Minimum players'], ['maxPlayers', 'Maximum players']
    ]) {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      const players = name.endsWith('Players');
      if (!players) input.max = '10000';
      input.step = players ? '1' : '10';
      input.placeholder = name === 'minLatency' ? '0 ms' : name === 'minPlayers' ? '0' : 'Any';
      input.value = publicServerFilter[name];
      input.setAttribute('data-rc-server-filter', name);
      input.setAttribute('aria-label', players ? labelText : `${labelText} in milliseconds`);
      addField(players ? labelText : `${labelText} (ms)`, input);
    }

    const sort = document.createElement('select');
    sort.setAttribute('data-rc-server-filter', 'playerSort');
    for (const [value, text] of [['default', 'Default order'], ['asc', 'Fewest players first'],
      ['desc', 'Most players first']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      sort.append(option);
    }
    addField('Sort players', sort);

    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'rc-public-server-filter-search';
    search.textContent = 'Search';
    search.addEventListener('click', () => void searchPublicServers(page, container));
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.className = 'rc-public-server-filter-stop';
    stop.textContent = 'Stop';
    stop.hidden = true;
    stop.addEventListener('click', () => {
      const state = publicServerBrowser(container);
      state.message = 'Search stopped.';
      state.version += 1;
      state.searchController?.abort();
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'rc-public-server-filter-reset';
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => {
      publicServerFilter.country = 'all';
      publicServerFilter.minLatency = '';
      publicServerFilter.maxPing = '';
      publicServerFilter.minPlayers = '';
      publicServerFilter.maxPlayers = '';
      publicServerFilter.playerSort = 'default';
      publicServerBrowser(container);
      sortNativePublicServers(container, 'default');
      schedule();
    });
    const count = document.createElement('span');
    count.className = 'rc-public-server-filter-count';
    toolbar.append(search, stop, reset, count);

    toolbar.addEventListener('input', event => {
      const key = event.target?.getAttribute('data-rc-server-filter');
      if (!key || !(key in publicServerFilter)) return;
      publicServerFilter[key] = event.target.value;
      publicServerBrowser(container);
      schedule();
    });
    toolbar.addEventListener('change', event => {
      const key = event.target?.getAttribute('data-rc-server-filter');
      if (!key || !(key in publicServerFilter)) return;
      publicServerFilter[key] = event.target.value;
      publicServerBrowser(container);
      schedule();
    });
    toolbar.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || !event.target?.matches('input')) return;
      event.preventDefault();
      void searchPublicServers(page, container);
    });
    container.append(toolbar);
    return toolbar;
  }

  function createPublicServerPagination(page, container) {
    const pagination = document.createElement('nav');
    pagination.className = 'rc-public-server-pagination';
    pagination.setAttribute('aria-label', 'Public server pages');
    const message = document.createElement('span');
    message.className = 'rc-public-server-page-message';
    message.setAttribute('role', 'status');
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'rc-public-server-previous';
    previous.textContent = '\u2190 Previous';
    previous.setAttribute('aria-label', 'Previous public server page');
    previous.addEventListener('click', () => void navigatePublicServerPage(page, container, -1));
    const current = document.createElement('span');
    current.className = 'rc-public-server-page-number';
    current.setAttribute('aria-live', 'polite');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'rc-public-server-next';
    next.textContent = 'Next \u2192';
    next.setAttribute('aria-label', 'Next public server page');
    next.addEventListener('click', () => void navigatePublicServerPage(page, container, 1));
    pagination.append(message, previous, current, next);
    container.append(pagination);
    return pagination;
  }

  function syncPublicServerVisibility(page, grid, cards, matching, visible, sorted) {
    const items = new Map();
    const groups = new Set();
    for (const card of cards) {
      let item = card;
      // Hide a layout wrapper only when it belongs to this one server.
      // Roblox can also put several cards inside the same grid child.
      while (grid && item.parentElement && item.parentElement !== grid
        && grid.contains(item.parentElement)
        && item.parentElement.querySelectorAll('.card-item').length === 1) {
        item = item.parentElement;
      }
      items.set(card, item);
      if (sorted && grid?.contains(item)) {
        for (let group = item.parentElement; group && group !== grid; group = group.parentElement) {
          groups.add(group);
        }
      }
    }
    const currentItems = new Set(items.values());
    for (const item of page.querySelectorAll(
      '[data-rc-server-filtered], [data-rc-server-page-hidden], [data-rc-public-server-item]')) {
      if (currentItems.has(item)) continue;
      item.removeAttribute('data-rc-server-filtered');
      item.removeAttribute('data-rc-server-page-hidden');
      item.removeAttribute('data-rc-public-server-item');
      item.style.removeProperty('order');
    }
    for (const group of page.querySelectorAll('[data-rc-public-server-group]')) {
      if (!groups.has(group)) group.removeAttribute('data-rc-public-server-group');
    }
    for (const previousGrid of page.querySelectorAll('[data-rc-public-server-grid]')) {
      if (previousGrid !== grid || !sorted) previousGrid.removeAttribute('data-rc-public-server-grid');
    }
    grid?.toggleAttribute('data-rc-public-server-grid', sorted);
    for (const group of groups) group.setAttribute('data-rc-public-server-group', '');
    const matches = new Set(matching);
    const order = new Map(matching.map((card, index) => [card, index]));
    for (const [card, item] of items) {
      item.setAttribute('data-rc-public-server-item', '');
      item.toggleAttribute('data-rc-server-filtered', !matches.has(card));
      item.toggleAttribute('data-rc-server-page-hidden', matches.has(card) && !visible.has(card));
      if (sorted) item.style.order = String(order.get(card) ?? cards.length);
      else item.style.removeProperty('order');
    }
  }

  function syncPublicServerFilters(page, publicContainer, cards) {
    let toolbar = page.querySelector('.rc-public-server-filters');
    let pagination = page.querySelector('.rc-public-server-pagination');
    if (!publicContainer) {
      toolbar?.remove();
      pagination?.remove();
      syncPublicServerVisibility(page, null, [], [], new Set(), false);
      return;
    }
    // Recreate listeners when Roblox replaces the native container.
    if (toolbar && !publicContainer.contains(toolbar)) { toolbar.remove(); toolbar = null; }
    if (pagination && !publicContainer.contains(pagination)) { pagination.remove(); pagination = null; }
    if (!toolbar) toolbar = createPublicServerFilters(page, publicContainer);
    if (!pagination) pagination = createPublicServerPagination(page, publicContainer);
    if (!toolbar) return;
    const grid = cards[0]?.closest('.card-list, .game-server-list, ul, ol')
      || cards[0]?.parentElement
      || publicContainer.querySelector('.card-list, .game-server-list');
    if (grid && grid !== publicContainer && publicContainer.contains(grid)) {
      if (toolbar.nextElementSibling !== grid) grid.before(toolbar);
      if (pagination.previousElementSibling !== grid) grid.after(pagination);
    } else if (cards.length) {
      if (toolbar.nextElementSibling !== cards[0]) cards[0].before(toolbar);
      if (publicContainer.lastElementChild !== pagination) publicContainer.append(pagination);
    }
    const state = publicServerBrowser(publicContainer);
    const search = toolbar.querySelector('.rc-public-server-filter-search');
    search.disabled = state.loading;
    setText(search, state.searching ? 'Searching...' : 'Search');
    toolbar.querySelector('.rc-public-server-filter-stop').hidden = !state.searching;
    toolbar.setAttribute('aria-busy', String(state.searching));

    const countries = new Map();
    for (const card of cards) {
      const code = card.dataset.rcServerCountry;
      if (!/^[A-Z]{2}$/.test(code || '')) continue;
      let name = code;
      try {
        name = new Intl.DisplayNames([globalThis.RobloxCustomizerI18n?.locale() || document.documentElement.lang || 'en'],
          { type: 'region' }).of(code) || code;
      } catch { /* Retain the two-letter country code. */ }
      countries.set(code, name);
    }
    const options = [...countries].sort((a, b) => a[1].localeCompare(b[1]));
    if (/^[A-Z]{2}$/.test(publicServerFilter.country)
      && !countries.has(publicServerFilter.country)) {
      options.push([publicServerFilter.country, publicServerFilter.country]);
    }
    const signature = JSON.stringify(options);
    const country = toolbar.querySelector('[data-rc-server-filter="country"]');
    if (country.dataset.rcOptions !== signature) {
      country.dataset.rcOptions = signature;
      country.replaceChildren();
      for (const [value, label] of [['all', 'All countries'], ['unknown', 'Unknown'], ...options]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        country.append(option);
      }
    }
    country.value = publicServerFilter.country;
    for (const key of ['minLatency', 'maxPing', 'minPlayers', 'maxPlayers', 'playerSort']) {
      const input = toolbar.querySelector(`[data-rc-server-filter="${key}"]`);
      if (input.value !== publicServerFilter[key]) input.value = publicServerFilter[key];
    }

    const firstServer = cards[0] && (publicServerIdFromCard(cards[0]) || cards[0]);
    if (state.firstServer && firstServer && state.firstServer !== firstServer) {
      state.page = 0;
      state.message = '';
      state.version += 1;
    }
    state.firstServer = firstServer;
    const matching = filteredPublicServerCards(cards);
    const pages = Math.ceil(matching.length / PUBLIC_SERVER_PAGE_SIZE);
    state.page = Math.min(state.page, Math.max(0, pages - 1));
    const start = state.page * PUBLIC_SERVER_PAGE_SIZE;
    const visible = new Set(matching.slice(start, start + PUBLIC_SERVER_PAGE_SIZE));
    const sorted = publicServerFilter.playerSort !== 'default';
    syncPublicServerVisibility(page, grid, cards, matching, visible, sorted);
    setText(toolbar.querySelector('.rc-public-server-filter-count'),
      matching.length ? `${start + 1}\u2013${start + visible.size} of ${matching.length} matches loaded`
        : `0 matches in ${cards.length} loaded servers`);
    const more = publicServerLoadMore(publicContainer);
    pagination.querySelector('.rc-public-server-previous').disabled = state.loading || state.page === 0;
    const next = pagination.querySelector('.rc-public-server-next');
    next.disabled = state.loading || state.page + 1 >= pages && !more;
    setText(next, state.loading ? 'Loading...' : 'Next \u2192');
    pagination.setAttribute('aria-busy', String(state.loading));
    setText(pagination.querySelector('.rc-public-server-page-number'),
      matching.length ? `Page ${state.page + 1}` : 'No matches');
    setText(pagination.querySelector('.rc-public-server-page-message'), state.message
      || (!matching.length && !state.loading ? 'No servers match these filters.' : ''));
  }

  function hidePrivateServerLoadMore(page) {
    for (const button of page.querySelectorAll('button, a[role="button"]')) {
      const loadMore = /^Load More(?: (?:Private )?Servers)?$/i.test(button.textContent.trim())
        || globalThis.RobloxCustomizerNativeLabels?.matches('loadMore', button.textContent);
      if (!loadMore && !button.hasAttribute('data-rc-private-server-load-more')) continue;
      const privateScope = button.closest(PRIVATE_SERVER_SECTION_SELECTOR);
      const section = button.closest('.server-list-section');
      const privateSection = section
        && !section.closest('#running-game-instances-container, #friends-game-instances-container')
        && !section.querySelector('#running-game-instances-container, #friends-game-instances-container')
        && !!section.querySelector(PRIVATE_SERVER_CONFIGURE_SELECTOR);
      button.toggleAttribute('data-rc-private-server-load-more', loadMore && !!(privateScope || privateSection));
    }
  }

  function hideNativePublicServerControls(page, publicContainer) {
    const pane = page.querySelector('#game-instances');
    if (!pane) return;
    if (!publicContainer) {
      for (const control of pane.querySelectorAll('[data-rc-native-server-controls], [data-rc-native-server-sort]')) {
        control.removeAttribute('data-rc-native-server-controls');
        control.removeAttribute('data-rc-native-server-sort');
      }
      return;
    }
    const scope = publicContainer;
    const containsServerContent = node => node.matches('.card-item')
      || !!node.querySelector('.card-item, .rc-public-server-filters, .rc-public-server-pagination');
    for (const control of pane.querySelectorAll('[data-rc-native-server-controls], [data-rc-native-server-sort]')) {
      if (!scope.contains(control) || control.closest(NON_PUBLIC_SERVER_SECTION_SELECTOR)) {
        control.removeAttribute('data-rc-native-server-controls');
        control.removeAttribute('data-rc-native-server-sort');
      } else if (containsServerContent(control)) {
        // React may populate a previously empty control group with the server list.
        control.removeAttribute('data-rc-native-server-controls');
      }
    }
    const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
    const nodes = [...scope.querySelectorAll('label, span, div')]
      .filter(node => !node.closest(NON_PUBLIC_SERVER_SECTION_SELECTOR)
        && !node.closest('.rc-public-server-filters, .rc-public-server-pagination')
        && !containsServerContent(node));
    const labelText = node => node.matches('label') && node.childNodes
      ? [...node.childNodes].filter(child => child.nodeType !== Node.ELEMENT_NODE || !child.matches('select, input'))
        .map(child => child.textContent).join(' ').replace(/\s+/g, ' ').trim() : text(node);
    const sortLabel = nodes.find(node => /^Sort By:?$/i.test(labelText(node))
      || globalThis.RobloxCustomizerNativeLabels?.matches('sortBy', labelText(node)));
    const excludeLabel = nodes.find(node => /^Exclude Full Servers$/i.test(labelText(node))
      || globalThis.RobloxCustomizerNativeLabels?.matches('excludeFull', labelText(node)));
    const findWrapper = (node, selector) => {
      for (let current = node, depth = 0;
        current && current !== scope && depth < 5;
        current = current.parentElement, depth += 1) {
        const control = current.matches(selector) ? current : current.querySelector(selector);
        if (control) return containsServerContent(current) ? control : current;
      }
      return node;
    };
    const sort = findWrapper(sortLabel, 'select');
    const exclude = findWrapper(excludeLabel, 'input[type="checkbox"]');
    sortLabel?.setAttribute('data-rc-native-server-controls', '');
    excludeLabel?.setAttribute('data-rc-native-server-controls', '');
    const nativeSort = sort?.matches('select') ? sort : sort?.querySelector('select');
    nativeSort?.setAttribute('data-rc-native-server-sort', '');
    if (sort && exclude) {
      let group = sort;
      while (group && group !== scope && !group.contains(exclude)) group = group.parentElement;
      if (group && group !== scope && !containsServerContent(group) && text(group).length < 300) {
        group.setAttribute('data-rc-native-server-controls', '');
      } else {
        sort.setAttribute('data-rc-native-server-controls', '');
        exclude.setAttribute('data-rc-native-server-controls', '');
      }
    } else {
      sort?.setAttribute('data-rc-native-server-controls', '');
      exclude?.setAttribute('data-rc-native-server-controls', '');
    }
    publicServerLoadMore(publicContainer)?.setAttribute('data-rc-native-server-controls', '');
  }

  function syncPublicServerStatuses() {
    const page = document.querySelector('#game-detail-page');
    const placeId = Number(placeIdFromPath());
    if (!pageMatchesPath(page) || !Number.isSafeInteger(placeId) || placeId <= 0) return;
    const publicContainer = page.querySelector('#running-game-instances-container');
    hideNativePublicServerControls(page, publicContainer);
    if (publicStatusPlaceId !== placeId) {
      publicStatusPlaceId = placeId;
      publicStatusFetchedAt = 0;
      publicStatusRetryAfter = 0;
      publicStatuses.clear();
      publicCountries.clear();
      publicCountryQueue.length = 0;
    }
    const serverIds = new Set();
    const publicCards = publicServerCards(publicContainer);
    for (const card of publicCards) {
      const id = publicServerIdFromCard(card);
      const details = combinedServerMetrics(card, id ? publicStatuses.get(id) : null);
      if (id && !details.ping) serverIds.add(id);
      if (id && !details.countryCode) queuePublicServerCountry(placeId, id);
      const countryState = id ? publicCountries.get(id) : null;
      const countryCode = details.countryCode || countryState?.countryCode || '';
      if (details.ping) card.dataset.rcServerPing = String(Math.round(details.ping));
      else card.removeAttribute('data-rc-server-ping');
      if (countryCode) card.dataset.rcServerCountry = countryCode.toUpperCase();
      else card.removeAttribute('data-rc-server-country');
      card.dataset.rcServerCountryState = countryCode ? 'known'
        : countryState?.pending ? 'pending' : 'unknown';
      renderServerMetrics(card, details, id ? { placeId, id } : null);
    }
    syncPublicServerFilters(page, publicContainer, publicCards);
    if (!serverIds.size || publicStatusRequest || Date.now() < publicStatusRetryAfter
      || Date.now() - publicStatusFetchedAt < 90_000
        && [...serverIds].every(id => publicStatuses.has(id))) return;
    publicStatusRequest = true;
    sendMessage({ type: 'rc-public-server-status', placeId,
      serverIds: [...serverIds].slice(0, 100) }, response => {
      publicStatusRequest = false;
      if (chrome.runtime.lastError || !Array.isArray(response?.servers)) {
        publicStatusRetryAfter = Date.now() + 30_000;
        setTimeout(schedule, 30_000);
        return;
      }
      if (publicStatusPlaceId !== placeId) return;
      for (const id of serverIds) publicStatuses.set(id, null);
      for (const server of response.servers) {
        if (typeof server?.id === 'string') publicStatuses.set(server.id.toLowerCase(), server);
      }
      publicStatusFetchedAt = Date.now();
      setTimeout(schedule, 90_000);
      schedule();
    });
  }

  function rolHeadingBefore(doc, anchor) {
    let label = '';
    for (const heading of doc.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      if (heading.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) {
        label = heading.textContent.trim();
      }
    }
    return label;
  }

  function rolCardText(anchor) {
    let node = anchor;
    for (let depth = 0; depth < 6 && node.parentElement; depth++) {
      node = node.parentElement;
      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 12 && text.length < 500
        && /(?:price|offsale|updated|win rate|awarded|visits)/i.test(text)) return text;
    }
    return (anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function rolLinks(doc, pattern, kind) {
    const entries = [];
    for (const anchor of doc.querySelectorAll('a[href]')) {
      let url;
      try { url = new URL(anchor.getAttribute('href'), 'https://www.rolimons.com'); }
      catch { continue; }
      const match = url.pathname.match(pattern);
      if (url.protocol !== 'https:' || url.hostname !== 'www.rolimons.com' || !match) continue;
      const text = rolCardText(anchor);
      const heading = rolHeadingBefore(doc, anchor).toLowerCase();
      const image = anchor.querySelector('img');
      let imageUrl = '';
      try {
        const candidate = new URL(image?.getAttribute('src') || image?.getAttribute('data-src') || '', 'https://www.rolimons.com');
        if (candidate.protocol === 'https:'
          && (/^(?:[a-z0-9-]+\.)*rbxcdn\.com$/i.test(candidate.hostname) || candidate.hostname === 'www.rolimons.com')) {
          imageUrl = candidate.href;
        }
      } catch { /* Keep the card text if the source page has no usable thumbnail. */ }
      let group = '';
      if (kind === 'gamepass') group = /off[\s-]?sale/i.test(`${heading} ${text}`) ? 'Offsale Gamepasses' : 'Gamepasses';
      if (kind === 'badge') group = /disabled/.test(`${heading} ${text}`) ? 'Disabled Badges' : 'Badges';
      if (kind === 'place') group = /place|map/.test(heading) ? heading : 'Places';
      entries.push({
        id: match[1],
        href: url.href,
        imageUrl,
        title: (anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim(),
        details: text,
        group
      });
    }
    return entries;
  }

  function rolExternalLink(text, href) {
    const link = document.createElement('a');
    link.className = 'rc-rolimons-external';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;
    return link;
  }

  function appendRolCards(container, entries, emptyText) {
    const unique = [...new Map(entries.map(entry => [entry.href || `id:${entry.id}`, entry])).values()];
    if (!unique.length) {
      const empty = document.createElement('p');
      empty.className = 'rc-rolimons-empty';
      empty.textContent = emptyText;
      container.append(empty);
      return;
    }
    const groups = new Map();
    for (const entry of unique) {
      if (!groups.has(entry.group)) groups.set(entry.group, []);
      groups.get(entry.group).push(entry);
    }
    for (const [name, items] of groups) {
      const section = document.createElement('section');
      section.className = 'rc-rolimons-data-group';
      const heading = document.createElement('h4');
      heading.textContent = name;
      const list = document.createElement('div');
      list.className = 'rc-rolimons-card-grid';
      for (const item of items) {
        const card = document.createElement(item.href ? 'a' : 'div');
        card.className = 'rc-rolimons-data-card';
        if (item.href) {
          card.href = item.href;
          card.target = '_blank';
          card.rel = 'noopener noreferrer';
        }
        if (item.imageUrl) {
          const image = document.createElement('img');
          image.src = item.imageUrl;
          image.alt = '';
          image.loading = 'lazy';
          card.append(image);
        }
        const title = document.createElement('strong');
        title.textContent = item.title || item.details.split(/\s+(?:Price|Win Rate|Awarded|Visits|Updated)/i)[0] || item.id;
        const detail = document.createElement('span');
        detail.textContent = item.details === item.title ? '' : item.details;
        card.append(title, detail);
        list.append(card);
      }
      section.append(heading, list);
      container.append(section);
    }
  }

  function renderRolimonsTab(panel, tabId, html, thumbnails = {}) {
    const output = panel.querySelector('.rc-rolimons-results');
    if (!output) return;
    output.replaceChildren();
    let doc;
    try { doc = new DOMParser().parseFromString(html, 'text/html'); }
    catch {
      output.textContent = 'Rolimons data could not be read.';
      return;
    }

    if (tabId === 'gamepasses') {
      const entries = rolLinks(doc, /\/gamepass\/(\d+)(?:\/|$)/i, 'gamepass');
      for (const entry of entries) entry.imageUrl = thumbnails[entry.id] || entry.imageUrl;
      appendRolCards(output, entries,
        'No tracked gamepasses were found for this game.');
      return;
    }
    if (tabId === 'badges') {
      appendRolCards(output, rolLinks(doc, /\/(?:gamebadge|badges?)\/(\d+)(?:\/|$)/i, 'badge'),
        'No tracked badges were found for this game.');
      return;
    }
    if (tabId === 'places') {
      appendRolCards(output, rolLinks(doc, /\/(?:gameplace|place)\/(\d+)(?:\/|$)/i, 'place'),
        'No tracked sub-places were found for this game.');
      return;
    }

    const lines = (doc.body?.innerText || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (tabId === 'charts') {
      const appendStats = (titleText, items, suffix = '') => {
        const heading = document.createElement('h4');
        heading.textContent = titleText;
        output.append(heading);
        const grid = document.createElement('div');
        grid.className = 'rc-rolimons-stat-grid';
        for (const item of items) {
          const card = document.createElement('div');
          card.className = 'rc-rolimons-stat-card';
          const name = document.createElement('span');
          name.textContent = item.label;
          const value = document.createElement('strong');
          value.textContent = `${item.value}${item.suffix ?? suffix}`;
          card.append(name, value);
          if (item.detail) {
            const detail = document.createElement('small');
            detail.textContent = item.detail;
            card.append(detail);
          }
          grid.append(card);
        }
        if (grid.childElementCount) output.append(grid);
        else {
          const empty = document.createElement('p');
          empty.className = 'rc-rolimons-empty';
          empty.textContent = 'No data is available for this section.';
          output.append(empty);
        }
      };
      const readNextValue = label => {
        const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase());
        return index >= 0 ? (lines[index + 1] || '') : '';
      };

      const snapshot = [];
      for (const label of ['Players', 'Visits', 'Rating', 'Upvotes', 'Downvotes', 'Favorites', 'Average Playtime']) {
        const value = readNextValue(label);
        if (value) snapshot.push({ label, value });
      }
      const updated = readNextValue('Game Updated');
      if (updated) snapshot.push({ label: 'Game Updated', value: updated });
      if (snapshot.length) appendStats('Current Game Stats', snapshot);

      const peaks = [];
      for (const label of ['All-Time', 'Past 30 Days', 'Past 7 Days', 'Past 24 Hours']) {
        const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase());
        if (index < 0) continue;
        const value = lines[index + 1] || '';
        const date = lines[index + 2] || '';
        if (value && value !== '-') peaks.push({ label, value: `${value} players`, detail: date === '-' ? '' : date });
      }
      if (peaks.length) appendStats('Peak Player Counts (CCU)', peaks);

      const note = document.createElement('p');
      note.className = 'rc-rolimons-note';
      note.textContent = 'Rolimons’ public game page provides current totals and peak counts. Its interactive time-series charts are available on the original analytics page.';
      output.append(note, rolExternalLink('Open interactive charts on Rolimons',
        `https://www.rolimons.com/game/${panel.dataset.placeId}`));
      return;
    }

    const labels = ['Servers', 'FPS Average', 'FPS Maximum', 'FPS Minimum', 'FPS Standard Deviation',
      'Ping Average', 'Ping Maximum', 'Ping Minimum', 'Ping Standard Deviation',
      'Players Average', 'Players Maximum', 'Players Minimum', 'Players Standard Deviation'];
    const stats = [];
    for (const label of labels) {
      const index = lines.findIndex(line => line.toLowerCase() === label.toLowerCase());
      if (index >= 0 && lines[index + 1]) stats.push({ label, value: lines[index + 1] });
    }
    const title = document.createElement('h4');
    title.textContent = 'Server Statistics';
    output.append(title);
    if (stats.length) {
      const grid = document.createElement('div');
      grid.className = 'rc-rolimons-stat-grid';
      for (const stat of stats) {
        const card = document.createElement('div');
        card.className = 'rc-rolimons-stat-card';
        const name = document.createElement('span');
        name.textContent = stat.label;
        const value = document.createElement('strong');
        value.textContent = stat.value;
        card.append(name, value);
        grid.append(card);
      }
      output.append(grid);
    } else {
      const empty = document.createElement('p');
      empty.className = 'rc-rolimons-empty';
      empty.textContent = 'No server statistics are available for this game.';
      output.append(empty);
    }
    output.append(rolExternalLink('Open server analytics on Rolimons',
      `https://www.rolimons.com/gameservers/${panel.dataset.placeId}`));
  }

  function loadRolimonsTab(panel, tabId) {
    const output = panel.querySelector('.rc-rolimons-results');
    if (!output) return;
    panel.dataset.activeTab = tabId;
    output.replaceChildren();
    const status = document.createElement('p');
    status.className = 'rc-rolimons-loading';
    status.textContent = 'Loading data from Rolimons…';
    output.append(status);

    const display = (html, thumbnails) => {
      if (!panel.isConnected || panel.dataset.activeTab !== tabId) return;
      renderRolimonsTab(panel, tabId, html, thumbnails);
    };
    const cached = rolimonsPageData.get(panel);
    if (cached) {
      display(cached.html, cached.gamepassThumbnails);
      return;
    }
    if (panel.dataset.rolimonsLoading === 'true') return;
    panel.dataset.rolimonsLoading = 'true';
    const placeId = Number(panel.dataset.placeId);
    sendMessage({ type: 'rc-rolimons-game-page', placeId }, response => {
      panel.dataset.rolimonsLoading = 'false';
      if (!panel.isConnected || panel.dataset.placeId !== String(placeId)) return;
      if (chrome.runtime.lastError || typeof response?.html !== 'string') {
        output.replaceChildren();
        const error = document.createElement('p');
        error.className = 'rc-rolimons-empty';
        error.textContent = 'Rolimons data could not be loaded. Try opening the original page.';
        output.append(error, rolExternalLink('Open on Rolimons', `https://www.rolimons.com/game/${placeId}`));
        return;
      }
      rolimonsPageData.set(panel, response);
      renderRolimonsTab(panel, panel.dataset.activeTab || tabId, response.html, response.gamepassThumbnails);
    });
  }

  function renderRobloxGameTab(panel, tabId, pageData) {
    const output = panel.querySelector('.rc-rolimons-results');
    if (!output) return;
    output.replaceChildren();

    if (tabId === 'charts') {
      const heading = document.createElement('h4');
      heading.textContent = 'Current Roblox Stats';
      const grid = document.createElement('div');
      grid.className = 'rc-rolimons-stat-grid';
      for (const item of pageData.items || []) {
        const card = document.createElement('div');
        card.className = 'rc-rolimons-stat-card';
        const name = document.createElement('span');
        name.textContent = item.label;
        const value = document.createElement('strong');
        value.textContent = item.value;
        card.append(name, value);
        grid.append(card);
      }
      output.append(heading, grid);
      const note = document.createElement('p');
      note.className = 'rc-rolimons-note';
      note.textContent = 'These current totals come directly from Roblox. Roblox does not provide public historical chart points here.';
      output.append(note, rolExternalLink('Open historical charts on Rolimons',
        `https://www.rolimons.com/game/${panel.dataset.placeId}`));
      return;
    }

    if (tabId === 'servers') {
      const heading = document.createElement('h4');
      heading.textContent = 'Live Public Roblox Servers';
      output.append(heading);
      const note = document.createElement('p');
      note.className = 'rc-rolimons-note';
      note.textContent = 'This list is provided by Roblox and shows current player counts. Use Roblox’s Servers tab to join an instance.';
      output.append(note);
    }

    const emptyText = tabId === 'badges' ? 'Roblox has no public badges for this experience.'
      : tabId === 'places' ? 'Roblox has no public sub-places for this experience.'
        : 'No public Roblox servers were found.';
    appendRolCards(output, pageData.items || [], emptyText);

    if (tabId === 'servers') {
      const nativeTabButton = document.createElement('button');
      nativeTabButton.type = 'button';
      nativeTabButton.className = 'rc-rolimons-toggle';
      nativeTabButton.textContent = 'Open Roblox server browser';
      nativeTabButton.addEventListener('click', () => document.querySelector('#tab-game-instances')?.click());
      output.append(nativeTabButton);
    }

    if (pageData.nextCursor) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'rc-rolimons-toggle';
      more.textContent = `Load More ${tabId === 'servers' ? 'Servers' : tabId === 'badges' ? 'Badges' : 'Places'}`;
      more.addEventListener('click', () => {
        more.disabled = true;
        more.textContent = 'Loading…';
        loadRobloxGameTab(panel, tabId, pageData.nextCursor, true);
      });
      output.append(more);
    }
  }

  function loadRobloxGameTab(panel, tabId, cursor = '', append = false) {
    const output = panel.querySelector('.rc-rolimons-results');
    if (!output) return;
    panel.dataset.activeTab = tabId;
    const cache = robloxGamePageData.get(panel) || new Map();
    robloxGamePageData.set(panel, cache);
    const cached = cache.get(tabId);
    if (cached && !cursor) {
      renderRobloxGameTab(panel, tabId, cached);
      return;
    }

    const loadingKey = `${tabId}:${cursor || 'first'}`;
    if (panel.dataset.robloxLoading === loadingKey) return;
    panel.dataset.robloxLoading = loadingKey;
    if (!append) output.replaceChildren();
    else {
      const oldMore = output.querySelector('.rc-rolimons-toggle:last-child');
      oldMore?.remove();
    }
    const status = document.createElement('p');
    status.className = 'rc-rolimons-loading';
    status.textContent = 'Loading data from Roblox…';
    if (append) output.append(status);
    else output.replaceChildren(status);

    const placeId = Number(panel.dataset.placeId);
    const universeId = Number(panel.dataset.universeId);
    sendMessage({
      type: 'rc-roblox-game-data', placeId, universeId, section: tabId, cursor
    }, response => {
      if (panel.dataset.robloxLoading === loadingKey) panel.dataset.robloxLoading = '';
      if (!panel.isConnected || panel.dataset.placeId !== String(placeId)) return;
      if (chrome.runtime.lastError || !response || response.error || !Array.isArray(response.items)) {
        if (panel.dataset.activeTab !== tabId) return;
        output.replaceChildren();
        const error = document.createElement('p');
        error.className = 'rc-rolimons-empty';
        error.textContent = response?.error || 'Roblox data could not be loaded.';
        output.append(error);
        return;
      }

      const previous = cache.get(tabId);
      const result = {
        items: append && previous ? [...previous.items, ...response.items] : response.items,
        nextCursor: response.nextCursor || ''
      };
      cache.set(tabId, result);
      if (panel.dataset.activeTab === tabId) renderRobloxGameTab(panel, tabId, result);
    });
  }

  function loadGameDataTab(panel, tabId) {
    if (tabId === 'gamepasses') loadRolimonsTab(panel, tabId);
    else loadRobloxGameTab(panel, tabId);
  }

  function waitForGamePaneContent(page, selector, ready, timeout = 15_000) {
    const pane = page.querySelector(selector);
    const placeId = placeIdFromPath();
    const current = () => pane?.isConnected && pageMatchesPath(page) && placeIdFromPath() === placeId;
    if (!current()) return Promise.resolve(false);
    if (ready(pane)) return Promise.resolve(true);

    return new Promise(resolve => {
      let finished = false;
      let timeoutTimer = 0;
      let inspectTimer = 0;
      const finish = ready => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        clearTimeout(timeoutTimer);
        clearTimeout(inspectTimer);
        resolve(ready);
      };
      const inspect = () => {
        if (finished) return;
        if (!current()) finish(false);
        else if (ready(pane)) finish(true);
      };
      const observer = new MutationObserver(inspect);
      observer.observe(pane, { childList: true, characterData: true, subtree: true });
      timeoutTimer = setTimeout(() => finish(false), timeout);
      // Navigation can replace the entire pane without mutating its descendants.
      const checkRoute = () => {
        inspect();
        if (finished) return;
        inspectTimer = setTimeout(checkRoute, 200);
      };
      checkRoute();
    });
  }

  function waitForServerContent(page, timeout = 15_000) {
    return waitForGamePaneContent(page, '#game-instances', pane => {
      const text = (pane.textContent || '').toLowerCase();
      return !!pane.querySelector(PRIVATE_SERVER_CONFIGURE_SELECTOR)
        || !!pane.querySelector('#running-game-instances-container .card-item, '
          + '#private-server-container .card-item, #private-game-instances-container .card-item')
        || /no private servers found|you don.t have any private servers|no (?:public |running )?servers (?:found|available)|no running experiences/.test(text)
        || globalThis.RobloxCustomizerNativeLabels?.matches('emptyServers', text)
        || globalThis.RobloxCustomizerNativeLabels?.matches('createPrivate', text)
        || /create\s+(?:a\s+)?private server/.test(text) && /your private servers|private servers/.test(text);
    }, timeout);
  }

  function waitForStoreContent(page) {
    return waitForGamePaneContent(page, '#store', pane =>
      !!pane.querySelector('.card-item, .item-card-container, a[href], button')
      || /no (?:passes|game passes|products|subscriptions)|does not (?:have|sell)/i.test(pane.textContent)
      || globalThis.RobloxCustomizerNativeLabels?.matches('emptyStore', pane.textContent), 1500);
  }

  function syncRolimonsPanel() {
    const placeId = placeIdFromPath();
    const page = document.querySelector('#game-detail-page');
    const about = page?.querySelector('#about');
    if (!placeId || !pageMatchesPath(page) || !aboutReady(page) || !about) return;
    const universeId = Number(page.querySelector('#game-detail-meta-data')?.getAttribute('data-universe-id'));

    let panel = about.querySelector(':scope > #rc-rolimons-panel');
    if (panel && panel.dataset.placeId !== placeId) {
      panel.remove();
      panel = null;
    }
    if (panel) {
      if (Number.isSafeInteger(universeId) && universeId > 0) {
        panel.dataset.universeId = String(universeId);
      }
      return;
    }

    panel = document.createElement('section');
    panel.id = 'rc-rolimons-panel';
    panel.className = 'rc-rolimons-panel';
    panel.dataset.placeId = placeId;
    panel.dataset.universeId = Number.isSafeInteger(universeId) && universeId > 0 ? String(universeId) : '';

    const heading = document.createElement('div');
    heading.className = 'rc-rolimons-heading';
    const title = document.createElement('h3');
    title.textContent = 'Game Data';
    const actions = document.createElement('div');
    actions.className = 'rc-rolimons-actions';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'rc-rolimons-toggle';
    toggle.textContent = 'Open game data menu';
    toggle.setAttribute('aria-expanded', 'false');

    const external = document.createElement('a');
    external.className = 'rc-rolimons-external';
    external.href = `https://www.rolimons.com/game/${placeId}`;
    external.target = '_blank';
    external.rel = 'noopener noreferrer';
    external.textContent = 'Open on Rolimons';

    const menu = document.createElement('div');
    menu.className = 'rc-rolimons-content';
    menu.hidden = true;

    const tabs = document.createElement('div');
    tabs.className = 'rc-rolimons-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Game data');
    const results = document.createElement('div');
    results.className = 'rc-rolimons-results';
    results.setAttribute('role', 'tabpanel');
    const sections = [
      ['gamepasses', 'Gamepasses'],
      ['badges', 'Badges'],
      ['places', 'Places']
    ];
    for (const [id, label] of sections) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'rc-rolimons-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.textContent = label;
      tab.addEventListener('click', () => {
        for (const sibling of tabs.children) {
          const selected = sibling === tab;
          sibling.classList.toggle('rc-rolimons-tab-active', selected);
          sibling.setAttribute('aria-selected', String(selected));
        }
        loadGameDataTab(panel, id);
      });
      tabs.append(tab);
    }
    menu.append(tabs, results);
    toggle.addEventListener('click', () => {
      const expanded = menu.hidden;
      menu.hidden = !expanded;
      toggle.setAttribute('aria-expanded', String(expanded));
      toggle.textContent = expanded ? 'Close game data menu' : 'Open game data menu';
    });

    actions.append(toggle, external);
    heading.append(title, actions);
    panel.append(heading, menu);
    about.append(panel);
  }

  function limitPrivateServerCards(list, rows, placeId) {
    const saved = privateVisibleCounts.get(list);
    const visible = saved?.placeId === placeId ? saved.count : 5;
    rows.forEach((row, index) => {
      row.classList.toggle('rc-private-server-collapsed', index >= visible);
    });

    let control = [...list.children].find(child => child.classList.contains('rc-private-server-more'));
    if (rows.length <= visible) {
      control?.remove();
      return;
    }
    if (!control) {
      control = document.createElement('div');
      control.className = 'rc-private-server-more';
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', () => {
        if (Number(placeIdFromPath()) !== placeId) return;
        const current = privateVisibleCounts.get(list);
        const count = current?.placeId === placeId ? current.count : 5;
        privateVisibleCounts.set(list, { placeId, count: count + 5 });
        syncPrivateServers();
      });
      control.append(button);
    }
    setText(control.firstElementChild, `Show More (${rows.length - visible} remaining)`);
    if (control.previousElementSibling !== rows[rows.length - 1]) {
      rows[rows.length - 1].after(control);
    }
  }

  function privateServerSourceMutation(record) {
    const target = record.target instanceof Element ? record.target : record.target?.parentElement;
    if (!target || target.closest(PRIVATE_SERVER_RENDER_SELECTOR)) return false;
    const privateScope = target.closest(PRIVATE_SERVER_SECTION_SELECTOR)
      || target.closest('.rc-private-server-card, .rc-private-server-native-card');
    if (record.type === 'attributes' || record.type === 'characterData') return !!privateScope;
    const changes = [...record.addedNodes || [], ...record.removedNodes || []]
      .filter(node => !(node instanceof Element && node.matches(PRIVATE_SERVER_RENDER_SELECTOR)));
    if (!changes.length) return false;
    if (privateScope) return true;
    return changes.some(node => node instanceof Element && (
      node.matches(PRIVATE_SERVER_SECTION_SELECTOR) || node.matches(PRIVATE_SERVER_CONFIGURE_SELECTOR)
      || !!node.querySelector(PRIVATE_SERVER_CONFIGURE_SELECTOR)));
  }

  function privateServerNativeText(row) {
    const parts = [];
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.parentElement?.closest(PRIVATE_SERVER_RENDER_SELECTOR)) parts.push(node.textContent);
    }
    return parts.join(' ');
  }

  function syncPrivateServerSource(row, serverId, nameKey, signature) {
    const previous = privateRowSources.get(row);
    const saved = previous?.placeId === privatePlaceId ? previous : privateSourcesById.get(serverId);
    if (saved && saved.signature !== signature) {
      privateSourceVersion += 1;
      // Native names, avatars and counts supersede the cached copy immediately.
      privateDetails.delete(saved.serverId);
      privateDetails.delete(serverId);
      privateDetailsByName.delete(saved.nameKey);
      privateDetailsByName.delete(nameKey);
    }
    const source = { placeId: privatePlaceId, serverId, nameKey, signature };
    privateRowSources.set(row, source);
    if (serverId) privateSourcesById.set(serverId, source);
  }

  function syncPrivateServerLoading(list, pending) {
    let status = [...list.children].find(child => child.classList.contains('rc-private-server-loading'));
    if (!pending) {
      status?.remove();
      return;
    }
    if (!status) {
      status = document.createElement('p');
      status.className = 'rc-private-server-loading';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      if (list.firstElementChild) list.firstElementChild.before(status);
      else list.append(status);
    }
    setText(status, Date.now() < privateRetryAfter
      ? 'Private server details are unavailable. Retrying...'
      : 'Loading private server details...');
  }

  function syncPrivateServers() {
    const page = document.querySelector('#game-detail-page') || document;
    const placeId = Number(location.pathname.match(/^\/games\/(\d+)(?:\/|$)/)?.[1]);
    if (!page || !Number.isSafeInteger(placeId) || placeId <= 0) return;
    if (page !== document && !pageMatchesPath(page)) return;
    hidePrivateServerLoadMore(page);
    if (privatePlaceId !== placeId) {
      privatePlaceId = placeId;
      privateSourceVersion += 1;
      privateFetchedSourceVersion = -1;
      privateSourcesById.clear();
      privateFetchedAt = 0;
      privateRetryAfter = 0;
      privateDetails.clear();
      privateDetailsByName.clear();
      privateQueriedIds = new Set();
      privateQueriedNames = new Set();
    }

    const serverIds = new Set();
    const serverNames = new Set();
    const serverLists = new Map();
    const processedRows = new Set();
    const privateListOwners = new Map();
    for (const configure of page.querySelectorAll(PRIVATE_SERVER_CONFIGURE_SELECTOR)) {
      let serverId;
      try {
        const url = new URL(configure.href, location.href);
        serverId = Number(url.searchParams.get('privateServerId')
          || url.pathname.match(/^\/private-server\/configure\/(\d+)\/?$/)?.[1]);
      }
      catch { continue; }
      if (!Number.isSafeInteger(serverId) || serverId <= 0) continue;

      const ownerActions = configure.parentElement;
      const ownerRow = ownerActions?.parentElement;
      const list = ownerRow?.parentElement;
      if (!ownerRow || !list) continue;
      list.setAttribute('data-rc-private-server-list', '');
      if (!privateListOwners.has(list)) privateListOwners.set(list, { ownerRow, ownerActions, serverId, configure });
    }
    // Shared private servers can have a Join button without an owner's Configure link.
    for (const row of page.querySelectorAll('.card-item')) {
      if (!row.closest('#private-server-container, #private-game-instances-container')) continue;
      const list = row.parentElement;
      if (!list || privateListOwners.has(list)) continue;
      list.setAttribute('data-rc-private-server-list', '');
      privateListOwners.set(list, { ownerRow: null, ownerActions: null, serverId: 0, configure: null });
    }

    const privateRows = new Map();
    const privateNameCounts = new Map();
    for (const list of privateListOwners.keys()) {
      const rows = [...list.children].filter(candidate => {
        if (candidate.classList.contains('rc-private-server-more')) return false;
        return candidate.matches('.card-item') || !!candidate.querySelector('.text-title-medium');
      });
      privateRows.set(list, rows);
      for (const row of rows) {
        const name = row.querySelector('.text-title-medium')?.textContent.trim().toLowerCase();
        if (name) privateNameCounts.set(name, (privateNameCounts.get(name) || 0) + 1);
      }
    }
    for (const [list, { ownerRow, ownerActions, serverId, configure }] of privateListOwners) {
      const rows = privateRows.get(list);
      serverLists.set(list, []);
      for (const row of rows) {
        if (processedRows.has(row)) continue;
        const main = row.firstElementChild;
        const nativeName = row.querySelector('.text-title-medium');
        const nativeAvatar = row.querySelector('.thumbnail-2d-container img')
          || [...row.querySelectorAll('img')].find(image =>
            !image.closest('.rc-private-server-summary, .rc-private-server-roster'));
        const name = nativeName?.textContent.trim() || '';
        const nameKey = name.toLowerCase();
        const rowServerId = privateServerIdFromRow(row) || (row === ownerRow ? serverId : 0);
        const nativeStatus = main?.querySelector('.text-body-medium')?.textContent.trim() || '';
        const nativeText = privateServerNativeText(row);
        const nativeCount = globalThis.RobloxCustomizerNativeLabels?.playerCount(nativeText)?.text
          || nativeText.match(/\b\d+\s+of\s+\d+\s+people\s+max\b/i)?.[0] || '';
        const nativeImages = [...row.querySelectorAll('img')]
          .filter(image => !image.closest(PRIVATE_SERVER_RENDER_SELECTOR))
          .map(image => [image.getAttribute('src'), image.getAttribute('srcset'), image.getAttribute('sizes')]);
        syncPrivateServerSource(row, rowServerId, nameKey,
          JSON.stringify([rowServerId, name, nativeStatus, nativeCount, nativeImages]));
        if (rowServerId) serverIds.add(rowServerId);
        else if (nameKey && name.length <= 100 && privateNameCounts.get(nameKey) === 1) {
          serverNames.add(name);
        }
        const details = rowServerId ? privateDetails.get(rowServerId)
          : privateNameCounts.get(nameKey) === 1 ? privateDetailsByName.get(nameKey) : null;
        const ready = main && name && nativeAvatar?.getAttribute('src')?.trim()
          && Number.isSafeInteger(details?.id) && details.id > 0
          && typeof details.name === 'string' && details.name.trim()
          && typeof details.ownerName === 'string' && Array.isArray(details.playerImages);
        row.toggleAttribute('data-rc-private-server-pending', !ready);
        if (!ready) {
          row.removeAttribute('data-rc-private-server-ready');
          continue;
        }
        const nativeControls = [...row.querySelectorAll('button, a[href], [role="button"]')]
          .filter(control => !control.closest('.rc-private-server-proxy, .rc-private-server-summary'));
        const joinControl = nativeControls.find(control =>
          /\bjoin\b/i.test(`${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`)
          || globalThis.RobloxCustomizerNativeLabels?.matches('join',
            `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`));
        const directActions = [...row.children].find(child =>
          !child.classList.contains('rc-private-server-summary')
          && !child.classList.contains('rc-private-server-roster')
          && !child.classList.contains('rc-private-server-proxy')
          && !child.contains(nativeName) && !child.contains(nativeAvatar)
          && (child === joinControl || (joinControl && child.contains(joinControl))
            || child === ownerActions || child.contains(configure)));
        let proxy = row.querySelector(':scope > .rc-private-server-proxy');
        if (directActions) proxy?.remove();
        else if (joinControl && !proxy) {
          proxy = document.createElement('div');
          proxy.className = 'rc-private-server-proxy';
          const join = document.createElement('button');
          join.type = 'button';
          join.textContent = 'Join';
          join.addEventListener('click', () => {
            const nativeJoin = [...row.querySelectorAll('button, a[href], [role="button"]')]
              .find(control => !control.closest('.rc-private-server-proxy')
                && (/\bjoin\b/i.test(`${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`)
                  || globalThis.RobloxCustomizerNativeLabels?.matches('join',
                    `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`)));
            nativeJoin?.click();
          });
          proxy.append(join);
          row.append(proxy);
        }
        const actions = directActions || proxy;
        if (!actions) {
          row.classList.add('rc-private-server-native-card');
          renderServerMetrics(row, combinedServerMetrics(row, details));
          row.setAttribute('data-rc-private-server-ready', '');
          processedRows.add(row);
          if (!serverLists.has(list)) serverLists.set(list, []);
          serverLists.get(list).push(row);
          continue;
        }
        row.classList.remove('rc-private-server-native-card');
        processedRows.add(row);

        if (!serverLists.has(list)) serverLists.set(list, []);
        serverLists.get(list).push(row);

        row.classList.add('rc-private-server-card');
        actions.classList.remove('rc-private-server-native-main');
        actions.classList.add('rc-private-server-actions');

        let summary = row.querySelector(':scope > .rc-private-server-summary');
        if (!summary) {
          summary = document.createElement('div');
          summary.className = 'rc-private-server-summary';
          row.append(summary);
        }
        for (const className of ['title', 'avatar', 'owner', 'count', 'status']) {
          if (!summary.querySelector(`:scope > .rc-private-server-${className}`)) {
            const node = document.createElement(className === 'avatar' ? 'img' : 'div');
            node.className = `rc-private-server-${className}`;
            if (className === 'avatar') node.alt = '';
            summary.append(node);
          }
        }
        let roster = row.querySelector(':scope > .rc-private-server-roster');
        if (!roster) {
          roster = document.createElement('div');
          roster.className = 'rc-private-server-roster';
          row.append(roster);
        }
        for (const child of row.children) {
          if (child !== actions && child !== summary && child !== roster) {
            child.classList.remove('rc-private-server-actions');
            child.classList.add('rc-private-server-native-main');
          }
        }

        setText(summary.querySelector('.rc-private-server-title'), nativeName.textContent.trim());
        const avatar = summary.querySelector('.rc-private-server-avatar');
        if (avatar.src !== nativeAvatar.src) avatar.src = nativeAvatar.src;
        if (avatar.srcset !== nativeAvatar.srcset) avatar.srcset = nativeAvatar.srcset;
        if (avatar.sizes !== nativeAvatar.sizes) avatar.sizes = nativeAvatar.sizes;
        renderServerMetrics(summary, combinedServerMetrics(row, details));
        setText(summary.querySelector('.rc-private-server-status'), details ? ''
          : nativeStatus === nativeCount ? '' : nativeStatus);
        setText(summary.querySelector('.rc-private-server-owner'), details?.ownerName || '');
        const count = details && Number.isInteger(details.playing) && Number.isInteger(details.maxPlayers)
          ? `${details.playing} of ${details.maxPlayers} people max` : nativeCount;
        setText(summary.querySelector('.rc-private-server-count'), count);

        const pictures = (Array.isArray(details?.playerImages) ? details.playerImages : [])
          .filter(url => typeof url === 'string' && url.startsWith('https://'));
        const signature = JSON.stringify([pictures, details?.playing ?? null, count]);
        const renderedImages = [...roster.querySelectorAll(':scope > img')].map(image => image.getAttribute('src'));
        const expectedChildren = pictures.length || (count ? 1 : 0);
        if (roster.dataset.rcPlayers !== signature || roster.children.length !== expectedChildren
          || JSON.stringify(renderedImages) !== JSON.stringify(pictures)) {
          roster.dataset.rcPlayers = signature;
          roster.replaceChildren();
          for (const imageUrl of pictures) {
            const image = document.createElement('img');
            image.src = imageUrl;
            image.alt = 'Player';
            image.loading = 'lazy';
            roster.append(image);
          }
          if (!pictures.length && count) {
            const label = document.createElement('span');
            label.className = 'rc-private-server-roster-count';
            const playing = Number(count.match(/^\d+/)?.[0] || 0);
            label.textContent = playing ? `${playing} players online` : 'No players online';
            roster.append(label);
          }
        }
        // Reveal the card only after its summary, avatar, controls and roster are populated.
        row.setAttribute('data-rc-private-server-ready', '');
      }
    }

    for (const [list, rows] of serverLists) {
      limitPrivateServerCards(list, rows, placeId);
      syncPrivateServerLoading(list, privateRows.get(list).length > rows.length);
    }

    if (!serverIds.size && !serverNames.size || privateRequest || Date.now() < privateRetryAfter) return;
    const requestedIds = [...serverIds].slice(0, 100);
    const requestedServerNames = [...serverNames].slice(0, 100);
    const requestedNames = new Set(requestedServerNames.map(name => name.toLowerCase()));
    if (Date.now() - privateFetchedAt < 90_000
      && privateFetchedSourceVersion === privateSourceVersion
      && requestedIds.every(id => privateQueriedIds.has(id))
      && [...requestedNames].every(name => privateQueriedNames.has(name))) return;
    privateRequest = true;
    const sourceVersion = privateSourceVersion;
    sendMessage({ type: 'rc-private-server-details', placeId,
      serverIds: requestedIds, serverNames: requestedServerNames }, response => {
      privateRequest = false;
      if (privatePlaceId !== placeId || privateSourceVersion !== sourceVersion) {
        schedule();
        return;
      }
      if (chrome.runtime.lastError || !Array.isArray(response?.servers)) {
        privateRetryAfter = Date.now() + 30_000;
        setTimeout(schedule, 30_000);
        syncPrivateServers();
        return;
      }
      privateDetails.clear();
      privateDetailsByName.clear();
      const uniqueNames = new Set(Array.isArray(response.uniqueNames) ? response.uniqueNames : []);
      for (const server of response.servers) {
        if (!Number.isSafeInteger(server?.id) || server.id <= 0) continue;
        privateDetails.set(server.id, server);
        const nameKey = typeof server.name === 'string' ? server.name.toLowerCase() : '';
        if (nameKey && uniqueNames.has(nameKey) && privateNameCounts.get(nameKey) === 1
          && requestedNames.has(nameKey)) {
          privateDetailsByName.set(nameKey, server);
        }
      }
      privateQueriedIds = new Set(requestedIds);
      privateQueriedNames = requestedNames;
      privateFetchedAt = Date.now();
      privateFetchedSourceVersion = sourceVersion;
      privateRetryAfter = 0;
      setTimeout(schedule, 90_000);
      syncPrivateServers();
      schedule();
    });
  }

  async function initialize() {
    if (running || document.readyState === 'loading') return;
    const state = currentPage();
    if (!state || initialized.get(state.page) === state.placeId) return;

    running = true;
    const originalUrl = location.href;
    try {
      // A Home-to-game navigation can reuse the document. Let Roblox finish its
      // default About pane before opening the tabs that fetch Store and Servers.
      if (!state.page.querySelector('#about')?.classList.contains('active')) {
        state.links[0].click();
      }

      if (!await waitForGamePaneContent(state.page, '#about', () => aboutReady(state.page), 10_000)) {
        if (!state.page.isConnected || !pageMatchesPath(state.page)
          || placeIdFromPath() !== state.placeId) return;
        setTimeout(schedule, 2000);
        return;
      }

      // Keep the native Store and Servers components and their own actions.
      for (const [index, link] of state.links.slice(1).entries()) {
        if (!state.page.isConnected || !pageMatchesPath(state.page)
          || placeIdFromPath() !== state.placeId) return;
        link.click();
        if (index === 1) {
          await waitForServerContent(state.page);
          if (!state.page.isConnected || !pageMatchesPath(state.page)
            || placeIdFromPath() !== state.placeId) return;
          syncPrivateServers();
        } else await waitForStoreContent(state.page);
      }

      // Return to About so Roblox keeps its description, badges and related
      // games mounted after the other two panes have fetched their data.
      if (!state.page.isConnected || !pageMatchesPath(state.page)
        || placeIdFromPath() !== state.placeId) return;
      state.links[0].click();
      if (!await waitForGamePaneContent(state.page, '#about', () => aboutReady(state.page), 10_000)) {
        if (!state.page.isConnected || !pageMatchesPath(state.page)
          || placeIdFromPath() !== state.placeId) return;
        setTimeout(schedule, 2000);
        return;
      }

      if (!state.page.isConnected || !pageMatchesPath(state.page)
        || placeIdFromPath() !== state.placeId) return;
      history.replaceState(history.state, '', originalUrl);
      initialized.set(state.page, state.placeId);
    } finally {
      running = false;
      moveRecommendations();
      if (!state.page.isConnected || placeIdFromPath() !== state.placeId) schedule();
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      moveRecommendations();
      syncLivePlayerStat();
      syncStoreSections();
      syncRolimonsPanel();
      syncXFeed();
      syncYouTubeFeed();
      syncBadges();
      syncPrivateServers();
      syncPublicServerStatuses();
      void initialize();
    }, 500);
  }

  document.addEventListener('rc-game-feed-preferences-changed', () => {
    syncXFeed();
    syncYouTubeFeed();
  });

  new MutationObserver(records => {
    const gamePage = document.querySelector('#game-detail-page');
    if (GAME_PATH.test(location.pathname) && pageMatchesPath(gamePage)) {
      hidePrivateServerLoadMore(gamePage);
      hideNativePublicServerControls(gamePage,
        gamePage.querySelector('#running-game-instances-container'));
    }
    const privateListChanged = GAME_PATH.test(location.pathname) && records.some(privateServerSourceMutation);
    if (privateListChanged) {
      syncPrivateServers();
    }
    schedule();
  }).observe(document, { attributes: true, attributeFilter: [
    'href', 'aria-label', 'title', 'data-rc-hide-x-feed', 'data-rc-hide-youtube-feed',
    'data-rc-profile-social-user-id', 'data-rc-profile-x-url', 'data-rc-profile-youtube-url',
    'data-rc-instance-id', 'data-rc-ping', 'data-btr-instance-id', 'data-rc-playing',
    'data-playing', 'data-player-count', 'src', 'srcset', 'sizes', 'alt',
    'data-private-server-id', 'data-vip-server-id', 'data-server-id', 'data-serverid'
  ], characterData: true, childList: true, subtree: true });
  window.addEventListener('load', schedule, { once: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  globalThis.RobloxCustomizerRuntime?.onResume(schedule);
  globalThis.RobloxCustomizerI18n?.onChange(locale => {
    badgeDateFormatter = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    badgeDateTimeFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
    for (const time of document.querySelectorAll('#rc-x-feed-panel time[datetime], #rc-youtube-feed-panel time[datetime]')) {
      time.textContent = badgeDateTimeFormatter.format(new Date(time.dateTime));
    }
    schedule();
  });
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  syncPrivateServers();
  schedule();
})();
