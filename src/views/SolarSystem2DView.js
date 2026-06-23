import { SUN, PLANETS } from '../data/planets.js';
import { VIEW } from '../core/AppState.js';

// Static 2D map: Sun + 8 planets as large colored circles, ordered left-to-right
// by distance from the Sun. Tap any body to navigate to its Planet View.
// Horizontally scrollable so all planets fit on small screens.
export class SolarSystem2DView {
  constructor(ctx) {
    this.app   = ctx.app;
    this.audio = ctx.audio;
    this._el   = null;
  }

  enter() {
    const el = document.createElement('div');
    el.id = 'solar-2d';
    el.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:5',
      'background:#05060f',
      'display:flex', 'align-items:center', 'justify-content:flex-start',
      'gap:clamp(18px,3.5vw,36px)',
      'padding:80px 32px 90px',   // leave room for top/bottom control bars
      'overflow-x:auto', 'overflow-y:hidden',
      '-webkit-overflow-scrolling:touch',
      'scrollbar-width:none',     // hide scrollbar on Firefox
    ].join(';');

    // Hide WebKit scrollbar
    const style = document.createElement('style');
    style.textContent = '#solar-2d::-webkit-scrollbar{display:none}';
    document.head.appendChild(style);
    this._styleEl = style;

    const all = [SUN, ...PLANETS];
    for (const body of all) {
      el.appendChild(this._makeCard(body));
    }

    // Subtle right-edge hint that more content is scrollable
    const hint = document.createElement('div');
    hint.style.cssText = [
      'position:fixed', 'right:0', 'top:0', 'bottom:0', 'width:40px',
      'background:linear-gradient(to right,transparent,rgba(5,6,15,0.8))',
      'pointer-events:none', 'z-index:6',
    ].join(';');
    document.body.appendChild(hint);
    this._hintEl = hint;

    document.body.appendChild(el);
    this._el = el;

    this.audio.narrate('Tap a planet to explore it!');
  }

  _makeCard(body) {
    // Size proportional to body.radius; Sun is max, small moons-era planets still tap-friendly.
    const MIN = 70, MAX = 140;
    const size = Math.round(MIN + (body.radius / SUN.radius) * (MAX - MIN));

    const card = document.createElement('div');
    card.style.cssText = [
      'display:flex', 'flex-direction:column', 'align-items:center',
      'gap:12px', 'flex-shrink:0', 'cursor:pointer',
      'user-select:none', '-webkit-tap-highlight-color:transparent',
    ].join(';');

    // ── circle ──────────────────────────────────────────────────────────────
    const circle = document.createElement('div');
    const hex    = '#' + body.color.toString(16).padStart(6, '0');
    const isSun  = body.key === 'sun';
    const glow   = isSun
      ? `box-shadow:0 0 ${Math.round(size * 0.55)}px ${Math.round(size * 0.28)}px rgba(255,180,60,0.75),0 0 ${Math.round(size * 0.2)}px ${Math.round(size * 0.1)}px rgba(255,230,100,0.9)`
      : '';
    circle.style.cssText = [
      `width:${size}px`, `height:${size}px`, 'border-radius:50%',
      `background:${hex}`,
      glow,
      'position:relative',
      'display:flex', 'align-items:center', 'justify-content:center',
      'transition:transform 0.1s ease,box-shadow 0.1s ease',
    ].join(';');

    // Saturn rings (horizontal ellipse)
    if (body.key === 'saturn') {
      circle.appendChild(_ring(size, 1.7, 0.38, 'rgba(214,196,130,0.7)', 4));
    }
    // Uranus rings (tilted)
    if (body.key === 'uranus') {
      const r = _ring(size, 1.55, 0.32, 'rgba(159,223,224,0.6)', 3);
      r.style.transform = 'translate(-50%,-50%) rotateX(15deg) rotateZ(90deg)';
      circle.appendChild(r);
    }

    // ── label ────────────────────────────────────────────────────────────────
    const label = document.createElement('div');
    label.textContent = body.name;
    label.style.cssText = [
      'color:#fff',
      "font-family:'Comic Sans MS',system-ui,sans-serif",
      'font-weight:700',
      'font-size:clamp(14px,2.4vw,20px)',
      'text-shadow:0 2px 6px rgba(0,0,0,0.7)',
      'text-align:center', 'white-space:nowrap',
    ].join(';');

    card.appendChild(circle);
    card.appendChild(label);

    // ── interaction ──────────────────────────────────────────────────────────
    card.addEventListener('pointerdown', () => {
      circle.style.transform = 'scale(0.91)';
    });
    card.addEventListener('pointercancel', () => {
      circle.style.transform = '';
    });
    card.addEventListener('pointerup', (e) => {
      // Only fire if pointer didn't scroll (small movement).
      circle.style.transform = '';
      this.audio.sfx('pop');
      this.audio.narrate(body.narration.name);
      this.app.go(VIEW.PLANET, body);
    });

    return card;
  }

  // No Three.js animation needed for the static 2D map.
  update() {}

  dispose() {
    this._el?.remove();
    this._hintEl?.remove();
    this._styleEl?.remove();
    this._el = this._hintEl = this._styleEl = null;
  }
}

// Helper: ring overlay div for Saturn / Uranus
function _ring(size, widthRatio, heightRatio, color, borderPx) {
  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:absolute',
    `width:${Math.round(size * widthRatio)}px`,
    `height:${Math.round(size * heightRatio)}px`,
    'border-radius:50%',
    `border:${borderPx}px solid ${color}`,
    'top:50%', 'left:50%',
    'transform:translate(-50%,-50%) rotateX(72deg)',
    'pointer-events:none',
  ].join(';');
  return ring;
}
