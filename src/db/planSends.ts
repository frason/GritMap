export interface PlanSendsDatabase {
  prepare(sql: string): {
    get(...parameters: unknown[]): unknown;
    run(...parameters: unknown[]): unknown;
  };
}

/** The `baselinePacingPlan` JSON exactly as sent (see buildBaselinePacingPlan.ts's toBaselinePlanWire). */
export interface SentBaselinePlan {
  id: string;
  segmentFingerprint: string;
  createdAtMs: number;
  generator: { type: string; modelVersion: string };
  ftpWatts: number;
  targetFinishTimeSeconds?: number;
  zones: {
    startDistanceMeters: number;
    endDistanceMeters: number;
    targetPowerWatts: number;
    classification: string;
    icon: string;
    instruction: string;
  }[];
}

export interface SentPlan {
  sendId: string;
  sentAtMs: number;
  generatorType: string;
  generatorModelVersion: string;
  ftpWatts: number;
  /** The target time the Karoo was given (the goal, the coach's own, or the predicted finish). */
  targetFinishSeconds?: number;
  zones: { startDistanceMeters: number; endDistanceMeters: number; targetPowerWatts: number }[];
}

interface StoredPlanSend {
  id: string;
  sent_at_ms: number;
  generator_type: string;
  generator_model_version: string;
  ftp_watts: number;
  target_finish_seconds: number | null;
  plan_json: string;
}

export interface RecordPlanSendParams {
  id: string;
  segmentId: string;
  sentAtMs: number;
  packageId: string;
  plan: SentBaselinePlan;
}

/** Records the plan a successful send to the Karoo carried. */
export function recordPlanSend(database: PlanSendsDatabase, params: RecordPlanSendParams): void {
  const { plan } = params;
  database
    .prepare(
      `INSERT INTO plan_sends (
        id, segment_id, sent_at_ms, package_id, generator_type, generator_model_version,
        ftp_watts, target_finish_seconds, plan_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      params.id,
      params.segmentId,
      params.sentAtMs,
      params.packageId,
      plan.generator.type,
      plan.generator.modelVersion,
      plan.ftpWatts,
      plan.targetFinishTimeSeconds ?? null,
      JSON.stringify(plan),
    );
}

/**
 * The plan that was on the Karoo for a ride starting at `atMs`: the most recent send to this
 * segment at or before that moment. Undefined when the ride predates every recorded send (the
 * caller falls back to the segment's current plan and says so).
 */
export function getPlanSentBefore(
  database: PlanSendsDatabase,
  segmentId: string,
  atMs: number,
): SentPlan | undefined {
  const row = database
    .prepare(
      `SELECT id, sent_at_ms, generator_type, generator_model_version, ftp_watts, target_finish_seconds, plan_json
       FROM plan_sends
       WHERE segment_id = ? AND sent_at_ms <= ?
       ORDER BY sent_at_ms DESC, id DESC
       LIMIT 1`,
    )
    .get(segmentId, atMs) as StoredPlanSend | null | undefined;

  // expo-sqlite's getFirstSync() returns null for "no row"; node:sqlite returns undefined.
  if (row === undefined || row === null) return undefined;

  const plan = JSON.parse(row.plan_json) as SentBaselinePlan;
  return {
    sendId: row.id,
    sentAtMs: row.sent_at_ms,
    generatorType: row.generator_type,
    generatorModelVersion: row.generator_model_version,
    ftpWatts: row.ftp_watts,
    ...(row.target_finish_seconds === null ? {} : { targetFinishSeconds: row.target_finish_seconds }),
    zones: plan.zones.map((zone) => ({
      startDistanceMeters: zone.startDistanceMeters,
      endDistanceMeters: zone.endDistanceMeters,
      targetPowerWatts: zone.targetPowerWatts,
    })),
  };
}
