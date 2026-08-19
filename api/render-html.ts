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
import UPNG from 'upng-js';
import { deriveTokens, contrast, BrandColors, RecipeVariant, Tokens, BgRecipe } from '../lib/skeleton-tokens.js';
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

// ── Bold Statement: título que cabe ──────────────────────────────────
// El cover de bold_statement usa font-size:176px fijo en el <h1>. Con títulos
// largos (>3-4 palabras) el texto se sale por abajo y empuja el footer fuera
// del lienzo. Ajustamos el tamaño del título según su longitud: corto -> 176px
// (máximo impacto, que es la gracia del estilo), largo -> se reduce hasta caber.
// Solo se aplica a bold_statement_cover; los demás estilos no se tocan.
function boldTitleSize(title: string): number {
  const len = (title || '').trim().length;
  if (len <= 14) return 176;
  if (len <= 22) return 150;
  if (len <= 34) return 128;
  if (len <= 48) return 108;
  if (len <= 64) return 92;
  return 78;
}
function fitBoldStatementTitle(resolvedHtml: string, skeletonId: string, title: unknown): string {
  if (skeletonId !== 'bold_statement_cover') return resolvedHtml;
  const t = title == null ? '' : String(title);
  const size = boldTitleSize(t);
  if (size === 176) return resolvedHtml; // ya es el tamaño por defecto
  // Reemplaza el font-size del <h1> (que trae 176px) por el calculado.
  return resolvedHtml.replace(/(<h1[^>]*font-size:)176px/, '$1' + size + 'px');
}

// ── Logo en la slide de cierre (cta) ─────────────────────────────────
// Inserta el logo de marca arriba centrado SOLO en la última slide (cta),
// SOLO si hay logo_url y la variante es 'light' (en fondos oscuros el logo —
// casi siempre oscuro y no recoloreable por ser PNG— quedaría sin contraste,
// así que se omite y se mantiene el nombre en texto que ya trae el esqueleto).
// Cuando SÍ se inserta el logo, el {{brand_name}} en texto del esqueleto se
// vacía (stripBrandNameSpan) para no duplicar la marca.
//
// DOS RESTRICCIONES DE SATORI QUE HAY QUE RESPETAR EN EL BLOQUE DEL LOGO:
//  1) El contenedor absolute usa left:0;width:1080px (NO left:0;right:0):
//     Satori no resuelve el ancho con left+right a la vez.
//  2) El <img> usa width/height EXPLÍCITOS en el CSS (NO width:auto):
//     con width:auto Satori inserta el <image> en el SVG pero NO lo rasteriza
//     (la imagen sale invisible). Caja fija 360x96 + object-fit:contain ->
//     el logo se pinta y conserva su proporción centrado en la caja.
// El logo (PNG, normalmente transparente) se aplana sobre el fondo REAL de la
// slide (detectRootBg) para que la zona transparente se funda con el fondo y no
// quede un recuadro. El fondo real puede ser --bg o --accent según el estilo.
const logoCache: Map<string, string> = new Map();

function hexToRgbTuple(hex: string): [number, number, number] {
  let h = (hex || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [255, 255, 255];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// Aplana un PNG (posiblemente con transparencia) sobre un color de fondo opaco.
// Satori NO rasteriza de forma fiable los PNG con canal alfa: los inserta en el
// árbol pero los pinta vacíos. Para evitarlo, decodificamos el PNG con upng-js
// (JS puro, sin binarios nativos -> seguro en Vercel), componemos el alfa sobre
// el color de fondo de la slide (así el "recuadro" del logo se funde con el
// fondo) y re-codificamos un PNG totalmente opaco que Satori sí pinta.
function flattenPngOverBg(pngBuf: Buffer, bgHex: string): Buffer {
  const dec = UPNG.decode(pngBuf);
  const rgba = new Uint8Array(UPNG.toRGBA8(dec)[0]);
  const [br, bg, bb] = hexToRgbTuple(bgHex);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255;
    rgba[i] = Math.round(rgba[i] * a + br * (1 - a));
    rgba[i + 1] = Math.round(rgba[i + 1] * a + bg * (1 - a));
    rgba[i + 2] = Math.round(rgba[i + 2] * a + bb * (1 - a));
    rgba[i + 3] = 255;
  }
  const out = UPNG.encode([rgba.buffer], dec.width, dec.height, 0); // 0 = lossless RGBA
  return Buffer.from(out);
}

async function fetchLogoDataUri(url: string, bgHex: string): Promise<string | null> {
  const cacheKey = url + '|' + bgHex; // el aplanado depende del fondo
  const cached = logoCache.get(cacheKey);
  if (cached !== undefined) return cached || null;
  try {
    const r = await fetch(url);
    if (!r.ok) { logoCache.set(cacheKey, ''); return null; }
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const urlPath = url.split('?')[0].toLowerCase();
    const isSvg = ct.includes('svg') || urlPath.endsWith('.svg');
    const isWebp = ct.includes('webp') || urlPath.endsWith('.webp');
    if (isWebp) { logoCache.set(cacheKey, ''); return null; } // webp no fiable en Satori
    const buf = Buffer.from(await r.arrayBuffer());
    if (isSvg) {
      // SVG no sufre el problema de alfa de Satori; se pasa tal cual.
      const dataUri = `data:image/svg+xml;base64,${buf.toString('base64')}`;
      logoCache.set(cacheKey, dataUri);
      return dataUri;
    }
    // PNG/JPEG: aplanar sobre el fondo para garantizar opacidad (Satori).
    let outBuf = buf;
    try { outBuf = flattenPngOverBg(buf, bgHex); }
    catch { outBuf = buf; } // si upng falla, usar el original (mejor que nada)
    const dataUri = `data:image/png;base64,${outBuf.toString('base64')}`;
    logoCache.set(cacheKey, dataUri);
    return dataUri;
  } catch { logoCache.set(cacheKey, ''); return null; }
}

// Detecta el color de fondo REAL del div raíz del HTML ya resuelto (los tokens
// ya son hex). Los esqueletos usan background:#xxxxxx en el primer div; la
// mayoría es --bg pero algunos estilos "invertidos" (p.ej. retro_warm) usan
// --accent. Aplanar el logo sobre ESTE color evita el recuadro blanco.
function detectRootBg(resolvedHtml: string, fallback: string): string {
  const m = resolvedHtml.match(/<div[^>]*background:\s*(#[0-9a-fA-F]{3,8})/);
  return m ? m[1] : fallback;
}

// ── Fondo fotográfico con velo adaptativo (2026-08-19) ──────────────
// body.background_image = { url }. Lo resuelve n8n (foto real de
// brand_media_library o, en el futuro, imagen generada). La foto se pinta
// DEBAJO de todo el contenido y encima va un VELO cuyo color depende del
// color REAL del texto del estilo (tokens ya derivados):
//   texto oscuro  -> velo blanco degradado (foto lavada, texto tinta)
//   texto claro   -> velo oscuro degradado (foto en sombra, texto claro)
// Así el contraste queda garantizado por construcción para CUALQUIER foto,
// sin calcular luminancia por imagen. El degradado deja respirar la foto en
// la parte alta y protege la zona de texto (centro/abajo en los esqueletos
// de quote/stat).
const photoCache: Map<string, string> = new Map();

async function fetchPhotoDataUri(url: string): Promise<string | null> {
  const cached = photoCache.get(url);
  if (cached !== undefined) return cached || null;
  try {
    const r = await fetch(url);
    if (!r.ok) { photoCache.set(url, ''); return null; }
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const urlPath = url.split('?')[0].toLowerCase();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) { photoCache.set(url, ''); return null; } // >8MB: no
    // webp no es fiable en Satori (mismo criterio que el logo)
    if (ct.includes('webp') || urlPath.endsWith('.webp')) { photoCache.set(url, ''); return null; }
    const isPng = ct.includes('png') || urlPath.endsWith('.png');
    let outBuf = buf;
    let mime = 'image/jpeg';
    if (isPng) {
      // PNG puede traer alfa, que Satori no rasteriza bien: aplanar sobre blanco.
      mime = 'image/png';
      try { outBuf = flattenPngOverBg(buf, '#FFFFFF'); } catch { outBuf = buf; }
    }
    const dataUri = `data:${mime};base64,${outBuf.toString('base64')}`;
    photoCache.set(url, dataUri);
    return dataUri;
  } catch { photoCache.set(url, ''); return null; }
}

function injectPhotoBackground(
  resolvedHtml: string,
  dataUri: string,
  tokens: Tokens,
  w: number,
  h: number
): { html: string; status: string } {
  const m = resolvedHtml.match(/<div[^>]*>/);
  if (!m) return { html: resolvedHtml, status: 'skip_no_root_div' };
  // El velo se decide por el color REAL del texto del estilo (no por variant):
  // cubre marcas con texto de color propio. Texto oscuro -> velo blanco.
  const ink = tokens['--text-title'] || '#1A1A1A';
  const darkText = contrast(ink, '#FFFFFF') >= contrast(ink, '#1A1A1A');
  const veil = darkText
    ? 'linear-gradient(to top, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.82) 55%, rgba(255,255,255,0.60) 100%)'
    : 'linear-gradient(to top, rgba(12,10,9,0.88) 0%, rgba(12,10,9,0.68) 55%, rgba(12,10,9,0.40) 100%)';
  // Restricciones Satori: dims explícitas en el <img> (nada de width:auto) y
  // contenedores absolute con width fija (no left+right).
  const block =
    '<div style="position:absolute;top:0;left:0;width:' + w + 'px;height:' + h + 'px;display:flex;">' +
    '<img src="' + dataUri + '" width="' + w + '" height="' + h + '" style="display:flex;width:' + w + 'px;height:' + h + 'px;object-fit:cover;" />' +
    '</div>' +
    '<div style="position:absolute;top:0;left:0;width:' + w + 'px;height:' + h + 'px;display:flex;background:' + veil + ';"></div>';
  const insertAt = (m.index || 0) + m[0].length;
  return {
    html: resolvedHtml.slice(0, insertAt) + block + resolvedHtml.slice(insertAt),
    status: darkText ? 'inserted_light_veil' : 'inserted_dark_veil',
  };
}

// Cuando vamos a poner el logo en la cta, el {{brand_name}} en texto que el
// esqueleto pinta arriba sobra (duplicaría la marca). Vaciamos el contenido del
// <span> que contiene {{brand_name}} (se hace sobre el skeleton CRUDO, antes de
// resolver el marcador). Mantener el <span> vacío preserva el layout flex.
function stripBrandNameSpan(skeletonHtml: string): string {
  return skeletonHtml.replace(/(<span[^>]*>)([^<]*\{\{brand_name\}\}[^<]*)(<\/span>)/g, '$1$3');
}

async function injectCtaLogo(resolvedHtml: string, opts: { skeletonId: string; variant: string; logoUrl?: string | null; fallbackBg: string }): Promise<{ html: string; status: string }> {
  const { skeletonId, variant, logoUrl, fallbackBg } = opts;
  const isCta = typeof skeletonId === 'string' && /_cta$/.test(skeletonId);
  if (!isCta) return { html: resolvedHtml, status: 'skip_not_cta' };
  if (variant === 'dark') return { html: resolvedHtml, status: 'skip_dark_variant' };
  if (!logoUrl) return { html: resolvedHtml, status: 'skip_no_logo_url' };
  // Aplanar el logo sobre el fondo REAL de esta slide (no un color asumido).
  const bgHex = detectRootBg(resolvedHtml, fallbackBg);
  const dataUri = await fetchLogoDataUri(logoUrl, bgHex);
  if (!dataUri) return { html: resolvedHtml, status: 'skip_logo_fetch_failed' }; // descarga falló -> nombre en texto
  // Ver restricciones de Satori arriba: left:0;width:1080px y <img> con dims fijas.
  const logoBlock =
    '<div style="position:absolute;top:56px;left:0;width:1080px;display:flex;flex-direction:row;justify-content:center;align-items:center;">' +
    '<img src="' + dataUri + '" width="360" height="96" style="display:flex;width:360px;height:96px;object-fit:contain;" />' +
    '</div>';
  const m = resolvedHtml.match(/<div[^>]*>/);
  if (!m) return { html: resolvedHtml, status: 'skip_no_root_div' };
  const insertAt = (m.index || 0) + m[0].length;
  return { html: resolvedHtml.slice(0, insertAt) + logoBlock + resolvedHtml.slice(insertAt), status: 'inserted' };
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
    // 2a. Si esta slide es cta, light y la marca tiene logo, el logo sustituirá
    //     al nombre en texto: lo vaciamos del esqueleto para no duplicar marca.
    const skeletonMeta = body?.meta?.skeleton_id || '';
    const willInsertLogo = /_cta$/.test(skeletonMeta) && variant !== 'dark' && !!(body?.brand?.logo_url);
    const baseSkeleton = willInsertLogo ? stripBrandNameSpan(skeletonHtml) : skeletonHtml;
    let resolvedHtml = fillTemplate(baseSkeleton, fields, tokens);
    // 2b. Si es un stat sin número, colapsar el hueco del número gigante.
    resolvedHtml = dropEmptyStatNumber(resolvedHtml, fields);
    // 2b-bis. bold_statement_cover: ajustar tamaño del título para que no se
    //         salga del lienzo con títulos largos.
    resolvedHtml = fitBoldStatementTitle(resolvedHtml, skeletonMeta, (fields as any)?.title);
    // 2c. Logo de marca en la slide de cierre (cta), si procede.
    const logoResult = await injectCtaLogo(resolvedHtml, {
      skeletonId: skeletonMeta,
      variant,
      logoUrl: body?.brand?.logo_url || null,
      fallbackBg: tokens['--bg'] || '#F4F1EA',
    });
    resolvedHtml = logoResult.html;

    // 2d. Fondo fotográfico con velo adaptativo (si n8n lo pide).
    let backgroundStatus = 'none';
    const backgroundImage = (body?.background_image && typeof body.background_image === 'object' && body.background_image.url)
      ? { url: String(body.background_image.url) }
      : null;
    if (backgroundImage) {
      const photoUri = await fetchPhotoDataUri(backgroundImage.url);
      if (photoUri) {
        const bgResult = injectPhotoBackground(resolvedHtml, photoUri, tokens, width, height);
        resolvedHtml = bgResult.html;
        backgroundStatus = bgResult.status;
      } else {
        backgroundStatus = 'skip_fetch_failed'; // se renderiza plano: nunca rompe
      }
    }

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
      logo_status: logoResult.status,    // diagnóstico: inserted | skip_* (por qué no se puso el logo)
      background_status: backgroundStatus, // fondo foto: none | inserted_light_veil | inserted_dark_veil | skip_*
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
