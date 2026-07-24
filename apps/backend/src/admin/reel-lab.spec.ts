import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';

import { ReelLabController } from './reel-lab.controller';

/**
 * This endpoint renders video from an uploaded file on an admin-only path. The
 * risk worth covering is the gate: an unauthenticated caller must not be able
 * to hand the server a file and make it spend CPU, transcription spend and
 * bucket space. Everything downstream is exercised by the video suite.
 */
const stub = () =>
  new ReelLabController(
    {} as never, // reel
    {} as never, // transcription
    {} as never, // edl
    {} as never, // storage
  );

const file = (name: string, bytes: Buffer) => [{ originalname: name, buffer: bytes }];

describe('reel-lab admin gate', () => {
  it('404s when no token is configured at all', async () => {
    // An unset ADMIN_TOKEN must fail closed. Treating "no token" as "no auth
    // required" would leave this open on any deploy missing the variable.
    const prev = process.env.ADMIN_TOKEN;
    delete process.env.ADMIN_TOKEN;
    try {
      await assert.rejects(
        () => stub().run('anything', file('a.mp4', Buffer.alloc(8))),
        NotFoundException,
      );
    } finally {
      if (prev !== undefined) process.env.ADMIN_TOKEN = prev;
    }
  });

  it('404s on a wrong token', async () => {
    process.env.ADMIN_TOKEN = 'right-token';
    try {
      await assert.rejects(
        () => stub().run('wrong-token', file('a.mp4', Buffer.alloc(8))),
        NotFoundException,
      );
    } finally {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('404s rather than 401s, so the endpoint is not discoverable', async () => {
    process.env.ADMIN_TOKEN = 'right-token';
    try {
      await stub().run(undefined, file('a.mp4', Buffer.alloc(8)));
      assert.fail('expected a rejection');
    } catch (err) {
      // A 401 would confirm the path exists to anyone probing for it.
      assert.ok(err instanceof NotFoundException, `got ${(err as Error).constructor.name}`);
    } finally {
      delete process.env.ADMIN_TOKEN;
    }
  });
});

describe('reel-lab input handling', () => {
  it('reports plainly when nothing was uploaded', async () => {
    process.env.ADMIN_TOKEN = 'right-token';
    try {
      assert.deepEqual(await stub().run('right-token', []), { error: 'no files' });
      assert.deepEqual(await stub().run('right-token', undefined), { error: 'no files' });
    } finally {
      delete process.env.ADMIN_TOKEN;
    }
  });

  it('rejects a file whose bytes are not video, whatever it is named', async () => {
    // The filename is attacker-controlled and the path is handed to ffmpeg, so
    // the decision comes from the bytes — the same rule as /uploads.
    process.env.ADMIN_TOKEN = 'right-token';
    try {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      const out = (await stub().run('right-token', file('clip.mp4', png))) as {
        error?: string;
      };
      assert.equal(out.error, 'not_video');
    } finally {
      delete process.env.ADMIN_TOKEN;
    }
  });
});
