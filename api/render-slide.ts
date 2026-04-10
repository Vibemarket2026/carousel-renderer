// /api/render-slide.ts
// Vibemarket Render Engine v2.1 - API Endpoint
// POST /api/render-slide → returns PNG base64 + Fabric.js JSON for editor

import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { RenderSlideRequest, RenderSlideResponse } from '../lib/types.js';
import { composeSlide, autoSelectDesign } from '../lib/composer.js';
import { loadFonts } from '../lib/fonts.js';
import { convertSlideToFabric } from '../lib/fabric-converter.js';

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

    // ── Validate ──────────────────────────────────────────────
    if (!body.title || !body.brand) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: 'Required: title, brand (with name, color_primary, color_secondary)',
      });
    }

    // ── Defaults ──────────────────────────────────────────────
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

    // ── Fetch asset image if provided ─────────────────────────
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

    // ── Compose the slide ─────────────────────────────────────
    const slideNode = composeSlide(
      { ...body, mood, layout, decoration, brand },
      assetImageData
    );

    // ── Load fonts ────────────────────────────────────────────
    const fonts = await loadFonts(brand.font_heading, brand.font_body);

    // ── Render with Satori → SVG ──────────────────────────────
    const svg = await satori(slideNode as any, {
      width,
      height,
      fonts,
    });

    // ── Convert SVG → PNG ─────────────────────────────────────
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: width },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    // ── Convert SVG → Fabric.js JSON for editor ───────────────
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
