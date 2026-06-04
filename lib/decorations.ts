// /lib/decorations.ts
// Decoration modules — leaf-node divs with display:flex (Satori requirement)
//
// SAFE ZONES: brand footer at bottom:40px left:60px; slide counter at
// top:40px right:40px. Decorations stay clear of those zones.
// Opacity floors raised so decorations stay visible on pastel/light moods
// where decorationColor is already withOpacity(primary, 0.14).

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
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', left: '0',
              width: '6px', height: '100%',
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
              top: `${Math.round(height * 0.2)}px`,
              right: `${Math.round(width * 0.06)}px`,
              width: `${Math.round(width * 0.1)}px`,
              height: '4px',
              backgroundColor: color,
              zIndex: 3, display: 'flex',
            },
          },
        },
      ];

    case 'geometric_circles':
      return [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(-height * 0.04)}px`,
              right: `${Math.round(-width * 0.04)}px`,
              width: `${Math.round(width * 0.24)}px`,
              height: `${Math.round(width * 0.24)}px`,
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
              width: `${Math.round(width * 0.15)}px`,
              height: `${Math.round(width * 0.15)}px`,
              borderRadius: '50%',
              backgroundColor: color,
              zIndex: 2, display: 'flex',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              top: `${Math.round(height * 0.62)}px`,
              right: `${Math.round(width * 0.1)}px`,
              width: `${Math.round(width * 0.06)}px`,
              height: `${Math.round(width * 0.06)}px`,
              borderRadius: '50%',
              backgroundColor: color,
              zIndex: 2, display: 'flex',
            },
          },
        },
      ];

    case 'corner_block':
      // All elements in TOP half + RIGHT edge. Never near bottom-left
      // (that zone is reserved for the brand footer).
      return [
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', right: '0',
              width: `${Math.round(width * 0.3)}px`,
              height: `${Math.round(height * 0.022)}px`,
              backgroundColor: color,
              zIndex: 2, display: 'flex',
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: '0', left: '0',
              width: `${Math.round(width * 0.14)}px`,
              height: `${Math.round(height * 0.045)}px`,
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
              top: `${Math.round(height * 0.18)}px`,
              right: '0',
              width: '5px',
              height: `${Math.round(height * 0.32)}px`,
              backgroundColor: color,
              zIndex: 2, display: 'flex',
            },
          },
        },
      ];

    case 'dot_pattern': {
      // Dot grid in top-right quadrant. Bigger dots + no opacity multiplier
      // (decorationColor already has appropriate alpha baked in for each mood).
      const dots: SatoriNode[] = [];
      const dotSize = Math.max(6, Math.round(width * 0.009));
      const spacing = Math.round(width * 0.055);
      const offsetX = Math.round(width * 0.62);
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
