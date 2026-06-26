// /api/render-html.ts
// Vibemarket Render Engine — endpoint de ESQUELETOS (DB-driven).
// POST /api/render-html → recibe un esqueleto HTML + datos, devuelve PNG base64.
//
// A diferencia de /api/render-slide (recetas/legacy hardcodeadas), este endpoint
// es puramente funcional y sin estado: NO conoce la base de datos, NO tiene
// estilos hardcodeados. Recibe TODO lo necesario en el body y renderiza.
//
// Reparto de responsabilidades:
//   - n8n (ensamblador) elige estilo, resuelve type->skeleton, trae el
//     html_template de DB, y manda aquí { skeleton_html, fields, brand, variant }.
//   - Aquí (única fuente de verdad de PRESENTACIÓN): derivar tokens con contraste
//     WCAG, inyectar campos + tokens, normalizar display:flex para Satori,
//     cargar fuentes de marca en runtime, y renderizar Satori -> Resvg -> PNG.
//
// Body esperado:
// {
//   "skeleton_html": "<div ...>...{{title}}...</div>",   // html_template del esqueleto
//   "fields": { "title": "...", "eyebrow": "...", ... },  // contenido del agente
//   "brand": {
//     "color_primary": "#1E6E5A", "color_secondary": "#CDE7DC",
//     "font_heading": "Instrument Serif", "font_body": "Inter", "name": "..."
//   },
//   "variant": "light" | "dark",                          // del estilo (global_rules.variant)
//   "output": { "width": 1080, "height": 1350 },          // opcional
//   "meta": { "post_id": "...", "slide_number": 2 }        // opcional, passthrough
// }

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { html as toVNode } from 'satori-html';
import { deriveTokens, BrandColors, RecipeVariant, Tokens, BgRecipe } from '../lib/skeleton-tokens.js';
import { loadBrandFonts } from '../lib/skeleton-fonts.js';

// ── Emoji via Twemoji (idéntico patrón a render-slide.ts) ────────────
const emojiCache: Map<string, string> = new Map();
function toEmojiCodepoint(segment: string): string {
  const cps: string[] = [];
  for (const ch of segment) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    const hex = cp.toString(16);
    if (hex === 'fe0f') continue;
    cps.push(hex);
  }
  return cps.join('-');
}
async function fetchEmojiSvg(segment: string): Promise<string | null> {
  const cached = emojiCache.get(segment);
  if (cached !== undefined) return cached;
  const codepoint = toEmojiCodepoint(segment);
  if (!codepoint) { emojiCache.set(segment, ''); return null; }
  const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoint}.svg`;
  try {
    const r = await fetch(url);
    if (!r.ok) { emojiCache.set(segment, ''); return null; }
    const svg = await r.text();
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    emojiCache.set(segment, dataUri);
    return dataUri;
  } catch { emojiCache.set(segment, ''); return null; }
}

// ── Inyección de campos + tokens en el HTML del esqueleto ────────────
function fillTemplate(htmlTpl: string, fields: Record<string, unknown>, tokens: Tokens): string {
  let out = htmlTpl;
  for (const [k, v] of Object.entries(fields || {})) {
    out = out.split('{{' + k + '}}').join(v == null ? '' : String(v));
  }
  out = out.replace(/\{\{\w+\}\}/g, ''); // limpiar campos no provistos
  for (const [k, v] of Object.entries(tokens)) {
    out = out.split('var(' + k + ')').join(v);
  }
  return out;
}

// ── Bug 3: stat sin número ───────────────────────────────────────────
// Algunos esqueletos `*_stat` reservan un <span> enorme para {{stat_number}}.
// Si el agente no envía número (stat_number vacío), ese span queda vacío y
// descoloca la composición, y el `context` se ve diminuto. Cuando no hay
// número, eliminamos el <span> del número del HTML resuelto para que el
// `stat_label` pase a ser el protagonista y el `context` quede debajo sin
// hueco. Es defensivo: si no encuentra el patrón, no toca nada.
function dropEmptyStatNumber(resolvedHtml: string, fields: Record<string, unknown>): string {
  const n = fields?.stat_number;
  const hasNumber = n != null && String(n).trim() !== '';
  if (hasNumber) return resolvedHtml;
  // El span del número se reconoce por un font-size muy grande (>=200px) y
  // estar vacío tras la sustitución. Capturamos
  // <span ...font-size:NNNpx...></span> con NNN>=200 y contenido vacío.
  const re = /<span[^>]*font-size:(\d{3,})px[^>]*>\s*<\/span>/g;
  return resolvedHtml.replace(re, (m, size) => (parseInt(size, 10) >= 200 ? '' : m));
}

// ── Logo en la slide de cierre (cta) ─────────────────────────────────
// Inserta el logo de marca arriba centrado SOLO en la última slide (cta),
// SOLO si hay logo_url y la variante es 'light' (en fondos oscuros el logo —
// casi siempre oscuro y no recoloreable por ser PNG— quedaría sin contraste,
// así que se omite y se mantiene el nombre en texto que ya trae el esqueleto).
// Se descarga la imagen a data-URI ANTES de pasarla a Satori; si la descarga
// falla, se omite el logo (no se rompe el render de la cta). Se inyecta como
// primer hijo del <div> raíz, en position:absolute, para no descolocar el
// layout de ninguna de las 12 plantillas de cta.
const logoCache: Map<string, string> = new Map();
async function fetchLogoDataUri(url: string): Promise<string | null> {
  const cached = logoCache.get(url);
  if (cached !== undefined) return cached || null;
  try {
    const r = await fetch(url);
    if (!r.ok) { logoCache.set(url, ''); return null; }
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    // Satori soporta png/jpeg/svg como <img>. Aceptamos esos tipos.
    let mime = 'image/png';
    if (ct.includes('svg')) mime = 'image/svg+xml';
    else if (ct.includes('jpeg') || ct.includes('jpg')) mime = 'image/jpeg';
    else if (ct.includes('png')) mime = 'image/png';
    else if (ct.includes('webp')) { logoCache.set(url, ''); return null; } // webp no fiable en Satori
    const buf = Buffer.from(await r.arrayBuffer());
    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    logoCache.set(url, dataUri);
    return dataUri;
  } catch { logoCache.set(url, ''); return null; }
}

async function injectCtaLogo(resolvedHtml: string, opts: { skeletonId: string; variant: string; logoUrl?: string | null }): Promise<string> {
  const { skeletonId, variant, logoUrl } = opts;
  const isCta = typeof skeletonId === 'string' && /_cta$/.test(skeletonId);
  if (!isCta || variant === 'dark' || !logoUrl) return resolvedHtml;
  const dataUri = await fetchLogoDataUri(logoUrl);
  if (!dataUri) return resolvedHtml; // logo no descargable -> se queda el nombre en texto
  const logoBlock =
    '<div style="position:absolute;top:64px;left:0;right:0;display:flex;flex-direction:row;justify-content:center;align-items:center;">' +
    '<img src="' + dataUri + '" width="200" height="72" style="display:flex;height:72px;width:auto;max-width:340px;object-fit:contain;" />' +
    '</div>';
  const m = resolvedHtml.match(/<div[^>]*>/);
  if (!m) return resolvedHtml;
  const insertAt = (m.index || 0) + m[0].length;
  return resolvedHtml.slice(0, insertAt) + logoBlock + resolvedHtml.slice(insertAt);
}

// ── Normalizador Satori: display:flex explícito en cada <div> ────────
// Satori exige display:flex (o none) en todo div con >1 hijo. Forzamos flex
// en todos los div; respetamos flex-direction si ya viene declarado, si no,
// asumimos column (el caso más común en estos esqueletos).
function normalizeFlex(node: any): any {
  if (!node || typeof node !== 'object') return node;
  const kids = node.props?.children;
  const arr = Array.isArray(kids) ? kids : (kids != null ? [kids] : []);
  if (node.type === 'div') {
    node.props = node.props || {};
    node.props.style = node.props.style || {};
    if (node.props.style.display == null) node.props.style.display = 'flex';
    if (node.props.style.display === 'flex' && node.props.style.flexDirection == null) {
      node.props.style.flexDirection = 'column';
    }
  }
  arr.forEach(normalizeFlex);
  return node;
}

export default async function handler(req: any, res: any) {
  const startTime = Date.now();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const skeletonHtml: string = body?.skeleton_html;
    if (!skeletonHtml || typeof skeletonHtml !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing skeleton_html' });
    }
    const fields = body?.fields || {};
    const brandColors: BrandColors = {
      color_primary: body?.brand?.color_primary || '#1E6E5A',
      color_secondary: body?.brand?.color_secondary || null,
    };
    const fontHeading: string = body?.brand?.font_heading || 'Instrument Serif';
    const fontBody: string = body?.brand?.font_body || 'Inter';
    const variant: RecipeVariant = body?.variant === 'dark' ? 'dark' : 'light';
    // Receta de fondo por estilo (opcional). Viene de global_rules.bg del estilo,
    // reenviada por n8n como body.bg_recipe. Si no llega, deriveTokens usa el crema.
    const bgRecipe: BgRecipe | null = (body?.bg_recipe && typeof body.bg_recipe === 'object')
      ? { tint: body.bg_recipe.tint, warm: body.bg_recipe.warm }
      : null;

    const width = body?.output?.width || 1080;
    const height = body?.output?.height || 1350;

    // 1. Tokens con contraste. Las familias de marca entran como tokens de fuente.
    const tokens = deriveTokens(brandColors, variant, bgRecipe);
    tokens['--font-display'] = fontHeading;
    tokens['--font-body'] = fontBody;

    // 2. Inyectar contenido + tokens en el esqueleto.
    let resolvedHtml = fillTemplate(skeletonHtml, fields, tokens);
    // 2b. Si es un stat sin número, colapsar el hueco del número gigante.
    resolvedHtml = dropEmptyStatNumber(resolvedHtml, fields);
    // 2c. Logo de marca en la slide de cierre (cta), si procede.
    resolvedHtml = await injectCtaLogo(resolvedHtml, {
      skeletonId: body?.meta?.skeleton_id || '',
      variant,
      logoUrl: body?.brand?.logo_url || null,
    });

    // 3. HTML -> vnode -> normalizar display:flex.
    const tree = normalizeFlex(toVNode(resolvedHtml));

    // 4. Fuentes de marca (Google Fonts runtime + Inter fallback).
    const fonts = await loadBrandFonts([fontHeading, fontBody]);

    // 5. Satori -> SVG (con emojis Twemoji).
    const svg = await satori(tree as any, {
      width, height, fonts,
      loadAdditionalAsset: async (code: string, segment: string) => {
        if (code === 'emoji') return (await fetchEmojiSvg(segment)) || '';
        return '';
      },
    });

    // 6. SVG -> PNG.
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();

    return res.status(200).json({
      success: true,
      image_base64: png.toString('base64'),
      resolved_tokens: tokens,           // para depurar contraste/colores
      dimensions: { width, height },
      meta: body?.meta || null,          // passthrough (post_id, slide_number…)
      render_time_ms: Date.now() - startTime,
    });
  } catch (error) {
    console.error('[render-html] error:', error);
    return res.status(500).json({
      success: false,
      error: 'Render failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
