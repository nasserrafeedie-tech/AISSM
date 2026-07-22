import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { clampAssetAsks, MAX_ASSET_ASKS } from './plan-week.handler';

/**
 * The bug this guards against, measured on a real account: the planner marked
 * all five slots `needs_asset`, so every slot sat waiting on a photo — and a
 * slot waiting on a photo is skipped by BOTH carousel and image generation. The
 * customer got a week of bare text posts and never saw the feature they had
 * upgraded for. Asking is not free; every ask spends a slot.
 */
const slot = (archetype: string, needs_asset = true) => ({ archetype, needs_asset });

describe('clampAssetAsks', () => {
  it('leaves a reasonable week alone', () => {
    const week = [slot('behind_the_scenes'), slot('educational_tip', false), slot('promo', false)];
    assert.deepEqual(clampAssetAsks(week), week);
  });

  it('caps a week that asks for a photo on every slot', () => {
    const week = [
      slot('behind_the_scenes'), slot('educational_tip'), slot('testimonial'),
      slot('product_spotlight'), slot('seasonal'),
    ];
    const out = clampAssetAsks(week);
    assert.equal(out.filter((s) => s.needs_asset).length, MAX_ASSET_ASKS);
  });

  it('spends the asks on posts that have no fallback, not on carousels', () => {
    // were_open and behind_the_scenes have nothing to fall back on; the
    // carousel archetypes can design themselves, so they yield first.
    const week = [
      slot('educational_tip'), slot('behind_the_scenes'), slot('product_spotlight'),
      slot('were_open'), slot('promo'),
    ];
    const kept = clampAssetAsks(week).filter((s) => s.needs_asset).map((s) => s.archetype);
    assert.deepEqual(kept.sort(), ['behind_the_scenes', 'were_open']);
  });

  it('leaves enough of the week free to actually be designed', () => {
    const week = Array.from({ length: 5 }, () => slot('educational_tip'));
    const free = clampAssetAsks(week).filter((s) => !s.needs_asset).length;
    assert.ok(free >= 3, `expected most of the week to be generatable, got ${free}`);
  });

  it('does not invent asks that the planner never made', () => {
    const week = [slot('promo', false), slot('seasonal', false)];
    assert.equal(clampAssetAsks(week).filter((s) => s.needs_asset).length, 0);
  });
});
