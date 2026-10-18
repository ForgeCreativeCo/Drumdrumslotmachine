import { PAYING_SYMBOLS, PAYTABLE, SCATTER_PAY, type SymbolId } from './symbols';
import { REELS, type Grid } from './reels';

export interface WayWin {
  symbol: SymbolId;
  /** Number of consecutive reels matched from the left. */
  reels: 3 | 4 | 5;
  ways: number;
  /** Sum of every way's multiplier (equals `ways` when no wild multipliers apply). */
  multiplier: number;
  /** Payout as a multiple of total bet. */
  pay: number;
  positions: [reel: number, row: number][];
}

export interface Evaluation {
  wins: WayWin[];
  /** Total way pay as a multiple of total bet. */
  total: number;
}

/**
 * Evaluate a grid on 243 ways (left to right, adjacent reels).
 *
 * When `wildMults` is given (free spins), each way is multiplied by the
 * largest multiplier among the wilds on it, or 1 if it has none.
 */
export function evaluateWays(grid: Grid, wildMults?: number[][] | null): Evaluation {
  const wins: WayWin[] = [];
  let total = 0;

  for (const symbol of PAYING_SYMBOLS) {
    // Per reel, the multiplier each matching position contributes (1 for a natural).
    const reelMults: number[][] = [];
    const positions: [number, number][] = [];

    for (let r = 0; r < REELS; r++) {
      const mults: number[] = [];
      grid[r].forEach((s, row) => {
        if (s === symbol) {
          mults.push(1);
          positions.push([r, row]);
        } else if (s === 'WILD') {
          mults.push(Math.max(1, wildMults?.[r]?.[row] ?? 1));
          positions.push([r, row]);
        }
      });
      if (mults.length === 0) break;
      reelMults.push(mults);
    }

    const len = reelMults.length;
    if (len < 3) continue;

    const ways = reelMults.reduce((a, m) => a * m.length, 1);
    const multiplier = wildMults ? sumOfMaxima(reelMults) : ways;

    const pay = PAYTABLE[symbol][len as 3 | 4 | 5] * multiplier;
    wins.push({
      symbol,
      reels: len as 3 | 4 | 5,
      ways,
      multiplier,
      pay,
      positions: positions.filter(([r]) => r < len),
    });
    total += pay;
  }

  wins.sort((a, b) => b.pay - a.pay);
  return { wins, total };
}

/** Sum over every way (one pick per reel) of the largest multiplier picked. */
function sumOfMaxima(reelMults: number[][]): number {
  const walk = (r: number, best: number): number => {
    if (r === reelMults.length) return best;
    let sum = 0;
    for (const m of reelMults[r]) sum += walk(r + 1, m > best ? m : best);
    return sum;
  };
  return walk(0, 1);
}

export function findScatters(grid: Grid): [number, number][] {
  const out: [number, number][] = [];
  grid.forEach((col, r) => col.forEach((s, row) => s === 'SCATTER' && out.push([r, row])));
  return out;
}

export function scatterPay(count: number): number {
  return SCATTER_PAY[Math.min(count, 5)] ?? 0;
}
