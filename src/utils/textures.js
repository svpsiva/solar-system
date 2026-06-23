// Planet texture system.
//
// Strategy (hybrid):
//  1. A procedural canvas texture is returned immediately (no wait).
//  2. The real 2K NASA/solarsystemscope.com texture is loaded in the background.
//  3. When it arrives, every THREE.Material that references the old texture has
//     its .map swapped and .needsUpdate set — seamless in-place upgrade.
//
// If the CDN is unreachable the procedural version stays and everything still works.

import * as THREE from 'three';
import { fbm } from './noise.js';

// ─── registry: maps textureUrl → { tex, subscribers[] } ──────────────────────
// subscribers are callbacks called with the new THREE.Texture when it loads.
const remoteRegistry = new Map();

// Call this after creating a planet mesh. Pass the planet's textureUrl and a
// callback that receives the loaded texture (use it to set material.map, etc.).
export function subscribeRemoteTexture(url, onLoad) {
  if (!url) return;
  if (!remoteRegistry.has(url)) {
    remoteRegistry.set(url, { tex: null, subscribers: [] });
    // kick off the load
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        const entry = remoteRegistry.get(url);
        entry.tex = tex;
        entry.subscribers.forEach((cb) => cb(tex));
        entry.subscribers = []; // free references
      },
      undefined,
      () => { /* silently ignore load errors — procedural stays */ }
    );
  }

  const entry = remoteRegistry.get(url);
  if (entry.tex) {
    // already loaded
    onLoad(entry.tex);
  } else {
    entry.subscribers.push(onLoad);
  }
}

// ─── procedural texture cache ─────────────────────────────────────────────────
const proceduralCache = new Map();

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2; // 2:1 equirectangular
  return canvas;
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function hexToRgb(hex) {
  return { r: (hex >> 16) & 255, g: (hex >> 8) & 255, b: hex & 255 };
}

function mix(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * k),
    g: Math.round(a.g + (b.g - a.g) * k),
    b: Math.round(a.b + (b.b - a.b) * k),
  };
}

function seedFromKey(key) {
  let s = 0;
  for (let i = 0; i < key.length; i++) s += key.charCodeAt(i) * (i + 1);
  return s;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── per-type procedural generators ──────────────────────────────────────────

function earthTexture(seed, size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const ocean     = hexToRgb(0x1e6fd0);
  const oceanDeep = hexToRgb(0x0c3d8a);
  const land      = hexToRgb(0x2f9e44);
  const landDry   = hexToRgb(0x9e8a3a);
  const desert    = hexToRgb(0xd4b060);
  const ice       = hexToRgb(0xeef4ff);

  for (let y = 0; y < h; y++) {
    const lat = Math.abs(y / h - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const n  = fbm((x / w) * 5, (y / h) * 5, { octaves: 7, seed });
      const n2 = fbm((x / w) * 9 + 3, (y / h) * 9 + 3, { octaves: 4, seed: seed + 7 });
      let c;
      if (n < 0.46) {
        c = mix(oceanDeep, ocean, n / 0.46);
      } else {
        const t = (n - 0.46) / 0.54;
        if (t < 0.25) c = mix(land, desert, t / 0.25);          // beach fringe
        else if (t < 0.7) c = mix(land, hexToRgb(0x3db854), n2); // green land
        else c = mix(hexToRgb(0x7a6a40), hexToRgb(0xaaaaaa), (t - 0.7) / 0.3); // mountains
      }
      if (lat > 0.82) c = mix(c, ice, smoothstep((lat - 0.82) / 0.18));
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Jupiter: distinct coloured bands + Great Red Spot oval.
function jupiterTexture(seed, size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);

  // Approximate Jupiter band colors from pole to equator
  const bandPalette = [
    hexToRgb(0xc8a87a), // polar — pale tan
    hexToRgb(0x8a5a2a), // dark brown
    hexToRgb(0xd8b48a), // light tan
    hexToRgb(0x9a6030), // medium brown
    hexToRgb(0xe8c89a), // cream equatorial zone
    hexToRgb(0xb87040), // SEB (south equatorial belt) — orange-brown
    hexToRgb(0xf0d8a0), // equatorial zone — brightest
    hexToRgb(0xa86030), // NEB
    hexToRgb(0xd8c088), // north temperate
    hexToRgb(0x7a4820), // dark north
    hexToRgb(0xc8a87a), // polar — pale tan
  ];

  for (let y = 0; y < h; y++) {
    const ny = y / h; // 0..1
    // base band index driven by latitude
    const bandF = ny * (bandPalette.length - 1);
    const b0 = Math.floor(bandF);
    const b1 = Math.min(b0 + 1, bandPalette.length - 1);
    const bt = bandF - b0;
    const bandColor = mix(bandPalette[b0], bandPalette[b1], smoothstep(bt));

    for (let x = 0; x < w; x++) {
      // wavy distortion on band edges
      const wave = fbm((x / w) * 5, ny * 14, { octaves: 4, seed, gain: 0.45 }) * 0.06;
      const bandFW = (ny + wave) * (bandPalette.length - 1);
      const bw0 = Math.floor(bandFW);
      const bw1 = Math.min(bw0 + 1, bandPalette.length - 1);
      const bwt = bandFW - bw0;
      let c = mix(bandPalette[Math.max(0, bw0)], bandPalette[bw1], smoothstep(bwt));
      // fine turbulence
      const turb = fbm((x / w) * 12, ny * 20, { octaves: 3, seed: seed + 5 }) * 0.18 - 0.09;
      c = mix(c, hexToRgb(0xfff0d8), 0.5 + turb);

      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Great Red Spot — oval in the SEB region (~38% down from top, 30% from left)
  const gx = w * 0.30;
  const gy = h * 0.62; // SEB latitude
  ctx.save();
  ctx.scale(1, 0.55); // squash vertically to oval
  const grs = ctx.createRadialGradient(gx, gy / 0.55, 0, gx, gy / 0.55, w * 0.07);
  grs.addColorStop(0,   'rgba(180, 60, 20, 0.85)');
  grs.addColorStop(0.5, 'rgba(160, 60, 30, 0.55)');
  grs.addColorStop(1,   'rgba(140, 70, 40, 0)');
  ctx.fillStyle = grs;
  ctx.fillRect(0, 0, w, h / 0.55);
  ctx.restore();

  return canvas;
}

// Saturn: similar banding but golden, no red spot.
function saturnTexture(seed, size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(0xf0dca0);
  const b = hexToRgb(0xc8a060);
  const dark = hexToRgb(0x9a7040);
  for (let y = 0; y < h; y++) {
    const ny = y / h;
    const band = Math.sin(ny * Math.PI * 16) * 0.5 + 0.5;
    for (let x = 0; x < w; x++) {
      const wave = fbm((x / w) * 4, ny * 10, { octaves: 3, seed }) * 0.05;
      const t = Math.max(0, Math.min(1, band + wave));
      let c = mix(dark, a, t);
      const turb = fbm((x / w) * 10, ny * 18, { octaves: 3, seed: seed + 3 }) * 0.14 - 0.07;
      c = mix(c, b, 0.5 + turb);
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Mars: red-orange with white polar caps.
function marsTexture(seed, size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const base  = hexToRgb(0xc84a20);
  const dark  = hexToRgb(0x7a2a10);
  const light = hexToRgb(0xe8884a);
  const ice   = hexToRgb(0xf0f4ff);

  for (let y = 0; y < h; y++) {
    const lat = Math.abs(y / h - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * 8, (y / h) * 8, { octaves: 6, seed });
      let c = mix(dark, n > 0.55 ? light : base, smoothstep(n));
      if (lat > 0.88) c = mix(c, ice, smoothstep((lat - 0.88) / 0.12));
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Crater pass
  const rng = mulberry32(seed + 99);
  for (let k = 0; k < 70; k++) {
    const cx = rng() * w, cy = rng() * h, r = 3 + rng() * 12;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(60,20,10,0.3)');
    g.addColorStop(0.7, 'rgba(60,20,10,0.05)');
    g.addColorStop(1, 'rgba(255,200,160,0.12)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

// Mercury / rocky: grey cratered.
function rockyTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * 10, (y / h) * 10, { octaves: 6, seed });
      const c = mix(b, a, n);
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rng = mulberry32(seed + 99);
  for (let k = 0; k < 80; k++) {
    const cx = rng() * w, cy = rng() * h, r = 3 + rng() * 14;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0.30)'); g.addColorStop(0.7, 'rgba(0,0,0,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0.10)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

// Venus: thick swirling yellow-orange cloud bands.
function cloudyTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);
  const bright = hexToRgb(0xffe0a0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * 5, (y / h) * 5, { octaves: 5, seed, gain: 0.6 });
      const n2 = fbm((x / w) * 12, (y / h) * 9, { octaves: 3, seed: seed + 4 });
      let c = mix(b, a, smoothstep(n));
      if (n2 > 0.65) c = mix(c, bright, (n2 - 0.65) / 0.35);
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Uranus: very smooth pale teal.
function uranusTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);
  const light = mix(a, hexToRgb(0xffffff), 0.45);
  for (let y = 0; y < h; y++) {
    const band = Math.sin((y / h) * Math.PI * 5) * 0.5 + 0.5;
    for (let x = 0; x < w; x++) {
      const swirl = fbm((x / w) * 2.5, (y / h) * 5, { octaves: 3, seed }) * 0.3;
      const t = band * 0.55 + swirl;
      let c = mix(b, a, Math.min(1, t));
      if (swirl > 0.2) c = mix(c, light, (swirl - 0.2) / 0.1);
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Neptune: deep blue with a dark oval storm spot.
function neptuneTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);
  const light = mix(a, hexToRgb(0xaaddff), 0.4);
  for (let y = 0; y < h; y++) {
    const band = Math.sin((y / h) * Math.PI * 7) * 0.5 + 0.5;
    for (let x = 0; x < w; x++) {
      const swirl = fbm((x / w) * 4, (y / h) * 8, { octaves: 4, seed });
      const t = band * 0.5 + swirl * 0.5;
      let c = mix(b, a, Math.min(1, t));
      if (swirl > 0.65) c = mix(c, light, (swirl - 0.65) / 0.35);
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Dark Great Dark Spot
  const gx = w * 0.45, gy = h * 0.45;
  ctx.save(); ctx.scale(1, 0.6);
  const gds = ctx.createRadialGradient(gx, gy / 0.6, 0, gx, gy / 0.6, w * 0.06);
  gds.addColorStop(0, 'rgba(10,20,80,0.70)');
  gds.addColorStop(1, 'rgba(10,20,80,0)');
  ctx.fillStyle = gds; ctx.fillRect(0, 0, w, h / 0.6); ctx.restore();
  return canvas;
}

// ─── moon-specific generators ────────────────────────────────────────────────

// Europa/Enceladus/Triton: white-blue icy with faint surface cracks.
function icyMoonTexture(seed, size, color) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const base  = hexToRgb(color);
  const white = hexToRgb(0xf4f6ff);
  const blue  = hexToRgb(0xd0ddf0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * 8, (y / h) * 8, { octaves: 5, seed });
      let c = mix(blue, white, smoothstep(n));
      c = mix(c, base, 0.25);
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Faint crack lines
  ctx.strokeStyle = 'rgba(160,185,220,0.5)';
  const rng = mulberry32(seed + 200);
  for (let k = 0; k < 12; k++) {
    ctx.lineWidth = 0.5 + rng() * 1.5;
    ctx.beginPath();
    ctx.moveTo(rng() * w, rng() * h);
    ctx.quadraticCurveTo(rng() * w, rng() * h, rng() * w, rng() * h);
    ctx.stroke();
  }
  return canvas;
}

// Io: yellow-orange sulfur base with dark lava patches.
function lavaMoonTexture(seed, size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w, h);
  const yellow = hexToRgb(0xe8d050);
  const orange = hexToRgb(0xd47830);
  const dark   = hexToRgb(0x402808);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n  = fbm((x / w) * 7, (y / h) * 7, { octaves: 5, seed });
      const n2 = fbm((x / w) * 14 + 5, (y / h) * 14 + 5, { octaves: 3, seed: seed + 9 });
      let c = mix(orange, yellow, smoothstep(n));
      if (n2 > 0.68) c = mix(c, dark, (n2 - 0.68) / 0.32);
      const i = (y * w + x) * 4;
      img.data[i] = c.r; img.data[i+1] = c.g; img.data[i+2] = c.b; img.data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Volcanic hot-spots
  const rng = mulberry32(seed + 300);
  for (let k = 0; k < 6; k++) {
    const cx = rng() * w, cy = rng() * h, r = 4 + rng() * 12;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,100,10,0.7)');
    g.addColorStop(1, 'rgba(255,100,10,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  return canvas;
}

// Titan: orange-brown hazy, like cloudyTexture but warmer.
function titanMoonTexture(seed, size) {
  return cloudyTexture(seed, size, 0xd8902a, 0xa86010);
}

// ─── public API ───────────────────────────────────────────────────────────────

// Returns a procedural THREE.Texture for a moon immediately (cached).
export function getMoonTexture(moon) {
  const size = 256;
  const cacheKey = `moon-${moon.name}-${size}`;
  if (proceduralCache.has(cacheKey)) return proceduralCache.get(cacheKey);

  const seed = seedFromKey(moon.name);
  let canvas;
  switch (moon.textureType) {
    case 'icy':   canvas = icyMoonTexture(seed, size, moon.color); break;
    case 'lava':  canvas = lavaMoonTexture(seed, size); break;
    case 'titan': canvas = titanMoonTexture(seed, size); break;
    default:      canvas = rockyTexture(seed, size, moon.color, (moon.color & 0xfefefe) >> 1); break;
  }
  const tex = toTexture(canvas);
  proceduralCache.set(cacheKey, tex);
  return tex;
}

// Returns a procedural THREE.Texture for a planet immediately (cached).
// `detail` 'high' uses a larger canvas for the close-up Planet View.
export function getPlanetTexture(planet, detail = 'low') {
  const size = detail === 'high' ? 1024 : 512;
  const cacheKey = `${planet.key}-${size}`;
  if (proceduralCache.has(cacheKey)) return proceduralCache.get(cacheKey);

  const seed = seedFromKey(planet.key);
  let canvas;
  switch (planet.key) {
    case 'jupiter': canvas = jupiterTexture(seed, size); break;
    case 'saturn':  canvas = saturnTexture(seed, size);  break;
    case 'mars':    canvas = marsTexture(seed, size);    break;
    case 'uranus':  canvas = uranusTexture(seed, size, planet.color, planet.color2); break;
    case 'neptune': canvas = neptuneTexture(seed, size, planet.color, planet.color2); break;
    default:
      switch (planet.textureType) {
        case 'earth':  canvas = earthTexture(seed, size);                              break;
        case 'cloudy': canvas = cloudyTexture(seed, size, planet.color, planet.color2); break;
        default:       canvas = rockyTexture(seed, size, planet.color, planet.color2);  break;
      }
  }
  const tex = toTexture(canvas);
  proceduralCache.set(cacheKey, tex);
  return tex;
}
