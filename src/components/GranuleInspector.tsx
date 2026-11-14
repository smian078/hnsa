import { useEffect, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileUp,
  HardDrive,
  Layers,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  NISAR_HDF5_MANIFEST,
  SMIAN_P5_VERIFIED_RECORDS,
} from '../data/samples/asfVertexSamples.ts';
import {
  getLaptopDbUrl,
  LAPTOP_DB_EVENT_NAME,
  normalizeRegionMatch,
  probeLaptopH5Db,
  type LaptopDbProbeResult,
  type LiveLaptopGranuleRecord,
} from '../services/nisarApi.ts';
import type {
  AsfGranuleMetadata,
  AsfGranulesApiResponse,
  EonetEvent,
  RegionDataset,
} from '../types/sar.ts';
import { parseUploadedGeoJsonOrGranule } from '../utils/sarPhysics.ts';

interface GranuleInspectorProps {
  region: RegionDataset;
  granulesData: AsfGranulesApiResponse | null;
  isLoadingGranules: boolean;
  granulesError: string | null;
  onRetryGranules: () => void;
  eonetEvents: EonetEvent[];
  demoMode: boolean;
}

const FALLBACK_SMIAN_P5_RECORDS: LiveLaptopGranuleRecord[] =
  SMIAN_P5_VERIFIED_RECORDS;

function translateWaterSignal(hhMean?: number, hhFloodMin?: number): string {
  const minVal = hhFloodMin ?? hhMean;
  if (typeof minVal !== 'number') {
    return 'Radar brightness data is stored in this grid.';
  }
  if (minVal <= -18.0) {
    return `Calm Floodwater Detected (${minVal.toFixed(1)} dB low / ${(hhMean ?? minVal).toFixed(1)} dB avg): Smooth water acts like a flat mirror and bounces radar away from the satellite, showing up as dark flood zones even under 100% monsoon clouds.`;
  }
  return `Surface Roughness & Wetness (${minVal.toFixed(1)} dB): Rougher soil and wet ground bounce more microwave signal back to space.`;
}

function translateCropSignal(hvMean?: number, regionId?: string): string {
  if (typeof hvMean !== 'number') {
    return 'Plant and forest scatter measurements are stored in this grid.';
  }
  if (regionId === 'japan' || hvMean <= -14.0) {
    return `Coastal Terrain & Forest Mix (${hvMean.toFixed(1)} dB): Moderate leaf and stem bounce across hillside cedar forests and coastal bedrock.`;
  }
  return `Healthy Crop & Forest Canopy (${hvMean.toFixed(1)} dB): Radar bounces inside leaves and stems, measuring plant density in cotton, paddy, and wetlands.`;
}

function translateSoilMoisture(soilMoistureIndex?: number): {
  pct: number;
  label: string;
} | null {
  if (typeof soilMoistureIndex !== 'number') return null;
  const pct = Math.min(100, Math.max(0, Math.round(soilMoistureIndex * 100)));
  if (pct >= 85) {
    return {
      pct,
      label: `${pct}% Topsoil Moisture — floodplain soil is saturated; extra rain turns straight into runoff`,
    };
  }
  if (pct >= 70) {
    return {
      pct,
      label: `${pct}% Topsoil Moisture — soil is heavily soaked, high runoff risk if rain continues`,
    };
  }
  return {
    pct,
    label: `${pct}% Topsoil Moisture — moderate ground dampness`,
  };
}

function translateGroundShift(
  losDisplacementCm?: number,
  coherenceMean?: number
): string | null {
  if (typeof losDisplacementCm !== 'number') return null;
  const direction = losDisplacementCm < 0 ? 'sank by' : 'rose by';
  const conf =
    typeof coherenceMean === 'number'
      ? ` (${Math.round(coherenceMean * 100)}% measurement confidence)`
      : '';
  return `Ground ${direction} ${Math.abs(losDisplacementCm).toFixed(1)} cm after earthquake fault movement${conf}.`;
}

function buildH5SummaryString(rec: LiveLaptopGranuleRecord): string {
  const sizeGb = (rec.fileSizeMB / 1000).toFixed(2);
  const parts: string[] = [
    `File: ${rec.fileName} (${Math.round(rec.fileSizeMB).toLocaleString('en-US')} MB / ${sizeGb} GB)`,
    `Region: ${rec.regionName}`,
    rec.plainEnglishSummary ? `Summary: ${rec.plainEnglishSummary}` : '',
    typeof rec.hhGamma0MeanDb === 'number'
      ? `Water HH avg ${rec.hhGamma0MeanDb.toFixed(1)} dB`
      : '',
    typeof rec.hhFloodMinDb === 'number'
      ? `Flood low ${rec.hhFloodMinDb.toFixed(1)} dB`
      : '',
    typeof rec.hvGamma0MeanDb === 'number'
      ? `Crops/Trees HV avg ${rec.hvGamma0MeanDb.toFixed(1)} dB`
      : '',
    typeof rec.soilMoistureIndex === 'number'
      ? `Soil Wetness ${Math.round(rec.soilMoistureIndex * 100)}%`
      : '',
    typeof rec.losDisplacementCm === 'number'
      ? `Ground Shift ${rec.losDisplacementCm.toFixed(1)} cm`
      : '',
    typeof rec.coherenceMean === 'number'
      ? `Measurement Confidence ${Math.round(rec.coherenceMean * 100)}%`
      : '',
    rec.liveDiskSlices && rec.liveDiskSlices.length > 0
      ? `Disk Slices: ${rec.liveDiskSlices
          .map(
            (s) =>
              `@${s.offsetMB.toFixed(1)}MB ${(s.nonZeroByteRatio * 100).toFixed(1)}% [${s.chunkSha256}]`
          )
          .join(', ')}`
      : '',
  ].filter(Boolean);
  return parts.join(' | ');
}

function askAiToExplainH5(rec: LiveLaptopGranuleRecord): void {
  const h5Summary = buildH5SummaryString(rec);
  window.dispatchEvent(
    new CustomEvent('nisar-ask-ai', {
      detail: {
        question: `Explain this .h5 satellite file (${rec.fileName}) for ${rec.regionName} in simple, everyday words`,
        h5Summary,
        h5Context: {
          fileName: rec.fileName,
          fileSizeMB: rec.fileSizeMB,
          regionName: rec.regionName,
          hhGamma0MeanDb: rec.hhGamma0MeanDb,
          hhFloodMinDb: rec.hhFloodMinDb,
          hvGamma0MeanDb: rec.hvGamma0MeanDb,
          soilMoistureIndex: rec.soilMoistureIndex,
          losDisplacementCm: rec.losDisplacementCm,
          coherenceMean: rec.coherenceMean,
          headerDigest: rec.headerDigest,
        },
      },
    })
  );
}

export function GranuleInspector({
  region,
  granulesData,
  isLoadingGranules,
  granulesError,
  onRetryGranules,
  eonetEvents,
  demoMode,
}: GranuleInspectorProps) {
  const [customGranules, setCustomGranules] = useState<AsfGranuleMetadata[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [expandedJsonId, setExpandedJsonId] = useState<string | null>(null);
  const [laptopProbe, setLaptopProbe] = useState<LaptopDbProbeResult | null>(
    null
  );
  const [isLoadingHardware, setIsLoadingHardware] = useState<boolean>(false);

  const loadLaptopTelemetry = async () => {
    setIsLoadingHardware(true);
    const result = await probeLaptopH5Db(getLaptopDbUrl());
    setLaptopProbe(result);
    setIsLoadingHardware(false);
  };

  useEffect(() => {
    void loadLaptopTelemetry();
    const onUrlChange = () => {
      void loadLaptopTelemetry();
    };
    window.addEventListener(LAPTOP_DB_EVENT_NAME, onUrlChange);
    return () => window.removeEventListener(LAPTOP_DB_EVENT_NAME, onUrlChange);
  }, []);

  const hdf5Manifest = NISAR_HDF5_MANIFEST[region.id];
  const combinedGranules = [
    ...customGranules,
    ...(granulesData?.granules ?? region.granules),
  ];

  const hardwareRecords =
    laptopProbe?.connected && laptopProbe.granules.length > 0
      ? laptopProbe.granules
      : FALLBACK_SMIAN_P5_RECORDS;

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseUploadedGeoJsonOrGranule(text);
    if (!parsed.valid) {
      setUploadError(parsed.error ?? 'Could not read that file.');
      setUploadStatus(null);
      return;
    }
    setUploadError(null);
    setUploadStatus(parsed.summary);
    setCustomGranules((prev) => [...parsed.granules, ...prev]);
    e.target.value = '';
  };

  const handleDownloadMetadata = (granule: AsfGranuleMetadata) => {
    const blob = new Blob([JSON.stringify(granule, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${granule.sceneName}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoadingGranules) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading satellite files">
        <div className="h-28 skeleton-shimmer" />
        <div className="h-28 skeleton-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {granulesError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border border-[var(--rr-warn-border)] bg-[var(--rr-warn-bg)] px-3 py-2 text-xs text-[var(--rr-warn-text)]"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{granulesError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryGranules}
            className="inline-flex items-center gap-1 border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rr-text)] hover:bg-[var(--rr-accent-solid)] hover:text-survey-basalt-text"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Live SMIAN_P5 Laptop HDF5 Telemetry Card */}
      <div
        data-testid="smian-p5-telemetry-card"
        className="border border-[var(--rr-success-border)] bg-[var(--rr-surface)] p-3.5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rr-border)] pb-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[var(--rr-success-text)]" aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
              SMIAN_P5 Live Database
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 border ${
              laptopProbe?.connected
                ? 'border-[var(--rr-success-border)] bg-[var(--rr-success-bg)] text-[var(--rr-success-text)]'
                : 'border-[var(--rr-warn-border)] bg-[var(--rr-warn-bg)] text-[var(--rr-warn-text)]'
            }`}
          >
            {laptopProbe?.connected ? (
              <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <span>
              {isLoadingHardware
                ? 'CHECKING...'
                : laptopProbe?.connected
                  ? `${laptopProbe.status} · ${laptopProbe.totalH5FilesFound} .H5 (${laptopProbe.totalSizeGb.toFixed(2)} GB)`
                  : 'OFFLINE BACKUP · VERIFIED FILES'}
            </span>
          </span>
        </div>

        <div className="border border-[var(--rr-border)] bg-[var(--rr-bg)] p-2.5 text-[11px] leading-relaxed text-[var(--rr-muted)]">
          <span className="font-bold text-[var(--rr-text)]">What is a .h5 file? </span>
          An <code className="font-mono text-[var(--rr-accent)]">.h5</code> (Hierarchical Data Format) file is NASA&apos;s scientific container that stores millions of radar echoes beamed through clouds at 24 cm microwave wavelength—acting like an X-ray of Earth&apos;s surface day or night.
        </div>

        <div className="space-y-3">
          {hardwareRecords.map((rec) => {
            const isActiveRegion = normalizeRegionMatch(rec.regionId, region.id);
            const sizeFormatted = `${Math.round(rec.fileSizeMB).toLocaleString('en-US')} MB`;
            const moisture = translateSoilMoisture(rec.soilMoistureIndex);
            const groundShiftText = translateGroundShift(
              rec.losDisplacementCm,
              rec.coherenceMean
            );

            return (
              <div
                key={rec.headerDigest + rec.fileName}
                className={`border p-3 space-y-2.5 ${
                  isActiveRegion
                    ? 'border-[var(--rr-accent)] bg-[var(--rr-bg)]'
                    : 'border-[var(--rr-border)] bg-[var(--rr-bg)]/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <HardDrive
                      className={`h-3.5 w-3.5 ${
                        isActiveRegion ? 'text-[var(--rr-accent)]' : 'text-[var(--rr-muted)]'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-bold text-[var(--rr-text)]">
                      {rec.regionName}
                    </span>
                    {isActiveRegion && (
                      <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 bg-survey-basalt text-survey-basalt-text">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-[var(--rr-text)] tabular-nums">
                    {sizeFormatted} ({(rec.fileSizeMB / 1000).toFixed(2)} GB)
                  </span>
                </div>

                <div className="font-mono text-[10px] text-[var(--rr-accent)] break-all">
                  {rec.fileName}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-[var(--rr-muted)]">
                  <span className="inline-flex items-center gap-1 text-[var(--rr-success-text)] font-bold">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    hdf5MagicVerified: {String(rec.hdf5MagicVerified)}
                  </span>
                  <span>
                    headerDigest:{' '}
                    <strong className="text-[var(--rr-text)]">{rec.headerDigest}</strong>
                  </span>
                  <span>
                    CRID: {rec.parsedGranule?.crid ?? 'P05036'} · Orbit{' '}
                    {rec.parsedGranule?.rel_orbit ?? '---'}/
                    {rec.parsedGranule?.frame ?? '---'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--rr-border)] pt-1.5 font-mono text-[10px] text-[var(--rr-text)] tabular-nums">
                  {typeof rec.hhGamma0MeanDb === 'number' && (
                    <span>HH Mean: {rec.hhGamma0MeanDb.toFixed(1)} dB</span>
                  )}
                  {typeof rec.hhFloodMinDb === 'number' && (
                    <span className="inline-flex items-center gap-1.5 text-survey-ink font-semibold">
                      <span className="h-2 w-2 bg-data-water inline-block" aria-hidden="true" />
                      HH Flood Min: {rec.hhFloodMinDb.toFixed(1)} dB
                    </span>
                  )}
                  {typeof rec.hvGamma0MeanDb === 'number' && (
                    <span>HV Mean: {rec.hvGamma0MeanDb.toFixed(1)} dB</span>
                  )}
                  {typeof rec.soilMoistureIndex === 'number' && (
                    <span>Soil Moisture: {rec.soilMoistureIndex.toFixed(2)}</span>
                  )}
                  {typeof rec.losDisplacementCm === 'number' && (
                    <span className="inline-flex items-center gap-1.5 text-survey-ink font-semibold">
                      <span className="h-2 w-2 bg-data-hh inline-block" aria-hidden="true" />
                      LOS Shift: {rec.losDisplacementCm.toFixed(1)} cm
                    </span>
                  )}
                  {typeof rec.coherenceMean === 'number' && (
                    <span>Coherence γ: {rec.coherenceMean.toFixed(2)}</span>
                  )}
                </div>

                {/* Highlighted Plain-English Summary & Translations */}
                <div
                  data-testid={`h5-translator-${rec.regionId}`}
                  className="border border-survey-border-strong bg-survey-surface p-3 space-y-2 text-[11px]"
                >
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-survey-ink">
                    In Simple Words (What This .h5 File Shows)
                  </div>

                  {rec.plainEnglishSummary && (
                    <p
                      data-testid={`h5-plain-summary-${rec.regionId}`}
                      className="border border-survey-border bg-survey-bg px-3 py-2 text-xs font-medium leading-relaxed text-survey-ink"
                    >
                      {rec.plainEnglishSummary}
                    </p>
                  )}

                  <p className="text-[var(--rr-muted)] leading-snug">
                    <strong className="text-[var(--rr-text)]">Water &amp; Floods (HH): </strong>
                    {translateWaterSignal(rec.hhGamma0MeanDb, rec.hhFloodMinDb)}
                  </p>

                  <p className="text-[var(--rr-muted)] leading-snug">
                    <strong className="text-[var(--rr-text)]">Crops &amp; Trees (HV): </strong>
                    {translateCropSignal(rec.hvGamma0MeanDb, rec.regionId)}
                  </p>

                  {moisture && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-bold text-[var(--rr-text)]">Soil Wetness</span>
                        <span className="font-mono font-bold text-survey-ink tabular-nums">
                          {moisture.pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full border border-survey-border bg-survey-bg overflow-hidden">
                        <div
                          className="h-full bg-data-water transition-all"
                          style={{ width: `${moisture.pct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-[var(--rr-muted)]">{moisture.label}</p>
                    </div>
                  )}

                  {groundShiftText && (
                    <p className="text-survey-muted leading-snug">
                      <strong className="inline-flex items-center gap-1.5 text-survey-ink">
                        <span className="h-2 w-2 bg-data-hh inline-block" aria-hidden="true" />
                        Ground Shift (cm):{' '}
                      </strong>
                      {groundShiftText}
                    </p>
                  )}

                  <ul className="space-y-0.5 border-t border-[var(--rr-border)] pt-1.5 text-[10px] text-[var(--rr-muted)]">
                    <li>
                      <code className="font-mono text-[var(--rr-text)]">HHHH</code> →{' '}
                      <strong className="text-[var(--rr-text)]">Water &amp; Surface Roughness Grid</strong>
                    </li>
                    <li>
                      <code className="font-mono text-[var(--rr-text)]">HVHV</code> →{' '}
                      <strong className="text-[var(--rr-text)]">Crop &amp; Tree Volume Grid</strong>
                    </li>
                    <li>
                      <code className="font-mono text-[var(--rr-text)]">boundingPolygon</code> →{' '}
                      <strong className="text-[var(--rr-text)]">GPS Map Outline</strong>
                    </li>
                  </ul>
                </div>

                {/* Live Binary Disk Slice Proof Badges */}
                {rec.liveDiskSlices && rec.liveDiskSlices.length > 0 && (
                  <div
                    data-testid={`disk-slices-${rec.regionId}`}
                    className="space-y-1.5 border border-[var(--rr-border)] bg-[var(--rr-surface-2)] p-2.5"
                  >
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-success-text)]">
                      Live Disk Read Proof ({rec.liveDiskSlices.length} Binary Slices)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                      {rec.liveDiskSlices.slice(0, 3).map((slice) => (
                        <div
                          key={`${rec.regionId}-${slice.offsetMB}-${slice.chunkSha256}`}
                          className="border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2 py-1.5 font-mono text-[10px] tabular-nums space-y-0.5"
                        >
                          <div className="text-[var(--rr-muted)]">
                            Offset MB:{' '}
                            <strong className="text-[var(--rr-text)]">
                              {slice.offsetMB.toFixed(1)} MB
                            </strong>
                          </div>
                          <div className="text-[var(--rr-muted)]">
                            Active Radar Fill:{' '}
                            <strong className="text-[var(--rr-accent)]">
                              {(slice.nonZeroByteRatio * 100).toFixed(1)}%
                            </strong>
                          </div>
                          <div className="text-[var(--rr-muted)] truncate" title={slice.chunkSha256}>
                            Chunk Hash:{' '}
                            <strong className="text-[var(--rr-success-text)]">
                              {slice.chunkSha256}
                            </strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  data-testid={`ask-ai-h5-${rec.regionId}`}
                  onClick={() => askAiToExplainH5(rec)}
                  className="w-full inline-flex items-center justify-center gap-2 border border-survey-basalt bg-survey-surface px-3 py-2 text-xs font-bold text-survey-ink hover:bg-survey-basalt hover:text-survey-basalt-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
                >
                  <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>Ask AI Guide to Explain This .h5 File</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Primary Open Data Sources */}
      <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3.5 space-y-2">
        <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-accent)]">
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Data Sources Used Here</span>
        </div>
        <ul className="space-y-1.5 text-xs text-[var(--rr-muted)]">
          <li>
            <strong className="text-[var(--rr-text)]">1. NASA–ISRO NISAR Cycle 035:</strong> Water, crop, and ground-shift radar scans.
          </li>
          <li>
            <strong className="text-[var(--rr-text)]">2. 2D Satellite Base Map:</strong> Real overhead photography to compare against radar.
          </li>
          <li>
            <strong className="text-[var(--rr-text)]">3. NASA POWER Weather:</strong> Daily rain and soil wetness measurements.
          </li>
          <li>
            <strong className="text-[var(--rr-text)]">4. NASA EONET Events:</strong> Live hazard alerts when Live NASA mode is on.
          </li>
        </ul>
      </div>

      {/* Primary .h5 Granule Info */}
      {(() => {
        const activeHardwareRec =
          hardwareRecords.find((r) => normalizeRegionMatch(r.regionId, region.id)) ??
          hardwareRecords[0];
        const primaryMoisture = translateSoilMoisture(
          activeHardwareRec?.soilMoistureIndex
        );
        const primaryShift = translateGroundShift(
          activeHardwareRec?.losDisplacementCm,
          activeHardwareRec?.coherenceMean
        );

        return (
          <div className="border border-[var(--rr-accent)] bg-[var(--rr-bg)] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
                Primary Radar File (.h5)
              </span>
              <span className="font-mono text-[10px] font-bold px-2 py-0.5 border border-survey-basalt bg-survey-basalt text-survey-basalt-text">
                Cycle {String(hdf5Manifest.cycle).padStart(3, '0')} · {hdf5Manifest.crid}
              </span>
            </div>

            <div className="font-mono text-[11px] font-bold text-[var(--rr-accent)] break-all">
              {hdf5Manifest.filename}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-[11px] text-[var(--rr-text)] tabular-nums">
              <div>Track: {String(hdf5Manifest.track).padStart(3, '0')}</div>
              <div>Frame: {String(hdf5Manifest.frame).padStart(3, '0')}</div>
              <div>Orbit: {hdf5Manifest.orbitDirection}</div>
              <div>BW: {hdf5Manifest.bandwidth}</div>
              <div>Pol: {hdf5Manifest.polarizationMode}</div>
              <div className="truncate" title={hdf5Manifest.acquisitionUtc}>
                UTC: {hdf5Manifest.acquisitionUtc}
              </div>
            </div>

            {/* Plain-English Primary .h5 Translator + Path Decoder */}
            <div
              data-testid="primary-h5-plain-english"
              className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3 space-y-2 text-[11px]"
            >
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-accent)]">
                What This .h5 File Means in Plain English
              </div>
              <p className="text-[var(--rr-muted)] leading-relaxed">
                <strong className="text-[var(--rr-text)]">What is a .h5 file? </strong>
                An .h5 (Hierarchical Data Format) file is NASA&apos;s scientific container that stores millions of radar echoes beamed through clouds at 24 cm microwave wavelength—acting like an X-ray of Earth&apos;s surface day or night.
              </p>

              {activeHardwareRec && (
                <div className="space-y-1.5 border-t border-[var(--rr-border)] pt-2">
                  <p className="text-[var(--rr-muted)] leading-snug">
                    <strong className="text-[var(--rr-text)]">Water &amp; Flood Signal (HH): </strong>
                    {translateWaterSignal(
                      activeHardwareRec.hhGamma0MeanDb,
                      activeHardwareRec.hhFloodMinDb
                    )}
                  </p>
                  <p className="text-[var(--rr-muted)] leading-snug">
                    <strong className="text-[var(--rr-text)]">Crop &amp; Forest Thickness (HV): </strong>
                    {translateCropSignal(
                      activeHardwareRec.hvGamma0MeanDb,
                      activeHardwareRec.regionId
                    )}
                  </p>
                  {primaryMoisture && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[var(--rr-text)]">Soil Wetness</span>
                        <span className="font-mono font-bold text-[var(--rr-accent)]">
                          {primaryMoisture.pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full border border-survey-border bg-survey-bg overflow-hidden">
                        <div
                          className="h-full bg-data-water"
                          style={{ width: `${primaryMoisture.pct}%` }}
                        />
                      </div>
                      <p className="text-survey-muted">{primaryMoisture.label}</p>
                    </div>
                  )}
                  {primaryShift && (
                    <p className="text-survey-muted leading-snug">
                      <strong className="inline-flex items-center gap-1.5 text-survey-ink">
                        <span className="h-2 w-2 bg-data-hh inline-block" aria-hidden="true" />
                        Ground Shift:{' '}
                      </strong>
                      {primaryShift}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-[var(--rr-border)] pt-2 space-y-1">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)]">
                  Filename &amp; HDF5 Path Decoder
                </div>
                <ul className="space-y-1 text-[11px] text-[var(--rr-muted)]">
                  <li className="break-all">
                    <code className="font-mono text-[10px] text-[var(--rr-accent)]">
                      {hdf5Manifest.paths.hhhh}
                    </code>{' '}
                    → <strong className="text-[var(--rr-text)]">Water &amp; Surface Roughness Grid</strong> (spots smooth floodwater vs rough ground)
                  </li>
                  <li className="break-all">
                    <code className="font-mono text-[10px] text-[var(--rr-accent)]">
                      {hdf5Manifest.paths.hvhv}
                    </code>{' '}
                    → <strong className="text-[var(--rr-text)]">Crop &amp; Tree Volume Grid</strong> (measures leaves, stems, and forest density)
                  </li>
                  <li className="break-all">
                    <code className="font-mono text-[10px] text-[var(--rr-accent)]">
                      {hdf5Manifest.paths.boundingPolygon}
                    </code>{' '}
                    → <strong className="text-[var(--rr-text)]">GPS Map Outline</strong> (places this satellite strip cleanly onto the 2D map)
                  </li>
                </ul>
              </div>
            </div>

            {activeHardwareRec && (
              <button
                type="button"
                data-testid="ask-ai-primary-h5-btn"
                onClick={() => askAiToExplainH5(activeHardwareRec)}
                className="w-full inline-flex items-center justify-center gap-2 border border-survey-basalt bg-survey-basalt px-3 py-2 text-xs font-bold text-survey-basalt-text hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
              >
                <Bot className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Ask AI Guide to Explain This .h5 File</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* Custom GeoJSON / JSON Upload */}
      <div className="border border-dashed border-[var(--rr-border-strong)] bg-[var(--rr-surface)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-[var(--rr-text)]">
              Upload Your Own GeoJSON or JSON File
            </div>
            <p className="text-[11px] text-[var(--rr-muted)]">
              Load custom radar scene files right inside your browser.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1.5 border border-survey-border-strong bg-survey-basalt px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-survey-basalt-text hover:opacity-90 focus-within:ring-2 focus-within:ring-survey-basalt">
            <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Upload JSON</span>
            <input
              type="file"
              accept=".json,.geojson,application/json,application/geo+json"
              onChange={handleFileUpload}
              className="sr-only"
              aria-label="Upload GeoJSON or JSON metadata file"
            />
          </label>
        </div>
        {uploadStatus && (
          <p className="mt-2 text-xs text-[var(--rr-success-text)] font-semibold">
            {uploadStatus}
          </p>
        )}
        {uploadError && (
          <p className="mt-2 text-xs text-[var(--rr-danger-text)] font-semibold" role="alert">
            {uploadError}
          </p>
        )}
      </div>

      {/* Catalog List */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)]">
            <Database className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>Satellite Scene Files ({combinedGranules.length})</span>
          </span>
          <span className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
            {granulesData?.source === 'ASF_VERTEX_LIVE_API'
              ? `Live (${granulesData.liveCount})`
              : 'Built-In List'}
          </span>
        </div>

        {combinedGranules.length === 0 ? (
          <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-4 text-xs text-[var(--rr-muted)]">
            No matching satellite files found for this area.
          </div>
        ) : (
          combinedGranules.map((g) => {
            const isExpanded = expandedJsonId === g.granuleId;
            return (
              <div
                key={g.granuleId}
                className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-[var(--rr-accent)] break-all">
                      {g.sceneName}
                    </div>
                    <div className="text-[11px] text-[var(--rr-muted)] mt-0.5">
                      {g.mission} · {g.beamMode} · {g.polarization}
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] text-[var(--rr-text)] shrink-0">
                    {g.processingLevel}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono tabular-nums text-[var(--rr-text)]">
                  <div>Date: {g.acquisitionDate}</div>
                  <div>Orbit: {g.orbitDirection}</div>
                  <div>Track/Frame: {g.trackNumber}/{g.frameNumber}</div>
                  <div>Wave: {g.wavelengthCm.toFixed(1)} cm</div>
                  <div>Grid: {g.spatialResolutionM} m</div>
                  <div className="truncate">
                    Source: {g.source === 'CUSTOM_UPLOAD' ? 'Upload' : g.source === 'ASF_VERTEX_LIVE_API' ? 'Live DB' : 'Sample'}
                  </div>
                </div>

                <p className="text-[11px] text-[var(--rr-muted)]">{g.browseNote}</p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedJsonId(isExpanded ? null : g.granuleId)
                    }
                    className="inline-flex items-center gap-1 border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--rr-text)] hover:border-[var(--rr-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                  >
                    <Code2 className="h-3 w-3 text-[var(--rr-accent)]" aria-hidden="true" />
                    <span>{isExpanded ? 'Hide JSON' : 'View JSON'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadMetadata(g)}
                    className="inline-flex items-center gap-1 border border-[var(--rr-border)] bg-[var(--rr-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--rr-text)] hover:border-[var(--rr-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                  >
                    <Download className="h-3 w-3 text-[var(--rr-accent)]" aria-hidden="true" />
                    <span>Download JSON</span>
                  </button>

                  <a
                    href={g.downloadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[var(--rr-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
                  >
                    <span>Source Link</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>

                {isExpanded && (
                  <pre className="mt-2 max-h-48 overflow-auto border border-survey-border bg-[var(--rr-space-bg)] p-2.5 font-mono text-[11px] text-[var(--rr-space-text)]">
                    {JSON.stringify(g, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Live NASA EONET Hazard Feed */}
      <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-text)] mb-1">
          Live Hazard Alerts (NASA EONET)
        </div>
        {demoMode ? (
          <p className="text-[11px] text-[var(--rr-muted)]">
            Sample Mode is on. Switch to <strong>Live NASA</strong> in the top bar to fetch live disaster events for this area.
          </p>
        ) : eonetEvents.length === 0 ? (
          <p className="text-[11px] text-[var(--rr-muted)]">
            No active hazard alerts overlap this area right now.
          </p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {eonetEvents.slice(0, 4).map((ev) => (
              <li
                key={ev.id}
                className="flex items-center justify-between gap-2 text-[var(--rr-text)]"
              >
                <span className="truncate">{ev.title}</span>
                <span className="font-mono text-[10px] text-[var(--rr-warn-text)] shrink-0">
                  {ev.category} · {ev.date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
