const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/pages/profile/profile-page.js'), 'utf8');
const exposed = source.replace(/  queueSync\(\);\s*\}\)\(\);\s*$/, `
  globalThis.profile = { fallbackProfileRoot, markProfileHeader, markSections, markProfileCards, findGridParent, relevantMutation, queueSync, sync,
    observeRoot(root, userId = 123) { observedRoot = root; observedUserId = userId; } };
})();`);
assert.notEqual(exposed, source, 'The actual content script must be loaded by this harness');

// A small structural DOM fixture. No layout, image loading, or site requests are
// simulated: these regressions assert that none of those affect section choice.
class Element {
  constructor(tag = 'div', { id = '', className = '', text = '', href = '' } = {}) {
    this.tagName = tag;
    this.id = id;
    this.className = className;
    this.text = text;
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.nodeType = 1;
    this.attributes = new Map(href ? [['href', href]] : []);
    this.properties = new Map();
    this.style = {
      setProperty: (name, value) => this.properties.set(name, value),
      getPropertyValue: name => this.properties.get(name) || '',
      getPropertyPriority: () => '',
      removeProperty: name => this.properties.delete(name)
    };
    this.rect = { width: 150, height: 200 };
    this.scrollHeight = 200;
    this.naturalWidth = 150;
    this.naturalHeight = 150;
  }
  append(...children) {
    for (const child of children) {
      child.remove();
      child.parentElement = this;
      this.children.push(child);
    }
  }
  remove() {
    if (this.parentElement) {
      const siblings = this.parentElement.children;
      siblings.splice(siblings.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  get childElementCount() { return this.children.length; }
  get isConnected() { return this.tagName === 'document' || !!this.parentElement?.isConnected; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      if (part.startsWith('#')) return this.id === part.slice(1);
      if (part.startsWith('.')) return this.className.split(/\s+/).includes(part.slice(1));
      if (part === 'a[href]') return this.tagName === 'a' && this.attributes.has('href');
      if (part === '[class*="text-heading"]') return this.className.includes('text-heading');
      const attribute = part.match(/^\[(data-[\w-]+)(?:="([^"]*)")?\]$/);
      if (attribute) {
        const key = attribute[1].slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        return key in this.dataset && (attribute[2] === undefined || this.dataset[key] === attribute[2]);
      }
      return this.tagName === part;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener() {}
  getBoundingClientRect() { return this.rect; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) {
    this.attributes.set(name, value);
    if (name.startsWith('data-')) {
      this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())];
  }
}

function environment() {
  const document = new Element('document');
  const location = { pathname: '/users/123/profile' };
  const timers = new Map();
  let now = 1000;
  let timerId = 0;
  const observations = [];
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe() { observations.push('observe'); }
    disconnect() { observations.push('disconnect'); }
  }
  const context = vm.createContext({ document, location, URL, Node: { ELEMENT_NODE: 1 },
    Date: { now: () => now }, MutationObserver: Observer, addEventListener() {},
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(exposed, context);
  return { profile: context.profile, document, location, timers, observations,
    advance(ms) { now += ms; } };
}

function section(name) {
  const wrapper = new Element();
  const header = new Element('div', { className: 'container-header' });
  const heading = new Element('h2', { text: name });
  const items = new Element();
  header.append(heading);
  wrapper.append(header, items);
  return { wrapper, header, heading, items };
}

test('profiles without a named wrapper use inner content instead of the main page shell', () => {
  const { profile, document } = environment();
  const main = new Element('main', { id: 'container-main' });
  const content = new Element('div', { id: 'content' });
  main.append(content);
  document.append(main);
  assert.equal(profile.fallbackProfileRoot(), content);
  content.remove();
  assert.equal(profile.fallbackProfileRoot(), main);
});

test('the current native information panel is styled without an h1 or English follower label', () => {
  for (const label of ['1 Follower', '0 Followers', '1 位粉絲']) {
    const { profile, document } = environment();
    const root = new Element('div', { id: 'profile-container' });
    root.rect = { width: 1280, height: 1000 };
    const summary = new Element('div', { id: 'user-profile-header-bg' });
    summary.rect = { width: 1280, height: 88 };
    const info = new Element('div', { className: 'user-profile-header' });
    const name = new Element('span', { id: 'profile-header-title-container-name', text: 'Xgs_tanjiro' });
    info.append(name, new Element('a', { text: label }));
    summary.append(info);
    root.append(summary);
    document.append(root);

    profile.markProfileHeader(root);

    assert.equal(summary.dataset.rcProfileSummary, '', label);
    assert.match(summary.properties.get('background-color'), /--rc-page-panel-opacity/);
    assert.match(summary.properties.get('backdrop-filter'), /^blur\(/);
    assert.equal(name.parentElement, info, 'Native content retains its parent');
    assert.equal(info.parentElement, summary);
    assert.equal(info.dataset.rcProfileSummary, undefined, 'Use one glass surface');
  }
});

test('legacy profile information accepts a singular follower count', () => {
  const { profile, document } = environment();
  const root = new Element('div', { id: 'profile-container' });
  root.rect = { width: 1280, height: 1000 };
  const summary = new Element();
  summary.rect = { width: 1280, height: 220 };
  const counts = new Element();
  counts.rect = { width: 1280, height: 32 };
  counts.append(new Element('a', { text: '1 Follower' }));
  summary.append(new Element('h1', { text: 'Xgs_tanjiro' }), counts);
  root.append(summary);
  document.append(root);

  profile.markProfileHeader(root);

  assert.equal(summary.dataset.rcProfileSummary, '');
  assert.match(summary.properties.get('backdrop-filter'), /^blur\(/);
});

test('profile sections stay fixed while empty carousels load and replace images', () => {
  const { profile, document } = environment();
  const root = new Element('div', { id: 'profile-container' });
  document.append(root);
  const wearing = section('Currently Wearing');
  const favorites = section('Favorites');
  const badges = section('Badges');
  root.append(wearing.wrapper, favorites.wrapper, badges.wrapper);
  favorites.items.append(new Element('img'), new Element('img'));

  for (let batch = 0; batch < 12; batch++) {
    if (batch % 2) wearing.items.append(new Element('img'), new Element('img'));
    else for (const child of [...wearing.items.children]) child.remove();
    const sections = profile.markSections(root);
    assert.equal(sections.get('wearing'), wearing.wrapper);
    assert.equal(sections.get('favorites'), favorites.wrapper);
    assert.equal(sections.get('badges'), badges.wrapper);
    assert.equal(profile.findGridParent(sections), root);
    assert.equal(root.dataset.rcProfileSection, undefined);
  }
});

test('unwrapped headings cannot mark the main root or an ancestor as a section', () => {
  const { profile, document } = environment();
  const main = new Element('main');
  const root = new Element('div', { id: 'profile-container' });
  main.append(root);
  document.append(main);
  root.append(new Element('h2', { text: 'Currently Wearing' }), new Element('img'), new Element('img'));
  assert.equal(profile.markSections(root).size, 0);
  assert.equal(main.dataset.rcProfileSection, undefined);
});

test('a shared ancestor and obsolete layout markers are never retained as a section', () => {
  const { profile, document } = environment();
  const root = new Element('div', { id: 'profile-container' });
  document.append(root);
  const wrapper = new Element();
  const wearing = section('Currently Wearing');
  const store = section('Store');
  const explicit = new Element('section');
  explicit.append(wearing.wrapper, store.wrapper);
  wrapper.append(explicit);
  root.append(wrapper);
  wrapper.dataset.rcProfileSection = 'wearing';
  const sections = profile.markSections(root);
  assert.equal(sections.get('wearing'), wearing.wrapper);
  assert.equal(sections.get('store'), store.wrapper);
  assert.equal(wrapper.dataset.rcProfileSection, undefined);
});

function nativeCard(kind, id, height = 200) {
  const card = new Element('div', { className: kind === 'game' ? 'game-container' : 'item-card' });
  const inner = new Element('div', { className: kind === 'game' ? 'game-card-container' : 'item-card-container' });
  const media = new Element('div', { className: kind === 'game' ? 'game-card-thumb-container' : 'item-card-thumb-container' });
  const image = new Element('img');
  const href = `/${kind === 'game' ? 'games' : 'catalog'}/${id}/Item`;
  const link = new Element('a', { href });
  const title = new Element('a', { href, text: 'Item title' });
  card.scrollHeight = height;
  media.append(image);
  link.append(media);
  inner.append(link, title);
  card.append(inner);
  return { card, inner, media, image, link, title };
}

test('wearing, store, collections, and experience cards keep their native tile boundaries', () => {
  const { profile, document } = environment();
  const root = new Element('div', { id: 'profile-container' });
  document.append(root);
  for (const [heading, kind, id] of [['Currently Wearing', 'asset', 1], ['Store', 'asset', 2], ['Experiences', 'game', 3], ['Collections', 'asset', 4]]) {
    const group = section(heading);
    const tile = new Element();
    const item = nativeCard(kind, id);
    tile.append(item.card);
    group.items.append(tile);
    root.append(group.wrapper);
    profile.markProfileCards(root, profile.markSections(root));
    assert.equal(item.card.dataset.rcProfileCard, kind, heading);
    assert.equal(item.inner.dataset.rcProfileCard, undefined, 'Only the outer card is marked');
    assert.equal(tile.dataset.rcProfileCard, undefined, 'Carousel tile sizing stays native');
    assert.equal(group.items.dataset.rcProfileCard, undefined, 'Single-item lists are not treated as cards');
    assert.equal(item.image.dataset.rcProfileCardThumb, kind);
    assert.equal(item.media.dataset.rcProfileCardMedia, '');
  }
});

test('a native anchor card is never promoted to the surrounding carousel tile', () => {
  const { profile, document } = environment();
  const root = new Element('div', { id: 'profile-container' });
  const group = section('Store');
  const tile = new Element();
  const card = new Element('a', { className: 'item-card', href: '/catalog/123/Item' });
  card.append(new Element('img'));
  tile.append(card);
  group.items.append(tile);
  root.append(group.wrapper);
  document.append(root);
  profile.markProfileCards(root, profile.markSections(root));
  assert.equal(card.dataset.rcProfileCard, 'asset');
  assert.equal(tile.dataset.rcProfileCard, undefined);
});

test('card heights align within each section and stale media markers are cleared', () => {
  const { profile, document } = environment();
  const root = new Element('div', { id: 'profile-container' });
  const wearing = section('Currently Wearing');
  const store = section('Store');
  const experiences = section('Experiences');
  const tall = nativeCard('asset', 1, 310);
  const short = nativeCard('asset', 2, 220);
  const game = nativeCard('game', 3, 240);
  wearing.items.append(tall.card);
  store.items.append(short.card);
  experiences.items.append(game.card);
  root.append(wearing.wrapper, store.wrapper, experiences.wrapper);
  document.append(root);
  const sections = profile.markSections(root);
  profile.markProfileCards(root, sections);
  assert.equal(wearing.wrapper.properties.get('--rc-profile-card-height'), '310px');
  assert.equal(store.wrapper.properties.get('--rc-profile-card-height'), '220px');
  assert.equal(experiences.wrapper.properties.get('--rc-profile-card-height'), '240px');
  assert.equal(store.wrapper.dataset.rcProfileCardCount, '1');
  assert.equal(experiences.wrapper.dataset.rcProfileCardCount, '1');
  const second = nativeCard('game', 4, 240);
  experiences.items.append(second.card);
  profile.markProfileCards(root, sections);
  assert.equal(experiences.wrapper.dataset.rcProfileCardCount, '2');
  short.link.remove();
  short.title.remove();
  short.card.append(short.media);
  profile.markProfileCards(root, sections);
  assert.equal(short.card.dataset.rcProfileCard, undefined);
  assert.equal(short.image.dataset.rcProfileCardThumb, undefined);
  assert.equal(short.media.dataset.rcProfileCardMedia, undefined);
  assert.equal(store.wrapper.properties.has('--rc-profile-card-height'), false);
  assert.equal(store.wrapper.dataset.rcProfileCardCount, '0');
});

test('extension renders and activity outside the profile cannot start another layout pass', () => {
  const { profile, document } = environment();
  const root = new Element('div', { id: 'profile-container' });
  const panels = new Element('div', { id: 'rc-profile-enhancements' });
  const facts = new Element();
  const feeds = new Element('div', { id: 'rc-profile-social-feeds' });
  const post = new Element();
  feeds.append(post);
  const chat = new Element();
  panels.append(facts);
  root.append(panels, feeds);
  document.append(root, chat);
  profile.observeRoot(root);
  const record = target => ({ target, addedNodes: [new Element('span')], removedNodes: [] });
  assert.equal(profile.relevantMutation(record(facts)), false);
  assert.equal(profile.relevantMutation(record(post)), false);
  assert.equal(profile.relevantMutation(record(chat)), false);
  assert.equal(profile.relevantMutation(record(root)), true);
  root.remove();
  assert.equal(profile.relevantMutation({ target: document, addedNodes: [], removedNodes: [root] }), true);
});

test('burst updates share one bounded timer, and a finished pass does not poll', () => {
  const env = environment();
  const { profile, timers, observations } = env;
  profile.queueSync();
  for (let update = 0; update < 9; update++) {
    env.advance(50);
    profile.queueSync();
    assert.equal(timers.size, 1);
  }
  const [{ callback, delay }] = [...timers.values()];
  assert.equal(delay, 50, 'Continuous loading cannot postpone the pass beyond 500 ms');
  timers.clear();
  env.location.pathname = '/home';
  callback();
  assert.equal(timers.size, 0);
  assert.deepEqual(observations.slice(-2), ['disconnect', 'observe']);
});
