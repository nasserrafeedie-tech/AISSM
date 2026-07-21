/**
 * Pre-research the playbook for trades nobody has signed up as yet.
 *
 * The engine researches an archetype the first time a new kind of business
 * arrives, which costs that owner a five-minute wait on their very first
 * interaction with us. Doing it in advance means the tenth trade to sign up
 * gets the same instant, cited strategy the third one did.
 *
 * Distinct from seed-playbook.ts, which imports the hand-written markdown doc.
 * This one calls the live research pass and writes what it finds on the web.
 *
 * Safe to leave running unattended. It only ever ADDS: ensureArchetypeFor
 * returns the existing row untouched when a trade is already covered, so
 * nothing researched or hand-written here can be overwritten. It is resumable —
 * run it again and it skips everything already done.
 *
 *   cd apps/backend
 *   set -a && . ../../.env && set +a
 *   npx tsx scripts/research-playbook.ts --dry-run   # list what it would do
 *   npx tsx scripts/research-playbook.ts             # do it
 *
 * Measured: about two minutes and ~30 cents per new archetype (a real pass
 * runs 8 web searches and cites ~60 sources).
 */
import { PrismaClient } from '@prisma/client';
import { appendFileSync } from 'node:fs';
import type { PrismaService } from '../src/prisma/prisma.service';
import { LlmService } from '../src/operator/llm/llm.service';
import { PlaybookService } from '../src/playbook/playbook.service';
import { ArchetypeResearchService } from '../src/playbook/archetype-research.service';

/**
 * What a local, owner-operated business in a US town actually is. Ordered
 * roughly by how likely each is to sign up, so a run that gets cut short has
 * still covered the ones that matter.
 */
const BUSINESS_TYPES = [
  // Food and drink
  'pizzeria', 'brewery', 'wine bar', 'juice and smoothie bar', 'ice cream shop',
  'butcher shop', 'deli and sandwich shop', 'catering company',
  // Beauty and body
  'tattoo studio', 'med spa', 'massage therapy practice', 'yoga studio',
  'pilates studio', 'crossfit gym', 'martial arts school',
  // Health
  'dental practice', 'chiropractic clinic', 'optometry practice',
  'veterinary clinic', 'physical therapy clinic',
  // Home and trade
  'auto repair shop', 'landscaping company', 'pool service company',
  'pest control company', 'roofing contractor', 'house cleaning service',
  'moving company', 'locksmith',
  // Retail
  'bike shop', 'plant and garden shop', 'record store', 'bookshop',
  'hardware store', 'dry cleaner', 'car wash',
  // People services
  'photography studio', 'wedding planner', 'daycare and preschool',
  'tutoring center', 'real estate agent',
];

/** Stop after this many NEW archetypes, so an unattended run cannot run away. */
const MAX_NEW = Number(process.env.MAX_NEW ?? 40);

/** Rough cost of one research pass, for the running total in the log. */
const APPROX_COST_EACH = 0.3;

const LOG = process.env.SEED_LOG ?? '/tmp/handled-playbook-research.log';
const dryRun = process.argv.includes('--dry-run');

function say(line: string): void {
  const stamped = `${new Date().toISOString().slice(11, 19)}  ${line}`;
  console.log(stamped);
  try {
    appendFileSync(LOG, `${stamped}\n`);
  } catch {
    // A log we cannot write is not a reason to stop researching.
  }
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set — load ../../.env first.');
    process.exit(1);
  }
  if (process.env.LLM_FAKE === '1') {
    console.error('LLM_FAKE=1 would write canned filler into the playbook. Refusing.');
    process.exit(1);
  }

  const client = new PrismaClient();
  const prisma = client as unknown as PrismaService;
  const playbook = new PlaybookService(prisma);
  const research = new ArchetypeResearchService(prisma, new LlmService(prisma), playbook);

  const before = await client.playbookArchetype.count();
  say(`starting — ${before} archetypes held, ${BUSINESS_TYPES.length} trades to check`);
  if (dryRun) say('DRY RUN — nothing will be written');

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const type of BUSINESS_TYPES) {
    if (added >= MAX_NEW) {
      say(`reached MAX_NEW=${MAX_NEW} — stopping here`);
      break;
    }

    // Ask first, so an already-covered trade costs nothing and reads clearly in
    // the log rather than looking like a silent no-op.
    const existing = await playbook.findByBusinessType(type);
    if (existing) {
      skipped++;
      say(`skip   ${type.padEnd(30)} already covered by "${existing.slug}"`);
      continue;
    }
    if (dryRun) {
      added++;
      say(`would  ${type}`);
      continue;
    }

    const started = Date.now();
    try {
      const row = await research.ensureArchetypeFor(type);
      if (!row) {
        failed++;
        say(`FAIL   ${type.padEnd(30)} research returned nothing`);
        continue;
      }
      added++;
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      say(
        `done   ${type.padEnd(30)} → ${row.slug} ` +
          `[${row.status} ${row.confidence.toFixed(2)}] ${secs}s ` +
          `· ~$${(added * APPROX_COST_EACH).toFixed(2)} so far`,
      );
    } catch (e) {
      // One bad trade must not end a run that has hours left in it.
      failed++;
      say(`FAIL   ${type.padEnd(30)} ${(e as Error).message.slice(0, 140)}`);
    }
  }

  const after = await client.playbookArchetype.count();
  say(
    `finished — added ${added}, skipped ${skipped}, failed ${failed}. ` +
      `Playbook ${before} → ${after}. Approx spend $${(added * APPROX_COST_EACH).toFixed(2)}.`,
  );
  await client.$disconnect();
  process.exit(0);
})().catch((e) => {
  say(`run aborted: ${(e as Error).message}`);
  process.exit(1);
});
