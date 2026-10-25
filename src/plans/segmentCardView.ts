import type { PlanScreenModel } from "./planScreenModel.ts";
import { classificationTone, type PlanTone } from "./planView.ts";
import { formatDurationMinutesSeconds } from "../screens/formatRideStats.ts";

export interface SegmentCardPlan {
  /** One tone per section, for the plan strip. Empty when there is no plan yet. */
  tones: PlanTone[];
  /** One plain line: the goal and prediction, or what is missing. */
  line: string;
}

/** What the plan strip and line on a segment card say, from the same model the Plan tab uses. */
export function segmentCardPlan(model: PlanScreenModel): SegmentCardPlan {
  if (model.kind === "needs-ftp") return { tones: [], line: "Set your FTP to get a plan" };
  if (model.kind === "needs-goal") return { tones: [], line: "No plan yet · set a goal" };
  const tones = model.zones.map((zone) => classificationTone(zone.classification));
  const parts: string[] = [];
  if (model.goal !== undefined) parts.push(`Goal ${formatDurationMinutesSeconds(model.goal.nextMs)}`);
  else parts.push(model.sourceLabel);
  if (model.prediction !== undefined) parts.push(`Predicted ${formatDurationMinutesSeconds(model.prediction.durationMs)}`);
  return { tones, line: parts.join(" · ") };
}
