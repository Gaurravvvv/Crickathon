/* ========== CricPulse — Sound Effects Engine ========== */

/**
 * SoundFX: Manages cricket match sound effects.
 * Uses Web Audio API to generate synthetic sounds
 * (no external audio files needed).
 */
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
  }

  _getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.ctx;
  }

  _playTone(freq, duration, type = 'sine', vol = null) {
    if (!this.enabled) return;
    const ctx = this._getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime((vol || this.volume) * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // --- Sound Effects ---

  /** Crowd cheer for boundary/six */
  cheer() {
    if (!this.enabled) return;
    // Multiple tones = crowd effect
    [400, 500, 600, 800].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.6, 'sawtooth', 0.15), i * 50);
    });
    // Rising excitement
    setTimeout(() => {
      [600, 700, 800, 900, 1000].forEach((f, i) => {
        setTimeout(() => this._playTone(f, 0.3, 'square', 0.1), i * 60);
      });
    }, 200);
  }

  /** Big hit celebration (6!) */
  bigSix() {
    if (!this.enabled) return;
    // Impact sound
    this._playTone(100, 0.3, 'sawtooth', 0.4);
    setTimeout(() => {
      this._playTone(150, 0.2, 'square', 0.3);
    }, 100);
    // Celebration ascending
    setTimeout(() => {
      [300, 400, 500, 600, 700, 800, 1000].forEach((f, i) => {
        setTimeout(() => this._playTone(f, 0.4, 'triangle', 0.2), i * 80);
      });
    }, 300);
  }

  /** Wicket fall — dramatic */
  wicket() {
    if (!this.enabled) return;
    // Descending dramatic tones
    [800, 600, 400, 300, 200].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.5, 'sawtooth', 0.2), i * 120);
    });
  }

  /** Dot ball — quiet tick */
  dot() {
    this._playTone(300, 0.1, 'sine', 0.1);
  }

  /** Correct prediction — success chime */
  success() {
    if (!this.enabled) return;
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.3, 'sine', 0.25), i * 120);
    });
  }

  /** Wrong prediction */
  fail() {
    if (!this.enabled) return;
    [400, 300].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.3, 'sine', 0.2), i * 200);
    });
  }

  /** Countdown tick */
  tick() {
    this._playTone(800, 0.05, 'square', 0.1);
  }

  /** Countdown warning (last 5 seconds) */
  tickUrgent() {
    this._playTone(1000, 0.08, 'square', 0.15);
  }

  /** DRS review suspense */
  drs() {
    if (!this.enabled) return;
    // Suspenseful repeating tone
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this._playTone(500 + (i * 50), 0.15, 'triangle', 0.2);
      }, i * 300);
    }
    // Final reveal
    setTimeout(() => {
      this._playTone(800, 0.5, 'sine', 0.3);
    }, 2000);
  }

  /** Room join / notification */
  notify() {
    [660, 880].forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.15, 'sine', 0.2), i * 100);
    });
  }

  /** Podium / game over celebration */
  podium() {
    if (!this.enabled) return;
    const notes = [523, 587, 659, 698, 784, 880, 988, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this._playTone(f, 0.4, 'triangle', 0.2), i * 100);
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
  }
}

window.soundFX = new SoundFX();
