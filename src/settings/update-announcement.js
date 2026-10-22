(() => {
  'use strict';
  if (globalThis.top && globalThis.top !== globalThis || globalThis.RobloxCustomizerUpdateAnnouncement) return;
  const i18n = globalThis.RobloxCustomizerI18n;
  const core = globalThis.RobloxCustomizerUpdateContent;
  const files = new Map();
  let content = null, contentLocale = 'en', storageKey = '', seen = false, ready = false, manual = false, timer = 0;
  let dialog = null, ui = null, previousFocus = null;
  let requestedFile = '', loading = false, loadVersion = 0, storageVersion = 0, activeLoad;
  const observer = new MutationObserver(queue);
  function watch() {
    observer.disconnect();
    if (content && (!seen || manual)) observer.observe(document, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['open', 'hidden', 'aria-modal', 'aria-hidden', 'class', 'style'] });
  }
  function close(remember = false) {
    if (!dialog) return;
    const current = dialog;
    dialog = null; ui = null;
    if (remember) {
      seen = true;
      manual = false;
      watch();
      void chrome.storage.local.set({ [storageKey]: true }).catch(error => {
        console.warn('Roblox Customizer: Could not remember the update announcement.', error);
      });
    }
    current.close(); current.remove();
    if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    previousFocus = null;
  }
  function element(tag, text = '') {
    const node = document.createElement(tag); node.textContent = text; return node;
  }
  function renderContent() {
    if (!ui || !content) return;
    ui.title.textContent = content.title; ui.title.lang = contentLocale;
    ui.version.textContent = content.id;
    ui.body.lang = contentLocale;
    ui.body.replaceChildren();
    for (const block of content.blocks) {
      if (block.type === 'list') {
        const list = element(block.ordered ? 'ol' : 'ul');
        list.append(...block.items.map(text => element('li', text))); ui.body.append(list);
      } else ui.body.append(element(block.type === 'heading' ? 'h3' : 'p', block.text));
    }
    ui.body.scrollTop = 0;
  }
  function show() {
    if (dialog) return;
    previousFocus = document.activeElement;
    dialog = element('dialog'); dialog.id = 'rc-update-announcement-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rc-update-announcement-title');
    const header = element('div'); header.className = 'rc-update-heading';
    const title = element('h2'); title.id = 'rc-update-announcement-title'; title.dataset.rcI18nIgnore = '';
    const version = element('span'); version.className = 'rc-update-version'; version.dataset.rcI18nIgnore = '';
    header.append(title, version);
    const body = element('div'); body.className = 'rc-update-content'; body.tabIndex = 0;
    body.setAttribute('role', 'region'); body.setAttribute('aria-labelledby', title.id); body.dataset.rcI18nIgnore = '';
    const actions = element('div'); actions.className = 'rc-update-actions';
    const done = element('button', 'Got it'); done.type = 'button'; done.id = 'rc-update-announcement-done';
    done.addEventListener('click', () => close(true)); actions.append(done);
    dialog.append(header, body, actions);
    ui = { title, version, body };
    renderContent();
    const current = dialog;
    current.addEventListener('cancel', event => { event.preventDefault(); close(true); });
    current.addEventListener('close', () => { if (dialog === current) close(true); });
    current.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === body) { event.preventDefault(); done.focus(); }
        else if (!event.shiftKey && document.activeElement === done) { event.preventDefault(); body.focus(); }
      }
    });
    globalThis.RobloxCustomizerDialogs?.dismissOnOutside(current);
    document.body.append(current); i18n?.localize(current); current.showModal(); body.focus();
  }
  function check() {
    timer = 0;
    if (!ready || loading || !content || seen && !manual || !document.body || document.hidden) return;
    if (dialog && !dialog.isConnected) { dialog = null; ui = null; previousFocus = null; }
    if (globalThis.RobloxCustomizerCompatibility?.reloading()) return;
    if (globalThis.RobloxCustomizerTerms && !globalThis.RobloxCustomizerTerms.accepted()) return;
    const pending = !manual && (globalThis.RobloxCustomizerSettingsGuide?.pending()
      || globalThis.RobloxCustomizerExtensionWarning?.pending());
    const blocked = globalThis.RobloxCustomizerDialogs?.blockingDialog({ exclude: dialog, allowSettings: manual });
    if (pending || blocked) { close(); return; }
    show();
  }
  function queue() { if (ready && content && (!seen || manual) && !timer) timer = setTimeout(check, 160); }
  globalThis.RobloxCustomizerUpdateAnnouncement = Object.freeze({
    available: () => ready && !loading && !!content,
    open() { if (content && ready && !loading) { manual = true; watch(); queue(); } },
    dismiss: () => close(true)
  });
  document.addEventListener('visibilitychange', queue);
  document.addEventListener('rc-extension-warning-changed', queue);
  document.addEventListener('rc-compatibility-changed', queue);
  addEventListener('pageshow', queue);
  i18n?.onChange(() => { if (dialog) i18n.localize(dialog); void load(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (storageKey && changes[storageKey]) {
      storageVersion++;
      seen = changes[storageKey].newValue === true;
      if (seen) { manual = false; close(); }
      watch();
    }
    queue();
  });
  const documentReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
  function notifyReady() { document.dispatchEvent(new Event('rc-update-announcement-ready')); }
  function readFile(file) {
    if (!files.has(file)) files.set(file, (async () => {
      try {
        const response = await fetch(chrome.runtime.getURL(file));
        if (!response.ok) return { content: null, disabled: false };
        const source = await response.text();
        return { content: core?.parse(source) || null, disabled: core?.metadata(source)?.enabled === false };
      } catch (error) {
        console.warn(`Roblox Customizer: Could not load ${file}.`, error);
        return { content: null, disabled: false };
      }
    })());
    return files.get(file);
  }
  const load = () => {
    const locale = i18n?.locale() || 'en', file = core?.fileFor(locale) || 'UPDATE.md';
    if (requestedFile === file) return activeLoad;
    requestedFile = file; loading = true;
    const version = ++loadVersion;
    notifyReady();
    activeLoad = (async () => {
      try {
        let result = await readFile(file), language = locale;
        if (version !== loadVersion) return;
        if (!result.content && !result.disabled && file !== 'UPDATE.md') {
          result = await readFile('UPDATE.md'); language = 'en';
        }
        if (version !== loadVersion) return;
        if (!result.content) {
          close(); manual = false; content = null; storageKey = ''; seen = false; return;
        }
        const nextKey = `rcUpdateAnnouncementSeen:${result.content.id}`;
        if (nextKey !== storageKey) { close(); seen = false; storageKey = nextKey; }
        content = result.content; contentLocale = language;
        const state = storageVersion;
        const stored = await chrome.storage.local.get(storageKey);
        if (version !== loadVersion) return;
        if (state === storageVersion) seen ||= stored[storageKey] === true;
        if (seen && !manual) close();
        else renderContent();
      } catch (error) {
        if (version === loadVersion) { close(); content = null; }
        console.warn('Roblox Customizer: Could not load the update announcement.', error);
      } finally {
        if (version === loadVersion) { loading = false; watch(); queue(); notifyReady(); }
      }
    })();
    return activeLoad;
  };
  Promise.all([load(), documentReady, globalThis.RobloxCustomizerTerms?.request(),
    globalThis.RobloxCustomizerLanguageWarning?.ready, globalThis.RobloxCustomizerExtensionWarning?.ready,
    globalThis.RobloxCustomizerSettingsGuide?.ready]).then(() => {
    ready = true; watch(); queue();
    notifyReady();
  });
})();
