/**
 * Rider-facing wording for how GritMap matched a ride to a segment. The matcher's own terms
 * (coverage, deviation, backward progress, matcher version) mean nothing to someone who has not
 * read its code, so each one gets a plain name and a sentence saying what it tells you.
 */

const REASONS: Record<string, string> = {
  "insufficient-coverage":
    "Your ride did not follow the whole segment closely enough. Part of it may have been off the route, or the GPS may have missed a stretch.",
  "implausible-gap-speed":
    "Your GPS dropped out for a while, and the gap would need an unrealistic speed to cross. The time for this effort may be off.",
  "backward-progress": "Your track moved backwards along the segment, so it may not be one clean pass.",
  "different-route": "Your ride went somewhere other than along this segment.",
  "reverse-traversal": "Your ride went along this segment in the opposite direction.",
};

export function describeMatchReason(reason: string): string {
  return REASONS[reason] ?? `${reason.charAt(0).toUpperCase()}${reason.slice(1).replace(/-/g, " ")}.`;
}

/** The status shown at the top of the review screen. */
export function describeAttemptStatus(decision: "accept" | "borderline", manuallyApproved: boolean): {
  label: string;
  tone: "success" | "warning";
  explanation: string;
} {
  if (manuallyApproved) {
    return { label: "Approved by you", tone: "success", explanation: "You confirmed this effort, so it counts toward your times." };
  }
  if (decision === "accept") {
    return { label: "Matched", tone: "success", explanation: "GritMap is confident this ride covered the segment, so it counts toward your times." };
  }
  return {
    label: "Needs your review",
    tone: "warning",
    explanation: "GritMap isn't sure this ride followed the whole segment. Look at the map and the details, then decide whether it counts.",
  };
}

export interface MatchDetail {
  label: string;
  value: string;
  /** What this number tells you, in a sentence. */
  meaning: string;
}

/** The numbers behind a match, named and explained for a rider. */
export function describeMatchDetails(input: {
  confidenceScore: number;
  coveragePct: number;
  maxDeviationMeters: number;
  medianDeviationMeters?: number;
  maxBackwardMeters: number;
  gpsGapCount: number;
  maxGapMs: number;
}): MatchDetail[] {
  const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;
  const meters = (value: number) => `${Math.round(value)} m`;
  const seconds = (ms: number) => (ms >= 60_000 ? `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1_000)} s` : `${Math.round(ms / 1_000)} s`);
  return [
    { label: "Match", value: percent(input.confidenceScore), meaning: "How well your ride lines up with the segment overall." },
    { label: "Route followed", value: percent(input.coveragePct), meaning: "The share of the segment your ride passed through." },
    { label: "Furthest off the route", value: meters(input.maxDeviationMeters), meaning: "The most your ride strayed from the segment's line." },
    ...(input.medianDeviationMeters === undefined
      ? []
      : [{ label: "Usually off the route by", value: meters(input.medianDeviationMeters), meaning: "How far from the line you typically were." }]),
    { label: "Backtracking", value: meters(input.maxBackwardMeters), meaning: "How far your track went backwards along the segment." },
    { label: "GPS dropouts", value: String(input.gpsGapCount), meaning: "Times your GPS stopped recording for a moment." },
    { label: "Longest dropout", value: seconds(input.maxGapMs), meaning: "The longest stretch with no GPS." },
  ];
}
