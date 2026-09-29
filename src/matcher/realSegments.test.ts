import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { parseFitFile } from "../fit/parseFitFile.ts";
import { matchSegment, toMatcherRidePoints, type SegmentDefinition } from "ride-segments";

/**
 * Validates the matcher against the client's own currently-defined real-world segments and
 * real completed/attempted rides (see issue #60) rather than only synthetic geometry. The
 * three segment definitions here are the same portable JSON already pushed to the client's
 * Karoo (apps/karoo/samples/), so this doubles as a check that both platforms agree on what
 * "the segment" is. Ground truth for each expected result below (elapsed time, coverage,
 * confidence) was independently established from the connected Karoo's own persisted
 * diagnostics and FIT reanalysis -- see handoffs/archive/2026-09-24-1633-codex-diablo-real-ride.md
 * and handoffs/archive/2026-08-22-1439-codex-relize-real-ride-verified.md.
 */

interface PortableSegment {
  id: string;
  matching: { corridorMeters: number; requiredCoveragePct: number };
  referencePolyline: { lat: number; lng: number; distanceMeters: number }[];
}

async function loadSegment(path: string): Promise<SegmentDefinition> {
  const raw = JSON.parse(await readFile(path, "utf8")) as PortableSegment;
  return {
    id: raw.id,
    corridorMeters: raw.matching.corridorMeters,
    requiredCoveragePct: raw.matching.requiredCoveragePct,
    referencePolyline: raw.referencePolyline,
  };
}

async function matchFixture(fitPath: string, segment: SegmentDefinition) {
  const bytes = await readFile(fitPath);
  const parsed = parseFitFile(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  return matchSegment(toMatcherRidePoints(parsed.points), segment);
}

describe("matchSegment against real client segments and rides", () => {
  it("accepts the client's first real Diablo climb (predates the pacing-plan build)", async () => {
    const segment = await loadSegment("apps/karoo/samples/Diablo.Northgate-to-Junction.segment.json");
    const result = await matchFixture("fixtures/fit/Karoo-Morning_Ride-2026-07-18-0908.fit", segment);

    assert.equal(result.length, 1);
    assert.equal(result[0].decision, "accept");
    assert.ok(result[0].coveragePct > 0.99);
    assert.ok(result[0].confidenceScore > 0.95);
  });

  it("accepts the client's Karoo-paced Diablo completion and rejects the same-ride reverse descent", async () => {
    // The Karoo's own diagnostics recorded a completed 45:48.947 climb followed ~20 minutes
    // later by a reverse traversal back down through the segment (see the archived handoff) --
    // the Karoo's live matcher could only reject that early as "no-valid-candidate", but this
    // offline matcher sees the whole ride and must recognize it as a completed reverse
    // traversal specifically, not silently miss it or misfile it as a forward accept.
    const segment = await loadSegment("apps/karoo/samples/Diablo.Northgate-to-Junction.segment.json");
    const result = await matchFixture("fixtures/fit/Karoo-Morning_Ride-2026-09-13-0647.fit", segment);

    assert.equal(result.length, 2);

    const [climb, descent] = result;
    assert.equal(climb.decision, "accept");
    assert.ok(climb.coveragePct > 0.99);
    assert.ok(climb.confidenceScore > 0.95);

    assert.equal(descent.decision, "reject");
    assert.deepEqual(descent.reasons, ["reverse-traversal"]);
    assert.ok(descent.startPointIndex > climb.endPointIndex, "descent must follow the climb, not overlap it");
  });

  it("accepts the client's real Relize completion, 33s under the 6:54 target", async () => {
    const segment = await loadSegment("apps/karoo/samples/Relize.segment.json");
    const result = await matchFixture("fixtures/fit/Karoo-Morning_Ride-2026-08-22-0828.fit", segment);

    assert.equal(result.length, 1);
    assert.equal(result[0].decision, "accept");
    assert.ok(result[0].coveragePct > 0.99);
    assert.ok(result[0].confidenceScore > 0.95);
  });

  it("does not falsely accept a ride that only brushes the Coco Jumbo corridor", async () => {
    // This ride crosses near the Coco Jumbo corridor without actually riding it -- low
    // coverage and backward progress. A real false-accept risk if corridor/coverage
    // thresholds were ever loosened; pinned here as a negative-control regression guard.
    const segment = await loadSegment("apps/karoo/samples/Coco_Jumbo.segment.json");
    const result = await matchFixture("fixtures/fit/Karoo-Morning_Ride-2026-08-29-0648.fit", segment);

    assert.ok(result.length > 0);
    assert.ok(result.every((candidate) => candidate.decision === "reject"));
  });

  it("does not match unrelated real climbs against segments they don't cover", async () => {
    // Cross-checks every real (segment, ride) pair that is known NOT to correspond, so a
    // change that widens matching can't silently start producing false positives here.
    const segments = await Promise.all([
      loadSegment("apps/karoo/samples/Diablo.Northgate-to-Junction.segment.json"),
      loadSegment("apps/karoo/samples/Relize.segment.json"),
      loadSegment("apps/karoo/samples/Coco_Jumbo.segment.json"),
    ]);
    const unrelatedRides = [
      "fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit",
      "fixtures/fit/Karoo-Morning_Ride-2026-08-09-0844.fit",
    ];

    for (const ridePath of unrelatedRides) {
      for (const segment of segments) {
        const result = await matchFixture(ridePath, segment);
        assert.deepEqual(result, [], `expected no candidates for ${ridePath} against ${segment.id}`);
      }
    }
  });
});
