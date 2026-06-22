import * as THREE from 'three';

// A large sphere of twinkly background stars.
export function createStars(count = 1500, radius = 800) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // random point on a sphere shell
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = radius * (0.8 + Math.random() * 0.2);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.twinkle = (t) => {
    mat.opacity = 0.7 + Math.sin(t * 2) * 0.2;
  };
  return points;
}
