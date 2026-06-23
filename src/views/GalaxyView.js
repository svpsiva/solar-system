import * as THREE from 'three';

// ── constants ────────────────────────────────────────────────────────────────
const ARMS        = 4;       // spiral arm count
const STARS_ARM   = 12000;   // stars per arm
const STARS_BULGE = 8000;    // central bulge stars
const STARS_HALO  = 4000;    // sparse outer halo stars
const GALAXY_R    = 500;     // galaxy radius in scene units
const SUN_OFFSET  = 0.52;    // Sun is ~26k ly from centre, galaxy R ~50k ly → 52%

// Camera: starts above our solar system position and pulls out to top-down galaxy view.
const CAM_START = new THREE.Vector3(SUN_OFFSET * GALAXY_R * 0.18, 30, SUN_OFFSET * GALAXY_R * 0.18);
const CAM_END   = new THREE.Vector3(0, GALAXY_R * 1.8, 120);

export class GalaxyView {
  constructor(ctx) {
    this._ctx   = ctx;
    this.app    = ctx.app;
    this.audio  = ctx.audio;
    this.scene  = ctx.renderer.scene;
    this.camera = ctx.renderer.camera;

    this.root  = new THREE.Group();
    this._t    = 0;          // elapsed time
    this._zoom = 0;          // 0 = zoomed-in start, 1 = full galaxy view

    this._onPointerDown   = this._onPointerDown.bind(this);
    this._onPointerMove   = this._onPointerMove.bind(this);
    this._onPointerUp     = this._onPointerUp.bind(this);
    this._onPointerCancel = this._onPointerUp.bind(this);
    this._onWheel         = this._onWheel.bind(this);

    this._pointers  = new Map();
    this._camYaw    = 0;
    this._camPitch  = Math.PI / 2.5;
    this._camDist   = GALAXY_R * 2.0;
    this._panTarget = new THREE.Vector3(0, 0, 0);

    this._labelEl = null;
  }

  enter() {
    this.scene.background = new THREE.Color(0x000005);

    // Extend far clip so the full galaxy (r=500, cam up to ~2000 away) is visible.
    this._prevFar = this.camera.far;
    this.camera.far = 8000;
    this.camera.updateProjectionMatrix();

    this._buildGalaxy();
    this._buildSunMarker();

    this.scene.add(this.root);

    // Start camera near the solar system and animate out.
    this.camera.position.copy(CAM_START);
    this.camera.lookAt(0, 0, 0);
    this._zoom = 0;

    const dom = this._ctx.renderer.renderer.domElement;
    dom.addEventListener('pointerdown',   this._onPointerDown);
    dom.addEventListener('pointermove',   this._onPointerMove);
    dom.addEventListener('pointerup',     this._onPointerUp);
    dom.addEventListener('pointercancel', this._onPointerCancel);
    dom.addEventListener('wheel',         this._onWheel, { passive: true });
    this._dom = dom;

    this._buildLabel();

    this.audio.narrate(
      'Zoom out to the Milky Way! Our whole solar system is just one tiny dot among 400 billion stars.'
    );
  }

  // ── galaxy geometry ──────────────────────────────────────────────────────────

  _buildGalaxy() {
    const positions = [];
    const colors    = [];
    const sizes     = [];
    const rng       = mulberry32(42);

    // Colour palettes
    const armPalette  = [
      [0.95, 0.92, 1.00],  // blue-white hot young star
      [1.00, 0.95, 0.80],  // warm white
      [0.70, 0.80, 1.00],  // blue-ish
      [1.00, 0.85, 0.60],  // yellowish
    ];
    const bulgePalette = [
      [1.00, 0.85, 0.55],  // old golden
      [1.00, 0.75, 0.40],  // orange
      [1.00, 0.95, 0.70],  // pale yellow
    ];

    // Spiral arms
    for (let arm = 0; arm < ARMS; arm++) {
      const armAngle = (arm / ARMS) * Math.PI * 2;
      for (let i = 0; i < STARS_ARM; i++) {
        const t      = rng();                        // 0..1 along arm
        const r      = 30 + t * GALAXY_R * 0.95;    // distance from centre
        const spiral = armAngle + t * Math.PI * 3.2; // rotation along arm
        const spread = (0.06 + t * 0.14) * r;       // arm width grows with r
        const dx     = (rng() - 0.5) * spread;
        const dz     = (rng() - 0.5) * spread;
        const dy     = (rng() - 0.5) * spread * 0.18 * (1 - t * 0.6); // thin disk

        positions.push(
          Math.cos(spiral) * r + dx,
          dy,
          Math.sin(spiral) * r + dz
        );

        const pal = armPalette[Math.floor(rng() * armPalette.length)];
        // stars further from centre are redder (older)
        const redShift = t * 0.35;
        colors.push(
          pal[0] - redShift * 0.15,
          pal[1] - redShift * 0.05,
          pal[2] - redShift * 0.40
        );
        sizes.push(1.2 + rng() * 2.5);
      }
    }

    // Central bulge — dense round cluster
    for (let i = 0; i < STARS_BULGE; i++) {
      const r   = Math.pow(rng(), 1.6) * GALAXY_R * 0.22;
      const phi = rng() * Math.PI * 2;
      const el  = (rng() - 0.5) * Math.PI;
      positions.push(
        Math.cos(phi) * Math.cos(el) * r,
        Math.sin(el)  * r * 0.5,
        Math.sin(phi) * Math.cos(el) * r
      );
      const pal = bulgePalette[Math.floor(rng() * bulgePalette.length)];
      colors.push(pal[0], pal[1], pal[2]);
      sizes.push(1.5 + rng() * 3.5);
    }

    // Outer halo — sparse and blue
    for (let i = 0; i < STARS_HALO; i++) {
      const r   = GALAXY_R * (0.8 + rng() * 0.6);
      const phi = rng() * Math.PI * 2;
      const el  = (rng() - 0.5) * Math.PI * 0.45;
      positions.push(
        Math.cos(phi) * Math.cos(el) * r,
        Math.sin(el)  * r * 0.2,
        Math.sin(phi) * Math.cos(el) * r
      );
      colors.push(0.65 + rng() * 0.3, 0.70 + rng() * 0.25, 0.85 + rng() * 0.15);
      sizes.push(0.8 + rng() * 1.5);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors,    3));
    geo.setAttribute('size',     new THREE.Float32BufferAttribute(sizes,     1));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */`
        attribute float size;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (320.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */`
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.08, d);
          gl_FragColor = vec4(vColor * (0.85 + alpha * 0.15), alpha * 0.9);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this._starsMat = mat;
    const points = new THREE.Points(geo, mat);
    this.root.add(points);

    // Glowing core billboard
    const coreTex = _makeGlowTexture(256, [1.0, 0.75, 0.35]);
    const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex,
      color: 0xffcc66,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    const coreSize = GALAXY_R * 0.32;
    coreSprite.scale.set(coreSize, coreSize * 0.55, 1);
    this.root.add(coreSprite);

    // Wide faint disk glow
    const diskTex = _makeGlowTexture(256, [0.4, 0.3, 0.6]);
    const diskSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: diskTex,
      color: 0x8866cc,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.25,
    }));
    diskSprite.scale.set(GALAXY_R * 2.6, GALAXY_R * 0.35, 1);
    this.root.add(diskSprite);
  }

  _buildSunMarker() {
    // Our solar system: arm 0, ~52% out
    const t       = SUN_OFFSET;
    const arm     = 0;
    const armAngle= (arm / ARMS) * Math.PI * 2;
    const r       = 30 + t * GALAXY_R * 0.95;
    const spiral  = armAngle + t * Math.PI * 3.2;
    const sunX    = Math.cos(spiral) * r;
    const sunZ    = Math.sin(spiral) * r;

    this._sunPos = new THREE.Vector3(sunX, 0, sunZ);

    // Bright pulsing dot
    const geo = new THREE.SphereGeometry(2.5, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff88 });
    const dot = new THREE.Mesh(geo, mat);
    dot.position.copy(this._sunPos);
    this.root.add(dot);
    this._sunDot = dot;

    // Glow around it
    const glowTex = _makeGlowTexture(128, [1.0, 1.0, 0.5]);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffffaa,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.scale.set(20, 20, 1);
    glow.position.copy(this._sunPos);
    this.root.add(glow);
    this._sunGlow = glow;

    // Ring indicator
    const ringGeo = new THREE.RingGeometry(8, 10, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffff44,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(this._sunPos);
    this.root.add(ring);
    this._sunRing = ring;
  }

  _buildLabel() {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:10',
      'bottom:110px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.65)',
      'color:#ffe87a',
      "font-family:'Comic Sans MS',system-ui,sans-serif",
      'font-size:clamp(13px,2vw,18px)',
      'font-weight:700',
      'padding:8px 18px',
      'border-radius:20px',
      'border:1px solid rgba(255,232,122,0.4)',
      'text-align:center',
      'white-space:nowrap',
      'opacity:0',
      'transition:opacity 0.8s ease',
    ].join(';');
    el.textContent = '☀️ You Are Here';
    document.body.appendChild(el);
    this._labelEl = el;
    // Fade in after zoom settles
    setTimeout(() => { if (this._labelEl) this._labelEl.style.opacity = '1'; }, 3000);
  }

  // ── pointer / wheel handlers ─────────────────────────────────────────────────

  _onPointerDown(e) {
    this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  _onPointerMove(e) {
    if (!this._pointers.has(e.pointerId)) return;

    if (this._pointers.size === 2) {
      const ids     = [...this._pointers.keys()];
      const otherId = ids.find((id) => id !== e.pointerId);
      const other   = this._pointers.get(otherId);
      const prev    = this._pointers.get(e.pointerId);
      const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const cur = this._pointers.get(e.pointerId);
      const newDist = Math.hypot(cur.x - other.x, cur.y - other.y);
      this._camDist = Math.max(50, Math.min(GALAXY_R * 4, this._camDist + (prevDist - newDist) * 2));
      this._applyCamera();
    } else {
      const prev = this._pointers.get(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (prev) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        this._camYaw   += dx * 0.005;
        this._camPitch  = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this._camPitch - dy * 0.005));
        this._applyCamera();
      }
    }
  }

  _onPointerUp(e) {
    this._pointers.delete(e.pointerId);
  }

  _onWheel(e) {
    this._camDist = Math.max(50, Math.min(GALAXY_R * 4, this._camDist + e.deltaY * 0.5));
    this._applyCamera();
  }

  _applyCamera() {
    if (this._zoom < 1) return; // let the intro animation control the camera
    const r = this._camDist;
    const x = r * Math.sin(this._camPitch) * Math.sin(this._camYaw);
    const y = r * Math.cos(this._camPitch);
    const z = r * Math.sin(this._camPitch) * Math.cos(this._camYaw);
    this.camera.position.copy(this._panTarget).add(new THREE.Vector3(x, y, z));
    this.camera.lookAt(this._panTarget);
  }

  // ── update loop ──────────────────────────────────────────────────────────────

  update(dt, t) {
    this._t += dt;

    // Intro zoom-out: ease from solar-system proximity to galaxy overview (~4 s).
    if (this._zoom < 1) {
      this._zoom = Math.min(1, this._zoom + dt / 4.0);
      const k = easeOut(this._zoom);
      this.camera.position.lerpVectors(CAM_START, CAM_END, k);
      this.camera.lookAt(0, 0, 0);

      if (this._zoom >= 1) {
        // Snap camera state to current position so user can then orbit freely.
        this._camDist   = this.camera.position.length();
        this._camPitch  = Math.acos(this.camera.position.y / this._camDist);
        this._camYaw    = Math.atan2(this.camera.position.x, this.camera.position.z);
      }
    }

    // Slowly rotate the galaxy disk
    this.root.rotation.y = t * 0.012;

    // Pulse the Sun marker
    const pulse = 0.85 + Math.sin(t * 2.5) * 0.15;
    this._sunDot.scale.setScalar(pulse);
    this._sunGlow.scale.setScalar(20 * (1 + Math.sin(t * 2.5) * 0.2));
    this._sunRing.material.opacity = 0.4 + Math.sin(t * 2.0) * 0.25;
    // Counter-rotate ring so it stays flat relative to world even as galaxy rotates
    this._sunRing.rotation.z = -this.root.rotation.y;
  }

  dispose() {
    if (this._dom) {
      this._dom.removeEventListener('pointerdown',   this._onPointerDown);
      this._dom.removeEventListener('pointermove',   this._onPointerMove);
      this._dom.removeEventListener('pointerup',     this._onPointerUp);
      this._dom.removeEventListener('pointercancel', this._onPointerCancel);
      this._dom.removeEventListener('wheel',         this._onWheel);
    }
    if (this._prevFar !== undefined) {
      this.camera.far = this._prevFar;
      this.camera.updateProjectionMatrix();
    }
    this._labelEl?.remove();
    this._labelEl = null;
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      obj.geometry?.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _makeGlowTexture(size, [r, g, b]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0,   `rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},1)`);
  grad.addColorStop(0.3, `rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},0.4)`);
  grad.addColorStop(1,   `rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
