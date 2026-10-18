import { audio } from '../audio/drums';
import { RHYTHM, multiplierFor, simulateRhythm, type Judgement, type RhythmResult } from '../math/rhythm';
import { cryptoRng } from '../math/rng';
import { mitsudomoe } from './art';

type NoteType = 'don' | 'ka';

interface Note {
  time: number;
  type: NoteType;
  judged: Judgement | null;
  /** Pre-decided judgement when the drummers auto-play. */
  auto?: Judgement;
}

const BPM = 116;
const BEAT = 60 / BPM;
const TRAVEL = 1.7;
const LEAD_IN_BEATS = 4;
// Four bars of eighth notes; x marks a note. 18 notes in total.
const CHART = ['x.x.x.x.', 'x.x.x.xx', 'x.xx.x.x', 'xx.x.x..'];

function buildChart(start: number): Note[] {
  const notes: Note[] = [];
  CHART.join('')
    .split('')
    .forEach((c, i) => {
      if (c !== 'x') return;
      notes.push({ time: start + (i * BEAT) / 2, type: Math.random() < 0.62 ? 'don' : 'ka', judged: null });
    });
  if (notes.length !== RHYTHM.notes) throw new Error('Chart length must match RHYTHM.notes');
  return notes;
}

const KEYS: Record<string, NoteType> = { KeyF: 'don', KeyJ: 'don', Space: 'don', KeyD: 'ka', KeyK: 'ka' };

/** Stage 1, "The Summoning": plays the rhythm game and resolves with the earned multiplier. */
export function playSummoning(host: HTMLElement): Promise<RhythmResult> {
  return new Promise((resolve) => {
    host.innerHTML = `
      <div class="rhythm">
        <p class="stage-tag">Stage 1 · 召喚</p>
        <h2>The Summoning</h2>
        <p class="hint">Strike as each drum reaches the ring.<br>
          <b class="don-t">Centre = DON</b> · <b class="ka-t">Rim = KA</b>
          <span class="keys">Keys: F/J/Space = DON, D/K = KA</span></p>
        <div class="lane-wrap"><canvas class="lane"></canvas></div>
        <div class="rhythm-stats">
          <div><span class="label">Drum power</span><span class="live-mult">×${RHYTHM.min}</span></div>
          <div class="judge" aria-live="polite"></div>
          <div><span class="label">Combo</span><span class="combo">0</span></div>
        </div>
        <div class="pad" role="group" aria-label="Taiko drum">
          <button class="pad-rim" aria-label="KA, strike the rim"></button>
          <button class="pad-head" aria-label="DON, strike the centre">
            <svg viewBox="0 0 100 100" aria-hidden="true">${mitsudomoe(50, 50, 30, '#b3201b')}</svg>
          </button>
        </div>
        <div class="rhythm-actions">
          <button class="btn primary begin">Begin</button>
          <button class="btn ghost auto">Let the drummers play</button>
        </div>
      </div>`;

    const canvas = host.querySelector<HTMLCanvasElement>('.lane')!;
    const ctx = canvas.getContext('2d')!;
    const judgeEl = host.querySelector<HTMLElement>('.judge')!;
    const multEl = host.querySelector<HTMLElement>('.live-mult')!;
    const comboEl = host.querySelector<HTMLElement>('.combo')!;
    const pad = host.querySelector<HTMLElement>('.pad')!;
    const actions = host.querySelector<HTMLElement>('.rhythm-actions')!;

    let notes: Note[] = [];
    let running = false;
    let auto = false;
    let perfects = 0;
    let goods = 0;
    let combo = 0;
    let raf = 0;
    let flash: { type: NoteType; t: number } | null = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    const setJudge = (j: Judgement, wrong = false) => {
      judgeEl.textContent = j === 'perfect' ? '良 PERFECT' : j === 'good' ? '可 GOOD' : wrong ? '× WRONG DRUM' : '不可 MISS';
      judgeEl.className = `judge ${j}`;
      void judgeEl.offsetWidth;
      judgeEl.classList.add('show');
    };

    const record = (n: Note, j: Judgement, wrong = false) => {
      n.judged = j;
      if (j === 'perfect') perfects++;
      if (j === 'good') goods++;
      combo = j === 'miss' ? 0 : combo + 1;
      comboEl.textContent = String(combo);
      multEl.textContent = `×${multiplierFor(perfects, goods)}`;
      setJudge(j, wrong);
    };

    const hit = (type: NoteType) => {
      if (type === 'don') audio.don();
      else audio.ka();
      const now = audio.now();
      flash = { type, t: now };
      pad.classList.remove('hit-don', 'hit-ka');
      void pad.offsetWidth;
      pad.classList.add(type === 'don' ? 'hit-don' : 'hit-ka');
      if (!running || auto) return;
      let best: Note | null = null;
      for (const n of notes) {
        if (n.judged) continue;
        const d = Math.abs(n.time - now);
        if (d <= RHYTHM.goodWindow && (!best || d < Math.abs(best.time - now))) best = n;
      }
      if (!best) return;
      const d = Math.abs(best.time - now);
      if (best.type !== type) record(best, 'miss', true);
      else record(best, d <= RHYTHM.perfectWindow ? 'perfect' : 'good');
    };

    const onKey = (e: KeyboardEvent) => {
      const t = KEYS[e.code];
      if (!t || e.repeat) return;
      e.preventDefault();
      hit(t);
    };
    const onPointer = (type: NoteType) => (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      hit(type);
    };
    host.querySelector<HTMLElement>('.pad-head')!.addEventListener('pointerdown', onPointer('don'));
    host.querySelector<HTMLElement>('.pad-rim')!.addEventListener('pointerdown', onPointer('ka'));
    window.addEventListener('keydown', onKey);

    const draw = () => {
      const now = audio.now();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const tx = Math.min(70, w * 0.16);
      const cy = h / 2;
      const r = Math.min(h * 0.32, 26);

      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(0, cy - r * 1.5, w, r * 3);
      // Beat lines.
      if (running) {
        const first = notes[0]?.time ?? now;
        for (let b = -LEAD_IN_BEATS; b < 20; b++) {
          const t = first + b * BEAT;
          const x = tx + ((t - now) / TRAVEL) * (w - tx);
          if (x < 0 || x > w) continue;
          ctx.fillStyle = 'rgba(243,199,90,.18)';
          ctx.fillRect(x - 0.5, cy - r * 1.5, 1, r * 3);
        }
      }

      // Target ring.
      const fl = flash && now - flash.t < 0.12 ? flash : null;
      ctx.lineWidth = 3;
      ctx.strokeStyle = fl ? (fl.type === 'don' ? '#ff5a4e' : '#5ab8ff') : '#f3c75a';
      ctx.beginPath();
      ctx.arc(tx, cy, r + 4, 0, Math.PI * 2);
      ctx.stroke();

      for (const n of notes) {
        if (auto && !n.judged && now >= n.time) {
          const j = n.auto ?? 'miss';
          if (j !== 'miss') hit(n.type);
          record(n, j);
        }
        if (!auto && !n.judged && now - n.time > RHYTHM.goodWindow) record(n, 'miss');
        if (n.judged && n.judged !== 'miss') continue;
        const x = tx + ((n.time - now) / TRAVEL) * (w - tx);
        if (x < -r || x > w + r) continue;
        const nr = n.type === 'don' ? r : r * 0.82;
        ctx.globalAlpha = n.judged === 'miss' ? 0.3 : 1;
        ctx.fillStyle = n.type === 'don' ? '#e8392f' : '#2f8fe8';
        ctx.strokeStyle = '#fff3d6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, cy, nr, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff3d6';
        ctx.font = `900 ${nr * 0.8}px "Noto Serif JP", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.type === 'don' ? 'ど' : 'か', x, cy + 1);
        ctx.globalAlpha = 1;
      }

      if (running && notes.every((n) => n.judged)) {
        finish();
        return;
      }
      raf = requestAnimationFrame(draw);
    };

    const start = (useAuto: boolean) => {
      audio.unlock();
      auto = useAuto;
      actions.hidden = true;
      host.querySelector('.rhythm')!.classList.toggle('auto-mode', auto);
      const t0 = audio.now() + 0.4;
      for (let b = 0; b < LEAD_IN_BEATS; b++) audio.kane(t0 + b * BEAT, b === LEAD_IN_BEATS - 1 ? 1 : 0.6);
      notes = buildChart(t0 + LEAD_IN_BEATS * BEAT + TRAVEL * 0.1);
      if (auto) {
        const sim = simulateRhythm(cryptoRng);
        const js: Judgement[] = [
          ...Array<Judgement>(sim.perfects).fill('perfect'),
          ...Array<Judgement>(sim.goods).fill('good'),
          ...Array<Judgement>(sim.misses).fill('miss'),
        ].sort(() => Math.random() - 0.5);
        notes.forEach((n, i) => (n.auto = js[i]));
      }
      running = true;
    };

    const finish = () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      const result: RhythmResult = {
        perfects,
        goods,
        misses: RHYTHM.notes - perfects - goods,
        multiplier: multiplierFor(perfects, goods),
      };
      audio.gong(undefined, 0.8);
      judgeEl.className = 'judge final show';
      judgeEl.textContent = `Drum power ×${result.multiplier}`;
      window.setTimeout(() => resolve(result), 1800);
    };

    host.querySelector('.begin')!.addEventListener('click', () => start(false));
    host.querySelector('.auto')!.addEventListener('click', () => start(true));
    raf = requestAnimationFrame(draw);
  });
}
