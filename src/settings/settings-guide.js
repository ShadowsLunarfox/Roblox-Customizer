(() => {
  'use strict';
  if (globalThis.top && globalThis.top !== globalThis || globalThis.RobloxCustomizerSettingsGuide) return;
  const STORAGE_KEY = 'robloxCustomizerSettingsGuideSeen';
  const i18n = globalThis.RobloxCustomizerI18n;
  let seen = false, ready = false, languageChecked = false, timer = 0;
  let dialog = null, previousFocus = null;
  const observer = new MutationObserver(queue);

  function watch() {
    observer.disconnect();
    if (!seen) observer.observe(document, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['open', 'hidden', 'aria-modal', 'aria-hidden', 'class', 'style'] });
  }

  function close(remember = false) {
    if (!dialog) return;
    const current = dialog;
    dialog = null;
    if (remember) {
      seen = true;
      watch();
      void chrome.storage.local.set({ [STORAGE_KEY]: true }).catch(error => {
        console.warn('Roblox Customizer: Could not remember the settings guide.', error);
      });
    }
    current.close();
    current.remove();
    if (previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    previousFocus = null;
  }

  function show() {
    if (dialog) return;
    previousFocus = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.id = 'rc-settings-guide-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rc-settings-guide-title');
    dialog.setAttribute('aria-describedby', 'rc-settings-guide-intro');
    const icon = chrome.runtime.getURL('icons/icon-128.png');
    dialog.innerHTML = `
      <div class="rc-guide-brand"><img src="${icon}" width="36" height="36" alt=""><span translate="no">Roblox Customizer</span></div>
      <h2 id="rc-settings-guide-title">Find your Customizer settings</h2>
      <p id="rc-settings-guide-intro">Open settings in either of these two ways.</p>
      <ol class="rc-guide-methods" role="list">
        <li>
          <h3><span class="rc-guide-number" aria-hidden="true">1</span><span>From the Roblox website</span></h3>
          <p>Click the gear in Roblox's top-right corner, then choose Roblox Customizer.</p>
          <div class="rc-guide-menu-preview" aria-hidden="true"><span class="rc-guide-gear">⚙</span><span>→</span><span class="rc-guide-menu-brand" translate="no"><img src="${icon}" width="24" height="24" alt="">Roblox Customizer</span></div>
        </li>
        <li>
          <h3><span class="rc-guide-number" aria-hidden="true">2</span><span>From your browser toolbar</span></h3>
          <p>On a Roblox page, click the Roblox Customizer icon in your browser's top-right toolbar.</p>
          <p class="rc-guide-tip">If the icon is hidden, open your browser's Extensions menu and pin Roblox Customizer.</p>
        </li>
      </ol>
      <div class="rc-guide-actions"><button type="button" id="rc-settings-guide-done">Got it</button><button type="button" id="rc-settings-guide-open">Open settings</button></div>`;
    const current = dialog;
    current.querySelector('#rc-settings-guide-done').addEventListener('click', () => close(true));
    current.querySelector('#rc-settings-guide-open').addEventListener('click', () => {
      close(true);
      globalThis.RobloxCustomizerSettings?.open();
    });
    current.addEventListener('cancel', event => { event.preventDefault(); close(true); });
    current.addEventListener('close', () => { if (dialog === current) close(true); });
    current.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close(true);
      } else if (event.key === 'Tab') {
        const first = current.querySelector('#rc-settings-guide-done'), last = current.querySelector('#rc-settings-guide-open');
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    globalThis.RobloxCustomizerDialogs?.dismissOnOutside(current);
    document.body.append(current);
    i18n?.localize(current);
    current.showModal();
    current.querySelector('#rc-settings-guide-done').focus();
  }

  function check() {
    timer = 0;
    if (!ready || seen || !document.body || document.hidden) return;
    if (dialog && !dialog.isConnected) { dialog = null; previousFocus = null; }
    if (globalThis.RobloxCustomizerCompatibility?.reloading()) return;
    if (globalThis.RobloxCustomizerTerms && !globalThis.RobloxCustomizerTerms.accepted()) return;
    if (!languageChecked) {
      languageChecked = true;
      globalThis.RobloxCustomizerLanguageWarning?.onOpen();
    }
    if (globalThis.RobloxCustomizerExtensionWarning?.pending()
      || globalThis.RobloxCustomizerDialogs?.blockingDialog({ exclude: dialog })) {
      close();
      return;
    }
    show();
  }

  function queue() { if (ready && !seen && !timer) timer = setTimeout(check, 120); }
  document.addEventListener('visibilitychange', queue);
  document.addEventListener('rc-extension-warning-changed', queue);
  document.addEventListener('rc-compatibility-changed', queue);
  addEventListener('pageshow', queue);
  i18n?.onChange(() => { if (dialog) i18n.localize(dialog); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY]) {
      seen = changes[STORAGE_KEY].newValue === true;
      if (seen) close();
      watch();
    }
    queue();
  });
  const documentReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true })) : Promise.resolve();
  const loaded = Promise.all([chrome.storage.local.get(STORAGE_KEY).catch(() => ({})), documentReady,
    globalThis.RobloxCustomizerTerms?.request(), globalThis.RobloxCustomizerLanguageWarning?.ready,
    globalThis.RobloxCustomizerExtensionWarning?.ready]).then(([saved]) => {
    seen ||= saved[STORAGE_KEY] === true;
    ready = true;
    watch();
    queue();
  });
  globalThis.RobloxCustomizerSettingsGuide = Object.freeze({
    dismiss: () => close(true), pending: () => !ready || !seen, ready: loaded
  });
})();
