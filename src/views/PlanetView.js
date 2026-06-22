import * as THREE from 'three';
import { VIEW } from '../core/AppState.js';
import { createPlanet } from '../objects/Planet.js';
import { createMoon } from '../objects/Moon.js';
import { createStars } from '../objects/Stars.js';
import { createRocket } from '../objects/Rocket.js';
import { disposeGroup } from './SolarSystemView.js';

// Close-up of one planet: detailed planet, orbiting moons, rings.
// Pinch (two fingers) or mouse-wheel zooms in/out.
export class PlanetView {
  constructor(ctx, planet) {
    this.ctx = ctx;
    this.scene = ctx.renderer.scene;
    this.camera = ctx.renderer.camera;
    this.audio = ctx.audio;
    this.app = ctx.app;
    this.planet = planet;

    this.root = new THREE.Group();
    this.moons = [];
    this.showMoons = true;
    this.showRings = true;
    this.landing = null;

    // Camera distance from planet centre (zoom state).
    this._defaultDist = planet.radius * 4.5 + 4;
    this._camDist = this._defaultDist;
    this._minDist = planet.radius * 2.0 + 1;
    this._maxDist = planet.radius * 9.0 + 4;

    // Pointer tracking
    this._pointers = new Map();
    this._onPointerDown   = this._onPointerDown.bind(this);
    this._onPointerMove   = this._onPointerMove.bind(this);
    this._onPointerUp     = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerUp.bind(this);
    this._onWheel         = this._onWheel.bind(this);
  }

  enter() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x070815);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.root.add(this.ambient);
    this.key = new THREE.DirectionalLight(0xffffff, 1.4);
    this.key.position.set(5, 4, 6);
    this.root.add(this.key);

    this.stars = createStars(1200, 400);
    this.root.add(this.stars);

    this.planetGroup = createPlanet(this.planet, { detail: 'high', withRings: true });
    this.root.add(this.planetGroup);

    this.moonGroup = new THREE.Group();
    (this.planet.moons || []).forEach((m, i) => {
      const moon = createMoon(m, (i / Math.max(1, this.planet.moons.length)) * Math.PI * 2);
      this.moonGroup.add(moon.pivot);
      this.moons.push(moon);
    });
    this.root.add(this.moonGroup);

    this.rocket = createRocket();
    this.rocket.scale.setScalar(0.5);
    this.root.add(this.rocket);

    scene.add(this.root);

    this._applyZoom();

    const dom = this.ctx.renderer.renderer.domElement;
    dom.addEventListener('pointerdown',   this._onPointerDown);
    dom.addEventListener('pointermove',   this._onPointerMove);
    dom.addEventListener('pointerup',     this._onPointerUp);
    dom.addEventListener('pointercancel', this._onPointerCancel);
    dom.addEventListener('wheel',         this._onWheel, { passive: true });

    this.audio.narrate(`${this.planet.narration.name} ${this.planet.narration.fact}`);
  }

  // ── camera zoom ───────────────────────────────────────────────────────────────

  _applyZoom() {
    if (this.landing) return; // landing animation controls the camera
    this.camera.position.set(0, this._camDist * 0.35, this._camDist);
    this.camera.lookAt(0, 0, 0);
  }

  _adjustZoom(delta) {
    this._camDist = Math.max(this._minDist, Math.min(this._maxDist, this._camDist + delta));
    this._applyZoom();
  }

  // ── pointer handlers ─────────────────────────────────────────────────────────

  _onPointerDown(e) {
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  _onPointerMove(e) {
    if (!this._pointers.has(e.pointerId)) return;

    if (this._pointers.size === 2) {
      const ids = [...this._pointers.keys()];
      const other = this._pointers.get(ids.find((id) => id !== e.pointerId));
      const prev  = this._pointers.get(e.pointerId);
      const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);

      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const cur = this._pointers.get(e.pointerId);
      const newDist = Math.hypot(cur.x - other.x, cur.y - other.y);

      // Scale delta to planet size so pinch feels consistent regardless of planet.
      const delta = (prevDist - newDist) * this._defaultDist * 0.004;
      this._adjustZoom(delta);
    } else {
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
  }

  _onPointerUp(e) {
    this._pointers.delete(e.pointerId);
  }

  _onWheel(e) {
    const delta = e.deltaY * 0.015;
    this._adjustZoom(delta);
  }

  // ── public controls ───────────────────────────────────────────────────────────

  toggleMoons(on) {
    this.showMoons = on;
    this.moonGroup.visible = on;
    this.audio.sfx('pop');
  }

  toggleRings(on) {
    this.showRings = on;
    if (this.planetGroup.userData.rings) this.planetGroup.userData.rings.visible = on;
    this.audio.sfx('pop');
  }

  land() {
    if (this.landing) return;
    this.audio.sfx('whoosh');
    this.audio.narrate(`Landing on ${this.planet.name}!`);
    this.landing = { t: 0, dur: 1.6, from: this.camera.position.clone() };
  }

  // ── update loop ───────────────────────────────────────────────────────────────

  update(dt, t) {
    if (this.planetGroup.userData.spin) this.planetGroup.userData.spin(dt, 0.4);
    if (this.showMoons) this.moons.forEach((m) => m.update(dt, 0.6));
    if (this.stars.userData.twinkle) this.stars.userData.twinkle(t);
    if (this.rocket.userData.animateFlame) this.rocket.userData.animateFlame(t);

    const r = this.planet.radius * 2.6 + 2;
    this.rocket.position.set(
      Math.cos(t * 0.6) * r,
      Math.sin(t * 0.3) * 1.5,
      Math.sin(t * 0.6) * r
    );
    this.rocket.lookAt(0, 0, 0);

    if (this.landing) {
      const l = this.landing;
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      const target = new THREE.Vector3(0, this.planet.radius * 0.2, this.planet.radius * 1.05);
      this.camera.position.lerpVectors(l.from, target, easeIn(k));
      this.camera.lookAt(0, 0, 0);
      if (k >= 1) {
        this.landing = null;
        this.app.go(VIEW.SURFACE, this.planet);
      }
    }
  }

  dispose() {
    const dom = this.ctx.renderer.renderer.domElement;
    dom.removeEventListener('pointerdown',   this._onPointerDown);
    dom.removeEventListener('pointermove',   this._onPointerMove);
    dom.removeEventListener('pointerup',     this._onPointerUp);
    dom.removeEventListener('pointercancel', this._onPointerCancel);
    dom.removeEventListener('wheel',         this._onWheel);
    this.scene.remove(this.root);
    disposeGroup(this.root);
  }
}

function easeIn(t) { return t * t; }
