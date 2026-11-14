import { AlertTriangle, CheckCircle2, Cpu, RefreshCw, Waves } from 'lucide-react';
import type {
  PhysicalDriverSynthesis,
  RegionDataset,
  ScatteringMechanism,
  StudyZone,
} from '../types/sar.ts';
import {
  classifyScatteringMechanism,
  computePassDelta,
  formatSigned,
} from '../utils/sarPhysics.ts';

interface PhysicalDriverSynthesizerProps {
  region: RegionDataset;
  selectedZone: StudyZone | null;
  passIndex: number;
  synthesis: PhysicalDriverSynthesis | null;
  isSynthesizing: boolean;
  synthesisError: string | null;
  onSynthesize: () => void;
}

function ScatteringDiagram({ mechanism }: { mechanism: ScatteringMechanism }) {
  const labels: Record<
    ScatteringMechanism,
    { title: string; swatchClass: string; strokeVar: string; desc: string }
  > = {
    SPECULAR_WATER: {
      title: 'Mirror Bounce (Standing Water)',
      swatchClass: 'bg-data-water',
      strokeVar: 'var(--rr-space-water)',
      desc: 'Smooth water reflects the radar wave away from the satellite like a mirror, making flooded zones stand out clearly.',
    },
    DOUBLE_BOUNCE_FLOODED_VEG: {
      title: 'Double Bounce (Water Under Plants)',
      swatchClass: 'bg-data-hh',
      strokeVar: 'var(--rr-space-hh)',
      desc: 'Radar bounces off the water onto plant stems and straight back, spotting hidden water beneath tall crops.',
    },
    VOLUME_CANOPY: {
      title: 'Canopy Scatter (Thick Crops / Forest)',
      swatchClass: 'bg-data-hv',
      strokeVar: 'var(--rr-space-hv)',
      desc: 'Radar waves bounce inside dense leaves and branches, showing healthy thick crop or forest cover.',
    },
    INSAR_PHASE_DEFORMATION: {
      title: 'Surface Shift (Earthquake Motion)',
      swatchClass: 'bg-data-hh',
      strokeVar: 'var(--rr-space-hh)',
      desc: 'Compares two satellite passes to measure centimeter-level rising or sinking of the ground.',
    },
  };

  const active = labels[mechanism];

  return (
    <div className="border border-survey-border bg-survey-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-survey-muted">
          How the Radar Sees This
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-survey-ink">
          <span className={`h-2 w-2 inline-block ${active.swatchClass}`} aria-hidden="true" />
          <span>{active.title}</span>
        </span>
      </div>

      <svg
        viewBox="0 0 320 76"
        className="w-full h-16 border border-survey-border bg-[var(--rr-space-bg)]"
        role="img"
        aria-label={active.title}
      >
        <line
          x1="16"
          y1="60"
          x2="304"
          y2="60"
          stroke="var(--rr-space-muted)"
          strokeWidth="2"
        />
        <line
          x1="48"
          y1="10"
          x2="145"
          y2="58"
          stroke="var(--rr-space-text)"
          strokeWidth="2"
          strokeDasharray="4 3"
        />
        {mechanism === 'SPECULAR_WATER' && (
          <>
            <line
              x1="145"
              y1="58"
              x2="255"
              y2="12"
              stroke="var(--rr-space-water)"
              strokeWidth="2.5"
            />
            <rect
              x="95"
              y="57"
              width="130"
              height="5"
              fill="var(--rr-space-water)"
              opacity="0.85"
            />
          </>
        )}
        {mechanism === 'DOUBLE_BOUNCE_FLOODED_VEG' && (
          <>
            <line
              x1="175"
              y1="30"
              x2="175"
              y2="60"
              stroke="var(--rr-space-hv)"
              strokeWidth="3"
            />
            <line
              x1="145"
              y1="58"
              x2="175"
              y2="44"
              stroke="var(--rr-space-hh)"
              strokeWidth="2.5"
            />
            <line
              x1="175"
              y1="44"
              x2="72"
              y2="10"
              stroke="var(--rr-space-hh)"
              strokeWidth="2.5"
            />
          </>
        )}
        {mechanism === 'VOLUME_CANOPY' && (
          <>
            <circle
              cx="155"
              cy="40"
              r="16"
              fill="var(--rr-space-hv)"
              fillOpacity="0.22"
              stroke="var(--rr-space-hv)"
              strokeWidth="1.5"
            />
            <circle
              cx="176"
              cy="44"
              r="12"
              fill="var(--rr-space-hv)"
              fillOpacity="0.22"
              stroke="var(--rr-space-hv)"
              strokeWidth="1.5"
            />
            <line
              x1="145"
              y1="42"
              x2="90"
              y2="12"
              stroke="var(--rr-space-hv)"
              strokeWidth="2"
            />
            <line
              x1="165"
              y1="38"
              x2="215"
              y2="16"
              stroke="var(--rr-space-hv)"
              strokeWidth="2"
            />
          </>
        )}
        {mechanism === 'INSAR_PHASE_DEFORMATION' && (
          <>
            <path
              d="M 90 60 Q 160 36 230 60"
              fill="none"
              stroke="var(--rr-space-hh)"
              strokeWidth="2.5"
            />
            <line
              x1="145"
              y1="48"
              x2="56"
              y2="12"
              stroke="var(--rr-space-hh)"
              strokeWidth="2.5"
            />
            <text
              x="160"
              y="26"
              fill="var(--rr-space-text)"
              fontSize="10"
              textAnchor="middle"
              fontFamily="monospace"
            >
              Δφ = 4π·ΔR / λ
            </text>
          </>
        )}
      </svg>
      <p className="mt-2 text-xs text-survey-muted leading-relaxed">{active.desc}</p>
    </div>
  );
}

export function PhysicalDriverSynthesizer({
  region,
  selectedZone,
  passIndex,
  synthesis,
  isSynthesizing,
  synthesisError,
  onSynthesize,
}: PhysicalDriverSynthesizerProps) {
  const activeZone = selectedZone ?? region.zones[0];
  const pass = activeZone.passes[passIndex] ?? activeZone.passes[0];
  const delta = computePassDelta(activeZone, passIndex);

  const previewMechanism = classifyScatteringMechanism(
    region.productType,
    pass.hhGamma0Db,
    pass.hvGamma0Db,
    pass.losDisplacementCm
  );

  return (
    <div className="space-y-4">
      <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--rr-muted)]">
              Selected Zone
            </div>
            <h3 className="text-sm font-bold text-[var(--rr-text)]">
              {activeZone.name}
            </h3>
          </div>
          <span className="font-mono text-[11px] font-bold text-[var(--rr-accent)] shrink-0">
            {pass.acquisitionDate}
          </span>
        </div>

        <div className="flex flex-wrap gap-3 pt-1 font-mono text-xs tabular-nums text-[var(--rr-text)]">
          <span>HH: {pass.hhGamma0Db.toFixed(1)} dB ({formatSigned(delta.deltaHhDb, 1)})</span>
          <span>HV: {pass.hvGamma0Db.toFixed(1)} dB</span>
          {pass.losDisplacementCm !== undefined && (
            <span>Shift: {formatSigned(pass.losDisplacementCm, 1)} cm</span>
          )}
          {pass.coherence !== undefined && (
            <span>Trust: {pass.coherence.toFixed(2)}</span>
          )}
          <span>Rain: {pass.rainfallMm.toFixed(1)} mm/d</span>
        </div>
      </div>

      <ScatteringDiagram
        mechanism={synthesis?.scatteringMechanism ?? previewMechanism}
      />

      {/* Generate Plain-English Explanation */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSynthesize}
          disabled={isSynthesizing}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-[var(--rr-accent-solid)] bg-[var(--rr-accent-solid)] px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-survey-basalt-text hover:opacity-90 disabled:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
        >
          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {isSynthesizing ? 'Writing Summary...' : 'Explain This Zone'}
          </span>
        </button>
      </div>

      {isSynthesizing && (
        <div className="space-y-3" aria-busy="true" aria-label="Generating plain-English summary">
          <div className="h-6 w-3/4 skeleton-shimmer" />
          <div className="h-24 skeleton-shimmer" />
          <div className="h-24 skeleton-shimmer" />
        </div>
      )}

      {synthesisError && !isSynthesizing && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 border border-[var(--rr-danger-border)] bg-[var(--rr-danger-bg)] p-3 text-xs text-[var(--rr-danger-text)]"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{synthesisError}</span>
          </div>
          <button
            type="button"
            onClick={onSynthesize}
            className="inline-flex items-center gap-1 border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rr-text)] hover:bg-[var(--rr-accent-solid)] hover:text-survey-basalt-text"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {!synthesis && !isSynthesizing && !synthesisError && (
        <div className="border border-dashed border-[var(--rr-border)] bg-[var(--rr-surface)] p-4 text-xs text-[var(--rr-muted)]">
          <div className="flex items-center gap-2 font-semibold text-[var(--rr-text)] mb-1">
            <Waves className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>Ready to Explain</span>
          </div>
          Click <strong>Explain This Zone</strong> for a clear summary of floodwater, crop growth, or ground movement based on the numbers above.
        </div>
      )}

      {synthesis && !isSynthesizing && (
        <article className="border border-[var(--rr-border-strong)] bg-[var(--rr-surface)] p-4 space-y-3 text-xs leading-relaxed">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--rr-border)] pb-2.5">
            <h4 className="text-sm font-bold text-[var(--rr-text)]">
              {synthesis.headline}
            </h4>
            <span className="font-mono text-[10px] font-bold px-2 py-0.5 border border-[var(--rr-accent)] bg-[var(--rr-accent)]/15 text-[var(--rr-accent)] shrink-0">
              {synthesis.source === 'GEMINI_4_HYDROGEN'
                ? 'AI Summary'
                : 'Built-In Guide'}
            </span>
          </div>

          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-accent)] mb-1">
              1. What the Radar Saw
            </div>
            <p className="text-[var(--rr-text)]">{synthesis.physicsExplanation}</p>
          </div>

          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)] mb-1">
              2. Likely Cause
            </div>
            <p className="text-[var(--rr-muted)]">{synthesis.humanAndNaturalDrivers}</p>
          </div>

          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-success-text)] mb-1.5">
              3. Next Steps
            </div>
            <ul className="space-y-1.5">
              {synthesis.actionableAdvisory.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[var(--rr-text)]">
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-[var(--rr-success-text)] mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border border-[var(--rr-border)] bg-[var(--rr-bg)] px-3 py-2 text-[11px] text-[var(--rr-muted)]">
            <strong className="text-[var(--rr-text)]">Things to Note: </strong>
            {synthesis.uncertaintyAndLimits}
          </div>
        </article>
      )}
    </div>
  );
}
