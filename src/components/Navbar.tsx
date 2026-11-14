import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  Database,
  Globe,
  Moon,
  Radio,
  RefreshCw,
  Sun,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { REGION_DATASETS } from '../data/samples/asfVertexSamples.ts';
import type { ThemeMode } from '../App.tsx';
import {
  DEFAULT_LAPTOP_DB_URL,
  getLaptopDbUrl,
  LAPTOP_DB_EVENT_NAME,
  probeLaptopH5Db,
  setLaptopDbUrl,
  type LaptopDbProbeResult,
} from '../services/nisarApi.ts';
import type { PageViewMode, RegionId } from '../types/sar.ts';

interface NavbarProps {
  pageView: PageViewMode;
  onNavigateHome: () => void;
  onEnterExplorer: () => void;
  activeRegionId: RegionId;
  onSelectRegion: (id: RegionId) => void;
  demoMode: boolean;
  onToggleDemoMode: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenAbout: () => void;
}

const REGION_LINKS: Array<{ id: RegionId; label: string }> = [
  { id: 'maharashtra_gcov', label: 'Maharashtra' },
  { id: 'northeast_india_gcov', label: 'NE India' },
  { id: 'japan_gunw', label: 'Japan' },
];

export function Navbar({
  pageView,
  onNavigateHome,
  onEnterExplorer,
  activeRegionId,
  onSelectRegion,
  demoMode,
  onToggleDemoMode,
  theme,
  onToggleTheme,
  onOpenAbout,
}: NavbarProps) {
  const [isDbPopoverOpen, setIsDbPopoverOpen] = useState(false);
  const [dbUrlInput, setDbUrlInput] = useState<string>(() => getLaptopDbUrl());
  const [isProbing, setIsProbing] = useState(false);
  const [probeState, setProbeState] = useState<LaptopDbProbeResult | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const runProbe = async (urlToTest: string, persistUrl: boolean) => {
    setIsProbing(true);
    const cleaned = persistUrl
      ? setLaptopDbUrl(urlToTest)
      : urlToTest.trim().replace(/\/+$/, '');
    setDbUrlInput(cleaned || DEFAULT_LAPTOP_DB_URL);
    const result = await probeLaptopH5Db(cleaned || DEFAULT_LAPTOP_DB_URL);
    setProbeState(result);
    setIsProbing(false);
  };

  useEffect(() => {
    void runProbe(getLaptopDbUrl(), false);
    const onDbEvent = () => {
      void runProbe(getLaptopDbUrl(), false);
    };
    window.addEventListener(LAPTOP_DB_EVENT_NAME, onDbEvent);
    return () => window.removeEventListener(LAPTOP_DB_EVENT_NAME, onDbEvent);
  }, []);

  useEffect(() => {
    setIsDbPopoverOpen(false);
  }, [pageView, activeRegionId]);

  useEffect(() => {
    if (!isDbPopoverOpen) return;
    const onOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsDbPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [isDbPopoverOpen]);

  const isLaptopConnected = probeState?.connected === true;
  const connectedLabel = probeState
    ? `LIVE DB: ${probeState.host} (${probeState.totalH5FilesFound} .H5 • ${probeState.totalSizeGb.toFixed(2)} GB)`
    : 'LIVE DB: SMIAN_P5 (3 .H5 • 18.04 GB)';
  const activeProductPlain =
    REGION_DATASETS[activeRegionId].productType === 'GUNW'
      ? 'Ground Shift'
      : 'Water Radar';
  const isDark = theme === 'dark';

  return (
    <header className="sticky top-0 z-[1050] h-20 w-full border-b border-[var(--rr-border)] bg-[var(--rr-header-bg)] backdrop-blur-[10px]">
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 px-4 sm:px-8 relative">
        {/* Left Navigation Links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-3 sm:gap-4 min-w-0"
        >
          <button
            type="button"
            onClick={onNavigateHome}
            aria-current={pageView === 'HOME_3D_GLOBE' ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
              pageView === 'HOME_3D_GLOBE'
                ? 'text-[var(--rr-accent)]'
                : 'text-[var(--rr-text)] hover:text-[var(--rr-accent)]'
            }`}
          >
            <Globe className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">3D Earth</span>
          </button>

          <div
            className="hidden md:flex items-center gap-3 border-l border-[var(--rr-border)] pl-3"
            role="group"
            aria-label="Quick study region navigation"
          >
            {REGION_LINKS.map((item) => {
              const active =
                pageView === 'REGION_2D_MAP' && activeRegionId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectRegion(item.id)}
                  className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                    active
                      ? 'text-[var(--rr-accent)] underline underline-offset-4'
                      : 'text-[var(--rr-muted)] hover:text-[var(--rr-text)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onOpenAbout}
            className="hidden sm:inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rr-muted)] hover:text-[var(--rr-text)] border-l border-[var(--rr-border)] pl-3 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            Sources
          </button>
        </nav>

        {/* Brand Mark: Radar Rhythm */}
        <button
          type="button"
          onClick={onNavigateHome}
          aria-label="Return to Radar Rhythm 3D Earth Home"
          className="2xl:absolute 2xl:left-1/2 2xl:-translate-x-1/2 inline-flex items-baseline gap-1 text-[var(--rr-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] px-1 shrink-0"
        >
          <span className="font-serif-editorial text-lg sm:text-2xl leading-none">
            Radar
          </span>
          <span className="text-base sm:text-xl font-black uppercase tracking-[-0.04em] leading-none">
            RHYTHM
          </span>
        </button>

        {/* Right Controls: Live DB Pill + Sample/Live + Dark/Light Toggle + Map CTA */}
        <div className="flex items-center gap-2 shrink-0" ref={popoverRef}>
          {/* Live Laptop DB Status Pill */}
          <div className="relative">
            <button
              type="button"
              data-testid="laptop-db-pill"
              onClick={() => setIsDbPopoverOpen((prev) => !prev)}
              aria-expanded={isDbPopoverOpen}
              aria-label={
                isLaptopConnected
                  ? `${connectedLabel} — click to edit database URL`
                  : 'Local database offline — using built-in data; click to configure URL'
              }
              className={`inline-flex items-center gap-1.5 border px-2 sm:px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.1em] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                isLaptopConnected
                  ? 'border-[var(--rr-success-border)] bg-[var(--rr-success-bg)] text-[var(--rr-success-text)]'
                  : 'border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-text)] hover:border-[var(--rr-border-strong)]'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  isLaptopConnected ? 'bg-[#22C55E]' : 'bg-[#A1A1AA]'
                }`}
              />
              <Database className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">
                {isLaptopConnected ? connectedLabel : 'Local DB (Backup)'}
              </span>
            </button>

            {isDbPopoverOpen && (
              <div
                data-testid="laptop-db-popover"
                role="dialog"
                aria-label="Live Satellite Database Connection"
                className="fixed sm:absolute right-3 sm:right-0 top-20 sm:top-full sm:mt-2 w-[calc(100vw-24px)] sm:w-[390px] border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] p-4 shadow-2xl z-[1200] space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--rr-border)] pb-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rr-text)]">
                      Live Satellite Database
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDbPopoverOpen(false)}
                    aria-label="Close database settings"
                    className="p-1 text-[var(--rr-muted)] hover:text-[var(--rr-text)]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div
                  className={`flex items-center gap-2 border px-2.5 py-2 text-[11px] font-semibold ${
                    isLaptopConnected
                      ? 'border-[var(--rr-success-border)] bg-[var(--rr-success-bg)] text-[var(--rr-success-text)]'
                      : 'border-[var(--rr-warn-border)] bg-[var(--rr-warn-bg)] text-[var(--rr-warn-text)]'
                  }`}
                >
                  {isLaptopConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{connectedLabel}</span>
                    </>
                  ) : (
                    <span>
                      Database unreachable right now — showing built-in satellite data.
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="laptop-db-url-input"
                    className="block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-muted)]"
                  >
                    Database Tunnel URL
                  </label>
                  <input
                    id="laptop-db-url-input"
                    data-testid="laptop-db-url-input"
                    type="url"
                    value={dbUrlInput}
                    onChange={(e) => setDbUrlInput(e.target.value)}
                    placeholder={DEFAULT_LAPTOP_DB_URL}
                    className="w-full border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2 font-mono text-xs text-[var(--rr-text)] focus:border-[var(--rr-accent)] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="laptop-db-connect-btn"
                    onClick={() => void runProbe(dbUrlInput, true)}
                    disabled={isProbing}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 border border-[var(--rr-border-strong)] bg-[var(--rr-surface-inverse)] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rr-text-inverse)] hover:bg-[var(--rr-accent-solid)] hover:border-[var(--rr-accent-solid)] hover:text-white disabled:opacity-60 transition-colors"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${isProbing ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isProbing ? 'Connecting...' : 'Save & Connect'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void runProbe(DEFAULT_LAPTOP_DB_URL, true)}
                    className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-muted)] hover:border-[var(--rr-border-strong)] hover:text-[var(--rr-text)]"
                  >
                    Reset URL
                  </button>
                </div>

                <div className="border-t border-[var(--rr-border)] pt-2 text-[11px] text-[var(--rr-muted)]">
                  Endpoint:{' '}
                  <code className="font-mono text-[var(--rr-text)] break-all">
                    {getLaptopDbUrl()}/api/local-h5
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Sample vs Live NASA Toggle */}
          <button
            type="button"
            onClick={onToggleDemoMode}
            aria-pressed={demoMode}
            title="Switch between built-in sample data and live NASA feeds"
            className={`hidden sm:inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
              demoMode
                ? 'border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-text)] hover:border-[var(--rr-border-strong)]'
                : 'border-[var(--rr-accent)] bg-[var(--rr-accent)]/15 text-[var(--rr-accent)]'
            }`}
          >
            {demoMode ? (
              <WifiOff className="h-3 w-3 text-[var(--rr-muted)]" aria-hidden="true" />
            ) : (
              <Wifi className="h-3 w-3 text-[var(--rr-accent)]" aria-hidden="true" />
            )}
            <span>{demoMode ? 'Sample' : 'Live NASA'}</span>
          </button>

          {/* Dark / Light Theme Switcher */}
          <button
            type="button"
            data-testid="theme-toggle-btn"
            onClick={onToggleTheme}
            aria-pressed={isDark}
            aria-label={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
            className="inline-flex items-center gap-1.5 border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)] hover:border-[var(--rr-border-strong)] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-[#FBBF24]" aria-hidden="true" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-[#0066FF]" aria-hidden="true" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Header CTA Pill */}
          <button
            type="button"
            onClick={pageView === 'HOME_3D_GLOBE' ? onEnterExplorer : onNavigateHome}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rr-border-strong)] bg-[var(--rr-surface)] px-3 sm:px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)] hover:bg-[var(--rr-accent-solid)] hover:border-[var(--rr-accent-solid)] hover:text-white transition-colors duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            {pageView === 'HOME_3D_GLOBE' ? (
              <>
                <Radio className="h-3 w-3 text-[var(--rr-accent)]" aria-hidden="true" />
                <span>2D Map ({activeProductPlain})</span>
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" aria-hidden="true" />
                <span>3D Earth</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
