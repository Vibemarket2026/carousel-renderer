// /lib/decorations.ts
// Decoration modules — leaf-node divs with display:flex (Satori requirement)
//
// SAFE ZONES (Nov 2025): all layouts place brand footer at bottom-left
// (around bottom:40px left:60px) and slide counter at top-right
// (around top:40px right:40px). Decorations MUST stay clear of these
// zones to avoid the kind of overlap we hit on the Fisiobárica deck
// where a corner_block sat behind the brand name.

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
      // Vertical accent line on left edge (full height) + horizontal accent
      // moved UP to the title zone (was at bottom 12% which is too close
      // to the brand footer when footer text wraps).
      return [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', left: '0',
              width: '5px', height: '100%',
              background: `linear-gradient(to bottom, ${color}, ${colorSoft})`,
              zIndex: 3, display: 'flex',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.18)}px`,
              right: `${Math.round(width * 0.06)}px`,
              width: `${Math.round(width * 0.1)}px`,
              height: '3px',
              backgroundColor: color,
              opacity: 0.5,
              zIndex: 3, display: 'flex',
            },
          },
        },
      ];

    case 'geometric_circles':
      // Top-right large circle (partly off-canvas), top-left small accent,
      // mid-right tiny dot. NO bottom-left circle (was clipping into the
      // brand footer area on tall canvases).
      return [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(-height * 0.04)}px`,
              right: `${Math.round(-width * 0.04)}px`,
              width: `${Math.round(width * 0.22)}px`,
              height: `${Math.round(width * 0.22)}px`,
              borderRadius: '50%',
              backgroundColor: colorSoft,
              zIndex: 2, display: 'flex',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.32)}px`,
              left: `${Math.round(-width * 0.06)}px`,
              width: `${Math.round(width * 0.14)}px`,
              height: `${Math.round(width * 0.14)}px`,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.14,
              zIndex: 2, display: 'flex',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.6)}px`,
              right: `${Math.round(width * 0.1)}px`,
              width: `${Math.round(width * 0.05)}px`,
              height: `${Math.round(width * 0.05)}px`,
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.1,
              zIndex: 2, display: 'flex',
            },
          },
        },
      ];

    case 'corner_block':
      // REDESIGNED: previous version had a solid block at bottom:0 left:0
      // that sat directly behind the brand-name footer (e.g. Fisiobárica
      // Wellness deck). All elements now live in the TOP half of the canvas
      // and on the RIGHT edge, never within ~18% of the bottom-left corner.
      return [
        // Top-right horizontal block (sits ABOVE the slide counter row, which
        // is at top:40px right:40px with ~38px font height = clear of 70px+)
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', right: '0',
              width: `${Math.round(width * 0.28)}px`,
              height: `${Math.round(height * 0.018)}px`,
              backgroundColor: color,
              opacity: 0.35,
              zIndex: 2, display: 'flex',
            },
          },
        },
        // Top-left compact accent (replaces the old bottom-left block)
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', left: '0',
              width: `${Math.round(width * 0.12)}px`,
              height: `${Math.round(height * 0.04)}px`,
              backgroundColor: colorSoft,
              zIndex: 2, display: 'flex',
            },
          },
        },
        // Right-edge vertical accent (mid-canvas)
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.18)}px`,
              right: '0',
              width: '4px',
              height: `${Math.round(height * 0.32)}px`,
              backgroundColor: color,
              opacity: 0.28,
              zIndex: 2, display: 'flex',
            },
          },
        },
      ];

    case 'dot_pattern': {
      // Dot grid stays in the top-right quadrant, well clear of footer.
      const dots: SatoriNode[] = [];
      const dotSize = Math.max(4, Math.round(width * 0.006));
      const spacing = Math.round(width * 0.06);
      const offsetX = Math.round(width * 0.65);
      const offsetY = Math.round(height * 0.05);

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 5; col++) {
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
                opacity: 0.2,
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
