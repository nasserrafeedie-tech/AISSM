import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tierHas,
  entitlementLine,
  upgradePitch,
} from './tier-entitlements';
import { tierHasCarousel } from './graphics/carousel-content';

/**
 * The sales copy and the code gates must agree. The whole point of this module
 * is that a Starter customer is never promised a carousel the engine will then
 * refuse — so the tests pin the promise to the gate, not to a hardcoded string.
 */
describe('tier entitlements', () => {
  it('matches the carousel code gate exactly — no drift', () => {
    for (const tier of ['starter', 'growth', 'pro']) {
      assert.equal(
        tierHas(tier, 'carousel'),
        tierHasCarousel(tier),
        `${tier}: entitlement disagrees with the real gate`,
      );
    }
  });

  it('Starter excludes the paid features', () => {
    assert.equal(tierHas('starter', 'carousel'), false);
    assert.equal(tierHas('starter', 'reel'), false);
    assert.equal(tierHas('starter', 'image'), false);
  });

  it('Growth and Pro include carousels', () => {
    assert.equal(tierHas('growth', 'carousel'), true);
    assert.equal(tierHas('pro', 'carousel'), true);
  });

  it('an unknown tier is treated as Starter, never as unlocked', () => {
    // A malformed value must fail closed — the safe direction is "no access".
    assert.equal(tierHas('', 'carousel'), false);
    assert.equal(tierHas('enterprise', 'carousel'), false);
  });

  describe('entitlementLine — what the concierge is told', () => {
    it('tells the model NOT to promise a carousel on Starter', () => {
      const line = entitlementLine('starter');
      assert.match(line, /does not include/i);
      assert.match(line, /carousel/i);
      assert.match(line, /do not promise|never claim/i);
    });

    it('names Growth as the tier that unlocks it', () => {
      assert.match(entitlementLine('starter'), /growth/i);
    });

    it('on Pro, says everything is included', () => {
      assert.match(entitlementLine('pro'), /everything/i);
    });
  });

  describe('upgradePitch — leads with the actual reason to upgrade', () => {
    it('puts carousels first for a Starter customer', () => {
      const pitch = upgradePitch('starter');
      assert.match(pitch, /carousel/i);
      // Carousels must appear before reels — they are the headline, not reels.
      assert.ok(
        pitch.toLowerCase().indexOf('carousel') <
          pitch.toLowerCase().indexOf('reel'),
        'carousels should lead the pitch, ahead of reels',
      );
    });

    it('pitches Pro (not carousels) to someone already on Growth', () => {
      const pitch = upgradePitch('growth');
      assert.match(pitch, /pro/i);
      assert.doesNotMatch(pitch, /carousel/i);
    });
  });
});
