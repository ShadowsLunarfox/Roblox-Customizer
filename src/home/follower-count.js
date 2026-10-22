/* Show the official follower total on the existing heading, independent of React's private exports. */
(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  const ROOTS = '#friends-web-app, #friends-container';
  const HEADINGS = '#friends-web-app .friends-subtitle h2, #friends-container .friends-subtitle h2';
  const send = globalThis.RobloxCustomizerRuntime?.sendMessage || ((...args) => chrome.runtime.sendMessage(...args));
  const edits = new Map();
  let route = '', total = null, pending = false, queued = false, epoch = 0, timer;
  const currentRoute = () => {
    const path = globalThis.RobloxCustomizerRoutes?.pathname() || location.pathname;
    return /^\/users\/(?:(\d+)\/)?friends\/?$/i.test(path) && /^#!?\/followers\/?(?:\?|$)/i.test(location.hash)
      && !document.documentElement.hasAttribute('data-rc-features-disabled') ? path + location.hash : '';
  };
  function restore() {
    for (const [node, edit] of edits) if (node.isConnected && node.nodeValue === edit.applied) node.nodeValue = edit.original;
    edits.clear();
  }
  function paint() {
    if (total === null || !route) return;
    let count;
    try { count = new Intl.NumberFormat(document.documentElement.lang || 'en-US').format(total); }
    catch { count = String(total); }
    for (const heading of document.querySelectorAll(HEADINGS)) {
      if (!heading.getClientRects().length) continue;
      const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const edit = edits.get(node);
        const value = edit && node.nodeValue === edit.applied ? edit.original : node.nodeValue;
        const next = value.replace(/([（(])\s*[\d,.\s\u00a0\u202f]+\+?\s*([）)])\s*$/u, (_, open, close) => open + count + close);
        if (next === node.nodeValue) continue;
        edits.set(node, { original: value, applied: next }); node.nodeValue = next;
      }
    }
    for (const [node] of edits) if (!node.isConnected) edits.delete(node);
  }
  function load(refresh = false) {
    if (!route || pending || document.hidden) return;
    pending = true; const version = epoch;
    clearTimeout(timer);
    try {
      send({ type: 'rc-friends-manager', action: 'follower-count', accountId: 0, refresh }, response => {
        if (version !== epoch || route !== currentRoute()) return;
        pending = false;
        if (!chrome.runtime.lastError && response?.ok && Number.isSafeInteger(response.count) && response.count >= 0) {
          total = response.count; paint();
        }
        // Retry at most once a minute; rendering or pagination never starts a request loop.
        timer = setTimeout(() => load(true), 60000);
      });
    } catch {
      pending = false; timer = setTimeout(() => load(true), 60000);
    }
  }
  function sync() {
    const next = currentRoute();
    if (route !== next) {
      restore(); clearTimeout(timer); epoch++; pending = false; total = null; route = next;
      if (route) load();
    }
    paint();
  }
  function queue() {
    if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; sync(); }); }
  }
  new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' && record.target === document.documentElement
      || currentRoute() && ((record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target)?.closest?.(ROOTS)
        || [...record.addedNodes, ...record.removedNodes].some(node => node instanceof Element && (node.matches(ROOTS) || node.querySelector(HEADINGS)))))) queue();
  }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['data-rc-features-disabled', 'lang', 'class', 'style', 'hidden'] });
  globalThis.RobloxCustomizerRuntime?.onResume(() => {
    sync();
    if (route && !pending) { restore(); total = null; load(true); }
  });
  addEventListener('hashchange', queue); addEventListener('popstate', queue); queue();
});
