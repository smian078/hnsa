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
  { id: 'maharashtra_gcov', label: 'MAHARASHTRA' },
  { id: 'northeast_india_gcov', label: 'NE INDIA' },
  { id: 'japan_gunw', label: 'JAPAN' },
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
      className="fixed top-0 left-0 right-0 z-[1050] h-[58px] w-full border-b border-[rgba(237,231,220,0.13)] bg-[rgba(10,12,14,0.78)] text-[#EDE7DC]"
      style={{ backdropFilter: 'blur(14px)' }}
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between gap-2 sm:gap-4 px-3 sm:px-8 relative">
        {/* Left: Syne Display Wordmark */}
        <button
          type="button"
          onClick={onNavigateHome}
          aria-label="Return to NISAR Pulse 3D Earth Portal"
          className="font-display text-[13px] sm:text-[15px] font-extrabold tracking-[-0.025em] text-[#EDE7DC] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
        >
          NISAR PULSE<span className="text-[#E8913C]">.</span>
        </button>

        {/* Center/Right: Editorial Navigation Links + Utility Triggers + Single Pill CTA */}
        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 min-w-0" ref={popoverRef}>
          <nav
            aria-label="Primary portal navigation"
            className="hidden md:flex items-center gap-5 lg:gap-6"
          >
            {pageView === 'HOME_3D_GLOBE' ? (
              <>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('portal')}
                  className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#9EA5A8] hover:text-[#E8913C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
                >
                  01 PORTAL
                </button>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('catalogue')}
                  className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#9EA5A8] hover:text-[#E8913C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
                >
                  02 CATALOGUE
                </button>
                <button
                  type="button"
                  onClick={() => scrollToHomeSection('roster')}
                  className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#9EA5A8] hover:text-[#E8913C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
                >
                  03 ROSTER &amp; PASSES
                </button>
                <button
                  type="button"
                  onClick={onEnterExplorer}
                  className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#EDE7DC] hover:text-[#E8913C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
                >
                  04 2D RADAR MAP
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onNavigateHome}
                  className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#9EA5A8] hover:text-[#E8913C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
                >
                  01 PORTAL
                </button>
                {REGION_LINKS.map((item) => {
                  const active = activeRegionId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectRegion(item.id)}
                      className={`text-[10.5px] font-medium uppercase tracking-[0.14em] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C] ${
                        active
                          ? 'text-[#E8913C] underline underline-offset-4'
                          : 'text-[#9EA5A8] hover:text-[#E8913C]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={onOpenAbout}
                  className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#9EA5A8] hover:text-[#E8913C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
                >
                  DATA SOURCES
                </button>
              </>
            )}
          </nav>

          {/* Compact SMIAN_P5 DB Status Trigger + Theme Icon + Single Pill Action */}
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
                className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#9EA5A8] hover:text-[#E8913C] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    isLaptopConnected ? 'bg-[#6EE7B7]' : 'bg-[#E8913C]'
                  }`}
                />
                <span className="hidden lg:inline">
                  {isLaptopConnected ? 'SMIAN_P5 LIVE' : 'SMIAN_P5 CACHE'}
                </span>
                <span className="lg:hidden">DB</span>
              </button>

              {isDbPopoverOpen && (
                <div
                  data-testid="laptop-db-popover"
                  role="dialog"
                  aria-label="Live Satellite Database Connection"
                  className="fixed sm:absolute right-3 sm:right-0 top-[58px] sm:top-full sm:mt-3 w-[calc(100vw-24px)] sm:w-[390px] border border-[rgba(232,145,60,0.45)] bg-[#101317] p-4 shadow-2xl z-[1200] space-y-3 text-[#EDE7DC]"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[rgba(237,231,220,0.13)] pb-2">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-[#E8913C]" aria-hidden="true" />
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                        SMIAN_P5 Laptop .H5 Server
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDbPopoverOpen(false)}
                      aria-label="Close database settings"
                      className="p-1 text-[#9EA5A8] hover:text-[#EDE7DC]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div
                    className={`flex items-center gap-2 border px-2.5 py-2 text-[11px] font-medium ${
                      isLaptopConnected
                        ? 'border-[#2E6B72] bg-[#0C231D] text-[#6EE7B7]'
                        : 'border-[#E8913C]/50 bg-[#261808] text-[#F5B873]'
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
                      className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[#9EA5A8]"
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
                      className="w-full border border-[rgba(237,231,220,0.13)] bg-[#0A0C0E] px-2.5 py-2 font-mono text-xs text-[#EDE7DC] focus:border-[#E8913C] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="laptop-db-connect-btn"
                      onClick={() => void runProbe(dbUrlInput, true)}
                      disabled={isProbing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 border border-[#E8913C] bg-[#0A0C0E] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#E8913C] hover:bg-[#9A4A0B] hover:text-white disabled:opacity-60 transition-colors"
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
                      className="border border-[rgba(237,231,220,0.13)] bg-[#0A0C0E] px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9EA5A8] hover:text-[#EDE7DC]"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="border-t border-[rgba(237,231,220,0.13)] pt-2 text-[11px] text-[#9EA5A8]">
                    Endpoint:{' '}
                    <code className="font-mono text-[#EDE7DC] break-all">
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
              className="p-1.5 text-[#9EA5A8] hover:text-[#E8913C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            {/* Single Pill Action Button */}
            <button
              type="button"
              onClick={onToggleDemoMode}
              aria-pressed={!demoMode}
              title="Toggle between Sample Mode and Live NASA API Feeds"
              className="rounded-full border border-[rgba(237,231,220,0.22)] px-2.5 sm:px-3.5 py-1 text-[9.5px] sm:text-[10.5px] font-medium uppercase tracking-[0.12em] sm:tracking-[0.14em] text-[#EDE7DC] hover:border-[#E8913C] hover:text-[#E8913C] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
            >
              <span className="hidden sm:inline">
                {demoMode ? 'SAMPLE · LIVE NASA' : 'LIVE NASA ON'}
              </span>
              <span className="sm:hidden">
                {demoMode ? 'SAMPLE' : 'LIVE NASA'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
