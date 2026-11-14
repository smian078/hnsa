import { Router } from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { REGION_DATASETS } from '../src/data/samples/asfVertexSamples.ts';
import type {
  AsfGranuleMetadata,
  DatasetAspectId,
  EonetEvent,
  LanguageCode,
  PageAwareAssistRequest,
  PageAwareAssistResponse,
  PageViewMode,
  PhysicalDriverSynthesis,
  PowerDailyPoint,
  ProductType,
  RegionId,
  ScatteringMechanism,
  SynthesizeRequestPayload,
} from '../src/types/sar.ts';
import { buildDeterministicSynthesis } from '../src/utils/sarPhysics.ts';
import {
  buildPageAwareAssistantFallback,
  formatPageContextLabel,
} from '../src/utils/globeMath.ts';
import { IpRateLimiter, TtlSwrCache } from './cache.ts';

const apiCache = new TtlSwrCache();
const rateLimiter = new IpRateLimiter(60, 60_000);

const REGION_ALIASES: Record<string, RegionId> = {
  maharashtra: 'maharashtra_gcov',
  maharashtra_gcov: 'maharashtra_gcov',
  northeast_india: 'northeast_india_gcov',
  northeast_india_gcov: 'northeast_india_gcov',
  japan: 'japan_gunw',
  japan_gunw: 'japan_gunw',
};

const VALID_LANGUAGES = new Set<LanguageCode>(['en', 'mr', 'hi']);
const VALID_SCATTERING = new Set<ScatteringMechanism>([
  'SPECULAR_WATER',
  'DOUBLE_BOUNCE_FLOODED_VEG',
  'VOLUME_CANOPY',
  'INSAR_PHASE_DEFORMATION',
]);

async function fetchWithTimeoutAndRetry(
  url: string,
  timeoutMs = 6000,
  retries = 1
): Promise<globalThis.Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'NISAR-Pulse/1.0',
        },
      });
      clearTimeout(timer);
      if (!resp.ok) {
        throw new Error(`Upstream HTTP ${resp.status}`);
      }
      return resp;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Upstream fetch failed');
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function createApiRouter(): Router {
  const router = Router();

  // Rate limiting for /api/*
  router.use((req: Request, res: Response, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const check = rateLimiter.allow(ip);
    res.setHeader('X-RateLimit-Remaining', String(check.remaining));
    if (!check.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded (60 requests/minute). Please retry shortly.',
        retryAfterSec: check.resetInSec,
      });
      return;
    }
    next();
  });

  // 1. Health Check
  router.get('/health', (_req: Request, res: Response) => {
    const geminiKey = process.env.GEMINI_API_KEY?.trim();
    const nasaKey = process.env.NASA_API_KEY?.trim();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      cacheEntries: apiCache.size(),
      geminiConfigured: Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY'),
      nasaKeyConfigured: Boolean(nasaKey),
    });
  });

  // 2. ASF Vertex Granule Search Proxy
  router.get('/asf/granules', async (req: Request, res: Response) => {
    const rawRegion =
      typeof req.query.region === 'string' ? req.query.region.toLowerCase() : 'maharashtra';
    const regionId = REGION_ALIASES[rawRegion];
    if (!regionId) {
      res.status(400).json({
        error: 'Invalid region parameter. Allowed: maharashtra, northeast_india, japan.',
      });
      return;
    }

    const rawProduct =
      typeof req.query.product === 'string'
        ? req.query.product.toUpperCase()
        : REGION_DATASETS[regionId].productType;
    if (rawProduct !== 'GCOV' && rawProduct !== 'GUNW') {
      res.status(400).json({
        error: 'Invalid product parameter. Allowed: GCOV, GUNW.',
      });
      return;
    }

    const dataset = REGION_DATASETS[regionId];
    const cacheKey = `asf:${regionId}:${rawProduct}`;
    const cached = apiCache.get<{
      granules: AsfGranuleMetadata[];
      source: 'ASF_VERTEX_LIVE_API' | 'ASF_VERTEX_BUNDLED_SAMPLE';
      liveCount: number;
    }>(cacheKey);

    if (cached && !cached.isStale) {
      res.json({
        region: regionId,
        product: rawProduct,
        source: cached.value.source,
        liveCount: cached.value.liveCount,
        granules: cached.value.granules,
        cached: true,
      });
      return;
    }

    const [minLon, minLat, maxLon, maxLat] = dataset.bbox;
    const asfUrl = `https://api.daac.asf.alaska.edu/services/search/param?bbox=${minLon},${minLat},${maxLon},${maxLat}&dataset=NISAR,SENTINEL-1&maxResults=10&output=geojson`;

    const fetchLiveAsf = async () => {
      const resp = await fetchWithTimeoutAndRetry(asfUrl, 6000, 1);
      const geojson = (await resp.json()) as {
        features?: Array<{
          properties?: Record<string, unknown>;
        }>;
      };

      const features = Array.isArray(geojson.features) ? geojson.features : [];
      const liveGranules: AsfGranuleMetadata[] = features.slice(0, 8).map((feat, idx) => {
        const p = feat.properties ?? {};
        const platform = typeof p.platform === 'string' ? p.platform : 'Sentinel-1 / SAR';
        const sceneName =
          typeof p.sceneName === 'string'
            ? p.sceneName
            : typeof p.fileID === 'string'
              ? p.fileID
              : `ASF_SCENE_${idx + 1}`;
        const level =
          typeof p.processingLevel === 'string' ? p.processingLevel : rawProduct;
        const startTime =
          typeof p.startTime === 'string'
            ? p.startTime.slice(0, 10)
            : dataset.gibsDate;

        return {
          granuleId: typeof p.fileID === 'string' ? p.fileID : sceneName,
          sceneName,
          mission: platform,
          productType: rawProduct as ProductType,
          beamMode: typeof p.beamModeType === 'string' ? p.beamModeType : 'IW',
          polarization:
            typeof p.polarization === 'string' ? p.polarization : 'VV+VH / Dual-Pol',
          acquisitionDate: startTime,
          orbitDirection:
            p.flightDirection === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING',
          trackNumber: typeof p.pathNumber === 'number' ? p.pathNumber : dataset.granules[0].trackNumber,
          frameNumber: typeof p.frameNumber === 'number' ? p.frameNumber : dataset.granules[0].frameNumber,
          wavelengthCm: platform.toUpperCase().includes('NISAR') ? 24.0 : 5.6,
          spatialResolutionM: 10,
          processingLevel: level,
          bbox: dataset.bbox,
          downloadUrl:
            typeof p.url === 'string'
              ? p.url
              : 'https://search.asf.alaska.edu/',
          browseNote: `Live ASF Vertex search result (${platform}) for ${dataset.shortName}`,
          source: 'ASF_VERTEX_LIVE_API',
        };
      });

      const hasNisar = liveGranules.some((g) =>
        g.mission.toUpperCase().includes('NISAR')
      );
      const merged = hasNisar
        ? liveGranules
        : [...dataset.granules, ...liveGranules.slice(0, 4)];

      const result = {
        granules: merged,
        source: (liveGranules.length > 0
          ? 'ASF_VERTEX_LIVE_API'
          : 'ASF_VERTEX_BUNDLED_SAMPLE') as
          | 'ASF_VERTEX_LIVE_API'
          | 'ASF_VERTEX_BUNDLED_SAMPLE',
        liveCount: liveGranules.length,
      };
      apiCache.set(cacheKey, result, 3600, 600);
      return result;
    };

    if (cached && cached.isStale) {
      void fetchLiveAsf().catch(() => undefined);
      res.json({
        region: regionId,
        product: rawProduct,
        source: cached.value.source,
        liveCount: cached.value.liveCount,
        granules: cached.value.granules,
        cached: true,
      });
      return;
    }

    try {
      const liveResult = await fetchLiveAsf();
      res.json({
        region: regionId,
        product: rawProduct,
        source: liveResult.source,
        liveCount: liveResult.liveCount,
        granules: liveResult.granules,
        cached: false,
      });
    } catch {
      const fallback = {
        granules: dataset.granules,
        source: 'ASF_VERTEX_BUNDLED_SAMPLE' as const,
        liveCount: 0,
      };
      apiCache.set(cacheKey, fallback, 300, 300);
      res.json({
        region: regionId,
        product: rawProduct,
        ...fallback,
        cached: false,
      });
    }
  });

  // 3. NASA POWER Daily Agroclimatology Proxy
  router.get('/nasa/power', async (req: Request, res: Response) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const start = typeof req.query.start === 'string' ? req.query.start : '';
    const end = typeof req.query.end === 'string' ? req.query.end : '';

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lon) ||
      lon < -180 ||
      lon > 180 ||
      !/^\d{8}$/.test(start) ||
      !/^\d{8}$/.test(end)
    ) {
      res.status(400).json({
        error: 'Invalid parameters. Provide valid lat, lon, and YYYYMMDD start/end.',
      });
      return;
    }

    // Match closest bundled region for instant fallback
    const closestRegion = Object.values(REGION_DATASETS).reduce((best, curr) => {
      const dBest = Math.hypot(best.center[0] - lat, best.center[1] - lon);
      const dCurr = Math.hypot(curr.center[0] - lat, curr.center[1] - lon);
      return dCurr < dBest ? curr : best;
    });

    const cacheKey = `power:${lat.toFixed(2)}:${lon.toFixed(2)}:${start}:${end}`;
    const cached = apiCache.get<{
      series: PowerDailyPoint[];
      source: 'NASA_POWER_LIVE' | 'NASA_POWER_BUNDLED';
    }>(cacheKey);

    if (cached && !cached.isStale) {
      res.json({
        lat,
        lon,
        source: cached.value.source,
        series: cached.value.series,
        cached: true,
      });
      return;
    }

    const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,GWETROOT,T2M&community=AG&longitude=${lon.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${start}&end=${end}&format=JSON`;

    const fetchLivePower = async () => {
      const resp = await fetchWithTimeoutAndRetry(powerUrl, 6000, 1);
      const json = (await resp.json()) as {
        properties?: {
          parameter?: {
            PRECTOTCORR?: Record<string, number>;
            GWETROOT?: Record<string, number>;
            T2M?: Record<string, number>;
          };
        };
      };

      const params = json.properties?.parameter;
      const precip = params?.PRECTOTCORR ?? {};
      const wetness = params?.GWETROOT ?? {};
      const temp = params?.T2M ?? {};

      const dates = Object.keys(precip).sort();
      const series: PowerDailyPoint[] = dates
        .filter((d) => precip[d] !== undefined && precip[d] > -900)
        .map((d) => {
          const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
          const rawWet = wetness[d];
          const rawTemp = temp[d];
          return {
            date: iso,
            rainfallMm: Math.max(0, Number((precip[d] ?? 0).toFixed(1))),
            soilMoistureIndex:
              rawWet !== undefined && rawWet > -900
                ? Math.min(1, Math.max(0, Number(rawWet.toFixed(2))))
                : 0.45,
            tempC:
              rawTemp !== undefined && rawTemp > -900
                ? Number(rawTemp.toFixed(1))
                : 27.0,
            source: 'NASA_POWER_LIVE',
          };
        });

      if (series.length === 0) {
        throw new Error('NASA POWER returned empty valid series');
      }

      const result = {
        series,
        source: 'NASA_POWER_LIVE' as const,
      };
      apiCache.set(cacheKey, result, 3600, 600);
      return result;
    };

    if (cached && cached.isStale) {
      void fetchLivePower().catch(() => undefined);
      res.json({
        lat,
        lon,
        source: cached.value.source,
        series: cached.value.series,
        cached: true,
      });
      return;
    }

    try {
      const live = await fetchLivePower();
      res.json({
        lat,
        lon,
        source: live.source,
        series: live.series,
        cached: false,
      });
    } catch {
      const fallback = {
        series: closestRegion.powerSeries,
        source: 'NASA_POWER_BUNDLED' as const,
      };
      apiCache.set(cacheKey, fallback, 300, 300);
      res.json({
        lat,
        lon,
        ...fallback,
        cached: false,
      });
    }
  });

  // 4. NASA EONET Natural Events Proxy
  router.get('/nasa/eonet', async (req: Request, res: Response) => {
    const rawBbox = typeof req.query.bbox === 'string' ? req.query.bbox : '';
    const cacheKey = `eonet:${rawBbox || 'global'}`;
    const cached = apiCache.get<{ events: EonetEvent[]; source: string }>(cacheKey);

    if (cached && !cached.isStale) {
      res.json({ ...cached.value, cached: true });
      return;
    }

    const eonetUrl = rawBbox
      ? `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=15&bbox=${encodeURIComponent(rawBbox)}`
      : `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=15`;

    try {
      const resp = await fetchWithTimeoutAndRetry(eonetUrl, 5000, 1);
      const data = (await resp.json()) as {
        events?: Array<{
          id?: string;
          title?: string;
          link?: string;
          categories?: Array<{ title?: string }>;
          geometry?: Array<{ date?: string; coordinates?: number[] }>;
        }>;
      };
      const events: EonetEvent[] = (data.events ?? [])
        .map((ev) => {
          const geom = ev.geometry?.[0];
          const coords = geom?.coordinates;
          if (!coords || coords.length < 2) return null;
          return {
            id: ev.id ?? 'eonet-event',
            title: ev.title ?? 'Active Earth Hazard Event',
            category: ev.categories?.[0]?.title ?? 'Hazard',
            date: (geom?.date ?? '').slice(0, 10),
            lon: Number(coords[0]),
            lat: Number(coords[1]),
            link: ev.link ?? 'https://eonet.gsfc.nasa.gov/',
          };
        })
        .filter((item): item is EonetEvent => item !== null);

      const result = { events, source: 'NASA_EONET_LIVE' };
      apiCache.set(cacheKey, result, 1800, 300);
      res.json({ ...result, cached: false });
    } catch {
      res.json({
        events: [],
        source: 'NASA_EONET_UNAVAILABLE',
        cached: false,
      });
    }
  });

  // 5. Grounded Gemini Physical Driver Synthesizer
  router.post('/gemini/synthesize', async (req: Request, res: Response) => {
    const body = req.body as Partial<SynthesizeRequestPayload> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }

    const regionId =
      typeof body.regionId === 'string' && body.regionId in REGION_DATASETS
        ? (body.regionId as RegionId)
        : null;
    const zoneName = typeof body.zoneName === 'string' ? body.zoneName.trim() : '';
    const productType =
      body.productType === 'GCOV' || body.productType === 'GUNW'
        ? body.productType
        : null;
    const language =
      typeof body.language === 'string' && VALID_LANGUAGES.has(body.language as LanguageCode)
        ? (body.language as LanguageCode)
        : 'en';

    if (
      !regionId ||
      !zoneName ||
      !productType ||
      typeof body.hhDb !== 'number' ||
      typeof body.hvDb !== 'number' ||
      typeof body.deltaHhDb !== 'number' ||
      typeof body.deltaHvDb !== 'number' ||
      typeof body.rainfallMm !== 'number' ||
      typeof body.soilMoistureIndex !== 'number'
    ) {
      res.status(400).json({
        error:
          'Missing or invalid telemetry fields. Required: regionId, zoneName, productType, hhDb, hvDb, deltaHhDb, deltaHvDb, rainfallMm, soilMoistureIndex.',
      });
      return;
    }

    const payload: SynthesizeRequestPayload = {
      regionId,
      zoneName,
      productType,
      hhDb: body.hhDb,
      hvDb: body.hvDb,
      deltaHhDb: body.deltaHhDb,
      deltaHvDb: body.deltaHvDb,
      losDisplacementCm:
        typeof body.losDisplacementCm === 'number' ? body.losDisplacementCm : undefined,
      coherence: typeof body.coherence === 'number' ? body.coherence : undefined,
      rainfallMm: body.rainfallMm,
      soilMoistureIndex: body.soilMoistureIndex,
      language,
    };

    const cacheKey = `gemini:${payload.regionId}:${payload.zoneName}:${payload.language}:${Math.round(payload.hhDb * 10)}:${Math.round((payload.losDisplacementCm ?? 0) * 10)}`;
    const cached = apiCache.get<PhysicalDriverSynthesis>(cacheKey);
    if (cached && !cached.isStale) {
      res.json({ ...cached.value, cached: true });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      const deterministic = buildDeterministicSynthesis(payload);
      apiCache.set(cacheKey, deterministic, 1800, 300);
      res.json({ ...deterministic, cached: false });
      return;
    }

    const languageName =
      payload.language === 'mr'
        ? 'Marathi (मराठी)'
        : payload.language === 'hi'
          ? 'Hindi (हिन्दी)'
          : 'English';

    const systemInstruction =
      'You are the NISAR Microwave Physics & Surface Change Analyst. Analyze ONLY the provided GCOV (Geocoded Polarimetric Covariance) or GUNW (Geocoded Unwrapped Interferogram) telemetry and NASA POWER climate metrics. Never invent measurements. Explain: (1) how surface roughness and dielectric constant or interferometric phase shift caused the observed radar signature, (2) the human or natural driver, and (3) a concrete local decision-maker recommendation. Output valid JSON matching the schema in the requested language (en, mr, or hi).';

    const userPrompt = `Analyze this NISAR L-Band (24 cm wavelength) radar observation and respond strictly in ${languageName}:
Region: ${payload.regionId}
Study Zone: ${payload.zoneName}
Product Level: ${payload.productType}
Co-Pol HH Backscatter: ${payload.hhDb.toFixed(2)} dB (Delta from baseline: ${payload.deltaHhDb.toFixed(2)} dB)
Cross-Pol HV Backscatter: ${payload.hvDb.toFixed(2)} dB (Delta from baseline: ${payload.deltaHvDb.toFixed(2)} dB)
${payload.losDisplacementCm !== undefined ? `GUNW LOS Displacement: ${payload.losDisplacementCm.toFixed(2)} cm` : ''}
${payload.coherence !== undefined ? `Interferometric Coherence (gamma): ${payload.coherence.toFixed(2)}` : ''}
NASA POWER Daily Rainfall (PRECTOTCORR): ${payload.rainfallMm.toFixed(1)} mm/day
NASA POWER Root-Zone Soil Wetness (GWETROOT): ${payload.soilMoistureIndex.toFixed(2)} (0.0-1.0)

Provide 3 concise, specific items in actionableAdvisory citing the exact dB, cm, coherence, or mm/day numbers above.`;

    const callGeminiModel = async (modelName: string) => {
      const geminiPromise = ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction,
          ...(modelName === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              scatteringMechanism: {
                type: Type.STRING,
                enum: [
                  'SPECULAR_WATER',
                  'DOUBLE_BOUNCE_FLOODED_VEG',
                  'VOLUME_CANOPY',
                  'INSAR_PHASE_DEFORMATION',
                ],
              },
              physicsExplanation: { type: Type.STRING },
              humanAndNaturalDrivers: { type: Type.STRING },
              actionableAdvisory: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              uncertaintyAndLimits: { type: Type.STRING },
            },
            required: [
              'headline',
              'scatteringMechanism',
              'physicsExplanation',
              'humanAndNaturalDrivers',
              'actionableAdvisory',
              'uncertaintyAndLimits',
            ],
          },
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${modelName} request timed out after 12000ms`)),
          12000
        )
      );

      return Promise.race([geminiPromise, timeoutPromise]);
    };

    try {
      let response;
      try {
        response = await callGeminiModel('gemini-4-hydrogen');
      } catch {
        response = await callGeminiModel('gemini-2.5-flash');
      }

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as Partial<PhysicalDriverSynthesis>;
      const fallback = buildDeterministicSynthesis(payload);

      const mechanism =
        typeof parsed.scatteringMechanism === 'string' &&
        VALID_SCATTERING.has(parsed.scatteringMechanism as ScatteringMechanism)
          ? (parsed.scatteringMechanism as ScatteringMechanism)
          : fallback.scatteringMechanism;

      const synthesis: PhysicalDriverSynthesis = {
        headline:
          typeof parsed.headline === 'string' && parsed.headline.trim()
            ? parsed.headline
            : fallback.headline,
        scatteringMechanism: mechanism,
        physicsExplanation:
          typeof parsed.physicsExplanation === 'string' && parsed.physicsExplanation.trim()
            ? parsed.physicsExplanation
            : fallback.physicsExplanation,
        humanAndNaturalDrivers:
          typeof parsed.humanAndNaturalDrivers === 'string' &&
          parsed.humanAndNaturalDrivers.trim()
            ? parsed.humanAndNaturalDrivers
            : fallback.humanAndNaturalDrivers,
        actionableAdvisory:
          Array.isArray(parsed.actionableAdvisory) &&
          parsed.actionableAdvisory.length > 0
            ? parsed.actionableAdvisory.slice(0, 4).map(String)
            : fallback.actionableAdvisory,
        uncertaintyAndLimits:
          typeof parsed.uncertaintyAndLimits === 'string' &&
          parsed.uncertaintyAndLimits.trim()
            ? parsed.uncertaintyAndLimits
            : fallback.uncertaintyAndLimits,
        source: 'GEMINI_4_HYDROGEN',
        language: payload.language,
        generatedAt: new Date().toISOString(),
      };

      apiCache.set(cacheKey, synthesis, 3600, 600);
      res.json({ ...synthesis, cached: false });
    } catch {
      const fallback = buildDeterministicSynthesis(payload);
      apiCache.set(cacheKey, fallback, 600, 300);
      res.json({ ...fallback, cached: false });
    }
  });

  // 6. Page-Aware Bottom-Right Assistant Route
  router.post('/gemini/assist', async (req: Request, res: Response) => {
    const body = req.body as Partial<PageAwareAssistRequest> | undefined;
    if (!body || typeof body !== 'object' || typeof body.question !== 'string' || !body.question.trim()) {
      res.status(400).json({ error: 'Missing required question string.' });
      return;
    }

    const currentView: PageViewMode =
      body.currentView === 'REGION_2D_MAP' ? 'REGION_2D_MAP' : 'HOME_3D_GLOBE';
    const regionId =
      typeof body.regionId === 'string' && body.regionId in REGION_DATASETS
        ? (body.regionId as RegionId)
        : undefined;
    const language: LanguageCode =
      typeof body.language === 'string' && VALID_LANGUAGES.has(body.language as LanguageCode)
        ? (body.language as LanguageCode)
        : 'en';

    const payload: PageAwareAssistRequest = {
      currentView,
      regionId,
      activeAspect:
        typeof body.activeAspect === 'string'
          ? (body.activeAspect as DatasetAspectId)
          : undefined,
      zoneName: typeof body.zoneName === 'string' ? body.zoneName.trim() : undefined,
      passDate: typeof body.passDate === 'string' ? body.passDate.trim() : undefined,
      layerMode: typeof body.layerMode === 'string' ? body.layerMode : undefined,
      metricsSummary:
        typeof body.metricsSummary === 'string' ? body.metricsSummary.trim() : undefined,
      question: body.question.trim().slice(0, 500),
      language,
    };

    const cacheKey = `assist:${payload.currentView}:${payload.regionId ?? 'none'}:${payload.activeAspect ?? 'none'}:${payload.zoneName ?? 'none'}:${payload.language}:${payload.question.toLowerCase()}`;
    const cached = apiCache.get<PageAwareAssistResponse>(cacheKey);
    if (cached && !cached.isStale) {
      res.json(cached.value);
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      const fallback = buildPageAwareAssistantFallback(payload);
      apiCache.set(cacheKey, fallback, 900, 300);
      res.json(fallback);
      return;
    }

    const contextLabel = formatPageContextLabel(payload);
    const languageName =
      payload.language === 'mr'
        ? 'Marathi (मराठी)'
        : payload.language === 'hi'
          ? 'Hindi (हिन्दी)'
          : 'English';

    const assistPrompt = `You are the NISAR Pulse Page-Aware Assistant. Respond concisely (2-4 sentences) in ${languageName}, strictly grounded to the user's active UI context and metrics. Never invent data.
Active Page: ${payload.currentView}
Context Label: ${contextLabel}
${payload.passDate ? `Orbital Pass Date: ${payload.passDate}` : ''}
${payload.layerMode ? `Active 2D Layer: ${payload.layerMode}` : ''}
${payload.metricsSummary ? `Visible Telemetry: ${payload.metricsSummary}` : ''}
User Question: ${payload.question}`;

    const runAssistModel = async (modelName: string) => {
      const promise = ai.models.generateContent({
        model: modelName,
        contents: assistPrompt,
        config: {
          systemInstruction:
            'You guide users through NISAR Pulse (3D Earth globe home and 2D GCOV/GUNW regional explorer). Always orient the answer to the exact page/aspect/zone they are viewing.',
          ...(modelName === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: { type: Type.STRING },
              suggestedFollowUps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['answer', 'suggestedFollowUps'],
          },
        },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${modelName} assist timed out`)), 5500)
      );
      return Promise.race([promise, timeoutPromise]);
    };

    try {
      let response;
      try {
        response = await runAssistModel('gemini-4-hydrogen');
      } catch {
        response = await runAssistModel('gemini-2.5-flash');
      }

      const raw = (response.text ?? '').trim();
      const parsed = JSON.parse(raw) as Partial<PageAwareAssistResponse>;
      const fallback = buildPageAwareAssistantFallback(payload);

      const assistResponse: PageAwareAssistResponse = {
        answer:
          typeof parsed.answer === 'string' && parsed.answer.trim()
            ? parsed.answer.trim()
            : fallback.answer,
        suggestedFollowUps:
          Array.isArray(parsed.suggestedFollowUps) && parsed.suggestedFollowUps.length > 0
            ? parsed.suggestedFollowUps.slice(0, 3).map(String)
            : fallback.suggestedFollowUps,
        contextLabel,
        source: 'GEMINI_4_HYDROGEN',
        generatedAt: new Date().toISOString(),
      };

      apiCache.set(cacheKey, assistResponse, 1800, 300);
      res.json(assistResponse);
    } catch {
      const fallback = buildPageAwareAssistantFallback(payload);
      apiCache.set(cacheKey, fallback, 600, 300);
      res.json(fallback);
    }
  });

  return router;
}
