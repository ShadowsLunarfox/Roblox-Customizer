/* A bounded, tab-local trace of avatar startup. Never collect page text or URLs. */
(() => {
  'use strict';
  if (globalThis.RobloxCustomizerAvatarDiagnostics) return;
  const BUILD = 'avatar-load-20261022-4';
  const entries = [];
  const nodes = new WeakMap();
  const writes = [];
  const started = performance.now();
  let nextNode = 0;
  let dropped = 0;
  let lastLayout = '';
  let currentLayout = null;
  let dialog = null;
  const onAvatar = () => /^\/my\/avatar(?:\/|$)/i.test(
    globalThis.RobloxCustomizerRoutes?.pathname() ?? location.pathname);
  const state = value => ['pending', 'ready', 'full', 'fallback'].includes(value) ? value : null;
  const nodeId = node => {
    if (!node || typeof node !== 'object') return 0;
    if (!nodes.has(node)) nodes.set(node, ++nextNode);
    return nodes.get(node);
  };
  const language = () => {
    const value = document.querySelector('meta[name="locale-data"]')?.getAttribute('data-language-code')
      || document.documentElement?.lang || '';
    return /^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(value) ? value : 'unknown';
  };
  function record(event, details = {}) {
    if (!onAvatar()) return;
    if (entries.length === 120) { entries.splice(20, 1); dropped++; }
    entries.push({ ms: Math.round(performance.now() - started), event, ...details });
  }
  function snapshot() {
    let version = 'unavailable';
    let runtimeAvailable = false;
    try {
      runtimeAvailable = !!globalThis.chrome?.runtime?.id;
      const candidate = globalThis.chrome?.runtime?.getManifest?.().version;
      if (/^\d+(?:\.\d+){0,3}$/.test(candidate)) version = candidate;
    } catch { /* An extension reload invalidates old content-script contexts. */ }
    const root = document.documentElement;
    return {
      build: BUILD, extensionVersion: version, runtimeAvailable,
      page: 'avatar', language: language(), documentState: document.readyState,
      visibility: document.visibilityState, boot: state(root?.getAttribute('data-rc-avatar-boot')),
      compatibility: state(root?.getAttribute('data-rc-compatibility')),
      compatibilityReloading: !!root?.hasAttribute('data-rc-compatibility-reloading'),
      previewPanels: document.querySelectorAll('#rc-avatar-2d').length,
      loadingCards: document.querySelectorAll('#rc-avatar-loading').length,
      layout: currentLayout, dropped, entries: entries.map(entry => ({ ...entry }))
    };
  }
  function layout(value, reason, preferencesReady) {
    if (!onAvatar()) return;
    const keys = ['page', 'studio', 'view', 'inventory', 'preview', 'categories', 'row', 'panel'];
    currentLayout = {
      reason, preferencesReady,
      nodes: Object.fromEntries(keys.map(key => [key, nodeId(value?.[key])])),
      connected: Object.fromEntries(keys.map(key => [key, !!value?.[key]?.isConnected])),
      controls: value?.controls?.length || 0,
      nativePreviewReady: value?.nativePreviewReady !== false,
      nativeCanvas: !!value?.preview?.querySelector('canvas')
    };
    const serialized = JSON.stringify(currentLayout);
    if (serialized === lastLayout) return;
    lastLayout = serialized;
    record('layout', currentLayout);
  }
  function gate(from, to, reason) {
    if (!onAvatar()) return;
    if (writes.length === 120) writes.shift();
    writes.push({ from, to });
    record('gate-request', { from: state(from), to: state(to), reason });
  }
  function button() {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'rc-avatar-diagnostics-open';
    element.textContent = 'Loading diagnostics';
    element.addEventListener('click', open);
    return element;
  }
  function open() {
    if (!document.body || !onAvatar()) return;
    if (dialog?.isConnected) { dialog.querySelector('textarea').focus(); return; }
    record('diagnostics-open');
    const panel = document.createElement('dialog');
    dialog = panel;
    panel.id = 'rc-avatar-diagnostics';
    panel.setAttribute('aria-labelledby', 'rc-avatar-diagnostics-title');
    panel.innerHTML = '<h2 id="rc-avatar-diagnostics-title">Loading diagnostics</h2>'
      + '<code data-rc-i18n-ignore></code>'
      + '<p>Diagnostics stay in this tab. No account details or avatar contents are included.</p>'
      + '<textarea readonly aria-label="Loading diagnostics" spellcheck="false"></textarea>'
      + '<div class="rc-avatar-diagnostics-actions"><button type="button" data-copy>Copy diagnostics</button>'
      + '<button type="button" data-refresh>Refresh</button><button type="button" data-close>Close</button></div>'
      + '<p role="status" class="rc-avatar-diagnostics-status"></p>';
    const output = panel.querySelector('textarea');
    const status = panel.querySelector('[role="status"]');
    const update = () => { output.value = JSON.stringify(snapshot(), null, 2); };
    panel.querySelector('code').textContent = BUILD;
    panel.querySelector('[data-copy]').addEventListener('click', async () => {
      update();
      try {
        await navigator.clipboard.writeText(output.value);
        status.textContent = 'Copied';
      } catch {
        output.focus(); output.select();
        status.textContent = 'Select the text and copy it.';
      }
      globalThis.RobloxCustomizerI18n?.localize(status);
    });
    panel.querySelector('[data-refresh]').addEventListener('click', update);
    panel.querySelector('[data-close]').addEventListener('click', () => panel.close());
    panel.addEventListener('close', () => { panel.remove(); if (dialog === panel) dialog = null; }, { once: true });
    globalThis.RobloxCustomizerDialogs?.dismissOnOutside(panel);
    document.body.append(panel);
    update();
    globalThis.RobloxCustomizerI18n?.localize(panel);
    panel.showModal();
  }
  globalThis.RobloxCustomizerAvatarDiagnostics = Object.freeze({ layout, gate, button, open, snapshot,
    native3D(phase) {
      if (['requested', 'canvas-ready', 'already-active'].includes(phase)) record('native-3d', { phase });
    }
  });
  new MutationObserver(records => {
    if (!onAvatar()) { writes.length = 0; return; }
    const boots = records.filter(item => item.target === document.documentElement
      && item.attributeName === 'data-rc-avatar-boot');
    for (let index = 0; index < boots.length; index++) {
      const from = boots[index].oldValue;
      const to = index + 1 < boots.length ? boots[index + 1].oldValue
        : document.documentElement.getAttribute('data-rc-avatar-boot');
      const own = writes[0]?.from === from && writes[0]?.to === to;
      if (own) writes.shift();
      record('boot-observed', { from: state(from), to: state(to), source: own ? 'startup' : 'untracked' });
    }
    if (records.some(item => item.target === document.documentElement
      && item.attributeName !== 'data-rc-avatar-boot')) {
      record('environment', { language: language(), compatibility: state(document.documentElement.getAttribute('data-rc-compatibility')),
        reloading: document.documentElement.hasAttribute('data-rc-compatibility-reloading') });
    }
  }).observe(document, { subtree: true, attributes: true, attributeOldValue: true,
    attributeFilter: ['data-rc-avatar-boot', 'data-rc-compatibility', 'data-rc-compatibility-reloading', 'lang'] });
  for (const event of ['pageshow', 'pagehide', 'load']) addEventListener(event, () => record(event));
  for (const event of ['popstate', 'hashchange']) addEventListener(event, () => { if (!onAvatar()) dialog?.close(); });
  document.addEventListener('visibilitychange', () => record('visibility', { hidden: document.hidden }));
  record('startup');
})();
