import {
  BarChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
} from 'recharts';
import { AlertTriangle, CloudRain, Compass, RefreshCw } from 'lucide-react';
import type {
  NasaPowerApiResponse,
  RegionDataset,
  StudyZone,
} from '../types/sar.ts';

interface TelemetryPanelProps {
  region: RegionDataset;
  selectedZone: StudyZone | null;
  onSelectZone: (zoneId: string) => void;
  passIndex: number;
  powerData: NasaPowerApiResponse | null;
  isLoadingPower: boolean;
  powerError: string | null;
  onRetryPower: () => void;
  isDark: boolean;
}

export function TelemetryPanel({
  region,
  selectedZone,
  onSelectZone,
  passIndex,
  powerData,
  isLoadingPower,
  powerError,
  onRetryPower,
  isDark: _isDark,
}: TelemetryPanelProps) {
  const activeZone = selectedZone ?? region.zones[0];
  const isGunw = region.productType === 'GUNW';
  const activeDate = activeZone.passes[passIndex]?.acquisitionDate;

  const gridStroke = 'var(--rr-border)';
  const tickColor = 'var(--rr-muted)';
  const hhColor = 'var(--rr-hh)';
  const hvColor = 'var(--rr-hv)';
  const waterColor = 'var(--rr-water)';
  const tooltipStyle = {
    backgroundColor: 'var(--rr-surface)',
    border: '1px solid var(--rr-border-strong)',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'var(--rr-text)',
  };

  const timeSeriesData = activeZone.passes.map((pass, idx) => {
    const matchedPower =
      powerData?.series[idx] ?? powerData?.series[powerData.series.length - 1];
    const rainfallMm =
      powerData?.source === 'NASA_POWER_LIVE' && matchedPower
        ? matchedPower.rainfallMm
        : pass.rainfallMm;
    const soilMoisturePct = Number(
      (
        (powerData?.source === 'NASA_POWER_LIVE' && matchedPower
          ? matchedPower.soilMoistureIndex
          : pass.soilMoistureIndex) * 100
      ).toFixed(0)
    );

    return {
      date: pass.acquisitionDate.slice(5),
      fullDate: pass.acquisitionDate,
      passCode: `Scan ${idx + 1}`,
      hhDb: pass.hhGamma0Db,
      hvDb: pass.hvGamma0Db,
      losCm: pass.losDisplacementCm ?? 0,
      coherencePct: Number(((pass.coherence ?? 0) * 100).toFixed(0)),
      rainfallMm,
      soilMoisturePct,
    };
  });

  const scatterData = region.zones.map((z) => {
    const p = z.passes[passIndex] ?? z.passes[0];
    return {
      zoneId: z.id,
      name: z.name,
      wetnessPct: Math.round(p.soilMoistureIndex * 100),
      roughness: p.surfaceRoughnessCm,
      hhDb: p.hhGamma0Db,
      hvDb: p.hvGamma0Db,
      isSelected: z.id === activeZone.id,
    };
  });

  if (isLoadingPower) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading rain and soil charts">
        <div className="h-52 skeleton-shimmer" />
        <div className="h-52 skeleton-shimmer" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {powerError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border border-[var(--rr-warn-border)] bg-[var(--rr-warn-bg)] px-3 py-2 text-xs text-[var(--rr-warn-text)]"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{powerError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryPower}
            className="inline-flex items-center gap-1 border border-[var(--rr-border-strong)] bg-[var(--rr-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--rr-text)] hover:bg-[var(--rr-accent-solid)] hover:text-survey-basalt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)]"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Sub-zone Quick Selector */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--rr-muted)]">
            Pick an Area
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-accent)]">
            {powerData?.source === 'NASA_POWER_LIVE'
              ? 'NASA Weather Live'
              : 'NASA Weather Sample'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {region.zones.map((z) => {
            const active = z.id === activeZone.id;
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => onSelectZone(z.id)}
                aria-pressed={active}
                className={`truncate px-2.5 py-1.5 text-left text-xs transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                  active
                    ? 'border-[var(--rr-accent-solid)] bg-[var(--rr-accent-solid)] text-survey-basalt-text font-semibold'
                    : 'border-[var(--rr-border)] bg-[var(--rr-surface)] text-[var(--rr-text)] hover:border-[var(--rr-border-strong)]'
                }`}
                title={z.name}
              >
                {z.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Radar vs Rainfall Chart */}
      <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)]">
            <CloudRain className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>
              {isGunw
                ? 'Ground Movement (cm) vs Daily Rain (mm)'
                : 'Water & Crop Signal vs Daily Rain (mm)'}
            </span>
          </h3>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={timeSeriesData}
              margin={{ top: 8, right: 6, left: -16, bottom: 0 }}
            >
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                stroke={tickColor}
                tick={{ fontSize: 11, fill: tickColor }}
              />
              <YAxis
                yAxisId="sar"
                stroke={hhColor}
                tick={{ fontSize: 11, fill: tickColor }}
                domain={isGunw ? [-22, 8] : [-25, -5]}
              />
              <YAxis
                yAxisId="rain"
                orientation="right"
                stroke={tickColor}
                tick={{ fontSize: 11, fill: tickColor }}
                domain={[0, 160]}
              />
              <Tooltip contentStyle={tooltipStyle} />
              {activeDate && (
                <ReferenceLine
                  yAxisId="sar"
                  x={activeDate.slice(5)}
                  stroke={hhColor}
                  strokeDasharray="3 3"
                />
              )}
              <Bar
                yAxisId="rain"
                dataKey="rainfallMm"
                name="Rain (mm/day)"
                fill={waterColor}
                fillOpacity={0.32}
                barSize={18}
              />
              {isGunw ? (
                <Line
                  yAxisId="sar"
                  type="monotone"
                  dataKey="losCm"
                  name="Ground Movement (cm)"
                  stroke={hhColor}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: hhColor }}
                />
              ) : (
                <>
                  <Line
                    yAxisId="sar"
                    type="monotone"
                    dataKey="hhDb"
                    name="Water on Ground (dB)"
                    stroke={hhColor}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: hhColor }}
                  />
                  <Line
                    yAxisId="sar"
                    type="monotone"
                    dataKey="hvDb"
                    name="Crops & Plants (dB)"
                    stroke={hvColor}
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: hvColor }}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--rr-muted)] font-mono">
          <span>
            Soil Wetness: {Math.round((activeZone.passes[passIndex]?.soilMoistureIndex ?? 0) * 100)}% Soaked
          </span>
          <span>
            Daily Rain: {(activeZone.passes[passIndex]?.rainfallMm ?? 0).toFixed(1)} mm
          </span>
        </div>
      </div>

      {/* Soil Wetness vs Surface Roughness Scatter */}
      <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-text)]">
            <Compass className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>Soil Wetness (%) vs Ground Roughness</span>
          </h3>
          <span className="font-mono text-[10px] uppercase text-[var(--rr-muted)]">
            Tap dot
          </span>
        </div>

        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="wetnessPct"
                name="Soil Wetness (%)"
                domain={[0, 100]}
                stroke={tickColor}
                tick={{ fontSize: 11, fill: tickColor }}
              />
              <YAxis
                type="number"
                dataKey="roughness"
                name="Ground Texture (cm)"
                domain={[0, 8]}
                stroke={tickColor}
                tick={{ fontSize: 11, fill: tickColor }}
              />
              <ZAxis range={[90, 180]} />
              <ReferenceLine x={50} stroke={tickColor} strokeDasharray="3 3" />
              <ReferenceLine y={3.0} stroke={tickColor} strokeDasharray="3 3" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={tooltipStyle} />
              <Scatter
                name="Zones"
                data={scatterData}
                onClick={(point) => {
                  const payload = point as unknown as { zoneId?: string };
                  if (payload?.zoneId) {
                    onSelectZone(payload.zoneId);
                  }
                }}
              >
                {scatterData.map((entry) => (
                  <Cell
                    key={entry.zoneId}
                    fill={
                      entry.isSelected
                        ? waterColor
                        : 'var(--rr-text)'
                    }
                    stroke="var(--rr-surface)"
                    strokeWidth={entry.isSelected ? 2 : 1}
                    className="cursor-pointer"
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] font-mono text-[var(--rr-muted)]">
          <span>Dry Soil (Left)</span>
          <span className="text-right">Soaked / Flooded (Right)</span>
          <span>Smooth Water (Bottom)</span>
          <span className="text-right">Tall Crops (Top)</span>
        </div>
      </div>

      {/* Soil Moisture Bar Strip */}
      <div className="border border-[var(--rr-border)] bg-[var(--rr-surface)] p-3">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-muted)] mb-2">
          Soil Wetness (%) Across All 4 Scans
        </div>
        <div className="h-20 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeSeriesData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <XAxis dataKey="passCode" stroke={tickColor} tick={{ fontSize: 10, fill: tickColor }} />
              <YAxis domain={[0, 100]} stroke={tickColor} tick={{ fontSize: 10, fill: tickColor }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="soilMoisturePct" name="Soil Wetness %" fill={waterColor} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
