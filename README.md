<p align="center">
  <img src="icons/icon-source.png" alt="Roblox Customizer logo" width="180">
</p>

# ✨ Roblox Customizer

> 🎨 Your Roblox, your style.

A browser extension for Chrome and Edge that adds custom backgrounds, frosted panels, and useful browsing tools to Roblox, with support for light and dark themes.

<p align="center">
  <kbd>Chrome & Edge</kbd> &nbsp; <kbd>Manifest V3</kbd> &nbsp; <kbd>Light & Dark Themes</kbd> &nbsp; <kbd>No Build Required</kbd>
</p>

[Features](#-features) · [Modified pages](#-pages--elements-modified) · [Installation](#-installation) · [Getting started](#-getting-started) · [Troubleshooting](#-troubleshooting) · [Project layout](#-project-layout)

---

## 🌟 Features

- **Animated backgrounds:** Use images, GIFs, or MP4 videos from a local file. Choose whether the background fills the screen or shows the entire image, and adjust dimming.
- **Frosted interface:** Tune glass blur and opacity for menus and page panels, with styling that follows Roblox's light or dark theme. **Disable transparency** makes panels opaque; **Disable blur** removes their backdrop filters. The two buttons work independently and keep your slider values for when you turn effects back on. Interface features and layout improvements work with Roblox's default background; a custom wallpaper is optional.
- **Experimental custom colors (opt-in):** Enable **Custom colors → Enable custom colors** to choose text, page/panel background, and accent colors. Changes save automatically and work with or without a wallpaper. Some Roblox elements may keep their own colors. Turn the switch off to restore the normal theme while keeping your palette, or use **Reset and disable** to clear it.
- **Theme-aware controls:** Text, icons, inputs, menus, and extension settings switch with Roblox's theme. Light panels retain a minimum backing opacity to keep text readable over dark wallpapers.
- **Personalized Home:** Customize greetings and the clock, show up to three friend rows, and pin games. Hide Favorites, Standout Games, or the upper and lower recommendations separately; hide and restore individual recommended games.
- **Local playtime history (enabled by default):** Track played experiences and estimated total time for the signed-in account, with a Home summary, searchable history, JSON export, and account-specific clear controls. Pause tracking in settings at any time; saved opt-outs are preserved. Records stay in this browser on your computer.
- **Game browsing tools:** Private servers across games use a custom card layout built from Roblox's server data before rendering, with native Join, Create, Configure, subscription, and refresh actions. Older private-server layouts retain the adapter fallback. View badge and server details, and search public servers by country, latency, ping, and player count, or sort by player count.
- **Game data & social feeds:** Explore gamepasses, badges, and places using Roblox and Rolimons data. Enable X and YouTube feeds separately for Game, Community, and Profile pages in **Social feed panels** settings.
- **Robux currency estimates:** Display approximate purchase equivalents in your chosen currency across Roblox and Creator Hub. Actual checkout prices may vary.
- **Page recovery:** Resynchronize interface features after tab suspension or restoration, repair removed background layers, and release stalled requests so loading controls remain usable.
- **Chinese page compatibility:** Native section and control detection supports Simplified and Traditional Chinese, including live language changes, private servers, avatar categories, chat, and compact Robux amounts.
- **Chinese extension interface:** Settings, Home controls, server filters, profile details, previews, and feed controls are available in English, 简体中文, and 繁體中文. Follow Roblox's language automatically or choose the extension language yourself.

## 🪄 Pages & elements modified

| Page or area | Route examples | What changes |
| --- | --- | --- |
| Home | `/home` | Greeting, clock, friends and their hover menus, pinned games, local playtime history, recommendation controls, and aligned game cards. |
| Game details | `/games/{id}` | Media and play controls, this game's local playtime and last-played time, Store product cards and purchase controls, information panels, badges, server cards and filters, and social feeds. |
| Private-server configuration | `/private-server/configure/{id}` | Configuration panels, server name and link fields, access controls, and native save actions. |
| Game passes & Badges | `/game-pass/{id}`, `/badges/{id}` | Responsive artwork and detail panels, native purchase controls, and related experience links. |
| Charts | `/charts` | Game cards, browsing controls, and filter panels. |
| Game & user search | `/discover/?keyword=…`, `/search/users?keyword=…` | Frosted search headers, game and player result cards, search fields, and native action/loading controls. |
| Marketplace | `/catalog`, `/catalog/{id}`, `/bundles/{id}` | Browsing cards, item and bundle previews, details, and resale panels. |
| Profiles & Avatar | `/users/{id}/profile`, `/my/avatar` | Full profile biographies and available More details (social links, previous names, join date) shown inline, profile sections, avatar previews, and editor panels. |
| Friends & Inventory | `/users/{id}/friends`, `/users/{id}/inventory` | Tabs, search controls, and list/card styling. |
| Account settings | `/my/account` | Settings navigation; Account Info, Robux, Browser preferences, Parental controls, Notifications, Privacy, and Security panels; device sessions, edit controls, and form fields. |
| Account & activity | `/plus`, `/my/messages`, `/trades`, `/transactions` | Membership, messaging, trading, and transaction panels. |
| Communities | `/search/communities`, `/communities/{id}`, `/communities/create` | Search results, community pages, and creation forms; legacy group routes are also supported. |
| Robux | `/upgrades/robux` | Purchase options and pricing panels. |
| Report Abuse | `/report-abuse` | Report form layout and styling. |
| Shared interface | Across the Roblox website | Backgrounds, navigation, dropdown menus, and chat panels. |

`{id}` represents a Roblox game, item, user, or community ID. Creator Hub receives Robux currency estimates; the full visual customization applies to the Roblox website.

## 🚀 Installation

1. Download or clone this repository. Extract the ZIP if you downloaded one.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the folder containing `manifest.json`.
5. Open or refresh Roblox, then click the extension's browser toolbar icon, or select **Roblox Customizer** from Roblox's settings gear menu.

No build step is required. Keep the unpacked extension folder in a permanent location so the browser can continue loading it.

## 🎛️ Getting started

Changes save automatically. Sliders and colors update the page when released or after a short pause.

Use **Settings → Backup and restore → Export backup** to download one JSON file containing appearance, language, Home and social settings, currency preference, playtime histories for every recorded Roblox account, pinned games and folders, and hidden recommendations. A saved background file (including GIFs and MP4s) or URL is included when present. **Import backup** validates the file and shows its account IDs and contents before you choose **Import and replace**. Import replaces those saved extension settings, pins, folders, and histories on this browser; it does not merge them. Export your current data first if you may need it later. Imported playtime stays attached to its original Roblox account IDs. If you sign in to a different account, that history will not become its Home playtime after the next account check, though the records remain stored. Roblox account data, Robux, purchases, game progress, live playtime samples, and temporary exchange-rate or social-feed caches cannot be imported. A restored tracker starts a fresh live sample while keeping recorded durations. Backups stay on your computer; files must be Roblox Customizer JSON backups no larger than 256 MB.

- **Choose your language:** Open the Customizer settings and use **Extension language / 扩展语言 / 擴充功能語言**. Choose **Automatic** to follow Roblox (or your browser when Roblox has no language setting), or select English, 简体中文, or 繁體中文. This setting changes extension controls; game titles, descriptions, and posts keep their original content.
- **Language compatibility and fallback:** If Roblox uses an unsupported language, Customizer preserves Roblox's native page layout and styling, with its settings entry still available in Roblox's settings gear menu. Only image backgrounds (including GIFs) and custom colors remain available. Frosted effects, page enhancements, Home tools, server tools, feeds, currency conversion, video backgrounds, and background playtime tracking are disabled; saved preferences and history are kept. Open **Roblox Customizer** from the settings gear menu or the extension's browser toolbar icon to access the remaining appearance controls. A centered pop-up explains fallback on your first Customizer opening or after switching to an unsupported language, and remembers it across reloads. **Continue with fallback** dismisses the pop-up without enabling disabled features. Switching Roblox to English, Simplified Chinese, or Traditional Chinese restores all saved features. Crossing between supported and unsupported languages reloads the page once to clear or restore native UI integrations; pending appearance changes save first. Choosing a supported extension language alone does not leave fallback mode.
- **Set the mood:** Select a local background, then adjust image fit, dimming, blur, and opacity. GIFs and MP4 videos remain animated.
- **Make Home yours:** Set morning, afternoon, and evening greetings; choose 12- or 24-hour time, seconds, and date visibility; adjust friend rows and section switches.
- **Keep favorite games close:** Use **Pin Game** on a game page to pin public or non-public experiences to Home. The button is also available on private game pages without Favorite. There is no extension-imposed pin limit; games are saved locally with join and unpin controls. Joining still follows Roblox's access permissions.
- **Organize pinned games:** Click **New folder** in Home's **Pinned Games** section to create categories. On a game page, click **Pin Game** to open the folder picker, choose a folder (or **Uncategorized**), then confirm with **Pin Game**. **Cancel** or Escape closes the picker without saving. Changing the folder of an already pinned game moves it immediately. Filter Home pins by **All games**, **Uncategorized**, or any folder; rename or delete the selected folder. Deleting a folder keeps its games in **Uncategorized**. Existing pins remain intact, and **Show more games** loads larger collections in groups of 24. Folder panels and controls follow your **Frost blur** and **Glass opacity** settings in both themes.
- **Curate recommendations:** Click **Hide** on a recommended game. Restore it through **Hidden recommendations** in the plugin settings.
- **Find a server:** Open a game's Servers tab, set your filters, and click **Search**. Use **Previous/Next** to browse results or **Reset** to clear the filters.
- **Choose a currency:** Find a currency by name or code in the converter settings. Use **Refresh rates** to update available exchange rates.
- **Track your playtime:** **Playtime tracking** is enabled by default unless you have previously switched it off. Pause or resume it in Customizer settings. **Your most played** in the Home greeting and clock panel shows up to five game cards at once, ranked by accumulated playtime, with the icon, name, and time below. Use the left/right arrows, swipe, or drag to browse more games; smaller screens show fewer cards. **View history**, or **View playtime history** in settings, opens search, sorting, JSON export, and account-specific clear controls. Tracking works with the default background too.

### ⏱️ Local playtime history

Each game page also shows **Your playtime** across the bottom of the game header, with the recorded total for that experience and the last-played date and time. The title sits above the cover and play controls, and the layout stacks on smaller screens. The panel updates automatically, supports English and both Chinese interfaces, and keeps saved records visible when tracking is paused. Games without local records are clearly marked; you can resume paused tracking directly from the panel.

The tracker checks the signed-in account's Roblox presence about every 30 seconds while your browser is running. Durations include seconds, so short recorded sessions no longer all appear as `0m`. Only time between confirmed **in-game** samples counts; browsing game pages and using Studio do not. A brief failed or delayed check can be recovered when the same account and experience are confirmed again within two minutes. Subplaces within an experience share a total. Each Roblox account has separate totals, session counts, and last-played dates, saved in the extension's local browser storage. No playtime records are uploaded or synced to another computer.

Times are estimates, not exact Roblox process measurements. Short sessions can be missed, hidden or unavailable presence cannot be tracked, and long gaps after sleep or connection failures are skipped. Chrome or Edge must remain running; closed-browser time and sessions before enabling the feature cannot be recovered. Roblox presence can also reflect play on another device signed into the same account.

Pausing tracking keeps saved history. **Clear this account** deletes that account's local history after confirmation; other accounts and customization settings remain. Export records before uninstalling if you want to keep them, because uninstalling removes extension storage. The `alarms` permission schedules checks, and `presence.roblox.com` access reads the signed-in player's game status; existing Roblox game and thumbnail access supplies titles and artwork.

## 🔄 Updating & removing

To update, replace the extension files with the new version, click the extension's reload button on the browser's extensions page, and refresh Roblox.

To restore the default background, select **Roblox default background** in the plugin settings. **Reset All** permanently clears all extension settings, uploaded backgrounds, pinned games and folders, and playtime history for every account in this browser after a confirmation. Export a backup first if you may want the data later. To disable or uninstall the extension, use the browser's extensions page.

## 🛠️ Troubleshooting

| Issue | Try this |
| --- | --- |
| Extension or settings entry is missing | Confirm it is enabled, reload it, refresh Roblox, and reopen the settings gear menu. |
| Background does not appear | Choose a supported local image, GIF, or MP4 file. |
| Server details, feeds, or rates are unavailable | Retry after a moment; these features depend on Roblox and external data services. |
| Layout looks unusual | Refresh Roblox and temporarily disable other Roblox extensions to check for conflicting styles. |

Preferences, pinned games, and playtime history are stored locally in your browser. Local background files are stored locally for reuse. Previously saved URL backgrounds remain supported until you replace or remove them.

## 🗂️ Project layout

```text
Roblox Customizer/
├── manifest.json          Extension entry point and permissions
├── icons/                 Extension icons and logo
├── _locales/              English, Simplified Chinese, and Traditional Chinese extension metadata
├── src/
│   ├── background/        Service worker and background feature handlers
│   ├── shared/            Startup, page bridge, and shared interface styles
│   ├── settings/          Customizer settings and background controls
│   ├── home/              Friends layout and pinned games
│   ├── currency/          Robux conversion logic and display
│   ├── playtime/          Local playtime records, Home summary, and history UI
│   └── pages/
│       ├── account/       Settings, messages, trades, and transactions
│       ├── avatar/        Avatar editor
│       ├── catalog/       Marketplace and item previews
│       ├── community/     Community pages and directory
│       ├── discovery/     Charts
│       ├── games/         Game details, badges, servers, and feeds
│       ├── profile/       User profiles
│       ├── reporting/     Report Abuse form
│       └── robux/         Robux purchase page
├── tests/                 Unit tests, browser fixtures, and package checks
├── README.md
└── LICENSE
```

Load the **repository root** containing `manifest.json` when installing the extension. The checked-in service worker bundle runs directly without a build step. After editing background worker sources, run `node scripts/build-service-worker.cjs` and include the updated bundle.

## 💬 Feedback

When reporting a problem, include the Roblox page URL, browser version, steps to reproduce it, and a screenshot of the affected area. This helps identify the page and layout involved.

---

📄 Licensed under [GNU GPL v3](LICENSE).
