import * as THREE from 'three';
import { getMoonTexture } from '../utils/textures.js';
import { subscribeRemoteTexture } from '../utils/textures.js';

// Small textured moon that orbits a parent on its own pivot.
// Returns { pivot, update(dt, scale) }. Add `pivot` to the planet group.
export function createMoon(moon, startAngle = 0) {
  const pivot = new THREE.Group();

  const geo = new THREE.SphereGeometry(moon.radius, 24, 24);
  const procTex = getMoonTexture(moon);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: procTex,
    roughness: 1.0,
    metalness: 0.0,
  });
  if (moon.textureUrl) {
    subscribeRemoteTexture(moon.textureUrl, (tex) => {
      mat.map = tex;
      mat.needsUpdate = true;
    });
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.x = moon.orbitRadius;
  mesh.userData.moonName = moon.name;
  pivot.add(mesh);
  pivot.rotation.y = startAngle;

  // slight orbital inclination so moons don't all sit in one flat line
  pivot.rotation.x = (Math.random() - 0.5) * 0.4;

  const update = (dt, scale = 1) => {
    pivot.rotation.y += dt * moon.speed * scale;
    mesh.rotation.y += dt * 0.5 * scale;
  };

  return { pivot, mesh, update };
}
