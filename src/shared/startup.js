(() => {
  'use strict';

  const CACHE_KEY = 'roblox-customizer-visuals-v1';
  const FROST_ROUTES = [
    [/^\/catalog(?:\/|$)/i, 'catalog'],
    [/^\/bundles\/\d+(?:\/|$)/i, 'catalog'],
    [/^\/game-pass\/\d+(?:\/|$)/i, 'game-pass'],
    [/^\/badges\/\d+(?:\/|$)/i, 'badge'],
    [/^\/private-server\/configure(?:\/\d+)?\/?$/i, 'private-server-configure'],
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
    [/^\/discover\/?$/i, 'game-search'],
    [/^\/search\/users\/?$/i, 'user-search'],
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
  let storedVisuals = '';
  let visualRoot = null;
  let gameHeader = null;
  let gameMedia = null;
  let gameActions = null;
  let gameTitle = null;
  let gameButtons = null;

  const bounded = (value, minimum, maximum, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
  };

  function colorPreferences(settings) {
    const color = (value, fallback) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? value.toLowerCase() : fallback;
    return {
      experimentalCustomColors: settings.experimentalCustomColors === true,
      customTextColor: color(settings.customTextColor, '#f4f6fb'),
      customBackgroundColor: color(settings.customBackgroundColor, '#14161c'),
      customAccentColor: color(settings.customAccentColor, '#335fff')
    };
  }

  function applyCustomColors(root, settings) {
    const colors = colorPreferences(settings);
    const enabled = colors.experimentalCustomColors;
    const rgb = hex => hex.slice(1).match(/../g).map(channel => parseInt(channel, 16));
    const mix = (first, second, amount) => `#${first.map((channel, i) =>
      Math.round(channel * amount + second[i] * (1 - amount)).toString(16).padStart(2, '0')).join('')}`;
    const luminance = channels => channels.map(channel => channel / 255)
      .map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4)
      .reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i], 0);
    const text = rgb(colors.customTextColor);
    const background = rgb(colors.customBackgroundColor);
    const accent = rgb(colors.customAccentColor);
    const accentLuminance = luminance(accent);
    const accentText = (accentLuminance + .05) / .05 >= 1.05 / (accentLuminance + .05)
      ? '#000000' : '#ffffff';
    const lightBackground = luminance(background) > .45;
    const properties = {
      '--rc-custom-text': colors.customTextColor,
      '--rc-custom-text-secondary': mix(text, background, .85),
      '--rc-custom-text-muted': mix(text, background, .75),
      '--rc-custom-text-rgb': text.join(' '),
      '--rc-custom-background': colors.customBackgroundColor,
      '--rc-custom-background-rgb': background.join(' '),
      '--rc-custom-control-bg': mix(text, background, .08),
      '--rc-custom-control-hover': mix(text, background, .15),
      '--rc-custom-control-border': mix(text, background, .5),
      '--rc-custom-accent': colors.customAccentColor,
      '--rc-custom-accent-text': accentText,
      '--rc-custom-accent-hover': mix(accentText === '#ffffff' ? [0, 0, 0] : [255, 255, 255], accent, .12),
      '--rc-custom-color-scheme': lightBackground ? 'light' : 'dark',
      '--rc-custom-surface-floor': lightBackground ? '.82' : '0'
    };
    root.toggleAttribute('data-rc-custom-colors', enabled);
    for (const [name, value] of Object.entries(properties)) {
      const next = enabled ? value : '';
      if (root.style.getPropertyValue?.(name) !== next) root.style.setProperty(name, next);
    }
  }

  function feedPreferences(settings) {
    const preferences = {};
    for (const page of ['Game', 'Community', 'Profile']) {
      for (const platform of ['X', 'YouTube']) {
        const key = `show${page}${platform}Feed`;
        preferences[key] = typeof settings[key] === 'boolean' ? settings[key] : settings[`hide${platform}Feed`] !== true;
      }
    }
    return preferences;
  }

  function applyVisuals(visuals) {
    const root = document.documentElement;
    if (!root || !visuals) return;
    if (globalThis.RobloxCustomizerCompatibility && !globalThis.RobloxCustomizerCompatibility.enabled()) {
      applyCustomColors(root, visuals);
      return;
    }
    const opacity = bounded(visuals.glassOpacity, 25, 90, 62);
    const disableTransparency = visuals.disableTransparency === true;
    const disableBlur = visuals.disableBlur === true;
    root.toggleAttribute('data-rc-disable-transparency', disableTransparency);
    root.toggleAttribute('data-rc-disable-blur', disableBlur);
    root.style.setProperty('--rc-glass-blur', disableBlur ? '0px' : `${bounded(visuals.glassBlur, 0, 40, 18)}px`);
    root.style.setProperty('--rc-glass-opacity', disableTransparency ? '1' : String(opacity / 100));
    root.style.setProperty('--rc-page-panel-opacity', disableTransparency ? '1' : String(opacity / 200));
    applyCustomColors(root, visuals);
    root.toggleAttribute('data-rc-background-active', visuals.backgroundActive === true);
    root.removeAttribute('data-rc-hide-recommended');
    for (const part of ['Upper', 'Lower']) {
      const value = visuals[`hideRecommended${part}`];
      root.toggleAttribute(`data-rc-hide-recommended-${part.toLowerCase()}`,
        typeof value === 'boolean' ? value : visuals.hideRecommended === true);
    }
    root.toggleAttribute('data-rc-hide-favorites', visuals.hideFavorites === true);
    root.toggleAttribute('data-rc-hide-standout-games', visuals.hideStandoutGames === true);
    const feeds = feedPreferences(visuals);
    for (const page of ['Game', 'Community', 'Profile']) {
      for (const platform of ['X', 'YouTube']) {
        root.toggleAttribute(`data-rc-hide-${page.toLowerCase()}-${platform.toLowerCase()}-feed`, !feeds[`show${page}${platform}Feed`]);
      }
    }
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

  function syncGameHeader() {
    // Native mounts determine this structure. Keep it out of relational CSS
    // selectors that must be reconsidered whenever an unrelated portal changes.
    if (gameHeader?.isConnected && gameMedia?.parentElement === gameHeader
      && gameActions?.parentElement === gameHeader && gameTitle?.parentElement === gameActions
      && gameButtons?.parentElement === gameActions) return;
    const media = document.querySelector('#game-details-carousel-container');
    const header = media?.parentElement?.matches('#game-detail-page .game-main-content')
      ? media.parentElement : null;
    if (gameHeader && gameHeader !== header) {
      gameHeader.removeAttribute('data-rc-game-header');
      gameHeader.removeAttribute('data-rc-game-header-split');
      gameActions?.removeAttribute('data-rc-game-actions');
    }
    gameHeader = header; gameMedia = media;
    if (!header) { gameActions = gameTitle = gameButtons = null; return; }
    gameActions?.removeAttribute('data-rc-game-actions');
    gameActions = header.querySelector(':scope > .game-calls-to-action');
    gameTitle = gameActions?.querySelector(':scope > .game-title-container');
    gameButtons = gameActions?.querySelector(':scope > .game-buttons-container');
    const split = !!(gameTitle && gameButtons);
    header.toggleAttribute('data-rc-game-header', true);
    header.toggleAttribute('data-rc-game-header-split', split);
    gameActions?.toggleAttribute('data-rc-game-actions', split);
  }

  function syncRoute() {
    const root = document.documentElement;
    if (!root) return;
    if (globalThis.RobloxCustomizerCompatibility && !globalThis.RobloxCustomizerCompatibility.enabled()) {
      for (const attribute of [...root.attributes]) {
        if (/^data-rc-(?:ui-active|frost-page|home-friends|hide-|avatar-boot|profile-boot|disable-)/.test(attribute.name)) {
          root.removeAttribute(attribute.name);
        }
      }
      applyVisuals(cachedVisuals);
      return;
    }
    syncGameHeader();
    root.toggleAttribute('data-rc-home-friends',
      !!document.querySelector('#HomeContainer .friend-carousel-container'));
    // Interface features are available with Roblox's default background too.
    if (!root.hasAttribute('data-rc-ui-active')) root.setAttribute('data-rc-ui-active', '');
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
    if (cached?.version === 1) {
      cachedVisuals = cached;
      storedVisuals = JSON.stringify(cached);
    }
  } catch { /* Storage can be unavailable; extension storage remains authoritative. */ }

  globalThis.RobloxCustomizerStartup = {
    syncRoute,
    setPreferences(settings) {
      // Cache only appearance flags, numbers and validated colors, never media data.
      cachedVisuals = {
        version: 1,
        glassBlur: bounded(settings.glassBlur, 0, 40, 18),
        glassOpacity: bounded(settings.glassOpacity, 25, 90, 62),
        disableTransparency: settings.disableTransparency === true,
        disableBlur: settings.disableBlur === true,
        backgroundActive: (settings.source === 'url' && !!settings.url)
          || (settings.source === 'file' && !!settings.fileKey),
        hideRecommendedUpper: typeof settings.hideRecommendedUpper === 'boolean'
          ? settings.hideRecommendedUpper : settings.hideRecommended === true,
        hideRecommendedLower: typeof settings.hideRecommendedLower === 'boolean'
          ? settings.hideRecommendedLower : settings.hideRecommended === true,
        hideFavorites: settings.hideFavorites === true,
        hideStandoutGames: settings.hideStandoutGames === true,
        ...colorPreferences(settings),
        ...feedPreferences(settings)
      };
      applyVisuals(cachedVisuals);
      const serialized = JSON.stringify(cachedVisuals);
      if (serialized !== storedVisuals) {
        try {
          localStorage.setItem(CACHE_KEY, serialized);
          storedVisuals = serialized;
        } catch { /* Optional cache. */ }
      }
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
  globalThis.RobloxCustomizerRuntime?.onResume(syncRoute);
  addEventListener('load', syncRoute, { once: true });
  document.addEventListener('DOMContentLoaded', syncRoute, { once: true });
  document.addEventListener('rc-compatibility-changed', syncRoute);
})();
