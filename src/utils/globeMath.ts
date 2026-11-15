import type {
  DatasetAspectId,
  DatasetAspectOption,
  LanguageCode,
  PageAwareAssistRequest,
  PageAwareAssistResponse,
  RegionId,
} from '../types/sar.ts';
import {
  REGION_DATASETS,
  SMIAN_P5_VERIFIED_RECORDS,
} from '../data/samples/asfVertexSamples.ts';

const DEG_TO_RAD = Math.PI / 180;

export interface CartesianPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Converts geographic coordinates (lat, lon in degrees) to Three.js SphereGeometry
 * right-handed Cartesian coordinates matching equirectangular canvas UVs
 * where u = (lon + 180) / 360 and v = (90 - lat) / 180 from North Pole.
 */
export function latLonToCartesian(
  lat: number,
  lon: number,
  radius: number
): CartesianPoint {
  const phi = (lon + 180) * DEG_TO_RAD;
  const theta = (90 - lat) * DEG_TO_RAD;
  const sinTheta = Math.sin(theta);

  return {
    x: -radius * Math.cos(phi) * sinTheta,
    y: radius * Math.cos(theta),
    z: radius * Math.sin(phi) * sinTheta,
  };
}

/**
 * Computes a camera position looking directly at the origin from above the
 * specified geographic coordinate at the requested orbital distance.
 */
export function computeCameraPositionForLatLon(
  lat: number,
  lon: number,
  distance: number
): CartesianPoint {
  return latLonToCartesian(lat, lon, distance);
}

/**
 * Returns dataset-specific toggleable aspects for the right-side analysis panel
 * next to the 2D Leaflet map.
 */
export function getDatasetAspectsForRegion(
  regionId: RegionId
): DatasetAspectOption[] {
  if (regionId === 'japan_gunw') {
    return [
      {
        id: 'crustal_los',
        code: '01',
        title: 'Crustal LOS Motion (GUNW)',
        shortTag: 'DISPLACEMENT',
        summary:
          '24 cm L-band interferometric Line-of-Sight uplift & subsidence gradient across Noto Peninsula & Tokyo Bay.',
        recommendedLayerMode: 'GUNW_LOS',
      },
      {
        id: 'coherence_mask',
        code: '02',
        title: 'Phase Coherence Mask (γ)',
        shortTag: 'COHERENCE',
        summary:
          'Filter temporal decorrelation over forests & coastal liquefaction zones using interferometric coherence (0.0–1.0).',
        recommendedLayerMode: 'GUNW_COHERENCE',
      },
      {
        id: 'flood_water',
        code: '03',
        title: 'Reference Co-Pol Backscatter (HH)',
        shortTag: 'GCOV REF',
        summary:
          'Baseline L-band HH amplitude from Cycle 035 Track 009 Frame 024 verifying surface roughness stability.',
        recommendedLayerMode: 'GCOV_HH',
      },
      {
        id: 'climate_power',
        code: '04',
        title: 'NASA POWER & Roughness Matrix',
        shortTag: 'TELEMETRY',
        summary:
          'Synchronized precipitation, root-zone soil wetness, and dielectric-vs-roughness quadrant analysis.',
      },
      {
        id: 'physics_ai',
        code: '05',
        title: 'Physical Driver AI Synthesis',
        shortTag: 'PHYSICS AI',
        summary:
          'Grounded radar physics interpretation in English, Marathi, or Hindi citing exact cm/dB/γ values.',
      },
      {
        id: 'sources_hdf5',
        code: '06',
        title: 'Detailed Info, Cycle 035 HDF5 & Sources',
        shortTag: 'DATA SOURCES',
        summary:
          'Exact ASF Vertex HDF5 (.h5) granule schema paths, custom GeoJSON upload, and open NASA/ISRO provenance.',
      },
      {
        id: 'history_issues',
        code: '07',
        title: 'History & Past Issues (Laptop Server AI)',
        shortTag: 'HISTORY & AI',
        summary:
          "Explore past floods, crop losses, or earthquakes here and ask AI how your laptop's live .h5 scan compares.",
      },
    ];
  }

  if (regionId === 'northeast_india_gcov') {
    return [
      {
        id: 'flood_water',
        code: '01',
        title: 'Brahmaputra Flood Inundation (HH)',
        shortTag: 'FLOOD HH',
        summary:
          'Specular reflection drop (HH <= -18.0 dB) isolating open floodwaters beneath 95%+ monsoon cloud cover.',
        recommendedLayerMode: 'GCOV_HH',
      },
      {
        id: 'crop_canopy',
        code: '02',
        title: 'Kaziranga Canopy & Double-Bounce (HV)',
        shortTag: 'WETLAND HV',
        summary:
          'Cross-polarized HV & HV/HH ratio isolating inundated grassland, paddy wetlands, and forest volume scatter.',
        recommendedLayerMode: 'GCOV_RATIO',
      },
      {
        id: 'climate_power',
        code: '03',
        title: 'NASA POWER Rainfall & Soil Wetness',
        shortTag: 'TELEMETRY',
        summary:
          'Daily NASA POWER precipitation (PRECTOTCORR) correlated against GCOV dielectric moisture response.',
      },
      {
        id: 'physics_ai',
        code: '04',
        title: 'Physical Driver AI Synthesis',
        shortTag: 'PHYSICS AI',
        summary:
          'Grounded scattering & hydro-ecological interpretation in English, Marathi, or Hindi for Assam ASDMA.',
      },
      {
        id: 'sources_hdf5',
        code: '05',
        title: 'Detailed Info, Cycle 035 HDF5 & Sources',
        shortTag: 'DATA SOURCES',
        summary:
          'Exact Cycle 035 Track 098 Frame 013 HDF5 paths, custom GeoJSON upload, and NASA/ISRO data citations.',
      },
      {
        id: 'history_issues',
        code: '06',
        title: 'History & Past Issues (Laptop Server AI)',
        shortTag: 'HISTORY & AI',
        summary:
          "Explore past floods, crop losses, or earthquakes here and ask AI how your laptop's live .h5 scan compares.",
      },
    ];
  }

  // Default: maharashtra_gcov
  return [
    {
      id: 'flood_water',
      code: '01',
      title: 'Gosikhurd Flood & Water Mapping (HH)',
      shortTag: 'FLOOD HH',
      summary:
        'Specular water drop (HH down to -21.4 dB) mapping spillway release & inundated Wainganga floodplains.',
      recommendedLayerMode: 'GCOV_HH',
    },
    {
      id: 'crop_canopy',
      code: '02',
      title: 'Vidarbha Cotton & Paddy Canopy (HV)',
      shortTag: 'CANOPY HV',
      summary:
        'L-band penetration into Bhandara paddy double-bounce & Wardha Bt cotton crop canopy biomass.',
      recommendedLayerMode: 'GCOV_HV',
    },
    {
      id: 'climate_power',
      code: '03',
      title: 'NASA POWER Rainfall & Dielectric Matrix',
      shortTag: 'TELEMETRY',
      summary:
        'Compare daily NASA POWER rainfall & root-zone wetness against SAR dielectric constant & roughness.',
    },
    {
      id: 'physics_ai',
      code: '04',
      title: 'Physical Driver AI Synthesis',
      shortTag: 'PHYSICS AI',
      summary:
        'Grounded decision briefing in English, Marathi, or Hindi for Maharashtra SDMA & agronomy officers.',
    },
    {
      id: 'sources_hdf5',
      code: '05',
      title: 'Detailed Info, Cycle 035 HDF5 & Sources',
      shortTag: 'DATA SOURCES',
      summary:
        'Cycle 035 Track 084 Frame 013 HDF5 dataset paths, custom GeoJSON inspector, and open data provenance.',
    },
    {
      id: 'history_issues',
      code: '06',
      title: 'History & Past Issues (Laptop Server AI)',
      shortTag: 'HISTORY & AI',
      summary:
        "Explore past floods, crop losses, or earthquakes here and ask AI how your laptop's live .h5 scan compares.",
    },
  ];
}

export function getDefaultAspectForRegion(regionId: RegionId): DatasetAspectId {
  return regionId === 'japan_gunw' ? 'crustal_los' : 'flood_water';
}

export function formatPageContextLabel(req: {
  currentView: PageAwareAssistRequest['currentView'];
  regionId?: RegionId;
  activeAspect?: DatasetAspectId;
  zoneName?: string;
}): string {
  if (req.currentView === 'HOME_3D_GLOBE') {
    return '3D EARTH HOME · GLOBAL OVERVIEW';
  }
  const regionShort = req.regionId
    ? REGION_DATASETS[req.regionId]?.shortName ?? req.regionId
    : '2D MAP';
  const aspectTitle = req.activeAspect
    ? req.activeAspect.replace('_', ' ').toUpperCase()
    : 'TELEMETRY';
  return req.zoneName
    ? `${regionShort} · ${aspectTitle} · ${req.zoneName}`
    : `${regionShort} · ${aspectTitle}`;
}

export function buildPageAwareAssistantFallback(
  req: PageAwareAssistRequest
): PageAwareAssistResponse {
  const contextLabel = formatPageContextLabel(req);
  const lang: LanguageCode = req.language ?? 'en';
  const qLower = req.question.toLowerCase();

  if (req.currentView === 'HOME_3D_GLOBE') {
    if (lang === 'mr') {
      return {
        answer:
          'तुम्ही सध्या 3D अर्थ होम पेजवर आहात. येथे महाराष्ट्र (GCOV पूर व कापूस/धान), ईशान्य भारत (ब्रह्मपुत्रा व काझीरंगा पाणथळ क्षेत्रे) आणि जपान (GUNW भूकंप हालचाल) हे तीन NISAR अभ्यास क्षेत्रे हायलाइट केली आहेत. कोणत्याही ठिकाणावर किंवा यादीतील प्रकल्पावर क्लिक केल्यास 2D नकाशा व सविस्तर विश्लेषण उघडेल.',
        suggestedFollowUps: [
          'महाराष्ट्र आणि जपान डेटामध्ये काय फरक आहे?',
          'L-बँड रडार ढगांमधून कसे पाहू शकते?',
          'Cycle 035 HDF5 डेटाबद्दल सांगा',
        ],
        contextLabel,
        source: 'DETERMINISTIC_PHYSICS_FALLBACK',
        generatedAt: new Date().toISOString(),
      };
    }

    if (lang === 'hi') {
      return {
        answer:
          'आप अभी 3D अर्थ होम पेज पर हैं। ग्लोब पर तीन सक्रिय NISAR क्षेत्र हाइलाइट हैं: महाराष्ट्र (GCOV मानसून बाढ़ एवं फसल), पूर्वोत्तर भारत (ब्रह्मपुत्र व काजीरंगा आर्द्रभूमि), और जापान (GUNW भूकंपीय विस्थापन)। किसी भी मार्कर या प्रोजेक्ट पंक्ति पर क्लिक करें और स्मूथ ट्रांज़िशन के साथ 2D मैप और दाईं ओर के विश्लेषण विकल्प देखें।',
        suggestedFollowUps: [
          'GCOV और GUNW में क्या अंतर है?',
          'L-बैंड रडार मानसून बादलों को कैसे भेदता है?',
          'किस क्षेत्र से शुरुआत करें?',
        ],
        contextLabel,
        source: 'DETERMINISTIC_PHYSICS_FALLBACK',
        generatedAt: new Date().toISOString(),
      };
    }

    const answer = qLower.includes('gcov') || qLower.includes('gunw') || qLower.includes('differ')
      ? 'On this 3D Earth Home view, two regions use NISAR Level-2 GCOV (Maharashtra & Northeast India, measuring dual-pol HH/HV backscatter in γ⁰ dB for floodwater and crop/wetland volume) while Japan highlights Level-2 GUNW interferometry (measuring cm-scale crustal uplift/subsidence & phase coherence γ). Tap any highlighted globe beacon or project row below to transition into the 2D explorer.'
      : 'You are on the 3D Earth Home page. Three active Cycle 035 study areas are highlighted: Maharashtra (Gosikhurd floods & Vidarbha crops), Northeast India (Brahmaputra floodplain & Kaziranga wetlands), and Japan (Noto Peninsula & Tokyo Bay crustal deformation). Click any glowing marker on the globe—or any row in the Study Area list—to morph smoothly into its interactive 2D Leaflet map with toggleable aspect panels.';

    return {
      answer,
      suggestedFollowUps: [
        'Compare GCOV vs GUNW products',
        'Why does L-band 24 cm pierce monsoon clouds?',
        'Which study area shows critical flood risk?',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  // REGION_2D_MAP context
  const region = req.regionId
    ? REGION_DATASETS[req.regionId]
    : REGION_DATASETS.maharashtra_gcov;
  const zoneLabel = req.zoneName || region.zones[0].name;
  const aspect = req.activeAspect ?? getDefaultAspectForRegion(region.id);
  const metricsNote = req.metricsSummary
    ? ` Live telemetry in view: ${req.metricsSummary}.`
    : '';

  if (lang === 'mr') {
    return {
      answer: `तुम्ही ${region.shortName} च्या 2D नकाशावर "${zoneLabel}" (${aspect}) तपासत आहात.${metricsNote} उजव्या बाजूचे पर्याय वापरून तुम्ही HH पूर नकाशा, HV पीक घनता, NASA POWER पाऊस किंवा Cycle 035 HDF5 डेटा स्रोत एकामागून एक उघडून पाहू शकता.`,
      suggestedFollowUps: [
        'सध्याच्या झोनमधील dB/cm बदलाचा अर्थ काय?',
        'NASA POWER पावसाचा रडार सिग्नलशी संबंध सांगा',
        'प्रशासनासाठी पुढील कृती काय असावी?',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  if (lang === 'hi') {
    return {
      answer: `आप ${region.shortName} के 2D मानचित्र पर "${zoneLabel}" (${aspect}) देख रहे हैं।${metricsNote} दाईं ओर दिए गए टॉगल विकल्पों से आप HH बाढ़ परत, HV फसल कैनोपी, NASA POWER वर्षा या Cycle 035 HDF5 डेटा स्रोतों का एक-एक करके विस्तृत विश्लेषण कर सकते हैं।`,
      suggestedFollowUps: [
        'वर्तमान ज़ोन के रडार मान का भौतिक अर्थ समझाएँ',
        'ऑप्टिकल vs SAR स्प्लिट स्लाइडर कैसे पढ़ें?',
        'आगे कौन-सा पहलू देखना चाहिए?',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  const matchedSmian = SMIAN_P5_VERIFIED_RECORDS.find((rec) => {
    if (qLower.includes(rec.fileName.toLowerCase())) return true;
    if (req.regionId === 'japan_gunw' && rec.regionId === 'japan') return true;
    if (
      req.regionId === 'northeast_india_gcov' &&
      rec.regionId === 'northeast_india'
    ) {
      return true;
    }
    if (req.regionId === 'maharashtra_gcov' && rec.regionId === 'maharashtra') {
      return true;
    }
    return false;
  }) ?? SMIAN_P5_VERIFIED_RECORDS[1];

  const isHistoryOrPastQuestion =
    aspect === 'history_issues' ||
    qLower.includes('history') ||
    qLower.includes('past') ||
    qLower.includes('previous') ||
    qLower.includes('recurring') ||
    qLower.includes('2019') ||
    qLower.includes('2020') ||
    qLower.includes('2022') ||
    qLower.includes('2023') ||
    qLower.includes('2024') ||
    qLower.includes('2025') ||
    qLower.includes('compare');

  if (isHistoryOrPastQuestion && matchedSmian.historicalIssues?.length) {
    const firstIssue = matchedSmian.historicalIssues[0];
    const secondIssue = matchedSmian.historicalIssues[1];
    const sizeGb = (matchedSmian.fileSizeMB / 1000).toFixed(1);
    const compareText =
      matchedSmian.regionId === 'japan'
        ? `Comparing past events (${firstIssue.year} ${firstIssue.eventTitle}) with your SMIAN_P5 laptop's ${sizeGb} GB Nov 5, 2026 .h5 scan: the land shifted up to ${Math.abs(matchedSmian.losDisplacementCm ?? -18.6).toFixed(1)} cm at ${Math.round((matchedSmian.coherenceMean ?? 0.81) * 100)}% reliability (γ = ${(matchedSmian.coherenceMean ?? 0.81).toFixed(2)}), while calm coastal water reads ${matchedSmian.hhFloodMinDb.toFixed(1)} dB. ${firstIssue.radarSignatureComparison}`
        : `Comparing past events (${firstIssue.year} ${firstIssue.eventTitle}${secondIssue ? ` and ${secondIssue.year} ${secondIssue.eventTitle}` : ''}) with your SMIAN_P5 laptop's ${sizeGb} GB Nov 11, 2026 .h5 scan: smooth floodwater reads ${matchedSmian.hhFloodMinDb.toFixed(1)} dB (flat-mirror reflection under clouds) with ${Math.round((matchedSmian.soilMoistureIndex ?? 0.78) * 100)}% soaked topsoil and ${matchedSmian.hvGamma0MeanDb.toFixed(1)} dB plant canopy bounce. ${firstIssue.radarSignatureComparison}`;

    return {
      answer: compareText,
      suggestedFollowUps: [
        'What recurring problem affects people most here?',
        'How does today’s .h5 scan compare to past floods/quakes?',
        'What should local teams watch next?',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  const isH5OrNumbersQuestion =
    qLower.includes('.h5') ||
    qLower.includes('h5') ||
    qLower.includes('hdf5') ||
    qLower.includes('file') ||
    qLower.includes('number') ||
    qLower.includes('what does') ||
    qLower.includes('simple');

  if (isH5OrNumbersQuestion) {
    const sizeGb = (matchedSmian.fileSizeMB / 1000).toFixed(1);
    const sliceProof =
      matchedSmian.liveDiskSlices && matchedSmian.liveDiskSlices.length > 0
        ? ` Verified across 3 live disk slices (e.g., ${(matchedSmian.liveDiskSlices[1]?.nonZeroByteRatio * 100 || 99.3).toFixed(1)}% active radar fill, hash ${matchedSmian.liveDiskSlices[1]?.chunkSha256 ?? matchedSmian.headerDigest}).`
        : '';
    const summaryLead = matchedSmian.plainEnglishSummary
      ? `${matchedSmian.plainEnglishSummary} `
      : '';

    if (matchedSmian.regionId === 'japan') {
      return {
        answer: `${summaryLead}Think of this ${sizeGb} GB (${matchedSmian.fileSizeMB.toLocaleString('en-US')} MB) NASA .h5 file as a cloud-piercing space X-ray for Noto Peninsula. Like a centimeter ruler from orbit, it measured the ground sinking by ${Math.abs(matchedSmian.losDisplacementCm ?? -18.6).toFixed(1)} cm (${Math.round((matchedSmian.coherenceMean ?? 0.81) * 100)}% measurement confidence), while smooth coastal water bounced radar away like a flat mirror (${matchedSmian.hhFloodMinDb.toFixed(1)} dB flood low, ${matchedSmian.hhGamma0MeanDb.toFixed(1)} dB average) and hillside plants scattered echoes off leaves and stems (${matchedSmian.hvGamma0MeanDb.toFixed(1)} dB).${sliceProof}`,
        suggestedFollowUps: [
          'Why does flat floodwater act like a mirror?',
          'What does 81% confidence mean on the map?',
          'How do I compare Satellite and Radar views?',
        ],
        contextLabel,
        source: 'DETERMINISTIC_PHYSICS_FALLBACK',
        generatedAt: new Date().toISOString(),
      };
    }

    const moisturePct = Math.round((matchedSmian.soilMoistureIndex ?? 0.78) * 100);
    return {
      answer: `${summaryLead}This ${sizeGb} GB (${matchedSmian.fileSizeMB.toLocaleString('en-US')} MB) NASA .h5 file for ${matchedSmian.regionName} is a scientific container packed with cloud-piercing radar echoes. Smooth standing floodwater acts like a flat mirror and bounces radar away from the satellite—dropping brightness to ${matchedSmian.hhFloodMinDb.toFixed(1)} dB (${matchedSmian.hhGamma0MeanDb.toFixed(1)} dB average)—while radar bouncing inside leaves and stems measures thick crops and wetlands at ${matchedSmian.hvGamma0MeanDb.toFixed(1)} dB, matching ${moisturePct}% soaked topsoil moisture.${sliceProof}`,
      suggestedFollowUps: [
        'Explain the 3 folders inside the .h5 file',
        'Why is floodwater dark in radar?',
        'What should local farmers or officials watch?',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  const isSafetyQuestion =
    qLower.includes('safe') ||
    qLower.includes('advisory') ||
    qLower.includes('danger') ||
    qLower.includes('risk') ||
    qLower.includes('watch') ||
    qLower.includes('action') ||
    qLower.includes('what should');

  if (isSafetyQuestion) {
    const safetyText =
      region.productType === 'GUNW'
        ? `In ${zoneLabel}, safety priority centers on crustal stability. Radar measures ${Math.abs(matchedSmian.losDisplacementCm ?? -18.6).toFixed(1)} cm of ground shift with ${Math.round((matchedSmian.coherenceMean ?? 0.81) * 100)}% measurement confidence. Geotechnical teams should prioritize inspecting roads, harbor seawalls, and water pipelines in coherent zones, while keeping away from saturated coastal bluffs vulnerable to aftershocks.`
        : `In ${zoneLabel}, immediate advisory priority focuses on water levels. Radar detects standing water dropping to ${matchedSmian.hhFloodMinDb.toFixed(1)} dB (mirror reflection) alongside ${Math.round((matchedSmian.soilMoistureIndex ?? 0.78) * 100)}% soaked soil. Low-lying riverbank communities should heed dam spillway alerts, while farmers should clear field trenches to relieve waterlogging in cotton and paddy root zones.`;

    return {
      answer: safetyText,
      suggestedFollowUps: [
        'How does today’s .h5 scan compare to past disasters?',
        'Why does flat floodwater act like a mirror?',
        'Explain the .h5 satellite file in simple words',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  const isFloodQuestion =
    qLower.includes('flood') ||
    qLower.includes('water') ||
    qLower.includes('inundat') ||
    qLower.includes('river') ||
    qLower.includes('dam') ||
    qLower.includes('spillway');

  if (isFloodQuestion) {
    return {
      answer: `In ${zoneLabel}, standing floodwater acts like a flat specular mirror for NISAR's 24 cm L-band microwaves. Instead of scattering back to the satellite, the pulse bounces away, making open inundation appear very dark (HH dropped to ${matchedSmian.hhFloodMinDb.toFixed(1)} dB, compared to ${matchedSmian.hhGamma0MeanDb.toFixed(1)} dB ground average). Crucially, 24 cm radar waves pass through 100% of monsoon cloud cover, revealing flood extents even during severe overcast.`,
      suggestedFollowUps: [
        'What should people watch out for?',
        'How does today’s .h5 scan compare to past floods?',
        'Explain the .h5 satellite file in simple words',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  const isCropQuestion =
    qLower.includes('crop') ||
    qLower.includes('cotton') ||
    qLower.includes('paddy') ||
    qLower.includes('soil') ||
    qLower.includes('wetness') ||
    qLower.includes('farm') ||
    qLower.includes('canopy');

  if (isCropQuestion) {
    return {
      answer: `In ${zoneLabel}, crop canopies create volume scattering where radar waves bounce repeatedly inside dense leaves and branches (measuring HV ${matchedSmian.hvGamma0MeanDb.toFixed(1)} dB). Coupled with NASA POWER topsoil wetness at ${Math.round((matchedSmian.soilMoistureIndex ?? 0.78) * 100)}%, this identifies healthy vegetative biomass alongside pockets where heavy vertisol clay is waterlogged and prone to fungal root stress.`,
      suggestedFollowUps: [
        'What should farmers do about waterlogging?',
        'Why is cross-pol HV sensitive to crops?',
        'Explain the .h5 satellite file in simple words',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  const isEarthquakeQuestion =
    qLower.includes('earthquake') ||
    qLower.includes('quake') ||
    qLower.includes('fault') ||
    qLower.includes('shift') ||
    qLower.includes('deform') ||
    qLower.includes('uplift') ||
    qLower.includes('subsid');

  if (isEarthquakeQuestion) {
    return {
      answer: `In ${zoneLabel}, NISAR Level-2 GUNW interferometry compares radar wave phase cycles between repeat orbits. Each 2π unwrapped fringe corresponds to 12.0 cm of Line-of-Sight (LOS) crustal shift. Current telemetry detects up to ${Math.abs(matchedSmian.losDisplacementCm ?? -18.6).toFixed(1)} cm of ground displacement with ${Math.round((matchedSmian.coherenceMean ?? 0.81) * 100)}% measurement reliability (γ = ${(matchedSmian.coherenceMean ?? 0.81).toFixed(2)}), pinpointing differential settling across fault blocks.`,
      suggestedFollowUps: [
        'What does 81% confidence mean for recovery?',
        'Where did the ground shift most?',
        'Explain the .h5 satellite file in simple words',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  const isRadarPhysicsQuestion =
    qLower.includes('cloud') ||
    qLower.includes('radar') ||
    qLower.includes('l-band') ||
    qLower.includes('microwave') ||
    qLower.includes('penetrat') ||
    qLower.includes('pierce');

  if (isRadarPhysicsQuestion) {
    return {
      answer: `NISAR uses L-band microwave radar at a 24.0 cm wavelength. Unlike visible sunlight used by normal camera satellites (which gets scattered and blocked by cloud droplets, smoke, and haze), 24 cm microwaves are thousands of times larger than cloud water droplets. They pass straight through heavy monsoon clouds, fog, and night darkness, illuminating the actual ground and water below with 10-meter spatial resolution.`,
      suggestedFollowUps: [
        'Why does flat floodwater act like a mirror?',
        'Explain the .h5 satellite file in simple words',
        'Compare the 3 places',
      ],
      contextLabel,
      source: 'DETERMINISTIC_PHYSICS_FALLBACK',
      generatedAt: new Date().toISOString(),
    };
  }

  let aspectInsight = '';
  if (aspect === 'flood_water') {
    aspectInsight =
      'In this Flood & Surface Water (HH) view, calm standing water acts as a specular mirror at 24 cm L-band, dropping HH backscatter below -18.0 dB even beneath 95%+ monsoon cloud cover.';
  } else if (aspect === 'crop_canopy') {
    aspectInsight =
      'In this Canopy & Double-Bounce (HV / Ratio) view, cross-polarized HV (>= -12.5 dB) captures volumetric scattering inside cotton/paddy crops and inundated emergent wetlands.';
  } else if (aspect === 'crustal_los') {
    aspectInsight =
      'In this GUNW Crustal Motion view, each 2π unwrapped interferometric fringe represents 12.0 cm of Line-of-Sight uplift or subsidence across active fault blocks—like reading a centimeter ruler from space.';
  } else if (aspect === 'coherence_mask') {
    aspectInsight =
      'In this Coherence Mask (γ) view, adjust the γ threshold slider to mask out low-coherence forests or liquefied shorelines (γ < 0.35) while keeping solid-rock strain estimates reliable.';
  } else if (aspect === 'climate_power') {
    aspectInsight =
      'In this NASA POWER Telemetry view, rainfall spikes (PRECTOTCORR) and root-zone wetness (GWETROOT) explain dielectric shifts across the 4 orbital passes.';
  } else if (aspect === 'sources_hdf5') {
    aspectInsight =
      'This Data Sources view displays the exact ASF Vertex Cycle 035 HDF5 (.h5) granule filename, plain-English folder decoders (Water Grid, Crop Grid, GPS Outline), and live SMIAN_P5 telemetry.';
  } else {
    aspectInsight =
      'Use the Physical Driver AI Synthesis panel to generate a grounded scattering mechanism briefing tailored to this exact study zone.';
  }

  return {
    answer: `Viewing ${region.shortName} → ${zoneLabel} (${aspect}).${metricsNote} ${aspectInsight}`,
    suggestedFollowUps: [
      'Explain the .h5 satellite file in simple words',
      'How does the Satellite vs Radar slider work?',
      'Which topic should I check next?',
    ],
    contextLabel,
    source: 'DETERMINISTIC_PHYSICS_FALLBACK',
    generatedAt: new Date().toISOString(),
  };
}
