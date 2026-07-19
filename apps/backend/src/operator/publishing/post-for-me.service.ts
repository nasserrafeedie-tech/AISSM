import { Injectable, Logger } from '@nestjs/common';
import type { Platform } from '@smm/contracts';

export interface PublishRequest {
  platform: Platform;
  postForMeRef: string;
  caption: string;
  hashtags: string[];
  mediaUrls: string[];
}

export interface PublishOutcome {
  externalPostId: string;
}

export interface PlatformMetrics {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

/**
 * Post for Me (§2/§13) — the unified posting + aggregation layer. All platform
 * quirks (no native scheduling on IG/TikTok/X/LinkedIn/Threads; Meta Graph
 * deprecations) live behind here, not in our code. Both methods are seams until
 * POST_FOR_ME_API_KEY is wired.
 */
@Injectable()
export class PostForMeService {
  private readonly log = new Logger(PostForMeService.name);
  private base = process.env.POST_FOR_ME_BASE_URL ?? 'https://api.postforme.dev';

  async publish(req: PublishRequest): Promise<PublishOutcome> {
    this.assertConfigured();
    const caption = [req.caption, req.hashtags.map((h) => `#${h}`).join(' ')]
      .filter(Boolean)
      .join('\n\n');

    const data = await this.call<{ id: string }>('POST', '/v1/posts', {
      social_accounts: [req.postForMeRef],
      platform: req.platform,
      caption,
      media: req.mediaUrls.map((url) => ({ url })),
    });
    return { externalPostId: data.id };
  }

  async fetchMetrics(externalPostId: string): Promise<PlatformMetrics> {
    this.assertConfigured();
    const data = await this.call<Partial<PlatformMetrics>>(
      'GET',
      `/v1/posts/${encodeURIComponent(externalPostId)}/insights`,
    );
    return {
      impressions: data.impressions ?? 0,
      likes: data.likes ?? 0,
      comments: data.comments ?? 0,
      shares: data.shares ?? 0,
      saves: data.saves ?? 0,
    };
  }

  /** One place that talks to Post for Me. Flips on when the key is set. */
  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${process.env.POST_FOR_ME_API_KEY}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Post for Me ${method} ${path} → ${res.status} ${res.statusText}` +
          (detail ? `: ${detail.slice(0, 300)}` : ''),
      );
    }
    return (await res.json()) as T;
  }

  private assertConfigured(): void {
    if (!process.env.POST_FOR_ME_API_KEY) {
      throw new Error('POST_FOR_ME_API_KEY not configured');
    }
  }
}
