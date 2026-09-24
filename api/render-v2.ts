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
import { loadLogoV2, fetchPhotoRgbaV2, compositeOverPhotoV2 } from '../lib/v2-media.js';

const CURTAIN_ALPHA = 0.8;

function normalizeFlex(node: any): any {
  if (!node || typeof node !== 'object') return node;
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

    let photoRgba: Uint8Array | null = null; let backgroundStatus = 'none';
    const bgi = body?.background_image && body.background_image.url ? body.background_image : null;
    if (bgi) { photoRgba = await fetchPhotoRgbaV2(String(bgi.url), width, height); backgroundStatus = photoRgba ? 'photo' : 'skip_fetch_failed'; }
    const isPhotoVariant = html.includes('{{photo_url}}');

    const v2 = await buildV2({
      html, fields: body?.fields || {}, brand, fonts, fontHeading, fontBody,
      slideNumber: body?.meta?.slide_number, enumIndex: body?.meta?.enum_index ?? null,
      photo: photoRgba ? { zone: bgi?.text_zone || null } : null,
      loadLogo: loadLogoV2,
    });
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
