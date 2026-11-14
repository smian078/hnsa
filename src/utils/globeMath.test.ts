import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPageAwareAssistantFallback,
  computeCameraPositionForLatLon,
  formatPageContextLabel,
  getDatasetAspectsForRegion,
  getDefaultAspectForRegion,
  latLonToCartesian,
} from './globeMath.ts';

describe('3D Globe Cartesian Projection & Region Aspect Helpers', () => {
  it('places Prime Meridian Equator (0, 0) along +X at exact sphere radius', () => {
    const pt = latLonToCartesian(0, 0, 2);
    assert.ok(Math.abs(pt.x - 2) < 1e-6);
    assert.ok(Math.abs(pt.y) < 1e-6);
    assert.ok(Math.abs(pt.z) < 1e-6);
  });

  it('places North Pole (90, 0) along +Y and East Hemisphere (+90E) along -Z', () => {
    const north = latLonToCartesian(90, 0, 2);
    assert.ok(Math.abs(north.y - 2) < 1e-6);
    assert.ok(Math.abs(north.x) < 1e-6);

    const east = latLonToCartesian(0, 90, 2);
    assert.ok(Math.abs(east.z + 2) < 1e-6);
    assert.ok(Math.abs(east.x) < 1e-6);
  });

  it('computes normalized orbital camera position matching region vector magnitude', () => {
    const cam = computeCameraPositionForLatLon(20.78, 79.42, 4.5);
    const mag = Math.hypot(cam.x, cam.y, cam.z);
    assert.ok(Math.abs(mag - 4.5) < 1e-6);
  });

  it('returns GUNW aspects for Japan and GCOV aspects for Maharashtra/Northeast India', () => {
    const mh = getDatasetAspectsForRegion('maharashtra_gcov');
    const jp = getDatasetAspectsForRegion('japan_gunw');
    assert.equal(getDefaultAspectForRegion('maharashtra_gcov'), 'flood_water');
    assert.equal(getDefaultAspectForRegion('japan_gunw'), 'crustal_los');
    assert.ok(mh.some((a) => a.id === 'sources_hdf5'));
    assert.ok(jp.some((a) => a.id === 'coherence_mask'));
  });

  it('builds distinct page-aware fallback answers for HOME_3D_GLOBE vs REGION_2D_MAP', () => {
    const homeResp = buildPageAwareAssistantFallback({
      currentView: 'HOME_3D_GLOBE',
      question: 'Where do I start?',
      language: 'en',
    });
    assert.match(homeResp.contextLabel, /3D EARTH HOME/);
    assert.match(homeResp.answer, /Maharashtra/i);

    const mapResp = buildPageAwareAssistantFallback({
      currentView: 'REGION_2D_MAP',
      regionId: 'japan_gunw',
      activeAspect: 'crustal_los',
      zoneName: 'Wajima Coastal Uplift Block',
      metricsSummary: 'LOS +18.2 cm, Coherence γ = 0.86',
      question: 'Explain this zone',
      language: 'en',
    });
    assert.equal(
      formatPageContextLabel({
        currentView: 'REGION_2D_MAP',
        regionId: 'japan_gunw',
        activeAspect: 'crustal_los',
        zoneName: 'Wajima Coastal Uplift Block',
      }),
      'Japan [GUNW] · CRUSTAL LOS · Wajima Coastal Uplift Block'
    );
    assert.match(mapResp.answer, /Wajima Coastal Uplift Block/);
    assert.match(mapResp.answer, /12\.0 cm/);
  });
});
