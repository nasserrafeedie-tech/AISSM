/**
 * End-to-end self-test of the CONTENT pipeline, with zero paid keys and zero
 * database. It mirrors what DRAFT_POST does in production (minus persistence):
 *
 *   brand voice  →  AI writes caption + hashtags  →  moderation  →  graphic PNG
 *
 * Run:
 *   npx tsx --tsconfig apps/backend/tsconfig.json apps/backend/scripts/pipeline-selftest.ts
 *
 * Proves the machine actually turns a request into a finished post before we
 * spend a cent or deploy anything. Output PNG lands in /tmp for eyeballing.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CaptionLlmOutput } from '@smm/contracts';
import { LlmService } from '../src/operator/llm/llm.service';
import { ModerationService } from '../src/operator/guardrails/moderation.service';
import { GraphicsService } from '../src/operator/graphics/graphics.service';
import type { BrandTheme, SlideSpec } from '../src/operator/graphics/slide-templates';

async function main() {
  // Force offline mode so this never calls (or needs) the Anthropic API.
  process.env.LLM_FAKE = '1';

  const llm = new LlmService();
  const moderation = new ModerationService();
  const gfx = new GraphicsService();

  // A believable small-business brand + the owner's request.
  const brandContext = [
    'You write social media content for a specific small business.',
    'Match its voice exactly. Never invent facts, offers, or claims.',
    '',
    'Business type: neighborhood coffee shop',
    'Voice / tone: warm, unpretentious, a little playful',
    'Target customer: locals who want a calm morning ritual',
    'Offers: house-roasted espresso; fresh pastries daily',
  ].join('\n');

  const prompt = [
    'Write one product_spotlight post for instagram.',
    'Notes: highlight this week’s single-origin espresso.',
    'Return JSON: {"caption": string, "hashtags": string[]}.',
    'Caption in the brand voice. Hashtags without the # prefix.',
  ].join(' ');

  console.log('1/4  Asking the writer for a caption (offline mode)…');
  const gen = await llm.completeJson(
    { tier: 'bulk', cachedContext: brandContext, prompt, maxTokens: 600 },
    CaptionLlmOutput,
  );
  console.log(`     caption : ${gen.caption}`);
  console.log(`     hashtags: ${gen.hashtags.map((h) => '#' + h).join(' ')}`);

  console.log('2/4  Running the safety/moderation check…');
  const verdict = await moderation.screen({
    caption: gen.caption,
    hashtags: gen.hashtags,
    blackoutTopics: ['politics', 'alcohol'],
  });
  console.log(`     passed  : ${verdict.passed}` +
    (verdict.reasons.length ? ` (reasons: ${verdict.reasons.join(', ')})` : ''));
  if (!verdict.passed) throw new Error('Moderation blocked the sample caption');

  console.log('3/4  Rendering a matching on-brand graphic…');
  const theme: BrandTheme = {
    primary: '#7C3A24',
    secondary: '#E7B27A',
    brandName: "Rosa's Coffee",
  };
  const slide: SlideSpec = {
    kind: 'title',
    headline: 'This week: single-origin espresso',
    body: gen.caption.slice(0, 90),
    footer: "Rosa's Coffee",
  };
  const [png] = gfx.renderCarousel([slide], theme);

  const outPath = join(tmpdir(), 'aissm-selftest.png');
  writeFileSync(outPath, png);
  console.log(`     wrote   : ${outPath} (${png.length} bytes)`);

  console.log('4/4  DONE ✓  The content pipeline works end-to-end with no keys.');
}

main().catch((err) => {
  console.error('SELF-TEST FAILED:', err);
  process.exit(1);
});
