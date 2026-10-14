(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';

  if (!/^\/my\/messages(?:\/|$)/i.test(location.pathname)) return;

  const ACTION = 'button, a, [role="button"], [role="menuitem"], input[type="button"]';
  const HIDDEN = 'data-rc-hide-unread-action';
  const UNREAD = /^(?:mark(?:\s+as)?\s+unread|make(?:\s+as)?\s+unread|标(?:记)?(?:为)?未读|標(?:記)?(?:為)?未讀|设为未读|設為未讀)$/i;
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().replace(/[.!。…:：]+$/, '').toLowerCase();
  const inInbox = () => /^\/my\/messages(?:\/|$)/i.test(location.pathname)
    && ['', 'inbox'].includes(location.hash.replace(/^#!?\/?/, '').split(/[/?&]/)[0].toLowerCase());

  function syncAction(action) {
    const labels = [action.getAttribute('aria-label'), action.getAttribute('title'),
      action.matches('input') ? action.value : action.textContent];
    action.toggleAttribute(HIDDEN, inInbox() && labels.some(label => UNREAD.test(normalize(label))));
  }

  function syncNearest(node) {
    const element = node.nodeType === 1 ? node : node.parentElement;
    const action = element?.closest?.(ACTION);
    if (action) syncAction(action);
  }

  function scanAdded(node) {
    if (node.nodeType !== 1) return;
    syncNearest(node);
    for (const action of node.querySelectorAll(ACTION)) syncAction(action);
  }

  function scanPage() {
    for (const action of document.querySelectorAll(ACTION)) syncAction(action);
  }

  new MutationObserver(records => {
    for (const record of records) {
      syncNearest(record.target);
      if (record.type === 'childList') for (const node of record.addedNodes) scanAdded(node);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true,
    attributes: true, attributeFilter: ['aria-label', 'title', 'value'] });
  addEventListener('hashchange', scanPage);
  addEventListener('popstate', scanPage);
  scanPage();
});
