import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import {
  MapContainer,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import {
  EyeOff,
  GripVertical,
  Layers,
  Radar,
  Satellite,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  LayerMode,
  RegionDataset,
  StudyZone,
} from '../types/sar.ts';
import {
  computePassDelta,
  formatSigned,
  getPolygonVisualStyle,
} from '../utils/sarPhysics.ts';
import { getSurveyMapColors } from '../utils/surveyTheme.ts';

interface CloudPiercerMapProps {
  region: RegionDataset;
  selectedZone: StudyZone | null;
  onSelectZone: (zoneId: string) => void;
  layerMode: LayerMode;
  onSelectLayerMode: (mode: LayerMode) => void;
  passIndex: number;
  coherenceThreshold: number;
  onChangeCoherenceThreshold: (val: number) => void;
  demoMode: boolean;
  splitPercent: number;
  onChangeSplitPercent: (val: number) => void;
  isDark: boolean;
}

interface MainMapBridgeProps {
  center: [number, number];
  zoom: number;
  onMapReady: (map: L.Map) => void;
}

function MainMapBridge({ center, zoom, onMapReady }: MainMapBridgeProps) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [map, onMapReady]);

  useEffect(() => {
    map.setView(center, zoom, { animate: false });
    map.invalidateSize();
  }, [map, center, zoom]);

  return null;
}

interface SatelliteMapBridgeProps {
  center: [number, number];
  zoom: number;
  splitPercent: number;
  onMapReady: (map: L.Map) => void;
}

function SatelliteMapBridge({
  center,
  zoom,
  splitPercent,
  onMapReady,
}: SatelliteMapBridgeProps) {
  const map = useMap();

  useEffect(() => {
    onMapReady(map);
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [map, onMapReady]);

  useEffect(() => {
    map.setView(center, zoom, { animate: false });
    map.invalidateSize();
  }, [map, center, zoom]);

  useEffect(() => {
    if (splitPercent > 0) {
      map.invalidateSize();
    }
  }, [map, splitPercent]);

  return null;
}

type MapDisplayMode = 'SATELLITE' | 'SPLIT' | 'RADAR';

export function CloudPiercerMap({
  region,
  selectedZone,
  onSelectZone,
  layerMode,
  onSelectLayerMode,
  passIndex,
  coherenceThreshold,
  onChangeCoherenceThreshold,
  demoMode,
  splitPercent,
  onChangeSplitPercent,
  isDark,
}: CloudPiercerMapProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [mainMap, setMainMap] = useState<L.Map | null>(null);
  const [satelliteMap, setSatelliteMap] = useState<L.Map | null>(null);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const handleMainMapReady = useCallback((map: L.Map) => {
    setMainMap(map);
  }, []);

  const handleSatelliteMapReady = useCallback((map: L.Map) => {
    setSatelliteMap(map);
  }, []);

  // Keep 2D Satellite map tightly synced with the interactive Radar map
  useEffect(() => {
    if (!mainMap || !satelliteMap) return;

    const syncSatellite = () => {
      satelliteMap.setView(mainMap.getCenter(), mainMap.getZoom(), {
        animate: false,
      });
    };

    syncSatellite();
    mainMap.on('move', syncSatellite);
    mainMap.on('zoom', syncSatellite);
    mainMap.on('moveend', syncSatellite);
    mainMap.on('zoomend', syncSatellite);

    return () => {
      mainMap.off('move', syncSatellite);
      mainMap.off('zoom', syncSatellite);
      mainMap.off('moveend', syncSatellite);
      mainMap.off('zoomend', syncSatellite);
    };
  }, [mainMap, satelliteMap, region.id]);

  const updateSplitFromClientX = useCallback(
    (clientX: number) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      onChangeSplitPercent(Math.round(Math.min(100, Math.max(0, pct))));
    },
    [onChangeSplitPercent]
  );

  const mapColors = useMemo(() => getSurveyMapColors(), [isDark]);

  const activePass =
    selectedZone?.passes[passIndex] ?? region.zones[0].passes[passIndex];
  const activeDelta = selectedZone
    ? computePassDelta(selectedZone, passIndex)
    : null;
  const activeStyle = activePass
    ? getPolygonVisualStyle(activePass, layerMode, coherenceThreshold, isDark)
    : null;

  const isGunw = region.productType === 'GUNW';

  const layerOptions: Array<{ mode: LayerMode; label: string }> = isGunw
    ? [
        { mode: 'GUNW_LOS', label: 'Ground Movement (cm)' },
        { mode: 'GUNW_COHERENCE', label: 'Signal Clarity (%)' },
        { mode: 'GCOV_HH', label: 'Surface Water View' },
      ]
    : [
        { mode: 'GCOV_HH', label: 'Floodwater View' },
        { mode: 'GCOV_HV', label: 'Crops & Trees View' },
        { mode: 'GCOV_RATIO', label: 'Water + Crops Combined' },
      ];

  const viewMode: MapDisplayMode =
    splitPercent >= 98 ? 'SATELLITE' : splitPercent <= 2 ? 'RADAR' : 'SPLIT';

  const setViewMode = (mode: MapDisplayMode) => {
    if (mode === 'SATELLITE') {
      onChangeSplitPercent(100);
    } else if (mode === 'RADAR') {
      onChangeSplitPercent(0);
    } else {
      onChangeSplitPercent(50);
    }
  };

  return (
    <section
      aria-label="2D Satellite and Radar Comparison Map"
      className="border border-[var(--rr-border)] bg-[var(--rr-bg)]"
    >
      {/* Top Map Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rr-border)] px-4 py-3 bg-[var(--rr-surface)]">
        {/* Radar Layer Selector */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Radar map layer"
        >
          <Layers className="h-3.5 w-3.5 text-[var(--rr-accent)] mr-1 shrink-0" aria-hidden="true" />
          {layerOptions.map((opt) => {
            const active = layerMode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onSelectLayerMode(opt.mode)}
                aria-pressed={active}
                className={`px-2.5 py-1.5 border font-mono text-[10px] font-bold tracking-[0.12em] whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                  active
                    ? 'border-[var(--rr-accent-solid)] bg-[var(--rr-accent-solid)] text-survey-basalt-text'
                    : 'border-[var(--rr-border)] bg-[var(--rr-bg)] text-[var(--rr-muted)] hover:border-[var(--rr-border-strong)] hover:text-[var(--rr-text)]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Working Satellite | Split | Radar Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Map view mode: Satellite, Split, or Radar"
            data-testid="map-view-mode-toggle"
            className="inline-flex border border-[var(--rr-border)] bg-[var(--rr-bg)]"
          >
            {(
              [
                { id: 'SATELLITE', label: 'Satellite' },
                { id: 'SPLIT', label: 'Split' },
                { id: 'RADAR', label: 'Radar' },
              ] as const
            ).map((item) => {
              const active = viewMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`view-mode-${item.id.toLowerCase()}`}
                  onClick={() => setViewMode(item.id)}
                  aria-pressed={active}
                  className={`px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-accent)] ${
                    active
                      ? 'bg-[var(--rr-surface-inverse)] text-[var(--rr-text-inverse)]'
                      : 'text-[var(--rr-muted)] hover:text-[var(--rr-text)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <span
            data-testid="map-data-feed-badge"
            className={`hidden xl:inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1.5 border whitespace-nowrap ${
              demoMode
                ? 'border-[var(--rr-border)] bg-[var(--rr-bg)] text-[var(--rr-muted)]'
                : 'border-survey-moss/50 bg-survey-moss/10 text-survey-moss'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 rounded-full shrink-0 ${
                demoMode ? 'bg-survey-muted' : 'bg-survey-moss'
              }`}
            />
            <span>{demoMode ? 'Sample Data' : 'LIVE NASA FEED'}</span>
          </span>
        </div>
      </div>

      {/* Main Map Stage */}
      <div
        ref={stageRef}
        data-testid="cloud-piercer-map-stage"
        className="relative h-[360px] lg:h-[460px] w-full select-none overflow-hidden bg-[var(--rr-map-bg)]"
      >
        {/* Base Interactive Radar Map (Right / Full Radar) */}
        <MapContainer
          center={region.center}
          zoom={region.zoom}
          className="h-full w-full z-10"
          scrollWheelZoom={true}
        >
          <MainMapBridge
            center={region.center}
            zoom={region.zoom}
            onMapReady={handleMainMapReady}
          />
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            className={
              isDark ? 'nisar-dark-basemap-tiles' : 'nisar-industrial-basemap-tiles'
            }
          />

          {region.zones.map((zone) => {
            const pass = zone.passes[passIndex] ?? zone.passes[0];
            const style = getPolygonVisualStyle(
              pass,
              layerMode,
              coherenceThreshold,
              isDark
            );
            const isSelected = selectedZone?.id === zone.id;

            return (
              <Polygon
                key={`${region.id}-${zone.id}`}
                positions={zone.coordinates}
                pathOptions={{
                  color: isSelected
                    ? mapColors.selectedOutline
                    : style.strokeColor,
                  weight: isSelected ? 3.5 : 1.75,
                  fillColor: style.fillColor,
                  fillOpacity: isSelected
                    ? Math.min(0.72, style.fillOpacity + 0.14)
                    : style.fillOpacity,
                  dashArray: style.dimmed ? '4 4' : undefined,
                }}
                eventHandlers={{
                  click: () => onSelectZone(zone.id),
                }}
              >
                <Tooltip sticky>
                  <div className="text-xs font-sans">
                    <div className="font-semibold text-survey-ink">{zone.name}</div>
                    <div className="font-mono text-survey-muted">
                      {style.classificationLabel} ({style.formattedValue} {style.unit})
                    </div>
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}
        </MapContainer>

        {/* Left Clipped Real 2D Satellite Map (Esri World Imagery) */}
        <div
          aria-hidden="true"
          data-testid="optical-clip-pane"
          className="pointer-events-none absolute inset-0 z-[420]"
          style={{
            clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
            visibility: splitPercent <= 0 ? 'hidden' : 'visible',
          }}
        >
          <MapContainer
            center={region.center}
            zoom={region.zoom}
            className="h-full w-full"
            zoomControl={false}
            attributionControl={false}
            dragging={false}
            scrollWheelZoom={false}
            doubleClickZoom={false}
            boxZoom={false}
            keyboard={false}
            touchZoom={false}
          >
            <SatelliteMapBridge
              center={region.center}
              zoom={region.zoom}
              splitPercent={splitPercent}
              onMapReady={handleSatelliteMapReady}
            />
            <TileLayer
              maxNativeZoom={18}
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            {/* Crisp zone outline overlay so study areas remain visible on 2D Satellite imagery */}
            {region.zones.map((zone) => {
              const isSelected = selectedZone?.id === zone.id;
              return (
                <Polygon
                  key={`sat-outline-${region.id}-${zone.id}`}
                  positions={zone.coordinates}
                  pathOptions={{
                    color: isSelected
                      ? mapColors.satSelectedOutline
                      : mapColors.satOutline,
                    weight: isSelected ? 2.5 : 1.25,
                    opacity: isSelected ? 0.95 : 0.75,
                    fillOpacity: 0.08,
                    fillColor: mapColors.satSelectedFill,
                    dashArray: isSelected ? undefined : '4 4',
                  }}
                />
              );
            })}
          </MapContainer>
        </div>

        {/* Pane Corner Badges */}
        {splitPercent > 8 && (
          <div className="pointer-events-none absolute bottom-3 left-3 sm:bottom-auto sm:top-3 sm:left-14 z-[460] flex items-center gap-1.5 rounded-md border border-survey-border-strong bg-survey-surface px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-survey-ink">
            <Satellite className="h-3.5 w-3.5 text-data-water" aria-hidden="true" />
            <span>Camera View (Blocked by Clouds)</span>
          </div>
        )}

        {splitPercent < 92 && (
          <div className="pointer-events-none absolute top-3 right-3 z-[460] flex items-center gap-1.5 rounded-md border border-survey-border-strong bg-survey-surface px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-survey-ink">
            <Radar className="h-3.5 w-3.5 text-data-hh" aria-hidden="true" />
            <span>Radar View (Sees Through Clouds)</span>
          </div>
        )}

        {/* Draggable Split Divider Handle (Shown in Split / partial states) */}
        {splitPercent > 0 && splitPercent < 100 && (
          <div
            className="absolute top-0 bottom-0 z-[480] w-0.5 bg-survey-basalt"
            style={{ left: `${splitPercent}%` }}
          >
            <button
              type="button"
              data-testid="split-drag-handle"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                setIsDraggingSplit(true);
              }}
              onPointerMove={(e) => {
                if (!isDraggingSplit) return;
                updateSplitFromClientX(e.clientX);
              }}
              onPointerUp={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                setIsDraggingSplit(false);
              }}
              onPointerCancel={() => setIsDraggingSplit(false)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  onChangeSplitPercent(Math.max(0, splitPercent - 5));
                } else if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  onChangeSplitPercent(Math.min(100, splitPercent + 5));
                }
              }}
              aria-label={`Satellite and Radar split handle at ${splitPercent}%. Drag or use Left and Right arrow keys.`}
              className="touch-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-11 w-7 cursor-ew-resize items-center justify-center rounded-md border-2 border-survey-border-strong bg-survey-basalt text-survey-basalt-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-survey-basalt"
            >
              <GripVertical className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Controls, Legend & Selected Area Summary */}
      <div className="border-t border-[var(--rr-border)] bg-[var(--rr-surface)] px-4 py-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Working Satellite / Radar Split Slider */}
          <div className="flex items-center gap-2.5 min-w-[230px]">
            <label
              htmlFor="cloud-piercer-range"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--rr-muted)] whitespace-nowrap"
            >
              Camera vs Radar Wipe
            </label>
            <input
              id="cloud-piercer-range"
              data-testid="satellite-radar-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={splitPercent}
              onChange={(e) => onChangeSplitPercent(Number(e.target.value))}
              aria-label="Satellite and Radar comparison slider percentage"
              className="nisar-range w-32"
            />
            <span
              data-testid="satellite-radar-pct"
              className="font-mono text-xs font-bold text-[var(--rr-accent)] tabular-nums w-10 text-right"
            >
              {splitPercent}%
            </span>
          </div>

          {/* Signal Clarity Filter (GUNW only) */}
          {isGunw && (
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
              <label
                htmlFor="coherence-filter-range"
                className="font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--rr-muted)] whitespace-nowrap"
              >
                MIN CLARITY &ge;
              </label>
              <input
                id="coherence-filter-range"
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={coherenceThreshold}
                onChange={(e) =>
                  onChangeCoherenceThreshold(Number(e.target.value))
                }
                aria-label="Signal clarity filter threshold"
                className="nisar-range w-24"
              />
              <span className="font-mono text-xs font-bold text-[var(--rr-text)] tabular-nums w-10">
                {Math.round(coherenceThreshold * 100)}%
              </span>
            </div>
          )}

          {/* Map Color Key (Plain Everyday Language) */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-survey-muted font-mono">
            {layerMode === 'GCOV_HH' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-water" />
                  <span>Blue = Standing Floodwater</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-hh" />
                  <span>Orange = Wet Soil or Rough Land</span>
                </span>
              </>
            )}
            {layerMode === 'GCOV_HV' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-hv" />
                  <span>Green = Thick Crops &amp; Trees</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-hh" />
                  <span>Orange = Light Farm Cover</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-water" />
                  <span>Blue = Open Water</span>
                </span>
              </>
            )}
            {layerMode === 'GCOV_RATIO' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-water" />
                  <span>Blue = Floodwater Under Crops</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-hv" />
                  <span>Green = Healthy Plants</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-hh" />
                  <span>Orange = Bare Soil / Towns</span>
                </span>
              </>
            )}
            {layerMode === 'GUNW_LOS' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-status-error" />
                  <span>Red = Land Sank Heavily (&le; -10 cm)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-hh" />
                  <span>Orange = Land Sank Slightly</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-survey-bg" />
                  <span>Grey = Steady Ground</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-water" />
                  <span>Blue = Land Rose (&ge; +2 cm)</span>
                </span>
              </>
            )}
            {layerMode === 'GUNW_COHERENCE' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-hv" />
                  <span>Green = Clear Reading (&ge; 70%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-data-water" />
                  <span>Blue = Moderate Clarity (40–69%)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-survey-border-strong bg-status-warning" />
                  <span>Amber = Noisy / Dense Forest (&lt; 40%)</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Selected Sub-Zone Readout (Plain Everyday Language) */}
        {selectedZone && activePass && activeStyle ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-[var(--rr-border)] bg-[var(--rr-bg)] px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[var(--rr-text)]">
                  {selectedZone.name}
                </span>
                <span className="text-xs text-[var(--rr-muted)]">
                  · {selectedZone.districtOrPrefecture}
                </span>
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 border ${
                    selectedZone.hazardStatus === 'CRITICAL'
                      ? 'border-[var(--rr-danger-border)] text-[var(--rr-danger-text)] bg-[var(--rr-danger-bg)]'
                      : selectedZone.hazardStatus === 'ELEVATED'
                        ? 'border-[var(--rr-warn-border)] text-[var(--rr-warn-text)] bg-[var(--rr-warn-bg)]'
                        : 'border-[var(--rr-success-border)] text-[var(--rr-success-text)] bg-[var(--rr-success-bg)]'
                  }`}
                >
                  {selectedZone.hazardStatus === 'CRITICAL'
                    ? 'HIGH RISK'
                    : selectedZone.hazardStatus === 'ELEVATED'
                      ? 'WATCH'
                      : 'NORMAL'}
                </span>
              </div>
              <p className="text-xs text-[var(--rr-muted)] mt-0.5">
                <span className="font-semibold text-[var(--rr-text)]">
                  What Radar Sees:
                </span>{' '}
                {activeStyle.classificationLabel} · {selectedZone.dominantCover}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums shrink-0">
              {isGunw ? (
                <>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Ground Movement
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-accent)]">
                      {(activePass.losDisplacementCm ?? 0) <= -1
                        ? `Sank ${Math.abs(activePass.losDisplacementCm ?? 0).toFixed(1)} cm`
                        : (activePass.losDisplacementCm ?? 0) >= 1
                          ? `Rose +${(activePass.losDisplacementCm ?? 0).toFixed(1)} cm`
                          : `Steady (${formatSigned(activePass.losDisplacementCm ?? 0, 1)} cm)`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Change Since Scan 1
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      {formatSigned(activeDelta?.deltaLosCm ?? 0, 1)} cm
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Signal Clarity
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      {Math.round((activePass.coherence ?? 0) * 100)}% Clear
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Water on Ground
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-accent)]">
                      {activePass.hhGamma0Db <= -18
                        ? `Flooded (${activePass.hhGamma0Db.toFixed(1)} dB)`
                        : activePass.hhGamma0Db <= -13
                          ? `Very Wet (${activePass.hhGamma0Db.toFixed(1)} dB)`
                          : `Mostly Dry (${activePass.hhGamma0Db.toFixed(1)} dB)`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Change Since Scan 1
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      {(activeDelta?.deltaHhDb ?? 0) <= -3
                        ? `More Water (${formatSigned(activeDelta?.deltaHhDb ?? 0, 1)} dB)`
                        : (activeDelta?.deltaHhDb ?? 0) >= 2
                          ? `Drier (${formatSigned(activeDelta?.deltaHhDb ?? 0, 1)} dB)`
                          : `Steady (${formatSigned(activeDelta?.deltaHhDb ?? 0, 1)} dB)`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Soil Wetness
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      {Math.round(activePass.soilMoistureIndex * 100)}% Soaked
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 border border-[var(--rr-border)] bg-[var(--rr-bg)] px-3.5 py-2.5 text-xs text-[var(--rr-muted)]">
            <EyeOff className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>Tap any highlighted zone on the map to see its water, soil, or ground movement readings.</span>
          </div>
        )}
      </div>
    </section>
  );
}
