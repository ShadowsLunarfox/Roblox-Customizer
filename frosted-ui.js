(() => {
  'use strict';

  const NATIVE_HOST = '#chat-container, #dialog-container, .react-chat-root';
  const NATIVE_PANEL = '#chat-main, .chat-main, .dialog-container, .dialog-main, .react-chat-dialog-shell';
  const CHAT_LIST_PANEL = 'section[aria-label="Chat"]';
  const CHAT_INPUT = 'input[placeholder="Search for friends" i], '
    + 'textarea[placeholder="Send a message" i], input[placeholder="Send a message" i], '
    + '[contenteditable="true"][aria-label="Send a message" i], '
    + '[data-testid="chat-input"], [data-testid="chat-search-input"]';
  const CHAT_HEADER = 'button, [role="button"], [aria-label="Chat" i], [title="Chat" i], '
    + 'h1, h2, h3, h4, h5, h6, span, p, div';
  const PROTECTED_CONTENT = '.dialog-message-container, .dialog-message, '
    + '.chat-friend-container, [role="listitem"], [role="img"], '
    + '[data-testid="chat-message"], [data-testid="message-bubble"]';
  const SURFACE_SELECTOR = 'div, section, article, main, aside, header, footer, form, ul, ol, li, button';
  const MESSAGE_REGION = '[role="log"], [aria-live], .dialog-body, [data-rc-chat-scroll]';
  const DISCOVERY_SELECTOR = `${NATIVE_HOST}, ${NATIVE_PANEL}, ${CHAT_LIST_PANEL}, ${CHAT_INPUT}, ${CHAT_HEADER}`;
  const panels = new Set();
  const discoveryRoots = new Set([document]);
  const dirtyPanels = new Set();
  let hostCache = new WeakMap();
  let timer = 0;

  function isHost(node) {
    if (node.matches(NATIVE_HOST) || node.hasAttribute('data-rc-chat-host')) return true;
    if (!node.matches(NATIVE_PANEL)) return false;
    if (hostCache.has(node)) return hostCache.get(node);
    const branches = new Set();
    for (const window of node.querySelectorAll(NATIVE_PANEL)) {
      if (window.matches(NATIVE_HOST)) continue;
      let branch = window;
      for (let parent = window.parentElement; parent && parent !== node; parent = parent.parentElement) {
        if (parent.matches(NATIVE_PANEL) && !parent.matches(NATIVE_HOST)) branch = parent;
      }
      branches.add(branch);
    }
    const shared = branches.size > 1;
    hostCache.set(node, shared);
    return shared;
  }

  function nativeWindowFor(anchor) {
    let window = null;
    for (let node = anchor; node && node !== document.body; node = node.parentElement) {
      if (isHost(node)) break;
      if (node.matches(NATIVE_PANEL)) window = node;
      // React's fixed root is only as wide as the friends list. Conversation
      // shells sit in a separate fixed child, outside that root's bounds.
      if (node.matches(CHAT_LIST_PANEL) && node.closest('.react-chat-root')) window = node;
    }
    return window;
  }

  function owns(panel, node) {
    const owner = node.closest('[data-rc-chat-panel]');
    return !owner || owner === panel;
  }

  function panelFor(input) {
    const native = nativeWindowFor(input);
    if (native) return native;
    const known = input.closest('[data-rc-chat-panel]');
    if (known && !isHost(known)) return known;
    // Current chat can use generated class names and render in a React portal.
    // Identify the small floating window containing its own search/composer.
    let candidate = null;
    for (let node = input.parentElement; node && node !== document.body; node = node.parentElement) {
      if (isHost(node)) return candidate;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (!candidate && rect.width >= 180 && rect.width <= 640 && rect.height >= 120
        && rect.bottom >= innerHeight - 40
        && (parseFloat(style.borderTopLeftRadius) >= 6
          || style.position === 'fixed' || style.position === 'absolute')) candidate = node;
      if (candidate && style.position === 'fixed') return candidate;
    }
    return null;
  }

  function isChatHeader(node) {
    const label = node.getAttribute('aria-label') || node.getAttribute('title');
    const text = Array.from(node.childNodes).filter(child => child.nodeType === 3)
      .map(child => child.textContent).join(' ').trim();
    return /^chat$/i.test(label || '') || /^chat$/i.test(text);
  }

  function panelForHeader(header) {
    if (!isChatHeader(header) || header.closest(`${PROTECTED_CONTENT}, ${MESSAGE_REGION}`)) return null;
    const native = nativeWindowFor(header);
    if (native) return native;
    const known = header.closest('[data-rc-chat-panel]');
    if (known && !isHost(known)) return known;
    let candidate = null;
    for (let node = header; node && node !== document.body; node = node.parentElement) {
      if (isHost(node)) return candidate;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      // Use the window's docking rather than just the collapsed height. The
      // composer may not exist yet while the same window opens or animates.
      const bottom = parseFloat(style.bottom);
      const docked = ((style.position === 'fixed' || style.position === 'absolute')
          && Number.isFinite(bottom) && bottom >= 0 && bottom <= 40)
        || (rect.bottom >= innerHeight - 40 && rect.bottom <= innerHeight + 8);
      if (rect.width >= 180 && rect.width <= 640 && rect.height >= 28
        && rect.height <= Math.min(innerHeight, 800) && docked
        && (!candidate || rect.width <= candidate.getBoundingClientRect().width + 40)) candidate = node;
      if (style.position === 'fixed') return candidate;
    }
    return null;
  }

  function markSurface(node, panel, notice = false) {
    if (node === panel || !owns(panel, node) || node.hasAttribute('data-rc-chat-panel')
      || (!notice && node.closest(PROTECTED_CONTENT))) return;
    // The wide header itself can be a minimize button. Small icon buttons keep
    // their native hover/selection backgrounds.
    if (node.matches('button, [role="button"]')
      && node.getBoundingClientRect().width < panel.getBoundingClientRect().width * .7) return;
    if (node.matches(SURFACE_SELECTOR)) {
      if (!node.hasAttribute('data-rc-chat-surface')) node.setAttribute('data-rc-chat-surface', '');
    }
  }

  function introNotice(panel) {
    // The current safety card nests its copy in spans and links and can be
    // localized. Its stable class avoids relying on English direct text.
    const nativeNotice = Array.from(panel.querySelectorAll('.react-chat-osa-inline-card'))
      .find(node => owns(panel, node));
    if (nativeNotice) return nativeNotice;
    let heading = null;
    let warning = null;
    for (const node of panel.querySelectorAll('div, p, span, strong, b, h1, h2, h3, h4, h5, h6')) {
      if (!owns(panel, node)) continue;
      const text = Array.from(node.childNodes).filter(child => child.nodeType === 3)
        .map(child => child.textContent).join(' ').trim();
      if (/^First conversation with\b/i.test(text)) heading = node;
      if (/^Be careful when you chat with strangers\b/i.test(text)) warning = node;
    }
    if (!heading || !warning) return null;
    let notice = null;
    for (let node = heading.parentElement; node && node !== panel; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (node.matches(MESSAGE_REGION) || ['auto', 'scroll'].includes(style.overflowY)) break;
      if (!node.contains(warning)) continue;
      if (!notice) notice = node;
      // A system notice can be a tall list item. Stop at its own message
      // wrapper instead of relying on a fraction of the window's height.
      if (node.matches('.dialog-message-container, [role="listitem"], [data-testid="chat-message"]')) {
        notice = node;
        break;
      }
    }
    return notice;
  }

  function syncPanelSurfaces(panel) {
    const panelWidth = panel.getBoundingClientRect().width;
    for (const child of panel.children) markSurface(child, panel);
    for (const node of panel.querySelectorAll(SURFACE_SELECTOR)) {
      if (!owns(panel, node) || node.hasAttribute('data-rc-chat-panel')) continue;
      const style = getComputedStyle(node);
      const scrollable = ['auto', 'scroll'].includes(style.overflowY);
      if (scrollable) {
        if (!node.hasAttribute('data-rc-chat-scroll')) node.setAttribute('data-rc-chat-scroll', '');
      } else if (node.hasAttribute('data-rc-chat-scroll')) node.removeAttribute('data-rc-chat-scroll');
      const messageRegion = node.closest(MESSAGE_REGION);
      const wideChrome = node.childElementCount > 0
        && node.getBoundingClientRect().width >= panelWidth * .8
        && (!messageRegion || messageRegion === node);
      const messageList = node.matches('ul') && node.parentElement?.matches('.react-chat-dialog-scroll');
      if (node.getAttribute('role') === 'log' || scrollable || wideChrome || messageList) markSurface(node, panel);
    }
    // Roblox renders this static welcome/safety card as a system message.
    // Its wrappers need transparency even though user message bubbles do not.
    const notice = introNotice(panel);
    if (notice) {
      for (let node = notice; node && node !== panel; node = node.parentElement) markSurface(node, panel, true);
      for (const node of notice.querySelectorAll(SURFACE_SELECTOR)) {
        if (node.getBoundingClientRect().width >= panelWidth * .6) markSurface(node, panel, true);
      }
    }
    for (const input of panel.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, [contenteditable="true"]')) {
      if (owns(panel, input) && !input.closest(PROTECTED_CONTENT) && !input.hasAttribute('data-rc-chat-input')) {
        input.setAttribute('data-rc-chat-input', '');
      }
    }
  }

  function discover(root) {
    const nodes = root instanceof Element ? [root, ...root.querySelectorAll(DISCOVERY_SELECTOR)]
      : root.querySelectorAll(DISCOVERY_SELECTOR);
    for (const node of nodes) {
      let panel = null;
      if (isHost(node)) {
        if (!node.hasAttribute('data-rc-chat-host')) node.setAttribute('data-rc-chat-host', '');
        continue;
      }
      if (node.matches(NATIVE_PANEL)
        || (node.matches(CHAT_LIST_PANEL) && node.closest('.react-chat-root'))) panel = nativeWindowFor(node);
      else if (node.matches(CHAT_INPUT)) {
        panel = panelFor(node);
        if (!panel) continue;
        if (!node.hasAttribute('data-rc-chat-input')) node.setAttribute('data-rc-chat-input', '');
        for (let parent = node.parentElement; parent && parent !== panel; parent = parent.parentElement) {
          markSurface(parent, panel);
        }
      } else panel = panelForHeader(node);
      if (panel) {
        panels.add(panel);
        dirtyPanels.add(panel);
        if (!panel.hasAttribute('data-rc-chat-panel')) panel.setAttribute('data-rc-chat-panel', '');
        panel.removeAttribute('data-rc-chat-surface');
        // Our marker makes a static shell relative. Keep it on later passes:
        // reading that resulting relative position must not remove the marker
        // and let its absolute backdrop expand across the shared fixed host.
        if (!panel.hasAttribute('data-rc-chat-static') && getComputedStyle(panel).position === 'static') {
          panel.setAttribute('data-rc-chat-static', '');
        }
      }
    }
  }

  function syncPanels() {
    timer = 0;
    hostCache = new WeakMap();
    const roots = new Set(discoveryRoots);
    discoveryRoots.clear();
    for (const root of roots) {
      if (root !== document && !root.isConnected) continue;
      // A React update can add both a wrapper and its children in one batch.
      // Discover each subtree once rather than repeatedly scanning it.
      if (root !== document && roots.has(document)) continue;
      let ancestor = root.parentElement;
      while (ancestor && !roots.has(ancestor)) ancestor = ancestor.parentElement;
      if (!ancestor) discover(root);
    }
    for (const panel of panels) {
      // Keep the styling while hidden, loading, or between animation frames.
      // Only retire a window after React actually removes it from the page.
      if (panel.isConnected && !isHost(panel)) continue;
      if (panel.isConnected) {
        panel.setAttribute('data-rc-chat-host', '');
        // A wrapper that held one conversation can become a shared host when
        // another opens. Give its existing children their own layers too.
        discover(panel);
      }
      panels.delete(panel);
      dirtyPanels.delete(panel);
      panel.removeAttribute('data-rc-chat-panel');
      panel.removeAttribute('data-rc-chat-static');
      for (const node of panel.querySelectorAll('[data-rc-chat-surface], [data-rc-chat-input], [data-rc-chat-scroll]')) {
        if (!owns(panel, node)) continue;
        node.removeAttribute('data-rc-chat-surface');
        node.removeAttribute('data-rc-chat-input');
        node.removeAttribute('data-rc-chat-scroll');
      }
    }
    for (const panel of dirtyPanels) syncPanelSurfaces(panel);
    dirtyPanels.clear();
  }

  function queueSync(root) {
    if (root === document || root instanceof Element) discoveryRoots.add(root);
    if (!timer) timer = setTimeout(syncPanels, 16);
  }

  new MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      const panel = target?.closest('[data-rc-chat-panel]');
      if (panel) {
        panels.add(panel);
        dirtyPanels.add(panel);
        changed = true;
      } else if (target && (record.type === 'attributes' || isChatHeader(target)
        || target.matches(`${NATIVE_PANEL}, ${CHAT_INPUT}`))) {
        discoveryRoots.add(target);
        changed = true;
      }
      for (const node of record.addedNodes || []) {
        if (!(node instanceof Element)) continue;
        discoveryRoots.add(node);
        changed = true;
      }
      if (record.removedNodes?.length) changed = true;
    }
    if (changed) queueSync();
  }).observe(document, {
    childList: true, characterData: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'id', 'placeholder', 'aria-label', 'title', 'style']
  });
  addEventListener('resize', () => queueSync(document));
  document.addEventListener('focusin', event => {
    if (event.target instanceof Element && event.target.matches(CHAT_INPUT)) queueSync(event.target);
  });
  queueSync();
})();
