(() => {
  'use strict';

  const listeners = new Set();
  const mediaListeners = new Set();
  const pending = new Set();
  const work = new Map();
  let resumeTimer = null;
  let workFrame = null;
  let workTimer = null;
  const now = () => globalThis.performance?.now() ?? Date.now();

  function requestWork() {
    if (!work.size || document.hidden || workFrame !== null || workTimer !== null) return;
    // Let the browser present a wallpaper/native frame before doing optional
    // DOM work. Every feature shares this budget rather than taking one each.
    if (typeof requestAnimationFrame === 'function') {
      workFrame = requestAnimationFrame(() => {
        workFrame = null;
        workTimer = setTimeout(flushWork, 0);
      });
    } else workTimer = setTimeout(flushWork, 16);
  }

  function flushWork() {
    workTimer = null;
    if (document.hidden) return;
    const start = now();
    let steps = 0;
    while (work.size && now() - start < 4 && steps++ < 2048) {
      const [key, task] = work.entries().next().value;
      try {
        task.iterator ||= task.create();
        const done = task.iterator.next().done;
        work.delete(key);
        if (!done) work.set(key, task);
      } catch (error) {
        work.delete(key);
        console.warn('Roblox Customizer: Could not update a page feature.', error);
      }
    }
    requestWork();
  }

  function queueWork(key, create) {
    if (!work.has(key)) work.set(key, { create, iterator: null });
    requestWork();
  }

  function notify(listener) {
    try { listener(); }
    catch (error) { console.warn('Roblox Customizer: Could not resume a page feature.', error); }
  }

  function sendMessage(message, callback) {
    if (globalThis.RobloxCustomizerCompatibility && !globalThis.RobloxCustomizerCompatibility.enabled()) {
      const response = { ok: false, error: 'This feature is disabled for the current Roblox language.' };
      return Promise.resolve(response).then(value => { callback?.(value); return value; });
    }
    // A missing worker response must not leave a section permanently busy.
    // Large inventories can legitimately take longer than other requests.
    const duration = message.type === 'rc-profile-limiteds' ? 300_000 : 60_000;
    let timer;
    let retryTimer;
    let settled = false;
    let attempt = 0;
    const readOnly = message.type === 'rc-catalog-item-2d'
      || message.type === 'rc-asset-tools' && ['details', 'content'].includes(message.action);
    const requestPath = globalThis.location?.pathname;
    const promise = new Promise(resolve => {
      const finish = response => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(retryTimer);
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
      const dispatch = () => {
        if (settled) return;
        if (attempt && requestPath && requestPath !== globalThis.location?.pathname) {
          finish({ ok: false, error: 'This request does not match the current item page.', code: 'page-changed' });
          return;
        }
        const currentAttempt = ++attempt;
        try {
          chrome.runtime.sendMessage(message, response => {
            // Reading lastError here also consumes Chrome's closed-port error.
            const error = chrome.runtime.lastError;
            if (settled || currentAttempt !== attempt) return;
            if (readOnly && error && attempt < 3
              && /(?:message port closed|message channel closed|channel closed before|receiving end does not exist)/i.test(error.message || '')) {
              retryTimer = setTimeout(dispatch, attempt === 1 ? 120 : 350);
              return;
            }
            finish(error ? { ok: false, error: error.message || 'Extension request unavailable.' }
              : response ?? { ok: false, error: 'No response from the extension.' });
          });
        } catch (error) {
          finish({ ok: false, error: error.message || 'Extension request unavailable.' });
        }
      };
      dispatch();
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
      for (const listener of mediaListeners) notify(listener);
      for (const listener of listeners) {
        if (typeof requestAnimationFrame !== 'function') notify(listener);
        else queueWork(listener, function* () { if (listeners.has(listener)) notify(listener); });
      }
      requestWork();
    }, 0);
  }

  globalThis.RobloxCustomizerRuntime = Object.freeze({
    sendMessage,
    queueWork,
    onResume(listener, { priority } = {}) {
      const group = priority === 'media' ? mediaListeners : listeners;
      group.add(listener);
      return () => group.delete(listener);
    }
  });
  chrome.runtime.onMessage?.addListener((message, sender, respond) => {
    if (message?.type !== 'rc-current-page-context' || sender.id !== chrome.runtime.id) return;
    // Reply from this exact document, including after same-document navigation.
    // No query strings, account information or page contents leave the frame.
    respond({ origin: location.origin, pathname: location.pathname });
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
