/**
 * Every sound in the game is synthesized here with Web Audio, so there are no
 * audio assets to load or license.
 */

// In-scale (miyako-bushi) pentatonic on D, for koto-style stings.
const IN_SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99, 880.0, 932.33];

export class DrumAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private loopTimer: number | null = null;
  muted = false;

  /** Must be called from a user gesture before anything is audible. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Current audio clock in seconds (falls back to wall clock if audio is unavailable). */
  now(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
  }

  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.master);
    return g;
  }

  private noiseBurst(t: number, freq: number, q: number, peak: number, decay: number, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f).connect(this.env(t, peak, 0.002, decay));
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay + 0.05);
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, peak: number, decay: number, attack = 0.003): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.8);
    o.connect(this.env(t, peak, attack, decay));
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  /** Big drum centre hit ("don"). */
  don(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    this.tone(t, 'sine', 120, 52, 0.9 * vel, 0.55);
    this.tone(t, 'triangle', 190, 90, 0.25 * vel, 0.18);
    this.noiseBurst(t, 600, 0.8, 0.35 * vel, 0.08, 'lowpass');
  }

  /** Rim click ("ka"). */
  ka(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    this.noiseBurst(t, 3200, 3, 0.5 * vel, 0.05);
    this.tone(t, 'square', 900, 700, 0.06 * vel, 0.04);
  }

  /** Tight high shime-daiko. */
  shime(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    this.tone(t, 'sine', 420, 330, 0.35 * vel, 0.12);
    this.noiseBurst(t, 1800, 2, 0.25 * vel, 0.04);
  }

  /** Small hand gong (kane): inharmonic bell partials. */
  kane(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    for (const [f, a] of [[1180, 0.12], [1840, 0.08], [2630, 0.05], [3410, 0.03]] as const) {
      this.tone(t, 'sine', f, f, a * vel, 0.7, 0.001);
    }
  }

  /** Deep temple gong for scatters and the bonus. */
  gong(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    for (const [f, a] of [[82, 0.5], [123.5, 0.3], [167, 0.22], [211, 0.15], [297, 0.1], [409, 0.06]] as const) {
      this.tone(t, 'sine', f * 1.01, f, a * vel, 3.2, 0.02);
    }
    this.noiseBurst(t, 300, 0.5, 0.2 * vel, 0.6, 'lowpass');
  }

  /** Crack of thunder for Raijin's lightning. */
  thunder(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    this.noiseBurst(t, 4000, 0.3, 0.6 * vel, 0.15, 'highpass');
    this.noiseBurst(t + 0.02, 180, 0.4, 0.9 * vel, 1.4, 'lowpass');
    this.tone(t, 'sine', 60, 35, 0.6 * vel, 1.2);
  }

  /** Pachislot lever pull ("gako"): a spring-loaded thunk and a latch click. */
  lever(at?: number): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    this.tone(t, 'sine', 160, 70, 0.45, 0.09);
    this.noiseBurst(t, 900, 1.2, 0.35, 0.05, 'lowpass');
    this.noiseBurst(t + 0.045, 4200, 4, 0.4, 0.025);
    this.tone(t + 0.045, 'square', 1500, 1300, 0.05, 0.02);
  }

  /** Stop-button clack ("kachi"), a step higher on each reel, under a soft drum. */
  reelStop(index: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 2600 + index * 300, 5, 0.45, 0.03);
    this.tone(t, 'square', 700 + index * 90, 600 + index * 80, 0.07, 0.03);
    this.don(t, 0.3 + index * 0.04);
  }

  /**
   * キュイン ("kyuin"): the premium sound that confirms a bonus. A detuned stack
   * sweeps up an octave and a half, then shimmers with a fast vibrato.
   */
  kyuin(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = at ?? ctx.currentTime;
    const sweep = 0.14;
    const end = t + 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.02);
    g.gain.setValueAtTime(0.16 * vel, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2500, t);
    f.frequency.exponentialRampToValueAtTime(9000, t + sweep);
    f.frequency.exponentialRampToValueAtTime(3500, end);
    f.connect(g).connect(this.master);
    const vib = ctx.createOscillator();
    vib.frequency.value = 15;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + sweep);
    depth.gain.linearRampToValueAtTime(0.025, t + sweep + 0.1);
    vib.connect(depth);
    for (const [type, cents, mul] of [['square', -9, 1], ['sawtooth', 9, 1], ['sine', 0, 2]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.detune.value = cents;
      o.frequency.setValueAtTime(700 * mul, t);
      o.frequency.exponentialRampToValueAtTime(2350 * mul, t + sweep);
      o.frequency.exponentialRampToValueAtTime(2200 * mul, t + sweep + 0.08);
      // Vibrato as a ratio of the pitch, so it sounds the same on every layer.
      const v = ctx.createGain();
      v.gain.value = 2200 * mul;
      depth.connect(v).connect(o.frequency);
      o.connect(f);
      o.start(t);
      o.stop(end + 0.05);
    }
    vib.start(t);
    vib.stop(end + 0.05);
    this.kane(t + sweep, 0.9 * vel);
  }

  /**
   * Freeze (フリーズ): the groove stops dead, the cabinet powers down with a
   * falling whine, then silence. Returns how long it lasts in seconds.
   */
  freeze(): number {
    this.stopLoop();
    if (!this.ctx) return 1.6;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const fall = 0.9;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(5000, t);
    f.frequency.exponentialRampToValueAtTime(120, t + fall);
    f.connect(this.env(t, 0.22, 0.005, fall));
    for (const cents of [-12, 12]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = cents;
      o.frequency.setValueAtTime(330, t);
      o.frequency.exponentialRampToValueAtTime(28, t + fall);
      o.connect(f);
      o.start(t);
      o.stop(t + fall + 0.05);
    }
    this.tone(t, 'sine', 90, 30, 0.5, fall);
    this.noiseBurst(t, 6000, 0.7, 0.3, 0.06, 'highpass');
    return 1.6;
  }

  /** Chance-up rise: a swelling, climbing whine under an anticipation roll. */
  chanceRise(duration = 1.4): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const end = t + duration;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, end - 0.05);
    g.gain.linearRampToValueAtTime(0, end);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(5000, end);
    f.connect(g).connect(this.master);
    for (const cents of [-10, 10]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = cents;
      o.frequency.setValueAtTime(IN_SCALE[0] / 2, t);
      o.frequency.exponentialRampToValueAtTime(IN_SCALE[5], end);
      o.connect(f);
      o.start(t);
      o.stop(end + 0.02);
    }
  }

  /** Accelerating drum roll, used for anticipation. Returns its length in seconds. */
  roll(duration = 1.4): number {
    if (!this.ctx) return duration;
    const t0 = this.ctx.currentTime;
    let t = 0;
    let gap = 0.12;
    while (t < duration) {
      this.shime(t0 + t, 0.4 + 0.6 * (t / duration));
      t += gap;
      gap = Math.max(0.035, gap * 0.93);
    }
    return duration;
  }

  /** Koto-like pluck. */
  pluck(at: number, freq: number, vel = 1): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 8, at);
    f.frequency.exponentialRampToValueAtTime(freq * 1.5, at + 0.4);
    o.connect(f).connect(this.env(at, 0.18 * vel, 0.004, 0.9));
    o.start(at);
    o.stop(at + 1);
  }

  /** Tempo of the running groove; stings and accents snap to its grid. */
  bpm = 116;

  /** Audio time of the next grid line, `div` lines per beat (2 = eighths). */
  nextGrid(div = 2): number {
    const now = this.now();
    const step = 60 / this.bpm / div;
    return Math.ceil((now + 0.02) / step) * step;
  }

  /** Short rising koto sting, landing on the beat grid; `size` 0..3 makes it longer. */
  winSting(size = 0): void {
    if (!this.ctx) return;
    const t = this.nextGrid(2);
    const step = 60 / this.bpm / 4;
    const notes = [0, 2, 3, 5, 7, 9].slice(0, 3 + size);
    notes.forEach((n, i) => this.pluck(t + i * step, IN_SCALE[n]));
    if (size >= 2) this.don(t + notes.length * step, 0.9);
  }

  /** A rising run for each step of the win climb (tier 0..2). */
  climbSting(tier: number): void {
    if (!this.ctx) return;
    const t = this.nextGrid(2);
    const step = 60 / this.bpm / 4;
    for (let i = 0; i < 6; i++) this.pluck(t + i * step, IN_SCALE[Math.min(IN_SCALE.length - 1, tier * 2 + i)], 1.2);
    this.gong(t, 0.6 + tier * 0.2);
    this.don(t, 1);
  }

  private grooves = {
    // Gentle base-game festival: don on the bar, soft rim and shime.
    festival: { pattern: 'D.......k...D.k.', gain: 0.35, kaneEvery: 32 },
    // Driving storm groove for the bonus.
    storm: { pattern: 'D.kDD.kkD.kDDkDk', gain: 1, kaneEvery: 16 },
  };
  private groove: keyof DrumAudio['grooves'] | null = null;

  /** Start (or switch) the groove; it is locked to the same beat grid as the visuals. */
  startLoop(style: 'festival' | 'storm', bpm: number): void {
    if (!this.ctx) return;
    if (this.groove === style && this.loopTimer !== null && this.bpm === bpm) return;
    this.stopLoop();
    this.bpm = bpm;
    this.groove = style;
    const g = this.grooves[style];
    const step = 60 / bpm / 2;
    let i = Math.ceil(this.ctx.currentTime / step);
    const schedule = () => {
      if (!this.ctx) return;
      while (i * step < this.ctx.currentTime + 0.25) {
        const at = i * step;
        if (at >= this.ctx.currentTime) {
          const c = g.pattern[i % g.pattern.length];
          if (c === 'D') this.don(at, 0.45 * g.gain);
          else if (c === 'k') this.ka(at, 0.35 * g.gain);
          if (i % g.kaneEvery === 0) this.kane(at, 0.4 * g.gain);
          if (i % 4 === 2) this.shime(at, 0.15 * g.gain);
        }
        i++;
      }
    };
    schedule();
    this.loopTimer = window.setInterval(schedule, 60);
  }

  stopLoop(): void {
    if (this.loopTimer !== null) window.clearInterval(this.loopTimer);
    this.loopTimer = null;
    this.groove = null;
  }
}

export const audio = new DrumAudio();
