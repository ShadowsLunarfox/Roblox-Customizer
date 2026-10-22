/* Advisory only: observe known page markers, never change another extension. */
(() => {
  'use strict';
  if (globalThis.top && globalThis.top !== globalThis || globalThis.RobloxCustomizerExtensionWarning) return;
  const extensions = [
    // Public Chrome Web Store IDs; a link to the store is not a detection.
    { key: 'btroblox', name: 'BTRoblox', id: 'hbkpclpemjeibhioopcebchdmohaieln' },
    { key: 'ropro', name: 'RoPro', id: 'adbacgifemdbhdkfppmeilbgppmhaobf' },
    { key: 'rogold', name: 'RoGold', id: 'mafcicncghogpdpaieifglifaagndbni' },
    { key: 'rogold-ultimate', name: 'RoGold Ultimate', id: 'namkakclifhmccmkbeddddpjegmdimed' },
    { key: 'roseal', name: 'RoSeal', id: 'hfjngafpndganmdggnapblamgbfjhnof' }
  ];
  const keyFor = extension => `rcExtensionWarningAcknowledged:${extension.key}`;
  const resourceSelector = 'link[rel~="stylesheet"][href^="chrome-extension://"], script[src^="chrome-extension://"], '
    + 'img[src^="chrome-extension://"], iframe[src^="chrome-extension://"]';
  const btrSelector = '[btr-loaded="true"], #btr-detect-content, .btr-settings-toggle';
  const selector = `${btrSelector}, ${resourceSelector}`;
  const detected = new Set();
  const acknowledged = new Set();
  const batches = [];
  let ready = false;
  let checkTimer = 0;
  let scanTimer = 0;
  let scanIterator = null;
  let dialog = null;
  let previousFocus = null;
  let saveQueue = Promise.resolve();
  const i18n = globalThis.RobloxCustomizerI18n;
  const unacknowledged = () => extensions.some(extension => detected.has(extension.key) && !acknowledged.has(extension.key));

  function updateDialog() {
    if (!dialog) return;
    const list = dialog.querySelector('ul');
    for (const extension of extensions) {
      if (!detected.has(extension.key) || list.querySelector(`[data-extension="${extension.key}"]`)) continue;
      const item = document.createElement('li');
      item.dataset.extension = extension.key;
      item.setAttribute('translate', 'no');
      item.textContent = extension.name;
      list.append(item);
    }
    i18n?.localize(dialog);
  }

  function closeDialog(remember = false) {
    if (!dialog) return;
    const current = dialog;
    dialog = null;
    if (remember) {
      const values = {};
      for (const extension of extensions) if (detected.has(extension.key)) {
        acknowledged.add(extension.key);
        values[keyFor(extension)] = true;
      }
      // Separate keys let different tabs acknowledge different extensions
      // without overwriting each other's notice history.
      saveQueue = saveQueue.then(() => chrome.storage.local.set(values)).catch(error => {
        console.warn('Roblox Customizer: Could not remember the extension notice.', error);
      });
    }
    current.close();
    current.remove();
    if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    previousFocus = null;
  }

  function check() {
    checkTimer = 0;
    if (!ready || !document.body || document.hidden) return;
    if (dialog && !dialog.isConnected) { dialog = null; previousFocus = null; }
    if (!unacknowledged()) { closeDialog(); return; }
    if (dialog) { updateDialog(); return; }
    // Onboarding, language warnings and native modal interactions finish first.
    // Do not open or accept the Terms of Service on behalf of this notice.
    if (globalThis.RobloxCustomizerTerms && !globalThis.RobloxCustomizerTerms.accepted()) return;
    if (document.querySelector('dialog[open], #rc-settings-overlay, [role="dialog"][aria-modal="true"]:not([hidden])')) return;
    previousFocus = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.id = 'rc-extension-warning-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rc-extension-warning-title');
    dialog.setAttribute('aria-describedby', 'rc-extension-warning-choice');
    dialog.innerHTML = `
      <h2 id="rc-extension-warning-title">Other Roblox extensions detected</h2>
      <div class="rc-extension-warning-content" tabindex="0" role="region" aria-label="Extension compatibility information">
        <p>The following extensions were detected running on this page:</p>
        <ul aria-label="Detected extensions"></ul>
        <p>Roblox Customizer makes extensive changes to the Roblox website's layout, styles, and some interactions. When another extension changes the same areas, these changes may affect one another, causing duplicate buttons or features, overlapping elements, misplaced content, or problems displaying or loading some content.</p>
        <p><strong id="rc-extension-warning-choice">You can keep using these extensions together. You do not have to choose just one.</strong> <span>You decide which extensions and features to keep. Roblox Customizer will not automatically disable other extensions or change their settings because of this notice.</span></p>
        <p>Detecting another extension does not mean a conflict will occur. If the page looks and works normally, you can continue without changing anything.</p>
        <p>If you notice a problem, you can try refreshing the page first. If it continues, you can choose to temporarily turn off overlapping features in an extension's settings, then refresh the page to check the result. You decide which extension's features to adjust; you do not need to uninstall an entire extension.</p>
      </div>
      <div class="rc-extension-warning-actions"><button type="button" autofocus>Got it, continue using Roblox</button></div>`;
    const current = dialog;
    current.querySelector('button').addEventListener('click', () => closeDialog(true));
    current.addEventListener('cancel', event => { event.preventDefault(); closeDialog(true); });
    current.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDialog(true); }
    });
    current.addEventListener('close', () => { if (dialog === current) closeDialog(true); });
    globalThis.RobloxCustomizerDialogs?.dismissOnOutside(current);
    document.body.append(current);
    updateDialog();
    current.showModal();
  }

  function queueCheck() {
    if (!checkTimer && ready && (dialog || unacknowledged())) checkTimer = setTimeout(check, 200);
  }

  function mark(key) {
    if (!extensions.some(extension => extension.key === key) || detected.has(key)) return;
    detected.add(key);
    queueCheck();
  }

  function inspect(element) {
    if (element.matches(btrSelector)) mark('btroblox');
    const value = element.matches('link[rel~="stylesheet"]') ? element.getAttribute('href')
      : element.matches('script, img, iframe') ? element.getAttribute('src') : null;
    if (!value?.startsWith('chrome-extension://')) return;
    let url;
    try { url = new URL(value); } catch { return; }
    const extension = extensions.find(extension => extension.id === url.hostname);
    if (extension) mark(extension.key);
  }

  function* scan() {
    while (batches.length) {
      const batch = batches.shift();
      const roots = new Set();
      for (const record of batch) {
        yield;
        if (record.type === 'attributes') {
          if (record.target.isConnected) inspect(record.target);
        } else for (const node of record.addedNodes) {
          yield;
          if (node.nodeType === 1) roots.add(node);
        }
      }
      for (const root of roots) {
        yield;
        if (!root.isConnected || root.closest('#rc-extension-warning-dialog')) continue;
        let parent = root.parentElement;
        while (parent && !roots.has(parent)) parent = parent.parentElement;
        if (parent) continue;
        inspect(root);
        if (!root.childElementCount) continue;
        for (const match of root.querySelectorAll(selector)) { yield; inspect(match); }
      }
    }
    queueCheck();
  }

  function flushScan() {
    scanTimer = 0;
    scanIterator ||= scan();
    const start = performance.now();
    while (performance.now() - start < 4) {
      if (scanIterator.next().done) { scanIterator = null; return; }
    }
    scanTimer = setTimeout(flushScan, 16);
  }

  function queueScan(records) {
    batches.push(records);
    if (globalThis.RobloxCustomizerRuntime?.queueWork) {
      globalThis.RobloxCustomizerRuntime.queueWork('extension-notice', scan);
    } else if (!scanTimer) scanTimer = setTimeout(flushScan, 16);
  }

  globalThis.RobloxCustomizerExtensionWarning = Object.freeze({
    detected: () => extensions.filter(extension => detected.has(extension.key)).map(extension => extension.name)
  });
  new MutationObserver(queueScan).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['src', 'href', 'btr-loaded', 'open'] });
  // Observe the public initialization signal without reading or changing its payload.
  document.addEventListener('btroblox/init', () => mark('btroblox'));
  document.addEventListener('visibilitychange', queueCheck);
  addEventListener('pageshow', queueCheck);
  i18n?.onChange(updateDialog);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const extension of extensions) {
      const change = changes[keyFor(extension)];
      if (!change) continue;
      if (change.newValue === true) acknowledged.add(extension.key);
      else acknowledged.delete(extension.key);
    }
    queueCheck();
  });
  const documentReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
  Promise.all([chrome.storage.local.get(extensions.map(keyFor)).catch(() => ({})), documentReady]).then(([saved]) => {
    for (const extension of extensions) if (saved[keyFor(extension)] === true) acknowledged.add(extension.key);
    ready = true;
    queueScan([{ type: 'childList', addedNodes: document.documentElement ? [document.documentElement] : [] }]);
  });
})();
