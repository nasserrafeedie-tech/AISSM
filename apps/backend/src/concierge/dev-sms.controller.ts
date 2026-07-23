import { Body, Controller, Headers, NotFoundException, Post } from '@nestjs/common';
import { z } from 'zod';
import { normalizePhone } from '../common/phone';
import { PrismaService } from '../prisma/prisma.service';
import { ConciergeService } from './concierge.service';

const SimBody = z.object({
  from: z.string().min(3).describe('phone number, e.g. +14245550199'),
  body: z.string().default(''),
  /** Simulate MMS attachments (any URL works offline). */
  mediaUrls: z.array(z.string().url()).default([]),
});

/**
 * SMS simulator for development. Lets us drive the whole Concierge — including
 * the onboarding interview — with curl while Twilio A2P approval is pending:
 *
 *   curl -X POST localhost:3001/dev/sms \
 *     -H 'content-type: application/json' \
 *     -d '{"from":"+14245550199","body":"hi"}'
 *
 * Returns whatever the Concierge texted back. Hidden in production unless
 * ALLOW_DEV_SMS=1 is set explicitly.
 */
@Controller('dev')
export class DevSmsController {
  constructor(
    private readonly concierge: ConciergeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Both dev endpoints stay invisible in production unless explicitly opened.
   *
   * ALLOW_DEV_SMS alone is NOT enough to open them. This endpoint speaks as any
   * customer it is given a number for — which means driving their onboarding
   * and, more seriously, replying YES to approve their posts. Left
   * unauthenticated in production it would be a way for a stranger to publish
   * to a customer's Instagram, which is the exact thing the approval gate
   * exists to prevent. So production also demands the admin token.
   */
  private assertDevAllowed(token: string | undefined): void {
    if (process.env.NODE_ENV !== 'production') return;

    if (process.env.ALLOW_DEV_SMS !== '1') throw new NotFoundException();

    const expected = process.env.ADMIN_TOKEN;
    if (!expected || token !== expected) throw new NotFoundException();
  }

  @Post('sms')
  async simulate(
    @Headers('x-admin-token') token: string | undefined,
    @Body() body: unknown,
  ): Promise<{ replies: string[] }> {
    this.assertDevAllowed(token);
    const { from, body: text, mediaUrls } = SimBody.parse(body);
    const phone = normalizePhone(from) ?? from;

    // Snapshot which outbound messages already exist BEFORE handling. Diffing by
    // id afterwards is immune to clock skew between this process and the DB —
    // filtering on `createdAt >= t0` (app clock vs Postgres `now()`) silently
    // drops a reply inserted milliseconds after t0 if the DB clock lags, and the
    // operator would think the customer got no reply.
    const before = await this.prisma.customer.findUnique({
      where: { phone },
      include: { conversation: { include: { messages: { select: { id: true } } } } },
    });
    const seen = new Set(
      before?.conversation?.messages.map((m) => m.id) ?? [],
    );

    await this.concierge.handleInbound({
      from,
      body: text,
      mediaUrls,
      mediaContentTypes: mediaUrls.map(() => 'image/jpeg'),
    });

    const customer = await this.prisma.customer.findUnique({
      where: { phone },
      include: { conversation: true },
    });
    if (!customer?.conversation) return { replies: [] };
    const outbound = await this.prisma.message.findMany({
      where: {
        conversationId: customer.conversation.id,
        direction: 'outbound',
      },
      orderBy: { createdAt: 'asc' },
    });
    // Only the ones that did not exist before this call.
    return {
      replies: outbound
        .filter((m) => !seen.has(m.id))
        .map((m) => m.body ?? ''),
    };
  }
}
