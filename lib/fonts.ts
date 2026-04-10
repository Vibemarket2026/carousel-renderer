// /lib/fonts.ts
// Font loading with in-memory cache for Vercel warm instances

import { readFileSync } from 'fs';
import { join } from 'path';
import { FONT_REGISTRY } from './types.js';

interface SatoriFont {
  name: string;
  data: Buffer;
  weight: number;
  style: 'normal' | 'italic';
}

const fontCache: Map<string, SatoriFont[]> = new Map();

export async function loadFonts(headingFont: string, bodyFont: string): Promise<SatoriFont[]> {
  const cacheKey = `${headingFont}|${bodyFont}`;
  if (fontCache.has(cacheKey)) {
    return fontCache.get(cacheKey)!;
  }

  const fonts: SatoriFont[] = [];
  const loadedFiles = new Set<string>();

  // Load heading font
  const headingFiles = FONT_REGISTRY[headingFont] || FONT_REGISTRY['Inter'];
  for (const entry of headingFiles) {
    if (!loadedFiles.has(entry.file)) {
      try {
        const fontPath = join(process.cwd(), 'fonts', entry.file);
        fonts.push({
          name: headingFont,
          data: readFileSync(fontPath),
          weight: entry.weight,
          style: entry.style,
        });
        loadedFiles.add(entry.file);
      } catch (e) {
        console.warn(`Font not found: ${entry.file}, falling back`);
      }
    }
  }

  // Load body font (if different from heading)
  if (bodyFont !== headingFont) {
    const bodyFiles = FONT_REGISTRY[bodyFont] || FONT_REGISTRY['Inter'];
    for (const entry of bodyFiles) {
      if (!loadedFiles.has(entry.file)) {
        try {
          const fontPath = join(process.cwd(), 'fonts', entry.file);
          fonts.push({
            name: bodyFont,
            data: readFileSync(fontPath),
            weight: entry.weight,
            style: entry.style,
          });
          loadedFiles.add(entry.file);
        } catch (e) {
          console.warn(`Font not found: ${entry.file}, falling back`);
        }
      }
    }
  }

  // Fallback: ensure at least Inter is loaded
  if (fonts.length === 0) {
    try {
      const regularPath = join(process.cwd(), 'fonts', 'Inter-Regular.ttf');
      const boldPath = join(process.cwd(), 'fonts', 'Inter-Bold.ttf');
      fonts.push(
        { name: 'Inter', data: readFileSync(regularPath), weight: 400, style: 'normal' },
        { name: 'Inter', data: readFileSync(boldPath), weight: 700, style: 'normal' },
      );
    } catch (e) {
      console.error('CRITICAL: Cannot load fallback Inter fonts');
    }
  }

  fontCache.set(cacheKey, fonts);
  return fonts;
}
