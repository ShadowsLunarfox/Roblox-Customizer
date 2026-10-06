/* Shared, independent conversion logic. Prices are reference purchase prices per 500 Robux. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'robuxCurrency';
  const RATE_STORAGE_KEY = 'robuxCurrencyRates';
  const DEFAULTS = Object.freeze({ enabled: true, currency: 'USD' });
  // Reference: BTRoblox's public Robux-to-cash price table. Actual checkout prices can vary.
  const PURCHASE_PRICES = Object.freeze({
    USD: 4.99, EUR: 5.99, AUD: 8.49, GBP: 4.99, NZD: 9.99, CAD: 6.99,
    SEK: 65, NOK: 70, DKK: 45, PLN: 29.99, CZK: 150, RON: 29.99,
    HUF: 2490, CHF: 5, RUB: 539, MXN: 129, CLP: 5500, BRL: 29.90,
    COP: 29900, PEN: 17.90, INR: 500, THB: 200, SGD: 6.98, JPY: 800,
    KRW: 7500, IDR: 90000, PHP: 350, MYR: 23.90, VND: 129000,
    HKD: 38, TWD: 170, SAR: 24.99, AED: 17.99, ZAR: 99.99
  });
  const FALLBACK_CODES = 'AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG ZWL'.split(' ');
  let supported;
  try { supported = Intl.supportedValuesOf('currency'); } catch { supported = FALLBACK_CODES; }
  const CURRENCIES = Object.freeze([...new Set([...supported, ...FALLBACK_CODES])].filter(code => !/^X(?:AU|AG|PT|PD|DR|TS|XX|BA|BB|BC|BD|SU|UA)$/.test(code)).sort());
  const currencySet = new Set(CURRENCIES);

  function normalizeSettings(value) {
    return { enabled: value?.enabled !== false, currency: currencySet.has(value?.currency) ? value.currency : DEFAULTS.currency };
  }

  function parseRobux(value) {
    let text = String(value ?? '').normalize('NFKC')
      .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 0x660))
      .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
      .replace(/\u066c/g, ',').replace(/\u066b/g, '.')
      .replace(/[\u200e\u200f\u061c]/g, '').replace(/\u2212/g, '-')
      .trim().replace(/^(?:R\$\s*|Robux\s+)/i, '').replace(/\s*Robux$/i, '').trim();
    const match = /^([+-]?\d[\d.,'\s]*)([KMB])?$/i.exec(text);
    if (!match) return null;
    let number = match[1].trim().replace(/[\s']/g, '');
    const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase()] || 1;
    if (multiplier === 1) {
      // Robux counts are integers; accept western and Indian thousands grouping.
      if (/[.,]/.test(number) && !/^[+-]?\d{1,3}(?:[.,]\d{3})+$/.test(number) && !/^[+-]?\d{1,2}(?:,\d{2})*,\d{3}$/.test(number)) return null;
      number = number.replace(/[.,]/g, '');
    } else {
      if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(number)) return null;
      number = number.replace(',', '.');
    }
    const amount = Number(number) * multiplier;
    return Number.isSafeInteger(amount) ? amount : null;
  }

  function sanitizeRates(payload) {
    if (!payload || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date || '')) return null;
    const date = new Date(`${payload.date}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== payload.date) return null;
    const source = payload.usd || payload.rates;
    if (!source || Math.abs(Number(source.usd ?? source.USD) - 1) > 0.000001 || !Number.isFinite(Number(source.usd ?? source.USD))) return null;
    const rates = {};
    for (const code of CURRENCIES) {
      const value = source[code.toLowerCase()] ?? source[code];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e12) rates[code] = value;
    }
    if (Object.keys(rates).length < 2) return null;
    return { date: payload.date, rates };
  }

  function convert(amount, currency, snapshot) {
    if (!Number.isSafeInteger(amount) || !currencySet.has(currency)) return null;
    const localPrice = PURCHASE_PRICES[currency];
    const rate = snapshot?.rates?.[currency];
    if (!localPrice && !(typeof rate === 'number' && Number.isFinite(rate) && rate > 0)) return null;
    const value = amount / 500 * (localPrice || PURCHASE_PRICES.USD * rate);
    if (!Number.isFinite(value)) return null;
    return { value, currency, localPrice: localPrice || null, date: localPrice ? null : snapshot.date, stale: !localPrice && !!snapshot.stale };
  }

  function format(result, locale) {
    if (!result) return '';
    const formatter = new Intl.NumberFormat(locale || undefined, { style: 'currency', currency: result.currency, currencyDisplay: 'narrowSymbol' });
    return `≈ ${formatter.format(result.value)} ${result.currency}`;
  }

  function description(result) {
    if (!result) return 'Currency estimate unavailable.';
    if (result.localPrice) return `Estimated purchase equivalent using a reference price of ${result.localPrice} ${result.currency} per 500 Robux. Actual checkout prices may vary.`;
    return `Estimated purchase equivalent using 4.99 USD per 500 Robux and exchange rates dated ${result.date}${result.stale ? ' (cached; refresh unavailable)' : ''}.`;
  }

  const api = Object.freeze({ STORAGE_KEY, RATE_STORAGE_KEY, DEFAULTS, PURCHASE_PRICES, CURRENCIES, normalizeSettings, parseRobux, sanitizeRates, convert, format, description });
  root.RobloxCustomizerCurrencyCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
