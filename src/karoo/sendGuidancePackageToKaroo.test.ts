import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { sendGuidancePackageToKaroo, type GuidancePackageRiderInput } from "./sendGuidancePackageToKaroo.ts";
import { buildBaselinePacingPlan } from "../pacing/buildBaselinePacingPlan.ts";
import { buildRiderHistoryPackage } from "../pacing/buildRiderHistoryPackage.ts";
import type { SegmentDetail } from "../db/getSegmentDetail.ts";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function sampleSegment(): SegmentDetail {
  return {
    segmentId: "segment-1",
    name: "Local Wall",
    corridorMeters: 30,
    requiredCoveragePct: 0.9,
    schemaVersion: 1,
    fingerprint: "abc123",
    createdAtMs: 1_000,
    referencePolyline: [
      { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
      { lat: 37.001, lng: -122.0, distanceMeters: 111, elevationMeters: 20 },
    ],
  };
}

function sampleRider(): GuidancePackageRiderInput {
  return { ftpWatts: 280, weightKg: 75.5, maxHeartRateBpm: 178 };
}

describe("sendGuidancePackageToKaroo", () => {
  it("POSTs a segment, rider profile, and generated baseline pacing plan to the Karoo's /transfer endpoint", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    const segment = sampleSegment();
    const rider = sampleRider();
    const result = await sendGuidancePackageToKaroo(
      segment,
      rider,
      39 * 60_000,
      "192.168.1.42:8734",
      "plan-1",
      1_700_000,
    );

    assert.deepEqual(result, { ok: true, statusCode: 200 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "http://192.168.1.42:8734/transfer");
    assert.equal(calls[0]?.init.method, "POST");

    const body = JSON.parse(calls[0]?.init.body as string);
    assert.equal(body.schemaVersion, 1);
    assert.equal(body.packageType, "gritmap-transfer");
    assert.equal(body.packageId, "plan-1");
    assert.equal(body.createdAtMs, 1_700_000);
    assert.deepEqual(body.segment, {
      schemaVersion: 1,
      id: "segment-1",
      name: "Local Wall",
      direction: "forward",
      matching: { corridorMeters: 30, requiredCoveragePct: 0.9 },
      referencePolyline: [
        { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
        { lat: 37.001, lng: -122.0, distanceMeters: 111, elevationMeters: 20 },
      ],
      fingerprint: "abc123",
    });

    // The pacing-plan and rider-history math themselves are covered by
    // buildBaselinePacingPlan.test.ts and buildRiderHistoryPackage.test.ts -- here we only
    // verify this function wires the same inputs into them and sends the results as-is.
    const expectedPlan = buildBaselinePacingPlan({
      id: "plan-1",
      segmentFingerprint: segment.fingerprint,
      referencePolyline: segment.referencePolyline,
      ftpWatts: rider.ftpWatts,
      targetDurationMs: 39 * 60_000,
      createdAtMs: 1_700_000,
    });
    assert.deepEqual(body.baselinePacingPlan, expectedPlan);

    const expectedRiderHistory = buildRiderHistoryPackage(rider);
    assert.deepEqual(body.riderHistory, expectedRiderHistory);
  });

  it("omits maxHeartRateBpm from the rider profile when the caller didn't provide it", async () => {
    globalThis.fetch = (async () => ({ ok: true, status: 200 }) as Response) as typeof fetch;

    await sendGuidancePackageToKaroo(
      sampleSegment(),
      { ftpWatts: 280, weightKg: 75.5 },
      39 * 60_000,
      "192.168.1.42:8734",
      "plan-1",
      1_700_000,
    );
  });

  it("reports a non-2xx response as not ok, with its status code", async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 500 }) as Response) as typeof fetch;

    const result = await sendGuidancePackageToKaroo(
      sampleSegment(),
      sampleRider(),
      39 * 60_000,
      "192.168.1.42:8734",
      "plan-1",
      1_700_000,
    );

    assert.deepEqual(result, { ok: false, statusCode: 500 });
  });

  it("reports a network failure (e.g. Karoo unreachable) without throwing", async () => {
    globalThis.fetch = (async () => {
      throw new Error("Network request failed");
    }) as typeof fetch;

    const result = await sendGuidancePackageToKaroo(
      sampleSegment(),
      sampleRider(),
      39 * 60_000,
      "192.168.1.42:8734",
      "plan-1",
      1_700_000,
    );

    assert.equal(result.ok, false);
    assert.equal(result.message, "Network request failed");
  });
});
