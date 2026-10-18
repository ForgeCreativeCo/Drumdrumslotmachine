const TOMOE = 'M 0 -42 A 42 42 0 0 1 36.4 21 A 46 46 0 0 0 17 -26 A 16 16 0 1 1 0 -42 Z';

/** Mitsudomoe crest, the triple swirl painted on taiko heads, as SVG paths. */
export function mitsudomoe(cx: number, cy: number, r: number, fill: string): string {
  const s = r / 50;
  return [0, 120, 240]
    .map((a) => `<path d="${TOMOE}" fill="${fill}" transform="translate(${cx} ${cy}) rotate(${a}) scale(${s})"/>`)
    .join('');
}
