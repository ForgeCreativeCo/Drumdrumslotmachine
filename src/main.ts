import './styles.css';
import { audio } from './audio/drums';
import type { WayWin } from './math/evaluate';
import { FreeSpinSession, JACKPOTS, STICKY_MULT_CAP, playBaseSpin, type SpinOutcome } from './math/game';
import { RHYTHM } from './math/rhythm';
import { cryptoRng } from './math/rng';
import { PAYING_SYMBOLS, PAYTABLE, SCATTER_PAY, SYMBOLS } from './math/symbols';
import { Fx } from './ui/fx';
import { crescendo, festivalIntro, festivalSummary } from './stage/festival-panels';
import { paintSymbol } from './stage/paint';
import { playSummoning } from './stage/summoning';
import { Stage } from './stage/stage';

const BETS = [0.2, 0.5, 1, 2, 5, 10, 20, 50];
const START_BALANCE = 1000;
const STORAGE_KEY = 'taiko-thunder:v1';
const BIG_WINS = [
  { at: 100, label: 'EPIC WIN', jp: '大祭' },
  { at: 40, label: 'MEGA WIN', jp: '豪勝' },
  { at: 15, label: 'BIG WIN', jp: '大勝利' },
];

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Saved {
  balance: number;
  betIndex: number;
  muted: boolean;
  turbo: boolean;
}

function load(): Saved {
  const fallback: Saved = { balance: START_BALANCE, betIndex: 2, muted: false, turbo: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const s = { ...fallback, ...JSON.parse(raw) } as Saved;
    if (!Number.isFinite(s.balance) || s.balance < 0) s.balance = START_BALANCE;
    s.betIndex = Math.max(0, Math.min(BETS.length - 1, s.betIndex | 0));
    return s;
  } catch {
    return fallback;
  }
}

const state = {
  ...load(),
  busy: false,
  auto: false,
  inBonus: false,
};

function save(): void {
  try {
    const { balance, betIndex, muted, turbo } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, betIndex, muted, turbo }));
  } catch {
    // Storage unavailable (private mode etc.); play continues unsaved.
  }
}

const bet = () => BETS[state.betIndex];

/** `?festival` in the URL makes the first spin trigger the bonus, for showing it off. */
let forceFestival = new URLSearchParams(location.search).has('festival');

const fx = new Fx($<HTMLCanvasElement>('#fx'));
fx.setPetals(0);
const modal = $('#modal');
const modalCard = $('.modal-card');
const live = $('#live');
audio.setMuted(state.muted);

// ---- Controls ---------------------------------------------------------------

function onSpinPressed(): void {
  if (state.auto) {
    state.auto = false;
    updateHud();
    return;
  }
  void spin();
}

function onAuto(): void {
  if (state.inBonus) return;
  audio.unlock();
  state.auto = !state.auto;
  updateHud();
  if (state.auto) void spin();
}

function onTurbo(): void {
  audio.unlock();
  state.turbo = !state.turbo;
  updateHud();
  save();
}

function onSound(): void {
  audio.unlock();
  state.muted = !state.muted;
  audio.setMuted(state.muted);
  updateHud();
  save();
}

function onInfo(): void {
  if (!state.busy && !state.inBonus) showInfo();
}

function changeBet(d: number): void {
  if (state.busy || state.inBonus) return;
  const next = Math.max(0, Math.min(BETS.length - 1, state.betIndex + d));
  if (next === state.betIndex) return;
  state.betIndex = next;
  audio.unlock();
  audio.ka();
  updateHud();
  save();
}

const stage = await Stage.create($('#stage'), {
  spin: onSpinPressed,
  betDown: () => changeBet(-1),
  betUp: () => changeBet(1),
  auto: onAuto,
  turbo: onTurbo,
  sound: onSound,
  info: onInfo,
});
const reels = stage.main.reels;
// Dev-only handle for poking the stage from the console or test scripts.
if (import.meta.env.DEV) (window as unknown as { __taiko: unknown }).__taiko = { stage, reels, crescendo, festivalSummary };

function updateHud(): void {
  stage.deck.setBalance(fmt(state.balance));
  stage.deck.setBet(fmt(bet()), state.betIndex);
  stage.top.setJackpots(Object.fromEntries(JACKPOTS.map((j) => [j.name, fmt(j.pay * bet())])));
  const locked = state.busy || state.inBonus;
  stage.deck.setState({
    auto: state.auto,
    turbo: state.turbo,
    muted: state.muted,
    betLocked: locked,
    spinEnabled: !state.inBonus && (!state.busy || state.auto),
    busy: state.busy,
  });
  stage.deck.setBetLimits(state.betIndex === 0, state.betIndex === BETS.length - 1, locked);
  $<HTMLButtonElement>('#a11y-spin').textContent = state.auto ? 'Stop autoplay' : 'Spin';
  $('#a11y-balance').textContent = `Balance ${fmt(state.balance)}, bet ${fmt(bet())}`;
}

function setWin(amount: number): void {
  stage.deck.setWin(fmt(amount));
  stage.main.setWin(amount > 0 ? fmt(amount) : null);
}

function say(text: string): void {
  stage.main.setInfo(text);
  live.textContent = text;
}

function toast(text: string, cls = ''): void {
  const t = $('#toast');
  t.textContent = text;
  t.className = `show ${cls}`;
  window.setTimeout(() => (t.className = ''), 1800);
}

function openModal(html: string, cls = ''): HTMLElement {
  modalCard.className = `modal-card ${cls}`;
  modalCard.innerHTML = html;
  modal.hidden = false;
  return modalCard;
}

function closeModal(): void {
  modal.hidden = true;
  modalCard.innerHTML = '';
}

/** Show a modal and wait for its primary button. */
function modalChoice(html: string, cls = ''): Promise<void> {
  const card = openModal(html, cls);
  card.querySelector<HTMLElement>('[data-close]')?.focus();
  return new Promise((resolve) => {
    card.querySelector('[data-close]')!.addEventListener(
      'click',
      () => {
        audio.unlock();
        closeModal();
        resolve();
      },
      { once: true },
    );
  });
}

/** Count a number up over `ms`, calling `set` with each formatted value. */
function countUp(set: (v: string) => void, to: number, ms: number, from = 0): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - k) ** 3;
      set(fmt(from + (to - from) * eased));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

// ---- Win presentation -----------------------------------------------------

let cycleTimer: number | null = null;

function stopWinCycle(): void {
  if (cycleTimer !== null) window.clearInterval(cycleTimer);
  cycleTimer = null;
  reels.clearHighlight();
}

function describeWin(w: WayWin, amount: number): string {
  const s = SYMBOLS[w.symbol];
  const mult = w.multiplier !== w.ways ? ` · ×${(w.multiplier / w.ways).toFixed(1)} wild avg` : '';
  return `${s.kanji} ${s.name} · ${w.reels} reels · ${w.ways} way${w.ways > 1 ? 's' : ''}${mult} · ${fmt(amount)}`;
}

/**
 * Highlight every win, then cycle through each one until the next spin.
 * Wins smaller than the bet are marked quietly rather than celebrated.
 */
function showWins(wins: WayWin[], scatters: [number, number][], scatterWin: number, mult: number, total: number): void {
  stopWinCycle();
  const quiet = total < 1;
  const items: { positions: [number, number][]; text: string; way: boolean }[] = wins.map((w) => ({
    positions: w.positions,
    text: describeWin(w, w.pay * mult * bet()),
    way: true,
  }));
  if (scatterWin > 0) {
    items.push({ positions: scatters, text: `雷 ${scatters.length} Thunder scatters · ${fmt(scatterWin * bet())}`, way: false });
  }
  if (!items.length) return;
  const all = items.flatMap((i) => i.positions);
  reels.highlight(all, { bolts: items[0].way ? items[0].positions : undefined, quiet });
  say(items.length > 1 ? `${items.length} wins!` : items[0].text);
  if (items.length < 2 && !state.inBonus) return;
  let i = 0;
  cycleTimer = window.setInterval(() => {
    const it = items[i++ % items.length];
    reels.highlight(it.positions, { bolts: it.way ? it.positions : undefined, quiet });
    stage.main.setInfo(it.text);
  }, 1600);
}

const symbolImages = new Map<string, string>();
function symbolImg(id: keyof typeof SYMBOLS): string {
  let url = symbolImages.get(id);
  if (!url) {
    url = paintSymbol(id, 128).toDataURL();
    symbolImages.set(id, url);
  }
  return `<img src="${url}" alt="">`;
}

async function bigWin(amount: number): Promise<void> {
  const x = amount / bet();
  const tier = BIG_WINS.find((b) => x >= b.at);
  if (!tier) return;
  const el = $('#bigwin');
  el.hidden = false;
  el.innerHTML = `<div class="bw-jp">${tier.jp}</div><div class="bw-label">${tier.label}</div><div class="bw-amount">0.00</div><p class="bw-skip">Tap to continue</p>`;
  audio.gong();
  audio.winSting(3);
  fx.coins(tier.at >= 100 ? 160 : tier.at >= 40 ? 110 : 70);
  stage.shake('big');
  stage.celebrate(6);
  let skip = false;
  const tapped = new Promise<void>((r) =>
    el.addEventListener(
      'pointerdown',
      () => {
        skip = true;
        r();
      },
      { once: true },
    ),
  );
  const amountEl = el.querySelector<HTMLElement>('.bw-amount')!;
  const ms = Math.min(6000, 1800 + x * 25);
  const drum = window.setInterval(() => audio.don(undefined, 0.5), 260);
  await Promise.race([countUp((v) => (amountEl.textContent = v), amount, ms), tapped]);
  window.clearInterval(drum);
  amountEl.textContent = fmt(amount);
  audio.don(undefined, 1);
  audio.kane();
  await wait(skip ? 300 : 1600);
  el.hidden = true;
}

// ---- Base game -------------------------------------------------------------

async function spin(): Promise<void> {
  if (state.busy || state.inBonus || !modal.hidden) return;
  audio.unlock();
  if (state.balance < bet() - 1e-9) {
    state.auto = false;
    updateHud();
    await outOfCredits();
    return;
  }
  state.busy = true;
  stopWinCycle();
  state.balance -= bet();
  setWin(0);
  say('ドン！');
  audio.don(undefined, 0.9);
  updateHud();
  save();

  let o = playBaseSpin(cryptoRng);
  while (forceFestival && o.freeSpinsAwarded === 0) o = playBaseSpin(cryptoRng);
  forceFestival = false;

  let landed = 0;
  let anticipated = -1;
  await reels.spin(o.grid, {
    turbo: state.turbo,
    free: false,
    onStop: (r) => {
      audio.reelStop(r);
      stage.main.drumHit(r);
      if (r === anticipated) {
        stage.main.release();
        stage.anticipate(false);
      }
      if (o.grid[r].includes('WILD')) {
        audio.don(undefined, 1);
        audio.ka(undefined, 0.8);
      }
      const sc = o.scatters.filter(([sr]) => sr === r);
      if (sc.length) {
        landed += sc.length;
        audio.kane();
        reels.pulse(sc, 'thunder');
        stage.top.lightDrums(landed);
        stage.top.strike(0.35 + landed * 0.15);
      }
    },
    onAnticipate: (r) => {
      anticipated = r;
      audio.roll(state.turbo ? 1.1 : 1.9);
      stage.main.push(r);
      stage.anticipate(true);
    },
  });
  stage.main.release();
  stage.anticipate(false);

  const win = o.totalWin * bet();
  if (win > 0) {
    showWins(o.wins, o.scatters, o.scatterWin, 1, o.totalWin);
    audio.winSting(o.totalWin >= 5 ? 2 : o.totalWin >= 1 ? 1 : 0);
    if (o.totalWin >= 1) stage.celebrate(1.6);
    setWin(win);
    await bigWin(win);
    state.balance += win;
  } else {
    say('Strike again!');
  }
  updateHud();
  save();

  if (o.freeSpinsAwarded > 0) {
    state.auto = false;
    await runFestival(o);
  }
  stage.top.lightDrums(0);

  state.busy = false;
  updateHud();
  if (state.auto) window.setTimeout(() => state.auto && spin(), state.turbo ? 250 : 650);
}

async function outOfCredits(): Promise<void> {
  await modalChoice(
    `<p class="stage-tag">小判</p><h2>Out of koban</h2>
     <p>The festival elders gift you a fresh purse of ${fmt(START_BALANCE)} play credits.</p>
     <button class="btn primary" data-close>Accept the gift</button>`,
  );
  state.balance = Math.max(state.balance, START_BALANCE);
  updateHud();
  save();
}

// ---- The Festival of a Thousand Drums ------------------------------------

/** Fly a spark from a cell up into Raijin's drum meter on the top screen. */
function sparkToMeter(reel: number, row: number, charge: number): Promise<void> {
  return stage.flyTo(reels.cellCenter(reel, row), stage.top.meterPoint(charge), 0x9fd8ff, state.turbo ? 0.4 : 0.65).then(() => {
    audio.shime(undefined, 0.6);
  });
}

function bonusStats(session: FreeSpinSession, shownWin = session.totalWin): string {
  return `FREE SPINS ${session.spinsLeft}  ·  DRUM POWER ×${session.multiplier}  ·  BONUS ${fmt(shownWin * bet())}`;
}

/** Raijin answers the scatters, then a thunderclap relights the cabinet as a storm. */
async function stormArrives(o: SpinOutcome): Promise<void> {
  reels.highlight(o.scatters);
  audio.gong();
  stage.shake('big');
  stage.top.lightDrums(8);
  for (const [r, row] of o.scatters) {
    stage.bolt([stage.top.skyPoint(), reels.cellCenter(r, row)], 0xdff4ff, 0.5, 7);
    stage.burst(reels.cellCenter(r, row), 0xbfe6ff, 30);
    stage.top.strike(0.8);
    audio.thunder(undefined, 0.6);
    await wait(260);
  }
  await wait(600);
  audio.thunder(undefined, 1);
  await stage.flash(() => {
    reels.clearHighlight();
    stage.setStorm(true);
    stage.top.lightDrums(0);
    stage.top.awaken(true);
    stage.top.setCharges(0);
  });
  audio.gong(undefined, 0.9);
  stage.shake('big');
}

async function runFestival(o: SpinOutcome): Promise<void> {
  state.inBonus = true;
  updateHud();
  stopWinCycle();
  say('Raijin awakens!');

  await stormArrives(o);
  say(`Festival of a Thousand Drums · ${o.freeSpinsAwarded} free spins`);
  await festivalIntro(stage, o.scatters.length, o.freeSpinsAwarded);

  // Stage 1.
  say('The Summoning');
  const rhythm = await playSummoning(stage);
  await stage.main.closePanel();

  // Stage 2.
  const session = new FreeSpinSession(o.freeSpinsAwarded, rhythm.multiplier);
  stage.top.showPower(session.multiplier);
  stage.main.setStats(bonusStats(session));
  setWin(0);
  say(`Drum Storm! Drum power ×${session.multiplier}`);
  audio.startLoop();
  await wait(800);

  let charges = 0;
  while (!session.done) {
    stopWinCycle();
    const before = session.sticky;
    const fs = session.spin(cryptoRng);
    stage.main.setStats(bonusStats(session, session.totalWin - fs.totalWin));

    // Locked wilds beat louder before the reels move.
    if (before.length) {
      const aged = fs.sticky.filter((w) => before.some((b) => b.reel === w.reel && b.row === w.row));
      reels.setSticky(aged);
      if (aged.some((w, i) => w.mult !== before[i]?.mult)) audio.don(undefined, 0.8);
      await wait(state.turbo ? 150 : 350);
    }

    const sparks: Promise<void>[] = [];
    const shown = fs.sticky.filter((w) => !fs.newWilds.some((n) => n.reel === w.reel && n.row === w.row));
    await reels.spin(fs.grid, {
      turbo: state.turbo,
      free: true,
      onStop: (r) => {
        audio.reelStop(r);
        stage.main.drumHit(r);
        const fresh = fs.newWilds.filter((w) => w.reel === r);
        if (fresh.length) {
          shown.push(...fresh);
          reels.setSticky(shown, fresh);
          audio.don(undefined, 1);
          audio.kane(undefined, 0.6);
          for (const w of fresh) {
            const n = ++charges;
            sparks.push(sparkToMeter(w.reel, w.row, n).then(() => stage.top.setCharges(n)));
          }
        }
        const th = fs.thunder.filter(([tr]) => tr === r);
        if (th.length) {
          reels.pulse(th, 'thunder');
          for (const [tr, row] of th) {
            const at = reels.cellCenter(tr, row);
            stage.bolt([stage.top.skyPoint(), at], 0xbfe6ff, 0.4, 5);
            audio.thunder(undefined, 0.35);
            const n = ++charges;
            sparks.push(sparkToMeter(tr, row, n).then(() => stage.top.setCharges(n)));
          }
        }
      },
    });
    await Promise.all(sparks);
    charges = fs.charges;
    stage.top.setCharges(charges);

    if (fs.totalWin > 0) {
      showWins(fs.wins, [], 0, session.multiplier, fs.totalWin);
      audio.winSting(fs.totalWin >= 5 ? 2 : 1);
      if (fs.totalWin >= 1) stage.celebrate(1.4);
      setWin(fs.totalWin * bet());
      const from = session.totalWin - fs.totalWin;
      await countUp(
        (v) => stage.main.setStats(`FREE SPINS ${session.spinsLeft}  ·  DRUM POWER ×${session.multiplier}  ·  BONUS ${v}`),
        session.totalWin * bet(),
        600,
        from * bet(),
      );
      if (fs.totalWin >= 15) await bigWin(fs.totalWin * bet());
    } else {
      setWin(0);
      say(`${session.spinsLeft} free spin${session.spinsLeft === 1 ? '' : 's'} left`);
    }
    if (fs.retrigger) {
      audio.gong();
      stage.top.strike(1);
      stage.top.fireworks(3);
      toast(`+${fs.retrigger} FREE SPINS`, 'gold');
    }
    stage.main.setStats(bonusStats(session));
    await wait(state.turbo ? 500 : fs.totalWin > 0 ? 1300 : 700);
  }
  stopWinCycle();
  audio.stopLoop();

  // Stage 3.
  const spinsWin = session.totalWin;
  const cres = session.crescendo();
  say("Raijin's Crescendo");
  await crescendo(stage, cres.charges, cres.jackpot?.name ?? null, fmt(cres.award * bet()), (x) => fmt(x * bet()));

  const total = session.totalWin * bet();
  await festivalSummary(stage, {
    multiplier: session.multiplier,
    spins: session.spinsPlayed,
    spinsWin: fmt(spinsWin * bet()),
    crescendo: cres.jackpot ? `${cres.jackpot.name} · ${fmt(cres.award * bet())}` : 'No jackpot',
    total: fmt(total),
  });
  await stage.main.closePanel();
  await bigWin(total);
  state.balance += total;
  setWin(total);
  save();

  reels.clearSticky();
  await stage.flash(() => {
    stage.setStorm(false);
    stage.top.awaken(false);
    stage.top.showPower(null);
    stage.main.setStats(null);
  }, 0xfff1c2, 0.05);
  say(`The festival paid ${fmt(total)}`);
  state.inBonus = false;
  updateHud();
}

// ---- Info -----------------------------------------------------------------

function showInfo(): void {
  const rows = PAYING_SYMBOLS.map((id) => {
    const p = PAYTABLE[id];
    return `<div class="pay-row"><div class="pay-sym">${symbolImg(id)}</div><div class="pay-name">${SYMBOLS[id].name}</div>
      <div class="pay-vals"><span>5× ${fmt(p[5] * bet())}</span><span>4× ${fmt(p[4] * bet())}</span><span>3× ${fmt(p[3] * bet())}</span></div></div>`;
  }).join('');
  void modalChoice(
    `<h2>How to play</h2>
     <p>243 ways: match symbols on adjacent reels from the left. Wins are shown for your current bet of ${fmt(bet())}.</p>
     <div class="pay-specials">
       <div class="pay-row"><div class="pay-sym">${symbolImg('WILD')}</div><div class="pay-name">Taiko Wild<small>Substitutes for all symbols except 雷. Reels 2 to 5.</small></div></div>
       <div class="pay-row"><div class="pay-sym">${symbolImg('SCATTER')}</div><div class="pay-name">Raijin Thunder<small>3/4/5 anywhere pay ${SCATTER_PAY[3]}×/${SCATTER_PAY[4]}×/${SCATTER_PAY[5]}× bet and start the Festival.</small></div></div>
     </div>
     <div class="paytable">${rows}</div>
     <h3>Festival of a Thousand Drums</h3>
     <ol class="stages">
       <li><b>The Summoning:</b> ${RHYTHM.notes} drum notes. Your accuracy sets Drum Power from ×${RHYTHM.min} to ×${RHYTHM.max}, applied to every free-spin win.</li>
       <li><b>Drum Storm:</b> wilds lock in place. Each locked wild gains +1× per spin (max ×${STICKY_MULT_CAP}); a way uses its highest wild multiplier. 3+ 雷 add more spins.</li>
       <li><b>Raijin's Crescendo:</b> each new wild and each 雷 adds a charge. ${JACKPOTS.map((j) => `${j.need}+ = ${j.name} (${j.pay}× bet)`).join(', ')}.</li>
     </ol>
     <h3>Controls</h3>
     <p>Space spins. A toggles autoplay, T toggles turbo, M mutes, I opens this page.</p>
     <p class="fine">A play-money demo. No real money, no purchases. Theoretical RTP is about 96% at average rhythm skill.</p>
     <button class="btn primary" data-close>Back to the drums</button>`,
    'info',
  );
}

// ---- Wiring ---------------------------------------------------------------

$('#a11y-spin').addEventListener('click', onSpinPressed);
$('#a11y-bet-down').addEventListener('click', () => changeBet(-1));
$('#a11y-bet-up').addEventListener('click', () => changeBet(1));
$('#a11y-auto').addEventListener('click', onAuto);
$('#a11y-turbo').addEventListener('click', onTurbo);
$('#a11y-sound').addEventListener('click', onSound);
$('#a11y-info').addEventListener('click', onInfo);

window.addEventListener('keydown', (e) => {
  if (!modal.hidden || state.inBonus || e.repeat) return;
  if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
  const keys: Record<string, () => void> = {
    Space: () => {
      stage.deck.strike();
      onSpinPressed();
    },
    KeyA: onAuto,
    KeyT: onTurbo,
    KeyM: onSound,
    KeyI: onInfo,
  };
  const fn = keys[e.code];
  if (!fn) return;
  e.preventDefault();
  fn();
});

updateHud();
say('243 ways · 3+ 雷 start the Festival of a Thousand Drums');
