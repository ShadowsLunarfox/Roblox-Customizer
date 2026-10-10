(() => {
  'use strict';

  const sendMessage = globalThis.RobloxCustomizerRuntime?.sendMessage
    || ((...args) => chrome.runtime.sendMessage(...args));

  const PROFILE_ROOT = '#profile-container, .profile-container, [data-testid="profile-page"]';
  const MAIN_ROOT = '#content, #container-main, main, [role="main"]';
  const OWNED = '#rc-profile-enhancements, #rc-profile-socials, #rc-profile-intro, #rc-profile-inline-about, #rc-profile-details, #rc-profile-limiteds, #rc-profile-social-feeds, #rc-x-feed-panel, #rc-youtube-feed-panel';
  const HEADINGS = 'h2, h3, h4, [role="heading"], .container-header, .section-title, [class*="text-heading"]';
  let syncTimer = 0;
  let syncDeadline = 0;
  let observedRoot = null;
  let observedUserId = 0;
  let requestedUserId = 0;
  let placementRoot = null;
  let placementDeadline = 0;
  let placementTimer = 0;
  const sectionContainers = new WeakMap();
  const gridParents = new WeakMap();
  const summaryInlineStyles = new WeakMap();
  const profileAboutData = new WeakMap();
  const clickedAboutTabs = new WeakSet();
  const limitedViews = new WeakMap();
  const numberFormat = new Intl.NumberFormat('en-US');
  const layoutObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => queueSync()) : null;
  let layoutTargets = [];

  function watchLayout(...elements) {
    if (!layoutObserver) return;
    const targets = [...new Set(elements.filter(Boolean))];
    if (targets.length === layoutTargets.length
      && targets.every((element, index) => element === layoutTargets[index])) return;
    layoutObserver.disconnect();
    layoutTargets = targets;
    for (const element of targets) layoutObserver.observe(element);
  }

  function clearIdentityBackdrop() {
    document.querySelector('#rc-profile-identity-backdrop')?.remove();
    for (const element of document.querySelectorAll('[data-rc-profile-glass-shell]')) {
      element.removeAttribute('data-rc-profile-glass-shell');
    }
  }

  function syncIdentityBackdrop(root, banner, heading, follower) {
    if (!banner || !heading) {
      clearIdentityBackdrop();
      return;
    }
    // The name, stats and avatar viewer need not share a dedicated Roblox
    // wrapper. Place a real backdrop behind their measured area instead of
    // relying on a particular profile-header class or wrapper height.
    let shell = heading.parentElement;
    while (shell && shell !== root && (!shell.contains(banner)
      || (follower && !shell.contains(follower)))) {
      shell = shell.parentElement;
    }
    if (!shell || shell === document.body || shell === document.documentElement) shell = root;
    const bannerRect = banner.getBoundingClientRect();
    const headingRect = heading.getBoundingClientRect();
    const followerRect = follower?.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    if (bannerRect.width < 300 || bannerRect.height < 150 || !shellRect.width) {
      clearIdentityBackdrop();
      return;
    }
    const nextPanelTop = [...root.querySelectorAll('[data-rc-profile-section], #rc-profile-enhancements')]
      .map(element => element.getBoundingClientRect().top)
      .filter(top => top > bannerRect.bottom + 80)
      .sort((a, b) => a - b)[0];
    const wantedBottom = Math.max(bannerRect.bottom + 205, headingRect.bottom + 125,
      (followerRect?.bottom || headingRect.bottom) + 55);
    const bottom = nextPanelTop ? Math.min(wantedBottom, nextPanelTop - 12) : wantedBottom;
    const top = bannerRect.bottom - 12;
    const height = Math.max(125, Math.min(330, bottom - top));
    let backdrop = document.querySelector('#rc-profile-identity-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'rc-profile-identity-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
    }
    if (backdrop.parentElement !== shell) {
      for (const element of document.querySelectorAll('[data-rc-profile-glass-shell]')) {
        element.removeAttribute('data-rc-profile-glass-shell');
      }
      shell.prepend(backdrop);
    }
    shell.setAttribute('data-rc-profile-glass-shell', '');
    backdrop.style.left = `${bannerRect.left - shellRect.left}px`;
    backdrop.style.top = `${top - shellRect.top}px`;
    backdrop.style.width = `${bannerRect.width}px`;
    backdrop.style.height = `${height}px`;
  }

  function currentUserId() {
    const id = Number(location.pathname.match(/^\/users\/(\d+)\/profile(?:\/|$)/i)?.[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
  }

  function fallbackProfileRoot() {
    // A selector list uses document order, so #container-main would win over
    // its inner #content and incorrectly include the entire page width.
    return document.querySelector('#content') || document.querySelector(MAIN_ROOT);
  }

  function sectionName(text) {
    const localized = globalThis.RobloxCustomizerNativeLabels?.classify('profile', text);
    if (localized) return localized;
    const label = text.replace(/\s+/g, ' ').trim()
      .replace(/(?:\s*(?:See All|View All|[\u203a>\u2192]))+\s*$/i, '');
    if (/^Currently Wearing$/i.test(label)) return 'wearing';
    if (/^Store$/i.test(label)) return 'store';
    if (/^Experiences$/i.test(label)) return 'experiences';
    if (/^Favorites$/i.test(label)) return 'favorites';
    if (/^Collections$/i.test(label)) return 'collections';
    if (/^Friends(?:\s*\([\d,]+\))?$/i.test(label)) return 'friends';
    if (/^Communities$/i.test(label)) return 'communities';
    if (/^Badges?$/i.test(label)) return 'badges';
    return '';
  }

  function findSection(heading, root, headings) {
    // Images and carousel children arrive in batches. Their count must never
    // determine which ancestor receives padding or becomes the page grid.
    const isBoundary = element => element !== root && root.contains(element)
      && !element.matches(`${PROFILE_ROOT}, ${MAIN_ROOT}, ${OWNED}`)
      && !element.querySelector('h1')
      && !headings.some(other => other !== heading && element.contains(other));
    const cached = sectionContainers.get(heading);
    if (cached?.contains(heading) && isBoundary(cached)) return cached;
    const explicit = heading.closest('section, .section-container, .profile-section');
    let section = explicit && isBoundary(explicit) ? explicit : null;
    if (!section) {
      for (let element = heading.parentElement; element && isBoundary(element); element = element.parentElement) {
        section = element;
      }
    }
    if (section) sectionContainers.set(heading, section);
    return section;
  }

  function markSections(root) {
    const sections = new Map();
    const candidates = [...root.querySelectorAll(HEADINGS)].filter(heading =>
      !heading.closest(OWNED) && heading.textContent.length <= 90 && sectionName(heading.textContent));
    // A .container-header and the h2 inside it describe the same section.
    const headings = candidates.filter(heading => !candidates.some(other =>
      other !== heading && heading.contains(other)));
    for (const heading of headings) {
      const name = sectionName(heading.textContent);
      if (sections.has(name)) continue;
      const section = findSection(heading, root, headings);
      if (!section || section === root || section.contains(root)
        || [...sections.values()].includes(section)) continue;
      if (section.dataset.rcProfileSection !== name) section.dataset.rcProfileSection = name;
      sections.set(name, section);
    }
    const active = new Set(sections.values());
    for (const stale of root.querySelectorAll('[data-rc-profile-section]')) {
      if (!active.has(stale)) delete stale.dataset.rcProfileSection;
    }
    return sections;
  }

  function markFriendsHeader(root, section) {
    const marked = new Set();
    if (section) {
      const heading = [...section.querySelectorAll(HEADINGS)]
        .find(element => sectionName(element.textContent) === 'friends');
      const seeAll = [...section.querySelectorAll('a, button')]
        .find(element => /^See All\s*[\u203a>\u2192]?$/i.test(element.textContent.trim())
          || globalThis.RobloxCustomizerNativeLabels?.matches('seeAll', element.textContent));
      const sectionWidth = section.getBoundingClientRect().width;
      let header = heading;
      while (header && header !== section && seeAll && !header.contains(seeAll)) {
        header = header.parentElement;
      }
      if (header && header !== section) {
        const candidates = [header, ...header.querySelectorAll('div, header, span')];
        for (const element of candidates) {
          const rect = element.getBoundingClientRect();
          if (rect.width >= sectionWidth * .55 && rect.height > 0 && rect.height <= 90) {
            marked.add(element);
          }
        }
      }
      for (let element = heading; element && element !== section; element = element.parentElement) {
        const rect = element.getBoundingClientRect();
        if (rect.width >= sectionWidth * .55 && rect.height > 0 && rect.height <= 90) {
          marked.add(element);
        }
      }
    }
    for (const element of root.querySelectorAll('[data-rc-profile-friends-header]')) {
      if (!marked.has(element)) element.removeAttribute('data-rc-profile-friends-header');
    }
    for (const element of marked) element.setAttribute('data-rc-profile-friends-header', '');
  }

  function markProfileCards(root, sections) {
    const markedCards = new Map();
    const markedThumbnails = new Map();
    const markedMedia = new Set();
    const cardKinds = [
      ['wearing', 'asset', /\/(?:catalog|bundles)\/\d+(?:\/|$)/i],
      ['store', 'asset', /\/(?:catalog|bundles)\/\d+(?:\/|$)/i],
      ['collections', 'asset', /\/(?:catalog|bundles)\/\d+(?:\/|$)/i],
      ['experiences', 'game', /\/games\/\d+(?:\/|$)/i],
      ['favorites', 'game', /\/games\/\d+(?:\/|$)/i],
    ];

    for (const [sectionName, kind, hrefPattern] of cardKinds) {
      const section = sections.get(sectionName);
      if (!section) continue;
      const links = [...section.querySelectorAll('a[href]')]
        .filter(link => hrefPattern.test(link.getAttribute('href') || ''));
      for (const link of links) {
        // Prefer native card boundaries, including when a store has one item.
        // The carousel's measured tile wrapper must retain its own width.
        const nativeCard = link.closest('.item-card, .game-container, .game-card')
          || link.closest('.item-card-container, .game-card-container');
        const hasNativeCard = nativeCard && section.contains(nativeCard);
        let card = hasNativeCard ? nativeCard : link;
        let fallback = link;
        const fallbackWidth = Math.max(220, link.getBoundingClientRect().width * 1.5);
        for (let node = link, depth = 0; !hasNativeCard && node && node !== section && depth < 7;
          node = node.parentElement, depth += 1) {
          const parent = node.parentElement;
          if (!parent || !section.contains(parent)) break;
          const siblingIds = [...parent.children].map(sibling =>
            [sibling, ...sibling.querySelectorAll('a[href]')]
              .map(anchor => (anchor.getAttribute('href') || '').match(hrefPattern)?.[0]?.replace(/\/$/, ''))
              .find(Boolean)).filter(Boolean);
          if (new Set(siblingIds).size >= 2) {
            card = node;
            break;
          }
          if (node !== link && node.getBoundingClientRect().width > fallbackWidth) break;
          fallback = node;
        }
        if (!hasNativeCard && card === link) card = fallback;
        markedCards.set(card, kind);
        const images = [...card.querySelectorAll('img')].sort((a, b) => {
          const rectA = a.getBoundingClientRect();
          const rectB = b.getBoundingClientRect();
          return rectB.width * rectB.height - rectA.width * rectA.height
            || (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight);
        });
        if (images[0]) {
          markedThumbnails.set(images[0], kind);
          const media = images[0].closest('.item-card-thumb-container, .game-card-thumb-container')
            || images[0].closest('.thumbnail-2d-container');
          if (media && card.contains(media)) markedMedia.add(media);
        }
      }
    }

    for (const element of root.querySelectorAll('[data-rc-profile-card]')) {
      if (!markedCards.has(element)) element.removeAttribute('data-rc-profile-card');
    }
    for (const element of root.querySelectorAll('[data-rc-profile-card-thumb]')) {
      if (!markedThumbnails.has(element)) element.removeAttribute('data-rc-profile-card-thumb');
    }
    for (const element of root.querySelectorAll('[data-rc-profile-card-media]')) {
      if (!markedMedia.has(element)) element.removeAttribute('data-rc-profile-card-media');
    }
    for (const [card, kind] of markedCards) card.dataset.rcProfileCard = kind;
    for (const [thumbnail, kind] of markedThumbnails) thumbnail.dataset.rcProfileCardThumb = kind;
    for (const media of markedMedia) media.setAttribute('data-rc-profile-card-media', '');

    const cardSections = cardKinds.map(([name]) => sections.get(name)).filter(Boolean);
    const cardsBySection = new Map(cardSections.map(section => [
      section, [...markedCards.keys()].filter(card => section.contains(card))
    ]));
    for (const section of root.querySelectorAll('[data-rc-profile-card-count]')) {
      if (!cardsBySection.has(section)) section.removeAttribute('data-rc-profile-card-count');
    }
    for (const [section, cards] of cardsBySection) {
      const count = String(cards.length);
      if (section.dataset.rcProfileCardCount !== count) section.dataset.rcProfileCardCount = count;
    }
    // Align cards within each section; a long title in one carousel should not
    // add empty space to the store or experiences farther down the page.
    for (const section of cardSections) section.style.removeProperty('--rc-profile-card-height');
    for (const [section, cards] of cardsBySection) {
      if (!cards.length) continue;
      const height = Math.ceil(Math.max(200, ...cards.map(card => Math.max(
        card.scrollHeight, card.getBoundingClientRect().height))));
      section.style.setProperty('--rc-profile-card-height', `${height}px`);
    }
  }

  function findGridParent(sections) {
    const counts = new Map();
    for (const section of sections.values()) {
      const parent = section.parentElement;
      if (parent) counts.set(parent, (counts.get(parent) || 0) + 1);
    }
    const [parent, count] = [...counts].sort((a, b) => b[1] - a[1])[0] || [];
    return count >= 3 ? parent : null;
  }

  function markProfileHeader(root) {
    const heading = [...root.querySelectorAll('h1, #profile-header-title-container-name')].find(element =>
      !element.closest(OWNED) && element.textContent.trim());
    const toggle = [...root.querySelectorAll('button, [role="button"]')].find(element =>
      /^(?:2D|3D)$/i.test(element.textContent.trim()));
    const rootWidth = root.getBoundingClientRect().width;
    if (!rootWidth) return;
    const minBannerWidth = Math.min(680, Math.max(300, rootWidth * .35));

    let banner = null;
    for (let element = toggle?.parentElement; element && element !== root; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if (rect.width >= minBannerWidth && rect.height >= 180 && rect.height <= 500
        && (!heading || !element.contains(heading))) {
        banner = element;
        break;
      }
    }
    if (!banner && heading) {
      const headingTop = heading.getBoundingClientRect().top;
      banner = [...root.querySelectorAll('div, section, article')]
        .filter(element => !element.contains(heading) && !element.closest(OWNED))
        .map(element => [element, element.getBoundingClientRect()])
        .filter(([, rect]) => rect.width >= minBannerWidth
          && rect.height >= 180 && rect.height <= 500
          && rect.bottom >= headingTop - 110 && rect.bottom <= headingTop + 55)
        .sort((a, b) => b[1].width - a[1].width
          || Math.abs(a[1].bottom - headingTop) - Math.abs(b[1].bottom - headingTop))[0]?.[0] || null;
    }

    const follower = root.querySelector('a[href*="/friends#!/followers"]')
      || [...root.querySelectorAll('span, a, div')].find(element =>
      !element.closest(OWNED) && element.childElementCount <= 2
      && (/\bFollowers?\b/i.test(element.textContent)
        || globalThis.RobloxCustomizerNativeLabels?.matches('followers', element.textContent))
      && element.textContent.trim().length < 70);
    watchLayout(root, banner, heading, follower);
    const headerWidth = banner?.getBoundingClientRect().width || rootWidth;
    let summary = root.querySelector('#user-profile-header-bg') || root.querySelector('.user-profile-header');
    for (let element = follower?.parentElement; !summary && element && element !== root; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if (rect.width >= headerWidth * .65 && rect.height >= 100 && rect.height <= 450
        && (!banner || !element.contains(banner))) {
        summary = element;
        break;
      }
    }
    if (!summary) {
      for (let element = heading?.parentElement; element && element !== root; element = element.parentElement) {
        const rect = element.getBoundingClientRect();
        if (rect.width >= headerWidth * .65 && rect.height >= 100 && rect.height <= 450
          && (/\bFollowers?\b/i.test(element.textContent)
            || globalThis.RobloxCustomizerNativeLabels?.matches('followers', element.textContent))
          && (!banner || !element.contains(banner))) {
          summary = element;
          break;
        }
      }
    }
    if (summary) clearIdentityBackdrop();
    else syncIdentityBackdrop(root, banner, heading, follower);

    let hero = null;
    for (let element = banner?.parentElement; element && element !== root; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if ((heading && element.contains(heading) || follower && element.contains(follower)
        || rect.height >= banner.getBoundingClientRect().height + 100)
        && rect.width >= headerWidth * .7
        && rect.height >= 350 && rect.height <= 850) {
        hero = element;
        break;
      }
    }

    const surfaces = new Set();
    if (banner) {
      const bannerRect = banner.getBoundingClientRect();
      for (const element of banner.querySelectorAll('div, section')) {
        const rect = element.getBoundingClientRect();
        if (rect.width < bannerRect.width * .9 || rect.height < bannerRect.height * .85) continue;
        const style = getComputedStyle(element);
        const color = style.backgroundColor;
        const alpha = color === 'transparent' ? 0
          : Number(color.match(/^rgba?\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] ?? 1);
        if (element.hasAttribute('data-rc-profile-banner-surface')
          || alpha >= .7 || /gradient\(/i.test(style.backgroundImage)) surfaces.add(element);
      }
    }

    for (const element of root.querySelectorAll('[data-rc-profile-banner]')) {
      if (element !== banner) element.removeAttribute('data-rc-profile-banner');
    }
    for (const element of root.querySelectorAll('[data-rc-profile-hero]')) {
      if (element !== hero) element.removeAttribute('data-rc-profile-hero');
    }
    for (const element of root.querySelectorAll('[data-rc-profile-summary]')) {
      if (element === summary) continue;
      element.removeAttribute('data-rc-profile-summary');
      const saved = summaryInlineStyles.get(element);
      if (saved) {
        for (const [property, value, priority] of saved) {
          if (value) element.style.setProperty(property, value, priority);
          else element.style.removeProperty(property);
        }
        summaryInlineStyles.delete(element);
      }
    }
    for (const element of root.querySelectorAll('[data-rc-profile-banner-surface]')) {
      if (!surfaces.has(element)) element.removeAttribute('data-rc-profile-banner-surface');
    }
    if (banner && !banner.hasAttribute('data-rc-profile-banner')) banner.setAttribute('data-rc-profile-banner', '');
    if (hero && !hero.hasAttribute('data-rc-profile-hero')) hero.setAttribute('data-rc-profile-hero', '');
    if (summary && !summary.hasAttribute('data-rc-profile-summary')) {
      summary.setAttribute('data-rc-profile-summary', '');
    }
    if (summary) {
      const properties = ['background-color', 'background-image', 'backdrop-filter',
        '-webkit-backdrop-filter', 'border-radius', 'box-shadow'];
      if (!summaryInlineStyles.has(summary)) {
        summaryInlineStyles.set(summary, properties.map(property => [property,
          summary.style.getPropertyValue(property), summary.style.getPropertyPriority(property)]));
      }
      const nestedInHero = !!hero && hero !== summary && hero.contains(summary);
      const panelColor = nestedInHero ? 'transparent'
        : 'rgb(var(--rc-glass-color, 20 22 28) / var(--rc-panel-opacity, var(--rc-page-panel-opacity, .31)))';
      const panelBlur = nestedInHero ? 'none'
        : 'blur(var(--rc-glass-blur, 18px)) saturate(1.2)';
      summary.style.setProperty('background-color', panelColor, 'important');
      summary.style.setProperty('background-image', 'none', 'important');
      summary.style.setProperty('backdrop-filter', panelBlur, 'important');
      summary.style.setProperty('-webkit-backdrop-filter', panelBlur, 'important');
      summary.style.setProperty('border-radius', '14px', 'important');
      summary.style.setProperty('box-shadow', nestedInHero ? 'none'
        : 'inset 0 0 0 1px rgb(var(--rc-foreground-rgb, 255 255 255) / 16%)', 'important');
    }
    for (const element of surfaces) {
      if (!element.hasAttribute('data-rc-profile-banner-surface')) {
        element.setAttribute('data-rc-profile-banner-surface', '');
      }
    }
  }

  function makeDetails() {
    const card = document.createElement('section');
    card.id = 'rc-profile-details';
    card.setAttribute('aria-label', 'Profile details');
    card.innerHTML = '<div class="rc-profile-details-header"><h2>Profile details</h2>'
      + '<button type="button" class="rc-profile-copy-id">Copy ID</button></div>'
      + '<div class="rc-profile-facts" aria-live="polite">Loading account details...</div>'
      + '<nav class="rc-profile-jumps" aria-label="Profile sections"></nav>'
      + '<div class="rc-profile-links"></div>';
    card.querySelector('.rc-profile-copy-id').addEventListener('click', async event => {
      const button = event.currentTarget;
      const id = card.dataset.userId;
      if (!id) return;
      try {
        await navigator.clipboard.writeText(id);
        button.textContent = 'Copied';
        setTimeout(() => { if (button.isConnected) button.textContent = 'Copy ID'; }, 1800);
      } catch { button.textContent = 'Copy failed'; }
    });
    card.querySelector('.rc-profile-jumps').addEventListener('click', event => {
      const button = event.target.closest('button[data-section]');
      if (!button) return;
      document.querySelector(`[data-rc-profile-section="${button.dataset.section}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return card;
  }

  function updateJumps(card, sections) {
    const names = [...sections.keys()];
    const signature = names.join(',');
    const nav = card.querySelector('.rc-profile-jumps');
    if (nav.dataset.names === signature) return;
    nav.dataset.names = signature;
    nav.replaceChildren();
    for (const name of names) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.section = name;
      button.textContent = name === 'wearing' ? 'Currently Wearing'
        : name.charAt(0).toUpperCase() + name.slice(1);
      nav.append(button);
    }
  }

  function addFact(container, label, value, preserveValue = false) {
    const fact = document.createElement('div');
    fact.className = 'rc-profile-fact';
    const title = document.createElement('span');
    title.textContent = label;
    const detail = document.createElement('strong');
    if (preserveValue) detail.setAttribute('data-rc-i18n-ignore', '');
    detail.textContent = value;
    fact.append(title, detail);
    container.append(fact);
    return detail;
  }

  function formatJoinedDate(date) {
    return new Intl.DateTimeFormat(globalThis.RobloxCustomizerI18n?.locale() || 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    }).format(date);
  }

  function hideNativeProfileTabs(root) {
    if (!root) return;
    const label = element => element.textContent.replace(/\s+/g, ' ').trim();
    const controls = [...root.querySelectorAll('a, button, [role="tab"]')]
      .filter(element => !element.closest(OWNED)
        && !element.querySelector('a, button, [role="tab"]'));
    const aboutTabs = controls.filter(element => element.id === 'tab-about' && element.closest('.profile-tabs')
      || label(element) === 'About'
      || globalThis.RobloxCustomizerNativeLabels?.matches('about', label(element)));
    const creationsTabs = controls.filter(element => element.id === 'tab-creations' && element.closest('.profile-tabs')
      || label(element) === 'Creations'
      || globalThis.RobloxCustomizerNativeLabels?.matches('creations', label(element)));
    for (const about of aboutTabs) {
      for (const creations of creationsTabs) {
        let bar = about.parentElement;
        while (bar && bar !== root && !bar.contains(creations)) bar = bar.parentElement;
        if (!bar || bar === root) continue;
        const nativeBar = bar.matches('.profile-tabs') && about.id === 'tab-about' && creations.id === 'tab-creations';
        const aboutLabel = label(about).replace(/\s+/g, '');
        const creationsLabel = label(creations).replace(/\s+/g, '');
        if (!nativeBar && ![aboutLabel + creationsLabel, creationsLabel + aboutLabel]
          .includes(label(bar).replace(/\s+/g, ''))) continue;
        const isTabContainer = element => {
          const children = [...element.children];
          const aboutChild = children.find(child => child.contains(about));
          const creationsChild = children.find(child => child.contains(creations));
          const separateTabs = children.length === 2 && aboutChild && creationsChild
            && aboutChild !== creationsChild;
          const semanticTabs = element.matches('nav, ul, [role="tablist"], '
            + '[class*="tabs" i], [class*="tab-list" i], [class*="tab-bar" i]')
            && element.getBoundingClientRect().height <= 120
            && !element.querySelector('section, article, [role="tabpanel"]');
          return separateTabs || semanticTabs;
        };
        if (!isTabContainer(bar)) continue;
        const creationTab = creations.closest('[role="tab"], li') || creations;
        if (!clickedAboutTabs.has(about)
          && (creations.matches('[aria-selected="true"], [aria-current="page"], .active')
            || creationTab.matches('[aria-selected="true"], [aria-current="page"], .active'))) {
          clickedAboutTabs.add(about);
          about.click();
        }
        for (let parent = bar.parentElement; parent && parent !== root;
          parent = parent.parentElement) {
          if (label(parent) !== label(bar) || parent.getBoundingClientRect().height > 120
            || !isTabContainer(parent)) break;
          bar = parent;
        }
        bar.setAttribute('data-rc-profile-native-tabs', '');
        return;
      }
    }
  }

  function expandNativeDescription(root) {
    if (!root) return null;
    // Current Roblox supplies the full escaped bio in a native pre, including
    // its links. Unclamp that node without depending on a second API request.
    const source = [...root.querySelectorAll('.description-content')].find(element =>
      !element.closest(`${OWNED}, [data-rc-profile-section], [role="dialog"], .modal`));
    if (!source) return null;
    if (!source.hasAttribute('data-rc-profile-native-description')) {
      source.setAttribute('data-rc-profile-native-description', '');
    }
    for (let parent = source.parentElement, depth = 0;
      parent && parent !== root && depth < 4; parent = parent.parentElement, depth++) {
      if (parent.querySelector('h1, h2, h3, img, video, canvas, .profile-tabs, [data-rc-profile-section]')) break;
      if (!parent.hasAttribute('data-rc-profile-native-bio-container')) {
        parent.setAttribute('data-rc-profile-native-bio-container', '');
      }
    }
    return source;
  }

  function findNativeBioBox(root, description = '') {
    if (!root) return null;
    const marked = root.querySelector('[data-rc-profile-inline-about-box]');
    if (marked) return marked;
    const fullText = description.replace(/\s+/g, ' ').trim();
    const rootTop = root.getBoundingClientRect().top;
    for (const trigger of root.querySelectorAll('a, button, [role="button"], span')) {
      if (trigger.closest(`${OWNED}, [data-rc-profile-section], [role="dialog"], .modal`)
        || (!/^(?:more|see more|show more)$/i.test(trigger.textContent.trim())
          && !globalThis.RobloxCustomizerNativeLabels?.matches('more', trigger.textContent))) continue;
      const triggerTop = trigger.getBoundingClientRect().top;
      if (triggerTop < rootTop || triggerTop > rootTop + 1200) continue;
      let box = null;
      for (let parent = trigger.parentElement, depth = 0;
        parent && parent !== root && depth < 6; parent = parent.parentElement, depth++) {
        if (parent.querySelector('h1, h2, h3, img, video, canvas')) break;
        const preview = parent.textContent.replace(/\s*(?:more|see more|show more|更多|查看更多|显示更多|顯示更多)\s*$/i, '')
          .replace(/\s+/g, ' ').trim().replace(/(?:\.{3}|\u2026)$/, '').trim();
        const rect = parent.getBoundingClientRect();
        if (preview.length < 8 || preview.length > 500 || rect.height > 300) continue;
        if (fullText && preview.length >= 12 && !fullText.startsWith(preview.slice(0, 24))) continue;
        if (parent.tagName === 'DIV' && rect.width >= 220) box = parent;
      }
      if (box) return box;
    }
    for (const source of root.querySelectorAll('p, span, div')) {
      if (source.closest(`${OWNED}, [data-rc-profile-section], [role="dialog"], .modal, h1, h2, h3`)) continue;
      if (source.querySelector('h1, h2, h3, img, video, canvas')) continue;
      const text = source.textContent.replace(/\s+/g, ' ').trim();
      if (fullText ? text !== fullText : !/^No bio yet\.?$/i.test(text)
        && !globalThis.RobloxCustomizerNativeLabels?.matches('noBio', text)) continue;
      let box = null;
      for (let parent = source.parentElement, depth = 0;
        parent && parent !== root && depth < 4; parent = parent.parentElement, depth++) {
        if (parent.querySelector('h1, h2, h3, img, video, canvas')
          || parent.textContent.length > text.length + 80) break;
        const rect = parent.getBoundingClientRect();
        if (parent.tagName === 'DIV' && rect.width >= 220 && rect.height <= 300) box = parent;
      }
      if (box) return box;
    }
    return null;
  }

  function bioText(value) {
    return value.replace(/\s+/g, ' ').trim();
  }

  function isTruncatedBio(source, description) {
    const preview = bioText(source.textContent);
    const full = bioText(description);
    if (!/(?:\.{3}|\u2026)$/.test(preview)) return false;
    const prefix = preview.replace(/(?:\.{3}|\u2026)$/, '').trim();
    return prefix.length >= 8 && full !== preview && full.length > prefix.length && full.startsWith(prefix);
  }

  function clearInlineAbout(root) {
    for (const inline of root.querySelectorAll('#rc-profile-inline-about')) inline.remove();
    for (const element of root.querySelectorAll('[data-rc-profile-inline-about-box], [data-rc-profile-native-preview]')) {
      element.removeAttribute('data-rc-profile-inline-about-box');
      element.removeAttribute('data-rc-profile-native-preview');
    }
  }

  function findBioPreview(box, description) {
    const full = bioText(description);
    return [...box.querySelectorAll('.description-content, pre, p, span, div')].find(element => {
      if (element.closest(`${OWNED}, button, [role="button"], [role="dialog"], .modal`)
        || element.querySelector('button, [role="button"], [role="dialog"], h1, h2, h3, img, video, canvas')) return false;
      const text = bioText(element.textContent);
      return full ? text === full || isTruncatedBio(element, description)
        : /^No bio yet\.?$/i.test(text) || globalThis.RobloxCustomizerNativeLabels?.matches('noBio', text);
    });
  }

  function socialProfileUrl(platform, raw) {
    if (typeof raw !== 'string' || !raw.trim() || raw.length > 2048) return '';
    const value = raw.trim();
    const hosts = {
      facebook: ['facebook.com', 'fb.com'], twitter: ['x.com', 'twitter.com'],
      youtube: ['youtube.com', 'youtu.be'], twitch: ['twitch.tv'],
      guilded: ['guilded.gg', 'guilded.com'], discord: ['discord.gg', 'discord.com'],
      tiktok: ['tiktok.com'], instagram: ['instagram.com']
    };
    try {
      const url = new URL(/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ? value : `https://${value}`);
      const host = url.hostname.toLowerCase();
      if (['https:', 'http:'].includes(url.protocol)
        && hosts[platform]?.some(domain => host === domain || host.endsWith(`.${domain}`))) {
        url.protocol = 'https:';
        return url.href;
      }
    } catch { /* A social field may contain a handle. */ }
    if (platform === 'twitter' && /^@?[A-Za-z0-9_]{1,15}$/.test(value)) {
      return `https://x.com/${value.replace(/^@/, '')}`;
    }
    if (platform === 'youtube' && /^@[A-Za-z0-9_.-]{1,80}$/.test(value)) {
      return `https://www.youtube.com/${value}`;
    }
    if (['facebook', 'twitch', 'tiktok', 'instagram'].includes(platform)
      && /^@?[A-Za-z0-9_.-]{1,80}$/.test(value)) {
      const domains = { facebook: 'www.facebook.com', twitch: 'www.twitch.tv',
        tiktok: 'www.tiktok.com', instagram: 'www.instagram.com' };
      const handle = value.replace(/^@/, '');
      return `https://${domains[platform]}/${platform === 'tiktok' ? '@' : ''}${handle}`;
    }
    return '';
  }

  function publishProfileSocialLinks(root, userId, data) {
    if (!root) return;
    const urls = {
      twitter: socialProfileUrl('twitter', data?.socialChannels?.twitter),
      youtube: socialProfileUrl('youtube', data?.socialChannels?.youtube)
    };
    // Public bio links can still identify the channels when Roblox does not
    // return promotion fields. Never guess accounts from the Roblox username.
    const bioLinks = typeof data?.description === 'string'
      ? data.description.slice(0, 10_000).match(/https?:\/\/[^\s<>"']+/gi) || [] : [];
    for (const platform of Object.keys(urls)) {
      if (urls[platform]) continue;
      for (const value of bioLinks) {
        const url = socialProfileUrl(platform, value.replace(/[),.;!?]+$/, ''));
        if (url) { urls[platform] = url; break; }
      }
    }
    for (const [key, value] of Object.entries({
      rcProfileSocialUserId: String(userId),
      rcProfileXUrl: urls.twitter,
      rcProfileYoutubeUrl: urls.youtube
    })) {
      if (root.dataset[key] !== value) root.dataset[key] = value;
    }
  }

  function renderNativeAbout(root, userId, data) {
    if (!root || !data || data.error) return;
    // Keep React's current text and native More/Edit actions. API details can
    // be older than an edit that has already appeared in the native profile.
    const source = expandNativeDescription(root);
    const needsBio = !source || isTruncatedBio(source, data.description || '');
    const box = source?.parentElement || findNativeBioBox(root, data.description || '');
    if (!box) return;
    const preview = source || findBioPreview(box, data.description || '');
    if (!preview) return;
    let inline = root.querySelector('#rc-profile-inline-about');
    if (inline && inline.parentElement !== box) {
      inline.parentElement?.removeAttribute('data-rc-profile-inline-about-box');
      inline.remove();
      inline = null;
    }
    if (!inline) {
      inline = document.createElement('div');
      inline.id = 'rc-profile-inline-about';
    }
    if (inline.dataset.userId !== String(userId) || inline.rcProfileSourceData !== data
      || inline.dataset.bioFallback !== String(needsBio)) {
      inline.dataset.userId = String(userId);
      inline.dataset.bioFallback = String(needsBio);
      inline.rcProfileSourceData = data;
      inline.replaceChildren();
      if (needsBio) {
        const bio = document.createElement('p');
        bio.className = 'rc-profile-inline-bio';
        if (data.description?.trim()) bio.setAttribute('data-rc-i18n-ignore', '');
        bio.textContent = data.description?.trim() || 'No bio yet.';
        inline.append(bio);
      }
      const created = new Date(data.created);
      if (Number.isFinite(created.getTime())) {
        const joined = document.createElement('div');
        joined.className = 'rc-profile-inline-joined';
        const date = formatJoinedDate(created);
        joined.dataset.rcJoinedDate = created.toISOString();
        joined.textContent = `Joined ${date}`;
        inline.append(joined);
      }
      if (Array.isArray(data.formerNames) && data.formerNames.length) {
        addFact(inline, 'Former usernames', data.formerNames.join(', '), true)
          .parentElement.classList.add('rc-profile-inline-names');
      }
      const labels = { facebook: 'Facebook', twitter: 'X', youtube: 'YouTube',
        twitch: 'Twitch', guilded: 'Guilded', discord: 'Discord',
        tiktok: 'TikTok', instagram: 'Instagram' };
      const links = document.createElement('nav');
      links.className = 'rc-profile-inline-socials';
      links.setAttribute('aria-label', 'Social links');
      for (const [platform, label] of Object.entries(labels)) {
        const url = socialProfileUrl(platform, data.socialChannels?.[platform]);
        if (!url) continue;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = label;
        links.append(link);
      }
      if (links.childElementCount) inline.append(links);
    }
    if (!inline.childElementCount) { clearInlineAbout(root); return; }
    // Full native descriptions still need the rest of More's About details.
    // Keep their links and React handlers, adding only the missing information.
    if (!needsBio && source) {
      if (source.nextElementSibling !== inline) source.after(inline);
    } else if (box.firstElementChild !== inline) box.prepend(inline);
    for (const stale of root.querySelectorAll('[data-rc-profile-native-preview]')) {
      if (!needsBio || stale !== preview) stale.removeAttribute('data-rc-profile-native-preview');
    }
    if (needsBio) preview.setAttribute('data-rc-profile-native-preview', '');
    box.setAttribute('data-rc-profile-inline-about-box', '');
    for (let parent = box.parentElement, depth = 0;
      parent && parent !== root && depth < 2; parent = parent.parentElement, depth++) {
      if (parent.querySelector('h1, img, video, canvas')) break;
      parent.setAttribute('data-rc-profile-native-bio-container', '');
    }
  }

  function renderDetails(card, userId, result) {
    if (!card.isConnected || currentUserId() !== userId || card.dataset.userId !== String(userId)) return;
    const facts = card.querySelector('.rc-profile-facts');
    facts.replaceChildren();
    addFact(facts, 'User ID', String(userId));
    if (result && !result.error) {
      const created = new Date(result.created);
      if (Number.isFinite(created.getTime())) {
        addFact(facts, 'Joined', formatJoinedDate(created)).dataset.rcJoinedDate = created.toISOString();
        const now = new Date();
        const days = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
        let years = now.getUTCFullYear() - created.getUTCFullYear();
        if (now.getUTCMonth() < created.getUTCMonth()
          || (now.getUTCMonth() === created.getUTCMonth() && now.getUTCDate() < created.getUTCDate())) years--;
        addFact(facts, 'Account age', years >= 1 ? `${years} years` : `${days} days`);
      }
      if (result.verified) addFact(facts, 'Verification', 'Verified');
      if (Array.isArray(result.formerNames)) {
        addFact(facts, 'Former usernames', result.formerNames.length
          ? result.formerNames.join(', ') : 'None listed', result.formerNames.length > 0);
      }
    } else {
      addFact(facts, 'Account details', 'Unavailable');
    }
    const links = card.querySelector('.rc-profile-links');
    links.replaceChildren();
    for (const [label, path] of [
      ['View friends', `/users/${userId}/friends#!/friends`],
      ['View inventory', `/users/${userId}/inventory`]
    ]) {
      const link = document.createElement('a');
      link.href = path;
      link.textContent = label;
      links.append(link);
    }
    profileAboutData.set(card, { userId, data: result });
    const root = document.querySelector(PROFILE_ROOT) || fallbackProfileRoot();
    publishProfileSocialLinks(root, userId, result);
    renderNativeAbout(root, userId, result);
  }

  function requestDetails(card, userId) {
    if (requestedUserId === userId && card.dataset.loaded === 'true') return;
    if (card.dataset.requested === String(userId)) return;
    card.dataset.requested = String(userId);
    sendMessage({ type: 'rc-profile-details', userId }, result => {
      card.dataset.loaded = 'true';
      renderDetails(card, userId, result);
    });
    requestedUserId = userId;
  }

  function makeLimiteds() {
    const panel = document.createElement('section');
    panel.id = 'rc-profile-limiteds';
    panel.setAttribute('aria-label', 'Limited items');
    panel.innerHTML = '<div class="rc-limiteds-header"><div><h2>Limited Items</h2>'
      + '<p class="rc-limiteds-summary">Loading Limited inventory...</p></div>'
      + '<div class="rc-limiteds-actions"><a class="rc-limiteds-rolimons" target="_blank" '
      + 'rel="noopener noreferrer">View on Rolimon\'s</a>'
      + '<button type="button" class="rc-limiteds-refresh">Refresh</button></div></div>'
      + '<p class="rc-limiteds-status" role="status"></p>'
      + '<div class="rc-limiteds-grid"></div>'
      + '<button type="button" class="rc-limiteds-more" hidden>Show more</button>'
      + '<p class="rc-limiteds-note">Total RAP uses Roblox recent average prices, not Rolimon\'s Value. '
      + 'Limited bundles may not appear in this list.</p>';
    panel.querySelector('.rc-limiteds-refresh').addEventListener('click', () => {
      const userId = Number(panel.dataset.userId);
      if (Number.isSafeInteger(userId) && userId > 0) requestLimiteds(panel, userId, true);
    });
    panel.querySelector('.rc-limiteds-more').addEventListener('click', () => {
      const view = limitedViews.get(panel);
      if (!view) return;
      view.visible = Math.min(view.items.length, view.visible + 24);
      renderLimitedItems(panel);
    });
    return panel;
  }

  function renderLimitedItems(panel) {
    const view = limitedViews.get(panel);
    if (!view) return;
    const grid = panel.querySelector('.rc-limiteds-grid');
    const fragment = document.createDocumentFragment();
    for (const item of view.items.slice(0, view.visible)) {
      const link = document.createElement('a');
      link.className = 'rc-limited-item';
      link.href = `/catalog/${item.assetId}/`;
      if (typeof item.imageUrl === 'string' && /^https:\/\/[\w.-]+\.rbxcdn\.com\//i.test(item.imageUrl)) {
        const image = document.createElement('img');
        image.src = item.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        link.append(image);
      } else {
        const placeholder = document.createElement('span');
        placeholder.className = 'rc-limited-item-placeholder';
        placeholder.setAttribute('aria-hidden', 'true');
        link.append(placeholder);
      }
      const text = document.createElement('span');
      text.className = 'rc-limited-item-text';
      const name = document.createElement('strong');
      name.textContent = item.name;
      const rap = document.createElement('span');
      rap.textContent = item.rap == null ? 'RAP unavailable'
        : `RAP R$ ${numberFormat.format(item.rap)}`;
      const quantity = document.createElement('span');
      quantity.textContent = `Owned: ${numberFormat.format(item.quantity)}`
        + (item.rap != null && item.quantity > 1
          ? ` | R$ ${numberFormat.format(item.rap * item.quantity)} total` : '');
      text.append(name, rap, quantity);
      link.append(text);
      fragment.append(link);
    }
    grid.replaceChildren(fragment);
    const more = panel.querySelector('.rc-limiteds-more');
    const remaining = view.items.length - view.visible;
    more.hidden = remaining <= 0;
    more.textContent = remaining > 0 ? `Show more (${numberFormat.format(remaining)} remaining)` : 'Show more';
  }

  function renderLimiteds(panel, userId, result) {
    if (!panel.isConnected || currentUserId() !== userId || panel.dataset.userId !== String(userId)) return;
    panel.querySelector('.rc-limiteds-refresh').disabled = false;
    const status = panel.querySelector('.rc-limiteds-status');
    const summary = panel.querySelector('.rc-limiteds-summary');
    if (!Array.isArray(result?.items)) {
      status.textContent = result?.error || 'Limited inventory unavailable.';
      summary.textContent = 'Total RAP unavailable';
      panel.querySelector('.rc-limiteds-grid').replaceChildren();
      panel.querySelector('.rc-limiteds-more').hidden = true;
      return;
    }
    const items = result.items.filter(item => Number.isSafeInteger(item?.assetId) && item.assetId > 0
      && Number.isSafeInteger(item?.quantity) && item.quantity > 0);
    limitedViews.set(panel, { items, visible: Math.min(24, items.length) });
    summary.textContent = `${result.unpricedCopies > 0 ? 'Known RAP' : 'Total RAP'}: `
      + `R$ ${numberFormat.format(result.totalRap || 0)}  |  `
      + `${numberFormat.format(result.copies || 0)} copies  |  ${numberFormat.format(items.length)} unique`;
    status.textContent = items.length ? '' : 'No Limited assets found in this inventory.';
    if (result.unpricedCopies > 0) {
      status.textContent = `${numberFormat.format(result.unpricedCopies)} copies have no RAP and are excluded from the total.`;
    }
    renderLimitedItems(panel);
  }

  function requestLimiteds(panel, userId, force = false) {
    if (!force && panel.dataset.requested === String(userId)) return;
    panel.dataset.requested = String(userId);
    panel.querySelector('.rc-limiteds-refresh').disabled = true;
    panel.querySelector('.rc-limiteds-status').textContent = 'Loading Limited inventory...';
    sendMessage({ type: 'rc-profile-limiteds', userId, force }, result => {
      renderLimiteds(panel, userId, result);
    });
  }

  function syncProfile() {
    const userId = currentUserId();
    observedUserId = userId;
    if (!userId) {
      clearIdentityBackdrop();
      watchLayout();
      observedRoot = null;
      placementRoot = null;
      clearTimeout(placementTimer);
      placementTimer = 0;
      return;
    }
    const profileRoot = document.querySelector(PROFILE_ROOT);
    const root = profileRoot || fallbackProfileRoot();
    observedRoot = root;
    if (!root || !root.firstElementChild) {
      watchLayout(root);
      return;
    }
    if (root.dataset.rcProfileSocialUserId !== String(userId)) {
      publishProfileSocialLinks(root, userId, null);
    }
    for (const oldPanel of root.querySelectorAll('#rc-profile-intro, #rc-profile-socials')) {
      oldPanel.remove();
    }
    for (const inline of root.querySelectorAll('#rc-profile-inline-about')) {
      if (inline.dataset.userId === String(userId)) continue;
      inline.parentElement?.removeAttribute('data-rc-profile-inline-about-box');
      inline.remove();
    }
    for (const box of root.querySelectorAll('[data-rc-profile-inline-about-box]')) {
      if (!box.querySelector(`#rc-profile-inline-about[data-user-id="${userId}"]`)) {
        box.removeAttribute('data-rc-profile-inline-about-box');
      }
    }
    hideNativeProfileTabs(root);
    expandNativeDescription(root);
    const existingCard = root.querySelector('#rc-profile-details');
    const knownAbout = existingCard && profileAboutData.get(existingCard);
    if (knownAbout?.userId === userId) {
      publishProfileSocialLinks(root, userId, knownAbout.data);
      renderNativeAbout(root, userId, knownAbout.data);
    }
    markProfileHeader(root);
    if (!profileRoot && document.readyState !== 'complete') return;
    if (placementRoot !== root) {
      placementRoot = root;
      placementDeadline = Date.now() + 1500;
      clearTimeout(placementTimer);
      placementTimer = 0;
    }
    const sections = markSections(root);
    markFriendsHeader(root, sections.get('friends'));
    markProfileCards(root, sections);
    const previousGrid = gridParents.get(root);
    // Keep the existing columns while Roblox temporarily unmounts headings.
    const grid = findGridParent(sections)
      || (previousGrid && root.contains(previousGrid) ? previousGrid : null);
    for (const stale of root.querySelectorAll('[data-rc-profile-grid]')) {
      if (stale !== grid) delete stale.dataset.rcProfileGrid;
    }
    if (root.hasAttribute('data-rc-profile-grid') && root !== grid) delete root.dataset.rcProfileGrid;
    if (grid) {
      gridParents.set(root, grid);
      if (!grid.hasAttribute('data-rc-profile-grid')) grid.dataset.rcProfileGrid = '';
    } else gridParents.delete(root);
    const first = grid
      ? [...sections.values()].find(section => section.parentElement === grid)
      : sections.values().next().value;
    // Wait briefly for Roblox's final section grid, then mount the cards once.
    // The native page remains visible and loading normally during this wait.
    if (!grid && Date.now() < placementDeadline) {
      if (!placementTimer && (first || root.querySelector('h1'))) {
        placementTimer = setTimeout(() => {
          placementTimer = 0;
          queueSync();
        }, Math.max(1, placementDeadline - Date.now()));
      }
      return;
    }
    if (!first && !root.querySelector('h1')) return;
    clearTimeout(placementTimer);
    placementTimer = 0;
    let panels = root.querySelector('#rc-profile-enhancements')
      || document.querySelector('#rc-profile-enhancements');
    if (!panels) {
      panels = document.createElement('div');
      panels.id = 'rc-profile-enhancements';
      panels.append(makeDetails(), makeLimiteds());
      if (first) first.before(panels);
      else root.append(panels);
    } else if (!root.contains(panels)) {
      if (first) first.before(panels);
      else root.append(panels);
    }
    const card = panels.querySelector('#rc-profile-details');
    updateJumps(card, sections);
    if (card.dataset.userId !== String(userId)) {
      profileAboutData.delete(card);
      card.dataset.userId = String(userId);
      card.dataset.loaded = '';
      card.dataset.requested = '';
      card.querySelector('.rc-profile-facts').textContent = 'Loading account details...';
    }
    requestDetails(card, userId);
    const limiteds = panels.querySelector('#rc-profile-limiteds');
    if (limiteds.dataset.userId !== String(userId)) {
      limiteds.dataset.userId = String(userId);
      limiteds.querySelector('.rc-limiteds-rolimons').href = `https://www.rolimons.com/player/${userId}`;
      limiteds.dataset.requested = '';
      limitedViews.delete(limiteds);
      limiteds.querySelector('.rc-limiteds-summary').textContent = 'Loading Limited inventory...';
      limiteds.querySelector('.rc-limiteds-grid').replaceChildren();
    }
    requestLimiteds(limiteds, userId);
  }

  function sync() {
    syncTimer = 0;
    syncDeadline = 0;
    // Ignore synchronous changes made by this pass. Native asynchronous
    // updates remain observable after the pass completes.
    observer.disconnect();
    try { syncProfile(); }
    finally { observer.observe(document, OBSERVER_OPTIONS); }
  }

  function queueSync() {
    if (!currentUserId() && !observedUserId) return;
    if (!syncDeadline) syncDeadline = Date.now() + 500;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, Math.max(0, Math.min(120, syncDeadline - Date.now())));
  }

  function relevantMutation(record) {
    const target = record.target.nodeType === Node.ELEMENT_NODE
      ? record.target : record.target.parentElement;
    if (target?.closest(OWNED)) return false;
    if (!observedRoot?.isConnected) return true;
    if (observedRoot.contains(target)) return true;
    return [...record.addedNodes || [], ...record.removedNodes || []].some(node =>
      node.nodeType === Node.ELEMENT_NODE && (node.contains(observedRoot)
        || node.matches(PROFILE_ROOT) || node.querySelector(PROFILE_ROOT)));
  }

  addEventListener('popstate', queueSync);
  addEventListener('hashchange', queueSync);
  globalThis.RobloxCustomizerRuntime?.onResume(queueSync);
  globalThis.RobloxCustomizerI18n?.onChange(() => {
    for (const node of document.querySelectorAll('#rc-profile-details [data-rc-joined-date], #rc-profile-inline-about [data-rc-joined-date]')) {
      const date = formatJoinedDate(new Date(node.dataset.rcJoinedDate));
      node.textContent = node.classList.contains('rc-profile-inline-joined') ? `Joined ${date}` : date;
    }
  });
  addEventListener('resize', queueSync);
  addEventListener('load', queueSync, { once: true });
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
  const OBSERVER_OPTIONS = { childList: true, characterData: true, subtree: true,
    attributes: true, attributeFilter: ['aria-label', 'title'] };
  const observer = new MutationObserver(records => {
    const userId = currentUserId();
    if (userId !== observedUserId || (userId && records.some(relevantMutation))) {
      if (userId) {
        const root = document.querySelector(PROFILE_ROOT) || fallbackProfileRoot();
        hideNativeProfileTabs(root);
        const card = root?.querySelector('#rc-profile-details');
        const knownAbout = card && profileAboutData.get(card);
        if (knownAbout?.userId === userId) renderNativeAbout(root, userId, knownAbout.data);
      }
      queueSync();
    }
  });
  observer.observe(document, OBSERVER_OPTIONS);
  queueSync();
})();
