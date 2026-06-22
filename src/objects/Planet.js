import * as THREE from 'three';
import { getPlanetTexture } from '../utils/textures.js';
import { createRings } from './Rings.js';

// A textured planet sphere. `detail` 'high' uses a larger texture for close-ups.
// `withRings` adds rings if the planet has them.
export function createPlanet(planet, { detail = 'low', withRings = true } = {}) {
  const group = new THREE.Group();

  const geo = new THREE.SphereGeometry(planet.radius, 48, 48);
  const tex = getPlanetTexture(planet, detail);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: planet.textureType === 'gas' || planet.textureType === 'ice' ? 0.55 : 0.9,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);
  group.userData.mesh = mesh;

  // gentle axial tilt for character
  group.rotation.z = planet.key === 'uranus' ? 1.4 : 0.2;

  if (withRings && planet.hasRings) {
    const rings = createRings(planet.radius, planet.ringColor || 0xd9c89a);
    group.add(rings);
    group.userData.rings = rings;
  }

  group.userData.spin = (dt, scale = 1) => {
    mesh.rotation.y += dt * planet.rotationSpeed * scale;
  };

  return group;
}
