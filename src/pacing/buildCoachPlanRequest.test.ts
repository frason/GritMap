import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildCoachPlanRequest } from "./buildCoachPlanRequest.ts";
import { parseCoachPlan } from "./coachPlan.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

const FINGERPRINT = "cd".repeat(32);

function climb(totalMeters: number, riseMeters: number): SegmentReferencePoint[] {
  const points: SegmentReferencePoint[] = [];
  for (let d = 0; d < totalMeters; d += 10) {
    points.push({ lat: 0, lng: 0, distanceMeters: d, elevationMeters: (d / totalMeters) * riseMeters });
  }
  points.push({ lat: 0, lng: 0, distanceMeters: totalMeters, elevationMeters: riseMeters });
  return points;
}

function templateOf(request: string): string {
  return request.slice(request.indexOf("{\n"));
}

describe("buildCoachPlanRequest", () => {
  it("states the segment facts and rules a coach needs", () => {
    const request = buildCoachPlanRequest({
      segmentName: "Diablo",
      segmentFingerprint: FINGERPRINT,
      referencePolyline: climb(10_427, 500),
      ftpWatts: 280,
      targetDurationMs: 39 * 60_000,
    });
    assert.match(request, /"Diablo"/);
    assert.match(request, /Distance: 10\.43 km \(10427 m\)/);
    assert.match(request, /FTP: 280 W/);
    assert.match(request, /Goal time: 39:00/);
    assert.match(request, /420 W/); // 150% of FTP
    assert.match(request, /at most 100 W/);
    assert.match(request, /0-402 m: \+4\.8%/);
  });

  it("includes a template that the importer accepts as-is (with a goal)", () => {
    const polyline = climb(10_427, 500);
    const request = buildCoachPlanRequest({
      segmentName: "Diablo",
      segmentFingerprint: FINGERPRINT,
      referencePolyline: polyline,
      ftpWatts: 280,
      targetDurationMs: 39 * 60_000,
    });
    const result = parseCoachPlan(templateOf(request), {
      segmentFingerprint: FINGERPRINT,
      segmentLengthMeters: 10_427,
      ftpWatts: 280,
    });
    assert.ok(result.ok, result.ok ? "" : result.errors.join("; "));
    assert.equal(result.plan.targetFinishTimeSeconds, 2_340);
    assert.ok(result.plan.zones.length >= 20);
    assert.equal(result.plan.zones.at(-1)!.endDistanceMeters, 10_427);
  });

  it("without a goal, falls back to a flat 90% FTP template that also imports cleanly", () => {
    const request = buildCoachPlanRequest({
      segmentName: "Short",
      segmentFingerprint: FINGERPRINT,
      referencePolyline: climb(805, 30),
      ftpWatts: 250,
    });
    assert.doesNotMatch(request, /Goal time/);
    const result = parseCoachPlan(templateOf(request), {
      segmentFingerprint: FINGERPRINT,
      segmentLengthMeters: 805,
      ftpWatts: 250,
    });
    assert.ok(result.ok, result.ok ? "" : result.errors.join("; "));
    assert.ok(result.plan.zones.every((zone) => zone.targetPowerWatts === 225));
    assert.equal(result.plan.targetFinishTimeSeconds, undefined);
  });
});
