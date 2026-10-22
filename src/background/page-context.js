/* A content-script context can retain its initial URL after history.pushState. */
(() => {
  'use strict';
  const canResolve = sender => sender.id === chrome.runtime.id && (sender.frameId ?? 0) === 0
    && Number.isInteger(sender.tab?.id) && typeof chrome.tabs?.sendMessage === 'function';
  async function resolve(sender) {
    if (!canResolve(sender)) return null;
    try {
      const original = new URL(sender.url);
      if (original.protocol !== 'https:' || !['www.roblox.com', 'roblox.com', 'create.roblox.com'].includes(original.hostname)) return null;
      const options = { frameId: 0, ...(sender.documentId ? { documentId: sender.documentId } : {}) };
      const current = await chrome.tabs.sendMessage(sender.tab.id, { type: 'rc-current-page-context' }, options);
      if (current?.origin !== original.origin || typeof current.pathname !== 'string'
        || !current.pathname.startsWith('/') || current.pathname.length > 4096) return null;
      const url = new URL(current.pathname, original.origin);
      return url.origin === original.origin && !url.search && !url.hash ? url : null;
    } catch { return null; }
  }
  globalThis.RobloxCustomizerPageContext = Object.freeze({ canResolve, resolve });
})();
