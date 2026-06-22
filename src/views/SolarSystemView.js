import * as THREE from 'three';
import { PLANETS } from '../data/planets.js';
import { VIEW } from '../core/AppState.js';
import { createSun } from '../objects/Sun.js';
import { createPlanet } from '../objects/Planet.js';
import { createAsteroidBelt } from '../objects/AsteroidBelt.js';
import { createComet } from '../objects/Comet.js';
import { createRocket } from '../objects/Rocket.js';
import { createStars } from '../objects/Stars.js';

// The main map: sun + orbiting planets, asteroid belt, comets and Astro's
// rocket. Tapping a planet flies the rocket to it and zooms into Planet View.
export class SolarSystemView {
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = ctx.renderer.scene;
    this.camera = ctx.renderer.camera;
    this.audio = ctx.audio;
    this.app = ctx.app;

    this.root = new THREE.Group();
    this.planetPivots = []; // { pivot, group, planet, hit, angle }
    this.timeScale = 1.0;
    this.showAsteroids = false;
    this.showComets = false;
    this.flying = null; // active fly-to animation
    this.transitioning = false;

    this._onPointerDown = this._onPointerDown.bind(this);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
  }

  enter() {
    const scene = this.scene;
    scene.background = new THREE.Color(0x05060f);

    // lighting (sun provides a point light; add a touch of ambient)
    this.ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.root.add(this.ambient);

    this.stars = createStars();
    this.root.add(this.stars);

    this.sun = createSun();
    this.root.add(this.sun);

    // planets on pivots
    for (const planet of PLANETS) {
      const pivot = new THREE.Group();
      const group = createPlanet(planet, { detail: 'low', withRings: true });
      group.position.x = planet.orbitRadius;

      // oversized invisible hit-sphere so toddler taps land easily
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(planet.radius * 2.2, 3.0), 16, 16),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hit.position.x = planet.orbitRadius;
      hit.userData.planet = planet;
      pivot.add(group);
      pivot.add(hit);

      // faint orbit ring
      const ring = makeOrbitRing(planet.orbitRadius);
      this.root.add(ring);

      const angle = Math.random() * Math.PI * 2;
      pivot.rotation.y = angle;
      this.root.add(pivot);
      this.planetPivots.push({ pivot, group, planet, hit });
    }

    // asteroid belt + comets (created but only added when toggled on)
    this.asteroids = createAsteroidBelt();
    this.comets = new THREE.Group();
    this.comets.add(createComet({ a: 95, b: 38, speed: 0.25, phase: 0, tilt: 0.35 }));
    this.comets.add(createComet({ a: 78, b: 50, speed: 0.32, phase: 2, tilt: -0.25 }));

    // rocket idles in the foreground
    this.rocket = createRocket();
    this.rocket.position.set(0, 6, 60);
    this.rocket.scale.setScalar(1.2);
    this.root.add(this.rocket);

    scene.add(this.root);

    // camera home position
    this.camera.position.set(0, 45, 110);
    this.camera.lookAt(0, 0, 0);

    // input
    this.ctx.renderer.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);

    this.audio.narrate("Welcome to space! Tap a planet to fly there with Astro.");
  }

  setTimeScale(v) {
    this.timeScale = v;
  }

  toggleAsteroids(on) {
    this.showAsteroids = on;
    if (on) this.root.add(this.asteroids);
    else this.root.remove(this.asteroids);
    this.audio.sfx('twinkle');
  }

  toggleComets(on) {
    this.showComets = on;
    if (on) this.root.add(this.comets);
    else this.root.remove(this.comets);
    this.audio.sfx('twinkle');
  }

  _onPointerDown(e) {
    if (this.transitioning) return;
    const rect = this.ctx.renderer.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.planetPivots.map((p) => p.hit);
    const intersects = this.raycaster.intersectObjects(hits, false);
    if (intersects.length > 0) {
      const planet = intersects[0].object.userData.planet;
      const entry = this.planetPivots.find((p) => p.planet === planet);
      this._flyTo(entry);
    }
  }

  _flyTo(entry) {
    if (this.transitioning) return;
    this.transitioning = true;
    this.audio.sfx('whoosh');
    this.audio.narrate(entry.planet.narration.name);

    // world position of the planet right now
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

  update(dt, t) {
    const scaled = dt * this.timeScale;

    if (this.sun.userData.spin) this.sun.userData.spin(scaled);
    if (this.stars.userData.twinkle) this.stars.userData.twinkle(t);

    for (const { pivot, group, planet } of this.planetPivots) {
      pivot.rotation.y += scaled * planet.orbitSpeed * 0.15;
      if (group.userData.spin) group.userData.spin(scaled);
      // keep hit sphere aligned with planet (pivot rotates both, so fine)
    }

    if (this.showAsteroids && this.asteroids.userData.update) {
      this.asteroids.userData.update(scaled);
    }
    if (this.showComets) {
      this.comets.children.forEach((c) => c.userData.update && c.userData.update(scaled));
    }

    if (this.rocket.userData.animateFlame) this.rocket.userData.animateFlame(t);

    // fly-to animation
    if (this.flying) {
      const f = this.flying;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e = easeInOut(k);

      // arc the rocket up and over toward the planet
      const pos = f.from.clone().lerp(f.to, e);
      pos.y += Math.sin(e * Math.PI) * 12;
      this.rocket.position.copy(pos);
      this.rocket.lookAt(f.to);

      // camera eases toward the planet too
      const camTarget = f.to.clone().add(new THREE.Vector3(0, 6, 18));
      this.camera.position.lerp(camTarget, 0.04);
      this.camera.lookAt(f.to);

      if (k >= 1) {
        const planet = f.planet;
        this.flying = null;
        this.app.go(VIEW.PLANET, planet);
      }
    } else if (!this.transitioning) {
      // idle bob
      this.rocket.position.y = 6 + Math.sin(t * 1.5) * 0.6;
    }
  }

  dispose() {
    this.ctx.renderer.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
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
      // NOTE: we intentionally do NOT dispose `.map` textures here — planet
      // textures are cached and shared across views (see utils/textures.js).
      mats.forEach((m) => m.dispose());
    }
  });
}
