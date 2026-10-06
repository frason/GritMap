import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { buildTargetPowerZones } from "./buildTargetPowerZones.ts";
import { computeAdaptiveZoneGrades } from "./computeZoneGrades.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";
import {
  COACH_PLAN_PACKAGE_TYPE,
  COACH_PLAN_SCHEMA_VERSION,
  MAX_FTP_FRACTION,
  MAX_INSTRUCTION_CHARACTERS,
  MAX_TARGET_STEP_WATTS,
} from "./coachPlan.ts";

export interface CoachPlanRequestInput {
  segmentName: string;
  segmentFingerprint: string;
  referencePolyline: readonly SegmentReferencePoint[];
  ftpWatts: number;
  /** When set, the template is pre-filled with GritMap's own generated plan for this goal, as a starting point to edit. */
  targetDurationMs?: number;
}

/**
 * A self-contained message a rider can paste to a coach or an AI assistant: the segment's
 * facts, the rules a plan must satisfy, and a ready-to-edit template that already parses. The
 * coach returns the edited JSON; the rider pastes it into "Import coach plan", where it is
 * validated by the same parser (coachPlan.ts) the rules below are quoted from.
 */
export function buildCoachPlanRequest(input: CoachPlanRequestInput): string {
  const totalMeters = input.referencePolyline.at(-1)?.distanceMeters ?? 0;
  const windows = computeAdaptiveZoneGrades(input.referencePolyline);

  const zones =
    input.targetDurationMs === undefined
      ? windows.map((window) => ({
          startDistanceMeters: round1(window.startDistanceMeters),
          endDistanceMeters: round1(window.endDistanceMeters),
          targetPercentFtp: 90,
        }))
      : buildTargetPowerZones(
          windows,
          computeAnchorPowerWatts(input.ftpWatts, input.targetDurationMs),
          input.ftpWatts,
        ).map((zone) => ({
          startDistanceMeters: round1(zone.startDistanceMeters),
          endDistanceMeters: round1(zone.endDistanceMeters),
          targetPowerWatts: zone.targetPowerWatts,
        }));
  // The last zone must end at the segment's exact length, not a rounded one.
  if (zones.length > 0) zones[zones.length - 1]!.endDistanceMeters = totalMeters;

  const template = {
    schemaVersion: COACH_PLAN_SCHEMA_VERSION,
    packageType: COACH_PLAN_PACKAGE_TYPE,
    source: "human-coach",
    author: "",
    notes: "",
    segmentFingerprint: input.segmentFingerprint,
    ...(input.targetDurationMs === undefined
      ? {}
      : { targetFinishTimeSeconds: Math.round(input.targetDurationMs / 1000) }),
    zones,
  };

  const profileRows = windows.map(
    (window) =>
      `${Math.round(window.startDistanceMeters)}-${Math.round(window.endDistanceMeters)} m: ${formatGrade(window.gradePct)}`,
  );

  return [
    `Please write a pacing plan for the cycling segment "${input.segmentName}".`,
    "",
    `Distance: ${(totalMeters / 1000).toFixed(2)} km (${Math.round(totalMeters)} m). Rider FTP: ${Math.round(input.ftpWatts)} W.` +
      (input.targetDurationMs === undefined
        ? ""
        : ` Goal time: ${formatDuration(input.targetDurationMs)}.`),
    "",
    "Grade by section:",
    ...profileRows,
    "",
    "Rules (a plan that breaks any of them is rejected on import):",
    `- Reply with the JSON only, keeping every field of the template below. Set "source" to "human-coach" or "ai-coach", and optionally fill "author" and "notes".`,
    `- "zones" must run in order from 0 m to exactly ${Math.round(totalMeters)} m with no gaps or overlaps.`,
    `- Each zone has either "targetPowerWatts" or "targetPercentFtp" (never both), at most ${Math.floor(MAX_FTP_FRACTION * 100)}% of FTP (${Math.floor(input.ftpWatts * MAX_FTP_FRACTION)} W).`,
    `- Neighbouring zones may differ by at most ${MAX_TARGET_STEP_WATTS} W.`,
    `- Optional per zone: "classification" (REST, HOLD or PUSH) and "instruction" (at most ${MAX_INSTRUCTION_CHARACTERS} characters, shown on the bike computer).`,
    "",
    "Template (edit the numbers):",
    JSON.stringify(template, null, 2),
  ].join("\n");
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatGrade(gradePct: number): string {
  const rounded = Math.round(gradePct * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
