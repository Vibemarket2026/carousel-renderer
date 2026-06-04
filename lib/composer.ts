// /lib/composer.ts
// The Composer: combines layout × mood × decoration into a final SatoriNode
// This is the brain of the render engine

import { SatoriNode, MoodName, LayoutName, DecorationType, RenderSlideRequest } from './types.js';
import { derivePalette, DerivedPalette, lighten, darken } from './contrast.js';
import { buildLayout } from './layouts.js';
import { generateDecorations } from './decorations.js';

// ── Mood → Palette Type Mapping ──────────────────────────────

function moodToPaletteType(mood: MoodName): 'dark' | 'light' | 'bold' | 'pastel' | 'split' | 'gradient' {
  switch (mood) {
    case 'dark_minimal':   return 'dark';
    case 'light_clean':    return 'light';
    case 'bold_primary':   return 'bold';
    case 'soft_pastel':    return 'pastel';
    case 'color_block':    return 'split';
    case 'warm_gradient':  return 'gradient';
  }
}

// ── Mood → Background Style ──────────────────────────────────
// Each mood applies a distinct background treatment to the container.
// Nov 2025: replaced flat backgroundColor with subtle gradients/radials
// on each mood so slides have visual texture without breaking the design
// system. All gradients stay within the mood's own palette so contrast
// guarantees from derivePalette() still hold.

function moodBackground(mood: MoodName, palette: DerivedPalette): Record<string, any> {
  switch (mood) {
    case 'dark_minimal':
      // Subtle radial highlight from top-center — adds depth without
      // breaking the minimal feel. Stays within the dark palette range.
      return {
        background: `radial-gradient(ellipse at 50% 0%, ${lighten(palette.bgMain, 0.04)} 0%, ${palette.bgMain} 55%, ${darken(palette.bgMain, 0.04)} 100%)`,
      };

    case 'light_clean':
      // Gentle vertical wash from main bg → slightly cooler tone at bottom.
      // Stays clean and editorial.
      return {
        background: `linear-gradient(180deg, ${palette.bgMain} 0%, #F2F2EE 100%)`,
      };

    case 'bold_primary':
      // Diagonal sweep within the brand color — top-left slightly lighter,
      // bottom-right slightly deeper. Gives flat brand color real depth.
      return {
        background: `linear-gradient(135deg, ${lighten(palette.bgMain, 0.05)} 0%, ${palette.bgMain} 55%, ${darken(palette.bgMain, 0.08)} 100%)`,
      };

    case 'soft_pastel':
      // Diagonal blend between the two pastel tones — adds dimension to
      // what was previously a flat pastel wash.
      return {
        background: `linear-gradient(160deg, ${palette.bgMain} 0%, ${palette.bgPanel} 100%)`,
      };

    case 'color_block':
      // Split-panel layout owns its bg, but we still set bgMain so the
      // right-content area renders correctly when the layout reads it.
      return { backgroundColor: palette.bgMain };

    case 'warm_gradient':
      // Already a gradient — keep but use a richer 3-stop path through
      // the brand colors for more visual interest.
      return {
        background: `linear-gradient(145deg, ${palette.gradientFrom} 0%, ${darken(palette.gradientTo, 0.05)} 55%, ${palette.gradientTo} 100%)`,
      };
  }
}

// ── Compose Final Slide ──────────────────────────────────────

export function composeSlide(request: RenderSlideRequest, assetImageData?: string | null): SatoriNode {
  const {
    brand,
    mood,
    layout,
    decoration,
    slide_type,
    slide_number,
    total_slides,
    title,
    subtitle,
    body_text,
    stat_number,
    stat_label,
    quote_attribution,
    emoji,
    use_asset_as,
  } = request;

  const width = request.output?.width || 1080;
  const height = request.output?.height || 1350;

  // 1. Derive color palette from brand colors + mood
  const paletteType = moodToPaletteType(mood);
  const palette = derivePalette(brand.color_primary, brand.color_secondary, paletteType);

  // 2. Build the layout content tree
  const layoutNode = buildLayout(layout, {
    slide_type,
    slide_number,
    total_slides,
    title,
    subtitle,
    body_text,
    stat_number,
    stat_label,
    quote_attribution,
    emoji,
    brand_name: brand.name,
    logo_url: brand.logo_url,
    asset_image_data: assetImageData,
    use_asset_as,
    font_heading: brand.font_heading || 'Inter',
    font_body: brand.font_body || 'Inter',
    palette,
    width,
    height,
    mood,
  });

  // 3. Generate decoration elements
  const decorationNodes = generateDecorations(decoration, {
    color: palette.decorationColor,
    colorSoft: palette.decorationSoft,
    width,
    height,
  });

  // 4. Combine: background style + layout + decorations
  const bgStyle = moodBackground(mood, palette);

  // The layout node already has the outer container with width/height.
  // We need to merge the mood background into it and inject decorations.
  const containerStyle = {
    ...layoutNode.props.style,
    ...bgStyle,
  };

  // Inject decoration nodes into the children array
  const existingChildren = Array.isArray(layoutNode.props.children)
    ? layoutNode.props.children
    : layoutNode.props.children
      ? [layoutNode.props.children]
      : [];

  const allChildren = [
    ...decorationNodes,
    ...existingChildren,
  ];

  return {
    type: 'div',
    props: {
      style: {
        ...containerStyle,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      },
      children: allChildren,
    },
  };
}

// ── Auto-select mood/layout/decoration based on slide_type ───
// Used when the AI workflow doesn't specify design params explicitly

export interface AutoDesignResult {
  mood: MoodName;
  layout: LayoutName;
  decoration: DecorationType;
}

export function autoSelectDesign(
  slideType: string,
  slideNumber: number,
  totalSlides: number,
  seed?: number
): AutoDesignResult {
  // Use a simple deterministic hash for variety within a carousel
  const hash = seed !== undefined
    ? (seed * 31 + slideNumber * 17) % 100
    : (slideNumber * 37 + totalSlides * 13) % 100;

  // Cover slides
  if (slideType === 'cover') {
    const moods: MoodName[] = ['dark_minimal', 'bold_primary', 'warm_gradient', 'light_clean'];
    return {
      mood: moods[hash % moods.length],
      layout: 'centered',
      decoration: (['accent_line', 'geometric_circles', 'corner_block'] as DecorationType[])[hash % 3],
    };
  }

  // CTA / final slides
  if (slideType === 'cta') {
    return {
      mood: (['dark_minimal', 'bold_primary', 'warm_gradient'] as MoodName[])[hash % 3],
      layout: 'cta_final',
      decoration: (['none', 'accent_line', 'geometric_circles'] as DecorationType[])[hash % 3],
    };
  }

  // Big stat slides
  if (slideType === 'big_stat') {
    return {
      mood: (['dark_minimal', 'soft_pastel', 'bold_primary', 'warm_gradient'] as MoodName[])[hash % 4],
      layout: 'big_stat',
      decoration: (['accent_line', 'geometric_circles', 'dot_pattern'] as DecorationType[])[hash % 3],
    };
  }

  // Quote slides
  if (slideType === 'quote') {
    return {
      mood: (['soft_pastel', 'light_clean', 'dark_minimal'] as MoodName[])[hash % 3],
      layout: 'quote_block',
      decoration: (['none', 'accent_line'] as DecorationType[])[hash % 2],
    };
  }

  // Content slides - most variety here
  const contentMoods: MoodName[] = ['dark_minimal', 'light_clean', 'bold_primary', 'soft_pastel', 'color_block', 'warm_gradient'];
  const contentLayouts: LayoutName[] = ['centered', 'left_aligned', 'split_panel'];
  const contentDecos: DecorationType[] = ['none', 'accent_line', 'geometric_circles', 'corner_block', 'dot_pattern'];

  return {
    mood: contentMoods[hash % contentMoods.length],
    layout: contentLayouts[hash % contentLayouts.length],
    decoration: contentDecos[hash % contentDecos.length],
  };
}
