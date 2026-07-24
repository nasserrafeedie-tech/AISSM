import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { GoogleBusinessService, googleLocalPost } from './google-business.service';

/**
 * The network calls can't run here (no OAuth client, and Google isn't reachable
 * from CI), so what's tested is the part that breaks silently: mapping our
 * caption to a Business Profile local post, and the promise that the service
 * stays inert until it's configured.
 */

describe('mapping a caption to a Google local post', () => {
  it('sets the required languageCode and topicType', () => {
    const post = googleLocalPost('Fresh bread daily');
    assert.equal(post.languageCode, 'en-US');
    assert.equal(post.topicType, 'STANDARD');
    assert.equal(post.summary, 'Fresh bread daily');
  });

  it('strips hashtags — Google shows them as literal spam text', () => {
    // A trailing hashtag block from a social caption must not reach a Search
    // result as "#freshbread".
    const post = googleLocalPost('Fresh bread daily #bakery #local #sourdough');
    assert.equal(post.summary, 'Fresh bread daily');
    assert.ok(!String(post.summary).includes('#'), 'a hashtag survived into the summary');
  });

  it('removes inline hashtags without eating the words around them', () => {
    const post = googleLocalPost('Come by #today for the #special roast');
    assert.equal(post.summary, 'Come by for the roast');
  });

  it('caps the summary at Google’s 1500-char limit', () => {
    const post = googleLocalPost('a'.repeat(2000));
    assert.equal(String(post.summary).length, 1500);
  });

  it('attaches a single photo when a media url is given', () => {
    const post = googleLocalPost('Look at this', 'https://cdn.example.com/x.jpg') as {
      media?: Array<{ mediaFormat: string; sourceUrl: string }>;
    };
    assert.deepEqual(post.media, [
      { mediaFormat: 'PHOTO', sourceUrl: 'https://cdn.example.com/x.jpg' },
    ]);
  });

  it('omits media entirely when there is no photo — not an empty array', () => {
    // The API rejects an empty media array; absence is the correct shape.
    assert.equal('media' in googleLocalPost('text only'), false);
  });
});

describe('the service stays inert until configured', () => {
  it('reports not-configured with no OAuth client set', () => {
    const prev = process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    try {
      assert.equal(new GoogleBusinessService().configured, false);
    } finally {
      if (prev !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = prev;
    }
  });

  it('refuses to build an auth URL when unconfigured, rather than a broken one', () => {
    const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    try {
      assert.throws(() => new GoogleBusinessService().authUrl('cust-1'), /not configured/i);
    } finally {
      if (id !== undefined) process.env.GOOGLE_OAUTH_CLIENT_ID = id;
      if (secret !== undefined) process.env.GOOGLE_OAUTH_CLIENT_SECRET = secret;
    }
  });

  it('builds a consent URL that asks for offline access and forces consent', () => {
    // Both are required to be handed a refresh token; without them the
    // connection would die an hour after the owner grants it.
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
    try {
      const url = new GoogleBusinessService().authUrl('cust-42');
      assert.match(url, /access_type=offline/);
      assert.match(url, /prompt=consent/);
      assert.match(url, /state=cust-42/);
      assert.match(url, /business\.manage/);
    } finally {
      delete process.env.GOOGLE_OAUTH_CLIENT_ID;
      delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    }
  });
});
