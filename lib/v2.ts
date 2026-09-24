// /lib/v2.ts — Motor v2 de esqueletos (9 estilos, sep 2026).
// Se activa solo con esqueletos que empiezan por <div data-engine="v2" style="--bg:...">.
// Los esqueletos antiguos siguen por el camino de siempre en render-html.ts.
//
// Qué hace (todo determinista, sin navegador):
//  1. Tokens: paleta de marca (primario, secundario, acento) -> ink, accent, accent-2,
//     accent-2-pale, accent-light, accent-text, con contraste garantizado. El wrapper del
//     esqueleto aporta los tokens del estilo (--bg, --text-*), que pueden referenciar a
//     los de marca y usar color-mix(in oklab, a p%, b) (se resuelve aquí, en sRGB).
//  2. Contenido: listas (check_N/item_N -> bloque <!--repeat:items-->), índice de enum,
//     palabra destacada (*palabra*), logo ({{logo}}: versión clara/oscura según fondo, o
//     nombre de marca en texto si no hay logo utilizable).
//  3. Titulares data-fit="max,min,altoMax,ancho": mide con las métricas reales de la fuente
//     cargada (opentype.js) y elige el mayor tamaño que cabe; parte en líneas
//     equilibradas, sin palabras cortas huérfanas; las cifras (stat_number) nunca se parten.
//  4. Satori: em -> px, fuera propiedades no soportadas.
//  5. Foto: quita la capa {{photo_url}} (la foto se compone luego a nivel de píxel) y funde
//     la zona de texto con el color de fondo del estilo.

import opentype from 'opentype.js';
export interface SatoriFont { name: string; data: Buffer; weight: number; style: 'normal' | 'italic' }

// ── color ────────────────────────────────────────────────────────────
const hx = (h: string): number[] => { let s = (h || '').replace('#', '').trim(); if (s.length === 3) s = s.split('').map(c => c + c).join(''); if (!/^[0-9a-fA-F]{6}$/.test(s)) return [0, 0, 0]; return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)); };
const toHex = (a: number[]) => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const isHex = (s: string) => /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test((s || '').trim());
export const mix = (a: string, b: string, t: number) => { const A = hx(a), B = hx(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export const lum = (h: string) => { const [r, g, b] = hx(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrastV2 = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const chroma = (h: string) => { const c = hx(h); return (Math.max(...c) - Math.min(...c)) / 255; };
const toward = (c: string, target: string, bg: string, ratio: number) => { for (let t = 0; t <= 1.0001; t += 0.05) { const k = mix(c, target, t); if (contrastV2(k, bg) >= ratio) return k; } return target; };

export function brandTokensV2(primary?: string | null, secondary?: string | null, accentColor?: string | null): Record<string, string> {
  const pal = [primary, secondary, accentColor].filter((c): c is string => !!c && isHex(c));
  if (pal.length === 0) pal.push('#1E6E5A');
  const chrom = pal.filter(c => chroma(c) >= 0.15);
  const accent = chrom[0] || pal[0];
  const accent2 = chrom.find(c => c.toLowerCase() !== accent.toLowerCase()) || mix(accent, '#FFFFFF', 0.45);
  const darkest = [...pal].sort((a, b) => lum(a) - lum(b))[0];
  const ink = mix(lum(darkest) < 0.08 ? darkest : mix(accent, '#000000', 0.5), '#000000', 0.45);
  // Acento legible sobre fondo oscuro: el color de marca que menos haya que aclarar.
  const cands = [accent, accent2].map(c => ({ c, k: toward(c, '#FFFFFF', ink, 4.5) }));
  cands.sort((a, b) => contrastV2(a.c, a.k) - contrastV2(b.c, b.k));
  return {
    '--ink': ink, '--accent': accent, '--accent-2': accent2,
    '--accent-2-pale': mix(accent2, '#FFFFFF', 0.82), '--accent-light': cands[0].k,
    '--accent-text': contrastV2(accent, '#FFFFFF') >= contrastV2(accent, '#1A1A1A') ? '#FFFFFF' : '#1A1A1A',
  };
}

function resolveValue(v: string, tok: Record<string, string>): string {
  let out = v;
  for (let g = 0; g < 6 && /var\(--/.test(out); g++) out = out.replace(/var\((--[\w-]+)\)/g, (x, k) => (tok[k] !== undefined ? tok[k] : x));
  out = out.replace(/color-mix\(in oklab,\s*(#[0-9a-fA-F]{6})\s+(\d+(?:\.\d+)?)%,\s*(#[0-9a-fA-F]{6})\)/g, (x, a, p, b) => mix(b, a, parseFloat(p) / 100));
  return out;
}

// ── fuentes para medir ───────────────────────────────────────────────
const otCache: Map<Buffer, any> = new Map();
function pickFont(fonts: SatoriFont[], family: string, weight: number, italic: boolean): any | null {
  let cand = fonts.filter(f => f.name === family);
  if (!cand.length) cand = fonts.filter(f => f.name === 'Inter');
  if (!cand.length) cand = fonts;
  const st = cand.filter(f => f.style === (italic ? 'italic' : 'normal'));
  const pool = st.length ? st : cand;
  const f = [...pool].sort((a, b) => Math.abs(a.weight - weight) - Math.abs(b.weight - weight))[0];
  if (!f) return null;
  if (!otCache.has(f.data)) { const b = f.data; try { otCache.set(b, opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length))); } catch { otCache.set(b, null); } }
  return otCache.get(f.data);
}

// ── utilidades ───────────────────────────────────────────────────────
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const styleGet = (st: string, k: string) => { const m = st.match(new RegExp('(?:^|;)\\s*' + k + '\\s*:\\s*([^;]*)')); return m ? m[1].trim() : ''; };

interface Tok { w: string; em: boolean }
function tokenize(text: string): Tok[] {
  const out: Tok[] = []; let on = false;
  for (let w of String(text || '').trim().split(/\s+/)) {
    if (!w) continue; let end = false;
    if (w.startsWith('*')) { on = true; w = w.slice(1); }
    if (w.includes('*')) { end = true; w = w.replace(/\*/g, ''); }
    if (w) out.push({ w, em: on });
    if (end) on = false;
  }
  return out;
}

// Titular data-fit -> filas equilibradas.
function layoutFit(style: string, text: string, hl: string, field: string, cfg: number[], fonts: SatoriFont[]): { style: string; inner: string } {
  const [mx, mn, mh, W] = cfg;
  const fam = styleGet(style, 'font-family').replace(/['"]/g, '').split(',')[0].trim();
  const weight = parseInt(styleGet(style, 'font-weight') || '400', 10);
  const italic = styleGet(style, 'font-style') === 'italic';
  const upper = styleGet(style, 'text-transform') === 'uppercase';
  const lh = parseFloat(styleGet(style, 'line-height') || '1.1') || 1.1;
  const lsRaw = styleGet(style, 'letter-spacing'); const lsEm = lsRaw.endsWith('em') ? parseFloat(lsRaw) : 0; const lsPx = lsRaw.endsWith('px') ? parseFloat(lsRaw) : 0;
  const gapRaw = styleGet(style, 'column-gap'); const gapEm = gapRaw.endsWith('em') ? parseFloat(gapRaw) : 0.24;
  const justify = styleGet(style, 'justify-content') || 'flex-start';
  const f = pickFont(fonts, fam, weight, italic);
  const toks = tokenize(text); const T = (s: string) => (upper ? s.toUpperCase() : s);
  const single = field === 'stat_number';
  const fitAt = (fs: number, allowOrphans: boolean) => {
    const adv = (s: string) => (f ? [...s].reduce((a, ch) => a + (f.charToGlyph(ch).advanceWidth || 0), 0) * fs / f.unitsPerEm : s.length * fs * 0.55) + (lsEm * fs + lsPx) * s.length;
    const gap = gapEm * fs; const widths = toks.map(t => adv(T(t.w)));
    const maxLines = single ? 1 : Math.max(1, Math.floor((mh + 1) / (lh * fs)));
    if (!toks.length) return { lines: [] as Tok[][] };
    if (single) { const total = widths.reduce((a, b) => a + b, 0) + gap * (toks.length - 1); return total <= W ? { lines: [toks] } : null; }
    if (Math.max(...widths) > W) return null;
    // Reparto óptimo (programación dinámica): con el menor nº de líneas posible,
    // minimiza la línea más larga (líneas equilibradas) y prohíbe líneas de una
    // sola palabra corta (<=3 letras) salvo en la 2ª pasada.
    const n = toks.length;
    const lineW = (a: number, b: number) => { let w = 0; for (let k = a; k < b; k++) w += widths[k] + (k > a ? gap : 0); return w; };
    const okLine = (a: number, b: number) => lineW(a, b) <= W + 0.5 && (allowOrphans || n === 1 || !(b - a === 1 && toks[a].w.length <= 3));
    for (let L = 1; L <= Math.min(maxLines, n); L++) {
      const dp: number[][] = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(Infinity));
      const from: number[][] = Array.from({ length: L + 1 }, () => new Array(n + 1).fill(-1));
      dp[0][0] = 0;
      for (let l = 1; l <= L; l++) for (let b = 1; b <= n; b++) for (let a = l - 1; a < b; a++) {
        if (dp[l - 1][a] === Infinity || !okLine(a, b)) continue;
        const c = Math.max(dp[l - 1][a], lineW(a, b));
        if (c < dp[l][b]) { dp[l][b] = c; from[l][b] = a; }
      }
      if (dp[L][n] < Infinity) { const lines: Tok[][] = []; let b = n; for (let l = L; l >= 1; l--) { const a = from[l][b]; lines.unshift(toks.slice(a, b)); b = a; } return { lines }; }
    }
    return null;
  };
  let size = mn, res: { lines: Tok[][] } | null = null;
  // 1ª pasada: sin palabras cortas huérfanas (hasta el mínimo). 2ª: se permiten.
  for (let s = mx; s >= mn && !res; s -= 2) { const r = fitAt(s, false); if (r) { size = s; res = r; } }
  for (let s = mx; s >= Math.min(mn, 28) && !res; s -= 2) { const r = fitAt(s, true); if (r) { size = s; res = r; } }
  if (!res) { size = Math.min(mn, 28); res = { lines: [toks] }; }
  const gapPx = Math.round(gapEm * size);
  const align = justify === 'center' ? 'center' : justify === 'flex-end' ? 'flex-end' : 'flex-start';
  let st2 = style.replace(/font-size:\s*[\d.]+px/, 'font-size:' + size + 'px').replace(/flex-wrap:\s*wrap;?/, '').replace(/column-gap:\s*[^;]+;?/, '');
  st2 += (st2.trim().endsWith(';') ? '' : ';') + 'flex-direction:column;align-items:' + align + ';';
  const inner = res.lines.map(l => `<div style="display:flex;flex-direction:row;justify-content:${align};column-gap:${gapPx}px">` + l.map(t => `<span${t.em && hl ? ` style="${hl}"` : ''}>${esc(t.w)}</span>`).join('') + '</div>').join('');
  return { style: st2, inner };
}

function emToPx(html: string): string {
  return html.replace(/style="([^"]*)"/g, (x, s: string) => {
    const fsm = s.match(/font-size:\s*([\d.]+)px/); const f = fsm ? parseFloat(fsm[1]) : 40;
    s = s.replace(/text-decoration-thickness:[^;"]*;?/g, '').replace(/text-underline-offset:[^;"]*;?/g, '').replace(/box-sizing:[^;"]*;?/g, '')
      .replace(/(-?\d*\.?\d+)em\b/g, (y, v) => (parseFloat(v) * f).toFixed(2) + 'px');
    return `style="${s}"`;
  });
}

export function isV2(html: string): boolean { return /^\s*<div data-engine="v2"/.test(html || ''); }

export interface V2Input {
  html: string;
  fields: Record<string, any>;
  brand: { name?: string; color_primary?: string; color_secondary?: string | null; color_accent?: string | null; logo_url?: string | null; logo_url_dark?: string | null };
  fonts: SatoriFont[];
  fontHeading: string; fontBody: string;
  slideNumber?: number; enumIndex?: number | null;
  photo?: { zone?: string | null } | null;
  loadLogo: (url: string, bgHex: string) => Promise<{ uri: string; w: number; h: number } | null>;
}

export async function buildV2(inp: V2Input): Promise<{ html: string; tokens: Record<string, string>; bgHex: string; logoStatus: string }> {
  const m = inp.html.match(/^\s*<div data-engine="v2"[^>]*style="([^"]*)">/);
  if (!m) throw new Error('v2: wrapper no reconocido');
  let body = inp.html.slice(m[0].length).replace(/<\/div>\s*$/, '');
  // 1. tokens
  const tok: Record<string, string> = brandTokensV2(inp.brand.color_primary, inp.brand.color_secondary, inp.brand.color_accent);
  const styleDecl: Record<string, string> = {};
  m[1].split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0 && d.trim().startsWith('--')) styleDecl[d.slice(0, i).trim()] = d.slice(i + 1).trim(); });
  const bgRefsAccent = /var\(--accent\)/.test(styleDecl['--bg'] || '');
  Object.assign(tok, styleDecl);
  for (const k of Object.keys(tok)) tok[k] = resolveValue(tok[k], tok);
  const bgHex = isHex(tok['--bg']) ? tok['--bg'] : '#FFFFFF';
  const darkBg = lum(bgHex) < 0.3;
  if (!bgRefsAccent && !darkBg) tok['--accent'] = toward(tok['--accent'], '#111111', bgHex, 3.2); // acento legible sobre fondo claro
  if (bgRefsAccent && contrastV2(tok['--accent-2'], tok['--accent']) < 3) tok['--accent-2'] = toward(tok['--accent-2'], tok['--accent-text'], tok['--accent'], 3);
  for (const k of ['--text-title', '--text-body', '--text-muted']) if (tok[k]) tok[k] = resolveValue(styleDecl[k] || tok[k], tok);
  tok['--font-display'] = inp.fontHeading; tok['--font-body'] = inp.fontBody;

  // 2. contenido
  const fields: Record<string, any> = { ...(inp.fields || {}) };
  fields.brand_name = fields.brand_name || inp.brand.name || '';
  if (inp.enumIndex != null && !fields.index) fields.index = String(inp.enumIndex).padStart(2, '0');
  let items: string[] = Array.isArray(fields.items) ? fields.items : [];
  if (!items.length) for (const p of ['check', 'item', 'step', 'point', 'tip']) for (let i = 1; i <= 8; i++) { const v = fields[p + '_' + i]; if (v != null && String(v).trim()) items.push(String(v)); }
  items = items.slice(0, 6);
  body = body.replace(/<!--repeat:items-->([\s\S]*?)<!--\/repeat-->/g, (x, blk) => items.map((it, i) => blk.replace('{{n}}', String(i + 1)).replace('{{item}}', esc(it))).join(''));

  // logo
  let logoStatus = 'no_slot';
  if (body.includes('{{logo}}')) {
    const url = darkBg ? (inp.brand.logo_url_dark || null) : (inp.brand.logo_url || null);
    let tag = '';
    if (url) {
      const lg = await inp.loadLogo(url, bgHex).catch(() => null);
      if (lg && lg.w > 0 && lg.h > 0) {
        let h = 80, w = Math.round(h * lg.w / lg.h); if (w > 420) { w = 420; h = Math.round(w * lg.h / lg.w); }
        tag = `<img src="${lg.uri}" width="${w}" height="${h}" style="display:flex;width:${w}px;height:${h}px;" />`; logoStatus = 'inserted' + (darkBg ? '_dark' : '');
      } else logoStatus = 'fetch_failed_text';
    } else logoStatus = darkBg ? 'no_dark_logo_text' : 'no_logo_text';
    if (!tag) tag = `<span style="font-family:var(--font-body);font-size:30px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-title)">${esc(fields.brand_name)}</span>`;
    body = body.split('{{logo}}').join(tag);
  }

  // foto: fuera la capa, raíz transparente y fundido de la zona de texto con el fondo
  if (inp.photo) {
    body = body.replace(/<div style="[^"]*url\(\{\{photo_url\}\}\)[^"]*"><\/div>/, '');
    const zone = inp.photo.zone === 'top' ? 'top' : 'bottom';
    const [r, g, b] = hx(bgHex);
    const fade = `<div style="display:flex;position:absolute;top:0;left:0;width:1080px;height:1350px;background:linear-gradient(${zone === 'top' ? 'to bottom' : 'to top'}, rgba(${r},${g},${b},1) 0%, rgba(${r},${g},${b},0.96) 34%, rgba(${r},${g},${b},0) 62%)"></div>`;
    body = body.replace(/^(<div style=")([^"]*)(">)/, (x, a, s, c) => a + s.replace(/background:[^;"]*(\([^)]*\)[^;"]*)?/, 'background:transparent') + c + fade);
  }

  // dos columnas con textos breves: el cuerpo crece (hasta x1.25) para no quedarse pequeño
  for (const f of ['left_body', 'right_body']) {
    const words = String(fields[f] || '').trim().split(/\s+/).filter(Boolean).length;
    if (words && words <= 14) { const k = words <= 8 ? 1.25 : 1.12; body = body.replace(new RegExp('(<div style="[^"]*font-size:)(\\d+)(px[^"]*">\\{\\{' + f + '\\}\\})'), (x, a, n, b) => a + Math.round(parseInt(n, 10) * k) + b); }
  }

  // campos simples (los de data-fit se quedan para el paso 3)
  body = body.replace(/(<div data-fit="[^"]*" data-hl="[^"]*" style="[^"]*">)\{\{(\w+)\}\}/g, (x, open, f) => open + '[[FIT:' + f + ']]');
  body = body.replace(/\{\{(\w+)\}\}/g, (x, f) => esc(fields[f] ?? ''));

  // resolver tokens en todo el html
  body = resolveValue(body, tok);
  body = body.replace(/justify-content:\s*space-evenly/g, 'justify-content:space-between');

  // 3. titulares con ajuste
  body = body.replace(/<div data-fit="([^"]*)" data-hl="([^"]*)" style="([^"]*)">\[\[FIT:(\w+)\]\]<\/div>/g, (x, cfg, hl, st, f) => {
    const nums = cfg.split(',').map((n: string) => parseFloat(n)); if (nums.length < 4) nums.push(912);
    const r = layoutFit(st, String(fields[f] ?? ''), hl, f, nums, inp.fonts);
    return `<div style="${r.style}">${r.inner}</div>`;
  });

  // 4. Satori
  body = emToPx(body);
  return { html: body, tokens: tok, bgHex, logoStatus };
}

// Dimensiones de una imagen a partir de un data URI (PNG IHDR / SVG viewBox / JPEG SOF).
export function imageDims(dataUri: string): { w: number; h: number } | null {
  try {
    const b64 = dataUri.split(',')[1] || ''; const buf = Buffer.from(b64, 'base64');
    if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf[0] === 0xff && buf[1] === 0xd8) { let i = 2; while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const mk = buf[i + 1]; const len = buf.readUInt16BE(i + 2); if (mk >= 0xc0 && mk <= 0xc3) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) }; i += 2 + len; } return null; }
    const svg = buf.toString('utf8'); const vb = svg.match(/viewBox="\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
    if (vb) return { w: parseFloat(vb[1]), h: parseFloat(vb[2]) };
    const w = svg.match(/width="([\d.]+)/), h = svg.match(/height="([\d.]+)/); if (w && h) return { w: parseFloat(w[1]), h: parseFloat(h[1]) };
  } catch { /* nada */ }
  return null;
}
