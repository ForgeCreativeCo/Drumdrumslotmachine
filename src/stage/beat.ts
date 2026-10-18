import { audio } from '../audio/drums';

/** One tempo for music and motion: lanterns, LEDs and pulses all read this clock. */
export const beat = {
  bpm: 116,
  /** Beats elapsed on the audio clock. */
  beats(): number {
    return (audio.now() * this.bpm) / 60;
  },
  /** 0..1 position within the current beat. */
  phase(): number {
    const b = this.beats();
    return b - Math.floor(b);
  },
  /** 1 on the beat, decaying towards 0 before the next. */
  pulse(sharpness = 6): number {
    return Math.exp(-this.phase() * sharpness);
  },
};
