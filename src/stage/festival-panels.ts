/**
 * In-cabinet panels for the Festival: the intro, Raijin's Crescendo and the
 * summary all play inside the reel window instead of pop-ups.
 */
import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { audio } from '../audio/drums';
import { JACKPOTS, STICKY_MULT_CAP } from '../math/game';
import { RHYTHM } from '../math/rhythm';
import { FONT } from './paint';
import { WINDOW_H, WINDOW_W } from './reels';
import type { Stage } from './stage';
import { GOLD, PlaqueButton, brushText, labelText, linear, moneyText } from './ui';

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function heading(panel: Container, title: string, tag: string, y = 52): void {
  const t = new Text({
    text: title,
    style: { fontFamily: FONT.numbers, fontSize: 44, fill: GOLD(), letterSpacing: 5, stroke: { color: '#050a20', width: 6 } },
    anchor: 0.5,
  });
  t.position.set(WINDOW_W / 2, y);
  const g = labelText(20, tag, '#9fd8ff');
  g.position.set(WINDOW_W / 2, y + 46);
  panel.addChild(t, g);
}

/** Resolve when the button is tapped, the deck drum is struck, or Enter/Space is pressed. */
function waitForButton(stage: Stage, panel: Container, label: string, y = WINDOW_H - 62): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      audio.unlock();
      window.removeEventListener('keydown', onKey);
      stage.deck.setPad(null);
      resolve();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      finish();
    };
    const btn = new PlaqueButton(label, 420, finish);
    btn.position.set(WINDOW_W / 2, y);
    gsap.fromTo(btn.scale, { x: 0.6, y: 0.6 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(2.5)' });
    gsap.to(btn, { alpha: 0.75, duration: 0.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    panel.addChild(btn);
    window.addEventListener('keydown', onKey);
    stage.deck.setPad(() => finish());
  });
}

export async function festivalIntro(stage: Stage, scatters: number, spins: number): Promise<void> {
  const panel = stage.main.openPanel();
  const jp = brushText(84, '千の太鼓祭り');
  jp.position.set(WINDOW_W / 2, 74);
  const en = new Text({
    text: 'FESTIVAL OF A THOUSAND DRUMS',
    style: { fontFamily: FONT.numbers, fontSize: 32, fill: '#ffe9a8', letterSpacing: 4, stroke: { color: '#050a20', width: 5 } },
    anchor: 0.5,
  });
  en.position.set(WINDOW_W / 2, 136);
  const award = moneyText(56, `${spins} FREE SPINS`);
  award.position.set(WINDOW_W / 2, 202);
  const lines = [
    `1  THE SUMMONING · drum in time for Drum Power ×${RHYTHM.min} to ×${RHYTHM.max}`,
    `2  DRUM STORM · Taiko Wilds lock and beat up to ×${STICKY_MULT_CAP}`,
    `3  RAIJIN'S CRESCENDO · every new wild and 雷 charges a jackpot`,
  ];
  const list = new Text({
    text: lines.join('\n'),
    style: { fontFamily: FONT.ui, fontWeight: '700', fontSize: 23, fill: '#e8dcc0', lineHeight: 40 },
    anchor: { x: 0.5, y: 0 },
  });
  list.position.set(WINDOW_W / 2, 252);
  const sub = labelText(18, `${scatters} THUNDER DRUMS ANSWERED`, '#9fd8ff');
  sub.position.set(WINDOW_W / 2, 22);
  panel.addChild(jp, en, award, list, sub);
  for (const [i, c] of [jp, en, award, list].entries()) {
    gsap.from(c, { alpha: 0, y: c.y + 24, duration: 0.5, delay: 0.15 * i, ease: 'power2.out' });
  }
  await wait(600);
  await waitForButton(stage, panel, 'SUMMON THE DRUMS');
}

/** Stage 3: each charge is a bolt from the sky, through its meter orb, into the counter. */
export async function crescendo(stage: Stage, charges: number, jackpot: string | null, award: string, fmt: (x: number) => string): Promise<void> {
  const panel = stage.main.openPanel();
  heading(panel, "RAIJIN'S CRESCENDO", 'STAGE 3 · 雷神', 46);
  const counter = moneyText(150, '0');
  counter.position.set(250, 262);
  const cl = labelText(20, 'CHARGES', '#bfe6ff');
  cl.position.set(250, 160);

  const ladder = new Container();
  ladder.position.set(640, 150);
  const ROW = 64;
  const rows = new Map<string, { bg: Graphics; c: Container }>();
  [...JACKPOTS].reverse().forEach((j, i) => {
    const c = new Container();
    c.y = i * ROW;
    const bg = new Graphics()
      .roundRect(-200, -28, 400, 56, 14)
      .fill(linear([[0, '#1a2448'], [1, '#080c20']]))
      .stroke({ width: 3, color: 0x6fc3ff, alpha: 0.5 });
    const name = new Text({ text: j.name.toUpperCase(), style: { fontFamily: FONT.numbers, fontSize: 24, fill: '#ffe9a8', letterSpacing: 3 }, anchor: { x: 0, y: 0.5 } });
    name.position.set(-182, -7);
    const need = labelText(13, `${j.need}+ CHARGES`, '#9fb8e8');
    need.anchor.set(0, 0.5);
    need.position.set(-182, 15);
    const value = moneyText(28, fmt(j.pay));
    value.anchor.set(1, 0.5);
    value.x = 182;
    c.addChild(bg, name, need, value);
    c.alpha = 0.55;
    ladder.addChild(c);
    rows.set(j.name, { bg, c });
  });
  const result = new Text({
    text: '',
    style: { fontFamily: FONT.numbers, fontSize: 40, fill: '#ffe08a', align: 'center', stroke: { color: '#050a20', width: 6 } },
    anchor: 0.5,
  });
  result.position.set(WINDOW_W / 2, 432);
  panel.addChild(cl, counter, ladder, result);

  stage.pullBack(true);
  stage.top.boostRing(4, 3);
  stage.top.setCharges(0);
  await wait(900);
  audio.roll(1.2);
  await wait(1100);

  for (let i = 1; i <= charges; i++) {
    const orb = stage.top.meterPoint(i);
    const target = counter.getGlobalPosition();
    stage.bolt([stage.top.skyPoint(), orb, [target.x, target.y]], 0xdff4ff, 0.42, 5);
    stage.top.setCharges(i);
    counter.text = String(i);
    gsap.fromTo(counter.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
    audio.thunder(undefined, 0.3 + Math.min(0.5, i / 20));
    audio.don(undefined, 0.7);
    const tier = JACKPOTS.find((j) => j.need === i);
    if (tier) {
      const row = rows.get(tier.name)!;
      row.c.alpha = 1;
      row.bg.clear().roundRect(-200, -28, 400, 56, 14).fill(linear([[0, '#8a5a10'], [1, '#2a1404']])).stroke({ width: 4, fill: GOLD() });
      gsap.fromTo(row.c.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      stage.top.flarePlaque(tier.name);
      stage.top.strike(0.8);
      stage.shake('small');
      audio.gong(undefined, 0.7);
      await wait(500);
    }
    await wait(Math.max(110, 400 - i * 22));
  }

  if (jackpot) {
    result.text = `${jackpot.toUpperCase()} JACKPOT · ${award}`;
    gsap.fromTo(result.scale, { x: 2.2, y: 2.2 }, { x: 1, y: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)' });
    audio.gong();
    audio.winSting(3);
    stage.shake('big');
    stage.top.fireworks(6);
    if (jackpot === 'Grand') stage.goldFlood(8);
    else {
      stage.coinShower(60);
      stage.celebrate(4);
    }
  } else {
    result.text = `${charges} charge${charges === 1 ? '' : 's'}. The storm rests, this time.`;
    result.style.fontSize = 28;
  }
  await wait(1200);
  await waitForButton(stage, panel, 'CONTINUE', WINDOW_H - 42);
  stage.pullBack(false);
}

export async function festivalSummary(
  stage: Stage,
  s: { multiplier: number; spins: number; spinsWin: string; crescendo: string; total: string },
): Promise<void> {
  const panel = stage.main.openPanel();
  heading(panel, 'FESTIVAL COMPLETE', '祭り完了', 50);
  const rows: [string, string][] = [
    ['Drum power', `×${s.multiplier}`],
    ['Free spins played', String(s.spins)],
    ['Drum Storm wins', s.spinsWin],
    ['Crescendo', s.crescendo],
  ];
  rows.forEach(([k, v], i) => {
    const y = 150 + i * 44;
    const a = new Text({ text: k, style: { fontFamily: FONT.ui, fontWeight: '700', fontSize: 24, fill: '#c8d4f0' }, anchor: { x: 0, y: 0.5 } });
    a.position.set(170, y);
    const b = new Text({ text: v, style: { fontFamily: FONT.numbers, fontSize: 26, fill: '#ffe9a8' }, anchor: { x: 1, y: 0.5 } });
    b.position.set(WINDOW_W - 170, y);
    panel.addChild(a, b);
  });
  const total = moneyText(76, s.total);
  total.position.set(WINDOW_W / 2, 366);
  const tl = labelText(20, 'TOTAL', '#bfe6ff');
  tl.position.set(WINDOW_W / 2, 318);
  panel.addChild(tl, total);
  gsap.fromTo(total.scale, { x: 0.5, y: 0.5 }, { x: 1, y: 1, duration: 0.7, ease: 'back.out(2)' });
  await waitForButton(stage, panel, 'COLLECT');
}
