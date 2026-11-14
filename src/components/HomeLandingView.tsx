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

  // Scroll-bound portal & statement rotation driven via rAF
  useEffect(() => {
    let ticking = false;
    const updateScrollMetrics = () => {
      ticking = false;
      const y = window.scrollY || 0;
      setGlobalScrollDeg((y * 0.14) % 360);

      const portalEl = portalRef.current;
      if (!portalEl) return;
      const rect = portalEl.getBoundingClientRect();
      // Shutter opens rapidly across first ~680px so shutters clear well past 350px within 700px scroll
      const travelDist = Math.max(460, Math.min(rect.height - window.innerHeight, 680));
      const scrolledPastTop = Math.max(0, -rect.top);
      const nextProgress = Math.max(0, Math.min(1, scrolledPastTop / travelDist));
      setPortalProgress(nextProgress);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateScrollMetrics);
      }
    };

    updateScrollMetrics();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
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
        indexLabel: 'SLEEVE 01 / 04',
        regionId: 'maharashtra_gcov',
        zoneId: 'mh_gosikhurd',
        accentHex: '#E8913C',
        kicker: 'GCOV · WATER & CROPS · INDIA',
        title: 'Maharashtra Spillway & Cotton Belt',
        subtitle:
          'Spots calm standing floodwater near Gosikhurd Dam and measures soaked black-cotton topsoil in Wardha.',
        metricBadge: `${(mh?.hhFloodMinDb ?? -21.4).toFixed(1)} dB HH · ${Math.round((mh?.soilMoistureIndex ?? 0.78) * 100)}% MOIST`,
        trackLabel: `TRACK ${mh?.parsedGranule.rel_orbit ?? '084'} · FRAME ${mh?.parsedGranule.frame ?? '013'}`,
        fileSizeLabel: `${((mh?.fileSizeMB ?? 6388) / 1000).toFixed(2)} GB .H5`,
      },
      {
        key: 'sleeve-ne',
        indexLabel: 'SLEEVE 02 / 04',
        regionId: 'northeast_india_gcov',
        zoneId: 'ne_kaziranga',
        accentHex: '#4DB8C4',
        kicker: 'GCOV · MONSOON FLOODS · INDIA',
        title: 'Brahmaputra & Kaziranga Wetlands',
        subtitle:
          'Pierces 95%+ monsoon storm clouds to track flooded riverbanks and inundated rhino sanctuary grasslands.',
        metricBadge: `${(ne?.hhFloodMinDb ?? -23.0).toFixed(1)} dB HH · ${Math.round((ne?.soilMoistureIndex ?? 0.82) * 100)}% WET`,
        trackLabel: `TRACK ${ne?.parsedGranule.rel_orbit ?? '098'} · FRAME ${ne?.parsedGranule.frame ?? '013'}`,
        fileSizeLabel: `${((ne?.fileSizeMB ?? 6520) / 1000).toFixed(2)} GB .H5`,
      },
      {
        key: 'sleeve-jp',
        indexLabel: 'SLEEVE 03 / 04',
        regionId: 'japan_gunw',
        zoneId: 'jp_noto',
        accentHex: '#E8913C',
        kicker: 'GUNW · CRUSTAL MOTION · JAPAN',
        title: 'Noto Peninsula & Toyama Bay Faults',
        subtitle:
          'Measures centimeter-scale ground uplift and coastal sinking after earthquakes with 81% phase coherence.',
        metricBadge: `${(jp?.losDisplacementCm ?? -18.6).toFixed(1)} cm LOS · γ ${(jp?.coherenceMean ?? 0.81).toFixed(2)}`,
        trackLabel: `TRACK ${jp?.parsedGranule.rel_orbit ?? '009'} · FRAME ${jp?.parsedGranule.frame ?? '024'}`,
        fileSizeLabel: `${((jp?.fileSizeMB ?? 5132) / 1000).toFixed(2)} GB .H5`,
      },
      {
        key: 'sleeve-archive',
        indexLabel: 'SLEEVE 04 / 04',
        regionId: 'maharashtra_gcov',
        zoneId: 'mh_wardha',
        accentHex: '#4DB8C4',
        kicker: 'SMIAN_P5 · LIVE .H5 ARCHIVE',
        title: `${recordsToShow.length} Verified Granules · ${totalGb} GB`,
        subtitle:
          'Direct HDF5 magic-byte headers & live disk slices served straight from local storage with instant offline fallback.',
        metricBadge: '100% HDF5 MAGIC · SHA-256',
        trackLabel: 'CYCLE 035 · 40+5 MHz DHDH',
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
        regionId === 'northeast_india_gcov' ? '#4DB8C4' : '#E8913C';
      const regionCode =
        regionId === 'maharashtra_gcov'
          ? 'MAHARASHTRA · GCOV'
          : regionId === 'northeast_india_gcov'
            ? 'NE INDIA · GCOV'
            : 'JAPAN · GUNW';

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
      }, 240);
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
    <div className="bg-[#0A0C0E] text-[#EDE7DC] overflow-x-clip">
      {/* SECTION 1: Scroll-Bound 240vh Portal Hero */}
      <section
        id="portal"
        ref={portalRef}
        aria-label="Orbital Portal Earth Hero"
        className="relative h-[240vh] bg-[#0A0C0E]"
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden isolate">
          {/* Back Layer: Interactive Google-Earth 3D Globe */}
          <div
            className="absolute inset-0 will-change-transform"
            style={{
              transform: `scale(${(1.12 - portalProgress * 0.12).toFixed(4)})`,
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

            {/* Subtle Duotone Atmospheric Wash + Radial Vignette */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(232, 145, 60, 0.22) 0%, rgba(10, 12, 14, 0) 48%, rgba(46, 107, 114, 0.24) 100%)',
                opacity: portalProgress * 0.18,
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, rgba(10,12,14,0) 44%, rgba(10,12,14,0.72) 100%)',
              }}
            />
          </div>

          {/* Middle Layer: Two 51vw Shutters with 1px Hairline Seam */}
          <div
            aria-hidden="true"
            className={`absolute inset-0 flex justify-between ${
              shuttersClear ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <div
              data-testid="portal-shutter-left"
              className="h-full w-[51vw] bg-[#0A0C0E] border-r border-[rgba(237,231,220,0.13)] will-change-transform"
              style={{
                transform: `translate3d(calc(-4vw - ${(portalProgress * 105).toFixed(2)}%), 0, 0)`,
              }}
            />
            <div
              data-testid="portal-shutter-right"
              className="h-full w-[51vw] bg-[#0A0C0E] border-l border-[rgba(237,231,220,0.13)] will-change-transform"
              style={{
                transform: `translate3d(calc(4vw + ${(portalProgress * 105).toFixed(2)}%), 0, 0)`,
              }}
            />
          </div>

          {/* Two 6px Center Accent Dots Drifting Toward Opposite Corners */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <span
              className="absolute h-[6px] w-[6px] rounded-full bg-[#E8913C]"
              style={{
                transform: `translate3d(${(-portalProgress * 42).toFixed(1)}vw, ${(-portalProgress * 34).toFixed(1)}vh, 0)`,
                opacity: Math.max(0.15, 1 - portalProgress * 0.85),
              }}
            />
            <span
              className="absolute h-[6px] w-[6px] rounded-full bg-[#2E6B72]"
              style={{
                transform: `translate3d(${(portalProgress * 42).toFixed(1)}vw, ${(portalProgress * 34).toFixed(1)}vh, 0)`,
                opacity: Math.max(0.15, 1 - portalProgress * 0.85),
              }}
            />
          </div>

          {/* Top Layer: Split Syne 800 Title */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 sm:px-4">
            <h1
              className="font-display font-extrabold text-[#EDE7DC] uppercase select-none flex items-center justify-center gap-2 sm:gap-5 will-change-transform"
              style={{
                fontSize: 'clamp(26px, 6.6vw, 106px)',
                lineHeight: 0.9,
                letterSpacing: `${(0.04 - portalProgress * 0.07).toFixed(4)}em`,
                transform: `scale(${(1 + portalProgress * 0.16).toFixed(4)})`,
                opacity: Math.max(0.08, 1 - portalProgress * 0.92),
              }}
            >
              <span
                className="inline-block will-change-transform"
                style={{
                  transform: `translate3d(${(-portalProgress * 24).toFixed(2)}vw, 0, 0)`,
                }}
              >
                NISAR
              </span>
              <span
                className="inline-block will-change-transform"
                style={{
                  transform: `translate3d(${(portalProgress * 24).toFixed(2)}vw, 0, 0)`,
                }}
              >
                PULSE<span className="text-[#E8913C]">.</span>
              </span>
            </h1>
          </div>

          {/* Corner Metadata Pinned Cleanly to Frame Edges (Clears 58px Fixed Navbar & Mobile Stack) */}
          <div className="pointer-events-none absolute top-[68px] sm:top-[74px] left-4 right-4 sm:left-8 sm:right-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <span className="font-micro text-[#9EA5A8]">
              01 / L-BAND 24 CM INTERFEROMETRY
            </span>
            <span className="font-micro text-[#E8913C] sm:text-right">
              CYCLE 035 · {recordsToShow.length} .H5 ({totalGb} GB)
            </span>
          </div>

          <div className="pointer-events-none absolute bottom-[68px] sm:bottom-5 left-4 sm:left-8 font-micro text-[#9EA5A8] max-w-[65vw]">
            {shuttersClear
              ? 'ORBITAL PORTAL OPEN · CLICK TARGET RING'
              : 'SCROLL TO PART ORBITAL SHUTTERS'}
          </div>

          {!shuttersClear && (
            <div className="absolute bottom-[102px] left-4 sm:bottom-5 sm:left-1/2 sm:-translate-x-1/2 z-20">
              <button
                type="button"
                data-testid="skip-portal-btn"
                onClick={handleSkipPortal}
                className="rounded-full border border-[rgba(237,231,220,0.32)] bg-[#0A0C0E]/92 px-3.5 sm:px-4 py-1.5 font-micro text-[#EDE7DC] hover:border-[#E8913C] hover:text-[#E8913C] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
              >
                SKIP PORTAL / INTERACT WITH GLOBE
              </button>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: Statement Fold */}
      <section
        aria-label="Mission physics statement"
        className="min-h-[85vh] border-t border-[rgba(237,231,220,0.13)] bg-[#0A0C0E] px-4 sm:px-8 py-20 sm:py-28 flex items-center"
      >
        <div className="mx-auto w-full max-w-[1600px] grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8 space-y-6">
            <div className="font-micro text-[#E8913C]">
              01 / ACTIVE MICROWAVE INTERFEROMETRY
            </div>
            <h2
              className="font-display font-bold tracking-[-0.025em] leading-[1.06] text-[#EDE7DC] max-w-[22ch]"
              style={{ fontSize: 'clamp(24px, 3.6vw, 52px)' }}
            >
              Twenty-four centimeter radar echoes see straight through monsoon
              storms, flooded paddy deltas, and shifting coastal fault lines—{' '}
              <span className="text-[#E8913C]">day or night, zero clouds.</span>
            </h2>
            <p className="text-sm sm:text-base text-[#9EA5A8] max-w-2xl leading-relaxed">
              Every 12 days, NASA-ISRO NISAR sweeps India and the Pacific Rim in
              dual polarization (HH + HV) to detect mirror-flat floodwater,
              soaked crop soils, and centimeter-level earthquake ground shift.
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
            <div className="flex items-center gap-4">
              <div
                aria-hidden="true"
                className="h-24 w-24 sm:h-28 sm:w-28 will-change-transform"
                style={{ transform: `rotate(${globalScrollDeg.toFixed(1)}deg)` }}
              >
                <svg viewBox="0 0 120 120" className="h-full w-full">
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    fill="none"
                    stroke="rgba(237,231,220,0.22)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="38"
                    fill="none"
                    stroke="#E8913C"
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="22"
                    fill="none"
                    stroke="#2E6B72"
                    strokeWidth="1.4"
                  />
                  <line
                    x1="60"
                    y1="6"
                    x2="60"
                    y2="114"
                    stroke="rgba(237,231,220,0.16)"
                    strokeWidth="1"
                  />
                  <line
                    x1="6"
                    y1="60"
                    x2="114"
                    y2="60"
                    stroke="rgba(237,231,220,0.16)"
                    strokeWidth="1"
                  />
                  <circle cx="60" cy="6" r="3" fill="#E8913C" />
                  <circle cx="98" cy="60" r="2.5" fill="#4DB8C4" />
                </svg>
              </div>
              <div className="font-micro text-[#9EA5A8] space-y-1">
                <div className="text-[#EDE7DC]">CYCLE 035 SEAL</div>
                <div>2π = 12.0 CM LOS</div>
                <div>DHDH POLARIMETRY</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: Releases & Physical Throwable Card Deck */}
      <section
        id="catalogue"
        aria-label="Cycle 035 Orbital Sleeves"
        className="border-t border-[rgba(237,231,220,0.13)] bg-[#101317] px-4 sm:px-8 py-20 sm:py-24"
      >
        <div className="mx-auto max-w-[1600px] grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Editorial Info & Controls */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="font-micro text-[#E8913C]">
                02 / RELEASE CATALOGUE · SMIAN_P5
              </div>
              <h2 className="font-display text-3xl sm:text-5xl font-bold tracking-[-0.025em] text-[#EDE7DC]">
                Cycle 035 Orbital Sleeves
              </h2>
              <p className="text-sm text-[#9EA5A8] leading-relaxed">
                Throw through the physical orbital sleeves to inspect each
                verified NASA HDF5 capture ({totalGb} GB across{' '}
                {recordsToShow.length} live granules) or dive directly into the
                2D Leaflet radar map.
              </p>
            </div>

            {/* Active Top Sleeve Summary Strip */}
            <div className="border-y border-[rgba(237,231,220,0.13)] py-4 space-y-2">
              <div className="flex items-center justify-between gap-2 font-micro">
                <span style={{ color: topSleeve.accentHex }}>
                  {topSleeve.indexLabel}
                </span>
                <span className="font-mono text-[#9EA5A8]">
                  {topSleeve.fileSizeLabel}
                </span>
              </div>
              <div className="font-display text-xl font-bold text-[#EDE7DC]">
                {topSleeve.title}
              </div>
              <p className="text-xs text-[#9EA5A8] leading-relaxed">
                {topSleeve.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  triggerDiveIntoGlobe(topSleeve.regionId, topSleeve.zoneId)
                }
                className="inline-flex items-center gap-2 border border-[#E8913C] px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#E8913C] hover:bg-[#9A4A0B] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
              >
                <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Dive Into 2D Map</span>
              </button>
              <button
                type="button"
                data-testid="cycle-next-sleeve-btn"
                onClick={() => cycleSleeve(1)}
                className="inline-flex items-center gap-2 border border-[rgba(237,231,220,0.2)] px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#EDE7DC] hover:border-[#2E6B72] hover:text-[#4DB8C4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
              >
                <span>Cycle Next Sleeve</span>
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
              aria-label="Interactive Cycle 035 Orbital Sleeve Deck. Drag sideways or press Left and Right arrow keys."
              onPointerDown={handleDeckPointerDown}
              onPointerMove={handleDeckPointerMove}
              onPointerUp={handleDeckPointerEnd}
              onPointerCancel={handleDeckPointerEnd}
              onKeyDown={handleDeckKeyDown}
              style={{ touchAction: 'pan-y' }}
              className="relative aspect-square w-full max-w-[440px] select-none cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
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
                        ? 3.2
                        : stackPos === 2
                          ? -2.8
                          : 5.0;
                  const baseTranslateX = stackPos * 7;
                  const baseTranslateY = stackPos * 7;
                  const baseScale = 1 - stackPos * 0.032;

                  let transformStr = `translate3d(${baseTranslateX}px, ${baseTranslateY}px, 0) scale(${baseScale}) rotate(${baseRotate}deg)`;
                  let cardOpacity = Math.max(0.55, 1 - stackPos * 0.14);

                  if (isTop) {
                    if (flingDir !== 0) {
                      transformStr = `translate3d(${flingDir * 460}px, -28px, 0) scale(0.95) rotate(${flingDir * 16}deg)`;
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
                            : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease',
                        boxShadow: '0 24px 52px rgba(0, 0, 0, 0.56)',
                      }}
                      className="absolute inset-0 flex flex-col justify-between border border-[rgba(237,231,220,0.2)] bg-[#14181D] p-6 sm:p-7"
                    >
                      {/* Top Record Sleeve Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-[rgba(237,231,220,0.13)] pb-3">
                        <div>
                          <div
                            className="font-micro font-semibold"
                            style={{ color: card.accentHex }}
                          >
                            {card.kicker}
                          </div>
                          <div className="font-mono text-[10px] text-[#9EA5A8] mt-1">
                            {card.trackLabel}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] border border-[rgba(237,231,220,0.16)] px-2 py-0.5 text-[#EDE7DC]">
                          {card.indexLabel}
                        </span>
                      </div>

                      {/* Center Radar Disc Graphic */}
                      <div className="my-auto flex flex-col items-start gap-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: card.accentHex }}
                          />
                          <span className="font-mono text-xs font-bold text-[#EDE7DC] tracking-wider">
                            {card.metricBadge}
                          </span>
                        </div>
                        <h3 className="font-display text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] leading-[1.08] text-[#EDE7DC]">
                          {card.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-[#9EA5A8] leading-relaxed">
                          {card.subtitle}
                        </p>
                      </div>

                      {/* Bottom Sleeve Footer */}
                      <div className="flex items-center justify-between gap-3 border-t border-[rgba(237,231,220,0.13)] pt-3.5">
                        <span className="font-mono text-[11px] font-bold text-[#9EA5A8]">
                          {card.fileSizeLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            triggerDiveIntoGlobe(card.regionId, card.zoneId)
                          }
                          className="inline-flex items-center gap-1.5 border border-[#E8913C] px-3 py-1.5 font-micro text-[#E8913C] hover:bg-[#9A4A0B] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
                        >
                          <span>DIVE INTO 2D MAP</span>
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
                      className={`h-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C] ${
                        active
                          ? 'w-6 bg-[#E8913C]'
                          : 'w-2 bg-[rgba(237,231,220,0.22)] hover:bg-[#9EA5A8]'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="font-micro text-[#6C7378]">
                DRAG SLEEVE TO THROW · OR PRESS ← → ARROWS
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Hairline Roster Across All Study Zones */}
      <section
        id="roster"
        aria-label="Monitored study zones roster"
        className="border-t border-[rgba(237,231,220,0.13)] bg-[#0A0C0E] px-4 sm:px-8 py-20"
      >
        <div className="mx-auto max-w-[1600px] space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="font-micro text-[#E8913C]">
                03 / ACTIVE STUDY ROSTER
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#EDE7DC]">
                Six Ground-Truth Monitoring Zones
              </h2>
            </div>
            <p className="text-xs text-[#9EA5A8] max-w-md">
              Select any study zone below to dive the 3D Earth into that
              basin’s live 2D radar and satellite split view.
            </p>
          </div>

          <div className="border-t border-[rgba(237,231,220,0.13)]">
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
                className="group w-full border-b border-[rgba(237,231,220,0.13)] py-5 px-2 sm:px-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-left hover:bg-[#101317] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
              >
                <div className="md:col-span-3 flex items-center gap-3">
                  <span className="font-mono text-xs text-[#6C7378]">
                    {row.indexStr}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
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
                  <div className="font-display text-lg sm:text-xl font-bold text-[#EDE7DC] group-hover:text-[#E8913C] transition-colors">
                    {row.zoneName}
                  </div>
                  <div className="text-xs text-[#9EA5A8] line-clamp-1">
                    {row.plainFocus}
                  </div>
                </div>

                <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-4">
                  <div className="text-left md:text-right">
                    <div className="font-mono text-xs font-bold text-[#EDE7DC] tabular-nums">
                      {row.metricLabel}
                    </div>
                    <div className="font-mono text-[10px] text-[#6C7378]">
                      {row.trackLabel}
                    </div>
                  </div>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[rgba(237,231,220,0.16)] text-[#EDE7DC] group-hover:border-[#E8913C] group-hover:text-[#E8913C] transition-colors">
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
        className="border-t border-[rgba(237,231,220,0.13)] bg-[#101317] px-4 sm:px-8 py-20"
      >
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="font-micro text-[#4DB8C4]">
                04 / ORBITAL PASS &amp; .H5 GRANULE DATES
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#EDE7DC]">
                Verified Cycle 035 Acquisitions
              </h2>
            </div>
            <button
              type="button"
              onClick={onOpenAbout}
              className="inline-flex items-center gap-1.5 border border-[rgba(237,231,220,0.2)] px-3.5 py-2 font-micro text-[#EDE7DC] hover:border-[#E8913C] hover:text-[#E8913C] transition-colors self-start sm:self-auto"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              <span>VIEW HDF5 SCHEMA SPEC</span>
            </button>
          </div>

          <div className="overflow-x-auto border-y border-[rgba(237,231,220,0.13)]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[rgba(237,231,220,0.13)] font-micro text-[#9EA5A8]">
                  <th className="py-3.5 pr-4 font-medium">ORBIT / FRAME</th>
                  <th className="py-3.5 px-4 font-medium">STUDY BASIN</th>
                  <th className="py-3.5 px-4 font-medium">ACQUISITION UTC</th>
                  <th className="py-3.5 px-4 font-medium hidden md:table-cell">
                    BAND / POL
                  </th>
                  <th className="py-3.5 px-4 font-medium text-right">
                    FILE SIZE
                  </th>
                  <th className="py-3.5 pl-4 font-medium text-right hidden sm:table-cell">
                    HEADER DIGEST
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(237,231,220,0.1)] text-xs">
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
                      className="cursor-pointer hover:bg-[#14181D] transition-colors"
                    >
                      <td className="py-4 pr-4 font-display text-sm sm:text-base font-bold text-[#EDE7DC] whitespace-nowrap">
                        Track {rec.parsedGranule.rel_orbit} · F
                        {rec.parsedGranule.frame}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-[#EDE7DC] font-medium">
                          {rec.regionName}
                        </div>
                        <div className="font-mono text-[10px] text-[#6C7378] truncate max-w-[260px] sm:max-w-[340px]">
                          {rec.fileName}
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-[#9EA5A8] tabular-nums whitespace-nowrap">
                        {rec.parsedGranule.start}
                      </td>
                      <td className="py-4 px-4 font-mono text-[#9EA5A8] hidden md:table-cell whitespace-nowrap">
                        40+5 MHz · {rec.parsedGranule.polar}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-[#E8913C] text-right tabular-nums whitespace-nowrap">
                        {rec.fileSizeMB.toLocaleString('en-US', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}{' '}
                        MB
                      </td>
                      <td className="py-4 pl-4 font-mono text-[#4DB8C4] text-right hidden sm:table-cell whitespace-nowrap">
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
