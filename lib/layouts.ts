// /lib/layouts.ts
// 6 layout modules using pure flexbox - zero fixed coordinates

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
  mood?: string;
}

function s(base: number, width: number): number {
  return Math.round(base * (width / 1080));
}

const TYPE = {
  // Cover title lowered from 120 to 104 (Nov 2025). At 120 a long single
  // word like "Psicomotricidad" rendered in heading-bold exceeded the
  // 920px maxWidth and was clipped by the canvas edge. 104 leaves room.
  titleCover:     104,  // was 120
  titleContent:    92,  // was 96 — same long-word concern, smaller margin
  titleLeft:       92,  // was 96
  titleCta:        80,  // was 84
  titleQuote:      72,

  bodyLarge:       54,
  bodyMedium:      48,
  bodyCta:         50,
  bodyStatLabel:   56,
  bodyQuote:       42,

  subtitle:        40,
  subtitleSmall:   36,
  swipeCta:        40,
  ctaButton:       46,

  brandFooter:     40,
  slideCounter:    40,
  source:          46,

  statNumber:     260,
  statNumberPanel: 120,

  emoji:          130,
  emojiSmall:     100,
  quoteMark:      220,

  accentLineW:    120,
  accentLineH:      6,
};

function moodTypeScale(mood?: string): { title: number; stat: number; body: number } {
  switch (mood) {
    case 'bold_primary':
    case 'dark_minimal':
    case 'warm_gradient':
      return { title: 1.0,  stat: 1.0,  body: 1.0  };
    case 'color_block':
      return { title: 0.95, stat: 1.0,  body: 1.0  };
    case 'light_clean':
      return { title: 0.92, stat: 0.95, body: 0.98 };
    case 'soft_pastel':
      return { title: 0.88, stat: 0.92, body: 0.95 };
    default:
      return { title: 1.0,  stat: 1.0,  body: 1.0  };
  }
}

function t(
  token: keyof typeof TYPE,
  mood: string | undefined,
  width: number,
  kind: 'title' | 'stat' | 'body' = 'body'
): number {
  const base = TYPE[token];
  const mult = moodTypeScale(mood)[kind];
  return s(Math.round(base * mult), width);
}

// ── Long-word safety helper ─────────────────────────────────
// If a title contains a single word longer than `threshold` characters
// (common in Spanish: "Psicomotricidad", "Responsabilidad", "Profesionalísimo"),
// scale the font down proportionally so it doesn't clip the canvas edge.
// Keeps the design impactful without breaking layout. Returns a multiplier
// in the range [0.7, 1.0].

function longWordScale(text: string, threshold = 13): number {
  const longest = Math.max(...text.split(/\s+/).map(w => w.length), 0);
  if (longest <= threshold) return 1.0;
  // 14 chars → 0.93, 16 chars → 0.81, 18 chars → 0.72
  return Math.max(0.7, threshold / longest);
}

// Title styles always carry wordBreak/overflowWrap so that even if the
// auto-scale isn't aggressive enough (or a brand chooses an extreme font),
// Satori will break the word at character level rather than overflow.
const TITLE_BREAK_STYLE = {
  wordBreak: 'break-word' as const,
  overflowWrap: 'break-word' as const,
};

// ── Shared footer helper ──────────────────────────────────
function footerElements(
  input: LayoutInput,
  p: DerivedPalette,
  w: number,
  showCounter: boolean
): SatoriNode[] {
  const out: SatoriNode[] = [
    {
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          bottom: `${s(40, w)}px`,
          left: `${s(60, w)}px`,
          fontSize: `${s(TYPE.brandFooter, w)}px`,
          color: p.textBody,
          fontFamily: input.font_body,
          fontWeight: 500,
          zIndex: 5,
        },
        children: input.brand_name,
      },
    },
  ];
  if (showCounter) {
    out.push({
      type: 'div',
      props: {
        style: {
          position: 'absolute',
          bottom: `${s(40, w)}px`,
          right: `${s(60, w)}px`,
          fontSize: `${s(TYPE.slideCounter, w)}px`,
          color: p.textBody,
          fontFamily: input.font_body,
          fontWeight: 600,
          zIndex: 5,
        },
        children: `${input.slide_number}/${input.total_slides}`,
      },
    });
  }
  return out;
}

// ── LAYOUT 1: CENTERED ──────────────────────────────────────
function layoutCentered(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body, mood } = input;
  const children: (SatoriNode | string)[] = [];

  if (input.use_asset_as === 'background' && input.asset_image_data) {
    children.push(
      { type: 'img', props: { src: input.asset_image_data, style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 1 } } },
      { type: 'div', props: { style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 2, display: 'flex' } } }
    );
  }

  const content: (SatoriNode | string)[] = [];

  if (input.subtitle && input.slide_type !== 'cta') {
    content.push({
      type: 'span',
      props: {
        style: {
          fontSize: `${t('subtitle', mood, w, 'body')}px`,
          letterSpacing: '3px',
          color: p.accent,
          fontFamily: font_body,
          fontWeight: 600,
          textTransform: 'uppercase',
        },
        children: input.subtitle,
      },
    });
  }

  if (input.use_asset_as === 'featured' && input.asset_image_data) {
    content.push({
      type: 'img',
      props: { src: input.asset_image_data, style: { width: `${s(360, w)}px`, height: `${s(360, w)}px`, objectFit: 'contain', marginBottom: `${s(30, w)}px` } },
    });
  } else if (input.emoji) {
    content.push({
      type: 'span',
      props: { style: { fontSize: `${s(TYPE.emoji, w)}px`, marginBottom: `${s(20, w)}px` }, children: input.emoji },
    });
  }

  const isCover = input.slide_type === 'cover';
  const titleToken = isCover ? 'titleCover' : 'titleContent';
  const titleBase = t(titleToken, mood, w, 'title');
  const titleScale = longWordScale(input.title);
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${Math.round(titleBase * titleScale)}px`,
        fontWeight: 700,
        color: input.use_asset_as === 'background' ? '#FFFFFF' : p.textTitle,
        fontFamily: font_heading,
        textAlign: 'center',
        lineHeight: 1.1,
        maxWidth: `${s(940, w)}px`,
        marginTop: `${s(20, w)}px`,
        ...TITLE_BREAK_STYLE,
      },
      children: input.title,
    },
  });

  if (input.body_text) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${t('bodyLarge', mood, w, 'body')}px`,
          color: input.use_asset_as === 'background' ? 'rgba(255,255,255,0.8)' : p.textBody,
          fontFamily: font_body,
          textAlign: 'center',
          lineHeight: 1.5,
          maxWidth: `${s(820, w)}px`,
          marginTop: `${s(28, w)}px`,
        },
        children: input.body_text,
      },
    });
  }

  content.push({
    type: 'div',
    props: {
      style: {
        width: `${s(TYPE.accentLineW, w)}px`,
        height: `${s(TYPE.accentLineH, w)}px`,
        backgroundColor: p.accent,
        marginTop: `${s(30, w)}px`,
        borderRadius: '2px',
      },
      display: 'flex',
    },
  });

  if (isCover) {
    content.push({
      type: 'span',
      props: {
        style: {
          fontSize: `${s(TYPE.swipeCta, w)}px`,
          color: p.accent,
          fontFamily: font_body,
          fontWeight: 600,
          marginTop: `${s(44, w)}px`,
          padding: `${s(14, w)}px ${s(32, w)}px`,
          border: `2px solid ${withOpacity(p.accent, 0.5)}`,
          borderRadius: `${s(8, w)}px`,
        },
        children: 'Desliza →',
      },
    });
  }

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

  const showCounter = input.slide_type === 'content' || input.slide_type === 'big_stat';
  children.push(...footerElements(input, p, w, showCounter));

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 2: LEFT ALIGNED ──────────────────────────────────
function layoutLeftAligned(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body, mood } = input;
  const children: (SatoriNode | string)[] = [];
  const content: (SatoriNode | string)[] = [];

  if (input.subtitle) {
    content.push({
      type: 'span',
      props: {
        style: { fontSize: `${t('subtitle', mood, w, 'body')}px`, letterSpacing: '2.5px', color: p.accent, fontFamily: font_body, fontWeight: 600 },
        children: input.subtitle.toUpperCase(),
      },
    });
  }

  const titleBase = t('titleLeft', mood, w, 'title');
  const titleScale = longWordScale(input.title);
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${Math.round(titleBase * titleScale)}px`,
        fontWeight: 700,
        color: p.textTitle,
        fontFamily: font_heading,
        lineHeight: 1.08,
        maxWidth: `${s(890, w)}px`,
        marginTop: `${s(20, w)}px`,
        ...TITLE_BREAK_STYLE,
      },
      children: input.title,
    },
  });

  content.push({
    type: 'div',
    props: {
      style: { width: `${s(TYPE.accentLineW, w)}px`, height: `${s(TYPE.accentLineH, w)}px`, backgroundColor: p.accent, marginTop: `${s(24, w)}px`, borderRadius: '2px' },
      display: 'flex',
    },
  });

  if (input.body_text) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${t('bodyLarge', mood, w, 'body')}px`,
          color: p.textBody,
          fontFamily: font_body,
          lineHeight: 1.55,
          maxWidth: `${s(800, w)}px`,
          marginTop: `${s(28, w)}px`,
        },
        children: input.body_text,
      },
    });
  }

  children.push({
    type: 'div',
    props: {
      style: {
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
        width: '100%', height: '100%', padding: `${s(80, w)}px ${s(70, w)}px`,
        gap: `${s(8, w)}px`, zIndex: 5,
      },
      children: content,
    },
  });

  children.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: `${s(40, w)}px`, left: `${s(70, w)}px`, right: `${s(70, w)}px`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
      },
      children: [
        { type: 'span', props: { style: { fontSize: `${s(TYPE.brandFooter, w)}px`, color: p.textBody, fontFamily: font_body, fontWeight: 500 }, children: input.brand_name } },
        { type: 'span', props: { style: { fontSize: `${s(TYPE.slideCounter, w)}px`, color: p.textBody, fontFamily: font_body, fontWeight: 600 }, children: `${input.slide_number}/${input.total_slides}` } },
      ],
    },
  });

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 3: BIG STAT ───────────────────────────────────────
function layoutBigStat(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body, mood } = input;
  const children: (SatoriNode | string)[] = [];
  const content: (SatoriNode | string)[] = [];

  if (input.subtitle) {
    content.push({
      type: 'span',
      props: {
        style: { fontSize: `${t('subtitle', mood, w, 'body')}px`, letterSpacing: '3px', color: p.accent, fontFamily: font_body, fontWeight: 600 },
        children: input.subtitle.toUpperCase(),
      },
    });
  }

  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${t('statNumber', mood, w, 'stat')}px`,
        fontWeight: 800,
        color: p.textTitle,
        fontFamily: font_heading,
        lineHeight: 0.95,
        marginTop: `${s(24, w)}px`,
        letterSpacing: '-2px',
      },
      children: input.stat_number || input.title,
    },
  });

  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${t('bodyStatLabel', mood, w, 'body')}px`,
        color: p.textBody,
        fontFamily: font_body,
        textAlign: 'center',
        lineHeight: 1.35,
        maxWidth: `${s(760, w)}px`,
        marginTop: `${s(20, w)}px`,
        fontWeight: 500,
      },
      children: input.stat_label || input.body_text || '',
    },
  });

  content.push({
    type: 'div',
    props: {
      style: { width: `${s(TYPE.accentLineW, w)}px`, height: `${s(TYPE.accentLineH, w)}px`, backgroundColor: p.accent, marginTop: `${s(28, w)}px`, borderRadius: '2px' },
      display: 'flex',
    },
  });

  if (input.body_text && input.stat_label) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${s(TYPE.source, w)}px`,
          color: p.textBody,
          fontFamily: font_body,
          textAlign: 'center',
          lineHeight: 1.45,
          maxWidth: `${s(840, w)}px`,
          marginTop: `${s(24, w)}px`,
          fontWeight: 500,
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

  children.push(...footerElements(input, p, w, true));

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 4: SPLIT PANEL ─────────────────────────────────
function layoutSplitPanel(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body, mood } = input;

  const panelWidth = Math.round(w * 0.35);
  const panelChildren: (SatoriNode | string)[] = [];

  panelChildren.push({
    type: 'span',
    props: {
      style: { fontSize: `${s(TYPE.slideCounter, w)}px`, color: withOpacity('#FFFFFF', 0.75), fontFamily: font_body, letterSpacing: '1px', fontWeight: 600 },
      children: `${input.slide_number}/${input.total_slides}`,
    },
  });

  if (input.stat_number) {
    panelChildren.push({
      type: 'div',
      props: {
        style: { fontSize: `${t('statNumberPanel', mood, w, 'stat')}px`, fontWeight: 800, color: '#FFFFFF', fontFamily: font_heading, lineHeight: 0.95, marginTop: `${s(20, w)}px`, letterSpacing: '-1px' },
        children: input.stat_number,
      },
    });
    if (input.stat_label) {
      panelChildren.push({
        type: 'div',
        props: {
          style: { fontSize: `${s(TYPE.subtitleSmall, w)}px`, color: withOpacity('#FFFFFF', 0.9), fontFamily: font_body, marginTop: `${s(10, w)}px`, lineHeight: 1.35 },
          children: input.stat_label,
        },
      });
    }
  } else if (input.emoji) {
    panelChildren.push({
      type: 'span',
      props: { style: { fontSize: `${s(TYPE.emojiSmall, w)}px`, marginTop: `${s(20, w)}px` }, children: input.emoji },
    });
  }

  panelChildren.push({
    type: 'div',
    props: {
      style: {
        marginTop: `${s(28, w)}px`,
        fontSize: `${s(TYPE.subtitleSmall, w)}px`,
        color: '#FFFFFF',
        fontFamily: font_body,
        fontWeight: 600,
        border: `2px solid ${withOpacity('#FFFFFF', 0.7)}`,
        padding: `${s(12, w)}px ${s(24, w)}px`,
        borderRadius: `${s(6, w)}px`,
        textAlign: 'center',
      },
      children: 'Saber más',
    },
  });

  const rightChildren: (SatoriNode | string)[] = [];

  if (input.subtitle) {
    rightChildren.push({
      type: 'span',
      props: {
        style: { fontSize: `${s(TYPE.subtitleSmall, w)}px`, letterSpacing: '2px', color: p.accent, fontFamily: font_body, fontWeight: 700 },
        children: input.subtitle.toUpperCase(),
      },
    });
  }

  const titleBase = t('titleContent', mood, w, 'title');
  const titleScale = longWordScale(input.title);
  rightChildren.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${Math.round(titleBase * titleScale)}px`,
        fontWeight: 700,
        color: p.textTitle,
        fontFamily: font_heading,
        lineHeight: 1.12,
        marginTop: `${s(14, w)}px`,
        ...TITLE_BREAK_STYLE,
      },
      children: input.title,
    },
  });

  if (input.body_text) {
    rightChildren.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${t('bodyMedium', mood, w, 'body')}px`, color: p.textBody, fontFamily: font_body,
          lineHeight: 1.5, marginTop: `${s(20, w)}px`,
        },
        children: input.body_text,
      },
    });
  }

  rightChildren.push({
    type: 'span',
    props: {
      style: { fontSize: `${s(TYPE.brandFooter, w)}px`, color: p.textBody, fontFamily: font_body, fontWeight: 500, marginTop: 'auto' },
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

// ── LAYOUT 5: QUOTE BLOCK ─────────────────────────────────
function layoutQuoteBlock(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body, mood } = input;
  const children: (SatoriNode | string)[] = [];
  const content: (SatoriNode | string)[] = [];

  content.push({
    type: 'div',
    props: {
      style: { fontSize: `${s(TYPE.quoteMark, w)}px`, color: p.accent, fontFamily: font_heading, lineHeight: 0.6, opacity: 0.45 },
      children: '\u201C',
    },
  });

  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${t('titleQuote', mood, w, 'title')}px`,
        fontWeight: 400, fontStyle: 'italic',
        color: p.textTitle, fontFamily: font_heading,
        textAlign: 'center', lineHeight: 1.35, maxWidth: `${s(860, w)}px`,
        marginTop: `${s(14, w)}px`,
        ...TITLE_BREAK_STYLE,
      },
      children: input.title,
    },
  });

  const attribution = input.quote_attribution || input.subtitle;
  if (attribution) {
    content.push({
      type: 'div',
      props: {
        style: {
          fontSize: `${s(TYPE.bodyQuote, w)}px`, color: p.accent, fontFamily: font_body,
          fontWeight: 600, marginTop: `${s(32, w)}px`, letterSpacing: '0.5px',
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

  children.push({
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: `${s(40, w)}px`, left: `${s(70, w)}px`, right: `${s(70, w)}px`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 5,
      },
      children: [
        { type: 'span', props: { style: { fontSize: `${s(TYPE.brandFooter, w)}px`, color: p.textBody, fontFamily: font_body, fontWeight: 500 }, children: input.brand_name } },
        { type: 'span', props: { style: { fontSize: `${s(TYPE.slideCounter, w)}px`, color: p.textBody, fontFamily: font_body, fontWeight: 600 }, children: `${input.slide_number}/${input.total_slides}` } },
      ],
    },
  });

  return { type: 'div', props: { style: { width: `${w}px`, height: `${h}px`, display: 'flex', position: 'relative', overflow: 'hidden' }, children } };
}

// ── LAYOUT 6: CTA FINAL ─────────────────────────────────
function layoutCtaFinal(input: LayoutInput): SatoriNode {
  const { palette: p, width: w, height: h, font_heading, font_body, mood } = input;
  const children: (SatoriNode | string)[] = [];
  const content: (SatoriNode | string)[] = [];

  if (input.logo_url) {
    content.push({
      type: 'img',
      props: {
        src: input.logo_url,
        style: { width: `${s(280, w)}px`, height: `${s(280, w)}px`, objectFit: 'contain', marginBottom: `${s(30, w)}px` },
      },
    });
  }

  const ctaTitleBase = t('titleCta', mood, w, 'title');
  const ctaTitleScale = longWordScale(input.brand_name);
  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${Math.round(ctaTitleBase * ctaTitleScale)}px`,
        fontWeight: 700,
        color: p.textTitle,
        fontFamily: font_heading,
        textAlign: 'center',
        lineHeight: 1.15,
        ...TITLE_BREAK_STYLE,
      },
      children: input.brand_name,
    },
  });

  content.push({
    type: 'div',
    props: {
      style: {
        fontSize: `${t('bodyCta', mood, w, 'body')}px`, color: p.textBody, fontFamily: font_body,
        textAlign: 'center', lineHeight: 1.45, maxWidth: `${s(740, w)}px`,
        marginTop: `${s(24, w)}px`,
      },
      children: input.title,
    },
  });

  if (input.body_text) {
    content.push({
      type: 'div',
      props: {
        style: {
          marginTop: `${s(40, w)}px`,
          backgroundColor: p.accent,
          color: p.bgMain,
          fontSize: `${s(TYPE.ctaButton, w)}px`,
          fontWeight: 700,
          fontFamily: font_body,
          padding: `${s(20, w)}px ${s(56, w)}px`,
          borderRadius: `${s(10, w)}px`,
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
