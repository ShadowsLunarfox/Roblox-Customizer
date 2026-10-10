(() => {
  'use strict';

  const sendMessage = globalThis.RobloxCustomizerRuntime?.sendMessage
    || ((...args) => chrome.runtime.sendMessage(...args));

  const AVATAR_PATH = /^\/my\/avatar(?:\/|$)/i;
  const PREVIEW_SELECTORS = [
    '#avatar-preview', '#avatar-preview-container', '.avatar-preview-container',
    '.avatar-preview', '.avatar-body-container', '.avatar-renderer',
    '.avatar-3d-container', '[data-testid="avatar-preview"]',
    '[data-testid="avatar-editor-preview"]'
  ].join(', ');
  const CATEGORY_SELECTORS = [
    '#avatar-categories', '.avatar-categories', '.avatar-tab-container',
    '.avatar-category-menu', '.avatar-editor-tabs', '[data-testid="avatar-categories"]',
    '[data-testid="avatar-category-tabs"]'
  ].join(', ');
  const MAIN_CATEGORY_LABELS = new Set([
    'recent', 'avatars', 'body', 'makeup', 'clothing', 'accessories',
    'backgrounds', 'animations'
  ]);
  const SUBCATEGORY_LABELS = new Set([
    'recently added', 'currently wearing', 'purchased', 'creations',
    'heads', 'skin tone', 'hair', 'torso', 'left arms', 'right arms',
    'left legs', 'right legs', 'scale', 'hats', 'face', 'neck', 'shoulder',
    'shoulders', 'front', 'back', 'waist', 'gear', 'tops', 'outerwear',
    'bottoms', 'shirts', 't-shirts', 'pants', 'jackets', 'sweaters',
    'shorts', 'dresses & skirts', 'dresses and skirts', 'shoes', 'classic',
    'left shoe', 'right shoe', 'left shoes', 'right shoes',
    'classic shirts', 'classic t-shirts',
    'classic pants', 'looks', 'eyes', 'lips', 'eyelashes', 'eyebrows',
    'faces', 'emotes', 'idle', 'walk', 'run', 'jump',
    'fall', 'climb', 'swim', 'bundles', 'characters', 'costumes'
  ]);
  const CLOTHING_SECTION_LABELS = new Set([
    'tops', 'outerwear', 'bottoms', 'shoes', 'classic'
  ]);
  const CATEGORY_CONTROL_SELECTORS = [
    'a', 'button', '[role="tab"]', '[role="button"]', '[role="menuitem"]',
    '[role="option"]', '[ng-click]', '[data-ng-click]'
  ].join(', ');
  const CATEGORY_MENU_SELECTORS = [
    '.dropdown-menu', '.rbx-dropdown-menu', '.tab-dropdown-menu',
    '.tab-dropdown', '.avatar-subcategories', '.avatar-subcategory-menu', '[role="menu"]'
  ].join(', ');
  const ITEM_SELECTORS = [
    '.avatar-items-container', '.avatar-inventory-container',
    '.avatar-item-grid', '.avatar-inventory-grid',
    '[data-testid="avatar-items"]', '[data-testid="avatar-item-grid"]'
  ].join(', ');
  const CARD_SELECTORS = [
    '.avatar-item-card', '.avatar-card', '.avatar-item',
    '.item-card', '.item-card-container', '[data-testid="avatar-item"]',
    '[role="gridcell"]'
  ].join(', ');
  let panel = null;
  let markedPreview = null;
  let marked3DSquareNodes = [];
  let marked3DSurface = null;
  let markedNative2DToggles = [];
  let markedCategories = null;
  let markedItems = null;
  let markedMainRow = null;
  let markedMainControls = [];
  let markedSubcategories = [];
  let markedSubControls = [];
  let markedClothingSections = [];
  let markedClothingHeadings = [];
  let markedNavPath = [];
  let markedContentPath = [];
  let markedSubcategoryPath = [];
  let markedCategoryBranches = [];
  let markedEditorFlow = null;
  let compareHost = null;
  let studio = null;
  let viewColumn = null;
  let itemColumn = null;
  let markedPage = null;
  let markedShell = null;
  let previewPath = [];
  let syncQueued = false;
  let thumbnailTimer = 0;
  let delayedThumbnailTimer = 0;
  let finalThumbnailTimer = 0;
  let requestSequence = 0;
  let changeSequence = 0;
  let waitingForUpdatedImage = false;
  let imageBeforeChange = '';
  let last3DClickAt = 0;
  const tried3D = new WeakSet();

  const onAvatarPage = () => AVATAR_PATH.test(location.pathname);

  function pageRoot() {
    return document.querySelector('#content')
      || document.querySelector('#container-main, main, [role="main"]');
  }

  function findPreview(root) {
    const candidates = [...root.querySelectorAll(PREVIEW_SELECTORS)]
      .filter(node => !node.closest('#rc-avatar-2d')
        && node.getClientRects().length > 0
        && node.querySelector('canvas, img, video, [role="img"]')
        && node.querySelectorAll('a[href*="/catalog/"]').length < 4);
    // A larger native preview wrapper keeps its Roblox mode and redraw controls.
    const preview = candidates.find(node => !candidates.some(other =>
      other !== node && other.contains(node) && other !== root));
    if (preview) return preview;
    const canvas = [...root.querySelectorAll('canvas')].find(node => node.getClientRects().length > 0);
    if (canvas && !canvas.closest('#rc-avatar-2d')) {
      let element = canvas.parentElement;
      for (let depth = 0; depth < 2 && element?.parentElement !== root; depth++) {
        element = element?.parentElement || element;
      }
      return element;
    }
    const image = [...root.querySelectorAll('img')].find(node => {
      if (node.closest('#rc-avatar-2d, a[href*="/catalog/"]')) return false;
      const rect = node.getBoundingClientRect();
      return rect.width >= 220 && rect.height >= 220;
    });
    if (image) return image.parentElement?.parentElement || image.parentElement;
    return null;
  }

  function findCategories(root) {
    const candidates = [...root.querySelectorAll(CATEGORY_SELECTORS)]
      .filter(node => node.getClientRects().length > 0 && !node.querySelector('canvas')
        && node.querySelectorAll(CARD_SELECTORS).length < 2
        && node.querySelectorAll(CATEGORY_CONTROL_SELECTORS).length >= 2);
    const primary = candidates.find(node => [...node.querySelectorAll(CATEGORY_CONTROL_SELECTORS)]
      .filter(control => MAIN_CATEGORY_LABELS.has(categoryLabel(control))).length >= 4);
    if (primary) return primary;
    if (candidates.length) return candidates[0];
    return [...root.querySelectorAll('nav, [role="tablist"]')].find(node => {
      const labels = [...node.querySelectorAll(CATEGORY_CONTROL_SELECTORS)]
        .map(categoryLabel);
      return labels.filter(label => MAIN_CATEGORY_LABELS.has(label)).length >= 3;
    }) || null;
  }

  function categoryLabel(node) {
    const normalize = value => value.trim().replace(/\s+/g, ' ')
      .replace(/[\u2304\u2303\u25be\u25b4\u25bc\u25b2]+$/g, '')
      .trim().toLowerCase().replace(/ (?:menu|tab)$/, '');
    const canonical = value => globalThis.RobloxCustomizerNativeLabels?.classify('avatar', value) || normalize(value);
    const visible = canonical(node.textContent || '');
    const accessible = canonical(node.getAttribute('aria-label') || '');
    if (MAIN_CATEGORY_LABELS.has(visible) || SUBCATEGORY_LABELS.has(visible)) return visible;
    if (MAIN_CATEGORY_LABELS.has(accessible) || SUBCATEGORY_LABELS.has(accessible)) return accessible;
    return visible || accessible;
  }

  function updateMarkedList(previous, next, attribute) {
    for (const node of previous) {
      if (!next.includes(node)) node.removeAttribute(attribute);
    }
    for (const node of next) {
      if (!node.hasAttribute(attribute)) node.setAttribute(attribute, '');
    }
    return next;
  }

  function categoryPopup(control) {
    if (MAIN_CATEGORY_LABELS.has(categoryLabel(control))) return null;
    const menu = control.closest(CATEGORY_MENU_SELECTORS);
    if (menu) return menu;
    const categoryMenu = control.closest('.avatar-category-menu');
    if (categoryMenu && categoryMenu !== markedCategories
      && /^(absolute|fixed)$/.test(getComputedStyle(categoryMenu).position)) {
      return categoryMenu;
    }
    return null;
  }

  function markCategoryNavigation(root) {
    const interactive = [...root.querySelectorAll(CATEGORY_CONTROL_SELECTORS)];
    // Some Roblox subcategories are plain text elements with a handler on their
    // row. Recognize those labels without treating inventory item names as tabs.
    const textControls = [...root.querySelectorAll('span, li, div, p, label')].filter(node =>
      node.children.length === 0 && SUBCATEGORY_LABELS.has(categoryLabel(node))
      && !node.closest(CATEGORY_CONTROL_SELECTORS));
    const allControls = [...interactive, ...textControls]
      .filter(node => !node.closest('#rc-avatar-2d') && !node.closest(CARD_SELECTORS));
    const mainControls = markedCategories
      ? allControls.filter(node => markedCategories.contains(node)
        && MAIN_CATEGORY_LABELS.has(categoryLabel(node))
        && !categoryPopup(node)) : [];
    markedMainControls = updateMarkedList(markedMainControls, mainControls,
      'data-rc-avatar-main-control');

    let mainRow = null;
    if (mainControls.length >= 4) {
      for (let parent = mainControls[0].parentElement; parent; parent = parent.parentElement) {
        if (mainControls.every(node => parent.contains(node))) {
          mainRow = parent;
          break;
        }
        if (parent === markedCategories) break;
      }
    }
    markedMainRow = mark(markedMainRow, mainRow, 'data-rc-avatar-main-row');

    const scope = itemColumn || root;
    const subControls = mainRow ? allControls.filter(node => scope.contains(node)
      && !mainControls.includes(node)
      && !MAIN_CATEGORY_LABELS.has(categoryLabel(node))
      && (SUBCATEGORY_LABELS.has(categoryLabel(node))
        || categoryPopup(node)
        || markedCategories?.contains(node))
      && categoryLabel(node).length > 0 && categoryLabel(node).length <= 36) : [];
    const groups = new Set();
    for (const control of subControls) {
      // The clothing menu contains several rows. Use their shared outer menu,
      // instead of giving every row its own full-width glass panel.
      let group = control;
      for (let parent = group.parentElement; parent && parent !== scope; parent = parent.parentElement) {
        if (parent.querySelector(CARD_SELECTORS) || parent.contains(markedItems)
          || mainControls.some(node => parent.contains(node))) break;
        group = parent;
      }
      if (group !== control && (subControls.some(node => node !== control && group.contains(node))
        || categoryPopup(control))) groups.add(group);
    }
    markedSubcategories = updateMarkedList(markedSubcategories, [...groups],
      'data-rc-avatar-subcategories');
    markedSubControls = updateMarkedList(markedSubControls, subControls,
      'data-rc-avatar-sub-control');
    const clothingHeadings = subControls.filter(node =>
      CLOTHING_SECTION_LABELS.has(categoryLabel(node)));
    const clothingSections = [];
    for (const heading of clothingHeadings) {
      for (let row = heading.parentElement; row && row !== scope; row = row.parentElement) {
        if (mainControls.some(node => row.contains(node)) || row.querySelector(CARD_SELECTORS)) break;
        if (clothingHeadings.some(node => node !== heading && row.contains(node))) break;
        if (subControls.some(node => node !== heading && !CLOTHING_SECTION_LABELS.has(categoryLabel(node))
          && row.contains(node))) {
          clothingSections.push(row);
          break;
        }
      }
    }
    markedClothingSections = updateMarkedList(markedClothingSections,
      [...new Set(clothingSections)], 'data-rc-avatar-clothing-section');
    markedClothingHeadings = updateMarkedList(markedClothingHeadings,
      clothingHeadings, 'data-rc-avatar-clothing-heading');
    markCategoryFlow(root, mainControls, [...groups]);
  }

  function markCategoryFlow(root, mainControls, groups) {
    // Fix the complete path, including Roblox's fixed-height carousel wrappers.
    // Expanding only the innermost tab row leaves the inventory underneath it.
    let common = markedMainRow?.parentElement;
    while (common && root.contains(common) && !common.contains(markedItems)) {
      common = common.parentElement;
    }
    if (!markedItems) {
      common = itemColumn?.contains(markedMainRow) ? itemColumn : null;
    }
    if (markedItems?.contains(markedMainRow)
      || !common || !root.contains(common) || common.contains(markedPreview)) common = null;
    markedEditorFlow = mark(markedEditorFlow, common, 'data-rc-avatar-editor-flow');
    const navPath = [];
    const contentPath = [];
    if (common) {
      for (let node = markedMainRow; node && node !== common; node = node.parentElement) {
        navPath.push(node);
      }
      for (let node = markedItems; node && node !== common; node = node.parentElement) {
        contentPath.push(node);
      }
    }
    markedNavPath = updateMarkedList(markedNavPath, navPath, 'data-rc-avatar-nav-path');
    markedContentPath = updateMarkedList(markedContentPath, contentPath, 'data-rc-avatar-content-path');

    const subPath = new Set();
    const branches = new Set();
    for (const group of groups) {
      for (let node = group; node && node !== common && node !== root; node = node.parentElement) {
        if (node === markedMainRow || node.querySelector(CARD_SELECTORS)) break;
        if (mainControls.some(control => node.contains(control))) {
          // Flatten only a tab's wrapper when its menu is nested inside the tab
          // track. The real controls stay mounted with their original handlers.
          if (markedMainRow?.contains(node)) branches.add(node);
          else break;
        } else {
          subPath.add(node);
        }
      }
    }
    markedSubcategoryPath = updateMarkedList(markedSubcategoryPath, [...subPath],
      'data-rc-avatar-subcategory-path');
    markedCategoryBranches = updateMarkedList(markedCategoryBranches, [...branches],
      'data-rc-avatar-category-branch');
  }

  function findItems(root, preview) {
    const known = [...root.querySelectorAll(ITEM_SELECTORS)].find(node =>
      node.getClientRects().length > 0 && !node.contains(preview)
      && node.querySelectorAll(CARD_SELECTORS).length >= 2);
    const cards = [...root.querySelectorAll(CARD_SELECTORS)].filter(node =>
      node.getClientRects().length > 0 && !preview.contains(node)
      && !node.closest('#rc-avatar-2d'));
    if (cards.length < 4) return known || null;
    let candidate = cards[0].parentElement;
    const sample = cards.slice(0, Math.min(8, cards.length));
    while (candidate && candidate !== root) {
      if (!candidate.contains(preview) && !candidate.contains(markedCategories)
        && sample.every(card => candidate.contains(card))) return candidate;
      candidate = candidate.parentElement;
    }
    return known || null;
  }

  function childUnder(parent, node) {
    let child = node;
    while (child?.parentElement && child.parentElement !== parent) child = child.parentElement;
    return child?.parentElement === parent ? child : null;
  }

  function arrangeStudio(root, items) {
    let layout = null;
    let view = null;
    let inventory = null;
    const inventoryTarget = items || markedCategories;
    if (inventoryTarget) {
      for (let parent = compareHost?.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
        if (!parent.contains(inventoryTarget)) continue;
        view = childUnder(parent, compareHost);
        inventory = childUnder(parent, inventoryTarget);
        if (view && inventory && view !== inventory) layout = parent;
        break;
      }
    }
    studio = mark(studio, layout, 'data-rc-avatar-studio');
    viewColumn = mark(viewColumn, layout ? view : null, 'data-rc-avatar-view-column');
    itemColumn = mark(itemColumn, layout ? inventory : null, 'data-rc-avatar-item-column');
  }

  function markPreviewPath(preview) {
    const next = [];
    const stop = viewColumn || compareHost?.parentElement;
    for (let node = preview; node && node !== stop; node = node.parentElement) {
      next.push(node);
    }
    for (const node of previewPath) {
      if (!next.includes(node)) node.removeAttribute('data-rc-avatar-preview-path');
    }
    for (const node of next) {
      if (!node.hasAttribute('data-rc-avatar-preview-path')) {
        node.setAttribute('data-rc-avatar-preview-path', '');
      }
    }
    previewPath = next;
  }

  function size3DRenderer(preview) {
    const canvas = preview.querySelector('canvas');
    const path = [];
    for (let node = canvas; node && preview.contains(node); node = node.parentElement) {
      path.push(node);
      if (node === preview) break;
    }
    const next = path.filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width >= 200 && rect.height >= 100
        && (marked3DSquareNodes.includes(node) || rect.height < rect.width * .8);
    });
    for (const node of marked3DSquareNodes) {
      if (next.includes(node)) continue;
      node.removeAttribute('data-rc-avatar-3d-square');
      node.style.removeProperty('--rc-avatar-3d-square-size');
    }
    for (const node of next) {
      node.setAttribute('data-rc-avatar-3d-square', '');
      node.style.setProperty('--rc-avatar-3d-square-size', `${Math.round(node.getBoundingClientRect().width)}px`);
    }
    marked3DSquareNodes = next;
    marked3DSurface = mark(marked3DSurface, next.at(-1) || null,
      'data-rc-avatar-3d-surface');
  }

  function hideNative2DToggle(scope) {
    const selectors = 'button, a, [role="button"], [tabindex]';
    const controls = [...scope.querySelectorAll(selectors)].filter(node => {
      const label = (node.getAttribute('aria-label') || node.getAttribute('title')
        || node.textContent || '').trim();
      return /^(?:2d|2d view|switch to 2d|view in 2d)$/i.test(label)
        || globalThis.RobloxCustomizerNativeLabels?.previewMode(label) === '2';
    });
    if (!controls.length) {
      for (const label of scope.querySelectorAll('span, div')) {
        if (label.children.length || label.textContent.trim() !== '2D') continue;
        const control = label.closest(selectors) || label.parentElement;
        if (control && control.getBoundingClientRect().width <= 120) controls.push(control);
      }
    }
    markedNative2DToggles = updateMarkedList(markedNative2DToggles, controls,
      'data-rc-avatar-native-2d-toggle');
  }

  function updatePageWidth() {
    if (!markedPage?.isConnected || !onAvatarPage()) return;
    if (markedShell?.isConnected) {
      const shellLeft = markedShell.getBoundingClientRect().left;
      const shellWidth = Math.max(320, Math.floor(innerWidth - Math.max(0, shellLeft) - 16));
      markedShell.style.setProperty('--rc-avatar-shell-width', `${shellWidth}px`);
    }
    const sidebarRight = Math.max(0, ...['#left-navigation-container', '#navigation']
      .map(selector => document.querySelector(selector)?.getBoundingClientRect())
      .filter(rect => rect && rect.width > 80 && rect.left < innerWidth / 3
        && rect.right < innerWidth / 2)
      .map(rect => rect.right));
    const shellLeft = markedShell?.getBoundingClientRect().left || 0;
    const workspaceLeft = Math.max(sidebarRight, shellLeft);
    const available = Math.max(320, innerWidth - workspaceLeft - 24);
    const width = Math.min(1480, Math.max(280, available - 32));
    const targetLeft = workspaceLeft + Math.max(0, (available - width) / 2);
    markedPage.style.setProperty('--rc-avatar-workspace-width', `${Math.floor(width)}px`);
    const previousShift = parseFloat(markedPage.style.getPropertyValue('--rc-avatar-workspace-shift')) || 0;
    const baseLeft = markedPage.getBoundingClientRect().left - previousShift;
    markedPage.style.setProperty('--rc-avatar-workspace-shift', `${Math.round(targetLeft - baseLeft)}px`);
  }

  function mark(ref, node, attribute) {
    if (ref && ref !== node) ref.removeAttribute(attribute);
    if (node && !node.hasAttribute(attribute)) node.setAttribute(attribute, '');
    return node;
  }

  function makePanel() {
    const aside = document.createElement('aside');
    aside.id = 'rc-avatar-2d';
    aside.setAttribute('aria-label', '2D avatar preview');
    aside.innerHTML = '<div class="rc-avatar-2d-heading"><h2>2D Preview</h2>'
      + '<button type="button" class="rc-avatar-refresh">Refresh</button></div>'
      + '<div class="rc-avatar-image-wrap"><img alt="Your current avatar in 2D" hidden></div>'
      + '<p class="rc-avatar-status" role="status">Loading 2D preview...</p>';
    aside.querySelector('.rc-avatar-refresh').addEventListener('click', () => refresh2D());
    return aside;
  }

  function refresh2D(retries = 0, lastAutomaticTry = false) {
    if (!onAvatarPage() || !panel?.isConnected) return;
    const sequence = ++requestSequence;
    const button = panel.querySelector('.rc-avatar-refresh');
    const status = panel.querySelector('.rc-avatar-status');
    const image = panel.querySelector('img');
    button.disabled = true;
    status.textContent = image.hidden ? 'Loading 2D preview...' : 'Updating 2D preview...';
    sendMessage({ type: 'rc-avatar-2d' }, result => {
      if (sequence !== requestSequence || !panel?.isConnected || !onAvatarPage()) return;
      button.disabled = false;
      if (chrome.runtime.lastError || result?.error || !result) {
        status.textContent = result?.error || '2D preview unavailable. Try Refresh.';
        return;
      }
      if (result.state === 'Pending') {
        status.textContent = 'Roblox is generating the 2D preview...';
        if (retries < 3) thumbnailTimer = setTimeout(() => refresh2D(retries + 1), 2500);
        return;
      }
      if (result.state !== 'Completed' || typeof result.imageUrl !== 'string') {
        status.textContent = '2D preview unavailable. Try Refresh.';
        return;
      }
      if (waitingForUpdatedImage && imageBeforeChange && result.imageUrl === imageBeforeChange) {
        status.textContent = lastAutomaticTry
          ? 'Roblox is still updating the 2D image. Use Refresh to check again.'
          : 'Waiting for Roblox to update the 2D image...';
        return;
      }
      const next = new Image();
      next.onload = () => {
        if (sequence !== requestSequence || !panel?.isConnected) return;
        image.src = result.imageUrl;
        image.hidden = false;
        waitingForUpdatedImage = false;
        status.textContent = '';
      };
      next.onerror = () => {
        if (sequence === requestSequence) status.textContent = 'Could not display the 2D preview.';
      };
      next.src = result.imageUrl;
    });
  }

  function queueThumbnailUpdate() {
    const change = ++changeSequence;
    imageBeforeChange = panel?.querySelector('img')?.src || '';
    waitingForUpdatedImage = true;
    clearTimeout(thumbnailTimer);
    clearTimeout(delayedThumbnailTimer);
    clearTimeout(finalThumbnailTimer);
    thumbnailTimer = setTimeout(() => {
      if (change === changeSequence) refresh2D();
    }, 1300);
    // Roblox can finish applying the item before its thumbnail has been redrawn.
    delayedThumbnailTimer = setTimeout(() => {
      if (change === changeSequence) refresh2D();
    }, 7000);
    finalThumbnailTimer = setTimeout(() => {
      if (change === changeSequence) refresh2D(0, true);
    }, 15000);
  }

  function enableNative3D(root, preview) {
    if (tried3D.has(preview) || preview.querySelector('canvas')
      || Date.now() - last3DClickAt < 15_000) return;
    const scopes = [preview, preview.parentElement, preview.parentElement?.parentElement]
      .filter(node => node && root.contains(node));
    let button = null;
    for (const scope of scopes) {
      button = [...scope.querySelectorAll('button, a, [role="button"], [role="tab"]')].find(control => {
        const label = (control.getAttribute('aria-label') || control.getAttribute('title')
          || control.textContent || '').trim();
        return /^(?:3d|view in 3d|3d view)$/i.test(label)
          || globalThis.RobloxCustomizerNativeLabels?.previewMode(label) === '3';
      });
      if (button) break;
    }
    if (!button) return;
    tried3D.add(preview);
    if (button.getAttribute('aria-pressed') !== 'true' && !button.classList.contains('active')) {
      last3DClickAt = Date.now();
      button.click();
    }
  }

  function clearPage() {
    clearTimeout(thumbnailTimer);
    clearTimeout(delayedThumbnailTimer);
    clearTimeout(finalThumbnailTimer);
    ++requestSequence;
    waitingForUpdatedImage = false;
    imageBeforeChange = '';
    panel?.remove();
    compareHost?.removeAttribute('data-rc-avatar-compare');
    markedPreview?.removeAttribute('data-rc-avatar-3d');
    marked3DSurface?.removeAttribute('data-rc-avatar-3d-surface');
    for (const node of markedNative2DToggles) node.removeAttribute('data-rc-avatar-native-2d-toggle');
    for (const node of marked3DSquareNodes) {
      node.removeAttribute('data-rc-avatar-3d-square');
      node.style.removeProperty('--rc-avatar-3d-square-size');
    }
    marked3DSquareNodes = [];
    marked3DSurface = null;
    markedNative2DToggles = [];
    markedCategories?.removeAttribute('data-rc-avatar-categories');
    markedItems?.removeAttribute('data-rc-avatar-items');
    markedMainRow?.removeAttribute('data-rc-avatar-main-row');
    for (const node of markedMainControls) node.removeAttribute('data-rc-avatar-main-control');
    for (const node of markedSubcategories) node.removeAttribute('data-rc-avatar-subcategories');
    for (const node of markedSubControls) node.removeAttribute('data-rc-avatar-sub-control');
    for (const node of markedClothingSections) node.removeAttribute('data-rc-avatar-clothing-section');
    for (const node of markedClothingHeadings) node.removeAttribute('data-rc-avatar-clothing-heading');
    for (const node of markedNavPath) node.removeAttribute('data-rc-avatar-nav-path');
    for (const node of markedContentPath) node.removeAttribute('data-rc-avatar-content-path');
    for (const node of markedSubcategoryPath) node.removeAttribute('data-rc-avatar-subcategory-path');
    for (const node of markedCategoryBranches) node.removeAttribute('data-rc-avatar-category-branch');
    markedEditorFlow?.removeAttribute('data-rc-avatar-editor-flow');
    markedEditorFlow = null;
    markedMainControls = markedSubcategories = markedSubControls = [];
    markedClothingSections = markedClothingHeadings = [];
    markedNavPath = markedContentPath = markedSubcategoryPath = markedCategoryBranches = [];
    studio?.removeAttribute('data-rc-avatar-studio');
    viewColumn?.removeAttribute('data-rc-avatar-view-column');
    itemColumn?.removeAttribute('data-rc-avatar-item-column');
    markedPage?.removeAttribute('data-rc-avatar-page');
    markedPage?.style.removeProperty('--rc-avatar-workspace-width');
    markedPage?.style.removeProperty('--rc-avatar-workspace-shift');
    markedShell?.removeAttribute('data-rc-avatar-shell');
    markedShell?.style.removeProperty('--rc-avatar-shell-width');
    for (const node of previewPath) node.removeAttribute('data-rc-avatar-preview-path');
    previewPath = [];
    compareHost = markedPreview = markedCategories = markedItems = markedMainRow = null;
    studio = viewColumn = itemColumn = markedPage = markedShell = null;
  }

  function sync() {
    if (!onAvatarPage()) {
      if (markedPage) clearPage();
      return;
    }
    const root = pageRoot();
    if (!root) return;
    const preview = findPreview(root);
    if (!preview?.parentElement) return;
    if (markedPage && markedPage !== root) {
      markedPage.removeAttribute('data-rc-avatar-page');
      markedPage.style.removeProperty('--rc-avatar-workspace-width');
      markedPage.style.removeProperty('--rc-avatar-workspace-shift');
    }
    markedPage = root;
    const shell = root !== document.querySelector('#container-main')
      ? root.closest('#container-main') : null;
    if (markedShell && markedShell !== shell) {
      markedShell.removeAttribute('data-rc-avatar-shell');
      markedShell.style.removeProperty('--rc-avatar-shell-width');
    }
    markedShell = shell;
    if (shell && !shell.hasAttribute('data-rc-avatar-shell')) shell.setAttribute('data-rc-avatar-shell', '');
    if (!root.hasAttribute('data-rc-avatar-page')) root.setAttribute('data-rc-avatar-page', '');
    updatePageWidth();
    const host = preview.parentElement;
    if (compareHost && compareHost !== host) compareHost.removeAttribute('data-rc-avatar-compare');
    compareHost = host;
    if (!host.hasAttribute('data-rc-avatar-compare')) host.setAttribute('data-rc-avatar-compare', '');
    markedPreview = mark(markedPreview, preview, 'data-rc-avatar-3d');
    size3DRenderer(preview);
    markedCategories = mark(markedCategories, findCategories(root), 'data-rc-avatar-categories');
    const items = findItems(root, preview);
    markedItems = mark(markedItems, items, 'data-rc-avatar-items');
    arrangeStudio(root, items);
    hideNative2DToggle(viewColumn || preview);
    markCategoryNavigation(root);
    markPreviewPath(preview);
    if (!panel) panel = makePanel();
    if (studio && viewColumn) {
      if (panel.parentElement !== studio || panel.previousElementSibling !== viewColumn) {
        viewColumn.after(panel);
      }
    } else if (panel.parentElement !== host || panel.previousElementSibling !== preview) {
      preview.after(panel);
    }
    if (studio && viewColumn && itemColumn && markedMainRow && panel.parentElement === studio) {
      globalThis.RobloxCustomizerStartup?.avatarReady();
    }
    if (!panel.querySelector('img').src && !panel.querySelector('.rc-avatar-refresh').disabled) refresh2D();
    enableNative3D(root, preview);
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    // Mutation batches are styled before the browser paints their native layout.
    queueMicrotask(() => {
      syncQueued = false;
      observer.disconnect();
      try { sync(); }
      finally { observer.observe(document, OBSERVER_OPTIONS); }
    });
  }

  document.addEventListener('click', event => {
    if (!onAvatarPage() || !panel?.isConnected) return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const root = pageRoot();
    if (!target || !root?.contains(target) || target.closest('#rc-avatar-2d')) return;
    if (markedPreview?.contains(target) || markedCategories?.contains(target)) return;
    if (target.closest(CARD_SELECTORS) || markedItems?.contains(target)
      || target.closest('button, [role="button"], [role="option"], input, label, select')) {
      queueThumbnailUpdate();
    }
  }, true);
  document.addEventListener('change', event => {
    if (!onAvatarPage() || !panel?.isConnected) return;
    const target = event.target;
    if (target instanceof Element && pageRoot()?.contains(target) && !target.closest('#rc-avatar-2d')) {
      queueThumbnailUpdate();
    }
  }, true);
  addEventListener('popstate', queueSync);
  addEventListener('hashchange', queueSync);
  globalThis.RobloxCustomizerRuntime?.onResume(queueSync);
  addEventListener('resize', () => {
    updatePageWidth();
    queueSync();
  });
  addEventListener('load', queueSync, { once: true });
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
  const OBSERVER_OPTIONS = { childList: true, characterData: true, subtree: true,
    attributes: true, attributeFilter: ['aria-label', 'title'] };
  const observer = new MutationObserver(records => {
    if (!onAvatarPage()) {
      if (markedPage) queueSync();
      return;
    }
    if (records.some(record => record.type !== 'childList'
      ? !(record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement)?.closest('#rc-avatar-2d')
      : [...record.addedNodes, ...record.removedNodes].some(node =>
      node.nodeType === Node.ELEMENT_NODE && node.id !== 'rc-avatar-2d'
      && !node.closest?.('#rc-avatar-2d')))) queueSync();
  });
  observer.observe(document, OBSERVER_OPTIONS);
  queueSync();
})();
