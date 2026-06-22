// Narration (Web Speech API) + procedurally-generated sound effects (Web Audio).
// No audio files are downloaded. Must be unlocked by a user gesture first
// (see init()), because browsers block audio until the user interacts.

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.voice = null;
    this._ready = false;
  }

  // Call from the first user tap.
  init() {
    if (this._ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    } catch (e) {
      this.ctx = null;
    }
    this._pickVoice();
    if (window.speechSynthesis) {
      // voices can load asynchronously
      window.speechSynthesis.onvoiceschanged = () => this._pickVoice();
    }
    this._ready = true;
  }

  _pickVoice() {
    if (!window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    // prefer an English voice; favour ones that sound friendly/female if present
    const preferred =
      voices.find((v) => /en(-|_)?(US|GB)/i.test(v.lang) && /female|samantha|google/i.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0];
    this.voice = preferred;
  }

  narrate(text) {
    if (!this.enabled || !text || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.rate = 0.9;
      u.pitch = 1.15;
      u.volume = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      /* speech not available — silently ignore */
    }
  }

  // Short generated sound effects. name: 'pop' | 'whoosh' | 'twinkle' | 'land'
  sfx(name) {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();
    const now = ctx.currentTime;

    if (name === 'pop') {
      this._tone(440, 660, 0.12, 'sine', now, 0.25);
    } else if (name === 'whoosh') {
      this._noise(0.5, now, 0.18);
    } else if (name === 'twinkle') {
      this._tone(880, 1320, 0.18, 'triangle', now, 0.15);
      this._tone(1320, 1760, 0.18, 'triangle', now + 0.08, 0.12);
    } else if (name === 'land') {
      this._tone(220, 110, 0.4, 'sine', now, 0.3);
    }
  }

  _tone(f0, f1, dur, type, start, gainPeak) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  _noise(dur, start, gainPeak) {
    const ctx = this.ctx;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, start);
    filter.frequency.linearRampToValueAtTime(2000, start + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainPeak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(start);
    src.stop(start + dur);
  }
}
