// Planet surface factory.
// Dispatches to one of five distinct surface builders based on planet.surfaceType.
// Each builder returns a THREE.Group with an optional userData.update(dt, t) hook
// for animated effects, and userData.heightAt(x,z) for astronaut placement.
//
// surfaceType map:
//   'gas'      — animated drifting cloud layers (Jupiter, Saturn, Uranus, Neptune)
//   'volcanic' — jagged terrain + glowing lava cracks + orange fog (Venus)
//   'earth'    — ocean plane + green hills + cloud sprites (Earth)
//   'desert'   — red/grey dusty plains + rocks (Mars, Mercury)
//   'icy'      — grey cratered plains + dense star sky (Moon)

import * as THREE from 'three';
import { fbm } from '../utils/noise.js';

export function createSurface(planet) {
  switch (planet.surfaceType) {
    case 'gas':      return gasCloudSurface(planet);
    case 'volcanic': return volcanicSurface(planet);
    case 'earth':    return earthSurface(planet);
    case 'desert':   return desertSurface(planet);
    case 'icy':
    default:         return icySurface(planet);
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(key) {
  let s = 0;
  for (let i = 0; i < key.length; i++) s += key.charCodeAt(i) * (i + 1);
  return s;
}

// Build a heightmap PlaneGeometry with vertex colors.
function makeHeightmap({
  size = 120,
  segments = 100,
  amp = 6,
  seed = 0,
  baseColor,  // THREE.Color
  darkColor,
  lightColor,
  flatShading = true,
  roughness = 0.9,
}) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos    = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const heights = [];

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = fbm((x / size) * 6 + 10, (z / size) * 6 + 10, { octaves: 6, seed });
    const h = (n - 0.5) * amp * 2;
    pos.setY(i, h);
    heights.push(h);
    const c = darkColor.clone().lerp(lightColor, n);
    colors[i * 3]     = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness,
    metalness: 0,
    flatShading,
  });

  const mesh = new THREE.Mesh(geo, mat);
  const half = size / 2, step = size / segments;
  mesh.userData.heightAt = (x, z) => {
    const ix = Math.round((x + half) / step);
    const iz = Math.round((z + half) / step);
    const cix = Math.max(0, Math.min(segments, ix));
    const ciz = Math.max(0, Math.min(segments, iz));
    return heights[ciz * (segments + 1) + cix] ?? 0;
  };
  return mesh;
}

// ─── 1. Gas surface ──────────────────────────────────────────────────────────
// No solid ground — several semi-transparent cloud planes drift past.
// The astronaut "floats" at a fixed height in the clouds.
function gasCloudSurface(planet) {
  const group = new THREE.Group();

  const cloudColor = new THREE.Color(planet.surface.groundColor ?? 0xd8c0a0);
  const layers = [];

  for (let i = 0; i < 5; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const base = cloudColor.clone();

    // Each layer slightly lighter or darker.
    base.multiplyScalar(0.7 + i * 0.12);

    // Horizontal swirly bands
    for (let y = 0; y < 512; y++) {
      const bandV = Math.sin((y / 512) * Math.PI * (8 + i * 2)) * 0.5 + 0.5;
      const nv = fbm(i * 3, y / 80, { octaves: 3, seed: seedFrom(planet.key) + i * 17 });
      const bright = 0.5 + bandV * 0.4 + nv * 0.15;
      const r = Math.min(255, base.r * 255 * bright);
      const g = Math.min(255, base.g * 255 * bright);
      const b = Math.min(255, base.b * 255 * bright);
      ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},0.82)`;
      ctx.fillRect(0, y, 512, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);

    const planeGeo = new THREE.PlaneGeometry(200, 200);
    planeGeo.rotateX(-Math.PI / 2);
    const planeMat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.72 - i * 0.08,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.position.y = -i * 2.5;
    plane.userData.driftSpeed = 0.008 + i * 0.004;
    plane.userData.driftDir   = i % 2 === 0 ? 1 : -1;
    group.add(plane);
    layers.push(plane);
  }

  // Astronaut floats at y = 2 above the top cloud layer.
  group.userData.heightAt = () => 4;

  group.userData.update = (_dt, t) => {
    layers.forEach((l) => {
      l.material.map.offset.x += l.userData.driftSpeed * l.userData.driftDir * 0.01;
      l.material.map.offset.y += l.userData.driftSpeed * 0.003;
      l.material.map.needsUpdate = false; // CanvasTexture doesn't need re-upload
    });
    // Gentle oscillation in "altitude"
    layers.forEach((l, i) => {
      l.position.y = -i * 2.5 + Math.sin(t * 0.3 + i) * 0.4;
    });
  };

  return group;
}

// ─── 2. Volcanic (Venus) ─────────────────────────────────────────────────────
// Jagged terrain, emissive lava crack lines, orange atmospheric fog (set on scene).
function volcanicSurface(planet) {
  const group = new THREE.Group();
  const seed = seedFrom(planet.key);

  const terrain = makeHeightmap({
    size: 130, segments: 110, amp: 10, seed,
    baseColor:  new THREE.Color(0x5a2010),
    darkColor:  new THREE.Color(0x3a0f08),
    lightColor: new THREE.Color(0x7a3020),
    flatShading: true, roughness: 1.0,
  });
  group.add(terrain);
  group.userData.heightAt = terrain.userData.heightAt;

  // Lava crack meshes — thin elongated quads placed along random paths.
  const rng = mulberry32(seed + 77);
  const lavaMat = new THREE.MeshStandardMaterial({
    color: 0xff6010, emissive: 0xff4800, emissiveIntensity: 1.4,
    roughness: 0.2, metalness: 0,
  });

  const crackGroup = new THREE.Group();
  for (let c = 0; c < 28; c++) {
    const len  = 4 + rng() * 18;
    const w    = 0.12 + rng() * 0.3;
    const px   = (rng() - 0.5) * 100;
    const pz   = (rng() - 0.5) * 100;
    const py   = terrain.userData.heightAt(px, pz) + 0.05;
    const ang  = rng() * Math.PI * 2;
    const geo  = new THREE.BoxGeometry(len, 0.08, w);
    const mesh = new THREE.Mesh(geo, lavaMat);
    mesh.position.set(px, py, pz);
    mesh.rotation.y = ang;
    crackGroup.add(mesh);
  }
  group.add(crackGroup);

  // Lava glow flicker
  group.userData.update = (_dt, t) => {
    const flicker = 1.0 + Math.sin(t * 6) * 0.25 + Math.sin(t * 13.7) * 0.15;
    lavaMat.emissiveIntensity = 1.2 * flicker;
  };

  // Fog is applied to the scene by SurfaceView when it enters.
  group.userData.fog = new THREE.Fog(0xc85820, 18, 70);

  return group;
}

// ─── 3. Earth surface ────────────────────────────────────────────────────────
// Ocean plane + rolling green hills + simple cloud billboard sprites.
function earthSurface(planet) {
  const group = new THREE.Group();
  const seed = seedFrom(planet.key);

  // Ocean — flat reflective plane.
  const oceanGeo = new THREE.PlaneGeometry(200, 200);
  oceanGeo.rotateX(-Math.PI / 2);
  const oceanMat = new THREE.MeshStandardMaterial({
    color: 0x1a7ad4, roughness: 0.05, metalness: 0.15,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.position.y = -0.4;
  group.add(ocean);

  // Land terrain.
  const terrain = makeHeightmap({
    size: 120, segments: 100, amp: 5, seed,
    baseColor:  new THREE.Color(0x3a9040),
    darkColor:  new THREE.Color(0xc8a840), // sand/beach
    lightColor: new THREE.Color(0x3a9040), // green
    flatShading: false, roughness: 0.8,
  });
  // Mask out sub-sea terrain (keep only land above ~-0.3)
  group.add(terrain);
  group.userData.heightAt = (x, z) => Math.max(0.1, terrain.userData.heightAt(x, z));

  // Cloud billboards — white blobs in the sky.
  const cloudTex = makeCloudTexture();
  const cloudMat = new THREE.SpriteMaterial({
    map: cloudTex, transparent: true, opacity: 0.88, depthWrite: false,
  });
  const clouds = [];
  const rng = mulberry32(seed + 55);
  for (let i = 0; i < 18; i++) {
    const s = new THREE.Sprite(cloudMat.clone());
    const sx = 12 + rng() * 22, sy = sx * 0.45;
    s.scale.set(sx, sy, 1);
    s.position.set((rng() - 0.5) * 100, 14 + rng() * 8, (rng() - 0.5) * 100);
    s.userData.driftX = (rng() - 0.5) * 0.015;
    group.add(s);
    clouds.push(s);
  }

  // Gentle sun sparkle on ocean.
  ocean.userData.sparkle = (t) => {
    oceanMat.roughness = 0.05 + Math.sin(t * 3) * 0.02;
  };

  group.userData.update = (_dt, t) => {
    clouds.forEach((c) => { c.position.x += c.userData.driftX; });
    ocean.userData.sparkle(t);
  };

  group.userData.fog = new THREE.Fog(0xa8d8ff, 50, 150);

  return group;
}

// ─── 4. Desert (Mars / Mercury) ──────────────────────────────────────────────
// Red/grey dusty plains + scattered rock formations.
function desertSurface(planet) {
  const group = new THREE.Group();
  const seed = seedFrom(planet.key);
  const isMercury = planet.key === 'mercury';

  const baseHex  = isMercury ? 0x7a7570 : 0xb24a2a;
  const darkHex  = isMercury ? 0x4a4540 : 0x7a2a10;
  const lightHex = isMercury ? 0xaaa09a : 0xe8804a;

  const terrain = makeHeightmap({
    size: 120, segments: 100, amp: 4, seed,
    baseColor:  new THREE.Color(baseHex),
    darkColor:  new THREE.Color(darkHex),
    lightColor: new THREE.Color(lightHex),
    flatShading: true, roughness: 1.0,
  });
  group.add(terrain);
  group.userData.heightAt = terrain.userData.heightAt;

  // Rock formations — dodecahedra of various sizes.
  const rng = mulberry32(seed + 33);
  const rockMat = new THREE.MeshStandardMaterial({
    color: isMercury ? 0x888880 : 0x9a4020, roughness: 1.0, flatShading: true,
  });
  for (let i = 0; i < 40; i++) {
    const s    = 0.5 + rng() * 3.5;
    const rx   = (rng() - 0.5) * 100;
    const rz   = (rng() - 0.5) * 100;
    const ry   = terrain.userData.heightAt(rx, rz);
    const geo  = new THREE.DodecahedronGeometry(s, 0);
    const mesh = new THREE.Mesh(geo, rockMat);
    mesh.position.set(rx, ry + s * 0.5, rz);
    mesh.rotation.set(rng() * 6, rng() * 6, rng() * 6);
    mesh.scale.set(1, 0.5 + rng() * 0.7, 1);
    group.add(mesh);
  }

  // Polar ice strip at the far edge.
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xeef4ff, roughness: 0.5 });
  const iceGeo = new THREE.PlaneGeometry(130, 14);
  iceGeo.rotateX(-Math.PI / 2);
  const ice = new THREE.Mesh(iceGeo, iceMat);
  ice.position.set(0, 0.1, -58);
  group.add(ice);

  if (!isMercury) {
    // Mars dust haze
    group.userData.fog = new THREE.FogExp2(0xd4906a, 0.012);
  }

  return group;
}

// ─── 5. Icy / Moon ───────────────────────────────────────────────────────────
// Grey cratered plains, dense craters, near-black sky.
function icySurface(planet) {
  const group = new THREE.Group();
  const seed = seedFrom(planet.key);
  const isMercury = planet.key === 'mercury';

  const darkC  = new THREE.Color(isMercury ? 0x3a3830 : 0x4a4848);
  const lightC = new THREE.Color(isMercury ? 0x888880 : 0xb0adaa);

  const terrain = makeHeightmap({
    size: 120, segments: 100, amp: 3, seed,
    baseColor: lightC.clone().lerp(darkC, 0.5),
    darkColor: darkC, lightColor: lightC,
    flatShading: true, roughness: 1.0,
  });
  group.add(terrain);
  group.userData.heightAt = terrain.userData.heightAt;

  // Paint craters as dark circles on top.
  const rng = mulberry32(seed + 11);
  const craterGeo = new THREE.CircleGeometry(1, 24);
  craterGeo.rotateX(-Math.PI / 2);
  const craterMat = new THREE.MeshBasicMaterial({
    color: isMercury ? 0x181810 : 0x282828, transparent: true, opacity: 0.55,
  });
  for (let i = 0; i < 50; i++) {
    const r  = 1 + rng() * 7;
    const cx = (rng() - 0.5) * 110;
    const cz = (rng() - 0.5) * 110;
    const cy = terrain.userData.heightAt(cx, cz) + 0.05;
    const m  = new THREE.Mesh(craterGeo, craterMat);
    m.scale.set(r, 1, r);
    m.position.set(cx, cy, cz);
    group.add(m);
  }

  return group;
}

// ─── cloud sprite texture ─────────────────────────────────────────────────────
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.7, 'rgba(240,245,255,0.35)');
  g.addColorStop(1,   'rgba(240,245,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
