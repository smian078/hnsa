import { ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onOpenAbout: () => void;
}

export function Footer({ onOpenAbout }: FooterProps) {
  return (
    <footer className="relative overflow-hidden bg-[var(--rr-surface)] text-[var(--rr-text)] border-t border-[var(--rr-border)]">
      {/* Top Interactive Trigger */}
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 pt-10 pb-8 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-[var(--rr-border)]">
          <div className="space-y-2.5">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--rr-muted)]">
              NASA Space Apps Challenge 2026 · Dancing With The SARs
            </div>
            <button
              type="button"
              onClick={onOpenAbout}
              className="group inline-flex items-center gap-3 text-left text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-[var(--rr-text)] border-b-2 border-transparent hover:border-[var(--rr-accent)] pb-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
            >
              <span>About Open NASA &amp; ISRO Satellite Data</span>
              <ArrowUpRight
                className="h-6 w-6 text-[var(--rr-accent)] transition-transform duration-300 group-hover:rotate-45"
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--rr-muted)] space-y-1">
            <div>ASF VERTEX · NISAR RADAR</div>
            <div>ESRI SATELLITE · NASA WEATHER · NASA EVENTS</div>
          </div>
        </div>
      </div>

      {/* Massive Low-Opacity Background Marquee */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none overflow-hidden py-2 opacity-10"
      >
        <div className="marquee-track-slow items-center gap-16">
          {[0, 1].map((idx) => (
            <div key={idx} className="flex items-center gap-16 pr-16">
              <span className="text-[16vw] leading-none font-black uppercase tracking-[-0.05em] whitespace-nowrap">
                RADAR RHYTHM
              </span>
              <span className="text-[16vw] leading-none font-serif-editorial whitespace-nowrap">
                earth radar
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Compliance Row */}
      <div className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-8 py-5 border-t border-[var(--rr-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rr-muted)]">
          Cycle 035 Radar Datasets Ready
        </div>

        <p className="text-xs text-[var(--rr-muted)] max-w-2xl">
          Built with open NASA &amp; ISRO NISAR / ASF / Earthdata / GIBS / POWER data. NASA does not endorse this application.
        </p>
      </div>
    </footer>
  );
}
