/* Compare supported localized Roblox routes without changing the browser URL. */
(function (root) {
  'use strict';
  function pathname(value = root.location?.pathname || '/') {
    return String(value).replace(/^\/(?:en|zh|id)(?:[-_][a-z0-9]+)*(?=\/|$)/i, '') || '/';
  }
  const routes = Object.freeze({ pathname });
  root.RobloxCustomizerRoutes = routes;
  if (typeof module === 'object' && module.exports) module.exports = routes;
})(globalThis);
