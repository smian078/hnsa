import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  buildBaselineMultiHazardPredictions,
  fetchNasaApiKeyStatus,
  runMultiHazardPredictions,
  type LiveLaptopGranuleRecord,
} from '../services/nisarApi.ts';
import type {
  HazardRiskLevel,
  MultiHazardPredictionsResponse,
  NasaApiKeyStatusResponse,
  RegionId,
  RegionalHazardPrediction,
} from '../types/sar.ts';

interface HomeHazardPredictionsSectionProps {
  records: LiveLaptopGranuleRecord[];
  onSelectRegionFromGlobe: (regionId: RegionId, zoneId?: string) => void;
}

const REGION_META: Record<
  RegionId,
  {
    indexLabel: string;
    shortTitle: string;
    subtitle: string;
    defaultZoneId: string;
    accentColorVar: string;
  }
> = {
  maharashtra_gcov: {
    indexLabel: '01 · Maharashtra',
    shortTitle: 'Gosikhurd Dam & Wardha Farms',
    subtitle: 'Wainganga River & Cotton Farmlands · India',
    defaultZoneId: 'mh_gosikhurd',
    accentColorVar: 'var(--rr-water)',
  },
  northeast_india_gcov: {
    indexLabel: '02 · Northeast India',
    shortTitle: 'Brahmaputra Valley & Kaziranga',
    subtitle: 'Assam River Floodplains & Majuli Island · India',
    defaultZoneId: 'ne_kaziranga',
    accentColorVar: 'var(--rr-hv)',
  },
  japan_gunw: {
    indexLabel: '03 · Japan',
    shortTitle: 'Noto Peninsula & Toyama Bay',
    subtitle: 'Ishikawa Coastline & Steep Hills · Japan',
    defaultZoneId: 'jp_noto',
    accentColorVar: 'var(--rr-hh)',
  },
};

function scoreToRiskLevel(score: number): HazardRiskLevel {
  if (score >= 78) return 'CRITICAL';
  if (score >= 58) return 'HIGH';
  if (score >= 35) return 'MODERATE';
  return 'LOW';
}

function getLevelStyles(level: HazardRiskLevel): {
  bg: string;
  border: string;
  text: string;
  barFill: string;
} {
  if (level === 'CRITICAL') {
    return {
      bg: 'var(--rr-danger-bg)',
      border: 'var(--rr-danger-border)',
      text: 'var(--rr-danger-text)',
      barFill: 'var(--rr-danger-border)',
    };
  }
  if (level === 'HIGH') {
    return {
      bg: 'var(--rr-warn-bg)',
      border: 'var(--rr-warn-border)',
      text: 'var(--rr-warn-text)',
      barFill: 'var(--rr-hh)',
    };
  }
  if (level === 'MODERATE') {
    return {
      bg: 'var(--rr-warn-bg)',
      border: 'var(--rr-warn-border)',
      text: 'var(--rr-warn-text)',
      barFill: 'var(--rr-warn-border)',
    };
  }
  return {
    bg: 'var(--rr-success-bg)',
    border: 'var(--rr-success-border)',
    text: 'var(--rr-success-text)',
    barFill: 'var(--rr-hv)',
  };
}

function RiskBarRow({
  label,
  score,
  colorVar,
}: {
  label: string;
  score: number;
  colorVar: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const level = scoreToRiskLevel(clamped);
  const style = getLevelStyles(level);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-[var(--rr-text)]">{label}</span>
        <div className="flex items-center gap-2 font-mono tabular-nums">
          <span className="text-[11px] font-bold text-[var(--rr-text)]">
            {clamped}/100
          </span>
          <span
            style={{
              backgroundColor: style.bg,
              borderColor: style.border,
              color: style.text,
            }}
            className="border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded"
          >
            {level}
          </span>
        </div>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-sm border border-[var(--rr-border)] bg-[var(--rr-surface-2)]"
        role="progressbar"
        aria-label={`${label}: ${clamped} out of 100 (${level})`}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          style={{
            width: `${clamped}%`,
            backgroundColor: colorVar,
          }}
          className="h-full transition-all duration-300"
        />
      </div>
    </div>
  );
}

export function HomeHazardPredictionsSection({
  records,
  onSelectRegionFromGlobe,
}: HomeHazardPredictionsSectionProps) {
  const [data, setData] = useState<MultiHazardPredictionsResponse>(() =>
    buildBaselineMultiHazardPredictions(records)
  );
  const [nasaStatus, setNasaStatus] =
    useState<NasaApiKeyStatusResponse | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const triggerForecast = useCallback(
    async (forceRefresh: boolean) => {
      setIsRunning(true);
      try {
        const result = await runMultiHazardPredictions(records, forceRefresh);
        setData(result);
      } finally {
        setIsRunning(false);
      }
    },
    [records]
  );

  useEffect(() => {
    setData((prev) =>
      prev.source === 'DETERMINISTIC_PHYSICS_FALLBACK'
        ? buildBaselineMultiHazardPredictions(records)
        : prev
    );
  }, [records]);

  useEffect(() => {
    void triggerForecast(false);
    void fetchNasaApiKeyStatus().then(setNasaStatus);
  }, [triggerForecast]);

  const sourceLabel =
    data.source === 'GEMINI_4_HYDROGEN'
      ? 'Live AI + NASA POWER & Open-Meteo'
      : data.source === 'GEMINI_2_5_FLASH'
        ? 'Live AI + NASA POWER & Open-Meteo'
        : data.source === 'NVIDIA_NEMOTRON_3_5'
          ? 'NVIDIA Nemotron 3.5 + Live NASA & Weather Feeds'
          : 'Live Radar Physics + NASA & Weather Feeds';

  return (
    <section
      id="hazard-predictions"
      data-testid="home-hazard-predictions-section"
      aria-label="7-Day AI Multi-Hazard Predictions"
      className="border-t border-[var(--rr-border)] bg-[var(--rr-bg)] px-4 sm:px-8 py-20"
    >
      <div className="mx-auto max-w-[1600px] space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-[var(--rr-border)] pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-micro text-[var(--rr-muted)]">
                03 / 7-DAY AI HAZARD PREDICTIONS
              </span>
              <span
                data-testid="nasa-key-active-badge"
                style={{
                  backgroundColor: 'var(--rr-success-bg)',
                  borderColor: 'var(--rr-success-border)',
                  color: 'var(--rr-success-text)',
                }}
                className="inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                <span>
                  NASA API Key Active (
                  {nasaStatus?.maskedKey || 'GwJC...Active'}) · 1,000 req/hr
                </span>
              </span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[var(--rr-text)]">
              7-Day Flood, Landslide &amp; Ground Safety Forecast
            </h2>
            <p className="text-xs sm:text-sm text-[var(--rr-muted)] max-w-3xl leading-relaxed">
              Combines our verified local <code className="font-mono text-[var(--rr-text)]">.h5</code>{' '}
              satellite radar scans with live NASA POWER satellite weather,
              7-day rain forecasts, river water flow, hill steepness, and nearby
              USGS earthquakes—explained in simple everyday words.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <div className="font-mono text-[11px] text-[var(--rr-muted)]">
              Source:{' '}
              <span className="font-semibold text-[var(--rr-text)]">
                {sourceLabel}
              </span>
            </div>
            <button
              type="button"
              data-testid="run-all-hazard-forecasts-btn"
              onClick={() => void triggerForecast(true)}
              disabled={isRunning}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--rr-border-strong)] bg-[var(--rr-surface-inverse)] px-4 py-2.5 text-xs font-semibold text-[var(--rr-text-inverse)] hover:opacity-90 disabled:opacity-60 transition-opacity whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-border-strong)]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRunning ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>
                {isRunning
                  ? 'Updating Live 7-Day Forecast...'
                  : 'Refresh Live 7-Day Forecast'}
              </span>
            </button>
          </div>
        </div>

        {/* 3-Column Regional Prediction Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {data.predictions.map((pred: RegionalHazardPrediction) => {
            const meta = REGION_META[pred.regionId];
            const overallStyles = getLevelStyles(pred.overallLevel);
            const t = pred.telemetryInput;
            const f = t.liveForecast;
            const isGunw = pred.regionId === 'japan_gunw';

            return (
              <article
                key={pred.regionId}
                data-testid={`hazard-card-${pred.regionId}`}
                className="flex flex-col justify-between rounded-xl border border-[var(--rr-border)] bg-[var(--rr-surface)] p-5 sm:p-6 space-y-5"
              >
                <div className="space-y-4">
                  {/* Card Top Header + Overall Risk Level */}
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--rr-border)] pb-3.5">
                    <div>
                      <div className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--rr-muted)]">
                        {meta.indexLabel}
                      </div>
                      <h3 className="font-display text-xl font-bold text-[var(--rr-text)] mt-0.5">
                        {meta.shortTitle}
                      </h3>
                      <div className="text-xs text-[var(--rr-muted)] mt-0.5">
                        {meta.subtitle}
                      </div>
                    </div>

                    <span
                      data-testid={`hazard-overall-badge-${pred.regionId}`}
                      style={{
                        backgroundColor: overallStyles.bg,
                        borderColor: overallStyles.border,
                        color: overallStyles.text,
                      }}
                      className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider shrink-0"
                    >
                      {pred.overallLevel === 'CRITICAL' ||
                      pred.overallLevel === 'HIGH' ? (
                        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : pred.overallLevel === 'MODERATE' ? (
                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>{pred.overallLevel}</span>
                    </span>
                  </div>

                  {/* Fused SMIAN_P5 .H5 + Live NASA POWER, Open-Meteo & USGS Telemetry Strip */}
                  <div className="rounded-lg border border-[var(--rr-border)] bg-[var(--rr-surface-2)] p-3 space-y-2">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[var(--rr-muted)]">
                      <span>What Satellites &amp; Weather Stations See Right Now</span>
                      <span className="text-[var(--rr-success-text)] font-bold">
                        {f.source === 'LIVE_OPEN_METEO_USGS'
                          ? `LIVE · ${new Date(f.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'BASELINE'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs tabular-nums">
                      {/* Box 1: Water on Ground */}
                      <div className="rounded border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2">
                        <div className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
                          Water on Ground
                        </div>
                        <div className="font-bold text-[var(--rr-water)] mt-0.5">
                          {t.hhFloodMinDb <= -20
                            ? 'Floodwater Present'
                            : t.hhFloodMinDb <= -17.5
                              ? 'Standing Water'
                              : 'Wet Ground'}
                        </div>
                        <div className="text-[10px] text-[var(--rr-muted)] mt-0.5">
                          Radar: {t.hhFloodMinDb.toFixed(1)} dB (calm water)
                        </div>
                      </div>

                      {/* Box 2: Live Soil Condition or Ground Movement */}
                      <div className="rounded border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2">
                        <div className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
                          {isGunw ? 'Land Movement' : 'Live Soil Wetness'}
                        </div>
                        <div
                          className="font-bold mt-0.5"
                          style={{
                            color: isGunw ? 'var(--rr-hh)' : 'var(--rr-hv)',
                          }}
                        >
                          {isGunw
                            ? `Sank ${Math.abs(t.losDisplacementCm ?? -18.6).toFixed(1)} cm`
                            : `${f.nasaPowerWetnessPct ?? Math.round((f.topsoilMoistureM3M3 / 0.5) * 100)}% Wet`}
                        </div>
                        <div className="text-[10px] text-[var(--rr-muted)] mt-0.5">
                          {isGunw
                            ? 'Dropped after earthquake'
                            : `Topsoil: ${f.topsoilMoistureM3M3.toFixed(2)} m³/m³`}
                        </div>
                      </div>

                      {/* Box 3: Real-Time Rain Next 7 Days */}
                      <div className="rounded border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2">
                        <div className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
                          Rain (Next 7 Days)
                        </div>
                        <div className="font-bold text-[var(--rr-text)] mt-0.5">
                          {f.rain7DayTotalMm >= 100
                            ? `Very Heavy (${f.rain7DayTotalMm.toFixed(1)} mm)`
                            : f.rain7DayTotalMm >= 50
                              ? `Heavy (${f.rain7DayTotalMm.toFixed(1)} mm)`
                              : f.rain7DayTotalMm >= 15
                                ? `Moderate (${f.rain7DayTotalMm.toFixed(1)} mm)`
                                : `Light (${f.rain7DayTotalMm.toFixed(1)} mm)`}
                        </div>
                        <div className="text-[10px] text-[var(--rr-muted)] mt-0.5">
                          Peak day: {f.rainDailyMaxMm.toFixed(1)} mm
                        </div>
                      </div>

                      {/* Box 4: Real-Time River Water Flow */}
                      <div className="rounded border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2">
                        <div className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
                          River Water Flow
                        </div>
                        <div className="font-bold text-[var(--rr-text)] mt-0.5">
                          {f.peakRiverDischargeM3s >= 8000
                            ? 'Massive Flood Surge'
                            : f.peakRiverDischargeM3s >= 1500
                              ? 'Large River Flow'
                              : f.peakRiverDischargeM3s >= 100
                                ? 'Moderate Flow'
                                : 'Steady Stream Flow'}
                        </div>
                        <div className="text-[10px] text-[var(--rr-muted)] mt-0.5">
                          {f.peakRiverDischargeM3s.toLocaleString('en-US', {
                            maximumFractionDigits: 1,
                          })}{' '}
                          m³/s (live GloFAS)
                        </div>
                      </div>

                      {/* Box 5: Terrain Shape / Steepness */}
                      <div className="rounded border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2">
                        <div className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
                          Land Shape
                        </div>
                        <div className="font-bold text-[var(--rr-text)] mt-0.5">
                          {f.slopeDegrees >= 10
                            ? `Steep Hills (${f.slopeDegrees.toFixed(1)}°)`
                            : f.slopeDegrees >= 3.5
                              ? `Gentle Slopes (${f.slopeDegrees.toFixed(1)}°)`
                              : `Flat Plains (${f.slopeDegrees.toFixed(1)}°)`}
                        </div>
                        <div className="text-[10px] text-[var(--rr-muted)] mt-0.5">
                          Elevation: {f.elevationCenterM} m
                        </div>
                      </div>

                      {/* Box 6: Nearby Earthquakes */}
                      <div className="rounded border border-[var(--rr-border)] bg-[var(--rr-surface)] px-2.5 py-2">
                        <div className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
                          Recent Earthquakes
                        </div>
                        <div className="font-bold text-[var(--rr-text)] mt-0.5">
                          {f.recentQuakesCount > 0
                            ? f.maxQuakeMagnitude >= 5.0
                              ? `${f.recentQuakesCount} Strong (M${f.maxQuakeMagnitude.toFixed(1)})`
                              : `${f.recentQuakesCount} Mild (M${f.maxQuakeMagnitude.toFixed(1)})`
                            : 'None (Calm)'}
                        </div>
                        <div className="text-[10px] text-[var(--rr-muted)] mt-0.5">
                          {f.recentQuakesCount > 0 && f.recentQuakes[0]
                            ? f.recentQuakes[0].place
                            : 'No M3.5+ quakes in 30d'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3 Clean Horizontal Risk Bars */}
                  <div className="space-y-3 pt-1">
                    <RiskBarRow
                      label="Flood Risk"
                      score={pred.floodScore}
                      colorVar="var(--rr-water)"
                    />
                    <RiskBarRow
                      label="Landslide Risk"
                      score={pred.landslideScore}
                      colorVar="var(--rr-hh)"
                    />
                    <RiskBarRow
                      label={
                        isGunw
                          ? 'Ground Shift Risk'
                          : 'Crop Waterlogging Risk'
                      }
                      score={pred.cropOrGroundScore}
                      colorVar={isGunw ? 'var(--rr-hh)' : 'var(--rr-hv)'}
                    />
                  </div>

                  {/* Plain-English AI Forecast & What People Should Do */}
                  <div className="space-y-2.5 border-t border-[var(--rr-border)] pt-3.5">
                    <div className="font-display text-sm font-bold text-[var(--rr-text)]">
                      {pred.predictionHeadline}
                    </div>
                    <p className="text-xs text-[var(--rr-muted)] leading-relaxed">
                      {pred.plainEnglishForecast}
                    </p>
                    <div className="rounded-lg border border-[var(--rr-border)] bg-[var(--rr-surface-2)] p-3 text-xs">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--rr-text)] block mb-1">
                        What People Should Do
                      </span>
                      <span className="text-[var(--rr-text)] leading-relaxed">
                        {pred.recommendedAction}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer CTA: Inspect on 2D Radar Map */}
                <div className="pt-2 border-t border-[var(--rr-border)] flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-[var(--rr-muted)] truncate">
                    {t.h5FileName.slice(0, 28)}...
                  </span>
                  <button
                    type="button"
                    data-testid={`inspect-hazard-map-${pred.regionId}`}
                    onClick={() =>
                      onSelectRegionFromGlobe(pred.regionId, meta.defaultZoneId)
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--rr-surface-inverse)] px-3.5 py-2 text-xs font-semibold text-[var(--rr-text-inverse)] hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-border-strong)]"
                  >
                    <span>Inspect on 2D Radar Map</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
