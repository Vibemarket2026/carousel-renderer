// /api/render-slide.ts
// Vibemarket Render Engine v2.1 - API Endpoint
// POST /api/render-slide → returns PNG base64 + Fabric.js JSON for editor

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { RenderSlideRequest, RenderSlideResponse } from '../lib/types.js';
import { composeSlide, autoSelectDesign } from '../lib/composer.js';
import { loadFonts } from '../lib/fonts.js';
import { convertSlideToFabric } from '../lib/fabric-converter.js';

// ── Emoji loading via Twemoji (Nov 2025) ─────────────────────────
//
// Satori does NOT render emojis with the loaded text fonts — they come out
// as empty box glyphs ("tofu"). The supported pattern is `loadAdditionalAsset`
// which returns an image URL/data-URI for each emoji segment, and Satori
// inlines it as an <img> at the right size.
//
// We use Twemoji SVGs hosted on jsDelivr — these are the same emoji set
// Twitter/X used to use, freely licensed (CC-BY 4.0), and rendered as crisp
// vector glyphs at any size.
//
// In-memory cache: a warm Vercel instance keeps fetched SVGs around so the
// same emoji used across slides only triggers one CDN fetch.

const emojiCache: Map<string, string> = new Map();

function toEmojiCodepoint(segment: string): string {
  // Twemoji filenames concatenate codepoints with `-`, lowercase hex,
  // and STRIP the variation selector U+FE0F (used for emoji vs text style).
  // Reference: https://github.com/twitter/twemoji#download
  const codepoints: string[] = [];
  for (const ch of segment) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    const hex = cp.toString(16);
    if (hex === 'fe0f') continue; // variation selector, skip
    codepoints.push(hex);
  }
  return codepoints.join('-');
}

async function fetchEmojiSvg(segment: string): Promise<string | null> {
  const cached = emojiCache.get(segment);
  if (cached !== undefined) return cached;

  const codepoint = toEmojiCodepoint(segment);
  if (!codepoint) {
    emojiCache.set(segment, '');
    return null;
  }

  // Twemoji 14.0.2 is the last freely-pinnable jsDelivr build.
  const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codepoint}.svg`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[emoji] Twemoji miss for "${segment}" (${codepoint}): HTTP ${response.status}`);
      emojiCache.set(segment, '');
      return null;
    }
    const svg = await response.text();
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    emojiCache.set(segment, dataUri);
    return dataUri;
  } catch (e) {
    console.warn(`[emoji] Fetch error for "${segment}":`, e);
    emojiCache.set(segment, '');
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const body = req.body as RenderSlideRequest;

    if (!body.title || !body.brand) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'Required: title, brand (with name, color_primary, color_secondary)',
      });
    }

    const slideType = body.slide_type || 'content';
    const slideNumber = body.slide_number || 1;
    const totalSlides = body.total_slides || 7;
    const width = body.output?.width || 1080;
    const height = body.output?.height || 1350;

    let mood = body.mood;
    let layout = body.layout;
    let decoration = body.decoration;

    if (!mood || !layout || !decoration) {
      const auto = autoSelectDesign(slideType, slideNumber, totalSlides);
      mood = mood || auto.mood;
      layout = layout || auto.layout;
      decoration = decoration || auto.decoration;
    }

    const brand = {
      name: body.brand.name || 'Brand',
      color_primary: body.brand.color_primary || '#333333',
      color_secondary: body.brand.color_secondary || '#666666',
      font_heading: body.brand.font_heading || 'Inter',
      font_body: body.brand.font_body || 'Inter',
      logo_url: body.brand.logo_url || null,
    };

    // ── Fetch asset image if provided ──────────────────────────
    let assetImageData: string | null = null;
    if (body.asset_url) {
      try {
        const response = await fetch(body.asset_url);
        if (response.ok) {
          const buffer = Buffer.from(await response.arrayBuffer());
          const contentType = response.headers.get('content-type') || 'image/png';
          assetImageData = `data:${contentType};base64,${buffer.toString('base64')}`;
        }
      } catch (e) {
        console.warn('Failed to fetch asset:', e);
      }
    }

    // ── Compose the slide ──────────────────────────────────
    const slideNode = composeSlide(
      { ...body, mood, layout, decoration, brand },
      assetImageData
    );

    // ── Load fonts ─────────────────────────────────────────
    const fonts = await loadFonts(brand.font_heading, brand.font_body);

    // ── Render with Satori → SVG (with emoji support) ───────────────────
    const svg = await satori(slideNode as any, {
      width,
      height,
      fonts,
      // When Satori encounters an emoji it can't render with the loaded
      // fonts, it calls this with code='emoji' and segment=<emoji string>.
      // We return a data URI for a Twemoji SVG and Satori inlines it.
      loadAdditionalAsset: async (code: string, segment: string) => {
        if (code === 'emoji') {
          const dataUri = await fetchEmojiSvg(segment);
          return dataUri || '';
        }
        // Unsupported asset type — return empty so Satori falls back gracefully.
        return '';
      },
    });

    // ── Convert SVG → PNG ────────────────────────────────────
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // ── Convert SVG → Fabric.js JSON for editor ──────────────────────
    const fabricData = convertSlideToFabric(svg, {
      slide_number: slideNumber,
      slide_type: slideType,
      mood,
      width,
      height,
      primary: brand.color_primary,
      secondary: brand.color_secondary,
    });

    const renderTime = Date.now() - startTime;

    return res.status(200).json({
      success: true,
      image_base64: pngBuffer.toString('base64'),
      design_elements: fabricData,
      design_intent: { mood, layout, decoration },
      dimensions: { width, height },
      render_time_ms: renderTime,
    });

  } catch (error) {
    console.error('Render error:', error);
    return res.status(500).json({
      success: false,
      error: 'Render failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
