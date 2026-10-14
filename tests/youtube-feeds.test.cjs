const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src/background/service-worker.js'), 'utf8');
const channelId = 'UCjiPEaapiHbJMoAdi_L8fNA';
const channelUrl = `https://www.youtube.com/channel/${channelId}`;
const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
const videosUrl = `${channelUrl}/videos`;

function worker(respond) {
  let listener;
  let now = 1000;
  const requests = [];
  const context = vm.createContext({ URL, AbortController, setTimeout, clearTimeout,
    Date: class extends Date { static now() { return now; } },
    chrome: { runtime: { onMessage: { addListener(callback) { listener = callback; } } } },
    async fetch(url, options) {
      requests.push({ url, options });
      const result = await respond(url);
      return { ok: true, status: 200, url, text: async () => '', ...result };
    }
  });
  vm.runInContext(source, context);
  return { context, requests, elapse(ms) { now += ms; },
    async load(url = channelUrl, force = false) {
      return context.getYouTubeVideos(url, force);
    },
    send() {
      return new Promise(resolve => {
        assert.equal(listener({ type: 'rc-youtube-videos', channelUrl },
          { url: 'https://www.roblox.com/users/2950704295/profile' }, resolve), true);
      });
    }
  };
}

function pageData(contents = [], options = {}) {
  return {
    metadata: { channelMetadataRenderer: { externalId: channelId, title: 'Roblox', ...options.metadata } },
    header: { videoRenderer: { videoId: 'header12345', title: { simpleText: 'Header trailer' } } },
    contents: { twoColumnBrowseResultsRenderer: { tabs: [
      { tabRenderer: { title: 'Home', content: { videoRenderer: { videoId: 'other123456' } } } },
      { tabRenderer: { selected: true, title: '影片',
        endpoint: { commandMetadata: { webCommandMetadata: { url: options.tabUrl || '/@Roblox/videos' } } },
        content: { richGridRenderer: { contents } } } }
    ] } }
  };
}

function page(data, assignment = 'var ytInitialData') {
  return `<html><script>globalThis.remoteExecuted = true;</script><script nonce="test">${assignment} = ${JSON.stringify(data)}; globalThis.remoteExecuted = true;</script></html>`;
}

function modern(id, title = 'Latest video', contentType = 'LOCKUP_CONTENT_TYPE_VIDEO') {
  return { richItemRenderer: { content: { lockupViewModel: {
    contentId: id, contentType, metadata: { lockupMetadataViewModel: { title: { content: title } } }
  } } } };
}

function feed(entries = '') {
  return `<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
    <yt:channelId>${channelId}</yt:channelId><author><name>Roblox &amp; Friends</name></author>${entries}</feed>`;
}

test('working Atom feeds retain titles, dates and thumbnails without fetching a channel page', async () => {
  const xml = feed(`<entry><yt:videoId>abcDEF12345</yt:videoId><title>Build &amp; Play &#x1f680;</title>
    <published>2026-10-13T12:00:00+00:00</published></entry>
    <entry><yt:videoId>invalid</yt:videoId></entry>`);
  const env = worker(() => ({ text: async () => xml }));
  const result = await env.load();
  assert.equal(result.channelId, channelId);
  assert.equal(result.channelTitle, 'Roblox & Friends');
  assert.equal(result.videos.length, 1);
  assert.equal(result.videos[0].title, 'Build & Play 🚀');
  assert.equal(result.videos[0].published, '2026-10-13T12:00:00+00:00');
  assert.equal(result.videos[0].thumbnailUrl, 'https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg');
  assert.deepEqual(env.requests.map(request => request.url), [feedUrl]);
});

test('a feed 404 falls back to current video cards from only the selected Videos tab', async () => {
  const data = pageData([modern('abcDEF12345', 'Title with }; { and "quotes" \\'),
    modern('abcDEF12345', 'Duplicate'), modern('PL123456789', 'Playlist', 'LOCKUP_CONTENT_TYPE_PLAYLIST'),
    modern('invalid', 'Invalid ID'), modern('zxyDEF12345', 'Second video')]);
  const env = worker(url => url === feedUrl ? { ok: false, status: 404 }
    : { text: async () => page(data) });
  const result = await env.send();
  assert.equal(result.channelTitle, 'Roblox');
  assert.deepEqual(Array.from(result.videos, video => video.id), ['abcDEF12345', 'zxyDEF12345']);
  assert.equal(result.videos[0].title, 'Title with }; { and "quotes" \\');
  assert.equal(result.videos[0].published, '', 'Relative ages must not become fabricated dates');
  assert.equal(env.context.remoteExecuted, undefined, 'Fetched scripts are never executed');
  assert.deepEqual(env.requests.map(request => request.url), [feedUrl, videosUrl]);
  assert.ok(env.requests.every(request => request.options.credentials === 'omit'));
});

test('legacy renderers and window assignments remain readable', async () => {
  const data = pageData([
    { gridVideoRenderer: { videoId: 'abcDEF12345', title: { simpleText: 'Old grid' } } },
    { videoRenderer: { videoId: 'zxyDEF12345', title: { runs: [{ text: 'Build ' }, { text: '& Play' }] } } }
  ]);
  const env = worker(url => url === feedUrl ? { ok: false, status: 503 }
    : { text: async () => page(data, 'window["ytInitialData"]') });
  const result = await env.load();
  assert.deepEqual(Array.from(result.videos, video => video.title), ['Old grid', 'Build & Play']);
});

test('HTML, empty static feeds, mismatched feeds and network errors also use the page fallback', async () => {
  for (const brokenFeed of ['<html>Unavailable</html>', '<feed><title>YouTube video feed</title></feed>',
    '<feed><yt:channelId>UC_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId></feed>', null]) {
    const env = worker(url => {
      if (url === feedUrl) {
        if (brokenFeed === null) throw new Error('Network unavailable');
        return { text: async () => brokenFeed };
      }
      return { text: async () => page(pageData([modern('abcDEF12345')])) };
    });
    assert.equal((await env.load()).videos[0].id, 'abcDEF12345');
    assert.equal(env.requests.length, 2);
  }
});

test('fallback results are cached for ten minutes and Reload bypasses the cache', async () => {
  const env = worker(url => url === feedUrl ? { ok: false, status: 404 }
    : { text: async () => page(pageData([modern('abcDEF12345')])) });
  const first = await env.load();
  assert.strictEqual(await env.load(), first);
  assert.equal(env.requests.length, 2);
  await env.load(channelUrl, true);
  assert.equal(env.requests.length, 4);
  env.elapse(10 * 60_000);
  await env.load();
  assert.equal(env.requests.length, 6);
});

test('fallback retains channel order and caps results at ten videos', async () => {
  const cards = Array.from({ length: 15 }, (_, index) => modern(`video${String(index).padStart(6, '0')}`, 'x'.repeat(400)));
  const env = worker(url => url === feedUrl ? { ok: false, status: 404 }
    : { text: async () => page(pageData(cards)) });
  const result = await env.load();
  assert.equal(result.videos.length, 10);
  assert.equal(result.videos[0].id, 'video000000');
  assert.equal(result.videos[9].id, 'video000009');
  assert.equal(result.videos[0].title.length, 300);
});

test('an empty Videos tab is a valid empty channel', async () => {
  const env = worker(url => url === feedUrl ? { ok: false, status: 404 }
    : { text: async () => page(pageData()) });
  assert.equal((await env.load()).videos.length, 0);
});

test('consent pages, mismatched channels, missing Videos tabs and oversized pages remain errors', async () => {
  for (const html of ['<html>Consent required</html>', '<script>var ytInitialData = {bad};</script>',
    page(pageData([], { metadata: { externalId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' } })),
    page(pageData([modern('abcDEF12345')], { tabUrl: '/@Roblox/featured' })), 'x'.repeat(8_000_001)]) {
    const env = worker(url => url === feedUrl ? { ok: false, status: 404 } : { text: async () => html });
    await assert.rejects(env.load());
    assert.equal((await env.send()).error, 'YouTube videos unavailable');
  }
});

test('handle links still resolve and normalize to the permitted YouTube host', async () => {
  const env = worker(url => url === feedUrl ? { text: async () => feed() }
    : { text: async () => `<link rel="canonical" href="${channelUrl}">` });
  const result = await env.load('https://m.youtube.com/@Roblox');
  assert.equal(result.channelId, channelId);
  assert.deepEqual(env.requests.map(request => request.url), ['https://www.youtube.com/@Roblox', feedUrl]);
});

test('untrusted channel URLs and redirects cannot supply video data', async () => {
  const env = worker(() => ({ url: 'https://example.com/consent', text: async () => page(pageData()) }));
  for (const url of ['https://www.youtube.com.evil.example/@Roblox', 'http://www.youtube.com/@Roblox']) {
    await assert.rejects(env.load(url), /Invalid YouTube channel URL/);
  }
  assert.equal(env.requests.length, 0);
  await assert.rejects(env.load('https://www.youtube.com/@Roblox'), /Invalid YouTube redirect/);
});
