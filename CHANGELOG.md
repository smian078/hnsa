# Changelog

## [0.1.0] - 2026-11-14 — P0 Complete Release
### Added
- **3-Region SAR Study Areas**: Bundled ASF Vertex `GCOV` & `GUNW` multi-polygon GeoJSON and 4-pass orbital telemetry for Maharashtra (Wainganga/Gosikhurd & Wardha), Northeast India (Brahmaputra/Kaziranga), and Japan (Noto Peninsula/Toyama Bay).
- **Cloud-Piercer Split-Screen Map (`src/components/CloudPiercerMap.tsx`)**: Synchronized dual Leaflet view comparing NASA GIBS MODIS Terra optical cloud cover against color-coded L-band SAR polygons with a draggable/keyboard-accessible split slider and GUNW coherence (`γ`) mask.
- **12-Day Orbital Pass Scrubber (`src/components/OrbitalTimeScrubber.tsx`)**: 4-cycle timeline with autoplay (respecting `prefers-reduced-motion`), baseline delta readouts, and `localStorage` snapshot pinning (`nisar_pulse_saved_snapshots_v1`).
- **Multi-Sensor Telemetry (`src/components/TelemetryPanel.tsx`)**: Dual-axis Recharts SAR vs NASA POWER rainfall/soil wetness correlation and interactive Roughness vs Dielectric Constant 2D quadrant scatter plot.
- **Grounded Physical Driver Synthesizer (`src/components/PhysicalDriverSynthesizer.tsx`)**: Server-side `gemini-4-hydrogen` integration (`/api/gemini/synthesize`) supporting English, Marathi (`मराठी`), and Hindi (`हिन्दी`), with deterministic physics fallback.
- **ASF Vertex Granule Inspector (`src/components/GranuleInspector.tsx`)**: Live/bundled granule metadata table, raw JSON inspector, JSON export, custom `.geojson`/`.json` upload parser, and live NASA EONET hazard feed.
- **Unified Express + Vite Server (`server.ts`, `server/routes.ts`, `server/cache.ts`)**: Proxies `/api/health`, `/api/asf/granules`, `/api/nasa/power`, `/api/nasa/eonet`, and `/api/gemini/synthesize` with in-memory TTL/SWR caching and 60 req/min rate limiting.

### Fixed (Browser Verification)
- Replaced CartoDB basemap URL (which displayed an API key watermark in sandbox) with dark-inverted OpenStreetMap tiles (`.nisar-dark-basemap-tiles`) and added `maxNativeZoom={9}` to the NASA GIBS MODIS Terra layer.
- Added a 5000ms timeout race on `/api/gemini/synthesize` and a 6000ms client `AbortController` so synthesis always resolves rapidly to either `GEMINI_4_HYDROGEN` or `DETERMINISTIC_PHYSICS_FALLBACK`.
- Fixed mobile (`390px`) Navbar control cluster wrapping and repositioned the Optical GIBS map badge to bottom-left on mobile viewports to prevent badge overlap.

## [0.1.1] - 2026-11-14 — ASF Vertex Cycle 035 HDF5 Wiring & Timeout Patch
### Added
- Wired the 3 downloaded ASF Vertex NISAR Cycle 035 `.h5` granules (Maharashtra Track 084 Frame 013, Northeast India Track 098 Frame 013, Japan Track 009 Frame 024; `40+5 MHz`, `DHDH [HH+HV]`, `CRID P05036`) and HDF5 internal paths (`/science/LSAR/GCOV/grids/frequencyA/HHHH`, `/science/LSAR/GCOV/grids/frequencyA/HVHV`, `/science/LSAR/identification/boundingPolygon`) into `src/data/samples/asfVertexSamples.ts` and `src/components/GranuleInspector.tsx`.
- Added local Python extractor `scripts/extract_nisar_h5.py` (`h5py` + `numpy`) to convert `.h5` covariance grids to `10 * log10(gamma0)` dB summaries and GeoJSON without storing >100 MB binaries in Git.

### Changed
- Increased `/api/gemini/synthesize` model timeout to `12000` ms with `gemini-2.5-flash` fallback prior to `DETERMINISTIC_PHYSICS_FALLBACK` in `server/routes.ts`.
- Replaced `__dirname` with `import.meta.dirname` in `vite.config.ts`.

## [0.2.0] - 2026-11-14 — Warm Industrial 3D Earth Home, 2D Morph Explorer & Page-Aware Assistant
### Added
- **Interactive 3D Earth Home (`src/components/EarthGlobeCanvas.tsx`, `src/components/HomeLandingView.tsx`)**: Procedural Three.js 3D globe with highlighted selectable region beacons for Maharashtra, Northeast India, and Japan, orbiting NISAR SweepSAR spacecraft model, software-WebGL pacing, and smooth camera fly-to transition into the 2D Leaflet workspace.
- **Right-Side Toggleable Dataset Aspects (`src/components/RegionExplorerView.tsx`, `src/utils/globeMath.ts`)**: Accordion aspect toggles tailored per study region (`Flood HH`, `Crop Canopy HV/Ratio`, `Crustal LOS GUNW`, `Coherence γ`, `NASA POWER Climate`, `Physical Driver AI Synthesis`, and `Cycle 035 HDF5 & Data Sources`), updating 2D map layers and detailed breakdowns one by one.
- **Bottom-Right Page-Aware AI Assistant (`src/components/PageAwareAssistant.tsx`, `/api/gemini/assist`)**: Floating context-synced guide tracking active page (`HOME_3D_GLOBE` vs `REGION_2D_MAP`), active region, aspect module, selected sub-zone, and live telemetry values in English, Marathi, and Hindi.
- **Unit Tests (`src/utils/globeMath.test.ts`)**: Verified 3D spherical-to-Cartesian projection, orbital camera target calculation, aspect configurations, and page-aware assistant fallback responses via `node:test`.

### Changed
- Redesigned UI into the **Warm Industrial** aesthetic (`#EBEBE8` background, `#18181B` foreground, `#0066FF` blue accent, `#D4D4D8` 1px borders, fixed 12-column grid lines, 4% noise overlay, `Inter` + `Playfair Display` + `JetBrains Mono` typography, `120px` marquee ticker, clip-path hover project list, and `#18181B` massive footer).

### Fixed
- Refined procedural 3D Earth continent polygons in `src/components/EarthGlobeCanvas.tsx` to eliminate concave self-intersections and render clean South Asia/Japan coastlines.
- Improved `390px` mobile header spacing in `src/components/Navbar.tsx`, preserved lowercase Greek `γ⁰`/`γ` symbols in telemetry HUD labels, map layer buttons, and the coherence mask slider label, and tuned `/api/gemini/assist` timeout to `5500ms`.

## [0.2.1] - 2026-11-14 — Live SMIAN_P5 Cloudflare HDF5 Database Integration
### Added
- **Default Live Laptop HDF5 Tunnel (`src/services/nisarApi.ts`)**: Set default `nisar_laptop_db_url` to `https://americans-revolution-nicole-meanwhile.trycloudflare.com`, added a 4000ms timeout `/api/local-h5` fetcher parsing `status`, `host`, `totalH5FilesFound`, and `granules` (`fileSizeMB`, `hdf5MagicVerified`, `headerDigest`, `hdf5InternalPaths`, `parsedGranule`), with seamless offline fallback to bundled Cycle 035 data.
- **Navbar Live Host Status Pill (`src/components/Navbar.tsx`)**: Added prominent green `LIVE DB: SMIAN_P5 (3 .H5 • 18.04 GB)` pill with editable tunnel URL popover and offline fallback state.
## [0.3.0] - 2026-11-14 — Radar Rhythm Rebrand, 2D Satellite View, Refresh & Dark Theme
### Added
- **Top-Left Refresh Button (`src/components/RegionExplorerView.tsx`, `src/App.tsx`)**: Added a working Refresh button next to `3D Earth` that refreshes regional weather, satellite catalog, hazard alerts, and live `.h5` database status with loading feedback and an updated timestamp.
- **Real 2D Satellite View & Mode Toggle (`src/components/CloudPiercerMap.tsx`)**: Replaced the hazy optical tile overlay with Esri World Imagery 2D satellite photography, added clickable `Satellite | Split | Radar` toggle buttons, fixed bidirectional Leaflet map sync on mount/pan/zoom, and upgraded the draggable divider with `setPointerCapture` across `0–100%`.
- **Dark & Light Theme (`src/index.css`, `src/App.tsx`, `src/components/Navbar.tsx`)**: Added a true-black Dark theme default with a `Dark / Light` switcher persisted in `localStorage` and adapted Recharts axes/tooltips and Leaflet radar base tiles.

### Changed
- **Renamed App to `Radar Rhythm`**: Updated branding across `index.html`, `Navbar.tsx`, `Footer.tsx`, `AboutDataModal.tsx`, `PageAwareAssistant.tsx`, and docs.
- **Simplified Plain-English Copy & Removed Language Switch**: Removed the `EN | MR | HI` language switcher from `Navbar.tsx`, `PhysicalDriverSynthesizer.tsx`, and `PageAwareAssistant.tsx`, and simplified headings and descriptions across Home and 2D Explorer views.

### Fixed
- **Defensive Laptop `.h5` Granule Parsing (`src/services/nisarApi.ts`, `src/components/GranuleInspector.tsx`)**: Added safe defaults for `parsedGranule` fields returned by `scripts/extract_nisar_h5.py` when filenames omit standard tokens.
- **Verified `SMIAN_P5` Telemetry Synchronization (`src/data/samples/asfVertexSamples.ts`, `src/services/nisarApi.ts`, `src/components/GranuleInspector.tsx`)**: Exported `LAPTOP_DB_URL` (`https://americans-revolution-nicole-meanwhile.trycloudflare.com`), added automatic startup `/api/local-h5` fetch with deduplicated merging into active region granules, and synced hardcoded verified `SMIAN_P5` file sizes, SHA-256 digests, and HH/HV/soil-moisture/LOS/coherence metrics across Japan (`5132.0 MB`, `0090bc4d60a3e529`), Maharashtra (`6388.0 MB`, `f6066c14dd4b68bb`), and Northeast India (`6516.0 MB`, `0ef3bd2a7b09daa8`).

## [0.3.2] - 2026-11-14 — Plain-English .h5 File Translator & AI Guide Bridge
### Added
- **Plain-English `.h5` File Translator (`src/components/GranuleInspector.tsx`, `scripts/extract_nisar_h5.py`)**: Added everyday explanations of NASA `.h5` containers, flat-mirror `HH` flood detection, leaf-bounce `HV` crop/forest thickness, percentage Soil Wetness bars, earthquake ground-shift translations, and 3-line HDF5 Path Decoders (`HHHH`, `HVHV`, `boundingPolygon`).
- **One-Click AI `.h5` Explanation Bridge (`src/components/GranuleInspector.tsx` ↔ `src/components/PageAwareAssistant.tsx`)**: Added `✨ Ask AI to Explain This .h5 File in Simple Words` buttons dispatching `nisar-ask-ai` custom events with exact `.h5` metrics so `PageAwareAssistant` auto-opens, submits, and exposes a default `"Explain the .h5 satellite file in simple words"` quick chip.
- **Everyday-Person AI Prompting (`server/routes.ts`, `src/utils/globeMath.ts`)**: Grounded `/api/gemini/assist` and deterministic fallbacks with mirror, leaf-bounce, and centimeter-ruler analogies alongside exact `SMIAN_P5` GB sizes and telemetry numbers.

## [0.3.3] - 2026-11-14 — Live .h5 Plain-English Summaries & Binary Disk Slice Proof
### Added
- **Schema Preservation (`src/services/nisarApi.ts`, `src/data/samples/asfVertexSamples.ts`)**: Added `plainEnglishSummary` and `liveDiskSlices` (`offsetMB`, `nonZeroByteRatio`, `chunkSha256`) to `LiveLaptopGranuleRecord`, `parseLiveLaptopPayload`, and `SMIAN_P5_VERIFIED_RECORDS`.
- **In Simple Words & Disk Slice Proof Badges (`src/components/GranuleInspector.tsx`)**: Highlighted `In Simple Words (What This .h5 File Shows)` boxes displaying `rec.plainEnglishSummary` plus HH/HV/Soil Wetness/Ground Shift plain-English translations and 3 binary disk slice proof badges (`Offset MB`, `Active Radar Fill %`, `Chunk Hash`).
- **AI Guide `.h5` Summary Bridge (`src/components/GranuleInspector.tsx`, `src/components/PageAwareAssistant.tsx`, `src/utils/globeMath.ts`, `server/routes.ts`)**: Updated `✨ Ask AI Guide to Explain This .h5 File` buttons to dispatch `h5Summary` inside `nisar-ask-ai`, auto-opening the assistant panel and forwarding the `.h5` summary to `/api/gemini/assist`.

## [0.3.4] - 2026-11-14 — History, Past Issues & Laptop Server AI Q&A
### Added
- **Dedicated `history_issues` Aspect & Types (`src/types/sar.ts`, `src/utils/globeMath.ts`, `src/services/nisarApi.ts`, `src/data/samples/asfVertexSamples.ts`)**: Added `'history_issues'` to `DatasetAspectId`, `HistoricalIssueEntry` interface, `recurringProblemsSummary`, and region-specific historical event timelines across Maharashtra, Northeast India, and Japan.
- **History & Past Issues Panel (`src/components/HistoryIssuesPanel.tsx`, `src/components/RegionExplorerView.tsx`)**: Created a dedicated section displaying the `DATA SOURCE: SMIAN_P5 LAPTOP SERVER (.H5 + HISTORICAL BASELINE)` badge, live `.h5` file metadata, **Past Issues vs. Current Nov 2026 `.h5` Scan Timeline**, and an inline **Ask AI About History & Past Issues** chat with 3 quick-question chips grounded in `/api/local-h5` + historical baselines.
- **Historical AI Grounding (`server/routes.ts`, `src/utils/globeMath.ts`)**: Enhanced `/api/gemini/assist` and `buildPageAwareAssistantFallback` to compare past flood, crop-loss, and earthquake events directly against current Nov 2026 `.h5` telemetry.

## [0.4.0] - 2026-11-14 — Dark Editorial Portal, Throwable Sleeve Deck & Google-Earth 3D Globe
### Added
- **Six-Section Editorial Portal (`src/components/HomeLandingView.tsx`, `src/components/Footer.tsx`)**: Implemented a `240vh` scroll-bound split-shutter portal hero (`SKIP PORTAL / INTERACT WITH GLOBE` bypass included), Statement Fold (`035` outline numeral + scroll-rotating interferogram seal), 4-card physical Throwable Sleeve Deck (pointer-capture fling + `←`/`→` keyboard navigation), 6-zone Hairline Roster, Cycle 035 `.h5` Passes Table, and cropped full-width `'Syne'` wordmark footer.
- **High-Detail 3D Satellite Earth & Dive-Zoom (`src/components/EarthGlobeCanvas.tsx`, `src/App.tsx`)**: Upgraded procedural/Blue-Marble Earth textures (`4096×2048` + `bumpMap` + water `roughnessMap` + `RoomEnvironment`), dual-layer Rayleigh atmospheric glow, composite gold-foil NISAR spacecraft, flush concentric radar target rings, zero-GC screen-projected HTML HUD badges synced with `SMIAN_P5`, and a `950ms` cubic-bezier dive-into-Earth transition with radial atmospheric cross-fade into the 2D Explorer.

### Changed
- **Palette & Typography (`index.html`, `src/index.css`, `src/components/Navbar.tsx`)**: Loaded `'Syne'`, `'Sora'`, and `'JetBrains Mono'`, applied the Dark Editorial color tokens (`#0A0C0E`, `#EDE7DC`, `#E8913C`, `#2E6B72`), and introduced the fixed `58px` translucent navigation bar (`01 PORTAL`, `02 CATALOGUE`, `03 ROSTER & PASSES`, `04 2D RADAR MAP`) while keeping all 2D Leaflet, `GranuleInspector`, `HistoryIssuesPanel`, `PageAwareAssistant`, and `/api/local-h5` flows intact.

## [0.4.1] - 2026-11-14 — Matte Realistic Earth, Zero-Gap Opening Shutters & Soft Bedroom Palette
### Changed
- **Matte Realistic 3D Earth (`src/components/EarthGlobeCanvas.tsx`)**: Removed `RoomEnvironment` IBL glare and glossy ocean specular overrides, raised surface roughness (`0.94`, `metalness: 0.0`, `envMapIntensity: 0.0`), calibrated oblique solar/hemisphere lighting, and softened atmospheric haze so Earth renders realistically without plastic highlights.
- **Zero-Gap Opening Shutters & Smooth 60/120fps Damping (`src/components/HomeLandingView.tsx`)**: Fixed the initial `scrollY = 0` shutter gap by positioning overlapping `50.5vw` left/right shutters flush at center and added high-resolution rAF interpolation over the existing scroll-driven shutter and rotation logic.
- **Comfortable Typography, Palette & Rounded UI (`index.html`, `src/index.css`, `src/App.tsx`, `src/components/Navbar.tsx`, `src/components/HomeLandingView.tsx`, `src/components/RegionExplorerView.tsx`, `src/components/Footer.tsx`, `src/components/PageAwareAssistant.tsx`)**: Switched to `Plus Jakarta Sans`, `DM Sans`, and `JetBrains Mono`; applied the warm linen/taupe/slate-blue/verdigris-teal color profile (plus matching soft slate dark theme); unified branding around `Radar Rhythm.`; and smoothed boxy corners across cards, pills, tables, and controls.


