const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/pages/games/game-page.js'), 'utf8');
const exposed = source.replace(/  syncPrivateServers\(\);\s*  schedule\(\);\s*\}\)\(\);\s*$/, `
  globalThis.feeds = { socialFeedContext, syncXFeed, syncYouTubeFeed,
    positionXFeed, positionYouTubeFeed, setXFeedExpanded };
})();`);
assert.notEqual(source, exposed, 'Exercise the actual shared feed modules');

class Element {
  constructor(tag = 'div', { id = '', className = '', rect } = {}) {
    this.tag = tag;
    this.id = id;
    this.className = className;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.style = {
      getPropertyValue(name) { return this[name] || ''; },
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; }
    };
    this.rect = rect || { left: 265, right: 1138, top: 80, width: 873, height: 1000 };
    this.text = '';
  }
  get classList() {
    const node = this;
    return {
      contains(name) { return node.className.split(/\s+/).includes(name); },
      toggle(name, force) {
        const present = this.contains(name), add = force ?? !present;
        node.className = node.className.split(/\s+/).filter(value => value && value !== name)
          .concat(add ? [name] : []).join(' ');
        return add;
      }
    };
  }
  get childElementCount() { return this.children.length; }
  get isConnected() { return this.tag === 'document' || !!this.parentElement?.isConnected; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren(); this.text = value; }
  append(...nodes) {
    for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); }
  }
  prepend(node) { node.remove(); node.parentElement = this; this.children.unshift(node); }
  before(node) {
    const parent = this.parentElement;
    node.remove(); node.parentElement = parent;
    parent.children.splice(parent.children.indexOf(this), 0, node);
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  replaceChildren(...nodes) {
    for (const child of [...this.children]) child.remove();
    this.append(...nodes);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? (name === 'href' ? this.href ?? null : null); }
  hasAttribute(name) { return this.getAttribute(name) !== null; }
  removeAttribute(name) { delete this.attributes[name]; }
  getBoundingClientRect() { return this.rect; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  click() { for (const callback of this.listeners.click || []) callback(); }
  matches(selector) {
    return selector.split(',').some(part => {
      const chain = part.trim().split(/\s+/);
      const simple = (node, value) => {
        const attributes = [...value.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
        if (!attributes.every(([, name, expected]) => expected === undefined
          ? node.hasAttribute(name) : node.getAttribute(name) === expected)) return false;
        value = value.replace(/\[[^\]]*\]/g, '');
        if (!value) return true;
        if (value.startsWith('#')) return node.id === value.slice(1);
        if (value.startsWith('.')) return node.classList.contains(value.slice(1));
        return node.tag === value;
      };
      if (!simple(this, chain.pop())) return false;
      let ancestor = this.parentElement;
      while (chain.length) {
        const value = chain.pop();
        while (ancestor && !simple(ancestor, value)) ancestor = ancestor.parentElement;
        if (!ancestor) return false;
        ancestor = ancestor.parentElement;
      }
      return true;
    });
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function environment(pathname = '/communities/3059674/Badimo', viewport = 1414) {
  const document = new Element('document');
  document.documentElement = new Element('html');
  document.body = new Element('body');
  document.append(document.documentElement);
  document.documentElement.append(document.body);
  document.createElement = tag => new Element(tag);
  document.getElementById = id => document.querySelector(`#${id}`);
  const page = new Element('main', { id: 'group-container' });
  const details = new Element('div', { className: 'group-details' });
  const summary = new Element('div', { className: 'group-profile-header' });
  const tabs = new Element('div', { className: 'rbx-tabs-horizontal' });
  const announcements = new Element('div', { className: 'group-announcement-archive' });
  document.body.append(page); page.append(details); details.append(summary, tabs, announcements);
  const requests = [], events = new Map();
  const location = { pathname, href: `https://www.roblox.com${pathname}`, hash: '#!/about' };
  class Observer { observe() {} disconnect() {} }
  const context = vm.createContext({ document, location, URL, Intl, Element,
    innerWidth: viewport, scrollX: 0, scrollY: 200,
    MutationObserver: Observer, ResizeObserver: Observer,
    window: { addEventListener(name, callback) { events.set(name, callback); } },
    chrome: { runtime: { lastError: null, sendMessage(message, callback) { requests.push({ message, callback }); } } },
    setTimeout() { return 1; }, clearTimeout() {}
  });
  vm.runInContext(exposed, context);
  const sync = () => { context.feeds.syncXFeed(); context.feeds.syncYouTubeFeed(); };
  const linked = () => {
    sync();
    requests.find(request => request.message.type === 'rc-community-social-links').callback({
      xUrl: 'https://x.com/badimo', youtubeUrl: 'https://www.youtube.com/@Badimo'
    });
    sync();
  };
  return { context, document, page, details, summary, tabs, announcements, requests, location, events, sync, linked };
}

test('community feeds share one link lookup and sit on the requested sides of the native content', () => {
  const env = environment();
  env.linked();
  const youtube = env.document.getElementById('rc-youtube-feed-panel');
  const x = env.document.getElementById('rc-x-feed-panel');
  assert.equal(env.requests.filter(request => request.message.type === 'rc-community-social-links').length, 1);
  assert.equal(youtube.dataset.channelUrl, 'https://www.youtube.com/@Badimo');
  assert.equal(x.dataset.handle, 'badimo');
  assert.equal(youtube.style.left, '16px');
  assert.equal(youtube.style.width, '237px');
  assert.equal(x.style.left, '1150px');
  assert.equal(x.style.width, '248px');
  assert.equal(youtube.style.top, '280px');
  assert.equal(x.classList.contains('rc-x-feed-floating'), false);
  assert.equal(youtube.classList.contains('rc-x-feed-floating'), false);
  assert.equal(env.announcements.parentElement, env.details);
});

test('native navigation reduces left side space and feeds reflow without covering content', () => {
  const env = environment();
  const navigation = new Element('nav', { id: 'navigation', rect: { left: 0, right: 180, width: 180 } });
  env.document.body.append(navigation);
  env.linked();
  const youtube = env.document.getElementById('rc-youtube-feed-panel');
  const x = env.document.getElementById('rc-x-feed-panel');
  const row = env.document.getElementById('rc-community-social-feeds');
  assert.equal(youtube.parentElement, row);
  assert.equal(youtube.classList.contains('rc-community-feed-inline'), true);
  assert.equal(x.parentElement, env.document.body);
  assert.deepEqual(env.details.children, [env.summary, row, env.tabs, env.announcements]);
  navigation.rect.width = 0;
  env.sync();
  assert.equal(youtube.parentElement, env.document.body);
  assert.equal(youtube.classList.contains('rc-community-feed-inline'), false);
  assert.equal(env.document.getElementById('rc-community-social-feeds'), null);
});

test('small community pages put both modules into a shared row and clean it up when hidden', () => {
  const env = environment('/groups/3059674/Badimo', 800);
  env.details.rect = { left: 20, right: 780, top: 80, width: 760, height: 1000 };
  env.linked();
  const row = env.document.getElementById('rc-community-social-feeds');
  assert.equal(row.childElementCount, 2);
  for (const panel of row.children) assert.equal(panel.classList.contains('rc-x-feed-floating'), false);
  env.document.documentElement.setAttribute('data-rc-hide-x-feed', '');
  env.document.documentElement.setAttribute('data-rc-hide-youtube-feed', '');
  env.sync();
  assert.equal(env.document.getElementById('rc-community-social-feeds'), null);
  assert.equal(env.document.getElementById('rc-x-feed-panel'), null);
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
});

test('community modules retain loading, thumbnails, reload, and collapse controls from games', () => {
  const env = environment(); env.linked();
  const youtube = env.document.getElementById('rc-youtube-feed-panel');
  const x = env.document.getElementById('rc-x-feed-panel');
  env.requests.find(request => request.message.type === 'rc-youtube-videos').callback({
    channelTitle: 'Badimo', videos: [{ id: 'abcDEF12345', title: 'New update' }]
  });
  env.requests.find(request => request.message.type === 'rc-x-posts').callback({
    posts: [{ id: '1234567890', text: 'Community news', images: ['https://pbs.twimg.com/media/example.jpg'] }]
  });
  assert.equal(youtube.querySelector('.rc-x-feed-post').href, 'https://www.youtube.com/watch?v=abcDEF12345');
  assert.equal(x.querySelector('.rc-x-feed-post').href, 'https://x.com/badimo/status/1234567890');
  assert.ok(env.requests.some(request => request.message.type === 'rc-youtube-image'));
  assert.ok(env.requests.some(request => request.message.type === 'rc-x-image'));
  youtube.querySelector('.rc-x-feed-toggle').click();
  assert.equal(youtube.classList.contains('rc-x-feed-collapsed'), true);
  assert.equal(youtube.querySelector('.rc-x-feed-toggle').getAttribute('aria-expanded'), 'false');
  youtube.querySelector('.rc-x-feed-retry').click();
  x.querySelector('.rc-x-feed-retry').click();
  assert.ok(env.requests.some(request => request.message.type === 'rc-youtube-videos' && request.message.force));
  assert.ok(env.requests.some(request => request.message.type === 'rc-x-posts' && request.message.force));
});

test('leaving a community removes its feeds and late responses cannot populate another community', () => {
  const env = environment(); env.linked();
  const oldX = env.document.getElementById('rc-x-feed-panel');
  const oldRequest = env.requests.find(request => request.message.type === 'rc-x-posts');
  env.location.pathname = '/communities/999/New'; env.sync();
  assert.equal(oldX.isConnected, false);
  assert.equal(env.document.getElementById('rc-x-feed-panel'), null);
  oldRequest.callback({ posts: [{ id: '1234567890', text: 'Old community' }] });
  assert.equal(oldX.querySelector('.rc-x-feed-posts').childElementCount, 0);
  env.location.pathname = '/home'; env.sync();
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
  assert.ok(env.events.has('popstate'));
  assert.ok(env.events.has('hashchange'));
});

test('game feeds still resolve from native game social links and preserve floating behavior', () => {
  const env = environment('/games/3059674/Test', 800);
  env.page.remove();
  const game = new Element('main', { id: 'game-detail-page' });
  const about = new Element('div', { id: 'about', rect: { left: 20, right: 780, top: 80, width: 760 } });
  const social = new Element('div', { className: 'social-links' });
  const xLink = new Element('a'), youtubeLink = new Element('a');
  xLink.href = 'https://x.com/badimo'; youtubeLink.href = 'https://www.youtube.com/@Badimo';
  env.document.body.append(game); game.append(about); about.append(social); social.append(xLink, youtubeLink);
  env.sync();
  const youtube = env.document.getElementById('rc-youtube-feed-panel');
  assert.equal(youtube.dataset.contextKey, 'game:3059674');
  assert.equal(youtube.dataset.placeId, '3059674');
  assert.equal(youtube.classList.contains('rc-x-feed-floating'), true);
  assert.equal(env.requests.some(request => request.message.type === 'rc-community-social-links'), false);
});

test('a late social-link response cannot create feeds after navigating to another community', () => {
  const env = environment(); env.sync();
  const oldRequest = env.requests[0];
  env.location.pathname = '/communities/999/New'; env.sync();
  oldRequest.callback({ xUrl: 'https://x.com/badimo', youtubeUrl: 'https://www.youtube.com/@Badimo' });
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel'), null);
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
  const currentRequest = env.requests.find(request => request.message.groupId === 999);
  currentRequest.callback({ xUrl: 'https://x.com/newcommunity', youtubeUrl: null });
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel').dataset.handle, 'newcommunity');
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
});

const backgroundSource = fs.readFileSync(path.join(__dirname, '..', 'src/background/service-worker.js'), 'utf8');
function background(links = []) {
  let listener;
  const requests = [];
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout,
    chrome: { runtime: { onMessage: { addListener(callback) { listener = callback; } } } },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ data: links }) }; }
  });
  vm.runInContext(backgroundSource + `
    getXPosts = async handle => ({ posts: [], handle });
    getYouTubeVideos = async channelUrl => ({ videos: [], channelUrl });
    getXImage = async () => 'data:image/png;base64,AAAA';
  `, context);
  return { requests, async send(message, pathname) {
    let resolve;
    const response = new Promise(done => { resolve = done; });
    const accepted = listener(message, { url: `https://www.roblox.com${pathname}` }, resolve);
    return accepted === true ? { accepted: true, response: await response } : { accepted: false };
  } };
}

test('community link lookup checks the source group and discards unrelated or malformed URLs', async () => {
  const env = background([{ url: 'https://x.com.evil.example/badimo' }, { url: 'javascript:alert(1)' },
    { url: 'https://youtube.com.evil.example/@Badimo' },
    { url: 'https://www.youtube.com/@Badimo' }, { url: 'https://x.com/badimo' }]);
  assert.equal((await env.send({ type: 'rc-community-social-links', groupId: 999 }, '/communities/3059674/Badimo')).accepted, false);
  assert.equal((await env.send({ type: 'rc-community-social-links', groupId: 3059674 }, '/games/3059674/Test')).accepted, false);
  const result = await env.send({ type: 'rc-community-social-links', groupId: 3059674 }, '/communities/3059674/Badimo');
  assert.equal(result.response.xUrl, 'https://x.com/badimo');
  assert.equal(result.response.youtubeUrl, 'https://www.youtube.com/@Badimo');
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].url, 'https://groups.roblox.com/v1/groups/3059674/social-links');
  assert.equal(env.requests[0].options.credentials, 'include');
});

test('the worker serves feed loaders on game, community, and profile routes while excluding other pages', async () => {
  const env = background();
  const messages = [
    { type: 'rc-x-posts', handle: 'badimo' },
    { type: 'rc-x-image', url: 'https://pbs.twimg.com/media/example.jpg' },
    { type: 'rc-youtube-videos', channelUrl: 'https://www.youtube.com/@Badimo' },
    { type: 'rc-youtube-image', videoId: 'abcDEF12345' }
  ];
  for (const message of messages) {
    for (const route of ['/games/123/Test', '/communities/3059674/Badimo', '/groups/3059674/Badimo', '/users/19717956/profile']) {
      assert.equal((await env.send(message, route)).accepted, true);
    }
    for (const route of ['/home', '/communities/search', '/groups', '/communities/3059674evil',
      '/users/friends', '/users/19717956/inventory', '/users/19717956/profile-extra', '/users/abc/profile']) {
      assert.equal((await env.send(message, route)).accepted, false);
    }
  }
});

const profileSource = fs.readFileSync(path.join(__dirname, '..', 'src/pages/profile/profile-page.js'), 'utf8');
const profileSocialStart = profileSource.indexOf('  function socialProfileUrl(');
const profileSocialEnd = profileSource.indexOf('  function renderNativeAbout(', profileSocialStart);
assert.ok(profileSocialStart >= 0 && profileSocialEnd > profileSocialStart);

function profileEnvironment(viewport = 1920) {
  const env = environment('/users/19717956/profile', viewport);
  env.page.id = 'profile-container';
  env.page.rect = { left: 430, right: 1530, top: 80, width: 1100, height: 1600 };
  env.announcements.setAttribute('data-rc-profile-section', 'collections');
  env.page.replaceChildren(env.summary, env.announcements);
  vm.runInContext(profileSource.slice(profileSocialStart, profileSocialEnd)
    + '\n globalThis.publishProfileSocialLinks = publishProfileSocialLinks;', env.context);
  env.publish = (data, userId = 19717956) => env.context.publishProfileSocialLinks(env.page, userId, data);
  env.linked = () => {
    env.publish({ socialChannels: { twitter: '@creator_test', youtube: '@CreatorTest' } });
    env.sync();
  };
  return env;
}

test('profile account details power side feeds even without a native bio or a second social lookup', () => {
  const env = profileEnvironment();
  env.document.body.append(new Element('nav', { id: 'navigation',
    rect: { left: 0, right: 180, width: 180, height: 1000 } }));
  env.linked();
  const youtube = env.document.getElementById('rc-youtube-feed-panel');
  const x = env.document.getElementById('rc-x-feed-panel');
  assert.equal(youtube.dataset.channelUrl, 'https://www.youtube.com/@CreatorTest');
  assert.equal(x.dataset.handle, 'creator_test');
  assert.equal(x.dataset.userId, '19717956');
  assert.equal(youtube.dataset.userId, '19717956');
  assert.equal(youtube.style.left, '196px', 'The left feed clears native navigation');
  assert.equal(youtube.style.width, '222px');
  assert.equal(x.style.left, '1542px');
  assert.equal(x.style.width, '350px');
  assert.equal(x.style.top, '280px');
  assert.equal(youtube.parentElement, env.document.body);
  assert.equal(x.parentElement, env.document.body);
  assert.deepEqual(env.requests.map(request => request.message.type), ['rc-x-posts', 'rc-youtube-videos']);
});

test('nested profile content wins over the screen-wide wrapper and feeds align with the avatar card', () => {
  const env = profileEnvironment(2547);
  const outer = new Element('main', { id: 'container-main',
    rect: { left: 240, right: 2547, top: 50, width: 2307, height: 1600 } });
  env.page.id = 'content';
  env.page.rect = { left: 640, right: 1920, top: 80, width: 1280, height: 1600 };
  const banner = new Element('div', {
    rect: { left: 640, right: 1920, top: 120, width: 1280, height: 300 } });
  banner.setAttribute('data-rc-profile-banner', '');
  env.page.prepend(banner);
  env.document.body.append(outer);
  outer.append(env.page);
  env.document.body.append(new Element('nav', { id: 'navigation',
    rect: { left: 0, right: 240, width: 240, height: 1000 } }));
  env.linked();
  assert.equal(env.context.feeds.socialFeedContext().page, env.page);
  const youtube = env.document.getElementById('rc-youtube-feed-panel');
  const x = env.document.getElementById('rc-x-feed-panel');
  assert.equal(youtube.style.left, '278px');
  assert.equal(x.style.left, '1932px');
  assert.equal(youtube.style.top, '320px');
  assert.equal(x.style.top, '320px');
  assert.equal(env.document.getElementById('rc-profile-social-feeds'), null);
  assert.deepEqual(env.page.children, [banner, env.summary, env.announcements]);
});

test('desktop profiles reserve both gutters and release the width when feeds are hidden or navigation leaves', () => {
  const env = profileEnvironment(1440);
  env.document.body.append(new Element('nav', { id: 'navigation',
    rect: { left: 0, right: 180, width: 180, height: 1000 } }));
  env.page.rect = { left: 200, right: 1420, top: 80, width: 1220, height: 1600 };
  env.linked();
  assert.equal(env.page.hasAttribute('data-rc-profile-feed-layout'), true);
  assert.equal(env.page.style.getPropertyValue('--rc-profile-feed-content-width'), '804px');
  // The structural fixture has no CSS engine. Supply the resulting centered
  // bounds for the next ResizeObserver pass and verify both panel positions.
  env.page.rect = { left: 408, right: 1212, top: 80, width: 804, height: 1600 };
  env.sync();
  assert.equal(env.document.getElementById('rc-youtube-feed-panel').style.left, '196px');
  assert.equal(env.document.getElementById('rc-x-feed-panel').style.left, '1224px');
  assert.equal(env.document.getElementById('rc-profile-social-feeds'), null);
  env.document.documentElement.setAttribute('data-rc-hide-x-feed', '');
  env.document.documentElement.setAttribute('data-rc-hide-youtube-feed', '');
  env.sync();
  assert.equal(env.page.hasAttribute('data-rc-profile-feed-layout'), false);
  assert.equal(env.page.style.getPropertyValue('--rc-profile-feed-content-width'), '');
  env.document.documentElement.removeAttribute('data-rc-hide-x-feed');
  env.document.documentElement.removeAttribute('data-rc-hide-youtube-feed');
  env.page.rect = { left: 200, right: 1420, top: 80, width: 1220, height: 1600 };
  env.sync();
  assert.equal(env.page.hasAttribute('data-rc-profile-feed-layout'), true);
  env.location.pathname = '/home';
  env.sync();
  assert.equal(env.page.hasAttribute('data-rc-profile-feed-layout'), false);
  assert.equal(env.page.style.getPropertyValue('--rc-profile-feed-content-width'), '');
});

test('profiles with space on only one side keep both feeds together below the identity', () => {
  const env = profileEnvironment(1300);
  env.document.body.append(new Element('nav', { id: 'navigation',
    rect: { left: 0, right: 180, width: 180, height: 1000 } }));
  env.page.rect = { left: 500, right: 1200, top: 80, width: 700, height: 1600 };
  env.linked();
  const row = env.document.getElementById('rc-profile-social-feeds');
  assert.equal(row.childElementCount, 2);
  assert.deepEqual(env.page.children, [env.summary, row, env.announcements]);
  assert.equal(env.page.hasAttribute('data-rc-profile-feed-layout'), false);
});

test('profile feeds reflow below the identity and above sections, and honor hide preferences', () => {
  const env = profileEnvironment(1000);
  env.page.rect = { left: 200, right: 980, top: 80, width: 780, height: 1600 };
  env.linked();
  const row = env.document.getElementById('rc-profile-social-feeds');
  assert.equal(row.childElementCount, 2);
  assert.deepEqual(env.page.children, [env.summary, row, env.announcements]);
  for (const panel of row.children) {
    assert.equal(panel.classList.contains('rc-profile-feed-inline'), true);
    assert.equal(panel.classList.contains('rc-x-feed-floating'), false);
  }
  env.page.rect = { left: 430, right: 1530, top: 80, width: 1100, height: 1600 };
  env.context.innerWidth = 1920;
  env.sync();
  assert.equal(env.document.getElementById('rc-profile-social-feeds'), null);
  env.document.documentElement.setAttribute('data-rc-hide-x-feed', '');
  env.document.documentElement.setAttribute('data-rc-hide-youtube-feed', '');
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel'), null);
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
});

test('profile videos and posts support thumbnails, collapse, reload, and direct links', () => {
  const env = profileEnvironment();
  env.linked();
  const youtube = env.document.getElementById('rc-youtube-feed-panel');
  const x = env.document.getElementById('rc-x-feed-panel');
  env.requests.find(request => request.message.type === 'rc-youtube-videos').callback({
    channelTitle: 'Creator Test', videos: [{ id: 'abcDEF12345', title: 'Latest video' }]
  });
  env.requests.find(request => request.message.type === 'rc-x-posts').callback({
    posts: [{ id: '1234567890', text: 'Latest update', images: ['https://pbs.twimg.com/media/example.jpg'] }]
  });
  assert.equal(youtube.querySelector('.rc-x-feed-post').href, 'https://www.youtube.com/watch?v=abcDEF12345');
  assert.equal(x.querySelector('.rc-x-feed-post').href, 'https://x.com/creator_test/status/1234567890');
  assert.ok(env.requests.some(request => request.message.type === 'rc-youtube-image'));
  assert.ok(env.requests.some(request => request.message.type === 'rc-x-image'));
  youtube.querySelector('.rc-x-feed-toggle').click();
  assert.equal(youtube.classList.contains('rc-x-feed-collapsed'), true);
  assert.equal(youtube.querySelector('.rc-x-feed-toggle').getAttribute('aria-expanded'), 'false');
  youtube.querySelector('.rc-x-feed-retry').click();
  x.querySelector('.rc-x-feed-retry').click();
  assert.ok(env.requests.some(request => request.message.type === 'rc-youtube-videos' && request.message.force));
  assert.ok(env.requests.some(request => request.message.type === 'rc-x-posts' && request.message.force));
});

test('profile navigation removes old feeds and ignores their late responses before showing the new account', () => {
  const env = profileEnvironment();
  env.linked();
  const oldX = env.document.getElementById('rc-x-feed-panel');
  const oldRequest = env.requests.find(request => request.message.type === 'rc-x-posts');
  env.location.pathname = '/users/999/profile';
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel'), null);
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
  oldRequest.callback({ posts: [{ id: '1234567890', text: 'Old profile update' }] });
  assert.equal(oldX.querySelector('.rc-x-feed-posts').childElementCount, 0);
  env.publish({ socialChannels: { twitter: 'new_creator' } }, 999);
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel').dataset.handle, 'new_creator');
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
  env.location.pathname = '/home';
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel'), null);
});

test('profile feeds use public bio URLs as fallback and never invent accounts or accept lookalike domains', () => {
  const env = profileEnvironment();
  env.publish({ description: 'YouTube: https://www.youtube.com/@CreatorTest. X: https://x.com/creator_test)' });
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel').dataset.handle, 'creator_test');
  assert.equal(env.document.getElementById('rc-youtube-feed-panel').dataset.channelUrl, 'https://www.youtube.com/@CreatorTest');
  env.publish({ name: 'creator_test', description: 'https://x.com.evil.example/creator_test',
    socialChannels: { youtube: 'https://youtube.com.evil.example/@CreatorTest' } });
  env.sync();
  assert.equal(env.document.getElementById('rc-x-feed-panel'), null);
  assert.equal(env.document.getElementById('rc-youtube-feed-panel'), null);
});
