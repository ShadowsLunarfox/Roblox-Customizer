(() => {
  'use strict';

  const ITEM_PATH = /^\/(catalog|bundles)\/(\d+)(?:\/|$)/i;
  const PREVIEW_SELECTORS = '#item-thumbnail-container-frontend, #item-thumbnail-container';
  const INFO_SELECTORS = '#item-info-container-frontend, .item-details';
  const CONTROL_SELECTORS = 'button, a, [role="button"], [role="tab"]';
  const MARKET_SELECTORS = '#asset-resale-data-container, #price-chart, #item-details-limited-inventory-container, #resellers';
  const MARKET_SECTIONS = [
    { selector: '#price-chart', kind: 'chart' },
    { selector: '#item-details-limited-inventory-container', kind: 'owned' },
    { selector: '#resellers', kind: 'resellers' }
  ];
  const OBSERVER_OPTIONS = { childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['data-target-id', 'data-is-bundle', 'data-show-3d-mode-button', 'disabled', 'data-rc-frost-page'] };
  let assetId = 0;
  let itemType = 'Asset';
  let preview = null;
  let studio = null;
  let info = null;
  let panel = null;
  let modeToggle = null;
  let refresh3DButton = null;
  let refresh3DStatus = null;
  let refresh3DState = null;
  let refresh3DTimer = 0;
  let tryOnControls = [];
  let rendererPath = [];
  let requestSequence = 0;
  let retryTimer = 0;
  let requested = false;
  let syncQueued = false;
  let tried3D = new WeakSet();
  let marketRoot = null;
  let marketLayout = null;
  let marketSections = [];
  let marketAssetId = 0;
  let marketItemType = 'Asset';
  let observedChart = null;
  let chartWidth = 0;
  let detailsInfo = null;
  let detailsRows = [];
  let detailsFavorites = null;
  let detailsSurface = null;
  let detailsSizeObserver = null;
  let detailsWidthTarget = null;

  function clearDetails() {
    detailsSizeObserver?.disconnect();
    detailsInfo?.removeAttribute('data-rc-item-specs');
    detailsInfo?.style.removeProperty('--rc-item-details-width');
    for (const row of detailsRows) {
      row.removeAttribute('data-rc-item-spec');
      row.removeAttribute('data-rc-item-spec-first');
      row.removeAttribute('data-rc-item-spec-last');
    }
    detailsFavorites?.removeAttribute('data-rc-item-spec-favorites');
    detailsFavorites?.style.removeProperty('--rc-item-spec-width');
    detailsFavorites?.style.removeProperty('--rc-item-spec-offset');
    detailsSurface?.remove();
    detailsInfo = detailsFavorites = detailsSurface = detailsWidthTarget = null;
    detailsRows = [];
  }

  function layoutDetailsSurface() {
    if (!detailsInfo?.isConnected || !detailsRows.length) return;
    const chart = document.querySelector('#price-chart');
    if (chart !== detailsWidthTarget) {
      if (detailsWidthTarget) detailsSizeObserver?.unobserve(detailsWidthTarget);
      detailsWidthTarget = chart;
      if (chart) detailsSizeObserver?.observe(chart);
    }
    const chartWidth = chart?.getBoundingClientRect().width;
    if (chartWidth > 0) {
      detailsInfo.style.setProperty('--rc-item-details-width', `${chartWidth}px`);
    } else {
      detailsInfo.style.removeProperty('--rc-item-details-width');
    }
    const origin = detailsInfo.getBoundingClientRect();
    const first = detailsRows[0].getBoundingClientRect();
    let bottom = detailsRows.at(-1).getBoundingClientRect().bottom;
    if (detailsFavorites?.isConnected) {
      const parent = detailsFavorites.parentElement;
      const host = parent.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(parent).paddingLeft) || 0;
      const offset = first.left - host.left - parent.clientLeft - padding;
      detailsFavorites.style.setProperty('--rc-item-spec-width', `${first.width}px`);
      detailsFavorites.style.setProperty('--rc-item-spec-offset', `${offset}px`);
      bottom = Math.max(bottom, detailsFavorites.getBoundingClientRect().bottom);
    }
    const style = detailsSurface.style;
    style.left = `${first.left - origin.left - detailsInfo.clientLeft}px`;
    style.top = `${first.top - origin.top - detailsInfo.clientTop}px`;
    style.width = `${first.width}px`;
    style.height = `${Math.max(0, bottom - first.top)}px`;
  }

  function syncDetails(nextId, nextType) {
    const enabled = document.documentElement?.getAttribute('data-rc-frost-page') === 'catalog';
    const root = nextId && enabled ? document.querySelector('#item-info-container-frontend') : null;
    const thumbnail = nextId ? document.querySelector(PREVIEW_SELECTORS) : null;
    if (!matchesItemMount(root, nextId, nextType)
      || thumbnail && !matchesItemMount(thumbnail, nextId, nextType)) {
      if (detailsInfo) clearDetails();
      return;
    }
    const section = root.querySelector('.item-details-section');
    const rows = section ? [...section.children].filter(row =>
      row.matches('.item-info-row-container') && !row.querySelector('.description-content')) : [];
    if (!rows.length) {
      if (detailsInfo) clearDetails();
      return;
    }
    const favorites = root.parentElement?.querySelector('#favorites-button') || null;
    if (detailsInfo !== root || detailsFavorites !== favorites
      || rows.length !== detailsRows.length || rows.some((row, index) => row !== detailsRows[index])) {
      clearDetails();
      detailsInfo = root;
      detailsRows = rows;
      detailsFavorites = favorites;
      root.setAttribute('data-rc-item-specs', favorites ? 'with-favorites' : '');
      for (const [index, row] of rows.entries()) {
        row.setAttribute('data-rc-item-spec', '');
        if (!index) row.setAttribute('data-rc-item-spec-first', '');
        if (index === rows.length - 1) row.setAttribute('data-rc-item-spec-last', '');
      }
      favorites?.setAttribute('data-rc-item-spec-favorites', '');
      // A sibling backing groups the native fields without reparenting React nodes.
      detailsSurface = document.createElement('div');
      detailsSurface.id = 'rc-catalog-item-specs';
      detailsSurface.setAttribute('aria-hidden', 'true');
      root.append(detailsSurface);
      if (typeof ResizeObserver === 'function') {
        detailsSizeObserver ||= new ResizeObserver(() => layoutDetailsSurface());
        detailsSizeObserver.observe(root);
        if (favorites) detailsSizeObserver.observe(favorites);
      }
    }
    if (detailsSurface.parentElement !== root) root.append(detailsSurface);
    layoutDetailsSurface();
  }

  function currentAssetId() {
    const id = Number(location.pathname.match(ITEM_PATH)?.[2]);
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
  }

  function currentItemType() {
    return location.pathname.match(ITEM_PATH)?.[1].toLowerCase() === 'bundles' ? 'Bundle' : 'Asset';
  }

  function isCurrentItem(id, type = itemType) {
    return currentAssetId() === id && currentItemType() === type;
  }

  function matchesItemMount(node, id, type) {
    if (!node) return false;
    const targetId = node.getAttribute('data-target-id');
    const isBundle = node.getAttribute('data-is-bundle');
    return (targetId === null || Number(targetId) === id)
      && (isBundle === null || (isBundle.toLowerCase() === 'true') === (type === 'Bundle'));
  }

  function modeLabel(control) {
    return (control.textContent || control.getAttribute('aria-label')
      || control.getAttribute('title') || '').trim();
  }

  function findModeButton(root) {
    return [...root.querySelectorAll(CONTROL_SELECTORS)].find(control =>
      /^(?:(?:switch to|view in) )?[23]d(?: view)?$/i.test(modeLabel(control))) || null;
  }

  function mark(previous, next, attribute) {
    if (previous !== next) previous?.removeAttribute(attribute);
    if (next && !next.hasAttribute(attribute)) next.setAttribute(attribute, '');
    return next;
  }

  function clearMarket() {
    chartSizeObserver?.disconnect();
    observedChart = null;
    chartWidth = 0;
    marketRoot?.removeAttribute('data-rc-market-root');
    marketLayout?.removeAttribute('data-rc-market-layout');
    for (const section of marketSections) section.removeAttribute('data-rc-market-section');
    marketRoot = marketLayout = null;
    marketSections = [];
    marketAssetId = 0;
  }

  function syncMarket(nextId, nextType) {
    const root = nextId ? document.querySelector('#asset-resale-data-container') : null;
    if (!matchesItemMount(root, nextId, nextType)) {
      if (marketRoot) clearMarket();
      return;
    }
    if (marketRoot && (marketRoot !== root || marketAssetId !== nextId || marketItemType !== nextType)) clearMarket();
    const sections = MARKET_SECTIONS.map(section => ({ ...section, node: root.querySelector(section.selector) }))
      .filter(section => section.node && (section.kind !== 'owned'
        || section.node.querySelector('.item-details-limited-inventory')));
    if (!sections.length) {
      if (marketRoot) clearMarket();
      return;
    }
    marketAssetId = nextId;
    marketItemType = nextType;
    marketRoot = mark(marketRoot, root, 'data-rc-market-root');
    const nodes = sections.map(section => section.node);
    const host = nodes[0].parentElement;
    marketLayout = mark(marketLayout, nodes.every(node => node.parentElement === host) ? host : null,
      'data-rc-market-layout');
    for (const node of marketSections) {
      if (!nodes.includes(node)) node.removeAttribute('data-rc-market-section');
    }
    for (const section of sections) {
      if (section.node.getAttribute('data-rc-market-section') !== section.kind) {
        section.node.setAttribute('data-rc-market-section', section.kind);
      }
    }
    marketSections = nodes;
    const chart = sections.find(section => section.kind === 'chart')?.node || null;
    if (chart !== observedChart) {
      chartSizeObserver?.disconnect();
      observedChart = chart;
      chartWidth = 0;
      if (chart) chartSizeObserver?.observe(chart);
    }
  }

  function sizeRenderer() {
    const next = [];
    const holder = preview.querySelector('.thumbnail-holder, .thumbnail-3d-container');
    const canvas = holder?.querySelector('canvas');
    for (let node = canvas; node && holder.contains(node); node = node.parentElement) {
      next.push(node);
      if (node === holder) break;
    }
    for (const node of rendererPath) {
      if (!next.includes(node)) node.removeAttribute('data-rc-item-renderer');
    }
    for (const node of next) {
      if (!node.hasAttribute('data-rc-item-renderer')) node.setAttribute('data-rc-item-renderer', '');
    }
    rendererPath = next;
  }

  function makePanel() {
    const aside = document.createElement('aside');
    aside.id = 'rc-catalog-item-2d';
    aside.setAttribute('aria-label', '2D item preview');
    aside.innerHTML = '<div class="rc-item-preview-heading"><h2>2D Preview</h2>'
      + '<button type="button" class="rc-item-refresh">Refresh</button></div>'
      + '<div class="rc-item-image-wrap"><img alt="Catalog item in 2D" hidden></div>'
      + '<p class="rc-item-preview-status" role="status">Loading 2D preview...</p>';
    aside.querySelector('.rc-item-refresh').addEventListener('click', () => refresh2D());
    return aside;
  }

  function sync3DControls(modeButton) {
    const controls = [...preview.querySelectorAll(CONTROL_SELECTORS)]
      .filter(control => /^(?:try on|take off)$/i.test(modeLabel(control)));
    for (const control of tryOnControls) {
      if (!controls.includes(control)) control.removeAttribute('data-rc-item-native-try-on');
    }
    for (const control of controls) control.setAttribute('data-rc-item-native-try-on', '');
    tryOnControls = controls;
    if (!refresh3DButton) {
      const button = document.createElement('button');
      button.id = 'rc-catalog-item-3d-refresh';
      button.type = 'button';
      button.setAttribute('aria-label', 'Refresh 3D preview');
      button.setAttribute('title', 'Reload the 3D model');
      button.addEventListener('click', () => {
        if (refresh3DButton === button) refresh3D();
      });
      refresh3DButton = button;
      refresh3DStatus = document.createElement('p');
      refresh3DStatus.id = 'rc-catalog-item-3d-status';
      refresh3DStatus.setAttribute('role', 'status');
    }
    if (refresh3DButton.parentElement !== preview) preview.append(refresh3DButton);
    if (refresh3DStatus.parentElement !== preview) preview.append(refresh3DStatus);
    refresh3DButton.disabled = !!refresh3DState || !modeButton || modeButton.disabled;
    refresh3DButton.textContent = refresh3DState ? 'Refreshing...' : 'Refresh';
  }

  function finish3DRefresh(message = '') {
    clearTimeout(refresh3DTimer);
    refresh3DTimer = 0;
    refresh3DState = null;
    refresh3DStatus.textContent = message;
    sync3DControls(findModeButton(preview));
  }

  function refresh3D() {
    if (refresh3DState || !preview?.isConnected || !isCurrentItem(assetId)) return;
    const button = findModeButton(preview);
    if (!button || button.disabled) return;
    const state = {
      preview, assetId, itemType, canvas: preview.querySelector('canvas'),
      phase: /2d/i.test(modeLabel(button)) ? 'out' : 'in', polls: 0
    };
    refresh3DState = state;
    refresh3DStatus.textContent = 'Reloading 3D preview...';
    sync3DControls(button);
    // Switching to 2D unmounts Roblox's Thumbnail3d component. Switch back only
    // after its native control confirms that render, so React creates a new viewer.
    button.click();
    queueSync();
    const poll = () => {
      if (refresh3DState !== state) return;
      if (preview !== state.preview || !preview.isConnected || !isCurrentItem(state.assetId, state.itemType)) {
        queueSync();
        return;
      }
      if (++state.polls >= 150) {
        finish3DRefresh('Could not reload the 3D preview. Try Refresh.');
        return;
      }
      queueSync();
      refresh3DTimer = setTimeout(poll, 100);
    };
    refresh3DTimer = setTimeout(poll, 100);
  }

  function advance3DRefresh(button, is3D) {
    if (refresh3DState.phase === 'out' && !is3D && !button.disabled) {
      refresh3DState.phase = 'in';
      tried3D.add(button);
      button.click();
      queueSync();
    } else if (refresh3DState.phase === 'in' && is3D) {
      const canvas = preview.querySelector('canvas');
      if (canvas && canvas !== refresh3DState.canvas) finish3DRefresh();
    }
  }

  function refresh2D(retries = 0) {
    if (!panel?.isConnected || !isCurrentItem(assetId)) return;
    clearTimeout(retryTimer);
    requested = true;
    const sequence = ++requestSequence;
    const activePanel = panel;
    const activeAssetId = assetId;
    const activeItemType = itemType;
    const button = panel.querySelector('.rc-item-refresh');
    const status = panel.querySelector('.rc-item-preview-status');
    const image = panel.querySelector('img');
    const isCurrent = () => sequence === requestSequence && panel === activePanel
      && panel.isConnected && isCurrentItem(activeAssetId, activeItemType);
    const fail = text => {
      button.disabled = false;
      status.textContent = text;
    };
    button.disabled = true;
    status.textContent = image.hidden ? 'Loading 2D preview...' : 'Updating 2D preview...';
    try {
      chrome.runtime.sendMessage({ type: 'rc-catalog-item-2d', assetId, itemType }, result => {
        const runtimeError = chrome.runtime.lastError;
        if (!isCurrent()) return;
        if (runtimeError || !result || result.error) {
          fail('2D preview unavailable. Try Refresh.');
          return;
        }
        if (result.state === 'Pending' || result.state === 'InReview') {
          fail('Roblox is generating the 2D preview...');
          if (retries < 3) retryTimer = setTimeout(() => {
            if (isCurrent()) refresh2D(retries + 1);
          }, 2500);
          else status.textContent = '2D preview is still being generated. Try Refresh.';
          return;
        }
        if (result.state !== 'Completed' || typeof result.imageUrl !== 'string') {
          fail('2D preview unavailable. Try Refresh.');
          return;
        }
        const next = new Image();
        next.onload = () => {
          if (!isCurrent()) return;
          image.src = result.imageUrl;
          image.hidden = false;
          button.disabled = false;
          status.textContent = '';
        };
        next.onerror = () => {
          if (isCurrent()) fail('Could not display the 2D preview. Try Refresh.');
        };
        next.src = result.imageUrl;
      });
    } catch {
      fail('2D preview unavailable. Reload the page and try again.');
    }
  }

  function clearPage() {
    ++requestSequence;
    clearTimeout(retryTimer);
    clearTimeout(refresh3DTimer);
    refresh3DButton?.remove();
    refresh3DStatus?.remove();
    for (const control of tryOnControls) control.removeAttribute('data-rc-item-native-try-on');
    panel?.remove();
    studio?.removeAttribute('data-rc-item-studio');
    preview?.removeAttribute('data-rc-item-3d');
    preview?.removeAttribute('data-rc-item-mode');
    info?.removeAttribute('data-rc-item-info');
    modeToggle?.removeAttribute('data-rc-item-native-2d-toggle');
    for (const node of rendererPath) node.removeAttribute('data-rc-item-renderer');
    panel = studio = preview = info = modeToggle = null;
    rendererPath = [];
    refresh3DButton = refresh3DStatus = refresh3DState = null;
    refresh3DTimer = 0;
    tryOnControls = [];
    assetId = 0;
    requested = false;
    tried3D = new WeakSet();
  }

  function sync() {
    const nextId = currentAssetId();
    const nextType = currentItemType();
    syncDetails(nextId, nextType);
    // Market panels also work for items without a native 3D preview.
    syncMarket(nextId, nextType);
    if (!nextId) {
      if (preview) clearPage();
      return;
    }
    const nextPreview = document.querySelector(PREVIEW_SELECTORS);
    // Wait for Roblox to replace the previous item's React mount after navigation.
    if (!matchesItemMount(nextPreview, nextId, nextType)) {
      if (preview) clearPage();
      return;
    }
    const button = findModeButton(nextPreview);
    if (nextPreview.getAttribute('data-show-3d-mode-button')?.toLowerCase() === 'false') {
      if (preview) clearPage();
      return;
    }
    if (!button) {
      // Native thumbnail loading can temporarily replace the controls.
      if (preview && (preview !== nextPreview || assetId !== nextId || itemType !== nextType)) clearPage();
      else if (preview) {
        sizeRenderer();
        sync3DControls(null);
      }
      return;
    }
    const host = nextPreview.parentElement;
    const nextInfo = host?.querySelector(INFO_SELECTORS);
    if (!host || !nextInfo || nextInfo.parentElement !== host
      || !matchesItemMount(nextInfo, nextId, nextType)) {
      if (preview && (preview !== nextPreview || assetId !== nextId || itemType !== nextType || studio !== host)) clearPage();
      return;
    }
    if (preview && (assetId !== nextId || itemType !== nextType || preview !== nextPreview || studio !== host)) clearPage();
    assetId = nextId;
    itemType = nextType;
    studio = mark(studio, host, 'data-rc-item-studio');
    preview = mark(preview, nextPreview, 'data-rc-item-3d');
    info = mark(info, nextInfo, 'data-rc-item-info');
    if (!panel) panel = makePanel();
    if (panel.parentElement !== studio || panel.previousElementSibling !== preview) preview.after(panel);
    const name = info.querySelector('h1')?.textContent.trim();
    const alt = name ? `${name} in 2D` : 'Catalog item in 2D';
    if (panel.querySelector('img').alt !== alt) panel.querySelector('img').alt = alt;
    if (!requested) refresh2D();

    const is3D = /2d/i.test(modeLabel(button));
    sync3DControls(button);
    modeToggle = mark(modeToggle, is3D ? button : null, 'data-rc-item-native-2d-toggle');
    const heading = is3D || refresh3DState ? '3D Preview' : 'Item Preview';
    if (preview.getAttribute('data-rc-item-mode') !== heading) preview.setAttribute('data-rc-item-mode', heading);
    sizeRenderer();
    if (refresh3DState) {
      advance3DRefresh(button, is3D);
    // Use the native mode handler to retain Roblox's model and orbit controls.
    } else if (!is3D && !button.disabled && !tried3D.has(button)) {
      tried3D.add(button);
      button.click();
      queueSync();
    }
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    queueMicrotask(() => {
      syncQueued = false;
      observer.disconnect();
      try { sync(); }
      finally { observer.observe(document, OBSERVER_OPTIONS); }
    });
  }

  // Roblox's bundled chart reflows on window resize. Notify it when its card
  // changes width; chart height and tooltip updates never trigger another reflow.
  const chartSizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    if (!observedChart?.isConnected || !isCurrentItem(marketAssetId, marketItemType)) return;
    const entry = entries.find(item => item.target === observedChart);
    const width = Math.round(entry?.contentRect.width || 0);
    if (width > 0 && width !== chartWidth) {
      chartWidth = width;
      dispatchEvent(new Event('resize'));
    }
  }) : null;

  const observer = new MutationObserver(records => {
    if (!currentAssetId()) {
      if (preview || marketRoot || detailsInfo) queueSync();
      return;
    }
    if (records.some(record => {
      const target = record.target.nodeType === Node.ELEMENT_NODE
        ? record.target : record.target.parentElement;
      if (target === document.documentElement && record.attributeName === 'data-rc-frost-page') return true;
      if (target?.closest('#rc-catalog-item-2d, #rc-catalog-item-3d-refresh, #rc-catalog-item-3d-status, #rc-catalog-item-specs, .highcharts-container')) return false;
      return !preview || !preview.isConnected || !isCurrentItem(assetId)
        || preview.contains(target) || info?.contains(target) || studio === target
        || detailsInfo?.contains(target) || detailsInfo && !detailsInfo.isConnected
        || detailsFavorites?.contains(target)
        || marketRoot?.contains(target) || marketRoot && !marketRoot.isConnected
        || [...record.addedNodes, ...record.removedNodes].some(node =>
          node.nodeType === Node.ELEMENT_NODE && (node.contains(preview)
            || node.matches(`${PREVIEW_SELECTORS}, ${MARKET_SELECTORS}`)
            || node.querySelector(`${PREVIEW_SELECTORS}, ${MARKET_SELECTORS}`)));
    })) queueSync();
  });
  observer.observe(document, OBSERVER_OPTIONS);
  addEventListener('popstate', queueSync);
  addEventListener('hashchange', queueSync);
  addEventListener('load', queueSync, { once: true });
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
  queueSync();
})();
