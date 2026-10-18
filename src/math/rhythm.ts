import type { Rng } from './rng';

/** Stage 1 "The Summoning": each judged drum hit builds the bonus multiplier. */
export const RHYTHM = {
  notes: 18,
  min: 1,
  max: 10,
  /** Hit windows in seconds either side of the note. */
  perfectWindow: 0.06,
  goodWindow: 0.13,
};

export type Judgement = 'perfect' | 'good' | 'miss';

export interface RhythmResult {
  perfects: number;
  goods: number;
  misses: number;
  multiplier: number;
}

/** Accuracy score in [0, 1]: a good hit counts half a perfect one. */
export function accuracy(perfects: number, goods: number): number {
  return Math.min(1, (perfects + goods / 2) / RHYTHM.notes);
}

/** Convex curve: a flawless performance earns 10x, an average one about 3x. */
export function multiplierFor(perfects: number, goods: number): number {
  const a = accuracy(perfects, goods);
  const raw = RHYTHM.min + (RHYTHM.max - RHYTHM.min) * a ** 3;
  return Math.round(raw * 2) / 2;
}

/** Hit odds for an average player; also used when the player lets the drums auto-play. */
export const AVERAGE_SKILL = { perfect: 0.4, good: 0.35 };

export function simulateRhythm(rng: Rng, skill = AVERAGE_SKILL): RhythmResult {
  let perfects = 0;
  let goods = 0;
  for (let i = 0; i < RHYTHM.notes; i++) {
    const r = rng();
    if (r < skill.perfect) perfects++;
    else if (r < skill.perfect + skill.good) goods++;
  }
  const misses = RHYTHM.notes - perfects - goods;
  return { perfects, goods, misses, multiplier: multiplierFor(perfects, goods) };
}
