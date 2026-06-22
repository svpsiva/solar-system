import * as THREE from 'three';

// Instanced ring of asteroids between Mars and Jupiter.
// Returns a group with an update(dt, scale) that slowly rotates the whole belt.
export function createAsteroidBelt({ count = 600, innerRadius = 37, outerRadius = 43 } = {}) {
  const group = new THREE.Group();

  const geo = new THREE.DodecahedronGeometry(0.35, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x9a8f80,
    roughness: 1.0,
    metalness: 0.0,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = innerRadius + Math.random() * (outerRadius - innerRadius);
    const y = (Math.random() - 0.5) * 2.0;
    dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const s = 0.4 + Math.random() * 1.2;
    dummy.scale.set(s, s, s);
    dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);

  group.userData.update = (dt, scale = 1) => {
    group.rotation.y += dt * 0.05 * scale;
  };

  return group;
}
