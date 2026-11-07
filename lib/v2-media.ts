// /lib/v2-media.ts — Logo y foto de fondo para el motor v2 (mismo método probado que
// render-html.ts: logo aplanado sobre el fondo real; foto decodificada y compuesta a
// nivel de píxel para no meter data URIs enormes en Satori).
// 2026-09-24: el logo se RECORTA a su contenido (fuera márgenes transparentes o del
// color de fondo del propio fichero) y se REDUCE a 240 px de alto como máximo antes de
// incrustarlo: con logos de miles de píxeles el data URI era enorme y satori-html se
// colgaba (>60 s, la slide fallaba).
import UPNG from 'upng-js';
import * as JPEG from 'jpeg-js';
import { imageDims } from './v2.js';

const LOGO_MAX_H = 240, LOGO_MAX_W = 1200;
const hexRgb = (hex: string): [number, number, number] => { let h = (hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); if (!/^[0-9a-fA-F]{6}$/.test(h)) return [255, 255, 255]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const logoCache: Map<string, { uri: string; w: number; h: number } | null> = new Map();

function cropToContent(rgba: Uint8Array, w: number, h: number): { data: Uint8Array; w: number; h: number } {
  const cr = rgba[0], cg = rgba[1], cb = rgba[2], ca = rgba[3];
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; const a = rgba[i + 3];
    if (a <= 16) continue;
    if (ca > 200 && Math.abs(rgba[i] - cr) + Math.abs(rgba[i + 1] - cg) + Math.abs(rgba[i + 2] - cb) < 30) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return { data: rgba, w, h };
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1; const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) out.set(rgba.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + nw) * 4), y * nw * 4);
  return { data: out, w: nw, h: nh };
}

// Reducción por promedio de caja (buena calidad para logos, sin dependencias).
function downscale(src: Uint8Array, w: number, h: number): { data: Uint8Array; w: number; h: number } {
  const s = Math.min(1, LOGO_MAX_H / h, LOGO_MAX_W / w);
  if (s >= 1) return { data: src, w, h };
  const nw = Math.max(1, Math.round(w * s)), nh = Math.max(1, Math.round(h * s)); const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const sy0 = Math.floor(y / s), sy1 = Math.min(h, Math.floor((y + 1) / s));
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.floor(x / s), sx1 = Math.min(w, Math.floor((x + 1) / s));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = sy0; yy < Math.max(sy1, sy0 + 1); yy++) for (let xx = sx0; xx < Math.max(sx1, sx0 + 1); xx++) { const i = (yy * w + xx) * 4; const al = src[i + 3]; r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++; }
      const o = (y * nw + x) * 4; out[o] = a ? r / a : 0; out[o + 1] = a ? g / a : 0; out[o + 2] = a ? b / a : 0; out[o + 3] = a / n;
    }
  }
  return { data: out, w: nw, h: nh };
}

export async function loadLogoV2(url: string, bgHex: string): Promise<{ uri: string; w: number; h: number } | null> {
  const key = url + '|' + bgHex;
  if (logoCache.has(key)) return logoCache.get(key) || null;
  let res: { uri: string; w: number; h: number } | null = null;
  try {
    const r = await fetch(url);
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
      const isSvg = !isPng && !isJpg && /<svg/i.test(buf.subarray(0, 512).toString('utf8'));
      if (isSvg) { if (buf.length < 400 * 1024) { const uri = 'data:image/svg+xml;base64,' + buf.toString('base64'); const d = imageDims(uri); if (d) res = { uri, ...d }; } }
      else if (isPng || isJpg) {
        let rgba: Uint8Array, w: number, h: number;
        if (isPng) { const dec = UPNG.decode(buf); rgba = new Uint8Array(UPNG.toRGBA8(dec)[0]); w = dec.width; h = dec.height; }
        else { const dec = JPEG.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 } as any); rgba = dec.data as Uint8Array; w = dec.width; h = dec.height; }
        const c0 = cropToContent(rgba, w, h); const c = downscale(c0.data, c0.w, c0.h);
        const [br, bg, bb] = hexRgb(bgHex); const d = c.data;
        for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; d[i] = Math.round(d[i] * a + br * (1 - a)); d[i + 1] = Math.round(d[i + 1] * a + bg * (1 - a)); d[i + 2] = Math.round(d[i + 2] * a + bb * (1 - a)); d[i + 3] = 255; }
        const uri = 'data:image/png;base64,' + Buffer.from(UPNG.encode([d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength)], c.w, c.h, 0)).toString('base64');
        res = { uri, w: c.w, h: c.h };
      }
    }
  } catch { res = null; }
  logoCache.set(key, res);
  return res;
}

// ── Foto de fondo ────────────────────────────────────────────────────
// 2026-11-07: además de PNG y JPEG, se decodifican WebP, GIF, AVIF y TIFF con sharp
// (import dinámico: si sharp no carga, PNG/JPEG siguen funcionando como antes). Antes una
// foto .webp de la biblioteca devolvía null y la slide fallaba ("Image source is not
// provided"): Mevak tenía 26 de 42 fotos en .webp.
export interface DecodedPhoto { rgba: Uint8Array; w: number; h: number }

let sharpMod: any = undefined;
async function loadSharp(): Promise<any> {
  if (sharpMod !== undefined) return sharpMod;
  try { const m: any = await import('sharp'); sharpMod = m.default || m; } catch (e) { console.error('[v2-media] sharp no disponible:', e); sharpMod = null; }
  return sharpMod;
}

export async function decodePhotoV2(buf: Buffer): Promise<DecodedPhoto | null> {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) { const d = UPNG.decode(buf); return { rgba: new Uint8Array(UPNG.toRGBA8(d)[0]), w: d.width, h: d.height }; }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) { const d = JPEG.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 } as any); return { rgba: d.data as Uint8Array, w: d.width, h: d.height }; }
  const sharp = await loadSharp();
  if (!sharp) return null;
  // Se limita a 2400 px de lado para no disparar memoria; de sobra para 1080x1350.
  const { data, info } = await sharp(buf, { animated: false, limitInputPixels: 80_000_000 }).rotate()
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), w: info.width, h: info.height };
}

export async function fetchPhotoV2(url: string): Promise<DecodedPhoto | null> {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 15 * 1024 * 1024) return null;
    return await decodePhotoV2(buf);
  } catch (e) { console.error('[v2-media] foto no decodificada:', url, e); return null; }
}

const hexToRgb = (hex: string): [number, number, number] => hexRgb(hex);

// Encaja la foto en el lienzo.
// - Sin zona de texto (cortina) o foto vertical/cuadrada: "cover" centrado, como antes.
// - Foto horizontal en una variante de foto: antes se recortaba al centro a 4:5 y se perdía
//   ~40 % del ancho. Ahora la foto ocupa solo la parte del lienzo que queda fuera del bloque
//   de texto (68 % del alto, pegada al lado contrario del texto) y el resto se rellena con el
//   color de fondo del estilo, que queda bajo el fundido opaco: no se nota la costura y se ve
//   casi toda la foto.
export function layoutPhotoV2(src: DecodedPhoto, dw: number, dh: number, opts: { zone: 'top' | 'bottom' | null; bgHex: string }): Uint8Array {
  const out = new Uint8Array(dw * dh * 4);
  const [br, bg, bb] = hexToRgb(opts.bgHex);
  for (let i = 0; i < out.length; i += 4) { out[i] = br; out[i + 1] = bg; out[i + 2] = bb; out[i + 3] = 255; }
  const { rgba, w: sw, h: sh } = src;
  const landscape = sw / sh > (dw / dh) * 1.15;
  let rx = 0, ry = 0, rw = dw, rh = dh; // región del lienzo que ocupa la foto
  if (opts.zone && landscape) {
    rh = Math.round(dh * 0.68);
    ry = opts.zone === 'bottom' ? 0 : dh - rh;
  }
  const scale = Math.max(rw / sw, rh / sh), ox = (sw - rw / scale) / 2, oy = (sh - rh / scale) / 2;
  for (let y = 0; y < rh; y++) {
    const sy = Math.min(sh - 1, Math.max(0, Math.floor(oy + (y + 0.5) / scale)));
    for (let x = 0; x < rw; x++) {
      const sx = Math.min(sw - 1, Math.max(0, Math.floor(ox + (x + 0.5) / scale)));
      const si = (sy * sw + sx) * 4, di = ((y + ry) * dw + (x + rx)) * 4; const a = rgba[si + 3] / 255;
      out[di] = Math.round(rgba[si] * a + br * (1 - a)); out[di + 1] = Math.round(rgba[si + 1] * a + bg * (1 - a)); out[di + 2] = Math.round(rgba[si + 2] * a + bb * (1 - a)); out[di + 3] = 255;
    }
  }
  return out;
}

export function compositeOverPhotoV2(slidePng: Buffer, photo: Uint8Array, dw: number, dh: number): Buffer {
  const dec = UPNG.decode(slidePng); const fg = new Uint8Array(UPNG.toRGBA8(dec)[0]);
  if (dec.width !== dw || dec.height !== dh) return slidePng;
  for (let i = 0; i < fg.length; i += 4) { const a = fg[i + 3] / 255; photo[i] = Math.round(fg[i] * a + photo[i] * (1 - a)); photo[i + 1] = Math.round(fg[i + 1] * a + photo[i + 1] * (1 - a)); photo[i + 2] = Math.round(fg[i + 2] * a + photo[i + 2] * (1 - a)); photo[i + 3] = 255; }
  return Buffer.from(UPNG.encode([photo.buffer as ArrayBuffer], dw, dh, 0));
}
