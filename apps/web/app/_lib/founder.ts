// Single source of truth for the founder story. Edit it here and it updates
// everywhere it appears (the homepage note and the About page). Folders that
// start with "_" are private in the Next.js app router — they never become
// routes, so this file is safe to live alongside the pages.

export const FOUNDER_NAME = 'Nasser';
export const FOUNDER_ROLE = 'founder';

// Each string is one paragraph.
export const FOUNDER_NOTE: readonly string[] = [
  'I kept watching my mom come home from long hours running her own business and go straight to her computer to pour hours into creating posts on Instagram and TikTok, then feel guilty as if she wasn’t doing enough when her social media went quiet for a month.',
  'I feel as if social media for a business shouldn’t be a second full-time job, so we built the partner that I wished existed for her. One that you can just text, then get back to the work you love.',
] as const;
