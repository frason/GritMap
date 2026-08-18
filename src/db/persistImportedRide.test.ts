import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { insertImportedRide, replaceImportedRide } from "./persistImportedRide.ts";
import type { SyncDatabase } from "./types.ts";
import type { ParsedPoint } from "../fit/parseFitFile.ts";

/** Adapts node:sqlite's DatabaseSync to SyncDatabase for tests -- mirrors toSyncDatabase.ts's
 * shape, but node:sqlite statements are safely reusable across calls with no manual finalize. */
function toTestSyncDatabase(database: DatabaseSync): SyncDatabase {
  return {
    exec: (sql) => database.exec(sql),
    prepare: (sql) => {
      const statement = database.prepare(sql);
      return {
        get: (...params) => statement.get(...(params as never[])),
        run: (...params) => statement.run(...(params as never[])),
        all: (...params) => statement.all(...(params as never[])),
      };
    },
    runMany: (sql, paramsList) => {
      const statement = database.prepare(sql);
      for (const params of paramsList) statement.run(...(params as never[]));
    },
  };
}

function migratedDatabase(): SyncDatabase {
  const raw = new DatabaseSync(":memory:");
  const database = toTestSyncDatabase(raw);
  applyMigrations(database);
  return database;
}

function sequentialIdFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(n += 1)}`;
}

function points(...entries: Array<Partial<ParsedPoint> & { timestampMs: number }>): ParsedPoint[] {
  return entries as ParsedPoint[];
}

function baseParams(overrides: Partial<Parameters<typeof insertImportedRide>[2]> = {}) {
  return {
    contentHash: "a".repeat(64),
    originalFilename: "ride.fit",
    retainedFileUri: "file:///fit-imports/ride.fit",
    fileSizeBytes: 12_345,
    points: points(
      { timestampMs: 1_000, distanceMeters: 0, elevationMeters: 100 },
      { timestampMs: 2_000, distanceMeters: 50, elevationMeters: 110 },
      { timestampMs: 3_000, distanceMeters: 120, elevationMeters: 105 },
    ),
    parserVersion: 1,
    deviceMetadataJson: "{}",
    startTimestampMs: 1_000,
    durationMs: 2_000,
    nowMs: 10_000,
    ...overrides,
  };
}

describe("insertImportedRide", () => {
  it("inserts the file, ride, and all points in one transaction", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");

    const result = insertImportedRide(database, generateId, baseParams());
    assert.equal(result.rideId, "id-2");

    const ride = database
      .prepare(
        `SELECT total_distance_meters, total_ascent_meters, end_timestamp_ms,
                start_timestamp_ms, duration_ms
         FROM rides WHERE id = ?`,
      )
      .get(result.rideId) as Record<string, number>;
    // Last present distance sample = 120. Ascent = (110-100) + max(0, 105-110) = 10.
    assert.equal(ride.total_distance_meters, 120);
    assert.equal(ride.total_ascent_meters, 10);
    assert.equal(ride.end_timestamp_ms, 3_000); // start (1000) + duration (2000)

    const pointCount = (
      database.prepare("SELECT count(*) AS n FROM ride_points WHERE ride_id = ?").get(
        result.rideId,
      ) as { n: number }
    ).n;
    assert.equal(pointCount, 3);
  });

  it("treats an all-missing-elevation ride as an absent (not zero) ascent", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");

    const result = insertImportedRide(
      database,
      generateId,
      baseParams({
        points: points({ timestampMs: 1_000 }, { timestampMs: 2_000 }),
      }),
    );

    const ride = database
      .prepare("SELECT total_distance_meters, total_ascent_meters FROM rides WHERE id = ?")
      .get(result.rideId) as Record<string, number | null>;
    assert.equal(ride.total_distance_meters, null);
    assert.equal(ride.total_ascent_meters, null);
  });

  it("does not let an elevation gap fabricate a jump across missing samples", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");

    // 100 -> (gap) -> 200: no delta should be attributed across the gap.
    const result = insertImportedRide(
      database,
      generateId,
      baseParams({
        points: points(
          { timestampMs: 1_000, elevationMeters: 100 },
          { timestampMs: 2_000 },
          { timestampMs: 3_000, elevationMeters: 200 },
        ),
      }),
    );

    const ride = database
      .prepare("SELECT total_ascent_meters FROM rides WHERE id = ?")
      .get(result.rideId) as { total_ascent_meters: number };
    assert.equal(ride.total_ascent_meters, 0);
  });

  it("rolls back entirely if any statement in the transaction fails", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");

    assert.throws(() =>
      insertImportedRide(
        database,
        generateId,
        baseParams({ contentHash: "too-short" }), // violates the sha256 length CHECK
      ),
    );

    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM imported_files").get() as { n: number }).n,
      0,
    );
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      0,
    );
  });
});

describe("replaceImportedRide", () => {
  it("preserves rides.id while replacing file, content, points, and summary columns", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    const { rideId } = insertImportedRide(database, generateId, baseParams());

    const result = replaceImportedRide(
      database,
      rideId,
      baseParams({
        contentHash: "b".repeat(64),
        originalFilename: "replacement.fit",
        retainedFileUri: "file:///fit-imports/replacement.fit",
        points: points(
          { timestampMs: 5_000, distanceMeters: 0, elevationMeters: 50 },
          { timestampMs: 6_000, distanceMeters: 999, elevationMeters: 60 },
        ),
        startTimestampMs: 5_000,
        durationMs: 1_000,
        nowMs: 20_000,
      }),
    );

    assert.equal(result.previousRetainedFileUri, "file:///fit-imports/ride.fit");

    const row = database
      .prepare(
        `SELECT rides.id, imported_files.original_filename,
                imported_files.retained_file_uri, rides.total_distance_meters,
                rides.total_ascent_meters, rides.start_timestamp_ms, rides.duration_ms
         FROM rides JOIN imported_files ON imported_files.id = rides.imported_file_id
         WHERE rides.id = ?`,
      )
      .get(rideId) as Record<string, unknown>;
    assert.equal(row.id, rideId); // id preserved, not regenerated
    assert.equal(row.original_filename, "replacement.fit");
    assert.equal(row.retained_file_uri, "file:///fit-imports/replacement.fit");
    assert.equal(row.total_distance_meters, 999);
    assert.equal(row.total_ascent_meters, 10);

    const pointCount = (
      database.prepare("SELECT count(*) AS n FROM ride_points WHERE ride_id = ?").get(rideId) as {
        n: number;
      }
    ).n;
    assert.equal(pointCount, 2); // old 3 points replaced with new 2, not accumulated to 5
  });

  it("cascade-clears segment_attempts/match_diagnostics tied to the replaced points", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    const { rideId } = insertImportedRide(database, generateId, baseParams());

    database
      .prepare(
        `INSERT INTO segments (
          id, name, corridor_meters, required_coverage, schema_version, fingerprint,
          created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("segment-1", "Test Segment", 30, 0.9, 1, "fp-1", 1_000);
    database
      .prepare(
        `INSERT INTO segment_attempts (
          id, segment_id, ride_id, start_point_index, end_point_index,
          start_timestamp_ms, end_timestamp_ms, matcher_version, confidence_score,
          decision, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("attempt-1", "segment-1", rideId, 0, 1, 1_000, 2_000, 1, 0.95, "accept", 1_000);
    database
      .prepare(
        `INSERT INTO match_diagnostics (
          attempt_id, coverage_pct, max_deviation_meters, max_backward_meters,
          max_gap_ms, confidence_score, created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("attempt-1", 0.95, 2, 0, 0, 0.95, 1_000);

    replaceImportedRide(database, rideId, baseParams({ nowMs: 20_000 }));

    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM segment_attempts").get() as { n: number }).n,
      0,
    );
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM match_diagnostics").get() as { n: number }).n,
      0,
    );
    // The segment itself is untouched -- only attempts/diagnostics tied to the old points.
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM segments").get() as { n: number }).n,
      1,
    );
  });

  it("throws for a ride id that doesn't exist, without touching the database", () => {
    const database = migratedDatabase();
    assert.throws(
      () => replaceImportedRide(database, "no-such-ride", baseParams()),
      /no such ride/,
    );
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      0,
    );
  });
});
