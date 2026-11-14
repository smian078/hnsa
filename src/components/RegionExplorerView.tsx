import { useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  Database,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { REGION_DATASETS } from '../data/samples/asfVertexSamples.ts';
import { LAPTOP_DB_EVENT_NAME } from '../services/nisarApi.ts';
import type {
  AsfGranulesApiResponse,
  DatasetAspectId,
  EonetEvent,
  LayerMode,
  NasaPowerApiResponse,
  PhysicalDriverSynthesis,
  RegionDataset,
  RegionId,
  SavedSnapshot,
  StudyZone,
} from '../types/sar.ts';
import { getDatasetAspectsForRegion } from '../utils/globeMath.ts';
import {
  computePassDelta,
  formatSigned,
  getPolygonVisualStyle,
} from '../utils/sarPhysics.ts';
import { CloudPiercerMap } from './CloudPiercerMap.tsx';
import { GranuleInspector } from './GranuleInspector.tsx';
import { HistoryIssuesPanel } from './HistoryIssuesPanel.tsx';
import { OrbitalTimeScrubber } from './OrbitalTimeScrubber.tsx';
import { PhysicalDriverSynthesizer } from './PhysicalDriverSynthesizer.tsx';
import { TelemetryPanel } from './TelemetryPanel.tsx';

interface RegionExplorerViewProps {
  region: RegionDataset;
  activeRegionId: RegionId;
  onSelectRegion: (id: RegionId) => void;
  onReturnToGlobe: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
  lastRefreshedAt: string | null;
  isDark: boolean;
  activeAspect: DatasetAspectId | null;
  onToggleAspect: (aspectId: DatasetAspectId) => void;
  selectedZone: StudyZone | null;
  onSelectZone: (zoneId: string) => void;
  layerMode: LayerMode;
  onSelectLayerMode: (mode: LayerMode) => void;
  passIndex: number;
  onSelectPass: (idx: number) => void;
  coherenceThreshold: number;
  onChangeCoherenceThreshold: (val: number) => void;
  demoMode: boolean;
  splitPercent: number;
  onChangeSplitPercent: (val: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPinSnapshot: () => void;
  savedSnapshots: SavedSnapshot[];
  onLoadSnapshot: (snap: SavedSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  powerData: NasaPowerApiResponse | null;
  isLoadingPower: boolean;
  powerError: string | null;
  onRetryPower: () => void;
  synthesis: PhysicalDriverSynthesis | null;
  isSynthesizing: boolean;
  synthesisError: string | null;
  onSynthesize: () => void;
  granulesData: AsfGranulesApiResponse | null;
  isLoadingGranules: boolean;
  granulesError: string | null;
  onRetryGranules: () => void;
  eonetEvents: EonetEvent[];
}

const REGION_SWITCH_ITEMS: Array<{ id: RegionId; label: string }> = [
  { id: 'maharashtra_gcov', label: '01 · Maharashtra' },
  { id: 'northeast_india_gcov', label: '02 · NE India' },
  { id: 'japan_gunw', label: '03 · Japan' },
];

interface PlainAspectCopy {
  shortTag: string;
  title: string;
  summary: string;
}

function getPlainAspectCopy(
  id: DatasetAspectId,
  regionId: RegionId
): PlainAspectCopy {
  switch (id) {
    case 'flood_water':
      return {
        shortTag: 'FLOODWATER · HH',
        title: 'Standing Floodwater',
        summary:
          regionId === 'northeast_india_gcov'
            ? 'Spots calm floodwater hidden beneath thick monsoon clouds.'
            : 'Spots standing water around dams, riverbanks, and soaked fields.',
      };
    case 'crop_canopy':
      return {
        shortTag: 'CROPS & TREES · HV',
        title: 'Crop & Forest Thickness',
        summary:
          regionId === 'northeast_india_gcov'
            ? 'Shows thick grasslands, forests, and water pooled under trees.'
            : 'Measures how dense crops are and whether water sits under the stems.',
      };
    case 'crustal_los':
      return {
        shortTag: 'GROUND SHIFT · cm',
        title: 'Ground Movement (in cm)',
        summary:
          'Shows how many centimeters the land lifted up or sank after earthquakes.',
      };
    case 'coherence_mask':
      return {
        shortTag: 'RELIABILITY · γ',
        title: 'Signal Trust Filter',
        summary:
          'Hides noisy forest patches so you see clear, steady ground readings.',
      };
    case 'climate_power':
      return {
        shortTag: 'RAIN & SOIL',
        title: 'Rainfall & Soil Wetness',
        summary:
          'Compares satellite radar readings with daily rain and soil moisture.',
      };
    case 'physics_ai':
      return {
        shortTag: 'AI SUMMARY',
        title: 'Plain-English Summary',
        summary:
          'Explains what is happening right here using real measurements.',
      };
    case 'history_issues':
      return {
        shortTag: 'HISTORY & AI',
        title: 'History & Past Issues (Laptop Server AI)',
        summary:
          "Explore past floods, crop losses, or earthquakes here and ask AI how your laptop's live .h5 scan compares.",
      };
    case 'sources_hdf5':
    default:
      return {
        shortTag: 'DATA & FILES',
        title: 'Satellite Files & Live Database',
        summary:
          'Inspect raw Cycle 035 satellite files, live laptop database, or upload your own map.',
      };
  }
}

export function RegionExplorerView({
  region,
  activeRegionId,
  onSelectRegion,
  onReturnToGlobe,
  onRefreshAll,
  isRefreshing,
  lastRefreshedAt,
  isDark,
  activeAspect,
  onToggleAspect,
  selectedZone,
  onSelectZone,
  layerMode,
  onSelectLayerMode,
  passIndex,
  onSelectPass,
  coherenceThreshold,
  onChangeCoherenceThreshold,
  demoMode,
  splitPercent,
  onChangeSplitPercent,
  isPlaying,
  onTogglePlay,
  onPinSnapshot,
  savedSnapshots,
  onLoadSnapshot,
  onDeleteSnapshot,
  powerData,
  isLoadingPower,
  powerError,
  onRetryPower,
  synthesis,
  isSynthesizing,
  synthesisError,
  onSynthesize,
  granulesData,
  isLoadingGranules,
  granulesError,
  onRetryGranules,
  eonetEvents,
}: RegionExplorerViewProps) {
  const aspects = getDatasetAspectsForRegion(region.id);
  const activeZone = selectedZone ?? region.zones[0];
  const activePass = activeZone.passes[passIndex] ?? activeZone.passes[0];
  const activeDelta = computePassDelta(activeZone, passIndex);
  const isLiveLaptopDb =
    granulesData?.granules.some((g) =>
      g.browseNote.includes('LIVE LAPTOP .H5 DB CONNECTED')
    ) ?? false;

  useEffect(() => {
    const onLaptopDbChanged = () => {
      onRetryGranules();
    };
    window.addEventListener(LAPTOP_DB_EVENT_NAME, onLaptopDbChanged);
    return () => window.removeEventListener(LAPTOP_DB_EVENT_NAME, onLaptopDbChanged);
  }, [onRetryGranules]);

  const plainSubtitle =
    region.id === 'maharashtra_gcov'
      ? 'Tracks Gosikhurd Dam floodwater and Wardha farm moisture through clouds.'
      : region.id === 'northeast_india_gcov'
        ? 'Sees through monsoon clouds to track Brahmaputra floods and Kaziranga wetlands.'
        : 'Measures how many centimeters the Noto Peninsula coastline rose or sank.';

  return (
    <div className="map-enter-reveal mx-auto w-full max-w-[1600px] border-x border-[var(--rr-border)] px-4 sm:px-8 py-6 space-y-6">
      {/* Top-Left Action Bar (Back + Working Refresh) & Region Heading */}
      <section
        aria-label="Active place header and controls"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[var(--rr-border)]"
      >
        <div className="space-y-2.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="back-to-globe-btn"
              onClick={onReturnToGlobe}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--rr-border-strong)] bg-[var(--rr-surface-inverse)] px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text-inverse)] hover:bg-[var(--rr-accent-solid)] hover:border-[var(--rr-accent-solid)] hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>3D Earth</span>
            </button>

            <button
              type="button"
              data-testid="refresh-region-data-btn"
              onClick={onRefreshAll}
              disabled={isRefreshing}
              aria-label="Refresh map and regional radar details"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] disabled:opacity-60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[var(--rr-accent)]' : ''}`}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            {lastRefreshedAt && (
              <span
                data-testid="last-refreshed-time"
                className="font-mono text-[10px] text-[var(--rr-muted)]"
              >
                Updated {lastRefreshedAt}
              </span>
            )}

            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-accent)]">
              {region.productType === 'GUNW'
                ? 'Ground Movement Map'
                : 'Water & Crop Radar Map'}
            </span>

            {isLiveLaptopDb && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rr-success-border)] bg-[var(--rr-success-bg)] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--rr-success-text)]">
                <Database className="h-3 w-3" aria-hidden="true" />
                <span>Live DB Connected</span>
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-[-0.03em] text-[var(--rr-text)]">
            {region.title}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--rr-muted)]">{plainSubtitle}</p>
        </div>

        {/* Region Switcher */}
        <div className="flex flex-col items-start lg:items-end gap-2 shrink-0">
          <div
            role="group"
            aria-label="Switch place"
            className="flex flex-wrap gap-1.5"
          >
            {REGION_SWITCH_ITEMS.map((item) => {
              const active = item.id === activeRegionId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectRegion(item.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                    active
                      ? 'border-[var(--rr-accent-solid)] bg-[var(--rr-accent-solid)] text-white shadow-sm'
                      : 'border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-text)] hover:border-[var(--rr-border-strong)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--rr-muted)] tabular-nums">
            Area [{region.bbox.map((v) => v.toFixed(2)).join(', ')}] ·{' '}
            {REGION_DATASETS[region.id].zones.length} Zones
          </div>
        </div>
      </section>

      {/* Main 12-Col Grid: 2D Map Left (7 cols) + Toggleable Details Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Stage (7 cols): 2D Map + Time Scrubber */}
        <div className="lg:col-span-7 space-y-5">
          <CloudPiercerMap
            region={region}
            selectedZone={selectedZone}
            onSelectZone={onSelectZone}
            layerMode={layerMode}
            onSelectLayerMode={onSelectLayerMode}
            passIndex={passIndex}
            coherenceThreshold={coherenceThreshold}
            onChangeCoherenceThreshold={onChangeCoherenceThreshold}
            demoMode={demoMode}
            splitPercent={splitPercent}
            onChangeSplitPercent={onChangeSplitPercent}
            isDark={isDark}
          />

          <OrbitalTimeScrubber
            region={region}
            selectedZone={selectedZone}
            passIndex={passIndex}
            onSelectPass={onSelectPass}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
            onPinSnapshot={onPinSnapshot}
            savedSnapshots={savedSnapshots}
            onLoadSnapshot={onLoadSnapshot}
            onDeleteSnapshot={onDeleteSnapshot}
          />
        </div>

        {/* Right Stage (5 cols): Toggleable Details & Analysis */}
        <aside
          aria-label="Details and topic toggles"
          className="lg:col-span-5 space-y-3"
        >
          <div className="flex items-center justify-between rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-surface)] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
                Explore Details · Toggle Topics
              </span>
            </div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-muted)]">
              {aspects.length} Views
            </span>
          </div>

          <div className="space-y-2.5">
            {aspects.map((aspect) => {
              const isOpen = activeAspect === aspect.id;
              const plain = getPlainAspectCopy(aspect.id, region.id);

              return (
                <div
                  key={aspect.id}
                  className={`rounded-2xl border overflow-hidden transition-all ${
                    isOpen
                      ? 'border-[var(--rr-border-strong)] bg-[var(--rr-bg)] shadow-sm'
                      : 'border-[var(--rr-border)] bg-[var(--rr-surface)] hover:border-[var(--rr-border-strong)]'
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`aspect-toggle-${aspect.id}`}
                    aria-expanded={isOpen}
                    onClick={() => onToggleAspect(aspect.id)}
                    className="w-full px-4 py-3.5 text-left flex items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rr-accent)]"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em]">
                        <span className="text-[var(--rr-accent)]">{aspect.code}</span>
                        <span className="text-[var(--rr-muted)]">·</span>
                        <span className="text-[var(--rr-muted)]">{plain.shortTag}</span>
                      </div>
                      <h2 className="text-sm font-bold text-[var(--rr-text)]">
                        {plain.title}
                      </h2>
                      <p className="text-xs text-[var(--rr-muted)] leading-snug">
                        {plain.summary}
                      </p>
                    </div>

                    <span
                      className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isOpen
                          ? 'border-[var(--rr-accent-solid)] bg-[var(--rr-accent-solid)] text-white'
                          : 'border-[var(--rr-border)] bg-[var(--rr-bg)] text-[var(--rr-text)]'
                      }`}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      data-testid={`aspect-detail-${aspect.id}`}
                      className="border-t border-[var(--rr-border)] bg-[var(--rr-bg)] p-4 space-y-4"
                    >
                      {(aspect.id === 'flood_water' ||
                        aspect.id === 'crop_canopy' ||
                        aspect.id === 'crustal_los' ||
                        aspect.id === 'coherence_mask') && (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-accent)]">
                                Selected Area · {activePass.passCode} ({activePass.acquisitionDate})
                              </span>
                              <Compass className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
                            </div>
                            <div className="text-sm font-bold text-[var(--rr-text)]">
                              {activeZone.name}
                            </div>
                            <p className="text-xs text-[var(--rr-muted)] leading-relaxed">
                              {aspect.id === 'flood_water' &&
                                `Standing Floodwater: Radar brightness reads ${activePass.hhGamma0Db.toFixed(1)} dB (${formatSigned(activeDelta.deltaHhDb, 1)} dB compared to dry ground). Values at -18.0 dB or lower show calm standing floodwater because smooth water bounces the radar beam away.`}
                              {aspect.id === 'crop_canopy' &&
                                `Crop & Forest Thickness: Plant-bounce strength is ${activePass.hvGamma0Db.toFixed(1)} dB with ${activePass.surfaceRoughnessCm.toFixed(1)} cm surface texture. Stronger readings (-12.5 dB or higher) mark thick standing crops or water pooling beneath plant stems.`}
                              {aspect.id === 'crustal_los' &&
                                `Ground Movement: The land in this zone moved ${formatSigned(activePass.losDisplacementCm ?? 0, 1)} cm compared to before the earthquake (${formatSigned(activeDelta.deltaLosCm ?? 0, 1)} cm net change). Positive numbers mean land rose; negative numbers mean land sank.`}
                              {aspect.id === 'coherence_mask' &&
                                `Signal Trust Filter: Confidence score is γ = ${(activePass.coherence ?? 0).toFixed(2)} vs your filter threshold γ ≥ ${coherenceThreshold.toFixed(2)}. Adjust the "TRUST γ" slider under the map to hide noisy forest spots.`}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-muted)]">
                              All {region.zones.length} Zones (Tap to Focus)
                            </div>
                            <div className="divide-y divide-[var(--rr-border)] rounded-xl overflow-hidden border border-[var(--rr-border)] bg-[var(--rr-surface)]">
                              {region.zones.map((z) => {
                                const p = z.passes[passIndex] ?? z.passes[0];
                                const st = getPolygonVisualStyle(
                                  p,
                                  layerMode,
                                  coherenceThreshold
                                );
                                const isSel = z.id === activeZone.id;
                                return (
                                  <button
                                    key={z.id}
                                    type="button"
                                    onClick={() => onSelectZone(z.id)}
                                    className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                                      isSel
                                        ? 'bg-[var(--rr-accent-solid)] text-white'
                                        : 'hover:bg-[var(--rr-surface-2)] text-[var(--rr-text)]'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-bold">
                                        {z.name}
                                      </div>
                                      <div
                                        className={`text-[11px] truncate ${
                                          isSel ? 'text-white/85' : 'text-[var(--rr-muted)]'
                                        }`}
                                      >
                                        {st.classificationLabel}
                                      </div>
                                    </div>
                                    <div className="font-mono text-xs font-bold shrink-0 tabular-nums">
                                      {st.formattedValue} {st.unit}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {aspect.id === 'climate_power' && (
                        <TelemetryPanel
                          region={region}
                          selectedZone={selectedZone}
                          onSelectZone={onSelectZone}
                          passIndex={passIndex}
                          powerData={powerData}
                          isLoadingPower={isLoadingPower}
                          powerError={powerError}
                          onRetryPower={onRetryPower}
                          isDark={isDark}
                        />
                      )}

                      {aspect.id === 'physics_ai' && (
                        <PhysicalDriverSynthesizer
                          region={region}
                          selectedZone={selectedZone}
                          passIndex={passIndex}
                          synthesis={synthesis}
                          isSynthesizing={isSynthesizing}
                          synthesisError={synthesisError}
                          onSynthesize={onSynthesize}
                        />
                      )}

                      {aspect.id === 'sources_hdf5' && (
                        <GranuleInspector
                          region={region}
                          granulesData={granulesData}
                          isLoadingGranules={isLoadingGranules}
                          granulesError={granulesError}
                          onRetryGranules={onRetryGranules}
                          eonetEvents={eonetEvents}
                          demoMode={demoMode}
                        />
                      )}

                      {aspect.id === 'history_issues' && (
                        <HistoryIssuesPanel
                          region={region}
                          selectedZone={selectedZone}
                          passIndex={passIndex}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
