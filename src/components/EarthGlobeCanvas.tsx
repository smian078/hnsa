import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Compass, RotateCcw } from 'lucide-react';
import { REGION_DATASETS } from '../data/samples/asfVertexSamples.ts';
import type { RegionId } from '../types/sar.ts';
import {
  computeCameraPositionForLatLon,
  latLonToCartesian,
} from '../utils/globeMath.ts';

interface EarthGlobeCanvasProps {
  activeRegionId: RegionId;
  onSelectRegionTransition: (regionId: RegionId) => void;
  isTransitioning: boolean;
}

const EARTH_RADIUS = 1.72;
const DEFAULT_CAMERA_LAT = 24;
const DEFAULT_CAMERA_LON = 98;
const DEFAULT_CAMERA_DIST = 4.35;

// Geographic coastline silhouettes for photorealistic procedural Blue Marble rendering
const LANDMASS_POLYGONS: Array<{
  biome: 'forest' | 'desert' | 'temperate' | 'ice';
  coords: Array<[number, number]>;
}> = [
  // North & Central America
  {
    biome: 'temperate',
    coords: [
      [-168, 65], [-162, 71], [-140, 70], [-122, 73], [-95, 74], [-78, 70],
      [-64, 64], [-55, 52], [-66, 45], [-74, 40], [-81, 31], [-80, 25],
      [-84, 29], [-90, 29], [-97, 26], [-96, 19], [-88, 21], [-84, 11],
      [-78, 8], [-85, 10], [-93, 15], [-105, 20], [-112, 28], [-117, 32],
      [-124, 40], [-125, 49], [-136, 58], [-152, 60], [-164, 55],
    ],
  },
  // Greenland
  {
    biome: 'ice',
    coords: [
      [-52, 60], [-42, 60], [-30, 68], [-19, 77], [-28, 83], [-56, 82],
      [-68, 76], [-56, 68],
    ],
  },
  // South America
  {
    biome: 'forest',
    coords: [
      [-78, 9], [-72, 12], [-62, 10], [-50, 2], [-35, -6], [-39, -15],
      [-40, -22], [-48, -28], [-54, -34], [-63, -41], [-67, -50], [-68, -55],
      [-74, -52], [-75, -43], [-71, -30], [-70, -18], [-81, -5], [-79, 2],
    ],
  },
  // Africa
  {
    biome: 'desert',
    coords: [
      [-17, 15], [-13, 28], [-6, 36], [10, 37], [15, 32], [25, 32], [33, 31],
      [39, 21], [43, 12], [51, 12], [49, 4], [41, -2], [40, -11], [35, -20],
      [32, -28], [26, -34], [18, -35], [15, -26], [12, -16], [12, -6],
      [9, 4], [2, 6], [-8, 5], [-14, 9],
    ],
  },
  // Madagascar
  { biome: 'forest', coords: [[44, -25], [47, -25], [50, -15], [48, -13], [44, -18]] },
  // Europe & Eurasia & India & SE Asia
  {
    biome: 'temperate',
    coords: [
      [-9, 37], [-9, 43], [-2, 43], [-4, 48], [2, 51], [8, 55], [10, 58],
      [5, 61], [15, 69], [28, 71], [44, 68], [66, 71], [90, 74], [115, 73],
      [140, 72], [175, 67], [163, 60], [155, 59], [142, 53], [136, 45],
      [129, 41], [129, 35], [126, 35], [124, 39], [120, 36], [122, 31],
      [118, 24], [108, 21], [109, 13], [104, 10], [103, 2], [99, 13],
      [96, 16], [92, 21], [88, 22], [84, 19], [80, 13], [77.5, 8.1],
      [76, 10], [73, 16], [72, 21], [68, 23], [62, 25], [56, 26],
      [50, 29], [57, 23], [53, 16], [44, 13], [35, 29], [36, 36],
      [27, 41], [24, 38], [18, 40], [15, 38], [12, 43], [7, 44], [3, 42], [-5, 36],
    ],
  },
  // Sri Lanka
  { biome: 'forest', coords: [[80, 9.6], [81.8, 7.8], [81.2, 6.0], [79.8, 6.9]] },
  // UK & Ireland
  { biome: 'temperate', coords: [[-6, 50], [1, 51], [-2, 58], [-6, 57], [-8, 53]] },
  // Japan Archipelago (Kyushu, Honshu, Hokkaido)
  { biome: 'forest', coords: [[130, 31.2], [131.6, 32], [131.2, 34], [129.6, 33.4]] },
  {
    biome: 'forest',
    coords: [
      [132, 34], [135, 34.4], [137, 36.8], [139.8, 35.2], [141, 38],
      [141.4, 41.3], [140, 41.2], [138.8, 37.8], [136.5, 36.8], [134, 35.6], [131, 34.2],
    ],
  },
  {
    biome: 'temperate',
    coords: [[140.2, 41.6], [142, 42.2], [145.5, 43.4], [144, 44.5], [141.6, 45.4], [140.2, 43.2]],
  },
  // Sumatra, Java, Borneo, Philippines
  { biome: 'forest', coords: [[95.3, 5.5], [105.8, -5.9], [104.2, -6.1], [98, 2.5]] },
  { biome: 'forest', coords: [[105.5, -6.2], [114.4, -8.3], [114.2, -7.2], [106, -5.8]] },
  { biome: 'forest', coords: [[109, 1.5], [117.5, 6.5], [118.8, 1.0], [115, -3.5], [110, -2.5]] },
  { biome: 'forest', coords: [[120, 18.4], [122.4, 14.2], [126.2, 7.2], [122, 6.8], [119.8, 13.5]] },
  // Australia & New Zealand
  {
    biome: 'desert',
    coords: [
      [114, -22], [122, -17], [130, -12], [136, -12], [142, -11], [146, -18],
      [153, -27], [151, -34], [147, -38], [139, -36], [131, -32], [122, -34],
      [115, -34], [113, -27],
    ],
  },
  { biome: 'temperate', coords: [[167, -46], [173, -41], [178, -37], [174, -35], [171, -41], [166, -45]] },
  // Antarctica Shelf
  {
    biome: 'ice',
    coords: [
      [-180, -72], [-120, -74], [-60, -68], [0, -70], [60, -68],
      [120, -67], [180, -72], [180, -90], [-180, -90],
    ],
  },
];

function pseudoNoise(x: number, y: number): number {
  const s1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const s2 = Math.sin(x * 39.346 + y * 11.135) * 24634.6345;
  return ((s1 - Math.floor(s1)) * 0.6 + (s2 - Math.floor(s2)) * 0.4);
}

function createSatelliteEarthTextures(): {
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
} {
  const width = 2048;
  const height = 1024;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = width;
  roughCanvas.height = height;
  const rCtx = roughCanvas.getContext('2d');

  const toPx = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  if (ctx && rCtx) {
    // 1. Deep Blue Marble Ocean Bathymetry Base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#0C2540');
    oceanGrad.addColorStop(0.25, '#072244');
    oceanGrad.addColorStop(0.5, '#0B3563');
    oceanGrad.addColorStop(0.75, '#072244');
    oceanGrad.addColorStop(1, '#0C2540');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle deep-sea ocean currents & bathymetric swells
    for (let i = 0; i < 180; i++) {
      const rx = ((i * 197) % width);
      const ry = ((i * 113) % height);
      const rad = 40 + (i % 6) * 25;
      const g = ctx.createRadialGradient(rx, ry, 2, rx, ry, rad);
      g.addColorStop(0, 'rgba(20, 88, 145, 0.14)');
      g.addColorStop(1, 'rgba(7, 34, 68, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Glossy ocean specular roughness (darker = shinier water)
    rCtx.fillStyle = '#383838';
    rCtx.fillRect(0, 0, width, height);

    // 2. Shallow turquoise continental shelf glow around coastlines
    ctx.save();
    ctx.lineJoin = 'round';
    for (const poly of LANDMASS_POLYGONS) {
      if (poly.coords.length < 3 || poly.biome === 'ice') continue;
      ctx.beginPath();
      poly.coords.forEach(([lon, lat], idx) => {
        const [px, py] = toPx(lon, lat);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(32, 138, 178, 0.34)';
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(56, 178, 208, 0.25)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Draw True-Color Biome Continents
    for (const poly of LANDMASS_POLYGONS) {
      if (poly.coords.length < 3) continue;

      ctx.beginPath();
      rCtx.beginPath();
      poly.coords.forEach(([lon, lat], idx) => {
        const [px, py] = toPx(lon, lat);
        if (idx === 0) {
          ctx.moveTo(px, py);
          rCtx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
          rCtx.lineTo(px, py);
        }
      });
      ctx.closePath();
      rCtx.closePath();

      if (poly.biome === 'ice') {
        ctx.fillStyle = '#DCE6F0';
      } else if (poly.biome === 'forest') {
        ctx.fillStyle = '#2A5533';
      } else if (poly.biome === 'desert') {
        ctx.fillStyle = '#8F7A54';
      } else {
        ctx.fillStyle = '#355D3B';
      }
      ctx.fill();

      // Matte landmass roughness
      rCtx.fillStyle = '#DEDEDE';
      rCtx.fill();

      // Clip inside continent to paint realistic biome gradients (deserts, mountains, monsoon forests)
      ctx.save();
      ctx.clip();

      // Equatorial tropical rainforest belt
      const [eqLeft, eqTop] = toPx(-180, 26);
      const [, eqBot] = toPx(180, -24);
      const tropGrad = ctx.createLinearGradient(0, eqTop, 0, eqBot);
      tropGrad.addColorStop(0, 'rgba(42, 85, 51, 0)');
      tropGrad.addColorStop(0.5, 'rgba(30, 82, 42, 0.55)');
      tropGrad.addColorStop(1, 'rgba(42, 85, 51, 0)');
      ctx.fillStyle = tropGrad;
      ctx.fillRect(eqLeft, eqTop, width, eqBot - eqTop);

      // Sahara + Arabian + Thar + Gobi Arid Belt
      const aridRegions: Array<{ lon: number; lat: number; rx: number; ry: number; color: string }> = [
        { lon: 14, lat: 22, rx: 190, ry: 85, color: 'rgba(182, 148, 96, 0.78)' }, // Sahara
        { lon: 46, lat: 24, rx: 90, ry: 55, color: 'rgba(186, 152, 102, 0.75)' }, // Arabia
        { lon: 68, lat: 27, rx: 75, ry: 45, color: 'rgba(164, 138, 86, 0.62)' }, // Thar / Indus
        { lon: 98, lat: 41, rx: 145, ry: 60, color: 'rgba(156, 136, 94, 0.65)' }, // Gobi / Taklamakan
        { lon: 133, lat: -24, rx: 110, ry: 65, color: 'rgba(176, 118, 72, 0.72)' }, // Australian Outback
        { lon: -108, lat: 36, rx: 75, ry: 55, color: 'rgba(158, 132, 92, 0.55)' }, // SW US
      ];
      aridRegions.forEach((zone) => {
        const [zx, zy] = toPx(zone.lon, zone.lat);
        const g = ctx.createRadialGradient(zx, zy, 8, zx, zy, zone.rx);
        g.addColorStop(0, zone.color);
        g.addColorStop(1, 'rgba(150, 125, 85, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(zx, zy, zone.rx, zone.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Himalayan & Tibetan High Mountain Snow/Rock Ridge
      const [himX, himY] = toPx(86, 33);
      const himGrad = ctx.createRadialGradient(himX, himY, 8, himX, himY, 125);
      himGrad.addColorStop(0, 'rgba(226, 232, 240, 0.85)');
      himGrad.addColorStop(0.45, 'rgba(148, 138, 126, 0.68)');
      himGrad.addColorStop(1, 'rgba(90, 95, 75, 0)');
      ctx.fillStyle = himGrad;
      ctx.beginPath();
      ctx.ellipse(himX, himY, 130, 52, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Northern Tundra & Boreal Forest tint
      const [, northBottom] = toPx(0, 55);
      const boreGrad = ctx.createLinearGradient(0, 0, 0, northBottom);
      boreGrad.addColorStop(0, 'rgba(218, 228, 238, 0.72)');
      boreGrad.addColorStop(0.55, 'rgba(72, 96, 68, 0.45)');
      boreGrad.addColorStop(1, 'rgba(46, 78, 52, 0)');
      ctx.fillStyle = boreGrad;
      ctx.fillRect(0, 0, width, northBottom);

      // Fine terrain mottling (forests, agricultural basins, river valleys)
      for (let i = 0; i < 650; i++) {
        const nx = pseudoNoise(i, 1.3) * width;
        const ny = pseudoNoise(i, 7.9) * height;
        const rad = 10 + pseudoNoise(i, 4.1) * 28;
        ctx.fillStyle =
          i % 3 === 0
            ? 'rgba(48, 102, 58, 0.16)'
            : i % 3 === 1
              ? 'rgba(132, 118, 76, 0.12)'
              : 'rgba(28, 66, 36, 0.16)';
        ctx.beginPath();
        ctx.arc(nx, ny, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // 4. Subtle Semi-Transparent Cloud Layer Texture
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 1024;
  cloudCanvas.height = 512;
  const cCtx = cloudCanvas.getContext('2d');
  if (cCtx) {
    cCtx.clearRect(0, 0, 1024, 512);
    for (let i = 0; i < 240; i++) {
      const cx = pseudoNoise(i, 2.7) * 1024;
      const cy = 48 + pseudoNoise(i, 9.4) * 416;
      const rx = 28 + pseudoNoise(i, 5.2) * 85;
      const ry = 8 + pseudoNoise(i, 3.6) * 22;
      const angle = (pseudoNoise(i, 8.1) - 0.5) * 0.5;
      const alpha = 0.06 + pseudoNoise(i, 6.4) * 0.18;

      const grad = cCtx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
      grad.addColorStop(0.55, `rgba(241, 245, 249, ${(alpha * 0.55).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
      cCtx.fill();
    }

    // Monsoon cloud band drifting across Bay of Bengal / NE India (showing why L-band radar is needed!)
    const monsoonCenters: Array<[number, number, number]> = [
      [780, 185, 65],
      [755, 195, 55],
      [805, 175, 52],
    ];
    monsoonCenters.forEach(([mx, my, mr]) => {
      const mg = cCtx.createRadialGradient(mx, my, 4, mx, my, mr);
      mg.addColorStop(0, 'rgba(255, 255, 255, 0.36)');
      mg.addColorStop(0.6, 'rgba(240, 248, 255, 0.16)');
      mg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cCtx.fillStyle = mg;
      cCtx.beginPath();
      cCtx.arc(mx, my, mr, 0, Math.PI * 2);
      cCtx.fill();
    });
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);

  const cloudMap = new THREE.CanvasTexture(cloudCanvas);
  cloudMap.colorSpace = THREE.SRGBColorSpace;

  return { colorMap, roughnessMap, cloudMap };
}

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

export function EarthGlobeCanvas({
  activeRegionId,
  onSelectRegionTransition,
  isTransitioning,
}: EarthGlobeCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionId | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const flyTriggerRef = useRef<((id: RegionId) => void) | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const onSelectRef = useRef(onSelectRegionTransition);
  const activeRegionRef = useRef(activeRegionId);

  useEffect(() => {
    onSelectRef.current = onSelectRegionTransition;
  }, [onSelectRegionTransition]);

  useEffect(() => {
    activeRegionRef.current = activeRegionId;
  }, [activeRegionId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(300, container.clientWidth || 720);
    const height = Math.max(360, container.clientHeight || 500);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('3D globe unavailable; choose a region card below to open the 2D radar map.');
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL(renderer);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute(
      'aria-label',
      'Photorealistic 3D Satellite Earth highlighting Maharashtra, Northeast India, and Japan'
    );

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
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
    controls.minDistance = 2.55;
    controls.maxDistance = 6.8;
    controls.autoRotate = false;

    // Sunlight + Soft Orbital Fill
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 1.05);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.35);
    sunLight.position.set(5.5, 3.2, 5.5);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-5.0, -1.5, -5.0);
    scene.add(rimLight);

    // Subtle deep-space starfield points
    const starPositions = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) {
      const r = 14 + (i % 7) * 2.1;
      const theta = i * 2.39996;
      const phi = Math.acos(1 - 2 * ((i + 0.5) / 260));
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 0.045,
      transparent: true,
      opacity: 0.55,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Earth & Clouds & Atmospheric Limb Glow
    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const { colorMap, roughnessMap, cloudMap } = createSatelliteEarthTextures();
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: colorMap,
      roughnessMap,
      roughness: 0.65,
      metalness: 0.06,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Try upgrading with NASA / Three.js live Blue Marble texture when online, without ever breaking offline render
    const texLoader = new THREE.TextureLoader();
    texLoader.setCrossOrigin('anonymous');
    let remoteMap: THREE.Texture | null = null;
    texLoader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
      (loaded) => {
        if (isDisposed) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.anisotropy = 4;
        remoteMap = loaded;
        earthMat.map = loaded;
        earthMat.needsUpdate = true;
        renderFrame();
      },
      undefined,
      () => {
        // Keep seamless procedural Blue Marble texture silently
      }
    );

    // Subtle Drifting Satellite Cloud Layer
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.014, 48, 36);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 0.95,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(cloudMesh);

    // Realistic Atmospheric Fresnel Limb Glow
    const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.068, 48, 36);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
          gl_FragColor = vec4(0.24, 0.64, 1.0, 0.85) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    earthGroup.add(atmoMesh);

    // Sun-Synchronous NISAR Orbital Ring + Spacecraft + Radar Scan Cone
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.z = THREE.MathUtils.degToRad(97.4);
    orbitGroup.rotation.y = THREE.MathUtils.degToRad(22);
    scene.add(orbitGroup);

    const orbitRadius = EARTH_RADIUS * 1.24;
    const orbitRingGeo = new THREE.TorusGeometry(orbitRadius, 0.006, 8, 96);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
    });
    const orbitRingMesh = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRingMesh.rotation.x = Math.PI / 2;
    orbitGroup.add(orbitRingMesh);

    const satelliteGroup = new THREE.Group();
    const satBusGeo = new THREE.BoxGeometry(0.055, 0.055, 0.075);
    const satBusMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.25 });
    const satBus = new THREE.Mesh(satBusGeo, satBusMat);
    satelliteGroup.add(satBus);

    const dishGeo = new THREE.CylinderGeometry(0.068, 0.012, 0.025, 16);
    const dishMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x0066ff,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    const dish = new THREE.Mesh(dishGeo, dishMat);
    dish.position.set(0, -0.05, 0);
    satelliteGroup.add(dish);

    const wingGeo = new THREE.BoxGeometry(0.24, 0.008, 0.045);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.55, roughness: 0.2 });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    satelliteGroup.add(wing);

    const beamGeo = new THREE.ConeGeometry(0.11, 0.34, 16, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(beamGeo, beamMat);
    beamCone.rotation.x = Math.PI / 2;
    beamCone.position.set(0, 0, 0.21);
    satelliteGroup.add(beamCone);

    orbitGroup.add(satelliteGroup);

    // 3 Glowing Orbital Satellite Scan Rings over Maharashtra, Northeast India & Japan
    const clickableTargets: THREE.Mesh[] = [];
    const beaconVisuals: Array<{
      regionId: RegionId;
      group: THREE.Group;
      pulseRing: THREE.Mesh;
      outerRing: THREE.Mesh;
      coreMesh: THREE.Mesh;
      stemMat: THREE.MeshBasicMaterial;
    }> = [];

    const stemGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8);
    const coreGeo = new THREE.SphereGeometry(0.052, 16, 16);
    const innerRingGeo = new THREE.RingGeometry(0.065, 0.095, 32);
    const outerRingGeo = new THREE.RingGeometry(0.135, 0.155, 36);
    const hitGeo = new THREE.SphereGeometry(0.24, 12, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    (Object.keys(REGION_DATASETS) as RegionId[]).forEach((regionId) => {
      const region = REGION_DATASETS[regionId];
      const pt = latLonToCartesian(region.center[0], region.center[1], EARTH_RADIUS);
      const normal = new THREE.Vector3(pt.x, pt.y, pt.z).normalize();

      const group = new THREE.Group();
      group.position.copy(normal.clone().multiplyScalar(EARTH_RADIUS * 1.005));
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      const isActive = regionId === activeRegionId;
      const accentHex = regionId === 'japan_gunw' ? 0xf97316 : 0x00f0ff;

      const stemMat = new THREE.MeshBasicMaterial({ color: accentHex });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.1;
      group.add(stem);

      const coreMat = new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: isActive ? 1.2 : 0.75,
        roughness: 0.2,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.y = 0.21;
      group.add(coreMesh);

      const pulseMat = new THREE.MeshBasicMaterial({
        color: accentHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const pulseRing = new THREE.Mesh(innerRingGeo, pulseMat);
      pulseRing.rotation.x = -Math.PI / 2;
      pulseRing.position.y = 0.015;
      group.add(pulseRing);

      const outerMat = new THREE.MeshBasicMaterial({
        color: accentHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      const outerRing = new THREE.Mesh(outerRingGeo, outerMat);
      outerRing.rotation.x = -Math.PI / 2;
      outerRing.position.y = 0.018;
      group.add(outerRing);

      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.y = 0.11;
      hitMesh.userData.regionId = regionId;
      group.add(hitMesh);
      clickableTargets.push(hitMesh);

      earthGroup.add(group);
      beaconVisuals.push({
        regionId,
        group,
        pulseRing,
        outerRing,
        coreMesh,
        stemMat,
      });
    });

    // Raycasting & Smooth Fly-To Animation State
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let isDisposed = false;
    let rafId = 0;
    let timerId = 0;
    let satAngle = 0.9;
    let hoverRegionLocal: RegionId | null = null;
    let flyState: {
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      startTime: number;
      durationMs: number;
      targetRegion: RegionId | null;
      triggerTransition: boolean;
    } | null = null;

    const triggerFlyTo = (regionId: RegionId, triggerTransition: boolean) => {
      const region = REGION_DATASETS[regionId];
      const targetCam = computeCameraPositionForLatLon(
        region.center[0],
        region.center[1],
        triggerTransition ? 2.55 : DEFAULT_CAMERA_DIST
      );
      flyState = {
        startPos: camera.position.clone(),
        endPos: new THREE.Vector3(targetCam.x, targetCam.y, targetCam.z),
        startTime: performance.now(),
        durationMs: isSoftwareGl ? 360 : 620,
        targetRegion: regionId,
        triggerTransition,
      };
      scheduleNextTick();
    };

    flyTriggerRef.current = (id: RegionId) => triggerFlyTo(id, true);
    resetViewRef.current = () => {
      const camPt = computeCameraPositionForLatLon(
        DEFAULT_CAMERA_LAT,
        DEFAULT_CAMERA_LON,
        DEFAULT_CAMERA_DIST
      );
      flyState = {
        startPos: camera.position.clone(),
        endPos: new THREE.Vector3(camPt.x, camPt.y, camPt.z),
        startTime: performance.now(),
        durationMs: 480,
        targetRegion: null,
        triggerTransition: false,
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
      const w = Math.max(300, container.clientWidth);
      const h = Math.max(360, container.clientHeight);
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

      // Gentle cloud drift & satellite orbit
      cloudMesh.rotation.y += isSoftwareGl ? 0.0009 : 0.00025;
      satAngle += isSoftwareGl ? 0.015 : 0.004;
      satelliteGroup.position.set(
        Math.cos(satAngle) * orbitRadius,
        0,
        Math.sin(satAngle) * orbitRadius
      );
      satelliteGroup.lookAt(0, 0, 0);

      // Pulse glowing orbital scan rings
      beaconVisuals.forEach((b, idx) => {
        const isHot = b.regionId === hoverRegionLocal || b.regionId === activeRegionRef.current;
        const wave = (now * 0.0018 + idx * 0.35) % 1;
        const scale = isHot ? 1.15 + wave * 1.05 : 0.95 + wave * 0.7;
        b.pulseRing.scale.set(scale, scale, 1);
        const pMat = b.pulseRing.material as THREE.MeshBasicMaterial;
        pMat.opacity = (1 - wave) * (isHot ? 0.95 : 0.7);
        const oMat = b.outerRing.material as THREE.MeshBasicMaterial;
        oMat.opacity = isHot ? 0.85 : 0.48;
        const cMat = b.coreMesh.material as THREE.MeshStandardMaterial;
        cMat.emissiveIntensity = isHot ? 1.4 : 0.85;
      });

      // Smooth camera fly-to
      if (flyState) {
        const elapsed = now - flyState.startTime;
        const rawT = Math.min(1, elapsed / flyState.durationMs);
        const eased = 1 - Math.pow(1 - rawT, 3);

        const startDir = flyState.startPos.clone().normalize();
        const endDir = flyState.endPos.clone().normalize();
        const interpDir = startDir.lerp(endDir, eased).normalize();
        const startDist = flyState.startPos.length();
        const endDist = flyState.endPos.length();
        const interpDist = THREE.MathUtils.lerp(startDist, endDist, eased);

        camera.position.copy(interpDir.multiplyScalar(interpDist));
        camera.lookAt(0, 0, 0);

        if (rawT >= 1) {
          const completed = flyState;
          flyState = null;
          if (completed.triggerTransition && completed.targetRegion) {
            onSelectRef.current(completed.targetRegion);
          }
        }
      } else {
        controls.update();
      }

      renderer.render(scene, camera);
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

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const tick = () => {
      if (isDisposed) return;
      renderFrame();
      if (!prefersReducedMotion || flyState) {
        if (isSoftwareGl) {
          timerId = window.setTimeout(() => afterDraw(tick), flyState ? 16 : 60);
        } else {
          rafId = window.requestAnimationFrame(tick);
        }
      }
    };

    const scheduleNextTick = () => {
      if (prefersReducedMotion && !flyState) {
        renderFrame();
      } else if (!rafId && !timerId) {
        tick();
      }
    };

    renderFrame();
    if (!prefersReducedMotion) {
      tick();
    }

    const handleControlChange = () => {
      if (prefersReducedMotion) {
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
      roughnessMap.dispose();
      if (remoteMap) remoteMap.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      cloudMap.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      orbitRingGeo.dispose();
      orbitRingMat.dispose();
      satBusGeo.dispose();
      satBusMat.dispose();
      dishGeo.dispose();
      dishMat.dispose();
      wingGeo.dispose();
      wingMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      stemGeo.dispose();
      coreGeo.dispose();
      innerRingGeo.dispose();
      outerRingGeo.dispose();
      hitGeo.dispose();
      hitMat.dispose();
      beaconVisuals.forEach((b) => {
        b.stemMat.dispose();
        (b.coreMesh.material as THREE.Material).dispose();
        (b.pulseRing.material as THREE.Material).dispose();
        (b.outerRing.material as THREE.Material).dispose();
      });

      renderer.dispose();
    };
  }, []);

  const activeHoverMeta = hoveredRegion ? REGION_DATASETS[hoveredRegion] : null;

  return (
    <div className="relative border border-[var(--rr-border)] bg-[#000000]">
      {/* Subtle Top Viewport Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rr-border)] bg-[#060911] px-4 py-2.5 text-[#FAFAFA]">
        <div className="flex items-center gap-2">
          <Compass className="h-3.5 w-3.5 text-[#38BDF8]" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
            3D Satellite Earth · Drag to Spin · Click a Glowing Ring
          </span>
        </div>
        <button
          type="button"
          onClick={() => resetViewRef.current?.()}
          aria-label="Reset 3D Earth camera view"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#A1A1AA] hover:text-[#38BDF8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          <span>Reset View</span>
        </button>
      </div>

      {/* Full-Bleed 3D Satellite Earth Viewport */}
      <div
        className="relative h-[390px] sm:h-[470px] lg:h-[520px] w-full overflow-hidden"
        style={{
          background:
            'radial-gradient(circle at 52% 48%, #0B192E 0%, #030710 68%, #000000 100%)',
        }}
      >
        {webglError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-[#FAFAFA] font-mono">
            {webglError}
          </div>
        ) : (
          <div
            ref={mountRef}
            data-testid="earth-globe-canvas"
            className="h-full w-full"
          />
        )}

        {/* Solid Corner Status Badges */}
        <div className="pointer-events-none absolute top-3 left-3 bg-black/90 px-2.5 py-1 border border-[#26262A] font-mono text-[10px] uppercase tracking-[0.16em] text-[#E4E4E7]">
          {activeHoverMeta
            ? `${activeHoverMeta.shortName} · Click to Open 2D Map`
            : isTransitioning
              ? 'Opening 2D Map...'
              : 'Satellite Earth · Cloud-Piercing Radar'}
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 bg-black/90 px-2.5 py-1 border border-[#26262A] font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#38BDF8]">
          3 Places Active
        </div>
      </div>

      {/* Hidden quick-trigger hooks so automated & keyboard focus still reaches pins directly */}
      <div className="sr-only">
        {(Object.keys(REGION_DATASETS) as RegionId[]).map((id) => (
          <button
            key={id}
            type="button"
            data-testid={`globe-pin-${id}`}
            onClick={() => flyTriggerRef.current?.(id)}
          >
            Focus {REGION_DATASETS[id].shortName}
          </button>
        ))}
      </div>
    </div>
  );
}
