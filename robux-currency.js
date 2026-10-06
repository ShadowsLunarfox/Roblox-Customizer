(function () {
  'use strict';
  const core = globalThis.RobloxCustomizerCurrencyCore;
  if (!core || globalThis.RobloxCustomizerCurrency) return;
  const VALUE_SELECTOR = '[class*="text-robux"], #nav-robux-amount, #nav-robux-balance, #robux-balance, .robux-balance, .robux-amount, .robux-text, [data-testid*="robux"], [data-testid*="Robux"], input[aria-label*="Robux"], input[aria-label*="robux"]';
  const ICON_SELECTOR = '[class*="icon-robux"], [class*="robux-icon"], [data-testid*="robux-icon"], [data-testid*="RobuxIcon"], [data-icon="Robux"], [data-icon="robux"], [title="Robux"], svg[aria-label="Robux"], img[alt="Robux"]';
  const AXIS_SELECTOR = '#price-chart .highcharts-yaxis-labels.highcharts-yaxis-labels-0 text';
  const OWN_SELECTOR = '.rc-robux-equivalent, #rc-settings-overlay, .rc-settings-currency';
  const STACK_SELECTOR = '.item-card-price, .store-card-price, .store-product-card-price, .price-container-text, .reseller-price-container, .item-card-container .price-container';
  const entries = new Map();
  const roots = new Set();
  const stackedHosts = new Set();
  const balanceHosts = new Set();
  let settings = { ...core.DEFAULTS };
  let snapshot = null;
  let timer = null;
  let loading = false;
  let started = false;
  let writeQueue = Promise.resolve();
  let names;
  try { names = new Intl.DisplayNames(navigator.language, { type: 'currency' }); } catch { /* ISO codes remain available. */ }

  function isOwn(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!element?.closest(OWN_SELECTOR);
  }

  function nativeText(element) {
    let value = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) value += node.nodeValue;
      else if (node.nodeType === Node.ELEMENT_NODE && !node.matches('.rc-robux-equivalent, svg, img, [class*="icon-robux"], [class*="robux-icon"]')) value += nativeText(node);
    }
    return value;
  }

  function amountOf(target) {
    const text = target.nodeType === Node.TEXT_NODE ? target.nodeValue : target.matches('input') ? target.value : nativeText(target);
    return core.parseRobux(text) ?? (target.nodeType === Node.TEXT_NODE ? core.parseRobux(text.trim().replace(/[.!]$/, '')) : null);
  }

  function numericTarget(element) {
    if (!element || isOwn(element) || element.matches('script, style, textarea, [contenteditable="true"]')) return null;
    if (element.matches('input')) return amountOf(element) === null ? null : element;
    if (element.namespaceURI === 'http://www.w3.org/2000/svg') return null;
    if (amountOf(element) === null) return null;
    for (const child of element.children) {
      if (child.matches('.rc-robux-equivalent, svg, img, [class*="icon-robux"], [class*="robux-icon"]')) continue;
      const target = numericTarget(child);
      if (target) return target;
    }
    // Keep the native numeric element's textContent untouched when an icon shares its parent.
    if (element.querySelector(ICON_SELECTOR)) {
      for (const node of element.childNodes) if (node.nodeType === Node.TEXT_NODE && amountOf(node) !== null) return node;
    }
    return element;
  }

  function add(target, svg = false) {
    if (!target || isOwn(target) || amountOf(target) === null || entries.has(target)) return;
    const label = svg ? document.createElementNS('http://www.w3.org/2000/svg', 'title') : document.createElement('span');
    label.classList.add('rc-robux-equivalent');
    entries.set(target, { label, svg, amount: null, text: '' });
    render(target, entries.get(target));
  }

  function render(target, entry) {
    const amount = amountOf(target);
    const result = core.convert(amount, settings.currency, snapshot);
    if (!result) { entry.label.remove(); return; }
    const text = core.format(result, navigator.language);
    if (entry.label.textContent !== text) entry.label.textContent = text;
    if (!entry.svg) entry.label.title = core.description(result);
    entry.amount = amount;
    entry.text = text;
    const element = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    const balanceAmount = element.closest('#nav-robux-amount');
    const headerBalance = balanceAmount?.closest('a, button');
    const stack = element.closest(STACK_SELECTOR);
    if (stack) { stack.setAttribute('data-rc-currency-stack', ''); stackedHosts.add(stack); }
    if (headerBalance) {
      headerBalance.setAttribute('data-rc-currency-balance', '');
      balanceHosts.add(headerBalance);
    }
    if (entry.svg) {
      if (entry.label.parentNode !== target) target.append(entry.label);
    } else if (headerBalance) {
      // Place the estimate beside the native Robux branch, before any wallet or caret.
      // Keep React's amount element and its descendants untouched.
      let anchor = balanceAmount;
      while (anchor.parentElement && anchor.parentElement !== headerBalance && anchor !== headerBalance) anchor = anchor.parentElement;
      if (anchor.parentElement === headerBalance) {
        if (anchor.nextSibling !== entry.label) anchor.after(entry.label);
      } else if (entry.label.parentNode !== headerBalance) headerBalance.append(entry.label);
    } else {
      const anchor = target.nodeType === Node.TEXT_NODE && element.matches(VALUE_SELECTOR) ? element : target;
      if (anchor.nextSibling !== entry.label) anchor.after(entry.label);
    }
  }

  function discover(root) {
    if (!root?.isConnected || isOwn(root)) return;
    const element = root.nodeType === Node.ELEMENT_NODE ? root : root.parentElement;
    if (!element) return;
    const select = selector => [ ...(element.matches(selector) ? [element] : []), ...element.querySelectorAll(selector) ];
    for (const candidate of select(VALUE_SELECTOR)) add(numericTarget(candidate));
    for (const icon of select(ICON_SELECTOR)) {
      if (isOwn(icon)) continue;
      let sibling = icon.nextSibling;
      let found = null;
      for (let i = 0; sibling && i < 4; i++, sibling = sibling.nextSibling) {
        if (sibling.nodeType === Node.TEXT_NODE && amountOf(sibling) !== null) { found = sibling; break; }
        if (sibling.nodeType === Node.ELEMENT_NODE) {
          if (sibling.matches('.rc-robux-equivalent')) continue;
          found = numericTarget(sibling);
          if (found) break;
          if (sibling.textContent.trim()) break;
        }
      }
      if (!found) found = numericTarget(icon.parentElement);
      add(found);
    }
    for (const axis of select(AXIS_SELECTOR)) if (amountOf(axis) !== null) add(axis, true);
  }

  function clear() {
    for (const entry of entries.values()) entry.label.remove();
    entries.clear();
    for (const host of stackedHosts) host.removeAttribute('data-rc-currency-stack');
    for (const host of balanceHosts) host.removeAttribute('data-rc-currency-balance');
    stackedHosts.clear();
    balanceHosts.clear();
  }

  function flush() {
    timer = null;
    if (!settings.enabled) { roots.clear(); clear(); return; }
    const pendingRoots = [...roots];
    roots.clear();
    for (const root of pendingRoots) if (!pendingRoots.some(other => other !== root && other.contains(root))) discover(root);
    for (const [target, entry] of entries) {
      if (!target.isConnected || isOwn(target)) { entry.label.remove(); entries.delete(target); }
      else render(target, entry);
    }
    for (const host of stackedHosts) if (!host.isConnected || !host.querySelector('.rc-robux-equivalent')) { host.removeAttribute('data-rc-currency-stack'); stackedHosts.delete(host); }
    for (const host of balanceHosts) if (!host.isConnected || !host.querySelector('.rc-robux-equivalent')) { host.removeAttribute('data-rc-currency-balance'); balanceHosts.delete(host); }
    refreshPanels();
  }

  function queue(root) {
    if (root) roots.add(root);
    if (timer === null) timer = setTimeout(flush, 80);
  }

  async function loadRates(force = false) {
    if (loading) return;
    loading = true;
    refreshPanels();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'rc-currency-rates', force });
      snapshot = response?.ok ? response : null;
    } catch { /* Local price references still work offline. */ }
    finally { loading = false; queue(); refreshPanels(); }
  }

  function save(next) {
    settings = core.normalizeSettings(next);
    queue(document.body);
    refreshPanels();
    if (settings.enabled && !core.PURCHASE_PRICES[settings.currency] && !snapshot) loadRates();
    const saved = { ...settings };
    writeQueue = writeQueue.catch(() => {}).then(() => chrome.storage.local.set({ [core.STORAGE_KEY]: saved })).catch(() => {
      for (const panel of document.querySelectorAll('.rc-settings-currency')) panel.querySelector('[data-currency-status]').textContent = 'Could not save. Try changing the currency again.';
    });
  }

  function refreshPanels() {
    for (const panel of document.querySelectorAll('.rc-settings-currency')) {
      panel.querySelector('[data-currency-enabled]').checked = settings.enabled;
      const select = panel.querySelector('[data-currency-select]');
      if (!select.querySelector(`option[value="${settings.currency}"]`)) {
        const option = document.createElement('option');
        option.value = settings.currency;
        option.textContent = `${settings.currency} — ${names?.of(settings.currency) || settings.currency}`;
        select.append(option);
      }
      select.value = settings.currency;
      const balance = document.querySelector('#nav-robux-amount, #nav-robux-balance');
      const amount = balance ? amountOf(balance) : null;
      const result = core.convert(amount ?? 500, settings.currency, snapshot);
      panel.querySelector('[data-currency-preview]').textContent = result ? `${amount === null ? 'Example' : 'Your balance'}: ${(amount ?? 500).toLocaleString(navigator.language)} Robux ${core.format(result, navigator.language)}` : 'Rates for this currency are unavailable. Use Refresh rates to try again.';
      panel.querySelector('[data-currency-preview]').title = core.description(result);
      panel.querySelector('[data-currency-refresh]').disabled = loading;
      panel.querySelector('[data-currency-status]').textContent = loading ? 'Updating exchange rates…' : core.PURCHASE_PRICES[settings.currency] ? 'Using a reference purchase price. Actual checkout prices may vary.' : snapshot?.rates?.[settings.currency] ? `Exchange rates: ${snapshot.date}${snapshot.stale ? ' · cached, refresh unavailable' : ''}` : 'No exchange rate available. Other currencies may still be available.';
    }
  }

  function mountSettings(panel) {
    if (!panel || panel.querySelector('[data-currency-select]')) return;
    panel.classList.add('rc-settings-currency');
    panel.innerHTML = `
      <h3>Robux currency converter</h3>
      <label class="rc-settings-toggle"><input type="checkbox" data-currency-enabled> Show currency equivalents across Roblox</label>
      <label for="rc-currency-search">Find a currency</label>
      <input id="rc-currency-search" type="search" placeholder="Currency name or code" autocomplete="off">
      <label for="rc-currency-select">Currency</label>
      <select id="rc-currency-select" data-currency-select></select>
      <p class="rc-currency-help">Displays an estimated purchase equivalent. This does not exchange your Robux.</p>
      <output data-currency-preview aria-live="polite"></output>
      <button type="button" class="rc-button rc-button-secondary" data-currency-refresh>Refresh rates</button>
      <p data-currency-status role="status"></p>`;
    const select = panel.querySelector('[data-currency-select]');
    const search = panel.querySelector('input[type="search"]');
    const options = core.CURRENCIES.map(code => ({ code, name: names?.of(code) || code }));
    function populate() {
      const query = search.value.trim().toLocaleLowerCase();
      select.replaceChildren();
      for (const option of options) {
        if (option.code !== settings.currency && !`${option.code} ${option.name}`.toLocaleLowerCase().includes(query)) continue;
        const node = document.createElement('option');
        node.value = option.code;
        node.textContent = `${option.code} — ${option.name}`;
        select.append(node);
      }
      select.value = settings.currency;
    }
    populate();
    search.addEventListener('input', populate);
    select.addEventListener('change', () => save({ ...settings, currency: select.value }));
    panel.querySelector('[data-currency-enabled]').addEventListener('change', event => save({ ...settings, enabled: event.target.checked }));
    panel.querySelector('[data-currency-refresh]').addEventListener('click', () => loadRates(true));
    refreshPanels();
  }

  function start() {
    if (started || !document.body) return;
    started = true;
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (isOwn(record.target)) continue;
        if (record.type === 'childList') {
          const nodes = [...record.addedNodes, ...record.removedNodes];
          if (nodes.length && nodes.every(node => node.nodeType === Node.ELEMENT_NODE && node.matches('.rc-robux-equivalent'))) continue;
          for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE && !isOwn(node)) queue(node);
        }
        // Scan a small surrounding subtree for icons and values split across siblings.
        const element = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        if (element && element !== document.body && element !== document.documentElement) queue(element.parentElement || element);
        else queue();
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-testid', 'aria-label', 'value'] });
    for (const event of ['input', 'change']) document.addEventListener(event, event => {
      if (event.target.matches?.('input') && !isOwn(event.target)) queue(event.target.parentElement);
    }, true);
    queue(document.body);
  }

  globalThis.RobloxCustomizerCurrency = Object.freeze({ mountSettings });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[core.STORAGE_KEY]) {
      settings = core.normalizeSettings(changes[core.STORAGE_KEY].newValue);
      queue(document.body);
      refreshPanels();
      if (settings.enabled && !core.PURCHASE_PRICES[settings.currency] && !snapshot?.rates?.[settings.currency]) loadRates();
    }
    if (changes[core.RATE_STORAGE_KEY]) {
      const clean = core.sanitizeRates(changes[core.RATE_STORAGE_KEY].newValue);
      if (clean) { snapshot = { ...clean, stale: false }; queue(); }
    }
  });
  chrome.storage.local.get(core.STORAGE_KEY).then(stored => {
    settings = core.normalizeSettings(stored[core.STORAGE_KEY]);
    queue(document.body);
    if (settings.enabled) loadRates();
  }).catch(() => { if (settings.enabled) loadRates(); });
  setInterval(() => { if (settings.enabled) loadRates(); }, 3600000);
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
