import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { insertSegment, type InsertSegmentParams } from "./insertSegment.ts";
import type { SyncDatabase } from "./types.ts";

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

function migratedDatabase(): { raw: DatabaseSync; database: SyncDatabase } {
  const raw = new DatabaseSync(":memory:");
  const database = toTestSyncDatabase(raw);
  applyMigrations(database);
  return { raw, database };
}

function insertSourceRide(raw: DatabaseSync, rideId = "ride-1"): void {
  raw
    .prepare(
      `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
       VALUES (?, ?, ?, ?)`,
    )
    .run(`file-${rideId}`, `file-${rideId}`.padEnd(64, "0").slice(0, 64), `${rideId}.fit`, 1_000);
  raw
    .prepare(
      `INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms)
       VALUES (?, ?, 1, 1000, 1000)`,
    )
    .run(rideId, `file-${rideId}`);
}

function sequentialIdFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(n += 1)}`;
}

function baseParams(overrides: Partial<InsertSegmentParams> = {}): InsertSegmentParams {
  return {
    name: "Local Wall",
    corridorMeters: 30,
    requiredCoveragePct: 0.9,
    schemaVersion: 1,
    fingerprint: "abc123",
    referencePolyline: [
      { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
      { lat: 37.001, lng: -122.0, distanceMeters: 111, elevationMeters: 20 },
    ],
    sourceRideId: "ride-1",
    sourceStartPointIndex: 0,
    sourceEndPointIndex: 5,
    nowMs: 2_000,
    ...overrides,
  };
}

describe("insertSegment", () => {
  it("inserts a segment and its reference points in one transaction", () => {
    const { raw, database } = migratedDatabase();
    insertSourceRide(raw);

    const { segmentId } = insertSegment(database, sequentialIdFactory("segment"), baseParams());

    assert.equal(segmentId, "segment-1");
    assert.deepEqual({ ...raw.prepare("SELECT * FROM segments WHERE id = ?").get(segmentId) }, {
      id: "segment-1",
      name: "Local Wall",
      corridor_meters: 30,
      required_coverage: 0.9,
      schema_version: 1,
      fingerprint: "abc123",
      source_ride_id: "ride-1",
      source_start_point_index: 0,
      source_end_point_index: 5,
      created_at_ms: 2_000,
    });
    const points = raw
      .prepare("SELECT * FROM segment_reference_points WHERE segment_id = ? ORDER BY point_index")
      .all(segmentId);
    assert.equal(points.length, 2);
    assert.deepEqual({ ...points[0] }, {
      segment_id: "segment-1",
      point_index: 0,
      latitude: 37.0,
      longitude: -122.0,
      distance_meters: 0,
      elevation_meters: 10,
    });
  });

  it("omits elevation_meters as NULL, not a fabricated value, when the point lacks it", () => {
    const { raw, database } = migratedDatabase();
    insertSourceRide(raw);

    const { segmentId } = insertSegment(
      database,
      sequentialIdFactory("segment"),
      baseParams({
        referencePolyline: [
          { lat: 37.0, lng: -122.0, distanceMeters: 0 },
          { lat: 37.001, lng: -122.0, distanceMeters: 111 },
        ],
      }),
    );

    const point = raw
      .prepare("SELECT elevation_meters FROM segment_reference_points WHERE segment_id = ? AND point_index = 0")
      .get(segmentId) as { elevation_meters: unknown };
    assert.equal(point.elevation_meters, null);
  });

  it("deletes cascade to reference points, per the segments FK", () => {
    const { raw, database } = migratedDatabase();
    insertSourceRide(raw);
    const { segmentId } = insertSegment(database, sequentialIdFactory("segment"), baseParams());

    raw.prepare("DELETE FROM segments WHERE id = ?").run(segmentId);

    const remaining = raw
      .prepare("SELECT count(*) AS count FROM segment_reference_points WHERE segment_id = ?")
      .get(segmentId) as { count: number };
    assert.equal(remaining.count, 0);
  });

  for (const [description, overrides] of [
    ["fewer than 2 reference points", { referencePolyline: [{ lat: 0, lng: 0, distanceMeters: 0 }] }],
    [
      "first point not at distance 0",
      {
        referencePolyline: [
          { lat: 0, lng: 0, distanceMeters: 5 },
          { lat: 0, lng: 0.001, distanceMeters: 111 },
        ],
      },
    ],
    [
      "non-increasing distances",
      {
        referencePolyline: [
          { lat: 0, lng: 0, distanceMeters: 0 },
          { lat: 0, lng: 0.001, distanceMeters: 0 },
        ],
      },
    ],
    [
      "out-of-range latitude",
      {
        referencePolyline: [
          { lat: 91, lng: 0, distanceMeters: 0 },
          { lat: 0, lng: 0.001, distanceMeters: 111 },
        ],
      },
    ],
    [
      "out-of-range longitude",
      {
        referencePolyline: [
          { lat: 0, lng: -181, distanceMeters: 0 },
          { lat: 0, lng: 0.001, distanceMeters: 111 },
        ],
      },
    ],
    [
      "non-finite elevation",
      {
        referencePolyline: [
          { lat: 0, lng: 0, distanceMeters: 0, elevationMeters: Number.NaN },
          { lat: 0, lng: 0.001, distanceMeters: 111 },
        ],
      },
    ],
    ["sourceStartPointIndex >= sourceEndPointIndex", { sourceStartPointIndex: 5, sourceEndPointIndex: 5 }],
    ["negative sourceStartPointIndex", { sourceStartPointIndex: -1, sourceEndPointIndex: 5 }],
  ] as const) {
    it(`rejects ${description}`, () => {
      const { raw, database } = migratedDatabase();
      insertSourceRide(raw);
      assert.throws(() =>
        insertSegment(database, sequentialIdFactory("segment"), baseParams(overrides as Partial<InsertSegmentParams>)),
      );
      assert.equal(
        (raw.prepare("SELECT count(*) AS count FROM segments").get() as { count: number }).count,
        0,
      );
    });
  }

  it("rolls back the whole transaction, including the already-inserted segments row, when the reference-point batch fails", () => {
    const execCalls: string[] = [];
    const fakeDatabase: SyncDatabase = {
      exec: (sql) => {
        execCalls.push(sql);
      },
      prepare: () => ({
        get: () => undefined,
        run: () => undefined,
        all: () => [],
      }),
      runMany: () => {
        throw new Error("simulated mid-batch failure");
      },
    };

    assert.throws(
      () => insertSegment(fakeDatabase, sequentialIdFactory("segment"), baseParams()),
      /simulated mid-batch failure/,
    );
    assert.deepEqual(execCalls, ["BEGIN IMMEDIATE", "ROLLBACK"]);
  });
});
