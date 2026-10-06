import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
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

const { importSegmentJsonText, MAX_SEGMENT_JSON_CHARACTERS } = await import("./importSegmentJsonText.ts");
const { applyMigrations } = await import("./migrations.ts");
import type { SyncDatabase } from "./types.ts";

/** What the Karoo already has installed for Coco Jumbo (read from its database on 2026-10-05). */
const KAROO_COCO_JUMBO_FINGERPRINT = "ed56296f099c2f53aed3fbd55932b2b55bf39f24228fc6a2688a796062f94366";

function migrated(): { raw: DatabaseSync; database: SyncDatabase } {
  const raw = new DatabaseSync(":memory:");
  applyMigrations(raw);
  const database: SyncDatabase = {
    exec: (sql) => raw.exec(sql),
    prepare: (sql) => {
      const statement = raw.prepare(sql);
      return {
        get: (...params) => statement.get(...(params as never[])),
        run: (...params) => statement.run(...(params as never[])),
        all: (...params) => statement.all(...(params as never[])),
      };
    },
    runMany: (sql, paramsList) => {
      const statement = raw.prepare(sql);
      for (const params of paramsList) statement.run(...(params as never[]));
    },
  };
  return { raw, database };
}

let counter = 0;
const generateId = () => `id-${(counter += 1)}`;

const cocoJumboText = () => readFile("apps/karoo/samples/Coco_Jumbo.segment.json", "utf8");

describe("importSegmentJsonText", () => {
  it("imports the Karoo's Coco Jumbo file (which has no fingerprint) with the same fingerprint the Karoo holds", async () => {
    const { raw, database } = migrated();
    const result = await importSegmentJsonText(database, generateId, await cocoJumboText(), 1_000);
    assert.equal(result.status, "imported");
    const row = raw.prepare("SELECT name, fingerprint, corridor_meters, required_coverage FROM segments").get()!;
    assert.equal(row.name, "Coco Jumbo");
    assert.equal(row.fingerprint, KAROO_COCO_JUMBO_FINGERPRINT);
    assert.equal(row.corridor_meters, 30);
    assert.equal(row.required_coverage, 0.9);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM segment_reference_points").get()!.n, 55);
  });

  it("reports an already-imported segment instead of duplicating it", async () => {
    const { raw, database } = migrated();
    const first = await importSegmentJsonText(database, generateId, await cocoJumboText(), 1_000);
    const second = await importSegmentJsonText(database, generateId, await cocoJumboText(), 2_000);
    assert.equal(first.status, "imported");
    assert.equal(second.status, "already-imported");
    assert.equal(second.status === "already-imported" && second.segmentId, first.status === "imported" && first.segmentId);
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM segments").get()!.n, 1);
  });

  it("verifies a fingerprint when the file carries one: correct is accepted, tampered is rejected", async () => {
    const original = JSON.parse(await cocoJumboText());
    const good = { ...original, fingerprint: KAROO_COCO_JUMBO_FINGERPRINT };
    const { database } = migrated();
    assert.equal((await importSegmentJsonText(database, generateId, JSON.stringify(good), 1_000)).status, "imported");

    const tamperedPolyline = structuredClone(good);
    tamperedPolyline.referencePolyline[10].lat += 0.0005;
    const tampered = await importSegmentJsonText(migrated().database, generateId, JSON.stringify(tamperedPolyline), 1_000);
    assert.deepEqual(tampered, { status: "invalid", error: "Fingerprint mismatch -- segment data may be corrupted or tampered" });

    const wrongPrint = await importSegmentJsonText(
      migrated().database,
      generateId,
      JSON.stringify({ ...original, fingerprint: "0".repeat(64) }),
      1_000,
    );
    assert.equal(wrongPrint.status, "invalid");
  });

  it("imports a differing route as its own segment when there is no fingerprint to check (nothing to verify against)", async () => {
    const original = JSON.parse(await cocoJumboText());
    original.referencePolyline[10].lat += 0.0005;
    const { raw, database } = migrated();
    const result = await importSegmentJsonText(database, generateId, JSON.stringify(original), 1_000);
    assert.equal(result.status, "imported");
    assert.notEqual(raw.prepare("SELECT fingerprint FROM segments").get()!.fingerprint, KAROO_COCO_JUMBO_FINGERPRINT);
  });

  it("accepts a whole gritmap-transfer guidance package and imports its segment", async () => {
    const text = await readFile("apps/karoo/samples/Relize.6m54.guidance-package.json", "utf8");
    const { raw, database } = migrated();
    const result = await importSegmentJsonText(database, generateId, text, 1_000);
    assert.equal(result.status, "imported", JSON.stringify(result));
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM segments").get()!.n, 1);
  });

  it("tolerates a byte-order mark", async () => {
    const result = await importSegmentJsonText(migrated().database, generateId, `﻿${await cocoJumboText()}`, 1_000);
    assert.equal(result.status, "imported");
  });

  it("rejects text that is not a segment, with a reason, and writes nothing", async () => {
    const { raw, database } = migrated();
    const original = JSON.parse(await cocoJumboText());
    const cases: [string, string][] = [
      ["not json", "Not a valid JSON file"],
      ["[1,2,3]", "Unsupported direction: undefined"],
      ["42", "Not a JSON object"],
      [JSON.stringify({ ...original, direction: "reverse" }), "Unsupported direction: reverse"],
      [JSON.stringify({ ...original, matching: undefined }), "Missing or invalid matching parameters"],
      [JSON.stringify({ ...original, referencePolyline: [original.referencePolyline[0]] }), "referencePolyline must have at least two points"],
      [JSON.stringify({ ...original, name: "  " }), "Missing or invalid name"],
      [JSON.stringify({ ...original, fingerprint: 7 }), "Missing or invalid fingerprint"],
    ];
    for (const [text, error] of cases) {
      assert.deepEqual(await importSegmentJsonText(database, generateId, text, 1_000), { status: "invalid", error }, text.slice(0, 40));
    }
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM segments").get()!.n, 0);
  });

  it("refuses an absurdly large file before parsing it", async () => {
    const result = await importSegmentJsonText(migrated().database, generateId, "x".repeat(MAX_SEGMENT_JSON_CHARACTERS + 1), 1_000);
    assert.deepEqual(result, { status: "invalid", error: "File is too large to be a segment" });
  });
});
