/**
 * Slide templates → SVG. We build the design ourselves so the text is always
 * crisp and correctly spelled (unlike diffusion image models). Output is an SVG
 * string that GraphicsService rasterizes to PNG. Instagram square canvas.
 */

export const CANVAS = 1080;

export type SlideKind = 'title' | 'body' | 'quote' | 'promo' | 'cta';

export interface BrandTheme {
  /** Background / accent color, e.g. "#0F172A". */
  primary: string;
  /** Secondary accent (footer bar, quote marks). Defaults derived from primary. */
  secondary?: string;
  /** Main text color. Defaults to auto contrast against primary. */
  text?: string;
  /** Business name shown in the footer. */
  brandName?: string;
}

export interface SlideSpec {
  kind: SlideKind;
  headline: string;
  body?: string;
  footer?: string;
}

/** Escape text for safe embedding in SVG. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Naive word wrap by estimated glyph width. fontSize in px; we assume an average
 * glyph is ~0.55*fontSize wide (works well for the system sans fallback).
 */
function wrap(text: string, fontSize: number, maxWidth: number): string[] {
  const maxChars = Math.max(6, Math.floor(maxWidth / (fontSize * 0.55)));
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Pick black or white text for best contrast against a hex background. */
function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  // relative luminance
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.6 ? '#111111' : '#ffffff';
}

function tspans(lines: string[], x: number, startY: number, lineHeight: number): string {
  return lines
    .map((l, i) => `<tspan x="${x}" y="${startY + i * lineHeight}">${esc(l)}</tspan>`)
    .join('');
}

/** Render one slide spec to an SVG string. */
export function renderSlideSvg(spec: SlideSpec, theme: BrandTheme): string {
  const bg = theme.primary || '#0F172A';
  const fg = theme.text || contrastText(bg);
  const accent = theme.secondary || fg;
  const pad = 96;
  const maxW = CANVAS - pad * 2;
  const footer = spec.footer ?? theme.brandName ?? '';

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">`,
    `<rect width="${CANVAS}" height="${CANVAS}" fill="${bg}"/>`,
  ];

  const family = `-apple-system, 'Helvetica Neue', Arial, sans-serif`;

  if (spec.kind === 'quote') {
    parts.push(
      `<text x="${pad}" y="${pad + 120}" font-family="${family}" font-size="220" font-weight="800" fill="${accent}" opacity="0.35">&#8220;</text>`,
    );
    const qLines = wrap(spec.headline, 68, maxW);
    parts.push(
      `<text font-family="${family}" font-size="68" font-weight="700" fill="${fg}" xml:space="preserve">${tspans(qLines, pad, 380, 88)}</text>`,
    );
    if (footer) {
      parts.push(
        `<text x="${pad}" y="${CANVAS - pad}" font-family="${family}" font-size="34" font-weight="600" fill="${accent}">— ${esc(footer)}</text>`,
      );
    }
  } else if (spec.kind === 'promo') {
    const hLines = wrap(spec.headline, 130, maxW);
    parts.push(
      `<text font-family="${family}" font-size="130" font-weight="900" fill="${fg}" xml:space="preserve">${tspans(hLines, pad, 360, 150)}</text>`,
    );
    if (spec.body) {
      const bLines = wrap(spec.body, 46, maxW);
      parts.push(
        `<text font-family="${family}" font-size="46" font-weight="500" fill="${fg}" opacity="0.9" xml:space="preserve">${tspans(bLines, pad, 720, 62)}</text>`,
      );
    }
    parts.push(`<rect x="0" y="${CANVAS - 24}" width="${CANVAS}" height="24" fill="${accent}"/>`);
    if (footer) {
      parts.push(
        `<text x="${pad}" y="${CANVAS - 60}" font-family="${family}" font-size="34" font-weight="700" fill="${fg}">${esc(footer)}</text>`,
      );
    }
  } else {
    // title / body / cta — headline block, optional body block
    const hSize = spec.kind === 'title' ? 96 : 72;
    const hLines = wrap(spec.headline, hSize, maxW);
    const hStart = spec.body ? 300 : 440;
    parts.push(
      `<text font-family="${family}" font-size="${hSize}" font-weight="800" fill="${fg}" xml:space="preserve">${tspans(hLines, pad, hStart, hSize * 1.15)}</text>`,
    );
    if (spec.body) {
      const bLines = wrap(spec.body, 44, maxW);
      const bStart = hStart + hLines.length * hSize * 1.15 + 60;
      parts.push(
        `<text font-family="${family}" font-size="44" font-weight="400" fill="${fg}" opacity="0.9" xml:space="preserve">${tspans(bLines, pad, bStart, 60)}</text>`,
      );
    }
    if (footer) {
      parts.push(
        `<text x="${pad}" y="${CANVAS - pad}" font-family="${family}" font-size="32" font-weight="600" fill="${accent}">${esc(footer)}</text>`,
      );
    }
  }

  parts.push(`</svg>`);
  return parts.join('');
}
