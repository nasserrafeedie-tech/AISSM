import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post as HttpPost,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { TaskBus } from '../tasks/task-bus.service';
import { BusinessMetricsService } from './business-metrics.service';

const PublishNowBody = z.object({ postId: z.string().uuid() });

/**
 * Operator's eyes — NOT a customer dashboard (§2: customers never get one).
 * One JSON endpoint behind ADMIN_TOKEN so Nasser can see leads, customers,
 * and failures without querying Postgres by hand. Fails closed: no token
 * configured → the route effectively doesn't exist.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: TaskBus,
    private readonly metrics: BusinessMetricsService,
  ) {}

  /**
   * Publish one approved post immediately.
   *
   * Posts normally fire from their own queued job at the scheduled minute, with
   * the hourly sweep as a backstop. Neither helps when a post is stuck and
   * somebody needs it out NOW — until this, the only recovery was to wait up to
   * an hour for the sweep and hope. Same PUBLISH_DUE path as everything else, so
   * the approval gate, platform limits and AI disclosure all still apply; the
   * only thing being overridden is the clock.
   */
  @HttpPost('publish-now')
  async publishNow(
    @Headers('x-admin-token') token: string | undefined,
    @Body() body: unknown,
  ) {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected || token !== expected) throw new NotFoundException();
    const { postId } = PublishNowBody.parse(body);

    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException(`no post ${postId}`);
    // Never a way to skip the owner's approval — that gate is the product.
    if (post.approvalState !== 'approved') {
      return { published: false, reason: `post is ${post.approvalState}, not approved` };
    }

    // Bring it due, then run the same sweep the scheduler runs.
    await this.prisma.post.update({
      where: { id: postId },
      data: { scheduledTime: new Date(Date.now() - 1000) },
    });
    const result = await this.bus.emit({
      task_id: randomUUID(),
      customer_id: post.customerId,
      type: 'PUBLISH_DUE',
      payload: {},
      requires_approval: false,
      created_by: 'cron',
      created_at: new Date().toISOString(),
    } as never);
    return { published: true, result };
  }

  @Get('overview')
  async overview(@Headers('x-admin-token') token: string | undefined) {
    const expected = process.env.ADMIN_TOKEN;
    if (!expected || token !== expected) throw new NotFoundException();

    const [leads, customers, recentPosts, failedPosts, archetypes] = await Promise.all([
      this.prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      this.prisma.customer.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { brandProfile: { select: { businessType: true, onboardingComplete: true, contentStrategy: true } } },
      }),
      this.prisma.post.findMany({
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: { id: true, customerId: true, platform: true, status: true, approvalState: true, caption: true, scheduledTime: true, createdAt: true },
      }),
      this.prisma.post.findMany({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        take: 25,
        select: { id: true, customerId: true, failureReason: true, updatedAt: true },
      }),
      // The playbook, so new archetypes the engine researched are reviewable
      // (engine Flow 2 step 6) and stale ones are visible.
      this.prisma.playbookArchetype.findMany({
        orderBy: [{ usageCount: 'desc' }, { slug: 'asc' }],
        select: {
          slug: true,
          title: true,
          status: true,
          confidence: true,
          usageCount: true,
          researchedAt: true,
        },
      }),
    ]);

    return {
      business: await this.metrics.build(),
      counts: {
        leads: await this.prisma.lead.count(),
        customers: await this.prisma.customer.count(),
        activeCustomers: await this.prisma.customer.count({ where: { status: 'active' } }),
        failedPosts: failedPosts.length,
      },
      leads,
      customers: customers.map((c) => ({
        id: c.id, phone: c.phone, businessName: c.businessName,
        plan: c.planTier, status: c.status, trust: c.trustLevel,
        business: c.brandProfile?.businessType ?? null,
        onboarded: c.brandProfile?.onboardingComplete ?? false,
        referralCode: c.referralCode, referredBy: c.referredByCode,
        strategy: c.brandProfile?.contentStrategy ?? null,
        archetype: c.archetypeSlug,
        created: c.createdAt,
      })),
      recentPosts, failedPosts, archetypes,
    };
  }
}
