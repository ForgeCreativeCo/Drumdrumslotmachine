import { SYMBOLS, type SymbolId } from '../math/symbols';

const TOMOE = 'M 0 -42 A 42 42 0 0 1 36.4 21 A 46 46 0 0 0 17 -26 A 16 16 0 1 1 0 -42 Z';

/** Mitsudomoe crest, the triple swirl painted on taiko heads. */
export function mitsudomoe(cx: number, cy: number, r: number, fill: string): string {
  const s = r / 50;
  return [0, 120, 240]
    .map((a) => `<path d="${TOMOE}" fill="${fill}" transform="translate(${cx} ${cy}) rotate(${a}) scale(${s})"/>`)
    .join('');
}

function tile(id: SymbolId, inner: string): string {
  const [light, dark] = SYMBOLS[id].colors;
  return `<svg viewBox="0 0 100 100" class="sym-svg" aria-hidden="true">
  <defs>
    <radialGradient id="g-${id}" cx="50%" cy="35%" r="75%">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${dark}"/>
    </radialGradient>
    <linearGradient id="rim-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff3c4"/>
      <stop offset=".5" stop-color="#d4a23c"/>
      <stop offset="1" stop-color="#7a5310"/>
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="90" height="90" rx="16" fill="url(#g-${id})" stroke="url(#rim-${id})" stroke-width="3.5"/>
  <rect x="11" y="11" width="78" height="78" rx="11" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="1.5"/>
  ${inner}
</svg>`;
}

function kanji(id: SymbolId, size = 58): string {
  const k = SYMBOLS[id].kanji;
  return `<text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="${size}"
    class="kanji" fill="#fff8e7" stroke="#2a0a04" stroke-width="2.4" paint-order="stroke">${k}</text>`;
}

function wild(): string {
  return `<svg viewBox="0 0 100 100" class="sym-svg" aria-hidden="true">
  <defs>
    <radialGradient id="wild-head" cx="45%" cy="40%" r="60%">
      <stop offset="0" stop-color="#fff6dc"/><stop offset=".75" stop-color="#e9cf9a"/><stop offset="1" stop-color="#b48a4a"/>
    </radialGradient>
    <linearGradient id="wild-body" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5a0d0d"/><stop offset=".5" stop-color="#b3201b"/><stop offset="1" stop-color="#5a0d0d"/>
    </linearGradient>
  </defs>
  <rect x="5" y="5" width="90" height="90" rx="16" fill="#2a0905" stroke="#f3c75a" stroke-width="3.5"/>
  <circle cx="50" cy="44" r="38" fill="url(#wild-body)" stroke="#f3c75a" stroke-width="2"/>
  ${Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `<circle cx="${(50 + Math.cos(a) * 35).toFixed(1)}" cy="${(44 + Math.sin(a) * 35).toFixed(1)}" r="2" fill="#f3c75a"/>`;
  }).join('')}
  <circle cx="50" cy="44" r="30" fill="url(#wild-head)"/>
  ${mitsudomoe(50, 44, 24, '#b3201b')}
  <rect x="14" y="74" width="72" height="18" rx="5" fill="#f3c75a" stroke="#7a5310" stroke-width="1.5"/>
  <text x="50" y="84" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="900"
    letter-spacing="3" fill="#5a0d0d" class="latin">WILD</text>
</svg>`;
}

function scatter(): string {
  const drums = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(a) * 34;
    const y = 50 + Math.sin(a) * 34;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7.5" fill="#e9cf9a" stroke="#f3c75a" stroke-width="1.5"/>
      ${mitsudomoe(x, y, 5.5, '#1f3f9a')}`;
  }).join('');
  return tile(
    'SCATTER',
    `<circle cx="50" cy="50" r="34" fill="none" stroke="#f3c75a" stroke-width="2.5"/>
    ${drums}
    <text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-size="40" class="kanji"
      fill="#fffbe0" stroke="#0a1a4a" stroke-width="2" paint-order="stroke">雷</text>`,
  );
}

const cache = new Map<SymbolId, string>();

export function symbolSvg(id: SymbolId): string {
  let svg = cache.get(id);
  if (!svg) {
    svg = id === 'WILD' ? wild() : id === 'SCATTER' ? scatter() : tile(id, kanji(id));
    cache.set(id, svg);
  }
  return svg;
}
