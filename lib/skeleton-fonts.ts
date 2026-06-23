// /lib/skeleton-fonts.ts
// Carga en runtime las fuentes de la MARCA desde Google Fonts (TTF estático),
// con cacheo en memoria y fallback a Inter. Generaliza la lógica de
// lib/recipes/fonts.ts para aceptar CUALQUIER familia (no un registro fijo).
//
// El truco del User-Agent viejo de Android fuerza a Google Fonts a servir TTF
// (no woff2), que es lo que Satori 0.10 necesita. Se parsea cada @font-face que
// lleve una url .ttf. Inter (committed en /fonts/) es el fallback garantizado.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface SatoriFont {
  name: string;
  data: Buffer;
  weight: number;
  style: 'normal' | 'italic';
}

const TTF_UA =
  'Mozilla/5.0 (Linux; U; Android 2.3.6; en-us; Nexus S Build/GRK39F) ' +
  'AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';

// Pesos por defecto que pedimos para una familia de marca arbitraria.
const DEFAULT_WEIGHTS = [400, 500, 600, 700, 800];

function isValidFont(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const s = buf.subarray(0, 4);
  if (s[0] === 0x00 && s[1] === 0x01 && s[2] === 0x00 && s[3] === 0x00) return true; // TrueType
  const a = s.toString('ascii');
  return a === 'OTTO' || a === 'ttcf' || a === 'true' || a === 'typ1';
}

function css2Url(family: string, weights: number[]): string {
  const fam = family.replace(/ /g, '+');
  return 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@' + weights.join(';') + '&display=swap';
}

const familyCache: Map<string, SatoriFont[]> = new Map();

async function fetchFamily(family: string, weights: number[]): Promise<SatoriFont[]> {
  const cacheKey = family + '|' + weights.join(',');
  const cached = familyCache.get(cacheKey);
  if (cached) return cached;

  const out: SatoriFont[] = [];
  try {
    const cssRes = await fetch(css2Url(family, weights), { headers: { 'User-Agent': TTF_UA } });
    if (!cssRes.ok) { familyCache.set(cacheKey, []); return []; }
    const css = await cssRes.text();

    const faceRe = /@font-face\s*\{([^}]+)\}/g;
    const seen = new Set<string>();
    const jobs: Promise<void>[] = [];
    let m: RegExpExecArray | null;
    while ((m = faceRe.exec(css)) !== null) {
      const body = m[1];
      const uM = body.match(/url\((https:\/\/[^)]+\.ttf)\)/);
      if (!uM) continue;
      const wM = body.match(/font-weight:\s*(\d+)/);
      const sM = body.match(/font-style:\s*(\w+)/);
      const weight = wM ? parseInt(wM[1], 10) : 400;
      const style: 'normal' | 'italic' = sM && sM[1] === 'italic' ? 'italic' : 'normal';
      const key = weight + '-' + style;
      if (seen.has(key)) continue;
      seen.add(key);
      const url = uM[1];
      jobs.push((async () => {
        try {
          const r = await fetch(url);
          if (!r.ok) return;
          const buf = Buffer.from(await r.arrayBuffer());
          if (isValidFont(buf)) out.push({ name: family, data: buf, weight, style });
        } catch { /* skip weight */ }
      })());
    }
    await Promise.all(jobs);
  } catch { /* family fetch failed -> fallback */ }

  familyCache.set(cacheKey, out);
  return out;
}

function loadInterFallback(): SatoriFont[] {
  const out: SatoriFont[] = [];
  const files: Array<[string, number]> = [['Inter-Regular.ttf', 400], ['Inter-Bold.ttf', 700]];
  for (const [file, weight] of files) {
    try {
      const p = join(process.cwd(), 'fonts', file);
      if (existsSync(p)) {
        const buf = readFileSync(p);
        if (isValidFont(buf)) out.push({ name: 'Inter', data: buf, weight, style: 'normal' });
      }
    } catch { /* skip */ }
  }
  return out;
}

// Carga las familias pedidas (heading + body de la marca), más Inter de fallback.
// Familias vacías o que fallen se ignoran; Satori usará Inter en su lugar.
export async function loadBrandFonts(families: string[]): Promise<SatoriFont[]> {
  const uniq = Array.from(new Set(families.filter(Boolean)));
  const results = await Promise.all(uniq.map((f) => fetchFamily(f, DEFAULT_WEIGHTS)));
  const fonts: SatoriFont[] = results.flat();
  fonts.push(...loadInterFallback());
  if (fonts.length === 0) {
    throw new Error('[skeleton-fonts] No fonts loaded (Google Fonts failed and Inter missing in /fonts/).');
  }
  return fonts;
}
