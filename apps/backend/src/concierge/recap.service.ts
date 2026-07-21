import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConciergeService } from './concierge.service';

/**
 * The month-in-review text, sent a few days before the card is charged.
 *
 * Social media services churn at roughly 46% a year — the worst of any
 * marketing category — and the thing that separates the services that keep
 * customers from the ones that don't is whether the customer can see what they
 * are paying for. A done-for-you service is invisible by design: the whole
 * promise is that the owner does not have to think about it. Invisible is
 * exactly what gets cancelled.
 *
 * Timed against the renewal rather than the calendar quarter, because the
 * moment someone decides to cancel is the moment the charge appears. A recap
 * landing three days earlier answers "what am I paying for?" while the answer
 * still matters. A quarterly one misses two renewals in every three.
 */
@Injectable()
export class RecapService {
  private readonly log = new Logger(RecapService.name);

  /** Days before renewal to send. Close enough to be connected to the charge. */
  private static readonly DAYS_BEFORE_RENEWAL = 3;
  /** Never send two recaps closer together than this. */
  private static readonly MIN_GAP_DAYS = 20;
  /** Don't recap someone who has barely started. */
  private static readonly MIN_TENURE_DAYS = 25;

  constructor(
    private readonly prisma: PrismaService,
    private readonly concierge: ConciergeService,
  ) {}

  /**
   * Send to everyone due today. Safe to run daily and repeatedly — the gap
   * check makes a second run on the same day a no-op.
   */
  async sweep(now = new Date()): Promise<{ sent: number; skipped: number }> {
    const customers = await this.prisma.customer.findMany({
      where: {
        status: 'active',
        createdAt: {
          lte: new Date(now.getTime() - RecapService.MIN_TENURE_DAYS * 86_400_000),
        },
        OR: [
          { lastRecapAt: null },
          {
            lastRecapAt: {
              lt: new Date(now.getTime() - RecapService.MIN_GAP_DAYS * 86_400_000),
            },
          },
        ],
      },
      select: { id: true, businessName: true, createdAt: true },
    });

    let sent = 0;
    let skipped = 0;
    for (const c of customers) {
      if (!this.isDue(c.createdAt, now)) {
        skipped++;
        continue;
      }
      try {
        const body = await this.build(c.id, c.businessName, now);
        if (!body) {
          // Nothing went out this cycle. A recap reading "0 posts published"
          // is an argument for cancelling, not against it — the silence is a
          // problem to fix upstream, not to narrate.
          this.log.warn(`no results to recap for ${c.id} — skipping`);
          skipped++;
          continue;
        }
        await this.concierge.notify(c.id, body);
        await this.prisma.customer.update({
          where: { id: c.id },
          data: { lastRecapAt: now },
        });
        sent++;
      } catch (e) {
        this.log.warn(`recap failed for ${c.id}: ${String(e)}`);
      }
    }

    if (sent) this.log.log(`sent ${sent} monthly recap(s)`);
    return { sent, skipped };
  }

  /**
   * Is the renewal within the send window?
   *
   * Stripe bills monthly on the anniversary of the subscription, so the
   * signup day-of-month is the renewal day. When a real period end is stored
   * from a Stripe webhook, use that instead — this is a proxy, but one that is
   * right for anyone who subscribed when they signed up.
   *
   * Handles short months: a customer who joined on the 31st renews on the 28th
   * in February, and would otherwise never be due.
   */
  private isDue(createdAt: Date, now: Date): boolean {
    const daysInMonth = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth() + 1,
      0,
    ).getUTCDate();
    const renewalDay = Math.min(createdAt.getUTCDate(), daysInMonth);
    const today = now.getUTCDate();

    const daysUntil = renewalDay - today;
    if (daysUntil >= 0) return daysUntil <= RecapService.DAYS_BEFORE_RENEWAL;
    // Renewal already passed this month — check next month's, which is what a
    // customer near the end of the month is actually approaching.
    return daysInMonth - today + renewalDay <= RecapService.DAYS_BEFORE_RENEWAL;
  }

  /**
   * The text itself, or null when there is nothing worth reporting.
   *
   * Written to be read in a notification preview: the number that justifies
   * the bill comes first, and the specific post comes second because a
   * concrete example is what makes the aggregate believable.
   */
  private async build(
    customerId: string,
    businessName: string | null,
    now: Date,
  ): Promise<string | null> {
    const since = new Date(now.getTime() - 30 * 86_400_000);

    const posts = await this.prisma.post.findMany({
      where: { customerId, status: 'published', updatedAt: { gte: since } },
      select: {
        caption: true,
        platform: true,
        metrics: { orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    });
    if (posts.length === 0) return null;

    let impressions = 0;
    let engagements = 0;
    let best: { caption: string | null; impressions: number } | null = null;

    for (const p of posts) {
      const m = p.metrics[0];
      if (!m) continue;
      impressions += m.impressions;
      engagements += m.likes + m.comments + m.shares + m.saves;
      if (!best || m.impressions > best.impressions) {
        best = { caption: p.caption, impressions: m.impressions };
      }
    }

    const who = businessName ? ` for ${businessName}` : '';
    const lines = [`Your month${who}: ${posts.length} posts went out.`];

    // Only claim reach we actually measured. A connected account that never
    // reported back should not become an invented number.
    if (impressions > 0) {
      lines.push(
        `They were seen ${impressions.toLocaleString()} times` +
          (engagements > 0
            ? ` and got ${engagements.toLocaleString()} likes, saves and shares.`
            : '.'),
      );
    }

    if (best?.caption && best.impressions > 0) {
      const opener = best.caption.split('\n')[0].slice(0, 60).trim();
      lines.push(`Best one: "${opener}…" — ${best.impressions.toLocaleString()} views.`);
    }

    lines.push("Next month's already planned. Anything you want more of, just say.");
    return lines.join(' ');
  }
}
