import { describe, expect, it } from 'vitest';
import { evaluateWays, findScatters } from '../src/math/evaluate';
import { FreeSpinSession, JACKPOTS, STICKY_MULT_CAP, playBaseSpin, resolveJackpot } from '../src/math/game';
import { BASE_REELS, FREE_REELS, ROWS, type Grid } from '../src/math/reels';
import { RHYTHM, multiplierFor, simulateRhythm } from '../src/math/rhythm';
import { mulberry32 } from '../src/math/rng';
import { PAYTABLE, type SymbolId } from '../src/math/symbols';

/** Build a grid from rows (as you'd see it on screen) for readability. */
function fromRows(rows: SymbolId[][]): Grid {
  return rows[0].map((_, r) => rows.map((row) => row[r]));
}

describe('evaluateWays', () => {
  it('pays a simple 3-reel way', () => {
    const grid = fromRows([
      ['ONI', 'ONI', 'ONI', 'ZENI', 'KOI'],
      ['ZENI', 'KOI', 'SAKURA', 'BACHI', 'ZENI'],
      ['BACHI', 'SAKURA', 'KOI', 'SAKURA', 'BACHI'],
    ]);
    const { wins, total } = evaluateWays(grid);
    const oni = wins.find((w) => w.symbol === 'ONI')!;
    expect(oni.reels).toBe(3);
    expect(oni.ways).toBe(1);
    expect(oni.pay).toBeCloseTo(PAYTABLE.ONI[3]);
    expect(total).toBeGreaterThanOrEqual(oni.pay);
  });

  it('multiplies ways by symbol counts per reel and substitutes wilds', () => {
    const grid = fromRows([
      ['KOI', 'KOI', 'WILD', 'KOI', 'ONI'],
      ['KOI', 'ZENI', 'SAKURA', 'ZENI', 'BACHI'],
      ['ZENI', 'KOI', 'BACHI', 'SAKURA', 'OGI'],
    ]);
    const koi = evaluateWays(grid).wins.find((w) => w.symbol === 'KOI')!;
    expect(koi.reels).toBe(4);
    expect(koi.ways).toBe(2 * 2 * 1 * 1);
    expect(koi.pay).toBeCloseTo(PAYTABLE.KOI[4] * 4);
  });

  it('does not pay fewer than 3 reels', () => {
    const grid = fromRows([
      ['ONI', 'ONI', 'ZENI', 'ZENI', 'KOI'],
      ['RYU', 'KOI', 'SAKURA', 'BACHI', 'ZENI'],
      ['BACHI', 'SAKURA', 'KOI', 'SAKURA', 'BACHI'],
    ]);
    expect(evaluateWays(grid).wins.find((w) => w.symbol === 'ONI')).toBeUndefined();
  });

  it('applies the largest wild multiplier on each way', () => {
    const grid = fromRows([
      ['ONI', 'WILD', 'WILD', 'ZENI', 'KOI'],
      ['RYU', 'ONI', 'SAKURA', 'BACHI', 'ZENI'],
      ['BACHI', 'SAKURA', 'KOI', 'SAKURA', 'BACHI'],
    ]);
    const mults = [
      [0, 0, 0],
      [3, 0, 0],
      [2, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const oni = evaluateWays(grid, mults).wins.find((w) => w.symbol === 'ONI')!;
    // Ways: ONI-WILD(3)-WILD(2) -> 3, ONI-ONI-WILD(2) -> 2.
    expect(oni.ways).toBe(2);
    expect(oni.multiplier).toBe(5);
    expect(oni.pay).toBeCloseTo(PAYTABLE.ONI[3] * 5);
  });
});

describe('reel strips', () => {
  it('never shows two scatters on one reel', () => {
    for (const strip of [...BASE_REELS, ...FREE_REELS]) {
      for (let stop = 0; stop < strip.length; stop++) {
        let n = 0;
        for (let row = 0; row < ROWS; row++) if (strip[(stop + row) % strip.length] === 'SCATTER') n++;
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps wilds off reel 1', () => {
    expect(BASE_REELS[0]).not.toContain('WILD');
    expect(FREE_REELS[0]).not.toContain('WILD');
  });
});

describe('base game', () => {
  it('awards free spins for 3+ scatters', () => {
    const rng = mulberry32(5);
    let triggered = 0;
    for (let i = 0; i < 20000; i++) {
      const o = playBaseSpin(rng);
      expect(o.freeSpinsAwarded > 0).toBe(o.scatters.length >= 3);
      expect(findScatters(o.grid)).toHaveLength(o.scatters.length);
      if (o.freeSpinsAwarded) triggered++;
    }
    expect(triggered).toBeGreaterThan(0);
  });
});

describe('free spins', () => {
  it('keeps wilds locked and grows their multipliers up to the cap', () => {
    const rng = mulberry32(11);
    const s = new FreeSpinSession(40, 3);
    const seen = new Map<string, number>();
    while (!s.done) {
      const o = s.spin(rng);
      for (const w of o.sticky) {
        const key = `${w.reel},${w.row}`;
        expect(o.grid[w.reel][w.row]).toBe('WILD');
        const prev = seen.get(key);
        if (prev !== undefined) expect(w.mult).toBe(Math.min(STICKY_MULT_CAP, prev + 1));
        seen.set(key, w.mult);
      }
      expect(o.totalWin).toBeCloseTo(o.baseWin * 3);
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('counts new wilds and thunder symbols as drum-meter charges', () => {
    const rng = mulberry32(3);
    const s = new FreeSpinSession(10, 1);
    let expected = 0;
    while (!s.done) {
      const o = s.spin(rng);
      expected += o.newWilds.length + o.thunder.length;
      expect(o.charges).toBe(expected);
    }
    const c = s.crescendo();
    expect(c.charges).toBe(expected);
    expect(c.jackpot).toEqual(resolveJackpot(expected));
  });

  it('resolves the highest jackpot reached', () => {
    expect(resolveJackpot(0)).toBeNull();
    for (const j of JACKPOTS) expect(resolveJackpot(j.need)?.name).toBe(j.name);
    expect(resolveJackpot(999)?.name).toBe('Grand');
  });
});

describe('rhythm', () => {
  it('spans 1x to 10x', () => {
    expect(multiplierFor(0, 0)).toBe(RHYTHM.min);
    expect(multiplierFor(RHYTHM.notes, 0)).toBe(RHYTHM.max);
  });

  it('rewards better play', () => {
    expect(multiplierFor(12, 4)).toBeGreaterThan(multiplierFor(8, 4));
    expect(multiplierFor(8, 6)).toBeGreaterThan(multiplierFor(8, 2));
  });

  it('simulates within range', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 1000; i++) {
      const r = simulateRhythm(rng);
      expect(r.perfects + r.goods + r.misses).toBe(RHYTHM.notes);
      expect(r.multiplier).toBeGreaterThanOrEqual(RHYTHM.min);
      expect(r.multiplier).toBeLessThanOrEqual(RHYTHM.max);
    }
  });
});
