/**
 * What each plan tier includes — the ONE place that answers it.
 *
 * The engine gates carousels, generated images and reels in code (a Starter
 * customer physically cannot get them). But those gates were the whole story:
 * nothing told the concierge what a tier *excludes*, so it could cheerfully
 * promise a Starter customer a carousel that the handler would then silently
 * refuse. Promised in conversation, absent in delivery, nothing logged wrong.
 *
 * This module is that missing half. The concierge reads it to know what it may
 * offer and what to decline-and-pitch; the upgrade reply reads it so the pitch
 * names the actual reason to upgrade. Keeping it beside `tierHasCarousel` and
 * friends means the sales copy and the gates can never drift apart — change a
 * gate, this changes with it.
 */

export type Tier = 'starter' | 'growth' | 'pro';

/** A gated capability the customer might ask for by name. */
export type Feature = 'carousel' | 'image' | 'reel' | 'video_upload';

const RANK: Record<Tier, number> = { starter: 0, growth: 1, pro: 2 };

/** The lowest tier that includes each feature. Mirrors the code gates exactly. */
const REQUIRES: Record<Feature, Tier> = {
  carousel: 'growth',
  image: 'growth',
  reel: 'growth',
  video_upload: 'growth',
};

/** How to name each feature to a shop owner — no jargon. */
export const FEATURE_LABEL: Record<Feature, string> = {
  carousel: 'swipeable carousels',
  image: 'custom generated images',
  reel: 'reels cut from your clips',
  video_upload: 'video uploads',
};

const norm = (t: string): Tier => (t in RANK ? (t as Tier) : 'starter');

/** Does this tier include this feature? */
export function tierHas(planTier: string, f: Feature): boolean {
  return RANK[norm(planTier)] >= RANK[REQUIRES[f]];
}

/** The lowest tier that unlocks a feature — for "that's a Growth feature". */
export function tierFor(f: Feature): Tier {
  return REQUIRES[f];
}

/**
 * One line for the drafting/concierge prompt describing exactly what this
 * customer's plan does and does not include — so the model never offers what
 * the engine will refuse. Written in the owner's terms.
 */
export function entitlementLine(planTier: string): string {
  const tier = norm(planTier);
  const has: Feature[] = [];
  const missing: Feature[] = [];
  (Object.keys(REQUIRES) as Feature[]).forEach((f) =>
    (tierHas(tier, f) ? has : missing).push(f),
  );

  if (missing.length === 0) {
    return `Plan ${tier}: includes everything — carousels, generated images and reels are all on.`;
  }
  const label = (fs: Feature[]) => fs.map((f) => FEATURE_LABEL[f]).join(', ');
  const next = tierFor(missing[0]);
  return (
    `Plan ${tier}: INCLUDES captions and the owner's own photos` +
    (has.length ? `, plus ${label(has)}` : '') +
    `. Does NOT include ${label(missing)} — those need ${next}. ` +
    `If they ask for one, do not promise it: say it's a ${next} feature and ` +
    `offer to bump them up. Never claim to have made something this plan excludes.`
  );
}

/**
 * The upgrade pitch, led by the feature that actually drives the upgrade.
 * Carousels are the stated #1 reason to leave Starter and carry the price gap,
 * so they come first — the previous copy omitted them entirely and sold reels.
 */
export function upgradePitch(planTier: string): string {
  const tier = norm(planTier);
  if (tier === 'starter') {
    return (
      'Growth adds swipeable carousels — the branded, multi-slide posts that ' +
      'get saved and shared most — plus reels cut from your clips, more posts ' +
      'a week and more platforms.'
    );
  }
  // On Growth already → the only step up is Pro.
  return (
    'Pro adds daily posting across every platform and priority on your drafts, ' +
    'on top of everything in Growth.'
  );
}
