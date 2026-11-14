import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Compass, Layers } from 'lucide-react';
import {
  REGION_DATASETS,
  SMIAN_P5_VERIFIED_RECORDS,
} from '../data/samples/asfVertexSamples.ts';
import {
  LAPTOP_DB_EVENT_NAME,
  normalizeRegionMatch,
  probeLaptopH5Db,
  type LiveLaptopGranuleRecord,
} from '../services/nisarApi.ts';
import type { RegionId } from '../types/sar.ts';
import { EarthGlobeCanvas, type DiveRequest } from './EarthGlobeCanvas.tsx';

interface HomeLandingViewProps {
  activeRegionId: RegionId;
  onSelectRegionFromGlobe: (regionId: RegionId, zoneId?: string) => void;
  onDiveStart?: (regionId: RegionId) => void;
  isTransitioning: boolean;
  onOpenAbout: () => void;
}

interface SleeveCardData {
  key: string;
  indexLabel: string;
  regionId: RegionId;
  zoneId?: string;
  accentHex: string;
  kicker: string;
  title: string;
  subtitle: string;
  metricBadge: string;
  trackLabel: string;
  fileSizeLabel: string;
}

interface RosterEntry {
  regionId: RegionId;
  zoneId: string;
  isPrimaryForRegion: boolean;
  indexStr: string;
  regionCode: string;
  accentHex: string;
  zoneName: string;
  plainFocus: string;
  metricLabel: string;
  trackLabel: string;
}

export function HomeLandingView({
  activeRegionId,
  onSelectRegionFromGlobe,
  onDiveStart,
  isTransitioning,
  onOpenAbout,
}: HomeLandingViewProps) {
  const portalRef = useRef<HTMLElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);

  const [portalProgress, setPortalProgress] = useState<number>(0);
  const [globalScrollDeg, setGlobalScrollDeg] = useState<number>(0);
  const [liveRecords, setLiveRecords] = useState<LiveLaptopGranuleRecord[] | null>(
    null
  );
  const [diveRequest, setDiveRequest] = useState<DiveRequest | null>(null);

  const targetProgressRef = useRef<number>(0);
  const currentProgressRef = useRef<number>(0);
  const targetDegRef = useRef<number>(0);
  const currentDegRef = useRef<number>(0);

  // Throwable Card Deck state
  const [deckOrder, setDeckOrder] = useState<number[]>([0, 1, 2, 3]);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [flingDir, setFlingDir] = useState<-1 | 0 | 1>(0);
  const dragStartRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const flingTimerRef = useRef<number | null>(null);
  const scrollDiveTimerRef = useRef<number | null>(null);

  // Sync live SMIAN_P5 metrics
  useEffect(() => {
    let mounted = true;
    const syncDb = async () => {
      const probe = await probeLaptopH5Db();
      if (mounted && probe.connected && probe.granules.length > 0) {
        setLiveRecords(probe.granules);
      }
    };
    void syncDb();
    const onChange = () => void syncDb();
    window.addEventListener(LAPTOP_DB_EVENT_NAME, onChange);
    return () => {
      mounted = false;
      window.removeEventListener(LAPTOP_DB_EVENT_NAME, onChange);
    };
  }, []);

  // Scroll-bound portal & statement rotation with smooth high-resolution rAF damping
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId: number | null = null;

    const stepSmooth = () => {
      rafId = null;
      const dp = targetProgressRef.current - currentProgressRef.current;
      const dd = targetDegRef.current - currentDegRef.current;

      if (prefersReduced || (Math.abs(dp) < 0.0004 && Math.abs(dd) < 0.05)) {
        currentProgressRef.current = targetProgressRef.current;
        currentDegRef.current = targetDegRef.current;
        setPortalProgress(currentProgressRef.current);
        setGlobalScrollDeg(currentDegRef.current % 360);
        return;
      }

      currentProgressRef.current += dp * 0.28;
      currentDegRef.current += dd * 0.28;
      setPortalProgress(currentProgressRef.current);
      setGlobalScrollDeg(currentDegRef.current % 360);
      rafId = window.requestAnimationFrame(stepSmooth);
    };

    const readScrollTargets = () => {
      const y = window.scrollY || 0;
      targetDegRef.current = y * 0.14;

      const portalEl = portalRef.current;
      if (portalEl) {
        const rect = portalEl.getBoundingClientRect();
        // Shutter opens smoothly across first ~680px so shutters clear >350px within 700px scroll
        const travelDist = Math.max(460, Math.min(rect.height - window.innerHeight, 680));
        const scrolledPastTop = Math.max(0, -rect.top);
        targetProgressRef.current = Math.max(0, Math.min(1, scrolledPastTop / travelDist));
      }

      if (prefersReduced) {
        currentProgressRef.current = targetProgressRef.current;
        currentDegRef.current = targetDegRef.current;
        setPortalProgress(currentProgressRef.current);
        setGlobalScrollDeg(currentDegRef.current % 360);
        return;
      }

      if (rafId === null) {
        rafId = window.requestAnimationFrame(stepSmooth);
      }
    };

    readScrollTargets();
    window.addEventListener('scroll', readScrollTargets, { passive: true });
    window.addEventListener('resize', readScrollTargets, { passive: true });
    return () => {
      window.removeEventListener('scroll', readScrollTargets);
      window.removeEventListener('resize', readScrollTargets);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (flingTimerRef.current) window.clearTimeout(flingTimerRef.current);
      if (scrollDiveTimerRef.current) window.clearTimeout(scrollDiveTimerRef.current);
    };
  }, []);

  const recordsToShow = useMemo(() => {
    return liveRecords && liveRecords.length > 0
      ? liveRecords
      : SMIAN_P5_VERIFIED_RECORDS;
  }, [liveRecords]);

  const getRecordForRegion = useCallback(
    (regionId: RegionId) => {
      return (
        recordsToShow.find((r) => normalizeRegionMatch(r.regionId, regionId)) ??
        SMIAN_P5_VERIFIED_RECORDS.find((r) =>
          normalizeRegionMatch(r.regionId, regionId)
        )
      );
    },
    [recordsToShow]
  );

  const totalGb = useMemo(() => {
    const mb = recordsToShow.reduce((acc, r) => acc + (r.fileSizeMB || 0), 0);
    return (mb / 1000).toFixed(2);
  }, [recordsToShow]);

  const sleeveCards: SleeveCardData[] = useMemo(() => {
    const mh = getRecordForRegion('maharashtra_gcov');
    const ne = getRecordForRegion('northeast_india_gcov');
    const jp = getRecordForRegion('japan_gunw');
    return [
      {
        key: 'sleeve-mh',
        indexLabel: 'CARD 01 / 04',
        regionId: 'maharashtra_gcov',
        zoneId: 'mh_gosikhurd',
        accentHex: 'var(--rr-accent)',
        kicker: 'WATER & CROPS · INDIA',
        title: 'Maharashtra Spillway & Farms',
        subtitle:
          'Spots calm standing floodwater near Gosikhurd Dam and checks wet cotton soils in Wardha.',
        metricBadge: `${(mh?.hhFloodMinDb ?? -21.4).toFixed(1)} dB HH · ${Math.round((mh?.soilMoistureIndex ?? 0.78) * 100)}% MOIST`,
        trackLabel: `TRACK ${mh?.parsedGranule.rel_orbit ?? '084'} · FRAME ${mh?.parsedGranule.frame ?? '013'}`,
        fileSizeLabel: `${((mh?.fileSizeMB ?? 6388) / 1000).toFixed(2)} GB .H5`,
      },
      {
        key: 'sleeve-ne',
        indexLabel: 'CARD 02 / 04',
        regionId: 'northeast_india_gcov',
        zoneId: 'ne_kaziranga',
        accentHex: 'var(--rr-teal)',
        kicker: 'MONSOON FLOODS · INDIA',
        title: 'Brahmaputra & Kaziranga',
        subtitle:
          'Looks straight through heavy monsoon storm clouds to map flooded riverbanks and wildlife wetlands.',
        metricBadge: `${(ne?.hhFloodMinDb ?? -23.0).toFixed(1)} dB HH · ${Math.round((ne?.soilMoistureIndex ?? 0.82) * 100)}% WET`,
        trackLabel: `TRACK ${ne?.parsedGranule.rel_orbit ?? '098'} · FRAME ${ne?.parsedGranule.frame ?? '013'}`,
        fileSizeLabel: `${((ne?.fileSizeMB ?? 6520) / 1000).toFixed(2)} GB .H5`,
      },
      {
        key: 'sleeve-jp',
        indexLabel: 'CARD 03 / 04',
        regionId: 'japan_gunw',
        zoneId: 'jp_noto',
        accentHex: 'var(--rr-warm)',
        kicker: 'LAND SHIFT · JAPAN',
        title: 'Noto Peninsula & Toyama Bay',
        subtitle:
          'Measures how many centimeters the coastline rose or sank after earthquakes with 81% signal clarity.',
        metricBadge: `${(jp?.losDisplacementCm ?? -18.6).toFixed(1)} cm LOS · γ ${(jp?.coherenceMean ?? 0.81).toFixed(2)}`,
        trackLabel: `TRACK ${jp?.parsedGranule.rel_orbit ?? '009'} · FRAME ${jp?.parsedGranule.frame ?? '024'}`,
        fileSizeLabel: `${((jp?.fileSizeMB ?? 5132) / 1000).toFixed(2)} GB .H5`,
      },
      {
        key: 'sleeve-archive',
        indexLabel: 'CARD 04 / 04',
        regionId: 'maharashtra_gcov',
        zoneId: 'mh_wardha',
        accentHex: 'var(--rr-teal)',
        kicker: 'SMIAN_P5 · LIVE .H5 STORAGE',
        title: `${recordsToShow.length} Verified Files · ${totalGb} GB`,
        subtitle:
          'Real NASA radar files and live disk reads served straight from local storage with instant offline fallback.',
        metricBadge: '100% VERIFIED · SHA-256',
        trackLabel: 'CYCLE 035 · L-BAND 24 CM',
        fileSizeLabel: `${totalGb} GB TOTAL`,
      },
    ];
  }, [getRecordForRegion, recordsToShow.length, totalGb]);

  const rosterRows: RosterEntry[] = useMemo(() => {
    const entries: RosterEntry[] = [];
    const regionOrder: RegionId[] = [
      'maharashtra_gcov',
      'northeast_india_gcov',
      'japan_gunw',
    ];
    let counter = 1;
    regionOrder.forEach((regionId) => {
      const ds = REGION_DATASETS[regionId];
      const accentHex =
        regionId === 'northeast_india_gcov'
          ? 'var(--rr-teal)'
          : regionId === 'japan_gunw'
            ? 'var(--rr-warm)'
            : 'var(--rr-accent)';
      const regionCode =
        regionId === 'maharashtra_gcov'
          ? 'MAHARASHTRA · WATER & CROPS'
          : regionId === 'northeast_india_gcov'
            ? 'NE INDIA · MONSOON FLOODS'
            : 'JAPAN · LAND SHIFT';

      ds.zones.forEach((zone, zIdx) => {
        const latestPass = zone.passes[zone.passes.length - 1];
        const metricLabel =
          regionId === 'japan_gunw'
            ? `${(latestPass.losDisplacementCm ?? 0) > 0 ? '+' : ''}${(latestPass.losDisplacementCm ?? 0).toFixed(1)} cm LOS · γ ${(latestPass.coherence ?? 0).toFixed(2)}`
            : `${latestPass.hhGamma0Db.toFixed(1)} dB HH · ${Math.round(latestPass.soilMoistureIndex * 100)}% MOIST`;
        entries.push({
          regionId,
          zoneId: zone.id,
          isPrimaryForRegion: zIdx === 0,
          indexStr: String(counter).padStart(2, '0'),
          regionCode,
          accentHex,
          zoneName: zone.name,
          plainFocus: `${zone.dominantCover} · ${zone.districtOrPrefecture}`,
          metricLabel,
          trackLabel: `TRK ${String(ds.granules[0]?.trackNumber ?? 35).padStart(3, '0')}`,
        });
        counter += 1;
      });
    });
    return entries;
  }, []);

  const triggerDiveIntoGlobe = useCallback(
    (regionId: RegionId, zoneId?: string) => {
      const portalEl = portalRef.current;
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReduced) {
        onSelectRegionFromGlobe(regionId, zoneId);
        return;
      }

      if (portalEl && (window.scrollY || 0) > 420) {
        const rect = portalEl.getBoundingClientRect();
        const top = rect.top + (window.scrollY || 0);
        const openOffset = Math.max(460, Math.min(rect.height - window.innerHeight, 680));
        window.scrollTo({ top: top + openOffset, behavior: 'smooth' });
        scrollDiveTimerRef.current = window.setTimeout(() => {
          setDiveRequest((prev) => ({
            regionId,
            zoneId,
            seq: (prev?.seq ?? 0) + 1,
          }));
        }, 280);
      } else {
        setDiveRequest((prev) => ({
          regionId,
          zoneId,
          seq: (prev?.seq ?? 0) + 1,
        }));
      }
    },
    [onSelectRegionFromGlobe]
  );

  const cycleSleeve = useCallback(
    (direction: -1 | 1) => {
      if (flingTimerRef.current) {
        window.clearTimeout(flingTimerRef.current);
      }
      setFlingDir(direction);
      setIsDragging(false);
      flingTimerRef.current = window.setTimeout(() => {
        setDeckOrder((prev) => {
          if (direction === 1) {
            return [...prev.slice(1), prev[0]];
          }
          return [prev[prev.length - 1], ...prev.slice(0, prev.length - 1)];
        });
        setFlingDir(0);
        setDragOffset({ x: 0, y: 0 });
      }, 260);
    },
    []
  );

  const handleDeckPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, active: true };
    setIsDragging(true);
  };

  const handleDeckPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.active) return;
    setDragOffset({
      x: e.clientX - dragStartRef.current.x,
      y: (e.clientY - dragStartRef.current.y) * 0.25,
    });
  };

  const handleDeckPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current.active) return;
    dragStartRef.current.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer already released
    }

    const deckWidth = deckRef.current?.clientWidth || 400;
    const dx = dragOffset.x;
    if (Math.abs(dx) > deckWidth * 0.1) {
      cycleSleeve(dx > 0 ? 1 : -1);
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const handleDeckKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      cycleSleeve(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      cycleSleeve(-1);
    }
  };

  const handleSkipPortal = () => {
    const portalEl = portalRef.current;
    if (!portalEl) return;
    const rect = portalEl.getBoundingClientRect();
    const top = rect.top + (window.scrollY || 0);
    const openOffset = Math.max(460, Math.min(rect.height - window.innerHeight, 680));
    window.scrollTo({ top: top + openOffset, behavior: 'smooth' });
  };

  const topCardIndex = deckOrder[0];
  const topSleeve = sleeveCards[topCardIndex];
  const shuttersClear = portalProgress > 0.72;

  return (
    <div className="bg-[var(--rr-bg)] text-[var(--rr-text)] overflow-x-clip transition-colors duration-300">
      {/* SECTION 1: Scroll-Bound 240vh Portal Hero */}
      <section
        id="portal"
        ref={portalRef}
        aria-label="Orbital Portal Earth Hero"
        className="relative h-[240vh] bg-[var(--rr-bg)]"
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden isolate">
          {/* Back Layer: Interactive 3D Satellite Earth */}
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              transform: `scale(${(1.1 - portalProgress * 0.1).toFixed(4)})`,
              transformOrigin: 'center center',
            }}
          >
            <EarthGlobeCanvas
              fullBleed
              hudVisible={portalProgress > 0.35}
              activeRegionId={activeRegionId}
              onSelectRegionTransition={onSelectRegionFromGlobe}
              onDiveStart={onDiveStart}
              isTransitioning={isTransitioning}
              diveRequest={diveRequest}
            />

            {/* Subtle Slate-Teal Wash & Soft Vignette */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(75, 114, 133, 0.14) 0%, rgba(14, 19, 27, 0) 48%, rgba(42, 107, 110, 0.16) 100%)',
                opacity: portalProgress * 0.2,
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(14,19,27,0) 52%, rgba(14,19,27,0.52) 100%)',
              }}
            />
          </div>

          {/* Middle Layer: Two Overlapping 50.5vw Shutters (Zero Gap at scrollY = 0) */}
          <div
            aria-hidden="true"
            className={`absolute inset-0 ${
              shuttersClear ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <div
              data-testid="portal-shutter-left"
              className="absolute inset-y-0 left-0 w-[50.5vw] bg-[var(--rr-bg)] border-r border-[var(--rr-border)] will-change-transform transition-colors duration-300"
              style={{
                transform: `translate3d(-${(portalProgress * 106).toFixed(3)}%, 0, 0)`,
              }}
            />
            <div
              data-testid="portal-shutter-right"
              className="absolute inset-y-0 right-0 w-[50.5vw] bg-[var(--rr-bg)] border-l border-[var(--rr-border)] will-change-transform transition-colors duration-300"
              style={{
                transform: `translate3d(${(portalProgress * 106).toFixed(3)}%, 0, 0)`,
              }}
            />
          </div>

          {/* Two Soft 7px Center Accent Dots Drifting Toward Opposite Corners */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span
              className="absolute h-[7px] w-[7px] rounded-full bg-[var(--rr-accent)]"
              style={{
                transform: `translate3d(${(-portalProgress * 42).toFixed(2)}vw, ${(-portalProgress * 34).toFixed(2)}vh, 0)`,
                opacity: Math.max(0.15, 1 - portalProgress * 0.85),
              }}
            />
            <span
              className="absolute h-[7px] w-[7px] rounded-full bg-[var(--rr-teal)]"
              style={{
                transform: `translate3d(${(portalProgress * 42).toFixed(2)}vw, ${(portalProgress * 34).toFixed(2)}vh, 0)`,
                opacity: Math.max(0.15, 1 - portalProgress * 0.85),
              }}
            />
          </div>

          {/* Top Layer: Comfortable Split Hero Wordmark */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 sm:px-4">
            <h1
              className="font-display font-extrabold text-[var(--rr-text)] uppercase select-none flex items-center justify-center gap-2 sm:gap-4 will-change-transform"
              style={{
                fontSize: 'clamp(28px, 6.2vw, 96px)',
                lineHeight: 0.94,
                letterSpacing: `${(0.02 - portalProgress * 0.04).toFixed(4)}em`,
                transform: `scale(${(1 + portalProgress * 0.14).toFixed(4)})`,
                opacity: Math.max(0, 1 - portalProgress * 1.18),
              }}
            >
              <span
                className="inline-block will-change-transform"
                style={{
                  transform: `translate3d(${(-portalProgress * 24).toFixed(2)}vw, 0, 0)`,
                }}
              >
                RADAR
              </span>
              <span
                className="inline-block will-change-transform"
                style={{
                  transform: `translate3d(${(portalProgress * 24).toFixed(2)}vw, 0, 0)`,
                }}
              >
                RHYTHM<span className="text-[var(--rr-accent)]">.</span>
              </span>
            </h1>
          </div>

          {/* Corner Metadata Pinned Cleanly to Frame Edges */}
          <div className="pointer-events-none absolute top-[68px] sm:top-[74px] left-4 right-4 sm:left-8 sm:right-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span
              className={`font-micro transition-colors ${
                shuttersClear ? 'text-[#E2DCD2]' : 'text-[var(--rr-muted)]'
              }`}
            >
              01 / Cloud-Piercing Earth Radar
            </span>
            <span
              className={`font-micro sm:text-right transition-colors ${
                shuttersClear ? 'text-[#7BA1B5]' : 'text-[var(--rr-accent)]'
              }`}
            >
              Cycle 035 · {recordsToShow.length} Scans ({totalGb} GB)
            </span>
          </div>

          <div
            className={`pointer-events-none absolute bottom-[68px] sm:bottom-5 left-4 sm:left-8 font-micro max-w-[65vw] transition-colors ${
              shuttersClear ? 'text-[#E2DCD2]' : 'text-[var(--rr-muted)]'
            }`}
          >
            {shuttersClear
              ? 'Earth View Open · Click Any Highlighted Ring'
              : 'Scroll Smoothly to Reveal Earth View'}
          </div>

          {!shuttersClear && (
            <div className="absolute bottom-[102px] left-4 sm:bottom-5 sm:left-1/2 sm:-translate-x-1/2 z-20">
              <button
                type="button"
                data-testid="skip-portal-btn"
                onClick={handleSkipPortal}
                className="rounded-full border border-[var(--rr-border-strong)] bg-[var(--rr-surface)]/95 px-4 py-1.5 font-micro text-[var(--rr-text)] shadow-sm hover:border-[var(--rr-accent)] hover:bg-[var(--rr-accent-solid)] hover:text-white transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
              >
                Open 3D Earth View
              </button>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: Statement Fold */}
      <section
        aria-label="Mission physics statement"
        className="min-h-[82vh] border-t border-[var(--rr-border)] bg-[var(--rr-bg)] px-4 sm:px-8 py-20 sm:py-28 flex items-center"
      >
        <div className="mx-auto w-full max-w-[1600px] grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8 space-y-6">
            <div className="font-micro text-[var(--rr-accent)]">
              01 / All-Weather Satellite Radar
            </div>
            <h2
              className="font-display font-bold tracking-[-0.02em] leading-[1.12] text-[var(--rr-text)] max-w-[23ch]"
              style={{ fontSize: 'clamp(24px, 3.4vw, 48px)' }}
            >
              Twenty-four centimeter radar beams look right through monsoon
              clouds, flooded farmlands, and shifting ground—{' '}
              <span className="text-[var(--rr-accent)]">
                day or night, in any weather.
              </span>
            </h2>
            <p className="text-sm sm:text-base text-[var(--rr-muted)] max-w-2xl leading-relaxed">
              Every 12 days, the NASA–ISRO NISAR satellite scans India and the
              Pacific Rim to spot calm floodwater, measure soaked crop soils,
              and track centimeter-level ground movement after earthquakes.
            </p>
          </div>

          <div className="lg:col-span-4 flex lg:flex-col items-center lg:items-end justify-between gap-8">
            <div
              aria-hidden="true"
              className="outline-numeral font-extrabold leading-none select-none"
              style={{ fontSize: 'clamp(92px, 12vw, 164px)' }}
            >
              035
            </div>

            {/* Scroll-Rotating Circular Radar Interferogram Badge */}
            <div className="flex items-center gap-4 rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-surface)]/75 px-4 py-3">
              <div
                aria-hidden="true"
                className="h-20 w-20 sm:h-24 sm:w-24 will-change-transform"
                style={{ transform: `rotate(${globalScrollDeg.toFixed(1)}deg)` }}
              >
                <svg viewBox="0 0 120 120" className="h-full w-full">
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="var(--rr-border-strong)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="38"
                    fill="none"
                    stroke="var(--rr-accent)"
                    strokeWidth="1.4"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="22"
                    fill="none"
                    stroke="var(--rr-teal)"
                    strokeWidth="1.4"
                  />
                  <line
                    x1="60"
                    y1="6"
                    x2="60"
                    y2="114"
                    stroke="var(--rr-border)"
                    strokeWidth="1"
                  />
                  <line
                    x1="6"
                    y1="60"
                    x2="114"
                    y2="60"
                    stroke="var(--rr-border)"
                    strokeWidth="1"
                  />
                  <circle cx="60" cy="6" r="3.5" fill="var(--rr-accent)" />
                  <circle cx="98" cy="60" r="3" fill="var(--rr-teal)" />
                </svg>
              </div>
              <div className="font-micro text-[var(--rr-muted)] space-y-1">
                <div className="text-[var(--rr-text)] font-semibold">
                  Cycle 035 Seal
                </div>
                <div>2π = 12.0 cm Shift</div>
                <div>Dual-Band Radar</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Releases & Interactive Sleeve Card Deck */}
      <section
        id="catalogue"
        aria-label="Cycle 035 Radar Capture Cards"
        className="border-t border-[var(--rr-border)] bg-[var(--rr-surface)] px-4 sm:px-8 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-[1600px] grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Info & Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="font-micro text-[var(--rr-accent)]">
                02 / Capture Cards · SMIAN_P5
              </div>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.02em] text-[var(--rr-text)]">
                Cycle 035 Radar Captures
              </h2>
              <p className="text-sm text-[var(--rr-muted)] leading-relaxed">
                Swipe or flick through the capture cards to browse each NASA
                radar scan ({totalGb} GB across {recordsToShow.length} live
                files), or jump straight into the interactive 2D map.
              </p>
            </div>

            {/* Active Top Card Summary Strip */}
            <div className="rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-bg)]/80 p-4 space-y-2 shadow-sm">
              <div className="flex items-center justify-between gap-2 font-micro">
                <span style={{ color: topSleeve.accentHex }}>
                  {topSleeve.indexLabel}
                </span>
                <span className="font-mono text-[var(--rr-muted)]">
                  {topSleeve.fileSizeLabel}
                </span>
              </div>
              <div className="font-display text-xl font-bold text-[var(--rr-text)]">
                {topSleeve.title}
              </div>
              <p className="text-xs text-[var(--rr-muted)] leading-relaxed">
                {topSleeve.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  triggerDiveIntoGlobe(topSleeve.regionId, topSleeve.zoneId)
                }
                className="inline-flex items-center gap-2 rounded-full bg-[var(--rr-accent-solid)] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-92 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
              >
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Dive Into 2D Map</span>
              </button>
              <button
                type="button"
                data-testid="cycle-next-sleeve-btn"
                onClick={() => cycleSleeve(1)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] px-5 py-2.5 text-xs font-semibold text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
              >
                <span>Next Card</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Right Column: Throwable Physical Card Deck */}
          <div className="lg:col-span-7 flex flex-col items-center gap-5">
            <div
              ref={deckRef}
              data-testid="sleeve-deck"
              tabIndex={0}
              role="region"
              aria-label="Interactive Cycle 035 Capture Card Deck. Drag sideways or press Left and Right arrow keys."
              onPointerDown={handleDeckPointerDown}
              onPointerMove={handleDeckPointerMove}
              onPointerUp={handleDeckPointerEnd}
              onPointerCancel={handleDeckPointerEnd}
              onKeyDown={handleDeckKeyDown}
              style={{ touchAction: 'pan-y' }}
              className="relative aspect-square w-full max-w-[440px] rounded-2xl select-none cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
            >
              {deckOrder
                .slice()
                .reverse()
                .map((cardIdx, revIdx) => {
                  const stackPos = deckOrder.length - 1 - revIdx;
                  const card = sleeveCards[cardIdx];
                  const isTop = stackPos === 0;

                  const baseRotate =
                    stackPos === 0
                      ? 0
                      : stackPos === 1
                        ? 2.8
                        : stackPos === 2
                          ? -2.4
                          : 4.4;
                  const baseTranslateX = stackPos * 7;
                  const baseTranslateY = stackPos * 7;
                  const baseScale = 1 - stackPos * 0.032;

                  let transformStr = `translate3d(${baseTranslateX}px, ${baseTranslateY}px, 0) scale(${baseScale}) rotate(${baseRotate}deg)`;
                  let cardOpacity = Math.max(0.58, 1 - stackPos * 0.14);

                  if (isTop) {
                    if (flingDir !== 0) {
                      transformStr = `translate3d(${flingDir * 460}px, -24px, 0) scale(0.95) rotate(${flingDir * 14}deg)`;
                      cardOpacity = 0;
                    } else {
                      const rot = dragOffset.x * 0.045;
                      transformStr = `translate3d(${dragOffset.x.toFixed(1)}px, ${dragOffset.y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
                    }
                  }

                  return (
                    <div
                      key={card.key}
                      data-testid={isTop ? 'sleeve-top-card' : undefined}
                      style={{
                        zIndex: 10 + (deckOrder.length - stackPos),
                        transform: transformStr,
                        opacity: cardOpacity,
                        transition:
                          isTop && isDragging
                            ? 'none'
                            : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease',
                        boxShadow: '0 20px 44px rgba(37, 42, 48, 0.16)',
                      }}
                      className="absolute inset-0 flex flex-col justify-between rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-bg)] p-6 sm:p-7"
                    >
                      {/* Top Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-[var(--rr-border)] pb-3">
                        <div>
                          <div
                            className="font-micro font-semibold"
                            style={{ color: card.accentHex }}
                          >
                            {card.kicker}
                          </div>
                          <div className="font-mono text-[10px] text-[var(--rr-muted)] mt-1">
                            {card.trackLabel}
                          </div>
                        </div>
                        <span className="rounded-full font-mono text-[10px] border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-0.5 text-[var(--rr-text)]">
                          {card.indexLabel}
                        </span>
                      </div>

                      {/* Center Card Details */}
                      <div className="my-auto flex flex-col items-start gap-4 py-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-1">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: card.accentHex }}
                          />
                          <span className="font-mono text-xs font-bold text-[var(--rr-text)] tracking-wide">
                            {card.metricBadge}
                          </span>
                        </div>
                        <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.02em] leading-[1.1] text-[var(--rr-text)]">
                          {card.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-[var(--rr-muted)] leading-relaxed">
                          {card.subtitle}
                        </p>
                      </div>

                      {/* Bottom Card Footer */}
                      <div className="flex items-center justify-between gap-3 border-t border-[var(--rr-border)] pt-3.5">
                        <span className="font-mono text-[11px] font-bold text-[var(--rr-muted)]">
                          {card.fileSizeLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            triggerDiveIntoGlobe(card.regionId, card.zoneId)
                          }
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rr-accent-solid)] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-92 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                        >
                          <span>Open 2D Map</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Deck Progress Dots & Tactile Hint */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                {sleeveCards.map((c, idx) => {
                  const active = topCardIndex === idx;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      aria-label={`Show ${c.title}`}
                      onClick={() => {
                        setDeckOrder([
                          idx,
                          (idx + 1) % 4,
                          (idx + 2) % 4,
                          (idx + 3) % 4,
                        ]);
                      }}
                      className={`h-2 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                        active
                          ? 'w-7 bg-[var(--rr-accent-solid)]'
                          : 'w-2 bg-[var(--rr-border-strong)] hover:bg-[var(--rr-accent)]'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="font-micro text-[var(--rr-subtle)]">
                Drag card sideways to flick · or press ← → keys
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Monitored Study Zones List */}
      <section
        id="roster"
        aria-label="Monitored study zones roster"
        className="border-t border-[var(--rr-border)] bg-[var(--rr-bg)] px-4 sm:px-8 py-20"
      >
        <div className="mx-auto max-w-[1600px] space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="font-micro text-[var(--rr-accent)]">
                03 / Monitored Study Areas
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--rr-text)]">
                Six Ground-Truth Locations
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[var(--rr-muted)] max-w-md">
              Choose any place below to smoothly zoom the 3D Earth into its live
              2D satellite and radar view.
            </p>
          </div>

          <div className="space-y-2.5">
            {rosterRows.map((row) => (
              <button
                key={row.zoneId}
                type="button"
                data-testid={
                  row.isPrimaryForRegion
                    ? `project-row-${row.regionId}`
                    : `roster-zone-${row.zoneId}`
                }
                onClick={() => triggerDiveIntoGlobe(row.regionId, row.zoneId)}
                className="group w-full rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-surface)]/55 py-4 px-4 sm:px-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-left hover:border-[var(--rr-border-strong)] hover:bg-[var(--rr-surface)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
              >
                <div className="md:col-span-3 flex items-center gap-3">
                  <span className="font-mono text-xs text-[var(--rr-subtle)]">
                    {row.indexStr}
                  </span>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: row.accentHex }}
                  />
                  <span
                    className="font-micro font-semibold"
                    style={{ color: row.accentHex }}
                  >
                    {row.regionCode}
                  </span>
                </div>

                <div className="md:col-span-5 space-y-1">
                  <div className="font-display text-lg sm:text-xl font-bold text-[var(--rr-text)] group-hover:text-[var(--rr-accent)] transition-colors">
                    {row.zoneName}
                  </div>
                  <div className="text-xs text-[var(--rr-muted)] line-clamp-1">
                    {row.plainFocus}
                  </div>
                </div>

                <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-4">
                  <div className="text-left md:text-right">
                    <div className="font-mono text-xs font-bold text-[var(--rr-text)] tabular-nums">
                      {row.metricLabel}
                    </div>
                    <div className="font-mono text-[10px] text-[var(--rr-subtle)]">
                      {row.trackLabel}
                    </div>
                  </div>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--rr-border)] bg-[var(--rr-bg)] text-[var(--rr-text)] group-hover:border-[var(--rr-accent)] group-hover:bg-[var(--rr-accent-solid)] group-hover:text-white transition-all">
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: Orbital Pass & .H5 Granule Dates Table */}
      <section
        id="passes"
        aria-label="Cycle 035 orbital passes and HDF5 granule index"
        className="border-t border-[var(--rr-border)] bg-[var(--rr-surface)] px-4 sm:px-8 py-20"
      >
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="font-micro text-[var(--rr-teal)]">
                04 / Satellite Passes &amp; .H5 Files
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[var(--rr-text)]">
                Verified Cycle 035 Scans
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenAbout}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] px-4 py-2 font-micro text-[var(--rr-text)] hover:border-[var(--rr-accent)] hover:text-[var(--rr-accent)] transition-colors self-start sm:self-auto"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Data Guide</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-bg)]/90 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--rr-border)] bg-[var(--rr-surface-2)]/50 font-micro text-[var(--rr-muted)]">
                  <th className="py-3.5 pl-5 pr-4 font-medium">Orbit / Frame</th>
                  <th className="py-3.5 px-4 font-medium">Study Region</th>
                  <th className="py-3.5 px-4 font-medium">Scan Time (UTC)</th>
                  <th className="py-3.5 px-4 font-medium hidden md:table-cell">
                    Radar Mode
                  </th>
                  <th className="py-3.5 px-4 font-medium text-right">
                    File Size
                  </th>
                  <th className="py-3.5 pl-4 pr-5 font-medium text-right hidden sm:table-cell">
                    File Digest
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rr-border)] text-xs">
                {recordsToShow.map((rec) => {
                  const targetRegionId: RegionId =
                    rec.regionId === 'japan'
                      ? 'japan_gunw'
                      : rec.regionId === 'northeast_india'
                        ? 'northeast_india_gcov'
                        : 'maharashtra_gcov';

                  return (
                    <tr
                      key={rec.fileName}
                      onClick={() => triggerDiveIntoGlobe(targetRegionId)}
                      className="cursor-pointer hover:bg-[var(--rr-surface)]/75 transition-colors"
                    >
                      <td className="py-4 pl-5 pr-4 font-display text-sm sm:text-base font-bold text-[var(--rr-text)] whitespace-nowrap">
                        Track {rec.parsedGranule.rel_orbit} · F
                        {rec.parsedGranule.frame}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-[var(--rr-text)] font-medium">
                          {rec.regionName}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--rr-subtle)] truncate max-w-[260px] sm:max-w-[340px]">
                          {rec.fileName}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-[var(--rr-muted)] tabular-nums whitespace-nowrap">
                        {rec.parsedGranule.start}
                      </td>
                      <td className="py-4 px-4 font-mono text-[var(--rr-muted)] hidden md:table-cell whitespace-nowrap">
                        40+5 MHz · {rec.parsedGranule.polar}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-[var(--rr-accent)] text-right tabular-nums whitespace-nowrap">
                        {rec.fileSizeMB.toLocaleString('en-US', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}{' '}
                        MB
                      </td>
                      <td className="py-4 pl-4 pr-5 font-mono text-[var(--rr-teal)] text-right hidden sm:table-cell whitespace-nowrap">
                        {rec.headerDigest}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
