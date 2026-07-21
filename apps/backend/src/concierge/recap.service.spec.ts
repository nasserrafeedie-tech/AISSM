import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { RecapService } from './recap.service';

const DAY = 86_400_000;
/** 18 July — renewal on the 21st is three days out, inside the window. */
const NOW = new Date('2026-07-18T12:00:00Z');

interface Cust {
  id: string;
  businessName: string | null;
  createdAt: Date;
  lastRecapAt: Date | null;
}

interface P {
  caption: string | null;
  platform: string;
  metrics: {
    impressions: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
  }[];
}

function fakePrisma(customers: Cust[], posts: P[] = []) {
  const updates: { id: string; lastRecapAt: Date }[] = [];
  return {
    updates,
    customer: {
      findMany: async ({ where }: any) => {
        const tenureBefore = where.createdAt.lte as Date;
        const gapBefore = where.OR[1].lastRecapAt.lt as Date;
        return customers
          .filter((c) => c.createdAt <= tenureBefore)
          .filter((c) => c.lastRecapAt === null || c.lastRecapAt < gapBefore);
      },
      update: async ({ where, data }: any) =>
        updates.push({ id: where.id, lastRecapAt: data.lastRecapAt }),
    },
    post: { findMany: async () => posts },
  };
}

function fakeConcierge() {
  const sent: { customerId: string; body: string }[] = [];
  return {
    sent,
    notify: async (customerId: string, body: string) => {
      sent.push({ customerId, body });
    },
  };
}

const cust = (over: Partial<Cust> = {}): Cust => ({
  id: 'c1',
  businessName: "Rosa's Coffee",
  // Joined on the 21st of a much earlier month → renews the 21st.
  createdAt: new Date('2026-01-21T00:00:00Z'),
  lastRecapAt: null,
  ...over,
});

const post = (impressions: number, caption = 'A quiet morning at the counter'): P => ({
  caption,
  platform: 'instagram',
  metrics: [{ impressions, likes: 10, comments: 2, shares: 1, saves: 4 }],
});

const build = (customers: Cust[], posts: P[] = []) => {
  const prisma = fakePrisma(customers, posts);
  const concierge = fakeConcierge();
  return {
    svc: new RecapService(prisma as any, concierge as any),
    prisma,
    concierge,
  };
};

describe('timing against the renewal', () => {
  it('sends three days before the renewal date', async () => {
    const { svc, concierge } = build([cust()], [post(900)]);
    assert.equal((await svc.sweep(NOW)).sent, 1);
    assert.equal(concierge.sent.length, 1);
  });

  it('stays quiet when the renewal is still weeks away', async () => {
    // Renews the 21st; today is the 2nd.
    const { svc, concierge } = build([cust()], [post(900)]);
    const r = await svc.sweep(new Date('2026-07-02T12:00:00Z'));
    assert.equal(r.sent, 0);
    assert.equal(concierge.sent.length, 0);
  });

  it('handles a renewal day that does not exist in a short month', async () => {
    // Joined the 31st. February has 28 days, so the renewal lands on the 28th
    // and a naive comparison would never fire.
    const { svc } = build(
      [cust({ createdAt: new Date('2026-01-31T00:00:00Z') })],
      [post(900)],
    );
    const r = await svc.sweep(new Date('2026-02-26T12:00:00Z'));
    assert.equal(r.sent, 1, 'a 31st signup should still be recapped in February');
  });

  it('fires for a renewal that wraps into next month', async () => {
    // Joined the 2nd, today is the 30th — the next renewal is two days out.
    const { svc } = build(
      [cust({ createdAt: new Date('2026-01-02T00:00:00Z') })],
      [post(900)],
    );
    assert.equal((await svc.sweep(new Date('2026-06-30T12:00:00Z'))).sent, 1);
  });
});

describe('not annoying anyone', () => {
  it('does not recap someone who just joined', async () => {
    const { svc } = build(
      [cust({ createdAt: new Date(NOW.getTime() - 5 * DAY) })],
      [post(900)],
    );
    assert.equal((await svc.sweep(NOW)).sent, 0);
  });

  it('does not send twice in one cycle', async () => {
    // The sweep runs daily and the window is several days wide.
    const { svc } = build(
      [cust({ lastRecapAt: new Date(NOW.getTime() - 2 * DAY) })],
      [post(900)],
    );
    assert.equal((await svc.sweep(NOW)).sent, 0);
  });

  it('sends again next cycle', async () => {
    const { svc } = build(
      [cust({ lastRecapAt: new Date(NOW.getTime() - 30 * DAY) })],
      [post(900)],
    );
    assert.equal((await svc.sweep(NOW)).sent, 1);
  });

  it('records the send so tomorrow is quiet', async () => {
    const { svc, prisma } = build([cust()], [post(900)]);
    await svc.sweep(NOW);
    assert.equal(prisma.updates.length, 1);
    assert.equal(prisma.updates[0].lastRecapAt.getTime(), NOW.getTime());
  });

  it('says nothing when nothing was published', async () => {
    // "0 posts this month" is an argument for cancelling, not against it.
    const { svc, concierge } = build([cust()], []);
    assert.equal((await svc.sweep(NOW)).sent, 0);
    assert.equal(concierge.sent.length, 0);
  });
});

describe('what it says', () => {
  const bodyOf = async () => {
    const { svc, concierge } = build([cust()], [post(1200), post(3400, 'Half-price Friday')]);
    await svc.sweep(NOW);
    return concierge.sent[0].body;
  };

  it('leads with the count and the reach', async () => {
    const body = await bodyOf();
    assert.match(body, /2 posts went out/);
    assert.match(body, /seen 4,600 times/);
  });

  it('names the business', async () => {
    assert.match(await bodyOf(), /Rosa's Coffee/);
  });

  it('quotes the best post, so the number is believable', async () => {
    const body = await bodyOf();
    assert.match(body, /Best one: "Half-price Friday/);
    assert.match(body, /3,400 views/);
  });

  it('invents no reach when nothing was measured', async () => {
    // A connected account that never reported back must not become a number.
    const noMetrics: P = { caption: 'hello', platform: 'instagram', metrics: [] };
    const { svc, concierge } = build([cust()], [noMetrics]);
    await svc.sweep(NOW);
    const body = concierge.sent[0].body;
    assert.match(body, /1 posts went out/);
    assert.ok(!/seen/.test(body), `claimed reach it never had: ${body}`);
  });

  it('ends by pointing forward, not asking for anything', async () => {
    assert.match(await bodyOf(), /Next month's already planned/);
  });
});
