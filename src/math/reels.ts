import { mulberry32, pickInt, type Rng } from './rng';
import type { SymbolId } from './symbols';

export const REELS = 5;
export const ROWS = 3;

/** grid[reel][row] */
export type Grid = SymbolId[][];

type Counts = Partial<Record<SymbolId, number>>;

/**
 * Expand symbol counts into a strip and shuffle it deterministically, so the
 * strips are fixed (and the maths reproducible) without hand-writing them.
 * Reshuffles until no two scatters can show in the same 3-row window.
 */
export function buildStrip(counts: Counts, seed: number): SymbolId[] {
  const strip: SymbolId[] = [];
  for (const [id, n] of Object.entries(counts) as [SymbolId, number][]) {
    for (let i = 0; i < n; i++) strip.push(id);
  }
  const rng = mulberry32(seed);
  do {
    for (let i = strip.length - 1; i > 0; i--) {
      const j = pickInt(rng, i + 1);
      [strip[i], strip[j]] = [strip[j], strip[i]];
    }
  } while (!scattersSpaced(strip));
  return strip;
}

function scattersSpaced(strip: SymbolId[]): boolean {
  const n = strip.length;
  for (let i = 0; i < n; i++) {
    if (strip[i] !== 'SCATTER') continue;
    for (let d = 1; d < ROWS; d++) if (strip[(i + d) % n] === 'SCATTER') return false;
  }
  return true;
}

// Wilds never appear on reel 1, so every way starts on a natural symbol.
const BASE_COUNTS: Counts[] = [
  { ONI: 2, RYU: 3, KOI: 3, OGI: 4, BACHI: 6, CHOCHIN: 6, SAKURA: 7, ZENI: 8, SCATTER: 1 },
  { ONI: 2, RYU: 3, KOI: 3, OGI: 4, BACHI: 6, CHOCHIN: 6, SAKURA: 7, ZENI: 7, WILD: 1, SCATTER: 1 },
  { ONI: 2, RYU: 3, KOI: 3, OGI: 4, BACHI: 6, CHOCHIN: 6, SAKURA: 7, ZENI: 7, WILD: 1, SCATTER: 2 },
  { ONI: 2, RYU: 3, KOI: 3, OGI: 4, BACHI: 6, CHOCHIN: 6, SAKURA: 7, ZENI: 7, WILD: 1, SCATTER: 1 },
  { ONI: 2, RYU: 3, KOI: 3, OGI: 4, BACHI: 6, CHOCHIN: 6, SAKURA: 7, ZENI: 7, WILD: 1, SCATTER: 1 },
];

// Free-spin strips: low-symbol heavy so the multipliers do the heavy lifting,
// with extra Thunder symbols to charge Raijin's drum meter.
const FREE_COUNTS: Counts[] = [
  { ONI: 1, RYU: 2, KOI: 2, OGI: 3, BACHI: 9, CHOCHIN: 9, SAKURA: 10, ZENI: 10, SCATTER: 2 },
  { ONI: 1, RYU: 2, KOI: 2, OGI: 3, BACHI: 9, CHOCHIN: 9, SAKURA: 10, ZENI: 10, WILD: 1, SCATTER: 2 },
  { ONI: 1, RYU: 2, KOI: 2, OGI: 3, BACHI: 9, CHOCHIN: 9, SAKURA: 10, ZENI: 10, WILD: 1, SCATTER: 2 },
  { ONI: 1, RYU: 2, KOI: 2, OGI: 3, BACHI: 9, CHOCHIN: 9, SAKURA: 10, ZENI: 10, WILD: 1, SCATTER: 2 },
  { ONI: 1, RYU: 2, KOI: 2, OGI: 3, BACHI: 9, CHOCHIN: 9, SAKURA: 10, ZENI: 10, WILD: 1, SCATTER: 2 },
];

export const BASE_REELS: SymbolId[][] = BASE_COUNTS.map((c, i) => buildStrip(c, 1000 + i));
export const FREE_REELS: SymbolId[][] = FREE_COUNTS.map((c, i) => buildStrip(c, 2000 + i));

export function spinGrid(reels: SymbolId[][], rng: Rng): Grid {
  return reels.map((strip) => {
    const stop = pickInt(rng, strip.length);
    return Array.from({ length: ROWS }, (_, row) => strip[(stop + row) % strip.length]);
  });
}

/** Random symbol from a strip, for filler cells while reels spin. */
export function randomSymbol(reel: number, rng: Rng, free = false): SymbolId {
  const strip = (free ? FREE_REELS : BASE_REELS)[reel];
  return strip[pickInt(rng, strip.length)];
}
