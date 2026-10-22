(function (root) {
  'use strict';
  const LOCALES = Object.freeze(['en', 'zh-CN', 'zh-TW', 'id', 'ja', 'th', 'ko']);
  const fileFor = locale => LOCALES.includes(locale) && locale !== 'en' ? `UPDATE.${locale}.md` : 'UPDATE.md';
  // A deliberately small Markdown subset keeps each announcement editable without a build step.
  function metadata(source) {
    if (typeof source !== 'string' || source.length > 128 * 1024) return null;
    let normalized = source.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n').trimStart();
    // Editor-generated author headers are Markdown comments, not announcement content.
    while (normalized.startsWith('<!--')) {
      const end = normalized.indexOf('-->');
      if (end < 0) return null;
      normalized = normalized.slice(end + 3).trimStart();
    }
    const header = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!header) return null;
    const id = header[1].match(/^id:\s*([a-zA-Z0-9][a-zA-Z0-9._-]{0,79})\s*$/m)?.[1];
    const enabled = header[1].match(/^enabled:\s*(true|false)\s*$/m)?.[1];
    return id && enabled ? { id, enabled: enabled === 'true', body: normalized.slice(header[0].length) } : null;
  }
  function parse(source) {
    const data = metadata(source);
    if (!data?.enabled) return null;
    let title = '', paragraph = [], list = null;
    const blocks = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
      if (list) blocks.push(list);
      list = null;
    };
    for (const line of data.body.split('\n')) {
      const text = line.trim();
      if (!text) { flush(); continue; }
      const heading = text.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flush();
        if (!title && heading[1] === '#') title = heading[2];
        else blocks.push({ type: 'heading', text: heading[2] });
        continue;
      }
      const item = text.match(/^(?:(\d+)\.\s+|[-*]\s+)(.+)$/);
      if (item) {
        const ordered = !!item[1];
        if (paragraph.length || list && list.ordered !== ordered) flush();
        list ||= { type: 'list', ordered, items: [] };
        list.items.push(item[2]);
      } else {
        if (list) flush();
        paragraph.push(text);
      }
    }
    flush();
    return title && blocks.length ? { id: data.id, title, blocks } : null;
  }
  const api = Object.freeze({ parse, metadata, fileFor, LOCALES });
  root.RobloxCustomizerUpdateContent = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
