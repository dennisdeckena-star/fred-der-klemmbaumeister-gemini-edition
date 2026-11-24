import { LDrawColor } from './types';

export const LDRAW_COLORS: Record<number, LDrawColor> = {
  0: { code: 0, name: 'Black', hex: '#20262E', edgeHex: '#525C68', alpha: 1, finish: 'ABS_GLOSS' },
  1: { code: 1, name: 'Blue', hex: '#1E5AA8', edgeHex: '#0F2E56', alpha: 1, finish: 'ABS_GLOSS' },
  2: { code: 2, name: 'Green', hex: '#00852B', edgeHex: '#004A18', alpha: 1, finish: 'ABS_GLOSS' },
  4: { code: 4, name: 'Red', hex: '#B40000', edgeHex: '#630000', alpha: 1, finish: 'ABS_GLOSS' },
  6: { code: 6, name: 'Brown', hex: '#583927', edgeHex: '#2E1E14', alpha: 1, finish: 'ABS_GLOSS' },
  7: { code: 7, name: 'Light Gray', hex: '#9BA19D', edgeHex: '#555856', alpha: 1, finish: 'ABS_GLOSS' },
  10: { code: 10, name: 'Bright Green', hex: '#58AB41', edgeHex: '#2F6121', alpha: 1, finish: 'ABS_GLOSS' },
  14: { code: 14, name: 'Yellow', hex: '#FAC80A', edgeHex: '#9E7E04', alpha: 1, finish: 'ABS_GLOSS' },
  15: { code: 15, name: 'White', hex: '#F4F4F4', edgeHex: '#B8B8B8', alpha: 1, finish: 'ABS_GLOSS' },
  19: { code: 19, name: 'Tan', hex: '#DEC69C', edgeHex: '#8E7B5A', alpha: 1, finish: 'ABS_GLOSS' },
  25: { code: 25, name: 'Orange', hex: '#E08E26', edgeHex: '#9A5B0E', alpha: 1, finish: 'ABS_GLOSS' },
  28: { code: 28, name: 'Dark Tan', hex: '#958A73', edgeHex: '#554E41', alpha: 1, finish: 'ABS_GLOSS' },
  41: { code: 41, name: 'Trans-Red', hex: '#C91A09', edgeHex: '#7A0F05', alpha: 0.55, finish: 'TRANSPARENT' },
  42: { code: 42, name: 'Trans-Neon Green', hex: '#C0FF00', edgeHex: '#7EA800', alpha: 0.55, finish: 'TRANSPARENT' },
  43: { code: 43, name: 'Trans-Light Blue', hex: '#73B9E6', edgeHex: '#3A749A', alpha: 0.55, finish: 'TRANSPARENT' },
  47: { code: 47, name: 'Trans-Clear', hex: '#FCFCFC', edgeHex: '#B0B0B0', alpha: 0.45, finish: 'TRANSPARENT' },
  70: { code: 70, name: 'Reddish Brown', hex: '#5F3109', edgeHex: '#331A04', alpha: 1, finish: 'ABS_GLOSS' },
  71: { code: 71, name: 'Light Bluish Gray', hex: '#A3A2A4', edgeHex: '#636264', alpha: 1, finish: 'ABS_GLOSS' },
  72: { code: 72, name: 'Dark Bluish Gray', hex: '#635F61', edgeHex: '#373536', alpha: 1, finish: 'ABS_GLOSS' },
  73: { code: 73, name: 'Medium Blue', hex: '#7396C8', edgeHex: '#3C5982', alpha: 1, finish: 'ABS_GLOSS' },
  272: { code: 272, name: 'Dark Blue', hex: '#143044', edgeHex: '#0A1924', alpha: 1, finish: 'ABS_GLOSS' },
  320: { code: 320, name: 'Dark Red', hex: '#720012', edgeHex: '#3E000A', alpha: 1, finish: 'ABS_GLOSS' },
};

export function getColorByCode(code: number): LDrawColor {
  return LDRAW_COLORS[code] ?? LDRAW_COLORS[71];
}

export function listColors(): LDrawColor[] {
  return Object.values(LDRAW_COLORS);
}
