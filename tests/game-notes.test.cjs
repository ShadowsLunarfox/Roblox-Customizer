const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../src/notes/game-notes-core.js');
const copy = value => structuredClone(value);

test('notes preserve private multiline text, stay with their page, and delete only when blank', () => {
  const text = '  攻略\n한국어 <img src=x onerror=alert(1)>\n日本語 ไทย  ';
  let state = core.update(null, { placeId: 123, name: '  My Game  ' }, text, 1234);
  assert.equal(core.find(state, 123).text, text);
  assert.equal(core.find(state, 123).name, 'My Game');
  state = core.update(state, { placeId: 456, name: 'Other Game' }, 'Other note', 2345);
  assert.equal(core.find(state, 456).text, 'Other note');
  assert.equal(core.find(state, 789), null);
  state = core.update(state, { placeId: 123 }, '\n  \n', 3456);
  assert.equal(core.find(state, 123), null);
  assert.equal(core.find(state, 456).text, 'Other note');
  assert.deepEqual(core.validate(state), state);
});

test('notes reject oversized or invalid input and do not silently evict notes at capacity', () => {
  assert.throws(() => core.update(null, { placeId: -1 }, 'text'));
  assert.throws(() => core.update(null, { placeId: 1 }, 'x'.repeat(core.MAX_LENGTH + 1)));
  const full = { version: 1, notes: Array.from({ length: core.MAX_NOTES }, (_, i) =>
    ({ placeId: i + 1, name: 'Game', text: 'Keep', updatedAt: 1 })) };
  assert.throws(() => core.update(full, { placeId: core.MAX_NOTES + 1 }, 'New'), /notes-limit/);
  assert.equal(core.update(full, { placeId: 1 }, 'Edit').notes.length, core.MAX_NOTES);
  assert.throws(() => core.validate({ version: 1, notes: [full.notes[0], full.notes[0]] }));
  assert.throws(() => core.validate({ version: 2, notes: [] }));
  assert.deepEqual(core.normalize({ version: 1, notes: [null, { placeId: 'bad' }, full.notes[0]] }),
    { version: 1, notes: [full.notes[0]] });
});

function worker() {
  const listeners = [], saved = {};
  let fail = false;
  const context = vm.createContext({ URL, Date, chrome: {
    runtime: { id: 'extension', onMessage: { addListener: listener => listeners.push(listener) } },
    storage: { local: { async get(key) { await Promise.resolve(); return copy({ [key]: saved[key] }); },
      async set(value) { if (fail) throw new Error('Storage full'); Object.assign(saved, copy(value)); } } }
  } });
  for (const file of ['src/notes/game-notes-core.js', 'src/background/game-notes-background.js']) {
    vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context);
  }
  const sender = { id: 'extension', url: 'https://www.roblox.com/ko/games/123/Test', frameId: 0 };
  const send = (placeId, text, source = sender) => new Promise(resolve => {
    if (!listeners[0]({ type: 'rc-game-notes', action: 'save', context: { placeId, name: 'Game' }, text },
      source, response => resolve(copy(response)))) resolve(undefined);
  });
  return { saved, send, fail(value) { fail = value; } };
}

test('simultaneous tab edits keep both games, failed writes preserve data, and untrusted senders cannot write', async () => {
  const w = worker();
  assert.ok((await Promise.all([w.send(123, 'First'), w.send(456, 'Second')])).every(result => result.ok));
  assert.equal(core.find(w.saved.rcGameNotes, 123).text, 'First');
  assert.equal(core.find(w.saved.rcGameNotes, 456).text, 'Second');
  w.fail(true);
  assert.equal((await w.send(123, 'Failed')).ok, false);
  assert.equal(core.find(w.saved.rcGameNotes, 123).text, 'First');
  w.fail(false);
  for (const source of [{ id: 'other', url: 'https://www.roblox.com/home' },
    { id: 'extension', url: 'https://evil.example/home' }, { id: 'extension', url: 'http://www.roblox.com/home' },
    { id: 'extension', url: 'https://www.roblox.com/home', frameId: 1 }]) {
    assert.equal(await w.send(123, 'Bad', source), undefined);
  }
  assert.equal((await w.send(123, 'After navigation', { id: 'extension', url: 'https://www.roblox.com/home', frameId: 0 })).ok, true);
  assert.equal(core.find(w.saved.rcGameNotes, 123).text, 'After navigation');
});
