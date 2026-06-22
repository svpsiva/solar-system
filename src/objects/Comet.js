import * as THREE from 'three';

// A comet: a bright head + an additive particle tail, travelling on an
// elongated elliptical orbit. Returns a group with update(dt, scale).
export function createComet({ a = 70, b = 30, speed = 0.3, phase = 0, tilt = 0.3 } = {}) {
  const group = new THREE.Group();
  group.rotation.x = tilt;

  // head
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xddeeff })
  );
  group.add(head);

  // glow sprite on the head
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlow(),
      color: 0x9fd0ff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.scale.set(4, 4, 1);
  head.add(glow);

  // particle tail
  const N = 120;
  const positions = new Float32Array(N * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const tailMat = new THREE.PointsMaterial({
    color: 0x9fd0ff,
    size: 0.5,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tail = new THREE.Points(geom, tailMat);
  group.add(tail);

  let angle = phase;
  const trail = [];

  group.userData.update = (dt, scale = 1) => {
    angle += dt * speed * scale;
    const x = Math.cos(angle) * a;
    const z = Math.sin(angle) * b;
    head.position.set(x, 0, z);

    // tail points away from the sun (origin)
    trail.unshift(new THREE.Vector3(x, 0, z));
    if (trail.length > N) trail.pop();
    const arr = tail.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const p = trail[Math.min(i, trail.length - 1)] || head.position;
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    tail.geometry.attributes.position.needsUpdate = true;
  };

  return group;
}

function makeGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(160,210,255,0.5)');
  g.addColorStop(1, 'rgba(160,210,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
