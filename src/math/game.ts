import { evaluateWays, findScatters, scatterPay, type WayWin } from './evaluate';
import { BASE_REELS, FREE_REELS, REELS, ROWS, spinGrid, type Grid } from './reels';
import type { Rng } from './rng';

export const FREE_SPINS_AWARD: Record<number, number> = { 3: 6, 4: 8, 5: 10 };
export const RETRIGGER_SPINS = 5;
export const STICKY_MULT_CAP = 2;

export interface Jackpot {
  name: 'Mini' | 'Minor' | 'Major' | 'Grand';
  /** Drum-meter charges needed when the free spins end. */
  need: number;
  /** Award as a multiple of total bet. */
  pay: number;
}

/** Stage 3 "Raijin's Crescendo" tiers, lowest first. */
export const JACKPOTS: Jackpot[] = [
  { name: 'Mini', need: 6, pay: 5 },
  { name: 'Minor', need: 8, pay: 15 },
  { name: 'Major', need: 11, pay: 50 },
  { name: 'Grand', need: 15, pay: 500 },
];

export interface SpinOutcome {
  grid: Grid;
  wins: WayWin[];
  wayWin: number;
  scatters: [number, number][];
  scatterWin: number;
  /** Total win as a multiple of total bet. */
  totalWin: number;
  freeSpinsAwarded: number;
}

export function playBaseSpin(rng: Rng): SpinOutcome {
  const grid = spinGrid(BASE_REELS, rng);
  const { wins, total } = evaluateWays(grid);
  const scatters = findScatters(grid);
  const scatterWin = scatterPay(scatters.length);
  return {
    grid,
    wins,
    wayWin: total,
    scatters,
    scatterWin,
    totalWin: total + scatterWin,
    freeSpinsAwarded: FREE_SPINS_AWARD[Math.min(scatters.length, 5)] ?? 0,
  };
}

export interface StickyWild {
  reel: number;
  row: number;
  mult: number;
}

export interface FreeSpinOutcome {
  /** Final grid with locked wilds overlaid. */
  grid: Grid;
  wins: WayWin[];
  newWilds: StickyWild[];
  sticky: StickyWild[];
  /** Way win before the bonus multiplier. */
  baseWin: number;
  /** Win after the bonus multiplier, as a multiple of total bet. */
  totalWin: number;
  retrigger: number;
  /** Thunder symbols that landed this spin (each charges the drum meter). */
  thunder: [number, number][];
  /** Drum-meter charges after this spin. */
  charges: number;
}

export interface CrescendoOutcome {
  charges: number;
  jackpot: Jackpot | null;
  award: number;
}

/** Stage 2 "Drum Storm": free spins at the earned multiplier, with sticky, growing wilds. */
export class FreeSpinSession {
  spinsLeft: number;
  spinsPlayed = 0;
  totalWin = 0;
  /** Raijin's drum meter: +1 per new locked wild and per Thunder symbol landed. */
  charges = 0;
  private stickyMap = new Map<number, StickyWild>();

  constructor(
    spins: number,
    readonly multiplier: number,
  ) {
    this.spinsLeft = spins;
  }

  get done(): boolean {
    return this.spinsLeft <= 0;
  }

  get sticky(): StickyWild[] {
    return [...this.stickyMap.values()].map((w) => ({ ...w }));
  }

  spin(rng: Rng): FreeSpinOutcome {
    if (this.done) throw new Error('No free spins left');
    this.spinsLeft--;
    this.spinsPlayed++;

    // Every locked wild beats louder: +1x per spin it survives.
    for (const w of this.stickyMap.values()) w.mult = Math.min(STICKY_MULT_CAP, w.mult + 1);

    const grid = spinGrid(FREE_REELS, rng);
    const newWilds: StickyWild[] = [];
    for (let r = 0; r < REELS; r++) {
      for (let row = 0; row < ROWS; row++) {
        const key = r * ROWS + row;
        if (grid[r][row] === 'WILD' && !this.stickyMap.has(key)) {
          const w = { reel: r, row, mult: 1 };
          this.stickyMap.set(key, w);
          newWilds.push({ ...w });
        }
      }
    }

    const wildMults: number[][] = Array.from({ length: REELS }, () => Array(ROWS).fill(0));
    for (const w of this.stickyMap.values()) {
      grid[w.reel][w.row] = 'WILD';
      wildMults[w.reel][w.row] = w.mult;
    }

    const thunder = findScatters(grid);
    this.charges += newWilds.length + thunder.length;
    const retrigger = thunder.length >= 3 ? RETRIGGER_SPINS : 0;
    this.spinsLeft += retrigger;

    const { wins, total } = evaluateWays(grid, wildMults);
    const totalWin = total * this.multiplier;
    this.totalWin += totalWin;

    return {
      grid,
      wins,
      newWilds,
      sticky: this.sticky,
      baseWin: total,
      totalWin,
      retrigger,
      thunder,
      charges: this.charges,
    };
  }

  crescendo(): CrescendoOutcome {
    const jackpot = resolveJackpot(this.charges);
    const award = jackpot?.pay ?? 0;
    this.totalWin += award;
    return { charges: this.charges, jackpot, award };
  }
}

export function resolveJackpot(charges: number): Jackpot | null {
  let best: Jackpot | null = null;
  for (const j of JACKPOTS) if (charges >= j.need) best = j;
  return best;
}
