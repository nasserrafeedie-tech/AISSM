import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';

import { ImageSafetyService } from './image-safety.service';

const bytes = Buffer.from('fake-image-bytes');
const realFetch = globalThis.fetch;
const svc = new ImageSafetyService();

function stubFetch(impl: () => any) {
  (globalThis as any).fetch = async () => impl();
}
function visionReply(text: string) {
  return { ok: true, json: async () => ({ content: [{ type: 'text', text }] }) };
}

afterEach(() => {
  (globalThis as any).fetch = realFetch;
  delete process.env.LLM_FAKE;
  process.env.ANTHROPIC_API_KEY = 'sk-test';
});

describe('ImageSafetyService.isPlace — the pixel gate', () => {
  it('passes a clear thing', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    stubFetch(() => visionReply('{"isPlace": false, "reason": "close-up of a coffee"}'));
    const v = await svc.isPlace(bytes, 'image/jpeg');
    assert.equal(v.isPlace, false);
  });

  it('catches a place', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    stubFetch(() => visionReply('{"isPlace": true, "reason": "a dental treatment room"}'));
    const v = await svc.isPlace(bytes, 'image/jpeg');
    assert.equal(v.isPlace, true);
    assert.match(v.reason, /treatment room/);
  });

  it('fails CLOSED when the vision call errors — a place, not a pass', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    stubFetch(() => { throw new Error('network down'); });
    assert.equal((await svc.isPlace(bytes, 'image/jpeg')).isPlace, true);
  });

  it('fails closed on a non-200 response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    stubFetch(() => ({ ok: false, status: 500, text: async () => 'err' }));
    assert.equal((await svc.isPlace(bytes, 'image/jpeg')).isPlace, true);
  });

  it('fails closed on an unparseable answer', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    stubFetch(() => visionReply('I think it might be okay?'));
    assert.equal((await svc.isPlace(bytes, 'image/jpeg')).isPlace, true);
  });

  it('treats a missing isPlace field as a place — only explicit false passes', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    stubFetch(() => visionReply('{"reason": "not sure"}'));
    assert.equal((await svc.isPlace(bytes, 'image/jpeg')).isPlace, true);
  });

  it('fails closed with no API key — cannot look, cannot pass', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal((await svc.isPlace(bytes, 'image/jpeg')).isPlace, true);
    process.env.ANTHROPIC_API_KEY = 'sk-test';
  });

  it('refuses a media type it cannot send to the vision model', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    // No fetch should even be attempted for an unsupported type.
    stubFetch(() => { throw new Error('should not be called'); });
    assert.equal((await svc.isPlace(bytes, 'image/heic')).isPlace, true);
  });
});
