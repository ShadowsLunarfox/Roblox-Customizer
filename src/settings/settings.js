(() => {
  'use strict';

  const sendMessage = globalThis.RobloxCustomizerRuntime?.sendMessage
    || ((...args) => chrome.runtime.sendMessage(...args));

  const STORAGE_KEY = 'customBackground';
  const enhancementsEnabled = () => !globalThis.RobloxCustomizerCompatibility || globalThis.RobloxCustomizerCompatibility.enabled();
  const DB_NAME = 'roblox-customizer-media';
  const STORE_NAME = 'backgrounds';
  const FEED_PAGES = [
    { kind: 'game', name: 'Game pages', prefix: 'Game' },
    { kind: 'community', name: 'Community pages', prefix: 'Community' },
    { kind: 'profile', name: 'Profile pages', prefix: 'Profile' }
  ];
  const FEED_VISIBILITY = FEED_PAGES.flatMap(page => [
    { key: `show${page.prefix}YouTubeFeed`, id: `rc-show-${page.kind}-youtube-feed`,
      attribute: `data-rc-hide-${page.kind}-youtube-feed`, legacy: 'hideYouTubeFeed', label: 'Enable YouTube feed' },
    { key: `show${page.prefix}XFeed`, id: `rc-show-${page.kind}-x-feed`,
      attribute: `data-rc-hide-${page.kind}-x-feed`, legacy: 'hideXFeed', label: 'Enable X feed' }
  ]);
  const DEFAULTS = {
    source: 'none', url: '', urlType: 'auto', fileKey: '', fileName: '',
    fit: 'cover', dim: 20, glassBlur: 18, glassOpacity: 62, uiLanguage: 'auto',
    disableTransparency: false, disableBlur: false,
    experimentalCustomColors: false,
    customTextColor: '#f4f6fb', customBackgroundColor: '#14161c', customAccentColor: '#335fff',
    hideFavorites: false, hideStandoutGames: false,
    hideRecommendedUpper: false, hideRecommendedLower: false,
    hiddenRecommendedGames: [], friendRows: 3,
    greetingMorning: '', greetingAfternoon: '', greetingEvening: '',
    clockShowSeconds: true, clockShowDate: true, clockHour12: false,
    ...Object.fromEntries(FEED_VISIBILITY.map(control => [control.key, true]))
  };
  let settings = { ...DEFAULTS };
  let activeObjectUrl = null;
  let backgroundLayer = null;
  let applyGeneration = 0;
  let modal = null;
  let modalOpeningPending = false;
  let activeSettingsCategory = 'appearance';
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
  let pendingAppearance = null;
  let mediaSelection = 0;
  let settingsChanged = false;
  let saveQueue = Promise.resolve(true);
  let modalClosing = false;
  let backupBusy = false;
  let mediaTask = Promise.resolve();
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
    for (const control of FEED_VISIBILITY) {
      saved[control.key] = typeof saved[control.key] === 'boolean'
        ? saved[control.key] : saved[control.legacy] !== true;
    }
    delete saved.hideXFeed;
    delete saved.hideYouTubeFeed;
    delete saved.hideRecommended;
    delete saved.clockShowTimeZone;
    delete saved.clockDateFormat;
    delete saved.clockTimeZone;
    if (!['auto', 'en', 'zh-CN', 'zh-TW'].includes(saved.uiLanguage)) saved.uiLanguage = 'auto';
    saved.disableTransparency = saved.disableTransparency === true;
    saved.disableBlur = saved.disableBlur === true;
    saved.experimentalCustomColors = saved.experimentalCustomColors === true;
    for (const key of ['customTextColor', 'customBackgroundColor', 'customAccentColor']) {
      saved[key] = typeof saved[key] === 'string' && /^#[0-9a-f]{6}$/i.test(saved[key])
        ? saved[key].toLowerCase() : DEFAULTS[key];
    }
    return { ...DEFAULTS, ...saved };
  }

  function syncFrostPage() {
    if (!enhancementsEnabled()) return;
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
      : /^\/discover\/?$/i.test(path) ? 'game-search'
      : /^\/search\/users\/?$/i.test(path) ? 'user-search'
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

  async function clearFiles() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
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
    backgroundLayer = layer;
    return layer;
  }

  function applyGlass(blur = settings.glassBlur, opacity = settings.glassOpacity) {
    if (!enhancementsEnabled()) return;
    const root = document.documentElement;
    if (!root) return;
    const clampedOpacity = Math.max(25, Math.min(90, Number(opacity) || 62));
    root.toggleAttribute('data-rc-disable-transparency', settings.disableTransparency === true);
    root.toggleAttribute('data-rc-disable-blur', settings.disableBlur === true);
    root.style.setProperty('--rc-glass-blur', settings.disableBlur ? '0px' : `${Math.max(0, Math.min(40, Number(blur) || 0))}px`);
    root.style.setProperty('--rc-glass-opacity', settings.disableTransparency ? '1' : String(clampedOpacity / 100));
    root.style.setProperty('--rc-page-panel-opacity', settings.disableTransparency ? '1' : String(clampedOpacity / 200));
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
    const translated = globalThis.RobloxCustomizerI18n?.t(fallback) || fallback;
    return typeof settings[key] === 'string' ? settings[key].trim().slice(0, 100) || translated : translated;
  }

  function homeDateText(now) {
    const locale = globalThis.RobloxCustomizerI18n?.locale();
    return homeFormatter(`date|medium|${locale}`, locale, { dateStyle: 'medium' }).format(now);
  }

  function updateHomeGreeting() {
    if (!enhancementsEnabled()) return;
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
    setUIAttribute(avatar, 'aria-label', displayName ? `${displayName}'s avatar` : 'Player avatar');

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
      sendMessage({ type: 'rc-home-user' }, result => {
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
    const localized = globalThis.RobloxCustomizerNativeLabels?.classify('home', text);
    if (localized) return localized;
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
    const headingKind = node => {
      const direct = homeSectionKind(node.getAttribute('aria-label')) || homeSectionKind(node.textContent);
      if (direct || !node.matches(headingSelector)) return direct;
      // Native headings can contain a translated action or an icon label.
      // Match their title child without treating that action as a new section.
      const kinds = new Set([...node.children].map(child => homeSectionKind(child.getAttribute('aria-label'))
        || homeSectionKind(child.textContent)).filter(Boolean));
      return kinds.size === 1 ? [...kinds][0] : '';
    };
    const labelledTitles = '[aria-label]';
    for (const heading of home.querySelectorAll(`${headingSelector}, ${labelledTitles}, span, div`)) {
      if (heading.closest(`${protectedSections}, ${cardSelector}`) || heading.childElementCount > 3) continue;
      const kind = headingKind(heading);
      if (!kind || [...heading.children].some(child => homeSectionKind(child.textContent) === kind)) continue;
      for (let section = heading.parentElement; section && section !== home && section !== document.body;
        section = section.parentElement) {
        if (section.matches(protectedSections) || section.querySelector(protectedSections)) break;
        // Do not hide a shared wrapper containing another Home section, such as Continue.
        if ([...section.querySelectorAll(headingSelector)].some(other =>
          !other.closest(cardSelector) && other.textContent.trim()
          && headingKind(other) !== kind)) break;
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
    if (!enhancementsEnabled()) return;
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
        setUIAttribute(button, 'aria-label', `Hide ${card.dataset.rcRecommendedName} from recommendations`);
        setUIAttribute(button, 'title', 'Hide this recommendation');
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
    if (!enhancementsEnabled()) { homeGreetingTickTimer = 0; return; }
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
    if (!enhancementsEnabled()) return;
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

    if (!enhancementsEnabled() && type === 'video') {
      source = '';
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
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
      const accountLink = item.matches('a[href*="/my/account"]');
      if (!accountLink && !/^Settings$/i.test(label)
        && !globalThis.RobloxCustomizerNativeLabels?.matches('settings', label)) continue;
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

  function setUIAttribute(node, attribute, source) {
    const translated = globalThis.RobloxCustomizerI18n?.t(source) || source;
    if (node.getAttribute(attribute) !== translated) node.setAttribute(attribute, source);
  }

  function syncMenu() {
    document.getElementById('rc-settings-launcher')?.remove();
    if (enhancementsEnabled()) markHeaderMenus();

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

  function markHeaderMenus() {
    const menus = new Set(document.querySelectorAll('#settings-popover-menu, #buy-robux-popover-menu, '
      + '#robux-popover-menu, #navbar-settings .dropdown-menu, #navbar-robux .dropdown-menu'));
    for (const anchor of document.querySelectorAll('.rc-settings-menu-entry, a[href*="/my/account"], '
      + 'a[href*="/settings"], a[href*="/transactions"], a[href*="/redeem"]')) {
      const menu = anchor.closest('[role="menu"]');
      if (menu) menus.add(menu);
    }
    for (const menu of menus) {
      if (!menu.hasAttribute('data-rc-header-menu')) menu.setAttribute('data-rc-header-menu', '');
      for (const item of menu.querySelectorAll('[role="menuitem"]')) {
        item.toggleAttribute('data-rc-menu-action', !item.querySelector('a, button'));
      }
    }
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

  function refreshSourceControls() {
    modal.querySelector('#rc-file').disabled = !modal.querySelector('input[name="rc-source"][value="file"]').checked;
  }

  function refreshColorControls() {
    if (!modal) return;
    modal.querySelector('#rc-custom-colors-enabled').checked = settings.experimentalCustomColors;
    modal.querySelector('#rc-custom-color-fields').disabled = !settings.experimentalCustomColors;
    for (const [id, key] of [['text', 'customTextColor'], ['background', 'customBackgroundColor'], ['accent', 'customAccentColor']]) {
      const input = modal.querySelector(`#rc-custom-${id}-color`);
      if (input.value !== settings[key]) input.value = settings[key];
      modal.querySelector(`#rc-custom-${id}-value`).value = settings[key].toUpperCase();
    }
  }

  function refreshEffectControls() {
    if (!modal) return;
    for (const [id, key, slider, suffix] of [
      ['transparency', 'disableTransparency', 'opacity', '%'],
      ['blur', 'disableBlur', 'blur', 'px']
    ]) {
      modal.querySelector(`#rc-disable-${id}`).setAttribute('aria-pressed', String(settings[key]));
      modal.querySelector(`#rc-glass-${slider}`).disabled = settings[key];
      const value = settings[slider === 'blur' ? 'glassBlur' : 'glassOpacity'];
      modal.querySelector(`#rc-glass-${slider}`).value = value;
      modal.querySelector(`#rc-glass-${slider}-value`).value = `${value}${suffix}`;
    }
  }

  async function closeModal() {
    if (!modal || modalClosing || backupBusy) return;
    modalClosing = true;
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
    pendingAppearance = null;
    globalThis.RobloxCustomizerI18n?.setLanguage(settings.uiLanguage);
    const language = modal?.querySelector('#rc-ui-language');
    if (language) language.value = settings.uiLanguage;
    if (!enhancementsEnabled()) {
      applyAppearance();
      refreshColorControls();
      if (!previous || ['source', 'url', 'urlType', 'fileKey'].some(key => previous[key] !== settings[key])) {
        void applyBackground();
      }
      return;
    }
    for (const control of FEED_VISIBILITY) {
      document.documentElement?.toggleAttribute(control.attribute, settings[control.key] !== true);
      const checkbox = modal?.querySelector(`#${control.id}`);
      if (checkbox) checkbox.checked = settings[control.key] === true;
    }
    document.documentElement?.removeAttribute('data-rc-hide-x-feed');
    document.documentElement?.removeAttribute('data-rc-hide-youtube-feed');
    if (!previous || FEED_VISIBILITY.some(control => previous[control.key] !== settings[control.key])) {
      document.dispatchEvent(new CustomEvent('rc-game-feed-preferences-changed'));
    }
    applyAppearance();
    refreshEffectControls();
    refreshColorControls();
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
    if (!previous || ['source', 'url', 'urlType', 'fileKey'].some(key => previous[key] !== settings[key])) {
      void applyBackground();
    }
  }

  function applyAppearance(previous) {
    if (!previous || ['glassBlur', 'glassOpacity', 'disableTransparency', 'disableBlur',
      'experimentalCustomColors', 'customTextColor', 'customBackgroundColor', 'customAccentColor']
      .some(key => previous[key] !== settings[key])) {
      if (globalThis.RobloxCustomizerStartup) globalThis.RobloxCustomizerStartup.setPreferences(settings);
      else applyGlass();
    }
    if (!previous || previous.fit !== settings.fit || previous.dim !== settings.dim) {
      const layer = ensureLayer();
      layer?.style.setProperty('--rc-background-fit', settings.fit);
      layer?.style.setProperty('--rc-background-dim', String(settings.dim / 100));
    }
  }

  function flushSettingsSave() {
    clearTimeout(persistTimer);
    persistTimer = 0;
    if (pendingAppearance) {
      const previous = pendingAppearance;
      pendingAppearance = null;
      applyAppearance(previous);
    }
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

  function changeAppearance(key, value, commit = false) {
    if (settings[key] !== value) {
      // Root color/blur tokens invalidate styles across the whole Roblox page.
      // Keep dragging native controls cheap; render and persist once on commit
      // or after a pause, without rebuilding unrelated settings controls.
      if (!pendingAppearance) pendingAppearance = settings;
      settings = { ...settings, [key]: value };
      settingsChanged = true;
      queueSettingsSave();
    }
    if (commit && persistTimer) void flushSettingsSave();
  }

  async function applyFileSelection(file) {
    const selection = ++mediaSelection;
    if (!file) return;
    if (!enhancementsEnabled() && mediaTypeForFile(file) !== 'image') {
      setStatus('Choose an image or GIF file.', true);
      return;
    }
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

  function backupStatus(message, isError = false) {
    setStatus(globalThis.RobloxCustomizerI18n?.t(message) || message, isError);
  }

  function lockBackupControls() {
    backupBusy = true;
    const focused = document.activeElement;
    const controls = [...modal.querySelectorAll('input, select, button')]
      .map(control => [control, control.disabled]);
    controls.forEach(([control]) => { control.disabled = true; });
    modal.querySelector('.rc-settings-dialog').setAttribute('aria-busy', 'true');
    return () => {
      backupBusy = false;
      controls.forEach(([control, disabled]) => { control.disabled = disabled; });
      modal?.querySelector('.rc-settings-dialog').removeAttribute('aria-busy');
      if (modal?.contains(focused)) focused.focus({ preventScroll: true });
    };
  }

  async function backupRequest(action, values = {}) {
    const result = await sendMessage({ type: 'rc-data-backup', action, ...values });
    if (!result?.ok) {
      const error = new Error(result?.error || 'Could not access backup data.');
      error.backupRejected = result?.rejected === true;
      throw error;
    }
    return result;
  }

  async function exportBackup() {
    if (backupBusy) return;
    const unlock = lockBackupControls();
    backupStatus('Preparing backup...');
    try {
      await mediaTask;
      if (!await (persistTimer ? flushSettingsSave() : saveQueue)) return;
      const core = globalThis.RobloxCustomizerBackup;
      const result = await backupRequest('export');
      let media = null;
      const background = result.data.customBackground;
      if (background.fileKey) {
        const file = await readFile(background.fileKey);
        if (!file) throw new Error('Your saved background file is unavailable. Choose it again before exporting.');
        if (file.size * 4 / 3 > core.MAX_BYTES - 1048576) throw new Error('Backup files must be smaller than 256 MB.');
        const encoded = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const extension = (background.fileName || '').split('.').pop().toLowerCase();
        const type = file.type || ({ png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
          webp:'image/webp', avif:'image/avif', svg:'image/svg+xml', mp4:'video/mp4' })[extension];
        media = { key: background.fileKey, name: background.fileName || file.name || 'background',
          type, size: file.size, lastModified: file.lastModified || 0, base64: encoded };
      }
      const backup = core.validate({ format: core.FORMAT, version: core.VERSION,
        createdAt: new Date().toISOString(), extensionVersion: result.extensionVersion, data: result.data, media });
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      if (blob.size > core.MAX_BYTES) throw new Error('Backup files must be smaller than 256 MB.');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `roblox-customizer-backup-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      backupStatus('Backup exported.');
    } catch (error) {
      backupStatus(error.message || 'Could not export backup.', true);
    } finally { unlock(); }
  }

  function showImportPreview(backup) {
    if (!modal || backupBusy || modal.querySelector('#rc-import-preview')) return;
    const preview = document.createElement('div');
    preview.id = 'rc-import-preview';
    preview.innerHTML = `
      <div class="rc-import-preview-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="rc-import-preview-title" aria-describedby="rc-import-preview-warning">
        <h3 id="rc-import-preview-title">Review backup before importing</h3>
        <p>This backup contains your extension appearance, Home and social settings, currency preference, pinned games and folders, and playtime histories.</p>
        <p id="rc-import-preview-counts"></p>
        <p id="rc-import-preview-media"></p>
        <p>Playtime stays with the original Roblox accounts listed below. If you sign in to a different account, this history will not appear as that account's Home playtime after the next account check; the records remain stored.</p>
        <ul id="rc-import-preview-accounts"></ul>
        <p>Roblox account data, Robux, purchases, and game progress cannot be imported.</p>
        <p>Live playtime samples and exchange-rate or social-feed caches are not imported.</p>
        <p id="rc-import-preview-warning">Import replaces saved extension settings, pinned games, folders, and playtime histories in this browser; it does not merge them. Export your current data first if you may want to restore it.</p>
        <div class="rc-import-preview-actions">
          <button type="button" id="rc-import-preview-cancel" class="rc-button rc-button-secondary">Cancel</button>
          <button type="button" id="rc-import-preview-confirm" class="rc-button rc-button-primary">Import and replace</button>
        </div>
      </div>`;
    modal.append(preview);
    const t = (source, values) => globalThis.RobloxCustomizerI18n?.t(source, values) || source;
    const accounts = backup.data.rcPlaytimeHistory.accounts;
    const records = accounts.reduce((sum, account) => sum + account.games.length, 0);
    preview.querySelector('#rc-import-preview-counts').textContent = t(
      'This file has {games} pinned games, {folders} folders, and {records} playtime records across {accounts} Roblox accounts.',
      { games: backup.data.pinnedGames.length, folders: backup.data.pinnedGameFolders.length,
        records, accounts: accounts.length });
    preview.querySelector('#rc-import-preview-media').textContent = t(backup.media
      ? 'An uploaded background image or video is included.'
      : backup.data.customBackground.source === 'url'
        ? 'A saved background URL is included; no uploaded file is included.'
        : 'No uploaded background file is included.');
    const list = preview.querySelector('#rc-import-preview-accounts');
    if (!accounts.length) {
      const empty = document.createElement('li');
      empty.textContent = t('No playtime history is included.');
      list.append(empty);
    }
    for (const account of accounts.slice(0, 12)) {
      const item = document.createElement('li');
      item.textContent = `${account.name || account.displayName || t('Unknown account')} · ID ${account.userId} · ${t('{count} games', { count: account.games.length })}`;
      item.setAttribute('translate', 'no');
      list.append(item);
    }
    if (accounts.length > 12) {
      const more = document.createElement('li');
      more.textContent = t('And {count} more accounts.', { count: accounts.length - 12 });
      list.append(more);
    }
    const cancel = () => {
      if (backupBusy) return;
      preview.remove();
      modal.querySelector('#rc-import-backup')?.focus();
    };
    preview.addEventListener('click', event => { if (event.target === preview) cancel(); });
    preview.querySelector('#rc-import-preview-cancel').addEventListener('click', cancel);
    preview.querySelector('#rc-import-preview-confirm').addEventListener('click', () => { void importBackup(backup); });
    preview.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (event.key !== 'Tab') return;
      event.stopPropagation();
      const first = preview.querySelector('#rc-import-preview-cancel');
      const last = preview.querySelector('#rc-import-preview-confirm');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    globalThis.RobloxCustomizerI18n?.localize(preview);
    preview.querySelector('#rc-import-preview-cancel').focus();
  }

  async function prepareImportBackup(file) {
    if (!file || backupBusy || modal?.querySelector('#rc-import-preview')) return;
    const unlock = lockBackupControls();
    backupStatus('Reading backup...');
    let backup;
    try {
      const core = globalThis.RobloxCustomizerBackup;
      if (file.size > core.MAX_BYTES) throw new Error('Backup files must be smaller than 256 MB.');
      let parsed;
      try { parsed = JSON.parse(await file.text()); }
      catch { throw new Error('Invalid backup file. No data was imported.'); }
      backup = core.validate(parsed);
      backupStatus('');
    } catch (error) {
      backupStatus(error.message || 'Could not import backup. Your existing data was kept.', true);
    } finally { unlock(); }
    if (backup) showImportPreview(backup);
  }

  async function importBackup(backup) {
    if (!backup || backupBusy) return;
    const unlock = lockBackupControls();
    backupStatus('Importing backup...');
    let mediaKey = '';
    let imported = false;
    let submitted = false;
    try {
      await mediaTask;
      if (!await (persistTimer ? flushSettingsSave() : saveQueue)) return;
      if (backup.media) {
        const parts = [];
        // Decode large wallpapers in chunks so the settings window can paint.
        for (let i = 0; i < backup.media.base64.length; i += 1048576) {
          const bytes = atob(backup.media.base64.slice(i, i + 1048576));
          parts.push(Uint8Array.from(bytes, character => character.charCodeAt(0)));
          if (i) await new Promise(resolve => setTimeout(resolve, 0));
        }
        mediaKey = crypto.randomUUID();
        await writeFile(mediaKey, new File(parts, backup.media.name,
          { type: backup.media.type, lastModified: backup.media.lastModified }));
        backup.data.customBackground.fileKey = mediaKey;
        backup.data.customBackground.fileName = backup.media.name;
      }
      const oldKey = settings.fileKey;
      submitted = true;
      await backupRequest('import', { data: backup.data });
      imported = true;
      settings = currentSettings(backup.data.customBackground);
      settingsChanged = true;
      applyCurrentSettings();
      if (oldKey && oldKey !== mediaKey) void deleteFile(oldKey).catch(() => {});
    } catch (error) {
      // A closed/timed-out response does not prove the worker failed to commit.
      // Keep its media in that case so a completed/late restore stays usable.
      if (mediaKey && !imported && (!submitted || error.backupRejected)) await deleteFile(mediaKey).catch(() => {});
      backupStatus(error.message || 'Could not import backup. Your existing data was kept.', true);
    } finally {
      unlock();
      if (!imported) {
        modal?.querySelector('#rc-import-preview')?.remove();
        modal?.querySelector('#rc-import-backup')?.focus({ preventScroll: true });
      }
      if (imported && modal) {
        const opener = lastFocus;
        const scrollTop = modal.querySelector('.rc-settings-content').scrollTop;
        modal.remove();
        modal = null;
        openModal();
        lastFocus = opener;
        backupStatus('Backup imported.');
        modal.querySelector('.rc-settings-content').scrollTop = scrollTop;
        modal.querySelector('#rc-import-backup').focus({ preventScroll: true });
      }
    }
  }

  async function resetAll() {
    if (backupBusy) return;
    const unlock = lockBackupControls();
    backupStatus('Resetting all data...');
    try {
      ++mediaSelection;
      await mediaTask;
      clearTimeout(persistTimer);
      persistTimer = 0;
      pendingAppearance = null;
      await saveQueue;
      await clearFiles();
      await backupRequest('reset');
      pendingFileDeletes.clear();
      for (const key of ['roblox-customizer-visuals-v1', 'roblox-customizer-friend-rows']) {
        try { localStorage.removeItem(key); } catch { /* These are optional page caches. */ }
      }
      location.reload();
    } catch {
      modal?.querySelector('#rc-reset-confirmation')?.remove();
      backupStatus('Reset could not finish. Check your saved data before trying again.', true);
    } finally {
      unlock();
    }
  }

  function confirmResetAll() {
    if (!modal || backupBusy || modal.querySelector('#rc-reset-confirmation')) return;
    const warning = document.createElement('div');
    warning.id = 'rc-reset-confirmation';
    warning.innerHTML = `
      <div class="rc-reset-confirmation-dialog" role="alertdialog" aria-modal="true"
        aria-labelledby="rc-reset-title" aria-describedby="rc-reset-warning">
        <h3 id="rc-reset-title">Reset all extension data?</h3>
        <p id="rc-reset-warning">This permanently deletes all settings, uploaded backgrounds, pinned games and folders, and playtime history for every account in this browser. This cannot be undone.</p>
        <div class="rc-reset-confirmation-actions">
          <button type="button" id="rc-reset-cancel" class="rc-button rc-button-secondary">Cancel</button>
          <button type="button" id="rc-reset-confirm" class="rc-button rc-button-danger">Reset All</button>
        </div>
      </div>`;
    modal.append(warning);
    const cancel = () => {
      if (backupBusy) return;
      warning.remove();
      modal.querySelector('#rc-reset-all')?.focus();
    };
    warning.addEventListener('click', event => { if (event.target === warning) cancel(); });
    warning.querySelector('#rc-reset-cancel').addEventListener('click', cancel);
    warning.querySelector('#rc-reset-confirm').addEventListener('click', () => { void resetAll(); });
    warning.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (event.key !== 'Tab') return;
      event.stopPropagation();
      const first = warning.querySelector('#rc-reset-cancel');
      const last = warning.querySelector('#rc-reset-confirm');
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    warning.querySelector('#rc-reset-cancel').focus();
  }

  function organizeSettingsCategories() {
    const dialog = modal.querySelector('.rc-settings-dialog');
    const layout = document.createElement('div');
    layout.className = 'rc-settings-layout';
    layout.innerHTML = '<nav class="rc-settings-nav" aria-label="Settings categories"></nav>'
      + '<div class="rc-settings-content" tabindex="0" aria-label="Settings content"></div>';
    dialog.insertBefore(layout, modal.querySelector('.rc-settings-language'));
    const nav = layout.querySelector('.rc-settings-nav');
    const content = layout.querySelector('.rc-settings-content');
    const categories = [
      { id: 'appearance', title: 'Appearance', nodes: ['.rc-default-source', '.rc-settings-field',
        '.rc-settings-options', '.rc-settings-glass', '.rc-settings-colors'] },
      { id: 'home', title: 'Home page', nodes: ['.rc-settings-home', '#rc-playtime-settings'] },
      { id: 'social', title: 'Social', nodes: ['.rc-settings-social'] },
      { id: 'currency', title: 'Currency', nodes: ['#rc-currency-settings'] },
      { id: 'data', title: 'Language & data', nodes: ['.rc-settings-language', '.rc-settings-backup'] }
    ];
    for (const [index, category] of categories.entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rc-settings-nav-button';
      button.dataset.rcSettingsCategory = category.id;
      button.setAttribute('aria-controls', `rc-settings-category-${category.id}`);
      button.innerHTML = `<span class="rc-settings-nav-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span>${category.title}</span>`;
      nav.append(button);
      const section = document.createElement('section');
      section.className = 'rc-settings-category';
      section.id = `rc-settings-category-${category.id}`;
      section.dataset.rcSettingsCategory = category.id;
      const heading = document.createElement('h3');
      heading.className = 'rc-settings-category-heading';
      heading.id = `rc-settings-category-title-${category.id}`;
      heading.textContent = category.title;
      section.setAttribute('aria-labelledby', heading.id);
      section.append(heading);
      for (const selector of category.nodes) {
        const node = modal.querySelector(selector);
        if (node) section.append(node);
      }
      content.append(section);
    }
    const selectCategory = (id, scroll) => {
      const target = content.querySelector(`#rc-settings-category-${id}`);
      if (!target) return;
      activeSettingsCategory = id;
      for (const button of nav.querySelectorAll('button')) {
        if (button.dataset.rcSettingsCategory === id) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
      if (scroll) content.scrollTop += target.getBoundingClientRect().top - content.getBoundingClientRect().top;
    };
    nav.addEventListener('click', event => {
      const button = event.target.closest('button[data-rc-settings-category]');
      if (button) selectCategory(button.dataset.rcSettingsCategory, true);
    });
    let scrollQueued = false;
    content.addEventListener('scroll', () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        if (!content.isConnected) return;
        const top = content.getBoundingClientRect().top + 20;
        let current = categories[0].id;
        for (const section of content.querySelectorAll('.rc-settings-category')) {
          if (section.getBoundingClientRect().top > top) break;
          current = section.dataset.rcSettingsCategory;
        }
        selectCategory(current, false);
      });
    }, { passive: true });
    selectCategory(activeSettingsCategory, true);
    globalThis.RobloxCustomizerI18n?.localize(layout);
  }

  function updateLegalLinks() {
    if (!modal) return;
    const locale = globalThis.RobloxCustomizerI18n?.locale() || 'en';
    const language = ['en', 'zh-CN', 'zh-TW'].includes(locale) ? locale : 'en';
    for (const link of modal.querySelectorAll('[data-rc-legal-document]')) {
      link.href = `${chrome.runtime.getURL('src/legal/index.html')}?document=${link.dataset.rcLegalDocument}&lang=${language}`;
    }
  }

  function openModal() {
    const compatibility = globalThis.RobloxCustomizerCompatibility;
    if (!document.body || compatibility && !compatibility.enabled() && !compatibility.fallback()) {
      modalOpeningPending = true;
      return;
    }
    modalOpeningPending = false;
    if (modal) return;
    const terms = globalThis.RobloxCustomizerTerms;
    if (terms && !terms.accepted()) {
      void terms.request().then(accepted => { if (accepted) openModal(); });
      return;
    }
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
        <section id="rc-settings-language-notice" role="note" aria-labelledby="rc-settings-language-notice-title" hidden>
          <strong id="rc-settings-language-notice-title">Your Roblox language is not supported yet</strong>
          <p>Only image backgrounds and custom colors are available. All other features are disabled.</p>
          <p>To use all features, switch Roblox's language to English, Simplified Chinese, or Traditional Chinese.</p>
          <a href="/my/account#!/info">Open Roblox language settings</a>
        </section>
        <p class="rc-settings-intro">Changes save automatically. Sliders and colors apply when released or after a short pause. GIFs and MP4 videos stay animated.</p>
        <div class="rc-settings-language">
          <label for="rc-ui-language">Extension language</label>
          <select id="rc-ui-language">
            <option value="auto">Automatic (Roblox / browser)</option>
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
            <option value="zh-TW">繁體中文</option>
          </select>
        </div>
        <div id="rc-currency-settings" class="rc-settings-currency"></div>
        <label class="rc-source-label rc-default-source"><input type="radio" name="rc-source" value="none"> Roblox default background</label>
        <div class="rc-settings-field">
          <label class="rc-source-label"><input type="radio" name="rc-source" value="file"> Local file</label>
          <input id="rc-file" type="file" accept="image/*,video/mp4,.mp4">
          <span id="rc-current-file" class="rc-settings-hint"></span>
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
          <div class="rc-effect-toggles" aria-describedby="rc-effects-hint">
            <button id="rc-disable-transparency" type="button" class="rc-button rc-button-secondary" aria-pressed="false">Disable transparency</button>
            <button id="rc-disable-blur" type="button" class="rc-button rc-button-secondary" aria-pressed="false">Disable blur</button>
          </div>
          <p id="rc-effects-hint" class="rc-settings-hint">Your blur and opacity values are kept when effects are disabled.</p>
          <label for="rc-glass-blur">Frost blur <output id="rc-glass-blur-value"></output></label>
          <input id="rc-glass-blur" type="range" min="0" max="40" step="1">
          <label for="rc-glass-opacity">Glass opacity <output id="rc-glass-opacity-value"></output></label>
          <input id="rc-glass-opacity" type="range" min="25" max="90" step="1">
        </div>
        <section class="rc-settings-colors" aria-labelledby="rc-custom-colors-title">
          <h3 id="rc-custom-colors-title">Custom colors <span class="rc-experimental-badge">Experimental</span></h3>
          <p id="rc-custom-colors-hint" class="rc-settings-hint">Changes text, page and panel backgrounds, and accents. Some Roblox elements may keep their own colors.</p>
          <label class="rc-settings-toggle"><input id="rc-custom-colors-enabled" type="checkbox" aria-describedby="rc-custom-colors-hint"> Enable custom colors</label>
          <fieldset id="rc-custom-color-fields" disabled>
            <legend>Color palette</legend>
            <label for="rc-custom-text-color">Text color</label>
            <div class="rc-color-value"><input id="rc-custom-text-color" type="color"><output id="rc-custom-text-value" for="rc-custom-text-color" translate="no"></output></div>
            <label for="rc-custom-background-color">Background color</label>
            <div class="rc-color-value"><input id="rc-custom-background-color" type="color"><output id="rc-custom-background-value" for="rc-custom-background-color" translate="no"></output></div>
            <label for="rc-custom-accent-color">Accent color</label>
            <div class="rc-color-value"><input id="rc-custom-accent-color" type="color"><output id="rc-custom-accent-value" for="rc-custom-accent-color" translate="no"></output></div>
          </fieldset>
          <button id="rc-reset-colors" type="button" class="rc-button rc-button-secondary">Reset and disable</button>
        </section>
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
        <div id="rc-playtime-settings"></div>
        <div class="rc-settings-social">
          <h3>Social feed panels</h3>
          <p class="rc-settings-hint">Choose feeds separately for each page type.</p>
          ${FEED_PAGES.map(page => `<fieldset class="rc-settings-feed-group">
            <legend>${page.name}</legend>
            ${FEED_VISIBILITY.filter(control => control.key.startsWith(`show${page.prefix}`))
              .map(control => `<label for="${control.id}" class="rc-settings-toggle">
                <input id="${control.id}" type="checkbox">${control.label}
              </label>`).join('')}
          </fieldset>`).join('')}
        </div>
        <section class="rc-settings-backup" aria-labelledby="rc-backup-title">
          <h3 id="rc-backup-title">Backup and restore</h3>
          <p class="rc-settings-hint">Backups include extension appearance, language, Home and social settings, currency preference, pinned games and folders, hidden recommendations, and playtime for every recorded Roblox account. A saved background file or URL is included when present.</p>
          <p class="rc-settings-hint">Import replaces the backed-up settings, pinned games, folders, and playtime histories in this browser; it does not merge them. Playtime remains linked to its original Roblox account and does not become the current account's playtime. Roblox account data, Robux, purchases, and game progress are not included.</p>
          <p class="rc-settings-hint">Only Roblox Customizer JSON backups up to 256 MB can be imported. Live playtime samples and exchange-rate or social-feed caches are not included.</p>
          <div class="rc-backup-actions">
            <button type="button" id="rc-export-backup" class="rc-button rc-button-secondary">Export backup</button>
            <button type="button" id="rc-import-backup" class="rc-button rc-button-secondary">Import backup</button>
          </div>
          <input type="file" id="rc-import-file" accept=".json,application/json" hidden tabindex="-1">
        </section>
        <p id="rc-settings-status" role="status" aria-live="polite"></p>
        <div class="rc-settings-actions">
          <button type="button" id="rc-reset-all" class="rc-button rc-button-danger">Reset All</button>
          <span class="rc-action-spacer"></span>
          <button type="button" id="rc-done" class="rc-button rc-button-primary">Close</button>
        </div>
        <footer class="rc-settings-footer">
          <div class="rc-settings-legal-links">
            <a class="rc-button rc-button-secondary rc-legal-link" data-rc-legal-document="terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
            <a class="rc-button rc-button-secondary rc-legal-link" data-rc-legal-document="privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          </div>
          <span><span>Author:</span> <span translate="no">Shadows_Lunarfox 月狐</span></span>
          <a href="https://github.com/ShadowsLunarfox/Roblox-Customizer" target="_blank" rel="noopener noreferrer">
            <span>GitHub repository</span>
            <span class="rc-settings-repository" translate="no">ShadowsLunarfox/Roblox-Customizer</span>
          </a>
        </footer>
      </div>`;
    document.body.append(modal);
    updateLegalLinks();
    if (enhancementsEnabled()) {
      globalThis.RobloxCustomizerCurrency?.mountSettings(modal.querySelector('#rc-currency-settings'));
      globalThis.RobloxCustomizerPlaytimeUI?.mountSettings(modal.querySelector('#rc-playtime-settings'));
    }
    organizeSettingsCategories();
    // Previously saved URL backgrounds still render, but have no source control.
    const sourceControl = [...modal.querySelectorAll('input[name="rc-source"]')]
      .find(input => input.value === settings.source);
    if (sourceControl) sourceControl.checked = true;
    modal.querySelector('#rc-fit').value = settings.fit;
    modal.querySelector('#rc-dim').value = settings.dim;
    modal.querySelector('#rc-dim-value').value = `${settings.dim}%`;
    modal.querySelector('#rc-glass-blur').value = settings.glassBlur;
    modal.querySelector('#rc-glass-blur-value').value = `${settings.glassBlur}px`;
    modal.querySelector('#rc-glass-opacity').value = settings.glassOpacity;
    modal.querySelector('#rc-glass-opacity-value').value = `${settings.glassOpacity}%`;
    for (const control of HOME_VISIBILITY) modal.querySelector(`#${control.id}`).checked = settings[control.key] === true;
    for (const control of FEED_VISIBILITY) modal.querySelector(`#${control.id}`).checked = settings[control.key] === true;
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
    modal.querySelector('#rc-ui-language').value = settings.uiLanguage;
    modal.querySelector('#rc-ui-language').addEventListener('change', event => {
      changeSettings({ ...settings, uiLanguage: event.target.value }, true);
    });
    modal.querySelector('#rc-current-file').textContent = settings.fileName ? `Current file: ${settings.fileName}` : '';
    refreshSourceControls();
    refreshEffectControls();
    refreshColorControls();
    if (backgroundError) setStatus(backgroundError, true);
    modal.querySelector('#rc-export-backup').addEventListener('click', exportBackup);
    modal.querySelector('#rc-import-backup').addEventListener('click', () => modal.querySelector('#rc-import-file').click());
    modal.querySelector('#rc-import-file').addEventListener('change', event => {
      const file = event.target.files[0];
      event.target.value = '';
      void prepareImportBackup(file);
    });

    modal.querySelectorAll('input[name="rc-source"]').forEach(input => input.addEventListener('change', () => {
      ++mediaSelection;
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
      }
    }));
    modal.querySelector('#rc-file').addEventListener('change', event => {
      const file = event.target.files[0];
      if (file) modal.querySelector('#rc-current-file').textContent = `Selected file: ${file.name}`;
      modal.querySelector('input[name="rc-source"][value="file"]').checked = true;
      refreshSourceControls();
      mediaTask = applyFileSelection(file);
    });
    modal.querySelector('#rc-fit').addEventListener('change', event => {
      changeSettings({ ...settings, fit: event.target.value }, true);
    });
    modal.querySelector('#rc-dim').addEventListener('input', event => {
      modal.querySelector('#rc-dim-value').value = `${event.target.value}%`;
      changeAppearance('dim', Number(event.target.value));
    });
    modal.querySelector('#rc-glass-blur').addEventListener('input', event => {
      modal.querySelector('#rc-glass-blur-value').value = `${event.target.value}px`;
      changeAppearance('glassBlur', Number(event.target.value));
    });
    modal.querySelector('#rc-glass-opacity').addEventListener('input', event => {
      modal.querySelector('#rc-glass-opacity-value').value = `${event.target.value}%`;
      changeAppearance('glassOpacity', Number(event.target.value));
    });
    for (const [id, key] of [['dim', 'dim'], ['glass-blur', 'glassBlur'], ['glass-opacity', 'glassOpacity']]) {
      modal.querySelector(`#rc-${id}`).addEventListener('change', event => {
        changeAppearance(key, Number(event.target.value), true);
      });
    }
    for (const [id, key] of [['transparency', 'disableTransparency'], ['blur', 'disableBlur']]) {
      modal.querySelector(`#rc-disable-${id}`).addEventListener('click', () => {
        changeSettings({ ...settings, [key]: !settings[key] }, true);
      });
    }
    modal.querySelector('#rc-custom-colors-enabled').addEventListener('change', event => {
      changeSettings({ ...settings, experimentalCustomColors: event.target.checked }, true);
    });
    for (const [id, key] of [['text', 'customTextColor'], ['background', 'customBackgroundColor'], ['accent', 'customAccentColor']]) {
      const input = modal.querySelector(`#rc-custom-${id}-color`);
      const update = immediate => {
        if (!settings.experimentalCustomColors) return;
        modal.querySelector(`#rc-custom-${id}-value`).value = input.value.toUpperCase();
        changeAppearance(key, input.value, immediate);
      };
      input.addEventListener('input', () => update(false));
      input.addEventListener('change', () => update(true));
    }
    modal.querySelector('#rc-reset-colors').addEventListener('click', () => {
      changeSettings({ ...settings, experimentalCustomColors: false,
        customTextColor: DEFAULTS.customTextColor, customBackgroundColor: DEFAULTS.customBackgroundColor,
        customAccentColor: DEFAULTS.customAccentColor }, true);
    });
    for (const control of HOME_VISIBILITY) {
      modal.querySelector(`#${control.id}`).addEventListener('change', event => {
        changeSettings({ ...settings, [control.key]: event.target.checked }, true);
      });
    }
    for (const control of FEED_VISIBILITY) {
      modal.querySelector(`#${control.id}`).addEventListener('change', event => {
        changeSettings({ ...settings, [control.key]: event.target.checked }, true);
      });
    }
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
    modal.querySelector('#rc-reset-all').addEventListener('click', confirmResetAll);
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(modal.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled)'))
        .filter(node => node.getClientRects().length && !node.closest('[hidden]'));
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    if (!enhancementsEnabled()) {
      for (const node of modal.querySelectorAll('.rc-settings-glass, #rc-settings-category-home, #rc-settings-category-social, #rc-settings-category-currency, #rc-settings-category-data, #rc-reset-all, .rc-action-spacer')) {
        node.hidden = true;
        for (const input of node.querySelectorAll('input, select, button')) input.disabled = true;
      }
      for (const button of modal.querySelectorAll('.rc-settings-nav-button')) {
        button.hidden = button.dataset.rcSettingsCategory !== 'appearance';
      }
      modal.querySelector('#rc-reset-all').disabled = true;
      modal.querySelector('#rc-file').accept = 'image/*';
      modal.querySelector('.rc-settings-nav-button[data-rc-settings-category="appearance"]').click();
      modal.querySelector('.rc-settings-intro').hidden = true;
      const notice = modal.querySelector('#rc-settings-language-notice');
      notice.hidden = false;
      globalThis.RobloxCustomizerI18n?.localize(notice);
    }
    modal.querySelector('#rc-close').focus();
    globalThis.RobloxCustomizerLanguageWarning?.onOpen();
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
    const sourceControl = [...(modal?.querySelectorAll('input[name="rc-source"]') || [])]
      .find(input => input.value === settings.source);
    if (sourceControl) sourceControl.checked = true;
    if (modal) refreshSourceControls();
    applyCurrentSettings();
  });

  const HOME_CONTENT_SELECTOR = '#HomeContainer, .home-container, [data-testid="home-page"], main';
  const FLOATING_UI_SELECTOR = '.friend-tile-dropdown, .popover, .tooltip, [role="tooltip"], [role="menu"], '
    + '[data-radix-popper-content-wrapper], [data-popper-placement]';
  const SETTINGS_MENU_SELECTOR = '#navbar-settings, #settings-popover-menu, #navbar-robux, '
    + '#buy-robux-popover-menu, #robux-popover-menu, [data-rc-header-menu], '
    + 'a[href*="/my/account"], a[href*="/settings"], a[href*="/transactions"], a[href*="/redeem"]';
  function homeContentMutation(record) {
    if (!/^\/home\/?$/i.test(location.pathname)) return false;
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (target?.closest(`#rc-home-greeting, #rc-settings-overlay, #rc-pinned-games, ${FLOATING_UI_SELECTOR}`)) return false;
    if (record.type !== 'childList') return !!target?.closest(HOME_CONTENT_SELECTOR)
      && !!(homeSectionKind(record.oldValue) || homeSectionKind(target.getAttribute('aria-label'))
        || homeSectionKind(target.textContent));
    const nodes = [...record.addedNodes, ...record.removedNodes];
    if (nodes.length && nodes.every(node => node instanceof Element && node.matches(FLOATING_UI_SELECTOR))) return false;
    if (target?.closest(HOME_CONTENT_SELECTOR)) return true;
    return nodes.some(node => node instanceof Element
      && (node.matches(HOME_CONTENT_SELECTOR) || node.querySelector(HOME_CONTENT_SELECTOR)));
  }
  function settingsMenuMutation(record) {
    const target = record.target instanceof Element ? record.target : record.target.parentElement;
    if (target?.closest('#rc-settings-overlay, .rc-settings-menu-entry')) return false;
    if (target?.closest(SETTINGS_MENU_SELECTOR)) return true;
    const nodes = record.type === 'childList' ? record.addedNodes : [target];
    return [...nodes].some(node => {
      if (!(node instanceof Element)) return false;
      if (node.matches(SETTINGS_MENU_SELECTOR) || node.querySelector(SETTINGS_MENU_SELECTOR)) return true;
      const buttons = [...(node.matches('button, [role="menuitem"]') ? [node] : []), ...node.querySelectorAll('button, [role="menuitem"]')];
      return buttons.some(button => {
        const label = button.textContent.trim();
        return /^settings$/i.test(label) || globalThis.RobloxCustomizerNativeLabels?.matches('settings', label);
      });
    });
  }
  let observedHomePath = location.pathname;
  new MutationObserver(records => {
    if (document.body && (backgroundPending || backgroundLayer && !backgroundLayer.isConnected)) {
      void applyBackground();
    }
    const outsideGreeting = records.filter(record =>
      !(record.target instanceof Element && record.target.closest('#rc-home-greeting')));
    const routeChanged = observedHomePath !== location.pathname;
    observedHomePath = location.pathname;
    if (routeChanged || outsideGreeting.some(homeContentMutation)) queueHomeSync();
    if (outsideGreeting.some(record => record.type === 'childList' || record.type === 'attributes')) {
      if (routeChanged || outsideGreeting.some(settingsMenuMutation)) queueMenuSync();
      syncFrostPage();
    }
  }).observe(document, { childList: true, subtree: true, characterData: true, characterDataOldValue: true,
    attributes: true, attributeOldValue: true, attributeFilter: ['aria-label'] });
  queueMenuSync();

  globalThis.RobloxCustomizerRuntime?.onResume(() => {
    syncFrostPage();
    queueHomeSync();
    queueMenuSync();
    scheduleHomeGreetingTick();
    if (!document.getElementById('rc-background-layer')) void applyBackground();
  });
  globalThis.RobloxCustomizerI18n?.onChange(updateHomeGreeting);
  globalThis.RobloxCustomizerI18n?.onChange(updateLegalLinks);
  globalThis.RobloxCustomizerCompatibility?.onBeforeReload(() => persistTimer ? flushSettingsSave() : saveQueue);
  chrome.runtime.onMessage?.addListener((message, sender) => {
    if (message?.type === 'rc-open-settings' && sender.id === chrome.runtime.id) openModal();
  });
  document.addEventListener('rc-compatibility-changed', () => {
    applyCurrentSettings();
    scheduleHomeGreetingTick();
    if (modalOpeningPending && !globalThis.RobloxCustomizerCompatibility?.reloading()) setTimeout(openModal, 0);
  });
  document.addEventListener('DOMContentLoaded', () => { if (modalOpeningPending) openModal(); }, { once: true });

  chrome.storage.local.get(STORAGE_KEY).then(result => {
    if (settingsChanged) return;
    settings = currentSettings(result[STORAGE_KEY]);
    applyCurrentSettings();
  }).catch(error => {
    applyCurrentSettings();
    console.warn('Roblox Customizer: Could not load background settings.', error);
  });
})();
