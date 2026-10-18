/**
 * Monte Carlo RTP simulator. Usage: npm run sim -- [spins] [seed]
 * The rhythm stage is played at average skill (see AVERAGE_SKILL).
 */
import { FreeSpinSession, JACKPOTS, playBaseSpin } from '../src/math/game';
import { simulateRhythm } from '../src/math/rhythm';
import { mulberry32 } from '../src/math/rng';

const spins = Number(process.argv[2] ?? 2_000_000);
const rng = mulberry32(Number(process.argv[3] ?? 42));

let baseWays = 0;
let baseScatter = 0;
let bonusSpins = 0;
let bonusJackpot = 0;
let bonuses = 0;
let hits = 0;
let maxWin = 0;
let freeSpinsPlayed = 0;
let wildsAtEnd = 0;
let rhythmMult = 0;
const chargeHist = new Array(31).fill(0);
const jackpotHits: Record<string, number> = Object.fromEntries(JACKPOTS.map((j) => [j.name, 0]));

for (let i = 0; i < spins; i++) {
  const o = playBaseSpin(rng);
  baseWays += o.wayWin;
  baseScatter += o.scatterWin;
  let win = o.totalWin;
  if (o.freeSpinsAwarded > 0) {
    bonuses++;
    const r = simulateRhythm(rng);
    rhythmMult += r.multiplier;
    const s = new FreeSpinSession(o.freeSpinsAwarded, r.multiplier);
    while (!s.done) bonusSpins += s.spin(rng).totalWin;
    freeSpinsPlayed += s.spinsPlayed;
    const c = s.crescendo();
    wildsAtEnd += c.charges;
    chargeHist[Math.min(c.charges, 30)]++;
    bonusJackpot += c.award;
    if (c.jackpot) jackpotHits[c.jackpot.name]++;
    win += s.totalWin;
  }
  if (win > 0) hits++;
  if (win > maxWin) maxWin = win;
}

const pct = (x: number) => ((x / spins) * 100).toFixed(2) + '%';
console.log(`Spins:              ${spins.toLocaleString()}`);
console.log(`RTP total:          ${pct(baseWays + baseScatter + bonusSpins + bonusJackpot)}`);
console.log(`  base ways:        ${pct(baseWays)}`);
console.log(`  base scatter:     ${pct(baseScatter)}`);
console.log(`  free spins:       ${pct(bonusSpins)}`);
console.log(`  crescendo:        ${pct(bonusJackpot)}`);
console.log(`Hit frequency:      ${pct(hits)}`);
console.log(`Bonus frequency:    1 in ${(spins / bonuses).toFixed(0)}`);
console.log(`Avg bonus value:    ${((bonusSpins + bonusJackpot) / bonuses).toFixed(1)}x bet`);
console.log(`Avg rhythm mult:    ${(rhythmMult / bonuses).toFixed(2)}x`);
console.log(`Avg free spins:     ${(freeSpinsPlayed / bonuses).toFixed(1)}`);
console.log(`Avg meter charges:  ${(wildsAtEnd / bonuses).toFixed(2)}`);
for (const j of JACKPOTS) {
  const n = jackpotHits[j.name];
  console.log(`  ${j.name.padEnd(6)} jackpot: ${((n / bonuses) * 100).toFixed(2)}% of bonuses`);
}
console.log('Charge distribution: ' + chargeHist.map((n, i) => `${i}:${((n / bonuses) * 100).toFixed(1)}`).join(' '));
console.log(`Max win:            ${maxWin.toFixed(1)}x bet`);
