import * as THREE from 'three';
import { createSurface } from '../objects/Terrain.js';
import { createAstronaut } from '../objects/Astronaut.js';
import { createStars } from '../objects/Stars.js';

// Walk-around surface of the chosen planet. Each planet has a distinct surface
// environment (gas clouds, volcanic lava, earth ocean, desert, icy craters).
// Controls: tap the ground to walk there; drag to look around.
export class SurfaceView {
  constructor(ctx, planet) {
    this.ctx = ctx;
    this.scene = ctx.renderer.scene;
    this.camera = ctx.renderer.camera;
    this.audio = ctx.audio;
    this.app = ctx.app;
    this.planet = planet;

    this.root = new THREE.Group();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._surface = null; // the createSurface() group

    this.camYaw = 0;
    this.camPitch = 0.35;
    this.camDist = 14;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.moved = false;
    this.walkTarget = null;

    this._onDown = this._onDown.bind(this);
    this._onMove = this._onMove.bind(this);
    this._onUp   = this._onUp.bind(this);
  }

  enter() {
    const surface = this.planet.surface || {};
    const skyColor = new THREE.Color(surface.skyColor ?? 0x111133);
    this.scene.background = skyColor;

    // Lighting
    this.ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.root.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.3);
    this.sun.position.set(20, 30, 10);
    this.root.add(this.sun);
    this.hemi = new THREE.HemisphereLight(skyColor.getHex(), 0x080808, 0.5);
    this.root.add(this.hemi);

    // Surface environment (planet-specific)
    this._surface = createSurface(this.planet);
    this.root.add(this._surface);

    // Apply optional scene fog from the surface builder.
    if (this._surface.userData.fog) {
      this.scene.fog = this._surface.userData.fog;
    }

    // Stars — skipped for Venus (thick clouds block them) and Earth (daytime).
    if (!['venus', 'earth'].includes(this.planet.key)) {
      this.stars = createStars(800, 350);
      this.root.add(this.stars);
    }

    // Astronaut
    this.astronaut = createAstronaut();
    const startY = (this._surface.userData.heightAt?.(0, 0) ?? 0);
    this.astronaut.position.set(0, startY, 0);
    this.root.add(this.astronaut);

    this.scene.add(this.root);
    this._updateCamera();

    const dom = this.ctx.renderer.renderer.domElement;
    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    dom.addEventListener('pointerup',   this._onUp);

    this.audio.narrate(`We have landed on ${this.planet.name}! Tap the ground to explore.`);
  }

  _onDown(e) {
    this.dragging = true; this.moved = false;
    this.lastX = e.clientX; this.lastY = e.clientY;
  }

  _onMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.moved = true;
    this.lastX = e.clientX; this.lastY = e.clientY;
    this.camYaw   -= dx * 0.005;
    this.camPitch  = Math.max(0.05, Math.min(1.2, this.camPitch + dy * 0.005));
    this._updateCamera();
  }

  _onUp(e) {
    this.dragging = false;
    if (this.moved) return;

    // Gas worlds: no terrain to raycast against — tap to "float" in a direction.
    if (this.planet.surfaceType === 'gas') {
      const dir = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      this.walkTarget = this.astronaut.position.clone().add(dir.multiplyScalar(10));
      this.audio.sfx('pop');
      return;
    }

    const rect = this.ctx.renderer.renderer.domElement.getBoundingClientRect();
    this.pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Raycast against the first Mesh in the surface group (the terrain).
    const terrainMeshes = [];
    this._surface.traverse((obj) => { if (obj.isMesh) terrainMeshes.push(obj); });
    const hits = this.raycaster.intersectObjects(terrainMeshes, false);
    if (hits.length > 0) {
      const p = hits[0].point;
      this.walkTarget = new THREE.Vector3(p.x, 0, p.z);
      this.audio.sfx('pop');
    }
  }

  _updateCamera() {
    const a = this.astronaut.position;
    const x = a.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    const y = a.y + Math.sin(this.camPitch) * this.camDist + 3;
    const z = a.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDist;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(a.x, a.y + 2, a.z);
  }

  update(dt, t) {
    if (this.astronaut.userData.bob) this.astronaut.userData.bob(t);
    if (this.stars?.userData.twinkle) this.stars.userData.twinkle(t);
    if (this._surface?.userData.update) this._surface.userData.update(dt, t);

    if (this.walkTarget) {
      const a   = this.astronaut.position;
      const dir = new THREE.Vector3(this.walkTarget.x - a.x, 0, this.walkTarget.z - a.z);
      const dist = dir.length();
      if (dist < 0.5) {
        this.walkTarget = null;
      } else {
        dir.normalize();
        const step = Math.min(dist, dt * 8);
        a.x += dir.x * step;
        a.z += dir.z * step;
        a.y = this._surface.userData.heightAt?.(a.x, a.z) ?? 0;
        this.astronaut.rotation.y = Math.atan2(dir.x, dir.z);
        this._updateCamera();
      }
    }
  }

  dispose() {
    // Clear fog when leaving surface view.
    this.scene.fog = null;

    const dom = this.ctx.renderer.renderer.domElement;
    dom.removeEventListener('pointerdown', this._onDown);
    dom.removeEventListener('pointermove', this._onMove);
    dom.removeEventListener('pointerup',   this._onUp);
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
  }
}
