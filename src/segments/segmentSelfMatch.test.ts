import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";

import { applyMigrations } from "../db/migrations.ts";
import { insertSegment } from "../db/insertSegment.ts";
import { getSegmentDetail } from "../db/getSegmentDetail.ts";
import type { SyncDatabase } from "../db/types.ts";
import { matchSegment, type SegmentDefinition } from "../matcher/matchSegment.ts";
import { toMatcherRidePoints, type SourcePoint } from "../matcher/toMatcherRidePoints.ts";
import { resamplePolyline } from "./resamplePolyline.ts";

const METERS_PER_DEGREE = 111_195;

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

function degrees(meters: number): number {
  return meters / METERS_PER_DEGREE;
}

describe("segment self-match (resample -> insert -> read back from SQLite -> matchSegment)", () => {
  it("accepts a near-100%-coverage traversal of the source ride against its own saved segment", () => {
    const raw = new DatabaseSync(":memory:");
    const database = toTestSyncDatabase(raw);
    applyMigrations(database);

    raw
      .prepare(
        `INSERT INTO imported_files (id, sha256, original_filename, imported_at_ms)
         VALUES ('file-1', ?, 'ride.fit', 1000)`,
      )
      .run("a".repeat(64));
    raw
      .prepare(
        `INSERT INTO rides (id, imported_file_id, parser_version, created_at_ms, updated_at_ms)
         VALUES ('ride-1', 'file-1', 1, 1000, 1000)`,
      )
      .run();

    // A straight 100m line, one GPS point every 10m/1s -- the same proven geometry
    // matchSegment.test.ts's own fixtures use.
    const ridePoints: SourcePoint[] = Array.from({ length: 11 }, (_, index) => ({
      timestampMs: index * 1_000,
      lat: 0,
      lng: degrees(index * 10),
    }));

    const referencePolyline = resamplePolyline(
      ridePoints.map((point) => ({ lat: point.lat!, lng: point.lng! })),
      10,
    );

    const { segmentId } = insertSegment(database, () => "segment-1", {
      name: "Self-match test segment",
      // A 5m corridor forces the matcher to complete only at the literal last point (see
      // matchSegment.test.ts's own note: with the default 30m corridor, points as early as
      // 70m already qualify on their own, so the match could complete before the ride's
      // actual end -- not what this test is isolating).
      corridorMeters: 5,
      requiredCoveragePct: 0.9,
      schemaVersion: 1,
      fingerprint: "self-match-fixture",
      referencePolyline,
      sourceRideId: "ride-1",
      sourceStartPointIndex: 0,
      sourceEndPointIndex: 10,
      nowMs: 2_000,
    });

    // Read back from SQLite -- not the in-memory `referencePolyline` computed above -- so a
    // bug in the round trip through storage/retrieval would actually be caught.
    const readBack = getSegmentDetail(database, segmentId);
    assert.ok(readBack !== undefined);

    const segmentDefinition: SegmentDefinition = {
      id: readBack.segmentId,
      corridorMeters: readBack.corridorMeters,
      requiredCoveragePct: readBack.requiredCoveragePct,
      referencePolyline: readBack.referencePolyline,
    };

    const matcherRide = toMatcherRidePoints(ridePoints);
    const candidates = matchSegment(matcherRide, segmentDefinition);

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.decision, "accept");
    assert.ok(candidates[0]!.coveragePct >= 0.99, `expected near-100% coverage, got ${candidates[0]?.coveragePct}`);
    assert.equal(candidates[0]?.startPointIndex, 0);
    assert.equal(candidates[0]?.endPointIndex, 10);
  });
});
