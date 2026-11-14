import * as THREE from 'three';

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

export function createSatelliteEarthTextures(
  maxAniso: number,
  isSoftwareGl: boolean
): {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
} {
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
    // 1. Matte deep ocean base (monsoon blue / deep slate ocean tones)
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0, '#0C2233');
    oceanGrad.addColorStop(0.24, '#0D2A42');
    oceanGrad.addColorStop(0.5, '#123A58');
    oceanGrad.addColorStop(0.76, '#0D2A42');
    oceanGrad.addColorStop(1, '#0C2233');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle deep-sea ocean ridges & trenches
    for (let i = 0; i < 280; i++) {
      const rx = (i * 397) % width;
      const ry = (i * 223) % height;
      const rad = 70 + (i % 7) * 45;
      const g = ctx.createRadialGradient(rx, ry, 4, rx, ry, rad);
      g.addColorStop(0, 'rgba(29, 111, 163, 0.14)');
      g.addColorStop(1, 'rgba(12, 34, 51, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(rx, ry, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Realistic matte ocean & continent roughness (no plastic ball highlight)
    const auxW = bumpCanvas.width;
    const auxH = bumpCanvas.height;
    bCtx.fillStyle = '#181818';
    bCtx.fillRect(0, 0, auxW, auxH);

    rCtx.fillStyle = '#D8D8D8';
    rCtx.fillRect(0, 0, auxW, auxH);

    // 2. Shallow coastal shelves along coastlines
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
      ctx.strokeStyle = 'rgba(42, 132, 166, 0.30)';
      ctx.lineWidth = isSoftwareGl ? 14 : 28;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(72, 164, 192, 0.18)';
      ctx.lineWidth = isSoftwareGl ? 5 : 10;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Draw true-color continents, relief shadows, river corridors & arid basins
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
        ctx.fillStyle = '#DCE3E8';
      } else if (poly.biome === 'forest') {
        ctx.fillStyle = '#2F563C';
      } else if (poly.biome === 'desert') {
        ctx.fillStyle = '#927D5B';
      } else {
        ctx.fillStyle = '#385C42';
      }
      ctx.fill();

      bCtx.fillStyle = poly.biome === 'ice' ? '#929292' : '#5C5C5C';
      bCtx.fill();

      rCtx.fillStyle = '#F7F7F7';
      rCtx.fill();

      ctx.save();
      ctx.clip();

      // Equatorial monsoon vegetation belt
      const [eqLeft, eqTop] = toPx(-180, 26);
      const [, eqBot] = toPx(180, -24);
      const tropGrad = ctx.createLinearGradient(0, eqTop, 0, eqBot);
      tropGrad.addColorStop(0, 'rgba(42, 86, 56, 0)');
      tropGrad.addColorStop(0.5, 'rgba(32, 78, 48, 0.54)');
      tropGrad.addColorStop(1, 'rgba(42, 86, 56, 0)');
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
        mg.addColorStop(0, 'rgba(222, 228, 232, 0.80)');
        mg.addColorStop(0.48, 'rgba(138, 128, 118, 0.60)');
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
      boreGrad.addColorStop(0, 'rgba(216, 226, 232, 0.72)');
      boreGrad.addColorStop(0.55, 'rgba(68, 92, 68, 0.45)');
      boreGrad.addColorStop(1, 'rgba(42, 74, 52, 0)');
      ctx.fillStyle = boreGrad;
      ctx.fillRect(0, 0, width, northBottom);

      // Fine terrain mottling
      for (let i = 0; i < 1100; i++) {
        const nx = pseudoNoise(i, 1.3) * width;
        const ny = pseudoNoise(i, 7.9) * height;
        const rad = 16 + pseudoNoise(i, 4.1) * 44;
        ctx.fillStyle =
          i % 3 === 0
            ? 'rgba(47, 107, 79, 0.16)'
            : i % 3 === 1
              ? 'rgba(128, 114, 72, 0.12)'
              : 'rgba(28, 62, 42, 0.16)';
        ctx.beginPath();
        ctx.arc(nx, ny, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // Subtle major river corridors
      ctx.strokeStyle = 'rgba(29, 111, 163, 0.45)';
      ctx.lineWidth = 3.2;
      const rivers: Array<Array<[number, number]>> = [
        [[95.5, 28.0], [93.2, 26.7], [90.6, 26.1], [89.8, 24.1], [90.8, 22.4]],
        [[78.2, 30.0], [82.0, 26.2], [86.0, 25.4], [88.5, 24.0], [90.2, 22.3]],
        [[79.4, 21.6], [79.6, 20.8], [79.9, 19.6], [81.6, 16.8]],
        [[32.5, 15.6], [32.8, 24.0], [31.2, 30.1]],
        [[-73.2, -3.7], [-60.0, -3.1], [-49.5, -0.5]],
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

      // Subtle warm laterite-sand settlement clusters
      const urbanClusters: Array<[number, number]> = [
        [72.8, 19.1], [79.1, 21.1], [77.2, 28.6], [88.3, 22.5], [91.7, 26.1],
        [139.7, 35.6], [135.5, 34.7], [136.6, 36.6], [121.5, 31.2], [116.4, 39.9],
        [-74.0, 40.7], [2.3, 48.8], [-0.1, 51.5], [103.8, 1.3],
      ];
      urbanClusters.forEach(([ulon, ulat]) => {
        const [ux, uy] = toPx(ulon, ulat);
        const ug = ctx.createRadialGradient(ux, uy, 1, ux, uy, 16);
        ug.addColorStop(0, 'rgba(184, 132, 82, 0.30)');
        ug.addColorStop(1, 'rgba(184, 132, 82, 0)');
        ctx.fillStyle = ug;
        ctx.beginPath();
        ctx.arc(ux, uy, 16, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    }
  }

  // 4. Soft monsoon cloud layer
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
      grad.addColorStop(0, `rgba(235, 238, 234, ${alpha.toFixed(2)})`);
      grad.addColorStop(0.55, `rgba(226, 230, 224, ${(alpha * 0.5).toFixed(2)})`);
      grad.addColorStop(1, 'rgba(245, 246, 242, 0)');
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
      mg.addColorStop(0, 'rgba(245, 246, 242, 0.34)');
      mg.addColorStop(0.6, 'rgba(232, 235, 230, 0.15)');
      mg.addColorStop(1, 'rgba(245, 246, 242, 0)');
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
