import { getSegmentDetail } from "../db/getSegmentDetail";
import { getAthleteProfile } from "../db/getAthleteProfile";
import { getActiveSegmentPlan } from "../db/segmentPlans";
import { listPlanSendMarks } from "../db/listPlanSendMarks";
import { listSegments, type SegmentSummary } from "../db/listSegments";
import type { SyncDatabase } from "../db/types";
import { karooMark, type KarooMark } from "./karooMarks";
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
}

/** Everything the Segments list and Home cards show, in the list's order (newest segment first). */
export function loadSegmentCards(database: SyncDatabase): SegmentCardData[] {
  const marks = new Map(listPlanSendMarks(database).map((mark) => [mark.segmentId, mark]));
  const ftpWatts = getAthleteProfile(database).ftpWatts;
  return listSegments(database).map((summary) => {
    const detail = getSegmentDetail(database, summary.segmentId);
    const model = detail === undefined ? ({ kind: "needs-ftp" } as const) : buildPlanScreenModel(loadPlanInput(database, detail));
    const send = marks.get(summary.segmentId);
    const importedAt = getActiveSegmentPlan(database, summary.segmentId)?.createdAtMs;
    const mark = karooMark({
      ...(send === undefined ? {} : { lastSentAtMs: send.sentAtMs, sentFtpWatts: send.ftpWatts }),
      ...(ftpWatts === undefined ? {} : { currentFtpWatts: ftpWatts }),
      ...(importedAt === undefined ? {} : { planChangedAtMs: importedAt }),
    });
    return { summary, plan: segmentCardPlan(model), sent: send !== undefined, ...(send === undefined ? {} : { lastSentAtMs: send.sentAtMs }), ...(mark === undefined ? {} : { mark }) };
  });
}
