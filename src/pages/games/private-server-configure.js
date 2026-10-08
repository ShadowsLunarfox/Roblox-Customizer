(() => {
  'use strict';

  const ROUTE = /^\/private-server\/configure(?:\/\d+)?\/?$/i;
  const PANEL = '.section, .section-content, .section-container, .configuration-section, '
    + '[data-slot="card"], .bg-surface-100, .bg-surface-200';
  const FLOATING = '.modal, [role="dialog"], [role="alertdialog"], .popover, .dropdown-menu, [role="menu"]';
  const HIDDEN = '.hidden, .hide, .ng-hide, .ng-cloak, [hidden], [ng-cloak]';
  const MARK = 'data-rc-private-config-panel';
  const tracked = new Set();
  let queued = false;

  function synchronize() {
    queued = false;
    const desired = new Set();
    const content = ROUTE.test(location.pathname) && document.querySelector('#content');
    if (content) {
      // Keep native forms and handlers intact, including sections loaded later.
      const candidates = [...content.querySelectorAll(PANEL)].filter(node =>
        !node.closest(FLOATING) && !node.closest(HIDDEN));
      for (const node of candidates) {
        if (!candidates.some(parent => parent !== node && parent.contains(node))) desired.add(node);
      }
      // Newer layouts can use only utility wrappers, without named sections.
      if (!desired.size && content.querySelector('form, input, button, [role="switch"]')) desired.add(content);
    }
    // Include copied markers from native remounts when clearing old sections.
    const previous = new Set([...tracked, ...document.querySelectorAll(`[${MARK}]`)]);
    for (const node of previous) if (!desired.has(node)) node.removeAttribute(MARK);
    for (const node of desired) if (!node.hasAttribute(MARK)) node.setAttribute(MARK, '');
    tracked.clear();
    for (const node of desired) tracked.add(node);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(synchronize);
  }

  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'role', 'data-slot', 'hidden']
  });
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
