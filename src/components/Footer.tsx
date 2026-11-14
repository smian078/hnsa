import { ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onOpenAbout: () => void;
  onOpenExplorer?: () => void;
}

export function Footer({ onOpenAbout, onOpenExplorer }: FooterProps) {
  return (
    <footer className="relative overflow-hidden bg-[#0A0C0E] text-[#EDE7DC] border-t border-[rgba(237,231,220,0.13)]">
      {/* Top Close Section */}
      <div className="mx-auto max-w-[1600px] px-4 sm:px-8 pt-14 pb-8 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10 border-b border-[rgba(237,231,220,0.13)]">
          <div className="space-y-3 max-w-2xl">
            <div className="font-micro text-[#E8913C]">
              06 / NASA SPACE APPS CHALLENGE 2026 · DANCING WITH THE SARS
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-[-0.025em] text-[#EDE7DC]">
              Cloud-piercing radar intelligence for floods, farms, and active faults.
            </h2>
            <p className="text-xs leading-relaxed text-[#9EA5A8]">
              Built with open NASA &amp; ISRO NISAR / ASF / Earthdata / GIBS / POWER data. NASA does not endorse this application.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onOpenExplorer && (
              <button
                type="button"
                onClick={onOpenExplorer}
                className="inline-flex items-center gap-2 border border-[#E8913C] px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#E8913C] hover:bg-[#9A4A0B] hover:text-white transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
              >
                <span>Open 2D Radar Explorer</span>
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAbout}
              className="inline-flex items-center gap-2 border border-[rgba(237,231,220,0.22)] px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-[#EDE7DC] hover:border-[#2E6B72] hover:text-[#6EE7B7] transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8913C]"
            >
              <span>Data Provenance</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Hairline Footer Strip */}
        <div className="pt-5 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10.5px] uppercase tracking-[0.14em] text-[#9EA5A8]">
          <span>NISAR CYCLE 035 · L-BAND 24 CM · DHDH POLARIMETRY</span>
          <span>ASF VERTEX · NASA POWER · NASA EONET · SMIAN_P5 .H5 SERVER</span>
        </div>
      </div>

      {/* Full-Width Cropped Syne Wordmark */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none overflow-hidden px-2 sm:px-6"
      >
        <div
          className="font-display font-extrabold leading-[0.86] tracking-[-0.035em] text-[#EDE7DC] whitespace-nowrap translate-y-[22%]"
          style={{ fontSize: 'clamp(26px, 7.6vw, 114px)' }}
        >
          NISAR PULSE<span className="text-[#E8913C]">.</span>
        </div>
      </div>
    </footer>
  );
}
