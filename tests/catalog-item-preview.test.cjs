const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/pages/catalog/catalog-item-page.js'), 'utf8');
const backgroundSource = fs.readFileSync(path.join(__dirname, '..', 'src/background/service-worker.js'), 'utf8');
const CROWN = 10159600649;
const BUNDLE = 33230277606065;
const IMAGE_URL = 'https://tr.rbxcdn.com/crown/420/420/Hat/Png/noFilter';

// Structural fixture of Roblox's separate React mounts. Requests and image loads
// remain deferred so navigation and native rerenders can race with them.
class Element {
  constructor(tag = 'div', attributes = {}) {
    this.tag = tag;
    this.nodeType = tag === 'document' ? 9 : 1;
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.parentElement = null;
    this.listeners = {};
    this.text = '';
    this.disabled = false;
    this.hidden = false;
    this.src = '';
    this.alt = '';
  }
  get id() { return this.getAttribute('id') || ''; }
  set id(value) { this.setAttribute('id', value); }
  get isConnected() { return this.tag === 'document' || !!this.parentElement?.isConnected; }
  get firstElementChild() { return this.children[0] || null; }
  get previousElementSibling() {
    const siblings = this.parentElement?.children || [];
    return siblings[siblings.indexOf(this) - 1] || null;
  }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { for (const child of [...this.children]) child.remove(); this.text = value; }
  set innerHTML(html) {
    const stack = [this];
    for (const token of html.match(/<[^>]+>|[^<]+/g) || []) {
      if (token.startsWith('</')) { stack.pop(); continue; }
      if (!token.startsWith('<')) { stack.at(-1).text += token; continue; }
      const tag = token.match(/^<([\w-]+)/)[1];
      const attributes = Object.fromEntries([...token.matchAll(/([\w-]+)="([^"]*)"/g)]
        .map(([, name, value]) => [name, value]));
      const child = new Element(tag, attributes);
      child.hidden = /\bhidden(?:\s|>)/.test(token);
      child.alt = attributes.alt || '';
      stack.at(-1).append(child);
      if (tag !== 'img') stack.push(child);
    }
  }
  append(...nodes) {
    for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); }
  }
  prepend(node) { node.remove(); node.parentElement = this; this.children.unshift(node); }
  replaceChildren(...nodes) {
    for (const child of [...this.children]) child.remove();
    this.append(...nodes);
  }
  after(node) {
    const parent = this.parentElement;
    node.remove(); node.parentElement = parent;
    parent.children.splice(parent.children.indexOf(this) + 1, 0, node);
  }
  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      if (part.startsWith('#')) return this.id === part.slice(1);
      if (part.startsWith('.')) return (this.getAttribute('class') || '').split(/\s+/).includes(part.slice(1));
      const attribute = part.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
      if (attribute) return this.hasAttribute(attribute[1])
        && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]);
      return this.tag === part;
    });
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  click() { if (!this.disabled) for (const callback of this.listeners.click || []) callback(); }
}

function nativeItem(id = CROWN, { threeD = false, supported = true, deferModeChanges = false, bundle = false } = {}) {
  const host = new Element('div', { class: 'clearfix' });
  const preview = new Element('div', { id: 'item-thumbnail-container-frontend',
    'data-target-id': String(id), 'data-is-bundle': String(bundle), 'data-show-3d-mode-button': String(supported) });
  const surface = new Element('div', { class: 'item-details-thumbnail-container' });
  const holder = new Element('div', { class: 'thumbnail-holder' });
  const controls = new Element('div', { class: 'thumbnail-ui-container' });
  const mode = new Element('button'); mode.textContent = threeD ? '2D' : '3D';
  const tryOn = new Element('button'); tryOn.textContent = 'Try On';
  const info = new Element('div', { id: 'item-info-container-frontend', 'data-target-id': String(id), 'data-is-bundle': String(bundle) });
  const title = new Element('h1'); title.textContent = bundle ? 'R6' : '8-Bit Royal Crown';
  const buy = new Element('button'); buy.textContent = 'Buy';
  const favorites = new Element('div', { id: 'favorites-button' });
  const report = new Element('div', { id: 'item-report-button-frontend' });
  host.append(preview, info, favorites, report);
  preview.append(surface); surface.append(holder, controls);
  if (supported) controls.append(mode);
  controls.append(tryOn); info.append(title, buy);
  let modeClicks = 0;
  let tryOnClicks = 0;
  const pendingModeChanges = [];
  mode.addEventListener('click', () => {
    modeClicks++;
    const next3D = mode.textContent === '3D';
    const commit = () => {
      mode.textContent = next3D ? '2D' : '3D';
      holder.replaceChildren(...(next3D ? [new Element('canvas')] : []));
    };
    if (deferModeChanges) pendingModeChanges.push(commit);
    else commit();
  });
  tryOn.addEventListener('click', () => { tryOnClicks++; });
  if (threeD) holder.append(new Element('canvas'));
  return { host, preview, holder, controls, mode, tryOn, info, title, buy, favorites, report,
    commitModeChange() { assert.ok(pendingModeChanges.length); pendingModeChanges.shift()(); },
    get modeClicks() { return modeClicks; }, get tryOnClicks() { return tryOnClicks; } };
}

function environment({ pathname = `/catalog/${CROWN}/8-Bit-Royal-Crown`, productId = CROWN, observeChartSize = false, ...options } = {}) {
  const document = new Element('document');
  const content = new Element('main', { id: 'content' });
  document.append(content);
  document.createElement = tag => new Element(tag);
  const item = nativeItem(productId, options); content.append(item.host);
  const location = { pathname };
  const requests = [], images = [], microtasks = [], observers = [], timers = new Map(), events = new Map();
  const sizeObservers = [], resizeEvents = [];
  let timerId = 0;
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  class Image {
    constructor() { images.push(this); }
  }
  class SizeObserver {
    constructor(callback) { this.callback = callback; sizeObservers.push(this); }
    observe(node) { this.node = node; }
    disconnect() { this.node = null; }
  }
  const runtime = { lastError: null, sendMessage(message, callback) { requests.push({ message, callback }); } };
  vm.runInNewContext(source, { document, location, Element, Image, MutationObserver: Observer,
    Node: { ELEMENT_NODE: 1 }, chrome: { runtime }, Event,
    ResizeObserver: observeChartSize ? SizeObserver : undefined,
    dispatchEvent(event) { resizeEvents.push(event.type); },
    queueMicrotask(callback) { microtasks.push(callback); },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, callback) { events.set(name, callback); }
  });
  const env = { document, content, item, location, requests, images, timers, runtime, sizeObservers, resizeEvents,
    flush() {
      let count = 0;
      while (microtasks.length) {
        assert.ok(++count < 20, 'Layout settles without an observer loop');
        microtasks.shift()();
      }
    },
    notify(target = item.host, addedNodes = [], removedNodes = []) {
      for (const observer of observers) if (observer.active) observer.callback([{ target, addedNodes, removedNodes }]);
      this.flush();
    },
    navigate(pathname) { location.pathname = pathname; events.get('popstate')(); this.flush(); },
    get panel() { return document.querySelector('#rc-catalog-item-2d'); },
    complete(request = requests.at(-1), url = IMAGE_URL) {
      request.callback({ state: 'Completed', imageUrl: url });
      images.at(-1).onload();
    }
  };
  env.flush();
  return env;
}

test('catalog loads simultaneous views, replaces Try On with Refresh and keeps native purchase nodes', () => {
  const env = environment();
  const { item } = env;
  assert.equal(env.panel.previousElementSibling, item.preview);
  assert.equal(env.panel.parentElement, item.host);
  assert.equal(item.info.parentElement, item.host);
  assert.equal(item.modeClicks, 1);
  assert.equal(item.preview.getAttribute('data-rc-item-mode'), '3D Preview');
  assert.equal(item.mode.hasAttribute('data-rc-item-native-2d-toggle'), true);
  assert.equal(item.holder.querySelector('canvas').hasAttribute('data-rc-item-renderer'), true);
  assert.equal(item.tryOn.hasAttribute('data-rc-item-native-try-on'), true);
  const refresh = item.preview.querySelector('#rc-catalog-item-3d-refresh');
  assert.equal(refresh.parentElement, item.preview);
  assert.equal(refresh.textContent, 'Refresh');
  assert.equal(refresh.getAttribute('aria-label'), 'Refresh 3D preview');
  assert.equal(item.tryOnClicks, 0);
  assert.equal(item.buy.parentElement, item.info);
  assert.equal(item.favorites.parentElement, item.host);
  env.complete();
  assert.equal(env.panel.querySelector('img').src, IMAGE_URL);
  assert.equal(env.panel.querySelector('img').hidden, false);
  assert.equal(env.panel.querySelector('img').alt, '8-Bit Royal Crown in 2D');
  env.notify(); env.notify();
  assert.equal(env.requests.length, 1);
  assert.equal(env.document.querySelectorAll('#rc-catalog-item-2d').length, 1);
  assert.equal(item.modeClicks, 1);
});

test('bundle products receive the same previews and native controls using their bundle thumbnail', () => {
  const env = environment({ pathname: `/bundles/${BUNDLE}/R6`, productId: BUNDLE, bundle: true });
  assert.equal(env.item.host.hasAttribute('data-rc-item-studio'), true);
  assert.equal(env.item.modeClicks, 1);
  assert.equal(env.panel.parentElement, env.item.host);
  assert.equal(env.item.buy.parentElement, env.item.info);
  assert.equal(env.item.favorites.parentElement, env.item.host);
  assert.equal(env.requests[0].message.assetId, BUNDLE);
  assert.equal(env.requests[0].message.itemType, 'Bundle');
  env.complete(env.requests[0], 'https://tr.rbxcdn.com/bundle.png');
  assert.equal(env.panel.querySelector('img').alt, 'R6 in 2D');
  assert.equal(env.panel.querySelector('img').src, 'https://tr.rbxcdn.com/bundle.png');
  const canvas = env.item.holder.querySelector('canvas');
  env.item.preview.querySelector('#rc-catalog-item-3d-refresh').click(); env.flush();
  assert.notEqual(env.item.holder.querySelector('canvas'), canvas);
  assert.equal(env.requests.length, 1);
  const flat = environment({ pathname: `/bundles/${BUNDLE}/R6`, productId: BUNDLE, bundle: true, supported: false });
  assert.equal(flat.panel, null);
  assert.equal(flat.requests.length, 0);
});

test('asset and bundle IDs remain distinct during navigation, image loading and 3D refresh', () => {
  const env = environment({ threeD: true, deferModeChanges: true });
  env.requests[0].callback({ state: 'Completed', imageUrl: IMAGE_URL });
  const oldImage = env.images[0];
  env.item.preview.querySelector('#rc-catalog-item-3d-refresh').click(); env.flush();
  const oldPoll = [...env.timers.values()][0].callback;
  env.navigate(`/bundles/${CROWN}/Bundle`);
  assert.equal(env.panel, null, 'Wait for the old asset mount to be replaced, even with the same numeric ID');
  assert.equal(env.timers.size, 0);
  const bundle = nativeItem(CROWN, { bundle: true, threeD: true });
  env.item.host.remove(); env.content.append(bundle.host); env.notify(env.content, [bundle.host]);
  assert.equal(env.requests.at(-1).message.itemType, 'Bundle');
  oldImage.onload(); oldPoll(); env.flush();
  assert.equal(env.panel.querySelector('img').hidden, true);
  assert.equal(bundle.modeClicks, 0, 'An old asset refresh cannot switch the bundle viewer');
  const bundleRequest = env.requests.at(-1);
  env.navigate(`/catalog/${CROWN}/Crown`);
  assert.equal(env.panel, null);
  const asset = nativeItem(CROWN, { threeD: true });
  bundle.host.remove(); env.content.append(asset.host); env.notify(env.content, [asset.host]);
  bundleRequest.callback({ state: 'Completed', imageUrl: 'https://tr.rbxcdn.com/bundle.png' });
  assert.equal(env.panel.querySelector('img').hidden, true, 'A bundle response cannot paint the asset preview');
  assert.equal(env.requests.at(-1).message.itemType, 'Asset');
});

test('an already mounted 3D viewer is kept and 2D-only items retain their native layout', () => {
  const active = environment({ threeD: true });
  assert.equal(active.item.modeClicks, 0);
  assert.ok(active.panel);
  const flat = environment({ supported: false });
  assert.equal(flat.panel, null);
  assert.equal(flat.requests.length, 0);
  assert.equal(flat.item.host.hasAttribute('data-rc-item-studio'), false);
  const search = environment({ pathname: '/catalog' });
  assert.equal(search.panel, null);
});

test('loading native controls preserves both preview panels and temporarily disables 3D Refresh', () => {
  const env = environment(); env.complete();
  const panel = env.panel;
  env.item.controls.remove(); env.notify(env.item.preview, [], [env.item.controls]);
  assert.equal(env.panel, panel);
  assert.equal(env.requests.length, 1);
  assert.equal(env.item.preview.querySelector('#rc-catalog-item-3d-refresh').disabled, true);
  env.item.preview.querySelector('.item-details-thumbnail-container').append(env.item.controls);
  env.notify(env.item.preview, [env.item.controls]);
  assert.equal(env.item.modeClicks, 1);
  assert.equal(env.panel, panel);
  assert.equal(env.item.preview.querySelector('#rc-catalog-item-3d-refresh').disabled, false);
});

test('3D Refresh remounts the model without invoking Try On or fetching the independent 2D image', () => {
  const env = environment(); env.complete();
  const refresh = env.item.preview.querySelector('#rc-catalog-item-3d-refresh');
  const canvas = env.item.holder.querySelector('canvas');
  refresh.click(); refresh.click(); env.flush();
  assert.equal(env.item.modeClicks, 3, 'One initial 3D switch, then 2D and back to 3D');
  assert.notEqual(env.item.holder.querySelector('canvas'), canvas);
  assert.equal(env.item.holder.querySelector('canvas').hasAttribute('data-rc-item-renderer'), true);
  assert.equal(env.item.tryOnClicks, 0);
  assert.equal(env.requests.length, 1);
  assert.equal(env.panel.querySelector('img').src, IMAGE_URL);
  assert.equal(refresh.disabled, false);
  assert.equal(refresh.textContent, 'Refresh');
  assert.equal(env.item.preview.querySelector('#rc-catalog-item-3d-status').textContent, '');
  assert.equal(env.timers.size, 0);
  refresh.click(); env.flush();
  assert.equal(env.item.modeClicks, 5, 'Refresh remains usable after the first reload');
});

test('3D Refresh waits for native React commits before returning to 3D and keeps a single top control after rerenders', () => {
  const env = environment({ threeD: true, deferModeChanges: true });
  const refresh = env.item.preview.querySelector('#rc-catalog-item-3d-refresh');
  const canvas = env.item.holder.querySelector('canvas');
  refresh.click(); env.flush();
  assert.equal(env.item.modeClicks, 1);
  assert.equal(env.item.holder.querySelector('canvas'), canvas);
  assert.equal(refresh.disabled, true);
  assert.equal(refresh.textContent, 'Refreshing...');
  env.item.commitModeChange(); env.notify(env.item.controls);
  assert.equal(env.item.modeClicks, 2, 'The second click follows the committed 2D state');
  assert.equal(env.item.holder.querySelector('canvas'), null);
  assert.equal(refresh.disabled, true);
  env.item.commitModeChange(); env.notify(env.item.controls);
  assert.notEqual(env.item.holder.querySelector('canvas'), canvas);
  assert.equal(refresh.disabled, false);
  assert.equal(env.timers.size, 0);
  refresh.remove(); env.notify(env.item.preview, [], [refresh]);
  assert.equal(env.item.preview.querySelector('#rc-catalog-item-3d-refresh'), refresh);
  assert.equal(env.document.querySelectorAll('#rc-catalog-item-3d-refresh').length, 1);
  env.item.tryOn.remove(); env.notify(env.item.controls);
  assert.equal(env.item.tryOn.hasAttribute('data-rc-item-native-try-on'), false);
  const nextTryOn = new Element('button'); nextTryOn.textContent = 'Try On';
  env.item.controls.append(nextTryOn); env.notify(env.item.controls, [nextTryOn]);
  assert.equal(nextTryOn.hasAttribute('data-rc-item-native-try-on'), true);
});

test('stalled 3D refreshes stop polling and allow another attempt', () => {
  const env = environment({ threeD: true, deferModeChanges: true });
  const refresh = env.item.preview.querySelector('#rc-catalog-item-3d-refresh');
  refresh.click(); env.flush();
  for (let count = 0; count < 150; count++) {
    const [id, timer] = [...env.timers][0];
    env.timers.delete(id); timer.callback(); env.flush();
  }
  assert.equal(env.timers.size, 0);
  assert.equal(refresh.disabled, false);
  assert.match(env.item.preview.querySelector('#rc-catalog-item-3d-status').textContent, /Try Refresh/);
  assert.equal(env.item.modeClicks, 1, 'A stalled native transition is not repeatedly clicked');
  refresh.click(); env.flush();
  assert.equal(env.item.modeClicks, 2);
  assert.equal(refresh.disabled, true);
});

test('navigation cancels a pending 3D refresh and stale callbacks cannot switch a different item', () => {
  const env = environment({ threeD: true, deferModeChanges: true });
  const refresh = env.item.preview.querySelector('#rc-catalog-item-3d-refresh');
  refresh.click(); env.flush();
  const oldPoll = [...env.timers.values()][0].callback;
  env.navigate('/catalog/123/Other');
  assert.equal(refresh.isConnected, false);
  assert.equal(env.item.tryOn.hasAttribute('data-rc-item-native-try-on'), false);
  assert.equal(env.timers.size, 0);
  env.item.host.remove();
  const next = nativeItem(123, { threeD: true });
  env.content.append(next.host); env.notify(env.content, [next.host]);
  oldPoll(); refresh.click(); env.flush();
  assert.equal(next.modeClicks, 0);
  assert.equal(next.preview.querySelector('#rc-catalog-item-3d-refresh').disabled, false);
  assert.equal(env.document.querySelectorAll('#rc-catalog-item-3d-refresh').length, 1);
});

test('late item names update accessible image text without refetching the thumbnail', () => {
  const env = environment();
  env.item.title.textContent = 'A newly loaded item name';
  env.notify({ nodeType: 3, parentElement: env.item.title });
  assert.equal(env.panel.querySelector('img').alt, 'A newly loaded item name in 2D');
  assert.equal(env.requests.length, 1);
});

test('pending thumbnails retry finitely, and Refresh recovers API and image errors', () => {
  const env = environment();
  for (let attempt = 0; attempt < 4; attempt++) {
    env.requests.at(-1).callback({ state: 'Pending' });
    if (attempt < 3) {
      const [id, timer] = [...env.timers][0];
      env.timers.delete(id); timer.callback();
    }
  }
  assert.equal(env.requests.length, 4);
  assert.equal(env.timers.size, 0);
  const refresh = env.panel.querySelector('.rc-item-refresh');
  assert.equal(refresh.disabled, false);
  refresh.click(); env.requests.at(-1).callback({ error: 'API error' });
  assert.match(env.panel.querySelector('.rc-item-preview-status').textContent, /Try Refresh/);
  assert.equal(refresh.disabled, false);
  refresh.click(); env.requests.at(-1).callback({ state: 'Completed', imageUrl: IMAGE_URL });
  env.images.at(-1).onerror();
  assert.match(env.panel.querySelector('.rc-item-preview-status').textContent, /Could not display/);
  refresh.click(); env.complete();
  assert.equal(env.panel.querySelector('img').hidden, false);
  assert.equal(refresh.disabled, false);
});

test('blocked thumbnails do not retry and failed refreshes keep the last visible image', () => {
  const env = environment(); env.complete();
  env.panel.querySelector('.rc-item-refresh').click();
  env.requests.at(-1).callback({ state: 'Blocked' });
  assert.equal(env.timers.size, 0);
  assert.equal(env.panel.querySelector('img').src, IMAGE_URL);
  assert.equal(env.panel.querySelector('img').hidden, false);
});

test('late API and image responses cannot paint a different item after navigation', () => {
  const env = environment();
  env.requests[0].callback({ state: 'Completed', imageUrl: IMAGE_URL });
  const oldImage = env.images[0];
  const oldPanel = env.panel;
  env.navigate('/catalog/123/Other-Item');
  assert.equal(env.panel, null, 'The old React mount must match the route before it can be reused');
  assert.equal(env.item.host.hasAttribute('data-rc-item-studio'), false);
  oldImage.onload();
  assert.equal(oldPanel.querySelector('img').hidden, true);
  env.item.host.remove();
  const next = nativeItem(123); env.content.append(next.host); env.notify(env.content, [next.host]);
  assert.equal(env.requests.at(-1).message.assetId, 123);
  env.requests[0].callback({ state: 'Completed', imageUrl: IMAGE_URL });
  assert.equal(env.panel.querySelector('img').hidden, true);
  env.complete(env.requests.at(-1), 'https://tr.rbxcdn.com/other.png');
  assert.equal(env.panel.querySelector('img').src, 'https://tr.rbxcdn.com/other.png');
  env.navigate('/home');
  assert.equal(env.panel, null);
  assert.equal(next.preview.hasAttribute('data-rc-item-3d'), false);
  assert.equal(next.mode.hasAttribute('data-rc-item-native-2d-toggle'), false);
});

test('replaced React mounts get one fresh panel and old pending retries are cancelled', () => {
  const env = environment();
  env.requests[0].callback({ state: 'InReview' });
  const old = env.item.host;
  const next = nativeItem(); old.remove(); env.content.append(next.host);
  env.notify(env.content, [next.host], [old]);
  assert.equal(env.timers.size, 0);
  assert.equal(env.document.querySelectorAll('#rc-catalog-item-2d').length, 1);
  assert.equal(env.panel.parentElement, next.host);
  assert.equal(next.modeClicks, 1);
});

function nativeMarket(id = CROWN, { ownedReady = true } = {}) {
  const root = new Element('div', { id: 'asset-resale-data-container', 'data-target-id': String(id) });
  const shell = new Element('div', { class: 'resale-pricechart-tabs' });
  const wrapper = new Element(), paneWrapper = new Element();
  const tabs = new Element('ul', { id: 'horizontal-tabs', role: 'tablist' });
  const tab = new Element('button', { role: 'tab', 'aria-selected': 'true' }); tab.textContent = 'Your Inventory';
  const layout = new Element('div', { class: 'tab-content rbx-tab-content' });
  const chart = new Element('div', { id: 'price-chart', class: 'tab-pane price-chart-section' });
  const chartRenderer = new Element('div', { class: 'highcharts-container' });
  const range = new Element('button'); range.textContent = '180 Days';
  const owned = new Element('div', { id: 'item-details-limited-inventory-container', class: 'tab-pane active' });
  const inventory = new Element('div', { class: 'item-details-limited-inventory' });
  const count = new Element('span', { class: 'font-header-1' }); count.textContent = 'Owned Items (1)';
  const sell = new Element('button'); sell.textContent = 'Sell'; sell.disabled = true;
  const resellers = new Element('div', { id: 'resellers', class: 'tab-pane resellers-container' });
  const list = new Element('ul', { class: 'vlist' });
  const buy = new Element('button', { 'data-expected-price': '26000' }); buy.textContent = 'Buy';
  let rangeClicks = 0, buyClicks = 0, sellClicks = 0;
  range.addEventListener('click', () => { rangeClicks++; });
  buy.addEventListener('click', () => { buyClicks++; });
  sell.addEventListener('click', () => { sellClicks++; });
  root.append(shell); shell.append(wrapper); wrapper.append(paneWrapper);
  paneWrapper.append(tabs, layout); tabs.append(tab); layout.append(chart, owned, resellers);
  chart.append(range, chartRenderer); inventory.append(count, sell);
  if (ownedReady) owned.append(inventory);
  resellers.append(list); list.append(buy);
  return { root, layout, tabs, tab, chart, chartRenderer, range, owned, inventory, count, sell, resellers, list, buy,
    get rangeClicks() { return rangeClicks; }, get buyClicks() { return buyClicks; }, get sellClicks() { return sellClicks; } };
}

function addMarket(env, options) {
  const market = nativeMarket(CROWN, options);
  env.content.append(market.root); env.notify(env.content, [market.root]);
  return market;
}

test('market panels retain the chart, purchase handlers and disabled Sell state without adding navigation', () => {
  const env = environment({ supported: false });
  const market = addMarket(env);
  assert.equal(env.document.querySelector('#rc-catalog-market-nav'), null);
  assert.equal(market.root.children.length, 1, 'Only the native market mount remains');
  assert.equal(market.layout.hasAttribute('data-rc-market-layout'), true);
  assert.equal(market.chart.getAttribute('data-rc-market-section'), 'chart');
  assert.equal(market.owned.getAttribute('data-rc-market-section'), 'owned');
  assert.equal(market.resellers.getAttribute('data-rc-market-section'), 'resellers');
  assert.equal(market.chartRenderer.parentElement, market.chart);
  assert.equal(market.tab.getAttribute('aria-selected'), 'true');
  market.range.click(); market.buy.click(); market.sell.click();
  assert.equal(market.rangeClicks, 1);
  assert.equal(market.buyClicks, 1);
  assert.equal(market.sellClicks, 0);
  assert.equal(market.buy.getAttribute('data-expected-price'), '26000');
  assert.equal(market.sell.disabled, true);
  assert.equal(env.requests.length, 0, 'Market layout does not fetch separate sales data or require 3D');
});

test('late inventory loading and missing seller sections update the market cards', () => {
  const env = environment();
  const market = addMarket(env, { ownedReady: false });
  assert.equal(market.owned.hasAttribute('data-rc-market-section'), false);
  market.owned.append(market.inventory); env.notify(market.owned, [market.inventory]);
  assert.equal(market.owned.getAttribute('data-rc-market-section'), 'owned');
  assert.equal(market.count.textContent, 'Owned Items (1)');
  market.resellers.remove(); env.notify(market.layout, [], [market.resellers]);
  assert.equal(market.resellers.hasAttribute('data-rc-market-section'), false);
  assert.equal(env.document.querySelector('#rc-catalog-market-nav'), null);
});

test('seller pagination and native rerenders preserve appended controls without adding navigation', () => {
  const env = environment();
  const market = addMarket(env);
  const more = new Element('button'); more.textContent = 'See More';
  market.resellers.append(more);
  more.addEventListener('click', () => {
    const nextBuy = new Element('button'); nextBuy.textContent = 'Buy';
    market.list.append(nextBuy); env.notify(market.list, [nextBuy]);
  });
  more.click(); env.notify(market.root);
  assert.equal(market.list.children.length, 2);
  assert.equal(env.document.querySelector('#rc-catalog-market-nav'), null);
  const requests = env.requests.length;
  env.notify(market.chartRenderer, [new Element('svg')]);
  assert.equal(env.requests.length, requests);
});

test('market cards remove stale markers and handle replaced mounts independently of the preview', () => {
  const env = environment({ supported: false });
  const old = addMarket(env);
  env.navigate('/catalog/123/Other');
  assert.equal(env.document.querySelector('#rc-catalog-market-nav'), null);
  assert.equal(old.root.hasAttribute('data-rc-market-root'), false);
  assert.equal(old.chart.hasAttribute('data-rc-market-section'), false);
  old.root.remove();
  const next = nativeMarket(123); env.content.append(next.root); env.notify(env.content, [next.root], [old.root]);
  assert.equal(next.root.hasAttribute('data-rc-market-root'), true);
  assert.equal(next.chart.getAttribute('data-rc-market-section'), 'chart');
  next.root.remove();
  const replaced = nativeMarket(123); env.content.append(replaced.root); env.notify(env.content, [replaced.root], [next.root]);
  assert.equal(env.document.querySelector('#rc-catalog-market-nav'), null);
  assert.equal(replaced.root.hasAttribute('data-rc-market-root'), true);
  assert.equal(next.root.hasAttribute('data-rc-market-root'), false);
  env.navigate('/home');
  assert.equal(env.document.querySelector('#rc-catalog-market-nav'), null);
  assert.equal(replaced.owned.hasAttribute('data-rc-market-section'), false);
  assert.equal(replaced.layout.hasAttribute('data-rc-market-layout'), false);
});

test('chart resizing notifies the native renderer once per width change and stops after navigation', () => {
  const env = environment({ observeChartSize: true });
  const market = addMarket(env);
  const observer = env.sizeObservers[0];
  assert.equal(observer.node, market.chart);
  observer.callback([{ target: market.chart, contentRect: { width: 600, height: 350 } }]);
  observer.callback([{ target: market.chart, contentRect: { width: 600, height: 420 } }]);
  assert.deepEqual(env.resizeEvents, ['resize']);
  observer.callback([{ target: market.chart, contentRect: { width: 500, height: 420 } }]);
  assert.deepEqual(env.resizeEvents, ['resize', 'resize']);
  env.navigate('/home');
  assert.equal(observer.node, null);
  observer.callback([{ target: market.chart, contentRect: { width: 300, height: 420 } }]);
  assert.equal(env.resizeEvents.length, 2);
});

function background(result) {
  let listener;
  const requests = [];
  vm.runInNewContext(backgroundSource, { URL, AbortController, setTimeout, clearTimeout,
    chrome: { runtime: { onMessage: { addListener(callback) { listener = callback; } } } },
    async fetch(url, options) {
      requests.push({ url, options });
      return { ok: true, json: async () => result };
    }
  });
  return { requests, async send(message, url = `https://www.roblox.com/catalog/${CROWN}/Crown`) {
    let resolve;
    const response = new Promise(done => { resolve = done; });
    const accepted = listener(message, { url }, resolve);
    return { accepted: accepted === true, response: accepted === true ? await response : undefined };
  } };
}

test('thumbnail worker fetches only the exact catalog item through the official API', async () => {
  const env = background({ data: [{ targetId: CROWN, state: 'Completed', imageUrl: IMAGE_URL }] });
  const message = { type: 'rc-catalog-item-2d', assetId: CROWN };
  for (const url of ['https://www.roblox.com/catalog', 'https://www.roblox.com/catalog/123/Other',
    'https://www.roblox.com/catalog/10159600649oops', 'https://www.roblox.com/games/10159600649/Game',
    'https://roblox.com.evil.example/catalog/10159600649', 'http://www.roblox.com/catalog/10159600649']) {
    assert.equal((await env.send(message, url)).accepted, false);
  }
  assert.equal((await env.send({ ...message, assetId: String(CROWN) })).accepted, false);
  assert.equal(env.requests.length, 0);
  assert.equal((await env.send(message)).response.imageUrl, IMAGE_URL);
  const url = new URL(env.requests[0].url);
  assert.equal(url.origin + url.pathname, 'https://thumbnails.roblox.com/v1/assets');
  assert.equal(url.searchParams.get('assetIds'), String(CROWN));
  assert.equal(url.searchParams.get('size'), '420x420');
});

test('worker preserves generation states and rejects unrelated items and unsafe image URLs', async () => {
  const message = { type: 'rc-catalog-item-2d', assetId: CROWN };
  const pending = background({ data: [{ targetId: CROWN, state: 'Pending' }] });
  assert.equal((await pending.send(message)).response.state, 'Pending');
  const blocked = background({ data: [{ targetId: CROWN, state: 'Blocked' }] });
  assert.equal((await blocked.send(message)).response.state, 'Blocked');
  const wrong = background({ data: [{ targetId: 123, state: 'Completed', imageUrl: IMAGE_URL }] });
  assert.ok((await wrong.send(message)).response.error);
  for (const imageUrl of ['https://rbxcdn.com.evil.example/image.png', 'http://tr.rbxcdn.com/image.png',
    'javascript:alert(1)', undefined]) {
    const env = background({ data: [{ targetId: CROWN, state: 'Completed', imageUrl }] });
    assert.ok((await env.send(message)).response.error);
  }
});

test('thumbnail worker uses the official bundle endpoint and rejects an asset/bundle type mismatch', async () => {
  const env = background({ data: [{ targetId: BUNDLE, state: 'Completed', imageUrl: IMAGE_URL }] });
  const message = { type: 'rc-catalog-item-2d', assetId: BUNDLE, itemType: 'Bundle' };
  const bundleUrl = `https://www.roblox.com/bundles/${BUNDLE}/R6`;
  assert.equal((await env.send(message, bundleUrl)).response.imageUrl, IMAGE_URL);
  const url = new URL(env.requests[0].url);
  assert.equal(url.origin + url.pathname, 'https://thumbnails.roblox.com/v1/bundles/thumbnails');
  assert.equal(url.searchParams.get('bundleIds'), String(BUNDLE));
  assert.equal(url.searchParams.has('assetIds'), false);
  assert.equal(url.searchParams.get('size'), '420x420');
  for (const [request, source] of [
    [{ ...message, itemType: 'Asset' }, bundleUrl],
    [message, `https://www.roblox.com/catalog/${BUNDLE}/Asset`],
    [message, `https://www.roblox.com/bundles/${BUNDLE}oops`],
    [{ ...message, assetId: BUNDLE + 1 }, bundleUrl],
    [{ ...message, itemType: 'Unknown' }, bundleUrl]
  ]) assert.equal((await env.send(request, source)).accepted, false);
  assert.equal(env.requests.length, 1);
});
