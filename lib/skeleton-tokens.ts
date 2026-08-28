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

// Croma aproximada (0..1): distingue colores "de verdad" de negros/grises/blancos.
function chromaOf(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
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

// Receta de fondo por ESTILO (variante light). El fondo se deriva del color de
// marca para que varíe por estilo Y por marca, en vez de ser siempre el mismo
// crema. tint = cuánto blanco se mezcla con el primario (mayor => más claro);
// warm = cuánto se desplaza luego hacia el crema base (calidez). El resultado
// se fuerza a un contraste muy alto con el texto para que SIEMPRE sea legible.
export interface BgRecipe { tint?: number; warm?: number; }
const CREAM_BASE = '#F4F1EA';

function computeStyleBg(primary: string, recipe: BgRecipe | null | undefined, textTitle: string): string {
  // Sin receta -> crema clásico (compatibilidad con estilos sin bg definido).
  if (!recipe || (recipe.tint == null && recipe.warm == null)) return CREAM_BASE;
  const tint = typeof recipe.tint === 'number' ? Math.min(0.99, Math.max(0.80, recipe.tint)) : 0.94;
  const warm = typeof recipe.warm === 'number' ? Math.min(0.6, Math.max(0, recipe.warm)) : 0;
  let bg = mix(primary, '#FFFFFF', tint);
  if (warm > 0) bg = mix(bg, CREAM_BASE, warm);
  // Garantía dura: el fondo debe quedar MUY claro frente al texto de título.
  // Si un primario raro lo dejara apagado, lo aclaramos hacia blanco hasta 8.5:1.
  let guard = 0;
  while (contrast(bg, textTitle) < 8.5 && guard < 12) { bg = mix(bg, '#FFFFFF', 0.15); guard++; }
  return bg;
}

export function deriveTokens(brand: BrandColors, variant: RecipeVariant = 'light', bgRecipe?: BgRecipe | null): Tokens {
  const primary = (brand.color_primary && brand.color_primary.trim()) || '#1E6E5A';
  const secondaryRaw = (brand.color_secondary && brand.color_secondary.trim()) || '';
  const dark = variant === 'dark';

  // El ACENTO visual es el color CROMÁTICO de la marca. Si el primario es
  // prácticamente acromático (negro/blanco/gris — típico en marcas premium
  // negro+dorado, como Pedro Quiromasajista) y el secundario sí tiene croma,
  // el acento real de la marca es el secundario: así barras, pills, checks y
  // números salen en el color de marca en vez de en negro/gris plano. Los
  // textos siguen gobernados por los tokens de texto con contraste, no por esto.
  let accent = primary;
  if (chromaOf(primary) < 0.10 && secondaryRaw && chromaOf(secondaryRaw) >= 0.18) {
    accent = secondaryRaw;
  }

  // Fondo: en dark, el oscuro de siempre. En light, derivado del estilo+marca
  // (con fallback al crema si el estilo no trae receta). Se tinta con el ACENTO
  // efectivo: si el primario es negro, el tinte de marca útil es el del acento.
  const bg = dark ? '#14110F' : computeStyleBg(accent, bgRecipe, '#1F2A24');
  const surface = dark ? '#1E1A17' : '#FFFFFF';

  // accent-soft: versión suave del primario. Si la marca da secundario y contrasta
  // poco con el primario, derivamos uno desde el primario para asegurar separación.
  let accentSoft = secondaryRaw || (dark ? mix(accent, '#000000', 0.55) : mix(accent, '#FFFFFF', 0.78));
  // Si el secundario de marca está demasiado cerca del accent o del bg (incluido
  // el caso en que el secundario ES ahora el accent), derivamos del accent.
  if (contrast(accentSoft, accent) < 1.15 || contrast(accentSoft, bg) < 1.06) {
    accentSoft = dark ? mix(accent, '#000000', 0.55) : mix(accent, '#FFFFFF', 0.78);
  }

  // accent-tint: tinte suave del primario para formas decorativas grandes de
  // fondo (círculos/blobs). Debe DESTACAR sobre --bg. Como ahora --bg puede ir
  // tintado de marca (mismo matiz que el tint), partimos del nivel suave y, si
  // no separa lo suficiente del fondo, lo intensificamos (menos blanco) hasta
  // lograr una diferencia visible. En dark se mantiene el cálculo anterior.
  let accentTint: string;
  if (dark) {
    accentTint = mix(accent, '#000000', 0.62);
  } else {
    let t = 0.86;
    accentTint = mix(accent, '#FFFFFF', t);
    let tg = 0;
    while (contrast(accentTint, bg) < 1.12 && t > 0.55 && tg < 20) {
      t -= 0.03; accentTint = mix(accent, '#FFFFFF', t); tg++;
    }
  }

  const textTitleBase = dark ? '#F4F1EA' : '#1F2A24';
  const textBodyBase = dark ? '#C9C4BD' : '#4A574F';
  const textMutedBase = dark ? '#8A847C' : '#8A938C';
  const hairline = dark ? '#2C2722' : '#E2DDD2';

  // GUARDIA DE LEGIBILIDAD DE accent-soft (2026-08-28). accent-soft es "fondo
  // de tarjetas CON TEXTO" (paneles de two_column, tarjetas), así que la tinta
  // de título tiene que leerse encima. Las comprobaciones de arriba solo miran
  // separación con accent y bg, no legibilidad: un secundario de marca casi
  // negro (caso real: Vibemarket #0b0d14) pasaba crudo y con variant light la
  // tinta oscura desaparecía sobre él (panel derecho ilegible en modern_grid).
  // Si no llega a 4.5:1 con la tinta final, se re-deriva del acento hacia el
  // polo del fondo (tinte claro en light, sombra en dark), que es lo que
  // "soft" significa. En dark, panel oscuro + tinta clara ya cumple y no se toca.
  const textTitle = ensureContrast(textTitleBase, bg, 7);
  if (contrast(accentSoft, textTitle) < 4.5) {
    accentSoft = dark ? mix(accent, '#000000', 0.55) : mix(accent, '#FFFFFF', 0.78);
    if (contrast(accentSoft, textTitle) < 4.5) {
      accentSoft = mix(accentSoft, relLum(textTitle) < 0.45 ? '#FFFFFF' : '#111111', 0.5);
    }
  }

  return {
    '--bg': bg,
    '--surface': surface,
    '--text-title': textTitle,
    '--text-body': ensureContrast(textBodyBase, bg, 4.5),
    '--text-muted': ensureContrast(textMutedBase, bg, 3),
    '--accent': accent,                       // relleno (botones, formas) — sin tocar
    '--accent-soft': accentSoft,              // fondo de slide / tarjetas con texto
    '--accent-tint': accentTint,              // wash decorativo seguro (círculos/blobs de fondo)
    '--accent-text': bestTextOn(accent),      // texto SOBRE accent (contraste garantizado)
    '--accent-on-bg': accentForText(accent, bg, 4.5), // accent usable como texto sobre bg
    '--hairline': hairline,
  };
}
