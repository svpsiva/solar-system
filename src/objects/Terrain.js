import * as THREE from 'three';
import { fbm } from '../utils/noise.js';

// Procedural heightmap terrain for the surface view, colored per planet.
// Returns a mesh; also returns heightAt(x, z) so we can place the astronaut.
export function createTerrain(planet, { size = 120, segments = 120 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const surface = planet.surface || { groundColor: 0x999999, roughness: 0.9 };
  const base = new THREE.Color(surface.groundColor);
  const dark = base.clone().multiplyScalar(0.55);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.35);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const seed = planet.key.length * 7 + 3;
  const amp = planet.textureType === 'gas' || planet.textureType === 'ice' ? 3 : 8;

  const heightField = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = fbm((x / size) * 6 + 10, (z / size) * 6 + 10, { octaves: 6, seed });
    const h = (n - 0.5) * amp * 2;
    pos.setY(i, h);
    heightField.push(h);

    // color by height
    const c = dark.clone().lerp(light, n);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: surface.roughness ?? 0.9,
    metalness: 0.0,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // sample height at a world position (nearest-vertex approximation)
  const half = size / 2;
  const step = size / segments;
  mesh.userData.heightAt = (x, z) => {
    const ix = Math.round((x + half) / step);
    const iz = Math.round((z + half) / step);
    const cix = Math.max(0, Math.min(segments, ix));
    const ciz = Math.max(0, Math.min(segments, iz));
    const idx = ciz * (segments + 1) + cix;
    return heightField[idx] ?? 0;
  };

  return mesh;
}
