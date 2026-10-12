# Interaction delay investigation

Investigated on 2026-10-13 with all manifest content scripts and styles loaded in isolated Chrome. The stress fixture contains 500 game cards, nested controls, prices, and 51 friends. Timings below use Chrome's 4× CPU slowdown; they are fixture measurements, not a recording of the user's live browser.

## Confirmed causes

1. **Document-wide relational CSS.** The friends menu rules used `html[data-rc-ui-active]:has(#HomeContainer .friend-carousel-container)` as their ancestor. Opening or replacing a small body portal made Chrome reconsider page styles. With the other extension styles loaded, six replacements took about 1,300–1,600 ms of style recalculation. Replacing this root check with the cached `data-rc-home-friends` marker reduced the same work to about 6 ms. Removing other suspected rules first did not resolve that remaining cost; changing the friends ancestor did.
2. **Unrelated chat discovery.** `frosted-ui.js` treated every observed class/style change as a reason to discover the target's entire subtree. A hover or animation class on a large page container consequently scanned thousands of unrelated elements. These discovery tasks took roughly 130–200 ms each. Attribute changes now trigger discovery only at chat anchors or already identified chat panels. Added native subtrees still receive discovery.
3. **Unnecessary page controllers.** The account controller searched for stale account markers off its route, and the game controller scheduled its complete update batch for unrelated portals and clock changes. Account cleanup now exits when no tracked account UI exists. Game updates now follow their native page scope, route changes, and actual server mutations.

## Changes

- Cache friends-carousel presence and game-header structure during native mounts. Keep the title, carousel, and native controls in their original DOM trees.
- Mark header menus and standalone menu actions during discovery instead of using repeated descendant `:has()` checks. Simplify game readiness selectors while retaining private-card loading markers.
- Limit chat discovery and page-controller updates to relevant native content.
- Retain transparency, blur, translated UI, and native event handlers.

## Regression coverage

`tests/hover-performance-browser.test.cjs` loads the entire extension, exercises real pointer/click input, changes large container classes/styles, and replaces popups repeatedly. It checks that unrelated chat/account/game scans do not run, limits style recalculation for six replacements to 250 ms at 4× CPU slowdown, and verifies new prices, friends, and recommendations still update.

Additional existing browser checks cover friend menus, game layouts, private-server loading and controls, settings, themes, and locales. GPU blur/paint costs and interactions with other installed extensions can vary outside this isolated fixture.
