import * as THREE from 'three';
import { subscribeRemoteTexture } from '../utils/textures.js';

// Flat ring disk. If ringTextureUrl is provided, the real Saturn ring alpha
// PNG is loaded and swapped in once available.
export function createRings(planetRadius, color = 0xd9c89a, ringTextureUrl = null) {
  const inner = planetRadius * 1.4;
  const outer = planetRadius * 2.3;
  const geo = new THREE.RingGeometry(inner, outer, 96, 1);

  // Remap UVs so the texture runs radially.
  const pos = geo.attributes.position;
  const uv  = geo.attributes.uv;
  const v   = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = v.length();
    const t = (r - inner) / (outer - inner);
    uv.setXY(i, t, 0);
  }

  const tex = makeRingTexture(color);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2.2;

  if (ringTextureUrl) {
    subscribeRemoteTexture(ringTextureUrl, (realTex) => {
      realTex.wrapS = THREE.ClampToEdgeWrapping;
      mat.map = realTex;
      mat.needsUpdate = true;
    });
  }

  return mesh;
}

function makeRingTexture(color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 16;
  const ctx = c.getContext('2d');
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  for (let x = 0; x < 256; x++) {
    const t = x / 256;
    const band = 0.5 + 0.5 * Math.sin(t * 60);
    const gap  = Math.sin(t * 18) > 0.85 ? 0.05 : 1;
    const a = (0.25 + band * 0.6) * gap;
    ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
    ctx.fillRect(x, 0, 1, 16);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
