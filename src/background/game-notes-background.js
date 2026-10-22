(() => {
  'use strict';
  const core = globalThis.RobloxCustomizerGameNotes;
  let queue = Promise.resolve();
  function serial(task) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }
  globalThis.RobloxCustomizerGameNotesBackground = Object.freeze({ withStorageLock: serial });
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'rc-game-notes') return;
    let url;
    try { url = new URL(sender.url); } catch { return; }
    if (sender.id !== chrome.runtime.id || url.protocol !== 'https:'
      || !['www.roblox.com', 'roblox.com'].includes(url.hostname) || (sender.frameId ?? 0) !== 0) return;
    // A pending edit can be flushed after SPA navigation has already changed
    // the sender URL. Use its captured place ID, never the new page's ID.
    const result = serial(async () => {
      if (message.action !== 'save') throw new Error('Invalid game note action.');
      const saved = await chrome.storage.local.get(core.STORAGE_KEY);
      const state = core.update(saved[core.STORAGE_KEY], message.context, message.text);
      await chrome.storage.local.set({ [core.STORAGE_KEY]: state });
      return { ok: true, note: core.find(state, message.context.placeId) };
    });
    result.then(respond, error => respond({ ok: false, error: error.message === 'notes-limit' ? 'notes-limit' : 'save-failed' }));
    return true;
  });
})();
