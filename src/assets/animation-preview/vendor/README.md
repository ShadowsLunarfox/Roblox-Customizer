# Animation preview dependencies

The avatar animation viewer uses **RoAvatar Renderer 1.9.12** by steinan under
GPL-3.0-only, compatible with this project's GPLv3 license. The renderer and
Draco decoder are unmodified files from the official npm release. Executable
code is loaded from the extension package.

- Upstream: https://github.com/steinann/RoAvatar-Renderer
- npm archive: https://registry.npmjs.org/roavatar-renderer/-/roavatar-renderer-1.9.12.tgz
- npm SHA-512: `DtBzWT1d6+CO3XqaYfwgEogtNIkVcuzDijlpJoMXRsTfdOSWDb/PVyoVRzw+PXRZ9fLvrJhbQKxVsJeDyK1pyw==`
- Renderer SHA-256: `61e470ff1e071907039d5dec36b1d101a871b63b99b7734d86ab167c5d71a40a`
- Corresponding source revision: `be2f8422a392cc88f819e5263ef6382cbdd257d4`
- Corresponding source is included at
  [third_party/roavatar-renderer-1.9.12-source.tar.gz](../../../../third_party/roavatar-renderer-1.9.12-source.tar.gz).
  SHA-256: `a158ccffcf308619eca67ca1b90f7ce6ace0b37b1d3cfc94108b8a2f5ff89cc3`.
  Extract it, run `npm ci`, then `npm run build` to build the upstream package.
- Full license: [roavatar-renderer.LICENSE](roavatar-renderer.LICENSE).

The distribution bundles Three.js 0.185.1 (MIT), N8AO 2.0.1 (CC0-1.0),
postprocessing 6.39.4 (Zlib), fflate 0.8.3 (MIT), and fzstd 0.1.1 (MIT).
Licenses for these are included alongside the renderer. The upstream source
also depends on React/React DOM 19.2.4 (MIT); their notices are retained even
though they are not used as this extension's UI framework or included in its
runtime-library count. Google Draco is under Apache-2.0; see
[draco.LICENSE](draco.LICENSE).

The Terms of Service and Privacy Policy list 10 distinct packaged runtime
libraries across the extension: this renderer and its five bundled libraries,
Google Draco, and the globe's d3-geo, d3-array, and embedded internmap. fzstd is
also used by the resource explorer and is counted only once. Build/test tools
and reference datasets are excluded from that count.

The source archive above is part of the current corresponding-source
distribution. A dependency credit or policy entry does not replace it. Before
omitting the archive from a release, provide an alternative corresponding-source
distribution that meets GPLv3 section 6, with clear download directions and
continued availability for the matching version. Keep all applicable licenses
and copyright notices.

The base R15 rig and compositing mesh data are copied without changes from
[RoAvatar](https://github.com/steinann/RoAvatar) at revision
`263775de79d82a5d009a2538a1d04d1f530d41e0` (`public/assets/`). The repository's
license is included as [asset-data.LICENSE](asset-data.LICENSE). Per-file source
paths and SHA-256 hashes are recorded in [asset-data.json](asset-data.json).
The binary mesh/rig files are the source data themselves; `assets.mjs` maps the
upstream built-in asset IDs to these local files. These basic files are bundled
so they do not need to be downloaded for each preview.

Our UI, iframe lifecycle, and read-only request adapter are in
`animation-bundle.js`, `renderer.mjs`, and `animation-preview-background.js`.
The adapter allows Roblox resource reads and metadata queries. It does not
expose avatar equip, purchase, outfit-save, or other account-changing requests.
