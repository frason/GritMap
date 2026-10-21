export type PastDateResult = { ok: true; value: number } | { ok: false; error: string };

const EARLIEST_YEAR = 2000;

/**
 * Reads a date the rider typed for a past weight: year-month-day ("2025-05-10") or month/day/year ("5/10/2025").
 * Returns noon local time that day (callers cap it at "now" for today), so it falls inside the ride day whatever the time
 * zone; dates after today and impossible dates are refused with a plain message.
 */
export function parsePastDateInput(text: string, nowMs: number): PastDateResult {
  const trimmed = text.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  let year: number;
  let month: number;
  let day: number;
  if (iso !== null) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (us !== null) {
    month = Number(us[1]);
    day = Number(us[2]);
    year = Number(us[3]);
  } else {
    return { ok: false, error: "Enter the date as year-month-day, for example 2025-05-10." };
  }
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || year < EARLIEST_YEAR) {
    return { ok: false, error: "That date doesn't exist. Enter it as year-month-day, for example 2025-05-10." };
  }
  const now = new Date(nowMs);
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  if (date.getTime() >= startOfTomorrow) return { ok: false, error: "That date is in the future. Enter the day you rode." };
  return { ok: true, value: date.getTime() };
}
