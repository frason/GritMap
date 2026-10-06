import { classifyAgainstAnchor, type PacingClassification } from "./buildTargetPowerZones.ts";

/**
 * GritMap coach-plan contract v1: the one structured document through which pacing guidance
 * written by the rider, a human coach, or an AI coach enters the app. Whatever its origin, it is
 * validated and normalized here into absolute-watt zones, previewed, and only then stored
 * (db/saveSegmentPlan.ts) and sent to the Karoo as an ordinary baseline plan. Provenance is
 * recorded for review but never changes how the Karoo treats the plan.
 *
 * The validation rules deliberately mirror the Karoo's own gate (AiPlanValidator.kt +
 * TransferPackageParser.parseBaseline) -- a plan that passes here must not be rejected there
 * after the phone already got an HTTP 200. See docs/COACH_PLAN_CONTRACT.md.
 */
export const COACH_PLAN_PACKAGE_TYPE = "gritmap-coach-plan";
export const COACH_PLAN_SCHEMA_VERSION = 1;
export const COACH_PLAN_SOURCES = ["self", "human-coach", "ai-coach"] as const;
export type CoachPlanSource = (typeof COACH_PLAN_SOURCES)[number];

/** AiPlanValidationConfig.maximumTargetStepWatts -- the Karoo's hard cap, not this app's softer 80W generator limit. */
export const MAX_TARGET_STEP_WATTS = 100;
/** AiPlanValidator: ftpWatts * 1.5. */
export const MAX_FTP_FRACTION = 1.5;
/** AiPlanValidationConfig.maximumInstructionCharacters. */
export const MAX_INSTRUCTION_CHARACTERS = 80;
export const MAX_ZONES = 200;
export const MAX_DOCUMENT_CHARACTERS = 100_000;
const MAX_AUTHOR_CHARACTERS = 60;
const MAX_NOTES_CHARACTERS = 500;
const MAX_REPORTED_ERRORS = 12;
/** Rounding noise between a coach's tables and the segment's exact length is forgiven up to this much; more is an error. */
const JOIN_SNAP_METERS = 1;
const END_SNAP_METERS = 5;

export interface CoachPlanZone {
  startDistanceMeters: number;
  endDistanceMeters: number;
  targetPowerWatts: number;
  classification: PacingClassification;
  instruction: string;
}

export interface ParsedCoachPlan {
  source: CoachPlanSource;
  authorLabel?: string;
  notes?: string;
  segmentFingerprint: string;
  targetFinishTimeSeconds?: number;
  zones: CoachPlanZone[];
}

export interface CoachPlanContext {
  segmentFingerprint: string;
  segmentLengthMeters: number;
  ftpWatts: number;
}

export type CoachPlanParseResult =
  | { ok: true; plan: ParsedCoachPlan; warnings: string[] }
  | { ok: false; errors: string[] };

const ZONE_KEYS = new Set([
  "startDistanceMeters",
  "endDistanceMeters",
  "targetPowerWatts",
  "targetPercentFtp",
  "classification",
  "instruction",
]);
const ROOT_KEYS = new Set([
  "schemaVersion",
  "packageType",
  "source",
  "author",
  "notes",
  "segmentFingerprint",
  "targetFinishTimeSeconds",
  "zones",
]);

/**
 * Parses and validates a pasted coach-plan document against the segment and rider it will be
 * used for. Collects every problem it can find (not just the first) so a coach or AI can fix a
 * plan in one round trip. Unknown keys are ignored with a warning -- AI coaches like to add
 * commentary fields -- but never interpreted.
 */
export function parseCoachPlan(text: string, context: CoachPlanContext): CoachPlanParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (message: string) => errors.push(message);

  if (text.length > MAX_DOCUMENT_CHARACTERS) {
    return { ok: false, errors: [`Plan is too large (over ${MAX_DOCUMENT_CHARACTERS} characters)`] };
  }
  let root: unknown;
  try {
    root = JSON.parse(stripCodeFence(text));
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : "";
    return { ok: false, errors: [`Not valid JSON${detail}`] };
  }
  if (!isRecord(root)) return { ok: false, errors: ["Plan must be a JSON object"] };

  warnUnknownKeys(root, ROOT_KEYS, "plan", warnings);

  if (root.packageType !== COACH_PLAN_PACKAGE_TYPE) {
    fail(`packageType must be "${COACH_PLAN_PACKAGE_TYPE}"`);
  }
  if (root.schemaVersion !== COACH_PLAN_SCHEMA_VERSION) {
    fail(`schemaVersion must be ${COACH_PLAN_SCHEMA_VERSION}`);
  }

  const source = COACH_PLAN_SOURCES.find((candidate) => candidate === root.source);
  if (source === undefined) fail(`source must be one of ${COACH_PLAN_SOURCES.join(", ")}`);

  if (typeof root.segmentFingerprint !== "string" || !/^[0-9a-fA-F]{64}$/.test(root.segmentFingerprint)) {
    fail("segmentFingerprint must be the segment's 64-character hex fingerprint");
  } else if (root.segmentFingerprint.toLowerCase() !== context.segmentFingerprint.toLowerCase()) {
    fail("This plan is for a different segment (segmentFingerprint does not match)");
  }

  const authorLabel = optionalText(root.author, "author", MAX_AUTHOR_CHARACTERS, fail);
  const notes = optionalText(root.notes, "notes", MAX_NOTES_CHARACTERS, fail);

  let targetFinishTimeSeconds: number | undefined;
  if (root.targetFinishTimeSeconds !== undefined) {
    if (!isFiniteNumber(root.targetFinishTimeSeconds) || root.targetFinishTimeSeconds <= 0) {
      fail("targetFinishTimeSeconds must be a positive number");
    } else {
      targetFinishTimeSeconds = Math.round(root.targetFinishTimeSeconds);
    }
  }

  const zones = parseZones(root.zones, context, fail, warnings);

  if (errors.length > 0 || source === undefined || zones === undefined) {
    return { ok: false, errors: capErrors(errors) };
  }

  const meanPower = distanceWeightedMeanPower(zones);
  const resolved: CoachPlanZone[] = zones.map((zone) => {
    const classification =
      zone.classification ?? classifyAgainstAnchor(zone.targetPowerWatts, meanPower);
    return {
      startDistanceMeters: zone.startDistanceMeters,
      endDistanceMeters: zone.endDistanceMeters,
      targetPowerWatts: zone.targetPowerWatts,
      classification,
      instruction: zone.instruction ?? defaultInstruction(classification),
    };
  });

  return {
    ok: true,
    warnings,
    plan: {
      source,
      ...(authorLabel === undefined ? {} : { authorLabel }),
      ...(notes === undefined ? {} : { notes }),
      segmentFingerprint: context.segmentFingerprint.toLowerCase(),
      ...(targetFinishTimeSeconds === undefined ? {} : { targetFinishTimeSeconds }),
      zones: resolved,
    },
  };
}

interface DraftZone {
  startDistanceMeters: number;
  endDistanceMeters: number;
  targetPowerWatts: number;
  classification?: PacingClassification;
  instruction?: string;
}

function parseZones(
  value: unknown,
  context: CoachPlanContext,
  fail: (message: string) => void,
  warnings: string[],
): DraftZone[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    fail("zones must be a non-empty array");
    return undefined;
  }
  if (value.length > MAX_ZONES) {
    fail(`zones has ${value.length} entries; the maximum is ${MAX_ZONES}`);
    return undefined;
  }

  const maxWatts = Math.floor(context.ftpWatts * MAX_FTP_FRACTION);
  const drafts: DraftZone[] = [];
  let structurallyValid = true;
  const unknownKeyWarned = new Set<string>();

  value.forEach((entry, index) => {
    const label = `zone ${index + 1}`;
    if (!isRecord(entry)) {
      fail(`${label} must be an object`);
      structurallyValid = false;
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!ZONE_KEYS.has(key) && !unknownKeyWarned.has(key)) {
        unknownKeyWarned.add(key);
        warnings.push(`Ignored unknown zone field "${key}"`);
      }
    }

    const { startDistanceMeters: start, endDistanceMeters: end } = entry;
    if (!isFiniteNumber(start) || !isFiniteNumber(end)) {
      fail(`${label} needs numeric startDistanceMeters and endDistanceMeters`);
      structurallyValid = false;
      return;
    }

    const hasWatts = entry.targetPowerWatts !== undefined;
    const hasPercent = entry.targetPercentFtp !== undefined;
    let watts: number | undefined;
    if (hasWatts === hasPercent) {
      fail(`${label} needs exactly one of targetPowerWatts or targetPercentFtp`);
      structurallyValid = false;
    } else if (hasWatts) {
      if (!isFiniteNumber(entry.targetPowerWatts)) {
        fail(`${label}: targetPowerWatts must be a number`);
        structurallyValid = false;
      } else {
        watts = Math.round(entry.targetPowerWatts);
      }
    } else if (!isFiniteNumber(entry.targetPercentFtp) || entry.targetPercentFtp <= 0) {
      fail(`${label}: targetPercentFtp must be a positive number`);
      structurallyValid = false;
    } else {
      watts = Math.round((entry.targetPercentFtp / 100) * context.ftpWatts);
    }

    let classification: PacingClassification | undefined;
    if (entry.classification !== undefined) {
      classification = normalizeClassification(entry.classification);
      if (classification === undefined) {
        fail(`${label}: classification must be REST, HOLD, or PUSH`);
        structurallyValid = false;
      }
    }

    let instruction: string | undefined;
    if (entry.instruction !== undefined) {
      if (typeof entry.instruction !== "string") {
        fail(`${label}: instruction must be text`);
        structurallyValid = false;
      } else if (entry.instruction.trim().length > 0) {
        const trimmed = entry.instruction.trim();
        if (trimmed.length > MAX_INSTRUCTION_CHARACTERS) {
          warnings.push(
            `${label}: instruction shortened to ${MAX_INSTRUCTION_CHARACTERS} characters for the Karoo display`,
          );
          instruction = `${trimmed.slice(0, MAX_INSTRUCTION_CHARACTERS - 1)}…`;
        } else {
          instruction = trimmed;
        }
      }
    }

    if (watts === undefined) return;
    if (watts < 0 || watts > maxWatts) {
      fail(`${label}: ${watts} W is outside 0-${maxWatts} W (150% of your ${context.ftpWatts} W FTP)`);
      structurallyValid = false;
    }
    drafts.push({
      startDistanceMeters: start,
      endDistanceMeters: end,
      targetPowerWatts: watts,
      ...(classification === undefined ? {} : { classification }),
      ...(instruction === undefined ? {} : { instruction }),
    });
  });

  if (!structurallyValid || drafts.length !== value.length) return undefined;

  // Geometry: zones must tile the segment. Tiny rounding mismatches are snapped; real gaps are errors.
  const first = drafts[0]!;
  if (Math.abs(first.startDistanceMeters) > END_SNAP_METERS) {
    fail(`zone 1 must start at 0 m (starts at ${formatMeters(first.startDistanceMeters)})`);
  } else {
    first.startDistanceMeters = 0;
  }
  for (let i = 1; i < drafts.length; i += 1) {
    const previous = drafts[i - 1]!;
    const zone = drafts[i]!;
    const gap = zone.startDistanceMeters - previous.endDistanceMeters;
    if (Math.abs(gap) > JOIN_SNAP_METERS) {
      fail(
        `zone ${i + 1} starts at ${formatMeters(zone.startDistanceMeters)} but zone ${i} ends at ${formatMeters(previous.endDistanceMeters)} (${gap > 0 ? "gap" : "overlap"})`,
      );
    } else {
      zone.startDistanceMeters = previous.endDistanceMeters;
    }
  }
  const last = drafts[drafts.length - 1]!;
  if (Math.abs(last.endDistanceMeters - context.segmentLengthMeters) > END_SNAP_METERS) {
    fail(
      `zones cover ${formatMeters(last.endDistanceMeters)} but the segment is ${formatMeters(context.segmentLengthMeters)}`,
    );
  } else {
    last.endDistanceMeters = context.segmentLengthMeters;
  }
  drafts.forEach((zone, index) => {
    if (zone.endDistanceMeters <= zone.startDistanceMeters) {
      fail(`zone ${index + 1} must end after it starts`);
    }
  });
  for (let i = 1; i < drafts.length; i += 1) {
    const step = Math.abs(drafts[i]!.targetPowerWatts - drafts[i - 1]!.targetPowerWatts);
    if (step > MAX_TARGET_STEP_WATTS) {
      fail(
        `zones ${i} and ${i + 1} differ by ${step} W; the Karoo accepts at most ${MAX_TARGET_STEP_WATTS} W between neighbours`,
      );
    }
  }
  return drafts;
}

/** Distance-weighted mean target power -- the reference REST/PUSH is measured against when a zone has no explicit class. */
export function distanceWeightedMeanPower(
  zones: readonly Pick<CoachPlanZone, "startDistanceMeters" | "endDistanceMeters" | "targetPowerWatts">[],
): number {
  let weighted = 0;
  let total = 0;
  for (const zone of zones) {
    const length = zone.endDistanceMeters - zone.startDistanceMeters;
    weighted += zone.targetPowerWatts * length;
    total += length;
  }
  return total > 0 ? weighted / total : 0;
}

export interface CoachPlanSummary {
  zoneCount: number;
  averagePowerWatts: number;
  percentOfFtp: number;
  minPowerWatts: number;
  maxPowerWatts: number;
}

export function summarizeCoachPlan(
  zones: readonly Pick<CoachPlanZone, "startDistanceMeters" | "endDistanceMeters" | "targetPowerWatts">[],
  ftpWatts: number,
): CoachPlanSummary {
  const watts = zones.map((zone) => zone.targetPowerWatts);
  const averagePowerWatts = distanceWeightedMeanPower(zones);
  return {
    zoneCount: zones.length,
    averagePowerWatts: Math.round(averagePowerWatts),
    percentOfFtp: Math.round((averagePowerWatts / ftpWatts) * 100),
    minPowerWatts: Math.min(...watts),
    maxPowerWatts: Math.max(...watts),
  };
}

/** AI chat tools habitually wrap JSON in a ``` fence; accept that rather than making the rider edit it out. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```$/.exec(trimmed);
  return fenced ? fenced[1]! : trimmed;
}

function normalizeClassification(value: unknown): PacingClassification | undefined {
  if (typeof value !== "string") return undefined;
  switch (value.trim().toUpperCase()) {
    case "REST":
    case "RECOVER":
      return "REST";
    case "HOLD":
      return "HOLD";
    case "PUSH":
      return "PUSH";
    default:
      return undefined;
  }
}

function defaultInstruction(classification: PacingClassification): string {
  return classification === "REST" ? "Rest" : classification === "PUSH" ? "Push" : "Hold";
}

function optionalText(
  value: unknown,
  name: string,
  maxCharacters: number,
  fail: (message: string) => void,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    fail(`${name} must be text`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > maxCharacters) {
    fail(`${name} is too long (maximum ${maxCharacters} characters)`);
    return undefined;
  }
  return trimmed;
}

function warnUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  where: string,
  warnings: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) warnings.push(`Ignored unknown ${where} field "${key}"`);
  }
}

function capErrors(errors: string[]): string[] {
  if (errors.length <= MAX_REPORTED_ERRORS) return errors;
  return [...errors.slice(0, MAX_REPORTED_ERRORS), `…and ${errors.length - MAX_REPORTED_ERRORS} more`];
}

function formatMeters(meters: number): string {
  return `${Math.round(meters * 10) / 10} m`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
