import type { CoachPlanSource, CoachPlanZone, ParsedCoachPlan } from "../pacing/coachPlan.ts";

export interface SegmentPlansDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  };
}

export interface SavedSegmentPlan {
  id: string;
  segmentId: string;
  source: CoachPlanSource;
  authorLabel?: string;
  notes?: string;
  /** The rider-profile version (athlete_profile.profile_version) the watts were written against. */
  profileVersion: number;
  ftpWatts: number;
  targetFinishSeconds?: number;
  zones: CoachPlanZone[];
  createdAtMs: number;
  lastSentAtMs?: number;
}

interface StoredSegmentPlan {
  id: string;
  segment_id: string;
  source: CoachPlanSource;
  author_label: string | null;
  notes: string | null;
  profile_version: number;
  ftp_watts: number;
  target_finish_seconds: number | null;
  zones_json: string;
  created_at_ms: number;
  last_sent_at_ms: number | null;
}

export interface SaveSegmentPlanParams {
  id: string;
  segmentId: string;
  plan: ParsedCoachPlan;
  /** The rider's current profile version and FTP, captured with the plan so staleness can be judged later. */
  profileVersion: number;
  ftpWatts: number;
  nowMs: number;
}

/**
 * Stores a validated imported plan and makes it the segment's one active plan, retiring the
 * previous active one (kept, inactive) in the same transaction. The partial unique index on
 * (segment_id) WHERE is_active = 1 is what actually guarantees there is only ever one.
 */
export function saveSegmentPlan(database: SegmentPlansDatabase, params: SaveSegmentPlanParams): void {
  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE segment_plans SET is_active = 0 WHERE segment_id = ? AND is_active = 1").run(
      params.segmentId,
    );
    database
      .prepare(
        `INSERT INTO segment_plans (
          id, segment_id, source, author_label, notes, profile_version, ftp_watts,
          target_finish_seconds, zones_json, created_at_ms, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .run(
        params.id,
        params.segmentId,
        params.plan.source,
        params.plan.authorLabel ?? null,
        params.plan.notes ?? null,
        params.profileVersion,
        Math.round(params.ftpWatts),
        params.plan.targetFinishTimeSeconds ?? null,
        JSON.stringify(params.plan.zones),
        params.nowMs,
      );
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

/** The segment's active imported plan, or undefined when it should fall back to the generated one. */
export function getActiveSegmentPlan(
  database: SegmentPlansDatabase,
  segmentId: string,
): SavedSegmentPlan | undefined {
  const row = database
    .prepare(
      `SELECT id, segment_id, source, author_label, notes, profile_version, ftp_watts,
              target_finish_seconds, zones_json, created_at_ms, last_sent_at_ms
       FROM segment_plans WHERE segment_id = ? AND is_active = 1`,
    )
    .get(segmentId) as StoredSegmentPlan | null | undefined;

  // expo-sqlite's getFirstSync() returns null for "no row"; node:sqlite returns undefined.
  if (row === undefined || row === null) return undefined;

  return {
    id: row.id,
    segmentId: row.segment_id,
    source: row.source,
    ...(row.author_label === null ? {} : { authorLabel: row.author_label }),
    ...(row.notes === null ? {} : { notes: row.notes }),
    profileVersion: row.profile_version,
    ftpWatts: row.ftp_watts,
    ...(row.target_finish_seconds === null ? {} : { targetFinishSeconds: row.target_finish_seconds }),
    zones: JSON.parse(row.zones_json) as CoachPlanZone[],
    createdAtMs: row.created_at_ms,
    ...(row.last_sent_at_ms === null ? {} : { lastSentAtMs: row.last_sent_at_ms }),
  };
}

/** Falls the segment back to its generated plan. The imported plan stays on record, inactive. */
export function deactivateSegmentPlan(database: SegmentPlansDatabase, segmentId: string): void {
  database.prepare("UPDATE segment_plans SET is_active = 0 WHERE segment_id = ? AND is_active = 1").run(segmentId);
}

/** Records that the plan was handed to the Karoo (received, not necessarily imported -- see sendGuidancePackageToKaroo.ts). */
export function markSegmentPlanSent(database: SegmentPlansDatabase, planId: string, nowMs: number): void {
  database.prepare("UPDATE segment_plans SET last_sent_at_ms = ? WHERE id = ?").run(nowMs, planId);
}

/**
 * Absolute watt targets are only as good as the FTP they were written against, and the Karoo
 * refuses a plan whose FTP differs from its installed rider profile. A plan is therefore
 * outdated exactly when the rider's FTP has moved; a weight or max-HR edit bumps the profile
 * version but leaves the watts valid.
 */
export function isSegmentPlanOutdated(plan: Pick<SavedSegmentPlan, "ftpWatts">, currentFtpWatts: number | undefined): boolean {
  return currentFtpWatts !== undefined && Math.round(currentFtpWatts) !== plan.ftpWatts;
}
