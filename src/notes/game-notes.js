(globalThis.RobloxCustomizerCompatibility?.runFeature || (initialize => initialize()))(() => {
  'use strict';
  if (globalThis.top && globalThis.top !== globalThis) return;
  const core = globalThis.RobloxCustomizerGameNotes;
  const i18n = globalThis.RobloxCustomizerI18n;
  const t = (source, values) => i18n?.t(source, values) || source;
  const routePath = () => globalThis.RobloxCustomizerRoutes?.pathname() || location.pathname;
  let data = core.normalize(null), ready = false, readError = false, storageVersion = 0;
  let panel = null, context = null, editing = false, queued = false, epoch = 0;
  const drafts = new Map();

  function gameContext() {
    const placeId = Number(routePath().match(/^\/games\/(\d+)(?:\/|$)/i)?.[1]);
    if (!core.validId(placeId)) return null;
    const page = document.getElementById('game-detail-page');
    const meta = page?.querySelector('#game-detail-meta-data');
    if (!page || Number(meta?.dataset.placeId || page.dataset.placeId) !== placeId) return null;
    return { placeId, name: meta?.dataset.placeName || page.querySelector('.game-name, .game-title-container h1, h1')?.textContent || '', page };
  }
  function draftFor(current) {
    let draft = drafts.get(current.placeId);
    if (!draft) {
      const text = core.find(data, current.placeId)?.text || '';
      draft = { context: { placeId: current.placeId, name: current.name }, text, base: text,
        dirty: false, timer: 0, promise: null, error: '', composing: false, saved: false };
      drafts.set(current.placeId, draft);
    }
    draft.context.name = current.name;
    return draft;
  }
  function request(draft, text) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('save-failed')), 10000);
      // Persist an already-entered edit even during the compatibility reload,
      // when the ordinary runtime helper has stopped starting page features.
      try {
        chrome.runtime.sendMessage({ type: 'rc-game-notes', action: 'save', context: { ...draft.context }, text }, response => {
          clearTimeout(timer);
          if (chrome.runtime.lastError || !response?.ok) reject(new Error(response?.error || 'save-failed'));
          else resolve(response);
        });
      } catch { clearTimeout(timer); reject(new Error('save-failed')); }
    });
  }
  async function save(draft) {
    if (drafts.get(draft.context.placeId) !== draft) return true;
    clearTimeout(draft.timer); draft.timer = 0;
    if (draft.promise) {
      const ok = await draft.promise;
      if (drafts.get(draft.context.placeId) !== draft) return true;
      return ok && draft.dirty ? save(draft) : ok;
    }
    if (!draft.dirty) return true;
    if (draft.composing || draft.text.length > core.MAX_LENGTH) return false;
    const text = draft.text, version = epoch;
    draft.error = '';
    const task = request(draft, text).then(response => {
      if (version !== epoch) return true;
      const updatedAt = response.note?.updatedAt || Date.now();
      data = core.update(data, draft.context, text, updatedAt);
      draft.base = text;
      draft.saved = true;
      draft.dirty = draft.text !== text;
      return true;
    }).catch(error => {
      if (version === epoch) draft.error = error.message === 'notes-limit' ? 'notes-limit' : 'save-failed';
      return false;
    });
    draft.promise = task;
    render();
    const ok = await task;
    if (draft.promise === task) draft.promise = null;
    render();
    return version === epoch && ok && draft.dirty ? save(draft) : ok;
  }
  async function flush() {
    return (await Promise.all([...drafts.values()].map(save))).every(Boolean);
  }
  function discardDrafts() {
    ++epoch;
    for (const draft of drafts.values()) clearTimeout(draft.timer);
    drafts.clear(); editing = false;
    render();
  }
  function inputChanged() {
    if (!context || !ready) return;
    const draft = draftFor(context);
    draft.text = panel.querySelector('textarea').value;
    draft.dirty = draft.text !== draft.base; draft.error = '';
    clearTimeout(draft.timer); draft.timer = 0;
    if (!draft.composing && draft.dirty && draft.text.length <= core.MAX_LENGTH) {
      draft.timer = setTimeout(() => { void save(draft); }, 700);
    }
    render();
  }
  function createPanel() {
    const section = document.createElement('section');
    section.id = 'rc-game-notes'; section.dataset.rcI18nIgnore = '';
    section.setAttribute('aria-labelledby', 'rc-game-notes-title');
    section.innerHTML = `<div class="rc-game-notes-header"><h2 id="rc-game-notes-title"></h2><p class="rc-game-notes-preview" translate="no"></p><button type="button" class="rc-game-notes-toggle" aria-controls="rc-game-notes-editor"></button></div>
      <p class="rc-game-notes-hint" hidden></p>
      <form id="rc-game-notes-editor" hidden><label for="rc-game-notes-text"></label>
        <textarea id="rc-game-notes-text" rows="5" translate="no" spellcheck="true" aria-describedby="rc-game-notes-count rc-game-notes-status"></textarea>
        <div class="rc-game-notes-footer"><span id="rc-game-notes-count"></span><div class="rc-game-notes-actions"><button type="button" class="rc-game-notes-delete"></button><button type="submit" class="rc-game-notes-save"></button></div></div></form>
      <p id="rc-game-notes-status" role="status" aria-live="polite"></p><button type="button" class="rc-game-notes-retry" hidden></button>`;
    section.querySelector('textarea').maxLength = core.MAX_LENGTH;
    section.querySelector('.rc-game-notes-toggle').addEventListener('click', async () => {
      if (!context || !ready) return;
      const draft = draftFor(context), placeId = context.placeId;
      if (editing && !await save(draft)) return;
      if (context?.placeId !== placeId) return;
      editing = !editing; render();
      if (editing) section.querySelector('textarea').focus();
    });
    section.querySelector('form').addEventListener('submit', event => {
      event.preventDefault(); if (context && ready) void save(draftFor(context));
    });
    const input = section.querySelector('textarea');
    input.addEventListener('input', inputChanged);
    input.addEventListener('compositionstart', () => {
      if (!context || !ready) return;
      const draft = draftFor(context); draft.composing = true; clearTimeout(draft.timer); draft.timer = 0;
    });
    input.addEventListener('compositionend', () => {
      if (context && ready) draftFor(context).composing = false;
      inputChanged();
    });
    input.addEventListener('blur', () => { if (context && ready) void save(draftFor(context)); });
    section.querySelector('.rc-game-notes-delete').addEventListener('click', () => {
      if (!context || !ready) return;
      const draft = draftFor(context); draft.text = ''; draft.dirty = true;
      render(); void save(draft);
    });
    section.querySelector('.rc-game-notes-retry').addEventListener('click', () => { void load(); });
    return section;
  }
  function render() {
    if (!panel || !context) return;
    const draft = ready ? draftFor(context) : null;
    panel.lang = i18n?.locale() || 'en';
    panel.dataset.editing = String(editing);
    panel.querySelector('h2').textContent = t('Game notes');
    panel.querySelector('.rc-game-notes-hint').textContent = t('Private to this browser. Notes are shared across your Roblox accounts and are not posted to Roblox.');
    panel.querySelector('.rc-game-notes-hint').hidden = !editing;
    const toggle = panel.querySelector('.rc-game-notes-toggle');
    toggle.textContent = t(editing ? 'Close' : draft?.text ? 'Edit note' : 'Add note');
    toggle.disabled = !ready; toggle.setAttribute('aria-expanded', String(editing));
    const preview = panel.querySelector('.rc-game-notes-preview');
    preview.hidden = editing || !ready || !draft?.text.trim();
    preview.textContent = draft?.text || '';
    panel.querySelector('form').hidden = !editing;
    panel.querySelector('label').textContent = t('Private note');
    const input = panel.querySelector('textarea');
    if (draft && input.value !== draft.text) input.value = draft.text;
    input.placeholder = t('Write a reminder, strategy, or anything you want to remember…');
    input.disabled = !ready;
    panel.querySelector('#rc-game-notes-count').textContent = t('{count}/{max} characters', { count: draft?.text.length || 0, max: core.MAX_LENGTH });
    const remove = panel.querySelector('.rc-game-notes-delete');
    remove.textContent = t('Delete note'); remove.hidden = !draft?.text && !draft?.base; remove.disabled = !ready;
    const button = panel.querySelector('.rc-game-notes-save'); button.textContent = t('Save now');
    button.disabled = !draft?.dirty || !!draft?.promise || !!draft?.composing || draft.text.length > core.MAX_LENGTH;
    let status = !ready ? readError ? t('Could not load game notes. Try again.') : t('Loading game notes…')
      : draft.text.length > core.MAX_LENGTH ? t('Notes can contain up to {max} characters.', { max: core.MAX_LENGTH })
      : draft.error === 'notes-limit' ? t('You can save notes for up to {max} games.', { max: core.MAX_NOTES })
      : draft.error ? t('Could not save note. Your text is kept. Try again.')
      : draft.promise ? t('Saving note…') : draft.dirty ? t('Changes save automatically.')
      : draft.base ? t('Note saved.') : draft.saved ? t('Note deleted.') : '';
    const statusNode = panel.querySelector('#rc-game-notes-status');
    statusNode.textContent = status;
    statusNode.dataset.error = String(readError || !!draft?.error || (draft?.text.length || 0) > core.MAX_LENGTH);
    statusNode.hidden = !status || (!editing && ready && !draft?.promise && !draft?.dirty && statusNode.dataset.error !== 'true');
    panel.querySelector('.rc-game-notes-retry').hidden = !readError;
    panel.querySelector('.rc-game-notes-retry').textContent = t('Try again');
  }
  function sync() {
    const next = gameContext();
    if (context?.placeId !== next?.placeId) {
      if (context && ready) void save(draftFor(context));
      panel?.remove(); panel = null; editing = false;
    }
    context = next;
    if (!next) { panel?.remove(); panel = null; return; }
    const parent = next.page.querySelector('.game-main-content:has(> #game-details-carousel-container)')
      || next.page.querySelector('.game-calls-to-action, .game-details-info') || next.page;
    if (!panel) { panel = createPanel(); render(); }
    if (panel.parentElement !== parent) {
      parent.querySelector('#rc-game-notes')?.remove();
      // Match visual and keyboard reading order regardless of which feature
      // finishes loading first. Only extension-owned nodes are inserted here.
      parent.insertBefore(panel, parent.querySelector(':scope > #rc-playtime-game-page'));
    }
  }
  function queueSync() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; sync(); });
  }
  async function load() {
    readError = false; render();
    const version = storageVersion;
    try {
      const saved = await chrome.storage.local.get(core.STORAGE_KEY);
      if (version === storageVersion) data = core.normalize(saved[core.STORAGE_KEY]);
      ready = true;
    } catch { readError = true; }
    render(); queueSync();
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[core.STORAGE_KEY]) return;
    ++storageVersion;
    if (changes[core.STORAGE_KEY].newValue === undefined) discardDrafts();
    data = core.normalize(changes[core.STORAGE_KEY].newValue); ready = true; readError = false;
    for (const [placeId, draft] of drafts) if (!draft.dirty && !draft.promise) {
      draft.text = draft.base = core.find(data, placeId)?.text || '';
    }
    render(); queueSync();
  });
  new MutationObserver(records => {
    if (records.some(record => !panel?.contains(record.target))) queueSync();
  }).observe(document, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-place-id', 'data-place-name', 'id'] });
  addEventListener('popstate', queueSync); addEventListener('hashchange', queueSync);
  addEventListener('pagehide', () => { void flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) void flush(); });
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
  globalThis.RobloxCustomizerCompatibility?.onBeforeReload(flush);
  i18n?.onChange(render);
  globalThis.RobloxCustomizerGameNotesUI = Object.freeze({ flush, discardDrafts });
  void load(); queueSync();
});
