import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { listAttemptsForSegment } from "./listAttemptsForSegment.ts";

const NOW = 1_700_000_000_000;

describe("listAttemptsForSegment", () => {
  it("lists every attempt for a segment, newest first, joined to the ride's filename", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRideAndSegment(database);

    insertAttempt(database, "attempt-1", { startTimestampMs: NOW, decision: "accept" });
    insertAttempt(database, "attempt-2", {
      startTimestampMs: NOW + 10_000,
      decision: "borderline",
      confidenceScore: 0.6,
    });

    const attempts = listAttemptsForSegment(database, "segment-1");

    assert.deepEqual(
      attempts.map((a) => a.attemptId),
      ["attempt-2", "attempt-1"],
    );
    assert.deepEqual(attempts[0], {
      attemptId: "attempt-2",
      rideId: "ride-1",
      rideOriginalFilename: "ride.fit",
      startTimestampMs: NOW + 10_000,
      endTimestampMs: NOW + 20_000,
      decision: "borderline",
      confidenceScore: 0.6,
      manuallyApproved: false,
    });
  });

  it("returns an empty array for a segment with no attempts", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRideAndSegment(database);

    assert.deepEqual(listAttemptsForSegment(database, "segment-1"), []);
  });

  it("reports manuallyApproved as a real boolean", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedRideAndSegment(database);
    insertAttempt(database, "attempt-1", { startTimestampMs: NOW, decision: "accept" });
    database.prepare("UPDATE segment_attempts SET manually_approved = 1 WHERE id = ?").run(
      "attempt-1",
    );

    assert.equal(listAttemptsForSegment(database, "segment-1")[0]?.manuallyApproved, true);
  });
});

function seedRideAndSegment(database: DatabaseSync): void {
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
  for (let index = 0; index <= 30; index += 1) {
    insertPoint.run(index, NOW + index * 1_000);
  }
}

function insertAttempt(
  database: DatabaseSync,
  attemptId: string,
  overrides: { startTimestampMs: number; decision: "accept" | "borderline"; confidenceScore?: number },
): void {
  database
    .prepare(
      `INSERT INTO segment_attempts (
        id, segment_id, ride_id, start_point_index, end_point_index,
        start_timestamp_ms, end_timestamp_ms, matcher_version, confidence_score, decision,
        manually_approved, created_at_ms
      ) VALUES (?, 'segment-1', 'ride-1', 0, 10, ?, ?, 2, ?, ?, 0, ?)`,
    )
    .run(
      attemptId,
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
