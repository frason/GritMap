import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "./migrations.ts";
import { getSegmentDetail } from "./getSegmentDetail.ts";

describe("getSegmentDetail", () => {
  it("returns undefined for a missing segment", () => {
    using database = migratedDatabase();
    assert.equal(getSegmentDetail(database, "missing"), undefined);
  });

  it("reads a segment's metadata and reference polyline in point_index order", () => {
    using database = migratedDatabase();
    insertRideAndSegment(database, {
      segmentId: "segment-1",
      rideId: "ride-1",
      points: [
        { pointIndex: 1, lat: 37.001, lng: -122.0, distanceMeters: 111, elevationMeters: 20 },
        { pointIndex: 0, lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
      ],
    });

    const detail = getSegmentDetail(database, "segment-1");
    assert.equal(detail?.name, "Local Wall");
    assert.equal(detail?.corridorMeters, 30);
    assert.equal(detail?.requiredCoveragePct, 0.9);
    assert.equal(detail?.fingerprint, "fp-segment-1");
    assert.equal(detail?.sourceRideId, "ride-1");
    assert.equal(detail?.sourceStartPointIndex, 0);
    assert.equal(detail?.sourceEndPointIndex, 5);
    assert.deepEqual(
      detail?.referencePolyline.map((p) => p.distanceMeters),
      [0, 111],
    );
    assert.equal(detail?.referencePolyline[0]?.elevationMeters, 10);
  });

  it("omits elevationMeters entirely (not as null) on reference points that lack it", () => {
    using database = migratedDatabase();
    insertRideAndSegment(database, {
      segmentId: "segment-no-elev",
      rideId: "ride-1",
      points: [
        { pointIndex: 0, lat: 0, lng: 0, distanceMeters: 0 },
        { pointIndex: 1, lat: 0, lng: 0.001, distanceMeters: 111 },
      ],
    });

    const detail = getSegmentDetail(database, "segment-no-elev");
    assert.ok(!("elevationMeters" in detail!.referencePolyline[0]!));
  });

  it("omits sourceRideId/sourceStartPointIndex/sourceEndPointIndex when absent (portable-imported segment, not from a local ride)", () => {
    using database = migratedDatabase();
    database
      .prepare(
        `INSERT INTO segments (
          id, name, corridor_meters, required_coverage, schema_version, fingerprint,
          created_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run("segment-portable", "Portable", 30, 0.9, 1, "fp-portable", 1_000);
    database
      .prepare(
        `INSERT INTO segment_reference_points (
          segment_id, point_index, latitude, longitude, distance_meters
        ) VALUES (?, ?, ?, ?, ?)`,
      )
      .run("segment-portable", 0, 0, 0, 0);

    const detail = getSegmentDetail(database, "segment-portable");
    assert.ok(!("sourceRideId" in detail!));
    assert.ok(!("sourceStartPointIndex" in detail!));
    assert.ok(!("sourceEndPointIndex" in detail!));
  });
});

function migratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(":memory:");
  applyMigrations(database);
  return database;
}

function insertRideAndSegment(
  database: DatabaseSync,
  args: {
    segmentId: string;
    rideId: string;
    points: { pointIndex: number; lat: number; lng: number; distanceMeters: number; elevationMeters?: number }[];
  },
): void {
  database
    .prepare(
      `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
       VALUES (?, ?, ?, ?)`,
    )
    .run(`file-${args.rideId}`, `file-${args.rideId}`.padEnd(64, "0").slice(0, 64), "r.fit", 1_000);
  database
    .prepare(
      `INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms)
       VALUES (?, ?, 1, 1000, 1000)`,
    )
    .run(args.rideId, `file-${args.rideId}`);
  database
    .prepare(
      `INSERT INTO segments (
        id, name, corridor_meters, required_coverage, schema_version, fingerprint,
        source_ride_id, source_start_point_index, source_end_point_index, created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(args.segmentId, "Local Wall", 30, 0.9, 1, `fp-${args.segmentId}`, args.rideId, 0, 5, 2_000);

  const insertPoint = database.prepare(
    `INSERT INTO segment_reference_points (
      segment_id, point_index, latitude, longitude, distance_meters, elevation_meters
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  for (const point of args.points) {
    insertPoint.run(
      args.segmentId,
      point.pointIndex,
      point.lat,
      point.lng,
      point.distanceMeters,
      point.elevationMeters ?? null,
    );
  }
}
