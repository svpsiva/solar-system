import * as THREE from 'three';

// A friendly low-poly rocket with a little astronaut window, fins and an
// animated flame. Used as Astro's ship in the solar-system view.
export function createRocket() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f8, roughness: 0.5, metalness: 0.1 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xff5252, roughness: 0.5 });
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x6fd0ff,
    emissive: 0x2a6fd6,
    emissiveIntensity: 0.4,
    roughness: 0.2,
  });

  // body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 2.2, 24), bodyMat);
  group.add(body);

  // nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.0, 24), accentMat);
  nose.position.y = 1.6;
  group.add(nose);

  // window
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 20), windowMat);
  win.position.set(0, 0.5, 0.45);
  group.add(win);

  // fins
  const finGeo = new THREE.ConeGeometry(0.35, 0.8, 4);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo, accentMat);
    const a = (i / 3) * Math.PI * 2;
    fin.position.set(Math.cos(a) * 0.55, -1.0, Math.sin(a) * 0.55);
    fin.rotation.y = -a;
    fin.rotation.x = Math.PI;
    group.add(fin);
  }

  // flame
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1.0, 16),
    new THREE.MeshBasicMaterial({ color: 0xffae42, transparent: true, opacity: 0.9 })
  );
  flame.position.y = -1.7;
  flame.rotation.x = Math.PI;
  group.add(flame);
  group.userData.flame = flame;

  // point the rocket "up" along +Y by default; nose forward when flying
  group.userData.animateFlame = (t) => {
    const s = 0.8 + Math.sin(t * 30) * 0.25;
    flame.scale.set(1, s, 1);
    flame.material.opacity = 0.7 + Math.sin(t * 25) * 0.2;
  };

  group.scale.setScalar(1.0);
  return group;
}
