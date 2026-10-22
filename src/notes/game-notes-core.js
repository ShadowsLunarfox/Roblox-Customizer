(function (root) {
  'use strict';
  const STORAGE_KEY = 'rcGameNotes';
  const MAX_LENGTH = 5000;
  const MAX_NOTES = 500;
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
  const validNote = note => note && validId(note.placeId) && typeof note.name === 'string'
    && note.name.length <= 200 && typeof note.text === 'string' && !!note.text.trim()
    && note.text.length <= MAX_LENGTH && validTime(note.updatedAt);

  function normalize(value) {
    const notes = [], ids = new Set();
    for (const note of value?.version === 1 && Array.isArray(value.notes) ? value.notes : []) {
      if (!validNote(note) || ids.has(note.placeId) || notes.length >= MAX_NOTES) continue;
      notes.push({ placeId: note.placeId, name: note.name, text: note.text, updatedAt: note.updatedAt });
      ids.add(note.placeId);
    }
    return { version: 1, notes };
  }
  function validate(value) {
    if (!value || value.version !== 1 || !Array.isArray(value.notes) || value.notes.length > MAX_NOTES
      || value.notes.some(note => !validNote(note))) throw new Error('Invalid game notes.');
    const clean = normalize(value);
    if (clean.notes.length !== value.notes.length) throw new Error('Invalid game notes.');
    return clean;
  }
  function find(value, placeId) {
    return value.notes.find(note => note.placeId === placeId) || null;
  }
  function update(value, context, text, now = Date.now()) {
    if (!validId(context?.placeId) || typeof text !== 'string' || text.length > MAX_LENGTH
      || !validTime(now)) throw new Error('Invalid game note.');
    const state = normalize(value);
    const previous = find(state, context.placeId);
    state.notes = state.notes.filter(note => note.placeId !== context.placeId);
    if (text.trim()) {
      if (!previous && state.notes.length >= MAX_NOTES) throw new Error('notes-limit');
      state.notes.push({ placeId: context.placeId,
        name: typeof context.name === 'string' ? context.name.trim().slice(0, 200) : '', text, updatedAt: now });
    }
    return state;
  }
  const api = Object.freeze({ STORAGE_KEY, MAX_LENGTH, MAX_NOTES, validId, normalize, validate, find, update });
  root.RobloxCustomizerGameNotes = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
