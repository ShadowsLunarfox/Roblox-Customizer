const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const core = require('../src/currency/robux-currency-core.js');
const workerSource = fs.readFileSync(path.join(__dirname, '..', 'src/background/robux-currency-background.js'), 'utf8');

test('Robux parsing accepts localized counts and compact notation without extracting unrelated numbers', () => {
  for (const [text, amount] of [['0', 0], ['250', 250], ['26,498', 26498], ['26.498', 26498], ['26\u202f498', 26498], ['1,23,456', 123456], ['−1,000', -1000], ['١٢٬٣٤٥', 12345], ['۲۵۰', 250], ['１２５', 125], ['R$ 250', 250], ['250 Robux', 250], ['12.5K', 12500], ['1,5M', 1500000]]) assert.equal(core.parseRobux(text), amount, text);
  for (const text of ['', 'Free', 'Off Sale', 'Item 250', '250 favorites', '2026-10-04', '12,5', '12.5', '1.2.3', 'Infinity', '9007199254740992']) assert.equal(core.parseRobux(text), null, text);
});

test('purchase references and exchange-based currencies use distinct, correct bases', () => {
  assert.equal(core.convert(250, 'MYR').value, 11.95);
  assert.equal(core.convert(500, 'USD').value, 4.99);
  assert.equal(core.convert(0, 'JPY').value, 0);
  assert.equal(core.convert(-500, 'EUR').value, -5.99);
  const fx = core.convert(500, 'CNY', { rates: { CNY: 7.1 }, date: '2026-10-04', stale: true });
  assert.equal(fx.value, 4.99 * 7.1);
  assert.equal(fx.stale, true);
  assert.match(core.description(fx), /2026-10-04.*cached/);
  assert.equal(core.convert(250, 'CNY'), null);
  assert.equal(core.convert(250, 'BTC', { rates: { BTC: 1 } }), null);
  assert.equal(core.convert(NaN, 'USD'), null);
  assert.equal(core.convert(250, 'CNY', { rates: { CNY: Infinity } }), null);
});

test('currency formatting respects currency precision and settings reject invalid codes', () => {
  assert.match(core.format(core.convert(250, 'MYR'), 'en-US'), /11\.95 MYR$/);
  assert.match(core.format(core.convert(250, 'JPY'), 'en-US'), /400 JPY$/);
  assert.match(core.format(core.convert(500, 'KWD', { rates: { KWD: .306 }, date: '2026-10-04' }), 'en-US'), /1\.527 KWD$/);
  assert.deepEqual(core.normalizeSettings({ enabled: false, currency: 'MYR' }), { enabled: false, currency: 'MYR' });
  assert.deepEqual(core.normalizeSettings({ currency: 'not-a-currency' }), core.DEFAULTS);
  assert.ok(core.CURRENCIES.includes('MYR') && core.CURRENCIES.includes('CNY'));
  assert.ok(!core.CURRENCIES.includes('BTC') && !core.CURRENCIES.includes('XAU'));
});

test('rate validation discards non-currencies and invalid rates', () => {
  assert.deepEqual(core.sanitizeRates({ date: '2026-10-04', usd: { usd: 1, cny: 7.1, btc: 1, eur: -1, myr: Infinity } }), { date: '2026-10-04', rates: { CNY: 7.1, USD: 1 } });
  assert.equal(core.sanitizeRates({ date: 'yesterday', usd: { usd: 1, cny: 7 } }), null);
  assert.equal(core.sanitizeRates({ date: '2026-02-30', usd: { usd: 1, cny: 7 } }), null);
  assert.equal(core.sanitizeRates({ date: '2026-10-04', usd: { usd: 2, cny: 7 } }), null);
  assert.equal(core.sanitizeRates({ date: '2026-10-04', usd: { cny: 7 } }), null);
});

function worker({ cached, fetchImpl } = {}) {
  let listener;
  let writes = 0;
  const requests = [];
  const data = { [core.RATE_STORAGE_KEY]: cached };
  const context = vm.createContext({
    RobloxCustomizerCurrencyCore: core, URL, AbortController, setTimeout, clearTimeout, Date,
    chrome: {
      runtime: { id: 'extension-id', onMessage: { addListener(fn) { listener = fn; } } },
      storage: { local: { async get() { return data; }, async set(value) { writes++; Object.assign(data, value); } } }
    },
    async fetch(url, options) { requests.push({ url, options }); return fetchImpl ? fetchImpl(url, options) : { ok: true, async json() { return { date: '2026-10-04', usd: { usd: 1, cny: 7.1, myr: 4.1 } }; } }; }
  });
  vm.runInContext(workerSource, context);
  function query(message = {}, sender = { url: 'https://www.roblox.com/catalog/123', id: 'extension-id' }) {
    return new Promise(resolve => {
      const result = listener({ type: 'rc-currency-rates', ...message }, sender, resolve);
      if (result !== true) resolve(undefined);
    });
  }
  return { query, requests, get writes() { return writes; } };
}

test('worker caches rates and deduplicates requests across Roblox pages without sending account data', async () => {
  const harness = worker();
  const [first, second] = await Promise.all([harness.query(), harness.query({}, { url: 'https://create.roblox.com/dashboard', id: 'extension-id' })]);
  assert.equal(first.rates.CNY, 7.1);
  assert.equal(second.rates.CNY, 7.1);
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].options.credentials, 'omit');
  assert.equal(harness.requests[0].options.body, undefined);
  assert.equal(harness.writes, 1);
  await harness.query();
  assert.equal(harness.requests.length, 1);
  await harness.query({ force: true });
  assert.equal(harness.requests.length, 2);
});

test('worker only serves authorized HTTPS Roblox surfaces', async () => {
  const harness = worker();
  for (const sender of [{ url: 'https://evil.example/' }, { url: 'http://www.roblox.com/' }, { url: 'https://www.roblox.com.evil.example/' }, { url: 'https://www.roblox.com/', id: 'different-extension' }, { url: 'invalid' }]) assert.equal(await harness.query({}, sender), undefined);
  assert.equal(harness.requests.length, 0);
  assert.equal(await harness.query({ type: 'another-message' }), undefined);
});

test('worker uses the backup when the primary fails validation', async () => {
  const harness = worker({ fetchImpl: async url => ({ ok: true, async json() { return url.includes('jsdelivr') ? { date: 'invalid' } : { date: '2026-10-04', usd: { usd: 1, cny: 7.2 } }; } }) });
  assert.equal((await harness.query()).rates.CNY, 7.2);
  assert.equal(harness.requests.length, 2);
  assert.match(harness.requests[1].url, /currency-api\.pages\.dev/);
});

test('worker falls back to dated cache offline, backs off, and rejects expired cache', async () => {
  const cached = { date: '2026-10-01', rates: { USD: 1, CNY: 7 }, fetchedAt: Date.now() - 2 * 86400000 };
  const harness = worker({ cached, fetchImpl: async () => { throw new Error('offline'); } });
  const response = await harness.query();
  assert.equal(response.stale, true);
  assert.equal(response.date, cached.date);
  await harness.query();
  assert.equal(harness.requests.length, 2);
  const expired = worker({ cached: { ...cached, fetchedAt: Date.now() - 31 * 86400000 }, fetchImpl: async () => { throw new Error('offline'); } });
  assert.equal((await expired.query()).ok, false);
});
