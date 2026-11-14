import { BookmarkPlus, CalendarClock, Pause, Play, Trash2 } from 'lucide-react';
import type { RegionDataset, SavedSnapshot, StudyZone } from '../types/sar.ts';
import { computePassDelta, formatSigned } from '../utils/sarPhysics.ts';

interface OrbitalTimeScrubberProps {
  region: RegionDataset;
  selectedZone: StudyZone | null;
  passIndex: number;
  onSelectPass: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPinSnapshot: () => void;
  savedSnapshots: SavedSnapshot[];
  onLoadSnapshot: (snap: SavedSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

export function OrbitalTimeScrubber({
  region,
  selectedZone,
  passIndex,
  onSelectPass,
  isPlaying,
  onTogglePlay,
  onPinSnapshot,
  savedSnapshots,
  onLoadSnapshot,
  onDeleteSnapshot,
}: OrbitalTimeScrubberProps) {
  const referenceZone = selectedZone ?? region.zones[0];
  const currentPass =
    referenceZone.passes[passIndex] ?? referenceZone.passes[0];
  const delta = computePassDelta(referenceZone, passIndex);
  const isGunw = region.productType === 'GUNW';

  return (
    <section
      aria-label="Satellite Pass Timeline"
      className="border border-[var(--rr-border)] bg-[var(--rr-bg)] p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--rr-border)]">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--rr-text)]">
            Satellite Pass Timeline (Every 12 Days)
          </h2>
          <span className="text-xs text-[var(--rr-muted)] font-mono">
            · {currentPass.acquisitionDate}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause pass animation' : 'Animate satellite passes'}
            className="inline-flex items-center gap-1.5 border border-survey-border-strong bg-survey-basalt px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-survey-basalt-text hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3 w-3" aria-hidden="true" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" aria-hidden="true" />
                <span>Animate</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onPinSnapshot}
            className="inline-flex items-center gap-1.5 border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)] hover:border-[var(--rr-border-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            <BookmarkPlus className="h-3 w-3 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>Save Snapshot</span>
          </button>
        </div>
      </div>

      {/* 4 Pass Buttons */}
      <div
        role="group"
        aria-label="Satellite pass dates"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {referenceZone.passes.map((pass, idx) => {
          const active = idx === passIndex;
          return (
            <button
              key={pass.passCode}
              type="button"
              onClick={() => onSelectPass(idx)}
              aria-pressed={active}
              className={`px-3 py-2.5 text-left transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                active
                  ? 'border-survey-basalt bg-survey-basalt text-survey-basalt-text'
                  : 'border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-text)] hover:border-[var(--rr-border-strong)]'
              }`}
            >
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono font-bold">
                <span>{pass.passCode}</span>
                <span className={active ? 'text-survey-basalt-text/85' : 'text-[var(--rr-muted)]'}>
                  {pass.acquisitionDate}
                </span>
              </div>
              <div className="mt-1 truncate text-xs font-semibold">
                {pass.passLabel.replace(/^Pass \d+ · /, '')}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Numbers Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono tabular-nums">
        {isGunw ? (
          <>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Ground Shift
              </div>
              <div className="text-base font-bold text-[var(--rr-accent)]">
                {formatSigned(currentPass.losDisplacementCm ?? 0, 1)} cm
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Net Change
              </div>
              <div className="text-base font-bold text-[var(--rr-text)]">
                {formatSigned(delta.deltaLosCm ?? 0, 1)} cm
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Radar Phase
              </div>
              <div className="text-base font-bold text-[var(--rr-text)]">
                {formatSigned(currentPass.unwrappedPhaseRad ?? 0, 2)} rad
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] tracking-[0.12em] text-[var(--rr-muted)]">
                TRUST (γ)
              </div>
              <div className="text-base font-bold text-[var(--rr-text)]">
                {(currentPass.coherence ?? 0).toFixed(2)}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Water Signal (HH)
              </div>
              <div className="text-base font-bold text-[var(--rr-accent)]">
                {currentPass.hhGamma0Db.toFixed(1)} dB
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] tracking-[0.12em] text-[var(--rr-muted)]">
                Change (Δγ⁰)
              </div>
              <div className="text-base font-bold text-[var(--rr-text)]">
                {formatSigned(delta.deltaHhDb, 1)} dB
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Crop Signal (HV)
              </div>
              <div className="text-base font-bold text-[var(--rr-text)]">
                {currentPass.hvGamma0Db.toFixed(1)} dB
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Wetness / Rain
              </div>
              <div className="text-base font-bold text-[var(--rr-text)]">
                {currentPass.dielectricConstantEst.toFixed(1)} · {currentPass.rainfallMm.toFixed(0)} mm
              </div>
            </div>
          </>
        )}
      </div>

      {/* Saved Snapshots Bar */}
      {savedSnapshots.length > 0 && (
        <div className="border-t border-[var(--rr-border)] pt-2.5">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-muted)] mb-2">
            Saved Snapshots ({savedSnapshots.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {savedSnapshots.map((snap) => (
              <div
                key={snap.id}
                className="inline-flex items-center gap-1.5 border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => onLoadSnapshot(snap)}
                  className="text-left text-[var(--rr-text)] hover:text-[var(--rr-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  <span className="font-semibold">{snap.zoneName.split(' ')[0]}</span>
                  <span className="text-[var(--rr-muted)] font-mono ml-1.5">
                    {snap.acquisitionDate} ·{' '}
                    {snap.losDisplacementCm !== undefined
                      ? `${formatSigned(snap.losDisplacementCm, 1)} cm`
                      : `${snap.hhDb.toFixed(1)} dB`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteSnapshot(snap.id)}
                  aria-label={`Remove saved snapshot ${snap.zoneName} ${snap.acquisitionDate}`}
                  className="text-[var(--rr-muted)] hover:text-[var(--rr-danger-text)] p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
