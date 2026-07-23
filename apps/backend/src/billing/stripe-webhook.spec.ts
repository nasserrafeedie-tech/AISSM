import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { StripeWebhookController } from './stripe-webhook.controller';

/**
 * Payment must land on the customer who already exists.
 *
 * Phone is the account key. A customer signed up in person already has a row —
 * with their brand profile, their connected Instagram, their conversation. When
 * they pay, the webhook has to resolve to THAT row. Matching on Stripe's raw
 * string instead splits them in two: the new row carries the plan they paid
 * for, the old row carries the Instagram account, and neither is a whole
 * customer. Nothing errors, and the symptom appears a week later as "why is my
 * paying customer getting no carousels".
 */

function makeController(rows: Record<string, any>) {
  const calls = { onboarded: [] as string[] };
  const prisma = {
    customer: {
      upsert: async ({ where, create, update }: any) => {
        const existing = rows[where.phone];
        const row = existing
          ? { ...existing, ...update }
          : { id: `cus_${Object.keys(rows).length + 1}`, ...create };
        rows[where.phone] = row;
        return row;
      },
      findUnique: async () => null,
      update: async () => ({}),
    },
  };
  const concierge = {
    beginOnboarding: async (id: string) => calls.onboarded.push(id),
    notify: async () => {},
  };
  const ctrl = new StripeWebhookController(
    prisma as any,
    {} as any,
    concierge as any,
  );
  return { ctrl, rows, calls };
}

/** Drive the private handler the way a real checkout event would. */
function checkout(ctrl: any, phone: string | undefined, plan = 'growth') {
  return ctrl.onCheckoutCompleted({
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: 'cus_stripe_123',
        metadata: { plan },
        customer_details: { phone },
      },
    },
  });
}

describe('Stripe checkout → customer', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('upgrades the EXISTING hand-made customer rather than splitting them', async () => {
    // The row a founder-run signup created, already holding real state.
    const rows: Record<string, any> = {
      '+14244098341': {
        id: 'cus_original',
        phone: '+14244098341',
        planTier: 'starter',
        businessName: 'Torrance Dental',
      },
    };
    const { ctrl } = makeController(rows);

    // Stripe hands the number back in its own formatting.
    await checkout(ctrl, '(424) 409-8341');

    assert.equal(
      Object.keys(rows).length,
      1,
      'must not create a second customer record',
    );
    assert.equal(rows['+14244098341'].id, 'cus_original');
    assert.equal(rows['+14244098341'].planTier, 'growth', 'the plan they paid for');
    assert.equal(
      rows['+14244098341'].businessName,
      'Torrance Dental',
      'existing profile must survive',
    );
  });

  it('normalizes a fresh self-serve signup too', async () => {
    const { ctrl, rows, calls } = makeController({});
    await checkout(ctrl, '424-409-8341');
    assert.deepEqual(Object.keys(rows), ['+14244098341']);
    assert.equal(calls.onboarded.length, 1, 'first text should go out');
  });

  it('refuses a phone it could never text, instead of storing junk', async () => {
    const { ctrl, rows, calls } = makeController({});
    await checkout(ctrl, 'not-a-number');
    assert.equal(
      Object.keys(rows).length,
      0,
      'a customer we cannot reach is worse than none',
    );
    assert.equal(calls.onboarded.length, 0);
  });

  it('does nothing when Stripe sends no phone at all', async () => {
    const { ctrl, rows } = makeController({});
    await checkout(ctrl, undefined);
    assert.equal(Object.keys(rows).length, 0);
  });
});

describe('Stripe webhook signature', () => {
  const saved = { ...process.env };
  let ctrl: any;

  beforeEach(() => {
    ctrl = makeController({}).ctrl;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('fails CLOSED in production when no secret is configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STRIPE_WEBHOOK_SECRET;
    assert.equal(ctrl.verify(Buffer.from('{}'), 't=1,v1=abc'), false);
  });

  it('rejects a forged signature', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const t = Math.floor(Date.now() / 1000);
    assert.equal(ctrl.verify(Buffer.from('{}'), `t=${t},v1=deadbeef`), false);
  });
});
