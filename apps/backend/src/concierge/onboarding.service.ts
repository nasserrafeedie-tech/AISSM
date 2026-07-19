import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { BrandProfile } from '@prisma/client';
import type { UpdateBrandProfilePayload } from '@smm/contracts';
import { LlmService } from '../operator/llm/llm.service';

/**
 * §6 onboarding as a checklist of profile fields, NOT a step counter — so an
 * hours-long gap resumes cleanly at the next empty field, and one answer that
 * fills several fields skips ahead. The Concierge asks one question per text.
 *
 * This module owns three things: *which* field to ask about next, the human
 * phrasing of each question, and *interpreting* the owner's answer into a
 * brand-profile patch. Interpretation runs through Haiku when a key is set
 * (one answer may fill several fields at once); offline it falls back to
 * deterministic per-field parsing so the whole flow works for free.
 */

export type ProfileField =
  | 'business_type'
  | 'voice_tone'
  | 'target_customer'
  | 'offers'
  | 'dos_and_donts'
  | 'posting_frequency';

type Patch = UpdateBrandProfilePayload['patch'];

/** Fields required before we consider onboarding complete and plan week 1. */
const REQUIRED: ProfileField[] = [
  'business_type',
  'voice_tone',
  'target_customer',
  'offers',
  'posting_frequency',
];

/** What the LLM may return: any subset of patchable profile fields. */
const LlmPatch = z
  .object({
    business_type: z.string().max(200).optional(),
    voice_tone: z.string().max(300).optional(),
    target_customer: z.string().max(300).optional(),
    offers: z.array(z.string().max(200)).max(20).optional(),
    dos_and_donts: z.array(z.string().max(300)).max(20).optional(),
    posting_frequency: z.number().int().min(1).max(21).optional(),
  })
  .strict();

@Injectable()
export class OnboardingService {
  private readonly log = new Logger(OnboardingService.name);

  constructor(private readonly llm: LlmService) {}

  /** The next unanswered required field, or null when we can start posting. */
  nextField(profile: BrandProfile | null): ProfileField | null {
    if (!profile) return 'business_type';
    for (const field of REQUIRED) {
      if (this.isEmpty(profile, field)) return field;
    }
    return null;
  }

  isComplete(profile: BrandProfile | null): boolean {
    return this.nextField(profile) === null;
  }

  /** Would applying `patch` to `profile` finish the checklist? */
  wouldComplete(profile: BrandProfile | null, patch: Patch): boolean {
    const filled = (field: ProfileField): boolean => {
      switch (field) {
        case 'business_type':
          return Boolean(patch.business_type ?? profile?.businessType);
        case 'voice_tone':
          return Boolean(patch.voice_tone ?? profile?.voiceTone);
        case 'target_customer':
          return Boolean(patch.target_customer ?? profile?.targetCustomer);
        case 'offers':
          return (patch.offers ?? profile?.offers ?? []).length > 0;
        case 'dos_and_donts':
          return (patch.dos_and_donts ?? profile?.dosAndDonts ?? []).length > 0;
        case 'posting_frequency':
          return Boolean(patch.posting_frequency ?? profile?.postingFrequency);
      }
    };
    return REQUIRED.every(filled);
  }

  /** One-question-per-text prompts, adapted where possible to what we know. */
  question(field: ProfileField, profile: BrandProfile | null): string {
    switch (field) {
      case 'business_type':
        return (
          "Hey — this is Handled ✳ From here on out I'll plan, write, design, " +
          "and post your social media, and you'll mostly just reply to my " +
          "texts. First things first: what's your business? Tell me in a " +
          'sentence or two.'
        );
      case 'voice_tone': {
        // Only echo the business back when it reads as a short label — the
        // offline parser stores the owner's whole sentence, which would be
        // awkward to parrot ("posts for I run a little coffee shop in…").
        const bt = profile?.businessType;
        const echo = bt && bt.length <= 40 ? ` for ${bt}` : '';
        return `Got it. I'm picturing posts${echo} that feel warm but polished — is that right, or do you want a different vibe?`;
      }
      case 'target_customer':
        return 'Perfect. Who are you mainly trying to reach — your ideal customer?';
      case 'offers':
        return "What's worth showing off? Your best products, services, or anything you want more people to know about.";
      case 'dos_and_donts':
        return 'Anything I should always mention, or never mention?';
      case 'posting_frequency':
        return 'Last one: how often should I post? Most businesses do 3–4× a week — want me to start there?';
    }
  }

  /**
   * Interpret the owner's answer to `asked` into a profile patch.
   * With an Anthropic key: Haiku extracts every field the answer covers.
   * Offline (or on any LLM failure): deterministic parsing of just the asked
   * field, so onboarding always moves forward.
   */
  async interpret(
    asked: ProfileField,
    answer: string,
    profile: BrandProfile | null,
  ): Promise<Patch> {
    const text = answer.trim();
    if (!text) return {};

    const llmOn =
      Boolean(process.env.ANTHROPIC_API_KEY) && process.env.LLM_FAKE !== '1';
    if (llmOn) {
      try {
        return await this.interpretWithLlm(asked, text, profile);
      } catch (err) {
        this.log.warn(`LLM interpret failed, falling back: ${String(err)}`);
      }
    }
    return this.interpretOffline(asked, text);
  }

  private async interpretWithLlm(
    asked: ProfileField,
    answer: string,
    profile: BrandProfile | null,
  ): Promise<Patch> {
    const known = JSON.stringify({
      business_type: profile?.businessType ?? null,
      voice_tone: profile?.voiceTone ?? null,
      target_customer: profile?.targetCustomer ?? null,
      offers: profile?.offers ?? [],
      posting_frequency: profile?.postingFrequency ?? null,
    });
    const patch = await this.llm.completeJson(
      {
        tier: 'bulk',
        cachedContext:
          'You extract structured brand-profile fields from a small-business ' +
          'owner\'s SMS during onboarding. Return ONLY a JSON object with any ' +
          'of these keys the answer supports: business_type (string), ' +
          'voice_tone (string), target_customer (string), offers (string[]), ' +
          'dos_and_donts (string[]), posting_frequency (integer posts/week, ' +
          '1-21). Fill every field the answer covers, not just the one asked. ' +
          'If the owner agrees to a suggestion ("yes", "sounds good"), use the ' +
          'suggested value. Omit keys the answer does not cover. No prose.',
        prompt:
          `Current profile: ${known}\n` +
          `Field asked about: ${asked}\n` +
          `Owner's answer: """${answer}"""`,
        maxTokens: 400,
      },
      LlmPatch,
    );
    // An empty patch would stall the interview — fall back to offline parsing.
    return Object.keys(patch).length > 0
      ? patch
      : this.interpretOffline(asked, answer);
  }

  /** Free-mode parsing: fill exactly the field we asked about. */
  private interpretOffline(asked: ProfileField, answer: string): Patch {
    const agreed = /^\s*(y(es|ep|eah|up)?|sure|sounds good|that works|perfect|ok(ay)?|do (?:it|that))\b/i;
    switch (asked) {
      case 'business_type':
        return { business_type: answer.slice(0, 200) };
      case 'voice_tone':
        // A bare "yes" takes the suggestion; a longer agreement ("yeah, but a
        // little playful too") carries extra flavor — keep the owner's words.
        return {
          voice_tone:
            agreed.test(answer) && answer.length <= 24
              ? 'warm but polished'
              : answer.slice(0, 300),
        };
      case 'target_customer':
        return { target_customer: answer.slice(0, 300) };
      case 'offers':
        return { offers: splitList(answer).map((s) => s.slice(0, 200)) };
      case 'dos_and_donts':
        return { dos_and_donts: splitList(answer).map((s) => s.slice(0, 300)) };
      case 'posting_frequency': {
        const num = /(\d{1,2})\s*(?:x|times?|posts?|\/)?/i.exec(answer);
        let n = 3; // the suggested default
        if (/daily|every ?day/i.test(answer)) n = 7;
        else if (num) n = Number(num[1]);
        else if (!agreed.test(answer)) n = 3;
        return { posting_frequency: Math.max(1, Math.min(21, n)) };
      }
    }
  }

  private isEmpty(profile: BrandProfile, field: ProfileField): boolean {
    switch (field) {
      case 'business_type':
        return !profile.businessType;
      case 'voice_tone':
        return !profile.voiceTone;
      case 'target_customer':
        return !profile.targetCustomer;
      case 'offers':
        return profile.offers.length === 0;
      case 'dos_and_donts':
        return profile.dosAndDonts.length === 0;
      case 'posting_frequency':
        return !profile.postingFrequency;
    }
  }
}

/** "lattes, pastries and our patio" → ["lattes", "pastries", "our patio"] */
function splitList(answer: string): string[] {
  return answer
    .split(/,|\band\b|\n|;/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}
