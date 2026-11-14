import type {
  AsfGranuleMetadata,
  LayerMode,
  OrbitalPassTelemetry,
  PassDeltaMetrics,
  PhysicalDriverSynthesis,
  PolygonVisualStyle,
  ProductType,
  ScatteringMechanism,
  StudyZone,
  SynthesizeRequestPayload,
} from '../types/sar.ts';

export function computePassDelta(
  zone: StudyZone,
  passIndex: number
): PassDeltaMetrics {
  const safeIndex = Math.max(0, Math.min(passIndex, zone.passes.length - 1));
  const baseline = zone.passes[0];
  const current = zone.passes[safeIndex];

  const deltaHhDb = roundTo(current.hhGamma0Db - baseline.hhGamma0Db, 2);
  const deltaHvDb = roundTo(current.hvGamma0Db - baseline.hvGamma0Db, 2);
  const deltaRatioDb = roundTo(current.hvHhRatioDb - baseline.hvHhRatioDb, 2);
  const deltaLosCm =
    current.losDisplacementCm !== undefined &&
    baseline.losDisplacementCm !== undefined
      ? roundTo(current.losDisplacementCm - baseline.losDisplacementCm, 2)
      : undefined;

  return {
    deltaHhDb,
    deltaHvDb,
    deltaRatioDb,
    deltaLosCm,
    baselineDate: baseline.acquisitionDate,
    currentDate: current.acquisitionDate,
  };
}

/**
 * Converts unwrapped L-band interferometric phase (radians) to Line-of-Sight
 * displacement in centimeters. Default NISAR L-band wavelength = 24 cm (1 fringe = 12 cm LOS).
 */
export function phaseToLosDisplacementCm(
  unwrappedPhaseRad: number,
  wavelengthCm = 24
): number {
  return roundTo((unwrappedPhaseRad * wavelengthCm) / (4 * Math.PI), 2);
}

export function getPolygonVisualStyle(
  pass: OrbitalPassTelemetry,
  layerMode: LayerMode,
  coherenceThreshold: number,
  isDark = false
): PolygonVisualStyle {
  const hhColor = isDark ? '#E0803F' : '#B8531F';
  const hvColor = isDark ? '#6FBF8E' : '#2F6B4F';
  const waterColor = isDark ? '#5AA9D6' : '#1D6FA3';
  const neutralColor = isDark ? '#36424A' : '#E8EBE6';
  const mutedStroke = isDark ? '#A3AFA7' : '#55625B';
  const warnColor = '#B7791F';
  const errColor = '#B3382C';

  if (layerMode === 'GCOV_HH') {
    const val = pass.hhGamma0Db;
    if (val <= -18.0) {
      return {
        fillColor: waterColor,
        strokeColor: waterColor,
        fillOpacity: 0.52,
        formattedValue: val.toFixed(1),
        unit: 'dB',
        dimmed: false,
        classificationLabel: 'Specular Water / Flooded',
      };
    }
    if (val <= -13.0) {
      return {
        fillColor: hhColor,
        strokeColor: hhColor,
        fillOpacity: 0.44,
        formattedValue: val.toFixed(1),
        unit: 'dB',
        dimmed: false,
        classificationLabel: 'High Dielectric Moisture',
      };
    }
    return {
      fillColor: hhColor,
      strokeColor: hhColor,
      fillOpacity: 0.42,
      formattedValue: val.toFixed(1),
      unit: 'dB',
      dimmed: false,
      classificationLabel: 'Rough / Double-Bounce Surface',
    };
  }

  if (layerMode === 'GCOV_HV') {
    const val = pass.hvGamma0Db;
    if (val >= -12.5) {
      return {
        fillColor: hvColor,
        strokeColor: hvColor,
        fillOpacity: 0.48,
        formattedValue: val.toFixed(1),
        unit: 'dB',
        dimmed: false,
        classificationLabel: 'Dense Canopy / Volume Scatter',
      };
    }
    if (val >= -16.0) {
      return {
        fillColor: hhColor,
        strokeColor: hhColor,
        fillOpacity: 0.42,
        formattedValue: val.toFixed(1),
        unit: 'dB',
        dimmed: false,
        classificationLabel: 'Moderate Crop / Wetland',
      };
    }
    return {
      fillColor: waterColor,
      strokeColor: waterColor,
      fillOpacity: 0.44,
      formattedValue: val.toFixed(1),
      unit: 'dB',
      dimmed: false,
      classificationLabel: 'Smooth / Open Water',
    };
  }

  if (layerMode === 'GCOV_RATIO') {
    const val = pass.hvHhRatioDb;
    if (val >= 5.0) {
      return {
        fillColor: waterColor,
        strokeColor: waterColor,
        fillOpacity: 0.5,
        formattedValue: `+${val.toFixed(1)}`,
        unit: 'dB',
        dimmed: false,
        classificationLabel: 'Flooded Emergent / Specular Gap',
      };
    }
    if (val >= -3.0) {
      return {
        fillColor: hvColor,
        strokeColor: hvColor,
        fillOpacity: 0.44,
        formattedValue: val >= 0 ? `+${val.toFixed(1)}` : val.toFixed(1),
        unit: 'dB',
        dimmed: false,
        classificationLabel: 'Vegetated Volume Dominated',
      };
    }
    return {
      fillColor: hhColor,
      strokeColor: hhColor,
      fillOpacity: 0.4,
      formattedValue: val.toFixed(1),
      unit: 'dB',
      dimmed: false,
      classificationLabel: 'Surface-Dominated Backscatter',
    };
  }

  if (layerMode === 'GUNW_LOS') {
    const los = pass.losDisplacementCm ?? 0;
    const coh = pass.coherence ?? 1;
    const dimmed = coh < coherenceThreshold;

    let fillColor = neutralColor;
    let strokeColor = mutedStroke;
    let classificationLabel = 'Stable Crustal Block';

    if (los <= -10.0) {
      fillColor = errColor;
      strokeColor = errColor;
      classificationLabel = 'Major Subsidence';
    } else if (los <= -2.0) {
      fillColor = hhColor;
      strokeColor = hhColor;
      classificationLabel = 'Moderate Subsidence';
    } else if (los >= 2.0) {
      fillColor = waterColor;
      strokeColor = waterColor;
      classificationLabel = 'Co-Seismic Uplift';
    }

    return {
      fillColor,
      strokeColor: dimmed ? mutedStroke : strokeColor,
      fillOpacity: dimmed ? 0.14 : 0.54,
      formattedValue: los > 0 ? `+${los.toFixed(1)}` : los.toFixed(1),
      unit: 'cm',
      dimmed,
      classificationLabel: dimmed
        ? `${classificationLabel} (Low γ)`
        : classificationLabel,
    };
  }

  // GUNW_COHERENCE
  const coh = pass.coherence ?? 0;
  const dimmed = coh < coherenceThreshold;
  if (coh >= 0.7) {
    return {
      fillColor: hvColor,
      strokeColor: hvColor,
      fillOpacity: dimmed ? 0.15 : 0.5,
      formattedValue: coh.toFixed(2),
      unit: 'γ',
      dimmed,
      classificationLabel: 'High Interferometric Coherence',
    };
  }
  if (coh >= 0.4) {
    return {
      fillColor: waterColor,
      strokeColor: waterColor,
      fillOpacity: dimmed ? 0.15 : 0.45,
      formattedValue: coh.toFixed(2),
      unit: 'γ',
      dimmed,
      classificationLabel: 'Moderate Coherence',
    };
  }
  return {
    fillColor: warnColor,
    strokeColor: warnColor,
    fillOpacity: dimmed ? 0.14 : 0.45,
    formattedValue: coh.toFixed(2),
    unit: 'γ',
    dimmed,
    classificationLabel: 'Decorrelated (Water / Canopy)',
  };
}

export function classifyScatteringMechanism(
  productType: ProductType,
  hhDb: number,
  hvDb: number,
  losDisplacementCm?: number
): ScatteringMechanism {
  if (productType === 'GUNW' && losDisplacementCm !== undefined) {
    return 'INSAR_PHASE_DEFORMATION';
  }
  if (hhDb <= -18.0 && hvDb <= -14.5) {
    return 'SPECULAR_WATER';
  }
  if (hhDb <= -15.5 && hvDb >= -13.0) {
    return 'DOUBLE_BOUNCE_FLOODED_VEG';
  }
  return 'VOLUME_CANOPY';
}

export function buildDeterministicSynthesis(
  payload: SynthesizeRequestPayload
): PhysicalDriverSynthesis {
  const mechanism = classifyScatteringMechanism(
    payload.productType,
    payload.hhDb,
    payload.hvDb,
    payload.losDisplacementCm
  );

  const isGunw = payload.productType === 'GUNW';
  const lang = payload.language;

  if (lang === 'mr') {
    const headline = isGunw
      ? `${payload.zoneName}: ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी भू-हालचाल (Coherence γ = ${payload.coherence?.toFixed(2) ?? '0.00'})`
      : `${payload.zoneName}: HH ${payload.hhDb.toFixed(1)} dB व HV ${payload.hvDb.toFixed(1)} dB रडार बदल`;

    const physicsExplanation = isGunw
      ? `L-बँड (24 सेमी तरंगलांबी) GUNW इंटरफेरोमेट्रीनुसार ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी LOS विस्थापन नोंदवले गेले आहे (सुसंगतता γ = ${payload.coherence?.toFixed(2) ?? '0.00'}). स्थिर खडकावर उच्च सुसंगतता अचूक फेज मोजमाप देते.`
      : `HH बॅकस्कॅटर ${payload.hhDb.toFixed(1)} dB (बदल ${payload.deltaHhDb >= 0 ? '+' : ''}${payload.deltaHhDb.toFixed(1)} dB) आणि HV ${payload.hvDb.toFixed(1)} dB आहे. पाण्याच्या सपाट पृष्ठभागावर स्पेक्क्युलर परावर्तन वाढून HH सिग्नल कमी होतो, तर ओलसर पीक व झुडुपांमुळे HV व्हॉल्यूम स्कॅटरिंग वाढते.`;

    const humanAndNaturalDrivers = isGunw
      ? `भूगर्भीय फॉल्ट सरकणे आणि किनारपट्टीवरील मातीचे द्रवीकरण यामुळे पृष्ठभागावर बदल झाला आहे. पर्जन्यमान ${payload.rainfallMm.toFixed(1)} मिमी/दिवस आहे.`
      : `NASA POWER नुसार ${payload.rainfallMm.toFixed(1)} मिमी/दिवस पाऊस आणि ${payload.soilMoistureIndex.toFixed(2)} मृदा ओलावा निर्देशांकामुळे पूर साचणे किंवा पिकांची वाढ प्रभावित झाली आहे.`;

    return {
      headline,
      scatteringMechanism: mechanism,
      physicsExplanation,
      humanAndNaturalDrivers,
      actionableAdvisory: isGunw
        ? [
            `γ < 0.35 असलेल्या भागांत रस्ते व पुलांची क्षेत्रीय तपासणी करा.`,
            `${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी विस्थापन क्षेत्रात जलवाहिनी व धरण सुरक्षा तपासा.`,
            `पुढील 12-दिवसीय NISAR फेरीमध्ये फेज सातत्य तपासा.`,
          ]
        : [
            `HH <= -18.0 dB असलेल्या सखल भागात पूर नियंत्रण व निचरा मार्ग मोकळे ठेवा.`,
            `मृदा ओलावा (${payload.soilMoistureIndex.toFixed(2)}) लक्षात घेऊन कापूस/धान पिकांचे सिंचन नियोजन करा.`,
            `ढगाळ हवामानात ऑप्टिकलऐवजी L-बँड GCOV नकाशांचा वापर आपत्ती व्यवस्थापनासाठी करा.`,
          ],
      uncertaintyAndLimits: isGunw
        ? `दाट वनस्पती किंवा पाण्यामुळे γ < 0.35 असल्यास फेज अनरॅपिंगमध्ये त्रुटी येऊ शकते.`
        : `तीव्र वाऱ्यामुळे पाण्यावर लाटा निर्माण झाल्यास ब्रॅग स्कॅटरिंग वाढून HH मूल्य किंचित वाढू शकते.`,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      language: 'mr',
      generatedAt: new Date().toISOString(),
    };
  }

  if (lang === 'hi') {
    const headline = isGunw
      ? `${payload.zoneName}: ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी सतह विस्थापन (Coherence γ = ${payload.coherence?.toFixed(2) ?? '0.00'})`
      : `${payload.zoneName}: HH ${payload.hhDb.toFixed(1)} dB एवं HV ${payload.hvDb.toFixed(1)} dB रडार विश्लेषण`;

    const physicsExplanation = isGunw
      ? `L-बैंड (24 सेमी तरंगदैर्ध्य) GUNW डेटा के अनुसार ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी LOS विस्थापन दर्ज हुआ है (सुसंगतता γ = ${payload.coherence?.toFixed(2) ?? '0.00'})। उच्च γ वाले क्षेत्रों में फेज मापन विश्वसनीय है।`
      : `HH बैकस्कैटर ${payload.hhDb.toFixed(1)} dB (परिवर्तन ${payload.deltaHhDb >= 0 ? '+' : ''}${payload.deltaHhDb.toFixed(1)} dB) और HV ${payload.hvDb.toFixed(1)} dB है। शांत जल सतह पर स्पेक्युलर परावर्तन से HH घटता है जबकि फसल/वनस्पति कैनोपी से HV वॉल्यूम स्कैटरिंग बढ़ती है।`;

    const humanAndNaturalDrivers = isGunw
      ? `टेक्टोनिक फॉल्ट विस्थापन एवं तटीय मृदा द्रवीकरण मुख्य कारण हैं; NASA POWER वर्षा ${payload.rainfallMm.toFixed(1)} मिमी/दिन दर्ज है।`
      : `NASA POWER वर्षा (${payload.rainfallMm.toFixed(1)} मिमी/दिन) और रूट-ज़ोन नमी (${payload.soilMoistureIndex.toFixed(2)}) ने जलभराव और फसल वृद्धि को प्रभावित किया है।`;

    return {
      headline,
      scatteringMechanism: mechanism,
      physicsExplanation,
      humanAndNaturalDrivers,
      actionableAdvisory: isGunw
        ? [
            `γ >= 0.70 वाले विस्थापन क्षेत्रों में अवसंरचना व तटबंधों का निरीक्षण करें।`,
            `${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी विस्थापन के निकट निकासी व सुरक्षा क्षेत्र चिह्नित करें।`,
            `अगले 12-दिवसीय NISAR पास के साथ निरंतर निगरानी जारी रखें।`,
          ]
        : [
            `HH <= -18.0 dB वाले जलमग्न क्षेत्रों में राहत एवं जल निकासी दल तैनात करें।`,
            `मृदा नमी (${payload.soilMoistureIndex.toFixed(2)}) के अनुसार कृषि सिंचाई व उर्वरक समय समायोजित करें।`,
            `मानसूनी बादलों के बावजूद L-बैंड GCOV लेयर से बाढ़ सीमांकन अपडेट रखें।`,
          ],
      uncertaintyAndLimits: isGunw
        ? `निम्न सुसंगतता (γ < 0.35) वाले वनस्पति या तटीय क्षेत्रों में अनरैप्ड फेज त्रुटि संभव है।`
        : `तेज़ हवा से जल सतह खुरदरी होने पर HH मान -18 dB से थोड़ा ऊपर जा सकता है।`,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      language: 'hi',
      generatedAt: new Date().toISOString(),
    };
  }

  // English deterministic grounded output
  const headline = isGunw
    ? `${payload.zoneName}: ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} cm LOS Deformation (γ = ${payload.coherence?.toFixed(2) ?? '0.00'})`
    : `${payload.zoneName}: HH ${payload.hhDb.toFixed(1)} dB (Δ ${payload.deltaHhDb >= 0 ? '+' : ''}${payload.deltaHhDb.toFixed(1)} dB) · HV ${payload.hvDb.toFixed(1)} dB`;

  const physicsExplanation = isGunw
    ? `At NISAR's 24 cm L-band wavelength, one 2π interferometric fringe equals 12.0 cm of Line-of-Sight (LOS) motion. The observed ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} cm LOS shift with interferometric coherence γ = ${payload.coherence?.toFixed(2) ?? '0.00'} reflects coherent phase change across ground reflectors, while zones below γ = 0.35 suffer temporal decorrelation.`
    : mechanism === 'SPECULAR_WATER'
      ? `The drop in co-polarized HH backscatter to ${payload.hhDb.toFixed(1)} dB (Δ ${payload.deltaHhDb.toFixed(1)} dB) combined with low HV (${payload.hvDb.toFixed(1)} dB) indicates smooth-surface specular reflection off standing floodwater, redirecting L-band energy away from the sensor.`
      : mechanism === 'DOUBLE_BOUNCE_FLOODED_VEG'
        ? `Moderate-low HH (${payload.hhDb.toFixed(1)} dB) paired with elevated cross-polarized HV (${payload.hvDb.toFixed(1)} dB, Δ ${payload.deltaHvDb >= 0 ? '+' : ''}${payload.deltaHvDb.toFixed(1)} dB) signals flooded emergent vegetation and wet-canopy double-bounce plus volume scattering.`
        : `Cross-polarized HV backscatter at ${payload.hvDb.toFixed(1)} dB (Δ ${payload.deltaHvDb >= 0 ? '+' : ''}${payload.deltaHvDb.toFixed(1)} dB) alongside high dielectric soil moisture (${payload.soilMoistureIndex.toFixed(2)}) demonstrates strong L-band volume scattering within maturing crop/forest canopy.`;

  const humanAndNaturalDrivers = isGunw
    ? `Co-seismic fault slip, coastal tectonic uplift/subsidence, and saturated sediment liquefaction govern the observed deformation gradient alongside ${payload.rainfallMm.toFixed(1)} mm/day precipitation.`
    : `NASA POWER telemetry records ${payload.rainfallMm.toFixed(1)} mm/day precipitation and a root-zone soil wetness index of ${payload.soilMoistureIndex.toFixed(2)}, driving reservoir stage surges, riparian inundation, or rapid vegetative biomass accumulation.`;

  const actionableAdvisory = isGunw
    ? [
        `Prioritize field geotechnical inspection in coherent deformation zones (γ >= 0.70) where LOS shifts exceed ${Math.abs(payload.losDisplacementCm ?? 0).toFixed(1)} cm.`,
        `Mask out γ < 0.35 vegetated or coastal liquefaction cells before computing engineering strain budgets.`,
        `Cross-check culvert, port seawall, and road grade elevations against the next 12-day ascending NISAR pass.`,
      ]
    : [
        `Target flood response and embankment patrolling to corridors where HH drops below -18.0 dB (currently ${payload.hhDb.toFixed(1)} dB).`,
        `Adjust agronomy irrigation and drainage advisories using the ${payload.soilMoistureIndex.toFixed(2)} GWETROOT moisture index and ${payload.rainfallMm.toFixed(1)} mm/day rain signal.`,
        `Use L-band GCOV masks directly when optical MODIS/VIIRS scenes remain cloud-obscured during peak monsoon.`,
      ];

  const uncertaintyAndLimits = isGunw
    ? `Single-track LOS displacement captures 1D projection along the radar look vector; areas with γ < 0.35 may exhibit phase-unwrapping ambiguities.`
    : `Wind-roughened water surfaces (> 5 m/s) can elevate HH backscatter via Bragg scattering, reducing water/land contrast in exposed reservoirs.`;

  return {
    headline,
    scatteringMechanism: mechanism,
    physicsExplanation,
    humanAndNaturalDrivers,
    actionableAdvisory,
    uncertaintyAndLimits,
    source: 'DETERMINISTIC_PHYSICS_FALLBACK',
    language: 'en',
    generatedAt: new Date().toISOString(),
  };
}

export interface ParsedCustomUpload {
  valid: boolean;
  summary: string;
  featureCount: number;
  granules: AsfGranuleMetadata[];
  error?: string;
}

export function parseUploadedGeoJsonOrGranule(rawText: string): ParsedCustomUpload {
  if (!rawText.trim()) {
    return {
      valid: false,
      summary: '',
      featureCount: 0,
      granules: [],
      error: 'Uploaded file is empty.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      valid: false,
      summary: '',
      featureCount: 0,
      granules: [],
      error: 'Invalid JSON syntax. Please provide valid GeoJSON or ASF Vertex JSON.',
    };
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return {
      valid: false,
      summary: '',
      featureCount: 0,
      granules: [],
      error: 'JSON root must be an object or GeoJSON FeatureCollection.',
    };
  }

  const obj = parsed as Record<string, unknown>;
  const granules: AsfGranuleMetadata[] = [];

  if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
    for (let i = 0; i < obj.features.length; i++) {
      const feat = obj.features[i];
      if (typeof feat !== 'object' || feat === null) continue;
      const f = feat as Record<string, unknown>;
      const props = (
        typeof f.properties === 'object' && f.properties !== null
          ? f.properties
          : {}
      ) as Record<string, unknown>;

      const sceneName =
        typeof props.sceneName === 'string'
          ? props.sceneName
          : typeof props.fileID === 'string'
            ? props.fileID
            : typeof props.granule === 'string'
              ? props.granule
              : `CUSTOM_ASF_SCENE_${i + 1}`;

      const processingLevel =
        typeof props.processingLevel === 'string'
          ? props.processingLevel
          : 'GCOV';
      const productType: ProductType = processingLevel
        .toUpperCase()
        .includes('GUNW')
        ? 'GUNW'
        : 'GCOV';

      granules.push({
        granuleId:
          typeof props.fileID === 'string'
            ? props.fileID
            : `CUSTOM-${i + 1}-${sceneName.slice(0, 12)}`,
        sceneName,
        mission:
          typeof props.platform === 'string' ? props.platform : 'NISAR / SAR',
        productType,
        beamMode: typeof props.beamModeType === 'string' ? props.beamModeType : 'IW / SweepSAR',
        polarization:
          typeof props.polarization === 'string' ? props.polarization : 'HH+HV',
        acquisitionDate:
          typeof props.startTime === 'string'
            ? props.startTime.slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        orbitDirection:
          props.flightDirection === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING',
        trackNumber: typeof props.pathNumber === 'number' ? props.pathNumber : 112,
        frameNumber: typeof props.frameNumber === 'number' ? props.frameNumber : 19,
        wavelengthCm: 24,
        spatialResolutionM: 10,
        processingLevel,
        bbox: [78.8, 19.9, 80.5, 21.6],
        downloadUrl:
          typeof props.url === 'string'
            ? props.url
            : 'https://search.asf.alaska.edu/',
        browseNote: 'Imported from local GeoJSON FeatureCollection',
        source: 'CUSTOM_UPLOAD',
      });
    }

    if (granules.length === 0) {
      return {
        valid: false,
        summary: '',
        featureCount: 0,
        granules: [],
        error: 'FeatureCollection contained 0 valid features.',
      };
    }

    return {
      valid: true,
      summary: `Parsed ${granules.length} GeoJSON feature(s) from custom ASF upload.`,
      featureCount: granules.length,
      granules,
    };
  }

  // Also support single granule JSON object
  if (typeof obj.granuleId === 'string' || typeof obj.sceneName === 'string') {
    const productType: ProductType =
      obj.productType === 'GUNW' ? 'GUNW' : 'GCOV';
    granules.push({
      granuleId:
        typeof obj.granuleId === 'string' ? obj.granuleId : 'CUSTOM-GRANULE-01',
      sceneName:
        typeof obj.sceneName === 'string' ? obj.sceneName : 'CUSTOM_SAR_SCENE',
      mission: typeof obj.mission === 'string' ? obj.mission : 'NISAR',
      productType,
      beamMode: typeof obj.beamMode === 'string' ? obj.beamMode : 'SweepSAR',
      polarization:
        typeof obj.polarization === 'string' ? obj.polarization : 'HH+HV',
      acquisitionDate:
        typeof obj.acquisitionDate === 'string'
          ? obj.acquisitionDate
          : new Date().toISOString().slice(0, 10),
      orbitDirection:
        obj.orbitDirection === 'DESCENDING' ? 'DESCENDING' : 'ASCENDING',
      trackNumber: typeof obj.trackNumber === 'number' ? obj.trackNumber : 112,
      frameNumber: typeof obj.frameNumber === 'number' ? obj.frameNumber : 19,
      wavelengthCm: typeof obj.wavelengthCm === 'number' ? obj.wavelengthCm : 24,
      spatialResolutionM:
        typeof obj.spatialResolutionM === 'number' ? obj.spatialResolutionM : 10,
      processingLevel:
        typeof obj.processingLevel === 'string' ? obj.processingLevel : productType,
      bbox: [78.8, 19.9, 80.5, 21.6],
      downloadUrl:
        typeof obj.downloadUrl === 'string'
          ? obj.downloadUrl
          : 'https://search.asf.alaska.edu/',
      browseNote: 'Imported custom SAR granule metadata JSON',
      source: 'CUSTOM_UPLOAD',
    });

    return {
      valid: true,
      summary: `Parsed 1 custom SAR granule (${granules[0].sceneName}).`,
      featureCount: 1,
      granules,
    };
  }

  return {
    valid: false,
    summary: '',
    featureCount: 0,
    granules: [],
    error: 'Unrecognized JSON structure. Expected GeoJSON FeatureCollection or SAR granule object.',
  };
}

export function roundTo(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function formatSigned(value: number, decimals = 1): string {
  const fixed = value.toFixed(decimals);
  return value > 0 ? `+${fixed}` : fixed;
}