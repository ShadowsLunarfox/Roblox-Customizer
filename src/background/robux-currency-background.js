(function () {
  'use strict';
  const core = globalThis.RobloxCustomizerCurrencyCore;
  const SOURCES = [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
    'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json'
  ];
  const DAY = 86400000;
  let pending = null;
  let retryAfter = 0;

  async function getRates(force) {
    let cached;
    try {
      const stored = (await chrome.storage.local.get(core.RATE_STORAGE_KEY))[core.RATE_STORAGE_KEY];
      const clean = core.sanitizeRates(stored);
      if (clean && Number.isFinite(stored.fetchedAt) && stored.fetchedAt <= Date.now()) cached = { ...clean, fetchedAt: stored.fetchedAt };
    } catch { /* Network can still supply rates if storage is unavailable. */ }
    const age = cached ? Date.now() - cached.fetchedAt : Infinity;
    if (!force && age < DAY) return { ok: true, ...cached, stale: false };
    if (!force && Date.now() < retryAfter) return age < 30 * DAY ? { ok: true, ...cached, stale: true } : { ok: false };
    for (const url of SOURCES) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const response = await fetch(url, { credentials: 'omit', signal: controller.signal, cache: 'no-cache' });
        if (!response.ok) throw new Error('Rate source unavailable');
        const clean = core.sanitizeRates(await response.json());
        if (!clean) throw new Error('Invalid currency rates');
        const snapshot = { ...clean, fetchedAt: Date.now() };
        try { await chrome.storage.local.set({ [core.RATE_STORAGE_KEY]: snapshot }); } catch { /* Keep this response usable. */ }
        retryAfter = 0;
        return { ok: true, ...snapshot, stale: false };
      } catch { /* Try the independent backup before falling back to cached rates. */ }
      finally { clearTimeout(timeout); }
    }
    retryAfter = Date.now() + 5 * 60000;
    return age < 30 * DAY ? { ok: true, ...cached, stale: true } : { ok: false };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'rc-currency-rates') return;
    let url;
    try { url = new URL(sender.url); } catch { return; }
    if (url.protocol !== 'https:' || !['www.roblox.com', 'roblox.com', 'create.roblox.com'].includes(url.hostname)) return;
    if (sender.id && sender.id !== chrome.runtime.id) return;
    if (!pending) pending = getRates(message.force === true).finally(() => { pending = null; });
    pending.then(sendResponse, () => sendResponse({ ok: false }));
    return true;
  });
})();
