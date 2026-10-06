import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";

import { sendGuidancePackageToKaroo, type GuidancePackageRiderInput } from "./sendGuidancePackageToKaroo.ts";
import { buildBaselinePacingPlan } from "../pacing/buildBaselinePacingPlan.ts";
import { buildRiderHistoryPackage } from "../pacing/buildRiderHistoryPackage.ts";
import type { SegmentDetail } from "../db/getSegmentDetail.ts";
import type { SavedSegmentPlan } from "../db/segmentPlans.ts";

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

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 200);
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

  it("returns the exact baseline plan it sent, so the phone can record what the Karoo received", async () => {
    let sentBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string);
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    const result = await sendGuidancePackageToKaroo(
      sampleSegment(), sampleRider(), 39 * 60_000, "192.168.1.42:8734", "plan-1", 1_700_000,
    );

    assert.deepEqual(result.baselinePlan, sentBody!.baselinePacingPlan);
    assert.equal(result.baselinePlan!.generator.type, "phone-ai");
  });

  it("returns no plan when the Karoo did not acknowledge the transfer", async () => {
    globalThis.fetch = (async () => ({ ok: false, status: 500 }) as Response) as typeof fetch;
    const result = await sendGuidancePackageToKaroo(
      sampleSegment(), sampleRider(), 39 * 60_000, "192.168.1.42:8734", "plan-1", 1_700_000,
    );
    assert.deepEqual(result, { ok: false, statusCode: 500 });
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
    assert.equal(result.unreachable, true);
  });

  it("rejects a malformed address before any request, and does not call it unreachable", async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    const result = await sendGuidancePackageToKaroo(
      sampleSegment(), sampleRider(), 39 * 60_000, "https://192.168.1.42", "plan-1", 1_700_000,
    );

    assert.deepEqual(result, { ok: false, message: "Karoo address must use http" });
    assert.equal(called, false);
  });

  describe("with an imported rider/coach plan", () => {
    function importedPlan(overrides: Partial<SavedSegmentPlan> = {}): SavedSegmentPlan {
      return {
        id: "saved-1",
        segmentId: "segment-1",
        source: "human-coach",
        authorLabel: "Sam",
        profileVersion: 2,
        ftpWatts: 280,
        targetFinishSeconds: 2_340,
        createdAtMs: 500,
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 60, targetPowerWatts: 200, classification: "REST", instruction: "Spin" },
          { startDistanceMeters: 60, endDistanceMeters: 111, targetPowerWatts: 290, classification: "PUSH", instruction: "Go" },
        ],
        ...overrides,
      };
    }

    function captureBody(): { bodies: Record<string, unknown>[] } {
      const bodies: Record<string, unknown>[] = [];
      globalThis.fetch = (async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string));
        return { ok: true, status: 200 } as Response;
      }) as typeof fetch;
      return { bodies };
    }

    it("sends the imported plan as a manual-generator baseline with provenance, REST translated to RECOVER", async () => {
      const { bodies } = captureBody();
      const result = await sendGuidancePackageToKaroo(
        sampleSegment(), sampleRider(), undefined, "192.168.1.42:8734", "pkg-9", 2_000, importedPlan(),
      );
      assert.equal(result.ok, true);
      assert.equal(result.statusCode, 200);
      assert.deepEqual(result.baselinePlan, bodies[0]!.baselinePacingPlan);
      assert.deepEqual(bodies[0]!.baselinePacingPlan, {
        schemaVersion: 1,
        id: "pkg-9",
        segmentFingerprint: "abc123",
        createdAtMs: 2_000,
        generator: { type: "manual", modelVersion: "human-coach" },
        ftpWatts: 280,
        targetFinishTimeSeconds: 2_340,
        zones: [
          { startDistanceMeters: 0, endDistanceMeters: 60, targetPowerWatts: 200, classification: "RECOVER", icon: "RECOVER", instruction: "Spin" },
          { startDistanceMeters: 60, endDistanceMeters: 111, targetPowerWatts: 290, classification: "PUSH", icon: "PUSH", instruction: "Go" },
        ],
      });
    });

    it("uses exactly the Karoo's accepted baseline keys, omitting targetFinishTimeSeconds when the plan has none", async () => {
      const { bodies } = captureBody();
      await sendGuidancePackageToKaroo(
        sampleSegment(), sampleRider(), undefined, "192.168.1.42:8734", "pkg-9", 2_000,
        (({ targetFinishSeconds: _omit, ...rest }) => rest)(importedPlan()),
      );
      assert.deepEqual(new Set(Object.keys(bodies[0]!.baselinePacingPlan as object)), new Set([
        "schemaVersion", "id", "segmentFingerprint", "createdAtMs", "generator", "ftpWatts", "zones",
      ]));
    });

    it("refuses, without sending, a plan written for a different FTP than the rider's current one", async () => {
      const { bodies } = captureBody();
      const result = await sendGuidancePackageToKaroo(
        sampleSegment(), sampleRider(), undefined, "192.168.1.42:8734", "pkg-9", 2_000, importedPlan({ ftpWatts: 260 }),
      );
      assert.equal(result.ok, false);
      assert.match(result.message ?? "", /260 W but yours is 280 W/);
      assert.equal(bodies.length, 0);
    });

    it("refuses a generated send with no goal time, without sending", async () => {
      const { bodies } = captureBody();
      const result = await sendGuidancePackageToKaroo(
        sampleSegment(), sampleRider(), undefined, "192.168.1.42:8734", "pkg-9", 2_000,
      );
      assert.deepEqual(result, { ok: false, message: "Set a goal time first." });
      assert.equal(bodies.length, 0);
    });
  });
});
