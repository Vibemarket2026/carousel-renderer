// /lib/contrast.ts
// WCAG 2.1 contrast validation + automatic color adjustment
// Ensures all text is readable regardless of user brand colors

interface RGB { r: number; g: number; b: number; }
interface HSL { h: number; s: number; l: number; }

// ── Parse & Convert ──────────────────────────────────────────

export function hexToRgb(hex: string): RGB {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

export function rgbToHex(rgb: RGB): string {
  const c = (v: number) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`;
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s, l };
}

export function hslToRgb(hsl: HSL): RGB {
  const { h, s, l } = hsl;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hNorm + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hNorm) * 255),
    b: Math.round(hue2rgb(p, q, hNorm - 1/3) * 255),
  };
}

// ── WCAG Luminance & Contrast ────────────────────────────────

function relativeLuminance(rgb: RGB): number {
  const srgb = [rgb.r, rgb.g, rgb.b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hexToRgb(hex)) > 0.4;
}

export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hexToRgb(hex)) < 0.15;
}

// ── Color Manipulation ───────────────────────────────────────

export function lighten(hex: string, amount: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = Math.min(1, hsl.l + amount);
  return rgbToHex(hslToRgb(hsl));
}

export function darken(hex: string, amount: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = Math.max(0, hsl.l - amount);
  return rgbToHex(hslToRgb(hsl));
}

export function adjustSaturation(hex: string, amount: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = Math.min(1, Math.max(0, hsl.s + amount));
  return rgbToHex(hslToRgb(hsl));
}

export function setLightness(hex: string, targetLightness: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.l = targetLightness;
  return rgbToHex(hslToRgb(hsl));
}

export function withOpacity(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

// ── Pastel Generation (for soft_pastel mood) ─────────────────

export function toPastel(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = Math.min(0.35, hsl.s * 0.5);
  hsl.l = 0.92;
  return rgbToHex(hslToRgb(hsl));
}

export function toPastelDark(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = Math.min(0.5, hsl.s * 0.7);
  hsl.l = 0.2;
  return rgbToHex(hslToRgb(hsl));
}

export function toPastelMid(hex: string): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  hsl.s = Math.min(0.4, hsl.s * 0.6);
  hsl.l = 0.4;
  return rgbToHex(hslToRgb(hsl));
}

// ── Smart Text Color Selection ───────────────────────────────
// Given a background color, returns the best text color
// that meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

export function textColorOnBg(bgHex: string, brandHex?: string): string {
  // Try white first
  if (contrastRatio(bgHex, '#FFFFFF') >= 4.5) return '#FFFFFF';
  // Try near-white
  if (contrastRatio(bgHex, '#F0F0F0') >= 4.5) return '#F0F0F0';
  // Try brand-derived dark
  if (brandHex) {
    const brandDark = setLightness(brandHex, 0.15);
    if (contrastRatio(bgHex, brandDark) >= 4.5) return brandDark;
  }
  // Try near-black
  if (contrastRatio(bgHex, '#1A1A1A') >= 4.5) return '#1A1A1A';
  // Fallback
  return isLightColor(bgHex) ? '#000000' : '#FFFFFF';
}

export function subtitleColorOnBg(bgHex: string, brandHex?: string): string {
  // Subtitle needs 3:1 (large text) and should be softer than title
  if (isLightColor(bgHex)) {
    // Light bg: muted dark
    if (brandHex) {
      const muted = setLightness(brandHex, 0.35);
      if (contrastRatio(bgHex, muted) >= 3) return muted;
    }
    return '#6B7280';
  } else {
    // Dark bg: muted light
    if (brandHex) {
      const muted = setLightness(brandHex, 0.7);
      if (contrastRatio(bgHex, muted) >= 3) return muted;
    }
    return withOpacity('#FFFFFF', 0.7);
  }
}

export function accentColorOnBg(bgHex: string, brandSecondary: string): string {
  // Accent (category labels, CTA borders) — needs 3:1 minimum
  if (contrastRatio(bgHex, brandSecondary) >= 3) return brandSecondary;
  // Adjust secondary to meet contrast
  const hsl = rgbToHsl(hexToRgb(brandSecondary));
  if (isLightColor(bgHex)) {
    hsl.l = Math.min(hsl.l, 0.4);
  } else {
    hsl.l = Math.max(hsl.l, 0.65);
  }
  const adjusted = rgbToHex(hslToRgb(hsl));
  if (contrastRatio(bgHex, adjusted) >= 3) return adjusted;
  // Last resort
  return isLightColor(bgHex) ? darken(brandSecondary, 0.3) : lighten(brandSecondary, 0.3);
}

// ── Derive Full Palette From 2 Brand Colors ──────────────────
// This is the key function: given any pair of brand colors,
// produce a safe, harmonious palette for any mood

export interface DerivedPalette {
  bgMain: string;
  bgPanel: string;
  textTitle: string;
  textBody: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  decorationColor: string;
  decorationSoft: string;
  gradientFrom: string;
  gradientTo: string;
}

export function derivePalette(
  primary: string,
  secondary: string,
  moodType: 'dark' | 'light' | 'bold' | 'pastel' | 'split' | 'gradient'
): DerivedPalette {
  switch (moodType) {
    case 'dark': {
      const bg = darken(primary, 0.35);
      return {
        bgMain: bg,
        bgPanel: darken(primary, 0.3),
        textTitle: '#FFFFFF',
        textBody: withOpacity('#FFFFFF', 0.7),
        textMuted: withOpacity('#FFFFFF', 0.4),
        accent: accentColorOnBg(bg, secondary),
        accentSoft: withOpacity(secondary, 0.15),
        decorationColor: withOpacity(secondary, 0.2),
        decorationSoft: withOpacity(primary, 0.15),
        gradientFrom: darken(primary, 0.38),
        gradientTo: darken(secondary, 0.3),
      };
    }
    case 'light': {
      const bg = '#FAFAF8';
      return {
        bgMain: bg,
        bgPanel: primary,
        textTitle: textColorOnBg(bg, primary),
        textBody: '#555555',
        textMuted: '#999999',
        accent: accentColorOnBg(bg, primary),
        accentSoft: lighten(primary, 0.3),
        decorationColor: primary,
        decorationSoft: lighten(primary, 0.35),
        gradientFrom: bg,
        gradientTo: '#F0F0EE',
      };
    }
    case 'bold': {
      return {
        bgMain: primary,
        bgPanel: darken(primary, 0.1),
        textTitle: textColorOnBg(primary),
        textBody: subtitleColorOnBg(primary),
        textMuted: withOpacity(textColorOnBg(primary), 0.4),
        accent: accentColorOnBg(primary, secondary),
        accentSoft: withOpacity(secondary, 0.2),
        decorationColor: withOpacity(secondary, 0.25),
        decorationSoft: withOpacity('#000000', 0.1),
        gradientFrom: primary,
        gradientTo: darken(primary, 0.15),
      };
    }
    case 'pastel': {
      const bg = toPastel(primary);
      return {
        bgMain: bg,
        bgPanel: toPastel(secondary),
        textTitle: toPastelDark(primary),
        textBody: toPastelMid(primary),
        textMuted: lighten(toPastelMid(primary), 0.15),
        accent: setLightness(primary, 0.35),
        accentSoft: withOpacity(primary, 0.15),
        decorationColor: withOpacity(primary, 0.12),
        decorationSoft: withOpacity(secondary, 0.08),
        gradientFrom: bg,
        gradientTo: toPastel(secondary),
      };
    }
    case 'split': {
      const bg = '#FFFFFF';
      return {
        bgMain: bg,
        bgPanel: primary,
        textTitle: textColorOnBg(bg, primary),
        textBody: '#666666',
        textMuted: '#AAAAAA',
        accent: accentColorOnBg(bg, primary),
        accentSoft: lighten(primary, 0.35),
        decorationColor: secondary,
        decorationSoft: lighten(secondary, 0.3),
        gradientFrom: primary,
        gradientTo: darken(primary, 0.1),
      };
    }
    case 'gradient': {
      const bg = darken(primary, 0.3);
      return {
        bgMain: bg,
        bgPanel: darken(secondary, 0.2),
        textTitle: '#FFFFFF',
        textBody: withOpacity('#FFFFFF', 0.65),
        textMuted: withOpacity('#FFFFFF', 0.35),
        accent: accentColorOnBg(bg, secondary),
        accentSoft: withOpacity(secondary, 0.12),
        decorationColor: withOpacity(secondary, 0.15),
        decorationSoft: withOpacity(primary, 0.2),
        gradientFrom: darken(primary, 0.32),
        gradientTo: darken(secondary, 0.15),
      };
    }
  }
}
