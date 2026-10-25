import type { PacingClassification } from "../pacing/buildTargetPowerZones.ts";
import { formatDurationMinutesSeconds } from "../screens/formatRideStats.ts";

const METERS_PER_MILE = 1609.344;

/** How hard a stretch of a plan asks you to ride. Drives the intensity colours. */
export type PlanTone = "rest" | "hold" | "push";

const TONE_BY_CLASSIFICATION: Record<PacingClassification, PlanTone> = { REST: "rest", HOLD: "hold", PUSH: "push" };
export const TONE_LABELS: Record<PlanTone, string> = { rest: "Rest", hold: "Hold", push: "Push" };
/** What each tone asks of the rider, in the words the legend and the info bubble use. */
export const TONE_MEANINGS: Record<PlanTone, string> = { rest: "Ease off", hold: "Ride steady", push: "Ride harder" };

export function classificationTone(classification: PacingClassification): PlanTone {
  return TONE_BY_CLASSIFICATION[classification];
}

/** "0.0–0.5 mi": a section's start and end along the segment, in miles. */
export function formatSectionRange(startMeters: number, endMeters: number): string {
  const miles = (meters: number) => (meters / METERS_PER_MILE).toFixed(1);
  return `${miles(startMeters)}–${miles(endMeters)} mi`;
}

export interface PlanSectionRow {
  /** 1-based, as a rider counts them. */
  number: number;
  rangeLabel: string;
  watts: number;
  tone: PlanTone;
  toneLabel: string;
}

export interface PlanZoneInput {
  startDistanceMeters: number;
  endDistanceMeters: number;
  targetPowerWatts: number;
  classification: PacingClassification;
}

export function buildSectionRows(zones: readonly PlanZoneInput[]): PlanSectionRow[] {
  return zones.map((zone, index) => {
    const tone = classificationTone(zone.classification);
    return {
      number: index + 1,
      rangeLabel: formatSectionRange(zone.startDistanceMeters, zone.endDistanceMeters),
      watts: zone.targetPowerWatts,
      tone,
      toneLabel: TONE_LABELS[tone],
    };
  });
}

/** How far a best time has come toward a goal: 1 when reached, otherwise goal / best. Undefined without a best. */
export function goalProgress(bestMs: number | undefined, goalMs: number): number | undefined {
  if (bestMs === undefined || !(bestMs > 0) || !(goalMs > 0)) return undefined;
  return bestMs <= goalMs ? 1 : goalMs / bestMs;
}

export interface GoalStage {
  key: "best" | "next" | "long-term";
  label: string;
  timeLabel: string;
}

/** The stages of a staged goal in order, from the rider's best to the long-term goal. Stages with no time are left out. */
export function buildGoalStages(input: { bestMs?: number; nextGoalMs: number; longTermMs?: number }): GoalStage[] {
  const stages: GoalStage[] = [];
  if (input.bestMs !== undefined) stages.push({ key: "best", label: "Best", timeLabel: formatDurationMinutesSeconds(input.bestMs) });
  stages.push({ key: "next", label: input.longTermMs === undefined ? "Goal" : "Next goal", timeLabel: formatDurationMinutesSeconds(input.nextGoalMs) });
  if (input.longTermMs !== undefined) stages.push({ key: "long-term", label: "Long-term", timeLabel: formatDurationMinutesSeconds(input.longTermMs) });
  return stages;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Oct 5": a short date for marks and chips. Local time. */
export function formatShortDate(ms: number): string {
  const date = new Date(ms);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** The quiet "Last sent Oct 5" line when the phone only knows what it sent. Undefined when nothing was ever sent. */
export function lastSentLabel(lastSentAtMs: number | undefined): string | undefined {
  return lastSentAtMs === undefined ? undefined : `Last sent ${formatShortDate(lastSentAtMs)}`;
}

/** Who wrote the plan: GritMap's own, or an imported one with its author when known. */
export function planSourceLabel(input: { origin: "generated" | "imported"; source?: "self" | "human-coach" | "ai-coach"; authorLabel?: string }): string {
  if (input.origin === "generated") return "GritMap plan";
  const base = input.source === "human-coach" ? "Coach plan" : input.source === "ai-coach" ? "AI coach plan" : "Your plan";
  return input.authorLabel === undefined ? base : `${base} · ${input.authorLabel}`;
}
