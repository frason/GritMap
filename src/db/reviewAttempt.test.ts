import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { confirmAttempt, rejectAttempt } from "./reviewAttempt.ts";

const NOW = 1_700_000_000_000;

describe("confirmAttempt / rejectAttempt", () => {
  it("confirmAttempt sets decision to accept and marks it manually approved", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedAttempt(database, "borderline");

    confirmAttempt(database, "attempt-1");

    assert.deepEqual(
      { ...database.prepare("SELECT decision, manually_approved FROM segment_attempts WHERE id = ?").get("attempt-1") },
      { decision: "accept", manually_approved: 1 },
    );
  });

  it("rejectAttempt deletes the attempt and cascades its diagnostics", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedAttempt(database, "borderline");

    rejectAttempt(database, "attempt-1");

    assert.equal(
      database.prepare("SELECT count(*) AS count FROM segment_attempts").get()?.count,
      0,
    );
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM match_diagnostics").get()?.count,
      0,
    );
  });

  it("rejectAttempt leaves the ride and segment intact", () => {
    using database = new DatabaseSync(":memory:");
    applyMigrations(database);
    seedAttempt(database, "borderline");

    rejectAttempt(database, "attempt-1");

    assert.ok(database.prepare("SELECT 1 FROM rides WHERE id = 'ride-1'").get());
    assert.ok(database.prepare("SELECT 1 FROM segments WHERE id = 'segment-1'").get());
  });
});

function seedAttempt(database: DatabaseSync, decision: "accept" | "borderline"): void {
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
  database
    .prepare(
      `INSERT INTO match_diagnostics (
        attempt_id, coverage_pct, max_deviation_meters, median_deviation_meters,
        max_backward_meters, max_gap_ms, gps_gap_count, confidence_score, reasons_json,
        created_at_ms
      ) VALUES ('attempt-1', 0.85, 12, 4, 3, 31000, 1, 0.6, '[]', ?)`,
    )
    .run(NOW);
}
