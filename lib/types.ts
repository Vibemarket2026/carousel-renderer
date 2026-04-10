// /lib/types.ts
// Shared types for the Vibemarket Render Engine

// ── Satori Node (what Satori accepts as input) ───────────────

export interface SatoriNode {
  type: string;
  props: {
    style?: Record<string, any>;
    children?: (SatoriNode | string)[] | SatoriNode | string;
    src?: string;
    [key: string]: any;
  };
}

// ── API Request Schema ───────────────────────────────────────

export interface RenderSlideRequest {
  // Slide content
  slide_number: number;
  total_slides: number;
  slide_type: 'cover' | 'content' | 'big_stat' | 'quote' | 'cta';
  title: string;
  subtitle?: string;
  body_text?: string;
  stat_number?: string;       // For big_stat: "85%", "3x", "€450"
  stat_label?: string;        // For big_stat: "de pacientes mejoran"
  quote_attribution?: string; // For quote: "— María G., paciente"
  emoji?: string;

  // Brand identity
  brand: {
    name: string;
    color_primary: string;    // Hex: "#2D5A3D"
    color_secondary: string;  // Hex: "#E8A87C"
    font_heading: string;     // "Montserrat", "Playfair Display", etc.
    font_body: string;        // "Inter", "Open Sans", etc.
    logo_url?: string | null;
  };

  // Design control
  mood: MoodName;
  layout: LayoutName;
  decoration: DecorationType;

  // Optional asset
  asset_url?: string | null;
  use_asset_as?: 'featured' | 'background' | null;

  // Output dimensions
  output?: {
    width: number;    // default 1080
    height: number;   // default 1350 (4:5), 900 for GMB (4:3)
    format: 'png';
  };
}

// ── API Response Schema ──────────────────────────────────────

export interface RenderSlideResponse {
  success: boolean;
  image_base64?: string;
  dimensions?: { width: number; height: number };
  render_time_ms?: number;
  error?: string;
  details?: string;
}

// ── Mood System ──────────────────────────────────────────────

export type MoodName =
  | 'dark_minimal'
  | 'light_clean'
  | 'bold_primary'
  | 'soft_pastel'
  | 'color_block'
  | 'warm_gradient';

export const ALL_MOODS: MoodName[] = [
  'dark_minimal',
  'light_clean',
  'bold_primary',
  'soft_pastel',
  'color_block',
  'warm_gradient',
];

// ── Layout System ────────────────────────────────────────────

export type LayoutName =
  | 'centered'       // Title + body centered vertically
  | 'left_aligned'   // Title left, body left, editorial feel
  | 'big_stat'       // Giant number + label centered
  | 'split_panel'    // Left color panel + right content (great for GMB)
  | 'quote_block'    // Quote marks + attribution
  | 'cta_final';     // Brand name + CTA + optional logo

export const ALL_LAYOUTS: LayoutName[] = [
  'centered',
  'left_aligned',
  'big_stat',
  'split_panel',
  'quote_block',
  'cta_final',
];

// ── Decoration System ────────────────────────────────────────

export type DecorationType =
  | 'none'
  | 'accent_line'
  | 'geometric_circles'
  | 'corner_block'
  | 'dot_pattern';

export const ALL_DECORATIONS: DecorationType[] = [
  'none',
  'accent_line',
  'geometric_circles',
  'corner_block',
  'dot_pattern',
];

// ── Font Registry ────────────────────────────────────────────

export interface FontFile {
  file: string;
  weight: number;
  style: 'normal' | 'italic';
}

export const FONT_REGISTRY: Record<string, FontFile[]> = {
  'Inter':            [{ file: 'Inter-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Inter-Bold.ttf', weight: 700, style: 'normal' }],
  'Roboto':           [{ file: 'Roboto-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Roboto-Bold.ttf', weight: 700, style: 'normal' }],
  'Open Sans':        [{ file: 'OpenSans-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'OpenSans-Bold.ttf', weight: 700, style: 'normal' }],
  'Montserrat':       [{ file: 'Montserrat-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Montserrat-Bold.ttf', weight: 700, style: 'normal' }],
  'Poppins':          [{ file: 'Poppins-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Poppins-Bold.ttf', weight: 700, style: 'normal' }],
  'Lato':             [{ file: 'Lato-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Lato-Bold.ttf', weight: 700, style: 'normal' }],
  'Raleway':          [{ file: 'Raleway-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Raleway-Bold.ttf', weight: 700, style: 'normal' }],
  'Playfair Display': [{ file: 'PlayfairDisplay-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'PlayfairDisplay-Bold.ttf', weight: 700, style: 'normal' }],
  'Merriweather':     [{ file: 'Merriweather-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Merriweather-Bold.ttf', weight: 700, style: 'normal' }],
  'Nunito':           [{ file: 'Nunito-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Nunito-Bold.ttf', weight: 700, style: 'normal' }],
  'Source Sans Pro':  [{ file: 'SourceSansPro-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'SourceSansPro-Bold.ttf', weight: 700, style: 'normal' }],
  'Work Sans':        [{ file: 'WorkSans-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'WorkSans-Bold.ttf', weight: 700, style: 'normal' }],
  'DM Sans':          [{ file: 'DMSans-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'DMSans-Bold.ttf', weight: 700, style: 'normal' }],
  'Outfit':           [{ file: 'Outfit-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'Outfit-Bold.ttf', weight: 700, style: 'normal' }],
  'Plus Jakarta Sans':[{ file: 'PlusJakartaSans-Regular.ttf', weight: 400, style: 'normal' },
                       { file: 'PlusJakartaSans-Bold.ttf', weight: 700, style: 'normal' }],
};
