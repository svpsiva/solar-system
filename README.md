# 🚀 Astro's Space Adventure

An interactive 3D solar-system game built for toddlers (≈2 years old). Join **Astro
the astronaut** as he flies his rocket through space to explore the planets!

Built with [Three.js](https://threejs.org/) + [Vite](https://vitejs.dev/). Everything
is generated **procedurally** — no asset downloads — so it runs offline and loads fast.

## Getting started

```bash
npm install
npm run dev      # open the printed URL in a browser
```

Other scripts:

```bash
npm run build    # production build into dist/
npm run preview  # serve the production build
```

Tap **"Let's Go!"** on the start screen (this also enables sound — browsers require a
tap before audio can play).

## How to play

The game has three views and the rocket carries the child between them.

### 🌞 Solar System
- The Sun sits in the middle with all 8 planets orbiting around it.
- 🐢/🐇 **Speed slider** and a **pause/play** button control how fast everything moves.
- **🪨 Asteroids** and **☄️ Comets** toggle buttons add or remove the asteroid belt and comets.
- **Tap any planet** → Astro's rocket flies over to it and zooms into the Planet view.

### 🪐 Planet view
- A detailed, close-up planet slowly spinning, with its **moons** orbiting and any **rings**.
- **🌙 Moons** and **💍 Rings** toggle buttons hide/show them.
- A friendly spoken fact plays for each planet.
- **🛬 Land!** sends the rocket down to the surface.

### 🏜️ Surface view
- Walk around a procedurally-generated landscape colored for that planet
  (red Mars, grey Moon, and so on).
- **Tap the ground** to send the astronaut walking there; **drag** to look around.

A **🚀 Back to Space** button is always visible so a toddler can never get stuck.

## Accessibility for non-readers
- **Spoken narration** (browser Web Speech API) announces planet names and fun facts.
- **Sound effects** (Web Audio, generated on the fly) for taps, rocket whooshes and landings.
- **Big, colorful, forgiving buttons** with generous tap areas, and oversized invisible
  hit-spheres around planets so small taps still land.

## Project structure

```
src/
  core/      Renderer, Loop, Audio, AppState (view state machine)
  data/      planets.js — single source of truth for all bodies
  objects/   Sun, Planet, Rocket, Astronaut, Moon, Rings, AsteroidBelt, Comet, Terrain, Stars
  views/     SolarSystemView, PlanetView, SurfaceView
  ui/        Controls — the big-button HTML overlay
  utils/     noise.js, textures.js — procedural generation
styles/      style.css
public/textures/  optional drop-in for real NASA textures (see its README)
```
