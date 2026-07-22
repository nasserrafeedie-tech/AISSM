import { Injectable, Logger } from '@nestjs/common';

/**
 * The last gate before a generated image is used: look at the actual pixels and
 * refuse anything that depicts a place.
 *
 * Every other guardrail checks the prompt — the words we send. This checks the
 * output — what came back. A subject can read as an innocent "dental tools on a
 * counter" and the model can still render a wide shot of a treatment room, and
 * a fabricated photo of a business's premises is the one result that could
 * genuinely damage the brand: a customer walks in expecting a place that never
 * existed. Words cannot catch that; only looking at the image can.
 *
 * Fail-closed. If the check cannot run or is unsure, the image is treated as a
 * place and refused — the owner gets asked for a real photo, which is a small
 * cost, where publishing a fake premises is not.
 */

export interface PlaceVerdict {
  isPlace: boolean;
  reason: string;
}

@Injectable()
export class ImageSafetyService {
  private readonly log = new Logger(ImageSafetyService.name);
  private static readonly ENDPOINT = 'https://api.anthropic.com/v1/messages';

  private model(): string {
    return process.env.LLM_MODEL_BULK ?? 'claude-haiku-4-5';
  }

  /**
   * Does this image depict a place rather than a thing? True also when the
   * check itself fails — see the fail-closed note above.
   */
  async isPlace(bytes: Buffer, contentType: string): Promise<PlaceVerdict> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || process.env.LLM_FAKE === '1') {
      // No way to look at it. Do not let an unverified image through.
      return { isPlace: true, reason: 'no vision check available (fail-closed)' };
    }

    // Anthropic vision accepts a narrow set of media types; anything else we
    // cannot verify, so we refuse it.
    const mediaType = contentType.toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mediaType)) {
      return { isPlace: true, reason: `unverifiable media type ${contentType}` };
    }

    const instruction = [
      'This image is about to be posted on a small business\'s social media as if',
      'the business took the photo. The rule that protects them: we may show a',
      'close-up of a THING they sell or use — a product, dish, ingredient, or',
      'tool. We may NOT show a PLACE — an interior, a room, a building, an',
      'exterior, a storefront, a shop floor, an office, a dining area — because it',
      'would read as their real premises when it is not, which is deceptive.',
      '',
      'Judge THIS image. Is it primarily a photograph of a place, or a close-up of',
      'a thing? A thing with a softly blurred, non-specific background is still a',
      'thing. A recognizable room or building is a place.',
      '',
      'Return ONLY JSON: {"isPlace": boolean, "reason": string under 12 words}.',
    ].join('\n');

    try {
      const res = await fetch(ImageSafetyService.ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model(),
          max_tokens: 120,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: bytes.toString('base64') },
                },
                { type: 'text', text: instruction },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        this.log.warn(`place check HTTP ${res.status} — refusing image (fail-closed)`);
        return { isPlace: true, reason: `check failed: ${res.status}` };
      }

      const json = (await res.json()) as { content?: { type: string; text?: string }[] };
      const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end <= start) {
        this.log.warn('place check returned no JSON — refusing image (fail-closed)');
        return { isPlace: true, reason: 'unparseable check response' };
      }
      const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<PlaceVerdict>;
      // Only an explicit, confident "not a place" passes. Anything else refuses.
      const isPlace = parsed.isPlace !== false;
      return { isPlace, reason: String(parsed.reason ?? '').slice(0, 120) };
    } catch (e) {
      this.log.warn(`place check errored — refusing image (fail-closed): ${String(e)}`);
      return { isPlace: true, reason: 'check errored' };
    }
  }
}
