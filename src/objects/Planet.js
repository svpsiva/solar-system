import * as THREE from 'three';
import { getPlanetTexture, subscribeRemoteTexture } from '../utils/textures.js';
import { createRings } from './Rings.js';

// A textured planet sphere.
// Shows a procedural texture immediately, then swaps in the real CDN texture
// when it finishes loading.
export function createPlanet(planet, { detail = 'low', withRings = true } = {}) {
  const group = new THREE.Group();

  const geo = new THREE.SphereGeometry(planet.radius, 48, 48);
  const tex = getPlanetTexture(planet, detail);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: planet.textureType === 'gas' || planet.textureType === 'ice' ? 0.55 : 0.88,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  group.userData.mesh = mesh;

  // gentle axial tilt
  group.rotation.z = planet.key === 'uranus' ? 1.4 : 0.2;

  if (withRings && planet.hasRings) {
    const rings = createRings(planet.radius, planet.ringColor || 0xd9c89a, planet.ringTextureUrl);
    group.add(rings);
    group.userData.rings = rings;
  }

  group.userData.spin = (dt, scale = 1) => {
    mesh.rotation.y += dt * planet.rotationSpeed * scale;
  };

  // Async: swap in the real texture once it arrives.
  if (planet.textureUrl) {
    subscribeRemoteTexture(planet.textureUrl, (realTex) => {
      mat.map = realTex;
      mat.needsUpdate = true;
    });
  }

  return group;
}
