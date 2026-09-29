const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export function formatRideDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
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
