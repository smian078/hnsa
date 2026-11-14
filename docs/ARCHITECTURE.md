# NISAR Pulse — System Architecture

## 1. Overview
NISAR Pulse is a single-workspace command console combining a React 19 + TypeScript + Tailwind CSS frontend with a Node.js + Express backend (`server.ts`) running on port 3000.

## 2. Frontend Modules
- `src/types/sar.ts`: Strict TypeScript contracts for GCOV, GUNW, NASA POWER, ASF granules, EONET, and synthesis results.
- `src/utils/sarPhysics.ts`: Pure calculations for pass deltas, L-band phase-to-LOS conversion, visual polygon classification, scattering mechanism taxonomy, deterministic offline synthesis, and GeoJSON upload parsing.
- `src/data/samples/asfVertexSamples.ts`: Pre-bundled ASF Vertex GCOV/GUNW polygon geometry, 4-pass orbital telemetry, and NASA POWER series for Maharashtra, Northeast India, and Japan.
- `src/components/CloudPiercerMap.tsx`: Synchronized dual-layer Leaflet viewport clipping NASA GIBS optical tiles against calibrated SAR polygons.
- `src/components/OrbitalTimeScrubber.tsx`: 4-pass repeat timeline with delta KPIs and `localStorage` snapshot persistence (`nisar_pulse_saved_snapshots_v1`).
- `src/components/TelemetryPanel.tsx`: Recharts dual-axis SAR/POWER time-series and Roughness vs Dielectric scatter matrix.
- `src/components/PhysicalDriverSynthesizer.tsx`: Grounded Gemini 4 Hydrogen physical driver card with microwave scattering vector diagrams in English, Marathi, and Hindi.
- `src/components/GranuleInspector.tsx`: ASF Vertex catalog browser, JSON inspector/downloader, and local GeoJSON uploader.

## 3. Backend Proxy & Caching (`server.ts`, `server/routes.ts`, `server/cache.ts`)
- **Rate Limiter**: 60 requests/min per IP across `/api/*`.
- **TTL + Stale-While-Revalidate Cache**: In-memory `Map` storing ASF Vertex (`3600s` TTL), NASA POWER (`3600s` TTL), NASA EONET (`1800s` TTL), and Gemini synthesis (`3600s` TTL).
- **Resilient Fallbacks**: Upstream timeouts (`6000ms` + 1 retry) or missing `GEMINI_API_KEY` automatically degrade cleanly to bundled ASF/POWER extracts and deterministic microwave physics synthesis.
