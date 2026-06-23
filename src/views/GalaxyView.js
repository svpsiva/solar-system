import * as THREE from 'three';

// ── constants ────────────────────────────────────────────────────────────────
const ARMS       = 4;     // spiral arm count (used for sun marker placement)
const GALAXY_R   = 500;   // galaxy radius in scene units
const SUN_OFFSET = 0.52;  // Sun is ~26k ly from centre, galaxy R ~50k ly → 52%

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

    // Load real Milky Way photo as equirectangular background.
    new THREE.TextureLoader().load('./textures/milkyway.jpg', (tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      this.scene.background = tex;
      this._skyTex = tex;
    });

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

    // Slowly rotate the Milky Way background
    this.scene.backgroundRotation.y = t * 0.012;
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
    if (this._skyTex) {
      this._skyTex.dispose();
      this._skyTex = null;
    }
    this.scene.backgroundRotation.y = 0;
    this.scene.remove(this.root);
    this.root.traverse((obj) => {
      obj.geometry?.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => { m.map?.dispose(); m.dispose(); });
        else { obj.material.map?.dispose(); obj.material.dispose(); }
      }
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
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
