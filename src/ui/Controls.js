import { VIEW } from '../core/AppState.js';

// Builds the big toddler-friendly HTML button overlay, rebuilt for each view.
// Talks to the currently-active view instance via app.current.
export class Controls {
  constructor(root, app) {
    this.root = root;
    this.app  = app;
    this._fsListeners = [];
  }

  get view() { return this.app.current; }

  render(viewName, planet) {
    // Remove any lingering fullscreen event listeners from a previous solar render.
    this._fsListeners.forEach(([ev, fn]) => {
      document.removeEventListener(ev, fn);
      document.removeEventListener('webkit' + ev, fn);
    });
    this._fsListeners = [];

    this.root.innerHTML = '';
    if (viewName === VIEW.SOLAR)         this._renderSolar();
    else if (viewName === VIEW.SOLAR_2D) this._renderSolar2D();
    else if (viewName === VIEW.GALAXY)   this._renderGalaxy();
    else if (viewName === VIEW.PLANET)   this._renderPlanet(planet);
    else if (viewName === VIEW.SURFACE)  this._renderSurface(planet);
  }

  // ---- helpers ---------------------------------------------------------
  _button(label, { className = '', onClick } = {}) {
    const btn = document.createElement('button');
    btn.className = `big-btn ${className}`;
    btn.innerHTML = label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.app.audio.sfx('pop');
      onClick?.(btn);
    });
    return btn;
  }

  _toggle(labelOn, labelOff, initial, onChange) {
    let on = initial;
    const btn = this._button(on ? labelOn : labelOff, {
      className: `toggle ${on ? 'on' : 'off'}`,
      onClick: () => {
        on = !on;
        btn.innerHTML = on ? labelOn : labelOff;
        btn.classList.toggle('on', on);
        btn.classList.toggle('off', !on);
        onChange(on);
      },
    });
    return btn;
  }

  _backToSpace() {
    return this._button('🚀 Back to Space', {
      className: 'back',
      onClick: () => this.app.go(VIEW.SOLAR),
    });
  }

  _bar(position) {
    const bar = document.createElement('div');
    bar.className = `control-bar ${position}`;
    this.root.appendChild(bar);
    return bar;
  }

  // ---- fullscreen helper -----------------------------------------------
  _fullscreenBtn() {
    const btn = document.createElement('button');
    btn.className = 'big-btn';

    const updateLabel = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      btn.textContent = inFs ? '✕ Exit Full' : '⛶';
    };
    updateLabel();

    const onChange = () => updateLabel();
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    this._fsListeners.push(['fullscreenchange', onChange], ['webkitfullscreenchange', onChange]);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const el = document.documentElement;
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
      if (!inFs) {
        // Use safe-navigation to handle iOS Safari where the method doesn't exist.
        const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
        req?.()
          .then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
          .catch(() => {});
      } else {
        (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
      }
    });

    return btn;
  }

  // ---- per-view layouts ------------------------------------------------
  _renderSolar() {
    const top = this._bar('top');
    const title = document.createElement('div');
    title.className = 'title-chip';
    title.textContent = "Astro's Space Adventure";
    top.appendChild(title);
    top.appendChild(this._button('🗺️ 2D Map', { onClick: () => this.app.go(VIEW.SOLAR_2D) }));
    top.appendChild(this._button('🌌 Galaxy', { onClick: () => this.app.go(VIEW.GALAXY) }));
    top.appendChild(this._fullscreenBtn());

    const bottom = this._bar('bottom');

    const speedWrap = document.createElement('div');
    speedWrap.className = 'speed-wrap';
    const slow = document.createElement('span'); slow.textContent = '🐢';
    const fast = document.createElement('span'); fast.textContent = '🐇';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '5';
    slider.step = '0.1';   slider.value = '1';
    slider.className = 'speed-slider';
    slider.addEventListener('input', () => this.view?.setTimeScale?.(parseFloat(slider.value)));
    speedWrap.append(slow, slider, fast);

    const pause = this._toggle('⏸️', '▶️', true, (running) => {
      this.view?.setTimeScale?.(running ? parseFloat(slider.value) : 0);
    });

    const asteroids = this._toggle('🪨 Asteroids: ON', '🪨 Asteroids: OFF', false, (on) =>
      this.view?.toggleAsteroids?.(on)
    );
    const comets = this._toggle('☄️ Comets: ON', '☄️ Comets: OFF', false, (on) =>
      this.view?.toggleComets?.(on)
    );

    bottom.append(speedWrap, pause, asteroids, comets);
  }

  _renderGalaxy() {
    const top = this._bar('top');
    const title = document.createElement('div');
    title.className = 'title-chip';
    title.textContent = 'Milky Way Galaxy';
    top.appendChild(title);
    top.appendChild(this._button('🚀 Back to Space', {
      className: 'back',
      onClick: () => this.app.go(VIEW.SOLAR),
    }));
    top.appendChild(this._fullscreenBtn());
  }

  _renderSolar2D() {
    const top = this._bar('top');
    const title = document.createElement('div');
    title.className = 'title-chip';
    title.textContent = 'Solar System';
    top.appendChild(title);
    top.appendChild(this._button('🌌 3D View', { onClick: () => this.app.go(VIEW.SOLAR) }));
    top.appendChild(this._fullscreenBtn());
  }

  _renderPlanet(planet) {
    const top = this._bar('top');
    const name = document.createElement('div');
    name.className = 'title-chip';
    name.textContent = planet.name;
    top.appendChild(name);
    top.appendChild(this._backToSpace());

    const bottom = this._bar('bottom');

    if (planet.moons && planet.moons.length) {
      bottom.appendChild(
        this._toggle('🌙 Moons: ON', '🌙 Moons: OFF', true, (on) => this.view?.toggleMoons?.(on))
      );
    }
    if (planet.hasRings) {
      bottom.appendChild(
        this._toggle('💍 Rings: ON', '💍 Rings: OFF', true, (on) => this.view?.toggleRings?.(on))
      );
    }
    const landLabel = planet.key === 'sun' ? '☀️ Visit!' : '🛬 Land!';
    bottom.appendChild(
      this._button(landLabel, { className: 'land', onClick: () => this.view?.land?.() })
    );
  }

  _renderSurface(planet) {
    const top = this._bar('top');
    const name = document.createElement('div');
    name.className = 'title-chip';
    name.textContent = `On ${planet.name}`;
    top.appendChild(name);

    const bottom = this._bar('bottom');
    bottom.appendChild(
      this._button('🪐 Back to Planet', {
        className: 'back',
        onClick: () => this.app.go(VIEW.PLANET, planet),
      })
    );
    bottom.appendChild(this._backToSpace());
  }
}
