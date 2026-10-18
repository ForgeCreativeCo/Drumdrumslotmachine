import './styles.css';
import { audio } from './audio/drums';
import type { WayWin } from './math/evaluate';
import { FreeSpinSession, JACKPOTS, STICKY_MULT_CAP, playBaseSpin, type SpinOutcome } from './math/game';
import { RHYTHM } from './math/rhythm';
import { cryptoRng } from './math/rng';
import { PAYING_SYMBOLS, PAYTABLE, SCATTER_PAY, SYMBOLS } from './math/symbols';
import { symbolSvg } from './ui/art';
import { Fx, shake } from './ui/fx';
import { ReelsView } from './ui/reels';
import { playSummoning } from './ui/rhythm-ui';

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

// ---- DOM ------------------------------------------------------------------

const fx = new Fx($<HTMLCanvasElement>('#fx'));
const reels = new ReelsView($('#reels'));
const app = $('#app');
const msg = $('#msg');
const modal = $('#modal');
const modalCard = $('.modal-card');

audio.setMuted(state.muted);

function updateHud(): void {
  $('#balance').textContent = fmt(state.balance);
  $('#bet').textContent = fmt(bet());
  for (const j of JACKPOTS) $(`[data-jp="${j.name}"]`).textContent = fmt(j.pay * bet());
  const locked = state.busy || state.inBonus;
  $<HTMLButtonElement>('#bet-down').disabled = locked || state.betIndex === 0;
  $<HTMLButtonElement>('#bet-up').disabled = locked || state.betIndex === BETS.length - 1;
  $('#spin').classList.toggle('busy', state.busy);
  $('#auto').classList.toggle('on', state.auto);
  $('#turbo').classList.toggle('on', state.turbo);
  $('#sound').classList.toggle('on', !state.muted);
  $('#sound').textContent = state.muted ? 'SOUND OFF' : 'SOUND ON';
}

function setWin(amount: number): void {
  $('#win').textContent = fmt(amount);
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

/** Count a number up in an element over `ms`. */
function countUp(el: HTMLElement, to: number, ms: number, from = 0): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const eased = 1 - (1 - k) ** 3;
      el.textContent = fmt(from + (to - from) * eased);
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

/** Highlight every win, then cycle through each one until the next spin. */
function showWins(wins: WayWin[], scatters: [number, number][], scatterWin: number, mult: number): void {
  stopWinCycle();
  const items: { positions: [number, number][]; text: string }[] = wins.map((w) => ({
    positions: w.positions,
    text: describeWin(w, w.pay * mult * bet()),
  }));
  if (scatterWin > 0) {
    items.push({ positions: scatters, text: `雷 ${scatters.length} Thunder scatters · ${fmt(scatterWin * bet())}` });
  }
  if (!items.length) return;
  const all = items.flatMap((i) => i.positions);
  reels.highlight(all);
  reels.pulse(all);
  msg.textContent = items.length > 1 ? `${items.length} wins!` : items[0].text;
  if (items.length < 2 && !state.inBonus) return;
  let i = 0;
  cycleTimer = window.setInterval(() => {
    const it = items[i++ % items.length];
    reels.highlight(it.positions);
    msg.textContent = it.text;
  }, 1300);
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
  shake(app, 'big');
  let skip = false;
  const onTap = () => (skip = true);
  el.addEventListener('pointerdown', onTap);
  const amountEl = el.querySelector<HTMLElement>('.bw-amount')!;
  const ms = Math.min(6000, 1800 + x * 25);
  const counting = countUp(amountEl, amount, ms);
  const drum = window.setInterval(() => audio.don(undefined, 0.5), 260);
  await Promise.race([counting, new Promise<void>((r) => el.addEventListener('pointerdown', () => r(), { once: true }))]);
  window.clearInterval(drum);
  amountEl.textContent = fmt(amount);
  audio.don(undefined, 1);
  audio.kane();
  if (!skip) await wait(1600);
  else await wait(300);
  el.removeEventListener('pointerdown', onTap);
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
  msg.textContent = 'ドン！';
  updateHud();
  save();

  let o = playBaseSpin(cryptoRng);
  while (forceFestival && o.freeSpinsAwarded === 0) o = playBaseSpin(cryptoRng);
  forceFestival = false;
  await reels.spin(o.grid, {
    turbo: state.turbo,
    free: false,
    onStop: (r) => {
      audio.reelStop(r);
      const sc = o.scatters.filter(([sr]) => sr === r);
      if (sc.length) {
        audio.kane();
        reels.pulse(sc, 'thunder');
      }
    },
    onAnticipate: () => audio.roll(state.turbo ? 0.9 : 1.5),
  });

  const win = o.totalWin * bet();
  if (win > 0) {
    showWins(o.wins, o.scatters, o.scatterWin, 1);
    audio.winSting(o.totalWin >= 5 ? 2 : o.totalWin >= 1 ? 1 : 0);
    setWin(win);
    await bigWin(win);
    state.balance += win;
  } else {
    msg.textContent = 'Strike again!';
  }
  updateHud();
  save();

  if (o.freeSpinsAwarded > 0) {
    state.auto = false;
    await runFestival(o);
  }

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

const MAX_PIPS = JACKPOTS[JACKPOTS.length - 1].need;

function meterHtml(): string {
  const pips = Array.from({ length: MAX_PIPS }, (_, i) => {
    const tier = JACKPOTS.find((j) => j.need === i + 1);
    return `<span class="pip${tier ? ` tier tier-${tier.name.toLowerCase()}` : ''}" data-i="${i + 1}">${
      tier ? `<em>${tier.name}</em>` : ''
    }</span>`;
  }).join('');
  return `<div class="pips">${pips}</div>`;
}

function setCharges(root: HTMLElement, charges: number): void {
  root.querySelectorAll<HTMLElement>('.pip').forEach((p) => p.classList.toggle('lit', Number(p.dataset.i) <= charges));
  const reached = [...JACKPOTS].reverse().find((j) => charges >= j.need);
  root.dataset.tier = reached?.name ?? '';
}

/** Fly a spark from a cell into the drum meter. */
function sparkToMeter(reel: number, row: number, charge: number): Promise<void> {
  const [x, y] = reels.cellCenter(reel, row);
  const pip = $('#meter').querySelector<HTMLElement>(`.pip[data-i="${Math.min(charge, MAX_PIPS)}"]`);
  if (!pip) return Promise.resolve();
  const pr = pip.getBoundingClientRect();
  const s = document.createElement('div');
  s.className = 'spark';
  document.body.appendChild(s);
  const anim = s.animate(
    [
      { transform: `translate(${x}px, ${y}px) scale(1.4)`, opacity: 1 },
      { transform: `translate(${pr.left + pr.width / 2}px, ${pr.top + pr.height / 2}px) scale(.6)`, opacity: 0.9 },
    ],
    { duration: state.turbo ? 350 : 600, easing: 'cubic-bezier(.5,0,.6,1)' },
  );
  return anim.finished.then(() => {
    s.remove();
    fx.burst(pr.left + pr.width / 2, pr.top + pr.height / 2, 10, ['#bfe6ff', '#fff']);
    audio.shime(undefined, 0.6);
  });
}

async function runFestival(o: SpinOutcome): Promise<void> {
  state.inBonus = true;
  updateHud();
  stopWinCycle();

  // Raijin answers the scatters.
  reels.highlight(o.scatters);
  audio.gong();
  shake(app, 'big');
  for (const [r, row] of o.scatters) {
    const [x, y] = reels.cellCenter(r, row);
    fx.lightning(x, -10, x, y);
    audio.thunder(undefined, 0.6);
    await wait(180);
  }
  await wait(700);

  await modalChoice(
    `<p class="stage-tag">千の太鼓祭り</p>
     <h2>Festival of a Thousand Drums</h2>
     <p class="lead">${o.scatters.length} Thunder drums summon <b>${o.freeSpinsAwarded} free spins</b>.</p>
     <ol class="stages">
       <li><b>The Summoning.</b> Drum in time to set your Drum Power, from ×${RHYTHM.min} up to ×${RHYTHM.max} on every free-spin win.</li>
       <li><b>Drum Storm.</b> Taiko Wilds lock in place and beat harder each spin, up to ×${STICKY_MULT_CAP}.</li>
       <li><b>Raijin's Crescendo.</b> Every new wild and every 雷 charges Raijin's drums. Fill them for a jackpot.</li>
     </ol>
     <button class="btn primary" data-close>Summon the drums</button>`,
    'festival',
  );

  // Stage 1.
  const card = openModal('', 'summoning');
  const rhythm = await playSummoning(card);
  closeModal();

  // Stage 2.
  const session = new FreeSpinSession(o.freeSpinsAwarded, rhythm.multiplier);
  document.body.classList.add('storm');
  fx.setPetals(0.15);
  const bar = $('#fs-bar');
  bar.hidden = false;
  const meter = $('#meter');
  meter.innerHTML = meterHtml();
  setCharges(meter, 0);
  $('#fs-mult').textContent = `×${session.multiplier}`;
  $('#fs-win').textContent = fmt(0);
  $('#fs-left').textContent = String(session.spinsLeft);
  setWin(0);
  msg.textContent = `Drum Storm! Drum power ×${session.multiplier}`;
  audio.startLoop();
  await wait(900);

  let charges = 0;
  while (!session.done) {
    stopWinCycle();
    const before = session.sticky;
    const fs = session.spin(cryptoRng);
    $('#fs-left').textContent = String(session.spinsLeft);

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
        const fresh = fs.newWilds.filter((w) => w.reel === r);
        if (fresh.length) {
          shown.push(...fresh);
          reels.setSticky(shown, fresh);
          audio.don(undefined, 1);
          audio.kane(undefined, 0.6);
          for (const w of fresh) sparks.push(sparkToMeter(w.reel, w.row, ++charges).then(() => setCharges(meter, charges)));
        }
        const th = fs.thunder.filter(([tr]) => tr === r);
        if (th.length) {
          reels.pulse(th, 'thunder');
          for (const [tr, row] of th) {
            const [x, y] = reels.cellCenter(tr, row);
            fx.lightning(x, y - 120, x, y, '#9fd8ff');
            audio.thunder(undefined, 0.35);
            sparks.push(sparkToMeter(tr, row, ++charges).then(() => setCharges(meter, charges)));
          }
        }
      },
    });
    await Promise.all(sparks);
    setCharges(meter, fs.charges);
    charges = fs.charges;

    if (fs.totalWin > 0) {
      showWins(fs.wins, [], 0, session.multiplier);
      audio.winSting(fs.totalWin >= 5 ? 2 : 1);
      setWin(fs.totalWin * bet());
      await countUp($('#fs-win'), session.totalWin * bet(), 600, (session.totalWin - fs.totalWin) * bet());
      if (fs.totalWin >= 15) await bigWin(fs.totalWin * bet());
    } else {
      setWin(0);
      msg.textContent = `${session.spinsLeft} free spin${session.spinsLeft === 1 ? '' : 's'} left`;
    }
    if (fs.retrigger) {
      audio.gong();
      toast(`+${fs.retrigger} FREE SPINS`, 'gold');
      $('#fs-left').textContent = String(session.spinsLeft);
    }
    await wait(state.turbo ? 500 : fs.totalWin > 0 ? 1300 : 700);
  }
  stopWinCycle();
  audio.stopLoop();

  // Stage 3.
  const spinsWin = session.totalWin;
  const cres = session.crescendo();
  await playCrescendo(cres.charges, cres.jackpot?.name ?? null, cres.award);

  const total = session.totalWin * bet();
  await modalChoice(
    `<p class="stage-tag">祭り完了</p><h2>Festival complete</h2>
     <dl class="summary">
       <dt>Drum power</dt><dd>×${session.multiplier}</dd>
       <dt>Free spins played</dt><dd>${session.spinsPlayed}</dd>
       <dt>Drum Storm wins</dt><dd>${fmt(spinsWin * bet())}</dd>
       <dt>Crescendo</dt><dd>${cres.jackpot ? `${cres.jackpot.name} · ${fmt(cres.award * bet())}` : 'No jackpot'}</dd>
       <dt class="total">Total</dt><dd class="total">${fmt(total)}</dd>
     </dl>
     <button class="btn primary" data-close>Collect</button>`,
    'festival',
  );
  await bigWin(total);
  state.balance += total;
  setWin(total);
  save();

  reels.clearSticky();
  document.body.classList.remove('storm');
  fx.setPetals(0.6);
  bar.hidden = true;
  msg.textContent = `The festival paid ${fmt(total)}`;
  state.inBonus = false;
  updateHud();
}

async function playCrescendo(charges: number, jackpot: string | null, award: number): Promise<void> {
  const tiers = JACKPOTS.map(
    (j) =>
      `<div class="tier-chip tier-${j.name.toLowerCase()}" data-name="${j.name}"><span>${j.name}</span><b>${fmt(j.pay * bet())}</b><small>${j.need}</small></div>`,
  ).join('');
  const card = openModal(
    `<p class="stage-tag">Stage 3 · 雷神</p>
     <h2>Raijin's Crescendo</h2>
     <div class="raijin" aria-hidden="true">雷神</div>
     <div class="big-meter">${meterHtml()}</div>
     <div class="tier-row">${tiers}</div>
     <p class="cres-result" aria-live="polite">${charges} charge${charges === 1 ? '' : 's'}…</p>
     <button class="btn primary" data-close hidden>Continue</button>`,
    'crescendo',
  );
  const bigMeter = card.querySelector<HTMLElement>('.big-meter')!;
  const raijin = card.querySelector<HTMLElement>('.raijin')!;
  await wait(800);
  audio.roll(1.2);
  await wait(1000);

  for (let i = 1; i <= charges; i++) {
    const pip = bigMeter.querySelector<HTMLElement>(`.pip[data-i="${Math.min(i, MAX_PIPS)}"]`)!;
    const from = raijin.getBoundingClientRect();
    const to = pip.getBoundingClientRect();
    fx.lightning(from.left + from.width / 2, from.bottom - 10, to.left + to.width / 2, to.top + to.height / 2);
    audio.thunder(undefined, 0.3 + Math.min(0.5, i / 20));
    audio.don(undefined, 0.7);
    setCharges(bigMeter, i);
    const tier = JACKPOTS.find((j) => j.need === i);
    if (tier) {
      card.querySelector(`.tier-chip[data-name="${tier.name}"]`)!.classList.add('lit');
      audio.gong(undefined, 0.7);
      shake(app, 'small');
      await wait(450);
    }
    await wait(Math.max(110, 380 - i * 22));
  }

  const result = card.querySelector<HTMLElement>('.cres-result')!;
  if (jackpot) {
    card.querySelector(`.tier-chip[data-name="${jackpot}"]`)!.classList.add('won');
    result.innerHTML = `<span class="jp-won">${jackpot.toUpperCase()} JACKPOT</span><b>${fmt(award * bet())}</b>`;
    audio.gong();
    audio.winSting(3);
    fx.coins(jackpot === 'Grand' ? 200 : 80);
    shake(app, 'big');
  } else {
    result.textContent = `${charges} charge${charges === 1 ? '' : 's'}. The storm rests, this time.`;
  }
  const btn = card.querySelector<HTMLButtonElement>('[data-close]')!;
  btn.hidden = false;
  await new Promise<void>((r) => btn.addEventListener('click', () => r(), { once: true }));
  closeModal();
}

// ---- Info -----------------------------------------------------------------

function showInfo(): void {
  const rows = PAYING_SYMBOLS.map((id) => {
    const p = PAYTABLE[id];
    return `<div class="pay-row"><div class="pay-sym">${symbolSvg(id)}</div><div class="pay-name">${SYMBOLS[id].name}</div>
      <div class="pay-vals"><span>5× ${fmt(p[5] * bet())}</span><span>4× ${fmt(p[4] * bet())}</span><span>3× ${fmt(p[3] * bet())}</span></div></div>`;
  }).join('');
  void modalChoice(
    `<h2>How to play</h2>
     <p>243 ways: match symbols on adjacent reels from the left. Wins are shown for your current bet of ${fmt(bet())}.</p>
     <div class="pay-specials">
       <div class="pay-row"><div class="pay-sym">${symbolSvg('WILD')}</div><div class="pay-name">Taiko Wild<small>Substitutes for all symbols except 雷. Reels 2 to 5.</small></div></div>
       <div class="pay-row"><div class="pay-sym">${symbolSvg('SCATTER')}</div><div class="pay-name">Raijin Thunder<small>3/4/5 anywhere pay ${SCATTER_PAY[3]}×/${SCATTER_PAY[4]}×/${SCATTER_PAY[5]}× bet and start the Festival.</small></div></div>
     </div>
     <div class="paytable">${rows}</div>
     <h3>Festival of a Thousand Drums</h3>
     <ol class="stages">
       <li><b>The Summoning:</b> ${RHYTHM.notes} drum notes. Your accuracy sets Drum Power from ×${RHYTHM.min} to ×${RHYTHM.max}, applied to every free-spin win.</li>
       <li><b>Drum Storm:</b> wilds lock in place. Each locked wild gains +1× per spin (max ×${STICKY_MULT_CAP}); a way uses its highest wild multiplier. 3+ 雷 add more spins.</li>
       <li><b>Raijin's Crescendo:</b> each new wild and each 雷 adds a charge. ${JACKPOTS.map((j) => `${j.need}+ = ${j.name} (${j.pay}× bet)`).join(', ')}.</li>
     </ol>
     <p class="fine">A play-money demo. No real money, no purchases. Theoretical RTP is about 96% at average rhythm skill.</p>
     <button class="btn primary" data-close>Back to the drums</button>`,
    'info',
  );
}

// ---- Wiring ---------------------------------------------------------------

$('#spin').addEventListener('click', () => {
  if (state.auto) {
    state.auto = false;
    updateHud();
    return;
  }
  void spin();
});
$('#auto').addEventListener('click', () => {
  if (state.inBonus) return;
  state.auto = !state.auto;
  updateHud();
  if (state.auto) void spin();
});
$('#turbo').addEventListener('click', () => {
  state.turbo = !state.turbo;
  updateHud();
  save();
});
$('#sound').addEventListener('click', () => {
  audio.unlock();
  state.muted = !state.muted;
  audio.setMuted(state.muted);
  updateHud();
  save();
});
$('#info').addEventListener('click', () => !state.busy && !state.inBonus && showInfo());
$('#bet-down').addEventListener('click', () => {
  state.betIndex = Math.max(0, state.betIndex - 1);
  audio.unlock();
  audio.ka();
  updateHud();
  save();
});
$('#bet-up').addEventListener('click', () => {
  state.betIndex = Math.min(BETS.length - 1, state.betIndex + 1);
  audio.unlock();
  audio.ka();
  updateHud();
  save();
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !modal.hidden || state.inBonus) return;
  e.preventDefault();
  void spin();
});

updateHud();
msg.textContent = `243 ways · 3+ 雷 start the Festival of a Thousand Drums`;
