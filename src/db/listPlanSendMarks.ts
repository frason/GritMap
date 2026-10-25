export interface PlanSendMarksDatabase {
  prepare(sql: string): {
    all(...parameters: unknown[]): unknown[];
  };
}

export interface PlanSendMark {
  segmentId: string;
  /** When this phone last sent the segment's plan to a Karoo. */
  sentAtMs: number;
  /** The FTP that send was built for. */
  ftpWatts: number;
}

interface StoredMark {
  segment_id: string;
  sent_at_ms: number;
  ftp_watts: number;
}

/**
 * The most recent send of each segment, from this phone's own send log. Until the Karoo reports what it holds,
 * this is the only honest answer to "what did I send?", so screens say "Last sent", never "On Karoo".
 */
export function listPlanSendMarks(database: PlanSendMarksDatabase): PlanSendMark[] {
  const rows = database
    .prepare(
      `SELECT plan_sends.segment_id, plan_sends.sent_at_ms, plan_sends.ftp_watts
       FROM plan_sends
       WHERE plan_sends.id = (
         SELECT p.id FROM plan_sends p WHERE p.segment_id = plan_sends.segment_id
         ORDER BY p.sent_at_ms DESC, p.id DESC LIMIT 1)
       ORDER BY plan_sends.sent_at_ms DESC, plan_sends.id DESC`,
    )
    .all() as StoredMark[];
  return rows.map((row) => ({ segmentId: row.segment_id, sentAtMs: row.sent_at_ms, ftpWatts: row.ftp_watts }));
}
