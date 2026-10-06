const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'game-page.js'), 'utf8');
const exposed = source.replace(/  syncPrivateServers\(\);\s*  schedule\(\);\s*\}\)\(\);\s*$/, `
  globalThis.servers = { filter: publicServerFilter, publicServerPlayerCount,
    filteredPublicServerCards, publicServerCards, publicServerBrowser,
    syncPublicServerFilters, navigatePublicServerPage, sortNativePublicServers, searchPublicServers,
    publicServerLoadMore, hideNativePublicServerControls, hidePrivateServerLoadMore,
    syncPrivateServers, privateServerSourceMutation, privateDetails,
    bind(page, container) {
      syncPublicServerStatuses = () => syncPublicServerFilters(page, container, publicServerCards(container));
    }
  };
})();`);
assert.notEqual(exposed, source, 'Exercise the actual content script');

// Structural DOM and native loader events; no Roblox requests or layout are mocked.
function environment(count = 0) {
  const observers = new Set();
  const timers = new Map();
  const requests = [];
  let timerId = 0;
  let clockOffset = 0;
  const notify = target => {
    for (const observer of [...observers]) {
      if (observer.root?.contains(target)) observer.callback([]);
    }
  };
  const datasetKey = name => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  class Element {
    constructor(tag = 'div', { id = '', className = '', text = '' } = {}) {
      this.tagName = tag;
      this.id = id;
      this.className = className;
      this.text = text;
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this.attributes = {};
      this.listeners = {};
      this.disabled = false;
      this.value = '';
      this.style = { removeProperty(name) { delete this[name]; } };
      this.nodeType = 1;
    }
    get classList() {
      const element = this;
      const contains = name => element.className.split(/\s+/).includes(name);
      const toggle = (name, force) => {
        const add = force ?? !contains(name);
        const classes = element.className.split(/\s+/).filter(value => value && value !== name);
        if (add) classes.push(name);
        element.className = classes.join(' ');
        return add;
      };
      return { contains, toggle, add(...names) { names.forEach(name => toggle(name, true)); },
        remove(...names) { names.forEach(name => toggle(name, false)); } };
    }
    get src() { return this.getAttribute('src') || ''; }
    set src(value) { this.setAttribute('src', value); }
    get srcset() { return this.getAttribute('srcset') || ''; }
    set srcset(value) { this.setAttribute('srcset', value); }
    get sizes() { return this.getAttribute('sizes') || ''; }
    set sizes(value) { this.setAttribute('sizes', value); }
    get href() { return this.getAttribute('href') || ''; }
    get isConnected() { return this.tagName === 'document' || !!this.parentElement?.isConnected; }
    get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.text = value; this.children = []; notify(this); }
    get nextElementSibling() {
      const siblings = this.parentElement?.children || [];
      return siblings[siblings.indexOf(this) + 1] || null;
    }
    get previousElementSibling() {
      const siblings = this.parentElement?.children || [];
      return siblings[siblings.indexOf(this) - 1] || null;
    }
    get lastElementChild() { return this.children.at(-1); }
    get firstElementChild() { return this.children[0] || null; }
    append(...nodes) {
      for (const node of nodes) {
        node.remove();
        node.parentElement = this;
        this.children.push(node);
      }
      notify(this);
    }
    remove() {
      const parent = this.parentElement;
      if (parent) {
        parent.children.splice(parent.children.indexOf(this), 1);
        this.parentElement = null;
        notify(parent);
      }
    }
    before(node) {
      const parent = this.parentElement;
      node.remove();
      node.parentElement = parent;
      parent.children.splice(parent.children.indexOf(this), 0, node);
      notify(parent);
    }
    after(node) {
      const parent = this.parentElement;
      node.remove();
      node.parentElement = parent;
      parent.children.splice(parent.children.indexOf(this) + 1, 0, node);
      notify(parent);
    }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentElement = null;
      this.children = [];
      this.append(...nodes);
    }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    setAttribute(name, value) {
      if (name.startsWith('data-')) this.dataset[datasetKey(name)] = String(value);
      else this.attributes[name] = String(value);
    }
    getAttribute(name) {
      return (name.startsWith('data-') ? this.dataset[datasetKey(name)] : this.attributes[name]) ?? null;
    }
    hasAttribute(name) { return this.getAttribute(name) !== null; }
    removeAttribute(name) {
      if (name.startsWith('data-')) delete this.dataset[datasetKey(name)];
      else delete this.attributes[name];
    }
    toggleAttribute(name, force) {
      if (force ?? !this.hasAttribute(name)) this.setAttribute(name, '');
      else this.removeAttribute(name);
    }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();
        const attributes = [...part.matchAll(/\[([\w-]+)(?:(\*?=)"([^"]*)")?\]/g)];
        if (!attributes.every(([, name, operator, value]) => {
          const actual = this.getAttribute(name);
          return actual !== null && (!operator || (operator === '*=' ? actual.includes(value) : actual === value));
        })) return false;
        part = part.replace(/\[[^\]]*\]/g, '');
        if (!part) return true;
        if (part.startsWith('#')) return this.id === part.slice(1);
        if (part.startsWith('.')) return this.className.split(/\s+/).includes(part.slice(1));
        return this.tagName === part;
      });
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) {
      if (selector.startsWith(':scope > ')) return this.children.filter(child => child.matches(selector.slice(9)));
      return this.children.flatMap(child => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
      ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    dispatchEvent(event) {
      event.target ||= this;
      for (const callback of this.listeners[event.type] || []) callback(event);
      if (event.bubbles) this.parentElement?.dispatchEvent(event);
    }
    click() { if (!this.disabled) this.dispatchEvent({ type: 'click', target: this }); }
  }
  class Select extends Element {
    get options() { return this.children.filter(child => child.tagName === 'option'); }
    get value() { return this.selectedValue || ''; }
    set value(value) { this.selectedValue = value; }
  }
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe(root) { this.root = root; observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const document = new Element('document');
  document.documentElement = { lang: 'en' };
  document.createElement = tag => tag === 'select' ? new Select(tag) : new Element(tag);
  document.createTreeWalker = root => {
    const texts = [];
    const visit = element => {
      if (element.text) texts.push({ nodeType: 3, textContent: element.text, parentElement: element });
      element.children.forEach(visit);
    };
    visit(root);
    let index = 0;
    return { nextNode() { return texts[index++] || null; } };
  };
  const location = { pathname: '/games/123/Test', href: 'https://www.roblox.com/games/123/Test' };
  const context = vm.createContext({ document, location, URL, Intl, Element, AbortController,
    Date: class extends Date { static now() { return Date.now() + clockOffset; } },
    NodeFilter: { SHOW_TEXT: 4 },
    chrome: { runtime: { lastError: null, sendMessage(message, callback) { requests.push({ message, callback }); } } },
    HTMLSelectElement: Select, Event: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    MutationObserver: Observer, ResizeObserver: Observer, window: { addEventListener() {} },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(exposed, context);
  const page = new Element('main', { id: 'game-detail-page' });
  const container = new Element('section', { id: 'running-game-instances-container', className: 'server-list-section' });
  const heading = new Element('h2', { text: 'Public Servers' });
  const grid = new Element('ul', { className: 'card-list' });
  document.append(page);
  page.append(container);
  container.append(heading, grid);
  const card = (players, country = 'MY', ping = 80) => {
    const node = new Element('li', { className: 'card-item' });
    if (players !== null) node.setAttribute('data-rc-playing', players);
    node.dataset.rcServerCountry = country;
    node.dataset.rcServerCountryState = country ? 'known' : 'unknown';
    node.dataset.rcServerPing = String(ping);
    return node;
  };
  for (let i = 0; i < count; i++) grid.append(card(i));
  const api = context.servers;
  api.bind(page, container);
  const sync = () => api.syncPublicServerFilters(page, container, api.publicServerCards(container));
  const visible = () => grid.children.filter(node => !node.hasAttribute('data-rc-server-filtered')
    && !node.hasAttribute('data-rc-server-page-hidden'));
  const loader = callback => {
    const button = new Element('button', { text: 'Load More' });
    button.addEventListener('click', () => callback(button));
    container.append(button);
    return button;
  };
  return { api, document, page, container, heading, grid, card, sync, visible, loader,
    Element, Select, timers, location, requests,
    advanceTime(ms) { clockOffset += ms; },
    mutate(records) {
      for (const observer of [...observers]) if (observer.root === document) observer.callback(records);
    },
    updateDetails(node, details) { Object.assign(node.dataset, details); notify(node); } };
}

test('filters sit below Public Servers and pagination shows eight, then the final partial page', async () => {
  const env = environment(17);
  env.sync();
  const { api, page, container, grid, heading, visible } = env;
  assert.equal(container.children[0], heading);
  assert.equal(page.querySelector('.rc-public-server-filters').nextElementSibling, grid);
  assert.equal(page.querySelector('.rc-public-server-pagination').previousElementSibling, grid);
  assert.equal(visible().length, 8);
  assert.equal(page.querySelector('.rc-public-server-previous').disabled, true);
  await api.navigatePublicServerPage(page, container, 1);
  assert.deepEqual(visible().map(api.publicServerPlayerCount), [8, 9, 10, 11, 12, 13, 14, 15]);
  await api.navigatePublicServerPage(page, container, 1);
  assert.deepEqual(visible().map(api.publicServerPlayerCount), [16]);
  assert.equal(page.querySelector('.rc-public-server-next').disabled, true);
  assert.equal(page.querySelector('.rc-public-server-page-number').textContent, 'Page 3');
  await api.navigatePublicServerPage(page, container, -1);
  assert.equal(visible().length, 8);
  assert.equal(page.querySelector('.rc-public-server-page-number').textContent, 'Page 2');
});

test('player ranges combine with country and ping, include zero, and exclude unknown counts', () => {
  const { api, card, Element } = environment();
  const zero = card(0);
  const selected = card(5);
  const cards = [zero, selected, card(12), card(5, 'US'), card(5, 'MY', 300), card(null)];
  Object.assign(api.filter, { country: 'MY', maxPing: '100', minPlayers: '0', maxPlayers: '5' });
  assert.deepEqual([...api.filteredPublicServerCards(cards)], [zero, selected]);
  const textCard = new Element('li', { text: '1,234 of 2,000 people max' });
  assert.equal(api.publicServerPlayerCount(textCard), 1234);
  textCard.textContent = '0 / 12';
  assert.equal(api.publicServerPlayerCount(textCard), 0);
  textCard.textContent = 'Players unavailable';
  assert.equal(api.publicServerPlayerCount(textCard), null);
});

test('filters and Search keep matching cards visible inside a shared list wrapper', async () => {
  const env = environment(12);
  const group = new env.Element('div');
  group.append(...env.grid.children);
  env.grid.append(group);
  env.api.filter.maxPlayers = '5';
  env.sync();
  const rendered = () => [...env.api.publicServerCards(env.container)].filter(card =>
    !card.closest('[data-rc-server-filtered], [data-rc-server-page-hidden]'));
  assert.deepEqual(rendered().map(env.api.publicServerPlayerCount), [0, 1, 2, 3, 4, 5]);
  await env.api.searchPublicServers(env.page, env.container);
  assert.match(env.page.querySelector('.rc-public-server-page-message').textContent, /Found 6/);
  assert.deepEqual(rendered().map(env.api.publicServerPlayerCount), [0, 1, 2, 3, 4, 5]);
  env.page.querySelector('.rc-public-server-filter-reset').click();
  env.sync();
  assert.deepEqual(rendered().map(env.api.publicServerPlayerCount), [0, 1, 2, 3, 4, 5, 6, 7]);
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  assert.deepEqual(rendered().map(env.api.publicServerPlayerCount), [8, 9, 10, 11]);
});

test('list replacement clears visibility left on an old server wrapper', () => {
  const env = environment(1);
  const wrapper = new env.Element('div');
  wrapper.append(...env.grid.children);
  env.grid.append(wrapper);
  env.api.filter.minPlayers = '1';
  env.sync();
  assert.equal(wrapper.hasAttribute('data-rc-server-filtered'), true);
  const replacementGrid = new env.Element('ul', { className: 'card-list' });
  replacementGrid.append(env.card(5));
  wrapper.replaceChildren(replacementGrid);
  env.sync();
  assert.equal(wrapper.hasAttribute('data-rc-server-filtered'), false);
  assert.equal(replacementGrid.children[0].closest('[data-rc-server-filtered], [data-rc-server-page-hidden]'), null);
});

test('native control hiding releases a wrapper after Roblox adds public cards to it', () => {
  const env = environment();
  sharedServerSections(env);
  const group = new env.Element('div');
  const sort = new env.Element('div');
  sort.append(new env.Element('span', { text: 'Sort By' }), new env.Select('select'));
  const exclude = new env.Element('div');
  const checkbox = new env.Element('input');
  checkbox.setAttribute('type', 'checkbox');
  exclude.append(new env.Element('span', { text: 'Exclude Full Servers' }), checkbox);
  group.append(sort, exclude, env.grid);
  env.container.append(group);
  env.api.hideNativePublicServerControls(env.page, env.container);
  assert.equal(group.hasAttribute('data-rc-native-server-controls'), true);
  env.grid.append(env.card(5));
  env.api.hideNativePublicServerControls(env.page, env.container);
  assert.equal(group.hasAttribute('data-rc-native-server-controls'), false);
  assert.equal(sort.hasAttribute('data-rc-native-server-controls'), true);
  assert.equal(exclude.hasAttribute('data-rc-native-server-controls'), true);
});

test('native controls sharing a parent with cards cannot hide that parent', () => {
  const env = environment(8);
  sharedServerSections(env);
  const group = new env.Element('div');
  const label = new env.Element('span', { text: 'Sort By' });
  group.append(label, new env.Select('select'), env.grid);
  env.container.append(group);
  env.api.hideNativePublicServerControls(env.page, env.container);
  assert.equal(group.hasAttribute('data-rc-native-server-controls'), false);
  assert.equal(label.hasAttribute('data-rc-native-server-controls'), true);
});

test('sorting handles both directions, and changing filters returns to the first matching page', async () => {
  const env = environment(20);
  env.sync();
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  Object.assign(env.api.filter, { minPlayers: '4', maxPlayers: '15', playerSort: 'desc' });
  env.sync();
  const matching = [...env.api.filteredPublicServerCards(env.api.publicServerCards(env.container))];
  assert.deepEqual(matching.map(env.api.publicServerPlayerCount), [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4]);
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 1');
  assert.equal(env.visible().length, 8);
  assert.equal(env.grid.children[15].style.order, '0');
  env.api.filter.playerSort = 'asc';
  env.sync();
  assert.equal(env.grid.children[4].style.order, '0');
  env.page.querySelector('.rc-public-server-filter-reset').click();
  env.sync();
  assert.equal(env.visible().length, 8);
  assert.equal(env.api.filter.maxPlayers, '');
  assert.equal(env.api.filter.playerSort, 'default');
  assert.equal(env.grid.children[4].style.order, undefined);
});

test('Next uses the native loader beyond the original eight and Previous uses cached cards', async () => {
  const env = environment(8);
  let requests = 0;
  env.loader(button => {
    requests += 1;
    env.grid.append(...Array.from({ length: 8 }, (_, i) => env.card(i + 8)));
    button.remove();
  });
  env.sync();
  assert.equal(env.page.querySelector('.rc-public-server-next').disabled, false);
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  env.sync();
  assert.equal(requests, 1);
  assert.deepEqual(env.visible().map(env.api.publicServerPlayerCount), [8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(env.page.querySelector('.rc-public-server-next').disabled, true);
  await env.api.navigatePublicServerPage(env.page, env.container, -1);
  assert.equal(requests, 1);
  assert.equal(env.visible()[0], env.grid.children[0]);
});

function sharedServerSections(env) {
  const wrapper = new env.Element('div', { id: 'game-instances', className: 'server-list-section' });
  const privateSection = new env.Element('section', { id: 'private-server-container' });
  const friendsSection = new env.Element('section', { id: 'friends-game-instances-container' });
  env.container.className = '';
  wrapper.append(privateSection, friendsSection, env.container);
  env.page.append(wrapper);
  return { wrapper, privateSection, friendsSection };
}

test('Next chooses the public loader when private and friends lists share its section ancestor', async () => {
  const env = environment(8);
  const { privateSection, friendsSection } = sharedServerSections(env);
  let privateRequests = 0;
  let friendsRequests = 0;
  let publicRequests = 0;
  const privateButton = new env.Element('button', { text: 'Load More' });
  privateButton.addEventListener('click', () => { privateRequests += 1; });
  privateSection.append(privateButton);
  const friendsButton = new env.Element('button', { text: 'Load More' });
  friendsButton.addEventListener('click', () => { friendsRequests += 1; });
  friendsSection.append(friendsButton);
  const publicButton = env.loader(button => {
    publicRequests += 1;
    env.grid.append(...Array.from({ length: 8 }, (_, i) => env.card(i + 8)));
    button.remove();
  });
  env.sync();
  assert.strictEqual(env.api.publicServerLoadMore(env.container), publicButton);
  assert.equal(privateButton.hasAttribute('data-rc-private-server-load-more'), true);
  assert.equal(friendsButton.hasAttribute('data-rc-private-server-load-more'), false);
  assert.equal(publicButton.hasAttribute('data-rc-private-server-load-more'), false);
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  env.sync();
  assert.equal(publicRequests, 1);
  assert.equal(privateRequests, 0);
  assert.equal(friendsRequests, 0);
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 2');
});

test('private Load More stays hidden independently of public controls and cannot enable public Next', () => {
  const env = environment(8);
  const { privateSection } = sharedServerSections(env);
  const privateButton = new env.Element('button', { text: 'Load More' });
  privateButton.setAttribute('data-rc-native-server-controls', '');
  privateSection.append(privateButton);
  env.api.hidePrivateServerLoadMore(env.page);
  env.api.hideNativePublicServerControls(env.page, env.container);
  env.sync();
  assert.equal(privateButton.hasAttribute('data-rc-native-server-controls'), false);
  assert.equal(privateButton.hasAttribute('data-rc-private-server-load-more'), true);
  assert.equal(env.api.publicServerLoadMore(env.container), null);
  assert.equal(env.page.querySelector('.rc-public-server-next').disabled, true);
});

test('private fragments nested inside the public container cannot supply its cards or loader', async () => {
  const env = environment(8);
  const privateList = new env.Element('div');
  privateList.setAttribute('data-rc-private-server-list', '');
  const privateCard = env.card(99);
  const privateButton = new env.Element('button', { text: 'Load More' });
  let privateRequests = 0;
  privateButton.addEventListener('click', () => { privateRequests += 1; });
  privateList.append(privateCard, privateButton);
  env.heading.before(privateList);
  env.loader(button => {
    env.grid.append(...Array.from({ length: 8 }, (_, i) => env.card(i + 8)));
    button.remove();
  });
  env.sync();
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  env.sync();
  assert.equal(env.api.publicServerCards(env.container).includes(privateCard), false);
  assert.equal(privateRequests, 0);
  assert.equal(privateCard.hasAttribute('data-rc-server-page-hidden'), false);
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 2');
});

test('native player sorting also stays within the public container under a shared ancestor', () => {
  const env = environment(8);
  const { privateSection } = sharedServerSections(env);
  const makeSort = parent => {
    const select = new env.Select('select');
    select.setAttribute('data-rc-native-server-sort', '');
    for (const value of ['Asc', 'Desc']) {
      const option = new env.Element('option', { text: value });
      option.value = value;
      select.append(option);
    }
    select.value = 'Desc';
    parent.append(select);
    return select;
  };
  const privateSort = makeSort(privateSection);
  const publicSort = makeSort(env.container);
  env.api.sortNativePublicServers(env.container, 'asc');
  assert.equal(publicSort.value, 'Asc');
  assert.equal(privateSort.value, 'Desc');
});

test('Next searches additional batches when the loaded servers do not match', async () => {
  const env = environment(8);
  env.api.filter.minPlayers = '20';
  let requests = 0;
  env.loader(button => {
    requests += 1;
    env.grid.append(...Array.from({ length: 8 }, (_, i) => env.card(requests * 8 + i)));
    if (requests === 3) button.remove();
  });
  env.sync();
  assert.equal(env.visible().length, 0);
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  env.sync();
  assert.equal(requests, 2);
  assert.deepEqual(env.visible().map(env.api.publicServerPlayerCount), [20, 21, 22, 23]);
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 1');
});

test('failed loading is retryable and concurrent Next clicks do not duplicate requests', async () => {
  const env = environment(8);
  let requests = 0;
  env.loader(() => { requests += 1; });
  env.sync();
  const loading = env.api.navigatePublicServerPage(env.page, env.container, 1);
  assert.equal(env.page.querySelector('.rc-public-server-next').disabled, true);
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  assert.equal(requests, 1);
  for (const timer of [...env.timers.values()]) if (timer.delay === 15_000) timer.callback();
  await loading;
  env.sync();
  assert.equal(env.page.querySelector('.rc-public-server-next').disabled, false);
  assert.match(env.page.querySelector('.rc-public-server-page-message').textContent, /Try Next again/);
  assert.equal(env.visible().length, 8);
});

test('changing filters during loading cannot move the new results to a stale page', async () => {
  const env = environment(8);
  env.loader(() => {});
  env.sync();
  const loading = env.api.navigatePublicServerPage(env.page, env.container, 1);
  env.api.filter.maxPlayers = '2';
  env.sync();
  env.grid.append(env.card(1));
  await loading;
  env.sync();
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 1');
  assert.equal(env.visible().length, 4);
});

test('a native loading spinner does not finish Next before the server response arrives', async () => {
  const env = environment(8);
  const button = env.loader(button => { button.textContent = 'Loading...'; });
  env.sync();
  const loading = env.api.navigatePublicServerPage(env.page, env.container, 1);
  await Promise.resolve();
  assert.equal(env.api.publicServerBrowser(env.container).loading, true);
  env.grid.append(...Array.from({ length: 8 }, (_, i) => env.card(i + 8)));
  button.remove();
  await loading;
  env.sync();
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 2');
  assert.equal(env.visible().length, 8);
});

test('player sort invokes the native query select and reset restores its original order', () => {
  const env = environment(8);
  const select = new env.Select('select');
  select.setAttribute('data-rc-native-server-sort', '');
  for (const value of ['Asc', 'Desc']) {
    const option = new env.Element('option', { text: value });
    option.value = value;
    select.append(option);
  }
  select.value = 'Desc';
  const changes = [];
  select.addEventListener('change', () => changes.push(select.value));
  env.container.append(select);
  env.api.sortNativePublicServers(env.container, 'asc');
  env.api.sortNativePublicServers(env.container, 'default');
  assert.deepEqual(changes, ['Asc', 'Desc']);
});

test('empty results keep Reset available and replacing the native list resets pagination', async () => {
  const env = environment(17);
  env.sync();
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  env.grid.replaceChildren(env.card(2));
  env.sync();
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 1');
  env.api.filter.minPlayers = '999';
  env.sync();
  assert.equal(env.visible().length, 0);
  assert.equal(env.page.querySelector('.rc-public-server-filters').hidden, undefined);
  assert.equal(env.page.querySelector('.rc-public-server-next').disabled, true);
  env.page.querySelector('.rc-public-server-filter-reset').click();
  env.sync();
  assert.equal(env.visible().length, 1);
});

test('Search checks more than five native batches and stops at the first matching server', async () => {
  const env = environment(8);
  env.api.filter.minPlayers = '60';
  env.api.filter.maxPlayers = '60';
  let requests = 0;
  env.loader(() => {
    requests += 1;
    env.grid.append(...Array.from({ length: 8 }, (_, i) => env.card(requests * 8 + i)));
  });
  env.sync();
  const searching = env.api.searchPublicServers(env.page, env.container);
  assert.equal(env.page.querySelector('.rc-public-server-filter-search').disabled, true);
  assert.equal(env.page.querySelector('.rc-public-server-filter-stop').hidden, false);
  await env.api.searchPublicServers(env.page, env.container);
  await searching;
  assert.equal(requests, 7);
  assert.deepEqual(env.visible().map(env.api.publicServerPlayerCount), [60]);
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 1');
  assert.equal(env.page.querySelector('.rc-public-server-page-message').textContent, 'Found 1 matching server.');
  assert.equal(env.page.querySelector('.rc-public-server-filter-search').disabled, false);
  assert.equal(env.page.querySelector('.rc-public-server-filter-stop').hidden, true);
});

test('Search button applies the configured filters and uses cached results without loading more', async () => {
  const env = environment(17);
  env.loader(() => { assert.fail('Cached matches must not request another page'); });
  env.sync();
  await env.api.navigatePublicServerPage(env.page, env.container, 1);
  const input = env.page.querySelector('[data-rc-server-filter="maxPlayers"]');
  input.value = '2';
  input.dispatchEvent({ type: 'input', bubbles: true });
  env.page.querySelector('.rc-public-server-filter-search').click();
  // The UI click starts the async handler, whose initial native sort is unchanged.
  for (let turn = 0; turn < 10 && env.api.publicServerBrowser(env.container).searching; turn++) await Promise.resolve();
  assert.equal(env.api.publicServerBrowser(env.container).searching, false);
  assert.deepEqual(env.visible().map(env.api.publicServerPlayerCount), [0, 1, 2]);
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 1');
  assert.match(env.page.querySelector('.rc-public-server-page-message').textContent, /Found 3/);
});

test('Search reports no matches when the public list is exhausted', async () => {
  const env = environment(8);
  env.api.filter.minPlayers = '99';
  let requests = 0;
  env.loader(button => {
    requests += 1;
    env.grid.append(env.card(8));
    button.remove();
  });
  env.sync();
  await env.api.searchPublicServers(env.page, env.container);
  assert.equal(requests, 1);
  assert.equal(env.visible().length, 0);
  assert.equal(env.page.querySelector('.rc-public-server-page-message').textContent,
    'No public servers match all your filters.');
  assert.equal(env.page.querySelector('.rc-public-server-filter-search').disabled, false);
});

test('Stop cancels a search during a native request without starting additional batches', async () => {
  const env = environment(8);
  env.api.filter.minPlayers = '50';
  let requests = 0;
  env.loader(() => { requests += 1; });
  env.sync();
  const searching = env.api.searchPublicServers(env.page, env.container);
  await Promise.resolve();
  assert.equal(requests, 1);
  env.page.querySelector('.rc-public-server-filter-stop').click();
  await searching;
  env.grid.append(env.card(9));
  await Promise.resolve();
  assert.equal(requests, 1);
  assert.equal(env.api.publicServerBrowser(env.container).loading, false);
  assert.equal(env.page.querySelector('.rc-public-server-filter-search').disabled, false);
  assert.equal(env.page.querySelector('.rc-public-server-filter-stop').hidden, true);
  assert.equal(env.page.querySelector('.rc-public-server-page-message').textContent, 'Search stopped.');
});

test('editing the requirements cancels an in-flight search and keeps its results on page one', async () => {
  const env = environment(8);
  env.api.filter.minPlayers = '50';
  let requests = 0;
  env.loader(() => { requests += 1; });
  env.sync();
  const searching = env.api.searchPublicServers(env.page, env.container);
  await Promise.resolve();
  const input = env.page.querySelector('[data-rc-server-filter="minPlayers"]');
  input.value = '0';
  input.dispatchEvent({ type: 'input', bubbles: true });
  await searching;
  assert.equal(requests, 1);
  assert.equal(env.api.publicServerBrowser(env.container).searching, false);
  assert.equal(env.visible().length, 8);
  assert.equal(env.page.querySelector('.rc-public-server-page-number').textContent, 'Page 1');
});

test('Search waits for pending country details before requesting another public batch', async () => {
  const env = environment();
  env.api.filter.country = 'MY';
  const candidate = env.card(5, '');
  candidate.dataset.rcServerCountryState = 'pending';
  env.grid.append(candidate);
  let requests = 0;
  env.loader(() => { requests += 1; });
  env.sync();
  const searching = env.api.searchPublicServers(env.page, env.container);
  await Promise.resolve();
  assert.equal(requests, 0);
  assert.equal(env.api.publicServerBrowser(env.container).searching, true);
  env.updateDetails(candidate, { rcServerCountry: 'MY', rcServerCountryState: 'known' });
  await searching;
  assert.equal(requests, 0);
  assert.deepEqual(env.visible(), [candidate]);
  assert.equal(env.page.querySelector('.rc-public-server-page-message').textContent, 'Found 1 matching server.');
});

test('Search loading failures offer a retry and clear the busy state', async () => {
  const env = environment(8);
  env.api.filter.minPlayers = '50';
  env.loader(() => {});
  env.sync();
  const searching = env.api.searchPublicServers(env.page, env.container);
  await Promise.resolve();
  for (const timer of [...env.timers.values()]) if (timer.delay === 15_000) timer.callback();
  await searching;
  assert.equal(env.page.querySelector('.rc-public-server-filter-search').disabled, false);
  assert.match(env.page.querySelector('.rc-public-server-page-message').textContent, /Try Search again/);
});

test('Search rejects contradictory player ranges without requesting servers', async () => {
  const env = environment(8);
  Object.assign(env.api.filter, { minPlayers: '10', maxPlayers: '2' });
  env.loader(() => { assert.fail('Invalid ranges must not start a server request'); });
  env.sync();
  await env.api.searchPublicServers(env.page, env.container);
  assert.match(env.page.querySelector('.rc-public-server-page-message').textContent, /Minimum players cannot exceed/);
  assert.equal(env.api.publicServerBrowser(env.container).searching, false);
});

test('Search applies native player sorting and waits for its new server list', async () => {
  const env = environment(8);
  env.api.filter.playerSort = 'asc';
  const select = new env.Select('select');
  select.setAttribute('data-rc-native-server-sort', '');
  for (const value of ['Asc', 'Desc']) {
    const option = new env.Element('option', { text: value });
    option.value = value;
    select.append(option);
  }
  select.value = 'Desc';
  let sorted = false;
  select.addEventListener('change', () => {
    sorted = true;
    env.grid.replaceChildren();
  });
  env.container.append(select);
  env.sync();
  const searching = env.api.searchPublicServers(env.page, env.container);
  await Promise.resolve();
  assert.equal(sorted, true);
  assert.equal(env.api.publicServerBrowser(env.container).searching, true);
  env.grid.append(env.card(1));
  await searching;
  assert.equal(select.value, 'Asc');
  assert.deepEqual(env.visible().map(env.api.publicServerPlayerCount), [1]);
  assert.equal(env.page.querySelector('.rc-public-server-page-message').textContent, 'Found 1 matching server.');
});

function privateServerFixture(env, id = 1234) {
  const { privateSection } = sharedServerSections(env);
  const list = new env.Element('div');
  const row = new env.Element('div', { className: 'card-item' });
  row.setAttribute('data-private-server-id', id);
  const main = new env.Element('div');
  const name = new env.Element('div', { className: 'text-title-medium', text: 'Original server' });
  const avatar = new env.Element('img');
  avatar.src = 'https://tr.rbxcdn.com/original-avatar.png';
  const status = new env.Element('div', { className: 'text-body-medium', text: '1 of 12 people max' });
  main.append(name, avatar, status);
  const actions = new env.Element('div');
  const join = new env.Element('button', { text: 'Join' });
  const configure = new env.Element('a', { text: 'Configure' });
  configure.setAttribute('aria-label', 'Configure');
  configure.setAttribute('href', `https://www.roblox.com/private-server/configure?privateServerId=${id}`);
  actions.append(join, configure);
  row.append(main, actions);
  list.append(row);
  privateSection.append(list);
  const details = (extra = {}) => ({ id, name: 'Original server', ownerName: 'Original owner',
    playing: 1, maxPlayers: 12, playerImages: ['https://tr.rbxcdn.com/original-player.png'], ...extra });
  return { id, list, row, main, name, avatar, status, join, details };
}

test('private cards wait for refreshed details after native names and image attributes change', () => {
  const env = environment();
  const server = privateServerFixture(env);
  env.api.syncPrivateServers();
  env.requests[0].callback({ servers: [server.details()] });
  env.api.syncPrivateServers();
  assert.equal(env.requests.length, 1, 'Unchanged source content uses the existing cache');
  server.name.textContent = 'Updated server';
  server.avatar.src = 'https://tr.rbxcdn.com/updated-avatar.png';
  server.avatar.srcset = 'https://tr.rbxcdn.com/updated-avatar-2x.png 2x';
  server.status.textContent = '3 of 12 people max';
  env.mutate([
    { type: 'characterData', target: { nodeType: 3, parentElement: server.name } },
    { type: 'attributes', target: server.avatar, attributeName: 'src' }
  ]);
  const summary = server.row.querySelector('.rc-private-server-summary');
  assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), false);
  assert.equal(server.row.hasAttribute('data-rc-private-server-pending'), true);
  assert.equal(summary.querySelector('.rc-private-server-title').textContent, 'Original server');
  assert.equal(env.requests.length, 2, 'New source data refreshes details before the 90-second cache expires');
  env.requests[1].callback({ servers: [server.details({ name: 'Updated server', playing: 3 })] });
  assert.equal(summary.querySelector('.rc-private-server-title').textContent, 'Updated server');
  assert.equal(summary.querySelector('.rc-private-server-avatar').src, server.avatar.src);
  assert.equal(summary.querySelector('.rc-private-server-avatar').srcset, server.avatar.srcset);
  assert.equal(summary.querySelector('.rc-private-server-count').textContent, '3 of 12 people max');
  assert.equal(server.row.classList.contains('rc-private-server-card'), true);
  assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), true);
});

test('late private-server responses from before a native update cannot restore old names or images', () => {
  const env = environment();
  const server = privateServerFixture(env);
  env.api.syncPrivateServers();
  const oldRequest = env.requests[0];
  server.name.textContent = 'Latest server';
  server.avatar.src = 'https://tr.rbxcdn.com/latest-avatar.png';
  env.mutate([{ type: 'attributes', target: server.avatar, attributeName: 'src' }]);
  oldRequest.callback({ servers: [server.details()] });
  assert.equal(env.api.privateDetails.has(server.id), false, 'The outdated response is discarded');
  env.api.syncPrivateServers();
  assert.equal(env.requests.length, 2);
  env.requests[1].callback({ servers: [server.details({ name: 'Latest server', ownerName: 'Latest owner',
    playerImages: ['https://tr.rbxcdn.com/latest-player.png'] })] });
  env.api.syncPrivateServers();
  assert.equal(server.row.querySelector('.rc-private-server-title').textContent, 'Latest server');
  assert.equal(server.row.querySelector('.rc-private-server-owner').textContent, 'Latest owner');
  assert.equal(server.row.querySelector('.rc-private-server-avatar').src, server.avatar.src);
  assert.deepEqual(server.row.querySelector('.rc-private-server-roster').children.map(node => node.src),
    ['https://tr.rbxcdn.com/latest-player.png']);
});

test('replaced native rows refresh the source for the same private server ID', () => {
  const env = environment();
  const server = privateServerFixture(env);
  env.api.syncPrivateServers();
  env.requests[0].callback({ servers: [server.details()] });
  env.api.syncPrivateServers();
  const replacement = privateServerFixture(env, server.id);
  replacement.name.textContent = 'Replacement server';
  replacement.avatar.src = 'https://tr.rbxcdn.com/replacement-avatar.png';
  server.list.remove();
  env.api.syncPrivateServers();
  assert.equal(env.api.privateDetails.has(server.id), false);
  assert.equal(env.requests.length, 2);
  assert.equal(replacement.row.querySelector('.rc-private-server-summary'), null);
  assert.equal(replacement.row.hasAttribute('data-rc-private-server-ready'), false);
  env.requests[1].callback({ servers: [replacement.details({ name: 'Replacement server' })] });
  assert.equal(replacement.row.querySelector('.rc-private-server-title').textContent, 'Replacement server');
  assert.equal(replacement.row.querySelector('.rc-private-server-avatar').src, replacement.avatar.src);
});

test('extension rendering mutations do not trigger private source refreshes or extra requests', () => {
  const env = environment();
  const server = privateServerFixture(env);
  env.api.syncPrivateServers();
  env.requests[0].callback({ servers: [server.details()] });
  env.api.syncPrivateServers();
  const title = server.row.querySelector('.rc-private-server-title');
  const avatar = server.row.querySelector('.rc-private-server-avatar');
  const roster = server.row.querySelector('.rc-private-server-roster');
  assert.equal(env.api.privateServerSourceMutation({ type: 'characterData',
    target: { nodeType: 3, parentElement: title } }), false);
  assert.equal(env.api.privateServerSourceMutation({ type: 'attributes', target: avatar, attributeName: 'src' }), false);
  assert.equal(env.api.privateServerSourceMutation({ type: 'childList', target: roster,
    addedNodes: [], removedNodes: roster.children }), false);
  const summary = server.row.querySelector('.rc-private-server-summary');
  assert.equal(env.api.privateServerSourceMutation({ type: 'childList', target: server.row,
    addedNodes: [summary], removedNodes: [] }), false);
  env.api.syncPrivateServers();
  assert.equal(env.requests.length, 1);
});

test('a wiped custom summary or roster is repaired even when the server details did not change', () => {
  const env = environment();
  const server = privateServerFixture(env);
  env.api.syncPrivateServers();
  env.requests[0].callback({ servers: [server.details()] });
  env.api.syncPrivateServers();
  server.row.querySelector('.rc-private-server-title').remove();
  const roster = server.row.querySelector('.rc-private-server-roster');
  roster.replaceChildren();
  env.api.syncPrivateServers();
  assert.equal(server.row.querySelector('.rc-private-server-title').textContent, 'Original server');
  assert.deepEqual(roster.children.map(node => node.src), ['https://tr.rbxcdn.com/original-player.png']);
  assert.equal(env.requests.length, 1, 'Repairing custom markup must not invalidate the data cache');
});

test('private cards create no custom UI until their complete details response arrives', () => {
  const env = environment();
  const server = privateServerFixture(env);
  env.api.syncPrivateServers();
  env.api.syncPrivateServers();
  assert.equal(env.requests.length, 1, 'Only one details request is in flight');
  assert.deepEqual(Array.from(env.requests[0].message.serverIds), [server.id]);
  assert.equal(server.row.hasAttribute('data-rc-private-server-pending'), true);
  assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), false);
  assert.equal(server.row.querySelector('.rc-private-server-summary'), null);
  assert.equal(server.row.querySelector('.rc-private-server-roster'), null);
  assert.equal(server.row.classList.contains('rc-private-server-card'), false);
  assert.equal(server.list.querySelector('.rc-private-server-loading').textContent, 'Loading private server details...');
  env.requests[0].callback({ servers: [server.details()] });
  assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), true);
  assert.equal(server.row.hasAttribute('data-rc-private-server-pending'), false);
  assert.equal(server.row.querySelector('.rc-private-server-owner').textContent, 'Original owner');
  assert.deepEqual(server.row.querySelector('.rc-private-server-roster').children.map(node => node.src),
    ['https://tr.rbxcdn.com/original-player.png']);
  assert.equal(server.list.querySelector('.rc-private-server-loading'), null);
});

for (const missing of ['name', 'image']) {
  test(`private cards wait for a missing native ${missing} and a current details response`, () => {
    const env = environment();
    const server = privateServerFixture(env);
    if (missing === 'name') server.name.textContent = '';
    else server.avatar.removeAttribute('src');
    env.api.syncPrivateServers();
    env.requests[0].callback({ servers: [server.details()] });
    assert.equal(server.row.querySelector('.rc-private-server-summary'), null);
    assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), false);
    server.name.textContent = 'Original server';
    server.avatar.src = 'https://tr.rbxcdn.com/original-avatar.png';
    env.api.syncPrivateServers();
    assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), false);
    assert.equal(env.requests.length, 2);
    env.requests[1].callback({ servers: [server.details()] });
    assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), true);
    assert.equal(server.row.querySelector('.rc-private-server-title').textContent, 'Original server');
  });
}

test('shared private cards wait for an unambiguous server ID from the details response', () => {
  const env = environment();
  const server = privateServerFixture(env);
  server.row.removeAttribute('data-private-server-id');
  server.row.querySelector('a').remove();
  env.api.syncPrivateServers();
  assert.deepEqual(Array.from(env.requests[0].message.serverIds), []);
  assert.deepEqual(Array.from(env.requests[0].message.serverNames), ['Original server']);
  assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), false);
  env.requests[0].callback({ servers: [server.details()], uniqueNames: ['original server'] });
  assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), true);
  assert.equal(server.row.querySelector('.rc-private-server-owner').textContent, 'Original owner');
});

test('a failed private details request keeps cards hidden and can recover after the retry deadline', () => {
  const env = environment();
  const server = privateServerFixture(env);
  env.api.syncPrivateServers();
  env.requests[0].callback({ error: 'Unavailable' });
  assert.equal(server.row.querySelector('.rc-private-server-summary'), null);
  assert.equal(server.row.hasAttribute('data-rc-private-server-pending'), true);
  assert.match(server.list.querySelector('.rc-private-server-loading').textContent, /unavailable.*Retrying/);
  env.api.syncPrivateServers();
  assert.equal(env.requests.length, 1);
  env.advanceTime(30_001);
  env.api.syncPrivateServers();
  assert.equal(env.requests.length, 2);
  env.requests[1].callback({ servers: [server.details({ playing: 0, playerImages: [] })] });
  assert.equal(server.row.hasAttribute('data-rc-private-server-ready'), true);
  assert.equal(server.row.querySelector('.rc-private-server-roster-count').textContent, 'No players online');
  assert.equal(server.list.querySelector('.rc-private-server-loading'), null);
});
