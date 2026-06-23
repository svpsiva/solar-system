import * as THREE from 'three';
import { SUN } from '../data/planets.js';
import { subscribeRemoteTexture } from '../utils/textures.js';

// Glowing sun: emissive sphere + additive sprite glow + a point light.
export function createSun() {
  const group = new THREE.Group();

  const geo = new THREE.SphereGeometry(SUN.radius, 48, 48);
  const mat = new THREE.MeshBasicMaterial({ color: SUN.color });
  const core = new THREE.Mesh(geo, mat);
  group.add(core);

  subscribeRemoteTexture(SUN.textureUrl, (tex) => {
    mat.map = tex;
    mat.needsUpdate = true;
  });

  // soft additive glow billboard
  const glowTex = makeGlowTexture();
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffaa33,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(SUN.radius * 6, SUN.radius * 6, 1);
  group.add(glow);

  const light = new THREE.PointLight(0xfff2dd, 3.5, 0, 0.0);
  group.add(light);

  group.userData.spin = (dt) => {
    core.rotation.y += dt * 0.05;
  };

  return group;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,230,160,1)');
  g.addColorStop(0.25, 'rgba(255,180,80,0.6)');
  g.addColorStop(0.6, 'rgba(255,120,40,0.18)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
