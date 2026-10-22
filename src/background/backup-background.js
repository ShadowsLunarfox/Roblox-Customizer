(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerBackup;
  let queue = Promise.resolve();
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rc-data-backup') return;
    let url;
    try { url = new URL(sender.url); } catch { return; }
    if (sender.id !== chrome.runtime.id || url.protocol !== 'https:'
      || !['www.roblox.com', 'roblox.com'].includes(url.hostname) || (sender.frameId ?? 0) !== 0) return;
    // Share both mutation queues: an in-flight presence poll or pin refresh
    // must finish before the snapshot/restore, never overwrite restored data.
    const result = queue.then(() => globalThis.RobloxCustomizerPinnedGamesBackground.withStorageLock(() =>
      globalThis.RobloxCustomizerPlaytimeBackground.withStorageLock(() =>
      globalThis.RobloxCustomizerGameNotesBackground.withStorageLock(async () => {
        if (message.action === 'export') {
          const saved = await chrome.storage.local.get(core.KEYS);
          return { ok: true, data: core.snapshot(saved), extensionVersion: chrome.runtime.getManifest().version };
        }
        if (message.action === 'import') {
          const data = core.data(message.data);
          await chrome.storage.local.set(data);
          return { ok: true };
        }
        if (message.action === 'reset') {
          await chrome.storage.session?.clear();
          const termsKey = 'robloxCustomizerTermsAccepted';
          const terms = await chrome.storage.local.get([termsKey]);
          if (terms[termsKey] === true) {
            // Reset preferences and user data without asking an accepted user to agree again.
            const saved = await chrome.storage.local.get(null);
            await chrome.storage.local.remove(Object.keys(saved).filter(key => key !== termsKey));
          } else {
            await chrome.storage.local.clear();
          }
          return { ok: true };
        }
        return { ok: false, error: 'Invalid backup action.' };
      }))));
    queue = result.catch(() => {});
    result.then(respond, error => respond({ ok: false, rejected: true,
      error: error.message || 'Could not access backup data.' }));
    return true;
  });
})();
