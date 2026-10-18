export type SymbolId =
  | 'ONI'
  | 'RYU'
  | 'KOI'
  | 'OGI'
  | 'BACHI'
  | 'CHOCHIN'
  | 'SAKURA'
  | 'ZENI'
  | 'WILD'
  | 'SCATTER';

export interface SymbolInfo {
  id: SymbolId;
  kanji: string;
  name: string;
  /** Tile gradient: [light, dark]. */
  colors: [string, string];
}

export const SYMBOLS: Record<SymbolId, SymbolInfo> = {
  ONI: { id: 'ONI', kanji: '鬼', name: 'Oni Drum Master', colors: ['#ff5a4e', '#7a0f12'] },
  RYU: { id: 'RYU', kanji: '龍', name: 'Dragon', colors: ['#4fe0b5', '#0b4d43'] },
  KOI: { id: 'KOI', kanji: '鯉', name: 'Golden Koi', colors: ['#ffb347', '#8a3b06'] },
  OGI: { id: 'OGI', kanji: '扇', name: 'War Fan', colors: ['#b98cff', '#3b1773'] },
  BACHI: { id: 'BACHI', kanji: '撥', name: 'Bachi Sticks', colors: ['#d9a46b', '#5a3313'] },
  CHOCHIN: { id: 'CHOCHIN', kanji: '灯', name: 'Paper Lantern', colors: ['#ff8a5c', '#7d2a12'] },
  SAKURA: { id: 'SAKURA', kanji: '桜', name: 'Sakura', colors: ['#ffb6d0', '#8c2f57'] },
  ZENI: { id: 'ZENI', kanji: '銭', name: 'Mon Coin', colors: ['#c9d27a', '#4f5216'] },
  WILD: { id: 'WILD', kanji: '太鼓', name: 'Taiko Wild', colors: ['#ffe08a', '#8a5a00'] },
  SCATTER: { id: 'SCATTER', kanji: '雷', name: 'Raijin Thunder', colors: ['#8fd3ff', '#102a6b'] },
};

/** Symbols that pay on ways, from highest to lowest. */
export const PAYING_SYMBOLS: SymbolId[] = [
  'ONI',
  'RYU',
  'KOI',
  'OGI',
  'BACHI',
  'CHOCHIN',
  'SAKURA',
  'ZENI',
];

/** Way pays, as multiples of the total bet, indexed by number of reels matched. */
export const PAYTABLE: Record<string, Record<3 | 4 | 5, number>> = {
  ONI: { 3: 0.7, 4: 2, 5: 7 },
  RYU: { 3: 0.55, 4: 1.6, 5: 5.5 },
  KOI: { 3: 0.4, 4: 1.4, 5: 4 },
  OGI: { 3: 0.32, 4: 1.1, 5: 3.2 },
  BACHI: { 3: 0.2, 4: 0.55, 5: 1.6 },
  CHOCHIN: { 3: 0.2, 4: 0.55, 5: 1.6 },
  SAKURA: { 3: 0.14, 4: 0.42, 5: 1.4 },
  ZENI: { 3: 0.14, 4: 0.42, 5: 1.4 },
};

/** Scatter pays (multiples of total bet) by number of scatters anywhere. */
export const SCATTER_PAY: Record<number, number> = { 3: 2, 4: 10, 5: 50 };
