import { computePlanVsActual, type ActualTrackPoint } from "./computePlanVsActual.ts";

/**
 * Per-quarter-mile power ceilings: the most a plan may ask of the rider in a stretch (GOALS priority 8).
 * A ceiling comes from what the rider has actually held there, where they have ridden it, and otherwise
 * from a sliding %FTP fallback. It is a guard on the plan, not a prediction, and every constant is
 * configurable and named so the assumptions are visible. Pure and deterministic.
 */
export interface PlanCeilingConfig {
  /** Headroom over the best average power ever held in a zone (0.04 = 4%). */
  historyMarginPct: number;
  /** History counts only when the best held power is at least this fraction of FTP; less means the rider coasted. */
  minHeldFractionOfFtp: number;
  /**
   * Fallback ceiling at the start of the segment, as a multiple of the plan's anchor power (the average the
   * goal needs). The original brief said "about 105% FTP early, trending to 95%"; for an hour-long goal the
   * anchor is 100% FTP, so that is 1.05 -> 0.95 of the anchor. That averages below the goal's own requirement,
   * which makes every goal at its anchor power look infeasible, so the defaults keep some slack above it.
   */
  fallbackStartPctOfAnchor: number;
  /** Fallback ceiling at the end of the segment, as a multiple of the anchor power. */
  fallbackEndPctOfAnchor: number;
  /** No ceiling is ever below this fraction of FTP (the plan's own floor) ... */
  minPctFtp: number;
  /** ... or above this one (the Karoo's hard limit, AiPlanValidator: FTP * 1.5). */
  maxPctFtp: number;
  /** A past effort's zone needs at least this share of its time with a power reading to count. */
  minPowerCoverage: number;
}

export const DEFAULT_PLAN_CEILING_CONFIG: PlanCeilingConfig = {
  historyMarginPct: 0.04,
  minHeldFractionOfFtp: 0.7,
  fallbackStartPctOfAnchor: 1.1,
  fallbackEndPctOfAnchor: 1.04,
  minPctFtp: 0.7,
  maxPctFtp: 1.5,
  minPowerCoverage: 0.8,
};

export interface CeilingZone {
  startDistanceMeters: number;
  endDistanceMeters: number;
}

/** What the rider's past efforts say about one zone. */
export interface ZoneHistory {
  /** The highest average power (W) held across the zone in any past effort with enough power data, or null. */
  bestHeldWatts: number | null;
  /** How many past efforts had usable power in this zone. */
  attemptsWithData: number;
}

export type CeilingSource = "history" | "fallback";

export interface ZoneCeiling {
  ceilingWatts: number;
  source: CeilingSource;
}

/**
 * Best average power held in each zone across past efforts. `attempts` are tracks with distance
 * re-based to the effort's own start (getAttemptTrack). Zones with too little power data in an
 * effort are ignored for that effort.
 */
export function summarizeZoneHistory(input: {
  attempts: readonly { track: readonly ActualTrackPoint[] }[];
  zones: readonly CeilingZone[];
  segmentLengthMeters: number;
  config?: Partial<PlanCeilingConfig>;
}): ZoneHistory[] {
  const config = { ...DEFAULT_PLAN_CEILING_CONFIG, ...input.config };
  const summary: ZoneHistory[] = input.zones.map(() => ({ bestHeldWatts: null, attemptsWithData: 0 }));
  const zoneLike = input.zones.map((zone) => ({ ...zone, targetPowerWatts: 0 }));
  for (const attempt of input.attempts) {
    if (attempt.track.length < 2) continue;
    const { zones } = computePlanVsActual({ track: attempt.track, zones: zoneLike, segmentLengthMeters: input.segmentLengthMeters });
    zones.forEach((result, index) => {
      if (result.actualPowerWatts === null || result.powerCoverage < config.minPowerCoverage) return;
      const entry = summary[index]!;
      entry.attemptsWithData += 1;
      entry.bestHeldWatts = Math.max(entry.bestHeldWatts ?? 0, result.actualPowerWatts);
    });
  }
  return summary;
}

/** One past effort boiled down for planning: how long it took, its average power, and the power it held in each zone. */
export interface EffortSummary {
  durationSeconds: number;
  /** Average power over the effort (W), or null with no usable power. */
  meanWatts: number | null;
  /** Average power held in each zone (W); null where the effort has too little power data. */
  zoneWatts: (number | null)[];
}

/** Per-effort summaries, in the order given (loadCalibrationAttempts returns newest first). */
export function summarizeEfforts(input: {
  attempts: readonly { track: readonly ActualTrackPoint[]; durationMs?: number }[];
  zones: readonly CeilingZone[];
  segmentLengthMeters: number;
  config?: Partial<PlanCeilingConfig>;
}): EffortSummary[] {
  const config = { ...DEFAULT_PLAN_CEILING_CONFIG, ...input.config };
  const zoneLike = input.zones.map((zone) => ({ ...zone, targetPowerWatts: 0 }));
  const efforts: EffortSummary[] = [];
  for (const attempt of input.attempts) {
    if (attempt.track.length < 2) continue;
    const first = attempt.track[0]!.timestampMs;
    const last = attempt.track[attempt.track.length - 1]!.timestampMs;
    const durationSeconds = (attempt.durationMs ?? last - first) / 1_000;
    if (!(durationSeconds > 0)) continue;
    const { zones, summary } = computePlanVsActual({ track: attempt.track, zones: zoneLike, segmentLengthMeters: input.segmentLengthMeters });
    efforts.push({
      durationSeconds,
      meanWatts: summary.averageActualWatts,
      zoneWatts: zones.map((zone) => (zone.actualPowerWatts === null || zone.powerCoverage < config.minPowerCoverage ? null : zone.actualPowerWatts)),
    });
  }
  return efforts;
}

/**
 * The ceiling for every zone. Where the rider has held at least `minHeldFractionOfFtp` of FTP, it is
 * the best they held plus the margin ("history"). Everywhere else it slides linearly from
 * `fallbackStartPctOfAnchor` to `fallbackEndPctOfAnchor` times the plan's anchor power across the segment
 * ("fallback"), so a short, hard goal is not capped at an hour's power.
 */
export function computeZoneCeilings(input: {
  zones: readonly CeilingZone[];
  ftpWatts: number;
  /** The plan's anchor power: the average the goal needs (powerDurationAnchor.computeAnchorPowerWatts). */
  anchorPowerWatts: number;
  history?: readonly (ZoneHistory | undefined)[];
  config?: Partial<PlanCeilingConfig>;
}): ZoneCeiling[] {
  const config = { ...DEFAULT_PLAN_CEILING_CONFIG, ...input.config };
  if (!Number.isFinite(input.ftpWatts) || input.ftpWatts <= 0) throw new RangeError(`ftpWatts must be positive, got ${input.ftpWatts}`);
  if (!Number.isFinite(input.anchorPowerWatts) || input.anchorPowerWatts <= 0) throw new RangeError(`anchorPowerWatts must be positive, got ${input.anchorPowerWatts}`);
  const total = input.zones.length === 0 ? 0 : input.zones[input.zones.length - 1]!.endDistanceMeters;
  const minWatts = Math.floor(input.ftpWatts * config.minPctFtp);
  const maxWatts = Math.floor(input.ftpWatts * config.maxPctFtp);

  return input.zones.map((zone, index) => {
    const held = input.history?.[index]?.bestHeldWatts ?? null;
    if (held !== null && held >= input.ftpWatts * config.minHeldFractionOfFtp) {
      return { ceilingWatts: clamp(Math.floor(held * (1 + config.historyMarginPct)), minWatts, maxWatts), source: "history" as const };
    }
    const fraction = total > 0 ? (zone.startDistanceMeters + zone.endDistanceMeters) / 2 / total : 0;
    const multiple = config.fallbackStartPctOfAnchor + (config.fallbackEndPctOfAnchor - config.fallbackStartPctOfAnchor) * fraction;
    return { ceilingWatts: clamp(Math.floor(input.anchorPowerWatts * multiple), minWatts, maxWatts), source: "fallback" as const };
  });
}

/** Zones of a plan whose target is above the ceiling (used to warn on imported plans, which are never rewritten). */
export function findTargetsAboveCeilings(
  zones: readonly { targetPowerWatts: number }[],
  ceilings: readonly ZoneCeiling[],
): { zoneIndex: number; targetPowerWatts: number; ceilingWatts: number; source: CeilingSource }[] {
  const found: { zoneIndex: number; targetPowerWatts: number; ceilingWatts: number; source: CeilingSource }[] = [];
  zones.forEach((zone, zoneIndex) => {
    const ceiling = ceilings[zoneIndex];
    if (ceiling !== undefined && zone.targetPowerWatts > ceiling.ceilingWatts) {
      found.push({ zoneIndex, targetPowerWatts: zone.targetPowerWatts, ceilingWatts: ceiling.ceilingWatts, source: ceiling.source });
    }
  });
  return found;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
