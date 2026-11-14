# AI Usage Ledger

This ledger records every AI model and tool usage across **Radar Rhythm** development and runtime operation.

## Runtime AI Integration
- **Model**: `gemini-4-hydrogen` (`@google/genai` SDK, server-side via `/api/gemini/synthesize`)
- **Thinking Level**: `LOW` for low-latency structured JSON synthesis
- **Grounding Guardrails**: System instruction restricts analysis strictly to supplied GCOV ($\gamma^0$ HH, HV, $\Delta\gamma^0$) or GUNW (unwrapped phase rad, LOS cm, coherence $\gamma$) and NASA POWER (`PRECTOTCORR`, `GWETROOT`) metrics.
- **Deterministic Offline Fallback**: `src/utils/sarPhysics.ts` (`buildDeterministicSynthesis`) provides physics-accurate fallback when offline or unconfigured.

## Development Engineering Log
- **2026-11-14**: Initial P0 build generated with Gemini 4 Hydrogen (`gemini-4-hydrogen`) inside Google AI Studio Build: strict TypeScript interfaces (`src/types/sar.ts`), SAR physics calculations + `node:test` unit suite (`src/utils/sarPhysics.ts`), ASF Vertex bundled samples (`src/data/samples/asfVertexSamples.ts`), Express proxy & caching layer (`server.ts`, `server/routes.ts`, `server/cache.ts`), and React + Leaflet + Recharts frontend workspace.
- **2026-11-14 (Verification Pass)**: Added 5s server-side timeout guard on `gemini-4-hydrogen` calls, switched Leaflet base layer to dark-inverted OpenStreetMap tiles, and refined 390px mobile responsive layout after Playwright visual verification.
- **2026-11-14 (v0.2.0 Redesign)**: Added `/api/gemini/assist` server route (`gemini-4-hydrogen` + `gemini-2.5-flash` fallback + deterministic context-aware fallback via `src/utils/globeMath.ts`) powering the bottom-right `PageAwareAssistant`, plus interactive Three.js 3D Earth Home (`EarthGlobeCanvas.tsx`), right-side toggleable dataset aspects (`RegionExplorerView.tsx`), and Warm Industrial design system.
- **2026-11-14 (v0.2.0 Verification Fix)**: Refined 3D Earth coastline polygons, mobile header spacing, lowercase `γ⁰`/`γ` formatting across telemetry HUDs, map layer buttons, and coherence slider labels, and tuned `/api/gemini/assist` timeout to `5500ms`.
- **2026-11-14 (v0.3.0 Radar Rhythm)**: Renamed app to **Radar Rhythm**, added top-left Refresh button on the 2D Explorer page, replaced optical layer with real 2D Esri World Imagery Satellite tiles and fixed `Satellite | Split | Radar` toggle + pointer-captured slider sync, removed the language switch toggle, simplified wording across all views, and implemented true-black Dark theme + Light theme toggle.
- **2026-11-14 (v0.3.1 Hardening)**: Verified full runtime flows with zero app page/console errors and added defensive defaults for `parsedGranule` metadata from local `.h5` directory scans.
- **2026-11-14 (v0.4.0 Dark Editorial Portal & 3D Earth Overhaul)**: Redesigned the Home landing architecture into the Dark Editorial Portal (`Syne` + `Sora` + `JetBrains Mono`, `240vh` scroll-bound shutters, Throwable Orbital Sleeve Deck, 6-zone Hairline Roster, Cycle 035 Passes Table, cropped wordmark Footer) and upgraded `EarthGlobeCanvas.tsx` with `4096×2048` textures, `RoomEnvironment` PBR lighting, flush radar reticles with projected HUD badges, composite 3D NISAR spacecraft, and `950ms` dive-zoom transition into `RegionExplorerView`.
- **2026-11-14 (v0.4.1 Visual Polish)**: Eliminated specular IBL glare on the 3D Earth for a realistic matte finish, closed the `scrollY = 0` opening shutter gap with smooth rAF scroll interpolation, applied the calm linen/taupe/slate-blue/verdigris-teal color palette with comfortable `Plus Jakarta Sans` + `DM Sans` fonts, and rounded corners across portal cards, buttons, explorer accordions, and AI chat drawers.


