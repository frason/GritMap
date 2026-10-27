import { getSegmentGoal } from "../db/getActiveGoal";
import { getSegmentDetail } from "../db/getSegmentDetail";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { getActiveSegmentPlan } from "../db/segmentPlans";
import { listPlanSendMarks } from "../db/listPlanSendMarks";
import { listSegments, type SegmentSummary } from "../db/listSegments";
import type { SyncDatabase } from "../db/types";
import { karooMark, latestChange, type KarooMark } from "./karooMarks";
import { sendLogInventory, type KarooInventory } from "./karooPresence";
import { thinCourse, type PreviewPoint } from "./segmentListView";
import { loadPlanInput } from "./loadPlanInput";
import { buildPlanScreenModel } from "./planScreenModel";
import { segmentCardPlan, type SegmentCardPlan } from "./segmentCardView";

export interface SegmentCardData {
  summary: SegmentSummary;
  plan: SegmentCardPlan;
  mark?: KarooMark;
  /** True when this phone has sent the segment to a Karoo at least once. */
  sent: boolean;
  lastSentAtMs?: number;
  /** True when the Karoo is known to hold this segment (see karooPresence.ts). The list shows a bare "Karoo" check. */
  onKaroo: boolean;
  /** The course thinned to a few dozen points, for the list's small route preview. */
  preview: PreviewPoint[];
}

const PREVIEW_POINTS = 40;

/**
 * Everything the Segments list and Home cards show, in the database's order (newest segment first; the
 * list sorts them itself). `inventory` says which segments a Karoo holds; it defaults to this phone's send log.
 */
export function loadSegmentCards(database: SyncDatabase, inventory?: KarooInventory): SegmentCardData[] {
  const sendMarks = listPlanSendMarks(database);
  const marks = new Map(sendMarks.map((mark) => [mark.segmentId, mark]));
  const karoo = inventory ?? sendLogInventory(sendMarks);
  const ftpWatts = getAthleteProfile(database).ftpWatts;
  return listSegments(database).map((summary) => {
    const detail = getSegmentDetail(database, summary.segmentId);
    const model = detail === undefined ? ({ kind: "needs-ftp" } as const) : buildPlanScreenModel(loadPlanInput(database, detail));
    const send = marks.get(summary.segmentId);
    const importedAt = getActiveSegmentPlan(database, summary.segmentId)?.createdAtMs;
    const goalSavedAt = getSegmentGoal(database, summary.segmentId)?.updatedAtMs;
    // The plan on the Karoo is out of date if the plan was replaced, or the goal it was built for changed, after the send.
    const planChangedAt = latestChange(importedAt, goalSavedAt);
    const mark = karooMark({
      ...(send === undefined ? {} : { lastSentAtMs: send.sentAtMs, sentFtpWatts: send.ftpWatts }),
      ...(ftpWatts === undefined ? {} : { currentFtpWatts: ftpWatts }),
      ...(planChangedAt === undefined ? {} : { planChangedAtMs: planChangedAt }),
    });
    const preview = detail === undefined ? [] : thinCourse(detail.referencePolyline, PREVIEW_POINTS);
    return { summary, plan: segmentCardPlan(model), sent: send !== undefined, onKaroo: karoo.hasSegment(summary.segmentId), preview, ...(send === undefined ? {} : { lastSentAtMs: send.sentAtMs }), ...(mark === undefined ? {} : { mark }) };
  });
}
