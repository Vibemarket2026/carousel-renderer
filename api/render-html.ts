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
import { deriveTokens, BrandColors, RecipeVariant, Tokens } from '../lib/skeleton-tokens.js';
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

    const width = body?.output?.width || 1080;
    const height = body?.output?.height || 1350;

    // 1. Tokens con contraste. Las familias de marca entran como tokens de fuente.
    const tokens = deriveTokens(brandColors, variant);
    tokens['--font-display'] = fontHeading;
    tokens['--font-body'] = fontBody;

    // 2. Inyectar contenido + tokens en el esqueleto.
    const resolvedHtml = fillTemplate(skeletonHtml, fields, tokens);

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
