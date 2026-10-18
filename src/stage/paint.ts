/**
 * Canvas painters for the code-built art: symbols, taiko drums, lanterns and
 * glow sprites. Each returns a canvas that the stage turns into a texture.
 */
import { SYMBOLS, type SymbolId } from '../math/symbols';
import { mulberry32 } from '../math/rng';
import { paintDragon, paintFan, paintKoi, paintOni } from './illustrations';

export const FONT = {
  kanji: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
  brush: '"Yuji Syuku", "Noto Serif JP", serif',
  numbers: '"Dela Gothic One", "Arial Black", Impact, sans-serif',
  ui: '"Zen Kaku Gothic New", "Hiragino Sans", system-ui, sans-serif',
};

const TOMOE = 'M 0 -42 A 42 42 0 0 1 36.4 21 A 46 46 0 0 0 17 -26 A 16 16 0 1 1 0 -42 Z';
let tomoePath: Path2D | null = null;

export function makeCanvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return [c, c.getContext('2d')!];
}

/** Triple-swirl crest; `r` is the outer radius. */
export function drawMitsudomoe(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  tomoePath ??= new Path2D(TOMOE);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(r / 44, r / 44);
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    ctx.fill(tomoePath);
    ctx.rotate((Math.PI * 2) / 3);
  }
  ctx.restore();
}

export function goldGradient(ctx: CanvasRenderingContext2D, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff8d6');
  g.addColorStop(0.4, '#f6cf63');
  g.addColorStop(0.52, '#a8701a');
  g.addColorStop(0.7, '#e9b544');
  g.addColorStop(1, '#fff0b0');
  return g;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// ---- Symbols ----------------------------------------------------------------

const HIGH = ['ONI', 'RYU', 'KOI', 'OGI'] as const;
const ILLUSTRATED: Record<(typeof HIGH)[number], (ctx: CanvasRenderingContext2D) => void> = {
  ONI: paintOni,
  RYU: paintDragon,
  KOI: paintKoi,
  OGI: paintFan,
};
/** Scale and offset that keep each illustration inside its cell. */
const FIT: Record<(typeof HIGH)[number], [number, number, number]> = {
  ONI: [1, 0, 0],
  RYU: [0.93, -4, 0],
  KOI: [0.92, -10, 0],
  OGI: [0.98, 0, -6],
};

/** Wood tones for the carved low-symbol plaques. */
const WOODS: Partial<Record<SymbolId, [string, string, string]>> = {
  BACHI: ['#c98e55', '#7a4720', '#3d1f0b'],
  CHOCHIN: ['#d0704a', '#7c2d17', '#3a1108'],
  SAKURA: ['#d88aa4', '#81405a', '#3c1526'],
  ZENI: ['#b8b06a', '#6a6526', '#2e2c0c'],
};

function woodGrain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number): void {
  const rnd = mulberry32(seed);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = '#1a0a02';
  for (let i = 0; i < 26; i++) {
    const yy = y + rnd() * h;
    ctx.lineWidth = 0.6 + rnd() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, yy);
    for (let xx = x; xx <= x + w; xx += w / 8) {
      ctx.lineTo(xx, yy + Math.sin(xx * 0.05 + i) * (2 + rnd() * 4));
    }
    ctx.stroke();
  }
  ctx.restore();
}

function paintLow(ctx: CanvasRenderingContext2D, id: SymbolId, s: number): void {
  const [light, mid, dark] = WOODS[id]!;
  const m = s * 0.13;
  const g = ctx.createLinearGradient(0, m, 0, s - m);
  g.addColorStop(0, light);
  g.addColorStop(0.6, mid);
  g.addColorStop(1, dark);
  roundRect(ctx, m, m, s - 2 * m, s - 2 * m, s * 0.1);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  woodGrain(ctx, m, m, s - 2 * m, s - 2 * m, id.length * 97);
  ctx.restore();
  roundRect(ctx, m, m, s - 2 * m, s - 2 * m, s * 0.1);
  ctx.lineWidth = s * 0.02;
  ctx.strokeStyle = 'rgba(20, 8, 2, .8)';
  ctx.stroke();
  // Carved kanji: dark recess with a light lower lip.
  ctx.font = `900 ${s * 0.5}px ${FONT.kanji}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const k = SYMBOLS[id].kanji;
  ctx.fillStyle = 'rgba(255, 240, 210, .35)';
  ctx.fillText(k, s / 2, s * 0.525 + s * 0.012);
  ctx.fillStyle = 'rgba(25, 8, 2, .85)';
  ctx.fillText(k, s / 2, s * 0.525);
}

function paintWild(ctx: CanvasRenderingContext2D, s: number): void {
  const drum = paintTaiko({ width: s * 0.86, tilt: 0.5, body: 'lacquer' });
  ctx.save();
  ctx.shadowColor = 'rgba(255, 200, 80, .8)';
  ctx.shadowBlur = s * 0.1;
  ctx.drawImage(drum, s * 0.07, s * 0.0);
  ctx.restore();
  // WILD ribbon.
  const y = s * 0.7;
  const h = s * 0.2;
  ctx.beginPath();
  ctx.moveTo(s * 0.06, y);
  ctx.lineTo(s * 0.94, y);
  ctx.lineTo(s * 0.88, y + h / 2);
  ctx.lineTo(s * 0.94, y + h);
  ctx.lineTo(s * 0.06, y + h);
  ctx.lineTo(s * 0.12, y + h / 2);
  ctx.closePath();
  ctx.fillStyle = goldGradient(ctx, y, y + h);
  ctx.fill();
  ctx.lineWidth = s * 0.012;
  ctx.strokeStyle = '#5a3008';
  ctx.stroke();
  ctx.font = `${s * 0.15}px ${FONT.numbers}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#5a0d0d';
  ctx.fillText('WILD', s / 2, y + h / 2 + s * 0.005);
}

function paintScatter(ctx: CanvasRenderingContext2D, s: number): void {
  const c = s / 2;
  const disc = ctx.createRadialGradient(c, c * 0.9, s * 0.05, c, c, s * 0.48);
  disc.addColorStop(0, '#5aa8ff');
  disc.addColorStop(0.5, '#1a3c9a');
  disc.addColorStop(1, '#050b2a');
  ctx.beginPath();
  ctx.arc(c, c, s * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = disc;
  ctx.fill();
  ctx.lineWidth = s * 0.03;
  ctx.strokeStyle = goldGradient(ctx, s * 0.04, s * 0.96);
  ctx.stroke();
  // Crackle.
  const rnd = mulberry32(7);
  ctx.save();
  ctx.strokeStyle = 'rgba(200, 235, 255, .7)';
  ctx.shadowColor = '#9fd8ff';
  ctx.shadowBlur = s * 0.04;
  ctx.lineWidth = s * 0.008;
  for (let i = 0; i < 7; i++) {
    let a = rnd() * Math.PI * 2;
    let r = s * 0.14;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    while (r < s * 0.42) {
      r += s * 0.05;
      a += (rnd() - 0.5) * 0.5;
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Ring of drums.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = c + Math.cos(a) * s * 0.36;
    const y = c + Math.sin(a) * s * 0.36;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#efdcae';
    ctx.fill();
    ctx.lineWidth = s * 0.012;
    ctx.strokeStyle = '#c9952f';
    ctx.stroke();
    drawMitsudomoe(ctx, x, y, s * 0.05, '#1f3f9a');
  }
  ctx.font = `900 ${s * 0.36}px ${FONT.kanji}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.shadowColor = '#bfe6ff';
  ctx.shadowBlur = s * 0.08;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('雷', c, c * 1.04);
  ctx.restore();
  ctx.lineWidth = s * 0.012;
  ctx.strokeStyle = '#0a1a4a';
  ctx.strokeText('雷', c, c * 1.04);
}

export function paintSymbol(id: SymbolId, s = 256): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(s);
  if (id === 'WILD') paintWild(ctx, s);
  else if (id === 'SCATTER') paintScatter(ctx, s);
  else if ((HIGH as readonly SymbolId[]).includes(id)) {
    const key = id as (typeof HIGH)[number];
    const [k, dx, dy] = FIT[key];
    ctx.save();
    ctx.scale(s / 256, s / 256);
    ctx.translate(128 + dx, 128 + dy);
    ctx.scale(k, k);
    ctx.translate(-128, -128);
    ILLUSTRATED[key](ctx);
    ctx.restore();
  }
  else paintLow(ctx, id, s);
  return c;
}

// ---- Taiko drum -------------------------------------------------------------

export interface TaikoOptions {
  width: number;
  /** Head ellipse height / width: 0 is side-on, 1 is face-on. */
  tilt: number;
  body: 'lacquer' | 'wood' | 'storm';
  crest?: string;
}

const BODY: Record<TaikoOptions['body'], string[]> = {
  lacquer: ['#2a0302', '#8a150f', '#e04a34', '#9e1b14', '#3a0504'],
  wood: ['#2a1405', '#7a4520', '#c98a4e', '#80491f', '#2a1405'],
  storm: ['#050a20', '#1a2f78', '#4f84e8', '#1f3a90', '#060c26'],
};

/** A 2.5D taiko seen from slightly above, shaded like a lit object. */
export function paintTaiko(o: TaikoOptions): HTMLCanvasElement {
  const w = o.width;
  const rx = w * 0.42;
  const ry = rx * o.tilt;
  const bh = w * 0.4;
  const h = ry * 2 + bh + w * 0.1;
  const [c, ctx] = makeCanvas(w, h);
  const cx = w / 2;
  const top = ry + w * 0.02;
  const bot = top + bh;

  // Contact shadow.
  ctx.save();
  ctx.filter = `blur(${w * 0.02}px)`;
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath();
  ctx.ellipse(cx, bot + ry * 0.4, rx * 1.02, ry * 0.7 + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Barrel.
  ctx.beginPath();
  ctx.moveTo(cx - rx, top);
  ctx.quadraticCurveTo(cx - rx * 1.13, (top + bot) / 2, cx - rx, bot);
  ctx.ellipse(cx, bot, rx, ry, 0, Math.PI, 0, true);
  ctx.quadraticCurveTo(cx + rx * 1.13, (top + bot) / 2, cx + rx, top);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - rx * 1.1, 0, cx + rx * 1.1, 0);
  const stops = BODY[o.body];
  [0, 0.18, 0.34, 0.62, 1].forEach((p, i) => g.addColorStop(p, stops[i]));
  ctx.fillStyle = g;
  ctx.fill();
  // Vertical shading so the barrel reads as round top to bottom.
  const vg = ctx.createLinearGradient(0, top, 0, bot + ry);
  vg.addColorStop(0, 'rgba(0,0,0,.35)');
  vg.addColorStop(0.35, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = vg;
  ctx.fill();

  // Gold rope band.
  ctx.save();
  ctx.lineWidth = w * 0.018;
  ctx.strokeStyle = goldGradient(ctx, top, bot);
  ctx.beginPath();
  ctx.ellipse(cx, (top + bot) / 2 + ry * 0.2, rx * 1.1, ry, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();

  // Rim tacks along the front edges.
  const tack = (y: number, n: number) => {
    for (let i = 1; i < n; i++) {
      const a = (i / n) * Math.PI;
      const x = cx + Math.cos(a) * rx * 0.985;
      const yy = y + Math.sin(a) * ry * 0.985;
      const r = w * 0.011 * (0.6 + 0.4 * Math.sin(a));
      ctx.beginPath();
      ctx.arc(x, yy + w * 0.012, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffe08a';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - r * 0.3, yy + w * 0.012 - r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#fffbe8';
      ctx.fill();
    }
  };
  tack(top, 18);
  tack(bot - w * 0.03, 18);

  // Handle rings.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * rx * 0.72, (top + bot) / 2 + ry * 0.35, w * 0.035, w * 0.045, 0, 0, Math.PI * 2);
    ctx.lineWidth = w * 0.012;
    ctx.strokeStyle = '#e9b544';
    ctx.stroke();
  }

  // Head.
  ctx.beginPath();
  ctx.ellipse(cx, top, rx, ry, 0, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(cx - rx * 0.25, top - ry * 0.3, rx * 0.05, cx, top, rx);
  hg.addColorStop(0, '#fff8e4');
  hg.addColorStop(0.7, '#ead2a0');
  hg.addColorStop(1, '#a87d42');
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.lineWidth = w * 0.022;
  ctx.strokeStyle = '#3a1a08';
  ctx.stroke();
  ctx.save();
  ctx.translate(cx, top);
  ctx.scale(1, o.tilt);
  drawMitsudomoe(ctx, 0, 0, rx * 0.62, o.crest ?? (o.body === 'storm' ? '#1f3f9a' : '#b3201b'));
  ctx.restore();
  return c;
}

// ---- Lantern and glows --------------------------------------------------------

export function paintLantern(w: number, kanji = '祭', color = '#d8321f'): HTMLCanvasElement {
  const h = w * 1.45;
  const [c, ctx] = makeCanvas(w, h);
  const cx = w / 2;
  const cy = h * 0.52;
  const rx = w * 0.46;
  const ry = h * 0.36;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(cx, cy, rx * 0.1, cx, cy, rx * 1.1);
  g.addColorStop(0, '#fff2b0');
  g.addColorStop(0.35, '#ffb347');
  g.addColorStop(0.8, color);
  g.addColorStop(1, '#5a0a06');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(90, 20, 5, .45)';
  ctx.lineWidth = w * 0.015;
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + (i * ry) / 5.5, rx, ry * 0.12, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  ctx.font = `900 ${w * 0.42}px ${FONT.kanji}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(40, 6, 2, .8)';
  ctx.fillText(kanji, cx, cy + w * 0.02);
  ctx.fillStyle = '#1a0806';
  ctx.fillRect(cx - rx * 0.55, cy - ry - h * 0.05, rx * 1.1, h * 0.07);
  ctx.fillRect(cx - rx * 0.55, cy + ry - h * 0.02, rx * 1.1, h * 0.07);
  ctx.fillRect(cx - w * 0.01, 0, w * 0.02, cy - ry - h * 0.04);
  return c;
}

/** White radial falloff; tint it in the stage. */
export function paintGlow(size = 128, hardness = 0): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.5 * hardness, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function paintPetal(size = 32): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size);
  ctx.translate(size / 2, size / 2);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.45);
  ctx.bezierCurveTo(size * 0.42, -size * 0.3, size * 0.3, size * 0.35, 0, size * 0.45);
  ctx.bezierCurveTo(-size * 0.3, size * 0.35, -size * 0.42, -size * 0.3, 0, -size * 0.45);
  const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  g.addColorStop(0, '#fff0f5');
  g.addColorStop(1, '#f48fb1');
  ctx.fillStyle = g;
  ctx.fill();
  return c;
}

/** Vertical gradient strip, used for cylinder shading over each reel. */
export function paintReelShade(h = 256): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(8, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,.85)');
  g.addColorStop(0.16, 'rgba(0,0,0,.15)');
  g.addColorStop(0.42, 'rgba(255,255,255,.07)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(0.84, 'rgba(0,0,0,.15)');
  g.addColorStop(1, 'rgba(0,0,0,.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, h);
  return c;
}

/** Seigaiha (wave) pattern tile for the temple-wood walls. */
export function paintSeigaiha(size = 96, ink = 'rgba(243,199,90,.08)'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size / 2);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  const r = size / 2;
  for (const [x, y] of [
    [0, r / 2],
    [size, r / 2],
    [r, r],
    [0, r * 1.5],
    [size, r * 1.5],
  ]) {
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(x, y, (r * k) / 4, Math.PI, 0);
      ctx.stroke();
    }
  }
  return c;
}

/** Procedural night sky with moon and layered mountains, the fallback backdrop. */
export function paintNightScene(w: number, h: number, storm: boolean): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (storm) {
    sky.addColorStop(0, '#02040e');
    sky.addColorStop(0.5, '#0b1640');
    sky.addColorStop(1, '#1a2a66');
  } else {
    sky.addColorStop(0, '#05040f');
    sky.addColorStop(0.55, '#1a1040');
    sky.addColorStop(1, '#4a1c3a');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const rnd = mulberry32(storm ? 11 : 5);
  // Stars.
  if (!storm) {
    for (let i = 0; i < 220; i++) {
      ctx.globalAlpha = 0.2 + rnd() * 0.7;
      ctx.fillStyle = '#fff';
      ctx.fillRect(rnd() * w, rnd() * h * 0.6, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
  }
  // Moon.
  const mx = w * 0.72;
  const my = h * 0.24;
  const mr = Math.min(h * 0.1, 62);
  const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
  halo.addColorStop(0, storm ? 'rgba(160,200,255,.35)' : 'rgba(255,230,190,.4)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fillStyle = storm ? '#cfe2ff' : '#fff1d6';
  ctx.globalAlpha = storm ? 0.35 : 1;
  ctx.fill();
  ctx.globalAlpha = 1;
  return c;
}

/** One mountain ridge silhouette, used as a parallax layer. */
export function paintRidge(w: number, h: number, color: string, seed: number, roughness = 0.5): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  const rnd = mulberry32(seed);
  const pts: number[] = [];
  const n = 64;
  for (let i = 0; i <= n; i++) pts.push(rnd());
  // Smooth with a few passes, then add peaks.
  for (let p = 0; p < 3; p++) for (let i = 1; i < n; i++) pts[i] = (pts[i - 1] + pts[i] + pts[i + 1]) / 3;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * w;
    const y = h * (0.15 + (1 - pts[i]) * 0.7 * roughness + (1 - roughness) * 0.35);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  return c;
}

/** Pagoda and torii silhouettes for the mid-ground. */
export function paintShrine(w: number, h: number, color: string): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  ctx.fillStyle = color;
  // Pagoda, five tiers.
  const px = w * 0.2;
  let y = h * 0.95;
  for (let t = 0; t < 5; t++) {
    const bw = w * (0.09 - t * 0.012);
    const th = h * 0.11;
    ctx.fillRect(px - bw * 0.35, y - th, bw * 0.7, th);
    ctx.beginPath();
    ctx.moveTo(px - bw, y - th + 4);
    ctx.quadraticCurveTo(px, y - th - h * 0.05, px + bw, y - th + 4);
    ctx.lineTo(px + bw * 0.9, y - th + 10);
    ctx.lineTo(px - bw * 0.9, y - th + 10);
    ctx.closePath();
    ctx.fill();
    y -= th;
  }
  ctx.fillRect(px - 2, y - h * 0.12, 4, h * 0.12);
  // Torii.
  const tx = w * 0.62;
  const tw = w * 0.2;
  const tb = h * 0.95;
  const tt = h * 0.45;
  ctx.fillRect(tx - tw / 2, tt + h * 0.05, w * 0.018, tb - tt);
  ctx.fillRect(tx + tw / 2 - w * 0.018, tt + h * 0.05, w * 0.018, tb - tt);
  ctx.beginPath();
  ctx.moveTo(tx - tw * 0.7, tt);
  ctx.quadraticCurveTo(tx, tt + h * 0.04, tx + tw * 0.7, tt);
  ctx.lineTo(tx + tw * 0.66, tt + h * 0.05);
  ctx.quadraticCurveTo(tx, tt + h * 0.08, tx - tw * 0.66, tt + h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(tx - tw * 0.55, tt + h * 0.12, tw * 1.1, h * 0.025);
  // Temple roofline across the base.
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h);
  ctx.lineTo(w * 0.33, h * 0.82);
  ctx.quadraticCurveTo(w * 0.42, h * 0.76, w * 0.5, h * 0.8);
  ctx.lineTo(w * 0.5, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
  return c;
}

/** Oval gold koban coin. */
export function paintKoban(): HTMLCanvasElement {
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
  return c;
}
