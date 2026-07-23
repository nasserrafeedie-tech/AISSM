/**
 * Resolving a business's brand colors, best source first.
 *
 * 1. Real colors we hold — logo-extracted hexes or the words the owner said,
 *    both stored on `brandColors` and normalized by toSvgColors.
 * 2. When we have none, a STABLE, distinct palette derived from the customer id.
 *
 * Step 2 is the point of this module. The old fallback was a single shared navy
 * for every colorless customer — off-brand, and it quietly re-created the
 * cross-company fingerprint (the design seed spreads the shapes, but two navy
 * feeds still look like the same shop). A per-brand fallback keeps colorless
 * businesses visibly different from each other until a real color arrives.
 */
import { toSvgColors } from './color.util';

export interface ResolvedPalette {
  primary: string;
  secondary?: string;
}

/** A hue in [0,360) derived stably from a string (djb2). */
function hashHue(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

/** HSL (h in degrees, s and l in [0,1]) → #rrggbb. */
export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/**
 * A distinct, brand-quality palette for a business we have no real color for.
 * Saturation and lightness are fixed in a tasteful band so every derived colour
 * reads well as a surface and against text; only the hue moves, spread across
 * the wheel by the id. The secondary is an analogous accent.
 */
export function fallbackPalette(id: string): ResolvedPalette {
  const h = hashHue(id);
  return {
    primary: hslToHex(h, 0.5, 0.42),
    secondary: hslToHex((h + 28) % 360, 0.55, 0.5),
  };
}

/**
 * The colors to brand this customer's graphics with. Real colors win; otherwise
 * a stable per-brand fallback. `id` is the customer id — same value the design
 * seed uses, so a colorless brand is coherent across both.
 */
export function resolveBrandColors(
  brandColors: string[] | null | undefined,
  id: string,
): ResolvedPalette {
  const svg = toSvgColors(brandColors ?? []);
  if (svg.length > 0) return { primary: svg[0], secondary: svg[1] };
  return fallbackPalette(id);
}
