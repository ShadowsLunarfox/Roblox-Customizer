(() => {
  'use strict';

  const STORAGE_KEY = 'customBackground';
  const DB_NAME = 'roblox-customizer-media';
  const STORE_NAME = 'backgrounds';
  const DEFAULTS = {
    source: 'none', url: '', urlType: 'auto', fileKey: '', fileName: '',
    fit: 'cover', dim: 20, glassBlur: 18, glassOpacity: 62,
    hideFavorites: false, hideStandoutGames: false,
    hideRecommendedUpper: false, hideRecommendedLower: false,
    hiddenRecommendedGames: [], friendRows: 3,
    greetingMorning: '', greetingAfternoon: '', greetingEvening: '',
    clockShowSeconds: true, clockShowDate: true, clockHour12: false,
    hideXFeed: false, hideYouTubeFeed: false
  };
  let settings = { ...DEFAULTS };
  let activeObjectUrl = null;
  let applyGeneration = 0;
  let modal = null;
  let lastFocus = null;
  let menuQueued = false;
  let backgroundError = '';
  let backgroundPending = false;
  let homeSyncQueued = false;
  let homeGreetingUser = null;
  let homeGreetingRequest = null;
  let homeGreetingAttempts = 0;
  let homeGreetingAvatarRetried = false;
  let homeGreetingTickTimer = 0;
  let persistTimer = 0;
  let urlTimer = 0;
  let mediaSelection = 0;
  let settingsChanged = false;
  let saveQueue = Promise.resolve(true);
  let modalClosing = false;
  const writerId = crypto.randomUUID();
  const pendingFileDeletes = new Set();
  const homeFormatterCache = new Map();
  const HOME_VISIBILITY = [
    { key: 'hideFavorites', id: 'rc-hide-favorites', attribute: 'data-rc-hide-favorites' },
    { key: 'hideStandoutGames', id: 'rc-hide-standout-games', attribute: 'data-rc-hide-standout-games' },
    { key: 'hideRecommendedUpper', id: 'rc-hide-recommended-upper', attribute: 'data-rc-hide-recommended-upper' },
    { key: 'hideRecommendedLower', id: 'rc-hide-recommended-lower', attribute: 'data-rc-hide-recommended-lower' }
  ];

  function currentSettings(value) {
    const saved = { ...value };
    // The old switch hid every recommendation section. Preserve that choice
    // until each new switch has its own saved preference.
    for (const key of ['hideRecommendedUpper', 'hideRecommendedLower']) {
      saved[key] = typeof saved[key] === 'boolean' ? saved[key] : saved.hideRecommended === true;
    }
    delete saved.hideRecommended;
    delete saved.clockShowTimeZone;
    delete saved.clockDateFormat;
    delete saved.clockTimeZone;
    return { ...DEFAULTS, ...saved };
  }

  function syncFrostPage() {
    if (globalThis.RobloxCustomizerStartup) {
      globalThis.RobloxCustomizerStartup.syncRoute();
      return;
    }
    const path = location.pathname;
    const page = (/^\/catalog(?:\/|$)/i.test(path)
      || /^\/bundles\/\d+(?:\/|$)/i.test(path)) ? 'catalog'
      : /^\/game-pass\/\d+(?:\/|$)/i.test(path) ? 'game-pass'
      : /^\/badges\/\d+(?:\/|$)/i.test(path) ? 'badge'
      : /^\/private-server\/configure(?:\/\d+)?\/?$/i.test(path) ? 'private-server-configure'
      : /^\/users\/\d+\/profile(?:\/|$)/i.test(path) ? 'profile'
      : /^\/plus(?:\/|$)/i.test(path) ? 'plus'
      : /^\/my\/messages(?:\/|$)/i.test(path) ? 'messages'
      : /^\/my\/account\/?$/i.test(path) ? 'account-settings'
      : /^\/users\/(?:\d+\/)?friends(?:\/|$)/i.test(path) ? 'friends'
      : /^\/my\/avatar(?:\/|$)/i.test(path) ? 'avatar'
      : /^\/users\/(?:\d+\/)?inventory(?:\/|$)/i.test(path) ? 'inventory'
      : /^\/trades(?:\/|$)/i.test(path) ? 'trades'
      : /^\/transactions\/?$/i.test(path) ? 'transactions'
      : /^\/report-abuse\/?$/i.test(path) ? 'report-abuse'
      : /^\/upgrades\/robux\/?$/i.test(path) ? 'robux'
      : /^\/search\/(?:communities|groups)\/?$/i.test(path) ? 'community-search'
      : /^\/(?:communities|groups)\/create\/?$/i.test(path) ? 'community-create'
      : /^\/(?:communities|groups)\/\d+(?:\/|$)/i.test(path) ? 'community'
      : /^\/charts(?:\/|$)/i.test(path) ? 'charts' : '';
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute('data-rc-ui-active', '');
    if (page) {
      if (root.dataset.rcFrostPage !== page) root.dataset.rcFrostPage = page;
    } else if (root.hasAttribute('data-rc-frost-page')) delete root.dataset.rcFrostPage;
  }

  syncFrostPage();
  addEventListener('popstate', syncFrostPage);
  addEventListener('hashchange', syncFrostPage);

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function readFile(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();
    });
  }

  async function writeFile(key, file) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(file, key);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    });
  }

  async function deleteFile(key) {
    if (!key) return;
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).delete(key);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    });
  }

  function mediaTypeForUrl(url, selectedType) {
    if (selectedType !== 'auto') return selectedType;
    return /\.mp4$/i.test(new URL(url).pathname) ? 'video' : 'image';
  }

  function mediaTypeForFile(file) {
    if (file.type === 'video/mp4' || /\.mp4$/i.test(file.name)) return 'video';
    if (file.type.startsWith('image/') || /\.(gif|png|jpe?g|webp|avif)$/i.test(file.name)) return 'image';
    return null;
  }

  function ensureLayer() {
    let layer = document.getElementById('rc-background-layer');
    if (!layer && document.body) {
      layer = document.createElement('div');
      layer.id = 'rc-background-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.prepend(layer);
    }
    return layer;
  }

  function applyGlass(blur = settings.glassBlur, opacity = settings.glassOpacity) {
    const root = document.documentElement;
    if (!root) return;
    const clampedOpacity = Math.max(25, Math.min(90, Number(opacity) || 62));
    root.style.setProperty('--rc-glass-blur', `${Math.max(0, Math.min(40, Number(blur) || 0))}px`);
    root.style.setProperty('--rc-glass-opacity', String(clampedOpacity / 100));
    root.style.setProperty('--rc-page-panel-opacity', String(clampedOpacity / 200));
  }

  function homeFormatter(key, locale, options) {
    if (!homeFormatterCache.has(key)) {
      if (homeFormatterCache.size >= 32) homeFormatterCache.clear();
      homeFormatterCache.set(key, new Intl.DateTimeFormat(locale, options));
    }
    return homeFormatterCache.get(key);
  }

  function homeGreetingText(now) {
    const hour = now.getHours();
    const key = hour >= 5 && hour < 12 ? 'greetingMorning'
      : hour >= 12 && hour < 18 ? 'greetingAfternoon' : 'greetingEvening';
    const fallback = key === 'greetingMorning' ? 'good morning!'
      : key === 'greetingAfternoon' ? 'good afternoon!' : 'good evening!';
    return typeof settings[key] === 'string' ? settings[key].trim().slice(0, 100) || fallback : fallback;
  }

  function homeDateText(now) {
    return homeFormatter('date|medium', undefined, { dateStyle: 'medium' }).format(now);
  }

  function updateHomeGreeting() {
    const card = document.getElementById('rc-home-greeting');
    if (!card) return;
    const now = new Date();
    const displayName = homeGreetingUser?.displayName || homeGreetingUser?.name;
    const greeting = homeGreetingText(now);
    const title = displayName ? `${displayName}, ${greeting}`
      : `${greeting.charAt(0).toUpperCase()}${greeting.slice(1)}`;
    const heading = card.querySelector('.rc-home-greeting-title');
    if (heading.textContent !== title) heading.textContent = title;

    const username = card.querySelector('.rc-home-greeting-username');
    const usernameText = homeGreetingUser?.name ? `@${homeGreetingUser.name}` : '';
    if (username.textContent !== usernameText) username.textContent = usernameText;
    username.hidden = !usernameText;

    const avatar = card.querySelector('.rc-home-greeting-avatar');
    const image = card.querySelector('.rc-home-greeting-avatar img');
    const initial = card.querySelector('.rc-home-greeting-initial');
    const imageUrl = homeGreetingUser?.imageUrl || '';
    if (imageUrl && image.src !== imageUrl) image.src = imageUrl;
    image.hidden = !imageUrl;
    initial.hidden = !!imageUrl;
    initial.textContent = (displayName || '?').slice(0, 1).toUpperCase();
    avatar.setAttribute('aria-label', displayName ? `${displayName}'s avatar` : 'Player avatar');

    const clock = card.querySelector('.rc-home-greeting-time');
    const showSeconds = settings.clockShowSeconds !== false;
    const hour12 = settings.clockHour12 === true;
    const clockText = homeFormatter(`time|${showSeconds}|${hour12}`, undefined, {
      hour: '2-digit', minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined, hour12
    }).format(now);
    if (clock.textContent !== clockText) clock.textContent = clockText;
    clock.dateTime = now.toISOString();

    const date = card.querySelector('.rc-home-greeting-date');
    date.hidden = settings.clockShowDate === false;
    if (!date.hidden) {
      const dateText = homeDateText(now);
      if (date.textContent !== dateText) date.textContent = dateText;
    }
  }

  function requestHomeGreetingUser() {
    if (!/^\/home\/?$/i.test(location.pathname)
      || homeGreetingRequest || homeGreetingAttempts >= 3) return;
    homeGreetingAttempts++;
    homeGreetingRequest = new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'rc-home-user' }, result => {
        const error = chrome.runtime.lastError;
        if (error || result?.error || !Number.isSafeInteger(result?.id)) {
          reject(new Error(error?.message || result?.error || 'Player details unavailable.'));
        } else resolve(result);
      });
    });
    homeGreetingRequest.then(user => {
      homeGreetingUser = user;
      homeGreetingRequest = null;
      updateHomeGreeting();
      if (!user.imageUrl && !homeGreetingAvatarRetried) {
        homeGreetingAvatarRetried = true;
        setTimeout(() => {
          if (!/^\/home\/?$/i.test(location.pathname)) return;
          homeGreetingAttempts = 0;
          requestHomeGreetingUser();
        }, 2500);
      }
    }).catch(() => {
      homeGreetingRequest = null;
      if (homeGreetingAttempts < 3 && /^\/home\/?$/i.test(location.pathname)) {
        setTimeout(requestHomeGreetingUser, homeGreetingAttempts * 2000);
      }
    });
  }

  function syncHomeGreeting(home) {
    if (home === document.body) return;
    let card = document.getElementById('rc-home-greeting');
    if (!card) {
      card = document.createElement('section');
      card.id = 'rc-home-greeting';
      card.className = 'rc-home-greeting';
      card.setAttribute('aria-label', 'Personal greeting');
      card.innerHTML = '<span class="rc-home-greeting-avatar" role="img" aria-label="Player avatar"><img alt="" hidden><span class="rc-home-greeting-initial" aria-hidden="true">?</span></span><div class="rc-home-greeting-copy"><span class="rc-home-greeting-eyebrow">YOUR HOME</span><h2 class="rc-home-greeting-title"></h2><span class="rc-home-greeting-username" hidden></span></div><div class="rc-home-greeting-clock"><span class="rc-home-greeting-clock-label">TIME</span><time class="rc-home-greeting-time"></time><span class="rc-home-greeting-date"></span></div>';
    }
    if (card.parentElement !== home || home.firstElementChild !== card) home.prepend(card);
    updateHomeGreeting();
    if (!homeGreetingTickTimer) scheduleHomeGreetingTick();
    if (!homeGreetingUser) requestHomeGreetingUser();
  }

  function homeSectionKind(text) {
    const title = (text || '').trim().replace(/\s+/g, ' ');
    if (title.length > 200) return '';
    if (/^Favorites\s*[→›»>]?\s*$/i.test(title)) return 'favorites';
    if (/^Standout Games(?=\s|:|$)/i.test(title)) return 'standout';
    if (/^Recommended (?:For You|Games)(?=\s|[→›»:]|$)/i.test(title)) return 'recommended';
    return '';
  }

  function markHomeSections(home, cardSelector, gameSelector) {
    const sections = new Map();
    const protectedSections = '.friend-carousel-container, #rc-pinned-games, #rc-home-greeting, #rc-settings-overlay';
    const headingSelector = 'h1, h2, h3, h4, [role="heading"], .game-home-page-carousel-title, .game-carousel-title';
    const labelledTitles = '[aria-label^="Favorites" i], [aria-label^="Standout Games" i], [aria-label^="Recommended For You" i], [aria-label^="Recommended Games" i]';
    for (const heading of home.querySelectorAll(`${headingSelector}, ${labelledTitles}, span, div`)) {
      if (heading.closest(`${protectedSections}, ${cardSelector}`) || heading.childElementCount > 3) continue;
      const kind = homeSectionKind(heading.getAttribute('aria-label') || heading.textContent);
      if (!kind || [...heading.children].some(child => homeSectionKind(child.textContent) === kind)) continue;
      for (let section = heading.parentElement; section && section !== home && section !== document.body;
        section = section.parentElement) {
        if (section.matches(protectedSections) || section.querySelector(protectedSections)) break;
        // Do not hide a shared wrapper containing another Home section, such as Continue.
        if ([...section.querySelectorAll(headingSelector)].some(other =>
          !other.closest(cardSelector) && other.textContent.trim()
          && homeSectionKind(other.textContent) !== kind)) break;
        if (!section.querySelector(gameSelector) && !section.matches(
          '.game-sort-carousel-container, .game-carousel-container, .game-home-page-carousel-container, .game-grid-container')) continue;
        sections.set(section, kind);
        break;
      }
    }
    for (const section of home.querySelectorAll('[data-rc-home-section], [data-rc-recommended-section]')) {
      if (sections.has(section)) continue;
      section.removeAttribute('data-rc-home-section');
      section.removeAttribute('data-rc-recommended-section');
    }
    let recommendedPart = 'upper';
    for (const [section, kind] of sections) {
      if (section.getAttribute('data-rc-home-section') !== kind) section.setAttribute('data-rc-home-section', kind);
      if (kind === 'recommended') {
        // DOM order remains stable when a section is hidden or has not loaded
        // its cards yet; visual coordinates would misclassify those sections.
        if (section.getAttribute('data-rc-recommended-section') !== recommendedPart) {
          section.setAttribute('data-rc-recommended-section', recommendedPart);
        }
        recommendedPart = 'lower';
      } else section.removeAttribute('data-rc-recommended-section');
    }
  }

  function syncHomeContent() {
    if (!/^\/home\/?$/i.test(location.pathname)) {
      document.getElementById('rc-home-greeting')?.remove();
      clearTimeout(homeGreetingTickTimer);
      homeGreetingTickTimer = 0;
      for (const section of document.querySelectorAll('[data-rc-home-section], [data-rc-recommended-section]')) {
        section.removeAttribute('data-rc-home-section');
        section.removeAttribute('data-rc-recommended-section');
      }
      return;
    }
    const home = document.querySelector('#HomeContainer, .home-container, [data-testid="home-page"]')
      || document.querySelector('main') || document.body;
    if (!home) return;
    syncHomeGreeting(home);

    const cardSelector = '.game-card-container, .game-card, .hover-game-tile, .game-tile, .grid-item-container, [data-testid="game-card"], [data-testid="game-tile"]';
    const gameSelector = `a[href*="/games/"], ${cardSelector}`;
    for (const link of home.querySelectorAll('a[href*="/games/"]')) {
      if (link.closest('.friend-carousel-container, #rc-pinned-games')) continue;
      const card = link.closest(cardSelector);
      if (card && home.contains(card)) card.classList.add('rc-home-game-card');
    }

    markHomeSections(home, cardSelector, gameSelector);

    const hiddenIds = new Set(hiddenRecommendedGames().map(game => game.placeId));
    const recommendedCards = new Set();
    for (const section of home.querySelectorAll('[data-rc-recommended-section]')) {
      for (const link of section.querySelectorAll('a[href*="/games/"]')) {
        let url;
        try { url = new URL(link.href); } catch { continue; }
        if (!['www.roblox.com', 'roblox.com'].includes(url.hostname)) continue;
        const placeId = url.pathname.match(/^\/games\/(\d+)(?:\/|$)/)?.[1];
        if (!placeId) continue;
        const card = link.closest('.game-card-container, .grid-item-container, [data-testid="game-card"], [data-testid="game-tile"]')
          || link.closest('.game-card, .hover-game-tile, .game-tile');
        if (!card || !section.contains(card)) continue;
        if (recommendedCards.has(card)) continue;
        recommendedCards.add(card);
        const name = (card.querySelector('.game-card-name, .game-name, [data-testid="game-title"]')?.textContent
          || link.getAttribute('aria-label') || link.getAttribute('title') || link.textContent || `Game ${placeId}`)
          .trim().replace(/\s+/g, ' ').slice(0, 100);
        card.setAttribute('data-rc-recommended-card', '');
        card.dataset.rcRecommendedPlaceId = placeId;
        card.dataset.rcRecommendedName = name || `Game ${placeId}`;
        card.toggleAttribute('data-rc-recommended-hidden', hiddenIds.has(placeId));
        let button = card.querySelector(':scope > .rc-hide-recommended-game');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'rc-hide-recommended-game';
          button.textContent = 'Hide';
          card.append(button);
        }
        button.setAttribute('aria-label', `Hide ${card.dataset.rcRecommendedName} from recommendations`);
        button.title = 'Hide this recommendation';
      }
    }
    for (const card of home.querySelectorAll('[data-rc-recommended-card]')) {
      if (recommendedCards.has(card)) continue;
      card.removeAttribute('data-rc-recommended-card');
      card.removeAttribute('data-rc-recommended-hidden');
      delete card.dataset.rcRecommendedPlaceId;
      delete card.dataset.rcRecommendedName;
      card.querySelector(':scope > .rc-hide-recommended-game')?.remove();
    }
  }

  function hiddenRecommendedGames() {
    if (!Array.isArray(settings.hiddenRecommendedGames)) return [];
    const seen = new Set();
    return settings.hiddenRecommendedGames.filter(game => {
      const id = String(game?.placeId || '');
      if (!/^\d+$/.test(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).map(game => ({
      placeId: String(game.placeId),
      name: typeof game.name === 'string' ? game.name.slice(0, 100) : `Game ${game.placeId}`
    }));
  }

  function queueHomeSync() {
    if (homeSyncQueued) return;
    homeSyncQueued = true;
    requestAnimationFrame(() => {
      homeSyncQueued = false;
      syncHomeContent();
    });
  }

  addEventListener('popstate', queueHomeSync);
  addEventListener('hashchange', queueHomeSync);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateHomeGreeting();
  });
  function scheduleHomeGreetingTick() {
    clearTimeout(homeGreetingTickTimer);
    if (!/^\/home\/?$/i.test(location.pathname)) {
      homeGreetingTickTimer = 0;
      return;
    }
    const interval = settings.clockShowSeconds === false ? 60_000 : 1000;
    homeGreetingTickTimer = setTimeout(() => {
      homeGreetingTickTimer = 0;
      updateHomeGreeting();
      scheduleHomeGreetingTick();
    }, interval - Date.now() % interval + 40);
  }
  scheduleHomeGreetingTick();

  function applyHomePreferences() {
    for (const control of HOME_VISIBILITY) {
      const hidden = settings[control.key] === true;
      document.documentElement?.toggleAttribute(control.attribute, hidden);
      const input = modal?.querySelector(`#${control.id}`);
      if (input) input.checked = hidden;
    }
    syncHomeContent();
  }

  async function applyBackground() {
    const generation = ++applyGeneration;
    const layer = ensureLayer();
    if (!layer) {
      backgroundPending = true;
      return;
    }
    backgroundPending = false;
    backgroundError = '';
    let source = '';
    let type = 'image';
    let objectUrl = null;

    try {
      if (settings.source === 'file') {
        const file = await readFile(settings.fileKey);
        if (!file) throw new Error('Saved file is unavailable. Choose it again.');
        objectUrl = URL.createObjectURL(file);
        source = objectUrl;
        type = mediaTypeForFile(file);
      } else if (settings.source === 'url') {
        source = settings.url;
        type = mediaTypeForUrl(source, settings.urlType);
      }
    } catch (error) {
      if (generation === applyGeneration) {
        backgroundError = error.message || 'Could not load the saved background.';
        if (modal) setStatus(backgroundError, true);
      }
    }

    if (generation !== applyGeneration) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      return;
    }

    layer.replaceChildren();
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = objectUrl;
    document.documentElement.toggleAttribute('data-rc-background-active', !!source);
    if (!source) return;

    const media = document.createElement(type === 'video' ? 'video' : 'img');
    media.className = 'rc-background-media';
    media.src = source;
    if (type === 'video') {
      media.autoplay = true;
      media.loop = true;
      media.muted = true;
      media.playsInline = true;
      media.setAttribute('disablepictureinpicture', '');
    } else {
      media.alt = '';
    }
    media.addEventListener('error', () => {
      if (generation !== applyGeneration) return;
      backgroundError = 'Could not load this background. Check the file or URL.';
      if (modal) setStatus(backgroundError, true);
    });
    media.addEventListener(type === 'video' ? 'loadeddata' : 'load', () => {
      if (generation === applyGeneration) backgroundError = '';
    }, { once: true });

    const shade = document.createElement('div');
    shade.className = 'rc-background-shade';
    layer.style.setProperty('--rc-background-fit', settings.fit);
    layer.style.setProperty('--rc-background-dim', String(settings.dim / 100));
    layer.append(media, shade);
    if (type === 'video') media.play().catch(() => {});
  }

  function findSettingsMenu() {
    return document.querySelector('#settings-popover-menu')
      || document.querySelector('#navbar-settings .dropdown-menu');
  }

  function findNativeSettingsItem() {
    const candidates = document.querySelectorAll(
      'a[href*="/my/account"], a[href*="/settings"], [role="menuitem"], button'
    );
    for (const item of candidates) {
      if (item.closest('#rc-settings-overlay, .rc-settings-menu-entry')) continue;
      const label = (item.textContent || '').trim().replace(/\s+/g, ' ');
      if (!/^Settings$/i.test(label)) continue;
      const rect = item.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.top > 450) continue;
      if (item.matches('button') && rect.top < 40
        && !item.closest('[role="menu"], [data-state="open"], [id*="popover"], [class*="popover"]')) continue;
      if (innerWidth > 700 && rect.left < innerWidth / 2 - 100
        && !item.closest('[role="menu"], [id*="popover"], [class*="popover"]')) continue;
      return item;
    }
    return null;
  }

  function setMenuBrand(entry) {
    const brand = document.createElement('span');
    brand.className = 'rc-settings-menu-brand';
    const icon = document.createElement('img');
    icon.className = 'rc-brand-icon';
    icon.src = chrome.runtime.getURL('icons/icon-48.png');
    icon.alt = '';
    icon.width = 24;
    icon.height = 24;
    icon.setAttribute('aria-hidden', 'true');
    brand.append(icon, document.createTextNode('Roblox Customizer'));
    entry.replaceChildren(brand);
  }

  function syncMenu() {
    document.getElementById('rc-settings-launcher')?.remove();

    const nativeItem = findNativeSettingsItem();
    if (nativeItem) {
      const row = nativeItem.closest('li') || nativeItem;
      if ([...(row.parentElement?.children || [])]
        .some(sibling => sibling.hasAttribute('data-rc-settings-clone')
          || sibling.matches('.rc-settings-menu-entry')
          || sibling.querySelector('.rc-settings-menu-entry'))) return;
      const addedRow = row.cloneNode(true);
      const entry = addedRow.matches('a, button, [role="menuitem"]')
        ? addedRow : addedRow.querySelector('a, button, [role="menuitem"]');
      if (entry) {
        addedRow.setAttribute('data-rc-settings-clone', '');
        addedRow.removeAttribute('id');
        addedRow.removeAttribute('data-testid');
        addedRow.querySelectorAll('[id], [data-testid]').forEach(node => {
          node.removeAttribute('id');
          node.removeAttribute('data-testid');
        });
        setMenuBrand(entry);
        entry.removeAttribute('href');
        entry.removeAttribute('aria-current');
        entry.removeAttribute('aria-expanded');
        entry.classList.remove('active', 'selected');
        entry.classList.add('rc-settings-menu-entry');
        entry.setAttribute('aria-label', 'Open Roblox Customizer settings');
        entry.setAttribute('aria-haspopup', 'dialog');
        if (entry.tagName === 'BUTTON') entry.type = 'button';
        else entry.setAttribute('tabindex', '0');
        row.after(addedRow);
        return;
      }
    }

    const menu = findSettingsMenu();
    if (!menu || menu.querySelector('.rc-settings-menu-entry')) return;
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.className = 'rbx-menu-item rc-settings-menu-entry';
    link.href = '#';
    setMenuBrand(link);
    link.setAttribute('aria-label', 'Open Roblox Customizer settings');
    link.setAttribute('aria-haspopup', 'dialog');
    item.append(link);
    menu.prepend(item);
  }

  function queueMenuSync() {
    if (menuQueued) return;
    menuQueued = true;
    requestAnimationFrame(() => {
      menuQueued = false;
      syncMenu();
    });
  }

  function setStatus(message, isError = false) {
    if (!modal) return;
    const status = modal.querySelector('#rc-settings-status');
    status.textContent = message;
    status.classList.toggle('rc-error', isError);
  }

  function renderHiddenRecommendedGames() {
    const list = modal?.querySelector('#rc-hidden-recommended-games');
    if (!list) return;
    list.replaceChildren();
    const games = hiddenRecommendedGames();
    if (!games.length) {
      const empty = document.createElement('p');
      empty.className = 'rc-settings-hint';
      empty.textContent = 'No games hidden individually.';
      list.append(empty);
      return;
    }
    for (const game of games) {
      const row = document.createElement('div');
      row.className = 'rc-hidden-recommended-game';
      const name = document.createElement('span');
      name.textContent = game.name || `Game ${game.placeId}`;
      name.title = name.textContent;
      const show = document.createElement('button');
      show.type = 'button';
      show.textContent = 'Show';
      show.setAttribute('aria-label', `Show ${name.textContent} in recommendations`);
      show.addEventListener('click', () => {
        changeSettings({ ...settings, hiddenRecommendedGames: hiddenRecommendedGames()
          .filter(item => item.placeId !== game.placeId) }, true);
      });
      row.append(name, show);
      list.append(row);
    }
  }

  function selectedSource() {
    return modal.querySelector('input[name="rc-source"]:checked').value;
  }

  function refreshSourceControls() {
    const source = selectedSource();
    modal.querySelector('#rc-file').disabled = source !== 'file';
    modal.querySelector('#rc-url').disabled = source !== 'url';
    modal.querySelector('#rc-url-type').disabled = source !== 'url';
  }

  async function closeModal() {
    if (!modal || modalClosing) return;
    modalClosing = true;
    if (urlTimer) {
      clearTimeout(urlTimer);
      urlTimer = 0;
      if (selectedSource() === 'url') applyUrlSelection();
    }
    const saved = await (persistTimer ? flushSettingsSave() : saveQueue);
    if (!saved) {
      modalClosing = false;
      return;
    }
    modal.remove();
    modal = null;
    lastFocus?.focus?.();
    lastFocus = null;
    modalClosing = false;
  }

  function applyCurrentSettings(previous) {
    applyGlass();
    document.documentElement?.toggleAttribute('data-rc-hide-x-feed', settings.hideXFeed === true);
    document.documentElement?.toggleAttribute('data-rc-hide-youtube-feed', settings.hideYouTubeFeed === true);
    if (previous && (previous.hideXFeed !== settings.hideXFeed
      || previous.hideYouTubeFeed !== settings.hideYouTubeFeed)) {
      document.dispatchEvent(new CustomEvent('rc-game-feed-preferences-changed'));
    }
    globalThis.RobloxCustomizerStartup?.setPreferences(settings);
    if (!previous || HOME_VISIBILITY.some(control => previous[control.key] !== settings[control.key])
      || previous.hiddenRecommendedGames !== settings.hiddenRecommendedGames) {
      applyHomePreferences();
      renderHiddenRecommendedGames();
    }
    if (!previous || previous.friendRows !== settings.friendRows) {
      document.dispatchEvent(new CustomEvent('rc-friend-rows-changed', {
        detail: { rows: settings.friendRows }
      }));
    }
    if (!previous || ['greetingMorning', 'greetingAfternoon', 'greetingEvening',
      'clockShowSeconds', 'clockShowDate', 'clockHour12']
      .some(key => previous[key] !== settings[key])) updateHomeGreeting();
    if (!previous || previous.clockShowSeconds !== settings.clockShowSeconds) scheduleHomeGreetingTick();
    const layer = ensureLayer();
    layer?.style.setProperty('--rc-background-fit', settings.fit);
    layer?.style.setProperty('--rc-background-dim', String(settings.dim / 100));
    if (!previous || ['source', 'url', 'urlType', 'fileKey'].some(key => previous[key] !== settings[key])) {
      void applyBackground();
    }
  }

  function flushSettingsSave() {
    clearTimeout(persistTimer);
    persistTimer = 0;
    const snapshot = { ...settings, _writer: writerId };
    saveQueue = saveQueue.then(async () => {
      await chrome.storage.local.set({ [STORAGE_KEY]: snapshot });
      for (const key of [...pendingFileDeletes]) {
        if (key === settings.fileKey) continue;
        try { await deleteFile(key); pendingFileDeletes.delete(key); } catch { /* Retry later. */ }
      }
      return true;
    }).catch(error => {
      setStatus(error.message || 'Could not save settings.', true);
      return false;
    });
    return saveQueue;
  }

  function queueSettingsSave(delay = 250) {
    clearTimeout(persistTimer);
    if (delay === 0) return flushSettingsSave();
    persistTimer = setTimeout(flushSettingsSave, delay);
  }

  function changeSettings(next, saveImmediately = false) {
    const previous = settings;
    if (previous.fileKey && previous.fileKey !== next.fileKey) pendingFileDeletes.add(previous.fileKey);
    settings = next;
    settingsChanged = true;
    applyCurrentSettings(previous);
    queueSettingsSave(saveImmediately ? 0 : 250);
  }

  function applyUrlSelection() {
    if (!modal) return;
    try {
      const url = new URL(modal.querySelector('#rc-url').value.trim());
      if (url.protocol !== 'https:') throw new TypeError();
      changeSettings({ ...settings, source: 'url', url: url.href,
        urlType: modal.querySelector('#rc-url-type').value }, true);
      setStatus('');
    } catch {
      setStatus('Enter a valid HTTPS image or MP4 URL.', true);
    }
  }

  async function applyFileSelection(file) {
    const selection = ++mediaSelection;
    if (!file) return;
    if (!mediaTypeForFile(file)) {
      setStatus('Choose an image, GIF, or MP4 file.', true);
      return;
    }
    const key = crypto.randomUUID();
    try {
      setStatus('Loading background...');
      await writeFile(key, file);
      if (selection !== mediaSelection) {
        void deleteFile(key).catch(() => {});
        return;
      }
      changeSettings({ ...settings, source: 'file', fileKey: key, fileName: file.name }, true);
      setStatus('');
    } catch (error) {
      void deleteFile(key).catch(() => {});
      setStatus(error.message || 'Could not load the selected file.', true);
    }
  }

  function removeBackground() {
    ++mediaSelection;
    clearTimeout(urlTimer);
    urlTimer = 0;
    changeSettings({ ...settings, source: 'none', url: '', urlType: 'auto',
      fileKey: '', fileName: '', fit: DEFAULTS.fit, dim: DEFAULTS.dim }, true);
    modal.querySelector('input[name="rc-source"][value="none"]').checked = true;
    modal.querySelector('#rc-file').value = '';
    modal.querySelector('#rc-current-file').textContent = '';
    modal.querySelector('#rc-url').value = '';
    modal.querySelector('#rc-url-type').value = 'auto';
    modal.querySelector('#rc-fit').value = settings.fit;
    modal.querySelector('#rc-dim').value = settings.dim;
    modal.querySelector('#rc-dim-value').value = `${settings.dim}%`;
    refreshSourceControls();
    setStatus('Background removed.');
  }

  function openModal() {
    if (modal) return;
    lastFocus = document.activeElement;
    modal = document.createElement('div');
    modal.id = 'rc-settings-overlay';
    modal.innerHTML = `
      <div class="rc-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="rc-settings-title">
        <div class="rc-settings-heading">
          <div class="rc-settings-brand">
            <img class="rc-brand-icon" src="${chrome.runtime.getURL('icons/icon-128.png')}" width="36" height="36" alt="" aria-hidden="true">
            <h2 id="rc-settings-title">Roblox Customizer</h2>
          </div>
          <button type="button" id="rc-close" class="rc-icon-button" aria-label="Close">&times;</button>
        </div>
        <p class="rc-settings-intro">Changes apply immediately and save automatically. GIFs and MP4 videos stay animated.</p>
        <div id="rc-currency-settings" class="rc-settings-currency"></div>
        <label class="rc-source-label rc-default-source"><input type="radio" name="rc-source" value="none"> Roblox default background</label>
        <div class="rc-settings-field">
          <label class="rc-source-label"><input type="radio" name="rc-source" value="file"> Local file</label>
          <input id="rc-file" type="file" accept="image/*,video/mp4,.mp4">
          <span id="rc-current-file" class="rc-settings-hint"></span>
        </div>
        <div class="rc-settings-field">
          <label class="rc-source-label"><input type="radio" name="rc-source" value="url"> Media URL</label>
          <input id="rc-url" type="url" inputmode="url" placeholder="https://example.com/background.gif">
          <label for="rc-url-type" class="rc-settings-hint">URL format</label>
          <select id="rc-url-type">
            <option value="auto">Detect automatically</option>
            <option value="image">Image or GIF</option>
            <option value="video">MP4 video</option>
          </select>
        </div>
        <div class="rc-settings-options">
          <label for="rc-fit">Image fit</label>
          <select id="rc-fit"><option value="cover">Fill screen</option><option value="contain">Show entire image</option></select>
          <label for="rc-dim">Dark overlay <output id="rc-dim-value"></output></label>
          <input id="rc-dim" type="range" min="0" max="80" step="5">
        </div>
        <div class="rc-settings-glass">
          <h3>Frosted menus and page panels</h3>
          <p class="rc-settings-hint">Works with Roblox's default background or your own image or video.</p>
          <label for="rc-glass-blur">Frost blur <output id="rc-glass-blur-value"></output></label>
          <input id="rc-glass-blur" type="range" min="0" max="40" step="1">
          <label for="rc-glass-opacity">Glass opacity <output id="rc-glass-opacity-value"></output></label>
          <input id="rc-glass-opacity" type="range" min="25" max="90" step="1">
        </div>
        <div class="rc-settings-home">
          <h3>Home page</h3>
          <label for="rc-hide-favorites" class="rc-settings-toggle">
            <input id="rc-hide-favorites" type="checkbox">
            Hide Favorites
          </label>
          <label for="rc-hide-standout-games" class="rc-settings-toggle">
            <input id="rc-hide-standout-games" type="checkbox">
            Hide Standout Games
          </label>
          <label for="rc-hide-recommended-upper" class="rc-settings-toggle">
            <input id="rc-hide-recommended-upper" type="checkbox">
            Hide upper Recommended Games
          </label>
          <label for="rc-hide-recommended-lower" class="rc-settings-toggle">
            <input id="rc-hide-recommended-lower" type="checkbox">
            Hide lower Recommended Games
          </label>
          <div class="rc-settings-hidden-recommendations">
            <h4>Hidden recommendations</h4>
            <p class="rc-settings-hint">Use Hide on a recommended game. Restore it here whenever you want.</p>
            <div id="rc-hidden-recommended-games"></div>
          </div>
          <div class="rc-settings-friends">
            <label for="rc-friend-rows">Maximum friend list rows</label>
            <select id="rc-friend-rows">
              <option value="1">1 row</option><option value="2">2 rows</option>
              <option value="3">3 rows</option>
            </select>
          </div>
          <div class="rc-settings-greetings">
            <h4>Personal greetings</h4>
            <p class="rc-settings-hint">Shown after your name. Leave blank to use the default greeting.</p>
            <label for="rc-greeting-morning">Morning</label>
            <input id="rc-greeting-morning" type="text" maxlength="100" placeholder="good morning!">
            <label for="rc-greeting-afternoon">Afternoon</label>
            <input id="rc-greeting-afternoon" type="text" maxlength="100" placeholder="good afternoon!">
            <label for="rc-greeting-evening">Evening</label>
            <input id="rc-greeting-evening" type="text" maxlength="100" placeholder="good evening!">
          </div>
          <div class="rc-settings-clock">
            <h4>Home clock</h4>
            <div class="rc-settings-clock-toggles">
              <label class="rc-settings-toggle"><input id="rc-clock-seconds" type="checkbox"> Show seconds</label>
              <label class="rc-settings-toggle"><input id="rc-clock-date" type="checkbox"> Show date</label>
            </div>
            <label for="rc-clock-hour-format">Hour format</label>
            <select id="rc-clock-hour-format"><option value="24">24-hour</option><option value="12">12-hour</option></select>
          </div>
        </div>
        <div class="rc-settings-social">
          <h3>Social feed panels</h3>
          <label for="rc-hide-x-feed" class="rc-settings-toggle">
            <input id="rc-hide-x-feed" type="checkbox">
            Hide X feed
          </label>
          <label for="rc-hide-youtube-feed" class="rc-settings-toggle">
            <input id="rc-hide-youtube-feed" type="checkbox">
            Hide YouTube feed
          </label>
        </div>
        <p id="rc-settings-status" role="status" aria-live="polite"></p>
        <div class="rc-settings-actions">
          <button type="button" id="rc-remove" class="rc-button rc-button-secondary">Remove background</button>
          <span class="rc-action-spacer"></span>
          <button type="button" id="rc-done" class="rc-button rc-button-primary">Close</button>
        </div>
      </div>`;
    document.body.append(modal);
    globalThis.RobloxCustomizerCurrency?.mountSettings(modal.querySelector('#rc-currency-settings'));
    modal.querySelector(`input[name="rc-source"][value="${settings.source}"]`).checked = true;
    modal.querySelector('#rc-url').value = settings.url;
    modal.querySelector('#rc-url-type').value = settings.urlType;
    modal.querySelector('#rc-fit').value = settings.fit;
    modal.querySelector('#rc-dim').value = settings.dim;
    modal.querySelector('#rc-dim-value').value = `${settings.dim}%`;
    modal.querySelector('#rc-glass-blur').value = settings.glassBlur;
    modal.querySelector('#rc-glass-blur-value').value = `${settings.glassBlur}px`;
    modal.querySelector('#rc-glass-opacity').value = settings.glassOpacity;
    modal.querySelector('#rc-glass-opacity-value').value = `${settings.glassOpacity}%`;
    for (const control of HOME_VISIBILITY) modal.querySelector(`#${control.id}`).checked = settings[control.key] === true;
    modal.querySelector('#rc-hide-x-feed').checked = settings.hideXFeed === true;
    modal.querySelector('#rc-hide-youtube-feed').checked = settings.hideYouTubeFeed === true;
    renderHiddenRecommendedGames();
    modal.querySelector('#rc-friend-rows').value = String(Math.max(1, Math.min(3,
      Number.isInteger(Number(settings.friendRows)) ? Number(settings.friendRows) : 3)));
    modal.querySelector('#rc-clock-seconds').checked = settings.clockShowSeconds !== false;
    modal.querySelector('#rc-clock-date').checked = settings.clockShowDate !== false;
    modal.querySelector('#rc-clock-hour-format').value = settings.clockHour12 === true ? '12' : '24';
    for (const [id, key] of [['morning', 'greetingMorning'], ['afternoon', 'greetingAfternoon'],
      ['evening', 'greetingEvening']]) {
      modal.querySelector(`#rc-greeting-${id}`).value = typeof settings[key] === 'string' ? settings[key] : '';
    }
    modal.querySelector('#rc-current-file').textContent = settings.fileName ? `Current file: ${settings.fileName}` : '';
    refreshSourceControls();
    if (backgroundError) setStatus(backgroundError, true);

    modal.querySelectorAll('input[name="rc-source"]').forEach(input => input.addEventListener('change', () => {
      ++mediaSelection;
      clearTimeout(urlTimer);
      urlTimer = 0;
      refreshSourceControls();
      if (input.value === 'none') {
        changeSettings({ ...settings, source: 'none' }, true);
        setStatus('');
      } else if (input.value === 'file') {
        if (settings.fileKey) {
          changeSettings({ ...settings, source: 'file' }, true);
          setStatus('');
        } else {
          setStatus('Choose a local file to use as the background.', true);
        }
      } else {
        applyUrlSelection();
      }
    }));
    modal.querySelector('#rc-file').addEventListener('change', event => {
      const file = event.target.files[0];
      if (file) modal.querySelector('#rc-current-file').textContent = `Selected file: ${file.name}`;
      modal.querySelector('input[name="rc-source"][value="file"]').checked = true;
      refreshSourceControls();
      void applyFileSelection(file);
    });
    modal.querySelector('#rc-url').addEventListener('input', () => {
      ++mediaSelection;
      modal.querySelector('input[name="rc-source"][value="url"]').checked = true;
      refreshSourceControls();
      clearTimeout(urlTimer);
      urlTimer = setTimeout(() => {
        urlTimer = 0;
        applyUrlSelection();
      }, 450);
    });
    modal.querySelector('#rc-url').addEventListener('change', () => {
      clearTimeout(urlTimer);
      urlTimer = 0;
      if (selectedSource() === 'url') applyUrlSelection();
    });
    modal.querySelector('#rc-url-type').addEventListener('change', event => {
      if (selectedSource() === 'url') applyUrlSelection();
      else changeSettings({ ...settings, urlType: event.target.value }, true);
    });
    modal.querySelector('#rc-fit').addEventListener('change', event => {
      changeSettings({ ...settings, fit: event.target.value }, true);
    });
    modal.querySelector('#rc-dim').addEventListener('input', event => {
      modal.querySelector('#rc-dim-value').value = `${event.target.value}%`;
      changeSettings({ ...settings, dim: Number(event.target.value) });
    });
    modal.querySelector('#rc-glass-blur').addEventListener('input', event => {
      modal.querySelector('#rc-glass-blur-value').value = `${event.target.value}px`;
      changeSettings({ ...settings, glassBlur: Number(event.target.value) });
    });
    modal.querySelector('#rc-glass-opacity').addEventListener('input', event => {
      modal.querySelector('#rc-glass-opacity-value').value = `${event.target.value}%`;
      changeSettings({ ...settings, glassOpacity: Number(event.target.value) });
    });
    for (const control of HOME_VISIBILITY) {
      modal.querySelector(`#${control.id}`).addEventListener('change', event => {
        changeSettings({ ...settings, [control.key]: event.target.checked }, true);
      });
    }
    modal.querySelector('#rc-hide-x-feed').addEventListener('change', event => {
      changeSettings({ ...settings, hideXFeed: event.target.checked }, true);
    });
    modal.querySelector('#rc-hide-youtube-feed').addEventListener('change', event => {
      changeSettings({ ...settings, hideYouTubeFeed: event.target.checked }, true);
    });
    modal.querySelector('#rc-friend-rows').addEventListener('change', event => {
      changeSettings({ ...settings, friendRows: Number(event.target.value) }, true);
    });
    for (const [id, key] of [['morning', 'greetingMorning'], ['afternoon', 'greetingAfternoon'],
      ['evening', 'greetingEvening']]) {
      modal.querySelector(`#rc-greeting-${id}`).addEventListener('input', event => {
        changeSettings({ ...settings, [key]: event.target.value });
      });
    }
    for (const [id, key] of [['seconds', 'clockShowSeconds'], ['date', 'clockShowDate']]) {
      modal.querySelector(`#rc-clock-${id}`).addEventListener('change', event => {
        changeSettings({ ...settings, [key]: event.target.checked }, true);
      });
    }
    modal.querySelector('#rc-clock-hour-format').addEventListener('change', event => {
      changeSettings({ ...settings, clockHour12: event.target.value === '12' }, true);
    });
    modal.querySelector('#rc-close').addEventListener('click', closeModal);
    modal.querySelector('#rc-done').addEventListener('click', closeModal);
    modal.querySelector('#rc-remove').addEventListener('click', removeBackground);
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(modal.querySelectorAll('button, input:not(:disabled), select:not(:disabled)'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    modal.querySelector('#rc-close').focus();
  }

  document.addEventListener('click', event => {
    const hide = event.target.closest?.('.rc-hide-recommended-game');
    if (!hide) return;
    event.preventDefault();
    event.stopPropagation();
    const card = hide.closest('[data-rc-recommended-card]');
    const placeId = card?.dataset.rcRecommendedPlaceId;
    if (!placeId || !/^\d+$/.test(placeId)) return;
    const games = hiddenRecommendedGames();
    if (games.some(game => game.placeId === placeId)) return;
    changeSettings({ ...settings, hiddenRecommendedGames: [...games, {
      placeId, name: card.dataset.rcRecommendedName || `Game ${placeId}`
    }] }, true);
  }, true);
  document.addEventListener('click', event => {
    const entry = event.target.closest?.('.rc-settings-menu-entry');
    if (!entry) return;
    event.preventDefault();
    event.stopPropagation();
    openModal();
  }, true);
  document.addEventListener('click', event => {
    if (event.target.closest?.('#navbar-settings, [aria-label*="ettings"], [data-testid*="settings"], [aria-haspopup="menu"]')) {
      queueMenuSync();
    }
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const entry = event.target.closest?.('.rc-settings-menu-entry');
    if (!entry) return;
    event.preventDefault();
    event.stopPropagation();
    openModal();
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    if (changes[STORAGE_KEY].newValue?._writer === writerId) return;
    settings = currentSettings(changes[STORAGE_KEY].newValue);
    applyCurrentSettings();
  });

  new MutationObserver(records => {
    if (backgroundPending && document.body) void applyBackground();
    const outsideGreeting = records.filter(record =>
      !(record.target instanceof Element && record.target.closest('#rc-home-greeting')));
    if (outsideGreeting.some(record => record.type === 'childList'
      ? record.addedNodes.length || record.removedNodes.length
      : homeSectionKind(record.oldValue) || homeSectionKind(record.target.textContent))) queueHomeSync();
    if (outsideGreeting.some(record => record.type === 'childList')) {
      queueMenuSync();
      syncFrostPage();
    }
  }).observe(document, { childList: true, subtree: true, characterData: true, characterDataOldValue: true });
  queueMenuSync();

  chrome.storage.local.get(STORAGE_KEY).then(result => {
    if (settingsChanged) return;
    settings = currentSettings(result[STORAGE_KEY]);
    applyCurrentSettings();
  }).catch(error => {
    applyCurrentSettings();
    console.warn('Roblox Customizer: Could not load background settings.', error);
  });
})();
