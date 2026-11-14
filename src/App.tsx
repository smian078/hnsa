import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer.tsx';
import { HomeLandingView } from './components/HomeLandingView.tsx';
import { Navbar } from './components/Navbar.tsx';
import { PageAwareAssistant } from './components/PageAwareAssistant.tsx';
import { RegionExplorerView } from './components/RegionExplorerView.tsx';
import { REGION_DATASETS } from './data/samples/asfVertexSamples.ts';
import {
  fetchAsfGranules,
  fetchEonetEvents,
  fetchNasaPowerSeries,
  LAPTOP_DB_EVENT_NAME,
  loadSavedSnapshots,
  persistSavedSnapshot,
  removeSavedSnapshot,
  synthesizePhysicalDrivers,
} from './services/nisarApi.ts';
import type {
  AsfGranulesApiResponse,
  DatasetAspectId,
  EonetEvent,
  LayerMode,
  NasaPowerApiResponse,
  PageViewMode,
  PhysicalDriverSynthesis,
  RegionId,
  SavedSnapshot,
} from './types/sar.ts';
import {
  getDatasetAspectsForRegion,
  getDefaultAspectForRegion,
} from './utils/globeMath.ts';
import { computePassDelta, formatSigned } from './utils/sarPhysics.ts';

const THEME_STORAGE_KEY = 'radar_rhythm_theme_v1';

const AboutDataModal = lazy(() =>
  import('./components/AboutDataModal.tsx').then((m) => ({
    default: m.AboutDataModal,
  }))
);

export type ThemeMode = 'dark' | 'light';

function readInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'dark';
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(readInitialTheme);
  const [pageView, setPageView] = useState<PageViewMode>('HOME_3D_GLOBE');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [isDiveCrossfading, setIsDiveCrossfading] = useState<boolean>(false);
  const [activeRegionId, setActiveRegionId] =
    useState<RegionId>('maharashtra_gcov');
  const [activeAspect, setActiveAspect] = useState<DatasetAspectId | null>(
    'flood_water'
  );
  const [layerMode, setLayerMode] = useState<LayerMode>('GCOV_HH');
  const [passIndex, setPassIndex] = useState<number>(2);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('mh_gosikhurd');
  const [demoMode, setDemoMode] = useState<boolean>(true);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [coherenceThreshold, setCoherenceThreshold] = useState<number>(0.35);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [savedSnapshots, setSavedSnapshots] = useState<SavedSnapshot[]>(() =>
    loadSavedSnapshots()
  );

  const [powerData, setPowerData] = useState<NasaPowerApiResponse | null>(null);
  const [isLoadingPower, setIsLoadingPower] = useState<boolean>(false);
  const [powerError, setPowerError] = useState<string | null>(null);

  const [granulesData, setGranulesData] =
    useState<AsfGranulesApiResponse | null>(null);
  const [isLoadingGranules, setIsLoadingGranules] = useState<boolean>(false);
  const [granulesError, setGranulesError] = useState<string | null>(null);

  const [eonetEvents, setEonetEvents] = useState<EonetEvent[]>([]);

  const [synthesis, setSynthesis] = useState<PhysicalDriverSynthesis | null>(
    null
  );
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage write errors
    }
  }, [theme]);

  const region = REGION_DATASETS[activeRegionId];
  const selectedZone =
    region.zones.find((z) => z.id === selectedZoneId) ?? region.zones[0] ?? null;
  const activePass =
    selectedZone?.passes[passIndex] ?? region.zones[0].passes[passIndex];

  const loadRegionalData = useCallback(async () => {
    const currentRegion = REGION_DATASETS[activeRegionId];
    setIsLoadingPower(true);
    setIsLoadingGranules(true);
    setPowerError(null);
    setGranulesError(null);

    const powerTask = fetchNasaPowerSeries(currentRegion, demoMode)
      .then((powerResp) => {
        setPowerData(powerResp);
      })
      .catch((err: unknown) => {
        setPowerError(
          err instanceof Error
            ? `${err.message}. Showing built-in weather sample.`
            : 'Could not reach NASA weather feed.'
        );
        setPowerData({
          lat: currentRegion.center[0],
          lon: currentRegion.center[1],
          source: 'NASA_POWER_BUNDLED',
          series: currentRegion.powerSeries,
          cached: false,
        });
      })
      .finally(() => {
        setIsLoadingPower(false);
      });

    const granulesTask = fetchAsfGranules(
      activeRegionId,
      currentRegion.productType,
      demoMode
    )
      .then((asfResp) => {
        setGranulesData(asfResp);
      })
      .catch((err: unknown) => {
        setGranulesError(
          err instanceof Error
            ? `${err.message}. Showing built-in satellite file list.`
            : 'Could not reach satellite file catalog.'
        );
        setGranulesData({
          region: activeRegionId,
          product: currentRegion.productType,
          source: 'ASF_VERTEX_BUNDLED_SAMPLE',
          liveCount: 0,
          granules: currentRegion.granules,
          cached: false,
        });
      })
      .finally(() => {
        setIsLoadingGranules(false);
      });

    const eonetTask = fetchEonetEvents(currentRegion.bbox, demoMode)
      .then((eonetResp) => {
        setEonetEvents(eonetResp.events);
      })
      .catch(() => {
        setEonetEvents([]);
      });

    await Promise.all([powerTask, granulesTask, eonetTask]);
    setLastRefreshedAt(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  }, [activeRegionId, demoMode]);

  useEffect(() => {
    void loadRegionalData();
  }, [loadRegionalData]);

  const handleRefreshAll = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.dispatchEvent(new Event(LAPTOP_DB_EVENT_NAME));
    try {
      await loadRegionalData();
    } finally {
      window.setTimeout(() => {
        setIsRefreshing(false);
      }, 260);
    }
  }, [isRefreshing, loadRegionalData]);

  useEffect(() => {
    if (!isPlaying) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setInterval(() => {
      setPassIndex((prev) => (prev + 1) % 4);
    }, 1800);

    return () => window.clearInterval(timer);
  }, [isPlaying]);

  const handleDiveStart = useCallback(() => {
    setIsDiveCrossfading(true);
  }, []);

  const selectRegionAndEnterMap = useCallback(
    (id: RegionId, zoneId?: string) => {
      const nextRegion = REGION_DATASETS[id];
      const matchedZone =
        zoneId && nextRegion.zones.some((z) => z.id === zoneId)
          ? zoneId
          : nextRegion.zones[0].id;
      setActiveRegionId(id);
      setSelectedZoneId(matchedZone);
      setLayerMode(nextRegion.productType === 'GUNW' ? 'GUNW_LOS' : 'GCOV_HH');
      setActiveAspect(getDefaultAspectForRegion(id));
      setSynthesis(null);
      setSynthesisError(null);
      setIsTransitioning(true);

      window.setTimeout(() => {
        setPageView('REGION_2D_MAP');
        setIsTransitioning(false);
        setIsDiveCrossfading(false);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }, 220);
    },
    []
  );

  const handleToggleAspect = (aspectId: DatasetAspectId) => {
    if (activeAspect === aspectId) {
      setActiveAspect(null);
      return;
    }
    setActiveAspect(aspectId);
    const meta = getDatasetAspectsForRegion(activeRegionId).find(
      (a) => a.id === aspectId
    );
    if (meta?.recommendedLayerMode) {
      setLayerMode(meta.recommendedLayerMode);
    }
  };

  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setSynthesis(null);
    setSynthesisError(null);
  };

  const handleSynthesize = async () => {
    if (!selectedZone) return;
    const pass = selectedZone.passes[passIndex] ?? selectedZone.passes[0];
    const delta = computePassDelta(selectedZone, passIndex);

    setIsSynthesizing(true);
    setSynthesisError(null);

    try {
      const result = await synthesizePhysicalDrivers({
        regionId: region.id,
        zoneName: selectedZone.name,
        productType: region.productType,
        hhDb: pass.hhGamma0Db,
        hvDb: pass.hvGamma0Db,
        deltaHhDb: delta.deltaHhDb,
        deltaHvDb: delta.deltaHvDb,
        losDisplacementCm: pass.losDisplacementCm,
        coherence: pass.coherence,
        rainfallMm: pass.rainfallMm,
        soilMoistureIndex: pass.soilMoistureIndex,
        language: 'en',
      });
      setSynthesis(result);
    } catch (err) {
      setSynthesisError(
        err instanceof Error
          ? err.message
          : 'Could not generate AI summary.'
      );
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handlePinSnapshot = () => {
    if (!selectedZone) return;
    const pass = selectedZone.passes[passIndex] ?? selectedZone.passes[0];
    const snap: SavedSnapshot = {
      id: `${region.id}-${selectedZone.id}-${pass.passCode}`,
      createdAt: new Date().toISOString(),
      regionId: region.id,
      regionTitle: region.shortName,
      zoneId: selectedZone.id,
      zoneName: selectedZone.name,
      passIndex,
      acquisitionDate: pass.acquisitionDate,
      layerMode,
      hhDb: pass.hhGamma0Db,
      hvDb: pass.hvGamma0Db,
      losDisplacementCm: pass.losDisplacementCm,
      coherence: pass.coherence,
      rainfallMm: pass.rainfallMm,
    };
    setSavedSnapshots(persistSavedSnapshot(snap));
  };

  const handleLoadSnapshot = (snap: SavedSnapshot) => {
    setActiveRegionId(snap.regionId);
    setSelectedZoneId(snap.zoneId);
    setPassIndex(snap.passIndex);
    setLayerMode(snap.layerMode);
    setActiveAspect(getDefaultAspectForRegion(snap.regionId));
    setPageView('REGION_2D_MAP');
    setSynthesis(null);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSavedSnapshots(removeSavedSnapshot(id));
  };

  const metricsSummary =
    region.productType === 'GUNW'
      ? `Shift ${formatSigned(activePass.losDisplacementCm ?? 0, 1)} cm, Trust ${(activePass.coherence ?? 0).toFixed(2)}, Rain ${activePass.rainfallMm.toFixed(1)} mm/d`
      : `Water ${activePass.hhGamma0Db.toFixed(1)} dB, Crops ${activePass.hvGamma0Db.toFixed(1)} dB, Rain ${activePass.rainfallMm.toFixed(1)} mm/d`;

  const isDark = theme === 'dark';

  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--rr-bg)] text-[var(--rr-text)] transition-colors duration-200">
      {/* Subtle 12-Column Structural Background Grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 mx-auto max-w-[1600px] grid grid-cols-12"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="border-r border-[var(--rr-grid-line)] first:border-l"
          />
        ))}
      </div>

      {/* Subtle Analog Texture Overlay */}
      <div
        aria-hidden="true"
        className="industrial-noise-overlay pointer-events-none fixed inset-0 z-[1500]"
      />

      <Navbar
        pageView={pageView}
        onNavigateHome={() => {
          setPageView('HOME_3D_GLOBE');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onEnterExplorer={() => selectRegionAndEnterMap(activeRegionId)}
        activeRegionId={activeRegionId}
        onSelectRegion={selectRegionAndEnterMap}
        demoMode={demoMode}
        onToggleDemoMode={() => setDemoMode((prev) => !prev)}
        theme={theme}
        onToggleTheme={() =>
          setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
        }
        onOpenAbout={() => setIsAboutOpen(true)}
      />

      <main className="relative z-10 flex-1">
        {pageView === 'HOME_3D_GLOBE' ? (
          <HomeLandingView
            activeRegionId={activeRegionId}
            onSelectRegionFromGlobe={selectRegionAndEnterMap}
            onDiveStart={handleDiveStart}
            isTransitioning={isTransitioning}
            onOpenAbout={() => setIsAboutOpen(true)}
          />
        ) : (
          <div className="pt-[58px]">
            <RegionExplorerView
              region={region}
              activeRegionId={activeRegionId}
              onSelectRegion={selectRegionAndEnterMap}
              onReturnToGlobe={() => {
                setPageView('HOME_3D_GLOBE');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onRefreshAll={() => void handleRefreshAll()}
              isRefreshing={isRefreshing}
              lastRefreshedAt={lastRefreshedAt}
              isDark={isDark}
              activeAspect={activeAspect}
              onToggleAspect={handleToggleAspect}
              selectedZone={selectedZone}
              onSelectZone={handleSelectZone}
              layerMode={layerMode}
              onSelectLayerMode={setLayerMode}
              passIndex={passIndex}
              onSelectPass={setPassIndex}
              coherenceThreshold={coherenceThreshold}
              onChangeCoherenceThreshold={setCoherenceThreshold}
              demoMode={demoMode}
              splitPercent={splitPercent}
              onChangeSplitPercent={setSplitPercent}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((prev) => !prev)}
              onPinSnapshot={handlePinSnapshot}
              savedSnapshots={savedSnapshots}
              onLoadSnapshot={handleLoadSnapshot}
              onDeleteSnapshot={handleDeleteSnapshot}
              powerData={powerData}
              isLoadingPower={isLoadingPower}
              powerError={powerError}
              onRetryPower={() => void loadRegionalData()}
              synthesis={synthesis}
              isSynthesizing={isSynthesizing}
              synthesisError={synthesisError}
              onSynthesize={() => void handleSynthesize()}
              granulesData={granulesData}
              isLoadingGranules={isLoadingGranules}
              granulesError={granulesError}
              onRetryGranules={() => void loadRegionalData()}
              eonetEvents={eonetEvents}
            />
          </div>
        )}
      </main>

      {/* Atmospheric Dive-Into-Earth Radial Cross-Fade Overlay */}
      {(isDiveCrossfading || isTransitioning) && (
        <div
          aria-hidden="true"
          className="dive-crossfade-overlay pointer-events-none fixed inset-0 z-[1400]"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(46, 107, 114, 0.25) 0%, rgba(10, 12, 14, 0.88) 55%, #0A0C0E 100%)',
          }}
        />
      )}

      <Footer
        onOpenAbout={() => setIsAboutOpen(true)}
        onOpenExplorer={() => selectRegionAndEnterMap(activeRegionId)}
      />

      <PageAwareAssistant
        pageView={pageView}
        activeRegionId={activeRegionId}
        activeAspect={activeAspect}
        zoneName={selectedZone?.name}
        passDate={activePass?.acquisitionDate}
        layerMode={layerMode}
        metricsSummary={metricsSummary}
      />

      <Suspense fallback={null}>
        <AboutDataModal
          isOpen={isAboutOpen}
          onClose={() => setIsAboutOpen(false)}
        />
      </Suspense>
    </div>
  );
}
