// requestAnimationFrame loop providing a clamped delta time (seconds).
// Subscribers are called every frame with (dt, elapsed).

export class Loop {
  constructor() {
    this.callbacks = new Set();
    this.last = performance.now();
    this.elapsed = 0;
    this.running = false;
    this._tick = this._tick.bind(this);
  }

  add(cb) {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this._tick);
  }

  _tick(now) {
    if (!this.running) return;
    // clamp dt so tab-switching doesn't make planets jump across the system
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    this.elapsed += dt;
    for (const cb of this.callbacks) cb(dt, this.elapsed);
    requestAnimationFrame(this._tick);
  }
}
