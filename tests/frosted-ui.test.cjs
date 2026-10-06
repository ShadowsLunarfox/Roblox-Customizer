const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'frosted-ui.js'), 'utf8');
const exposed = source.replace(/  queueSync\(\);\s*\}\)\(\);\s*$/, `
  globalThis.frost = { panelFor, panelForHeader, syncPanels, queueSync, markSurface, introNotice, syncPanelSurfaces };
})();`);
assert.notEqual(exposed, source, 'Load the actual chat discovery code');

class Element {
  constructor(parent = null, options = {}) {
    this.parentElement = parent;
    this.id = options.id || '';
    this.className = options.className || '';
    this.tag = options.tag || 'div';
    this.text = options.text || '';
    this.children = [];
    this.attributes = { ...options.attributes };
    if (parent) parent.children.push(this);
    this.rect = options.rect || { width: 250, height: 310, bottom: 680 };
    this.style = { position: 'static', borderTopLeftRadius: '0px', overflowY: 'visible', ...options.style };
  }
  get childElementCount() { return this.children.length; }
  get childNodes() { return [{ nodeType: 3, textContent: this.text }, ...this.children]; }
  get isConnected() {
    for (let node = this; node; node = node.parentElement) {
      if (node.tag === 'body') return true;
    }
    return false;
  }
  getBoundingClientRect() { return this.rect; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    return selector.split(',').some(part => {
      part = part.trim();
      if (part.startsWith('#')) return this.id === part.slice(1);
      if (part.startsWith('.')) return this.className.split(/\s+/).includes(part.slice(1));
      const tagAttribute = part.match(/^(\w+)(\[.*\])$/);
      if (tagAttribute) return this.tag === tagAttribute[1] && this.matches(tagAttribute[2]);
      if (part.startsWith('[')) {
        const match = part.match(/^\[([^=\]]+)(?:="([^"]+)")?(?: i)?\]$/);
        return !!match && (match[2] ? this.getAttribute(match[1]) === match[2] : this.hasAttribute(match[1]));
      }
      return part === this.tag;
    });
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
}

function harness() {
  const body = new Element(null, { tag: 'body', rect: { width: 1000, height: 700, bottom: 700 } });
  const timers = [];
  const documentQueries = [];
  let observeChanges;
  const context = {
    Element, innerHeight: 700,
    document: { body, addEventListener() {}, querySelectorAll(selector) {
      documentQueries.push(selector);
      return body.querySelectorAll(selector);
    } },
    getComputedStyle: node => ({ ...node.style,
      ...(node.hasAttribute('data-rc-chat-static') ? { position: 'relative' } : {}) }),
    MutationObserver: class { constructor(callback) { observeChanges = callback; } observe() {} },
    addEventListener() {},
    setTimeout(callback) { timers.push(callback); return timers.length; }
  };
  vm.runInNewContext(exposed, context, { filename: 'frosted-ui.js' });
  return { body, timers, documentQueries, observeChanges, ...context.frost };
}

test('chat keeps its glass during the loading gap and the closing animation', () => {
  const { body, syncPanels, observeChanges, timers } = harness();
  const panel = new Element(body, { rect: { width: 256, height: 42, bottom: 700 },
    style: { position: 'fixed', borderTopLeftRadius: '16px', bottom: '0px' } });
  const title = new Element(panel, { tag: 'span', text: 'Chat',
    rect: { width: 30, height: 18, bottom: 688 } });
  syncPanels();
  panel.rect.height = 190;
  title.rect.bottom = 520;
  observeChanges([{ type: 'attributes', target: panel, addedNodes: [] }]);
  timers.shift()();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true, 'Keep glass while the composer is not mounted');
  panel.rect.height = 0;
  panel.rect.bottom = 760;
  title.rect.bottom = 748;
  observeChanges([{ type: 'attributes', target: panel, addedNodes: [] }]);
  timers.shift()();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true, 'Keep glass while the closing bar is offscreen');
});

test('opening chat without a composer discovers the full window rather than its header', () => {
  const { body, syncPanels } = harness();
  const panel = new Element(body, { rect: { width: 256, height: 420, bottom: 700 },
    style: { position: 'fixed', borderTopLeftRadius: '16px', bottom: '0px' } });
  const header = new Element(panel, { rect: { width: 256, height: 42, bottom: 322 } });
  new Element(header, { tag: 'span', text: 'Chat', rect: { width: 30, height: 18, bottom: 308 } });
  new Element(panel, { text: 'Loading...', rect: { width: 256, height: 378, bottom: 700 } });
  syncPanels();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(header.hasAttribute('data-rc-chat-panel'), false);
});

test('rapid chat toggles share a scoped update without rescanning the document', () => {
  const { body, syncPanels, observeChanges, timers, documentQueries } = harness();
  const panel = new Element(body, { rect: { width: 256, height: 42, bottom: 700 },
    style: { position: 'fixed', borderTopLeftRadius: '16px', bottom: '0px' } });
  new Element(panel, { tag: 'span', text: 'Chat', rect: { width: 30, height: 18, bottom: 688 } });
  syncPanels();
  documentQueries.length = 0;
  for (let i = 0; i < 200; i++) {
    panel.rect.height = i % 2 ? 180 : 42;
    observeChanges([{ type: 'attributes', target: panel, addedNodes: [] }]);
  }
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(documentQueries.length, 0, 'Animation updates must not scan every page div');
});

test('a collapsed chat bar is frosted without a search or composer', () => {
  const { body, panelForHeader, syncPanels } = harness();
  const panel = new Element(body, { className: 'generated-chat-launcher',
    rect: { width: 256, height: 42, bottom: 700 }, style: { position: 'fixed' } });
  const header = new Element(panel, { tag: 'button',
    rect: { width: 256, height: 42, bottom: 700 } });
  const title = new Element(header, { tag: 'span', text: 'Chat',
    rect: { width: 30, height: 18, bottom: 688 } });
  const icon = new Element(header, { tag: 'button', rect: { width: 24, height: 24, bottom: 690 } });
  assert.equal(panelForHeader(title), panel);
  syncPanels();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(header.hasAttribute('data-rc-chat-surface'), true);
  assert.equal(icon.hasAttribute('data-rc-chat-surface'), false);
});

test('a collapsed chat bar inside a full-screen portal frosts only the bar', () => {
  const { body, panelForHeader } = harness();
  const portal = new Element(body, { style: { position: 'fixed' },
    rect: { width: 1000, height: 700, bottom: 700 } });
  const panel = new Element(portal, { style: { position: 'absolute' },
    rect: { width: 256, height: 42, bottom: 700 } });
  const title = new Element(panel, { tag: 'span', text: 'Chat',
    rect: { width: 30, height: 18, bottom: 688 } });
  assert.equal(panelForHeader(title), panel);
});

test('ordinary Chat headings and wide or undocked fixed bars are excluded', () => {
  const { body, panelForHeader } = harness();
  for (const options of [
    { rect: { width: 256, height: 42, bottom: 700 } },
    { rect: { width: 900, height: 42, bottom: 700 }, style: { position: 'fixed' } },
    { rect: { width: 256, height: 42, bottom: 400 }, style: { position: 'fixed' } }
  ]) {
    const panel = new Element(body, options);
    const title = new Element(panel, { tag: 'span', text: 'Chat',
      rect: { width: 30, height: 18, bottom: options.rect.bottom - 12 } });
    assert.equal(panelForHeader(title), null);
  }
});

test('an accessible Chat label also identifies the collapsed bar', () => {
  const { body, panelForHeader } = harness();
  const panel = new Element(body, { style: { position: 'fixed' },
    rect: { width: 256, height: 42, bottom: 700 }, attributes: { 'aria-label': 'Chat' } });
  assert.equal(panelForHeader(panel), panel);
});

test('a message containing only Chat cannot become a collapsed launcher', () => {
  const { body, panelForHeader } = harness();
  const panel = new Element(body, { style: { position: 'fixed' } });
  const log = new Element(panel, { attributes: { role: 'log' } });
  const bubble = new Element(log, { rect: { width: 220, height: 42, bottom: 690 } });
  const text = new Element(bubble, { tag: 'span', text: 'Chat',
    rect: { width: 30, height: 18, bottom: 682 } });
  assert.equal(panelForHeader(text), null);
});

test('chat styling survives expanding and collapsing the same generated window', () => {
  const { body, syncPanels, observeChanges, timers } = harness();
  const panel = new Element(body, { rect: { width: 256, height: 42, bottom: 700 },
    style: { position: 'fixed', borderTopLeftRadius: '16px' } });
  const title = new Element(panel, { tag: 'span', text: 'Chat',
    rect: { width: 30, height: 18, bottom: 688 } });
  syncPanels();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true);
  panel.rect.height = 310;
  title.rect.bottom = 410;
  const input = new Element(panel, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
  observeChanges([{ type: 'childList', target: panel, addedNodes: [input] }]);
  timers.shift()();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(input.hasAttribute('data-rc-chat-input'), true);
  panel.children = [title];
  input.parentElement = null;
  panel.rect.height = 42;
  title.rect.bottom = 688;
  observeChanges([{ type: 'childList', target: panel, addedNodes: [], removedNodes: [input] }]);
  timers.shift()();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true);
});

test('replacing an open chat window retires the old markers and styles the new loading pane', () => {
  const { body, syncPanels, observeChanges, timers, documentQueries } = harness();
  const previous = new Element(body, { rect: { width: 256, height: 42, bottom: 700 },
    style: { position: 'fixed', bottom: '0px' } });
  new Element(previous, { tag: 'span', text: 'Chat', rect: { width: 30, height: 18, bottom: 688 } });
  syncPanels();
  assert.equal(previous.hasAttribute('data-rc-chat-panel'), true);
  body.children = [];
  previous.parentElement = null;
  const next = new Element(body, { rect: { width: 256, height: 420, bottom: 700 },
    style: { position: 'fixed', bottom: '0px' } });
  new Element(next, { tag: 'span', text: 'Chat', rect: { width: 30, height: 18, bottom: 300 } });
  const loading = new Element(next);
  new Element(loading, { tag: 'span', text: 'Loading...' });
  documentQueries.length = 0;
  observeChanges([{ type: 'childList', target: body, addedNodes: [next, loading], removedNodes: [previous] }]);
  assert.equal(timers.length, 1);
  timers.shift()();
  assert.equal(previous.hasAttribute('data-rc-chat-panel'), false);
  assert.equal(next.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(loading.hasAttribute('data-rc-chat-surface'), true);
  assert.equal(documentQueries.length, 0);
});

test('unrelated page changes do not trigger a document-wide chat scan', () => {
  const { body, syncPanels, observeChanges, timers, documentQueries } = harness();
  syncPanels();
  documentQueries.length = 0;
  const card = new Element(body, { text: 'A regular game card' });
  observeChanges([{ type: 'childList', target: body, addedNodes: [card] }]);
  observeChanges([{ type: 'attributes', target: card, addedNodes: [] }]);
  timers.shift()();
  assert.equal(documentQueries.length, 0);
  assert.equal(card.hasAttribute('data-rc-chat-panel'), false);
});

test('a shared dialog host never becomes a glass window as conversations are added', () => {
  const { body, syncPanels, observeChanges, timers } = harness();
  const host = new Element(body, { id: 'dialog-container', style: { position: 'fixed' },
    rect: { width: 500, height: 310, bottom: 700 } });
  const windows = [];
  for (let i = 0; i < 2; i++) {
    const window = new Element(host, { className: 'dialog-container',
      rect: { width: 250, height: 310, bottom: 700 } });
    const main = new Element(window, { className: 'dialog-main' });
    new Element(main, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
    windows.push(window);
  }
  syncPanels();
  assert.equal(host.hasAttribute('data-rc-chat-panel'), false, 'The shared host must not clip every window backdrop');
  for (const window of windows) {
    assert.equal(window.hasAttribute('data-rc-chat-panel'), true);
    assert.equal(window.hasAttribute('data-rc-chat-surface'), false);
    assert.equal(window.querySelector('.dialog-main').hasAttribute('data-rc-chat-panel'), false);
  }
  const next = new Element(host, { className: 'dialog-container' });
  new Element(next, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
  observeChanges([{ type: 'childList', target: host, addedNodes: [next] }]);
  timers.shift()();
  assert.equal(host.hasAttribute('data-rc-chat-panel'), false);
  assert.equal(next.hasAttribute('data-rc-chat-panel'), true);
  for (const window of windows) assert.equal(window.hasAttribute('data-rc-chat-panel'), true);
});

test('live React chat gives each outlying conversation and the friends list its own layer', () => {
  const { body, syncPanels, observeChanges, timers } = harness();
  const host = new Element(body, { id: 'chat-container', rect: { width: 2100, height: 0, bottom: 700 } });
  const root = new Element(host, { className: 'react-chat-root', style: { position: 'fixed' },
    rect: { width: 286, height: 360, bottom: 700 } });
  const dialogs = new Element(root, { style: { position: 'fixed' },
    rect: { width: 1560, height: 360, bottom: 700 } });
  const windows = [];
  for (let i = 0; i < 5; i++) {
    const pane = new Element(dialogs, { tag: 'section', className: 'react-chat-dialog-shell',
      rect: { width: 260, height: 360, bottom: 700 } });
    windows.push(pane);
  }
  const list = new Element(root, { tag: 'section', attributes: { 'aria-label': 'Chat' },
    rect: { width: 286, height: 360, bottom: 700 } });
  syncPanels();
  for (const container of [host, root, dialogs]) assert.equal(container.hasAttribute('data-rc-chat-panel'), false);
  for (const pane of [...windows, list]) {
    assert.equal(pane.hasAttribute('data-rc-chat-panel'), true, 'Discover the actual shell before inputs load');
    assert.equal(pane.hasAttribute('data-rc-chat-surface'), false);
    assert.equal(pane.hasAttribute('data-rc-chat-static'), true);
  }
  const next = new Element(dialogs, { tag: 'section', className: 'react-chat-dialog-shell' });
  observeChanges([{ type: 'childList', target: dialogs, addedNodes: [next] }]);
  timers.shift()();
  assert.equal(next.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(root.hasAttribute('data-rc-chat-panel'), false);
});

test('live React list backing and nested localized safety cards clear in every conversation', () => {
  const { body, syncPanels } = harness();
  const root = new Element(body, { className: 'react-chat-root' });
  const conversations = [];
  for (let i = 0; i < 3; i++) {
    const pane = new Element(root, { tag: 'section', className: 'react-chat-dialog-shell' });
    const scroll = new Element(pane, { className: 'react-chat-dialog-scroll', style: { overflowY: 'auto' } });
    const list = new Element(scroll, { tag: 'ul' });
    const item = new Element(list, { tag: 'li' });
    const card = new Element(item, { className: 'react-chat-osa-inline-card' });
    new Element(card, { tag: 'a', text: 'Profile' });
    new Element(card, { text: '第一次聊天' });
    const warning = new Element(card);
    new Element(warning, { tag: 'span', text: 'Be careful when you chat with strangers.' });
    const message = new Element(list, { tag: 'li' });
    const bubble = new Element(message, { text: 'A normal message bubble' });
    conversations.push({ scroll, list, item, card, message, bubble });
  }
  syncPanels();
  for (const { scroll, list, item, card, message, bubble } of conversations) {
    for (const surface of [scroll, list, item, card]) assert.equal(surface.hasAttribute('data-rc-chat-surface'), true);
    assert.equal(message.hasAttribute('data-rc-chat-surface'), false);
    assert.equal(bubble.hasAttribute('data-rc-chat-surface'), false);
  }
});

test('repeated React discovery retains the containing block supplied by the glass stylesheet', () => {
  const { body, syncPanels, observeChanges, timers } = harness();
  const root = new Element(body, { className: 'react-chat-root', style: { position: 'fixed' } });
  const pane = new Element(root, { tag: 'section', className: 'react-chat-dialog-shell' });
  syncPanels();
  for (let i = 0; i < 20; i++) {
    const wrapper = new Element(pane);
    new Element(wrapper, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
    observeChanges([{ type: 'childList', target: pane, addedNodes: [wrapper] }]);
    timers.shift()();
    assert.equal(pane.hasAttribute('data-rc-chat-static'), true);
    assert.equal(root.hasAttribute('data-rc-chat-panel'), false);
  }
});

test('a shared class wrapper is split into individual conversation windows', () => {
  const { body, syncPanels } = harness();
  const host = new Element(body, { className: 'dialog-container', style: { position: 'fixed' },
    rect: { width: 500, height: 310, bottom: 700 } });
  const group = new Element(host);
  const first = new Element(group, { className: 'dialog-main' });
  const second = new Element(group, { className: 'dialog-main' });
  for (const window of [first, second]) {
    new Element(window, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
  }
  syncPanels();
  assert.equal(host.hasAttribute('data-rc-chat-panel'), false);
  assert.equal(first.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(second.hasAttribute('data-rc-chat-panel'), true);
});

test('surface cleanup cannot remove a neighbouring window backdrop', () => {
  const { body, syncPanelSurfaces } = harness();
  const host = new Element(body);
  const window = new Element(host, { attributes: { 'data-rc-chat-panel': '' } });
  const content = new Element(window);
  new Element(content, { tag: 'span', text: 'A window header' });
  syncPanelSurfaces(host);
  assert.equal(window.hasAttribute('data-rc-chat-surface'), false);
  assert.equal(content.hasAttribute('data-rc-chat-surface'), false);
});

test('adding a second conversation splits a previously single class wrapper', () => {
  const { body, syncPanels, observeChanges, timers } = harness();
  const host = new Element(body, { className: 'dialog-container', style: { position: 'fixed' } });
  const first = new Element(host, { className: 'dialog-main' });
  new Element(first, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
  syncPanels();
  assert.equal(host.hasAttribute('data-rc-chat-panel'), true);
  const second = new Element(host, { className: 'dialog-main' });
  new Element(second, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
  observeChanges([{ type: 'childList', target: host, addedNodes: [second] }]);
  timers.shift()();
  assert.equal(host.hasAttribute('data-rc-chat-panel'), false);
  assert.equal(first.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(second.hasAttribute('data-rc-chat-panel'), true);
  assert.equal(first.hasAttribute('data-rc-chat-surface'), false);
});

test('introductory notices rendered as list items clear in every window', () => {
  const { body, syncPanels } = harness();
  const host = new Element(body, { id: 'dialog-container' });
  const notices = [];
  const messages = [];
  for (let i = 0; i < 3; i++) {
    const window = new Element(host, { className: 'dialog-container' });
    const log = new Element(window, { className: 'dialog-body', tag: 'ul', attributes: { role: 'log' } });
    const notice = new Element(log, { tag: 'li', className: 'dialog-message-container' });
    new Element(notice, { tag: 'strong', text: 'First conversation with TestFriend' + i });
    new Element(notice, { tag: 'p', text: "Be careful when you chat with strangers. Don't share personal info." });
    const message = new Element(log, { tag: 'li', className: 'dialog-message-container' });
    new Element(message, { className: 'dialog-message', text: 'Keep this ordinary message styled' });
    notices.push(notice);
    messages.push(message);
    new Element(window, { tag: 'input', attributes: { 'data-testid': 'chat-input' } });
  }
  syncPanels();
  for (const notice of notices) assert.equal(notice.hasAttribute('data-rc-chat-surface'), true);
  for (const message of messages) assert.equal(message.hasAttribute('data-rc-chat-surface'), false);
});

test('a dynamically mounted collapsed chat bar schedules discovery', () => {
  const { body, timers, observeChanges } = harness();
  const panel = new Element(body, { rect: { width: 256, height: 42, bottom: 700 },
    style: { position: 'fixed' } });
  new Element(panel, { tag: 'span', text: 'Chat' });
  observeChanges([{ target: body, addedNodes: [panel] }]);
  assert.equal(timers.length, 1);
  timers[0]();
  assert.equal(panel.hasAttribute('data-rc-chat-panel'), true);
});

test('native chat panels can live outside the old chat container', () => {
  const { body, panelFor } = harness();
  const panel = new Element(body, { className: 'dialog-container dialog-visible' });
  assert.equal(panelFor(new Element(new Element(panel))), panel);
});

test('generated floating chat classes are discovered through their composer', () => {
  const { body, panelFor } = harness();
  const panel = new Element(body, { className: 'css-generated-42',
    style: { position: 'fixed', borderTopLeftRadius: '16px' } });
  const composer = new Element(panel, { rect: { width: 250, height: 45, bottom: 680 } });
  assert.equal(panelFor(new Element(composer)), panel);
});

test('a rounded chat pane inside a full-screen fixed portal is supported', () => {
  const { body, panelFor } = harness();
  const portal = new Element(body, { style: { position: 'fixed' },
    rect: { width: 1000, height: 700, bottom: 700 } });
  const panel = new Element(portal, { style: { position: 'absolute', borderTopLeftRadius: '16px' } });
  assert.equal(panelFor(new Element(panel)), panel);
});

test('regular Friends-page searches near the viewport bottom are excluded', () => {
  const { body, panelFor } = harness();
  const pageCard = new Element(body, { style: { position: 'absolute', borderTopLeftRadius: '16px' } });
  assert.equal(panelFor(new Element(pageCard)), null);
});

test('a search control alone cannot turn into a frosted chat window', () => {
  const { body, panelFor } = harness();
  const inputWrapper = new Element(body, { style: { position: 'fixed', borderTopLeftRadius: '8px' },
    rect: { width: 250, height: 32, bottom: 680 } });
  assert.equal(panelFor(new Element(inputWrapper)), null);
});

test('large page surfaces and unpinned cards are excluded', () => {
  const { body, panelFor } = harness();
  const widePage = new Element(body, { style: { position: 'fixed', borderTopLeftRadius: '16px' },
    rect: { width: 900, height: 310, bottom: 680 } });
  const unpinned = new Element(body, { style: { position: 'fixed', borderTopLeftRadius: '16px' },
    rect: { width: 250, height: 310, bottom: 450 } });
  assert.equal(panelFor(new Element(widePage)), null);
  assert.equal(panelFor(new Element(unpinned)), null);
});

test('bursts of chat rendering updates share one pending scan', () => {
  const { timers, queueSync } = harness();
  for (let i = 0; i < 30; i++) queueSync();
  assert.equal(timers.length, 1);
});

test('clickable chat headers and nested backings clear while small icon buttons keep their styles', () => {
  const { body, syncPanelSurfaces } = harness();
  const panel = new Element(body);
  const wrapper = new Element(panel);
  const header = new Element(wrapper, { attributes: { role: 'button' } });
  new Element(header, { tag: 'span', text: 'Chat' });
  const icon = new Element(header, { tag: 'button', rect: { width: 24, height: 24, bottom: 400 } });
  syncPanelSurfaces(panel);
  assert.equal(header.hasAttribute('data-rc-chat-surface'), true);
  assert.equal(icon.hasAttribute('data-rc-chat-surface'), false);
});

test('the built-in first-conversation card clears even when Roblox classifies it as a message', () => {
  const { body, syncPanelSurfaces, introNotice } = harness();
  const panel = new Element(body);
  const log = new Element(panel, { attributes: { role: 'log' } });
  const notice = new Element(log, { className: 'dialog-message-container',
    rect: { width: 250, height: 145, bottom: 500 } });
  const profile = new Element(notice);
  new Element(profile, { tag: 'span', text: 'TestFriend' });
  const warningCopy = new Element(notice, { rect: { width: 250, height: 90, bottom: 500 } });
  new Element(warningCopy, { tag: 'strong', text: 'First conversation with TestFriend' });
  new Element(warningCopy, { tag: 'p', text: "Be careful when you chat with strangers. Don't share personal info." });
  const message = new Element(log, { className: 'dialog-message-container' });
  const bubble = new Element(message, { className: 'dialog-message', text: 'Hello' });
  assert.equal(introNotice(panel), notice);
  syncPanelSurfaces(panel);
  assert.equal(notice.hasAttribute('data-rc-chat-surface'), true);
  assert.equal(profile.hasAttribute('data-rc-chat-surface'), true);
  assert.equal(message.hasAttribute('data-rc-chat-surface'), false);
  assert.equal(bubble.hasAttribute('data-rc-chat-surface'), false);
});

test('a single matching phrase does not turn an ordinary message into an introduction card', () => {
  const { body, introNotice } = harness();
  const panel = new Element(body);
  const message = new Element(panel, { className: 'dialog-message-container' });
  new Element(message, { tag: 'span', text: 'First conversation with TestFriend' });
  assert.equal(introNotice(panel), null);
});

test('generated message bubbles inside a scrolling conversation keep their backgrounds', () => {
  const { body, syncPanelSurfaces } = harness();
  const panel = new Element(body);
  const scroll = new Element(panel, { style: { overflowY: 'auto' } });
  const bubble = new Element(scroll, { className: 'generated-bubble-123' });
  new Element(bubble, { tag: 'span', text: 'An ordinary long message' });
  syncPanelSurfaces(panel);
  assert.equal(scroll.hasAttribute('data-rc-chat-surface'), true);
  assert.equal(bubble.hasAttribute('data-rc-chat-surface'), false);
});
