import { getSegmentGoal } from "../db/getActiveGoal";
import { listAttemptsForSegment } from "../db/listAttemptsForSegment";
import { listSegments } from "../db/listSegments";
import { getActiveSegmentPlan } from "../db/segmentPlans";
import type { SyncDatabase } from "../db/types";
import { formatDurationMinutesSeconds } from "../screens/formatRideStats";
import { segmentInsight, type SegmentInsight } from "./segmentInsights";

export interface HomeSegmentInsight extends SegmentInsight {
  segmentId: string;
  name: string;
}

/**
 * The "Latest segments" on Home: for segments that have a goal or a plan (other than `exceptSegmentId`, the pinned
 * one shown above), what the latest counted effort says. Newest effort first, at most `limit`.
 */
export function loadSegmentInsights(database: SyncDatabase, exceptSegmentId: string | undefined, limit = 3): HomeSegmentInsight[] {
  const insights: HomeSegmentInsight[] = [];
  for (const segment of listSegments(database)) {
    if (segment.segmentId === exceptSegmentId) continue;
    const goal = getSegmentGoal(database, segment.segmentId);
    if (goal === undefined && getActiveSegmentPlan(database, segment.segmentId) === undefined) continue;
    const efforts = listAttemptsForSegment(database, segment.segmentId)
      .filter((attempt) => attempt.decision === "accept" || attempt.manuallyApproved)
      .map((attempt) => ({ attemptId: attempt.attemptId, startTimestampMs: attempt.startTimestampMs, durationMs: attempt.endTimestampMs - attempt.startTimestampMs }));
    const insight = segmentInsight({ efforts, format: formatDurationMinutesSeconds, ...(goal === undefined ? {} : { goalMs: goal.targetDurationMs }) });
    if (insight !== undefined) insights.push({ ...insight, segmentId: segment.segmentId, name: segment.name });
  }
  return insights.sort((a, b) => b.startTimestampMs - a.startTimestampMs).slice(0, limit);
}
