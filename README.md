<p align="center">
  <img src="icons/icon-source.png" alt="Roblox Customizer logo" width="112" height="112">
</p>

<h1 align="center">Roblox Customizer</h1>

<p align="center">
  <img src="icons/readme-banner.svg" alt="Your Roblox, your style. Backgrounds, glass, and colors." width="100%">
</p>

<p align="center">
  Custom backgrounds, frosted panels, and useful tools across Roblox.<br>
  Make your Home feel like home, in light or dark mode.
</p>

<p align="center">
  <img src="icons/readme-badges.svg" alt="Chrome and Edge · Light and dark themes · No build step" width="470">
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/roblox-customizer/docflecekjjcekdcapolmneiomimiboi">
    <img src="icons/chrome-web-store-button.svg" alt="Install from the Chrome Web Store" width="252" height="60">
  </a>
</p>

<p align="center">
  <a href="#-features">Features</a> ·
  <a href="#-installation">Installation</a> ·
  <a href="#-quick-start">Quick start</a> ·
  English / <a href="README.zh-CN.md">简体中文</a>
</p>

## 🖼️ Preview

<p align="center">
  <img src="icons/marquee-promo-1400x560.jpg" alt="Roblox Customizer promotional banner" width="100%">
</p>

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h3>🖼️ Backgrounds</h3>
      Local images, GIFs, and MP4 videos, with image fit and dimming controls.
    </td>
    <td width="50%">
      <h3>🎨 Appearance</h3>
      Adjustable glass blur and opacity, plus experimental text, background, and accent colors.
    </td>
  </tr>
  <tr>
    <td>
      <h3>🏠 Personalized Home</h3>
      Greetings, a clock, up to three friend rows, pinned games and folders, and recommendation controls.
    </td>
    <td>
      <h3>⏱️ Local playtime</h3>
      Account-specific estimates, Home summaries, searchable history, and JSON export. Pause tracking in settings.
    </td>
  </tr>
  <tr>
    <td>
      <h3>🎮 Game tools</h3>
      Badge and gamepass details, private-server cards, and public-server filters for country, latency, ping, and player count.
    </td>
    <td>
      <h3>💬 Social feeds</h3>
      Enable X and YouTube separately on Game, Community, and Profile pages.
    </td>
  </tr>
</table>

**💱 Robux estimates:** Approximate currency equivalents on Roblox and Creator Hub; checkout prices may differ.

**↩️ Recent servers:** Each game's Servers tab shows its own recent-server list, including visits to that game's subplaces. Rejoin, check availability, or clear just that game's list. Each of the 10 most recently used accounts retains up to 6 servers per game; a new entry replaces that game's oldest. Settings show all lists grouped by game under **Home page → Recent servers**, with recording controlled separately from playtime.

## 📦 Installation

[![Install from the Chrome Web Store](icons/chrome-web-store-button.svg)](https://chromewebstore.google.com/detail/roblox-customizer/docflecekjjcekdcapolmneiomimiboi)

<details>
<summary><strong>🛠️ Install manually in Chrome or Edge</strong></summary>

To load the extension from this repository:

1. Download or clone this repository and extract it if needed.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Refresh Roblox. Open settings from the extension's toolbar icon or **Roblox Customizer** in Roblox's settings gear menu.

No build step is needed to install. Keep the extension folder in a permanent location.

</details>

> [!NOTE]
> The first time you visit Roblox after installing, a Terms of Service prompt appears automatically. Acceptance is remembered in this browser, including after **Reset All**.

## 🚀 Quick start

- Choose a background and adjust its fit, dimming, blur, and opacity in **Appearance**. Changes save automatically.
- Click **Pin Game** on a game page, choose a folder, and confirm. Manage folders from **Pinned Games** on Home.
- Open a game's **Servers** tab, set your filters, and click **Search**.
- Use **Backup and restore** to export your settings, backgrounds, pins, and playtime. Import replaces existing extension data.

## 🌐 Language support

Full features require Roblox's language to be **English, Simplified Chinese, Traditional Chinese, or Indonesian**. Other languages use fallback mode: only image/GIF backgrounds and custom colors remain available, while Roblox's native layout is preserved.

Switch Roblox's language to restore all features. Changing only the extension's interface language does not leave fallback mode.

## 💾 Data and limitations

Preferences, backgrounds, pinned games, and playtime history are stored locally in your browser. Playtime is estimated from Roblox presence while the browser runs; past sessions and time while the browser is closed cannot be recovered.

Recent servers are recorded from confirmed Roblox presence while the browser runs; hidden server IDs cannot be recovered. Rejoining opens the Roblox app, and full, closed, or restricted servers may reject the join. Availability checks scan up to 500 public servers; an incomplete scan remains unknown. Recent-server history is excluded from full backups. Reset All removes saved server history.

Server data, feeds, and currency rates depend on Roblox and external services. Retry unavailable data later. Export a backup and use **Reset All** before uninstalling to remove saved backgrounds and site caches as well.

Read the published [Privacy Policy](https://github.com/ShadowsLunarfox/Roblox-Customizer/blob/main/PRIVACY.md) and [Terms of Service](https://github.com/ShadowsLunarfox/Roblox-Customizer/blob/main/TERMS.md) on GitHub. Settings and the first-visit prompt open the version matching the extension's language. Contact [lunar@lunarfox.my](mailto:lunar@lunarfox.my) for support or privacy questions.

## 💬 Updates and feedback

Replace the extension files, reload the extension, and refresh Roblox. For problems, include the page URL, browser version, reproduction steps, and a screenshot.

<details>
<summary><strong>🔧 Working on the extension?</strong></summary>

After editing background worker sources, rebuild the checked-in bundle with `node scripts/build-service-worker.cjs`.
After editing the page bridge, route helpers, compatibility guard or server-card view, run `node scripts/build-page-bridge.cjs`. The MAIN-world entry includes its own dependencies because Chrome de-duplicates content-script files shared across execution worlds.

The real extension injection regression is `node --test tests/extension-server-metadata-browser.test.cjs`. Set `CHROME_EXTENSION_TESTS=1`, `CHROME_BIN` to Chrome for Testing or Chromium, and `SERVER_VIEW_REACT_BUNDLE` to a local copy of Roblox's React bundle. The test uses a fresh profile, the actual manifest and local network fixtures.

</details>

The extension links to the policy Markdown files on GitHub's `main` branch. Published policy updates appear there without requiring an extension update.

Licensed under [GNU GPL v3](LICENSE).

<p align="center">
  <a href="#roblox-customizer">↑ Back to top</a>
</p>
