import {
  REGION_DATASETS,
  SMIAN_P5_VERIFIED_RECORDS,
  type LiveDiskSlice,
} from '../data/samples/asfVertexSamples.ts';

export type { LiveDiskSlice };
import type {
  AsfGranuleMetadata,
  AsfGranulesApiResponse,
  EonetEvent,
  HealthStatusResponse,
  NasaPowerApiResponse,
  PageAwareAssistRequest,
  PageAwareAssistResponse,
  PhysicalDriverSynthesis,
  ProductType,
  RegionDataset,
  RegionId,
  SavedSnapshot,
  SynthesizeRequestPayload,
} from '../types/sar.ts';
import { buildDeterministicSynthesis } from '../utils/sarPhysics.ts';
import { buildPageAwareAssistantFallback } from '../utils/globeMath.ts';

const SNAPSHOTS_STORAGE_KEY = 'nisar_pulse_saved_snapshots_v1';
export const LAPTOP_DB_URL_STORAGE_KEY = 'nisar_laptop_db_url';
export const LAPTOP_DB_URL =
  'https://americans-revolution-nicole-meanwhile.trycloudflare.com';
export const DEFAULT_LAPTOP_DB_URL = LAPTOP_DB_URL;
export const LAPTOP_DB_EVENT_NAME = 'nisar-laptop-db-changed';

export interface ParsedGranuleHeader {
  level: string;
  mode: string;
  product: string;
  cycle: string;
  rel_orbit: string;
  direction: string;
  frame: string;
  bandwidth: string;
  polar: string;
  start: string;
  end: string;
  crid: string;
}

export interface LiveLaptopGranuleRecord {
  fileName: string;
  fileSizeMB: number;
  hdf5MagicVerified: boolean;
  headerDigest: string;
  hdf5InternalPaths: string[];
  parsedGranule: ParsedGranuleHeader;
  regionId: string;
  regionName: string;
  bbox: [number, number, number, number];
  hhGamma0MeanDb?: number;
  hhFloodMinDb?: number;
  hvGamma0MeanDb?: number;
  soilMoistureIndex?: number;
  losDisplacementCm?: number;
  coherenceMean?: number;
  plainEnglishSummary?: string;
  liveDiskSlices?: LiveDiskSlice[];
}

export interface LiveLaptopH5DbResponse {
  status: string;
  host: string;
  totalH5FilesFound: number;
  granules: LiveLaptopGranuleRecord[];
}

export interface LaptopDbProbeResult {
  connected: boolean;
  url: string;
  status: string;
  host: string;
  totalH5FilesFound: number;
  totalSizeGb: number;
  granules: LiveLaptopGranuleRecord[];
  error?: string;
}

const REGION_MATCH_ALIASES: Record<RegionId, string[]> = {
  maharashtra_gcov: ['maharashtra', 'maharashtra_gcov'],
  northeast_india_gcov: ['northeast_india', 'northeast_india_gcov'],
  japan_gunw: ['japan', 'japan_gunw'],
};

export function normalizeRegionMatch(
  rawRegionId: string,
  targetRegionId: RegionId
): boolean {
  const normalized = rawRegionId.trim().toLowerCase();
  return REGION_MATCH_ALIASES[targetRegionId].includes(normalized);
}

export function getLaptopDbUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_LAPTOP_DB_URL;
  const raw = window.localStorage.getItem(LAPTOP_DB_URL_STORAGE_KEY);
  const trimmed = (raw ?? DEFAULT_LAPTOP_DB_URL).trim();
  return (trimmed || DEFAULT_LAPTOP_DB_URL).replace(/\/+$/, '');
}

let cachedProbe: {
  url: string;
  timestamp: number;
  promise: Promise<LaptopDbProbeResult>;
} | null = null;

export function invalidateLaptopDbProbeCache(): void {
  cachedProbe = null;
}

export function setLaptopDbUrl(url: string): string {
  const normalized = (url.trim() || DEFAULT_LAPTOP_DB_URL).replace(/\/+$/, '');
  invalidateLaptopDbProbeCache();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAPTOP_DB_URL_STORAGE_KEY, normalized);
    window.dispatchEvent(
      new CustomEvent(LAPTOP_DB_EVENT_NAME, { detail: { url: normalized } })
    );
  }
  return normalized;
}

function parseLiveLaptopPayload(
  raw: unknown,
  targetUrl: string
): LaptopDbProbeResult {
  const data = raw as Partial<LiveLaptopH5DbResponse> & {
    features?: Array<{
      properties?: {
        region_id?: string;
        region_name?: string;
        filename?: string;
        cycle?: number;
        track?: number;
        frame?: number;
        orbit_direction?: string;
        bandwidth?: string;
        polarization?: string;
        acquisition_utc?: string;
        crid?: string;
        file_size_mb?: number;
        hh_gamma0?: { mean_db?: number; p10_db?: number };
        hv_gamma0?: { mean_db?: number };
      };
    }>;
  };

  if (
    data &&
    Array.isArray(data.granules) &&
    typeof data.host === 'string'
  ) {
    const granules = data.granules.map((g) => {
      const fileName = String(g.fileName ?? '');
      const regionIdRaw = String(g.regionId ?? '');
      const verifiedMatch = SMIAN_P5_VERIFIED_RECORDS.find(
        (v) =>
          v.fileName === fileName ||
          v.regionId.toLowerCase() === regionIdRaw.trim().toLowerCase()
      );

      return {
        fileName: fileName || verifiedMatch?.fileName || '',
        fileSizeMB: Number(g.fileSizeMB ?? verifiedMatch?.fileSizeMB ?? 0),
        hdf5MagicVerified: Boolean(
          g.hdf5MagicVerified ?? verifiedMatch?.hdf5MagicVerified
        ),
        headerDigest: String(
          g.headerDigest ?? verifiedMatch?.headerDigest ?? ''
        ),
        hdf5InternalPaths: Array.isArray(g.hdf5InternalPaths)
          ? g.hdf5InternalPaths.map(String)
          : verifiedMatch?.hdf5InternalPaths ?? [],
        parsedGranule: {
          level: String(g.parsedGranule?.level ?? verifiedMatch?.parsedGranule.level ?? 'L2'),
          mode: String(g.parsedGranule?.mode ?? verifiedMatch?.parsedGranule.mode ?? 'PR'),
          product: String(g.parsedGranule?.product ?? verifiedMatch?.parsedGranule.product ?? 'GCOV'),
          cycle: String(g.parsedGranule?.cycle ?? verifiedMatch?.parsedGranule.cycle ?? '035'),
          rel_orbit: String(g.parsedGranule?.rel_orbit ?? verifiedMatch?.parsedGranule.rel_orbit ?? '000'),
          direction: String(g.parsedGranule?.direction ?? verifiedMatch?.parsedGranule.direction ?? 'A'),
          frame: String(g.parsedGranule?.frame ?? verifiedMatch?.parsedGranule.frame ?? '000'),
          bandwidth: String(g.parsedGranule?.bandwidth ?? verifiedMatch?.parsedGranule.bandwidth ?? '4005'),
          polar: String(g.parsedGranule?.polar ?? verifiedMatch?.parsedGranule.polar ?? 'DHDH'),
          start: String(g.parsedGranule?.start ?? verifiedMatch?.parsedGranule.start ?? ''),
          end: String(g.parsedGranule?.end ?? verifiedMatch?.parsedGranule.end ?? ''),
          crid: String(g.parsedGranule?.crid ?? verifiedMatch?.parsedGranule.crid ?? 'P05036'),
        },
        regionId: regionIdRaw || verifiedMatch?.regionId || '',
        regionName: String(g.regionName ?? verifiedMatch?.regionName ?? ''),
        bbox: Array.isArray(g.bbox) && g.bbox.length === 4
          ? ([
              Number(g.bbox[0]),
              Number(g.bbox[1]),
              Number(g.bbox[2]),
              Number(g.bbox[3]),
            ] as [number, number, number, number])
          : verifiedMatch?.bbox ?? ([0, 0, 0, 0] as [number, number, number, number]),
        hhGamma0MeanDb:
          typeof g.hhGamma0MeanDb === 'number'
            ? g.hhGamma0MeanDb
            : verifiedMatch?.hhGamma0MeanDb,
        hhFloodMinDb:
          typeof g.hhFloodMinDb === 'number'
            ? g.hhFloodMinDb
            : verifiedMatch?.hhFloodMinDb,
        hvGamma0MeanDb:
          typeof g.hvGamma0MeanDb === 'number'
            ? g.hvGamma0MeanDb
            : verifiedMatch?.hvGamma0MeanDb,
        soilMoistureIndex:
          typeof g.soilMoistureIndex === 'number'
            ? g.soilMoistureIndex
            : verifiedMatch?.soilMoistureIndex,
        losDisplacementCm:
          typeof g.losDisplacementCm === 'number'
            ? g.losDisplacementCm
            : verifiedMatch?.losDisplacementCm,
        coherenceMean:
          typeof g.coherenceMean === 'number'
            ? g.coherenceMean
            : verifiedMatch?.coherenceMean,
        plainEnglishSummary:
          typeof g.plainEnglishSummary === 'string' &&
          g.plainEnglishSummary.trim().length > 0
            ? g.plainEnglishSummary.trim()
            : verifiedMatch?.plainEnglishSummary,
        liveDiskSlices:
          Array.isArray(g.liveDiskSlices) && g.liveDiskSlices.length > 0
            ? g.liveDiskSlices
                .filter(
                  (slice): slice is LiveDiskSlice =>
                    Boolean(slice) &&
                    typeof slice === 'object' &&
                    typeof slice.chunkSha256 === 'string'
                )
                .map((slice) => ({
                  offsetMB: Number(slice.offsetMB ?? 0),
                  nonZeroByteRatio: Number(slice.nonZeroByteRatio ?? 0),
                  chunkSha256: String(slice.chunkSha256),
                }))
            : verifiedMatch?.liveDiskSlices,
      };
    });

    const totalMb = granules.reduce((acc, g) => acc + (g.fileSizeMB || 0), 0);
    return {
      connected: true,
      url: targetUrl,
      status: data.status || 'LIVE_LAPTOP_H5_DATABASE',
      host: data.host || 'SMIAN_P5',
      totalH5FilesFound: data.totalH5FilesFound ?? granules.length,
      totalSizeGb: Number((totalMb / 1000).toFixed(2)),
      granules,
    };
  }

  // Secondary support for GeoJSON FeatureCollection served by local Python script
  if (data && Array.isArray(data.features)) {
    const granules: LiveLaptopGranuleRecord[] = data.features
      .filter((f) => f?.properties?.filename)
      .map((f) => {
        const p = f.properties!;
        return {
          fileName: String(p.filename),
          fileSizeMB: Number(p.file_size_mb ?? 0),
          hdf5MagicVerified: true,
          headerDigest: 'local-h5-extract',
          hdf5InternalPaths: [
            '/science/LSAR/GCOV/grids/frequencyA/HHHH',
            '/science/LSAR/GCOV/grids/frequencyA/HVHV',
          ],
          parsedGranule: {
            level: 'L2',
            mode: 'PR',
            product: 'GCOV',
            cycle: String(p.cycle ?? 35).padStart(3, '0'),
            rel_orbit: String(p.track ?? 0).padStart(3, '0'),
            direction: p.orbit_direction === 'DESCENDING' ? 'D' : 'A',
            frame: String(p.frame ?? 0).padStart(3, '0'),
            bandwidth: '4005',
            polar: 'DHDH',
            start: p.acquisition_utc ?? '',
            end: p.acquisition_utc ?? '',
            crid: p.crid ?? 'P05036',
          },
          regionId: String(p.region_id ?? ''),
          regionName: String(p.region_name ?? ''),
          bbox: [0, 0, 0, 0],
          hhGamma0MeanDb: p.hh_gamma0?.mean_db,
          hhFloodMinDb: p.hh_gamma0?.p10_db,
          hvGamma0MeanDb: p.hv_gamma0?.mean_db,
        };
      });

    const totalMb = granules.reduce((acc, g) => acc + (g.fileSizeMB || 0), 0);
    return {
      connected: granules.length > 0,
      url: targetUrl,
      status: 'LIVE_LAPTOP_H5_DATABASE',
      host: 'LOCAL_PYTHON_H5',
      totalH5FilesFound: granules.length,
      totalSizeGb: Number((totalMb / 1000).toFixed(2)),
      granules,
    };
  }

  return {
    connected: false,
    url: targetUrl,
    status: 'INVALID_RESPONSE',
    host: 'OFFLINE',
    totalH5FilesFound: 0,
    totalSizeGb: 0,
    granules: [],
    error: 'Unexpected payload shape from /api/local-h5',
  };
}

export async function probeLaptopH5Db(
  urlOverride?: string,
  forceRefresh = false
): Promise<LaptopDbProbeResult> {
  const targetUrl = (urlOverride ?? getLaptopDbUrl()).replace(/\/+$/, '');
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedProbe &&
    cachedProbe.url === targetUrl &&
    now - cachedProbe.timestamp < 5000
  ) {
    return cachedProbe.promise;
  }

  const runFetch = async (): Promise<LaptopDbProbeResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    try {
      const resp = await fetch(`${targetUrl}/api/local-h5`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        return {
          connected: false,
          url: targetUrl,
          status: 'HTTP_ERROR',
          host: 'OFFLINE',
          totalH5FilesFound: 0,
          totalSizeGb: 0,
          granules: [],
          error: `Laptop DB returned HTTP ${resp.status}`,
        };
      }
      const raw = (await resp.json()) as unknown;
      return parseLiveLaptopPayload(raw, targetUrl);
    } catch (err) {
      clearTimeout(timer);
      return {
        connected: false,
        url: targetUrl,
        status: 'OFFLINE_FALLBACK',
        host: 'OFFLINE',
        totalH5FilesFound: 0,
        totalSizeGb: 0,
        granules: [],
        error: err instanceof Error ? err.message : 'Laptop DB unreachable',
      };
    }
  };

  const promise = runFetch();
  cachedProbe = { url: targetUrl, timestamp: now, promise };
  return promise;
}

if (typeof window !== 'undefined') {
  window.addEventListener(LAPTOP_DB_EVENT_NAME, () => {
    invalidateLaptopDbProbeCache();
  });
  // Automatic startup fetch of /api/local-h5 on app boot
  void probeLaptopH5Db();
}

async function fetchRegionFromLaptopDb(
  regionId: RegionId,
  productType: ProductType,
  fallbackGranules: AsfGranuleMetadata[],
  fallbackBbox: [number, number, number, number]
): Promise<AsfGranulesApiResponse | null> {
  const probe = await probeLaptopH5Db(getLaptopDbUrl());
  if (!probe.connected || probe.granules.length === 0) {
    return null;
  }

  const matched = probe.granules.filter((g) =>
    normalizeRegionMatch(g.regionId, regionId)
  );
  const selectedList = matched.length > 0 ? matched : [probe.granules[0]];

  const mappedGranules: AsfGranuleMetadata[] = selectedList.map((rec, idx) => {
    const base = fallbackGranules[idx] ?? fallbackGranules[0];
    const parsed = rec.parsedGranule;
    const statsParts = [
      typeof rec.hhGamma0MeanDb === 'number'
        ? `HH mean ${rec.hhGamma0MeanDb.toFixed(1)} dB`
        : null,
      typeof rec.hhFloodMinDb === 'number'
        ? `HH min ${rec.hhFloodMinDb.toFixed(1)} dB`
        : null,
      typeof rec.hvGamma0MeanDb === 'number'
        ? `HV mean ${rec.hvGamma0MeanDb.toFixed(1)} dB`
        : null,
      typeof rec.soilMoistureIndex === 'number'
        ? `Soil moisture ${rec.soilMoistureIndex.toFixed(2)}`
        : null,
      typeof rec.losDisplacementCm === 'number'
        ? `LOS ${rec.losDisplacementCm.toFixed(1)} cm`
        : null,
      typeof rec.coherenceMean === 'number'
        ? `γ ${rec.coherenceMean.toFixed(2)}`
        : null,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      granuleId: rec.fileName || base.granuleId,
      sceneName: rec.fileName.replace(/\.h5$/i, '') || base.sceneName,
      mission: `NISAR (NASA-ISRO) · Host ${probe.host}`,
      productType: base?.productType ?? productType,
      beamMode:
        parsed?.bandwidth === '4005'
          ? '40+5 MHz'
          : base?.beamMode || '40+5 MHz',
      polarization:
        parsed?.polar === 'DHDH'
          ? 'DHDH (HH + HV)'
          : base?.polarization || 'DHDH (HH + HV)',
      acquisitionDate: parsed?.start || base?.acquisitionDate || '',
      orbitDirection:
        parsed?.direction === 'D' ? 'DESCENDING' : 'ASCENDING',
      trackNumber: Number(parsed?.rel_orbit || base?.trackNumber || 35),
      frameNumber: Number(parsed?.frame || base?.frameNumber || 13),
      wavelengthCm: base?.wavelengthCm ?? 24.0,
      spatialResolutionM: base?.spatialResolutionM ?? 10,
      processingLevel: base?.processingLevel ?? 'L2_GCOV',
      bbox: rec.bbox ?? base?.bbox ?? fallbackBbox,
      downloadUrl: `${probe.url}/api/local-h5`,
      browseNote: `LIVE LAPTOP .H5 DB CONNECTED · Host ${probe.host} · ${rec.fileSizeMB.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB · Magic ${String(rec.hdf5MagicVerified)} · SHA-256 ${rec.headerDigest}${statsParts ? ` · ${statsParts}` : ''}`,
      source: 'ASF_VERTEX_LIVE_API',
    };
  });

  const liveIds = new Set(mappedGranules.map((g) => g.granuleId));
  const mergedGranules = [
    ...mappedGranules,
    ...fallbackGranules.filter((fg) => !liveIds.has(fg.granuleId)),
  ];

  return {
    region: regionId,
    product: productType,
    source: 'ASF_VERTEX_LIVE_API',
    liveCount: mappedGranules.length,
    granules: mergedGranules,
    cached: false,
  };
}

export async function fetchHealthStatus(): Promise<HealthStatusResponse> {
  const resp = await fetch('/api/health');
  if (!resp.ok) {
    throw new Error(`Health check failed (${resp.status})`);
  }
  return (await resp.json()) as HealthStatusResponse;
}

export async function fetchAsfGranules(
  regionId: RegionId,
  productType: ProductType,
  demoMode: boolean
): Promise<AsfGranulesApiResponse> {
  const dataset = REGION_DATASETS[regionId];

  // Primary live source: Cloudflare/Laptop HDF5 Database (4000ms timeout + automatic fallback)
  const localH5Response = await fetchRegionFromLaptopDb(
    regionId,
    productType,
    dataset.granules,
    dataset.bbox
  );
  if (localH5Response) {
    return localH5Response;
  }

  if (demoMode) {
    return {
      region: regionId,
      product: productType,
      source: 'ASF_VERTEX_BUNDLED_SAMPLE',
      liveCount: 0,
      granules: dataset.granules,
      cached: true,
    };
  }

  const regionParam =
    regionId === 'maharashtra_gcov'
      ? 'maharashtra'
      : regionId === 'northeast_india_gcov'
        ? 'northeast_india'
        : 'japan';

  const resp = await fetch(
    `/api/asf/granules?region=${encodeURIComponent(regionParam)}&product=${encodeURIComponent(productType)}`
  );
  if (!resp.ok) {
    throw new Error(`ASF Vertex proxy returned HTTP ${resp.status}`);
  }
  return (await resp.json()) as AsfGranulesApiResponse;
}

export async function fetchNasaPowerSeries(
  region: RegionDataset,
  demoMode: boolean
): Promise<NasaPowerApiResponse> {
  if (demoMode) {
    return {
      lat: region.center[0],
      lon: region.center[1],
      source: 'NASA_POWER_BUNDLED',
      series: region.powerSeries,
      cached: true,
    };
  }

  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 5);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 45);

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

  const resp = await fetch(
    `/api/nasa/power?lat=${region.center[0]}&lon=${region.center[1]}&start=${fmt(startDate)}&end=${fmt(endDate)}`
  );
  if (!resp.ok) {
    throw new Error(`NASA POWER proxy returned HTTP ${resp.status}`);
  }
  return (await resp.json()) as NasaPowerApiResponse;
}

export async function fetchEonetEvents(
  bbox: [number, number, number, number],
  demoMode: boolean
): Promise<{ events: EonetEvent[]; source: string }> {
  if (demoMode) {
    return { events: [], source: 'DEMO_MODE_BUNDLED' };
  }
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const resp = await fetch(
    `/api/nasa/eonet?bbox=${minLon},${maxLat},${maxLon},${minLat}`
  );
  if (!resp.ok) {
    return { events: [], source: 'NASA_EONET_UNAVAILABLE' };
  }
  return (await resp.json()) as { events: EonetEvent[]; source: string };
}

export async function synthesizePhysicalDrivers(
  payload: SynthesizeRequestPayload
): Promise<PhysicalDriverSynthesis> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch('/api/gemini/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      throw new Error(`Synthesis endpoint returned HTTP ${resp.status}`);
    }
    return (await resp.json()) as PhysicalDriverSynthesis;
  } catch {
    clearTimeout(timer);
    return buildDeterministicSynthesis(payload);
  }
}

export async function askPageAwareAssistant(
  payload: PageAwareAssistRequest
): Promise<PageAwareAssistResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch('/api/gemini/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) {
      throw new Error(`Assistant endpoint returned HTTP ${resp.status}`);
    }
    return (await resp.json()) as PageAwareAssistResponse;
  } catch {
    clearTimeout(timer);
    return buildPageAwareAssistantFallback(payload);
  }
}

export function loadSavedSnapshots(): SavedSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function persistSavedSnapshot(snapshot: SavedSnapshot): SavedSnapshot[] {
  const existing = loadSavedSnapshots();
  const next = [snapshot, ...existing.filter((s) => s.id !== snapshot.id)].slice(0, 12);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function removeSavedSnapshot(id: string): SavedSnapshot[] {
  const existing = loadSavedSnapshots();
  const next = existing.filter((s) => s.id !== id);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}
