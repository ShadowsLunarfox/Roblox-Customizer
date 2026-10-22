<a id="top"></a>

<p align="center">
  <img src="icons/icon-source.png" alt="Roblox Customizer logo" width="96" height="96">
</p>

<h1 align="center">✨ Roblox Customizer</h1>

<p align="center">
  <img src="icons/readme-banner.svg" alt="Personalize Roblox with custom backgrounds, frosted panels, and tools for Home, friends, avatars, games, and servers." width="100%">
</p>

<p align="center">
  Personalize Roblox with custom backgrounds, frosted panels, and tools for Home, friends, avatars, games, and servers.<br>
  For Chrome and Edge, with light and dark theme support.
</p>

<p align="center">
  🧩 Chrome · Edge &nbsp; 🌓 Light &amp; dark &nbsp; 💾 Stored locally &nbsp; 🌍 7 languages
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/roblox-customizer/docflecekjjcekdcapolmneiomimiboi">
    <img src="icons/chrome-web-store-button.svg" alt="Install from the Chrome Web Store" width="252" height="60">
  </a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.zh-TW.md">繁體中文</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.ja.md">日本語</a> · <a href="README.th.md">ไทย</a> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="#languages">Languages</a> ·
  <a href="#data-and-backups">Data and backups</a> ·
  <a href="#troubleshooting-and-feedback">Help</a>
</p>

<details>
<summary><strong>🖼️ Preview</strong></summary>

<p align="center">
  <img src="icons/marquee-promo-1400x560.jpg" alt="Roblox Customizer promotional preview" width="100%">
</p>

</details>

---

<a id="installation"></a>

## 📦 Installation

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/roblox-customizer/docflecekjjcekdcapolmneiomimiboi), then refresh your open Roblox pages.

<details>
<summary><strong>Load the repository manually in Chrome or Edge</strong></summary>

1. Download or clone this repository. Extract the ZIP if needed.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the folder containing `manifest.json`.
4. Refresh Roblox.

The repository includes the files needed to run the extension, so installation requires no build step. Keep the extension folder in a permanent location.

For manual updates, replace the files, select **Reload** on the extension's management page, and refresh Roblox again.

</details>

On your first visit, the extension asks you to accept its Terms of Service. Acceptance is remembered in this browser, including after **Reset All**.

A first-use guide automatically appears on your first Roblox visit, after language and extension notices. It shows both settings shortcuts: **Roblox gear → Roblox Customizer**, or the **Roblox Customizer browser toolbar icon** while on Roblox, and includes an **Open settings** button. The update announcement follows the guide; neither requires opening settings first. Dismissals are remembered separately, and a new announcement ID only shows the new announcement again.

<a id="quick-start"></a>

## 🚀 Quick start

Open Roblox, then click the extension's toolbar icon or **Roblox Customizer** in Roblox's settings gear menu. Settings save automatically.

| Settings category | What you can manage |
| --- | --- |
| **Appearance** | Background files, dimming, glass blur and opacity, transparency, custom colors, and website fonts. |
| **Home page** | The Home banner, greetings, clock, friend rows, recommendations, playtime, and recent-server recording. |
| **Pinned Games** | Enable or disable pinning, and view saved games and folders. |
| **Social** | Enable X and YouTube feeds separately on Game, Community, and Profile pages. |
| **Currency** | Robux currency estimates and your preferred currency. |
| **Language & data** | Extension language, backups, restore, and reset. |

To pin a game, select **Pin Game** on its game page and choose a folder. To pin a friend, use **Pin friend** on their profile or **Manage pinned friends** on Home or your Friends page.

In **Home page → Home friends**, toggle **Show Roblox friends list** and **Show pinned friends** independently. Hidden sections keep their saved pins, and your choices survive refreshes.

Under **Home page → Home banner**, turn off **Show banner background and border** to remove the outer glass frame while keeping the avatar, greeting, clock, and playtime card visible. This choice is saved automatically.

<a id="features"></a>

## ✨ Features

### 🎨 Appearance and Home

- Use local images, animated GIFs, or MP4 videos as your background. Adjust fit and dimming.
- Set glass blur and opacity, or disable blur and transparency. Experimental colors let you choose text, background, and accent colors.
- Load a local TTF, OTF, WOFF, or WOFF2 font, up to 32 MB. Preview it, switch it off, or restore the default; missing characters use fallback fonts.
- Customize the Home greeting and clock. Show or hide the banner, avatar, names, greeting, time, date, and most-played card separately.
- Display up to three rows of native friends, keep pinned friends together on Home, and organize pinned games into folders.
- Control Favorites, Standout Games, and recommendation sections, or hide individual recommended games.

### 👥 Friends and followers

The friend tools extend Roblox's original toolbar and cards, preserving native avatars, menus, chat, Join actions, and pagination.

- Filter friends by online, in-game, offline, Studio, or pinned status. Sort by display name, username, online first, or pinned first.
- Select users with checkboxes on the original cards. Selection survives pagination; select the current page or all filtered results.
- Unfriend or unfollow selected users, or accept or ignore incoming friend requests in batches. Review the selected people before submitting; progress and failures remain visible, and processing can stop after the current action.
- Pin or unpin a friend from their profile, the native Friends list, or the pinned-friend manager. Pins are saved separately for each Roblox account in this browser.
- Show the full follower total in the original Followers heading when Roblox's count API is available, instead of the capped `500+` label.

Removing friends changes your Roblox relationships and cannot be undone by the extension. Pinning only changes your local Home list.

### 🎮 Games and servers

- View badge and gamepass details, private-server cards, and a **Game notes** panel on game pages.
- Search public servers using player ranges, not-full status, country, city, and ping. Use connection sorting, shuffle, random join, and preferred-city fallback.
- Choose regions on an interactive globe by dragging, zooming, clicking a country, or searching its name.
- See server performance, Roblox-reported language matches, and running place versions when that data is available. Language matches follow Roblox's website language and do not confirm what players actually speak.
- Rejoin recent servers, check availability, or clear a game's history. Subplace visits are grouped with their game; recording is controlled separately from playtime in **Home page → Recent servers**.

Server filters reset on refresh or navigation. Locations and counts reflect loaded data; age sorting requires reliable start times. Recent-server checks scan up to 500 public servers, so incomplete results remain unknown. Full, closed, or restricted servers may reject a join.

### 🧍 Avatars and animation previews

- Use Roblox's native 3D avatar preview alongside a separate 2D preview, with responsive category and inventory layouts.
- Expand **Avatar tools** on **My avatar** to edit six RGB body colors or adjust supported equipped accessories' position, rotation, and scale within Roblox's limits.
- Preview changes locally, then select **Apply colors** or **Apply accessory** to update your signed-in avatar. Refresh the page to update Roblox's native preview.
- On animation bundle, individual animation, and emote pages, select **Preview on my avatar** to play the motion on your current avatar with its accessories. Native action selection and playback controls stay synchronized.

Animation previews use an R15 rig, run locally, and pause off-screen or in background tabs. Previewing an animation does not equip items or save an outfit.

### 🧰 Item details and resource explorer

- Extend native catalog, bundle, library, and Creator Store asset details with IDs, available dates, and reported sales or quantity fields. Copy IDs without replacing existing purchase or try-on controls.
- Load accessible resources on demand to browse an object tree, inspect read-only properties, follow references, search, copy values, and export files.
- Read XML, JSON, and RBXM models, including LZ4 and Zstandard compression, and preview supported images, audio, and video.

Access follows Roblox's permissions. Resource files are inspected without execution. Loading is limited to 32 MB, 5,000 model instances, and 128 MB of expanded binary chunks. Text previews display up to 131,072 characters; copying and text export retain the available full value.

### ⏱️ Playtime, notes, feeds, and currency

- **Playtime:** Account-specific estimates, Home summaries, searchable history, and JSON export. Tracking can be paused in settings. Estimates use Roblox presence while the browser runs; past sessions and time while the browser is closed cannot be recovered.
- **Game notes:** Private, automatically saved notes of up to 5,000 characters per game page. Notes are shared across your Roblox accounts in this browser and are not posted to Roblox.
- **Social feeds:** X and YouTube panels on supported Game, Community, and Profile pages, with separate switches for each page type.
- **Robux estimates:** Approximate currency equivalents on Roblox and Creator Hub. Actual checkout prices may differ.

<a id="languages"></a>

## 🌐 Languages

Full page enhancements support **English, Simplified Chinese, Traditional Chinese, Indonesian, Japanese, Thai, and Korean**.

Choose the extension's interface language in **Language & data → Extension language**, or select **Automatic** to follow Roblox. Supported localized paths, including `/ja/`, `/th/`, and `/ko/`, work too.

If Roblox uses another language, the extension enters fallback mode: image/GIF backgrounds, custom colors, and fonts remain available while the native layout is preserved. Switch **Roblox's website language** to a supported language to restore full features; changing only the extension's language does not leave fallback mode.

<a id="data-and-backups"></a>

## 💾 Data and backups

Your settings and saved content stay in this browser. Features that read Roblox data, feeds, exchange rates, or server locations contact the relevant services as described in the [Privacy Policy](PRIVACY.md).

| Data | Scope | Full settings backup |
| --- | --- | --- |
| Settings, background files, and font files | This browser | Included |
| Pinned games and folders | Shared across Roblox accounts in this browser | Included |
| Pinned friends | Separate for each Roblox account | Included |
| Playtime history | Separate for each Roblox account | Saved history included |
| Game notes | Shared across Roblox accounts in this browser | Included |
| Recent servers | Separate for each Roblox account | Excluded |
| Active server filters | Current page only | Excluded |

Recent-server history retains up to six servers per game for each of the ten most recently used accounts. Hidden server IDs cannot be recovered.

Use **Language & data → Backup and restore** to export or import a full backup. **Import replaces existing extension data.** Export before resetting or moving to another browser.

**Reset All** removes saved extension data, including notes and recent-server history, and clears supported website caches. Terms acceptance is retained. To remove your saved data before uninstalling, run Reset All while the extension is still installed.

Read the [Privacy Policy](PRIVACY.md) and [Terms of Service](TERMS.md) for details. The extension's policy links open the published documents on GitHub in the selected interface language.

<a id="troubleshooting-and-feedback"></a>

## 🛠️ Troubleshooting and feedback

- **An update has not appeared:** For a manual installation, reload the extension from `chrome://extensions` or `edge://extensions`, then refresh Roblox. Refreshing only the webpage may leave manifest or background changes unloaded.
- **Some enhancements are missing:** Check Roblox's website language against the supported list above. API-dependent features can also be temporarily unavailable.
- **Items overlap or the page behaves unexpectedly:** Other extensions may modify the same elements. The compatibility notice can identify some known Roblox extensions; try adjusting overlapping features when diagnosing a problem. The notice does not disable other extensions.
- **Data fails to load:** Retry after Roblox or the external service becomes available. Unavailable server fields and resource permissions cannot be supplied by the extension.

For support, email [lunar@lunarfox.my](mailto:lunar@lunarfox.my). Include the affected page URL, browser and version, Roblox language, reproduction steps, and a screenshot.

<a id="development"></a>

## 🧑‍💻 Development

Installation uses the checked-in files. Development and tests use Node.js.

**Editing update announcements:** English is in [UPDATE.md](UPDATE.md); the other languages have separate `UPDATE.zh-CN.md`, `UPDATE.zh-TW.md`, `UPDATE.id.md`, `UPDATE.ja.md`, `UPDATE.th.md`, and `UPDATE.ko.md` files. Edit each file directly. The dialog reads the current extension language and updates when it changes; a missing or invalid translation falls back to English. Keep the same `id` across translations so switching languages does not repeat a read announcement. Keep that ID for wording corrections, or update all translations to a new ID (for example, `1.2.1`) for a new announcement. `enabled: false` disables that language's announcement without falling back to English. No build is needed; reload the extension and refresh Roblox. Users can reopen the announcement from **Update Changelog** at the bottom of settings.

Rebuild the relevant generated files after editing their sources:

| Changed source | Command |
| --- | --- |
| Background worker modules or their bundled dependencies | `node scripts/build-service-worker.cjs` |
| Page bridge, routes, compatibility, server-card view, or native friend helpers | `node scripts/build-page-bridge.cjs` |
| Policy text in `src/legal/content.json` | `node scripts/build-legal-docs.cjs` |

Check the bundles and run focused package, label, and backup checks:

```sh
node scripts/build-service-worker.cjs --check
node scripts/build-page-bridge.cjs --check
node --test tests/extension-package.test.cjs tests/native-labels.test.cjs tests/backup.test.cjs
```

Browser tests use isolated profiles and local fixtures. Set `CHROME_BIN` to a Chrome or Chromium executable to run them. The real extension-injection test also requires `CHROME_EXTENSION_TESTS=1`, Chrome for Testing or Chromium with unpacked-extension support, and `SERVER_VIEW_REACT_BUNDLE` pointing to a local copy of Roblox's React bundle:

```sh
node --test tests/extension-server-metadata-browser.test.cjs
```

The resource explorer's property and enum reference data can be refreshed with `node scripts/build-model-schema.cjs`.

<a id="license-and-credits"></a>

## 📜 License and credits

Licensed under [GNU GPL v3](LICENSE). Bundled third-party components retain their own licenses and notices, including [fzstd](src/assets/vendor/fzstd.LICENSE) and the [animation preview renderer and dependencies](src/assets/animation-preview/vendor/README.md).

---

<p align="center">
  <a href="#top">⬆️ Back to top</a>
</p>
