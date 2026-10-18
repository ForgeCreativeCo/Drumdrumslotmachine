import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import gsap from 'gsap';
import { beat } from './beat';
import { FONT, makeCanvas } from './paint';
import { tex } from './textures';
import { BRASS, BrassButton, GOLD, bachi, inset, labelText, linear, moneyText } from './ui';

export const DECK_H = 400;
const W = 1080;

export interface DeckHandlers {
  spin: () => void;
  betDown: () => void;
  betUp: () => void;
  auto: () => void;
  turbo: () => void;
  sound: () => void;
  info: () => void;
}

function kobanTexture(): Texture {
  const [c, ctx] = makeCanvas(120, 70);
  ctx.beginPath();
  ctx.ellipse(60, 35, 56, 30, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(0, 5, 0, 65);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.5, '#e0a93a');
  g.addColorStop(1, '#8a5a10');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#6a4208';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(110, 70, 8, .55)';
  ctx.lineWidth = 2;
  for (let x = 22; x <= 98; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x, 52);
    ctx.stroke();
  }
  return Texture.from(c);
}

/** The button deck: credit and win meters, bet stack, the big drum and the brass buttons. */
export class Deck extends Container {
  private balance: Text;
  private win: Text;
  private betValue: Text;
  private coins = new Container();
  private koban = kobanTexture();
  private drum = new Container();
  private drumSprite: Sprite;
  private drumHalo: Sprite;
  private sticks: Graphics[];
  private spinLabel: Text;
  private betDown: BrassButton;
  private betUp: BrassButton;
  private buttons: Record<'auto' | 'turbo' | 'sound' | 'info', BrassButton>;
  private spinEnabled = true;
  private busy = false;

  constructor(h: DeckHandlers) {
    super();
    const bg = new Graphics()
      .rect(0, 0, W, DECK_H)
      .fill(linear([[0, '#2a0806'], [0.4, '#160404'], [1, '#080102']]))
      .rect(0, 0, W, 14)
      .fill(BRASS())
      .rect(0, 14, W, 3)
      .fill({ color: 0x000000, alpha: 0.6 });
    this.addChild(bg);
    for (let x = 30; x < W; x += 60) {
      const t = new Sprite({ texture: tex().dot, anchor: 0.5, tint: 0xfff1c2, x, y: 7 });
      t.scale.set(0.2);
      this.addChild(t);
    }

    // Credit meter.
    const credit = new Container();
    credit.position.set(30, 42);
    const cl = labelText(17, 'CREDIT');
    cl.position.set(165, 26);
    this.balance = moneyText(46);
    this.balance.position.set(165, 74);
    credit.addChild(inset(330, 112), cl, this.balance);
    this.addChild(credit);

    // Win meter.
    const winBox = new Container();
    winBox.position.set(W - 360, 42);
    const wl = labelText(17, 'WIN');
    wl.position.set(165, 26);
    this.win = moneyText(46, '0.00');
    this.win.position.set(165, 74);
    winBox.addChild(inset(330, 112), wl, this.win);
    this.addChild(winBox);

    // Bet: a stack of koban that grows with the stake.
    const bet = new Container();
    bet.position.set(195, 284);
    const bl = labelText(17, 'BET');
    bl.y = -92;
    this.coins.y = -6;
    this.betValue = moneyText(38);
    this.betValue.y = 58;
    this.betDown = new BrassButton(38, '−', h.betDown);
    this.betDown.x = -125;
    this.betUp = new BrassButton(38, '+', h.betUp);
    this.betUp.x = 125;
    for (const b of [this.betDown, this.betUp]) (b.children[2] as Text).style.fontSize = 40;
    bet.addChild(bl, this.coins, this.betValue, this.betDown, this.betUp);
    this.addChild(bet);

    // The big drum.
    this.drum.position.set(W / 2, 196);
    this.drumHalo = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0xff9a40, blendMode: 'add' });
    this.drumHalo.scale.set(3.6, 2.8);
    this.sticks = [bachi(), bachi()];
    this.sticks[0].position.set(-118, -70);
    this.sticks[0].rotation = -0.62;
    this.sticks[1].position.set(118, -70);
    this.sticks[1].rotation = 0.62;
    this.drumSprite = new Sprite({ texture: tex().spinDrum, anchor: 0.5 });
    this.drumSprite.scale.set(0.86);
    this.drum.addChild(this.drumHalo, ...this.sticks, this.drumSprite);
    const ribbon = new Graphics()
      .poly([-120, -26, 120, -26, 104, 0, 120, 26, -120, 26, -104, 0])
      .fill(GOLD())
      .stroke({ width: 3, color: 0x5a3008 });
    ribbon.y = 160;
    this.spinLabel = new Text({
      text: 'SPIN',
      style: { fontFamily: FONT.numbers, fontSize: 34, fill: '#5a0d0d', letterSpacing: 8 },
      anchor: 0.5,
    });
    this.spinLabel.y = 161;
    this.drum.addChild(ribbon, this.spinLabel);
    this.drum.eventMode = 'static';
    this.drum.cursor = 'pointer';
    this.drum.hitArea = { contains: (x: number, y: number) => x * x + (y * 1.25) ** 2 < 170 * 170 || (Math.abs(x) < 120 && Math.abs(y - 160) < 26) };
    this.drum.on('pointerdown', () => this.spinEnabled && this.strike());
    this.drum.on('pointertap', () => this.spinEnabled && h.spin());
    this.addChild(this.drum);

    // Brass buttons.
    this.buttons = {
      auto: new BrassButton(42, 'AUTO', h.auto),
      turbo: new BrassButton(42, 'TURBO', h.turbo),
      sound: new BrassButton(42, 'SOUND', h.sound),
      info: new BrassButton(42, 'INFO', h.info),
    };
    const pos: [number, number][] = [
      [W - 280, 238],
      [W - 140, 238],
      [W - 280, 340],
      [W - 140, 340],
    ];
    Object.values(this.buttons).forEach((b, i) => {
      b.position.set(...pos[i]);
      this.addChild(b);
    });
  }

  /** Bachi strike the drum head. */
  strike(): void {
    const [l, r] = this.sticks;
    gsap.timeline()
      .to(l, { rotation: -0.25, x: -70, duration: 0.07, ease: 'power3.in' }, 0)
      .to(r, { rotation: 0.25, x: 70, duration: 0.07, ease: 'power3.in' }, 0)
      .to(l, { rotation: -0.62, x: -118, duration: 0.3, ease: 'back.out(2)' }, 0.07)
      .to(r, { rotation: 0.62, x: 118, duration: 0.3, ease: 'back.out(2)' }, 0.07);
    gsap.fromTo(this.drumSprite.scale, { x: 0.9, y: 0.8 }, { x: 0.86, y: 0.86, duration: 0.45, ease: 'elastic.out(1, 0.35)', delay: 0.06 });
    gsap.fromTo(this.drumHalo, { alpha: 1 }, { alpha: 0.4, duration: 0.6, delay: 0.06 });
  }

  setBalance(v: string): void {
    this.balance.text = v;
  }

  setWin(v: string): void {
    if (this.win.text === v) return;
    this.win.text = v;
    if (v !== '0.00') gsap.fromTo(this.win.scale, { x: 1.2, y: 1.2 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' });
  }

  setBet(v: string, level: number): void {
    this.betValue.text = v;
    this.coins.removeChildren();
    const n = Math.min(8, level + 1);
    for (let i = 0; i < n; i++) {
      const c = new Sprite({ texture: this.koban, anchor: 0.5 });
      c.scale.set(0.8);
      c.y = -i * 9;
      c.x = (i % 2 ? 2 : -2) * (i / n);
      this.coins.addChild(c);
    }
    const top = this.coins.children[this.coins.children.length - 1];
    if (top) gsap.fromTo(top, { y: top.y - 40, alpha: 0 }, { y: top.y, alpha: 1, duration: 0.25, ease: 'bounce.out' });
  }

  setState(s: { auto: boolean; turbo: boolean; muted: boolean; betLocked: boolean; spinEnabled: boolean; busy: boolean }): void {
    this.buttons.auto.lit = s.auto;
    this.buttons.turbo.lit = s.turbo;
    this.buttons.sound.lit = !s.muted;
    this.buttons.sound.text = s.muted ? 'MUTED' : 'SOUND';
    this.betDown.enabled = !s.betLocked;
    this.betUp.enabled = !s.betLocked;
    this.buttons.info.enabled = !s.betLocked;
    this.spinEnabled = s.spinEnabled;
    this.busy = s.busy;
    this.drum.alpha = s.spinEnabled ? 1 : 0.55;
    this.drum.cursor = s.spinEnabled ? 'pointer' : 'default';
    this.spinLabel.text = s.auto ? 'STOP' : 'SPIN';
  }

  setBetLimits(atMin: boolean, atMax: boolean, locked: boolean): void {
    this.betDown.enabled = !locked && !atMin;
    this.betUp.enabled = !locked && !atMax;
  }

  tick(_dt: number, time: number): void {
    const p = beat.pulse(4);
    if (!this.busy && this.spinEnabled) {
      this.drumHalo.alpha = Math.max(this.drumHalo.alpha * 0.96, 0.3 + p * 0.45);
      this.drumSprite.rotation = 0;
    } else if (this.busy) {
      this.drumHalo.alpha = 0.25;
    }
    this.drumHalo.scale.set(3.6 + Math.sin(time * 2) * 0.1, 2.8);
    for (const b of Object.values(this.buttons)) b.tick();
  }
}
