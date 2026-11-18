(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  const routePath = value => globalThis.RobloxCustomizerRoutes?.pathname(value) ?? value ?? location.pathname;

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
    'backgrounds', 'animations', 'expired', 'recently added', 'characters'
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
    '#avatar-items', '#avatar-items-container', '.avatar-items-container', '.avatar-inventory-container',
    '.avatar-item-grid', '.avatar-inventory-grid', '.item-cards',
    '[data-testid="avatar-items"]', '[data-testid="avatar-item-grid"]'
  ].join(', ');
  const CARD_SELECTORS = [
    '.avatar-item-card', '.avatar-card', '.avatar-item',
    '.item-card', '.item-card-container', '[data-testid="avatar-item"]',
    '[role="gridcell"]'
  ].join(', ');
  let panel = null;
  let previewHeading = null;
  let markedPreview = null;
  let marked3DSquareNodes = [];
  let marked3DSurface = null;
  let marked3DBackdrops = [];
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
  let markedSubcategoryBranches = [];
  let markedEditorFlow = null;
  let markedBodyControls = [];
  const movedBodyControls = new Map();
  let compareHost = null;
  let studio = null;
  let viewColumn = null;
  let itemColumn = null;
  let categoryColumn = null;
  const categoryResize = new ResizeObserver(() => {
    if (!studio || !categoryColumn) return;
    setSize(studio, '--rc-avatar-category-height', `${Math.ceil(categoryColumn.getBoundingClientRect().height)}px`);
  });
  let bodyControls = null;
  let markedPage = null;
  let markedShell = null;
  let previewPath = [];
  let syncFrame = 0;
  let layoutPending = false;
  let thumbnailTimer = 0;
  let delayedThumbnailTimer = 0;
  let finalThumbnailTimer = 0;
  let requestSequence = 0;
  let changeSequence = 0;
  let waitingForUpdatedImage = false;
  let imageBeforeChange = '';
  let last3DClickAt = 0;
  let waitingForNative3D = false;
  let requestedViewportResize = false;
  const tried3D = new WeakSet();

  const onAvatarPage = () => AVATAR_PATH.test(routePath());

  function pageRoot() {
    return document.querySelector('#content')
      || document.querySelector('#container-main, main, [role="main"]');
  }

  function findPreview(root) {
    const containsInventory = node => node.querySelector(`${CATEGORY_SELECTORS}, ${ITEM_SELECTORS}, ${CARD_SELECTORS}`);
    const candidates = [...root.querySelectorAll(PREVIEW_SELECTORS)]
      .filter(node => !node.closest('#rc-avatar-2d')
        && node.getClientRects().length > 0
        && node.querySelector('canvas, img, video, [role="img"]')
        && !containsInventory(node));
    // A larger native preview wrapper keeps its Roblox mode and redraw controls.
    const preview = candidates.find(node => !candidates.some(other =>
      other !== node && other.contains(node) && other !== root));
    if (preview) return preview;
    const canvas = [...root.querySelectorAll('canvas')].find(node =>
      !node.closest(CARD_SELECTORS) && node.getClientRects().length > 0);
    if (canvas && !canvas.closest('#rc-avatar-2d')) {
      let element = canvas.parentElement;
      for (let depth = 0; depth < 2 && element?.parentElement !== root; depth++) {
        const parent = element?.parentElement;
        if (!parent || containsInventory(parent)) break;
        element = parent;
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
    // Recent menus repeat top-level category names as shortcuts. Their menu
    // scope, rather than their label, distinguishes them from the main tabs.
    const menu = control.closest(CATEGORY_MENU_SELECTORS);
    if (menu && menu !== markedCategories) return menu;
    const categoryMenu = control.closest('.avatar-category-menu');
    if (categoryMenu && categoryMenu !== markedCategories
      && /^(absolute|fixed)$/.test(getComputedStyle(categoryMenu).position)) {
      return categoryMenu;
    }
    return null;
  }

  function markCategoryNavigation(root) {
    const scope = categoryColumn || itemColumn || root;
    const controlsRoot = scope.contains(markedCategories) ? scope : root;
    const isCategoryCandidate = node => !node.closest('#rc-avatar-2d, [data-rc-avatar-body-controls]')
      && !node.closest(CARD_SELECTORS);
    // Native menus can put the same action on both a row and its link. Style
    // only the innermost action, leaving all native handlers in place.
    const interactive = [...controlsRoot.querySelectorAll(CATEGORY_CONTROL_SELECTORS)]
      .filter(node => isCategoryCandidate(node) && !node.querySelector(CATEGORY_CONTROL_SELECTORS));
    // Some categories are text labels with the handler on a surrounding row.
    const textControls = [...controlsRoot.querySelectorAll('span, li, div, p, label')].filter(node =>
      node.children.length === 0
      && isCategoryCandidate(node)
      && (MAIN_CATEGORY_LABELS.has(categoryLabel(node)) || SUBCATEGORY_LABELS.has(categoryLabel(node)))
      && !interactive.some(control => control.contains(node)));
    const allControls = [...interactive, ...textControls]
      .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
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

    const subControls = mainRow ? allControls.filter(node => scope.contains(node)
      && !mainControls.includes(node)
      && (!mainRow.contains(node) || categoryPopup(node))
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
    const headingCandidates = subControls.filter(node =>
      CLOTHING_SECTION_LABELS.has(categoryLabel(node)));
    const clothingHeadings = [];
    const clothingSections = [];
    for (const heading of headingCandidates) {
      for (let row = heading.parentElement; row && row !== scope; row = row.parentElement) {
        if (mainControls.some(node => row.contains(node)) || row.querySelector(CARD_SELECTORS)) break;
        const options = subControls.filter(node => row.contains(node));
        if (options.length < 2) continue;
        // A label such as Outerwear can also be an option in the Tops row.
        // A section heading must precede its options, in its own native row.
        if (options[0] !== heading || groups.has(row)
          && headingCandidates.some(node => node !== heading && row.contains(node))) break;
        clothingHeadings.push(heading);
        clothingSections.push(row);
        break;
      }
    }
    markedClothingSections = updateMarkedList(markedClothingSections,
      [...new Set(clothingSections)], 'data-rc-avatar-clothing-section');
    markedClothingHeadings = updateMarkedList(markedClothingHeadings,
      clothingHeadings, 'data-rc-avatar-clothing-heading');
    const subcategoryBranches = new Set();
    for (const control of subControls) {
      for (let node = control.parentElement; node && node !== scope; node = node.parentElement) {
        if (groups.has(node) || mainControls.some(main => node.contains(main))
          || node.querySelector(CARD_SELECTORS)) break;
        if (!clothingSections.includes(node)) subcategoryBranches.add(node);
      }
    }
    markedSubcategoryBranches = updateMarkedList(markedSubcategoryBranches,
      [...subcategoryBranches], 'data-rc-avatar-subcategory-branch');
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
    if (categoryColumn?.contains(markedMainRow)) common = categoryColumn;
    markedEditorFlow = mark(markedEditorFlow, common, 'data-rc-avatar-editor-flow');
    const navPath = [];
    const contentPath = [];
    if (common) {
      for (let node = markedMainRow; node && node !== common; node = node.parentElement) {
        navPath.push(node);
      }
      if (common.contains(markedItems)) {
        for (let node = markedItems; node && node !== common; node = node.parentElement) {
          contentPath.push(node);
        }
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
    // Recognize the native mount before the inventory request fills it with cards.
    const mounts = [...root.querySelectorAll(ITEM_SELECTORS)].filter(node =>
      !node.contains(preview) && !node.contains(markedCategories) && !preview.contains(node)
      && !node.closest('[data-rc-avatar-preview-controls]'));
    const known = mounts.find(node => node.getClientRects().length > 0) || mounts[0];
    if (known) return known;
    const sample = [];
    for (const node of root.querySelectorAll(CARD_SELECTORS)) {
      if (preview.contains(node) || node.closest('#rc-avatar-2d, [data-rc-avatar-preview-controls]')
        || node.parentElement?.closest(CARD_SELECTORS) || !node.getClientRects().length) continue;
      sample.push(node);
      if (sample.length === 8) break;
    }
    if (sample.length < 2) return null;
    let candidate = sample[0].parentElement;
    while (candidate && candidate !== root) {
      if (!candidate.contains(preview) && !candidate.contains(markedCategories)
        && sample.every(card => candidate.contains(card))) return candidate;
      candidate = candidate.parentElement;
    }
    return null;
  }

  function childUnder(parent, node) {
    let child = node;
    while (child?.parentElement && child.parentElement !== parent) child = child.parentElement;
    return child?.parentElement === parent ? child : null;
  }

  function arrangeBodyControls(root) {
    for (const [node, placeholder] of movedBodyControls) {
      if (!node.isConnected) {
        placeholder.remove();
        movedBodyControls.delete(node);
      } else if (!placeholder.isConnected) {
        // Roblox replaced the original component while its old controls were relocated.
        node.remove();
        movedBodyControls.delete(node);
      }
    }
    const filters = markedCategories || markedMainRow;
    if (!filters || !root.contains(filters) || !markedItems) {
      restoreBodyControls();
      return;
    }
    const isolated = node => node && node !== root && root.contains(node)
      && node !== bodyControls && node !== itemColumn && node !== categoryColumn
      && ![markedPreview, markedCategories, markedMainRow, markedItems, panel]
        .some(boundary => boundary && node.contains(boundary))
      && !node.matches(ITEM_SELECTORS) && !node.querySelector(`${ITEM_SELECTORS}, ${CARD_SELECTORS}`);
    const groups = new Set();
    const addGroup = node => {
      if (!isolated(node)) return;
      while (isolated(node.parentElement)) node = node.parentElement;
      groups.add(node);
    };
    // R6/R15 labels remain the same in all supported locales. Keep their native toggle intact.
    const labels = [...root.querySelectorAll('span, label, button, a, div, p')]
      .filter(node => /^(?:R6|R15)$/i.test(node.textContent.trim()) && !node.closest(CARD_SELECTORS));
    for (const label of labels) {
      for (let node = label.parentElement; isolated(node); node = node.parentElement) {
        if (labels.some(other => /^R6$/i.test(other.textContent.trim()) && node.contains(other))
          && labels.some(other => /^R15$/i.test(other.textContent.trim()) && node.contains(other))) {
          addGroup(node);
          break;
        }
      }
    }
    // A resize panel can mount separately from the R6/R15 switch.
    const scaleLabels = new Map();
    const scaleSources = [...root.querySelectorAll('input[type="range"], [role="slider"], .noUi-target, .rzslider')];
    for (const label of root.querySelectorAll('label, span, div, p')) {
      if ((label.children.length && label.tagName !== 'LABEL') || label.closest(CARD_SELECTORS)) continue;
      const name = globalThis.RobloxCustomizerNativeLabels?.classify('avatarScale', label.textContent);
      if (!name) continue;
      scaleLabels.set(label, name);
      if (name !== 'head') scaleSources.push(label);
    }
    for (const slider of scaleSources) {
      if (slider.closest('#rc-avatar-2d') || slider.closest(CARD_SELECTORS)) continue;
      for (let node = slider.parentElement; isolated(node); node = node.parentElement) {
        const dimensions = new Set([...scaleLabels].filter(([label]) => node.contains(label)).map(([, name]) => name));
        if (dimensions.size >= 2) {
          addGroup(node);
          break;
        }
      }
    }
    const panels = [...groups].filter(node => ![...groups].some(other => other !== node && other.contains(node)))
      .sort((a, b) => a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    for (const [node, placeholder] of movedBodyControls) {
      if (panels.includes(node)) continue;
      placeholder.replaceWith(node);
      movedBodyControls.delete(node);
    }
    markedBodyControls = updateMarkedList(markedBodyControls, panels, 'data-rc-avatar-body-controls');
    if (studio && panel.parentElement === studio && panels.length) {
      if (!bodyControls) {
        bodyControls = document.createElement('div');
        bodyControls.setAttribute('data-rc-avatar-preview-controls', '');
      }
      if (bodyControls.previousElementSibling !== panel) panel.after(bodyControls);
    } else if (!panels.length) {
      bodyControls?.remove();
    }
    const inPreviewRail = bodyControls?.parentElement && bodyControls.parentElement === studio;
    const target = inPreviewRail ? bodyControls : itemColumn?.contains(filters) ? itemColumn : filters.parentElement;
    const before = inPreviewRail ? null : childUnder(target, filters);
    let insertionPoint = before?.nextElementSibling || null;
    while (panels.includes(insertionPoint)) insertionPoint = insertionPoint.nextElementSibling;
    for (const node of panels.reverse()) {
      if (node.parentElement !== target || node.nextElementSibling !== insertionPoint) {
        if (!movedBodyControls.has(node)) {
          const placeholder = document.createComment('Roblox Customizer: original avatar body controls');
          node.before(placeholder);
          movedBodyControls.set(node, placeholder);
        }
        target.insertBefore(node, insertionPoint);
      }
      insertionPoint = node;
    }
  }

  function restoreBodyControls() {
    for (const node of markedBodyControls) node.removeAttribute('data-rc-avatar-body-controls');
    markedBodyControls = [];
    for (const [node, placeholder] of movedBodyControls) {
      node.removeAttribute('data-rc-avatar-body-controls');
      if (placeholder.isConnected && node.isConnected) placeholder.replaceWith(node);
      else {
        placeholder.remove();
        node.remove();
      }
    }
    movedBodyControls.clear();
    bodyControls?.remove();
    bodyControls = null;
  }

  function arrangeStudio(root, items) {
    let layout = null;
    let view = null;
    let inventory = null;
    let categories = null;
    // A native inventory refresh can temporarily remove both its categories
    // and item cards. Keep the existing columns while their mount still exists.
    const inventoryTarget = items || markedCategories
      || (itemColumn?.isConnected && root.contains(itemColumn) ? itemColumn : null);
    if (inventoryTarget) {
      for (let parent = compareHost?.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
        if (!parent.contains(inventoryTarget) || markedCategories && !parent.contains(markedCategories)) continue;
        view = childUnder(parent, markedPreview);
        inventory = childUnder(parent, inventoryTarget);
        categories = childUnder(parent, markedCategories);
        if (view && inventory && view !== inventory && view !== categories) {
          layout = parent;
          break;
        }
      }
    }
    const previousStudio = studio;
    const previousCategories = categoryColumn;
    studio = mark(studio, layout, 'data-rc-avatar-studio');
    viewColumn = mark(viewColumn, layout ? view : null, 'data-rc-avatar-view-column');
    itemColumn = mark(itemColumn, layout ? inventory : null, 'data-rc-avatar-item-column');
    categoryColumn = mark(categoryColumn, layout && categories !== inventory ? categories : null,
      'data-rc-avatar-category-column');
    if (previousStudio !== studio || previousCategories !== categoryColumn) {
      previousStudio?.style.removeProperty('--rc-avatar-category-height');
      categoryResize.disconnect();
      if (categoryColumn) categoryResize.observe(categoryColumn, { box: 'border-box' });
    }
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
    const stage = canvas?.parentElement;
    const surface = stage && !stage.querySelector('button, a, input, [role="button"], [role="slider"]')
      ? stage : canvas;
    // A renderer can start at only a few pixels tall. A CSS square gives its
    // native resize handler a stable viewport as soon as the canvas mounts.
    const next = canvas ? surface === canvas ? [canvas] : [canvas, surface] : [];
    marked3DSquareNodes = updateMarkedList(marked3DSquareNodes, next, 'data-rc-avatar-3d-square');
    marked3DSurface = mark(marked3DSurface, surface,
      'data-rc-avatar-3d-surface');
    mark3DBackdrops(preview, canvas);
    if (!canvas || requestedViewportResize || !hasMismatchedViewport(canvas)) return;
    // Some native renderers only update their camera and buffer on window resize.
    // Request one initial reflow per editor visit, even if Roblox replaces the canvas.
    requestedViewportResize = true;
    requestAnimationFrame(() => {
      if (onAvatarPage() && markedPreview?.contains(canvas) && hasMismatchedViewport(canvas)) {
        dispatchEvent(new Event('resize'));
      }
    });
  }

  function hasMismatchedViewport(canvas) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    return width > 0 && height > 0 && canvas.width > 0 && canvas.height > 0
      && Math.abs(canvas.width * height / (canvas.height * width) - 1) > .05;
  }

  function mark3DBackdrops(preview, canvas) {
    const backdrops = new Set();
    for (let node = canvas; node && preview.contains(node); node = node.parentElement) {
      backdrops.add(node);
    }
    if (canvas) {
      const root = viewColumn?.contains(preview) ? viewColumn : compareHost || preview;
      // Legacy avatar backgrounds also sit on the native wrapper outside the
      // discovered renderer. Stop at the extension's outer frosted card.
      for (let node = preview.parentElement; node && root.contains(node); node = node.parentElement) {
        if (node === viewColumn) break;
        backdrops.add(node);
        if (node === root) break;
      }
      const scene = canvas.getBoundingClientRect();
      const previous = new Set(marked3DBackdrops);
      // Native backdrops can be siblings of the canvas or pseudo-elements,
      // rather than backgrounds on the canvas's own ancestor chain.
      for (const node of root.querySelectorAll('*')) {
        if (backdrops.has(node) || node.closest('#rc-avatar-2d, button, a, input, select, textarea, [role="button"], [role="menu"], [role="dialog"]')) continue;
        const rect = node.getBoundingClientRect();
        const overlapWidth = Math.max(0, Math.min(rect.right, scene.right) - Math.max(rect.left, scene.left));
        const overlapHeight = Math.max(0, Math.min(rect.bottom, scene.bottom) - Math.max(rect.top, scene.top));
        // Cover both a full-stage image and four separately tiled images.
        if (!scene.width || !scene.height || overlapWidth < scene.width * .35
          || overlapHeight < scene.height * .35) continue;
        // Keep recognized layers marked after their URL has been cleared by
        // CSS. Small control icons and item thumbnails never qualify.
        if (previous.has(node) || ['', '::before', '::after'].some(pseudo =>
          getComputedStyle(node, pseudo || null).backgroundImage.includes('url('))) backdrops.add(node);
      }
    }
    marked3DBackdrops = updateMarkedList(marked3DBackdrops, [...backdrops],
      'data-rc-avatar-backdrop');
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
      const shellWidth = Math.max(0, Math.floor(innerWidth - Math.max(0, shellLeft)));
      setSize(markedShell, '--rc-avatar-shell-width', `${shellWidth}px`);
    }
    const sidebarRight = innerWidth < 1024 ? 0 : Math.max(0,
      ...[...document.querySelectorAll('.left-nav, #left-navigation-container, #navigation')]
        .filter(node => getComputedStyle(node).visibility === 'visible')
        .map(node => node.getBoundingClientRect())
        .filter(rect => rect.width > 80 && rect.left < innerWidth / 3 && rect.right < innerWidth / 2)
        .map(rect => rect.right));
    const shellLeft = markedShell?.getBoundingClientRect().left || 0;
    const workspaceLeft = Math.max(sidebarRight, shellLeft);
    const gutter = innerWidth < 760 ? 12 : 24;
    const width = Math.min(1680, Math.max(0, innerWidth - workspaceLeft - gutter * 2));
    const targetLeft = workspaceLeft + gutter;
    const layout = width >= 760 ? 'split' : width >= 520 ? 'compact' : 'single';
    if (markedPage.dataset.rcAvatarLayout !== layout) markedPage.dataset.rcAvatarLayout = layout;
    setSize(markedPage, '--rc-avatar-workspace-width', `${Math.floor(width)}px`);
    const previousShift = parseFloat(markedPage.style.getPropertyValue('--rc-avatar-workspace-shift')) || 0;
    const baseLeft = markedPage.getBoundingClientRect().left - previousShift;
    setSize(markedPage, '--rc-avatar-workspace-shift', `${Math.round(targetLeft - baseLeft)}px`);
  }

  function setSize(node, property, value) {
    if (node.style.getPropertyValue(property) !== value) node.style.setProperty(property, value);
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
    aside.innerHTML = '<div class="rc-avatar-2d-heading"><h2>2D Preview</h2><div class="rc-avatar-preview-actions">'
      + '<button type="button" class="rc-avatar-refresh">Refresh</button></div></div>'
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
        status.textContent = result?.error === 'Sign in to view your avatar.'
          ? result.error : '2D preview unavailable. Try Refresh.';
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
    if (preview.querySelector('canvas')) {
      waitingForNative3D = false;
      return;
    }
    // The native switch can replace the editor before its canvas appears.
    if (waitingForNative3D || tried3D.has(preview)
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
    waitingForNative3D = true;
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
    waitingForNative3D = false;
    requestedViewportResize = false;
    last3DClickAt = 0;
    restoreBodyControls();
    panel?.remove();
    previewHeading?.remove();
    previewHeading = null;
    compareHost?.removeAttribute('data-rc-avatar-compare');
    markedPreview?.removeAttribute('data-rc-avatar-3d');
    marked3DSurface?.removeAttribute('data-rc-avatar-3d-surface');
    for (const node of marked3DBackdrops) node.removeAttribute('data-rc-avatar-backdrop');
    marked3DBackdrops = [];
    for (const node of markedNative2DToggles) node.removeAttribute('data-rc-avatar-native-2d-toggle');
    for (const node of marked3DSquareNodes) node.removeAttribute('data-rc-avatar-3d-square');
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
    for (const node of markedSubcategoryBranches) node.removeAttribute('data-rc-avatar-subcategory-branch');
    markedEditorFlow?.removeAttribute('data-rc-avatar-editor-flow');
    markedEditorFlow = null;
    markedMainControls = markedSubcategories = markedSubControls = [];
    markedClothingSections = markedClothingHeadings = [];
    markedNavPath = markedContentPath = markedSubcategoryPath = markedCategoryBranches = [];
    markedSubcategoryBranches = [];
    studio?.removeAttribute('data-rc-avatar-studio');
    studio?.style.removeProperty('--rc-avatar-category-height');
    categoryResize.disconnect();
    viewColumn?.removeAttribute('data-rc-avatar-view-column');
    itemColumn?.removeAttribute('data-rc-avatar-item-column');
    categoryColumn?.removeAttribute('data-rc-avatar-category-column');
    markedPage?.removeAttribute('data-rc-avatar-page');
    markedPage?.removeAttribute('data-rc-avatar-layout');
    markedPage?.style.removeProperty('--rc-avatar-workspace-width');
    markedPage?.style.removeProperty('--rc-avatar-workspace-shift');
    markedShell?.removeAttribute('data-rc-avatar-shell');
    markedShell?.style.removeProperty('--rc-avatar-shell-width');
    for (const node of previewPath) node.removeAttribute('data-rc-avatar-preview-path');
    previewPath = [];
    compareHost = markedPreview = markedCategories = markedItems = markedMainRow = null;
    studio = viewColumn = itemColumn = categoryColumn = markedPage = markedShell = null;
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
      markedPage.removeAttribute('data-rc-avatar-layout');
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
    markedCategories = mark(markedCategories, findCategories(root), 'data-rc-avatar-categories');
    const items = findItems(root, preview);
    markedItems = mark(markedItems, items, 'data-rc-avatar-items');
    arrangeStudio(root, items);
    if (viewColumn) {
      if (!previewHeading) {
        previewHeading = document.createElement('h2');
        previewHeading.className = 'rc-avatar-3d-heading';
        previewHeading.textContent = '3D Preview';
      }
      if (previewHeading.parentElement !== viewColumn) viewColumn.prepend(previewHeading);
    } else previewHeading?.remove();
    markPreviewPath(preview);
    size3DRenderer(preview);
    hideNative2DToggle(viewColumn || preview);
    if (!panel) panel = makePanel();
    if (studio && viewColumn) {
      if (panel.parentElement !== studio || panel.previousElementSibling !== viewColumn) {
        viewColumn.after(panel);
      }
    } else if (panel.parentElement !== host || panel.previousElementSibling !== preview) {
      preview.after(panel);
    }
    arrangeBodyControls(root);
    markCategoryNavigation(root);
    enableNative3D(root, preview);
    if (!panel.querySelector('img').src && !panel.querySelector('.rc-avatar-refresh').disabled) refresh2D();
  }

  function queueFrame() {
    if (syncFrame) return;
    // Native renderer and extension observers can both react to a DOM write.
    // Coalesce their work before paint without chaining layout microtasks.
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      if (!layoutPending) {
        if (onAvatarPage() && markedPreview?.isConnected) {
          mark3DBackdrops(markedPreview, markedPreview.querySelector('canvas'));
        }
        return;
      }
      layoutPending = false;
      observer.disconnect();
      previewObserver.disconnect();
      try { sync(); }
      finally {
        observer.observe(document, OBSERVER_OPTIONS);
        if (onAvatarPage() && markedPreview?.isConnected) {
          previewObserver.observe(viewColumn || compareHost || markedPreview, { subtree: true, attributes: true,
            attributeOldValue: true, attributeFilter: ['class', 'style'] });
        }
      }
    });
  }

  function queueSync() {
    layoutPending = true;
    queueFrame();
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
  addEventListener('resize', queueSync);
  addEventListener('load', queueSync, { once: true });
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
  const OBSERVER_OPTIONS = { childList: true, characterData: true, subtree: true,
    attributes: true, attributeFilter: ['aria-label', 'title'] };
  const backgroundDeclarations = value => (value || '').match(/(?:^|;)\s*background[^;]*/gi)?.join(';') || '';
  const previewObserver = new MutationObserver(records => {
    // Native background choices can update a class or inline image without
    // changing the editor layout. Canvas animation classes do neither.
    if (records.some(record => !record.target.matches('canvas')
      && (record.attributeName === 'class' || backgroundDeclarations(record.oldValue)
        !== backgroundDeclarations(record.target.getAttribute('style'))))) queueFrame();
  });
  const observer = new MutationObserver(records => {
    if (!onAvatarPage()) {
      if (markedPage) queueSync();
      return;
    }
    if (records.some(record => {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (target?.closest('#rc-avatar-2d, #rc-avatar-enhancements')) return false;
      if (markedPage?.isConnected && target && !markedPage.contains(target) && !target.contains(markedPage)) return false;
      if (record.type !== 'childList') return true;
      return [...record.addedNodes, ...record.removedNodes].some(node =>
        node instanceof Element && (node === panel ? !panel.isConnected : node.id !== 'rc-avatar-enhancements'));
    })) queueSync();
  });
  observer.observe(document, OBSERVER_OPTIONS);
  queueSync();
});
