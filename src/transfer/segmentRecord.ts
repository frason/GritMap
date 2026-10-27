/**
 * The optional `segmentRecord` the Karoo can store (docs/RECEIVER_CAPABILITIES_CONTRACT.md, "Exact record fields";
 * shared fixture fixtures/contracts/segment-record-v1.json). The Karoo rejects the WHOLE package atomically when
 * a record is malformed or names a different owner, so the phone checks every rule here and never stages a record
 * that fails: a missing record costs nothing, a bad one costs the whole transfer.
 */
export const MAX_RECORD_BYTES = 8192;
export const MAX_RECORD_SPLITS = 80;
export const MAX_BEST_DURATION_SECONDS = 604_800;
export const MAX_EFFORT_COUNT = 1_000_000;

const RIDER_ID = /^[A-Za-z0-9_-]{16,64}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;
const RECORD_KEYS = ["schemaVersion", "riderId", "segmentFingerprint", "bestDurationSeconds", "achievedAtMs", "effortCount", "splits"];
const SPLIT_KEYS = ["distanceMeters", "elapsedSeconds"];
const DURATION_TOLERANCE_SECONDS = 1e-6;
const LENGTH_TOLERANCE_METERS = 0.01;

export interface SegmentRecordContext {
  /** The fingerprint of the segment being sent; the record must name exactly this one. */
  segmentFingerprint?: string;
  /** The length of the segment as installed on the Karoo, in meters; the last split must end exactly there. */
  segmentLengthMeters?: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Everything the Karoo's strict record parser would reject, as readable strings (never any content); empty means accepted. */
export function validateSegmentRecord(value: unknown, context: SegmentRecordContext = {}): string[] {
  if (!isPlainObject(value)) return ["record is not an object"];
  const problems: string[] = [];
  for (const key of Object.keys(value)) if (!RECORD_KEYS.includes(key)) problems.push(`unknown field ${key}`);
  for (const key of RECORD_KEYS) if (!(key in value)) problems.push(`missing ${key}`);
  if (problems.length > 0) return problems;

  if (value.schemaVersion !== 1) problems.push("schemaVersion must be 1");
  if (typeof value.riderId !== "string" || !RIDER_ID.test(value.riderId)) problems.push("riderId must be 16 to 64 letters, digits, underscores or hyphens");
  if (typeof value.segmentFingerprint !== "string" || !FINGERPRINT.test(value.segmentFingerprint)) {
    problems.push("segmentFingerprint must be 64 lowercase hex");
  } else if (context.segmentFingerprint !== undefined && value.segmentFingerprint !== context.segmentFingerprint) {
    problems.push("segmentFingerprint does not match the segment being sent");
  }
  const best = value.bestDurationSeconds;
  if (!isFiniteNumber(best) || best <= 0 || best > MAX_BEST_DURATION_SECONDS) problems.push(`bestDurationSeconds must be a number above 0 and at most ${MAX_BEST_DURATION_SECONDS}`);
  if (typeof value.achievedAtMs !== "number" || !Number.isSafeInteger(value.achievedAtMs) || value.achievedAtMs <= 0) problems.push("achievedAtMs must be a positive whole number");
  if (typeof value.effortCount !== "number" || !Number.isSafeInteger(value.effortCount) || value.effortCount < 0 || value.effortCount > MAX_EFFORT_COUNT) {
    problems.push(`effortCount must be a whole number from 0 to ${MAX_EFFORT_COUNT}`);
  }

  const splits = value.splits;
  if (!Array.isArray(splits)) {
    problems.push("splits must be a list");
  } else if (splits.length !== 0) {
    if (splits.length < 2 || splits.length > MAX_RECORD_SPLITS) {
      problems.push(`splits must be empty or have 2 to ${MAX_RECORD_SPLITS} entries`);
    } else {
      let previousDistance = -Infinity;
      let previousElapsed = -Infinity;
      splits.forEach((split, index) => {
        if (!isPlainObject(split) || Object.keys(split).length !== SPLIT_KEYS.length || !SPLIT_KEYS.every((key) => key in split)) {
          problems.push(`split ${index} must have exactly distanceMeters and elapsedSeconds`);
          return;
        }
        const distance = split.distanceMeters;
        const elapsed = split.elapsedSeconds;
        if (!isFiniteNumber(distance) || !isFiniteNumber(elapsed)) {
          problems.push(`split ${index} must hold finite numbers`);
          return;
        }
        if (index === 0 && (distance !== 0 || elapsed !== 0)) problems.push("the first split must be 0 m at 0 s");
        if (distance <= previousDistance || elapsed <= previousElapsed) problems.push(`split ${index} must be further and later than the one before`);
        previousDistance = distance;
        previousElapsed = elapsed;
      });
      const finish = splits[splits.length - 1];
      if (isPlainObject(finish) && isFiniteNumber(finish.elapsedSeconds) && isFiniteNumber(best)) {
        if (Math.abs(finish.elapsedSeconds - best) > DURATION_TOLERANCE_SECONDS) problems.push("the last split's time must equal bestDurationSeconds");
      }
      if (isPlainObject(finish) && isFiniteNumber(finish.distanceMeters) && context.segmentLengthMeters !== undefined) {
        if (Math.abs(finish.distanceMeters - context.segmentLengthMeters) > LENGTH_TOLERANCE_METERS) problems.push("the last split must end at the segment's length");
      }
    }
  }

  if (problems.length === 0 && new TextEncoder().encode(JSON.stringify(value)).length > MAX_RECORD_BYTES) {
    problems.push(`record is larger than ${MAX_RECORD_BYTES} bytes`);
  }
  return problems;
}
