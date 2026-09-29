import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchSegment, type RidePoint, type SegmentDefinition } from "./matchSegment.ts";

const METERS_PER_DEGREE = 111_195;

describe("matchSegment", () => {
  it("accepts a clean forward traversal", () => {
    assert.equal(matchSegment(lineRide(0, 100, 10), segment())[0]?.decision, "accept");
  });

  it("ignores an incomplete traversal that enters the corridor but never reaches the end", () => {
    // The ride starts the segment and stops partway (e.g. the rider turned off mid-climb) --
    // this must not surface as any candidate at all, not even a reject.
    assert.deepEqual(matchSegment(lineRide(0, 60, 10), segment()), []);
  });

  it("rejects a completed reverse traversal", () => {
    const result = matchSegment(lineRide(100, 0, -10), segment());
    assert.equal(result.length, 1);
    assert.equal(result[0].decision, "reject");
    assert.deepEqual(result[0].reasons, ["reverse-traversal"]);
  });

  it("rejects endpoints connected by a materially different route", () => {
    const ride = [
      ridePoint(0, 0, 0),
      ridePoint(10, 0, 1_000),
      ridePoint(20, 100, 2_000),
      ridePoint(80, 100, 3_000),
      ridePoint(90, 0, 4_000),
      ridePoint(100, 0, 5_000),
    ];
    const result = matchSegment(ride, segment());
    assert.equal(result[0]?.decision, "reject");
    assert.ok(result[0]?.reasons.includes("different-route"));
  });

  it("does not flag a long GPS gap as suspicious when it implies a normal cycling pace", () => {
    // Gap here is 32s, but the rider only covered 10m across it -- a real dropout under
    // tree cover or a tunnel that resumes right where a normal pace would put them isn't
    // suspicious just because it was long.
    const ride = lineRide(0, 100, 10);
    for (let index = 6; index < ride.length; index += 1) ride[index].timestampMs += 31_000;
    const result = matchSegment(ride, segment());
    assert.equal(result[0]?.decision, "accept");
    assert.deepEqual(result[0]?.reasons, []);
  });

  it("flags a gap as a reason for uncertainty when it implies an unreasonably fast pace", () => {
    const longSegment = segment();
    longSegment.referencePolyline = Array.from({ length: 101 }, (_, index) => ({
      lat: 0,
      lng: degrees(index * 10),
      distanceMeters: index * 10,
    }));
    const ride = [
      ridePoint(0, 0, 0),
      ridePoint(10, 0, 1_000),
      ridePoint(900, 0, 36_000), // 35s gap covering 890m -> ~25.4 m/s, over the 20 m/s ceiling
      ridePoint(910, 0, 37_000),
      ridePoint(1_000, 0, 38_000),
    ];

    const result = matchSegment(ride, longSegment);

    assert.equal(result[0]?.decision, "borderline");
    assert.ok(result[0]?.reasons.includes("implausible-gap-speed"));
  });

  it("still matches correctly when a real GPS gap jumps further than the search window", () => {
    // The windowed search (added to keep matching fast on a real several-thousand-point
    // segment) only looks a bounded distance around where the previous point landed before
    // falling back to a full scan. This ride jumps 2000m across a real gap -- far beyond
    // that window on a 400-point (4000m) reference line -- and must still resolve correctly
    // via the fallback, not silently mismatch or miss the segment's actual end.
    const longSegment = segment();
    longSegment.referencePolyline = Array.from({ length: 401 }, (_, index) => ({
      lat: 0,
      lng: degrees(index * 10),
      distanceMeters: index * 10,
    }));
    const ride = [
      ridePoint(0, 0, 0),
      ridePoint(500, 0, 1_000), // 500m in, then a real dropout
      ridePoint(2_500, 0, 32_000), // resumes 2000m further along after 31s -- past the window
      ridePoint(3_000, 0, 33_000),
      ridePoint(4_000, 0, 34_000), // reaches the true end
    ];

    const result = matchSegment(ride, longSegment);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.startPointIndex, 0);
    assert.equal(result[0]?.endPointIndex, 4);
    assert.ok(result[0]?.maxDeviationMeters < 1, "should land exactly on the line, not a stale window match");
  });

  it("marks a sparse but same-route traversal below 90% coverage borderline", () => {
    const ride = [ridePoint(0, 0, 0), ridePoint(50, 0, 10_000), ridePoint(100, 0, 20_000)];
    const result = matchSegment(ride, segment(8));
    assert.equal(result[0]?.decision, "borderline");
    assert.ok(result[0]?.coveragePct < 0.9);
    assert.ok(result[0]?.reasons.includes("insufficient-coverage"));
  });

  it("keeps two separate forward traversals while deduplicating nearby candidate starts", () => {
    const first = lineRide(0, 100, 10);
    const connector = [ridePoint(150, 50, 12_000), ridePoint(-50, 50, 13_000)];
    const second = lineRide(0, 100, 10, 14_000);
    const result = matchSegment([...first, ...connector, ...second], segment());
    const accepted = result.filter((candidate) => candidate.decision === "accept");
    assert.equal(accepted.length, 2);
    assert.ok(accepted[0].endPointIndex < accepted[1].startPointIndex);
  });

  it("rejects a genuine mid-ride reversal on a plain straight segment", () => {
    // No self-proximate geometry here -- confirms the hairpin fix below doesn't also mask
    // a real rider actually turning around and riding backward.
    const ride = [
      ridePoint(0, 0, 0),
      ridePoint(20, 0, 1_000),
      ridePoint(40, 0, 2_000),
      ridePoint(60, 0, 3_000),
      ridePoint(40, 0, 4_000),
      ridePoint(20, 0, 5_000),
      ridePoint(10, 0, 6_000),
    ];
    const result = matchSegment(ride, segment());
    assert.equal(result[0]?.decision, "reject");
    assert.deepEqual(result[0]?.reasons, ["backward-progress"]);
  });

  it("does not reject a real switchback that briefly projects onto an earlier, nearby leg", () => {
    // Diagnosed against a real climbing segment with a real hairpin: the matcher's own
    // source ride was rejected as backward-progress even though the rider never left the
    // corridor, because the globally-nearest-point search occasionally snapped onto the
    // wrong (spatially close but sequentially earlier) leg of the switchback. This fixture
    // reproduces that class of route -- a loop that returns within half a meter of its own
    // earlier path before continuing on -- using synthetic coordinates.
    //
    // Verified this reproduces the actual bug: reverting projectOntoPolyline's
    // previousProgressMeters bias makes this same fixture reject with backward-progress
    // (maxBackwardMeters ~147) instead of accepting cleanly.
    const loopSegment: SegmentDefinition = {
      id: "switchback-segment",
      corridorMeters: 30,
      requiredCoveragePct: 0.9,
      referencePolyline: [
        loopPoint(0, 0, 0),
        loopPoint(0, 50, 50),
        loopPoint(50, 50, 100),
        loopPoint(50, 0, 150),
        loopPoint(0.5, 3, 200), // the switchback: close to, but not on, the up-leg's line
        loopPoint(0.5, 80, 277),
      ],
    };
    const ride: RidePoint[] = [
      loopRidePoint(0, 0, 0),
      loopRidePoint(0, 25, 1),
      loopRidePoint(0, 50, 2),
      loopRidePoint(50, 50, 3),
      loopRidePoint(50, 0, 4),
      // 0.1m from the up-leg's line but 0.4m from the true (later) point -- the globally
      // nearest search alone would pick the up-leg (wrong, low progress) here.
      loopRidePoint(0.1, 3, 5),
      loopRidePoint(0.5, 40, 6),
      loopRidePoint(0.5, 80, 7),
    ];

    const result = matchSegment(ride, loopSegment);

    assert.equal(result.length, 1);
    assert.equal(result[0]?.decision, "accept");
    assert.equal(result[0]?.startPointIndex, 0);
    assert.equal(result[0]?.endPointIndex, 7);
    assert.equal(result[0]?.maxBackwardMeters, 0);
  });

  it("reports original source indexes across a non-GPS gap inside the matched region", () => {
    // 11 points along the reference line (0..100m), but index 5 (50m) has no GPS fix --
    // simulating a dropped record that a caller filtered out before calling matchSegment,
    // while still carrying the original array position forward via sourcePointIndex.
    const withGap: RidePoint[] = lineRide(0, 100, 10).map((point, index) => ({
      ...point,
      sourcePointIndex: index,
    }));
    const filtered = withGap.filter((_, index) => index !== 5);

    assert.equal(filtered.length, 10);
    assert.deepEqual(
      filtered.map((point) => point.sourcePointIndex),
      [0, 1, 2, 3, 4, 6, 7, 8, 9, 10],
    );

    // A tight 5m corridor forces isAtEnd to trigger only at the literal last point (100m):
    // with the default 30m corridor, points as early as 70m are already within 30m of the
    // endpoint and satisfy isAtEnd on their own, so the match could legitimately complete
    // before the array's actual end -- not what this test is trying to isolate.
    const result = matchSegment(filtered, segment(5));
    assert.equal(result.length, 1);
    const [candidate] = result;
    assert.equal(candidate.decision, "accept");
    // Must be the *original* first/last indexes (0 and 10) from the unfiltered 11-point
    // ride, not the filtered array's own positions (0 and 9) -- a caller looking up
    // ride_points by these indexes must land on the correct database rows.
    assert.equal(candidate.startPointIndex, 0);
    assert.equal(candidate.endPointIndex, 10);
  });
});

function segment(corridorMeters = 30): SegmentDefinition {
  return {
    id: "segment-1",
    corridorMeters,
    requiredCoveragePct: 0.9,
    referencePolyline: Array.from({ length: 11 }, (_, index) => ({
      lat: 0,
      lng: degrees(index * 10),
      distanceMeters: index * 10,
    })),
  };
}

/** x/y meters -> lat/lng, for the switchback fixture's two-dimensional loop shape. */
function loopPoint(xMeters: number, yMeters: number, distanceMeters: number) {
  return { lat: degrees(yMeters), lng: degrees(xMeters), distanceMeters };
}

function loopRidePoint(xMeters: number, yMeters: number, indexSeconds: number): RidePoint {
  return { lat: degrees(yMeters), lng: degrees(xMeters), timestampMs: indexSeconds * 1_000 };
}

function lineRide(start: number, end: number, step: number, timeOffset = 0): RidePoint[] {
  const points: RidePoint[] = [];
  let index = 0;
  for (let meters = start; step > 0 ? meters <= end : meters >= end; meters += step) {
    points.push(ridePoint(meters, 0, timeOffset + index * 1_000));
    index += 1;
  }
  return points;
}

function ridePoint(xMeters: number, yMeters: number, timestampMs: number): RidePoint {
  return { lat: degrees(yMeters), lng: degrees(xMeters), timestampMs };
}

function degrees(meters: number): number {
  return meters / METERS_PER_DEGREE;
}
