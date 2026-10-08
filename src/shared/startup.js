(() => {
  'use strict';

  const CACHE_KEY = 'roblox-customizer-visuals-v1';
  const FROST_ROUTES = [
    [/^\/catalog(?:\/|$)/i, 'catalog'],
    [/^\/bundles\/\d+(?:\/|$)/i, 'catalog'],
    [/^\/users\/\d+\/profile(?:\/|$)/i, 'profile'],
    [/^\/plus(?:\/|$)/i, 'plus'],
    [/^\/my\/messages(?:\/|$)/i, 'messages'],
    [/^\/my\/account\/?$/i, 'account-settings'],
    [/^\/users\/(?:\d+\/)?friends(?:\/|$)/i, 'friends'],
    [/^\/my\/avatar(?:\/|$)/i, 'avatar'],
    [/^\/users\/(?:\d+\/)?inventory(?:\/|$)/i, 'inventory'],
    [/^\/trades(?:\/|$)/i, 'trades'],
    [/^\/transactions\/?$/i, 'transactions'],
    [/^\/report-abuse\/?$/i, 'report-abuse'],
    [/^\/upgrades\/robux\/?$/i, 'robux'],
    [/^\/search\/(?:communities|groups)\/?$/i, 'community-search'],
    [/^\/(?:communities|groups)\/create\/?$/i, 'community-create'],
    [/^\/(?:communities|groups)\/\d+(?:\/|$)/i, 'community'],
    [/^\/charts(?:\/|$)/i, 'charts']
  ];
  let route = null;
  let preferencesReady = false;
  let avatarReady = false;
  let fallbackTimer = 0;
  let cachedVisuals = null;
  let visualRoot = null;

  const bounded = (value, minimum, maximum, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
  };

  function applyVisuals(visuals) {
    const root = document.documentElement;
    if (!root || !visuals) return;
    const opacity = bounded(visuals.glassOpacity, 25, 90, 62);
    root.style.setProperty('--rc-glass-blur', `${bounded(visuals.glassBlur, 0, 40, 18)}px`);
    root.style.setProperty('--rc-glass-opacity', String(opacity / 100));
    root.style.setProperty('--rc-page-panel-opacity', String(opacity / 200));
    root.toggleAttribute('data-rc-background-active', visuals.backgroundActive === true);
    root.removeAttribute('data-rc-hide-recommended');
    for (const part of ['Upper', 'Lower']) {
      const value = visuals[`hideRecommended${part}`];
      root.toggleAttribute(`data-rc-hide-recommended-${part.toLowerCase()}`,
        typeof value === 'boolean' ? value : visuals.hideRecommended === true);
    }
    root.toggleAttribute('data-rc-hide-favorites', visuals.hideFavorites === true);
    root.toggleAttribute('data-rc-hide-standout-games', visuals.hideStandoutGames === true);
  }

  function revealAvatar() {
    if (route !== 'avatar' || !preferencesReady || !avatarReady) return;
    clearTimeout(fallbackTimer);
    fallbackTimer = 0;
    document.documentElement?.setAttribute('data-rc-avatar-boot', 'ready');
  }

  function armFallback() {
    if (route !== 'avatar' || fallbackTimer
      || document.documentElement?.getAttribute('data-rc-avatar-boot') !== 'pending') return;
    // Start the deadline after page content exists, so a slow Roblox response
    // does not expose the unfinished layout before it can be styled.
    if (document.readyState === 'loading'
      && !document.querySelector('#avatar-container, #avatar-editor, .avatar-editor-container, #avatar-preview, .avatar-preview-container')) return;
    fallbackTimer = setTimeout(() => {
      fallbackTimer = 0;
      if (route === 'avatar') document.documentElement?.setAttribute('data-rc-avatar-boot', 'fallback');
    }, 1800);
  }

  function syncRoute() {
    const root = document.documentElement;
    if (!root) return;
    if (visualRoot !== root) {
      applyVisuals(cachedVisuals);
      visualRoot = root;
    }
    const next = FROST_ROUTES.find(([pattern]) => pattern.test(location.pathname))?.[1] || '';
    if (next) {
      if (root.dataset.rcFrostPage !== next) root.dataset.rcFrostPage = next;
    } else if (root.hasAttribute('data-rc-frost-page')) root.removeAttribute('data-rc-frost-page');
    if (route !== next) {
      route = next;
      avatarReady = false;
      clearTimeout(fallbackTimer);
      fallbackTimer = 0;
      if (next === 'avatar') root.setAttribute('data-rc-avatar-boot', 'pending');
      else root.removeAttribute('data-rc-avatar-boot');
      root.removeAttribute('data-rc-profile-boot');
    }
    armFallback();
  }

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached?.version === 1) cachedVisuals = cached;
  } catch { /* Storage can be unavailable; extension storage remains authoritative. */ }

  globalThis.RobloxCustomizerStartup = {
    syncRoute,
    setPreferences(settings) {
      // Cache only appearance flags and numbers, never media URLs or file data.
      cachedVisuals = {
        version: 1,
        glassBlur: bounded(settings.glassBlur, 0, 40, 18),
        glassOpacity: bounded(settings.glassOpacity, 25, 90, 62),
        backgroundActive: (settings.source === 'url' && !!settings.url)
          || (settings.source === 'file' && !!settings.fileKey),
        hideRecommendedUpper: typeof settings.hideRecommendedUpper === 'boolean'
          ? settings.hideRecommendedUpper : settings.hideRecommended === true,
        hideRecommendedLower: typeof settings.hideRecommendedLower === 'boolean'
          ? settings.hideRecommendedLower : settings.hideRecommended === true,
        hideFavorites: settings.hideFavorites === true,
        hideStandoutGames: settings.hideStandoutGames === true
      };
      applyVisuals(cachedVisuals);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(cachedVisuals)); } catch { /* Optional cache. */ }
      preferencesReady = true;
      revealAvatar();
    },
    avatarReady() {
      syncRoute();
      avatarReady = true;
      revealAvatar();
    }
  };

  syncRoute();
  applyVisuals(cachedVisuals);
  // The bootstrap runs before the other content scripts and before first paint.
  // This also covers navigation inside Roblox without a full document reload.
  new MutationObserver(() => {
    syncRoute();
  }).observe(document, { childList: true, subtree: true });
  addEventListener('popstate', syncRoute);
  addEventListener('hashchange', syncRoute);
  addEventListener('load', syncRoute, { once: true });
  document.addEventListener('DOMContentLoaded', syncRoute, { once: true });
})();
