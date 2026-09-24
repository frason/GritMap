import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { createHash } from "node:crypto";

import { applyMigrations } from "../db/migrations.ts";
import type { SyncDatabase } from "../db/types.ts";
import { importRideFile, type ImportRideFileInput } from "./importRideFile.ts";

const FIXTURE_A = "fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit";
const FIXTURE_B = "fixtures/fit/Karoo-Morning_Ride-2026-08-09-0844.fit";
const GPX_FIXTURE = "fixtures/gpx/Tilden_Inspiration_1_5_Bears_turnaround_repeat.gpx";

/** Mirrors toSyncDatabase.ts's shape; node:sqlite statements don't need manual finalization. */
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
  const database = toTestSyncDatabase(new DatabaseSync(":memory:"));
  applyMigrations(database);
  return database;
}

function sequentialIdFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(n += 1)}`;
}

function hashOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function inputFor(path: string, overrides: Partial<ImportRideFileInput> = {}): ImportRideFileInput {
  const bytes = new Uint8Array(readFileSync(path));
  return {
    bytes,
    filename: path.split("/").pop() ?? path,
    contentHash: hashOf(bytes),
    retainedFileUri: `file:///fit-imports/${path.split("/").pop()}`,
    fileSizeBytes: bytes.byteLength,
    nowMs: 1_000,
    ...overrides,
  };
}

describe("importRideFile", () => {
  it("imports a fresh real Karoo fixture end to end", () => {
    const database = migratedDatabase();
    const result = importRideFile(database, sequentialIdFactory("id"), inputFor(FIXTURE_A));

    assert.equal(result.status, "imported");
    if (result.status !== "imported") return;

    const ride = database
      .prepare("SELECT total_distance_meters, duration_ms FROM rides WHERE id = ?")
      .get(result.rideId) as { total_distance_meters: number; duration_ms: number };
    assert.equal(ride.duration_ms, 11_458_000);
    assert.ok(ride.total_distance_meters > 0);
  });

  it("detects a re-import of the same bytes as a content-hash duplicate, without writing", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    importRideFile(database, generateId, inputFor(FIXTURE_A));

    const result = importRideFile(database, generateId, inputFor(FIXTURE_A));
    assert.equal(result.status, "duplicate");
    if (result.status !== "duplicate") return;
    assert.equal(result.matchedRule, "content-hash");

    const rideCount = (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number })
      .n;
    assert.equal(rideCount, 1); // the duplicate re-import wrote nothing
  });

  it("'keep' resolution leaves the existing ride untouched and writes nothing new", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    const first = importRideFile(database, generateId, inputFor(FIXTURE_A));
    assert.equal(first.status, "imported");

    const result = importRideFile(database, generateId, inputFor(FIXTURE_A), "keep");
    assert.equal(result.status, "duplicate-kept");

    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      1,
    );
  });

  it("'replace' resolution updates the existing ride and returns the superseded file URI", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    const first = importRideFile(
      database,
      generateId,
      inputFor(FIXTURE_A, { retainedFileUri: "file:///fit-imports/original.fit" }),
    );
    assert.equal(first.status, "imported");
    if (first.status !== "imported") return;

    const result = importRideFile(
      database,
      generateId,
      inputFor(FIXTURE_A, { retainedFileUri: "file:///fit-imports/replacement.fit", nowMs: 2_000 }),
      "replace",
    );

    assert.equal(result.status, "replaced");
    if (result.status !== "replaced") return;
    assert.equal(result.rideId, first.rideId); // same ride id, not a new one
    assert.equal(result.previousRetainedFileUri, "file:///fit-imports/original.fit");

    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      1, // still exactly one ride -- updated in place, not duplicated
    );
  });

  it("returns 'failed' for bytes that aren't a valid FIT or GPX file, without writing", () => {
    const database = migratedDatabase();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const result = importRideFile(database, sequentialIdFactory("id"), {
      bytes,
      filename: "not-a-fit-file.fit",
      contentHash: hashOf(bytes),
      retainedFileUri: "file:///fit-imports/bad.fit",
      fileSizeBytes: bytes.byteLength,
      nowMs: 1_000,
    });

    assert.equal(result.status, "failed");
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      0,
    );
  });

  it("a failed file in a batch does not block or roll back files already imported", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    const badBytes = new Uint8Array([9, 9, 9]);

    const results = [
      importRideFile(database, generateId, inputFor(FIXTURE_A)),
      importRideFile(database, generateId, {
        bytes: badBytes,
        filename: "corrupt.fit",
        contentHash: hashOf(badBytes),
        retainedFileUri: "file:///fit-imports/corrupt.fit",
        fileSizeBytes: badBytes.byteLength,
        nowMs: 1_000,
      }),
      importRideFile(database, generateId, inputFor(FIXTURE_B)),
    ];

    assert.deepEqual(
      results.map((r) => r.status),
      ["imported", "failed", "imported"],
    );
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      2,
    );
  });

  it("distinguishes two different real rides as separate, non-duplicate imports", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    const first = importRideFile(database, generateId, inputFor(FIXTURE_A));
    const second = importRideFile(database, generateId, inputFor(FIXTURE_B));

    assert.equal(first.status, "imported");
    assert.equal(second.status, "imported");
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      2,
    );
  });

  it("imports a real GPX file end to end, routed by content not filename", () => {
    const database = migratedDatabase();
    // Filename deliberately says ".fit" -- looksLikeGpx must sniff the real GPX content, not
    // trust the picked filename/extension, since a picker can hand back any name.
    const result = importRideFile(
      database,
      sequentialIdFactory("id"),
      inputFor(GPX_FIXTURE, { filename: "mislabeled.fit" }),
    );

    assert.equal(result.status, "imported");
    if (result.status !== "imported") return;

    const ride = database
      .prepare(
        "SELECT parser_version, total_distance_meters, duration_ms FROM rides WHERE id = ?",
      )
      .get(result.rideId) as {
      parser_version: number;
      total_distance_meters: number;
      duration_ms: number;
    };
    assert.equal(ride.parser_version, 1); // GPX_PARSER_VERSION, not FIT's PARSER_VERSION
    assert.ok(ride.total_distance_meters > 0);
    assert.ok(ride.duration_ms > 0);

    const pointCount = (
      database.prepare("SELECT count(*) AS n FROM ride_points WHERE ride_id = ?").get(
        result.rideId,
      ) as { n: number }
    ).n;
    assert.equal(pointCount, 5_207);
  });

  it("detects a re-import of the same GPX bytes as a content-hash duplicate", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    importRideFile(database, generateId, inputFor(GPX_FIXTURE));

    const result = importRideFile(database, generateId, inputFor(GPX_FIXTURE));
    assert.equal(result.status, "duplicate");
    if (result.status !== "duplicate") return;
    assert.equal(result.matchedRule, "content-hash");
  });

  it("does not confuse a GPX import with an unrelated FIT ride", () => {
    const database = migratedDatabase();
    const generateId = sequentialIdFactory("id");
    const fitResult = importRideFile(database, generateId, inputFor(FIXTURE_A));
    const gpxResult = importRideFile(database, generateId, inputFor(GPX_FIXTURE));

    assert.equal(fitResult.status, "imported");
    assert.equal(gpxResult.status, "imported");
    assert.equal(
      (database.prepare("SELECT count(*) AS n FROM rides").get() as { n: number }).n,
      2,
    );
  });
});
