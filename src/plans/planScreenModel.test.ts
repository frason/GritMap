import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import { buildPlanScreenModel } from "./planScreenModel.ts";

function polyline(totalMeters: number): SegmentReferencePoint[] {
  const points: SegmentReferencePoint[] = [];
  for (let d = 0; d < totalMeters; d += 10) points.push({ lat: 0, lng: 0, distanceMeters: d, elevationMeters: d / 20 });
  points.push({ lat: 0, lng: 0, distanceMeters: totalMeters, elevationMeters: totalMeters / 20 });
  return points;
}

const base = { referencePolyline: polyline(5_000), historyAttempts: [], predictionAttempts: [] };

const imported: SavedSegmentPlan = {
  id: "p1",
  segmentId: "s1",
  source: "human-coach",
  authorLabel: "Sam",
  profileVersion: 1,
  ftpWatts: 280,
  createdAtMs: 1,
  zones: [{ startDistanceMeters: 0, endDistanceMeters: 5_000, targetPowerWatts: 250, classification: "HOLD", instruction: "Hold" }],
};

describe("buildPlanScreenModel", () => {
  it("asks for FTP first", () => {
    assert.equal(buildPlanScreenModel(base).kind, "needs-ftp");
  });

  it("asks for a goal when there is none, mentioning a goal on another segment", () => {
    const model = buildPlanScreenModel({ ...base, ftpWatts: 280, weightKg: 75, activeGoal: { segmentId: "other", targetDurationMs: 600_000 }, otherGoalSegmentName: "Hill" });
    assert.equal(model.kind, "needs-goal");
    assert.equal(model.kind === "needs-goal" && model.otherGoal?.name, "Hill");
  });

  it("builds a GritMap plan for a goal on this segment", () => {
    const model = buildPlanScreenModel({ ...base, ftpWatts: 280, weightKg: 75, activeGoal: { segmentId: "s1", targetDurationMs: 600_000 } });
    assert.equal(model.kind, "plan");
    if (model.kind !== "plan") return;
    assert.equal(model.origin, "generated");
    assert.equal(model.sourceLabel, "GritMap plan");
    assert.ok(model.sections.length > 0);
    assert.equal(model.goal?.nextMs, 600_000);
    assert.equal(model.needsWeight, false);
  });

  it("an imported plan wins and flags an outdated FTP", () => {
    const model = buildPlanScreenModel({ ...base, ftpWatts: 320, weightKg: 75, activePlan: imported, activeGoal: { segmentId: "s1", targetDurationMs: 600_000 }, lastSentAtMs: new Date(2026, 9, 5, 12).getTime() });
    assert.equal(model.kind, "plan");
    if (model.kind !== "plan") return;
    assert.equal(model.origin, "imported");
    assert.equal(model.sourceLabel, "Coach plan · Sam");
    assert.equal(model.outdated?.planFtpWatts, 280);
    assert.equal(model.lastSent, "Karoo");
  });

  it("without a weight there is no predicted finish and the plan says so", () => {
    const model = buildPlanScreenModel({ ...base, ftpWatts: 280, activePlan: imported });
    assert.equal(model.kind === "plan" && model.needsWeight, true);
    assert.equal(model.kind === "plan" && model.prediction, undefined);
  });
});
