import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { listAttemptsForRide } from "./listAttemptsForRide.ts";

const NOW = 1_700_000_000_000;

describe("listAttemptsForRide", () => {
  it("lists every attempt for a ride, newest first, joined to the segment's name", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRideAndSegments(database);

    insertAttempt(database, "attempt-1", "segment-1", { startTimestampMs: NOW, decision: "accept" });
    insertAttempt(database, "attempt-2", "segment-2", {
      startTimestampMs: NOW + 10_000,
      decision: "borderline",
      confidenceScore: 0.6,
    });

    const attempts = listAttemptsForRide(database, "ride-1");

    assert.deepEqual(
      attempts.map((a) => a.attemptId),
      ["attempt-2", "attempt-1"],
    );
    assert.deepEqual(attempts[0], {
      attemptId: "attempt-2",
      segmentId: "segment-2",
      segmentName: "Second Climb",
      startTimestampMs: NOW + 10_000,
      endTimestampMs: NOW + 20_000,
      decision: "borderline",
      confidenceScore: 0.6,
      manuallyApproved: false,
    });
  });

  it("returns an empty array for a ride with no detected traversals", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRideAndSegments(database);

    assert.deepEqual(listAttemptsForRide(database, "ride-1"), []);
  });

  it("does not include another ride's attempts", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRideAndSegments(database);
    database.exec(`
      INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
      VALUES ('file-2', '${"b".repeat(64)}', 'other.fit', ${NOW});
      INSERT INTO rides (
        id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
        created_at_ms, updated_at_ms
      ) VALUES ('ride-2', 'file-2', 1, ${NOW}, ${NOW + 30_000}, ${NOW}, ${NOW});
    `);
    const insertPoint = database.prepare(
      `INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude)
       VALUES ('ride-2', ?, ?, 0, 0)`,
    );
    for (let index = 0; index <= 30; index += 1) insertPoint.run(index, NOW + index * 1_000);
    insertAttempt(database, "attempt-other-ride", "segment-1", {
      startTimestampMs: NOW,
      decision: "accept",
      rideId: "ride-2",
    });

    assert.deepEqual(listAttemptsForRide(database, "ride-1"), []);
  });
});

function seedRideAndSegments(database: DatabaseSync): void {
  database.exec(`
    INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
    VALUES ('file-1', '${"a".repeat(64)}', 'ride.fit', ${NOW});
    INSERT INTO rides (
      id, imported_file_id, parser_version, start_timestamp_ms, end_timestamp_ms,
      created_at_ms, updated_at_ms
    ) VALUES ('ride-1', 'file-1', 1, ${NOW}, ${NOW + 30_000}, ${NOW}, ${NOW});
    INSERT INTO segments (
      id, name, corridor_meters, required_coverage, schema_version, fingerprint, created_at_ms
    ) VALUES
      ('segment-1', 'First Climb', 30, 0.9, 1, 'fingerprint-1', ${NOW}),
      ('segment-2', 'Second Climb', 30, 0.9, 1, 'fingerprint-2', ${NOW});
  `);
  const insertPoint = database.prepare(
    `INSERT INTO ride_points (ride_id, point_index, timestamp_ms, latitude, longitude)
     VALUES ('ride-1', ?, ?, 0, 0)`,
  );
  for (let index = 0; index <= 30; index += 1) insertPoint.run(index, NOW + index * 1_000);
}

function insertAttempt(
  database: DatabaseSync,
  attemptId: string,
  segmentId: string,
  overrides: {
    startTimestampMs: number;
    decision: "accept" | "borderline";
    confidenceScore?: number;
    rideId?: string;
  },
): void {
  const rideId = overrides.rideId ?? "ride-1";
  database
    .prepare(
      `INSERT INTO segment_attempts (
        id, segment_id, ride_id, start_point_index, end_point_index,
        start_timestamp_ms, end_timestamp_ms, matcher_version, confidence_score, decision,
        manually_approved, created_at_ms
      ) VALUES (?, ?, ?, 0, 10, ?, ?, 2, ?, ?, 0, ?)`,
    )
    .run(
      attemptId,
      segmentId,
      rideId,
      overrides.startTimestampMs,
      overrides.startTimestampMs + 10_000,
      overrides.confidenceScore ?? 0.95,
      overrides.decision,
      overrides.startTimestampMs,
    );
  database
    .prepare(
      `INSERT INTO match_diagnostics (
        attempt_id, coverage_pct, max_deviation_meters, median_deviation_meters,
        max_backward_meters, max_gap_ms, gps_gap_count, confidence_score, reasons_json,
        created_at_ms
      ) VALUES (?, 1, 5, 2, 0, 0, 0, ?, '[]', ?)`,
    )
    .run(attemptId, overrides.confidenceScore ?? 0.95, overrides.startTimestampMs);
}
