<p align="center">
  <img src="icons/icon-source.png" alt="Roblox Customizer logo" width="160" height="160">
</p>

<h1 align="center">Roblox Customizer</h1>

<h2 align="center">Your Roblox, your style.</h2>

A Chrome and Edge extension for custom backgrounds, frosted panels, and useful tools across Roblox. Supports light and dark themes.

English · [简体中文](README.zh-CN.md)

## Preview

<p align="center">
  <img src="icons/marquee-promo-1400x560.jpg" alt="Roblox Customizer promotional banner" width="100%">
</p>

<p align="center">
  <img src="icons/small-promo-440x280.jpg" alt="Roblox Customizer promotional tile" width="440">
</p>

## Features

- **Backgrounds:** Local images, GIFs, and MP4 videos, with image fit and dimming controls.
- **Appearance:** Adjustable glass blur and opacity, plus experimental text, background, and accent colors.
- **Personalized Home:** Greetings, a clock, up to three friend rows, pinned games and folders, and recommendation controls.
- **Local playtime:** Account-specific estimates, Home summaries, searchable history, and JSON export. Tracking can be paused in settings.
- **Game tools:** Badge and gamepass details, private-server cards, and public-server filters for country, latency, ping, and player count.
- **Social feeds:** Enable X and YouTube separately on Game, Community, and Profile pages.
- **Robux estimates:** Approximate currency equivalents on Roblox and Creator Hub; checkout prices may differ.

## Installation

1. Download or clone this repository and extract it if needed.
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.
4. Refresh Roblox. Open settings from the extension's toolbar icon or **Roblox Customizer** in Roblox's settings gear menu.

No build step is needed to install. Keep the extension folder in a permanent location.

The first time you visit Roblox after installing, a Terms of Service prompt appears automatically. Acceptance is remembered in this browser, including after **Reset All**.

## Quick start

- Choose a background and adjust its fit, dimming, blur, and opacity in **Appearance**. Changes save automatically.
- Click **Pin Game** on a game page, choose a folder, and confirm. Manage folders from **Pinned Games** on Home.
- Open a game's **Servers** tab, set your filters, and click **Search**.
- Use **Backup and restore** to export your settings, backgrounds, pins, and playtime. Import replaces existing extension data.

## Language support

Full features require Roblox's language to be **English, Simplified Chinese, or Traditional Chinese**. Other languages use fallback mode: only image/GIF backgrounds and custom colors remain available, while Roblox's native layout is preserved.

Switch Roblox's language to restore all features. Changing only the extension's interface language does not leave fallback mode.

## Data and limitations

Preferences, backgrounds, pinned games, and playtime history are stored locally in your browser. Playtime is estimated from Roblox presence while the browser runs; past sessions and time while the browser is closed cannot be recovered.

Server data, feeds, and currency rates depend on Roblox and external services. Retry unavailable data later. Export a backup and use **Reset All** before uninstalling to remove saved backgrounds and site caches as well.

Read the [Privacy Policy](PRIVACY.md) and [Terms of Service](TERMS.md), also available from the settings menu. Contact [lunar@lunarfox.my](mailto:lunar@lunarfox.my) for support or privacy questions.

## Updates and feedback

Replace the extension files, reload the extension, and refresh Roblox. For problems, include the page URL, browser version, reproduction steps, and a screenshot.

After editing background worker sources, rebuild the checked-in bundle with `node scripts/build-service-worker.cjs`.

Policy text is maintained in `src/legal/content.json`; run `node scripts/build-legal-docs.cjs` after editing it to update the public documents.

Licensed under [GNU GPL v3](LICENSE).
