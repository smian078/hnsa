import { ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onOpenAbout: () => void;
  onOpenExplorer?: () => void;
}

export function Footer({ onOpenAbout, onOpenExplorer }: FooterProps) {
  return (
    <footer className="relative overflow-hidden bg-survey-surface text-survey-ink border-t border-survey-border transition-colors duration-200">
      {/* Top Close Section */}
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 pt-14 pb-8 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-survey-border">
          <div className="space-y-3 max-w-2xl">
            <div className="font-micro text-survey-muted">
              NASA Space Apps Challenge 2026 · Dancing with the SARs
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-[-0.015em] text-survey-ink">
              Clear cloud-piercing radar maps for floods, farms, and active faults.
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed text-survey-muted">
              Built with open NASA &amp; ISRO NISAR / ASF / Earthdata / GIBS / POWER data. NASA does not endorse this application.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onOpenExplorer && (
              <button
                type="button"
                onClick={onOpenExplorer}
                className="inline-flex items-center gap-2 rounded-lg bg-survey-basalt px-5 py-2.5 text-xs font-semibold text-survey-basalt-text hover:opacity-90 transition-opacity whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
              >
                <span>Open 2D Radar Map</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAbout}
              className="inline-flex items-center gap-2 rounded-lg border border-survey-border-strong bg-survey-bg px-5 py-2.5 text-xs font-semibold text-survey-ink hover:bg-survey-raised transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
            >
              <span>Data Sources</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Soft Footer Strip */}
        <div className="pt-5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-survey-muted">
          <span>NISAR Cycle 035 · L-Band 24 cm · Dual Polarization</span>
          <span>ASF Vertex · NASA POWER · NASA EONET · SMIAN_P5 .H5 Server</span>
        </div>
      </div>

      {/* Gentle Cropped Display Wordmark */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none overflow-hidden px-3 sm:px-6"
      >
        <div
          className="font-display font-extrabold leading-[0.88] tracking-[-0.025em] text-survey-ink/90 whitespace-nowrap translate-y-[20%]"
          style={{ fontSize: 'clamp(28px, 8.2vw, 118px)' }}
        >
          Radar Rhythm<span className="text-data-hh">.</span>
        </div>
      </div>
    </footer>
  );
}
