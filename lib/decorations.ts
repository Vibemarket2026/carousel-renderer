// /lib/decorations.ts
// Decoration modules — leaf-node divs with display:flex (Satori requirement)

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
        { type: 'div', props: { style: { position: 'absolute', top: '0', left: '0', width: '5px', height: '100%', background: `linear-gradient(to bottom, ${color}, ${colorSoft})`, zIndex: 3, display: 'flex' } } },
        { type: 'div', props: { style: { position: 'absolute', bottom: `${Math.round(height * 0.12)}px`, left: `${Math.round(width * 0.06)}px`, width: `${Math.round(width * 0.08)}px`, height: '2px', backgroundColor: color, opacity: 0.4, zIndex: 3, display: 'flex' } } },
      ];

    case 'geometric_circles':
      return [
        { type: 'div', props: { style: { position: 'absolute', top: `${Math.round(-height * 0.04)}px`, right: `${Math.round(-width * 0.04)}px`, width: `${Math.round(width * 0.2)}px`, height: `${Math.round(width * 0.2)}px`, borderRadius: '50%', backgroundColor: colorSoft, zIndex: 2, display: 'flex' } } },
        { type: 'div', props: { style: { position: 'absolute', bottom: `${Math.round(height * 0.06)}px`, left: `${Math.round(-width * 0.05)}px`, width: `${Math.round(width * 0.13)}px`, height: `${Math.round(width * 0.13)}px`, borderRadius: '50%', backgroundColor: color, opacity: 0.12, zIndex: 2, display: 'flex' } } },
        { type: 'div', props: { style: { position: 'absolute', top: `${Math.round(height * 0.55)}px`, right: `${Math.round(width * 0.08)}px`, width: `${Math.round(width * 0.06)}px`, height: `${Math.round(width * 0.06)}px`, borderRadius: '50%', backgroundColor: color, opacity: 0.08, zIndex: 2, display: 'flex' } } },
      ];

    case 'corner_block':
      return [
        { type: 'div', props: { style: { position: 'absolute', top: '0', right: '0', width: `${Math.round(width * 0.25)}px`, height: `${Math.round(height * 0.08)}px`, backgroundColor: color, opacity: 0.1, zIndex: 2, display: 'flex' } } },
        { type: 'div', props: { style: { position: 'absolute', bottom: '0', left: '0', width: `${Math.round(width * 0.15)}px`, height: `${Math.round(height * 0.05)}px`, backgroundColor: colorSoft, zIndex: 2, display: 'flex' } } },
        { type: 'div', props: { style: { position: 'absolute', top: `${Math.round(height * 0.15)}px`, right: '0', width: '3px', height: `${Math.round(height * 0.3)}px`, backgroundColor: color, opacity: 0.2, zIndex: 2, display: 'flex' } } },
      ];

    case 'dot_pattern':
      const dots: SatoriNode[] = [];
      const dotSize = Math.round(width * 0.005);
      const spacing = Math.round(width * 0.06);
      const offsetX = Math.round(width * 0.65);
      const offsetY = Math.round(height * 0.05);

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 5; col++) {
          dots.push({ type: 'div', props: { style: { position: 'absolute', top: `${offsetY + row * spacing}px`, left: `${offsetX + col * spacing}px`, width: `${dotSize}px`, height: `${dotSize}px`, borderRadius: '50%', backgroundColor: color, opacity: 0.15, zIndex: 2, display: 'flex' } } });
        }
      }
      return dots;
  }
}
