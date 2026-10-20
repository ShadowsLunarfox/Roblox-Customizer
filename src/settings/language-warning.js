(() => {
  'use strict';

  const i18n = globalThis.RobloxCustomizerI18n;
  if (!i18n) return;
  const STORAGE_KEY = 'robloxCustomizerLanguageWarning';
  const languageKey = value => typeof value === 'string' ? value.trim().replaceAll('_', '-').toLowerCase() : '';
  let state = { opened: false, language: '' };
  let ready = false;
  let openingPending = false;
  let dialog = null;
  let saveQueue = Promise.resolve();

  function closeWarning() {
    if (!dialog) return;
    const warning = dialog;
    dialog = null;
    warning.close();
    warning.remove();
  }

  function updateWarning() {
    if (!dialog) return;
    const language = i18n.robloxLanguage();
    if (!language || i18n.isSupportedLanguage(language)) {
      closeWarning();
      return;
    }
    const fallback = globalThis.RobloxCustomizerCompatibility?.fallback();
    dialog.querySelector('#rc-language-warning-message').textContent = i18n.t(fallback
      ? 'Your Roblox language ({language}) is not supported. Only image backgrounds, custom colors, and custom fonts remain active; all other features are disabled to preserve the Roblox interface.'
      : 'Your Roblox language ({language}) is not supported by Roblox Customizer. Some features may not work correctly.', { language });
    if (fallback) dialog.querySelector('button').textContent = i18n.t('Continue with fallback');
    i18n.localize(dialog);
  }

  function showWarning() {
    if (dialog) { updateWarning(); return; }
    dialog = document.createElement('dialog');
    dialog.id = 'rc-language-warning-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rc-language-warning-title');
    dialog.setAttribute('aria-describedby', 'rc-language-warning-message rc-language-warning-advice');
    dialog.innerHTML = `
      <div class="rc-language-warning-icon" aria-hidden="true">!</div>
      <h2 id="rc-language-warning-title">Unsupported Roblox language</h2>
      <p id="rc-language-warning-message"></p>
      <p id="rc-language-warning-advice">For the best experience, switch Roblox's language to English, Simplified Chinese, Traditional Chinese, Indonesian, Japanese, Thai, or Korean.</p>
      <div class="rc-language-warning-actions">
        <a href="/my/account#!/info">Open Roblox language settings</a>
        <button type="button" autofocus>Continue anyway</button>
      </div>`;
    const warning = dialog;
    warning.addEventListener('close', () => {
      warning.remove();
      if (dialog === warning) dialog = null;
    });
    // Keep Escape from also closing Customizer settings underneath the dialog.
    warning.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeWarning();
        return;
      }
      if (event.key !== 'Tab') return;
      const first = warning.querySelector('a');
      const last = warning.querySelector('button');
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    warning.addEventListener('cancel', event => {
      event.preventDefault();
      closeWarning();
    });
    warning.querySelector('button').addEventListener('click', closeWarning);
    document.body.append(warning);
    updateWarning();
    warning.showModal();
  }

  function checkLanguage(opening = false) {
    openingPending ||= opening;
    if (!ready) return;
    if (globalThis.RobloxCustomizerCompatibility?.reloading()) return;
    const language = languageKey(i18n.robloxLanguage());
    if (!language) { closeWarning(); return; }
    const firstOpening = openingPending && !state.opened;
    const changed = !!state.language && state.language !== language;
    const unsupported = !i18n.isSupportedLanguage(language);
    const shouldWarn = unsupported && (firstOpening || changed);
    const terms = globalThis.RobloxCustomizerTerms;
    if (shouldWarn && terms && !terms.accepted()) {
      // Do not consume or display a language warning above the first-visit terms prompt.
      void terms.request().then(accepted => { if (accepted) checkLanguage(true); });
      return;
    }
    // A language-change warning also satisfies the first-opening warning.
    const opened = state.opened || openingPending || shouldWarn;
    openingPending = false;
    if (opened !== state.opened || language !== state.language) {
      state = { opened, language };
      // Leave a fresh or reset installation empty until the first opening or
      // warning; keep the initial page language in memory in the meantime.
      if (opened) {
        const snapshot = { ...state };
        saveQueue = saveQueue.then(() => chrome.storage.local.set({ [STORAGE_KEY]: snapshot })).catch(error => {
          console.warn('Roblox Customizer: Could not remember the language warning.', error);
        });
      }
    }
    if (!unsupported) closeWarning();
    else if (shouldWarn) showWarning();
    else updateWarning();
  }

  globalThis.RobloxCustomizerLanguageWarning = Object.freeze({ onOpen: () => checkLanguage(true) });
  i18n.onChange(updateWarning);
  i18n.onRobloxLanguageChange(() => checkLanguage());
  globalThis.RobloxCustomizerCompatibility?.onBeforeReload(() => {
    // Preserve the previous language so a switch can warn on the fresh page,
    // even if Customizer has not been opened yet.
    return saveQueue.then(() => chrome.storage.local.set({ [STORAGE_KEY]: { ...state } }));
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]?.newValue?.opened === true) {
      // Other open tabs share the first-opening flag, while each page tracks
      // its own language so an older tab does not appear to switch languages.
      state.opened = true;
    }
  });
  const documentReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
  // Read the final page metadata and saved state before deciding whether to warn.
  Promise.all([chrome.storage.local.get(STORAGE_KEY).catch(() => ({})), documentReady]).then(([result]) => {
    const saved = result[STORAGE_KEY];
    state = { opened: state.opened || saved?.opened === true, language: languageKey(saved?.language) };
    ready = true;
    checkLanguage();
  });
})();
