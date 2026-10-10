(() => {
  'use strict';

  const ROUTE = /^\/private-server\/configure(?:\/\d+)?\/?$/i;
  const PANEL = '.section, .section-content, .section-container, .configuration-section, '
    + '[data-slot="card"], .bg-surface-100, .bg-surface-200';
  const FLOATING = '.modal, [role="dialog"], [role="alertdialog"], .popover, .dropdown-menu, [role="menu"]';
  const HIDDEN = '.hidden, .hide, .ng-hide, .ng-cloak, [hidden], [ng-cloak]';
  const CONTENT = 'h2, h3, h4, p, label, img, a[href], input:not([type="hidden"]), '
    + 'select, textarea, button, [role="button"], [role="switch"], [role="combobox"], '
    + ':is(div, span):not(:has(*)):not(:empty)';
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
      // The summary can contain just artwork, text, and an inline edit link.
      // It also needs a backing when later controls use recognized sections.
      const visibleContent = [...content.querySelectorAll(CONTENT)].filter(node =>
        !node.closest(FLOATING) && !node.closest(HIDDEN)
        && (node.textContent.trim() || node.matches('img, input, select, textarea, button, [role="button"], [role="switch"], [role="combobox"]')));
      if (visibleContent.some(node => ![...desired].some(panel => panel === node || panel.contains(node)))) {
        desired.clear();
        desired.add(content);
      }
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
  globalThis.RobloxCustomizerRuntime?.onResume(schedule);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
