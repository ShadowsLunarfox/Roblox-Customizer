const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const { isolatedChrome, waitForDocument } = require('./helpers/chrome.cjs');

const workspace = path.resolve(__dirname, '..');
const script = 'src/pages/account/messages-page.js';
const style = 'src/pages/account/messages-page.css';

test('Inbox hides only Mark as Unread actions across rerenders and restores them outside Inbox',
  { skip: !process.env.CHROME_BIN, timeout: 30000 }, async t => {
    const server = http.createServer((request, response) => {
      const file = new URL(request.url, 'http://localhost').pathname.slice(1);
      if (file === script || file === style) {
        response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
        response.end(fs.readFileSync(path.join(workspace, file)));
        return;
      }
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html><head><link rel="stylesheet" href="/${style}"></head><body>
        <div id="private-message-web-app">
          <div class="toolbar"><button id="archive">Archive</button><button id="read">Mark as Read</button>
            <button id="unread"><span>Mark as Unread</span></button></div>
          <article>Message body: Mark as Unread</article>
        </div>
        <div role="menu"><a id="portal-unread" role="menuitem" href="#">Mark as unread</a></div>
        <script src="/${script}"></script></body></html>`);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await isolatedChrome(t, 'messages-unread');
    const url = `http://127.0.0.1:${server.address().port}/my/messages/#!/inbox`;
    await browser.send('Page.navigate', { url });
    await waitForDocument(browser, '#private-message-web-app', url);
    await browser.waitFor("getComputedStyle(document.querySelector('#unread')).display==='none'&&getComputedStyle(document.querySelector('#portal-unread')).display==='none'");
    assert.equal(await browser.evaluate("['archive','read'].every(id=>getComputedStyle(document.getElementById(id)).display!=='none')"), true);
    assert.equal(await browser.evaluate("document.querySelector('article').textContent.includes('Mark as Unread')"), true);

    await browser.evaluate("document.querySelector('.toolbar').insertAdjacentHTML('beforeend','<button id=late>标记为未读</button><button id=other>Delete</button>')");
    await browser.waitFor("getComputedStyle(document.querySelector('#late')).display==='none'");
    assert.equal(await browser.evaluate("getComputedStyle(document.querySelector('#other')).display!=='none'"), true);

    await browser.evaluate("location.hash='!/sent'");
    await browser.waitFor("getComputedStyle(document.querySelector('#unread')).display!=='none'&&getComputedStyle(document.querySelector('#late')).display!=='none'");
    await browser.evaluate("location.hash='!/inbox'");
    await browser.waitFor("getComputedStyle(document.querySelector('#unread')).display==='none'");

    await browser.evaluate("document.querySelector('#unread span').textContent='Mark as Read';document.querySelector('#late').textContent='Action';document.querySelector('#late').setAttribute('aria-label','標記為未讀')");
    await browser.waitFor("getComputedStyle(document.querySelector('#unread')).display!=='none'&&getComputedStyle(document.querySelector('#late')).display==='none'");
    assert.deepEqual(browser.errors, []);
  });
