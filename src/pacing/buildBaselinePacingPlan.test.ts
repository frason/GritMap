import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { buildBaselinePacingPlan } from "./buildBaselinePacingPlan.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

function simplePolyline(totalDistanceMeters: number): SegmentReferencePoint[] {
  const points: SegmentReferencePoint[] = [];
  for (let d = 0; d < totalDistanceMeters; d += 10) points.push({ lat: 0, lng: 0, distanceMeters: d, elevationMeters: 100 });
  points.push({ lat: 0, lng: 0, distanceMeters: totalDistanceMeters, elevationMeters: 100 });
  return points;
}

describe("buildBaselinePacingPlan", () => {
  it("emits exactly the key set apps/karoo's TransferPackageParser.parseBaseline() expects", () => {
    const plan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: "fp-abc",
      referencePolyline: simplePolyline(1000),
      ftpWatts: 280,
      targetDurationMs: 39 * 60_000,
      createdAtMs: 1_000,
    }) as Record<string, unknown>;

    assert.deepEqual(new Set(Object.keys(plan)), new Set([
      "schemaVersion", "id", "segmentFingerprint", "createdAtMs", "generator",
      "ftpWatts", "targetFinishTimeSeconds", "zones",
    ]));
  });

  it("emits exactly the key set AiPacingResponseParser.parseZone() expects for every zone", () => {
    const plan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: "fp-abc",
      referencePolyline: simplePolyline(1000),
      ftpWatts: 280,
      targetDurationMs: 39 * 60_000,
      createdAtMs: 1_000,
    }) as { zones: Record<string, unknown>[] };

    assert.ok(plan.zones.length > 0);
    for (const zone of plan.zones) {
      assert.deepEqual(new Set(Object.keys(zone)), new Set([
        "startDistanceMeters", "endDistanceMeters", "targetPowerWatts", "classification", "icon", "instruction",
      ]));
    }
  });

  it("serializes a REST zone as RECOVER on the wire, for both classification and icon", () => {
    // Three quarter-mile zones exactly: a steep descent, flat, then a matching steep
    // climb back up -- the descent zone's grade sits far enough below the segment's own
    // average to be modulated into a REST classification.
    const plan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: "fp-abc",
      referencePolyline: [
        { lat: 0, lng: 0, distanceMeters: 0, elevationMeters: 100 },
        { lat: 0, lng: 0, distanceMeters: 402.875, elevationMeters: 59.7125 },
        { lat: 0, lng: 0, distanceMeters: 805.75, elevationMeters: 59.7125 },
        { lat: 0, lng: 0, distanceMeters: 1208.625, elevationMeters: 100 },
      ],
      ftpWatts: 300,
      targetDurationMs: 60 * 60_000,
      createdAtMs: 1_000,
    }) as { zones: { classification: string; icon: string }[] };

    assert.equal(plan.zones.length, 3);
    assert.equal(plan.zones[0]!.classification, "RECOVER");
    assert.equal(plan.zones[0]!.icon, "RECOVER");
    for (const zone of plan.zones) assert.notEqual(zone.classification, "REST");
  });

  it("always emits whole-number ftpWatts and targetPowerWatts, even for a fractional FTP", () => {
    const plan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: "fp-abc",
      referencePolyline: simplePolyline(1000),
      ftpWatts: 279.6,
      targetDurationMs: 39 * 60_000,
      createdAtMs: 1_000,
    }) as { ftpWatts: number; zones: { targetPowerWatts: number }[] };

    assert.ok(Number.isInteger(plan.ftpWatts));
    for (const zone of plan.zones) assert.ok(Number.isInteger(zone.targetPowerWatts));
  });

  it("sets targetFinishTimeSeconds to the rounded target duration in seconds", () => {
    const plan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: "fp-abc",
      referencePolyline: simplePolyline(1000),
      ftpWatts: 280,
      targetDurationMs: 2_340_500, // 39:00.5
      createdAtMs: 1_000,
    }) as { targetFinishTimeSeconds: number };

    assert.equal(plan.targetFinishTimeSeconds, 2341);
  });

  it("starts the first zone at distance 0 and ends the last zone at the polyline's exact total distance", () => {
    const polyline = simplePolyline(900);
    const plan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: "fp-abc",
      referencePolyline: polyline,
      ftpWatts: 280,
      targetDurationMs: 39 * 60_000,
      createdAtMs: 1_000,
    }) as { zones: { startDistanceMeters: number; endDistanceMeters: number }[] };

    assert.equal(plan.zones[0]!.startDistanceMeters, 0);
    assert.equal(plan.zones.at(-1)!.endDistanceMeters, polyline.at(-1)!.distanceMeters);
  });

  it("end-to-end against the real Diablo Northgate-to-Junction fixture: contiguous zones, no step over 80W", async () => {
    const fixture = JSON.parse(
      await readFile(
        "apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json",
        "utf8",
      ),
    ) as { segment: { referencePolyline: SegmentReferencePoint[] } };

    const plan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: "fp-diablo",
      referencePolyline: fixture.segment.referencePolyline,
      ftpWatts: 280,
      targetDurationMs: 39 * 60_000,
      createdAtMs: 1_000,
    }) as { zones: { startDistanceMeters: number; endDistanceMeters: number; targetPowerWatts: number }[] };

    assert.ok(plan.zones.length > 0);
    for (let i = 1; i < plan.zones.length; i += 1) {
      assert.equal(plan.zones[i]!.startDistanceMeters, plan.zones[i - 1]!.endDistanceMeters);
      const step = Math.abs(plan.zones[i]!.targetPowerWatts - plan.zones[i - 1]!.targetPowerWatts);
      assert.ok(step <= 80, `step ${step} between zone ${i - 1} and ${i} exceeds 80W`);
    }
  });
});
