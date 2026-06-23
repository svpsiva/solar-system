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
    this._t    = 0;
    this._zoom = 0;

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

    // Try to load real Milky Way photo as equirectangular background (bonus if it loads).
    new THREE.TextureLoader().load('./textures/milkyway.jpg', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = tex;
      this._skyTex = tex;
    });

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

    const armPalette  = [
      [0.95, 0.92, 1.00],
      [1.00, 0.95, 0.80],
      [0.70, 0.80, 1.00],
      [1.00, 0.85, 0.60],
    ];
    const bulgePalette = [
      [1.00, 0.85, 0.55],
      [1.00, 0.75, 0.40],
      [1.00, 0.95, 0.70],
    ];

    // Spiral arms
    for (let arm = 0; arm < ARMS; arm++) {
      const armAngle = (arm / ARMS) * Math.PI * 2;
      for (let i = 0; i < STARS_ARM; i++) {
        const t      = rng();
        const r      = 30 + t * GALAXY_R * 0.95;
        const spiral = armAngle + t * Math.PI * 3.2;
        const spread = (0.06 + t * 0.14) * r;
        const dx     = (rng() - 0.5) * spread;
        const dz     = (rng() - 0.5) * spread;
        const dy     = (rng() - 0.5) * spread * 0.18 * (1 - t * 0.6);
        positions.push(Math.cos(spiral) * r + dx, dy, Math.sin(spiral) * r + dz);
        const pal = armPalette[Math.floor(rng() * armPalette.length)];
        const redShift = t * 0.35;
        colors.push(pal[0] - redShift * 0.15, pal[1] - redShift * 0.05, pal[2] - redShift * 0.40);
        sizes.push(1.2 + rng() * 2.5);
      }
    }

    // Central bulge
    for (let i = 0; i < STARS_BULGE; i++) {
      const r   = Math.pow(rng(), 1.6) * GALAXY_R * 0.22;
      const phi = rng() * Math.PI * 2;
      const el  = (rng() - 0.5) * Math.PI;
      positions.push(
        Math.cos(phi) * Math.cos(el) * r,
        Math.sin(el) * r * 0.5,
        Math.sin(phi) * Math.cos(el) * r
      );
      const pal = bulgePalette[Math.floor(rng() * bulgePalette.length)];
      colors.push(pal[0], pal[1], pal[2]);
      sizes.push(1.5 + rng() * 3.5);
    }

    // Outer halo
    for (let i = 0; i < STARS_HALO; i++) {
      const r   = GALAXY_R * (0.8 + rng() * 0.6);
      const phi = rng() * Math.PI * 2;
      const el  = (rng() - 0.5) * Math.PI * 0.45;
      positions.push(
        Math.cos(phi) * Math.cos(el) * r,
        Math.sin(el) * r * 0.2,
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
      uniforms: {},
      vertexShader: /* glsl */`
        attribute float size;
        varying vec3 vColor;
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
    this.root.add(new THREE.Points(geo, mat));

    // Glowing core billboard
    const coreTex = _makeGlowTexture(256, [1.0, 0.75, 0.35]);
    const coreSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex, color: 0xffcc66, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    const coreSize = GALAXY_R * 0.32;
    coreSprite.scale.set(coreSize, coreSize * 0.55, 1);
    this.root.add(coreSprite);

    // Wide faint disk glow
    const diskTex = _makeGlowTexture(256, [0.4, 0.3, 0.6]);
    const diskSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: diskTex, color: 0x8866cc, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.25,
    }));
    diskSprite.scale.set(GALAXY_R * 2.6, GALAXY_R * 0.35, 1);
    this.root.add(diskSprite);
  }

  _buildSunMarker() {
    const t        = SUN_OFFSET;
    const armAngle = 0;
    const r        = 30 + t * GALAXY_R * 0.95;
    const spiral   = armAngle + t * Math.PI * 3.2;
    const sunX     = Math.cos(spiral) * r;
    const sunZ     = Math.sin(spiral) * r;

    this._sunPos = new THREE.Vector3(sunX, 0, sunZ);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(2.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff88 })
    );
    dot.position.copy(this._sunPos);
    this.root.add(dot);
    this._sunDot = dot;

    const glowTex = _makeGlowTexture(128, [1.0, 1.0, 0.5]);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffaa, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(20, 20, 1);
    glow.position.copy(this._sunPos);
    this.root.add(glow);
    this._sunGlow = glow;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(8, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0xffff44, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
    );
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
      'background:rgba(0,0,0,0.65)', 'color:#ffe87a',
      "font-family:'Comic Sans MS',system-ui,sans-serif",
      'font-size:clamp(13px,2vw,18px)', 'font-weight:700',
      'padding:8px 18px', 'border-radius:20px',
      'border:1px solid rgba(255,232,122,0.4)',
      'text-align:center', 'white-space:nowrap',
      'opacity:0', 'transition:opacity 0.8s ease',
    ].join(';');
    el.textContent = '☀️ You Are Here';
    document.body.appendChild(el);
    this._labelEl = el;
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
        this._camYaw  += dx * 0.005;
        this._camPitch = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, this._camPitch - dy * 0.005));
        this._applyCamera();
      }
    }
  }

  _onPointerUp(e) { this._pointers.delete(e.pointerId); }

  _onWheel(e) {
    this._camDist = Math.max(50, Math.min(GALAXY_R * 4, this._camDist + e.deltaY * 0.5));
    this._applyCamera();
  }

  _applyCamera() {
    if (this._zoom < 1) return;
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

    if (this._zoom < 1) {
      this._zoom = Math.min(1, this._zoom + dt / 4.0);
      const k = easeOut(this._zoom);
      this.camera.position.lerpVectors(CAM_START, CAM_END, k);
      this.camera.lookAt(0, 0, 0);
      if (this._zoom >= 1) {
        this._camDist  = this.camera.position.length();
        this._camPitch = Math.acos(this.camera.position.y / this._camDist);
        this._camYaw   = Math.atan2(this.camera.position.x, this.camera.position.z);
      }
    }

    this.scene.backgroundRotation.y = t * 0.012;
    this.root.rotation.y = t * 0.012;

    const pulse = 0.85 + Math.sin(t * 2.5) * 0.15;
    this._sunDot.scale.setScalar(pulse);
    this._sunGlow.scale.setScalar(20 * (1 + Math.sin(t * 2.5) * 0.2));
    this._sunRing.material.opacity = 0.4 + Math.sin(t * 2.0) * 0.25;
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
    if (this._skyTex) {
      this._skyTex.dispose();
      this._skyTex = null;
    }
    this.scene.backgroundRotation.y = 0;
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      obj.geometry?.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
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
