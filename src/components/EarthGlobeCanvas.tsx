import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RotateCcw } from 'lucide-react';
import {
  REGION_DATASETS,
  SMIAN_P5_VERIFIED_RECORDS,
} from '../data/samples/asfVertexSamples.ts';
import {
  LAPTOP_DB_EVENT_NAME,
  normalizeRegionMatch,
  probeLaptopH5Db,
  type LiveLaptopGranuleRecord,
} from '../services/nisarApi.ts';
import type { RegionId } from '../types/sar.ts';
import {
  computeCameraPositionForLatLon,
  latLonToCartesian,
} from '../utils/globeMath.ts';
import { createSatelliteEarthTextures } from '../utils/earthTextures.ts';
import { getSurveyGlobeColors } from '../utils/surveyTheme.ts';

export interface DiveRequest {
  regionId: RegionId;
  zoneId?: string;
  seq: number;
}

interface EarthGlobeCanvasProps {
  activeRegionId: RegionId;
  onSelectRegionTransition: (regionId: RegionId, zoneId?: string) => void;
  onDiveStart?: (regionId: RegionId) => void;
  isTransitioning: boolean;
  diveRequest?: DiveRequest | null;
  fullBleed?: boolean;
  hudVisible?: boolean;
}

const EARTH_RADIUS = 1.72;
const DEFAULT_CAMERA_LAT = 24;
const DEFAULT_CAMERA_LON = 98;
const DEFAULT_CAMERA_DIST = 4.35;
const DIVE_TARGET_DIST = 1.82;
const BASE_FOV = 38;
const DIVE_FOV = 64;

// Pre-allocated scratch vectors for zero-GC frame updates
const _projVec = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _worldNormal = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _startDir = new THREE.Vector3();
const _endDir = new THREE.Vector3();
const _interpDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

function detectSoftwareWebGL(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const rendererStr = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '');
      if (/SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr)) {
        return true;
      }
    }
    const baseStr = String(gl.getParameter(gl.RENDERER) ?? '');
    return /SwiftShader|llvmpipe|softpipe|Software/i.test(baseStr);
  } catch {
    return false;
  }
}

interface HudBadgeMeta {
  regionId: RegionId;
  code: string;
  label: string;
  accentCssVar: string;
  fallbackMetric: string;
}

const HUD_BADGES: HudBadgeMeta[] = [
  {
    regionId: 'maharashtra_gcov',
    code: '01',
    label: 'MAHARASHTRA',
    accentCssVar: 'var(--rr-space-water)',
    fallbackMetric: '-21.4 dB HH',
  },
  {
    regionId: 'northeast_india_gcov',
    code: '02',
    label: 'NE INDIA',
    accentCssVar: 'var(--rr-space-hv)',
    fallbackMetric: '-23.0 dB HH',
  },
  {
    regionId: 'japan_gunw',
    code: '03',
    label: 'JAPAN',
    accentCssVar: 'var(--rr-space-hh)',
    fallbackMetric: '-18.6 cm LOS',
  },
];

function formatLiveBadgeMetric(
  regionId: RegionId,
  records: LiveLaptopGranuleRecord[] | null
): string {
  const rec =
    records?.find((r) => normalizeRegionMatch(r.regionId, regionId)) ??
    SMIAN_P5_VERIFIED_RECORDS.find((r) => normalizeRegionMatch(r.regionId, regionId));

  if (!rec) {
    return HUD_BADGES.find((b) => b.regionId === regionId)?.fallbackMetric ?? 'CYCLE 035';
  }
  if (regionId === 'japan_gunw') {
    const cm = rec.losDisplacementCm ?? -18.6;
    return `${cm > 0 ? '+' : ''}${cm.toFixed(1)} cm LOS`;
  }
  const hh = rec.hhFloodMinDb ?? rec.hhGamma0MeanDb ?? -18.0;
  return `${hh.toFixed(1)} dB HH`;
}

export function EarthGlobeCanvas({
  activeRegionId,
  onSelectRegionTransition,
  onDiveStart,
  isTransitioning,
  diveRequest,
  fullBleed = false,
  hudVisible = true,
}: EarthGlobeCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const hudRefs = useRef<Record<RegionId, HTMLButtonElement | null>>({
    maharashtra_gcov: null,
    northeast_india_gcov: null,
    japan_gunw: null,
  });

  const [hoveredRegion, setHoveredRegion] = useState<RegionId | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [liveRecords, setLiveRecords] = useState<LiveLaptopGranuleRecord[] | null>(null);

  const flyTriggerRef = useRef<((id: RegionId, zoneId?: string) => void) | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelectRegionTransition);
  const onDiveStartRef = useRef(onDiveStart);
  const activeRegionRef = useRef(activeRegionId);

  useEffect(() => {
    onSelectRef.current = onSelectRegionTransition;
  }, [onSelectRegionTransition]);

  useEffect(() => {
    onDiveStartRef.current = onDiveStart;
  }, [onDiveStart]);

  useEffect(() => {
    activeRegionRef.current = activeRegionId;
  }, [activeRegionId]);

  useEffect(() => {
    let active = true;
    const syncRecords = async () => {
      const res = await probeLaptopH5Db();
      if (active && res.connected && res.granules.length > 0) {
        setLiveRecords(res.granules);
      }
    };
    void syncRecords();
    const onDbChange = () => void syncRecords();
    window.addEventListener(LAPTOP_DB_EVENT_NAME, onDbChange);
    return () => {
      active = false;
      window.removeEventListener(LAPTOP_DB_EVENT_NAME, onDbChange);
    };
  }, []);

  useEffect(() => {
    if (!diveRequest) return;
    flyTriggerRef.current?.(diveRequest.regionId, diveRequest.zoneId);
  }, [diveRequest]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(320, container.clientWidth || 960);
    const height = Math.max(380, container.clientHeight || 640);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('3D Earth unavailable; choose a region below to open the 2D radar map.');
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL(renderer);
    const maxAniso = isSoftwareGl
      ? 2
      : Math.min(8, renderer.capabilities.getMaxAnisotropy());
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D Satellite Earth highlighting Maharashtra, Northeast India, and Japan'
    );

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(BASE_FOV, width / height, 0.08, 100);
    const initCam = computeCameraPositionForLatLon(
      DEFAULT_CAMERA_LAT,
      DEFAULT_CAMERA_LON,
      DEFAULT_CAMERA_DIST
    );
    camera.position.set(initCam.x, initCam.y, initCam.z);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.65;
    controls.minDistance = 2.35;
    controls.maxDistance = 6.8;
    controls.autoRotate = false;

    const globeColors = getSurveyGlobeColors();

    // Subtle matte natural orbital sunlight (no glare)
    const ambientLight = new THREE.AmbientLight(new THREE.Color(globeColors.spaceText), 0.56);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(
      new THREE.Color(globeColors.spaceText),
      new THREE.Color(globeColors.spaceWater).multiplyScalar(0.35),
      0.32
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(new THREE.Color(globeColors.spaceText), 1.42);
    sunLight.position.set(6.8, 2.2, 4.2);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(new THREE.Color(globeColors.spaceWater), 0.36);
    rimLight.position.set(-5.2, -1.6, -4.6);
    scene.add(rimLight);

    // Subtle deep-space starfield
    const starPositions = new Float32Array(280 * 3);
    for (let i = 0; i < 280; i++) {
      const r = 15 + (i % 7) * 2.2;
      const theta = i * 2.39996;
      const phi = Math.acos(1 - 2 * ((i + 0.5) / 280));
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: new THREE.Color(globeColors.spaceText),
      size: 0.034,
      transparent: true,
      opacity: 0.35,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const { colorMap, bumpMap, roughnessMap, cloudMap } =
      createSatelliteEarthTextures(maxAniso, isSoftwareGl);

    const sphereSegsW = isSoftwareGl ? 48 : 72;
    const sphereSegsH = isSoftwareGl ? 36 : 54;
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, sphereSegsW, sphereSegsH);
    const earthMat = new THREE.MeshStandardMaterial({
      map: colorMap,
      bumpMap,
      bumpScale: 0.032,
      roughnessMap,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.0,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    let isDisposed = false;
    const remoteTextures: THREE.Texture[] = [];
    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');

    const loadOptionalTexture = (
      url: string,
      isSrgb: boolean,
      onLoad: (tex: THREE.Texture) => void
    ) => {
      texLoader.load(
        url,
        (loaded) => {
          if (isDisposed) {
            loaded.dispose();
            return;
          }
          if (isSrgb) loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.anisotropy = maxAniso;
          remoteTextures.push(loaded);
          onLoad(loaded);
          earthMat.needsUpdate = true;
          renderFrame();
        },
        undefined,
        () => {
          // Retain high-res procedural fallback cleanly
        }
      );
    };

    loadOptionalTexture(
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
      true,
      (tex) => {
        earthMat.map = tex;
      }
    );
    loadOptionalTexture(
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png',
      false,
      (tex) => {
        earthMat.bumpMap = tex;
        earthMat.bumpScale = 0.034;
      }
    );

    // Subtle drifting matte cloud deck (no additive glow layers)
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.01, 56, 40);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
      roughness: 0.98,
      metalness: 0.0,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(cloudMesh);

    // Sun-Synchronous 97.4° Orbit + Realistic Multi-Part 3D NISAR Spacecraft
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.z = THREE.MathUtils.degToRad(97.4);
    orbitGroup.rotation.y = THREE.MathUtils.degToRad(24);
    scene.add(orbitGroup);

    const orbitRadius = EARTH_RADIUS * 1.24;
    const orbitRingGeo = new THREE.TorusGeometry(orbitRadius, 0.0032, 8, 128);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(globeColors.spaceHh),
      transparent: true,
      opacity: 0.28,
    });
    const orbitRingMesh = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRingMesh.rotation.x = Math.PI / 2;
    orbitGroup.add(orbitRingMesh);

    const satelliteGroup = new THREE.Group();
    const goldFoilMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(globeColors.spaceHh),
      metalness: 0.65,
      roughness: 0.38,
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(globeColors.spaceText),
      metalness: 0.55,
      roughness: 0.4,
    });
    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(globeColors.spaceWater).multiplyScalar(0.5),
      metalness: 0.4,
      roughness: 0.35,
    });
    const reflectorMeshMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(globeColors.spaceHh),
      metalness: 0.55,
      roughness: 0.42,
      side: THREE.DoubleSide,
    });

    const busGeo = new THREE.CylinderGeometry(0.032, 0.034, 0.068, 8);
    const satBus = new THREE.Mesh(busGeo, goldFoilMat);
    satelliteGroup.add(satBus);

    const boomGeo = new THREE.CylinderGeometry(0.005, 0.006, 0.125, 8);
    const boom = new THREE.Mesh(boomGeo, titaniumMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, -0.012, 0.065);
    satelliteGroup.add(boom);

    const drumRimGeo = new THREE.TorusGeometry(0.062, 0.0045, 10, 32);
    const drumRim = new THREE.Mesh(drumRimGeo, goldFoilMat);
    drumRim.position.set(0, -0.012, 0.13);
    satelliteGroup.add(drumRim);

    const drumDishGeo = new THREE.CircleGeometry(0.059, 28);
    const drumDish = new THREE.Mesh(drumDishGeo, reflectorMeshMat);
    drumDish.position.set(0, -0.012, 0.13);
    satelliteGroup.add(drumDish);

    const wingGeo = new THREE.BoxGeometry(0.115, 0.004, 0.042);
    const leftWing = new THREE.Mesh(wingGeo, solarPanelMat);
    leftWing.position.set(-0.085, 0.008, 0);
    satelliteGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, solarPanelMat);
    rightWing.position.set(0.085, 0.008, 0);
    satelliteGroup.add(rightWing);

    const beamGeo = new THREE.ConeGeometry(0.13, 0.36, 20, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(globeColors.spaceHh),
      transparent: true,
      opacity: 0.11,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(beamGeo, beamMat);
    beamCone.rotation.x = Math.PI / 2;
    beamCone.position.set(0, -0.012, 0.31);
    satelliteGroup.add(beamCone);

    orbitGroup.add(satelliteGroup);

    // Flush Surface Target Rings (No protruding pins/glow)
    const clickableTargets: THREE.Mesh[] = [];
    const beaconVisuals: Array<{
      regionId: RegionId;
      group: THREE.Group;
      coreDot: THREE.Mesh;
      pulseRing: THREE.Mesh;
      outerRing: THREE.Mesh;
    }> = [];

    const dotGeo = new THREE.CircleGeometry(0.024, 24);
    const pulseRingGeo = new THREE.RingGeometry(0.038, 0.052, 36);
    const outerReticleGeo = new THREE.RingGeometry(0.078, 0.086, 48);
    const hitGeo = new THREE.SphereGeometry(0.22, 12, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    (Object.keys(REGION_DATASETS) as RegionId[]).forEach((regionId) => {
      const region = REGION_DATASETS[regionId];
      const pt = latLonToCartesian(region.center[0], region.center[1], EARTH_RADIUS);
      const normal = new THREE.Vector3(pt.x, pt.y, pt.z).normalize();

      const group = new THREE.Group();
      group.position.copy(normal.clone().multiplyScalar(EARTH_RADIUS * 1.003));
      group.quaternion.setFromUnitVectors(_upAxis, normal);

      const accentColorStr =
        regionId === 'northeast_india_gcov'
          ? globeColors.spaceHv
          : regionId === 'japan_gunw'
            ? globeColors.spaceHh
            : globeColors.spaceWater;

      const coreMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(accentColorStr),
        side: THREE.DoubleSide,
      });
      const coreDot = new THREE.Mesh(dotGeo, coreMat);
      coreDot.rotation.x = -Math.PI / 2;
      coreDot.position.y = 0.004;
      group.add(coreDot);

      const pulseMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(accentColorStr),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.88,
      });
      const pulseRing = new THREE.Mesh(pulseRingGeo, pulseMat);
      pulseRing.rotation.x = -Math.PI / 2;
      pulseRing.position.y = 0.005;
      group.add(pulseRing);

      const outerMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(globeColors.spaceText),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
      });
      const outerRing = new THREE.Mesh(outerReticleGeo, outerMat);
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.006;
      group.add(outerRing);

      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.04;
      hitMesh.userData.regionId = regionId;
      group.add(hitMesh);
      clickableTargets.push(hitMesh);

      earthGroup.add(group);
      beaconVisuals.push({
        regionId,
        group,
        coreDot,
        pulseRing,
        outerRing,
      });
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let rafId = 0;
    let timerId = 0;
    let satAngle = 0.9;
    let hoverRegionLocal: RegionId | null = null;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    let flyState: {
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      startFov: number;
      endFov: number;
      startTime: number;
      durationMs: number;
      targetRegion: RegionId | null;
      targetZoneId?: string;
      triggerTransition: boolean;
      diveStartedFired: boolean;
    } | null = null;

    const triggerFlyTo = (
      regionId: RegionId,
      triggerTransition: boolean,
      zoneId?: string
    ) => {
      const region = REGION_DATASETS[regionId];
      const targetCam = computeCameraPositionForLatLon(
        region.center[0],
        region.center[1],
        triggerTransition ? DIVE_TARGET_DIST : DEFAULT_CAMERA_DIST
      );
      flyState = {
        startPos: camera.position.clone(),
        endPos: new THREE.Vector3(targetCam.x, targetCam.y, targetCam.z),
        startFov: camera.fov,
        endFov: triggerTransition ? DIVE_FOV : BASE_FOV,
        startTime: performance.now(),
        durationMs: prefersReducedMotion
          ? 12
          : isSoftwareGl
            ? 520
            : triggerTransition
              ? 950
              : 540,
        targetRegion: regionId,
        targetZoneId: zoneId,
        triggerTransition,
        diveStartedFired: false,
      };
      scheduleNextTick();
    };

    flyTriggerRef.current = (id: RegionId, zoneId?: string) =>
      triggerFlyTo(id, true, zoneId);
    resetViewRef.current = () => {
      const camPt = computeCameraPositionForLatLon(
        DEFAULT_CAMERA_LAT,
        DEFAULT_CAMERA_LON,
        DEFAULT_CAMERA_DIST
      );
      flyState = {
        startPos: camera.position.clone(),
        endPos: new THREE.Vector3(camPt.x, camPt.y, camPt.z),
        startFov: camera.fov,
        endFov: BASE_FOV,
        startTime: performance.now(),
        durationMs: prefersReducedMotion ? 12 : 480,
        targetRegion: null,
        triggerTransition: false,
        diveStartedFired: false,
      };
      scheduleNextTick();
    };

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableTargets, false);
      const hitId = (hits[0]?.object.userData.regionId as RegionId | undefined) ?? null;
      if (hitId !== hoverRegionLocal) {
        hoverRegionLocal = hitId;
        setHoveredRegion(hitId);
        renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(
        e.clientX - pointerDownPos.x,
        e.clientY - pointerDownPos.y
      );
      if (moved > 8) return;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableTargets, false);
      const hitId = hits[0]?.object.userData.regionId as RegionId | undefined;
      if (hitId) {
        triggerFlyTo(hitId, true);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (isDisposed || !container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(380, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderFrame();
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    const renderFrame = () => {
      if (isDisposed) return;
      const now = performance.now();

      if (!prefersReducedMotion) {
        cloudMesh.rotation.y += isSoftwareGl ? 0.0008 : 0.00022;
        satAngle += isSoftwareGl ? 0.012 : 0.0035;
      }

      satelliteGroup.position.set(
        Math.cos(satAngle) * orbitRadius,
        0,
        Math.sin(satAngle) * orbitRadius
      );
      satelliteGroup.lookAt(0, 0, 0);

      // Update surface reticles
      beaconVisuals.forEach((b, idx) => {
        const isHot = b.regionId === hoverRegionLocal || b.regionId === activeRegionRef.current;
        const wave = prefersReducedMotion ? 0.35 : (now * 0.0016 + idx * 0.33) % 1;
        const scale = isHot ? 1.15 + wave * 1.1 : 0.9 + wave * 0.75;
        b.pulseRing.scale.set(scale, scale, 1);
        (b.pulseRing.material as THREE.MeshBasicMaterial).opacity =
          (1 - wave) * (isHot ? 0.92 : 0.62);
        (b.outerRing.material as THREE.MeshBasicMaterial).opacity = isHot ? 0.75 : 0.38;
      });

      // Smooth Dive-Into-Earth animation
      if (flyState) {
        const elapsed = now - flyState.startTime;
        const rawT = Math.min(1, elapsed / flyState.durationMs);
        // Smooth cubic ease
        const eased =
          rawT < 0.5
            ? 4 * rawT * rawT * rawT
            : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        _startDir.copy(flyState.startPos).normalize();
        _endDir.copy(flyState.endPos).normalize();
        _interpDir.copy(_startDir).lerp(_endDir, eased).normalize();
        const startDist = flyState.startPos.length();
        const endDist = flyState.endPos.length();
        const interpDist = THREE.MathUtils.lerp(startDist, endDist, eased);

        camera.position.copy(_interpDir.multiplyScalar(interpDist));
        camera.fov = THREE.MathUtils.lerp(flyState.startFov, flyState.endFov, eased);
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);

        if (
          flyState.triggerTransition &&
          flyState.targetRegion &&
          !flyState.diveStartedFired &&
          rawT >= 0.62
        ) {
          flyState.diveStartedFired = true;
          onDiveStartRef.current?.(flyState.targetRegion);
        }

        if (rawT >= 1) {
          const completed = flyState;
          flyState = null;
          if (completed.triggerTransition && completed.targetRegion) {
            onSelectRef.current(completed.targetRegion, completed.targetZoneId);
          }
        }
      } else {
        controls.update();
      }

      renderer.render(scene, camera);

      // Synchronize projected HTML HUD marker positions directly via DOM refs (0 React re-renders)
      const viewWidth = container.clientWidth || width;
      const viewHeight = container.clientHeight || height;
      _camDir.copy(camera.position).normalize();

      beaconVisuals.forEach((b) => {
        const el = hudRefs.current[b.regionId];
        if (!el) return;
        b.group.getWorldPosition(_worldPos);
        _worldNormal.copy(_worldPos).normalize();
        const facingDot = _worldNormal.dot(_camDir);

        if (facingDot <= 0.14) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }

        _projVec.copy(_worldPos).project(camera);
        if (_projVec.z > 1) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }

        const screenX = (_projVec.x * 0.5 + 0.5) * viewWidth;
        const screenY = (-_projVec.y * 0.5 + 0.5) * viewHeight;

        const fadeAlpha = Math.min(1, (facingDot - 0.14) / 0.25);
        el.style.opacity = String(fadeAlpha);
        el.style.pointerEvents = fadeAlpha > 0.35 ? 'auto' : 'none';
        el.style.transform = `translate3d(${screenX.toFixed(1)}px, ${screenY.toFixed(1)}px, 0)`;
      });
    };

    const gl2 = isSoftwareGl
      ? (renderer.getContext() as WebGL2RenderingContext)
      : null;

    const afterDraw = (next: () => void) => {
      if (isDisposed) return;
      if (gl2 && typeof gl2.fenceSync === 'function') {
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl2.flush();
          const started = performance.now();
          const poll = () => {
            if (isDisposed) {
              gl2.deleteSync(sync);
              return;
            }
            const status = gl2.clientWaitSync(sync, 0, 0);
            if (
              status === gl2.ALREADY_SIGNALED ||
              status === gl2.CONDITION_SATISFIED ||
              performance.now() - started > 80
            ) {
              gl2.deleteSync(sync);
              next();
            } else {
              timerId = window.setTimeout(poll, 8);
            }
          };
          timerId = window.setTimeout(poll, 8);
          return;
        }
      }
      rafId = window.requestAnimationFrame(next);
    };

    const tick = () => {
      if (isDisposed) return;
      renderFrame();
      if (flyState) {
        if (isSoftwareGl) {
          timerId = window.setTimeout(() => afterDraw(tick), 24);
        } else {
          rafId = window.requestAnimationFrame(tick);
        }
      } else if (!prefersReducedMotion && !isSoftwareGl) {
        rafId = window.requestAnimationFrame(tick);
      } else if (!prefersReducedMotion && isSoftwareGl) {
        // Gentle throttled cadence on software WebGL so Chromium's compositor stays idle-ready
        timerId = window.setTimeout(() => afterDraw(tick), 650);
      }
    };

    const scheduleNextTick = () => {
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(rafId);
      timerId = 0;
      rafId = 0;
      if (prefersReducedMotion && !flyState) {
        renderFrame();
      } else {
        tick();
      }
    };

    renderFrame();
    if (!prefersReducedMotion) {
      if (isSoftwareGl) {
        timerId = window.setTimeout(() => afterDraw(tick), 650);
      } else {
        tick();
      }
    }

    const handleControlChange = () => {
      if (prefersReducedMotion || isSoftwareGl) {
        renderFrame();
      }
    };
    controls.addEventListener('change', handleControlChange);

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      resizeObserver.disconnect();
      controls.removeEventListener('change', handleControlChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);

      starGeo.dispose();
      starMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      colorMap.dispose();
      bumpMap.dispose();
      roughnessMap.dispose();
      remoteTextures.forEach((t) => t.dispose());
      cloudGeo.dispose();
      cloudMat.dispose();
      cloudMap.dispose();
      orbitRingGeo.dispose();
      orbitRingMat.dispose();
      busGeo.dispose();
      boomGeo.dispose();
      drumRimGeo.dispose();
      drumDishGeo.dispose();
      wingGeo.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      goldFoilMat.dispose();
      titaniumMat.dispose();
      solarPanelMat.dispose();
      reflectorMeshMat.dispose();
      dotGeo.dispose();
      pulseRingGeo.dispose();
      outerReticleGeo.dispose();
      hitGeo.dispose();
      hitMat.dispose();
      beaconVisuals.forEach((b) => {
        (b.coreDot.material as THREE.Material).dispose();
        (b.pulseRing.material as THREE.Material).dispose();
        (b.outerRing.material as THREE.Material).dispose();
      });

      renderer.dispose();
    };
  }, []);

  const activeHoverMeta = hoveredRegion ? REGION_DATASETS[hoveredRegion] : null;

  return (
    <div
      className={
        fullBleed
          ? 'relative h-full w-full overflow-hidden bg-[var(--rr-space-bg)]'
          : 'relative rounded-xl border border-survey-border bg-[var(--rr-space-bg)] overflow-hidden'
      }
    >
      {/* Full-Bleed 3D Satellite Earth Viewport (Flat Warm-Grey Background) */}
      <div
        className={
          fullBleed
            ? 'relative h-full w-full overflow-hidden bg-[var(--rr-space-bg)]'
            : 'relative h-[420px] sm:h-[500px] lg:h-[560px] w-full overflow-hidden bg-[var(--rr-space-bg)]'
        }
      >
        {webglError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-[var(--rr-space-text)] font-mono">
            {webglError}
          </div>
        ) : (
          <div
            ref={mountRef}
            data-testid="earth-globe-canvas"
            className="h-full w-full"
          />
        )}

        {/* Projected Screen-Space HUD Callout Markers (Zero sticks, synced via refs) */}
        <div
          aria-label="Orbital Earth target markers"
          className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-300 ${
            hudVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {HUD_BADGES.map((badge) => {
            const metric = formatLiveBadgeMetric(badge.regionId, liveRecords);
            const isActive =
              activeRegionId === badge.regionId ||
              hoveredRegion === badge.regionId;
            return (
              <button
                key={badge.regionId}
                ref={(el) => {
                  hudRefs.current[badge.regionId] = el;
                }}
                type="button"
                data-testid={`globe-pin-${badge.regionId}`}
                onClick={() => flyTriggerRef.current?.(badge.regionId)}
                aria-label={`Dive into ${badge.label} (${metric}) 2D Radar Map`}
                style={{ opacity: 0 }}
                className="group absolute left-0 top-0 -translate-x-1.5 -translate-y-1/2 flex items-center gap-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-space-water)]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-[var(--rr-space-bg)] transition-transform group-hover:scale-125"
                  style={{ backgroundColor: badge.accentCssVar }}
                />
                <span
                  className="h-px w-5 sm:w-7 transition-all group-hover:w-9"
                  style={{ backgroundColor: badge.accentCssVar }}
                />
                <span
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1 text-left transition-colors bg-[var(--rr-space-surface)] text-[var(--rr-space-text)] ${
                    isActive
                      ? 'border-[var(--rr-space-border-strong)]'
                      : 'border-[var(--rr-space-border)] group-hover:border-[var(--rr-space-border-strong)]'
                  }`}
                >
                  <span className="text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap">
                    {badge.code} · {badge.label}
                  </span>
                  <span
                    className="font-mono text-[10px] font-semibold tabular-nums whitespace-nowrap"
                    style={{ color: badge.accentCssVar }}
                  >
                    {metric}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Minimal Corner Controls When Interactive */}
        <div className="pointer-events-none absolute bottom-12 sm:bottom-14 left-4 sm:left-8 flex items-center gap-2">
          <div className="rounded-lg bg-[var(--rr-space-surface)] border border-[var(--rr-space-border)] px-3.5 py-1.5 text-[11px] font-medium text-[var(--rr-space-text)]">
            {activeHoverMeta
              ? `${activeHoverMeta.shortName} · Click to view 2D map`
              : isTransitioning
                ? 'Opening 2D radar view...'
                : 'Drag to rotate Earth · Click a ring to explore'}
          </div>
          <button
            type="button"
            onClick={() => resetViewRef.current?.()}
            aria-label="Reset 3D Earth camera view"
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--rr-space-surface)] border border-[var(--rr-space-border)] px-3 py-1.5 text-[11px] font-medium text-[var(--rr-space-text)] hover:border-[var(--rr-space-border-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rr-space-water)]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
