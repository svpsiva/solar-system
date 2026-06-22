import * as THREE from 'three';
import { VIEW } from '../core/AppState.js';
import { createPlanet } from '../objects/Planet.js';
import { createMoon } from '../objects/Moon.js';
import { createStars } from '../objects/Stars.js';
import { createRocket } from '../objects/Rocket.js';
import { disposeGroup } from './SolarSystemView.js';

// Close-up of one planet: detailed planet, orbiting moons, rings.
// 1-finger drag: orbit-rotate camera. 2-finger pinch: zoom. 2-finger drag: pan.
// Tap a moon to hear its name. Double-tap empty space: re-centre.
export class PlanetView {
  constructor(ctx, planet) {
    this.ctx    = ctx;
    this.scene  = ctx.renderer.scene;
    this.camera = ctx.renderer.camera;
    this.audio  = ctx.audio;
    this.app    = ctx.app;
    this.planet = planet;

    this.root    = new THREE.Group();
    this.moons   = [];
    this.moonMeshes = [];
    this.showMoons  = true;
    this.showRings  = true;
    this.landing    = null;

    // Camera distance from planet centre (zoom state).
    this._defaultDist = planet.radius * 4.5 + 4;
    this._camDist = this._defaultDist;
    this._minDist = planet.radius * 2.0 + 1;
    this._maxDist = planet.radius * 9.0 + 4;

    // Orbit-camera spherical coordinates around _panTarget.
    // Initial pitch 0.336 matches original (0, dist*0.35, dist) elevation ratio.
    this._camYaw    = 0;
    this._camPitch  = 0.336;
    this._panTarget = new THREE.Vector3();

    // Pointer tracking
    this._pointers    = new Map();
    this._tapStart    = null;
    this._lastTapTime = 0;

    this.raycaster = new THREE.Raycaster();

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
      this.moonMeshes.push(moon.mesh);
    });
    this.root.add(this.moonGroup);

    this.rocket = createRocket();
    this.rocket.scale.setScalar(0.5);
    this.root.add(this.rocket);

    scene.add(this.root);

    this._applyCamera();

    const dom = this.ctx.renderer.renderer.domElement;
    dom.addEventListener('pointerdown',   this._onPointerDown);
    dom.addEventListener('pointermove',   this._onPointerMove);
    dom.addEventListener('pointerup',     this._onPointerUp);
    dom.addEventListener('pointercancel', this._onPointerCancel);
    dom.addEventListener('wheel',         this._onWheel, { passive: true });

    this.audio.narrate(`${this.planet.narration.name} ${this.planet.narration.fact}`);
  }

  // ── camera ────────────────────────────────────────────────────────────────────

  _applyCamera() {
    if (this.landing) return;
    const r = this._camDist;
    const x = r * Math.cos(this._camPitch) * Math.sin(this._camYaw);
    const y = r * Math.sin(this._camPitch);
    const z = r * Math.cos(this._camPitch) * Math.cos(this._camYaw);
    this.camera.position.copy(this._panTarget).add(new THREE.Vector3(x, y, z));
    this.camera.lookAt(this._panTarget);
  }

  _adjustZoom(delta) {
    this._camDist = Math.max(this._minDist, Math.min(this._maxDist, this._camDist + delta));
    this._applyCamera();
  }

  // ── pointer handlers ─────────────────────────────────────────────────────────

  _onPointerDown(e) {
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 1) {
      this._tapStart = { x: e.clientX, y: e.clientY };
    }
  }

  _onPointerMove(e) {
    if (!this._pointers.has(e.pointerId)) return;

    if (this._pointers.size === 2) {
      // Two-finger: zoom (pinch) + pan (midpoint shift) simultaneously.
      const ids     = [...this._pointers.keys()];
      const otherId = ids.find((id) => id !== e.pointerId);
      const other   = this._pointers.get(otherId);
      const prev    = this._pointers.get(e.pointerId);

      const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
      const prevMidX = (prev.x + other.x) / 2;
      const prevMidY = (prev.y + other.y) / 2;

      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const cur = this._pointers.get(e.pointerId);

      const newDist = Math.hypot(cur.x - other.x, cur.y - other.y);
      const newMidX = (cur.x + other.x) / 2;
      const newMidY = (cur.y + other.y) / 2;

      // Zoom — scale delta to planet size so pinch feels consistent.
      this._adjustZoom((prevDist - newDist) * this._defaultDist * 0.004);

      // Pan
      const dmx = newMidX - prevMidX;
      const dmy = newMidY - prevMidY;
      if (Math.abs(dmx) > 0.3 || Math.abs(dmy) > 0.3) {
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        const right = new THREE.Vector3().crossVectors(camDir, this.camera.up).negate().normalize();
        const scale = this._camDist * 0.002;
        this._panTarget.addScaledVector(right, dmx * scale);
        this._panTarget.addScaledVector(this.camera.up, -dmy * scale);
        this._panTarget.clampLength(0, this.planet.radius * 3);
        this._applyCamera();
      }

      this._tapStart = null;
    } else {
      // Single-finger: tap detection + drag-to-rotate.
      const prev = this._pointers.get(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this._tapStart) {
        const dx = e.clientX - this._tapStart.x;
        const dy = e.clientY - this._tapStart.y;
        if (dx * dx + dy * dy > 64) {
          this._tapStart = null;
        }
      } else if (prev) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this._camYaw   += dx * 0.005;
        this._camPitch  = Math.max(0.05, Math.min(1.2, this._camPitch - dy * 0.005));
        this._applyCamera();
      }
    }
  }

  _onPointerUp(e) {
    const wasTap = this._pointers.size === 1 && this._tapStart !== null;

    if (wasTap) {
      // Check for moon tap first.
      if (this.showMoons && this.moonMeshes.length > 0) {
        const rect = this.ctx.renderer.renderer.domElement.getBoundingClientRect();
        const ptr  = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width)  * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(ptr, this.camera);
        const hits = this.raycaster.intersectObjects(this.moonMeshes, false);
        if (hits.length > 0) {
          const name = hits[0].object.userData.moonName;
          this._showMoonLabel(name);
          this.audio.narrate(name);
          this._pointers.delete(e.pointerId);
          if (this._pointers.size === 0) this._tapStart = null;
          return;
        }
      }

      // Double-tap empty space → re-centre pan.
      const now = performance.now();
      if (now - this._lastTapTime < 400) {
        this._panTarget.set(0, 0, 0);
        this._applyCamera();
        this._lastTapTime = 0;
      } else {
        this._lastTapTime = now;
      }
    }

    this._pointers.delete(e.pointerId);
    if (this._pointers.size === 0) this._tapStart = null;
  }

  _onWheel(e) {
    this._adjustZoom(e.deltaY * 0.015);
  }

  // ── moon label ────────────────────────────────────────────────────────────────

  _showMoonLabel(name) {
    const existing = document.querySelector('.moon-label');
    if (existing) {
      clearTimeout(existing._fadeTimer);
      clearTimeout(existing._removeTimer);
      existing.remove();
    }
    const label = document.createElement('div');
    label.className = 'moon-label';
    label.textContent = `🌙 ${name}`;
    document.body.appendChild(label);
    label._fadeTimer   = setTimeout(() => label.classList.add('fade'), 2000);
    label._removeTimer = setTimeout(() => label.remove(), 2900);
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
    this.audio.narrate(`${this.planet.key === 'sun' ? 'Visiting' : 'Landing on'} ${this.planet.name}!`);
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
    document.querySelector('.moon-label')?.remove();
    this.scene.remove(this.root);
    disposeGroup(this.root);
  }
}

function easeIn(t) { return t * t; }
