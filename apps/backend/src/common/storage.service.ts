import { Injectable, Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Media storage. Always writes the local media dir (so offline previews via
 * /media keep working), and ALSO pushes to Cloudflare R2 the moment the four
 * R2_* env vars exist — no code change on launch day. R2 speaks the S3 API.
 */
@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  private client: import('@aws-sdk/client-s3').S3Client | null | undefined;

  get mediaDir(): string {
    return process.env.MEDIA_DIR ?? join(__dirname, '..', '..', 'media');
  }

  private r2() {
    if (this.client !== undefined) return this.client;
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
      this.client = null;
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3Client } = require('@aws-sdk/client-s3');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
    return this.client;
  }

  /** Store bytes under `key`. Local always; R2 when configured. */
  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    const path = join(this.mediaDir, key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);

    const client = this.r2();
    if (!client) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: contentType,
        }),
      );
    } catch (err) {
      // Local copy exists; publish-time URL resolution will warn if R2 is the
      // only viable public base. Loud log, no crash.
      this.log.error(`R2 upload failed for ${key}: ${String(err)}`);
    }
  }

  /** Public URL for a stored key (R2 public base preferred). */
  publicUrl(key: string): string {
    const r2base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
    if (r2base) return `${r2base}/${key}`;
    const base = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
    return `${base}/media/${key}`;
  }
}
