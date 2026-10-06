import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SavedSegmentPlan } from "../db/segmentPlans.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import type { SentPlan } from "../db/planSends.ts";
import { resolvePlanForEffort, resolveSegmentPlan } from "./resolveSegmentPlan.ts";

function polyline(totalMeters: number): SegmentReferencePoint[] {
  const points: SegmentReferencePoint[] = [];
  for (let d = 0; d < totalMeters; d += 10) points.push({ lat: 0, lng: 0, distanceMeters: d, elevationMeters: d / 20 });
  points.push({ lat: 0, lng: 0, distanceMeters: totalMeters, elevationMeters: totalMeters / 20 });
  return points;
}

const imported: SavedSegmentPlan = {
  id: "p1",
  segmentId: "s1",
  source: "human-coach",
  profileVersion: 1,
  ftpWatts: 280,
  createdAtMs: 1,
  zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 250, classification: "HOLD", instruction: "Hold" }],
};

describe("resolveSegmentPlan", () => {
  it("prefers an active imported plan over everything else", () => {
    const resolved = resolveSegmentPlan({ activePlan: imported, ftpWatts: 300, goalDurationMs: 600_000, referencePolyline: polyline(1_000) });
    assert.equal(resolved.kind, "imported");
    assert.equal(resolved.kind === "imported" && resolved.zones[0]!.targetPowerWatts, 250);
  });

  it("generates a plan from FTP and the goal when nothing is imported", () => {
    const resolved = resolveSegmentPlan({ ftpWatts: 280, goalDurationMs: 39 * 60_000, referencePolyline: polyline(10_000) });
    assert.equal(resolved.kind, "generated");
    if (resolved.kind !== "generated") return;
    assert.equal(resolved.ftpWatts, 280);
    assert.ok(resolved.zones.length >= 10);
    assert.equal(resolved.zones[0]!.startDistanceMeters, 0);
    assert.equal(resolved.zones.at(-1)!.endDistanceMeters, 10_000);
  });

  it("says why there is no plan", () => {
    assert.deepEqual(resolveSegmentPlan({ goalDurationMs: 600_000, referencePolyline: polyline(1_000) }), { kind: "none", reason: "no-ftp" });
    assert.deepEqual(resolveSegmentPlan({ ftpWatts: 280, referencePolyline: polyline(1_000) }), { kind: "none", reason: "no-goal" });
  });
});

describe("resolvePlanForEffort", () => {
  const sent: SentPlan = {
    sendId: "send-1",
    sentAtMs: 5_000,
    generatorType: "manual",
    generatorModelVersion: "ai-coach",
    ftpWatts: 280,
    targetFinishSeconds: 2_512,
    zones: [{ startDistanceMeters: 0, endDistanceMeters: 1_000, targetPowerWatts: 240 }],
  };

  it("uses the plan that was on the Karoo for the ride, even when the segment's plan has changed since", () => {
    const resolved = resolvePlanForEffort({ sentPlan: sent, activePlan: imported, ftpWatts: 300, goalDurationMs: 600_000, referencePolyline: polyline(1_000) });
    assert.equal(resolved.kind, "sent");
    assert.equal(resolved.kind === "sent" && resolved.zones[0]!.targetPowerWatts, 240);
  });

  it("falls back to the segment's current plan when no send was recorded before the ride", () => {
    assert.equal(resolvePlanForEffort({ activePlan: imported, referencePolyline: polyline(1_000) }).kind, "imported");
    assert.equal(resolvePlanForEffort({ ftpWatts: 280, goalDurationMs: 39 * 60_000, referencePolyline: polyline(10_000) }).kind, "generated");
    assert.deepEqual(resolvePlanForEffort({ referencePolyline: polyline(1_000) }), { kind: "none", reason: "no-ftp" });
  });
});

