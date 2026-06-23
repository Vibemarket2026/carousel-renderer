// /lib/skeleton-tokens.ts
// Derivación de paleta de marca -> tokens CSS, con control de contraste WCAG.
// Única fuente de verdad de la presentación: la usa render-html.ts.
//
// Recibe los 2 colores de marca crudos y la variante (light/dark) que define el
// estilo, y devuelve el set completo de tokens que los esqueletos esperan
// (--bg, --surface, --text-title, --text-body, --text-muted, --accent,
//  --accent-soft, --accent-text, --hairline). Garantiza legibilidad: ningún
// par texto/fondo baja del ratio exigido aunque la marca suba colores difíciles.

export interface BrandColors {
  color_primary?: string | null;
  color_secondary?: string | null;
}

export type RecipeVariant = 'light' | 'dark';

export type Tokens = Record<string, string>;

function clamp(v: number): number { return Math.max(0, Math.min(255, Math.round(v))); }

function hexToRgb(hex: string): [number, number, number] {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [30, 110, 90]; // fallback verde si viene basura
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

function relLum(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const l1 = relLum(a), l2 = relLum(b);
  const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(hex: string, target: string, t: number): string {
  const a = hexToRgb(hex), b = hexToRgb(target);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

// El color de texto (blanco o casi-negro) que mejor contrasta sobre un fondo.
function bestTextOn(bg: string): string {
  return contrast(bg, '#FFFFFF') >= contrast(bg, '#1A1A1A') ? '#FFFFFF' : '#1A1A1A';
}

// Empuja `text` hacia blanco o negro (según el fondo) hasta alcanzar `ratio`.
function ensureContrast(text: string, bg: string, ratio = 4.5): string {
  if (contrast(text, bg) >= ratio) return text;
  const goWhite = relLum(bg) < 0.45; // fondo oscuro -> aclarar el texto
  let best = text, bestC = contrast(text, bg);
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const cand = mix(text, goWhite ? '#FFFFFF' : '#111111', t);
    const c = contrast(cand, bg);
    if (c > bestC) { bestC = c; best = cand; }
    if (c >= ratio) return cand;
  }
  return best;
}

// Si el accent es demasiado claro para usarse como TEXTO sobre el fondo claro
// (eyebrows, números), derivamos una versión más oscura SOLO para texto, sin
// tocar el accent usado como relleno (botones, formas).
function accentForText(accent: string, bg: string, ratio = 4.5): string {
  if (contrast(accent, bg) >= ratio) return accent;
  let best = accent, bestC = contrast(accent, bg);
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const cand = mix(accent, '#111111', t);
    const c = contrast(cand, bg);
    if (c > bestC) { bestC = c; best = cand; }
    if (c >= ratio) return cand;
  }
  return best;
}

export function deriveTokens(brand: BrandColors, variant: RecipeVariant = 'light'): Tokens {
  const primary = (brand.color_primary && brand.color_primary.trim()) || '#1E6E5A';
  const secondaryRaw = (brand.color_secondary && brand.color_secondary.trim()) || '';
  const dark = variant === 'dark';

  const bg = dark ? '#14110F' : '#F4F1EA';
  const surface = dark ? '#1E1A17' : '#FFFFFF';
  const accent = primary;

  // accent-soft: versión suave del primario. Si la marca da secundario y contrasta
  // poco con el primario, derivamos uno desde el primario para asegurar separación.
  let accentSoft = secondaryRaw || (dark ? mix(primary, '#000000', 0.55) : mix(primary, '#FFFFFF', 0.78));
  // Si el secundario de marca está demasiado cerca del accent o del bg, derivamos.
  if (contrast(accentSoft, accent) < 1.15 || contrast(accentSoft, bg) < 1.06) {
    accentSoft = dark ? mix(primary, '#000000', 0.55) : mix(primary, '#FFFFFF', 0.78);
  }

  const textTitleBase = dark ? '#F4F1EA' : '#1F2A24';
  const textBodyBase = dark ? '#C9C4BD' : '#4A574F';
  const textMutedBase = dark ? '#8A847C' : '#8A938C';
  const hairline = dark ? '#2C2722' : '#E2DDD2';

  return {
    '--bg': bg,
    '--surface': surface,
    '--text-title': ensureContrast(textTitleBase, bg, 7),
    '--text-body': ensureContrast(textBodyBase, bg, 4.5),
    '--text-muted': ensureContrast(textMutedBase, bg, 3),
    '--accent': accent,                       // relleno (botones, formas) — sin tocar
    '--accent-soft': accentSoft,
    '--accent-text': bestTextOn(accent),      // texto SOBRE accent (contraste garantizado)
    '--accent-on-bg': accentForText(accent, bg, 4.5), // accent usable como texto sobre bg
    '--hairline': hairline,
  };
}
