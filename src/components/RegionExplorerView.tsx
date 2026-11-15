import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Compass,
  Database,
  History,
  Layers,
  Map,
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
  activeViewTab?: '2D_MAP' | 'HISTORY_AI';
  onChangeViewTab?: (tab: '2D_MAP' | 'HISTORY_AI') => void;
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
  activeViewTab,
  onChangeViewTab,
}: RegionExplorerViewProps) {
  const [localTab, setLocalTab] = useState<'2D_MAP' | 'HISTORY_AI'>('2D_MAP');
  const activeTab = activeViewTab ?? localTab;
  const setTab = onChangeViewTab ?? setLocalTab;

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
              className="inline-flex items-center gap-2 rounded-full border border-survey-border-strong bg-survey-basalt px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-survey-basalt-text hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
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
                  className={`rounded-full border px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                    active
                      ? 'border-survey-basalt bg-survey-basalt text-survey-basalt-text'
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

      {/* Primary Section Switcher: 2D Radar Map vs Dedicated Historical Disasters & Laptop .H5 Database */}
      <div
        role="tablist"
        aria-label="Explorer Sections"
        className="flex flex-wrap items-center gap-2.5 border-b border-[var(--rr-border)] pb-3"
      >
        <button
          type="button"
          role="tab"
          id="tab-2d-map"
          aria-selected={activeTab === '2D_MAP'}
          data-testid="tab-2d-map-btn"
          onClick={() => setTab('2D_MAP')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
            activeTab === '2D_MAP'
              ? 'border border-survey-basalt bg-survey-basalt text-survey-basalt-text shadow-sm'
              : 'border border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-muted)] hover:border-[var(--rr-border-strong)] hover:text-[var(--rr-text)]'
          }`}
        >
          <Map className="h-3.5 w-3.5" aria-hidden="true" />
          <span>01 · 2D Radar &amp; Satellite Map</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-history-ai"
          aria-selected={activeTab === 'HISTORY_AI'}
          data-testid="tab-history-ai-btn"
          onClick={() => setTab('HISTORY_AI')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
            activeTab === 'HISTORY_AI'
              ? 'border border-survey-basalt bg-survey-basalt text-survey-basalt-text shadow-sm'
              : 'border border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-muted)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)]'
          }`}
        >
          <History className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
          <span>02 · History, Past Issues &amp; Laptop Server AI</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-survey-moss/40 bg-survey-moss/10 px-2 py-0.5 text-[9px] font-bold text-survey-moss">
            <Database className="h-2.5 w-2.5" />
            <span>SMIAN_P5 .H5</span>
          </span>
        </button>
      </div>

      {activeTab === 'HISTORY_AI' ? (
        <section
          aria-labelledby="tab-history-ai"
          className="space-y-4"
        >
          <div className="rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--rr-text)] flex items-center gap-2">
                <History className="h-4 w-4 text-[var(--rr-accent)]" />
                <span>Historical Disasters &amp; Laptop .H5 Database (NVIDIA AI Coverage)</span>
              </h2>
              <p className="text-xs text-[var(--rr-muted)] mt-0.5">
                Pulls live .h5 server data and historical baselines from <code className="font-mono text-survey-ink font-semibold">/api/local-h5</code> on <code className="font-mono text-survey-ink font-bold">SMIAN_P5</code> with full coverage by NVIDIA NIM AI (LLaMA 3.3 70B).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTab('2D_MAP')}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-[var(--rr-border)] bg-[var(--rr-bg)] px-3 py-1.5 font-mono text-[11px] font-bold uppercase text-[var(--rr-text)] hover:border-survey-basalt transition-colors"
            >
              <Map className="h-3.5 w-3.5" />
              <span>Back to 2D Map</span>
            </button>
          </div>

          <HistoryIssuesPanel
            region={region}
            selectedZone={selectedZone}
            passIndex={passIndex}
            fullWidth={true}
          />
        </section>
      ) : (
        /* Main 12-Col Grid: 2D Map Left (7 cols) + Toggleable Details Right (5 cols) */
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
          <div className="flex items-center justify-between rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-surface)] px-4 py-3">
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
                  className={`rounded-2xl border overflow-hidden transition-colors ${
                    isOpen
                      ? 'border-[var(--rr-border-strong)] bg-[var(--rr-bg)]'
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
                          ? 'border-survey-basalt bg-survey-basalt text-survey-basalt-text'
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
                                Selected Area · Scan {passIndex + 1} ({activePass.acquisitionDate})
                              </span>
                              <Compass className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
                            </div>
                            <div className="text-sm font-bold text-[var(--rr-text)]">
                              {activeZone.name}
                            </div>
                            <p className="text-xs text-[var(--rr-muted)] leading-relaxed">
                              {aspect.id === 'flood_water' &&
                                `Standing Floodwater: Calm water acts like a flat mirror and bounces the radar beam away, dropping the reading to ${activePass.hhGamma0Db.toFixed(1)} dB (${formatSigned(activeDelta.deltaHhDb, 1)} dB compared to Scan 1). Readings at -18 dB or lower mean open floodwater is covering the ground.`}
                              {aspect.id === 'crop_canopy' &&
                                `Crop & Forest Thickness: Plant leaves and stems bounce the radar beam back (${activePass.hvGamma0Db.toFixed(1)} dB) while the soil underneath is ${Math.round(activePass.soilMoistureIndex * 100)}% soaked. Higher readings (-12.5 dB or above) mean thick green crops or floodwater standing beneath crop stems.`}
                              {aspect.id === 'crustal_los' &&
                                `Ground Movement: The land in this zone ${
                                  (activePass.losDisplacementCm ?? 0) < 0
                                    ? `sank by ${Math.abs(activePass.losDisplacementCm ?? 0).toFixed(1)} cm`
                                    : `rose by +${(activePass.losDisplacementCm ?? 0).toFixed(1)} cm`
                                } compared to before the earthquake (${formatSigned(activeDelta.deltaLosCm ?? 0, 1)} cm change since Scan 1).`}
                              {aspect.id === 'coherence_mask' &&
                                `Signal Clarity Filter: This area has ${Math.round((activePass.coherence ?? 0) * 100)}% signal clarity compared to your minimum filter of ${Math.round(coherenceThreshold * 100)}%. Use the "MIN CLARITY" slider under the map to dim noisy forest or water spots.`}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-muted)]">
                              All {region.zones.length} Zones in {region.title} (Tap to Focus)
                            </div>
                            <div className="divide-y divide-[var(--rr-border)] rounded-xl overflow-hidden border border-[var(--rr-border)] bg-[var(--rr-surface)]">
                              {region.zones.map((z) => {
                                const p = z.passes[passIndex] ?? z.passes[0];
                                const st = getPolygonVisualStyle(
                                  p,
                                  layerMode,
                                  coherenceThreshold,
                                  isDark
                                );
                                const isSel = z.id === activeZone.id;
                                return (
                                  <button
                                    key={z.id}
                                    type="button"
                                    onClick={() => onSelectZone(z.id)}
                                    className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                                      isSel
                                        ? 'bg-survey-basalt text-survey-basalt-text'
                                        : 'hover:bg-[var(--rr-surface-2)] text-[var(--rr-text)]'
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-xs font-bold">
                                        {z.name}
                                      </div>
                                      <div
                                        className={`text-[11px] truncate ${
                                          isSel ? 'text-survey-basalt-text/85' : 'text-[var(--rr-muted)]'
                                        }`}
                                      >
                                        {st.classificationLabel}
                                      </div>
                                    </div>
                                    <div className="font-mono text-xs font-bold shrink-0 tabular-nums">
                                      {st.unit === 'γ'
                                        ? `${Math.round(Number(st.formattedValue) * 100)}% Clear`
                                        : `${st.formattedValue} ${st.unit}`}
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
                        <div className="space-y-3">
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => setTab('HISTORY_AI')}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--rr-accent)] bg-[var(--rr-accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--rr-accent)] hover:bg-[var(--rr-accent)] hover:text-white transition-colors"
                            >
                              <span>Open Full-Width Dedicated History View &rarr;</span>
                            </button>
                          </div>
                          <HistoryIssuesPanel
                            region={region}
                            selectedZone={selectedZone}
                            passIndex={passIndex}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>
      )}
    </div>
  );
}
