import { useCallback, useEffect, useRef, useState } from 'react';
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

  const activePass =
    selectedZone?.passes[passIndex] ?? region.zones[0].passes[passIndex];
  const activeDelta = selectedZone
    ? computePassDelta(selectedZone, passIndex)
    : null;
  const activeStyle = activePass
    ? getPolygonVisualStyle(activePass, layerMode, coherenceThreshold)
    : null;

  const isGunw = region.productType === 'GUNW';

  const layerOptions: Array<{ mode: LayerMode; label: string }> = isGunw
    ? [
        { mode: 'GUNW_LOS', label: 'Shift (cm)' },
        { mode: 'GUNW_COHERENCE', label: 'Trust (γ)' },
        { mode: 'GCOV_HH', label: 'Base (HH dB)' },
      ]
    : [
        { mode: 'GCOV_HH', label: 'Water (HH)' },
        { mode: 'GCOV_HV', label: 'Crops (HV)' },
        { mode: 'GCOV_RATIO', label: 'Water + Crop Mix' },
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
                    ? 'border-[var(--rr-accent-solid)] bg-[var(--rr-accent-solid)] text-white'
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
            className={`hidden xl:inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.14em] px-2.5 py-1.5 border whitespace-nowrap ${
              demoMode
                ? 'border-[var(--rr-border)] bg-[var(--rr-bg)] text-[var(--rr-muted)]'
                : 'border-[var(--rr-accent)] bg-[var(--rr-accent)]/15 text-[var(--rr-accent)]'
            }`}
          >
            {demoMode ? 'Sample Data' : 'Live NASA'}
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
              coherenceThreshold
            );
            const isSelected = selectedZone?.id === zone.id;

            return (
              <Polygon
                key={`${region.id}-${zone.id}`}
                positions={zone.coordinates}
                pathOptions={{
                  color: isSelected
                    ? isDark
                      ? '#FFFFFF'
                      : '#18181B'
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
                    <div className="font-semibold text-[#18181B]">{zone.name}</div>
                    <div className="font-mono text-[#52525B]">
                      {style.formattedValue} {style.unit} · {style.classificationLabel}
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
                    color: isSelected ? '#38BDF8' : '#FFFFFF',
                    weight: isSelected ? 2.5 : 1.25,
                    opacity: isSelected ? 0.95 : 0.7,
                    fillOpacity: 0.06,
                    fillColor: '#38BDF8',
                    dashArray: isSelected ? undefined : '4 4',
                  }}
                />
              );
            })}
          </MapContainer>
        </div>

        {/* Pane Corner Badges */}
        {splitPercent > 8 && (
          <div className="pointer-events-none absolute bottom-3 left-3 sm:bottom-auto sm:top-3 sm:left-14 z-[460] flex items-center gap-1.5 border border-[var(--rr-border-strong)] bg-black/85 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            <Satellite className="h-3.5 w-3.5 text-[#38BDF8]" aria-hidden="true" />
            <span>2D Satellite View</span>
          </div>
        )}

        {splitPercent < 92 && (
          <div className="pointer-events-none absolute top-3 right-3 z-[460] flex items-center gap-1.5 border border-[#38BDF8] bg-black/85 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            <Radar className="h-3.5 w-3.5 text-[#38BDF8]" aria-hidden="true" />
            <span>Radar View ({region.productType})</span>
          </div>
        )}

        {/* Draggable Split Divider Handle (Shown in Split / partial states) */}
        {splitPercent > 0 && splitPercent < 100 && (
          <div
            className="absolute top-0 bottom-0 z-[480] w-0.5 bg-[#38BDF8]"
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
              className="touch-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-11 w-7 cursor-ew-resize items-center justify-center border-2 border-[#38BDF8] bg-black text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
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
              Satellite / Radar
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

          {/* Signal Trust Filter (GUNW only) */}
          {isGunw && (
            <div className="flex items-center gap-2.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--rr-accent)]" aria-hidden="true" />
              <label
                htmlFor="coherence-filter-range"
                className="font-mono text-[10px] font-bold tracking-[0.14em] text-[var(--rr-muted)] whitespace-nowrap"
              >
                TRUST γ &ge;
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
                aria-label="Signal trust filter threshold"
                className="nisar-range w-24"
              />
              <span className="font-mono text-xs font-bold text-[var(--rr-text)] tabular-nums w-10">
                {coherenceThreshold.toFixed(2)}
              </span>
            </div>
          )}

          {/* Map Color Key */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--rr-muted)] font-mono">
            {layerMode === 'GCOV_HH' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#00F0FF]" />
                  <span>Flood (&le; -18 dB)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#C04CFD]" />
                  <span>Wet Soil</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#E8559D]" />
                  <span>Dry Ground</span>
                </span>
              </>
            )}
            {layerMode === 'GCOV_HV' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#D4F844]" />
                  <span>Thick Crops (&ge; -12.5 dB)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#C04CFD]" />
                  <span>Light Cover</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#00F0FF]" />
                  <span>Open Water</span>
                </span>
              </>
            )}
            {layerMode === 'GCOV_RATIO' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#00F0FF]" />
                  <span>Water Under Plants</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#D4F844]" />
                  <span>Healthy Canopy</span>
                </span>
              </>
            )}
            {layerMode === 'GUNW_LOS' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#EF4444]" />
                  <span>Sinking (&le; -10 cm)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#00F0FF]" />
                  <span>Rising (&ge; +2 cm)</span>
                </span>
              </>
            )}
            {layerMode === 'GUNW_COHERENCE' && (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#D4F844]" />
                  <span>High Trust (&ge; 0.70)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 border border-[var(--rr-border-strong)] bg-[#F59E0B]" />
                  <span>Noisy (&lt; 0.40)</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Selected Sub-Zone Readout */}
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
                  {selectedZone.hazardStatus}
                </span>
              </div>
              <p className="text-xs text-[var(--rr-muted)] mt-0.5">
                {selectedZone.dominantCover} · {activeStyle.classificationLabel}
              </p>
            </div>

            <div className="flex items-center gap-4 font-mono text-xs tabular-nums shrink-0">
              {isGunw ? (
                <>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Ground Shift
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-accent)]">
                      {formatSigned(activePass.losDisplacementCm ?? 0, 1)} cm
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px] uppercase">
                      Phase
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      {formatSigned(activePass.unwrappedPhaseRad ?? 0, 2)} rad
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px]">
                      TRUST γ
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      γ {(activePass.coherence ?? 0).toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px]">
                      HH γ⁰
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-accent)]">
                      {activePass.hhGamma0Db.toFixed(1)} dB
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px]">
                      Change
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      {formatSigned(activeDelta?.deltaHhDb ?? 0, 1)} dB
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--rr-muted)] block text-[10px]">
                      HV γ⁰
                    </span>
                    <span className="text-sm font-bold text-[var(--rr-text)]">
                      {activePass.hvGamma0Db.toFixed(1)} dB
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 border border-[var(--rr-border)] bg-[var(--rr-bg)] px-3.5 py-2.5 text-xs text-[var(--rr-muted)]">
            <EyeOff className="h-4 w-4 text-[var(--rr-accent)]" aria-hidden="true" />
            <span>Tap any highlighted zone on the map to view its numbers.</span>
          </div>
        )}
      </div>
    </section>
  );
}
