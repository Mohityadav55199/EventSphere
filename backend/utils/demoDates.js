// Date helpers for keeping the public demo bookable.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

/**
 * Moves a past date forward by whole weeks until it is at least `minLeadDays` in the future.
 * Whole weeks keep the original weekday and time of day ("Friday 7pm" stays "Friday 7pm").
 * Dates that are already far enough ahead are returned unchanged.
 */
export function rollForwardByWeeks(date, now = new Date(), minLeadDays = 7) {
  const original = new Date(date);
  const target = now.getTime() + minLeadDays * DAY_MS;
  if (original.getTime() >= target) return original;
  const weeks = Math.ceil((target - original.getTime()) / WEEK_MS);
  return new Date(original.getTime() + weeks * WEEK_MS);
}
