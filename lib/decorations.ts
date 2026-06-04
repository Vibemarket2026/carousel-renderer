// /lib/decorations.ts
// Decoration modules — leaf-node divs with display:flex (Satori requirement)
//
// DESIGN PRINCIPLES (Nov 2025 revision):
//
// 1. SAFE ZONES: brand footer at bottom:40px left:60px and slide counter at
//    bottom:40px right:60px. Decorations must NEVER occupy the bottom 12%
//    of the canvas.
//
// 2. CONTENT ZONES: titles/stats live in the centered vertical band
//    (roughly 40-60% width centered, 30-70% height centered). Decorations
//    must avoid this zone or risk overlapping text — the worst case we
//    hit was a small circle landing on the word "permiten" in a big_stat
//    explanatory line.
//
// 3. OPACITY: every decoration carries an explicit `opacity` prop in the
//    0.35-0.55 range. Relying on the palette's color alpha is unreliable
//    because some moods deliver solid hex (pastel/light/split) and some
//    deliver alpha-baked rgba (dark/bold/gradient).

import { SatoriNode } from './types.js';

export type DecorationType = 'none' | 'accent_line' | 'geometric_circles' | 'corner_block' | 'dot_pattern';

interface DecorationConfig {
  color: string;
  colorSoft: string;
  width: number;
  height: number;
}

export function generateDecorations(
  type: DecorationType,
  config: DecorationConfig
): SatoriNode[] {
  const { color, colorSoft, width, height } = config;

  switch (type) {
    case 'none':
      return [];

    case 'accent_line':
      return [
        // Vertical line, full height, left edge — thin so it can stay
        // present without competing with content.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', left: '0',
              width: '6px', height: '100%',
              background: `linear-gradient(to bottom, ${color}, ${colorSoft})`,
              opacity: 0.6,
              zIndex: 3, display: 'flex',
            },
          },
        },
        // Horizontal accent bar in the upper-right zone, above any title.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.2)}px`,
              right: `${Math.round(width * 0.06)}px`,
              width: `${Math.round(width * 0.1)}px`,
              height: '4px',
              backgroundColor: color,
              opacity: 0.55,
              zIndex: 3, display: 'flex',
            },
          },
        },
      ];

    case 'geometric_circles':
      // Three circles, all positioned to stay clear of the centered
      // content column AND the bottom footer band.
      return [
        // Top-right large arc — mostly off-canvas, only a corner shows.
        // Negative offset puts the visible portion fully in the corner.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(-height * 0.08)}px`,
              right: `${Math.round(-width * 0.08)}px`,
              width: `${Math.round(width * 0.28)}px`,
              height: `${Math.round(width * 0.28)}px`,
              borderRadius: '50%',
              backgroundColor: colorSoft,
              opacity: 0.5,
              zIndex: 2, display: 'flex',
            },
          },
        },
        // Mid-left small arc — partly off-canvas at left edge, sits well
        // above where text typically wraps, well below the title band.
        // Top 18% → well above the centered stat (which sits ~50% from top).
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.18)}px`,
              left: `${Math.round(-width * 0.04)}px`,
              width: `${Math.round(width * 0.09)}px`,
              height: `${Math.round(width * 0.09)}px`,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.32,
              zIndex: 2, display: 'flex',
            },
          },
        },
        // Third small dot in the TOP area (was previously at 60% from top,
        // right 10% — that position landed directly on the explanatory
        // text in big_stat slides). Now safely above the title band.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.06)}px`,
              right: `${Math.round(width * 0.28)}px`,
              width: `${Math.round(width * 0.035)}px`,
              height: `${Math.round(width * 0.035)}px`,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.45,
              zIndex: 2, display: 'flex',
            },
          },
        },
      ];

    case 'corner_block':
      // All three elements live in the TOP half + RIGHT edge — never
      // in the bottom-left or bottom-right where the brand footer and
      // slide counter live.
      return [
        // Top-right wide thin bar.
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', right: '0',
              width: `${Math.round(width * 0.3)}px`,
              height: `${Math.round(height * 0.022)}px`,
              backgroundColor: color,
              opacity: 0.42,
              zIndex: 2, display: 'flex',
            },
          },
        },
        // Top-left small block (corner accent).
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', left: '0',
              width: `${Math.round(width * 0.14)}px`,
              height: `${Math.round(height * 0.045)}px`,
              backgroundColor: colorSoft,
              opacity: 0.55,
              zIndex: 2, display: 'flex',
            },
          },
        },
        // Right-edge vertical accent (mid-canvas, narrow).
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.18)}px`,
              right: '0',
              width: '5px',
              height: `${Math.round(height * 0.32)}px`,
              backgroundColor: color,
              opacity: 0.4,
              zIndex: 2, display: 'flex',
            },
          },
        },
      ];

    case 'dot_pattern': {
      // Compact 5×4 grid tucked in the TOP-RIGHT corner only. Previous
      // 8×5 grid extended down to ~50% from top which started competing
      // with stat numbers and titles. The new footprint stays within the
      // top 25% of the canvas.
      const dots: SatoriNode[] = [];
      const dotSize = Math.max(5, Math.round(width * 0.008));
      const spacing = Math.round(width * 0.05);
      const offsetX = Math.round(width * 0.7);
      const offsetY = Math.round(height * 0.06);

      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          dots.push({
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: `${offsetY + row * spacing}px`,
                left: `${offsetX + col * spacing}px`,
                width: `${dotSize}px`,
                height: `${dotSize}px`,
                borderRadius: '50%',
                backgroundColor: color,
                opacity: 0.5,
                zIndex: 2, display: 'flex',
              },
            },
          });
        }
      }
      return dots;
    }
  }
}
