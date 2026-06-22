// Procedural canvas texture generators for each planet "textureType".
// These create the hybrid look: bright/cartoon-friendly but with real-looking
// detail (continents, cloud bands, craters, ice swirls). No external assets.

import * as THREE from 'three';
import { fbm } from './noise.js';

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2; // 2:1 for equirectangular wrap
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
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function seedFromKey(key) {
  let s = 0;
  for (let i = 0; i < key.length; i++) s += key.charCodeAt(i) * (i + 1);
  return s;
}

// Earth: blue oceans, green/brown continents, white poles, soft clouds.
function earthTexture(seed, size) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);
  const ocean = hexToRgb(0x1e6fd0);
  const oceanDeep = hexToRgb(0x0f4a9e);
  const land = hexToRgb(0x2f9e44);
  const landDry = hexToRgb(0x9e8a3a);
  const ice = hexToRgb(0xf0f4ff);

  for (let y = 0; y < h; y++) {
    const lat = Math.abs(y / h - 0.5) * 2; // 0 equator -> 1 pole
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * 6, (y / h) * 6, { octaves: 6, seed });
      let c;
      if (n < 0.48) {
        c = mix(oceanDeep, ocean, n / 0.48);
      } else {
        const t = (n - 0.48) / 0.52;
        c = mix(land, landDry, Math.min(1, t * 1.4));
      }
      if (lat > 0.82) c = mix(c, ice, (lat - 0.82) / 0.18); // polar caps
      const i = (y * w + x) * 4;
      img.data[i] = c.r;
      img.data[i + 1] = c.g;
      img.data[i + 2] = c.b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Gas giant: horizontal swirling bands (Jupiter/Saturn).
function gasTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);
  const light = mix(a, hexToRgb(0xffffff), 0.35);

  for (let y = 0; y < h; y++) {
    // banding driven by latitude with wavy distortion
    const band = Math.sin((y / h) * Math.PI * 14 + fbm(0, (y / h) * 4, { seed }) * 4);
    for (let x = 0; x < w; x++) {
      const swirl = fbm((x / w) * 4, (y / h) * 10, { octaves: 4, seed }) * 0.5;
      const t = (band * 0.5 + 0.5) * 0.7 + swirl * 0.6;
      let c = mix(b, a, Math.min(1, Math.max(0, t)));
      if (t > 0.85) c = mix(c, light, (t - 0.85) / 0.15);
      const i = (y * w + x) * 4;
      img.data[i] = c.r;
      img.data[i + 1] = c.g;
      img.data[i + 2] = c.b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Rocky/cratered (Mercury, Mars).
function rockyTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * 10, (y / h) * 10, { octaves: 6, seed });
      const c = mix(b, a, n);
      const i = (y * w + x) * 4;
      img.data[i] = c.r;
      img.data[i + 1] = c.g;
      img.data[i + 2] = c.b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // scatter craters
  const rng = mulberry32(seed + 99);
  const craters = 60;
  for (let k = 0; k < craters; k++) {
    const cx = rng() * w;
    const cy = rng() * h;
    const r = 3 + rng() * 14;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(0.7, 'rgba(0,0,0,0.05)');
    g.addColorStop(1, 'rgba(255,255,255,0.10)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

// Cloudy (Venus) — soft yellow swirls.
function cloudyTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm((x / w) * 5, (y / h) * 5, { octaves: 5, seed, gain: 0.6 });
      const c = mix(b, a, smoothstep(n));
      const i = (y * w + x) * 4;
      img.data[i] = c.r;
      img.data[i + 1] = c.g;
      img.data[i + 2] = c.b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Icy (Uranus, Neptune) — smooth bands with soft swirls.
function iceTexture(seed, size, color, color2) {
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);
  const a = hexToRgb(color);
  const b = hexToRgb(color2);
  const light = mix(a, hexToRgb(0xffffff), 0.4);
  for (let y = 0; y < h; y++) {
    const band = Math.sin((y / h) * Math.PI * 6) * 0.5 + 0.5;
    for (let x = 0; x < w; x++) {
      const swirl = fbm((x / w) * 3, (y / h) * 6, { octaves: 4, seed });
      const t = band * 0.6 + swirl * 0.4;
      let c = mix(b, a, t);
      if (swirl > 0.7) c = mix(c, light, (swirl - 0.7) / 0.3);
      const i = (y * w + x) * 4;
      img.data[i] = c.r;
      img.data[i + 1] = c.g;
      img.data[i + 2] = c.b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cache so we don't regenerate the same texture repeatedly.
const cache = new Map();

// Returns a THREE.Texture for a planet config. `detail` controls canvas size
// (close-up Planet View uses a bigger canvas for the "realistic" hybrid look).
export function getPlanetTexture(planet, detail = 'low') {
  const size = detail === 'high' ? 1024 : 512;
  const cacheKey = `${planet.key}-${size}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const seed = seedFromKey(planet.key);
  let canvas;
  switch (planet.textureType) {
    case 'earth':
      canvas = earthTexture(seed, size);
      break;
    case 'gas':
      canvas = gasTexture(seed, size, planet.color, planet.color2);
      break;
    case 'cloudy':
      canvas = cloudyTexture(seed, size, planet.color, planet.color2);
      break;
    case 'ice':
      canvas = iceTexture(seed, size, planet.color, planet.color2);
      break;
    case 'rocky':
    default:
      canvas = rockyTexture(seed, size, planet.color, planet.color2);
      break;
  }
  const tex = toTexture(canvas);
  cache.set(cacheKey, tex);
  return tex;
}
