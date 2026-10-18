import { Container, Graphics, Sprite, Text } from 'pixi.js';
import gsap from 'gsap';
import { beat } from './beat';
import { FONT } from './paint';
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

/** The button deck: credit and win meters, bet stack, the big drum and the brass buttons. */
export class Deck extends Container {
  private balance: Text;
  private win: Text;
  private betValue: Text;
  private coins = new Container();
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
  private pad: ((t: 'don' | 'ka') => void) | null = null;
  private padLayer = new Container();
  private rimFlash!: Graphics;
  private headFlash!: Sprite;
  private betGroup!: Container;

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
    this.betGroup = bet;

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
    this.drum.on('pointerdown', (e) => {
      if (this.pad) {
        const t = this.padType(e.global);
        this.pad(t);
        this.padHit(t);
      } else if (this.spinEnabled) this.strike();
    });
    this.drum.on('pointertap', () => !this.pad && this.spinEnabled && h.spin());
    this.addChild(this.drum);
    this.buildPadLayer();

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

  // Head ellipse of the spin-drum texture, relative to the sprite's centre.
  private static HEAD = { y: -78, rx: 142.8, ry: 88.5 };

  private buildPadLayer(): void {
    const k = 0.86;
    const { y, rx, ry } = Deck.HEAD;
    this.rimFlash = new Graphics()
      .ellipse(0, y * k, rx * k * 1.06, ry * k * 1.1)
      .stroke({ width: 10, color: 0x6fb8ff });
    this.rimFlash.alpha = 0.35;
    this.rimFlash.blendMode = 'add';
    this.headFlash = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0xff5a4e, blendMode: 'add', alpha: 0 });
    this.headFlash.position.set(0, y * k);
    this.headFlash.scale.set(2.4, 1.5);
    const don = new Text({ text: 'DON', style: { fontFamily: FONT.numbers, fontSize: 26, fill: '#ffffff', stroke: { color: '#5a0d0d', width: 5 } }, anchor: 0.5 });
    don.position.set(0, y * k + 46);
    const kaL = new Text({ text: 'KA', style: { fontFamily: FONT.numbers, fontSize: 24, fill: '#bfe0ff', stroke: { color: '#06122a', width: 5 } }, anchor: 0.5 });
    kaL.position.set(-150, 52);
    const kaR = new Text({ text: 'KA', style: kaL.style });
    kaR.anchor.set(0.5);
    kaR.position.set(150, 52);
    this.padLayer.addChild(this.headFlash, this.rimFlash, don, kaL, kaR);
    this.padLayer.visible = false;
    this.drum.addChild(this.padLayer);
  }

  private padType(global: { x: number; y: number }): 'don' | 'ka' {
    const p = this.drumSprite.toLocal(global);
    const { y, rx, ry } = Deck.HEAD;
    const d = (p.x / rx) ** 2 + ((p.y - y) / ry) ** 2;
    return d < 0.62 ? 'don' : 'ka';
  }

  /** Visual feedback for a drum hit in pad mode (also used by keyboard play). */
  padHit(t: 'don' | 'ka'): void {
    if (t === 'don') {
      this.strike();
      gsap.fromTo(this.headFlash, { alpha: 0.9 }, { alpha: 0, duration: 0.25 });
    } else {
      gsap.fromTo(this.rimFlash, { alpha: 1 }, { alpha: 0.35, duration: 0.25 });
      gsap.fromTo(this.drum.scale, { x: 1.17, y: 1.17 }, { x: 1.14, y: 1.14, duration: 0.2 });
    }
  }

  /** Turn the big drum into the rhythm pad (or back into the spin button with null). */
  setPad(handler: ((t: 'don' | 'ka') => void) | null): void {
    this.pad = handler;
    const on = !!handler;
    this.padLayer.visible = on;
    this.spinLabel.text = on ? 'STRIKE' : 'SPIN';
    gsap.to(this.drum.scale, { x: on ? 1.14 : 1, y: on ? 1.14 : 1, duration: 0.4, ease: 'back.out(2)' });
    for (const c of [this.betGroup, ...Object.values(this.buttons)]) {
      gsap.to(c, { alpha: on ? 0.2 : 1, duration: 0.3 });
      c.eventMode = on ? 'none' : 'static';
    }
    this.drum.alpha = 1;
    this.drum.cursor = 'pointer';
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
      const c = new Sprite({ texture: tex().koban, anchor: 0.5 });
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
    if (this.pad) return;
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
