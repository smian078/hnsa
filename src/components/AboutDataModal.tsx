import { useEffect } from 'react';
import {
  Code2,
  ExternalLink,
  KeyRound,
  Layers,
  Radio,
  ShieldCheck,
  X,
} from 'lucide-react';

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
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-[var(--rr-space-bg)]/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-modal-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-survey-border-strong bg-survey-bg p-6 text-survey-ink"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--rr-border)] pb-4">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--rr-accent)]">
              About &amp; Simple Guide
            </div>
            <h2
              id="about-modal-title"
              className="text-xl font-black tracking-tight text-[var(--rr-text)] mt-1"
            >
              Radar Rhythm · Dancing With the SARs
            </h2>
            <p className="mt-1 text-sm text-[var(--rr-muted)]">
              Easy-to-read satellite radar maps and 7-day safety forecasts for
              floodwater, farm crops, and earthquake ground movement—even
              through thick clouds.
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
          {/* Open-Source GitHub Repository Banner */}
          <section
            data-testid="about-github-section"
            className="border border-[var(--rr-border-strong)] bg-[var(--rr-surface)] p-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
                  <Code2
                    className="h-4 w-4 text-[var(--rr-accent)]"
                    aria-hidden="true"
                  />
                  Project GitHub Repository
                </h3>
                <p className="mt-1 text-xs text-[var(--rr-muted)]">
                  Explore our full source code, local <code className="font-mono">.h5</code>{' '}
                  radar reader scripts, and documentation on GitHub:
                </p>
                <a
                  href="https://github.com/humairakhan1804-create/Dancing_With_SARs"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="about-github-repo-link"
                  className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs font-bold text-[var(--rr-water)] hover:underline break-all"
                >
                  <span>
                    https://github.com/humairakhan1804-create/Dancing_With_SARs
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              </div>

              <a
                href="https://github.com/humairakhan1804-create/Dancing_With_SARs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--rr-surface-inverse)] px-4 py-2 text-xs font-semibold text-[var(--rr-text-inverse)] hover:opacity-90 transition-opacity shrink-0"
              >
                <span>Open GitHub Repo</span>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </section>

          {/* Simple Explanation of How Radar Sees Through Clouds */}
          <section className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--rr-accent)]">
              <Radio className="h-4 w-4" aria-hidden="true" />
              How Satellite Radar Sees Through Storm Clouds
            </h3>
            <p className="mt-2 text-xs text-[var(--rr-muted)]">
              Regular camera satellites cannot see the ground when monsoon storm
              clouds or night darkness cover the sky. The NASA–ISRO NISAR
              satellite sends out 24 cm radar waves every 12 days that pass
              straight through clouds to measure standing water, wet farm soil,
              and ground movement.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="border border-[var(--rr-border)] bg-[var(--rr-bg)] p-3">
                <p className="font-bold text-xs text-[var(--rr-text)]">
                  Floodwater &amp; Crops (Maharashtra &amp; Assam)
                </p>
                <p className="mt-1 text-xs text-[var(--rr-muted)]">
                  Calm floodwater acts like a flat mirror and bounces radar
                  signals away (shown in blue as low dB), while leafy green
                  crops bounce signals back strongly.
                </p>
              </div>
              <div className="border border-[var(--rr-border)] bg-[var(--rr-bg)] p-3">
                <p className="font-bold text-xs text-[var(--rr-text)]">
                  Earthquake Ground Shift (Noto Peninsula, Japan)
                </p>
                <p className="mt-1 text-xs text-[var(--rr-muted)]">
                  Compares two radar passes 12 days apart like a centimeter
                  ruler from space to see where coastal land rose or sank after
                  earthquakes.
                </p>
              </div>
            </div>
          </section>

          {/* NASA API Key Functions Section */}
          <section className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
              <KeyRound
                className="h-4 w-4 text-[var(--rr-hv)]"
                aria-hidden="true"
              />
              Live NASA API Key Functions
            </h3>
            <p className="mt-1.5 text-xs text-[var(--rr-muted)]">
              Our server authenticates live requests with your{' '}
              <code className="font-mono text-[var(--rr-text)]">NASA_API_KEY</code>{' '}
              (upgrading NASA Open API rate limits to 1,000 requests/hour):
            </p>
            <ul className="mt-2.5 space-y-2 text-xs text-[var(--rr-muted)]">
              <li className="border-b border-[var(--rr-border)] pb-1.5">
                <strong className="font-mono text-[var(--rr-text)]">
                  getNasaApiKey() &amp; buildNasaAuthenticatedUrl()
                </strong>
                : Automatically attaches your NASA API key to every NASA POWER
                and NASA EONET request.
              </li>
              <li className="border-b border-[var(--rr-border)] pb-1.5">
                <strong className="font-mono text-[var(--rr-text)]">
                  fetchNasaPowerLiveMetrics(lat, lon, apiKey)
                </strong>
                : Pulls live satellite rainfall, root-zone soil wetness, and
                temperature for Maharashtra, Northeast India, and Japan.
              </li>
              <li>
                <strong className="font-mono text-[var(--rr-text)]">
                  fetchNasaEonetRegionalAlerts(lat, lon, apiKey)
                </strong>
                : Checks NASA EONET for active flood, storm, landslide, and
                earthquake alerts near our three study regions.
              </li>
            </ul>
          </section>

          {/* Open Data Feeds */}
          <section className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4">
            <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
              <Layers
                className="h-4 w-4 text-[var(--rr-accent)]"
                aria-hidden="true"
              />
              Open Satellite &amp; Weather Feeds Used
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs text-[var(--rr-muted)]">
              <li className="flex items-start justify-between gap-3 border-b border-[var(--rr-border)] pb-2">
                <div>
                  <strong className="text-[var(--rr-text)]">
                    Alaska Satellite Facility (ASF Vertex) &amp; Local .H5 Server
                  </strong>
                  <p>
                    NISAR Cycle 035 HDF5 (.h5) radar files (18.04 GB total) for
                    Maharashtra, Northeast India, and Japan.
                  </p>
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
                  <strong className="text-[var(--rr-text)]">
                    NASA POWER Weather Satellite Data
                  </strong>
                  <p>
                    Daily rainfall (mm/day) and farm soil wetness for each
                    location.
                  </p>
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
                  <strong className="text-[var(--rr-text)]">
                    NASA EONET, Open-Meteo Flood &amp; USGS Earthquakes
                  </strong>
                  <p>
                    Live 7-day rain, river water flow (m³/s), hill steepness,
                    and 30-day earthquake alerts.
                  </p>
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
              <ShieldCheck
                className="h-4 w-4 text-[var(--rr-accent)]"
                aria-hidden="true"
              />
              Team &amp; Attribution
            </h3>
            <p className="mt-2 text-xs text-[var(--rr-muted)]">
              Built with open NASA &amp; ISRO NISAR / ASF / Earthdata / GIBS /
              POWER data. NASA does not endorse this application.
            </p>
            <p className="mt-2 text-xs text-[var(--rr-muted)]">
              <strong className="text-[var(--rr-text)]">
                Team Dancing With the SARs (Nagpur 2026):
              </strong>{' '}
              Aman Kawale · Vedant Jaiswal · Kalash Wasad · Humaira Khan ·
              Asawari Dhawad
            </p>
          </section>
        </div>

        <div className="mt-5 flex justify-end border-t border-survey-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-survey-basalt bg-survey-basalt px-5 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-survey-basalt-text hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
          >
            Back to App
          </button>
        </div>
      </div>
    </div>
  );
}
