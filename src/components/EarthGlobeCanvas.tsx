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
  {
    biome: 'forest',
    coords: [
      [44, -25], [47, -25], [50, -15], [48, -13], [44, -18],
    ],
  },
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
  {
    biome: 'forest',
    coords: [
      [80, 9.6], [81.8, 7.8], [81.2, 6.0], [79.8, 6.9],
    ],
  },
  // UK & Ireland
  {
    biome: 'temperate',
    coords: [
      [-6, 50], [1, 51], [-2, 58], [-6, 57], [-8, 53],
    ],
  },
  // Japan Archipelago (Kyushu, Honshu, Hokkaido)
  {
    biome: 'forest',
    coords: [
      [130, 31.2], [131.6, 32], [131.2, 34], [129.6, 33.4],
    ],
  },
  {
    biome: 'forest',
    coords: [
      [132, 34], [135, 34.4], [137, 36.8], [139.8, 35.2], [141, 38],
      [141.4, 41.3], [140, 41.2], [138.8, 37.8], [136.5, 36.8], [134, 35.6], [131, 34.2],
    ],
  },
  {
    biome: 'temperate',
    coords: [
      [140.2, 41.6], [142, 42.2], [145.5, 43.4], [144, 44.5], [141.6, 45.4], [140.2, 43.2],
    ],
  },
  // Maritime SE Asia
  {
    biome: 'forest',
    coords: [
      [95.3, 5.5], [105.8, -5.9], [104.2, -6.1], [98, 2.5],
    ],
  },
  {
    biome: 'forest',
    coords: [
      [105.5, -6.2], [114.4, -8.3], [114.2, -7.2], [106, -5.8],
    ],
  },
  {
    biome: 'forest',
    coords: [
      [109, 1.5], [117.5, 6.5], [118.8, 1.0], [115, -3.5], [110, -2.5],
    ],
  },
  {
    biome: 'forest',
    coords: [
      [120, 18.4], [122.4, 14.2], [126.2, 7.2], [122, 6.8], [119.8, 13.5],
    ],
  },
  // Australia & New Zealand
  {
    biome: 'desert',
    coords: [
      [114, -22], [122, -17], [130, -12], [136, -12], [142, -11], [146, -18],
      [153, -27], [151, -34], [147, -38], [139, -36], [131, -32], [122, -34],
      [115, -34], [113, -27],
    ],
  },
  {
    biome: 'temperate',
    coords: [
      [167, -46], [173, -41], [178, -37], [174, -35], [171, -41], [166, -45],
    ],
  },
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
  return (s1 - Math.floor(s1)) * 0.6 + (s2 - Math.floor(s2)) * 0.4;
}

function createSatelliteEarthTextures(
  maxAniso: number,
  isSoftwareGl: boolean
): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
} {
  // 4096x2048 Google-Earth-grade procedural Blue Marble on GPU; 2048x1024 on software WebGL
  const width = isSoftwareGl ? 2048 : 4096;
  const height = isSoftwareGl ? 1024 : 2048;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = width;
  colorCanvas.height = height;
  const ctx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = isSoftwareGl ? 1024 : 2048;
  bumpCanvas.height = isSoftwareGl ? 512 : 1024;
  const bCtx = bumpCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = isSoftwareGl ? 1024 : 2048;
  roughCanvas.height = isSoftwareGl ? 512 : 1024;
  const rCtx = roughCanvas.getContext('2d');

  const toPx = (lon: number, lat: number, w = width, h = height): [number, number] => [
    ((lon + 180) / 360) * w,
    ((90 - lat) / 180) * h,
  ];

  if (ctx && bCtx && rCtx) {
    // 1. Deep oceanic bathymetry gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#091A2E');
    oceanGrad.addColorStop(0.24, '#071D38');
    oceanGrad.addColorStop(0.5, '#0B3057');
    oceanGrad.addColorStop(0.76, '#071D38');
    oceanGrad.addColorStop(1, '#091A2E');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle deep-sea ocean ridges & trenches
    for (let i = 0; i < 280; i++) {
      const rx = (i * 397) % width;
      const ry = (i * 223) % height;
      const rad = 70 + (i % 7) * 45;
      const g = ctx.createRadialGradient(rx, ry, 4, rx, ry, rad);
      g.addColorStop(0, 'rgba(22, 92, 148, 0.14)');
      g.addColorStop(1, 'rgba(7, 29, 56, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Realistic matte ocean & continent roughness (eliminates shiny plastic ball highlight)
    const auxW = bumpCanvas.width;
    const auxH = bumpCanvas.height;
    bCtx.fillStyle = '#181818';
    bCtx.fillRect(0, 0, auxW, auxH);

    rCtx.fillStyle = '#C8C8C8';
    rCtx.fillRect(0, 0, auxW, auxH);

    // 2. Shallow turquoise continental shelves along coastlines
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
      ctx.strokeStyle = 'rgba(34, 142, 180, 0.34)';
      ctx.lineWidth = isSoftwareGl ? 14 : 28;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(64, 184, 210, 0.22)';
      ctx.lineWidth = isSoftwareGl ? 5 : 10;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Draw true-color continents, relief shadows, river deltas & urban clusters
    for (const poly of LANDMASS_POLYGONS) {
      if (poly.coords.length < 3) continue;

      ctx.beginPath();
      poly.coords.forEach(([lon, lat], idx) => {
        const [px, py] = toPx(lon, lat);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();

      bCtx.beginPath();
      rCtx.beginPath();
      poly.coords.forEach(([lon, lat], idx) => {
        const [px, py] = toPx(lon, lat, auxW, auxH);
        if (idx === 0) {
          bCtx.moveTo(px, py);
          rCtx.moveTo(px, py);
        } else {
          bCtx.lineTo(px, py);
          rCtx.lineTo(px, py);
        }
      });
      bCtx.closePath();
      rCtx.closePath();

      if (poly.biome === 'ice') {
        ctx.fillStyle = '#DCE5EE';
      } else if (poly.biome === 'forest') {
        ctx.fillStyle = '#2A5035';
      } else if (poly.biome === 'desert') {
        ctx.fillStyle = '#917C58';
      } else {
        ctx.fillStyle = '#345A3B';
      }
      ctx.fill();

      bCtx.fillStyle = poly.biome === 'ice' ? '#929292' : '#5C5C5C';
      bCtx.fill();

      rCtx.fillStyle = '#F5F5F5';
      rCtx.fill();

      ctx.save();
      ctx.clip();

      // Equatorial monsoon belt
      const [eqLeft, eqTop] = toPx(-180, 26);
      const [, eqBot] = toPx(180, -24);
      const tropGrad = ctx.createLinearGradient(0, eqTop, 0, eqBot);
      tropGrad.addColorStop(0, 'rgba(38, 82, 48, 0)');
      tropGrad.addColorStop(0.5, 'rgba(26, 76, 38, 0.56)');
      tropGrad.addColorStop(1, 'rgba(38, 82, 48, 0)');
      ctx.fillStyle = tropGrad;
      ctx.fillRect(eqLeft, eqTop, width, eqBot - eqTop);

      // Arid belts
      const aridRegions = [
        { lon: 14, lat: 22, rx: 380, ry: 170, color: 'rgba(178, 142, 92, 0.78)' },
        { lon: 46, lat: 24, rx: 180, ry: 110, color: 'rgba(182, 146, 98, 0.75)' },
        { lon: 68, lat: 27, rx: 145, ry: 90, color: 'rgba(160, 134, 84, 0.64)' },
        { lon: 98, lat: 41, rx: 280, ry: 120, color: 'rgba(150, 130, 90, 0.66)' },
        { lon: 133, lat: -24, rx: 220, ry: 130, color: 'rgba(172, 114, 70, 0.72)' },
        { lon: -108, lat: 36, rx: 150, ry: 110, color: 'rgba(154, 128, 90, 0.55)' },
      ];
      aridRegions.forEach((zone) => {
        const [zx, zy] = toPx(zone.lon, zone.lat);
        const g = ctx.createRadialGradient(zx, zy, 16, zx, zy, zone.rx);
        g.addColorStop(0, zone.color);
        g.addColorStop(1, 'rgba(150, 125, 85, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(zx, zy, zone.rx, zone.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      // Himalayan & Andean/Rocky Mountain relief + bump shading
      const mountainRidges: Array<{ lon: number; lat: number; rx: number; ry: number; rot: number }> = [
        { lon: 86, lat: 33, rx: 260, ry: 105, rot: -0.15 },
        { lon: -114, lat: 46, rx: 130, ry: 220, rot: -0.22 },
        { lon: -69, lat: -22, rx: 75, ry: 260, rot: 0.08 },
        { lon: 138, lat: 36.2, rx: 58, ry: 32, rot: 0.4 },
      ];
      mountainRidges.forEach((m) => {
        const [mx, my] = toPx(m.lon, m.lat);
        const mg = ctx.createRadialGradient(mx, my, 12, mx, my, m.rx);
        mg.addColorStop(0, 'rgba(222, 228, 236, 0.82)');
        mg.addColorStop(0.48, 'rgba(138, 128, 118, 0.62)');
        mg.addColorStop(1, 'rgba(72, 78, 64, 0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.ellipse(mx, my, m.rx, m.ry, m.rot, 0, Math.PI * 2);
        ctx.fill();

        const [bmx, bmy] = toPx(m.lon, m.lat, bumpCanvas.width, bumpCanvas.height);
        const bmg = bCtx.createRadialGradient(bmx, bmy, 4, bmx, bmy, m.rx * 0.5);
        bmg.addColorStop(0, 'rgba(245, 245, 245, 0.92)');
        bmg.addColorStop(1, 'rgba(100, 100, 100, 0)');
        bCtx.fillStyle = bmg;
        bCtx.beginPath();
        bCtx.ellipse(bmx, bmy, m.rx * 0.5, m.ry * 0.5, m.rot, 0, Math.PI * 2);
        bCtx.fill();
      });

      // Northern Tundra & Boreal Forest tint
      const [, northBottom] = toPx(0, 55);
      const boreGrad = ctx.createLinearGradient(0, 0, 0, northBottom);
      boreGrad.addColorStop(0, 'rgba(216, 226, 236, 0.72)');
      boreGrad.addColorStop(0.55, 'rgba(68, 92, 64, 0.45)');
      boreGrad.addColorStop(1, 'rgba(42, 74, 48, 0)');
      ctx.fillStyle = boreGrad;
      ctx.fillRect(0, 0, width, northBottom);

      // Fine terrain mottling (basins, valleys, vegetation density)
      for (let i = 0; i < 1100; i++) {
        const nx = pseudoNoise(i, 1.3) * width;
        const ny = pseudoNoise(i, 7.9) * height;
        const rad = 16 + pseudoNoise(i, 4.1) * 44;
        ctx.fillStyle =
          i % 3 === 0
            ? 'rgba(42, 94, 52, 0.16)'
            : i % 3 === 1
              ? 'rgba(128, 114, 72, 0.12)'
              : 'rgba(24, 58, 32, 0.16)';
        ctx.beginPath();
        ctx.arc(nx, ny, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle major river corridors (Brahmaputra, Ganga, Wainganga, Nile, Amazon)
      ctx.strokeStyle = 'rgba(22, 86, 126, 0.45)';
      ctx.lineWidth = 3.2;
      const rivers: Array<Array<[number, number]>> = [
        [[95.5, 28.0], [93.2, 26.7], [90.6, 26.1], [89.8, 24.1], [90.8, 22.4]], // Brahmaputra
        [[78.2, 30.0], [82.0, 26.2], [86.0, 25.4], [88.5, 24.0], [90.2, 22.3]], // Ganga
        [[79.4, 21.6], [79.6, 20.8], [79.9, 19.6], [81.6, 16.8]], // Wainganga-Godavari
        [[32.5, 15.6], [32.8, 24.0], [31.2, 30.1]], // Nile
        [[-73.2, -3.7], [-60.0, -3.1], [-49.5, -0.5]], // Amazon
      ];
      rivers.forEach((rv) => {
        ctx.beginPath();
        rv.forEach(([rlon, rlat], idx) => {
          const [rx, ry] = toPx(rlon, rlat);
          if (idx === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        });
        ctx.stroke();
      });

      // Subtle warm golden urban clusters along key corridors
      const urbanClusters: Array<[number, number]> = [
        [72.8, 19.1], [79.1, 21.1], [77.2, 28.6], [88.3, 22.5], [91.7, 26.1],
        [139.7, 35.6], [135.5, 34.7], [136.6, 36.6], [121.5, 31.2], [116.4, 39.9],
        [-74.0, 40.7], [2.3, 48.8], [-0.1, 51.5], [103.8, 1.3],
      ];
      urbanClusters.forEach(([ulon, ulat]) => {
        const [ux, uy] = toPx(ulon, ulat);
        const ug = ctx.createRadialGradient(ux, uy, 1, ux, uy, 18);
        ug.addColorStop(0, 'rgba(232, 168, 92, 0.35)');
        ug.addColorStop(1, 'rgba(232, 168, 92, 0)');
        ctx.fillStyle = ug;
        ctx.beginPath();
        ctx.arc(ux, uy, 18, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }
  }

  // 4. High-res semi-transparent cloud canopy with monsoon band over Bay of Bengal / NE India
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 2048;
  cloudCanvas.height = 1024;
  const cCtx = cloudCanvas.getContext('2d');
  if (cCtx) {
    cCtx.clearRect(0, 0, 2048, 1024);
    for (let i = 0; i < 320; i++) {
      const cx = pseudoNoise(i, 2.7) * 2048;
      const cy = 96 + pseudoNoise(i, 9.4) * 832;
      const rx = 44 + pseudoNoise(i, 5.2) * 140;
      const ry = 14 + pseudoNoise(i, 3.6) * 38;
      const angle = (pseudoNoise(i, 8.1) - 0.5) * 0.55;
      const alpha = 0.04 + pseudoNoise(i, 6.4) * 0.14;

      const grad = cCtx.createRadialGradient(cx, cy, 4, cx, cy, rx);
      grad.addColorStop(0, `rgba(237, 241, 245, ${alpha.toFixed(2)})`);
      grad.addColorStop(0.55, `rgba(226, 232, 240, ${(alpha * 0.5).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cCtx.fillStyle = grad;
      cCtx.beginPath();
      cCtx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
      cCtx.fill();
    }

    const monsoonCenters: Array<[number, number, number]> = [
      [1560, 370, 120],
      [1510, 390, 95],
      [1610, 350, 92],
    ];
    monsoonCenters.forEach(([mx, my, mr]) => {
      const mg = cCtx.createRadialGradient(mx, my, 8, mx, my, mr);
      mg.addColorStop(0, 'rgba(245, 248, 252, 0.34)');
      mg.addColorStop(0.6, 'rgba(230, 240, 250, 0.15)');
      mg.addColorStop(1, 'rgba(255, 255, 255, 0)');
      cCtx.fillStyle = mg;
      cCtx.beginPath();
      cCtx.arc(mx, my, mr, 0, Math.PI * 2);
      cCtx.fill();
    });
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = maxAniso;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = maxAniso;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.anisotropy = maxAniso;

  const cloudMap = new THREE.CanvasTexture(cloudCanvas);
  cloudMap.colorSpace = THREE.SRGBColorSpace;
  cloudMap.anisotropy = maxAniso;

  return { colorMap, bumpMap, roughnessMap, cloudMap };
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

interface HudBadgeMeta {
  regionId: RegionId;
  code: string;
  label: string;
  accentColor: string;
  fallbackMetric: string;
}

const HUD_BADGES: HudBadgeMeta[] = [
  {
    regionId: 'maharashtra_gcov',
    code: '01',
    label: 'MAHARASHTRA',
    accentColor: '#7BA1B5',
    fallbackMetric: '-21.4 dB HH',
  },
  {
    regionId: 'northeast_india_gcov',
    code: '02',
    label: 'NE INDIA',
    accentColor: '#4E9699',
    fallbackMetric: '-23.0 dB HH',
  },
  {
    regionId: 'japan_gunw',
    code: '03',
    label: 'JAPAN',
    accentColor: '#D49E96',
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

    // Realistic oblique sunlight & natural orbital earthshine (no studio IBL glare)
    const ambientLight = new THREE.AmbientLight(0xdce6f0, 0.52);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xe8f1f8, 0x263242, 0.34);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffdf7, 1.48);
    sunLight.position.set(6.8, 2.2, 4.2);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7da7bd, 0.42);
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
      color: 0xf2efe9,
      size: 0.036,
      transparent: true,
      opacity: 0.38,
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
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.0,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // Upgrade progressively with NASA Blue Marble / topology / water textures when reachable
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

    // Subtle drifting cloud deck
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.01, 56, 40);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudMap,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      roughness: 0.98,
      metalness: 0.0,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(cloudMesh);

    // Thin crisp Rayleigh atmospheric horizon (subtle natural airglow)
    const innerAtmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.036, 56, 40);
    const innerAtmoMat = new THREE.ShaderMaterial({
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
          float fresnel = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.2);
          gl_FragColor = vec4(0.36, 0.62, 0.84, 0.42) * fresnel;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    earthGroup.add(new THREE.Mesh(innerAtmoGeo, innerAtmoMat));

    const outerAtmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.072, 56, 40);
    const outerAtmoMat = new THREE.ShaderMaterial({
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
          float rim = pow(0.56 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.6);
          gl_FragColor = vec4(0.28, 0.52, 0.68, 0.24) * rim;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    earthGroup.add(new THREE.Mesh(outerAtmoGeo, outerAtmoMat));

    // Sun-Synchronous 97.4° Orbit + Realistic Multi-Part 3D NISAR Spacecraft
    const orbitGroup = new THREE.Group();
    orbitGroup.rotation.z = THREE.MathUtils.degToRad(97.4);
    orbitGroup.rotation.y = THREE.MathUtils.degToRad(24);
    scene.add(orbitGroup);

    const orbitRadius = EARTH_RADIUS * 1.24;
    const orbitRingGeo = new THREE.TorusGeometry(orbitRadius, 0.0035, 8, 128);
    const orbitRingMat = new THREE.MeshBasicMaterial({
      color: 0xe8913c,
      transparent: true,
      opacity: 0.28,
    });
    const orbitRingMesh = new THREE.Mesh(orbitRingGeo, orbitRingMat);
    orbitRingMesh.rotation.x = Math.PI / 2;
    orbitGroup.add(orbitRingMesh);

    const satelliteGroup = new THREE.Group();
    const goldFoilMat = new THREE.MeshStandardMaterial({
      color: 0xd9963b,
      metalness: 0.85,
      roughness: 0.24,
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0xc8cfd6,
      metalness: 0.78,
      roughness: 0.28,
    });
    const solarPanelMat = new THREE.MeshStandardMaterial({
      color: 0x163864,
      metalness: 0.62,
      roughness: 0.22,
    });
    const reflectorMeshMat = new THREE.MeshStandardMaterial({
      color: 0xe8a84a,
      emissive: 0x6b3a08,
      emissiveIntensity: 0.35,
      metalness: 0.72,
      roughness: 0.32,
      side: THREE.DoubleSide,
    });

    // Octagonal spacecraft bus
    const busGeo = new THREE.CylinderGeometry(0.032, 0.034, 0.068, 8);
    const satBus = new THREE.Mesh(busGeo, goldFoilMat);
    satelliteGroup.add(satBus);

    // Titanium truss boom connecting bus to 12m deployable reflector drum
    const boomGeo = new THREE.CylinderGeometry(0.005, 0.006, 0.125, 8);
    const boom = new THREE.Mesh(boomGeo, titaniumMat);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, -0.012, 0.065);
    satelliteGroup.add(boom);

    // 12m Golden Mesh Reflector Drum + Rim
    const drumRimGeo = new THREE.TorusGeometry(0.062, 0.0045, 10, 32);
    const drumRim = new THREE.Mesh(drumRimGeo, goldFoilMat);
    drumRim.position.set(0, -0.012, 0.13);
    satelliteGroup.add(drumRim);

    const drumDishGeo = new THREE.CircleGeometry(0.059, 28);
    const drumDish = new THREE.Mesh(drumDishGeo, reflectorMeshMat);
    drumDish.position.set(0, -0.012, 0.13);
    satelliteGroup.add(drumDish);

    // Dual Solar Array Wings
    const wingGeo = new THREE.BoxGeometry(0.115, 0.004, 0.042);
    const leftWing = new THREE.Mesh(wingGeo, solarPanelMat);
    leftWing.position.set(-0.085, 0.008, 0);
    satelliteGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, solarPanelMat);
    rightWing.position.set(0.085, 0.008, 0);
    satelliteGroup.add(rightWing);

    // Translucent L-band radar swath cone aimed toward Earth center (+Z when lookAt(0,0,0))
    const beamGeo = new THREE.ConeGeometry(0.13, 0.36, 20, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xe8913c,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(beamGeo, beamMat);
    beamCone.rotation.x = Math.PI / 2;
    beamCone.position.set(0, -0.012, 0.31);
    satelliteGroup.add(beamCone);

    orbitGroup.add(satelliteGroup);

    // Precision Flush Surface Target Rings (NO protruding sticks/spheres)
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

      const accentHex =
        regionId === 'northeast_india_gcov'
          ? 0x4e9699
          : regionId === 'japan_gunw'
            ? 0xd49e96
            : 0x7ba1b5;

      const coreMat = new THREE.MeshBasicMaterial({
        color: accentHex,
        side: THREE.DoubleSide,
      });
      const coreDot = new THREE.Mesh(dotGeo, coreMat);
      coreDot.rotation.x = -Math.PI / 2;
      coreDot.position.y = 0.004;
      group.add(coreDot);

      const pulseMat = new THREE.MeshBasicMaterial({
        color: accentHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      });
      const pulseRing = new THREE.Mesh(pulseRingGeo, pulseMat);
      pulseRing.rotation.x = -Math.PI / 2;
      pulseRing.position.y = 0.005;
      group.add(pulseRing);

      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xede7dc,
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
      innerAtmoGeo.dispose();
      innerAtmoMat.dispose();
      outerAtmoGeo.dispose();
      outerAtmoMat.dispose();
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
          ? 'relative h-full w-full overflow-hidden bg-[#0E131B]'
          : 'relative rounded-2xl border border-[var(--rr-border)] bg-[#0E131B] overflow-hidden'
      }
    >
      {/* Full-Bleed 3D Satellite Earth Viewport */}
      <div
        className={
          fullBleed
            ? 'relative h-full w-full overflow-hidden'
            : 'relative h-[420px] sm:h-[500px] lg:h-[560px] w-full overflow-hidden'
        }
        style={{
          background:
            'radial-gradient(circle at 50% 48%, #182230 0%, #0E131B 64%, #090C11 100%)',
        }}
      >
        {webglError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-[#F0EDE7] font-mono">
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
                className="group absolute left-0 top-0 -translate-x-1.5 -translate-y-1/2 flex items-center gap-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7BA1B5]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full border border-[#0E131B] shadow-sm transition-transform group-hover:scale-125"
                  style={{ backgroundColor: badge.accentColor }}
                />
                <span
                  className="h-px w-5 sm:w-7 transition-all group-hover:w-9"
                  style={{ backgroundColor: badge.accentColor }}
                />
                <span
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-left shadow-md backdrop-blur-md transition-colors ${
                    isActive
                      ? 'border-[#7BA1B5] bg-[#191C21]/92 text-[#F5F2ED]'
                      : 'border-[rgba(245,242,237,0.22)] bg-[#191C21]/82 text-[#F5F2ED] group-hover:border-[#7BA1B5]'
                  }`}
                >
                  <span className="text-[10px] font-semibold tracking-wide uppercase whitespace-nowrap">
                    {badge.code} · {badge.label}
                  </span>
                  <span
                    className="font-mono text-[10px] font-semibold tabular-nums whitespace-nowrap"
                    style={{ color: badge.accentColor }}
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
          <div className="rounded-full bg-[#191C21]/82 border border-[rgba(245,242,237,0.16)] px-3.5 py-1.5 text-[11px] font-medium text-[#E2DCD2] backdrop-blur-sm">
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
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#191C21]/85 border border-[rgba(245,242,237,0.2)] px-3 py-1.5 text-[11px] font-medium text-[#F5F2ED] hover:border-[#7BA1B5] hover:text-[#7BA1B5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7BA1B5]"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
}
