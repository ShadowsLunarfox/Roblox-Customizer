const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src/shared/runtime.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(__dirname, '../src/background/service-worker.js'), 'utf8');

function clock() {
  let now = 1000;
  let id = 0;
  const timers = new Map();
  return {
    timers, Date: class extends Date { static now() { return now; } },
    setTimeout(callback, delay) { timers.set(++id, { callback, due: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    elapse(ms) { now += ms; },
    fire(id) { const timer = timers.get(id); timers.delete(id); timer.callback(); },
    flush() {
      for (const [id, timer] of [...timers]) if (timer.due <= now && timers.has(id)) this.fire(id);
    }
  };
}

function environment() {
  const time = clock();
  const events = new Map();
  const requests = [];
  const warnings = [];
  const addEventListener = (name, callback) => events.set(name, callback);
  const document = { hidden: false, addEventListener };
  const chrome = { runtime: { lastError: null, sendMessage(message, callback) { requests.push({ message, callback }); } } };
  const context = vm.createContext({ ...time, document, chrome, addEventListener,
    console: { warn: (...args) => warnings.push(args) } });
  vm.runInContext(source, context);
  return { ...time, document, chrome, requests, warnings, runtime: context.RobloxCustomizerRuntime,
    dispatch: name => events.get(name)() };
}

test('stalled worker messages settle once and another request can succeed', async () => {
  const env = environment();
  const responses = [];
  const message = { type: 'rc-avatar-2d' };
  const first = env.runtime.sendMessage(message, value => responses.push(value));
  assert.strictEqual(env.requests[0].message, message);
  env.elapse(60_000); env.flush();
  assert.equal((await first).timedOut, true);
  assert.equal(responses.length, 1);
  env.requests[0].callback({ state: 'Completed', imageUrl: 'old' });
  assert.equal(responses.length, 1, 'Late responses cannot overwrite the recovered UI');
  const next = env.runtime.sendMessage(message);
  env.requests[1].callback({ state: 'Completed', imageUrl: 'new' });
  assert.equal((await next).imageUrl, 'new');
  assert.equal(env.timers.size, 0);
});

test('message errors, missing responses and a disconnected extension release loading state', async () => {
  const env = environment();
  const closed = env.runtime.sendMessage({ type: 'rc-currency-rates' });
  env.chrome.runtime.lastError = { message: 'Message port closed' };
  env.requests[0].callback();
  env.chrome.runtime.lastError = null;
  assert.equal((await closed).error, 'Message port closed');
  const empty = env.runtime.sendMessage({ type: 'rc-home-user' });
  env.requests[1].callback();
  assert.equal((await empty).ok, false);
  env.chrome.runtime.sendMessage = () => { throw new Error('Extension context invalidated'); };
  assert.equal((await env.runtime.sendMessage({ type: 'rc-home-user' })).error, 'Extension context invalidated');
  assert.equal(env.timers.size, 0);
});

test('large inventories have a longer deadline and successful responses cancel it', async () => {
  const env = environment();
  const request = env.runtime.sendMessage({ type: 'rc-profile-limiteds', userId: 123 });
  env.elapse(60_000); env.flush();
  assert.equal(env.timers.size, 1);
  env.requests[0].callback({ items: [] });
  assert.equal((await request).items.length, 0);
  assert.equal(env.timers.size, 0);
});

test('restoration expires suspended requests before resynchronizing visible features', async () => {
  const env = environment();
  let busy = true;
  const request = env.runtime.sendMessage({ type: 'rc-private-server-details' }, () => { busy = false; });
  let resumed = 0;
  env.runtime.onResume(() => { assert.equal(busy, false); resumed++; });
  env.document.hidden = true;
  env.dispatch('visibilitychange');
  env.elapse(90_000);
  assert.equal(busy, true, 'Simulate Chrome suspending the original timeout');
  env.document.hidden = false;
  env.dispatch('pageshow');
  env.dispatch('visibilitychange');
  env.dispatch('focus');
  env.fire(Math.max(...env.timers.keys()));
  assert.equal(resumed, 1, 'A restoration burst schedules just one synchronization');
  assert.equal((await request).timedOut, true);
  assert.equal(env.timers.size, 0, 'Recovery does not install an idle polling loop');
});

test('one failing resume listener cannot prevent other page sections from recovering', () => {
  const env = environment();
  let calls = 0;
  const remove = env.runtime.onResume(() => { calls++; });
  env.runtime.onResume(() => { throw new Error('Fixture feature failed'); });
  env.runtime.onResume(() => { calls++; });
  env.dispatch('online'); env.flush();
  assert.equal(calls, 2);
  assert.equal(env.warnings.length, 1);
  remove();
  env.dispatch('focus'); env.flush();
  assert.equal(calls, 3);
  assert.equal(env.timers.size, 0);
});

test('a failed response handler cannot leave other suspended requests and sections busy', async () => {
  const env = environment();
  const first = env.runtime.sendMessage({ type: 'rc-avatar-2d' }, () => { throw new Error('Detached native view'); });
  let busy = true;
  const second = env.runtime.sendMessage({ type: 'rc-home-user' }, () => { busy = false; });
  let resumed = false;
  env.runtime.onResume(() => { resumed = true; });
  env.elapse(90_000);
  env.dispatch('resume');
  env.fire(Math.max(...env.timers.keys()));
  assert.equal((await first).timedOut, true);
  assert.equal((await second).timedOut, true);
  assert.equal(busy, false);
  assert.equal(resumed, true);
  assert.equal(env.warnings.length, 1);
  assert.equal(env.timers.size, 0);
});

test('the worker bounds stalled headers and bodies, clears deadlines, and allows retry', async () => {
  for (const phase of ['headers', 'body']) {
    const time = clock();
    const calls = [];
    let stalled = true;
    const context = vm.createContext({ ...time, URL, AbortController,
      chrome: { runtime: { onMessage: { addListener() {} } } },
      fetch(url, options) {
        calls.push({ url, options });
        const wait = () => new Promise((_, reject) => {
          if (options.signal.aborted) reject(new Error('Request aborted'));
          else options.signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
        });
        if (stalled && phase === 'headers') return wait();
        return Promise.resolve({ ok: true, json: () => stalled ? wait() : Promise.resolve({ data: [] }) });
      }
    });
    vm.runInContext(workerSource, context);
    const failed = context.readJson('https://users.roblox.com/v1/users/123');
    const rejected = assert.rejects(failed, /Request aborted/);
    await new Promise(setImmediate);
    time.elapse(15_000); time.flush();
    await rejected;
    assert.equal(calls[0].options.signal.aborted, true, phase);
    assert.equal(time.timers.size, 0);
    stalled = false;
    assert.equal((await context.readJson(calls[0].url)).data.length, 0);
    assert.equal(calls[1].options.credentials, 'include', 'Authentication behavior is preserved');
    assert.equal(time.timers.size, 0);
  }
});
