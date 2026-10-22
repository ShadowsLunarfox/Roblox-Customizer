const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { parse, metadata, fileFor, LOCALES } = require('../src/settings/update-announcement-core.js');
const source = fs.readFileSync(path.join(__dirname, 'fixtures/update-announcement.md'), 'utf8');

test('Each supported language has an independently packaged announcement with matching release metadata and sections', () => {
  const manifest = require('../manifest.json');
  const resources = manifest.web_accessible_resources.flatMap(entry => entry.resources);
  const englishSource = fs.readFileSync(path.join(__dirname, '..', fileFor('en')), 'utf8');
  const english = metadata(englishSource), reference = parse(englishSource);
  for (const locale of LOCALES) {
    const file = fileFor(locale);
    assert.ok(resources.includes(file), file+' is readable by content scripts');
    const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const release = metadata(text);
    assert.equal(release.id, english.id, file+' shares the release ID');
    if (release.enabled && reference) {
      const content = parse(text);
      assert.ok(content.title);
      assert.equal(content.blocks.filter(block => block.type === 'heading').length,
        reference.blocks.filter(block => block.type === 'heading').length, file+' translates every section');
      assert.deepEqual(content.blocks.filter(block => block.type === 'list').map(block => block.items.length),
        reference.blocks.filter(block => block.type === 'list').map(block => block.items.length), file+' translates every item');
    }
  }
  for (const locale of ['fr', '../other', null, undefined]) assert.equal(fileFor(locale), 'UPDATE.md');
});

test('Announcement Markdown preserves section order and numbered update lists', () => {
  const value = parse(source);
  assert.equal(value.id, '1.2.0');
  assert.equal(value.title, 'Update Changelog');
  assert.deepEqual(value.blocks.filter(block => block.type === 'heading').map(block => block.text),
    ['New Language Support', 'Changes and Bug Fixes', 'New Features']);
  assert.deepEqual(value.blocks.filter(block => block.type === 'list').map(block => block.items.length), [4, 4, 6]);
  assert.equal(parse('\uFEFF'+source.replaceAll('\n', '\r\n')).title, value.title);
  assert.deepEqual(parse('<!-- Editor author header -->\n\n<!-- Another comment -->\n'+source), value);
});

test('A disabled or incomplete announcement does not create a release or consume its ID', () => {
  for (const value of [null, '', source.replace('enabled: true', 'enabled: false'), source.replace('id: 1.2.0', 'id: '),
    source.replace('id: 1.2.0', 'id: invalid/id'), '# No metadata\nText', '---\nid: test\nenabled: true\n---\n# No body', 'x'.repeat(128*1024+1)]) {
    assert.equal(parse(value), null);
  }
});

test('Simple headings, paragraphs and either list style can be edited without interpreting HTML', () => {
  const value = parse('---\nid: custom-2026\nenabled: true\n---\n# 自定义公告\n\nFirst line\nsecond line\n\n## Details\n- <img src=x onerror=alert(1)>\n- New item\n\n1. Done');
  assert.equal(value.title, '自定义公告');
  assert.deepEqual(value.blocks, [
    { type: 'paragraph', text: 'First line second line' }, { type: 'heading', text: 'Details' },
    { type: 'list', ordered: false, items: ['<img src=x onerror=alert(1)>', 'New item'] },
    { type: 'list', ordered: true, items: ['Done'] }
  ]);
});
