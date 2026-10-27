const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

/**
 * "Monday, Oct 5". A ride from an earlier (or later) year carries its year ("Sunday, Nov 9, 2025"),
 * so a list sorted newest-first never looks out of order. `nowMs` is only for tests.
 */
export function formatRideDate(ms: number, nowMs: number = Date.now()): string {
  const date = new Date(ms);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === new Date(nowMs).getFullYear() ? {} : { year: "numeric" }),
  });
}

export function formatDistanceMiles(meters?: number): string {
  if (meters === undefined) return "—";
  return `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
}

export function formatElevationFeet(meters?: number): string {
  if (meters === undefined) return "—";
  return `${Math.round(meters / METERS_PER_FOOT)} ft`;
}

export function formatDurationHoursMinutes(ms?: number): string {
  if (ms === undefined) return "—";
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** mm:ss, for goal/attempt times precise enough to matter for a PR (e.g. "45:49"). */
export function formatDurationMinutesSeconds(ms: number): string {
  const totalSeconds = Math.round(ms / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatGradePercent(percent?: number): string {
  if (percent === undefined) return "—";
  return `${percent.toFixed(1)}%`;
}

/** Reuses formatDistanceMiles's own meters-per-mile conversion, scaled to an hourly rate. */
export function formatSpeedMph(metersPerSecond?: number): string {
  if (metersPerSecond === undefined) return "—";
  const SECONDS_PER_HOUR = 3_600;
  return `${((metersPerSecond * SECONDS_PER_HOUR) / METERS_PER_MILE).toFixed(1)} mph`;
}

/**
 * "Sat morning ride": the title for a ride whose file carried no name, built from when it started (the phone's
 * local time). Morning is before noon, afternoon before 5pm, evening before 9pm, otherwise night.
 */
export function fallbackRideTitle(startMs: number): string {
  const date = new Date(startMs);
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" });
  const hour = date.getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  return `${weekday} ${part} ride`;
}

/** What a ride is called on its card and detail page: its own name, else the date-built title, else "Ride". */
export function rideTitle(ride: { name?: string; startTimestampMs?: number }): string {
  if (ride.name !== undefined) return ride.name;
  return ride.startTimestampMs === undefined ? "Ride" : fallbackRideTitle(ride.startTimestampMs);
}
