import { interpolateTimestamp, preparePoints } from "../comparison/resampleChannel.ts";

export interface ActualTrackPoint {
  /** Distance from the attempt's own start (getAttemptTrack re-bases it to 0). */
  distanceMeters: number;
  timestampMs: number;
  power?: number;
}

export interface PlanZoneLike {
  startDistanceMeters: number;
  endDistanceMeters: number;
  targetPowerWatts: number;
}

export type ZoneStatus = "over" | "under" | "on" | "nodata";

export interface PlanVsActualZone {
  index: number;
  startDistanceMeters: number;
  endDistanceMeters: number;
  targetPowerWatts: number;
  /** Time-weighted average power while the rider was in this zone, or null with no power samples. */
  actualPowerWatts: number | null;
  deviationWatts: number | null;
  deviationPct: number | null;
  status: ZoneStatus;
  durationMs: number | null;
  /** Share of the zone's elapsed time that had a power reading, 0-1. */
  powerCoverage: number;
  /** Time lost (+) or gained (-) in this zone against the reference attempt; null without one. */
  timeVsReferenceMs: number | null;
}

export interface PlanVsActualSummary {
  averageActualWatts: number | null;
  /** Distance-weighted mean of the plan's targets. */
  averageTargetWatts: number;
  zonesWithData: number;
  zonesOnTarget: number;
  /** Mean deviation from plan (%, distance-weighted) in the first, middle and last third of the segment. */
  firstThirdPct: number | null;
  middleThirdPct: number | null;
  lastThirdPct: number | null;
  /** Total time against the reference attempt at the finish (+ slower), or null. */
  totalVsReferenceMs: number | null;
  insights: string[];
}

export interface PlanVsActualInput {
  track: readonly ActualTrackPoint[];
  zones: readonly PlanZoneLike[];
  segmentLengthMeters: number;
  /** Another attempt on the same segment to measure time gained/lost against. */
  reference?: readonly ActualTrackPoint[];
}

/** A zone counts as on target within this fraction of its target, but never tighter than the floor. */
export const ON_TARGET_FRACTION = 0.05;
export const ON_TARGET_FLOOR_WATTS = 5;
/** A gap longer than this between samples is a pause (auto-pause, dropout): excluded, not averaged across. */
const MAX_SAMPLE_GAP_MS = 30_000;
const MIN_INSIGHT_MISS_WATTS = 15;
/** First-vs-last-third gap (percentage points of the plan) that counts as a fade or a build. */
const SHAPE_CHANGE_PCT_POINTS = 6;

/**
 * Lines a ride's power up against a pacing plan, zone by zone. Power is averaged over *time*
 * spent in each zone (a fast descent must not outweigh a slow climb), zone boundaries and
 * time-vs-reference use the same gap-aware distance interpolation as the attempt comparison
 * screens, and the attempt's own odometer is stretched to the segment's polyline length first
 * (the two are measured differently and differ by a few percent). Pure and deterministic.
 */
export function computePlanVsActual(input: PlanVsActualInput): {
  zones: PlanVsActualZone[];
  summary: PlanVsActualSummary;
} {
  const { zones, segmentLengthMeters } = input;
  const track = normalizeTrack(input.track, segmentLengthMeters);
  const reference = input.reference === undefined ? undefined : normalizeTrack(input.reference, segmentLengthMeters);

  const referenceGapAt = (distanceMeters: number): number | null => {
    if (reference === undefined || track.length === 0 || reference.length === 0) return null;
    const own = interpolateTimestamp(track, distanceMeters, MAX_SAMPLE_GAP_MS);
    const other = interpolateTimestamp(reference, distanceMeters, MAX_SAMPLE_GAP_MS);
    if (own === null || other === null) return null;
    return own - track[0]!.timestampMs - (other - reference[0]!.timestampMs);
  };

  const energy = zones.map(() => 0);
  const powerTime = zones.map(() => 0);
  for (let i = 0; i + 1 < track.length; i += 1) {
    const from = track[i]!;
    const to = track[i + 1]!;
    const dt = to.timestampMs - from.timestampMs;
    if (dt <= 0 || dt > MAX_SAMPLE_GAP_MS) continue;
    const readings = [from.power, to.power].filter((value): value is number => value !== undefined);
    if (readings.length === 0) continue;
    const zoneIndex = zoneIndexAt((from.distanceMeters + to.distanceMeters) / 2, zones);
    if (zoneIndex === -1) continue;
    energy[zoneIndex]! += (readings.reduce((sum, value) => sum + value, 0) / readings.length) * dt;
    powerTime[zoneIndex]! += dt;
  }

  const results: PlanVsActualZone[] = zones.map((zone, index) => {
    const entry = timestampAt(track, zone.startDistanceMeters);
    const exit = timestampAt(track, zone.endDistanceMeters);
    const durationMs = entry !== null && exit !== null && exit >= entry ? exit - entry : null;
    const actualPowerWatts = powerTime[index]! > 0 ? energy[index]! / powerTime[index]! : null;
    const deviationWatts = actualPowerWatts === null ? null : actualPowerWatts - zone.targetPowerWatts;
    const tolerance = Math.max(ON_TARGET_FLOOR_WATTS, ON_TARGET_FRACTION * zone.targetPowerWatts);
    const startGap = referenceGapAt(zone.startDistanceMeters);
    const endGap = referenceGapAt(zone.endDistanceMeters);
    return {
      index,
      startDistanceMeters: zone.startDistanceMeters,
      endDistanceMeters: zone.endDistanceMeters,
      targetPowerWatts: zone.targetPowerWatts,
      actualPowerWatts,
      deviationWatts,
      deviationPct:
        deviationWatts === null || zone.targetPowerWatts <= 0 ? null : (deviationWatts / zone.targetPowerWatts) * 100,
      status:
        deviationWatts === null
          ? "nodata"
          : deviationWatts > tolerance
            ? "over"
            : deviationWatts < -tolerance
              ? "under"
              : "on",
      durationMs,
      powerCoverage: durationMs !== null && durationMs > 0 ? Math.min(1, powerTime[index]! / durationMs) : 0,
      timeVsReferenceMs: startGap === null || endGap === null ? null : endGap - startGap,
    };
  });

  return { zones: results, summary: summarize(results, zones, referenceGapAt(segmentLengthMeters)) };
}

function summarize(
  results: readonly PlanVsActualZone[],
  zones: readonly PlanZoneLike[],
  totalVsReferenceMs: number | null,
): PlanVsActualSummary {
  const lengths = zones.map((zone) => zone.endDistanceMeters - zone.startDistanceMeters);
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const averageTargetWatts =
    totalLength > 0 ? zones.reduce((sum, zone, i) => sum + zone.targetPowerWatts * lengths[i]!, 0) / totalLength : 0;

  const withData = results.filter((zone) => zone.actualPowerWatts !== null);
  const actualEnergy = withData.reduce((sum, zone) => sum + zone.actualPowerWatts! * (zone.durationMs ?? 0), 0);
  const actualTime = withData.reduce((sum, zone) => sum + (zone.durationMs ?? 0), 0);
  const averageActualWatts = actualTime > 0 ? actualEnergy / actualTime : null;

  const thirdOf = (zone: PlanVsActualZone): 0 | 1 | 2 => {
    const fraction = totalLength > 0 ? (zone.startDistanceMeters + zone.endDistanceMeters) / 2 / totalLength : 0;
    return fraction < 1 / 3 ? 0 : fraction < 2 / 3 ? 1 : 2;
  };
  const thirdPct = (third: 0 | 1 | 2): number | null => {
    let actual = 0;
    let target = 0;
    for (const zone of withData) {
      if (thirdOf(zone) !== third) continue;
      const length = zone.endDistanceMeters - zone.startDistanceMeters;
      actual += zone.actualPowerWatts! * length;
      target += zone.targetPowerWatts * length;
    }
    return target > 0 ? (actual / target - 1) * 100 : null;
  };

  const summary: PlanVsActualSummary = {
    averageActualWatts,
    averageTargetWatts,
    zonesWithData: withData.length,
    zonesOnTarget: results.filter((zone) => zone.status === "on").length,
    firstThirdPct: thirdPct(0),
    middleThirdPct: thirdPct(1),
    lastThirdPct: thirdPct(2),
    totalVsReferenceMs,
    insights: [],
  };
  summary.insights = buildInsights(summary, results);
  return summary;
}

function buildInsights(summary: PlanVsActualSummary, results: readonly PlanVsActualZone[]): string[] {
  if (summary.averageActualWatts === null) return ["This effort has no power data, so it can't be compared with the plan."];
  const insights: string[] = [];

  const overallPct = (summary.averageActualWatts / summary.averageTargetWatts - 1) * 100;
  if (Math.abs(overallPct) <= 3) {
    insights.push(
      `Averaged ${Math.round(summary.averageActualWatts)} W against a plan of ${Math.round(summary.averageTargetWatts)} W: right on plan.`,
    );
  } else {
    insights.push(
      `Averaged ${Math.round(summary.averageActualWatts)} W against a plan of ${Math.round(summary.averageTargetWatts)} W: ${Math.abs(Math.round(overallPct))}% ${overallPct > 0 ? "over" : "under"} plan.`,
    );
  }

  const { firstThirdPct: first, lastThirdPct: last } = summary;
  if (first !== null && last !== null) {
    if (first >= 8 && last <= -5) {
      insights.push(
        `Went out hard: ${Math.round(first)}% over plan in the first third, then ${Math.abs(Math.round(last))}% under in the last.`,
      );
    } else if (last >= 5 && first <= 2) {
      insights.push(
        `Finished strong: the last third was ${Math.round(last)}% over plan after a ${first >= 0 ? "controlled" : "conservative"} start.`,
      );
    } else if (first - last >= SHAPE_CHANGE_PCT_POINTS) {
      insights.push(
        `Faded as the effort went on: ${signedPct(first)} against plan in the first third, ${signedPct(last)} in the last.`,
      );
    } else if (last - first >= SHAPE_CHANGE_PCT_POINTS) {
      insights.push(
        `Built through the effort: ${signedPct(first)} against plan in the first third, ${signedPct(last)} in the last.`,
      );
    }
  }

  const biggest = results
    .filter((zone) => zone.deviationWatts !== null)
    .reduce<PlanVsActualZone | undefined>(
      (best, zone) => (best === undefined || Math.abs(zone.deviationWatts!) > Math.abs(best.deviationWatts!) ? zone : best),
      undefined,
    );
  if (biggest !== undefined && Math.abs(biggest.deviationWatts!) >= MIN_INSIGHT_MISS_WATTS) {
    insights.push(
      `Biggest miss: ${Math.round(biggest.startDistanceMeters)}–${Math.round(biggest.endDistanceMeters)} m, ${Math.round(Math.abs(biggest.deviationWatts!))} W ${biggest.deviationWatts! > 0 ? "over" : "under"} the target.`,
    );
  }

  const coverage = results.reduce((sum, zone) => sum + zone.powerCoverage * (zone.durationMs ?? 0), 0);
  const duration = results.reduce((sum, zone) => sum + (zone.durationMs ?? 0), 0);
  if (duration > 0 && coverage / duration < 0.8) {
    insights.push(`Power data covers only ${Math.round((coverage / duration) * 100)}% of the effort.`);
  }
  return insights;
}

function signedPct(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded)}%`;
}

/** Stretches the attempt's odometer onto the segment's polyline length and makes distance non-decreasing. */
function normalizeTrack(track: readonly ActualTrackPoint[], segmentLengthMeters: number): ActualTrackPoint[] {
  if (track.length === 0) return [];
  let runningMax = 0;
  const monotone = track.map((point) => {
    runningMax = Math.max(runningMax, Math.max(0, point.distanceMeters));
    return { ...point, distanceMeters: runningMax };
  });
  const attemptLength = monotone[monotone.length - 1]!.distanceMeters;
  if (attemptLength <= 0 || segmentLengthMeters <= 0) return preparePoints(monotone);
  const scale = segmentLengthMeters / attemptLength;
  const scaled = monotone.map((point) => ({ ...point, distanceMeters: point.distanceMeters * scale }));
  // Float scaling must not leave the finish a hair short of the segment length.
  scaled[scaled.length - 1] = { ...scaled[scaled.length - 1]!, distanceMeters: segmentLengthMeters };
  return preparePoints(scaled);
}

function timestampAt(track: readonly ActualTrackPoint[], distanceMeters: number): number | null {
  if (track.length === 0) return null;
  if (distanceMeters <= track[0]!.distanceMeters) return track[0]!.timestampMs;
  if (distanceMeters >= track[track.length - 1]!.distanceMeters) return track[track.length - 1]!.timestampMs;
  return interpolateTimestamp(track, distanceMeters, MAX_SAMPLE_GAP_MS);
}

function zoneIndexAt(distanceMeters: number, zones: readonly PlanZoneLike[]): number {
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i]!;
    const isLast = i === zones.length - 1;
    if (distanceMeters >= zone.startDistanceMeters && (distanceMeters < zone.endDistanceMeters || isLast)) return i;
  }
  return -1;
}
