import * as THREE from 'three';
import { PLANETS, SUN } from '../data/planets.js';
import { VIEW } from '../core/AppState.js';
import { createSun } from '../objects/Sun.js';
import { createPlanet } from '../objects/Planet.js';
import { createAsteroidBelt } from '../objects/AsteroidBelt.js';
import { createComet } from '../objects/Comet.js';
import { createRocket } from '../objects/Rocket.js';
import { createStars } from '../objects/Stars.js';

// The main map: sun + orbiting planets, asteroid belt, comets and Astro's
// rocket. Tapping a planet (or the Sun) navigates to Planet View.
// 1-finger drag: orbit-rotate camera. 2-finger pinch: zoom. 2-finger drag: pan.
// Double-tap empty space: re-centre. Mouse wheel: zoom.
export class SolarSystemView {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = ctx.renderer.scene;
    this.camera = ctx.renderer.camera;
    this.audio = ctx.audio;
    this.app = ctx.app;

    this.root = new THREE.Group();
    this.planetPivots = [];
    this.timeScale = 1.0;
    this.showAsteroids = false;
    this.showComets = false;
    this.flying = null;
    this.transitioning = false;

    // Zoom state: 1.0 = default, 0.3 = closest, 2.5 = furthest
    this._zoom = 1.0;

    // Orbit-camera state (spherical coordinates around panTarget)
    // Initial pitch ~22° matches original camera.position(0, 45*z, 110*z)
    this._camYaw   = 0;
    this._camPitch = 0.388;
    this._panTarget = new THREE.Vector3();

    // Pointer tracking: pointerId → {x, y}
    this._pointers  = new Map();
    this._tapStart  = null; // {x, y} of initial single-pointer down
    this._lastTapTime = 0;  // for double-tap re-centre detection

    this.raycaster = new THREE.Raycaster();
    this.pointer   = new THREE.Vector2();

    this._onPointerDown   = this._onPointerDown.bind(this);
    this._onPointerMove   = this._onPointerMove.bind(this);
    this._onPointerUp     = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerUp.bind(this);
    this._onWheel         = this._onWheel.bind(this);
  }

  enter() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x05060f);

    this.ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.root.add(this.ambient);

    this.stars = createStars();
    this.root.add(this.stars);

    this.sun = createSun();
    this.root.add(this.sun);

    // Invisible hit-sphere for the Sun so it can be tapped.
    this.sunHit = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.sunHit.userData.isSun = true;
    this.root.add(this.sunHit);

    for (const planet of PLANETS) {
      const pivot = new THREE.Group();
      const group = createPlanet(planet, { detail: 'low', withRings: true });
      group.position.x = planet.orbitRadius;

      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(planet.radius * 4.0, 5.0), 16, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.x = planet.orbitRadius;
      hit.userData.planet = planet;
      pivot.add(group);
      pivot.add(hit);

      const ring = makeOrbitRing(planet.orbitRadius);
      this.root.add(ring);

      pivot.rotation.y = Math.random() * Math.PI * 2;
      this.root.add(pivot);
      this.planetPivots.push({ pivot, group, planet, hit });
    }

    this.asteroids = createAsteroidBelt();
    this.comets = new THREE.Group();
    this.comets.add(createComet({ a: 95, b: 38, speed: 0.25, phase: 0, tilt: 0.35 }));
    this.comets.add(createComet({ a: 78, b: 50, speed: 0.32, phase: 2, tilt: -0.25 }));

    this.rocket = createRocket();
    this.rocket.position.set(0, 6, 60);
    this.rocket.scale.setScalar(1.2);
    this.root.add(this.rocket);

    scene.add(this.root);

    this._applyCamera();

    const dom = this.ctx.renderer.renderer.domElement;
    dom.addEventListener('pointerdown',   this._onPointerDown);
    dom.addEventListener('pointermove',   this._onPointerMove);
    dom.addEventListener('pointerup',     this._onPointerUp);
    dom.addEventListener('pointercancel', this._onPointerCancel);
    dom.addEventListener('wheel',         this._onWheel, { passive: true });

    if (this.app.isFirstVisit(VIEW.SOLAR)) {
      this.audio.narrate("Welcome to space! Tap a planet to fly there with Astro.");
    }
  }

  // ── camera ───────────────────────────────────────────────────────────────────

  _applyCamera() {
    if (this.flying) return;
    const r = 120 * this._zoom;
    const x = r * Math.cos(this._camPitch) * Math.sin(this._camYaw);
    const y = r * Math.sin(this._camPitch);
    const z = r * Math.cos(this._camPitch) * Math.cos(this._camYaw);
    this.camera.position.copy(this._panTarget).add(new THREE.Vector3(x, y, z));
    this.camera.lookAt(this._panTarget);
  }

  _adjustZoom(delta) {
    this._zoom = Math.max(0.3, Math.min(2.5, this._zoom + delta));
    this._applyCamera();
  }

  // ── pointer / touch event handlers ──────────────────────────────────────────

  _onPointerDown(e) {
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this._pointers.size === 1) {
      this._tapStart = { x: e.clientX, y: e.clientY };
    }
  }

  _onPointerMove(e) {
    if (!this._pointers.has(e.pointerId)) return;

    if (this._pointers.size === 2) {
      // Two-finger gesture: zoom (pinch) + pan (midpoint shift) simultaneously.
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

      // Zoom
      this._adjustZoom((prevDist - newDist) * 0.003);

      // Pan (midpoint shift → world-space translate of look-at target)
      const dmx = newMidX - prevMidX;
      const dmy = newMidY - prevMidY;
      if (Math.abs(dmx) > 0.3 || Math.abs(dmy) > 0.3) {
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        const right = new THREE.Vector3().crossVectors(camDir, this.camera.up).negate().normalize();
        const scale = this._zoom * 0.25;
        this._panTarget.addScaledVector(right, dmx * scale);
        this._panTarget.addScaledVector(this.camera.up, -dmy * scale);
        this._panTarget.clampLength(0, 60);
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
          this._tapStart = null; // too far moved — treat as drag
        }
      } else if (prev) {
        // Drag-to-rotate: orbit camera around panTarget.
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this._camYaw   += dx * 0.005;
        this._camPitch  = Math.max(0.05, Math.min(1.2, this._camPitch - dy * 0.005));
        this._applyCamera();
      }
    }
  }

  _onPointerUp(e) {
    const wasSingleTap =
      this._pointers.size === 1 &&
      this._tapStart !== null &&
      !this.transitioning;

    if (wasSingleTap) {
      const rect = this.ctx.renderer.renderer.domElement.getBoundingClientRect();
      this.pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.pointer, this.camera);

      const allHits   = [...this.planetPivots.map((p) => p.hit), this.sunHit];
      const intersects = this.raycaster.intersectObjects(allHits, false);

      if (intersects.length > 0) {
        const obj = intersects[0].object;
        if (obj.userData.isSun) {
          this.transitioning = true;
          this.audio.sfx('whoosh');
          this.app.go(VIEW.PLANET, SUN);
        } else {
          const planet = obj.userData.planet;
          const entry  = this.planetPivots.find((p) => p.planet === planet);
          this._flyTo(entry);
        }
      } else {
        // Screen-space proximity fallback — find nearest planet within 80px.
        const rect = this.ctx.renderer.renderer.domElement.getBoundingClientRect();
        const tapX = e.clientX - rect.left;
        const tapY = e.clientY - rect.top;
        const THRESH2 = 80 * 80;

        const toScreen = (worldPos) => {
          const v = worldPos.clone().project(this.camera);
          return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height };
        };

        let bestDist = THRESH2;
        let bestEntry = null;

        for (const entry of this.planetPivots) {
          const wp = new THREE.Vector3();
          entry.hit.getWorldPosition(wp);
          const ps = toScreen(wp);
          const d2 = (ps.x - tapX) ** 2 + (ps.y - tapY) ** 2;
          if (d2 < bestDist) { bestDist = d2; bestEntry = entry; }
        }

        const ss = toScreen(new THREE.Vector3(0, 0, 0));
        const sunDist2 = (ss.x - tapX) ** 2 + (ss.y - tapY) ** 2;

        if (sunDist2 < THRESH2 && sunDist2 <= bestDist) {
          this.transitioning = true;
          this.audio.sfx('whoosh');
          this.app.go(VIEW.PLANET, SUN);
        } else if (bestEntry) {
          this._flyTo(bestEntry);
        } else {
          // Double-tap on empty space → re-centre pan.
          const now = performance.now();
          if (now - this._lastTapTime < 400) {
            this._panTarget.set(0, 0, 0);
            this._applyCamera();
            this._lastTapTime = 0;
          } else {
            this._lastTapTime = now;
          }
        }
      }
    }

    this._pointers.delete(e.pointerId);
    if (this._pointers.size === 0) this._tapStart = null;
  }

  _onWheel(e) {
    this._adjustZoom(e.deltaY * 0.001);
  }

  // ── planet / sun selection ───────────────────────────────────────────────────

  _flyTo(entry) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.audio.sfx('whoosh');
    this.audio.narrate(entry.planet.narration.name);

    const target = new THREE.Vector3();
    entry.group.getWorldPosition(target);

    this.flying = {
      planet: entry.planet,
      from: this.rocket.position.clone(),
      to: target,
      t: 0,
      dur: 1.4,
    };
  }

  // ── controls ──────────────────────────────────────────────────────────────────

  setTimeScale(v) { this.timeScale = v; }

  toggleAsteroids(on) {
    this.showAsteroids = on;
    if (on) this.root.add(this.asteroids); else this.root.remove(this.asteroids);
    this.audio.sfx('twinkle');
  }

  toggleComets(on) {
    this.showComets = on;
    if (on) this.root.add(this.comets); else this.root.remove(this.comets);
    this.audio.sfx('twinkle');
  }

  // ── update loop ───────────────────────────────────────────────────────────────

  update(dt, t) {
    const scaled = dt * this.timeScale;

    if (this.sun.userData.spin) this.sun.userData.spin(scaled);
    if (this.stars.userData.twinkle) this.stars.userData.twinkle(t);

    for (const { pivot, group, planet } of this.planetPivots) {
      pivot.rotation.y += scaled * planet.orbitSpeed * 0.15;
      if (group.userData.spin) group.userData.spin(scaled);
    }

    if (this.showAsteroids && this.asteroids.userData.update)
      this.asteroids.userData.update(scaled);

    if (this.showComets)
      this.comets.children.forEach((c) => c.userData.update && c.userData.update(scaled));

    if (this.rocket.userData.animateFlame) this.rocket.userData.animateFlame(t);

    if (this.flying) {
      const f = this.flying;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const ease = easeInOut(k);

      const pos = f.from.clone().lerp(f.to, ease);
      pos.y += Math.sin(ease * Math.PI) * 12;
      this.rocket.position.copy(pos);
      this.rocket.lookAt(f.to);

      const camTarget = f.to.clone().add(new THREE.Vector3(0, 6, 18));
      this.camera.position.lerp(camTarget, 0.04);
      this.camera.lookAt(f.to);

      if (k >= 1) {
        const planet = f.planet;
        this.flying = null;
        this.app.go(VIEW.PLANET, planet);
      }
    } else if (!this.transitioning) {
      this.rocket.position.y = 6 + Math.sin(t * 1.5) * 0.6;
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

function makeOrbitRing(radius) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
  const pts = curve.getPoints(128).map((p) => new THREE.Vector3(p.x, 0, p.y));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color: 0x335577, transparent: true, opacity: 0.35 });
  return new THREE.LineLoop(geo, mat);
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      // Do NOT dispose .map — planet textures are cached in utils/textures.js.
      mats.forEach((m) => m.dispose());
    }
  });
}
