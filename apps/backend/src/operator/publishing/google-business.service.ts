import { Injectable, Logger } from '@nestjs/common';

/**
 * Google Business Profile (§ posting) — a DIRECT Google integration, not Post
 * for Me.
 *
 * Post for Me has no Google support, so this is the one channel we talk to the
 * platform ourselves. The shape mirrors PostForMeService on purpose (a
 * `configured` gate, one `call` seam, offline-safe) so the publish handler can
 * route to whichever publisher a platform needs without special-casing the rest
 * of its logic.
 *
 * Three Google-specific facts drive the design:
 *
 *  • Auth is a long-lived refresh token, not a session. We store the refresh
 *    token (encrypted) at connect time and mint a short-lived access token on
 *    each publish. So there is no "token expired" reminder to chase the owner
 *    about the way Meta's 59-day tokens need — as long as the owner does not
 *    revoke us, the connection keeps working.
 *  • Posts are "local posts" on a specific LOCATION (`accounts/{account}/locations/{location}`),
 *    not on a feed. The location resource name is resolved once at connect time
 *    and stored; publishing just needs it back.
 *  • Google Business Profile has no hashtags and a 1500-char summary. Content
 *    mapping lives in a pure function (googleLocalPost) so it can be tested
 *    without the network.
 *
 * Everything here is a seam until GOOGLE_OAUTH_CLIENT_ID / _SECRET are set — the
 * whole feature flips on the moment those and an approved API project exist.
 */

export interface GoogleTokens {
  accessToken: string;
  /** Long-lived; only returned on the first consent, so it must be persisted. */
  refreshToken?: string;
  /** Seconds until the access token expires (~3600). */
  expiresIn: number;
  scope?: string;
}

/** One Business Profile location, as we need it to publish. */
export interface GoogleLocation {
  /** Resource name `accounts/{account}/locations/{location}` — the post target. */
  name: string;
  /** The shop's display name, for showing the owner what got connected. */
  title?: string;
}

export interface GoogleLocalPostRequest {
  /** The connected location resource name, `accounts/{account}/locations/{location}`. */
  locationName: string;
  /** Long-lived refresh token (decrypted by the caller). */
  refreshToken: string;
  caption: string;
  /** First image only — a local post takes a single photo, not a carousel. */
  mediaUrl?: string;
}

/** Google Business Profile's summary cap. Anything longer is rejected. */
const SUMMARY_MAX = 1500;

@Injectable()
export class GoogleBusinessService {
  private readonly log = new Logger(GoogleBusinessService.name);

  private static readonly TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private static readonly AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  // The scope that lets us manage a business's profile and post to it.
  static readonly SCOPE = 'https://www.googleapis.com/auth/business.manage';
  // Local posts live on the older My Business v4 surface (the one gated behind
  // the access-request approval); account/location lookups use the newer split
  // APIs. Both are enabled on the project.
  private static readonly MYBUSINESS_V4 = 'https://mybusiness.googleapis.com/v4';
  private static readonly ACCOUNT_MGMT =
    'https://mybusinessaccountmanagement.googleapis.com/v1';

  /** True once the OAuth client is configured. Lets callers fall back cleanly. */
  get configured(): boolean {
    return Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    );
  }

  private get redirectUri(): string {
    const site = process.env.PUBLIC_SITE_URL ?? 'https://texthandled.com';
    return process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `${site}/connect/google/callback`;
  }

  /**
   * The consent URL the owner opens to grant us posting access.
   *
   * `access_type=offline` + `prompt=consent` are both required to be handed a
   * refresh token — without them Google returns only a one-hour access token
   * and the connection dies at the first publish an hour later. `state` carries
   * our customer id back through the redirect.
   */
  authUrl(customerId: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: GoogleBusinessService.SCOPE,
      access_type: 'offline',
      prompt: 'consent',
      state: customerId,
    });
    return `${GoogleBusinessService.AUTH_URL}?${params.toString()}`;
  }

  /** Exchange the one-time code from the callback for tokens. */
  async exchangeCode(code: string): Promise<GoogleTokens> {
    this.assertConfigured();
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    });
    return this.tokenRequest(body);
  }

  /** Mint a fresh access token from a stored refresh token. */
  async accessTokenFrom(refreshToken: string): Promise<string> {
    this.assertConfigured();
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET as string,
      grant_type: 'refresh_token',
    });
    return (await this.tokenRequest(body)).accessToken;
  }

  /**
   * The first location on the business the owner just authorized.
   *
   * Handled manages one profile per customer, so we take the first account and
   * its first location. A multi-location chain would need the owner to choose;
   * that is a deliberate later problem, not a launch one.
   */
  async firstLocation(accessToken: string): Promise<GoogleLocation | null> {
    const accounts = await this.call<{ accounts?: Array<{ name: string }> }>(
      accessToken,
      `${GoogleBusinessService.ACCOUNT_MGMT}/accounts`,
    );
    const account = accounts.accounts?.[0]?.name;
    if (!account) return null;

    // readMask is required by the Business Information API or it 400s.
    const locations = await this.call<{
      locations?: Array<{ name: string; title?: string }>;
    }>(
      accessToken,
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations?readMask=name,title`,
    );
    const loc = locations.locations?.[0];
    if (!loc) return null;
    // The post endpoint wants the fully-qualified `accounts/{account}/locations/{location}`.
    return { name: `${account}/${loc.name}`, title: loc.title };
  }

  /**
   * Publish a local post. Mints a fresh access token, then creates the post on
   * the stored location. Returns the created post's resource name as the
   * external id, so the rest of the pipeline records it like any other publish.
   */
  async publish(req: GoogleLocalPostRequest): Promise<{ externalPostId: string }> {
    this.assertConfigured();
    const accessToken = await this.accessTokenFrom(req.refreshToken);
    const created = await this.call<{ name: string }>(
      accessToken,
      `${GoogleBusinessService.MYBUSINESS_V4}/${req.locationName}/localPosts`,
      googleLocalPost(req.caption, req.mediaUrl),
    );
    return { externalPostId: created.name };
  }

  private async tokenRequest(body: URLSearchParams): Promise<GoogleTokens> {
    const res = await fetch(GoogleBusinessService.TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Google token ${res.status}: ${detail.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in ?? 3600,
      scope: data.scope,
    };
  }

  /** One place that talks to the Business Profile APIs. */
  private async call<T>(accessToken: string, url: string, body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Google ${res.status} ${url.replace(/https:\/\/[^/]+/, '')}: ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new Error('GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET not configured');
    }
  }
}

/**
 * Map our caption to a Google Business Profile local-post body.
 *
 * Pure and exported so the mapping is tested without the network — the part
 * most likely to break silently if the API shape shifts. Three things Google
 * requires that a feed post does not:
 *  • a summary capped at 1500 chars (we trim rather than let the API reject),
 *  • no hashtags — GBP ignores them and they read as spam in Search, so any
 *    trailing hashtag block is stripped,
 *  • an explicit languageCode.
 */
export function googleLocalPost(
  caption: string,
  mediaUrl?: string,
): Record<string, unknown> {
  const summary = stripHashtags(caption).slice(0, SUMMARY_MAX);
  return {
    languageCode: 'en-US',
    summary,
    topicType: 'STANDARD',
    ...(mediaUrl
      ? { media: [{ mediaFormat: 'PHOTO', sourceUrl: mediaUrl }] }
      : {}),
  };
}

/**
 * Remove a trailing hashtag block and any inline #tags. Google Business Profile
 * has no hashtag concept; left in, they show as literal "#foo" text in a Search
 * result, which reads as spam rather than the polished update the owner expects.
 */
function stripHashtags(caption: string): string {
  return caption
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
