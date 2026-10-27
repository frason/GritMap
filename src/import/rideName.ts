const MAX_NAME_LENGTH = 80;

/**
 * The name a ride arrived with, if its file carried one: a FIT session's sport profile name (what the bike
 * computer calls the profile, e.g. "Road") or a GPX track's <name>. Returns undefined when there is none, so
 * the app falls back to a title built from the ride's date (see rideTitle in formatRideStats).
 */
export function extractRideName(deviceMetadata: Record<string, unknown>): string | undefined {
  const sessions = deviceMetadata.sessions;
  const session = Array.isArray(sessions) && sessions.length > 0 ? sessions[0] : undefined;
  const sessionRecord = typeof session === "object" && session !== null ? (session as Record<string, unknown>) : undefined;
  return cleanName(sessionRecord?.sportProfileName) ?? cleanName(deviceMetadata.trackName);
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  return trimmed.length === 0 ? undefined : trimmed.slice(0, MAX_NAME_LENGTH);
}
