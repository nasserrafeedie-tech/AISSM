/**
 * Timezone helpers for scheduling.
 *
 * The planner picks wall-clock hours that suit a local business — 09:00,
 * 12:30, 17:00. Those are meaningless without a zone: treating "09:00" as UTC
 * publishes at 2am in California, which is useless to the customer and the
 * opposite of what the distribution playbook is trying to achieve.
 *
 * Uses Intl rather than a date library, so DST is resolved by the platform's
 * own tz database for the specific date in question.
 */

/** Milliseconds to add to a UTC-parsed wall time to get the true instant. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  try {
    const asUtc = new Date(instant.toLocaleString('en-US', { timeZone: 'UTC' }));
    const asZone = new Date(instant.toLocaleString('en-US', { timeZone }));
    return asUtc.getTime() - asZone.getTime();
  } catch {
    return 0; // unknown zone → treat as UTC rather than throwing
  }
}

/**
 * "2026-07-20" + "09:00" in America/Los_Angeles → the real UTC instant of
 * 9am Pacific that day.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const naive = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(naive.getTime())) return new Date();
  return new Date(naive.getTime() + zoneOffsetMs(naive, timeZone));
}

/** "Tue, 9:00 AM" in the business's own zone — how the owner thinks about it. */
export function formatInZone(when: Date, timeZone: string): string {
  try {
    return when.toLocaleString('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return when.toISOString();
  }
}

/** Tomorrow at 9am in the business's zone, as a UTC instant. */
export function tomorrowMorningInZone(timeZone: string): Date {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(tomorrow);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '01';
  return zonedToUtc(`${get('year')}-${get('month')}-${get('day')}`, '09:00', timeZone);
}
