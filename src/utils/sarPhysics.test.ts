import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeterministicSynthesis,
  classifyScatteringMechanism,
  computePassDelta,
  getPolygonVisualStyle,
  parseUploadedGeoJsonOrGranule,
  phaseToLosDisplacementCm,
} from './sarPhysics.ts';
import type { OrbitalPassTelemetry, StudyZone } from '../types/sar.ts';

const mockZone: StudyZone = {
  id: 'test-zone',
  name: 'Gosikhurd Reservoir',
  districtOrPrefecture: 'Bhandara, Maharashtra',
  dominantCover: 'Reservoir & Floodplain',
  hazardStatus: 'CRITICAL',
  centroid: [20.87, 79.62],
  coordinates: [
    [20.9, 79.55],
    [20.9, 79.7],
    [20.82, 79.7],
    [20.82, 79.55],
  ],
  passes: [
    {
      passIndex: 0,
      passCode: 'C01',
      passLabel: 'Baseline',
      acquisitionDate: '2026-06-15',
      hhGamma0Db: -9.4,
      hvGamma0Db: -16.8,
      hvHhRatioDb: -7.4,
      dielectricConstantEst: 6.5,
      surfaceRoughnessCm: 3.1,
      rainfallMm: 12.4,
      soilMoistureIndex: 0.34,
      temperatureC: 34.2,
      cloudCoverPct: 45,
    },
    {
      passIndex: 1,
      passCode: 'C03',
      passLabel: 'Peak Monsoon',
      acquisitionDate: '2026-08-14',
      hhGamma0Db: -21.4,
      hvGamma0Db: -18.2,
      hvHhRatioDb: 3.2,
      dielectricConstantEst: 68.5,
      surfaceRoughnessCm: 0.5,
      rainfallMm: 118.6,
      soilMoistureIndex: 0.92,
      temperatureC: 27.1,
      cloudCoverPct: 98,
    },
  ],
};

test('computePassDelta calculates exact backscatter deltas against baseline', () => {
  const delta = computePassDelta(mockZone, 1);
  assert.equal(delta.deltaHhDb, -12.0);
  assert.equal(delta.deltaHvDb, -1.4);
  assert.equal(delta.deltaRatioDb, 10.6);
  assert.equal(delta.baselineDate, '2026-06-15');
  assert.equal(delta.currentDate, '2026-08-14');
});

test('phaseToLosDisplacementCm converts L-band 2pi fringe to 12 cm LOS', () => {
  const oneFringeCm = phaseToLosDisplacementCm(2 * Math.PI, 24);
  assert.equal(oneFringeCm, 12);
  const subsidenceCm = phaseToLosDisplacementCm(-9.74, 24);
  assert.equal(subsidenceCm, -18.6);
});

test('getPolygonVisualStyle classifies specular flood and respects coherence threshold', () => {
  const floodStyle = getPolygonVisualStyle(mockZone.passes[1], 'GCOV_HH', 0.35);
  assert.equal(floodStyle.fillColor, '#1D6FA3');
  assert.equal(floodStyle.unit, 'dB');
  assert.equal(floodStyle.dimmed, false);

  const darkFloodStyle = getPolygonVisualStyle(mockZone.passes[1], 'GCOV_HH', 0.35, true);
  assert.equal(darkFloodStyle.fillColor, '#5AA9D6');

  const gunwPass: OrbitalPassTelemetry = {
    ...mockZone.passes[1],
    losDisplacementCm: -12.3,
    coherence: 0.24,
  };
  const dimmedStyle = getPolygonVisualStyle(gunwPass, 'GUNW_LOS', 0.35);
  assert.equal(dimmedStyle.dimmed, true);
  assert.equal(dimmedStyle.unit, 'cm');

  const clearStyle = getPolygonVisualStyle(gunwPass, 'GUNW_LOS', 0.2);
  assert.equal(clearStyle.dimmed, false);
});

test('classifyScatteringMechanism distinguishes specular, double-bounce, volume, and InSAR', () => {
  assert.equal(classifyScatteringMechanism('GCOV', -21.4, -18.2), 'SPECULAR_WATER');
  assert.equal(classifyScatteringMechanism('GCOV', -16.2, -11.4), 'DOUBLE_BOUNCE_FLOODED_VEG');
  assert.equal(classifyScatteringMechanism('GCOV', -10.5, -11.2), 'VOLUME_CANOPY');
  assert.equal(classifyScatteringMechanism('GUNW', -12.0, -17.0, -18.6), 'INSAR_PHASE_DEFORMATION');
});

test('buildDeterministicSynthesis produces grounded multilingual responses', () => {
  const mr = buildDeterministicSynthesis({
    regionId: 'maharashtra_gcov',
    zoneName: 'Gosikhurd Reservoir',
    productType: 'GCOV',
    hhDb: -21.4,
    hvDb: -18.2,
    deltaHhDb: -12.0,
    deltaHvDb: -1.4,
    rainfallMm: 118.6,
    soilMoistureIndex: 0.92,
    language: 'mr',
  });
  assert.equal(mr.language, 'mr');
  assert.equal(mr.actionableAdvisory.length, 3);
  assert.match(mr.headline, /Gosikhurd Reservoir/);
});

test('parseUploadedGeoJsonOrGranule validates valid GeoJSON and rejects malformed payloads', () => {
  const validGeoJson = JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          sceneName: 'NISAR_L2_PR_GCOV_004_112_A_019',
          processingLevel: 'GCOV',
          platform: 'NISAR',
        },
        geometry: null,
      },
    ],
  });
  const ok = parseUploadedGeoJsonOrGranule(validGeoJson);
  assert.equal(ok.valid, true);
  assert.equal(ok.granules.length, 1);
  assert.equal(ok.granules[0].productType, 'GCOV');

  const bad = parseUploadedGeoJsonOrGranule('{bad json');
  assert.equal(bad.valid, false);
  assert.ok(bad.error);
});
