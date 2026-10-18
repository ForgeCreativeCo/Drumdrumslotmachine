/**
 * Code-painted illustrations for the four high symbols. Every painter draws
 * into a 256 x 256 design box; the caller scales the context.
 */
import { mulberry32 } from '../math/rng';

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

const INK = '#1a0503';

function gold(ctx: Ctx, y0: number, y1: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff8d6');
  g.addColorStop(0.45, '#f6cf63');
  g.addColorStop(0.6, '#a8701a');
  g.addColorStop(1, '#f3c75a');
  return g;
}

function mirror(p: Pt): Pt {
  return [256 - p[0], p[1]];
}

function poly(ctx: Ctx, pts: Pt[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function quad(a: Pt, c: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
}

function cubic(a: Pt, c1: Pt, c2: Pt, b: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u ** 3 * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * b[0],
    u ** 3 * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * b[1],
  ];
}

/** Lacquer roundel with a gold ring that the illustration breaks out of. */
export function roundel(ctx: Ctx, light: string, dark: string, cy = 138): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(128, cy, 100, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(110, cy - 30, 10, 128, cy, 104);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 7;
  ctx.strokeStyle = gold(ctx, cy - 100, cy + 100);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, cy, 90, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,233,168,.45)';
  ctx.stroke();
}

// ---- 鬼 Oni mask ---------------------------------------------------------------

export const ONI_EYES: Pt[] = [
  [96, 134],
  [160, 134],
];

export function paintOni(ctx: Ctx): void {
  roundel(ctx, '#5a1010', '#160304');

  // Wild white hair behind the face.
  const rnd = mulberry32(3);
  const hair: Pt[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = Math.PI * 0.95 + (i / 28) * Math.PI * 1.1;
    const r = i % 2 ? 78 : 102 + rnd() * 14;
    hair.push([128 + Math.cos(a) * r * 1.05, 136 + Math.sin(a) * r * 0.95]);
  }
  poly(ctx, hair);
  const hg = ctx.createRadialGradient(128, 120, 30, 128, 130, 120);
  hg.addColorStop(0, '#ffffff');
  hg.addColorStop(1, '#a9a2b8');
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3a3448';
  ctx.stroke();

  // Horns.
  for (const side of [false, true]) {
    const f = (p: Pt) => (side ? mirror(p) : p);
    ctx.beginPath();
    ctx.moveTo(...f([84, 80]));
    ctx.quadraticCurveTo(...f([46, 52]), ...f([40, 6]));
    ctx.quadraticCurveTo(...f([70, 38]), ...f([106, 66]));
    ctx.closePath();
    const g = ctx.createLinearGradient(...f([40, 6]), ...f([96, 76]));
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.6, '#f0d48a');
    g.addColorStop(1, '#a8701a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // Horn rings.
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(90,50,10,.55)';
    for (const t of [0.35, 0.55, 0.72]) {
      const a = quad(f([84, 80]), f([46, 52]), f([40, 6]), t);
      const b = quad(f([106, 66]), f([70, 38]), f([40, 6]), t);
      ctx.beginPath();
      ctx.moveTo(...a);
      ctx.lineTo(...b);
      ctx.stroke();
    }
  }

  // Face.
  ctx.beginPath();
  ctx.moveTo(66, 98);
  ctx.bezierCurveTo(68, 56, 188, 56, 190, 98);
  ctx.bezierCurveTo(210, 132, 210, 172, 186, 198);
  ctx.bezierCurveTo(166, 226, 90, 226, 70, 198);
  ctx.bezierCurveTo(46, 172, 46, 132, 66, 98);
  const face = ctx.createRadialGradient(108, 108, 10, 128, 140, 110);
  face.addColorStop(0, '#ff8a5a');
  face.addColorStop(0.45, '#d8261b');
  face.addColorStop(1, '#5a0604');
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Forehead wrinkles and gold jewel.
  ctx.strokeStyle = 'rgba(70,4,2,.7)';
  ctx.lineWidth = 3;
  for (const y of [84, 94]) {
    ctx.beginPath();
    ctx.moveTo(96, y + 4);
    ctx.quadraticCurveTo(128, y - 6, 160, y + 4);
    ctx.stroke();
  }
  poly(ctx, [
    [128, 70],
    [136, 80],
    [128, 90],
    [120, 80],
  ]);
  ctx.fillStyle = gold(ctx, 70, 90);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();

  // Brows, eyes.
  for (const side of [false, true]) {
    const f = (p: Pt) => (side ? mirror(p) : p);
    poly(ctx, [f([66, 104]), f([120, 120]), f([118, 134]), f([70, 120])]);
    ctx.fillStyle = '#140604';
    ctx.fill();
    const [ex, ey] = f(ONI_EYES[0]);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(side ? -0.28 : 0.28);
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
    const eg = ctx.createRadialGradient(0, -2, 1, 0, 0, 18);
    eg.addColorStop(0, '#fffbd0');
    eg.addColorStop(1, '#f0a020');
    ctx.fillStyle = eg;
    ctx.shadowColor = '#ffd040';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(side ? -4 : 4, 1, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
  }

  // Nose.
  ctx.beginPath();
  ctx.moveTo(118, 140);
  ctx.quadraticCurveTo(128, 134, 138, 140);
  ctx.quadraticCurveTo(154, 160, 146, 170);
  ctx.quadraticCurveTo(128, 178, 110, 170);
  ctx.quadraticCurveTo(102, 160, 118, 140);
  ctx.fillStyle = '#e8402c';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  for (const x of [118, 138]) {
    ctx.beginPath();
    ctx.ellipse(x, 166, 6, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2a0302';
    ctx.fill();
  }

  // Snarling mouth with fangs.
  ctx.beginPath();
  ctx.moveTo(80, 182);
  ctx.quadraticCurveTo(128, 196, 176, 182);
  ctx.quadraticCurveTo(168, 222, 128, 220);
  ctx.quadraticCurveTo(88, 222, 80, 182);
  ctx.fillStyle = '#2a0202';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#7a0a08';
  ctx.beginPath();
  ctx.ellipse(128, 222, 30, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6e0';
  for (let x = 90; x < 168; x += 13) {
    const y = 182 + Math.sin(((x - 80) / 96) * Math.PI) * 13;
    ctx.fillRect(x, y - 2, 10, 9);
  }
  ctx.restore();
  for (const side of [false, true]) {
    const f = (p: Pt) => (side ? mirror(p) : p);
    poly(ctx, [f([86, 184]), f([98, 188]), f([94, 208])]);
    ctx.fillStyle = '#fffbe8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    poly(ctx, [f([98, 216]), f([110, 214]), f([102, 192])]);
    ctx.fill();
    ctx.stroke();
  }

  // Lacquer sheen.
  ctx.beginPath();
  ctx.ellipse(104, 92, 26, 12, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.22)';
  ctx.fill();
}

// ---- 龍 Dragon ------------------------------------------------------------------

export const RYU_PEARL: Pt = [112, 148];

export function paintDragon(ctx: Ctx): void {
  roundel(ctx, '#0f4a40', '#03130f');

  // Flaming pearl.
  const [px, py] = RYU_PEARL;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(a - 0.4) * 24, py + Math.sin(a - 0.4) * 24);
    ctx.quadraticCurveTo(px + Math.cos(a) * 60, py + Math.sin(a) * 60, px + Math.cos(a + 0.25) * 52, py + Math.sin(a + 0.25) * 52);
    ctx.quadraticCurveTo(px + Math.cos(a + 0.3) * 34, py + Math.sin(a + 0.3) * 34, px + Math.cos(a + 0.4) * 24, py + Math.sin(a + 0.4) * 24);
    ctx.fillStyle = i % 2 ? '#ffb340' : '#ff6a2a';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(px, py, 26, 0, Math.PI * 2);
  const pg = ctx.createRadialGradient(px - 8, py - 8, 2, px, py, 26);
  pg.addColorStop(0, '#ffffff');
  pg.addColorStop(0.5, '#a8ecff');
  pg.addColorStop(1, '#2a7ab8');
  ctx.fillStyle = pg;
  ctx.shadowColor = '#9fe8ff';
  ctx.shadowBlur = 20;
  ctx.fill();
  ctx.restore();

  // Coiled body.
  const A: Pt = [222, 214];
  const C1: Pt = [150, 252];
  const C2: Pt = [26, 226];
  const B: Pt = [40, 140];
  const D1: Pt = [52, 64];
  const D2: Pt = [150, 34];
  const E: Pt = [178, 84];
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(...A);
    ctx.bezierCurveTo(...C1, ...C2, ...B);
    ctx.bezierCurveTo(...D1, ...D2, ...E);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  body();
  ctx.lineWidth = 42;
  ctx.strokeStyle = '#021a14';
  ctx.stroke();
  // Spine fins along the outer edge.
  const pts: Pt[] = [];
  for (let i = 0; i <= 14; i++) pts.push(cubic(A, C1, C2, B, i / 14));
  for (let i = 1; i <= 12; i++) pts.push(cubic(B, D1, D2, E, i / 12));
  for (let i = 1; i < pts.length - 2; i += 2) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i + 1];
    const [x, y] = pts[i];
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const len = Math.hypot(nx, ny) || 1;
    // Outward normal points away from the coil centre.
    const out = (x - 128) * nx + (y - 140) * ny > 0 ? 1 : -1;
    const ox = (nx / len) * out;
    const oy = (ny / len) * out;
    poly(ctx, [
      [x0 + ox * 14, y0 + oy * 14],
      [x + ox * 32, y + oy * 32],
      [x1 + ox * 14, y1 + oy * 14],
    ]);
    ctx.fillStyle = '#ff6a3a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3a0802';
    ctx.stroke();
  }
  body();
  const bg = ctx.createLinearGradient(30, 40, 220, 240);
  bg.addColorStop(0, '#5ff0c0');
  bg.addColorStop(0.5, '#1aa080');
  bg.addColorStop(1, '#0a4a3a');
  ctx.lineWidth = 34;
  ctx.strokeStyle = bg;
  ctx.stroke();
  // Scale bands and belly plates.
  body();
  ctx.setLineDash([3, 9]);
  ctx.lineWidth = 34;
  ctx.strokeStyle = 'rgba(2, 30, 22, .35)';
  ctx.stroke();
  ctx.setLineDash([7, 4]);
  body();
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#f0dc8a';
  ctx.stroke();
  ctx.setLineDash([]);

  // Head, facing the pearl.
  ctx.save();
  ctx.translate(184, 86);
  ctx.rotate(0.25);
  // Mane.
  poly(ctx, [
    [10, -26],
    [48, -30],
    [30, -12],
    [58, -4],
    [34, 6],
    [52, 24],
    [16, 18],
  ]);
  ctx.fillStyle = '#ff8a3a';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#3a0802';
  ctx.stroke();
  // Antlers.
  ctx.lineWidth = 6;
  ctx.strokeStyle = gold(ctx, -60, 0);
  ctx.beginPath();
  ctx.moveTo(4, -22);
  ctx.quadraticCurveTo(30, -50, 58, -56);
  ctx.moveTo(30, -42);
  ctx.lineTo(36, -62);
  ctx.stroke();
  // Skull and snout.
  ctx.beginPath();
  ctx.moveTo(22, -24);
  ctx.quadraticCurveTo(-10, -30, -44, -10);
  ctx.lineTo(-52, -2);
  ctx.quadraticCurveTo(-40, 4, -20, 2);
  ctx.lineTo(-46, 14);
  ctx.quadraticCurveTo(-12, 26, 18, 18);
  ctx.quadraticCurveTo(34, 0, 22, -24);
  const hd = ctx.createLinearGradient(0, -30, 0, 26);
  hd.addColorStop(0, '#7ff5d0');
  hd.addColorStop(1, '#0a5a48');
  ctx.fillStyle = hd;
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#021a14';
  ctx.stroke();
  // Teeth and eye.
  ctx.fillStyle = '#fffbe8';
  for (const x of [-40, -32, -24]) {
    poly(ctx, [
      [x, 2],
      [x + 5, 2],
      [x + 2, 9],
    ]);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(-2, -12, 8, 6, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd040';
  ctx.shadowColor = '#ffd040';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000';
  ctx.fillRect(-3, -17, 2.5, 10);
  // Whiskers.
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#fff1c2';
  ctx.beginPath();
  ctx.moveTo(-46, -6);
  ctx.bezierCurveTo(-70, -30, -96, -10, -110, -44);
  ctx.moveTo(-40, 10);
  ctx.bezierCurveTo(-64, 40, -92, 28, -104, 56);
  ctx.stroke();
  ctx.restore();
}

// ---- 鯉 Koi ---------------------------------------------------------------------

export function paintKoi(ctx: Ctx): void {
  roundel(ctx, '#1a4a7a', '#04101e');
  // Ripples.
  ctx.strokeStyle = 'rgba(160, 210, 255, .25)';
  ctx.lineWidth = 2;
  for (const r of [30, 52, 74]) {
    ctx.beginPath();
    ctx.ellipse(118, 214, r, r * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const H: Pt = [60, 104];
  const C: Pt = [112, 0];
  const T: Pt = [198, 150];
  const radius = (t: number) => (9 + 27 * (1 - t) ** 0.8) * Math.min(1, 0.62 + t * 4.5);
  const bodyPath = (grow: number) => {
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const [x, y] = quad(H, C, T, t);
      const r = radius(t) + grow;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
  };

  // Tail fin.
  const tail = () => {
    ctx.beginPath();
    ctx.moveTo(T[0] - 4, T[1] - 6);
    ctx.quadraticCurveTo(232, 104, 252, 112);
    ctx.quadraticCurveTo(226, 150, 246, 196);
    ctx.quadraticCurveTo(216, 182, T[0] - 2, T[1] + 6);
    ctx.closePath();
  };
  tail();
  const tg = ctx.createLinearGradient(196, 120, 252, 180);
  tg.addColorStop(0, 'rgba(255, 200, 90, .95)');
  tg.addColorStop(1, 'rgba(255, 120, 40, .55)');
  ctx.fillStyle = tg;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#5a2004';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120, 40, 4, .5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(T[0], T[1]);
    ctx.lineTo(244 - i * 2, 116 + i * 15);
    ctx.stroke();
  }

  // Pectoral fin.
  ctx.beginPath();
  ctx.moveTo(84, 128);
  ctx.quadraticCurveTo(58, 150, 72, 178);
  ctx.quadraticCurveTo(92, 156, 104, 132);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 210, 120, .8)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#5a2004';
  ctx.stroke();

  // Body: outline first, then the fill.
  bodyPath(3.5);
  ctx.fillStyle = '#3a1202';
  ctx.fill();
  bodyPath(0);
  const g = ctx.createLinearGradient(60, 20, 150, 150);
  g.addColorStop(0, '#fff3c0');
  g.addColorStop(0.45, '#f6b23a');
  g.addColorStop(1, '#c8500a');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  bodyPath(0);
  ctx.clip();
  // Kohaku patches.
  const rnd = mulberry32(21);
  ctx.fillStyle = '#e2381e';
  for (const t of [0.22, 0.48, 0.7]) {
    const [x, y] = quad(H, C, T, t);
    ctx.beginPath();
    ctx.ellipse(x + (rnd() - 0.5) * 12, y - 8, 20 + rnd() * 10, 13, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Scales.
  ctx.strokeStyle = 'rgba(110, 40, 0, .35)';
  ctx.lineWidth = 1.5;
  for (let i = 4; i < 36; i++) {
    const t = i / 40;
    const [x, y] = quad(H, C, T, t);
    const r = radius(t);
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.arc(x, y + k * r * 0.55, r * 0.32, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }
  // Belly light.
  ctx.fillStyle = 'rgba(255, 255, 240, .3)';
  ctx.beginPath();
  ctx.ellipse(110, 60, 40, 14, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Dorsal fin.
  ctx.beginPath();
  ctx.moveTo(108, 36);
  ctx.quadraticCurveTo(126, 8, 156, 36);
  ctx.quadraticCurveTo(136, 34, 124, 50);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 160, 60, .85)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#5a2004';
  ctx.stroke();

  // Eye and barbels.
  ctx.beginPath();
  ctx.arc(56, 92, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(54, 93, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#7a3004';
  ctx.beginPath();
  ctx.moveTo(42, 108);
  ctx.quadraticCurveTo(28, 116, 30, 130);
  ctx.stroke();

  // Splash.
  ctx.fillStyle = 'rgba(220, 240, 255, .9)';
  for (const [x, y, r] of [
    [70, 206, 6],
    [92, 222, 4],
    [146, 220, 5],
    [164, 204, 3.5],
    [58, 186, 3],
    [178, 190, 2.5],
  ] as [number, number, number][]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(220, 240, 255, .85)';
  ctx.beginPath();
  ctx.moveTo(78, 214);
  ctx.quadraticCurveTo(96, 190, 104, 214);
  ctx.moveTo(130, 214);
  ctx.quadraticCurveTo(140, 192, 156, 212);
  ctx.stroke();
}

// ---- 扇 War fan -----------------------------------------------------------------

export function paintFan(ctx: Ctx): void {
  roundel(ctx, '#4a2088', '#120624');
  const cx = 128;
  const cy = 214;
  const r0 = 40;
  const r1 = 66;
  const R = 150;
  const a0 = Math.PI * 1.17;
  const a1 = Math.PI * 1.83;
  const n = 14;

  // Paper leaf, folded into alternating facets.
  for (let i = 0; i < n; i++) {
    const s = a0 + ((a1 - a0) * i) / n;
    const e = a0 + ((a1 - a0) * (i + 1)) / n;
    ctx.beginPath();
    ctx.arc(cx, cy, R, s, e);
    ctx.arc(cx, cy, r1, e, s, true);
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, r1, cx, cy, R);
    g.addColorStop(0, i % 2 ? '#f6d27a' : '#d9a640');
    g.addColorStop(1, i % 2 ? '#fff1c0' : '#f0c45a');
    ctx.fillStyle = g;
    ctx.fill();
  }
  // Crimson sun and waves, clipped to the leaf.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a1);
  ctx.arc(cx, cy, r1, a1, a0, true);
  ctx.closePath();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx, cy - 112, 32, 0, Math.PI * 2);
  const sun = ctx.createRadialGradient(cx - 8, cy - 120, 4, cx, cy - 112, 32);
  sun.addColorStop(0, '#ff6a4e');
  sun.addColorStop(1, '#a8150e');
  ctx.fillStyle = sun;
  ctx.fill();
  ctx.strokeStyle = 'rgba(40, 20, 120, .45)';
  ctx.lineWidth = 2.5;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = cy - 66 + k * 9 + Math.sin(x * 0.12 + k) * 4;
      if (x) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  // Fold creases and outer edge.
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(90, 50, 8, .55)';
  for (let i = 1; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, R, a0, a1);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#3a1a06';
  ctx.stroke();

  // Lacquered ribs below the leaf.
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const guard = i === 0 || i === n;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
    ctx.lineTo(cx + Math.cos(a) * (guard ? R : r1 + 4), cy + Math.sin(a) * (guard ? R : r1 + 4));
    ctx.lineWidth = guard ? 9 : 4;
    ctx.strokeStyle = guard ? '#2a0806' : '#4a160c';
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r0, a0, a1);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a0806';
  ctx.stroke();

  // Rivet and tassel.
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#8a4ae0';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.quadraticCurveTo(cx + 22, cy + 22, cx + 18, cy + 34);
  ctx.stroke();
  poly(ctx, [
    [cx + 10, cy + 34],
    [cx + 26, cy + 34],
    [cx + 30, cy + 46],
    [cx + 6, cy + 46],
  ]);
  ctx.fillStyle = '#6a2ac8';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fillStyle = gold(ctx, cy - 9, cy + 9);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
}
