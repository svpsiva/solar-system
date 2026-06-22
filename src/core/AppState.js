// Tiny state machine that owns the three views and switches between them.
// Shares one Renderer / Loop / Audio across all views.

import { Renderer } from './Renderer.js';
import { Loop } from './Loop.js';
import { Audio } from './Audio.js';
import { SolarSystemView } from '../views/SolarSystemView.js';
import { PlanetView } from '../views/PlanetView.js';
import { SurfaceView } from '../views/SurfaceView.js';
import { Controls } from '../ui/Controls.js';

export const VIEW = {
  SOLAR: 'SOLAR',
  PLANET: 'PLANET',
  SURFACE: 'SURFACE',
};

export class AppState {
  constructor(canvas, uiRoot) {
    this.renderer = new Renderer(canvas);
    this.loop = new Loop();
    this.audio = new Audio();
    this.controls = new Controls(uiRoot, this);

    this.current = null; // active view instance
    this.currentName = null;
    this.currentPlanet = null; // planet config when in PLANET/SURFACE

    // wire the per-frame update
    this.loop.add((dt, t) => {
      if (this.current && this.current.update) this.current.update(dt, t);
      this.renderer.render();
    });
  }

  start() {
    this.loop.start();
    this.go(VIEW.SOLAR);
  }

  // Switch views. `planet` is the planet config for PLANET/SURFACE views.
  go(viewName, planet = this.currentPlanet) {
    if (this.current && this.current.dispose) this.current.dispose();
    this.currentPlanet = planet;
    this.currentName = viewName;

    const ctx = {
      renderer: this.renderer,
      audio: this.audio,
      controls: this.controls,
      app: this,
    };

    if (viewName === VIEW.SOLAR) {
      this.current = new SolarSystemView(ctx);
    } else if (viewName === VIEW.PLANET) {
      this.current = new PlanetView(ctx, planet);
    } else if (viewName === VIEW.SURFACE) {
      this.current = new SurfaceView(ctx, planet);
    }

    this.current.enter();
    this.controls.render(viewName, planet);
  }
}
