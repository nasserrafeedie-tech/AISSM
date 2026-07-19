import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';

const LeadBody = z.object({
  phone: z.string().min(7).max(20),
  email: z.string().email().optional(),
  source: z.string().max(40).default('website'),
});

/**
 * Pre-launch lead capture. Until Twilio clears there is no number to text, so
 * this is the only way an interested owner can raise a hand. Idempotent on
 * phone — resubmitting never errors at the visitor.
 */
@Controller('leads')
export class LeadsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async create(@Body() body: unknown): Promise<{ ok: boolean }> {
    const parsed = LeadBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException('invalid lead');
    const { phone, email, source } = parsed.data;
    const normalized = phone.replace(/[^\d+]/g, '');
    if (normalized.replace(/\D/g, '').length < 10) {
      throw new BadRequestException('invalid phone');
    }
    await this.prisma.lead.upsert({
      where: { phone: normalized },
      create: { phone: normalized, email, source },
      update: { email: email ?? undefined },
    });
    return { ok: true };
  }
}
