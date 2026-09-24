// /lib/v2-media.ts — Logo y foto de fondo para el motor v2 (mismo método probado que
// render-html.ts: logo aplanado sobre el fondo real; foto decodificada y compuesta a
// nivel de píxel para no meter data URIs enormes en Satori).
import UPNG from 'upng-js';
import * as JPEG from 'jpeg-js';
import { imageDims } from './v2.js';

const hexRgb = (hex: string): [number, number, number] => { let h = (hex || '').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); if (!/^[0-9a-fA-F]{6}$/.test(h)) return [255, 255, 255]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const logoCache: Map<string, { uri: string; w: number; h: number } | null> = new Map();

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
      let uri = '';
      if (isSvg) uri = 'data:image/svg+xml;base64,' + buf.toString('base64');
      else if (isPng) {
        const dec = UPNG.decode(buf); const rgba = new Uint8Array(UPNG.toRGBA8(dec)[0]); const [br, bg, bb] = hexRgb(bgHex);
        for (let i = 0; i < rgba.length; i += 4) { const a = rgba[i + 3] / 255; rgba[i] = Math.round(rgba[i] * a + br * (1 - a)); rgba[i + 1] = Math.round(rgba[i + 1] * a + bg * (1 - a)); rgba[i + 2] = Math.round(rgba[i + 2] * a + bb * (1 - a)); rgba[i + 3] = 255; }
        uri = 'data:image/png;base64,' + Buffer.from(UPNG.encode([rgba.buffer], dec.width, dec.height, 0)).toString('base64');
      } else if (isJpg) uri = 'data:image/jpeg;base64,' + buf.toString('base64');
      if (uri) { const d = imageDims(uri); if (d) res = { uri, ...d }; }
    }
  } catch { res = null; }
  logoCache.set(key, res);
  return res;
}

export async function fetchPhotoRgbaV2(url: string, dw: number, dh: number): Promise<Uint8Array | null> {
  try {
    const r = await fetch(url); if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 8 * 1024 * 1024 || buf.length < 12) return null;
    let rgba: Uint8Array, sw: number, sh: number;
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) { const d = UPNG.decode(buf); rgba = new Uint8Array(UPNG.toRGBA8(d)[0]); sw = d.width; sh = d.height; }
    else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) { const d = JPEG.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 512 } as any); rgba = d.data as Uint8Array; sw = d.width; sh = d.height; }
    else return null;
    const scale = Math.max(dw / sw, dh / sh), ox = (sw - dw / scale) / 2, oy = (sh - dh / scale) / 2;
    const out = new Uint8Array(dw * dh * 4);
    for (let y = 0; y < dh; y++) { const sy = Math.min(sh - 1, Math.max(0, Math.floor(oy + (y + 0.5) / scale))); for (let x = 0; x < dw; x++) { const sx = Math.min(sw - 1, Math.max(0, Math.floor(ox + (x + 0.5) / scale))); const si = (sy * sw + sx) * 4, di = (y * dw + x) * 4; out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = 255; } }
    return out;
  } catch { return null; }
}

export function compositeOverPhotoV2(slidePng: Buffer, photo: Uint8Array, dw: number, dh: number): Buffer {
  const dec = UPNG.decode(slidePng); const fg = new Uint8Array(UPNG.toRGBA8(dec)[0]);
  if (dec.width !== dw || dec.height !== dh) return slidePng;
  for (let i = 0; i < fg.length; i += 4) { const a = fg[i + 3] / 255; photo[i] = Math.round(fg[i] * a + photo[i] * (1 - a)); photo[i + 1] = Math.round(fg[i + 1] * a + photo[i + 1] * (1 - a)); photo[i + 2] = Math.round(fg[i + 2] * a + photo[i + 2] * (1 - a)); photo[i + 3] = 255; }
  return Buffer.from(UPNG.encode([photo.buffer as ArrayBuffer], dw, dh, 0));
}
