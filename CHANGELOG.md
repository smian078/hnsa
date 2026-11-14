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

