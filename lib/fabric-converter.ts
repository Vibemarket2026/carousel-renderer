// /lib/fabric-converter.ts
// Reescritura: Mapeo matemático directo. Ignoramos el SVG generado por Satori 
// para evitar los problemas de conversión de textos a <path>.

import { MoodName, DecorationType } from './types.js';
import { DerivedPalette, derivePalette } from './contrast.js';
import { TYPE, s, LayoutInput } from './layouts.js';

export interface FabricBackground {
  type: 'solid' | 'gradient';
  color?: string;
  gradientType?: 'linear';
  coords?: { x1: number; y1: number; x2: number; y2: number };
  colorStops?: { offset: number; color: string }[];
}

export interface FabricElement {
  type: 'textbox' | 'rect' | 'circle' | 'line';
  id?: string;
  left: number;
  top: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fill?: string;
  opacity?: number;
  textAlign?: string;
  lineHeight?: number;
  editable?: boolean;
  role?: string;
}

export interface FabricSlide {
  slide_number: number;
  slide_type: string;
  background: FabricBackground;
  elements: FabricElement[];
}

// ── Background Builder ───────────────────────────────────────
function buildFabricBackground(mood: MoodName, palette: DerivedPalette, width: number, height: number): FabricBackground {
  switch (mood) {
    case 'warm_gradient':
    case 'soft_pastel':
      return {
        type: 'gradient',
        gradientType: 'linear',
        coords: { x1: 0, y1: 0, x2: width, y2: height },
        colorStops: [
          { offset: 0, color: palette.gradientFrom },
          { offset: 1, color: palette.gradientTo },
        ],
      };
    default:
      return { type: 'solid', color: palette.bgMain };
  }
}

// ── Mathematical Layout Mappers ──────────────────────────────
// En lugar de parsear SVG, calculamos las coordenadas exactas de Fabric
// basándonos en las reglas de Flexbox delayouts.ts

function mapCenteredLayout(input: LayoutInput, p: DerivedPalette, w: number, h: number): FabricElement[] {
  const elements: FabricElement[] = [];
  const paddingX = s(80, w);
  const maxWidth = w - (paddingX * 2);
  let currentY = h * 0.35; // Aproximación del centro vertical basado en flexbox

  if (input.subtitle) {
    elements.push({
      type: 'textbox', id: 'subtitle',
      left: paddingX, top: currentY, width: maxWidth,
      text: input.subtitle.toUpperCase(),
      fontSize: s(TYPE.subtitle, w), fontFamily: input.font_heading, fontWeight: 700,
      fill: p.accent, textAlign: 'center', role: 'subtitle'
    });
    currentY += s(TYPE.subtitle + 40, w);
  }

  elements.push({
    type: 'textbox', id: 'title',
    left: paddingX, top: currentY, width: maxWidth,
    text: input.title,
    fontSize: s(TYPE.titleContent, w), fontFamily: input.font_heading, fontWeight: 800,
    fill: p.textTitle, textAlign: 'center', lineHeight: 1.1, role: 'title'
  });
  
  // Estimación de altura del título basada en longitud para empujar el body
  const titleLines = Math.ceil(input.title.length / 20); 
  currentY += s(TYPE.titleContent, w) * titleLines + s(40, w);

  if (input.body_text) {
    const bodyWidth = maxWidth * 0.85;
    elements.push({
      type: 'textbox', id: 'body',
      left: w/2 - bodyWidth/2, top: currentY, width: bodyWidth,
      text: input.body_text,
      fontSize: s(TYPE.bodyLarge, w), fontFamily: input.font_body, fontWeight: 400,
      fill: p.textBody, textAlign: 'center', lineHeight: 1.4, role: 'body'
    });
  }

  return elements;
}

function mapLeftAlignedLayout(input: LayoutInput, p: DerivedPalette, w: number, h: number): FabricElement[] {
  const elements: FabricElement[] = [];
  const paddingX = s(100, w);
  const maxWidth = w - (paddingX * 2);
  let currentY = h * 0.30;

  if (input.subtitle) {
    elements.push({
      type: 'textbox', id: 'subtitle',
      left: paddingX, top: currentY, width: maxWidth,
      text: input.subtitle.toUpperCase(),
      fontSize: s(TYPE.subtitle, w), fontFamily: input.font_heading, fontWeight: 700,
      fill: p.accent, textAlign: 'left', role: 'subtitle'
    });
    currentY += s(TYPE.subtitle + 40, w);
  }

  elements.push({
    type: 'textbox', id: 'title',
    left: paddingX, top: currentY, width: maxWidth,
    text: input.title,
    fontSize: s(TYPE.titleLeft, w), fontFamily: input.font_heading, fontWeight: 800,
    fill: p.textTitle, textAlign: 'left', lineHeight: 1.1, role: 'title'
  });
  
  const titleLines = Math.ceil(input.title.length / 18);
  currentY += s(TYPE.titleLeft, w) * titleLines + s(40, w);

  if (input.body_text) {
    elements.push({
      type: 'textbox', id: 'body',
      left: paddingX, top: currentY, width: maxWidth,
      text: input.body_text,
      fontSize: s(TYPE.bodyLarge, w), fontFamily: input.font_body, fontWeight: 400,
      fill: p.textBody, textAlign: 'left', lineHeight: 1.5, role: 'body'
    });
  }

  return elements;
}

// ── Main Conversion Function ─────────────────────────────────

export function convertSlideToFabric(
  slideData: any // Recibe el JSON completo en lugar de un string SVG
): FabricSlide {
  
  const paletteType = ({
    dark_minimal: 'dark', light_clean: 'light', bold_primary: 'bold',
    soft_pastel: 'pastel', color_block: 'split', warm_gradient: 'gradient',
  } as const)[slideData.mood as MoodName] || 'light';
  
  const palette = derivePalette(slideData.primary, slideData.secondary, paletteType);
  const background = buildFabricBackground(slideData.mood, palette, slideData.width, slideData.height);
  
  // Transformar input genérico a LayoutInput
  const layoutInput: LayoutInput = {
    ...slideData,
    palette,
    font_heading: slideData.font_heading || 'Inter',
    font_body: slideData.font_body || 'Inter',
  };

  // Dispatcher matemático según el layout
  let elements: FabricElement[] = [];
  const layoutName = slideData.layout || 'centered';

  if (['left_aligned', 'split_panel', 'quote_block'].includes(layoutName)) {
    elements = mapLeftAlignedLayout(layoutInput, palette, slideData.width, slideData.height);
  } else {
    elements = mapCenteredLayout(layoutInput, palette, slideData.width, slideData.height);
  }
  
  return {
    slide_number: slideData.slide_number,
    slide_type: slideData.slide_type,
    background,
    elements,
  };
}
