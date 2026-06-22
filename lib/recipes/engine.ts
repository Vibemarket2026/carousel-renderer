// /lib/recipes/engine.ts
// Descriptor interpreter for the recipe engine. The agent picks a recipe + a
// skeleton (template) per slide and supplies content; this builds the Satori
// node deterministically. Brand-agnostic: the palette comes from tokens.ts.
//
// STAGED: this first cut ships the two recipes whose code is fully validated
// (Bold Promo, Studio Lux) to prove the end-to-end pipeline (runtime fonts +
// Satori 0.10). The other five (Clinical Editorial, Data Story, Soft Wellness,
// Mono Premium, Noir) land in a follow-up commit once a preview render is OK.
//
// Node format is the plain JSX-object shape Satori accepts: { type, props }.

import { deriveTokens, Tokens } from './tokens.js';

const W = 1080, H = 1350, PADX = 86, SAFE_BOTTOM = 184;
const NUM_LH = 1.12; // overlap guard: big glyphs never overflow upward into the line above

type AnyObj = Record<string, any>;

const clean = (o: AnyObj): AnyObj => {
  const r: AnyObj = {};
  for (const k in o) { const v = o[k]; if (v !== undefined && v !== null) r[k] = v; }
  return r;
};
const div = (style: AnyObj, children?: any): AnyObj => ({ type: 'div', props: clean({ style: clean({ display: 'flex', ...style }), children }) });
const col = (style: AnyObj, children?: any): AnyObj => div({ flexDirection: 'column', ...style }, children);
const row = (style: AnyObj, children?: any): AnyObj => div({ flexDirection: 'row', ...style }, children);

// ── Recipes (art directions) ────────────────────────────────
// variant + font roles (display/body/mono -> family names) + shape (radii) +
// optional ink policy + full type scale (per role: font role, size, line-height,
// weight, letter-spacing, uppercase, italic).
export const RECIPES: AnyObj = {
  bold_promo: {
    variant: 'light', display: 'Anton', body: 'Archivo', mono: 'Archivo', buttonRadius: 4, cardRadius: 12,
    type: {
      display: { f: 'display', size: 150, lh: 0.96, w: 400, up: true }, h1: { f: 'display', size: 112, lh: 0.98, w: 400, up: true },
      lead: { f: 'body', size: 40, lh: 1.34, w: 500 }, body: { f: 'body', size: 38, lh: 1.42, w: 400 },
      eyebrow: { f: 'body', size: 26, lh: 1.2, w: 700, ls: 4, up: true },
      index: { f: 'display', size: 240, lh: 1.0, w: 400 }, stat: { f: 'display', size: 360, lh: 0.92, w: 400 },
      statLabel: { f: 'body', size: 44, lh: 1.26, w: 600 }, quote: { f: 'display', size: 84, lh: 1.04, w: 400, up: true },
      attribution: { f: 'body', size: 28, lh: 1.3, w: 600 }, cta: { f: 'display', size: 120, lh: 0.98, w: 400, up: true },
      button: { f: 'body', size: 33, lh: 1, w: 700 }, footer: { f: 'body', size: 22, lh: 1, w: 600, ls: 1 },
      statBig: { f: 'display', size: 112, lh: 1.0, w: 400 }, smallLabel: { f: 'body', size: 26, lh: 1.25, w: 600 },
    },
  },
  studio_lux: {
    variant: 'light', display: 'Cormorant Garamond', body: 'Jost', mono: 'Jost', buttonRadius: 0, cardRadius: 4,
    type: {
      display: { f: 'display', size: 138, lh: 1.04, w: 400 }, h1: { f: 'display', size: 96, lh: 1.06, w: 400 },
      lead: { f: 'body', size: 38, lh: 1.4, w: 400 }, body: { f: 'body', size: 37, lh: 1.46, w: 400 },
      eyebrow: { f: 'body', size: 24, lh: 1.2, w: 500, ls: 6, up: true },
      index: { f: 'display', size: 220, lh: 1.04, w: 400 }, stat: { f: 'display', size: 320, lh: 1.02, w: 400 },
      statLabel: { f: 'body', size: 40, lh: 1.3, w: 400 }, quote: { f: 'display', size: 84, lh: 1.16, w: 400, italic: true },
      attribution: { f: 'body', size: 26, lh: 1.3, w: 500 }, cta: { f: 'display', size: 96, lh: 1.05, w: 400 },
      button: { f: 'body', size: 29, lh: 1, w: 500, ls: 1 }, footer: { f: 'body', size: 22, lh: 1, w: 400, ls: 3 },
      statBig: { f: 'display', size: 92, lh: 1.04, w: 500 }, smallLabel: { f: 'body', size: 24, lh: 1.3, w: 500 },
    },
  },
};

function inAccentTokens(tk: any): any {
  const c = tk.accentText;
  return { ...tk, bgMain: tk.accent, bgPanel: tk.accent, surface: c, textTitle: c, textBody: c, textMuted: c, accent: c, accentSoft: c, hairline: c, accentText: tk.accent };
}
function inPhotoTokens(tk: any): any {
  return { ...tk, textTitle: '#FBF7F2', textBody: 'rgba(251,247,242,0.88)', textMuted: 'rgba(251,247,242,0.72)', accent: tk.accentSoft, accentSoft: 'rgba(255,255,255,0.22)', hairline: 'rgba(255,255,255,0.45)' };
}

// ── Block primitives ────────────────────────────────────────
// (This staged engine implements the primitives Bold Promo + Studio Lux use.
//  index / statBig / bars / statGrid / statRow / list / checklist / twoColumn
//  arrive with the data/soft/clinical recipes.)
function renderBlock(b: any, ctx: any): any {
  const { recipe, tk, content, align } = ctx;
  const t = (role: string) => recipe.type[role];
  const fam = (role: string) => recipe[t(role).f] || t(role).f;
  const ink = (role: string, def: string) => tk[(recipe.ink && recipe.ink[role]) || def];
  const ta = align === 'left' ? 'left' : 'center';
  const val = b.field ? content[b.field] : b.text;

  const textNode = (role: string, value: any, color: string, extra?: any): any => {
    const r = t(role);
    return div(clean({
      fontFamily: fam(role), fontSize: r.size, fontWeight: r.w, lineHeight: r.lh,
      letterSpacing: r.ls, textTransform: r.up ? 'uppercase' : undefined,
      fontStyle: r.italic ? 'italic' : undefined, color, textAlign: ta, maxWidth: W - PADX * 2, ...extra,
    }), String(value));
  };

  switch (b.kind) {
    case 'eyebrow':
      if (!val) return null;
      return textNode('eyebrow', val, ink('eyebrow', 'accent'), { marginBottom: 18 });
    case 'rule':
      return div({ width: 64, height: 4, backgroundColor: ink('rule', 'accent'), marginBottom: 24, borderRadius: 2 });
    case 'title':
      if (!val) return null;
      return textNode(b.scale || 'h1', val, ink('title', 'textTitle'));
    case 'body':
      if (!val) return null;
      return textNode(b.scale || 'body', val, tk.textBody, { marginTop: 24 });
    case 'statNumber':
      if (!val) return null;
      return textNode('stat', val, ink('stat', 'accent'), { lineHeight: NUM_LH, marginBottom: 10 });
    case 'statLabel':
      if (!val) return null;
      return textNode('statLabel', val, tk.textBody, { marginTop: 4 });
    case 'quoteMark':
      return textNode('quote', '\u201C', ink('quoteMark', 'accentSoft'), { marginBottom: -8, lineHeight: 0.9 });
    case 'quote':
      if (!val) return null;
      return textNode('quote', val, ink('quote', 'textTitle'));
    case 'attribution':
      if (!val) return null;
      return textNode('attribution', val, tk.textMuted, { marginTop: 28 });
    case 'ctaButton': {
      if (!val) return null;
      const r = t('button');
      return row(clean({
        marginTop: 38, backgroundColor: tk.accent, paddingLeft: 40, paddingRight: 38,
        paddingTop: 22, paddingBottom: 22, borderRadius: recipe.buttonRadius ?? 6, alignItems: 'center',
      }), [
        div({ fontFamily: recipe.body, fontSize: r.size, fontWeight: r.w, letterSpacing: r.ls, color: tk.accentText }, String(val)),
        div({ width: 11, height: 11, borderRight: `2.5px solid ${tk.accentText}`, borderTop: `2.5px solid ${tk.accentText}`, transform: 'rotate(45deg)', marginLeft: 16, marginTop: 1 }),
      ]);
    }
    case 'logo': {
      if (content.logo_url) {
        return div({ marginBottom: 26 }, [{ type: 'img', props: { src: content.logo_url, style: { display: 'flex', height: 64, objectFit: 'contain' } } }]);
      }
      const mono = b.text || (content.brand_name ? String(content.brand_name).slice(0, 1).toUpperCase() : 'V');
      const children = [
        div({ width: 56, height: 56, borderRadius: recipe.buttonRadius === 999 ? 999 : 12, backgroundColor: tk.accent, alignItems: 'center', justifyContent: 'center' }, [
          div({ fontFamily: recipe.display, fontSize: 30, fontWeight: 700, color: tk.accentText }, mono),
        ]),
      ];
      if (content.brand_name) children.push(div({ fontFamily: recipe.body, fontSize: 30, fontWeight: 700, color: tk.textTitle, marginLeft: 16 }, content.brand_name));
      return row({ marginBottom: 26, alignItems: 'center' }, children);
    }
    default:
      return null;
  }
}

export function composeFromTemplate(desc: any, content: any, tk0: any, recipe: any): any {
  const align = desc.align || 'center';
  const justify = desc.vAnchor === 'top' ? 'flex-start' : desc.vAnchor === 'bottom' ? 'flex-end' : 'center';
  const itemsAlign = align === 'left' ? 'flex-start' : 'center';
  const tk = desc.onAccent ? inAccentTokens(tk0) : desc.photo ? inPhotoTokens(tk0) : tk0;

  let bgStyle: AnyObj = { backgroundColor: tk.bgMain };
  if (desc.onAccent) bgStyle = { backgroundColor: tk0.accent };
  else if (desc.background?.style === 'panel') bgStyle = { backgroundColor: tk.bgPanel };
  else if (desc.background?.style === 'gradient') bgStyle = { backgroundImage: `linear-gradient(160deg, ${tk.gradFrom}, ${tk.gradTo})` };
  else if (desc.background?.style === 'grid') bgStyle = { backgroundColor: tk.bgMain, backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 79px, ${tk.border} 79px, ${tk.border} 80px)` };
  if (desc.card) bgStyle = { backgroundColor: tk.bgPanel };

  const layers: any[] = [];
  if (desc.photo) {
    if (content.asset_url) layers.push({ type: 'img', props: { src: content.asset_url, style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' } } });
    else layers.push(div({ position: 'absolute', top: 0, left: 0, width: W, height: H, backgroundImage: `linear-gradient(150deg, ${tk0.textTitle}, ${tk0.accent})` }));
    layers.push(div({ position: 'absolute', top: 0, left: 0, width: W, height: H, backgroundImage: `linear-gradient(180deg, rgba(12,10,9,0.32), rgba(12,10,9,0.74))` }));
  }
  if (desc.frame) layers.push(div({ position: 'absolute', top: 46, left: 46, right: 46, bottom: 46, border: `1.5px solid ${desc.frameColor === 'accent' ? tk.accent : tk.hairline}`, borderRadius: 2 }));

  const blocks = desc.blocks.map((b: any) => renderBlock(b, { recipe, tk, content, align })).filter(Boolean);

  if (desc.media) {
    const mediaH = Math.round(H * 0.46);
    if (content.asset_url) layers.push({ type: 'img', props: { src: content.asset_url, style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: W, height: mediaH, objectFit: 'cover' } } });
    else layers.push(div({ position: 'absolute', top: 0, left: 0, width: W, height: mediaH, backgroundImage: `linear-gradient(140deg, ${tk.accentSoft}, ${tk.bgPanel})` }));
    layers.push(col({ position: 'absolute', top: mediaH, left: 0, right: 0, bottom: 0, paddingLeft: PADX, paddingRight: PADX, paddingTop: 56, paddingBottom: SAFE_BOTTOM, justifyContent: 'flex-start', alignItems: itemsAlign }, blocks));
  } else if (desc.card) {
    layers.push(div({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: justify, paddingLeft: 60, paddingRight: 60, paddingTop: 96, paddingBottom: SAFE_BOTTOM }, [
      col({ width: '100%', backgroundColor: tk.surface, borderRadius: recipe.cardRadius ?? 30, boxShadow: '0 26px 60px rgba(20,17,14,0.13)', paddingLeft: 64, paddingRight: 64, paddingTop: 68, paddingBottom: 68, alignItems: itemsAlign }, blocks)]));
  } else {
    layers.push(col({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingLeft: PADX, paddingRight: PADX, paddingTop: 92, paddingBottom: SAFE_BOTTOM, justifyContent: justify, alignItems: itemsAlign }, blocks));
  }

  const ft = recipe.type.footer;
  const footerText = (s: string) => div(clean({ fontFamily: recipe[ft.f] || ft.f, fontSize: ft.size, fontWeight: ft.w, letterSpacing: ft.ls, color: tk.textMuted }), s);
  layers.push(row({ position: 'absolute', left: PADX, right: PADX, bottom: 64, justifyContent: 'space-between', alignItems: 'center' }, [
    footerText(content.brand_name || 'Centro Fisia'),
    footerText(`${String(content.slide_number ?? 1).padStart(2, '0')} / ${String(content.total ?? 8).padStart(2, '0')}`)]));

  return div({ width: W, height: H, position: 'relative', flexDirection: 'column', ...bgStyle }, layers);
}

// Google 4:3 promo piece (1200x900) — dedicated builder (Bold Promo).
export function buildGooglePiece(content: any, tk0: any, recipe: any): any {
  const tk = inAccentTokens(tk0);
  const t = recipe.type;
  const fam = (role: string) => recipe[t[role].f] || t[role].f;
  const txt = (role: string, val: any, extra?: any) => div(clean({ fontFamily: fam(role), fontSize: t[role].size, fontWeight: t[role].w, lineHeight: t[role].lh, textTransform: t[role].up ? 'uppercase' : undefined, letterSpacing: t[role].ls, color: tk.textTitle, ...extra }), val);
  return div({ width: 1200, height: 900, position: 'relative', flexDirection: 'column', backgroundColor: tk0.accent }, [
    div({ position: 'absolute', top: 40, left: 40, right: 40, bottom: 40, border: `2px solid ${tk.hairline}` }),
    col({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingLeft: 96, paddingRight: 96, justifyContent: 'center', alignItems: 'flex-start' }, [
      txt('eyebrow', content.subtitle, { color: tk.accent, marginBottom: 18 }),
      txt('h1', content.title, { color: tk.textTitle, maxWidth: 1010 }),
      row({ marginTop: 42, backgroundColor: tk.surface, paddingLeft: 40, paddingRight: 38, paddingTop: 22, paddingBottom: 22, borderRadius: recipe.buttonRadius ?? 6, alignItems: 'center' }, [
        div({ fontFamily: recipe.body, fontSize: t.button.size, fontWeight: t.button.w, color: tk0.accent }, content.body_text),
        div({ width: 11, height: 11, borderRight: `2.5px solid ${tk0.accent}`, borderTop: `2.5px solid ${tk0.accent}`, transform: 'rotate(45deg)', marginLeft: 16, marginTop: 1 })]),
    ]),
  ]);
}

// ── Skeleton descriptors per recipe ─────────────────────────
const BOLD: any[] = [
  { id: 'bold_cover', slideType: 'cover', onAccent: true, align: 'left', vAnchor: 'center', blocks: [{ kind: 'eyebrow', field: 'subtitle' }, { kind: 'title', field: 'title', scale: 'display' }, { kind: 'body', field: 'body_text', scale: 'lead' }] },
  { id: 'bold_offer', slideType: 'content', onAccent: true, align: 'left', vAnchor: 'center', blocks: [{ kind: 'eyebrow', field: 'subtitle' }, { kind: 'title', field: 'title', scale: 'h1' }, { kind: 'body', field: 'body_text' }] },
  { id: 'bold_stat', slideType: 'big_stat', onAccent: true, align: 'center', vAnchor: 'center', blocks: [{ kind: 'eyebrow', field: 'subtitle' }, { kind: 'statNumber', field: 'stat_number' }, { kind: 'statLabel', field: 'stat_label' }] },
  { id: 'bold_cta', slideType: 'cta', align: 'center', vAnchor: 'center', blocks: [{ kind: 'logo', text: 'CF' }, { kind: 'eyebrow', field: 'subtitle' }, { kind: 'title', field: 'title', scale: 'cta' }, { kind: 'ctaButton', field: 'body_text' }] },
];
const STUDIO: any[] = [
  { id: 'lux_cover', slideType: 'cover', photo: true, align: 'left', vAnchor: 'bottom', blocks: [{ kind: 'eyebrow', field: 'subtitle' }, { kind: 'title', field: 'title', scale: 'display' }, { kind: 'body', field: 'body_text', scale: 'lead' }] },
  { id: 'lux_split', slideType: 'content', media: 'top', align: 'left', vAnchor: 'top', blocks: [{ kind: 'eyebrow', field: 'subtitle' }, { kind: 'title', field: 'title', scale: 'h1' }, { kind: 'body', field: 'body_text' }] },
  { id: 'lux_stat', slideType: 'big_stat', align: 'center', vAnchor: 'center', blocks: [{ kind: 'eyebrow', field: 'subtitle' }, { kind: 'statNumber', field: 'stat_number' }, { kind: 'statLabel', field: 'stat_label' }, { kind: 'body', field: 'body_text' }] },
  { id: 'lux_quote', slideType: 'quote', photo: true, align: 'left', vAnchor: 'center', blocks: [{ kind: 'quoteMark' }, { kind: 'quote', field: 'title' }, { kind: 'attribution', field: 'quote_attribution' }] },
  { id: 'lux_cta', slideType: 'cta', align: 'center', vAnchor: 'center', blocks: [{ kind: 'logo', text: 'CF' }, { kind: 'eyebrow', field: 'subtitle' }, { kind: 'title', field: 'title', scale: 'cta' }, { kind: 'ctaButton', field: 'body_text' }] },
];

const SETS: AnyObj = { bold_promo: BOLD, studio_lux: STUDIO };

function famList(recipe: any): string[] {
  return Array.from(new Set([recipe.display, recipe.body, recipe.mono].filter(Boolean)));
}

export interface RecipeRenderResult { node: any; fontFamilies: string[]; width: number; height: number; recipe: string; template: string; }

// Entry point used by api/render-slide.ts when a request carries `recipe`.
// Maps the request to (recipe, descriptor, content) and returns the Satori node
// plus the font families to load. Throws on an unknown recipe.
export function buildRecipeSlide(body: any): RecipeRenderResult {
  const recipeKey: string = body.recipe;
  const recipe = RECIPES[recipeKey];
  if (!recipe) throw new Error(`[recipes] Unknown recipe: ${recipeKey}`);

  const brand = body.brand || {};
  const tk = deriveTokens(brand.color_primary || '#2D5A3D', brand.color_secondary || '#E8A87C', { variant: recipe.variant }) as Tokens;

  const set: any[] = SETS[recipeKey] || [];
  const wanted = body.template || body.skeleton;
  const desc = set.find((d) => d.id === wanted)
    || set.find((d) => d.slideType === (body.slide_type || 'content'))
    || set[0];

  const content: AnyObj = {
    subtitle: body.subtitle,
    title: body.title,
    body_text: body.body_text,
    stat_number: body.stat_number,
    stat_label: body.stat_label,
    quote_attribution: body.quote_attribution || body.attribution,
    brand_name: brand.name,
    logo_url: brand.logo_url || null,
    asset_url: body.asset_url || null,
    slide_number: body.slide_number || 1,
    total: body.total_slides || set.length,
  };

  // Bold Promo's Google 4:3 promo image is a dedicated builder.
  if (recipeKey === 'bold_promo' && (wanted === 'bold_google' || body.slide_type === 'google_promo')) {
    return { node: buildGooglePiece(content, tk, recipe), fontFamilies: famList(recipe), width: 1200, height: 900, recipe: recipeKey, template: 'bold_google' };
  }

  const node = composeFromTemplate(desc, content, tk, recipe);
  return { node, fontFamilies: famList(recipe), width: W, height: H, recipe: recipeKey, template: desc.id };
}
