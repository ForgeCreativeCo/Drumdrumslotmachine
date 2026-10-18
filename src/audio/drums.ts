/**
 * Every sound in the game is synthesized here with Web Audio, so there are no
 * audio assets to load or license. The music bed and stings aim at the modern
 * "Japanese casino" sound: sub-heavy drums, koto and shamisen lines over a
 * bass and pad, and harp-like shimmers on wins.
 */

// In-scale (miyako-bushi) pentatonic on D, for koto-style stings.
const IN_SCALE = [293.66, 311.13, 392.0, 440.0, 466.16, 587.33, 622.25, 783.99, 880.0, 932.33];

// Bass roots, low enough to sit under the drums.
const D2 = 73.42;
const EB2 = 77.78;
const G1 = 49.0;
const A1 = 55.0;
const BB1 = 58.27;

const _ = -1;

export class DrumAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  /** Bus for the music bed, so stings can duck it. */
  private bed!: GainNode;
  /** Where new voices connect: the master, or the bed while the groove schedules. */
  private out!: AudioNode;
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
      // Brick-wall limiter last, so stacked booms and stings never clip.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.1;
      this.master.connect(comp).connect(limiter).connect(this.ctx.destination);
      this.master.connect(this.hall(comp));
      this.bed = this.ctx.createGain();
      this.bed.connect(this.master);
      this.out = this.master;
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  /** Temple-hall reverb send into `dest`: a decaying noise impulse, with the sub kept dry. Returns its input. */
  private hall(dest: AudioNode): AudioNode {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 250;
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    hp.connect(conv).connect(wet).connect(dest);
    return hp;
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
    g.connect(this.out);
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
    this.tone(t, 'sine', 62, 40, 0.4 * vel, 0.8, 0.008);
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
    this.boom(t, 0.5 * vel);
  }

  /** Cinematic sub boom: a falling sine with a low rumble under it. */
  boom(at?: number, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    this.tone(t, 'sine', 70, 28, 0.45 * vel, 1.8, 0.01);
    this.tone(t, 'triangle', 110, 55, 0.1 * vel, 0.6, 0.005);
    this.noiseBurst(t, 140, 0.7, 0.25 * vel, 1.2, 'lowpass');
  }

  /** Harp-like glissando across the in-scale, `notes` long; falls instead when `up` is false. */
  shimmer(at?: number, up = true, notes = 12, vel = 1): void {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const all = [...IN_SCALE, ...IN_SCALE.map((f) => f * 2)];
    const run = up ? all.slice(-notes) : all.slice(-notes).reverse();
    run.forEach((f, i) => {
      const at2 = t + i * 0.028;
      this.tone(at2, 'sine', f, f, 0.07 * vel, 0.9, 0.002);
      this.tone(at2, 'triangle', f * 2, f * 2, 0.025 * vel, 0.35, 0.002);
    });
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

  /** Shamisen-like pluck: a bachi snap, then a bright buzzing string that dulls fast. */
  shamisen(at: number, freq: number, vel = 1): void {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(7000, at);
    f.frequency.exponentialRampToValueAtTime(freq * 2.5, at + 0.22);
    f.connect(this.env(at, 0.13 * vel, 0.002, 0.4));
    for (const cents of [0, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = cents;
      o.frequency.setValueAtTime(freq * 1.03, at);
      o.frequency.exponentialRampToValueAtTime(freq, at + 0.03);
      o.connect(f);
      o.start(at);
      o.stop(at + 0.5);
    }
    this.noiseBurst(at, 5000, 2, 0.12 * vel, 0.012);
  }

  /** Sub bass note with a soft upper harmonic so it still reads on phone speakers. */
  bass(at: number, freq: number, vel = 1, len = 0.4): void {
    this.tone(at, 'sine', freq, freq, 0.45 * vel, len, 0.008);
    this.tone(at, 'triangle', freq * 2, freq * 2, 0.12 * vel, len * 0.6, 0.006);
  }

  /** Soft, slow-swelling pad on the root, held for `len` seconds. */
  pad(at: number, freq: number, vel: number, len: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vel, at + len * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    g.connect(this.out);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    f.connect(g);
    for (const [mul, cents] of [[4, -8], [4, 8], [8, 0]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = cents;
      o.frequency.value = freq * mul;
      o.connect(f);
      o.start(at);
      o.stop(at + len + 0.05);
    }
  }

  /** Pull the music bed down under a sting for `seconds`, then bring it back. */
  private duck(seconds: number): void {
    const t = this.ctx!.currentTime;
    const g = this.bed.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.3, t, 0.03);
    g.setTargetAtTime(1, t + seconds, 0.3);
  }

  /** Tempo of the running groove; stings and accents snap to its grid. */
  bpm = 116;

  /** Audio time of the next grid line, `div` lines per beat (2 = eighths). */
  nextGrid(div = 2): number {
    const now = this.now();
    const step = 60 / this.bpm / div;
    return Math.ceil((now + 0.02) / step) * step;
  }

  /**
   * Koto win jingle, landing on the beat grid. `size` 0..3 grows it from a
   * three-note lift to a two-phrase fanfare with a held chord, boom and shimmer.
   */
  winSting(size = 0): void {
    if (!this.ctx) return;
    const t = this.nextGrid(2);
    const step = 60 / this.bpm / 4;
    const phrases = [
      [2, 3, 5],
      [2, 3, 5, _, 7],
      [0, 2, 3, 5, 3, 5, 7, 9],
      [0, 2, 3, 5, 3, 5, 7, _, 5, 7, 8, 9],
    ];
    const notes = phrases[Math.min(3, size)];
    notes.forEach((n, i) => n !== _ && this.pluck(t + i * step, IN_SCALE[n], 1 + size * 0.1));
    const end = t + notes.length * step;
    this.duck(end - this.ctx.currentTime + 0.8);
    if (size >= 1) {
      this.bass(end, D2, 0.8, 0.9);
      this.shimmer(end, true, 6 + size * 3, 0.6 + size * 0.2);
    }
    if (size >= 2) {
      this.don(end, 0.9);
      this.boom(end, 0.5 + (size - 2) * 0.4);
      for (const n of [5, 7, 9]) this.pluck(end, IN_SCALE[n], 0.8);
    }
    if (size >= 3) this.kane(end, 0.8);
  }

  /** A rising run for each step of the win climb (tier 0..2). */
  climbSting(tier: number): void {
    if (!this.ctx) return;
    const t = this.nextGrid(2);
    const step = 60 / this.bpm / 4;
    for (let i = 0; i < 6; i++) this.pluck(t + i * step, IN_SCALE[Math.min(IN_SCALE.length - 1, tier * 2 + i)], 1.2);
    this.gong(t, 0.6 + tier * 0.2);
    this.don(t, 1);
    this.shimmer(t + 6 * step, true, 10 + tier * 3, 0.8);
    this.duck(6 * step + 1.5);
  }

  // Each groove is a four-bar loop in eighths: drums, a bass line on the bar's
  // root, a pad, and a melody (in-scale indices, _ for a rest).
  private grooves = {
    // Gentle base-game festival: don on the bar, a lazy koto tune over it.
    festival: {
      pattern: 'D.......k...D.k.',
      gain: 0.35,
      kaneEvery: 32,
      roots: [D2, BB1, G1, A1],
      bassSteps: 'B.....B.',
      bassVel: 0.35,
      voice: 'koto',
      melodyVel: 0.55,
      padVel: 0.05,
      melody: [5, _, 3, _, 2, _, 3, _, 4, _, _, 3, _, _, 2, _, 5, _, 6, _, 5, _, 3, _, 2, _, _, _, 0, _, _, _],
    },
    // Driving storm groove for the bonus: a shamisen ostinato over a pushing bass.
    storm: {
      pattern: 'D.kDD.kkD.kDDkDk',
      gain: 1,
      kaneEvery: 16,
      roots: [D2, EB2, D2, BB1],
      bassSteps: 'B..B..B.',
      bassVel: 0.7,
      voice: 'shamisen',
      melodyVel: 0.7,
      padVel: 0.06,
      melody: [5, 3, 5, 2, 5, 3, 4, 3, 6, 4, 6, 3, 6, 4, 5, 4, 5, 3, 5, 2, 5, 7, 6, 5, 4, 2, 4, 1, 4, 3, 2, _],
    },
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
      this.out = this.bed;
      while (i * step < this.ctx.currentTime + 0.25) {
        const at = i * step;
        if (at >= this.ctx.currentTime) {
          const c = g.pattern[i % g.pattern.length];
          if (c === 'D') this.don(at, 0.45 * g.gain);
          else if (c === 'k') this.ka(at, 0.35 * g.gain);
          if (i % g.kaneEvery === 0) this.kane(at, 0.4 * g.gain);
          if (i % 4 === 2) this.shime(at, 0.15 * g.gain);
          const root = g.roots[Math.floor(i / 8) % g.roots.length];
          if (g.bassSteps[i % 8] === 'B') this.bass(at, root, g.bassVel, step * 2.5);
          if (i % 8 === 0) this.pad(at, root, g.padVel, step * 8);
          const n = g.melody[i % g.melody.length];
          if (n !== _) {
            if (g.voice === 'koto') this.pluck(at, IN_SCALE[n], g.melodyVel);
            else this.shamisen(at, IN_SCALE[n], g.melodyVel);
          }
        }
        i++;
      }
      this.out = this.master;
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
