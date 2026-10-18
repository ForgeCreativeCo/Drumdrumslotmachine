/**
 * Stage 1, "The Summoning", played on the cabinet: the lane runs across the
 * reel window and the deck's big drum is the pad.
 */
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import gsap from 'gsap';
import { audio } from '../audio/drums';
import { RHYTHM, multiplierFor, simulateRhythm, type Judgement, type RhythmResult } from '../math/rhythm';
import { cryptoRng } from '../math/rng';
import { FONT, makeCanvas } from './paint';
import type { Stage } from './stage';
import { WINDOW_W } from './reels';
import { tex } from './textures';
import { GOLD, PlaqueButton, labelText, linear } from './ui';

type NoteType = 'don' | 'ka';

interface Note {
  time: number;
  type: NoteType;
  judged: Judgement | null;
  auto?: Judgement;
  sprite: Sprite;
}

const BPM = 116;
const BEAT = 60 / BPM;
const TRAVEL = 1.8;
const LEAD_IN = 4;
// Four bars of eighth notes; x marks a note. 18 notes in total.
const CHART = 'x.x.x.x.x.x.x.xxx.xx.x.xxx.x.x..';
const KEYS: Record<string, NoteType> = { KeyF: 'don', KeyJ: 'don', Space: 'don', KeyD: 'ka', KeyK: 'ka' };

const LANE_Y = 262;
const HIT_X = 120;

let noteTex: Record<NoteType, Texture> | null = null;
function noteTextures(): Record<NoteType, Texture> {
  if (noteTex) return noteTex;
  const paint = (type: NoteType) => {
    const r = type === 'don' ? 46 : 38;
    const [c, ctx] = makeCanvas(r * 2 + 8);
    const m = r + 4;
    ctx.beginPath();
    ctx.arc(m, m, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(m - r * 0.3, m - r * 0.3, 2, m, m, r);
    g.addColorStop(0, type === 'don' ? '#ff9a7a' : '#9fd0ff');
    g.addColorStop(1, type === 'don' ? '#b3201b' : '#1f5fc0');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fff3d6';
    ctx.stroke();
    ctx.font = `900 ${r * 0.95}px ${FONT.kanji}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff3d6';
    ctx.fillText(type === 'don' ? 'ど' : 'か', m, m + 2);
    return Texture.from(c);
  };
  noteTex = { don: paint('don'), ka: paint('ka') };
  return noteTex;
}

export function playSummoning(stage: Stage): Promise<RhythmResult> {
  const panel = stage.main.openPanel();
  const t = noteTextures();

  const title = new Text({
    text: 'THE SUMMONING',
    style: { fontFamily: FONT.numbers, fontSize: 46, fill: GOLD(), letterSpacing: 6, stroke: { color: '#050a20', width: 6 } },
    anchor: 0.5,
  });
  title.position.set(WINDOW_W / 2, 52);
  const tag = labelText(20, 'STAGE 1 · 召喚', '#9fd8ff');
  tag.position.set(WINDOW_W / 2, 100);
  const hint = new Text({
    text: 'Strike the drum below as each note reaches the ring.\nCentre = DON (red) · Rim = KA (blue) · Keys F/J = DON, D/K = KA',
    style: { fontFamily: FONT.ui, fontWeight: '700', fontSize: 22, fill: '#e8dcc0', align: 'center', lineHeight: 32 },
    anchor: 0.5,
  });
  hint.position.set(WINDOW_W / 2, 158);

  const lane = new Graphics()
    .roundRect(10, LANE_Y - 62, WINDOW_W - 20, 124, 20)
    .fill(linear([[0, '#1d0a0a'], [1, '#2b1210']]))
    .stroke({ width: 3, color: 0xf3c75a, alpha: 0.5 });
  const beats = new Graphics();
  const ring = new Graphics().circle(HIT_X, LANE_Y, 50).stroke({ width: 5, fill: GOLD() });
  const ringFlash = new Sprite({ texture: tex().glow, anchor: 0.5, x: HIT_X, y: LANE_Y, blendMode: 'add', alpha: 0 });
  ringFlash.scale.set(1.6);
  const notesLayer = new Container();

  const judge = new Text({
    text: '',
    style: { fontFamily: FONT.numbers, fontSize: 40, fill: '#ffe08a', stroke: { color: '#050a20', width: 6 } },
    anchor: 0.5,
  });
  judge.position.set(WINDOW_W / 2, 380);
  const combo = new Text({
    text: '',
    style: { fontFamily: FONT.numbers, fontSize: 26, fill: '#bfe6ff', letterSpacing: 3 },
    anchor: 0.5,
  });
  combo.position.set(WINDOW_W / 2, 428);

  const actions = new Container();
  actions.position.set(WINDOW_W / 2, 470);
  panel.addChild(title, tag, hint, lane, beats, notesLayer, ring, ringFlash, judge, combo, actions);

  let notes: Note[] = [];
  let running = false;
  let auto = false;
  let started = false;
  let perfects = 0;
  let goods = 0;
  let streak = 0;
  stage.top.showPower(RHYTHM.min);

  return new Promise((resolve) => {
    const show = (j: Judgement, wrong = false) => {
      judge.text = j === 'perfect' ? '良  PERFECT' : j === 'good' ? '可  GOOD' : wrong ? '×  WRONG DRUM' : '不可  MISS';
      judge.style.fill = j === 'perfect' ? '#ffe08a' : j === 'good' ? '#b9f0a0' : '#9a8a8a';
      gsap.fromTo(judge.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.25, ease: 'back.out(3)' });
    };

    const record = (n: Note, j: Judgement, wrong = false) => {
      n.judged = j;
      if (j === 'perfect') perfects++;
      if (j === 'good') goods++;
      streak = j === 'miss' ? 0 : streak + 1;
      combo.text = streak > 1 ? `${streak} COMBO` : '';
      stage.top.showPower(multiplierFor(perfects, goods));
      show(j, wrong);
      if (j !== 'miss') {
        gsap.fromTo(ringFlash, { alpha: 1 }, { alpha: 0, duration: 0.3 });
        gsap.to(n.sprite, { alpha: 0, duration: 0.15 });
        gsap.to(n.sprite.scale, { x: 1.6, y: 1.6, duration: 0.15 });
        if (j === 'perfect') stage.top.fireworks(1);
      } else {
        n.sprite.alpha = 0.3;
      }
    };

    const hit = (type: NoteType, fromPad: boolean) => {
      if (type === 'don') audio.don();
      else audio.ka();
      if (!fromPad) stage.deck.padHit(type);
      if (!started && !auto) {
        if (type === 'don') start(false);
        return;
      }
      if (!running || auto) return;
      const now = audio.now();
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
      const k = KEYS[e.code];
      if (!k || e.repeat) return;
      e.preventDefault();
      audio.unlock();
      hit(k, false);
    };
    window.addEventListener('keydown', onKey);
    stage.deck.setPad((k) => {
      audio.unlock();
      hit(k, true);
    });

    const begin = new PlaqueButton('BEGIN', 280, () => start(false));
    begin.x = -170;
    const autoBtn = new PlaqueButton('LET THE DRUMMERS PLAY', 400, () => start(true), false);
    autoBtn.x = 190;
    actions.addChild(begin, autoBtn);
    judge.text = 'Strike DON or press BEGIN';
    judge.style.fill = '#e8dcc0';

    const start = (useAuto: boolean) => {
      if (started) return;
      started = true;
      audio.unlock();
      auto = useAuto;
      gsap.to(actions, { alpha: 0, duration: 0.2, onComplete: () => (actions.visible = false) });
      judge.text = auto ? 'The drummers play…' : 'Ready…';
      const t0 = audio.now() + 0.4;
      for (let b = 0; b < LEAD_IN; b++) audio.kane(t0 + b * BEAT, b === LEAD_IN - 1 ? 1 : 0.6);
      const first = t0 + LEAD_IN * BEAT + TRAVEL * 0.1;
      notes = [];
      CHART.split('').forEach((c, i) => {
        if (c !== 'x') return;
        const type: NoteType = Math.random() < 0.62 ? 'don' : 'ka';
        const sprite = new Sprite({ texture: t[type], anchor: 0.5, y: LANE_Y, x: -200 });
        notesLayer.addChild(sprite);
        notes.push({ time: first + (i * BEAT) / 2, type, judged: null, sprite });
      });
      if (notes.length !== RHYTHM.notes) throw new Error('Chart length must match RHYTHM.notes');
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

    const frame = () => {
      if (!running) return;
      const now = audio.now();
      const w = WINDOW_W - 20;
      beats.clear();
      const first = notes[0].time;
      for (let b = -LEAD_IN; b < 20; b++) {
        const x = HIT_X + ((first + b * BEAT - now) / TRAVEL) * (w - HIT_X);
        if (x > 20 && x < w) beats.rect(x - 1, LANE_Y - 56, 2, 112);
      }
      beats.fill({ color: 0xf3c75a, alpha: 0.18 });
      for (const n of notes) {
        if (auto && !n.judged && now >= n.time) {
          const j = n.auto ?? 'miss';
          if (j !== 'miss') {
            if (n.type === 'don') audio.don();
            else audio.ka();
            stage.deck.padHit(n.type);
          }
          record(n, j);
        }
        if (!auto && !n.judged && now - n.time > RHYTHM.goodWindow) record(n, 'miss');
        if (n.judged && n.judged !== 'miss') continue;
        n.sprite.x = HIT_X + ((n.time - now) / TRAVEL) * (w - HIT_X);
        n.sprite.visible = n.sprite.x > -50 && n.sprite.x < w + 50;
      }
      if (notes.every((n) => n.judged)) finish();
    };
    stage.app.ticker.add(frame);

    const finish = () => {
      running = false;
      stage.app.ticker.remove(frame);
      window.removeEventListener('keydown', onKey);
      stage.deck.setPad(null);
      const result: RhythmResult = {
        perfects,
        goods,
        misses: RHYTHM.notes - perfects - goods,
        multiplier: multiplierFor(perfects, goods),
      };
      audio.gong(undefined, 0.8);
      stage.top.showPower(result.multiplier);
      stage.top.fireworks(4);
      stage.top.strike(0.8);
      judge.text = `DRUM POWER ×${result.multiplier}`;
      judge.style.fill = '#ffe08a';
      gsap.fromTo(judge.scale, { x: 2, y: 2 }, { x: 1.2, y: 1.2, duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      combo.text = `${perfects} perfect · ${goods} good · ${result.misses} miss`;
      window.setTimeout(() => resolve(result), 2000);
    };
  });
}
