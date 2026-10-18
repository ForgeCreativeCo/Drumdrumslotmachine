/**
 * The win climb, played on the cabinet: the amount counts up and each time
 * it crosses a tier (Big, Mega, Epic) the banner slams in, Raijin strikes and
 * the music steps up, while koban pour into a pile on the button deck.
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { audio } from '../audio/drums';
import { FONT } from './paint';
import type { Stage } from './stage';
import { tex } from './textures';
import { GOLD, brushText, linear, moneyText } from './ui';

export const WIN_TIERS = [
  { at: 15, label: 'BIG WIN', jp: '大勝利', color: 0xffb340 },
  { at: 40, label: 'MEGA WIN', jp: '豪勝', color: 0xff5a3a },
  { at: 100, label: 'EPIC WIN', jp: '大祭', color: 0xb98cff },
];

const W = 1080;

function banner(): Container {
  const c = new Container();
  const w = 900;
  const h = 470;
  // Hanging rod and tassels, like a festival nobori.
  const rod = new Graphics().roundRect(-w / 2 - 40, -h / 2 - 34, w + 80, 22, 11).fill(GOLD());
  const cloth = new Graphics()
    .roundRect(-w / 2, -h / 2, w, h, 28)
    .fill(linear([[0, '#c0281e'], [0.55, '#7a1512'], [1, '#2a0504']]))
    .stroke({ width: 8, fill: GOLD() })
    .roundRect(-w / 2 + 18, -h / 2 + 18, w - 36, h - 36, 18)
    .stroke({ width: 2, color: 0xffe9a8, alpha: 0.5 });
  const tassels = new Graphics();
  for (const x of [-w / 2 + 40, w / 2 - 40]) {
    tassels.moveTo(x, h / 2).lineTo(x, h / 2 + 60).stroke({ width: 4, color: 0xf3c75a });
    tassels.poly([x - 14, h / 2 + 56, x + 14, h / 2 + 56, x + 18, h / 2 + 96, x - 18, h / 2 + 96]).fill(0xb3201b);
  }
  c.addChild(tassels, cloth, rod);
  return c;
}

export function winClimb(stage: Stage, amount: number, bet: number, fmt: (n: number) => string): Promise<void> {
  const x = amount / bet;
  const tiers = WIN_TIERS.filter((t) => x >= t.at);
  if (!tiers.length) return Promise.resolve();

  const { main, deck } = stage.screens;
  const root = new Container();
  const dim = new Graphics().rect(0, main.y, W, main.h + deck.h).fill({ color: 0x050208, alpha: 0.82 });
  const rays = new Sprite({ texture: tex().glow, anchor: 0.5, blendMode: 'add', tint: tiers[0].color });
  rays.position.set(W / 2, main.y + 380);
  rays.scale.set(9);
  rays.alpha = 0.5;
  const b = banner();
  b.position.set(W / 2, main.y + 380);
  const jp = brushText(150, '');
  jp.y = -110;
  const label = new Text({
    text: 'WIN',
    style: { fontFamily: FONT.numbers, fontSize: 70, fill: GOLD(), letterSpacing: 10, stroke: { color: '#2a0806', width: 8 } },
    anchor: 0.5,
  });
  label.y = 10;
  const value = moneyText(116, fmt(0));
  value.y = 140;
  b.addChild(jp, label, value);
  const pile = new Container();
  const skipHint = new Text({ text: 'TAP TO CONTINUE', style: { fontFamily: FONT.ui, fontWeight: '700', fontSize: 22, fill: '#e8cf9a', letterSpacing: 4 }, anchor: 0.5 });
  skipHint.position.set(W / 2, main.y + 770);
  skipHint.alpha = 0;
  root.addChild(dim, rays, b, pile, skipHint);
  stage.overlay.addChild(root);

  gsap.from(dim, { alpha: 0, duration: 0.3 });
  gsap.fromTo(b.scale, { x: 0.2, y: 0.2 }, { x: 1, y: 1, duration: 0.6, ease: 'back.out(1.8)' });
  gsap.to(rays, { rotation: Math.PI * 2, duration: 12, repeat: -1, ease: 'none' });
  gsap.to(skipHint, { alpha: 0.8, duration: 0.6, delay: 1, yoyo: true, repeat: -1 });
  stage.celebrate(30);

  // Koban pile on the deck: each coin lands on the stack in its column.
  const cols = new Array(24).fill(0);
  const floor = deck.y + deck.h - 30;
  const dropCoin = () => {
    const i = Math.floor(Math.random() * cols.length);
    const cx = 160 + (i / (cols.length - 1)) * (W - 320) + (Math.random() - 0.5) * 20;
    const ty = floor - cols[i];
    cols[i] = Math.min(220, cols[i] + 7);
    const c = new Sprite({ texture: tex().koban, anchor: 0.5 });
    c.scale.set(0.55 + Math.random() * 0.15);
    c.rotation = (Math.random() - 0.5) * 0.5;
    c.position.set(W / 2 + (Math.random() - 0.5) * 400, b.y + 220);
    pile.addChild(c);
    gsap.to(c, { x: cx, duration: 0.55, ease: 'power1.out' });
    gsap.to(c, { y: ty, duration: 0.55, ease: 'bounce.out', onComplete: () => Math.random() < 0.3 && audio.ka(undefined, 0.15) });
  };

  let tierIndex = -1;
  let rate = 8;
  const reach = (i: number) => {
    tierIndex = i;
    const t = WIN_TIERS[i];
    jp.text = t.jp;
    label.text = t.label;
    rays.tint = t.color;
    gsap.fromTo([jp.scale, label.scale], { x: 2.6, y: 2.6 }, { x: 1, y: 1, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
    gsap.fromTo(b, { rotation: -0.04 }, { rotation: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
    stage.shake('big');
    stage.flash(undefined, t.color, 0.02);
    stage.top.strike(1);
    stage.top.boostRing(4 + i * 2, 2);
    stage.top.fireworks(3 + i * 2);
    stage.coinShower(30 + i * 30);
    audio.climbSting(i);
    rate = 8 + i * 10;
  };

  return new Promise((resolve) => {
    const counter = { v: 0 };
    let skipped = false;
    let finished = false;
    const duration = Math.min(9, 2.4 + x * 0.045);
    let acc = 0;
    let last = performance.now();
    const pour = () => {
      const now = performance.now();
      acc += ((now - last) / 1000) * rate;
      last = now;
      while (acc >= 1 && !finished) {
        acc--;
        dropCoin();
      }
    };
    stage.app.ticker.add(pour);
    const beatDrum = window.setInterval(() => audio.don(audio.nextGrid(1), 0.5), (60 / audio.bpm) * 1000);

    const tween = gsap.to(counter, {
      v: amount,
      duration,
      ease: 'power1.inOut',
      onUpdate: () => {
        value.text = fmt(counter.v);
        const next = WIN_TIERS[tierIndex + 1];
        if (next && counter.v / bet >= next.at) reach(tierIndex + 1);
      },
      onComplete: () => land(),
    });

    const land = () => {
      if (finished) return;
      finished = true;
      tween.kill();
      window.clearInterval(beatDrum);
      value.text = fmt(amount);
      const top = tiers.length - 1;
      if (tierIndex < top) reach(top);
      gsap.fromTo(value.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.5, ease: 'back.out(3)' });
      audio.don(undefined, 1);
      audio.kane();
      window.setTimeout(close, skipped ? 500 : 1800);
    };

    const close = () => {
      stage.app.ticker.remove(pour);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onTap);
      gsap.to(root, {
        alpha: 0,
        duration: 0.45,
        onComplete: () => {
          // Coins may still be falling; stop every tween before the sprites go away.
          for (const c of pile.children) {
            gsap.killTweensOf(c);
            gsap.killTweensOf(c.scale);
          }
          gsap.killTweensOf([rays, skipHint, b, dim, jp.scale, label.scale, value.scale, b.scale]);
          root.destroy({ children: true });
          resolve();
        },
      });
    };

    const skip = () => {
      if (finished) return;
      skipped = true;
      land();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        skip();
      }
    };
    const onTap = () => skip();
    window.addEventListener('keydown', onKey);
    // A tap anywhere skips; listening on the window keeps the cabinet's buttons hit-testable.
    window.addEventListener('pointerdown', onTap);
  });
}
