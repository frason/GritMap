import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import {
  calculateConfidenceScore,
  MATCHER_VERSION,
  matchSegment,
  type MatchCandidate,
  type MatchDecision,
  type SegmentDefinition,
} from "../matcher/matchSegment.ts";
import { toMatcherRidePoints, type SourcePoint } from "../matcher/toMatcherRidePoints.ts";
import { applyMigrations } from "./migrations.ts";
import { persistMatchCandidate } from "./persistMatchCandidate.ts";

const NOW = 1_700_000_000_000;

describe("persistMatchCandidate", () => {
  it("persists an accepted attempt and every diagnostic field", () => {
    using database = createDatabase();
    const candidate = matchCandidate("accept");

    assert.deepEqual(persistMatchCandidate(database, candidate, context("attempt-accept")), {
      status: "inserted",
      attemptId: "attempt-accept",
    });

    assert.deepEqual({ ...database.prepare(`
      SELECT segment_id, ride_id, start_point_index, end_point_index,
             start_timestamp_ms, end_timestamp_ms,
             matcher_version, confidence_score, decision, manually_approved
      FROM segment_attempts WHERE id = ?
    `).get("attempt-accept") }, {
      segment_id: "segment-1",
      ride_id: "ride-1",
      start_point_index: 1,
      end_point_index: 3,
      // Read directly from the ride_points rows at point_index 1 and 3, not supplied by the caller.
      start_timestamp_ms: NOW + 1_000,
      end_timestamp_ms: NOW + 3_000,
      matcher_version: MATCHER_VERSION,
      confidence_score: 0.95,
      decision: "accept",
      manually_approved: 0,
    });
    assert.deepEqual({ ...database.prepare(`
      SELECT coverage_pct, max_deviation_meters, median_deviation_meters,
             max_backward_meters, max_gap_ms, gps_gap_count,
             confidence_score, reasons_json
      FROM match_diagnostics WHERE attempt_id = ?
    `).get("attempt-accept") }, {
      coverage_pct: 1,
      max_deviation_meters: 8,
      median_deviation_meters: 3,
      max_backward_meters: 2,
      max_gap_ms: 1_000,
      gps_gap_count: 0,
      confidence_score: 0.95,
      reasons_json: "[]",
    });
  });

  it("persists a borderline attempt and its review reasons", () => {
    using database = createDatabase();
    const candidate = matchCandidate("borderline", {
      confidenceScore: 0.62,
      maxGapMs: 31_000,
      gpsGapCount: 1,
      reasons: ["gps-gap"],
    });

    persistMatchCandidate(database, candidate, context("attempt-borderline"));

    assert.equal(
      database.prepare("SELECT decision FROM segment_attempts WHERE id = ?")
        .get("attempt-borderline")?.decision,
      "borderline",
    );
    assert.deepEqual(
      { ...database.prepare(`
        SELECT gps_gap_count, confidence_score, reasons_json
        FROM match_diagnostics WHERE attempt_id = ?
      `).get("attempt-borderline") },
      { gps_gap_count: 1, confidence_score: 0.62, reasons_json: '["gps-gap"]' },
    );
  });

  it("throws instead of persisting when a boundary point_index has no ride_points row", () => {
    using database = createDatabase();
    const candidate = matchCandidate("accept", { startPointIndex: 1, endPointIndex: 99 });

    assert.throws(
      () => persistMatchCandidate(database, candidate, context("attempt-missing-row")),
      /No ride_points row for ride ride-1 at point_index 99/,
    );
    assert.equal(count(database, "segment_attempts"), 0);
    assert.equal(count(database, "match_diagnostics"), 0);
  });

  it("does not persist rejected candidates", () => {
    using database = createDatabase();

    assert.deepEqual(
      persistMatchCandidate(database, matchCandidate("reject"), context("attempt-reject")),
      { status: "rejected" },
    );
    assert.equal(count(database, "segment_attempts"), 0);
    assert.equal(count(database, "match_diagnostics"), 0);
  });

  it("keeps the existing row when the same physical traversal is rescanned", () => {
    using database = createDatabase();
    const candidate = matchCandidate("accept");

    persistMatchCandidate(database, candidate, context("attempt-first"));
    const before = { ...database.prepare(
      "SELECT * FROM segment_attempts WHERE id = 'attempt-first'",
    ).get() };
    const duplicate = persistMatchCandidate(
      database,
      candidate,
      context("attempt-rescan"),
    );

    assert.deepEqual(duplicate, { status: "duplicate", attemptId: "attempt-first" });
    assert.equal(count(database, "segment_attempts"), 1);
    assert.equal(count(database, "match_diagnostics"), 1);
    assert.deepEqual({ ...database.prepare(
      "SELECT * FROM segment_attempts WHERE id = 'attempt-first'",
    ).get() }, before);
  });

  it("treats more than 50% overlap as the same physical traversal", () => {
    using database = createDatabase();
    const first = matchCandidate("accept", {
      startPointIndex: 10,
      endPointIndex: 20,
    });
    const overlapping = matchCandidate("accept", {
      startPointIndex: 15,
      endPointIndex: 25,
    });

    persistMatchCandidate(database, first, contextFor("attempt-first", 10, 20));
    const result = persistMatchCandidate(
      database,
      overlapping,
      contextFor("attempt-overlap", 15, 25),
    );

    assert.deepEqual(result, { status: "duplicate", attemptId: "attempt-first" });
    assert.equal(count(database, "segment_attempts"), 1);
  });

  it("treats exactly 50% overlap as separate traversals", () => {
    using database = createDatabase();
    const first = matchCandidate("accept", {
      startPointIndex: 10,
      endPointIndex: 19,
    });
    const halfOverlap = matchCandidate("accept", {
      startPointIndex: 15,
      endPointIndex: 24,
    });

    persistMatchCandidate(database, first, contextFor("attempt-first", 10, 19));
    persistMatchCandidate(database, halfOverlap, contextFor("attempt-half", 15, 24));

    assert.equal(count(database, "segment_attempts"), 2);
  });

  it("does not collapse traversals that share only one endpoint", () => {
    using database = createDatabase();
    persistMatchCandidate(
      database,
      matchCandidate("accept", { startPointIndex: 10, endPointIndex: 20 }),
      contextFor("attempt-first", 10, 20),
    );
    persistMatchCandidate(
      database,
      matchCandidate("accept", { startPointIndex: 20, endPointIndex: 30 }),
      contextFor("attempt-second", 20, 30),
    );

    assert.equal(count(database, "segment_attempts"), 2);
  });

  it("persists multiple back-to-back laps in the same ride", () => {
    using database = createDatabase();
    for (let lap = 0; lap < 3; lap += 1) {
      const start = lap * 10;
      const end = start + 10;
      persistMatchCandidate(
        database,
        matchCandidate("accept", { startPointIndex: start, endPointIndex: end }),
        contextFor(`lap-${lap}`, start, end),
      );
    }

    assert.equal(count(database, "segment_attempts"), 3);
  });

  it("refreshes an overlapping automatic result from a newer matcher version", () => {
    using database = createDatabase();
    persistMatchCandidate(
      database,
      matchCandidate("accept", {
        startPointIndex: 10,
        endPointIndex: 20,
        matcherVersion: 1,
        confidenceScore: 0.7,
      }),
      contextFor("attempt-original", 10, 20),
    );
    const refreshed = matchCandidate("borderline", {
      startPointIndex: 15,
      endPointIndex: 25,
      matcherVersion: 2,
      confidenceScore: 0.55,
      medianDeviationMeters: 12,
      reasons: ["gps-gap"],
    });

    const result = persistMatchCandidate(
      database,
      refreshed,
      contextFor("attempt-new-id", 15, 25),
    );

    assert.deepEqual(result, { status: "updated", attemptId: "attempt-original" });
    assert.deepEqual({ ...database.prepare(`
      SELECT id, start_point_index, end_point_index, start_timestamp_ms,
             end_timestamp_ms, matcher_version, confidence_score, decision
      FROM segment_attempts
    `).get() }, {
      id: "attempt-original",
      start_point_index: 15,
      end_point_index: 25,
      start_timestamp_ms: NOW + 15_000,
      end_timestamp_ms: NOW + 25_000,
      matcher_version: 2,
      confidence_score: 0.55,
      decision: "borderline",
    });
    assert.deepEqual({ ...database.prepare(`
      SELECT median_deviation_meters, confidence_score, reasons_json
      FROM match_diagnostics WHERE attempt_id = 'attempt-original'
    `).get() }, {
      median_deviation_meters: 12,
      confidence_score: 0.55,
      reasons_json: '["gps-gap"]',
    });
  });

  it("never changes a manually approved attempt during a newer rescan", () => {
    using database = createDatabase();
    persistMatchCandidate(
      database,
      matchCandidate("accept", {
        startPointIndex: 10,
        endPointIndex: 20,
        matcherVersion: 1,
      }),
      contextFor("attempt-manual", 10, 20),
    );
    database.prepare(
      "UPDATE segment_attempts SET manually_approved = 1 WHERE id = 'attempt-manual'",
    ).run();
    const beforeAttempt = { ...database.prepare(
      "SELECT * FROM segment_attempts WHERE id = 'attempt-manual'",
    ).get() };
    const beforeDiagnostic = { ...database.prepare(
      "SELECT * FROM match_diagnostics WHERE attempt_id = 'attempt-manual'",
    ).get() };

    const result = persistMatchCandidate(
      database,
      matchCandidate("borderline", {
        startPointIndex: 15,
        endPointIndex: 25,
        matcherVersion: 2,
        confidenceScore: 0.2,
        reasons: ["gps-gap"],
      }),
      contextFor("attempt-new-id", 15, 25),
    );

    assert.deepEqual(result, { status: "duplicate", attemptId: "attempt-manual" });
    assert.deepEqual({ ...database.prepare(
      "SELECT * FROM segment_attempts WHERE id = 'attempt-manual'",
    ).get() }, beforeAttempt);
    assert.deepEqual({ ...database.prepare(
      "SELECT * FROM match_diagnostics WHERE attempt_id = 'attempt-manual'",
    ).get() }, beforeDiagnostic);
  });

  it("removes an automatic attempt when a newer matcher rejects it", () => {
    using database = createDatabase();
    persistMatchCandidate(
      database,
      matchCandidate("accept", { matcherVersion: 1 }),
      context("attempt-automatic"),
    );

    const result = persistMatchCandidate(
      database,
      matchCandidate("reject", { matcherVersion: 2 }),
      context("unused-new-id"),
    );

    assert.deepEqual(result, { status: "removed", attemptId: "attempt-automatic" });
    assert.equal(count(database, "segment_attempts"), 0);
    assert.equal(count(database, "match_diagnostics"), 0);
  });

  it("preserves a manually approved attempt when a newer matcher rejects it", () => {
    using database = createDatabase();
    persistMatchCandidate(
      database,
      matchCandidate("accept", { matcherVersion: 1 }),
      context("attempt-manual"),
    );
    database.prepare(
      "UPDATE segment_attempts SET manually_approved = 1 WHERE id = 'attempt-manual'",
    ).run();
    const before = { ...database.prepare(
      "SELECT * FROM segment_attempts WHERE id = 'attempt-manual'",
    ).get() };

    const result = persistMatchCandidate(
      database,
      matchCandidate("reject", { matcherVersion: 2 }),
      context("unused-new-id"),
    );

    assert.deepEqual(result, { status: "duplicate", attemptId: "attempt-manual" });
    assert.deepEqual({ ...database.prepare(
      "SELECT * FROM segment_attempts WHERE id = 'attempt-manual'",
    ).get() }, before);
    assert.equal(count(database, "match_diagnostics"), 1);
  });

  it("computes median deviation and hand-checked confidence for every decision type", () => {
    const matched = matchSegment(knownDeviationRide(), knownSegment());
    const accepted = matched.find((candidate) => candidate.decision === "accept");
    assert.ok(accepted);
    assert.ok(Math.abs(accepted.medianDeviationMeters - 10) < 0.02);
    assert.ok(Math.abs(accepted.maxDeviationMeters - 20) < 0.02);
    assert.ok(Math.abs(accepted.confidenceScore - 0.933333) < 0.00002);
    assert.equal(accepted.matcherVersion, MATCHER_VERSION);

    const common = {
      coveragePct: 0.9,
      requiredCoveragePct: 0.9,
      maxDeviationMeters: 30,
      medianDeviationMeters: 15,
      corridorMeters: 30,
      maxBackwardMeters: 15,
      maxGapMs: 45_000,
    };
    const byDecision: Record<MatchDecision, number> = {
      accept: calculateConfidenceScore({ ...common, reasons: [] }),
      borderline: calculateConfidenceScore({ ...common, reasons: ["gps-gap"] }),
      reject: calculateConfidenceScore({ ...common, reasons: ["backward-progress"] }),
    };

    // Hand calculation: .35 + .20 + .10 + .05 + .075 = .775.
    assert.equal(byDecision.accept, 0.775);
    assert.equal(byDecision.borderline, 0.775);
    // Direction/order contributes zero for backward-progress: .775 - .20 = .575.
    assert.equal(byDecision.reject, 0.575);
  });

  it("persists correct original point_index boundaries across a non-GPS gap in the ride", () => {
    // Full source array as it would arrive from the FIT parser: 11 points along the
    // segment, with index 5 missing GPS entirely (dropped fix mid-ride).
    const sourcePoints: SourcePoint[] = Array.from({ length: 11 }, (_, index) => ({
      timestampMs: NOW + index * 1_000,
      ...(index === 5 ? {} : { lat: 0, lng: (index * 10) / METERS_PER_DEGREE }),
    }));

    const matcherInput = toMatcherRidePoints(sourcePoints);
    assert.equal(matcherInput.length, 10, "the non-GPS point must be filtered out");

    // 5m corridor forces isAtEnd to trigger only at the literal last point (100m) -- with
    // the default 30m corridor, points as early as 70m already qualify on their own, so
    // the match could complete before the array's actual end (not what this test isolates).
    const [candidate] = matchSegment(matcherInput, {
      id: "gap-segment",
      corridorMeters: 5,
      requiredCoveragePct: 0.9,
      referencePolyline: Array.from({ length: 11 }, (_, index) => ({
        lat: 0,
        lng: (index * 10) / METERS_PER_DEGREE,
        distanceMeters: index * 10,
      })),
    });
    assert.equal(candidate.decision, "accept");
    assert.equal(candidate.startPointIndex, 0);
    assert.equal(candidate.endPointIndex, 10);

    // Import stores every parsed point, GPS or not -- point_index 5 exists with NULL
    // lat/longitude, exactly as a real batch import would write it.
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    database.exec(`
      INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
      VALUES ('file-gap', '${"b".repeat(64)}', 'gap-ride.fit', ${NOW});
      INSERT INTO rides (
        id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
        created_at_ms, updated_at_ms
      ) VALUES ('ride-gap', 'file-gap', 1, ${NOW}, ${NOW + 10_000}, ${NOW}, ${NOW});
      INSERT INTO segments (
        id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms
      ) VALUES ('segment-gap', 'Gap segment', 30, 0.9, 1, 'gap-fingerprint', ${NOW});
    `);
    const insertPoint = database.prepare(`
      INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude)
      VALUES ('ride-gap', ?, ?, ?, ?)
    `);
    sourcePoints.forEach((point, index) => {
      insertPoint.run(index, point.timestampMs, point.lat ?? null, point.lng ?? null);
    });

    const result = persistMatchCandidate(database, candidate, {
      attemptId: "attempt-gap",
      segmentId: "segment-gap",
      rideId: "ride-gap",
      createdAtMs: NOW + 20_000,
    });
    assert.deepEqual(result, { status: "inserted", attemptId: "attempt-gap" });

    const stored = database.prepare(`
      SELECT start_point_index, end_point_index, start_timestamp_ms, end_timestamp_ms
      FROM segment_attempts WHERE id = 'attempt-gap'
    `).get();
    assert.deepEqual({ ...stored }, {
      start_point_index: 0,
      end_point_index: 10,
      // Read from ride_points at point_index 0 and 10 -- not the filtered array's own
      // first/last positions, which would incorrectly resolve to point_index 0 and 9.
      start_timestamp_ms: NOW,
      end_timestamp_ms: NOW + 10_000,
    });
  });
});

function createDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  database.exec(`
    INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
    VALUES ('file-1', '${"a".repeat(64)}', 'ride.fit', ${NOW});
    INSERT INTO rides (
      id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
      created_at_ms, updated_at_ms
    ) VALUES ('ride-1', 'file-1', 1, ${NOW}, ${NOW + 4_000}, ${NOW}, ${NOW});
    INSERT INTO segments (
      id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms
    ) VALUES ('segment-1', 'Test segment', 30, 0.9, 1, 'segment-fingerprint', ${NOW});
  `);
  const insertPoint = database.prepare(`
    INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude)
    VALUES ('ride-1', ?, ?, 0, ?)
  `);
  for (let index = 0; index <= 100; index += 1) {
    insertPoint.run(index, NOW + index * 1_000, index / 100_000);
  }
  return database;
}

function matchCandidate(
  decision: MatchDecision,
  overrides: Partial<MatchCandidate> = {},
): MatchCandidate {
  return {
    decision,
    startPointIndex: 1,
    endPointIndex: 3,
    coveragePct: 1,
    maxBackwardMeters: 2,
    maxGapMs: 1_000,
    gpsGapCount: 0,
    maxDeviationMeters: 8,
    medianDeviationMeters: 3,
    confidenceScore: 0.95,
    matcherVersion: MATCHER_VERSION,
    reasons: decision === "reject" ? ["different-route"] : [],
    ...overrides,
  };
}

function context(attemptId: string) {
  return {
    attemptId,
    segmentId: "segment-1",
    rideId: "ride-1",
    createdAtMs: NOW + 10_000,
  };
}

function contextFor(attemptId: string, startPointIndex: number, endPointIndex: number) {
  return {
    attemptId,
    segmentId: "segment-1",
    rideId: "ride-1",
    startTimestampMs: NOW + startPointIndex * 1_000,
    endTimestampMs: NOW + endPointIndex * 1_000,
    createdAtMs: NOW + 200_000,
  };
}

function count(database: DatabaseSync, table: string): number {
  return Number(database.prepare(`SELECT count(*) AS count FROM ${table}`).get()?.count);
}

const METERS_PER_DEGREE = 111_195;

function knownSegment(): SegmentDefinition {
  return {
    id: "known-segment",
    corridorMeters: 30,
    requiredCoveragePct: 0.9,
    referencePolyline: [0, 25, 50, 75, 100].map((meters) => ({
      lat: 0,
      lng: meters / METERS_PER_DEGREE,
      distanceMeters: meters,
    })),
  };
}

function knownDeviationRide() {
  return [0, 25, 50, 75, 100].map((xMeters, index) => ({
    lat: [0, 10, 20, 10, 0][index] / METERS_PER_DEGREE,
    lng: xMeters / METERS_PER_DEGREE,
    timestampMs: NOW + index * 1_000,
  }));
}
