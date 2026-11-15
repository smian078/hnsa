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
        classificationLabel: 'Calm Standing Floodwater',
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
        classificationLabel: 'Very Wet Soil & Mud',
      };
    }
    return {
      fillColor: hhColor,
      strokeColor: hhColor,
      fillOpacity: 0.42,
      formattedValue: val.toFixed(1),
      unit: 'dB',
      dimmed: false,
      classificationLabel: 'Dry Ground, Buildings, or Wet Stems',
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
        classificationLabel: 'Thick Green Crops & Forest',
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
        classificationLabel: 'Moderate Farm Crops or Marsh',
      };
    }
    return {
      fillColor: waterColor,
      strokeColor: waterColor,
      fillOpacity: 0.44,
      formattedValue: val.toFixed(1),
      unit: 'dB',
      dimmed: false,
      classificationLabel: 'Open Water or Bare Soil',
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
        classificationLabel: 'Floodwater Under Crops',
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
        classificationLabel: 'Healthy Crops & Trees',
      };
    }
    return {
      fillColor: hhColor,
      strokeColor: hhColor,
      fillOpacity: 0.4,
      formattedValue: val.toFixed(1),
      unit: 'dB',
      dimmed: false,
      classificationLabel: 'Bare Soil or Buildings',
    };
  }

  if (layerMode === 'GUNW_LOS') {
    const los = pass.losDisplacementCm ?? 0;
    const coh = pass.coherence ?? 1;
    const dimmed = coh < coherenceThreshold;

    let fillColor = neutralColor;
    let strokeColor = mutedStroke;
    let classificationLabel = 'Steady Ground (No Shift)';

    if (los <= -10.0) {
      fillColor = errColor;
      strokeColor = errColor;
      classificationLabel = 'Ground Sank Heavily';
    } else if (los <= -2.0) {
      fillColor = hhColor;
      strokeColor = hhColor;
      classificationLabel = 'Ground Sank Slightly';
    } else if (los >= 2.0) {
      fillColor = waterColor;
      strokeColor = waterColor;
      classificationLabel = 'Ground Pushed Upward';
    }

    return {
      fillColor,
      strokeColor: dimmed ? mutedStroke : strokeColor,
      fillOpacity: dimmed ? 0.14 : 0.54,
      formattedValue: los > 0 ? `+${los.toFixed(1)}` : los.toFixed(1),
      unit: 'cm',
      dimmed,
      classificationLabel: dimmed
        ? `${classificationLabel} (Low Clarity)`
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
      classificationLabel: 'Very Clear Signal (Reliable)',
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
      classificationLabel: 'Moderate Signal Clarity',
    };
  }
  return {
    fillColor: warnColor,
    strokeColor: warnColor,
    fillOpacity: dimmed ? 0.14 : 0.45,
    formattedValue: coh.toFixed(2),
    unit: 'γ',
    dimmed,
    classificationLabel: 'Noisy Signal (Dense Trees / Water)',
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
      ? `${payload.zoneName}: ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी जमीन हालचाल (${Math.round((payload.coherence ?? 0) * 100)}% स्पष्ट सिग्नल)`
      : `${payload.zoneName}: पूरपाणी आणि मातीच्या ओलाव्याची सद्यस्थिती`;

    const physicsExplanation = isGunw
      ? `उपग्रह रडारनुसार या भागात जमीन ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी हलली आहे. सिग्नल स्पष्टता ${Math.round((payload.coherence ?? 0) * 100)}% असल्यामुळे हे मोजमाप विश्वसनीय आहे.`
      : `सपाट पूरपाण्यावरून रडारचा किरण आरशासारखा दूर परावर्तित होतो, त्यामुळे पाण्याचा सिग्नल (${payload.hhDb.toFixed(1)} dB) कमी दिसतो. शेतातील पिके आणि झाडांवरून सिग्नल (${payload.hvDb.toFixed(1)} dB) परत येतो.`;

    const humanAndNaturalDrivers = isGunw
      ? `भूकंपामुळे जमिनीखालील खडक सरकणे आणि किनारपट्टीवरील ओलसर माती सैल होणे हे मुख्य कारण आहे. आजचा पाऊस ${payload.rainfallMm.toFixed(1)} मिमी आहे.`
      : `NASA च्या माहितीनुसार ${payload.rainfallMm.toFixed(1)} मिमी पाऊस आणि ${Math.round(payload.soilMoistureIndex * 100)}% ओलसर मातीमुळे नदीकाठी पाणी साचले आहे.`;

    return {
      headline,
      scatteringMechanism: mechanism,
      physicsExplanation,
      humanAndNaturalDrivers,
      actionableAdvisory: isGunw
        ? [
            `जमीन खचलेल्या भागात रस्ते आणि पुलांची तातडीने पाहणी करा.`,
            `${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी जमीन हललेल्या ठिकाणी पाण्याच्या टाक्या व पाईपलाईन तपासा.`,
            `पुढील १२ दिवसांनंतर येणाऱ्या उपग्रह पाहणीत बदल तपासा.`,
          ]
        : [
            `सखल भागात साचलेले पूरपाणी बाहेर काढण्यासाठी नाले मोकळे ठेवा.`,
            `मातीतील ${Math.round(payload.soilMoistureIndex * 100)}% ओलावा पाहून पिकांना पाणी देण्याचे नियोजन करा.`,
            `ढगाळ वातावरणातही हा रडार नकाशा थेट पूरस्थिती दाखवतो.`,
          ],
      uncertaintyAndLimits: isGunw
        ? `दाट जंगलात किंवा पाण्यात सिग्नल स्पष्टता ३५% पेक्षा कमी असल्यास अचूकता थोडी कमी होऊ शकते.`
        : `जोराच्या वाऱ्यामुळे पाण्यावर लाटा आल्यास पाण्याचा सिग्नल थोडा बदलू शकतो.`,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      language: 'mr',
      generatedAt: new Date().toISOString(),
    };
  }

  if (lang === 'hi') {
    const headline = isGunw
      ? `${payload.zoneName}: ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी ज़मीन का खिसकना (${Math.round((payload.coherence ?? 0) * 100)}% स्पष्ट सिग्नल)`
      : `${payload.zoneName}: बाढ़ के पानी और खेतों की नमी की स्थिति`;

    const physicsExplanation = isGunw
      ? `सैटेलाइट रडार के अनुसार यहाँ ज़मीन ${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी खिसकी है। रडार स्पष्टता ${Math.round((payload.coherence ?? 0) * 100)}% होने से यह माप भरोसेमंद है।`
      : `शांत बाढ़ के पानी से रडार किरणें आईने की तरह दूर चली जाती हैं, जिससे पानी का सिग्नल (${payload.hhDb.toFixed(1)} dB) कम हो जाता है। वहीं फसलों और पेड़ों से सिग्नल (${payload.hvDb.toFixed(1)} dB) वापस लौटता है।`;

    const humanAndNaturalDrivers = isGunw
      ? `भूकंप से ज़मीन का खिसकना और तटीय मिट्टी का ढीला पड़ना मुख्य कारण हैं; साथ ही ${payload.rainfallMm.toFixed(1)} मिमी बारिश दर्ज की गई है।`
      : `NASA के अनुसार ${payload.rainfallMm.toFixed(1)} मिमी बारिश और ${Math.round(payload.soilMoistureIndex * 100)}% मिट्टी की नमी ने जलभराव और फसलों को प्रभावित किया है।`;

    return {
      headline,
      scatteringMechanism: mechanism,
      physicsExplanation,
      humanAndNaturalDrivers,
      actionableAdvisory: isGunw
        ? [
            `ज़मीन धँसने वाले इलाकों में सड़कों, पुलों और तटबंधों की जाँच करें।`,
            `${payload.losDisplacementCm?.toFixed(1) ?? '0.0'} सेमी खिसकाव वाले क्षेत्रों के पास सुरक्षा घेरा बनाएँ।`,
            `अगले 12-दिन के सैटेलाइट स्कैन में बदलाव पर नज़र रखें।`,
          ]
        : [
            `निचले इलाकों में जहाँ पानी भरा है, वहाँ जल निकासी और राहत दल भेजें।`,
            `मिट्टी की नमी (${Math.round(payload.soilMoistureIndex * 100)}%) को देखते हुए खेतों में सिंचाई रोकें या घटाएँ।`,
            `मानसून के घने बादलों में भी यह रडार नक्शा साफ़ बाढ़ की स्थिति दिखाता है।`,
          ],
      uncertaintyAndLimits: isGunw
        ? `घने पेड़ों या पानी वाले हिस्सों में जहाँ स्पष्टता 35% से कम है, वहाँ माप थोड़ा धुंधला हो सकता है।`
        : `तेज़ हवा से पानी में लहरें उठने पर रडार सिग्नल में थोड़ा अंतर आ सकता है।`,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      language: 'hi',
      generatedAt: new Date().toISOString(),
    };
  }

  // Plain-English everyday explanation
  const soilPct = Math.round(payload.soilMoistureIndex * 100);
  const cohPct = Math.round((payload.coherence ?? 0) * 100);
  const losVal = payload.losDisplacementCm ?? 0;

  const headline = isGunw
    ? `${payload.zoneName}: Ground ${losVal < 0 ? `Sank ${Math.abs(losVal).toFixed(1)} cm` : `Rose +${losVal.toFixed(1)} cm`} (${cohPct}% Clear Signal)`
    : mechanism === 'SPECULAR_WATER'
      ? `${payload.zoneName}: Standing Floodwater Detected (${soilPct}% Wet Soil)`
      : mechanism === 'DOUBLE_BOUNCE_FLOODED_VEG'
        ? `${payload.zoneName}: Floodwater Standing Under Crops (${soilPct}% Wet Soil)`
        : `${payload.zoneName}: Wet Soil & Growing Crops (${soilPct}% Wet Soil)`;

  const physicsExplanation = isGunw
    ? `Comparing before-and-after satellite scans shows the ground here ${losVal < 0 ? `dropped by ${Math.abs(losVal).toFixed(1)} cm` : `lifted up by ${losVal.toFixed(1)} cm`}. The reading clarity is ${cohPct}%, meaning solid buildings and bare rock reflected a clean signal back to space.`
    : mechanism === 'SPECULAR_WATER'
      ? `Calm standing water acts like a flat mirror and bounces the radar beam away from the satellite, causing the water reading to drop to ${payload.hhDb.toFixed(1)} dB (${payload.deltaHhDb.toFixed(1)} dB lower than dry days). This confirms open floodwater on the ground even under thick storm clouds.`
      : mechanism === 'DOUBLE_BOUNCE_FLOODED_VEG'
        ? `Radar beams are bouncing off the water surface and hitting crop stems or tree trunks before returning to the satellite (water signal ${payload.hhDb.toFixed(1)} dB, crop signal ${payload.hvDb.toFixed(1)} dB). This means water is pooling underneath standing plants.`
        : `The satellite beam is bouncing inside thick leaves and branches (crop signal ${payload.hvDb.toFixed(1)} dB) while the soil underneath is ${soilPct}% soaked with moisture.`;

  const humanAndNaturalDrivers = isGunw
    ? `Earthquake shaking shifted the ground and loosened wet coastal soil, while ${payload.rainfallMm.toFixed(1)} mm of daily rain adds extra weight to nearby hillsides.`
    : `Live weather data shows ${payload.rainfallMm.toFixed(1)} mm of daily rain and ${soilPct}% soaked topsoil, filling up riverbanks and low-lying farmland.`;

  const actionableAdvisory = isGunw
    ? [
        `Inspect roads, bridges, and sea walls in areas where the ground moved more than ${Math.abs(losVal).toFixed(1)} cm.`,
        `Use high-clarity areas (${cohPct}% clarity) first when planning repair crews; check forest slopes in person.`,
        `Compare with the next 12-day satellite scan to see if the ground has stopped settling.`,
      ]
    : [
        `Clear drainage channels and alert villages in blue zones where standing floodwater is detected (${payload.hhDb.toFixed(1)} dB).`,
        `Advise farmers to pause irrigation and drain excess field water while soil wetness is at ${soilPct}%.`,
        `Rely on this cloud-piercing radar map during heavy monsoon clouds when regular camera satellites are blocked.`,
      ];

  const uncertaintyAndLimits = isGunw
    ? `Dense forests or moving water have lower signal clarity (below 35%), so ground movement there should be verified with field teams.`
    : `Strong winds can create small waves on open water, making the water look slightly rougher on radar.`;

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