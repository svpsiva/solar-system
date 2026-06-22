import { VIEW } from '../core/AppState.js';

// Builds the big toddler-friendly HTML button overlay, rebuilt for each view.
// Talks to the currently-active view instance via app.current.
export class Controls {
  constructor(root, app) {
    this.root = root;
    this.app = app;
  }

  get view() {
    return this.app.current;
  }

  render(viewName, planet) {
    this.root.innerHTML = '';
    if (viewName === VIEW.SOLAR) this._renderSolar();
    else if (viewName === VIEW.PLANET) this._renderPlanet(planet);
    else if (viewName === VIEW.SURFACE) this._renderSurface(planet);
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

  // ---- per-view layouts ------------------------------------------------
  _renderSolar() {
    const top = this._bar('top');
    const title = document.createElement('div');
    title.className = 'title-chip';
    title.textContent = "Astro's Space Adventure";
    top.appendChild(title);

    top.appendChild(this._button('⛶', {
      onClick: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().then(() => {
            screen.orientation?.lock?.('landscape').catch(() => {});
          }).catch(() => {});
        } else {
          document.exitFullscreen?.();
        }
      },
    }));

    const bottom = this._bar('bottom');

    // speed control
    const speedWrap = document.createElement('div');
    speedWrap.className = 'speed-wrap';
    const slow = document.createElement('span');
    slow.textContent = '🐢';
    const fast = document.createElement('span');
    fast.textContent = '🐇';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '5';
    slider.step = '0.1';
    slider.value = '1';
    slider.className = 'speed-slider';
    slider.addEventListener('input', () => {
      this.view?.setTimeScale?.(parseFloat(slider.value));
    });
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
