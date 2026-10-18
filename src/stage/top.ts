import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { AdvancedBloomFilter } from 'pixi-filters';
import gsap from 'gsap';
import { JACKPOTS } from '../math/game';
import { beat } from './beat';
import { FONT, makeCanvas, paintNightScene, paintRidge, paintShrine } from './paint';
import { Particles } from './particles';
import { tex } from './textures';
import { GOLD, brushText, labelText, linear, moneyText } from './ui';

export const W = 1080;

// Optional painted backdrops: drop backdrop-festival.jpg / backdrop-storm.jpg into src/assets.
const ART = import.meta.glob('../assets/backdrop-*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function artUrl(name: 'festival' | 'storm'): string | undefined {
  return Object.entries(ART).find(([path]) => path.includes(`backdrop-${name}`))?.[1];
}

const TIER_STYLE: Record<string, { label: string; fill: [string, string]; w: number }> = {
  Grand: { label: '#ffe08a', fill: ['#8a1a10', '#2a0504'], w: 300 },
  Major: { label: '#ff9a7a', fill: ['#6a1030', '#1e0410'], w: 230 },
  Minor: { label: '#9fd8ff', fill: ['#14306a', '#060c22'], w: 230 },
  Mini: { label: '#b9f0a0', fill: ['#1a4a2a', '#06160c'], w: 230 },
};

const RIDGE = {
  festival: [0x3a2266, 0x24133f, 0x120a1e],
  storm: [0x1a2a5c, 0x0f1a3c, 0x070b1c],
};

interface Lantern {
  s: Sprite;
  glow: Sprite;
  phase: number;
}

interface RingDrum {
  s: Sprite;
  halo: Sprite;
  index: number;
}

function shineTexture(): Texture {
  const [c, ctx] = makeCanvas(160, 160);
  const g = ctx.createLinearGradient(0, 0, 160, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,250,220,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 160, 160);
  return Texture.from(c);
}

function vignetteTexture(): Texture {
  const [c, ctx] = makeCanvas(256);
  const g = ctx.createRadialGradient(128, 110, 60, 128, 128, 190);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return Texture.from(c);
}

export class TopScreen extends Container {
  h = 620;
  private storm = false;
  private world = new Container();
  private parallax: { c: Container; k: number }[] = [];
  private skyFestival = new Sprite();
  private skyStorm = new Sprite();
  private hasArt = false;
  private ridges: Sprite[] = [];
  private shrine = new Sprite();
  private windows = new Container();
  private mist: Sprite[] = [];
  private lanternLayer = new Container();
  private lanterns: Lantern[] = [];
  private rope = new Graphics();
  private weather = new Particles();
  private ring = new Container();
  private drums: RingDrum[] = [];
  private emblem = new Container();
  private emblemGlow!: Sprite;
  private ribbon = new Container();
  private plaques = new Container();
  private plaqueValues = new Map<string, Text>();
  private meter = new Container();
  private orbs: { core: Graphics; glow: Sprite; tier: boolean }[] = [];
  private flash = new Graphics();
  private bolt = new Graphics();
  private vignette = new Sprite();
  private frameMask = new Graphics();
  private ringAngle = 0;
  private litDrums = 0;
  private nextStrike = 4;
  private weatherAcc = 0;
  private bloom = new AdvancedBloomFilter({ threshold: 0.45, bloomScale: 0.9, brightness: 1, blur: 8, quality: 4 });

  constructor() {
    super();
    this.addChild(this.world, this.flash, this.vignette, this.frameMask);
    this.mask = this.frameMask;
    this.world.filters = [this.bloom];

    const sky = new Container();
    sky.addChild(this.skyFestival, this.skyStorm);
    this.skyStorm.alpha = 0;

    const ridgeLayers = [0, 1, 2].map((i) => {
      const s = new Sprite(Texture.from(paintRidge(1400, 420, '#ffffff', 31 + i * 17, 0.55 - i * 0.12)));
      s.tint = RIDGE.festival[i];
      this.ridges.push(s);
      const c = new Container();
      c.addChild(s);
      return c;
    });

    const shrineLayer = new Container();
    this.shrine.texture = Texture.from(paintShrine(1300, 460, '#ffffff'));
    this.shrine.tint = 0x0a0610;
    shrineLayer.addChild(this.shrine, this.windows);

    const mistLayer = new Container();
    for (let i = 0; i < 4; i++) {
      const m = new Sprite({ texture: tex().glow, anchor: 0.5, alpha: 0.07, tint: 0xd8c8ff });
      m.scale.set(9, 1.6);
      this.mist.push(m);
      mistLayer.addChild(m);
    }

    this.lanternLayer.addChild(this.rope);
    this.ring.sortableChildren = true;

    for (const [c, k] of [
      [sky, 0.15],
      [ridgeLayers[0], 0.3],
      [ridgeLayers[1], 0.5],
      [ridgeLayers[2], 0.7],
      [shrineLayer, 0.85],
      [mistLayer, 1],
      [this.weather, 1.1],
      [this.ring, 0],
      [this.ribbon, 0],
      [this.lanternLayer, 1.35],
      [this.meter, 0],
      [this.plaques, 0],
      [this.bolt, 0.5],
    ] as [Container, number][]) {
      this.world.addChild(c);
      // Fixed layers (k = 0) keep their own position.
      if (k) this.parallax.push({ c, k });
    }
    this.bolt.blendMode = 'add';

    this.buildRing();
    this.buildPlaques();
    this.buildMeter();
    this.vignette.texture = vignetteTexture();
    void this.loadArt();
    this.layout(this.h);
  }

  private async loadArt(): Promise<void> {
    const fest = artUrl('festival');
    const storm = artUrl('storm');
    if (!fest) return;
    try {
      this.skyFestival.texture = await Assets.load(fest);
      this.skyStorm.texture = storm ? await Assets.load(storm) : this.skyFestival.texture;
      if (!storm) this.skyStorm.tint = 0x7f9cff;
      this.hasArt = true;
      // The painting already has its own mountains and shrine.
      for (const r of this.ridges) r.visible = false;
      this.shrine.visible = false;
      this.windows.visible = false;
      this.layout(this.h);
    } catch {
      // Keep the procedural scene.
    }
  }

  private buildRing(): void {
    const t = tex();
    for (let i = 0; i < 8; i++) {
      const halo = new Sprite({ texture: t.glow, anchor: 0.5, tint: 0x9fd8ff, blendMode: 'add', alpha: 0 });
      halo.scale.set(2.4);
      const s = new Sprite({ texture: i % 2 ? t.drumWood : t.drumLacquer, anchor: { x: 0.5, y: 0.55 } });
      const holder = new Container();
      holder.addChild(halo, s);
      this.ring.addChild(holder);
      this.drums.push({ s, halo, index: i });
    }
    this.emblemGlow = new Sprite({ texture: t.glow, anchor: 0.5, tint: 0xff7a30, blendMode: 'add', alpha: 0.6 });
    this.emblemGlow.scale.set(4.2, 3);
    const kanji = brushText(150, '太鼓雷');
    kanji.y = -6;
    this.emblem.addChild(this.emblemGlow, kanji);
    this.emblem.zIndex = 0.5;
    this.ring.addChild(this.emblem);

    const band = new Graphics()
      .poly([-300, -30, 300, -30, 275, 0, 300, 30, -300, 30, -275, 0])
      .fill(linear([
        [0, '#c0281e'],
        [1, '#4a0806'],
      ]))
      .stroke({ width: 4, fill: GOLD() });
    const name = new Text({
      text: 'TAIKO THUNDER',
      style: {
        fontFamily: FONT.numbers,
        fontSize: 40,
        fill: GOLD(),
        letterSpacing: 8,
        stroke: { color: '#2a0806', width: 4 },
      },
      anchor: 0.5,
    });
    this.ribbon.addChild(band, name);
  }

  private buildPlaques(): void {
    const shine = shineTexture();
    for (const j of [...JACKPOTS].reverse()) {
      const st = TIER_STYLE[j.name];
      const c = new Container();
      c.label = j.name;
      const h = j.name === 'Grand' ? 132 : 118;
      const body = new Graphics()
        .roundRect(-st.w / 2, -h / 2, st.w, h, 22)
        .fill(linear([
          [0, st.fill[0]],
          [1, st.fill[1]],
        ]))
        .stroke({ width: 5, fill: GOLD() })
        .roundRect(-st.w / 2 + 9, -h / 2 + 9, st.w - 18, h - 18, 14)
        .stroke({ width: 1.5, color: 0xffe9a8, alpha: 0.4 });
      const label = new Text({
        text: j.name.toUpperCase(),
        style: {
          fontFamily: FONT.numbers,
          fontSize: j.name === 'Grand' ? 30 : 24,
          fill: st.label,
          letterSpacing: 6,
          stroke: { color: '#000000', width: 4 },
        },
        anchor: 0.5,
      });
      label.y = -h * 0.24;
      const value = moneyText(j.name === 'Grand' ? 46 : 38);
      value.y = h * 0.14;
      this.plaqueValues.set(j.name, value);
      const sh = new Sprite({ texture: shine, anchor: 0.5, blendMode: 'add' });
      sh.height = h * 1.6;
      sh.width = 110;
      sh.rotation = 0.35;
      sh.x = -st.w;
      const m = new Graphics().roundRect(-st.w / 2, -h / 2, st.w, h, 22).fill(0xffffff);
      sh.mask = m;
      c.addChild(body, label, value, sh, m);
      gsap.to(sh, {
        x: st.w,
        duration: 1.1,
        ease: 'power2.inOut',
        repeat: -1,
        repeatDelay: j.name === 'Grand' ? 2.2 : 4 + Math.random() * 3,
        delay: Math.random() * 3,
      });
      this.plaques.addChild(c);
    }
  }

  private buildMeter(): void {
    const need = new Map<number, string>(JACKPOTS.map((j) => [j.need, j.name]));
    const n = JACKPOTS[JACKPOTS.length - 1].need;
    for (let i = 1; i <= n; i++) {
      const tier = need.get(i);
      const r = tier ? 22 : 15;
      const glow = new Sprite({ texture: tex().glow, anchor: 0.5, tint: tier ? 0xffd86b : 0x6fc3ff, blendMode: 'add', alpha: 0 });
      glow.scale.set((r * 5) / 128);
      const core = new Graphics();
      const o = new Container();
      o.addChild(glow, core);
      if (tier) {
        const l = labelText(15, tier.toUpperCase(), '#ffe9a8');
        l.y = -r - 16;
        o.addChild(l);
      }
      this.meter.addChild(o);
      this.orbs.push({ core, glow, tier: !!tier });
    }
    this.setCharges(0);
    this.meter.visible = false;
  }

  layout(h: number): void {
    this.h = h;
    this.frameMask.clear().rect(0, 0, W, h).fill(0xffffff);
    this.flash.clear().rect(0, 0, W, h).fill(0xddeeff);
    this.flash.alpha = 0;
    this.vignette.width = W;
    this.vignette.height = h;

    const coverSky = (s: Sprite) => {
      if (!s.texture || s.texture === Texture.EMPTY) return;
      const k = Math.max((W * 1.06) / s.texture.width, h / s.texture.height);
      s.scale.set(k);
      s.anchor.set(0.5, 0.5);
      s.position.set(W / 2, h / 2);
    };
    if (!this.hasArt) {
      this.skyFestival.texture = Texture.from(paintNightScene(W * 1.06, h, false));
      this.skyStorm.texture = Texture.from(paintNightScene(W * 1.06, h, true));
      this.skyFestival.scale.set(1);
      this.skyStorm.scale.set(1);
      this.skyFestival.anchor.set(0);
      this.skyStorm.anchor.set(0);
      this.skyFestival.position.set(-W * 0.03, 0);
      this.skyStorm.position.set(-W * 0.03, 0);
    } else {
      coverSky(this.skyFestival);
      coverSky(this.skyStorm);
    }

    this.ridges.forEach((r, i) => {
      r.anchor.set(0.5, 1);
      r.position.set(W / 2, h);
      r.scale.set(1, (h * (0.62 - i * 0.13)) / 420);
    });
    this.shrine.anchor.set(0.5, 1);
    this.shrine.position.set(W / 2, h * 0.78);
    this.shrine.scale.set(1, (h * 0.4) / 460);
    this.windows.removeChildren();
    for (let i = 0; i < 4; i++) {
      const g = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0xffa040, blendMode: 'add', alpha: 0.45 });
      g.scale.set(0.3, 0.16);
      g.position.set(W / 2 - 1300 * 0.3, h * 0.78 - h * 0.4 * (0.08 + i * 0.11));
      this.windows.addChild(g);
    }
    this.mist.forEach((m, i) => m.position.set(W * (0.2 + i * 0.25), h * (0.55 + (i % 2) * 0.12)));

    // Lantern string.
    this.lanternLayer.removeChildren();
    this.lanterns = [];
    this.lanternLayer.addChild(this.rope);
    const sag = 60;
    const y0 = 18;
    this.rope.clear().moveTo(-60, y0).quadraticCurveTo(W / 2, y0 + sag * 2, W + 60, y0).stroke({ width: 3, color: 0x120806 });
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = -60 + t * (W + 120);
      const y = y0 * (1 - t) ** 2 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const glow = new Sprite({ texture: tex().glow, anchor: 0.5, tint: 0xff8a30, blendMode: 'add' });
      glow.scale.set(1.5);
      glow.position.set(x, y + 52);
      const s = new Sprite({ texture: tex().lantern, anchor: { x: 0.5, y: 0 } });
      s.scale.set(0.62);
      s.position.set(x, y);
      this.lanternLayer.addChild(glow, s);
      this.lanterns.push({ s, glow, phase: i * 0.7 });
    }

    // Ring, ribbon, meter and plaques.
    // Short top screens (landscape) get a smaller ring so it clears the meter.
    const k = Math.max(0.62, Math.min(1, h / 820));
    const cy = h * 0.36;
    this.ring.position.set(W / 2, cy);
    this.ring.scale.set(k);
    this.ribbon.position.set(W / 2, cy + 250 * k);
    this.ribbon.scale.set(Math.max(0.8, k));
    const plaqueY = h - 82;
    const order = ['Mini', 'Minor', 'Grand', 'Major'];
    const widths = order.map((n) => TIER_STYLE[n].w);
    const total = widths.reduce((a, b) => a + b, 0) + 14 * 3;
    let x = (W - total) / 2;
    order.forEach((name, i) => {
      const c = this.plaques.getChildByLabel(name)!;
      c.position.set(x + widths[i] / 2, plaqueY);
      x += widths[i] + 14;
    });
    const mY = plaqueY - 110;
    this.orbs.forEach((_, i) => {
      const t = i / (this.orbs.length - 1);
      const o = this.meter.children[i];
      o.position.set(110 + t * (W - 220), mY - Math.sin(t * Math.PI) * 28);
    });
  }

  /** Drop the bloom pass on slow devices. */
  setLowQuality(): void {
    this.world.filters = [];
  }

  setJackpots(values: Record<string, string>): void {
    for (const [name, v] of Object.entries(values)) {
      const t = this.plaqueValues.get(name);
      if (t && t.text !== v) {
        t.text = v;
        gsap.fromTo(t.scale, { x: 1.15, y: 1.15 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(2)' });
      }
    }
  }

  setStorm(on: boolean): void {
    this.storm = on;
    gsap.to(this.skyStorm, { alpha: on ? 1 : 0, duration: 1.2 });
    this.ridges.forEach((r, i) => {
      const from = { v: 0 };
      const a = RIDGE[on ? 'festival' : 'storm'][i];
      const b = RIDGE[on ? 'storm' : 'festival'][i];
      gsap.to(from, {
        v: 1,
        duration: 1.2,
        onUpdate: () => (r.tint = lerpColor(a, b, from.v)),
      });
    });
    const t = tex();
    this.drums.forEach((d) => (d.s.texture = on ? t.drumStorm : d.index % 2 ? t.drumWood : t.drumLacquer));
    this.emblemGlow.tint = on ? 0x6fc3ff : 0xff7a30;
    for (const m of this.mist) m.tint = on ? 0x9fb8ff : 0xd8c8ff;
    this.lanterns.forEach((l) => (l.glow.tint = on ? 0x9fd8ff : 0xff8a30));
    this.meter.visible = on;
    if (!on) this.setCharges(0);
  }

  setCharges(n: number): void {
    this.orbs.forEach((o, i) => {
      const lit = i < n;
      const r = o.tier ? 22 : 15;
      o.core
        .clear()
        .circle(0, 0, r)
        .fill(lit ? (o.tier ? 0xffe9a8 : 0xcfeeff) : 0x101634)
        .stroke({ width: o.tier ? 4 : 3, color: o.tier ? 0xf3c75a : 0x6fc3ff, alpha: lit ? 1 : 0.6 });
      const was = o.glow.alpha > 0.5;
      o.glow.alpha = lit ? 0.9 : 0;
      if (lit && !was) gsap.fromTo(o.core.scale, { x: 1.8, y: 1.8 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(3)' });
    });
  }

  /** Orb position for charge `i` (1-based) in viewport coordinates. */
  meterPoint(i: number): [number, number] {
    const o = this.meter.children[Math.max(0, Math.min(this.orbs.length - 1, i - 1))];
    const p = o.getGlobalPosition();
    return [p.x, p.y];
  }

  /** Light one ring drum per scatter landed, for anticipation. */
  lightDrums(n: number): void {
    this.litDrums = n;
  }

  /** Thunderclap: white flash and a bolt across the sky. */
  strike(intensity = 1): void {
    gsap.killTweensOf(this.flash);
    gsap
      .timeline()
      .to(this.flash, { alpha: 0.55 * intensity, duration: 0.04 })
      .to(this.flash, { alpha: 0.1, duration: 0.08 })
      .to(this.flash, { alpha: 0.4 * intensity, duration: 0.04 })
      .to(this.flash, { alpha: 0, duration: 0.6 });
    const g = this.bolt.clear();
    let x = W * (0.15 + Math.random() * 0.7);
    let y = 0;
    g.moveTo(x, y);
    while (y < this.h * 0.6) {
      y += 20 + Math.random() * 40;
      x += (Math.random() - 0.5) * 70;
      g.lineTo(x, y);
    }
    g.stroke({ width: 5, color: 0xdff4ff });
    gsap.fromTo(this.bolt, { alpha: 1 }, { alpha: 0, duration: 0.5, ease: 'power2.in' });
  }

  tick(dt: number, time: number): void {
    const drift = Math.sin(time * 0.12) * 14;
    for (const { c, k } of this.parallax) c.x = drift * k;
    for (const m of this.mist) {
      m.x += dt * 12;
      if (m.x > W + 500) m.x = -500;
    }

    const pulse = beat.pulse(5);
    for (const l of this.lanterns) {
      l.s.rotation = Math.sin(time * 1.3 + l.phase) * 0.06 + pulse * 0.02;
      l.glow.alpha = 0.55 + Math.sin(time * 9 + l.phase * 3) * 0.05 + pulse * 0.2;
    }

    // Raijin's ring: drums orbit the emblem on a tilted ellipse.
    this.ringAngle += dt * (this.storm ? 0.55 : 0.22);
    const rx = 420;
    const ry = 135;
    for (const d of this.drums) {
      const a = this.ringAngle + (d.index / 8) * Math.PI * 2;
      const depth = (Math.sin(a) + 1) / 2;
      const holder = d.s.parent!;
      holder.position.set(Math.cos(a) * rx, Math.sin(a) * ry);
      const sc = (0.5 + depth * 0.42) * (1 + pulse * 0.05 * depth);
      holder.scale.set(sc);
      holder.zIndex = depth;
      const shade = Math.round(110 + depth * 145);
      const lit = d.index < this.litDrums;
      d.s.tint = lit ? 0xffffff : (shade << 16) | (shade << 8) | shade;
      d.halo.alpha = lit ? 0.75 + Math.sin(time * 20) * 0.2 : this.storm ? 0.15 * depth : 0;
    }
    this.emblem.scale.set(1 + pulse * 0.03);
    this.emblemGlow.alpha = 0.45 + pulse * 0.35;

    // Weather.
    this.weatherAcc += dt * (this.storm ? 90 : 5);
    const t = tex();
    while (this.weatherAcc >= 1) {
      this.weatherAcc--;
      if (this.storm) {
        this.weather.spawn(t.streak, {
          x: Math.random() * (W + 300) - 150,
          y: -40,
          vx: -260,
          vy: 1300,
          life: this.h / 1300 + 0.1,
          scale: 0.9,
          alpha: 0.35,
          tint: 0xbfe0ff,
        });
      } else {
        this.weather.spawn(t.petal, {
          x: Math.random() * W,
          y: -20,
          vx: 30 + Math.random() * 30,
          vy: 40 + Math.random() * 40,
          life: this.h / 50,
          scale: 0.5 + Math.random() * 0.5,
          spin: 1.5,
          sway: 30,
        });
      }
    }
    for (const p of this.weather.children) if (this.storm) p.rotation = 0.2;
    this.weather.update(dt);

    if (this.storm) {
      this.nextStrike -= dt;
      if (this.nextStrike <= 0) {
        this.strike(0.6);
        this.nextStrike = 4 + Math.random() * 6;
      }
    }
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ch = (s: number) => {
    const x = (a >> s) & 255;
    const y = (b >> s) & 255;
    return Math.round(x + (y - x) * t) << s;
  };
  return ch(16) | ch(8) | ch(0);
}
