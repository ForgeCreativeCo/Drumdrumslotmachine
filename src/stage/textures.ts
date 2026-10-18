import { Texture } from 'pixi.js';
import type { SymbolId } from '../math/symbols';
import {
  makeCanvas,
  paintGlow,
  paintLantern,
  paintPetal,
  paintReelShade,
  paintSymbol,
  paintTaiko,
} from './paint';

const ALL: SymbolId[] = ['ONI', 'RYU', 'KOI', 'OGI', 'BACHI', 'CHOCHIN', 'SAKURA', 'ZENI', 'WILD', 'SCATTER'];

export interface TextureSet {
  symbols: Record<SymbolId, Texture>;
  glow: Texture;
  glowHard: Texture;
  petal: Texture;
  dot: Texture;
  streak: Texture;
  reelShade: Texture;
  lantern: Texture;
  drumLacquer: Texture;
  drumWood: Texture;
  drumStorm: Texture;
  spinDrum: Texture;
}

let set: TextureSet | null = null;

function streak(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(6, 64);
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,.9)');
  ctx.fillStyle = g;
  ctx.fillRect(2, 0, 2, 64);
  return c;
}

function dot(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(32);
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  return c;
}

/** Paint every texture once, after fonts have loaded. */
export function buildTextures(): TextureSet {
  if (set) return set;
  const symbols = Object.fromEntries(ALL.map((id) => [id, Texture.from(paintSymbol(id, 256))])) as Record<
    SymbolId,
    Texture
  >;
  set = {
    symbols,
    glow: Texture.from(paintGlow(128)),
    glowHard: Texture.from(paintGlow(128, 0.4)),
    petal: Texture.from(paintPetal(32)),
    dot: Texture.from(dot()),
    streak: Texture.from(streak()),
    reelShade: Texture.from(paintReelShade()),
    lantern: Texture.from(paintLantern(96)),
    drumLacquer: Texture.from(paintTaiko({ width: 220, tilt: 0.42, body: 'lacquer' })),
    drumWood: Texture.from(paintTaiko({ width: 220, tilt: 0.42, body: 'wood' })),
    drumStorm: Texture.from(paintTaiko({ width: 220, tilt: 0.42, body: 'storm' })),
    spinDrum: Texture.from(paintTaiko({ width: 340, tilt: 0.62, body: 'lacquer' })),
  };
  return set;
}

export function tex(): TextureSet {
  if (!set) throw new Error('Textures not built yet');
  return set;
}
