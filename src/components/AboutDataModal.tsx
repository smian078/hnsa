import { useEffect } from 'react';
import { ExternalLink, Layers, Radio, ShieldCheck, X } from 'lucide-react';

interface AboutDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDataModal({ isOpen, onClose }: AboutDataModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] p-6 text-[var(--rr-text)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rr-border)] pb-4">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--rr-accent)]">
              Data Sources &amp; How It Works
            </div>
            <h2
              id="about-modal-title"
              className="text-xl font-black tracking-tight text-[var(--rr-text)] mt-1"
            >
              Radar Rhythm &amp; Open Satellite Data
            </h2>
            <p className="mt-1 text-sm text-[var(--rr-muted)]">
              Easy-to-read radar maps showing floodwater, crops, and earthquake ground shift through clouds.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close About and Data Sources dialog"
            className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-2 text-[var(--rr-text)] hover:border-[var(--rr-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5 text-sm leading-relaxed text-[var(--rr-text)]">
          <section className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--rr-accent)]">
              <Radio className="h-4 w-4" aria-hidden="true" />
              Why Radar Sees Through Clouds and Darkness
            </h3>
            <p className="mt-2 text-xs text-[var(--rr-muted)]">
              Normal camera satellites get blocked by thick monsoon clouds and night skies. NISAR sends out 24 cm radar waves every 12 days that pass right through clouds to measure standing water, crop thickness, and centimeter-level ground movement.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="border border-[var(--rr-border)] bg-[var(--rr-bg)] p-3">
                <p className="font-bold text-xs text-[var(--rr-text)]">
                  Water &amp; Crop Radar (GCOV)
                </p>
                <p className="mt-1 text-xs text-[var(--rr-muted)]">
                  Smooth floodwater reflects radar waves away like a mirror (shown as low dB), while dense crops and flooded stalks scatter signals back strongly.
                </p>
              </div>
              <div className="border border-[var(--rr-border)] bg-[var(--rr-bg)] p-3">
                <p className="font-bold text-xs text-[var(--rr-text)]">
                  Ground Movement Radar (GUNW)
                </p>
                <p className="mt-1 text-xs text-[var(--rr-muted)]">
                  Compares radar passes 12 days apart to spot land lifting upward or sinking downward in centimeters, filtered by a signal trust score (0.0–1.0).
                </p>
              </div>
            </div>
          </section>

          <section className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
              <Layers className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
              Open Data Feeds Used
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs text-[var(--rr-muted)]">
              <li className="flex items-start justify-between gap-3 border-b border-[var(--rr-border)] pb-2">
                <div>
                  <strong className="text-[var(--rr-text)]">Alaska Satellite Facility (ASF Vertex)</strong>
                  <p>NISAR Cycle 035 HDF5 (.h5) radar files for Maharashtra, Northeast India, and Japan.</p>
                </div>
                <a
                  href="https://search.asf.alaska.edu/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--rr-accent)] hover:underline shrink-0"
                >
                  <span>Vertex</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
              <li className="flex items-start justify-between gap-3 border-b border-[var(--rr-border)] pb-2">
                <div>
                  <strong className="text-[var(--rr-text)]">2D Satellite Base Imagery</strong>
                  <p>High-resolution 2D satellite map tiles paired side-by-side with radar zones.</p>
                </div>
                <a
                  href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--rr-accent)] hover:underline shrink-0"
                >
                  <span>Imagery</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
              <li className="flex items-start justify-between gap-3 border-b border-[var(--rr-border)] pb-2">
                <div>
                  <strong className="text-[var(--rr-text)]">NASA POWER Weather Data</strong>
                  <p>Daily rainfall (mm/day) and root-zone soil wetness for each location.</p>
                </div>
                <a
                  href="https://power.larc.nasa.gov/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--rr-accent)] hover:underline shrink-0"
                >
                  <span>POWER</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
              <li className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-[var(--rr-text)]">NASA EONET Hazard Feed</strong>
                  <p>Live natural disaster alerts shown when Live NASA mode is enabled.</p>
                </div>
                <a
                  href="https://eonet.gsfc.nasa.gov/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[var(--rr-accent)] hover:underline shrink-0"
                >
                  <span>EONET</span>
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </section>

          <section className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
              <ShieldCheck className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
              Team &amp; Attribution
            </h3>
            <p className="mt-2 text-xs text-[var(--rr-muted)]">
              Built with open NASA &amp; ISRO NISAR / ASF / Earthdata / GIBS / POWER data. NASA does not endorse this application.
            </p>
            <p className="mt-2 text-xs text-[var(--rr-muted)]">
              <strong className="text-[var(--rr-text)]">Team (Nagpur 2026):</strong> Aman Kawale · Vedant Jaiswal · Kalash Wasad · Humaira Khan · Asawari Dhawad
            </p>
          </section>
        </div>

        <div className="mt-5 flex justify-end border-t border-[var(--rr-border)] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="border border-[var(--rr-border-strong)] bg-[var(--rr-surface-inverse)] px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--rr-text-inverse)] hover:bg-[var(--rr-accent-solid)] hover:border-[var(--rr-accent-solid)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            Back to App
          </button>
        </div>
      </div>
    </div>
  );
}
