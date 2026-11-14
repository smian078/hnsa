import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Moon,
  RefreshCw,
  Sun,
  X,
} from 'lucide-react';
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
  const isDark = theme === 'dark';

  const scrollToHomeSection = (sectionId: string) => {
    if (pageView !== 'HOME_3D_GLOBE') {
      onNavigateHome();
      window.setTimeout(() => {
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
      return;
    }
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-[1050] h-[58px] w-full border-b border-[var(--rr-border)] text-[var(--rr-text)] transition-colors duration-300"
      style={{
        backgroundColor: 'var(--rr-header-bg)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 sm:gap-4 px-3 sm:px-8 relative">
        {/* Left: Clean Brand Wordmark */}
        <button
          type="button"
          onClick={onNavigateHome}
          aria-label="Return to Radar Rhythm 3D Earth Portal"
          className="font-display text-[15px] sm:text-[17px] font-bold tracking-[-0.02em] text-[var(--rr-text)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] rounded-lg px-1"
        >
          Radar Rhythm<span className="text-[var(--rr-accent)]">.</span>
        </button>

        {/* Center/Right: Calm Navigation Links + Utility Triggers */}
        <div
          className="flex items-center gap-2 sm:gap-4 lg:gap-6 min-w-0"
          ref={popoverRef}
        >
          <nav
            aria-label="Primary portal navigation"
            className="hidden md:flex items-center gap-4 lg:gap-6"
          >
            {pageView === 'HOME_3D_GLOBE' ? (
              <>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('portal')}
                  className="text-xs font-medium text-[var(--rr-muted)] hover:text-[var(--rr-accent)] transition-colors whitespace-nowrap shrink-0 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  01 Earth Portal
                </button>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('catalogue')}
                  className="text-xs font-medium text-[var(--rr-muted)] hover:text-[var(--rr-accent)] transition-colors whitespace-nowrap shrink-0 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  02 Captures
                </button>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('roster')}
                  className="text-xs font-medium text-[var(--rr-muted)] hover:text-[var(--rr-accent)] transition-colors whitespace-nowrap shrink-0 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  03 Regions &amp; Passes
                </button>
                <button
                  type="button"
                  onClick={onEnterExplorer}
                  className="text-xs font-semibold text-[var(--rr-accent)] hover:text-[var(--rr-teal)] transition-colors whitespace-nowrap shrink-0 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  04 2D Radar Map
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="text-xs font-medium text-[var(--rr-muted)] hover:text-[var(--rr-accent)] transition-colors whitespace-nowrap shrink-0 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  3D Earth
                </button>
                {REGION_LINKS.map((item) => {
                  const active = activeRegionId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectRegion(item.id)}
                      className={`text-xs font-medium transition-colors whitespace-nowrap shrink-0 rounded-full px-3 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                        active
                          ? 'bg-[var(--rr-accent-solid)] text-white'
                          : 'text-[var(--rr-muted)] hover:text-[var(--rr-accent)]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onOpenAbout}
                  className="text-xs font-medium text-[var(--rr-muted)] hover:text-[var(--rr-accent)] transition-colors whitespace-nowrap shrink-0 rounded-lg px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  Data Sources
                </button>
              </>
            )}
          </nav>

          {/* Compact SMIAN_P5 DB Status Trigger + Theme Icon + Pill Action */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative">
              <button
                type="button"
                data-testid="laptop-db-pill"
                onClick={() => setIsDbPopoverOpen((prev) => !prev)}
                aria-expanded={isDbPopoverOpen}
                aria-label={
                  isLaptopConnected
                    ? `${connectedLabel} — click to configure database URL`
                    : 'Local database offline — using verified sample; click to configure URL'
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--rr-text)] hover:border-[var(--rr-border-strong)] transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
              >
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${
                    isLaptopConnected
                      ? 'bg-[var(--rr-teal)]'
                      : 'bg-[var(--rr-warm)]'
                  }`}
                />
                <span className="hidden lg:inline">
                  {isLaptopConnected ? 'SMIAN_P5 Live' : 'SMIAN_P5 Cache'}
                </span>
                <span className="lg:hidden">DB</span>
              </button>

              {isDbPopoverOpen && (
                <div
                  data-testid="laptop-db-popover"
                  role="dialog"
                  aria-label="Live Satellite Database Connection"
                  className="fixed sm:absolute right-3 sm:right-0 top-[64px] sm:top-full sm:mt-3 w-[calc(100vw-24px)] sm:w-[390px] rounded-2xl border border-[var(--rr-border)] bg-[var(--rr-bg)] p-4 shadow-xl z-[1200] space-y-3 text-[var(--rr-text)]"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--rr-border)] pb-2.5">
                    <div className="flex items-center gap-2">
                      <Database
                        className="h-4 w-4 text-[var(--rr-accent)]"
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-[var(--rr-text)]">
                        SMIAN_P5 Laptop .H5 Server
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDbPopoverOpen(false)}
                      aria-label="Close database settings"
                      className="rounded-full p-1 text-[var(--rr-muted)] hover:bg-[var(--rr-surface)] hover:text-[var(--rr-text)] transition-colors"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
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
                        Laptop tunnel offline — serving verified Cycle 035 baselines.
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="laptop-db-url-input"
                      className="block text-[11px] font-medium text-[var(--rr-muted)]"
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
                      className="w-full rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2 font-mono text-xs text-[var(--rr-text)] focus:border-[var(--rr-accent)] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="laptop-db-connect-btn"
                      onClick={() => void runProbe(dbUrlInput, true)}
                      disabled={isProbing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--rr-accent-solid)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
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
                      className="rounded-full border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3.5 py-2 text-xs font-medium text-[var(--rr-muted)] hover:text-[var(--rr-text)] transition-colors"
                    >
                      Reset
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

            <button
              type="button"
              data-testid="theme-toggle-btn"
              onClick={onToggleTheme}
              aria-pressed={isDark}
              aria-label={isDark ? 'Switch to Light theme' : 'Switch to Dark theme'}
              className="rounded-full p-2 text-[var(--rr-muted)] hover:bg-[var(--rr-surface)] hover:text-[var(--rr-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={onToggleDemoMode}
              aria-pressed={!demoMode}
              title="Toggle between Sample Mode and Live NASA API Feeds"
              className="rounded-full border border-[var(--rr-border-strong)] bg-[var(--rr-surface)] px-3 sm:px-3.5 py-1 text-[11px] font-medium text-[var(--rr-text)] hover:bg-[var(--rr-accent-solid)] hover:border-[var(--rr-accent-solid)] hover:text-white transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
            >
              <span className="hidden sm:inline">
                {demoMode ? 'Sample · Live NASA' : 'Live NASA On'}
              </span>
              <span className="sm:hidden">
                {demoMode ? 'Sample' : 'Live'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
