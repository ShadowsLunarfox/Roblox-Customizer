(() => {
  'use strict';

  const attributes = new Map();
  let queued = false;
  const CONTENT_SELECTOR = '#info, #robux, #security, #privacy, #notifications, '
    + '#browser-preferences, #parental-controls, .settings-content, .settings-tab-content, '
    + '.rbx-tab-content, .tab-content, [role="tabpanel"]';
  const PANEL_SELECTOR = '.setting-section, .settings-section, .section, .section-content, [data-slot="card"]';
  const FLOATING_SELECTOR = '.modal, [role="dialog"], [role="alertdialog"], .popover, .dropdown-menu, [role="menu"]';
  const EDIT_SELECTOR = '.btn-generic-edit-sm, .btn-generic-edit-md';
  const FIELD_SELECTOR = 'select, textarea, input:not([type="hidden"], [type="checkbox"], '
    + '[type="radio"], [type="range"], [type="button"], [type="submit"], [type="reset"]), '
    + '.input-dropdown-btn, [role="combobox"]';
  const FIELD_LABEL = ':scope > :is(label, .form-control-label, .text-label)';
  const CONTENT_ATOMS = 'h1, h2, h3, h4, h5, h6, p, label, input:not([type="hidden"]), '
    + 'select, textarea, button, [role="heading"], [role="button"], [role="combobox"], [role="switch"], [role="radio"], '
    + ':is(div, span):not(:has(*)):not(:empty)';
  const HIDDEN_SELECTOR = '.hidden, .hide, .ng-hide, .ng-cloak, [hidden], [ng-cloak]';
  const MANAGED_ATTRIBUTES = [
    'data-rc-settings-panel', 'data-rc-settings-surface', 'data-rc-settings-row', 'data-rc-settings-row-action',
    'data-rc-settings-field', 'data-rc-settings-control', 'data-rc-settings-choice', 'data-rc-settings-layout', 'data-rc-settings-nav',
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

  function pageHeading(node) {
    const text = node.textContent.trim();
    return node.matches('h1') || !!node.querySelector('h1')
      || text.length < 40 && (/^(?:my\s+)?settings$/i.test(text)
        || globalThis.RobloxCustomizerNativeLabels?.matches('settings', text));
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
          !node.closest(FLOATING_SELECTOR) && !node.closest(HIDDEN_SELECTOR) && !navigation?.contains(node)
          && !node.contains(navigation) && !node.matches(CONTENT_SELECTOR));
        const panels = candidates.filter(node => {
          if (node.matches('.setting-section, .settings-section, [data-slot="card"]')) return true;
          if (node.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > .container-header, :scope > .section-header')) return true;
          return !node.querySelector(PANEL_SELECTOR);
        });
        // A section and its own section-content are one card, not two backings.
        const panelRoots = panels.filter(node => !panels.some(parent => parent !== node && parent.contains(node)));
        for (const panel of panelRoots) {
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
        }
        // Inputs can be nested in narrow native wrappers, including plain tabs
        // that have no named panel. Give each control its nearest labeled field.
        for (const control of content.querySelectorAll(FIELD_SELECTOR)) {
          if (navigation?.contains(control) || control.closest(FLOATING_SELECTOR)
            || control.closest(HIDDEN_SELECTOR)) continue;
          for (let field = control.parentElement; field && field !== content; field = field.parentElement) {
            if (!field.querySelector(FIELD_LABEL)) continue;
            if (field.matches('form, fieldset') || field.querySelector('h1, h2, h3, [role="heading"]')) break;
            if (!field.matches('.form-group') && field.querySelectorAll(FIELD_SELECTOR).length > 1) continue;
            if (desired.get(field)?.has('data-rc-settings-row')) break;
            mark(field, 'data-rc-settings-field');
            for (let wrapper = control.parentElement; wrapper && wrapper !== field; wrapper = wrapper.parentElement) {
              // A shared birthday/select row keeps its native multi-column layout.
              if (wrapper.querySelectorAll(FIELD_SELECTOR).length > 1) break;
              mark(wrapper, 'data-rc-settings-control');
            }
            break;
          }
        }
        // Compact Foundation choices can be buttons with an external label.
        // Text-bearing theme cards keep their larger native click targets.
        for (const choice of content.querySelectorAll('[role="radio"], [role="checkbox"]')) {
          if (!choice.matches('input') && !choice.textContent.trim()
            && !choice.closest(FLOATING_SELECTOR) && !choice.closest(HIDDEN_SELECTOR)
            && !navigation?.contains(choice)) mark(choice, 'data-rc-settings-choice');
        }
        if (navigation) {
          const bodies = [...content.querySelectorAll(CONTENT_SELECTOR + ', ' + PANEL_SELECTOR)]
            .filter(node => !navigation.contains(node) && !node.contains(navigation)
              && !node.closest(FLOATING_SELECTOR) && !node.closest(HIDDEN_SELECTOR));
          // React settings views can be plain wrappers without any legacy
          // section classes. Locate their branch beside the native navigation.
          if (!bodies.length) {
            for (let parent = navigation.parentElement; parent; parent = parent.parentElement) {
              const navBranch = branchUnder(navigation, parent);
              const branches = [...parent.children].filter(node => node !== navBranch
                && !node.matches('script, style, template, link, ' + FLOATING_SELECTOR)
                && !node.closest(HIDDEN_SELECTOR)
                && !pageHeading(node)
                && (node.querySelector('h2, h3, h4, h5, h6, [role="heading"], form, [role="tabpanel"]')
                  || node.textContent.trim().length > 0));
              if (branches.length) { bodies.push(...branches); break; }
              if (parent === content) break;
            }
          }
          let layout = navigation.parentElement;
          while (layout && layout !== content && !bodies.every(node => layout.contains(node))) layout = layout.parentElement;
          if (layout && bodies.length && layout.contains(navigation)) {
            const navBranch = branchUnder(navigation, layout);
            const bodyBranches = [...layout.children].filter(node => node !== navBranch
              && !node.matches('script, style, template, link, ' + FLOATING_SELECTOR));
            const headings = bodyBranches.filter(node => !bodies.some(body => node === body || node.contains(body))
              && pageHeading(node));
            const columns = bodyBranches.filter(node => !headings.includes(node));
            if (navBranch && columns.some(node => bodies.some(body => node === body || node.contains(body)))) {
              mark(layout, 'data-rc-settings-layout');
              mark(navBranch, 'data-rc-settings-nav');
              mark(navigation, 'data-rc-settings-menu');
              for (let wrapper = navigation.parentElement; wrapper && wrapper !== layout; wrapper = wrapper.parentElement) {
                mark(wrapper, 'data-rc-settings-nav-wrapper');
              }
              columns.forEach(node => mark(node, 'data-rc-settings-body'));
              for (const column of columns) {
                // One complete surface also covers mixed tabs, such as legacy
                // security cards followed by an unwrapped device-session list.
                const uncovered = [...column.querySelectorAll(CONTENT_ATOMS)].some(node =>
                  (node.textContent.trim() || node.matches('input, select, textarea, button, [role="button"], [role="combobox"], [role="switch"], [role="radio"]'))
                  && !node.closest(FLOATING_SELECTOR) && !node.closest(HIDDEN_SELECTOR)
                  && !panelRoots.some(panel => panel === node || panel.contains(node)));
                if (uncovered) mark(column, 'data-rc-settings-surface');
              }
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
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['class', 'href', 'hidden', 'role', 'aria-selected', 'data-rc-frost-page']
  });
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  globalThis.RobloxCustomizerRuntime?.onResume(schedule);
  document.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})();
