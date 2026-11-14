export type RegionId = 'maharashtra_gcov' | 'northeast_india_gcov' | 'japan_gunw';

export type ProductType = 'GCOV' | 'GUNW';

export type LayerMode =
  | 'GCOV_HH'
  | 'GCOV_HV'
  | 'GCOV_RATIO'
  | 'GUNW_LOS'
  | 'GUNW_COHERENCE';

export type LanguageCode = 'en' | 'mr' | 'hi';

export type HazardStatus = 'NOMINAL' | 'ELEVATED' | 'CRITICAL';

export type ScatteringMechanism =
  | 'SPECULAR_WATER'
  | 'DOUBLE_BOUNCE_FLOODED_VEG'
  | 'VOLUME_CANOPY'
  | 'INSAR_PHASE_DEFORMATION';

export interface OrbitalPassTelemetry {
  passIndex: number;
  passCode: string;
  passLabel: string;
  acquisitionDate: string;
  hhGamma0Db: number;
  hvGamma0Db: number;
  hvHhRatioDb: number;
  dielectricConstantEst: number;
  surfaceRoughnessCm: number;
  unwrappedPhaseRad?: number;
  losDisplacementCm?: number;
  coherence?: number;
  rainfallMm: number;
  soilMoistureIndex: number;
  temperatureC: number;
  cloudCoverPct: number;
}

export interface StudyZone {
  id: string;
  name: string;
  districtOrPrefecture: string;
  dominantCover: string;
  hazardStatus: HazardStatus;
  centroid: [number, number]; // [lat, lon]
  coordinates: [number, number][]; // [lat, lon] polygon ring
  passes: OrbitalPassTelemetry[];
}

export interface AsfGranuleMetadata {
  granuleId: string;
  sceneName: string;
  mission: string;
  productType: ProductType;
  beamMode: string;
  polarization: string;
  acquisitionDate: string;
  orbitDirection: 'ASCENDING' | 'DESCENDING';
  trackNumber: number;
  frameNumber: number;
  wavelengthCm: number;
  spatialResolutionM: number;
  processingLevel: string;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  downloadUrl: string;
  browseNote: string;
  source: 'ASF_VERTEX_BUNDLED_SAMPLE' | 'ASF_VERTEX_LIVE_API' | 'CUSTOM_UPLOAD';
}

export interface PowerDailyPoint {
  date: string;
  rainfallMm: number;
  soilMoistureIndex: number;
  tempC: number;
  source: 'NASA_POWER_LIVE' | 'NASA_POWER_BUNDLED';
}

export interface EonetEvent {
  id: string;
  title: string;
  category: string;
  date: string;
  lat: number;
  lon: number;
  link: string;
}

export interface RegionDataset {
  id: RegionId;
  shortName: string;
  title: string;
  subtitle: string;
  productType: ProductType;
  center: [number, number];
  zoom: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  gibsDate: string;
  isSample: boolean;
  zones: StudyZone[];
  granules: AsfGranuleMetadata[];
  powerSeries: PowerDailyPoint[];
}

export interface PassDeltaMetrics {
  deltaHhDb: number;
  deltaHvDb: number;
  deltaRatioDb: number;
  deltaLosCm?: number;
  baselineDate: string;
  currentDate: string;
}

export interface PolygonVisualStyle {
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  formattedValue: string;
  unit: string;
  dimmed: boolean;
  classificationLabel: string;
}

export interface SynthesizeRequestPayload {
  regionId: RegionId;
  zoneName: string;
  productType: ProductType;
  hhDb: number;
  hvDb: number;
  deltaHhDb: number;
  deltaHvDb: number;
  losDisplacementCm?: number;
  coherence?: number;
  rainfallMm: number;
  soilMoistureIndex: number;
  language: LanguageCode;
}

export interface PhysicalDriverSynthesis {
  headline: string;
  scatteringMechanism: ScatteringMechanism;
  physicsExplanation: string;
  humanAndNaturalDrivers: string;
  actionableAdvisory: string[];
  uncertaintyAndLimits: string;
  source: 'GEMINI_4_HYDROGEN' | 'DETERMINISTIC_PHYSICS_FALLBACK';
  language: LanguageCode;
  generatedAt: string;
  cached?: boolean;
}

export interface SavedSnapshot {
  id: string;
  createdAt: string;
  regionId: RegionId;
  regionTitle: string;
  zoneId: string;
  zoneName: string;
  passIndex: number;
  acquisitionDate: string;
  layerMode: LayerMode;
  hhDb: number;
  hvDb: number;
  losDisplacementCm?: number;
  coherence?: number;
  rainfallMm: number;
}

export interface HealthStatusResponse {
  status: string;
  timestamp: string;
  cacheEntries: number;
  geminiConfigured: boolean;
  nasaKeyConfigured: boolean;
}

export interface AsfGranulesApiResponse {
  region: string;
  product: string;
  source: 'ASF_VERTEX_LIVE_API' | 'ASF_VERTEX_BUNDLED_SAMPLE';
  liveCount: number;
  granules: AsfGranuleMetadata[];
  cached: boolean;
}

export interface NasaPowerApiResponse {
  lat: number;
  lon: number;
  source: 'NASA_POWER_LIVE' | 'NASA_POWER_BUNDLED';
  series: PowerDailyPoint[];
  cached: boolean;
}

export type PageViewMode = 'HOME_3D_GLOBE' | 'REGION_2D_MAP';

export type DatasetAspectId =
  | 'flood_water'
  | 'crop_canopy'
  | 'crustal_los'
  | 'coherence_mask'
  | 'climate_power'
  | 'physics_ai'
  | 'sources_hdf5'
  | 'history_issues';

export interface HistoricalIssueEntry {
  year: string;
  eventTitle: string;
  whatHappened: string;
  radarSignatureComparison: string;
  communityImpact: string;
}

export interface DatasetAspectOption {
  id: DatasetAspectId;
  code: string;
  title: string;
  shortTag: string;
  summary: string;
  recommendedLayerMode?: LayerMode;
}

export interface AssistChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'GEMINI_4_HYDROGEN' | 'DETERMINISTIC_PHYSICS_FALLBACK';
  timestamp: string;
}

export interface PageAwareAssistRequest {
  currentView: PageViewMode;
  regionId?: RegionId;
  activeAspect?: DatasetAspectId;
  zoneName?: string;
  passDate?: string;
  layerMode?: LayerMode;
  metricsSummary?: string;
  question: string;
  language: LanguageCode;
}

export interface PageAwareAssistResponse {
  answer: string;
  suggestedFollowUps: string[];
  contextLabel: string;
  source: 'GEMINI_4_HYDROGEN' | 'DETERMINISTIC_PHYSICS_FALLBACK';
  generatedAt: string;
}

