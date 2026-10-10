(() => {
  'use strict';

  const listeners = new Set();
  const pending = new Set();
  let resumeTimer = null;

  function sendMessage(message, callback) {
    // A missing worker response must not leave a section permanently busy.
    // Large inventories can legitimately take longer than other requests.
    const duration = message.type === 'rc-profile-limiteds' ? 300_000 : 60_000;
    let timer;
    let settled = false;
    const promise = new Promise(resolve => {
      const finish = response => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pending.delete(request);
        resolve(response);
        try { callback?.(response); }
        catch (error) { console.warn('Roblox Customizer: Could not apply a request response.', error); }
      };
      const request = {
        deadline: Date.now() + duration,
        expire() { finish({ ok: false, error: 'Request timed out. Please try again.', timedOut: true }); }
      };
      pending.add(request);
      timer = setTimeout(request.expire, duration);
      try {
        chrome.runtime.sendMessage(message, response => {
          // Reading lastError here also consumes Chrome's closed-port error.
          const error = chrome.runtime.lastError;
          finish(error ? { ok: false, error: error.message || 'Extension request unavailable.' }
            : response ?? { ok: false, error: 'No response from the extension.' });
        });
      } catch (error) {
        finish({ ok: false, error: error.message || 'Extension request unavailable.' });
      }
    });
    return promise;
  }

  function resume() {
    if (document.hidden || resumeTimer !== null) return;
    resumeTimer = setTimeout(() => {
      resumeTimer = null;
      if (document.hidden) return;
      // Background tabs can suspend timers. Expire overdue work before asking
      // each feature to synchronize with the current native page again.
      for (const request of pending) if (Date.now() >= request.deadline) request.expire();
      for (const listener of listeners) {
        try { listener(); }
        catch (error) { console.warn('Roblox Customizer: Could not resume a page feature.', error); }
      }
    }, 0);
  }

  globalThis.RobloxCustomizerRuntime = Object.freeze({
    sendMessage,
    onResume(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  });
  addEventListener('pageshow', resume);
  addEventListener('focus', resume);
  addEventListener('online', resume);
  document.addEventListener('visibilitychange', resume);
  document.addEventListener('resume', resume);
  // Roblox can change its locale without remounting every native component.
  // Resynchronize features after either locale signal changes.
  if (typeof MutationObserver === 'function') {
    new MutationObserver(records => {
      if (records.some(record => record.attributeName === 'lang'
        && record.target === document.documentElement
        || record.attributeName === 'data-language-code'
          && record.target.matches('meta[name="locale-data"]'))) resume();
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['lang', 'data-language-code'] });
  }
  addEventListener('languagechange', resume);
})();
