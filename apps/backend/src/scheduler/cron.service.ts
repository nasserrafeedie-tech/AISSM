import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import type { Task } from '@smm/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { TaskBus } from '../tasks/task-bus.service';

/**
 * The autonomous heartbeat (§10). Three recurring jobs, all routed through the
 * TaskBus so they get the same validation + audit trail as owner-triggered work:
 *   • weekly  — PLAN_WEEK for every active customer (Mon 08:00)
 *   • hourly  — PUBLISH_DUE sweep (safety net beside the per-post BullMQ jobs)
 *   • daily   — FETCH_METRICS so planning learns from what worked (06:00)
 *
 * Disabled when ENABLE_CRON=0 (e.g. local dev / tests) so it never fires
 * unexpectedly. Paused customers are skipped — the kill switch stays honored.
 */
@Injectable()
export class CronService {
  private readonly log = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: TaskBus,
  ) {}

  private get enabled(): boolean {
    return process.env.ENABLE_CRON !== '0';
  }

  private async activeCustomerIds(): Promise<string[]> {
    const rows = await this.prisma.customer.findMany({
      where: { status: 'active' },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  private emit(customerId: string, type: Task['type'], payload: unknown): Promise<unknown> {
    const task = {
      task_id: randomUUID(),
      customer_id: customerId,
      type,
      payload,
      requires_approval: false,
      created_by: 'cron' as const,
      created_at: new Date().toISOString(),
    } as Task;
    return this.bus.emit(task);
  }

  /** Weekly: plan the coming week for every active customer. */
  @Cron('0 8 * * 1')
  async planWeek(): Promise<void> {
    if (!this.enabled) return;
    const ids = await this.activeCustomerIds();
    this.log.log(`weekly PLAN_WEEK for ${ids.length} customers`);
    for (const id of ids) {
      await this.emit(id, 'PLAN_WEEK', { week_start: nextMonday() }).catch((e) =>
        this.log.warn(`PLAN_WEEK failed for ${id}: ${e.message}`),
      );
    }
  }

  /** Hourly: publish anything now due (belt-and-suspenders with BullMQ). */
  @Cron(CronExpression.EVERY_HOUR)
  async publishDue(): Promise<void> {
    if (!this.enabled) return;
    const ids = await this.activeCustomerIds();
    for (const id of ids) {
      await this.emit(id, 'PUBLISH_DUE', {}).catch((e) =>
        this.log.warn(`PUBLISH_DUE failed for ${id}: ${e.message}`),
      );
    }
  }

  /** Daily: pull fresh metrics so next week's plan learns from results. */
  @Cron('0 6 * * *')
  async fetchMetrics(): Promise<void> {
    if (!this.enabled) return;
    const ids = await this.activeCustomerIds();
    this.log.log(`daily FETCH_METRICS for ${ids.length} customers`);
    for (const id of ids) {
      await this.emit(id, 'FETCH_METRICS', {}).catch((e) =>
        this.log.warn(`FETCH_METRICS failed for ${id}: ${e.message}`),
      );
    }
  }
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const add = ((8 - day) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + add);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}
