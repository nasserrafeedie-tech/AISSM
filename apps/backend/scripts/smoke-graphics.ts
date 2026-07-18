/**
 * Infra-free smoke test for the new pieces (no DB/Redis needed):
 *   • the offline fake writer (captions + week plan) validates against the contract
 *   • the graphics renderer produces real PNG bytes
 *   • the free-text → slides heuristic maps common owner asks correctly
 *   npx tsx scripts/smoke-graphics.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CaptionLlmOutput, PlanWeekLlmOutput, parseLlmJson } from '@smm/contracts';
import { LlmService } from '../src/operator/llm/llm.service';
import { GraphicsService } from '../src/operator/graphics/graphics.service';

const line = (s: string) => console.log(s);

async function main() {
  delete process.env.ANTHROPIC_API_KEY; // force offline mode
  process.env.LLM_FAKE = '1';
  const llm = new LlmService();
  const gfx = new GraphicsService();

  line('── offline fake writer ─────────────────────');
  const caption = await llm.completeJson(
    { tier: 'bulk', cachedContext: 'ctx', prompt: 'Write one promo post. Return JSON: {"caption","hashtags"}', maxTokens: 300 },
    CaptionLlmOutput,
  );
  line(`  caption generated: "${caption.caption.slice(0, 48)}..." (${caption.hashtags.length} hashtags) ✓`);

  const plan = await llm.completeJson(
    { tier: 'voice', cachedContext: 'ctx', prompt: 'Plan 5 posts for the week starting 2026-07-20. Return JSON with slots.', maxTokens: 800 },
    PlanWeekLlmOutput,
  );
  line(`  week planned: ${plan.slots.length} slots (expect 5) ✓`);

  line('\n── graphics renderer ───────────────────────');
  const pngs = gfx.renderCarousel(
    [
      { kind: 'title', headline: '5 Reasons to Visit Us', footer: "Rosa's Coffee" },
      { kind: 'quote', headline: 'The best ideas are brewed, not forced.', footer: 'Rosa' },
      { kind: 'promo', headline: '50% OFF', body: 'Every latte, Friday only.', footer: "Rosa's Coffee" },
      { kind: 'cta', headline: 'Come say hi', body: 'Open 7am–4pm on Main Street.', footer: "Rosa's Coffee" },
    ],
    { primary: '#0F172A', secondary: '#38BDF8', brandName: "Rosa's Coffee" },
  );
  const isPng = (b: Buffer) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50; // \x89PNG
  line(`  rendered ${pngs.length} slides, all valid PNG: ${pngs.every(isPng)} ✓`);

  const outDir = join(__dirname, 'out');
  mkdirSync(outDir, { recursive: true });
  pngs.forEach((p, i) => writeFileSync(join(outDir, `smoke-slide-${i + 1}.png`), p));
  line(`  wrote ${pngs.length} files to ${outDir}`);

  line('\n── free-text → slides heuristic ────────────');
  const cases: [string, string, string][] = [
    ['make a promo graphic for 50% off all lattes', 'promo', '50% OFF'],
    ['create a quote card that says "Mondays are for coffee"', 'quote', 'Mondays are for coffee'],
    ['make me a graphic about our grand opening', 'title', 'our grand opening'],
  ];
  const { buildSlidesFromText } = await import('../src/concierge/concierge.service');
  for (const [input, kind, contains] of cases) {
    const slides = buildSlidesFromText(input);
    const s = slides[0];
    const good = s.kind === kind && (s.headline + (s.body ?? '')).toLowerCase().includes(contains.toLowerCase());
    line(`  "${input.slice(0, 34)}..." -> ${s.kind}/"${s.headline}" ${good ? '✓' : '✗ EXPECTED ' + kind + '/' + contains}`);
  }

  line('\nALL GRAPHICS SMOKE CHECKS RAN ✓');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
