const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pathname } = require('../src/shared/routes.js');

test('supported locale prefixes preserve the complete Roblox route and IDs', () => {
  for (const prefix of ['', '/id', '/id-id', '/ID_ID', '/en-us', '/zh-cn', '/zh-Hant-TW']) {
    for (const route of ['/home', '/games/123/Test', '/users/456/profile', '/my/avatar', '/my/account', '/private-server/configure/789']) {
      assert.equal(pathname(prefix + route), route, prefix + route);
    }
  }
  assert.equal(pathname('/id'), '/');
  assert.equal(pathname('/id/'), '/');
  for (const route of ['/identity/home', '/games/123/id/home', '/fr/home', '/id/id/home', '/foo/id/home']) {
    assert.notEqual(pathname(route), '/home', route);
  }
});
