(() => {
  'use strict';
  const STORAGE_KEY = 'robloxCustomizerTermsAccepted';
  const i18n = globalThis.RobloxCustomizerI18n;
  let accepted = false;
  let pending = null;
  let dialog = null;
  let resolveRequest = null;
  let previousFocus = null;
  let saving = false;
  let saveFailed = false;
  const documentReady = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();
  const ready = Promise.all([chrome.storage.local.get(STORAGE_KEY).catch(() => ({})), documentReady])
    .then(([stored]) => { accepted ||= stored[STORAGE_KEY] === true; });

  function updateDialog() {
    if (!dialog) return;
    const locale = i18n?.locale() || 'en';
    const language = ['en', 'zh-CN', 'zh-TW'].includes(locale) ? locale : 'en';
    const suffix = language === 'en' ? '' : `.${language}`;
    for (const link of dialog.querySelectorAll('[data-rc-legal-document]')) {
      const file = link.dataset.rcLegalDocument === 'terms' ? 'TERMS' : 'PRIVACY';
      link.href = `https://github.com/ShadowsLunarfox/Roblox-Customizer/blob/main/${file}${suffix}.md`;
    }
    dialog.querySelector('#rc-terms-accept').textContent = saving ? 'Saving acceptance…' : 'Accept and continue';
    dialog.querySelector('#rc-terms-status').textContent = saveFailed
      ? 'Could not save your acceptance. Please try again.' : '';
    i18n?.localize(dialog);
  }

  function finish(result) {
    if (!resolveRequest) return;
    const resolve = resolveRequest;
    resolveRequest = null;
    const current = dialog;
    dialog = null;
    current?.close();
    current?.remove();
    previousFocus?.focus?.();
    previousFocus = null;
    resolve(result);
  }

  async function accept() {
    if (saving || !dialog) return;
    saving = true;
    saveFailed = false;
    for (const button of dialog.querySelectorAll('button')) button.disabled = true;
    updateDialog();
    try {
      // Only a completed storage write counts as acceptance. Never mark a view or dismissal as consent.
      await chrome.storage.local.set({ [STORAGE_KEY]: true });
      accepted = true;
      finish(true);
    } catch {
      saveFailed = true;
    } finally {
      saving = false;
      if (dialog) {
        for (const button of dialog.querySelectorAll('button')) button.disabled = false;
        updateDialog();
        dialog.querySelector('#rc-terms-accept').focus();
      }
    }
  }

  function showDialog(resolve) {
    resolveRequest = resolve;
    previousFocus = document.activeElement;
    saving = false;
    saveFailed = false;
    dialog = document.createElement('dialog');
    dialog.id = 'rc-terms-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'rc-terms-title');
    dialog.setAttribute('aria-describedby', 'rc-terms-message rc-terms-privacy');
    dialog.innerHTML = `
      <div class="rc-terms-brand">
        <img src="${chrome.runtime.getURL('icons/icon-128.png')}" width="40" height="40" alt="" aria-hidden="true">
        <span translate="no">Roblox Customizer</span>
      </div>
      <h2 id="rc-terms-title">Welcome to Roblox Customizer</h2>
      <p id="rc-terms-message">Please read and accept the Terms of Service for Roblox Customizer.</p>
      <p id="rc-terms-privacy">The Privacy Policy explains how the extension handles your data.</p>
      <div class="rc-terms-links">
        <a data-rc-legal-document="terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
        <a data-rc-legal-document="privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      </div>
      <p id="rc-terms-status" role="alert" aria-live="assertive"></p>
      <div class="rc-terms-actions">
        <button type="button" id="rc-terms-later">Not now</button>
        <button type="button" id="rc-terms-accept">Accept and continue</button>
      </div>`;
    const current = dialog;
    dialog.querySelector('#rc-terms-accept').addEventListener('click', () => { void accept(); });
    dialog.querySelector('#rc-terms-later').addEventListener('click', () => { if (!saving) finish(false); });
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (!saving) finish(false);
    });
    dialog.addEventListener('close', () => { if (dialog === current && !saving) finish(false); });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!saving) finish(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('a[href], button:not(:disabled)')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.body.append(dialog);
    updateDialog();
    dialog.showModal();
    dialog.querySelector('a').focus();
  }

  function request() {
    if (pending) return pending;
    pending = ready.then(() => accepted ? true : new Promise(showDialog))
      .finally(() => { pending = null; });
    return pending;
  }

  globalThis.RobloxCustomizerTerms = Object.freeze({ accepted: () => accepted, request });
  i18n?.onChange(updateDialog);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]?.newValue === true) {
      // Accepting in one tab also resolves a pending prompt in other tabs.
      accepted = true;
      finish(true);
    }
  });
  // The first Roblox visit starts onboarding; opening settings shares this request if it is still pending.
  void request();
})();
