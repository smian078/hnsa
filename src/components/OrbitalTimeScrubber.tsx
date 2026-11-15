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
                <span>Scan {idx + 1}</span>
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

      {/* Quick Numbers Strip (Plain Everyday Language) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono tabular-nums">
        {isGunw ? (
          <>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Ground Movement
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-accent)]">
                {(currentPass.losDisplacementCm ?? 0) <= -1
                  ? `Sank ${Math.abs(currentPass.losDisplacementCm ?? 0).toFixed(1)} cm`
                  : (currentPass.losDisplacementCm ?? 0) >= 1
                    ? `Rose +${(currentPass.losDisplacementCm ?? 0).toFixed(1)} cm`
                    : `Steady (${formatSigned(currentPass.losDisplacementCm ?? 0, 1)} cm)`}
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                Land height change
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Change Since Scan 1
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-text)]">
                {formatSigned(delta.deltaLosCm ?? 0, 1)} cm
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                Compared to {delta.baselineDate}
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Daily Rain &amp; Soil
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-text)]">
                {currentPass.rainfallMm.toFixed(0)} mm · {Math.round(currentPass.soilMoistureIndex * 100)}% Wet
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                Rain &amp; wet hillside soil
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Signal Clarity
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-text)]">
                {Math.round((currentPass.coherence ?? 0) * 100)}% Clear
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                {(currentPass.coherence ?? 0) >= 0.7
                  ? 'High confidence reading'
                  : 'Moderate clarity'}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Water on Ground
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-accent)]">
                {currentPass.hhGamma0Db <= -18
                  ? 'Floodwater Present'
                  : currentPass.hhGamma0Db <= -13
                    ? 'Wet Ground / Mud'
                    : 'Dry / Normal Ground'}
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                Radar: {currentPass.hhGamma0Db.toFixed(1)} dB (lower = more water)
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Change Since Scan 1
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-text)]">
                {delta.deltaHhDb <= -6
                  ? 'Much More Water'
                  : delta.deltaHhDb <= -2
                    ? 'Wetter Than Scan 1'
                    : delta.deltaHhDb >= 2
                      ? 'Water Draining Away'
                      : 'Little Change'}
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                {formatSigned(delta.deltaHhDb, 1)} dB vs {delta.baselineDate}
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Crops &amp; Plants
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-text)]">
                {currentPass.hvGamma0Db >= -12.5
                  ? 'Thick Green Crops'
                  : currentPass.hvGamma0Db >= -16
                    ? 'Moderate Plants'
                    : 'Submerged / Open Water'}
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                Plant signal: {currentPass.hvGamma0Db.toFixed(1)} dB
              </div>
            </div>
            <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--rr-muted)]">
                Soil Wetness &amp; Rain
              </div>
              <div className="text-sm sm:text-base font-bold text-[var(--rr-text)]">
                {Math.round(currentPass.soilMoistureIndex * 100)}% Wet · {currentPass.rainfallMm.toFixed(0)} mm
              </div>
              <div className="text-[10px] font-sans text-[var(--rr-muted)] mt-0.5">
                Soaked soil &amp; daily rainfall
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
                      : snap.hhDb <= -18
                        ? `Flooded (${snap.hhDb.toFixed(1)} dB)`
                        : `Wet (${snap.hhDb.toFixed(1)} dB)`}
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
