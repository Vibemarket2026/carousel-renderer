// /lib/layouts.ts
// 6 layout modules using pure flexbox - zero fixed coordinates
// Each layout adapts to any text length via flex properties
// The palette comes from contrast.ts derivePalette()

import { SatoriNode, LayoutName } from './types.js';
import { DerivedPalette, withOpacity } from './contrast.js';

interface LayoutInput {
  slide_type: string;
  slide_number: number;
  total_slides: number;
  title: string;
  subtitle?: string;
  body_text?: string;
  stat_number?: string;
  stat_label?: string;
  quote_attribution?: string;
  emoji?: string;
  brand_name: string;
  logo_url?: string | null;
  asset_image_data?: string | null;
  use_asset_as?: 'featured' | 'background' | null;
  font_heading: string;
  font_body: string;
  palette: DerivedPalette;
  width: number;
  height: number;
}

// ── Scale helper: all sizes proportional to canvas ───────────
function s(base: number, width: number): number {
  return Math.round(base * (width / 1080));
}

// ── LAYOUT 1: CENTERED ───────────────────────────────────────
// Classic centered composition. Title + body stacked vertically.
// Works for cover, content, and CTA slides.

function layoutCentered(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body } = input;
  const children: (SatoriNode | string)[] = [];

  // Background image if provided
  if (input.use_asset_as === 'background' && input.asset_image_data) {
    children.push(
      { type: 'img', props: { src: input.asset_image_data, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 } } },
      { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 2 }, children: [] } }
    );
  }

  // Content wrapper
  const content: (SatoriNode | string)[] = [];

  // Category / slide number
  if (input.subtitle && input.slide_type !== 'cta') {
    content.push({
      type: 'span',
      props: {
        style: {
          fontSize: `${s(24, w)}px`,
          letterSpacing: '3px',
          color: p.accent,
          fontFamily: font_body,
          fontWeight: 500,
          textTransform: 'uppercase',
        },
        children: input.subtitle,
      },
    });
  }

  // Emoji or featured asset
  if (input.use_asset_as === 'featured' && input.asset_image_data) {
    content.push({
      type: 'img',
      props: { src: input.asset_image_data, style: { width: `${s(360, w)}px`, height: `${s(360, w)}px`, objectFit: 'contain', marginBottom: `${s(30, w)}px` } },
    });
  } else if (input.emoji) {
    content.push({
      type: 'span',
      props: { style: { fontSize: `${s(100, w)}px`, marginBottom: `${s(20, w)}px` }, children: input.emoji },
    });
  }

  // Title
  const isCover = input.slide_type === 'cover';
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(isCover ? 72 : 58, w)}px`,
        fontWeight: 700,
        color: input.use_asset_as === 'background' ? '#FFFFFF' : p.textTitle,
        fontFamily: font_heading,
        textAlign: 'center',
        lineHeight: 1.15,
        maxWidth: `${s(900, w)}px`,
        marginTop: `${s(16, w)}px`,
      },
      children: input.title,
    },
  });

  // Body text
  if (input.body_text) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${s(30, w)}px`,
          color: input.use_asset_as === 'background' ? 'rgba(255,255,255,0.75)' : p.textBody,
          fontFamily: font_body,
          textAlign: 'center',
          lineHeight: 1.6,
          maxWidth: `${s(800, w)}px`,
          marginTop: `${s(24, w)}px`,
        },
        children: input.body_text,
      },
    });
  }

  // Accent line separator
  content.push({
    type: 'div',
    props: {
      style: {
        width: `${s(50, w)}px`,
        height: '3px',
        backgroundColor: p.accent,
        marginTop: `${s(24, w)}px`,
        borderRadius: '2px',
      },
      children: [],
    },
  });

  // Swipe indicator for covers
  if (isCover) {
    content.push({
      type: 'span',
      props: {
        style: {
          fontSize: `${s(26, w)}px`,
          color: p.accent,
          fontFamily: font_body,
          fontWeight: 500,
          marginTop: `${s(40, w)}px`,
          padding: `${s(10, w)}px ${s(24, w)}px`,
          border: `1px solid ${withOpacity(p.accent, 0.35)}`,
          borderRadius: `${s(6, w)}px`,
        },
        children: 'Desliza →',
      },
    });
  }

  // Brand footer
  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: `${s(60, w)}px`,
        gap: `${s(12, w)}px`,
        zIndex: 5,
      },
      children: content,
    },
  });

  // Brand name at bottom
  children.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: `${s(40, w)}px`,
        left: `${s(60, w)}px`,
        fontSize: `${s(22, w)}px`,
        color: p.textMuted,
        fontFamily: font_body,
        zIndex: 5,
      },
      children: input.brand_name,
    },
  });

  // Slide counter
  if (input.slide_type === 'content' || input.slide_type === 'big_stat') {
    children.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          top: `${s(40, w)}px`,
          right: `${s(40, w)}px`,
          fontSize: `${s(24, w)}px`,
          color: p.textMuted,
          fontFamily: font_body,
          fontWeight: 600,
          zIndex: 5,
        },
        children: `${input.slide_number}/${input.total_slides}`,
      },
    });
  }

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 2: LEFT ALIGNED ───────────────────────────────────
// Editorial style. Everything left-aligned with generous padding.

function layoutLeftAligned(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body } = input;
  const children: (SatoriNode | string)[] = [];

  const content: (SatoriNode | string)[] = [];

  // Category label
  if (input.subtitle) {
    content.push({
      type: 'span',
      props: {
        style: { fontSize: `${s(22, w)}px`, letterSpacing: '2.5px', color: p.accent, fontFamily: font_body, fontWeight: 500 },
        children: input.subtitle.toUpperCase(),
      },
    });
  }

  // Title
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(62, w)}px`,
        fontWeight: 700,
        color: p.textTitle,
        fontFamily: font_heading,
        lineHeight: 1.12,
        maxWidth: `${s(850, w)}px`,
        marginTop: `${s(16, w)}px`,
      },
      children: input.title,
    },
  });

  // Accent line
  content.push({
    type: 'div',
    props: {
      style: { width: `${s(60, w)}px`, height: '3px', backgroundColor: p.accent, marginTop: `${s(20, w)}px`, borderRadius: '2px' },
      children: [],
    },
  });

  // Body
  if (input.body_text) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${s(28, w)}px`,
          color: p.textBody,
          fontFamily: font_body,
          lineHeight: 1.65,
          maxWidth: `${s(780, w)}px`,
          marginTop: `${s(24, w)}px`,
        },
        children: input.body_text,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: `${s(80, w)}px ${s(70, w)}px`,
        gap: `${s(8, w)}px`,
        zIndex: 5,
      },
      children: content,
    },
  });

  // Bottom bar
  children.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        bottom: `${s(40, w)}px`,
        left: `${s(70, w)}px`,
        right: `${s(70, w)}px`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 5,
      },
      children: [
        { type: 'span', props: { style: { fontSize: `${s(22, w)}px`, color: p.textMuted, fontFamily: font_body }, children: input.brand_name } },
        { type: 'span', props: { style: { fontSize: `${s(20, w)}px`, color: p.accent, fontFamily: font_body, fontWeight: 500 }, children: `${input.slide_number}/${input.total_slides}` } },
      ],
    },
  });

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 3: BIG STAT ───────────────────────────────────────
// Giant number centered, label below, source at bottom.

function layoutBigStat(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body } = input;
  const children: (SatoriNode | string)[] = [];
  const content: (SatoriNode | string)[] = [];

  // Category
  if (input.subtitle) {
    content.push({
      type: 'span',
      props: {
        style: { fontSize: `${s(22, w)}px`, letterSpacing: '3px', color: p.accent, fontFamily: font_body, fontWeight: 500 },
        children: input.subtitle.toUpperCase(),
      },
    });
  }

  // The big number
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(140, w)}px`,
        fontWeight: 700,
        color: p.textTitle,
        fontFamily: font_heading,
        lineHeight: 1,
        marginTop: `${s(20, w)}px`,
      },
      children: input.stat_number || input.title,
    },
  });

  // Stat label
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(34, w)}px`,
        color: p.textBody,
        fontFamily: font_body,
        textAlign: 'center',
        lineHeight: 1.4,
        maxWidth: `${s(700, w)}px`,
        marginTop: `${s(16, w)}px`,
      },
      children: input.stat_label || input.body_text || '',
    },
  });

  // Accent line
  content.push({
    type: 'div',
    props: {
      style: { width: `${s(50, w)}px`, height: '3px', backgroundColor: p.accent, marginTop: `${s(24, w)}px`, borderRadius: '2px' },
      children: [],
    },
  });

  // Source / attribution
  if (input.body_text && input.stat_label) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${s(22, w)}px`,
          color: p.textMuted,
          fontFamily: font_body,
          textAlign: 'center',
          lineHeight: 1.5,
          maxWidth: `${s(600, w)}px`,
          marginTop: `${s(20, w)}px`,
        },
        children: input.body_text,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: `${s(60, w)}px`, gap: `${s(8, w)}px`, zIndex: 5,
      },
      children: content,
    },
  });

  // Brand footer + counter
  children.push({
    type: 'div',
    props: {
      style: { position: 'absolute', bottom: `${s(40, w)}px`, left: `${s(60, w)}px`, fontSize: `${s(22, w)}px`, color: p.textMuted, fontFamily: font_body, zIndex: 5 },
      children: input.brand_name,
    },
  });
  children.push({
    type: 'div',
    props: {
      style: { position: 'absolute', top: `${s(40, w)}px`, right: `${s(40, w)}px`, fontSize: `${s(24, w)}px`, color: p.textMuted, fontFamily: font_body, fontWeight: 600, zIndex: 5 },
      children: `${input.slide_number}/${input.total_slides}`,
    },
  });

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 4: SPLIT PANEL ────────────────────────────────────
// Left color panel (35%) + right content (65%). Great for GMB promos.

function layoutSplitPanel(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body } = input;

  const panelWidth = Math.round(w * 0.35);
  const panelChildren: (SatoriNode | string)[] = [];

  // Slide counter in panel
  panelChildren.push({
    type: 'span',
    props: {
      style: { fontSize: `${s(20, w)}px`, color: withOpacity('#FFFFFF', 0.5), fontFamily: font_body, letterSpacing: '1px' },
      children: `${input.slide_number}/${input.total_slides}`,
    },
  });

  // Big element in panel (stat number, emoji, or first word of title)
  if (input.stat_number) {
    panelChildren.push({
      type: 'div',
      props: {
        style: { fontSize: `${s(90, w)}px`, fontWeight: 700, color: '#FFFFFF', fontFamily: font_heading, lineHeight: 1, marginTop: `${s(16, w)}px` },
        children: input.stat_number,
      },
    });
    if (input.stat_label) {
      panelChildren.push({
        type: 'div',
        props: {
          style: { fontSize: `${s(22, w)}px`, color: withOpacity('#FFFFFF', 0.7), fontFamily: font_body, marginTop: `${s(8, w)}px`, lineHeight: 1.4 },
          children: input.stat_label,
        },
      });
    }
  } else if (input.emoji) {
    panelChildren.push({
      type: 'span',
      props: { style: { fontSize: `${s(80, w)}px`, marginTop: `${s(20, w)}px` }, children: input.emoji },
    });
  }

  // CTA button in panel
  panelChildren.push({
    type: 'div',
    props: {
      style: {
        marginTop: `${s(24, w)}px`,
        fontSize: `${s(20, w)}px`,
        color: p.accent,
        fontFamily: font_body,
        fontWeight: 500,
        border: `1px solid ${p.accent}`,
        padding: `${s(10, w)}px ${s(20, w)}px`,
        borderRadius: `${s(5, w)}px`,
        textAlign: 'center',
      },
      children: 'Saber más',
    },
  });

  // Right content
  const rightChildren: (SatoriNode | string)[] = [];

  if (input.subtitle) {
    rightChildren.push({
      type: 'span',
      props: {
        style: { fontSize: `${s(20, w)}px`, letterSpacing: '2px', color: p.accent, fontFamily: font_body, fontWeight: 600 },
        children: input.subtitle.toUpperCase(),
      },
    });
  }

  rightChildren.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(46, w)}px`, fontWeight: 700, color: p.textTitle, fontFamily: font_heading,
        lineHeight: 1.2, marginTop: `${s(10, w)}px`,
      },
      children: input.title,
    },
  });

  if (input.body_text) {
    rightChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${s(26, w)}px`, color: p.textBody, fontFamily: font_body,
          lineHeight: 1.6, marginTop: `${s(16, w)}px`,
        },
        children: input.body_text,
      },
    });
  }

  rightChildren.push({
    type: 'span',
    props: {
      style: { fontSize: `${s(20, w)}px`, color: p.textMuted, fontFamily: font_body, marginTop: 'auto' },
      children: input.brand_name,
    },
  });

  return {
    type: 'div',
    props: {
      style: { width: `${w}px`, height: `${h}px`, display: 'flex', flexDirection: 'row', position: 'relative', overflow: 'hidden' },
      children: [
        {
          type: 'div',
          props: {
            style: {
              width: `${panelWidth}px`, height: '100%', backgroundColor: p.bgPanel,
              display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
              padding: `${s(50, w)}px ${s(40, w)}px`, gap: `${s(4, w)}px`,
            },
            children: panelChildren,
          },
        },
        {
          type: 'div',
          props: {
            style: {
              flex: 1, backgroundColor: p.bgMain, display: 'flex', flexDirection: 'column',
              justifyContent: 'center', padding: `${s(50, w)}px ${s(50, w)}px`,
              gap: `${s(6, w)}px`,
            },
            children: rightChildren,
          },
        },
      ],
    },
  };
}

// ── LAYOUT 5: QUOTE BLOCK ────────────────────────────────────
// Large quote marks, italic text, attribution below.

function layoutQuoteBlock(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body } = input;
  const children: (SatoriNode | string)[] = [];
  const content: (SatoriNode | string)[] = [];

  // Big opening quote mark
  content.push({
    type: 'div',
    props: {
      style: { fontSize: `${s(160, w)}px`, color: p.accent, fontFamily: font_heading, lineHeight: 0.6, opacity: 0.3 },
      children: '\u201C',
    },
  });

  // Quote text (the title field)
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(44, w)}px`, fontWeight: 400, fontStyle: 'italic',
        color: p.textTitle, fontFamily: font_heading,
        textAlign: 'center', lineHeight: 1.45, maxWidth: `${s(820, w)}px`,
        marginTop: `${s(10, w)}px`,
      },
      children: input.title,
    },
  });

  // Attribution
  const attribution = input.quote_attribution || input.subtitle;
  if (attribution) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${s(24, w)}px`, color: p.accent, fontFamily: font_body,
          fontWeight: 500, marginTop: `${s(28, w)}px`,
        },
        children: `— ${attribution}`,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: `${s(80, w)}px ${s(70, w)}px`,
        gap: `${s(8, w)}px`, zIndex: 5,
      },
      children: content,
    },
  });

  // Bottom bar
  children.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: `${s(40, w)}px`, left: `${s(70, w)}px`, right: `${s(70, w)}px`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
      },
      children: [
        { type: 'span', props: { style: { fontSize: `${s(22, w)}px`, color: p.textMuted, fontFamily: font_body }, children: input.brand_name } },
        { type: 'span', props: { style: { fontSize: `${s(20, w)}px`, color: p.textMuted, fontFamily: font_body }, children: `${input.slide_number}/${input.total_slides}` } },
      ],
    },
  });

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 6: CTA FINAL ──────────────────────────────────────
// Final slide: brand-focused CTA with optional logo.

function layoutCtaFinal(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body } = input;
  const children: (SatoriNode | string)[] = [];
  const content: (SatoriNode | string)[] = [];

  // Logo
  if (input.logo_url) {
    content.push({
      type: 'img',
      props: {
        src: input.logo_url,
        style: { width: `${s(280, w)}px`, height: `${s(280, w)}px`, objectFit: 'contain', marginBottom: `${s(30, w)}px` },
      },
    });
  }

  // Brand name (large)
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(56, w)}px`, fontWeight: 700, color: p.textTitle, fontFamily: font_heading,
        textAlign: 'center', lineHeight: 1.2,
      },
      children: input.brand_name,
    },
  });

  // CTA text (title field)
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${s(34, w)}px`, color: p.textBody, fontFamily: font_body,
        textAlign: 'center', lineHeight: 1.5, maxWidth: `${s(700, w)}px`,
        marginTop: `${s(20, w)}px`,
      },
      children: input.title,
    },
  });

  // CTA button
  if (input.body_text) {
    content.push({
      type: 'div',
      props: {
        style: {
          marginTop: `${s(36, w)}px`,
          backgroundColor: p.accent,
          color: p.bgMain,
          fontSize: `${s(26, w)}px`,
          fontWeight: 600,
          fontFamily: font_body,
          padding: `${s(16, w)}px ${s(48, w)}px`,
          borderRadius: `${s(8, w)}px`,
          textAlign: 'center',
        },
        children: input.body_text,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', padding: `${s(60, w)}px`, gap: `${s(8, w)}px`, zIndex: 5,
      },
      children: content,
    },
  });

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT DISPATCHER ────────────────────────────────────────

export function buildLayout(layout: LayoutName, input: LayoutInput): SatoriNode {
  switch (layout) {
    case 'centered':     return layoutCentered(input);
    case 'left_aligned': return layoutLeftAligned(input);
    case 'big_stat':     return layoutBigStat(input);
    case 'split_panel':  return layoutSplitPanel(input);
    case 'quote_block':  return layoutQuoteBlock(input);
    case 'cta_final':    return layoutCtaFinal(input);
    default:             return layoutCentered(input);
  }
}
