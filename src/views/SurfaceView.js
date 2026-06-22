import * as THREE from 'three';
import { createTerrain } from '../objects/Terrain.js';
import { createAstronaut } from '../objects/Astronaut.js';
import { createStars } from '../objects/Stars.js';

// Walk-around surface of the chosen planet. Toddler controls: tap the ground to
// send the astronaut walking there; drag to look around. No fail states.
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

    // camera orbit state around the astronaut
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
    this._onUp = this._onUp.bind(this);
  }

  enter() {
    const surface = this.planet.surface || {};
    const sky = new THREE.Color(surface.skyColor ?? 0x111133);
    this.scene.background = sky;

    // lighting tuned for an outdoor surface
    this.ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.root.add(this.ambient);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.3);
    this.sun.position.set(20, 30, 10);
    this.root.add(this.sun);

    // a faint hemisphere fill using the sky color
    this.hemi = new THREE.HemisphereLight(sky.getHex(), 0x080808, 0.5);
    this.root.add(this.hemi);

    this.terrain = createTerrain(this.planet);
    this.root.add(this.terrain);

    // stars only look right on airless worlds, but harmless elsewhere & pretty
    this.stars = createStars(800, 350);
    this.root.add(this.stars);

    this.astronaut = createAstronaut();
    this.astronaut.position.set(0, this.terrain.userData.heightAt(0, 0), 0);
    this.root.add(this.astronaut);

    this.scene.add(this.root);

    this._updateCamera();

    const dom = this.ctx.renderer.renderer.domElement;
    dom.addEventListener('pointerdown', this._onDown);
    dom.addEventListener('pointermove', this._onMove);
    dom.addEventListener('pointerup', this._onUp);

    this.audio.narrate(`We are on ${this.planet.name}! Tap the ground to explore.`);
  }

  _onDown(e) {
    this.dragging = true;
    this.moved = false;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  _onMove(e) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.moved = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.camYaw -= dx * 0.005;
    this.camPitch = Math.max(0.05, Math.min(1.2, this.camPitch + dy * 0.005));
    this._updateCamera();
  }

  _onUp(e) {
    this.dragging = false;
    if (this.moved) return; // it was a look-around drag, not a tap
    // tap: raycast to the terrain and walk there
    const rect = this.ctx.renderer.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.terrain, false);
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
    if (this.stars.userData.twinkle) this.stars.userData.twinkle(t);

    // walk toward tapped target
    if (this.walkTarget) {
      const a = this.astronaut.position;
      const dir = new THREE.Vector3(this.walkTarget.x - a.x, 0, this.walkTarget.z - a.z);
      const dist = dir.length();
      if (dist < 0.5) {
        this.walkTarget = null;
      } else {
        dir.normalize();
        const step = Math.min(dist, dt * 8);
        a.x += dir.x * step;
        a.z += dir.z * step;
        a.y = this.terrain.userData.heightAt(a.x, a.z);
        this.astronaut.rotation.y = Math.atan2(dir.x, dir.z);
        this._updateCamera();
      }
    }
  }

  dispose() {
    const dom = this.ctx.renderer.renderer.domElement;
    dom.removeEventListener('pointerdown', this._onDown);
    dom.removeEventListener('pointermove', this._onMove);
    dom.removeEventListener('pointerup', this._onUp);
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
