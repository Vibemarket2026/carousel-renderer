// /lib/recipes/fonts.ts
// Runtime font loader for the recipe engine.
//
// The legacy path loads committed .ttf files from /fonts/ via FONT_REGISTRY.
// The recipe families are many and we can't commit binaries here, so we fetch
// them at runtime from the Google Fonts CSS API and cache in-memory (warm
// Vercel instances reuse them). Same spirit as the Twemoji fetch in render-slide.ts.
//
// We force STATIC TTF (Satori 0.10 in this repo expects TrueType/OpenType, not
// woff2) by sending an old Android User-Agent. With that UA the CSS comes back as
// plain @font-face blocks (one per weight/style, no /* subset */ comments and no
// unicode-range), so we parse every block that carries a .ttf url. Inter (already
// committed in /fonts/) is always added as a guaranteed fallback.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface SatoriFont {
  name: string;
  data: Buffer;
  weight: number;
  style: 'normal' | 'italic';
}

interface FamilySpec { weights: number[]; italics?: number[]; }

// The weights/italics each recipe signature family actually uses.
export const RECIPE_FONT_SPECS: Record<string, FamilySpec> = {
  'Newsreader': { weights: [400, 500, 600, 700], italics: [400] },
  'Hanken Grotesk': { weights: [400, 500, 600, 700] },
  'Archivo': { weights: [400, 600, 700, 800] },
  'IBM Plex Mono': { weights: [400, 500, 600] },
  'DM Serif Display': { weights: [400], italics: [400] },
  'Mulish': { weights: [400, 500, 600, 700] },
  'Space Grotesk': { weights: [400, 500, 600, 700] },
  'Playfair Display': { weights: [400, 500, 600, 700], italics: [400] },
  'Manrope': { weights: [400, 500, 600, 700] },
  'Anton': { weights: [400] },
  'Cormorant Garamond': { weights: [400, 500, 600], italics: [400] },
  'Jost': { weights: [400, 500, 600] },
};

// Old Android UA -> Google Fonts serves static .ttf (no woff/woff2 support assumed).
const TTF_UA =
  'Mozilla/5.0 (Linux; U; Android 2.3.6; en-us; Nexus S Build/GRK39F) ' +
  'AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';

function isValidFont(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  const s = buf.subarray(0, 4);
  if (s[0] === 0x00 && s[1] === 0x01 && s[2] === 0x00 && s[3] === 0x00) return true; // TrueType
  const a = s.toString('ascii');
  return a === 'OTTO' || a === 'ttcf' || a === 'true' || a === 'typ1';
}

function css2Url(family: string, spec: FamilySpec): string {
  const fam = family.replace(/ /g, '+');
  const its = spec.italics ?? [];
  if (its.length) {
    const tuples: string[] = [];
    for (const w of spec.weights) tuples.push('0,' + w); // ital,wght — normals first
    for (const w of its) tuples.push('1,' + w);          // then italics
    return 'https://fonts.googleapis.com/css2?family=' + fam + ':ital,wght@' + tuples.join(';') + '&display=swap';
  }
  return 'https://fonts.googleapis.com/css2?family=' + fam + ':wght@' + spec.weights.join(';') + '&display=swap';
}

const familyCache: Map<string, SatoriFont[]> = new Map();

async function fetchFamily(family: string): Promise<SatoriFont[]> {
  const cached = familyCache.get(family);
  if (cached) return cached;
  const spec = RECIPE_FONT_SPECS[family];
  if (!spec) { familyCache.set(family, []); return []; }

  const out: SatoriFont[] = [];
  try {
    const cssRes = await fetch(css2Url(family, spec), { headers: { 'User-Agent': TTF_UA } });
    if (!cssRes.ok) { familyCache.set(family, []); return []; }
    const css = await cssRes.text();

    // With the old-Android UA, Google Fonts returns plain TTF @font-face blocks:
    // one per weight/style, with NO /* subset */ comment and NO unicode-range.
    // Parse every @font-face that carries a .ttf url; key on weight+style to dedupe.
    // (The previous parser required a /* subset */ comment, which this format lacks,
    //  so it matched nothing and every recipe fell back to Inter.)
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
        } catch { /* skip this weight */ }
      })());
    }
    await Promise.all(jobs);
  } catch { /* family fetch failed — engine falls back */ }

  familyCache.set(family, out);
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

// Load every family in `families` (recipe signature + any brand overrides),
// plus Inter as a guaranteed fallback. Unknown families are simply skipped.
export async function loadRecipeFonts(families: string[]): Promise<SatoriFont[]> {
  const uniq = Array.from(new Set(families.filter(Boolean)));
  const results = await Promise.all(uniq.map((f) => fetchFamily(f)));
  const fonts: SatoriFont[] = results.flat();
  fonts.push(...loadInterFallback());
  if (fonts.length === 0) {
    throw new Error('[recipes/fonts] No fonts loaded (Google Fonts fetch failed and Inter missing in /fonts/).');
  }
  return fonts;
}
