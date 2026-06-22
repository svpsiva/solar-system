import * as THREE from 'three';

// A cute low-poly astronaut for the surface view. Returns a group; call
// userData.bob(t) for a gentle idle animation.
export function createAstronaut() {
  const group = new THREE.Group();

  const suit = new THREE.MeshStandardMaterial({ color: 0xf2f2f5, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff5252, roughness: 0.6 });
  const visor = new THREE.MeshStandardMaterial({
    color: 0x223344,
    emissive: 0x6fd0ff,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    metalness: 0.3,
  });

  // body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.6, 6, 12), suit);
  body.position.y = 0.9;
  group.add(body);

  // helmet
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), suit);
  helmet.position.y = 1.7;
  group.add(helmet);

  // visor
  const v = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24, 0, Math.PI), visor);
  v.position.set(0, 1.7, 0.18);
  v.rotation.x = Math.PI / 2;
  group.add(v);

  // backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), accent);
  pack.position.set(0, 1.0, -0.4);
  group.add(pack);

  // arms
  const armGeo = new THREE.CapsuleGeometry(0.13, 0.5, 4, 8);
  const armL = new THREE.Mesh(armGeo, suit);
  armL.position.set(-0.55, 1.0, 0);
  armL.rotation.z = 0.3;
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, suit);
  armR.position.set(0.55, 1.0, 0);
  armR.rotation.z = -0.3;
  group.add(armR);

  // legs
  const legGeo = new THREE.CapsuleGeometry(0.16, 0.5, 4, 8);
  const legL = new THREE.Mesh(legGeo, suit);
  legL.position.set(-0.2, 0.3, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, suit);
  legR.position.set(0.2, 0.3, 0);
  group.add(legR);

  group.userData.bob = (t) => {
    group.position.y += Math.sin(t * 2) * 0.002;
    armL.rotation.x = Math.sin(t * 2) * 0.1;
    armR.rotation.x = -Math.sin(t * 2) * 0.1;
  };

  return group;
}
