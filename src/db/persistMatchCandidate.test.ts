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
             matcher_version, confidence_score, decision, manually_approved
      FROM segment_attempts WHERE id = ?
    `).get("attempt-accept") }, {
      segment_id: "segment-1",
      ride_id: "ride-1",
      start_point_index: 1,
      end_point_index: 3,
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
    const duplicate = persistMatchCandidate(
      database,
      candidate,
      context("attempt-rescan"),
    );

    assert.deepEqual(duplicate, { status: "duplicate", attemptId: "attempt-first" });
    assert.equal(count(database, "segment_attempts"), 1);
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
  for (let index = 0; index < 5; index += 1) {
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
    startTimestampMs: NOW + 1_000,
    endTimestampMs: NOW + 3_000,
    createdAtMs: NOW + 10_000,
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
