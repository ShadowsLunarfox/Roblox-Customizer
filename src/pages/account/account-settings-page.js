(() => {
  'use strict';

  const attributes = new Map();
  let queued = false;
  const CONTENT_SELECTOR = '#info, #robux, .settings-content, .settings-tab-content, '
    + '.rbx-tab-content, .tab-content, [role="tabpanel"]';
  const PANEL_SELECTOR = '.setting-section, .settings-section, .section, .section-content, [data-slot="card"]';
  const FLOATING_SELECTOR = '.modal, [role="dialog"], [role="alertdialog"], .popover, .dropdown-menu, [role="menu"]';
  const EDIT_SELECTOR = '.btn-generic-edit-sm, .btn-generic-edit-md';
  const FIELD_SELECTOR = 'select, textarea, input:not([type="hidden"], [type="checkbox"], '
    + '[type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"])';
  const MANAGED_ATTRIBUTES = [
    'data-rc-settings-panel', 'data-rc-settings-row', 'data-rc-settings-row-action',
    'data-rc-settings-field', 'data-rc-settings-layout', 'data-rc-settings-nav',
    'data-rc-settings-menu', 'data-rc-settings-nav-wrapper', 'data-rc-settings-body',
    'data-rc-settings-content-wrapper', 'data-rc-settings-heading',
    'data-rc-settings-tab', 'data-rc-settings-active-tab'
  ];
  const TAB_NAMES = new Set([
    'info', 'security', 'privacy', 'notifications', 'billing', 'paymentmethods',
    'payment-methods', 'robux', 'subscriptions', 'parental-controls', 'parentalcontrols',
    'app-permissions', 'apppermissions', 'browser-preferences', 'browserpreferences'
  ]);

  function tabName(link) {
    const href = link.getAttribute('href');
    if (!href) return '';
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin || !/^\/my\/account\/?$/i.test(url.pathname)) return '';
      const name = url.hash.replace(/^#!?\/?/, '').split(/[/?]/)[0].toLowerCase();
      return TAB_NAMES.has(name) ? name : '';
    } catch { return ''; }
  }

  function branchUnder(node, parent) {
    let branch = node;
    while (branch?.parentElement && branch.parentElement !== parent) branch = branch.parentElement;
    return branch?.parentElement === parent ? branch : null;
  }

  function synchronize() {
    queued = false;
    const desired = new Map();
    const mark = (node, name) => {
      if (!node) return;
      if (!desired.has(node)) desired.set(node, new Set());
      desired.get(node).add(name);
    };

    if (/^\/my\/account\/?$/i.test(location.pathname)) {
      const content = document.querySelector('#content');
      if (content) {
        const links = [...content.querySelectorAll('a[href]')].filter(link => tabName(link));
        const menus = [...content.querySelectorAll('.settings-left-navigation, .menu-vertical, [role="tablist"], nav')];
        const menu = menus.filter(node => links.filter(link => node.contains(link)).length >= 2)
          .sort((a, b) => a.contains(b) ? 1 : b.contains(a) ? -1 : 0)[0];
        // Tabs can also be buttons. Known native navigation remains usable in
        // that version without interpreting account fields or localized copy.
        const navigation = menu || menus
          .find(node => node.querySelectorAll('[role="tab"], .menu-option, button').length >= 2);
        // Robux and newer tabs use section-content or Foundation cards rather
        // than Account Info's setting-section. Mark one surface per panel.
        const candidates = [...content.querySelectorAll(PANEL_SELECTOR)].filter(node =>
          !node.closest(FLOATING_SELECTOR) && !navigation?.contains(node)
          && !node.contains(navigation) && !node.matches(CONTENT_SELECTOR));
        const panels = candidates.filter(node => {
          if (node.matches('.setting-section, .settings-section, [data-slot="card"]')) return true;
          if (node.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > .container-header, :scope > .section-header')) return true;
          return !node.querySelector(PANEL_SELECTOR);
        });
        // A section and its own section-content are one card, not two backings.
        for (const panel of panels.filter(node => !panels.some(parent => parent !== node && parent.contains(node)))) {
          mark(panel, 'data-rc-settings-panel');
          const rows = new Set(panel.querySelectorAll('.account-info-row, .account-row'));
          for (const edit of panel.querySelectorAll(EDIT_SELECTOR)) {
            // Native Account Info variants also use unnamed row wrappers. Stop
            // before a whole section, form, or multi-control group is reached.
            for (let row = edit.parentElement; row && row !== panel; row = row.parentElement) {
              if (row.matches('form, .section, .section-content, .setting-section')
                || row.querySelector('h1, h2, h3, ' + FIELD_SELECTOR)
                || row.querySelectorAll(EDIT_SELECTOR).length > 1) break;
              const branch = branchUnder(edit, row);
              if (branch && [...row.children].some(node => node !== branch && node.textContent.trim())) {
                rows.add(row);
                break;
              }
            }
          }
          for (const row of rows) {
            if (row.closest(FLOATING_SELECTOR)) continue;
            const edit = row.querySelector(EDIT_SELECTOR + ', button');
            const action = edit && branchUnder(edit, row);
            mark(row, 'data-rc-settings-row');
            if (action) mark(action, 'data-rc-settings-row-action');
          }
          for (const field of panel.querySelectorAll('.form-group')) {
            if (!field.closest(FLOATING_SELECTOR) && !rows.has(field)
              && field.querySelector(':scope > label, :scope > .form-control-label')
              && field.querySelector(FIELD_SELECTOR)) mark(field, 'data-rc-settings-field');
          }
        }
        if (navigation) {
          const bodies = [...content.querySelectorAll(CONTENT_SELECTOR + ', ' + PANEL_SELECTOR)]
            .filter(node => !navigation.contains(node) && !node.contains(navigation)
              && !node.closest(FLOATING_SELECTOR));
          let layout = navigation.parentElement;
          while (layout && layout !== content && !bodies.every(node => layout.contains(node))) layout = layout.parentElement;
          if (layout && bodies.length && layout.contains(navigation)) {
            const navBranch = branchUnder(navigation, layout);
            const bodyBranches = [...layout.children].filter(node => node !== navBranch
              && !node.matches('script, style, template, link, ' + FLOATING_SELECTOR));
            const headings = bodyBranches.filter(node => !bodies.some(body => node === body || node.contains(body))
              && (node.matches('h1') || node.querySelector('h1')
                || (node.textContent.trim().length < 40 && /^(?:my\s+)?settings$/i.test(node.textContent.trim()))));
            const columns = bodyBranches.filter(node => !headings.includes(node));
            if (navBranch && columns.some(node => bodies.some(body => node === body || node.contains(body)))) {
              mark(layout, 'data-rc-settings-layout');
              mark(navBranch, 'data-rc-settings-nav');
              mark(navigation, 'data-rc-settings-menu');
              for (let wrapper = navigation.parentElement; wrapper && wrapper !== layout; wrapper = wrapper.parentElement) {
                mark(wrapper, 'data-rc-settings-nav-wrapper');
              }
              columns.forEach(node => mark(node, 'data-rc-settings-body'));
              for (const body of bodies) {
                for (let wrapper = body.parentElement; wrapper && wrapper !== layout; wrapper = wrapper.parentElement) {
                  mark(wrapper, 'data-rc-settings-content-wrapper');
                }
              }
              headings.forEach(node => mark(node, 'data-rc-settings-heading'));
              const span = String(Math.max(1, columns.filter(node => !node.hidden
                && !node.matches('.ng-hide, .hidden, .ng-cloak, [ng-cloak]')).length));
              if (layout.style.getPropertyValue('--rc-settings-body-rows') !== span) {
                layout.style.setProperty('--rc-settings-body-rows', span);
              }
              const current = location.hash.replace(/^#!?\/?/, '').split(/[/?]/)[0].toLowerCase() || 'info';
              for (const link of links.filter(node => navigation.contains(node))) {
                mark(link, 'data-rc-settings-tab');
                if (tabName(link) === current) mark(link, 'data-rc-settings-active-tab');
              }
              for (const control of navigation.querySelectorAll('.menu-option-content, [role="tab"]')) {
                mark(control, 'data-rc-settings-tab');
                if (control.getAttribute('aria-selected') === 'true') mark(control, 'data-rc-settings-active-tab');
              }
            }
          }
        }
      }
    }

    // Native remounts can copy marked HTML. Include those nodes so stale marks
    // are also removed when a card changes structure or navigation leaves settings.
    const tracked = new Set([...attributes.keys(), ...document.querySelectorAll(
      MANAGED_ATTRIBUTES.map(name => `[${name}]`).join(', ')
    )]);
    for (const node of tracked) {
      for (const name of MANAGED_ATTRIBUTES) {
        if (desired.get(node)?.has(name)) continue;
        if (!node.hasAttribute(name)) continue;
        node.removeAttribute(name);
        if (name === 'data-rc-settings-layout') node.style.removeProperty('--rc-settings-body-rows');
      }
    }
    for (const [node, names] of desired) {
      for (const name of names) if (!node.hasAttribute(name)) node.setAttribute(name, '');
    }
    attributes.clear();
    for (const [node, names] of desired) attributes.set(node, names);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(synchronize);
  }

  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'href', 'hidden', 'role', 'aria-selected', 'data-rc-frost-page']
  });
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
