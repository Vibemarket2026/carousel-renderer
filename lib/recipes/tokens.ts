// /lib/recipes/tokens.ts
// Derive a full design-token set from a brand's 2 colors. Every value the
// templates reference is a ROLE here, recalculated per brand. WCAG-aware:
// title/body text are darkened (or lightened on dark variant) to clear contrast.

export interface Tokens {
  variant: 'light' | 'dark';
  bgMain: string; bgPanel: string;
  surface: string; surfaceAlt: string;
  border: string; hairline: string;
  textTitle: string; textBody: string; textMuted: string;
  accent: string; accentSoft: string; accentText: string;
  scrim: string; gradFrom: string; gradTo: string;
}

interface RGB { r: number; g: number; b: number; }
interface HSL { h: number; s: number; l: number; }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function hexToRgb(h: string): RGB {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export const rgbToHex = ({ r, g, b }: RGB): string =>
  '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

function rgbToHsl({ r, g, b }: RGB): HSL {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
function hslToRgb({ h, s, l }: HSL): RGB {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}
export const hsl = (h: number, s: number, l: number): string => rgbToHex(hslToRgb({ h, s, l }));
const withL = (hex: string, l: number) => { const c = rgbToHsl(hexToRgb(hex)); return hsl(c.h, c.s, l); };
const withSL = (hex: string, s: number, l: number) => { const c = rgbToHsl(hexToRgb(hex)); return hsl(c.h, s, l); };
const getHSL = (hex: string): HSL => rgbToHsl(hexToRgb(hex));

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const a = [r, g, b].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
export function contrast(a: string, b: string): number {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function readableText(bg: string, hueHex: string, opts: { ratio?: number; dark?: boolean } = {}): string {
  const ratio = opts.ratio ?? 4.5; const dark = opts.dark ?? true;
  const c = getHSL(hueHex);
  for (let l = dark ? 30 : 92; dark ? l >= 0 : l <= 100; l += dark ? -2 : 2) {
    const cand = hsl(c.h, Math.min(c.s, 30), l);
    if (contrast(bg, cand) >= ratio) return cand;
  }
  return dark ? '#111111' : '#ffffff';
}
const onAccent = (accent: string) => (contrast(accent, '#ffffff') >= 3.2 ? '#ffffff' : withL(accent, 12));

export function deriveTokens(
  primary: string,
  secondary: string,
  opts: { variant?: 'light' | 'dark' } = {},
): Tokens {
  const variant = opts.variant ?? 'light';
  const p = getHSL(primary), s = getHSL(secondary);
  const accentHex = p.s >= s.s ? primary : secondary;
  const otherHex = p.s >= s.s ? secondary : primary;
  const a = getHSL(accentHex), o = getHSL(otherHex);
  const neutralHue = o.h;
  const isDarkOther = o.l < 35;
  const darken = (hex: string) => { const c = getHSL(hex); return hsl(c.h, c.s, 22); };

  if (variant === 'dark') {
    const bgMain = hsl(neutralHue, Math.min(o.s, 22), 8);
    const bgPanel = hsl(neutralHue, Math.min(o.s, 22), 13);
    const accent = withL(accentHex, Math.max(a.l, 55));
    return {
      variant, bgMain, bgPanel,
      surface: hsl(neutralHue, 18, 16), surfaceAlt: hsl(neutralHue, 16, 20),
      border: hsl(neutralHue, 14, 26), hairline: hsl(neutralHue, 12, 34),
      textTitle: hsl(neutralHue, 8, 95), textBody: hsl(neutralHue, 8, 82), textMuted: hsl(neutralHue, 10, 60),
      accent, accentSoft: withSL(accentHex, Math.min(a.s, 40), 24), accentText: onAccent(accent),
      scrim: 'rgba(8,10,12,0.86)', gradFrom: bgMain, gradTo: bgPanel,
    };
  }

  const bgMain = hsl(neutralHue, isDarkOther ? 16 : Math.min(o.s, 30), 95.5);
  const bgPanel = hsl(neutralHue, isDarkOther ? 14 : Math.min(o.s, 26), 92);
  const accent = a.l > 62 ? withL(accentHex, 46) : accentHex;
  const titleHueRef = isDarkOther ? otherHex : darken(accentHex);
  const textTitle = readableText(bgMain, titleHueRef, { ratio: 9, dark: true });
  const textBody = readableText(bgMain, titleHueRef, { ratio: 6.5, dark: true });
  const textMuted = readableText(bgMain, titleHueRef, { ratio: 4.5, dark: true });
  const accentSoft = isDarkOther ? withSL(accentHex, Math.min(a.s, 60), 86) : withSL(otherHex, Math.min(o.s, 70), 84);
  return {
    variant, bgMain, bgPanel,
    surface: '#ffffff', surfaceAlt: hsl(neutralHue, isDarkOther ? 12 : 20, 97),
    border: hsl(neutralHue, isDarkOther ? 10 : 18, 84),
    hairline: hsl(neutralHue, isDarkOther ? 8 : 14, 76),
    textTitle, textBody, textMuted,
    accent, accentSoft, accentText: onAccent(accent),
    scrim: 'rgba(20,17,14,0.78)', gradFrom: bgMain, gradTo: accentSoft,
  };
}
