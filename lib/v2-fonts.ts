// /lib/v2-fonts.ts — Fuentes de marca para el motor v2.
// A diferencia de skeleton-fonts.ts (pide 400-800 en una sola petición), aquí se pide
// CADA peso y cada cursiva por separado: si una familia no tiene un peso, Google
// responde error solo para esa variante y el resto se carga igual. Así llegan las
// cursivas (palabra destacada, subtítulos) y los pesos 300/900 cuando existen.
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { SatoriFont } from './v2.js';

const TTF_UA = 'Mozilla/5.0 (Linux; U; Android 2.3.6; en-us; Nexus S Build/GRK39F) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';
const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
const cache: Map<string, SatoriFont | null> = new Map();

function isValidFont(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf[0] === 0x00 && buf[1] === 0x01 && buf[2] === 0x00 && buf[3] === 0x00) return true;
  const a = buf.subarray(0, 4).toString('ascii');
  return a === 'OTTO' || a === 'ttcf' || a === 'true';
}

async function fetchVariant(family: string, weight: number, italic: boolean): Promise<SatoriFont | null> {
  const key = family + '|' + weight + '|' + (italic ? 1 : 0);
  if (cache.has(key)) return cache.get(key) || null;
  let out: SatoriFont | null = null;
  try {
    const url = 'https://fonts.googleapis.com/css2?family=' + family.replace(/ /g, '+') + ':ital,wght@' + (italic ? 1 : 0) + ',' + weight + '&display=swap';
    const r = await fetch(url, { headers: { 'User-Agent': TTF_UA } });
    if (r.ok) {
      const css = await r.text();
      const u = css.match(/url\((https:\/\/[^)]+\.ttf)\)/);
      if (u) {
        const fr = await fetch(u[1]);
        if (fr.ok) { const buf = Buffer.from(await fr.arrayBuffer()); if (isValidFont(buf)) out = { name: family, data: buf, weight, style: italic ? 'italic' : 'normal' }; }
      }
    }
  } catch { out = null; }
  cache.set(key, out);
  return out;
}

function interFallback(): SatoriFont[] {
  const out: SatoriFont[] = [];
  for (const [file, weight] of [['Inter-Regular.ttf', 400], ['Inter-Bold.ttf', 700]] as Array<[string, number]>) {
    try { const p = join(process.cwd(), 'fonts', file); if (existsSync(p)) { const buf = readFileSync(p); if (isValidFont(buf)) out.push({ name: 'Inter', data: buf, weight, style: 'normal' }); } } catch { /* nada */ }
  }
  return out;
}

export async function loadFontsV2(families: string[]): Promise<SatoriFont[]> {
  const uniq = Array.from(new Set(families.filter(Boolean)));
  const jobs: Promise<SatoriFont | null>[] = [];
  for (const f of uniq) for (const w of WEIGHTS) for (const it of [false, true]) jobs.push(fetchVariant(f, w, it));
  const fonts = (await Promise.all(jobs)).filter((x): x is SatoriFont => !!x);
  fonts.push(...interFallback());
  if (!fonts.length) throw new Error('[v2-fonts] No se pudo cargar ninguna fuente');
  return fonts;
}
