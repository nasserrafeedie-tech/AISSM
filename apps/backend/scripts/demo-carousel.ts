/**
 * Renders a sample Instagram carousel to real PNG files you can open.
 * Run:  npx tsx apps/backend/scripts/demo-carousel.ts
 * Output: apps/backend/scripts/out/slide-1.png ... slide-4.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GraphicsService } from '../src/operator/graphics/graphics.service';
import type { SlideSpec, BrandTheme } from '../src/operator/graphics/slide-templates';

const theme: BrandTheme = {
  primary: '#0F172A',
  secondary: '#38BDF8',
  brandName: "Rosa's Coffee",
};

const slides: SlideSpec[] = [
  { kind: 'title', headline: '5 Reasons to Start Your Morning With Us', footer: "Rosa's Coffee" },
  { kind: 'quote', headline: 'The best ideas are brewed, not forced.', footer: 'Rosa' },
  { kind: 'promo', headline: '50% OFF', body: 'Every latte, this Friday only. Show this post at the counter.', footer: "Rosa's Coffee" },
  { kind: 'cta', headline: 'Come say hi', body: 'Open 7am–4pm on Main Street. Tag a friend who needs a coffee run.', footer: "Rosa's Coffee" },
];

const gfx = new GraphicsService();
const pngs = gfx.renderCarousel(slides, theme);

const outDir = join(__dirname, 'out');
mkdirSync(outDir, { recursive: true });
pngs.forEach((png, i) => {
  const p = join(outDir, `slide-${i + 1}.png`);
  writeFileSync(p, png);
  console.log(`wrote ${p} (${(png.length / 1024).toFixed(1)} KB)`);
});
console.log(`\nDone — ${pngs.length} slides in ${outDir}`);
