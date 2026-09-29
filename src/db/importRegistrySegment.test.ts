import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, it, mock } from "node:test";

mock.module("expo-crypto", {
  exports: {
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    async digestStringAsync(_algorithm: string, data: string) {
      return createHash("sha256").update(data, "utf8").digest("hex");
    },
  },
});

const { importRegistrySegment } = await import("./importRegistrySegment.ts");
const { applyMigrations } = await import("./migrations.ts");
const { toPortableSegmentJson } = await import("../segments/toPortableSegmentJson.ts");
import type { SyncDatabase } from "./types.ts";

// Same JVM-verified fixture used by segmentFingerprint.test.ts / fromPortableSegmentJson.test.ts.
const VALID_POLYLINE = [
  { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
  { lat: 37.001, lng: -122.0, distanceMeters: 111, elevationMeters: 20 },
];
const VALID_FINGERPRINT = "c2b8492774847a2117a8a045de50aadecb71b9b98017892da38338809772e615";

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

function validRegistryJson() {
  return toPortableSegmentJson({
    id: "wall",
    name: "Local Wall",
    schemaVersion: 1,
    corridorMeters: 30,
    requiredCoveragePct: 0.9,
    fingerprint: VALID_FINGERPRINT,
    referencePolyline: VALID_POLYLINE,
  });
}

function sequentialIdFactory(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${(n += 1)}`;
}

describe("importRegistrySegment", () => {
  it("imports a valid registry entry with no source ride", async () => {
    const { raw, database } = migratedDatabase();

    const result = await importRegistrySegment(database, sequentialIdFactory("segment"), validRegistryJson(), 5_000);

    assert.deepEqual(result, { status: "imported", segmentId: "segment-1" });
    const row = raw.prepare("SELECT * FROM segments WHERE id = ?").get("segment-1") as Record<string, unknown>;
    assert.equal(row.name, "Local Wall");
    assert.equal(row.fingerprint, VALID_FINGERPRINT);
    assert.equal(row.source_ride_id, null);
  });

  it("reports already-imported (not a duplicate insert or an error) for a fingerprint already present", async () => {
    const { database } = migratedDatabase();
    const first = await importRegistrySegment(database, sequentialIdFactory("segment"), validRegistryJson(), 5_000);
    assert.equal(first.status, "imported");

    const second = await importRegistrySegment(database, sequentialIdFactory("segment"), validRegistryJson(), 6_000);

    assert.deepEqual(second, { status: "already-imported", segmentId: first.status === "imported" ? first.segmentId : "" });
  });

  it("reports invalid input without touching the database", async () => {
    const { raw, database } = migratedDatabase();

    const result = await importRegistrySegment(database, sequentialIdFactory("segment"), { not: "a segment" }, 5_000);

    assert.equal(result.status, "invalid");
    assert.equal((raw.prepare("SELECT count(*) AS count FROM segments").get() as { count: number }).count, 0);
  });

  it("rejects a tampered fingerprint rather than importing corrupted data", async () => {
    const { raw, database } = migratedDatabase();
    const tampered = { ...validRegistryJson(), fingerprint: "0".repeat(64) };

    const result = await importRegistrySegment(database, sequentialIdFactory("segment"), tampered, 5_000);

    assert.equal(result.status, "invalid");
    assert.equal((raw.prepare("SELECT count(*) AS count FROM segments").get() as { count: number }).count, 0);
  });
});
