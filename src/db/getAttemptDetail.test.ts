import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getAttemptDetail } from "./getAttemptDetail.ts";

const NOW = 1_700_000_000_000;

describe("getAttemptDetail", () => {
  it("reads every diagnostic field for a borderline attempt", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedFixture(database, "borderline", ["gps-gap"]);

    const detail = getAttemptDetail(database, "attempt-1");

    assert.deepEqual(detail, {
      attemptId: "attempt-1",
      segmentId: "segment-1",
      rideId: "ride-1",
      rideOriginalFilename: "ride.fit",
      startPointIndex: 2,
      endPointIndex: 8,
      startTimestampMs: NOW + 2_000,
      endTimestampMs: NOW + 8_000,
      matcherVersion: 2,
      decision: "borderline",
      manuallyApproved: false,
      coveragePct: 0.85,
      maxDeviationMeters: 12,
      medianDeviationMeters: 4,
      maxBackwardMeters: 3,
      maxGapMs: 31_000,
      gpsGapCount: 1,
      confidenceScore: 0.6,
      reasons: ["gps-gap"],
    });
  });

  it("omits medianDeviationMeters when it is null in storage", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedFixture(database, "accept", [], { medianDeviationMeters: null });

    const detail = getAttemptDetail(database, "attempt-1");

    assert.equal(detail?.medianDeviationMeters, undefined);
    assert.equal("medianDeviationMeters" in detail!, false);
  });

  it("returns undefined for an unknown attempt id", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);

    assert.equal(getAttemptDetail(database, "missing"), undefined);
  });
});

function seedFixture(
  database: DatabaseSync,
  decision: "accept" | "borderline",
  reasons: string[],
  overrides: { medianDeviationMeters?: number | null } = {},
): void {
  database.exec(`
    INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
    VALUES ('file-1', '${"a".repeat(64)}', 'ride.fit', ${NOW});
    INSERT INTO rides (
      id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
      created_at_ms, updated_at_ms
    ) VALUES ('ride-1', 'file-1', 1, ${NOW}, ${NOW + 30_000}, ${NOW}, ${NOW});
    INSERT INTO segments (
      id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms
    ) VALUES ('segment-1', 'Test segment', 30, 0.9, 1, 'fingerprint', ${NOW});
  `);
  const insertPoint = database.prepare(
    `INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude)
     VALUES ('ride-1', ?, ?, 0, 0)`,
  );
  for (let index = 0; index <= 10; index += 1) {
    insertPoint.run(index, NOW + index * 1_000);
  }

  database
    .prepare(
      `INSERT INTO segment_attempts (
        id, segment_id, ride_id, start_point_index, end_point_index,
        start_timestamp_ms, end_timestamp_ms, matcher_version, confidence_score, decision,
        manually_approved, created_at_ms
      ) VALUES ('attempt-1', 'segment-1', 'ride-1', 2, 8, ?, ?, 2, 0.6, ?, 0, ?)`,
    )
    .run(NOW + 2_000, NOW + 8_000, decision, NOW);

  const medianDeviationMeters =
    overrides.medianDeviationMeters === undefined ? 4 : overrides.medianDeviationMeters;
  database
    .prepare(
      `INSERT INTO match_diagnostics (
        attempt_id, coverage_pct, max_deviation_meters, median_deviation_meters,
        max_backward_meters, max_gap_ms, gps_gap_count, confidence_score, reasons_json,
        created_at_ms
      ) VALUES ('attempt-1', 0.85, 12, ?, 3, 31000, 1, 0.6, ?, ?)`,
    )
    .run(medianDeviationMeters, JSON.stringify(reasons), NOW);
}
