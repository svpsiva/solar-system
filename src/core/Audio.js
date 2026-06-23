// Narration (Web Speech API) + procedurally-generated sound effects (Web Audio)
// + a gentle ambient space-music pad.
//
// No audio files are downloaded. Must be unlocked by a user gesture first
// (see init()), because browsers block audio until the user interacts.

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.voice = null;
    this._ready = false;
    this._musicNode = null;
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
      window.speechSynthesis.onvoiceschanged = () => this._pickVoice();
    }
    this._ready = true;
    // Start ambient music after a short delay so the start-screen click doesn't
    // feel too abrupt.
    setTimeout(() => this._startMusic(), 600);
  }

  _pickVoice() {
    if (!window.speechSynthesis) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    // Priority list for the most natural-sounding English voices in Chrome/Edge.
    const priority = [
      (v) => v.name === 'Google UK English Female',
      (v) => v.name === 'Google US English',
      (v) => v.name.startsWith('Google') && /en/i.test(v.lang),
      (v) => /en(-|_)?(US|GB)/i.test(v.lang) && /samantha|karen|moira|fiona/i.test(v.name),
      (v) => /^en/i.test(v.lang) && v.localService === false, // online/neural voices
      (v) => /^en/i.test(v.lang),
      () => true,
    ];

    for (const test of priority) {
      const match = voices.find(test);
      if (match) {
        this.voice = match;
        return;
      }
    }
  }

  // Split on sentence boundaries and speak each piece with a small gap so
  // the voice doesn't run together in one flat monotone block.
  narrate(text) {
    if (!this.enabled || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let delay = 0;
    sentences.forEach((sentence, i) => {
      setTimeout(() => {
        // Don't speak if something else started in the meantime.
        if (i > 0 && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) return;
        const u = new SpeechSynthesisUtterance(sentence);
        if (this.voice) u.voice = this.voice;
        u.rate = 0.82;
        u.pitch = 1.08;
        u.volume = 1.0;
        window.speechSynthesis.speak(u);
      }, delay);
      // ~300 ms between sentences; first one fires immediately.
      delay += 300;
    });
  }

  mute() {
    this.enabled = false;
    window.speechSynthesis?.cancel();
    if (this._musicNode) this._musicNode.masterGain.gain.value = 0;
  }

  unmute() {
    this.enabled = true;
    if (this._musicNode) this._musicNode.masterGain.gain.value = 0.065;
  }

  // Short generated sound effects.
  // name: 'pop' | 'whoosh' | 'twinkle' | 'land'
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

  // Dreamy ambient space-music pad: three pure sine oscillators softly detuned.
  // No LFO — previously an LFO AudioNode was wired to the same AudioParam that
  // also had linearRampToValueAtTime automation scheduled on it, which caused an
  // audible buzz/click (undefined behaviour per the Web Audio spec). Fixed by
  // using only scheduled automation on the gain param, no live AudioNode modulation.
  _startMusic() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === 'suspended') ctx.resume();

    // Master gain: fade in over 5 s, nothing else touches this AudioParam.
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.065, ctx.currentTime + 5);
    masterGain.connect(ctx.destination);

    // Oscillator output gain (static) — the oscillators connect here, not to masterGain,
    // so the fade-in ramp on masterGain.gain is the only thing that ever touches it.
    const oscGain = ctx.createGain();
    oscGain.gain.value = 1.0;
    oscGain.connect(masterGain);

    // Two sine waves a perfect fifth apart, barely detuned for a gentle chorus.
    const specs = [
      { freq: 130.81, detune: -2 }, // C3
      { freq: 196.00, detune:  3 }, // G3
    ];
    const osc = specs.map(({ freq, detune }) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(oscGain);
      return o;
    });

    osc.forEach((o) => o.start());

    this._musicNode = { masterGain, oscGain, osc };
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
