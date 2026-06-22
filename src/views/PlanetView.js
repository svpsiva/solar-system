import * as THREE from 'three';
import { VIEW } from '../core/AppState.js';
import { createPlanet } from '../objects/Planet.js';
import { createMoon } from '../objects/Moon.js';
import { createStars } from '../objects/Stars.js';
import { createRocket } from '../objects/Rocket.js';
import { disposeGroup } from './SolarSystemView.js';

// Close-up of one planet: detailed planet, orbiting moons, rings.
// Moons/rings can be toggled. "Land" descends to the surface view.
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

    // detailed planet at the origin
    this.planetGroup = createPlanet(this.planet, { detail: 'high', withRings: true });
    this.root.add(this.planetGroup);

    // moons
    this.moonGroup = new THREE.Group();
    (this.planet.moons || []).forEach((m, i) => {
      const moon = createMoon(m, (i / Math.max(1, this.planet.moons.length)) * Math.PI * 2);
      this.moonGroup.add(moon.pivot);
      this.moons.push(moon);
    });
    this.root.add(this.moonGroup);

    // little rocket orbiting nearby for story flavour
    this.rocket = createRocket();
    this.rocket.scale.setScalar(0.5);
    this.root.add(this.rocket);

    scene.add(this.root);

    // frame the planet
    const d = this.planet.radius * 4.5 + 4;
    this.camera.position.set(0, d * 0.35, d);
    this.camera.lookAt(0, 0, 0);

    this.audio.narrate(`${this.planet.narration.name} ${this.planet.narration.fact}`);
  }

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

  update(dt, t) {
    if (this.planetGroup.userData.spin) this.planetGroup.userData.spin(dt, 0.4);
    if (this.showMoons) this.moons.forEach((m) => m.update(dt, 0.6));
    if (this.stars.userData.twinkle) this.stars.userData.twinkle(t);
    if (this.rocket.userData.animateFlame) this.rocket.userData.animateFlame(t);

    // rocket orbits the planet
    const r = this.planet.radius * 2.6 + 2;
    this.rocket.position.set(Math.cos(t * 0.6) * r, Math.sin(t * 0.3) * 1.5, Math.sin(t * 0.6) * r);
    this.rocket.lookAt(0, 0, 0);

    if (this.landing) {
      const l = this.landing;
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      // dive the camera toward the planet surface
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
    this.scene.remove(this.root);
    disposeGroup(this.root);
  }
}

function easeIn(t) {
  return t * t;
}
