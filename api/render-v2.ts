// /api/render-v2.ts — Endpoint del motor v2 (9 estilos, sep 2026).
// Mismo contrato que /api/render-html (lo llama n8n), para esqueletos v2
// (<div data-engine="v2" ...>). Campos extra opcionales:
//   brand.color_accent, brand.logo_url_dark, background_image.text_zone ('top'|'bottom'),
//   meta.enum_index (nº de punto en slides enum).
// Foto: si el esqueleto es una variante de foto (lleva capa {{photo_url}}), la zona de texto
// se funde con el fondo (lib/v2.ts). Si NO lo es (cita, dato, lista... con foto), se pone una
// CORTINA uniforme del color de fondo del estilo sobre toda la foto: se intuye la imagen y el
// texto, esté donde esté, se lee siempre.
// Toda la lógica de presentación vive en lib/v2.ts.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { html as toVNode } from 'satori-html';
import { buildV2, isV2 } from '../lib/v2.js';
import { loadFontsV2 } from '../lib/v2-fonts.js';
import { loadLogoV2, fetchPhotoV2, layoutPhotoV2, compositeOverPhotoV2, type DecodedPhoto } from '../lib/v2-media.js';

const CURTAIN_ALPHA = 0.8;

// Zona de texto de una variante de foto. Manda SIEMPRE el esqueleto: en todas las variantes
// *_photo_top la caja de texto que sigue a la capa {{photo_url}} empieza en top:0px; en las
// *_photo_bottom empieza más abajo (top:590/630px). El text_zone que manda n8n solo se usa si
// el esqueleto no permite deducirlo.
// 2026-10-15: antes se asumía 'bottom' y en las variantes de arriba el fundido caía abajo.
// 2026-10-29: si el estilo no tiene variante para la zona pedida (suizo solo tiene abajo,
// editorial solo arriba), n8n usaba el esqueleto disponible pero mandaba la zona pedida, y el
// fundido quedaba en el lado contrario al texto. Ahora el esqueleto tiene prioridad.
function resolveTextZone(html: string, explicit: unknown): 'top' | 'bottom' {
  const m = html.match(/url\(\{\{photo_url\}\}\)[^>]*><\/div><div style="[^"]*?(?:^|;)\s*top:\s*(\d+)px/);
  if (m) return parseInt(m[1], 10) < 300 ? 'top' : 'bottom';
  if (explicit === 'top' || explicit === 'bottom') return explicit;
  return 'bottom';
}

// 2026-11-11: lib/v2.ts escapa los campos al montar el HTML (& -> &amp;, < -> &lt;...)
// para no romper el parseo, pero satori-html deja las entidades tal cual en los nodos de
// texto y Satori las pintaba literales ("S&amp;G Nail Madrid"). Se decodifican aquí, en
// los textos ya parseados (no en atributos), así que no hay riesgo de reinterpretar HTML.
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s: string): string {
  if (!s || s.indexOf('&') === -1) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m: string, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    const v = NAMED_ENTITIES[e.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

function normalizeFlex(node: any): any {
  if (!node || typeof node !== 'object') return node;
  if (node.props && typeof node.props.children === 'string') node.props.children = decodeEntities(node.props.children);
  else if (node.props && Array.isArray(node.props.children)) node.props.children = node.props.children.map((k: any) => (typeof k === 'string' ? decodeEntities(k) : k));
  const kids = node.props?.children; const arr = Array.isArray(kids) ? kids : (kids != null ? [kids] : []);
  if (node.type === 'div') {
    node.props = node.props || {}; node.props.style = node.props.style || {};
    if (node.props.style.display == null) node.props.style.display = 'flex';
    if (node.props.style.display === 'flex' && node.props.style.flexDirection == null) node.props.style.flexDirection = 'column';
  }
  arr.forEach(normalizeFlex); return node;
}

export default async function handler(req: any, res: any) {
  const t0 = Date.now();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const html: string = body?.skeleton_html;
    if (!html || !isV2(html)) return res.status(400).json({ success: false, error: 'skeleton_html v2 requerido' });
    const width = body?.output?.width || 1080, height = body?.output?.height || 1350;
    const brand = body?.brand || {};
    const fontHeading: string = brand.font_heading || 'Inter';
    const fontBody: string = brand.font_body || fontHeading;
    const fonts = await loadFontsV2([fontHeading, fontBody]);

    let photo: DecodedPhoto | null = null; let photoRgba: Uint8Array | null = null; let backgroundStatus = 'none';
    const bgi = body?.background_image && body.background_image.url ? body.background_image : null;
    if (bgi) { photo = await fetchPhotoV2(String(bgi.url)); backgroundStatus = photo ? 'photo' : 'skip_fetch_failed'; }
    const isPhotoVariant = html.includes('{{photo_url}}');
    const zone = resolveTextZone(html, bgi?.text_zone);
    // 2026-11-07: si la foto no se pudo cargar, se quita la capa {{photo_url}} y la slide sale
    // plana (antes satori fallaba con "Image source is not provided" y se perdía la slide).
    const srcHtml = (!photo && isPhotoVariant) ? html.replace(/<div style="[^"]*url\(\{\{photo_url\}\}\)[^"]*"><\/div>/, '') : html;

    const v2 = await buildV2({
      html: srcHtml, fields: body?.fields || {}, brand, fonts, fontHeading, fontBody,
      slideNumber: body?.meta?.slide_number, enumIndex: body?.meta?.enum_index ?? null,
      photo: photo ? { zone } : null,
      loadLogo: loadLogoV2,
    });
    if (photo) photoRgba = layoutPhotoV2(photo, width, height, { zone: isPhotoVariant ? zone : null, bgHex: v2.bgHex });
    let outHtml = v2.html;
    if (photoRgba && !isPhotoVariant) {
      // Cortina uniforme: sustituye el fundido por zona por un velo del color de fondo.
      outHtml = outHtml.replace(/linear-gradient\(to (?:top|bottom), rgba\((\d+),(\d+),(\d+),1\) 0%, rgba\(\d+,\d+,\d+,0\.96\) 34%, rgba\(\d+,\d+,\d+,0\) 62%\)/,
        (m: string, r: string, g: string, b: string) => `rgba(${r},${g},${b},${CURTAIN_ALPHA})`);
      backgroundStatus = 'curtain';
    }
    const svg = await satori(normalizeFlex(toVNode(outHtml)) as any, { width, height, fonts: fonts as any });
    let png: Buffer = Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng());
    if (photoRgba) { try { png = compositeOverPhotoV2(png, photoRgba, width, height); backgroundStatus += '_composited'; } catch { backgroundStatus = 'skip_composite_failed'; } }
    return res.status(200).json({
      success: true, image_base64: png.toString('base64'), engine: 'v2',
      resolved_tokens: v2.tokens, logo_status: v2.logoStatus, background_status: backgroundStatus,
      dimensions: { width, height }, meta: body?.meta || null, render_time_ms: Date.now() - t0,
    });
  } catch (error) {
    console.error('[render-v2] error:', error);
    return res.status(500).json({ success: false, error: 'Render failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
}
