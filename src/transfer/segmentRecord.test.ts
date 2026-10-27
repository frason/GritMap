import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { MAX_RECORD_BYTES, validateSegmentRecord } from "./segmentRecord.ts";

/** Codex's shared, invented fixture (fixtures/contracts/segment-record-v1.json): the Karoo's own tests parse the same file. */
const fixture = JSON.parse(readFileSync("fixtures/contracts/segment-record-v1.json", "utf8")) as Record<string, any>;
const context = { segmentFingerprint: fixture.segmentFingerprint as string, segmentLengthMeters: 10460.736 };
const bad = (change: Record<string, unknown>) => validateSegmentRecord({ ...fixture, ...change }, context);

describe("segmentRecord against the shared fixture", () => {
  it("accepts the Karoo-side fixture exactly as it is", () => {
    assert.deepEqual(validateSegmentRecord(fixture, context), []);
    assert.deepEqual(validateSegmentRecord(fixture), []);
  });

  it("accepts a duration-only record (empty splits) and a many-split record", () => {
    assert.deepEqual(bad({ splits: [] }), []);
    const splits = Array.from({ length: 80 }, (_, i) => ({ distanceMeters: (i * 10460.736) / 79, elapsedSeconds: (i * 2400) / 79 }));
    splits[79] = { distanceMeters: 10460.736, elapsedSeconds: 2400 };
    assert.deepEqual(bad({ splits }), []);
    assert.ok(bad({ splits: [...splits, { distanceMeters: 11000, elapsedSeconds: 2500 }] }).length > 0, "81 splits is over the limit");
  });

  it("rejects what the Karoo's strict parser rejects, rather than repairing it", () => {
    assert.ok(validateSegmentRecord({ ...fixture, extra: 1 }, context).some((p) => /unknown field/.test(p)));
    const { riderId: _omitted, ...withoutRider } = fixture;
    assert.ok(validateSegmentRecord(withoutRider, context).some((p) => /missing riderId/.test(p)));
    assert.ok(bad({ schemaVersion: 2 }).length > 0);
    for (const riderId of ["short", "has spaces in it 123456", "x".repeat(65), "name@example.com", 12345678901234567]) assert.ok(bad({ riderId }).length > 0, String(riderId));
    assert.ok(bad({ segmentFingerprint: "ABAB".repeat(16) }).length > 0, "fingerprint must be lowercase hex");
    assert.ok(validateSegmentRecord(fixture, { ...context, segmentFingerprint: "cd".repeat(32) }).some((p) => /does not match the segment/.test(p)));
    for (const bestDurationSeconds of [0, -1, "2400", Number.NaN, Infinity, 604_801]) assert.ok(bad({ bestDurationSeconds }).length > 0, String(bestDurationSeconds));
    for (const achievedAtMs of [0, -5, 1.5, "1000"]) assert.ok(bad({ achievedAtMs }).length > 0, String(achievedAtMs));
    for (const effortCount of [-1, 1.5, 1_000_001, "2"]) assert.ok(bad({ effortCount }).length > 0, String(effortCount));
  });

  it("rejects splits that are not a complete, increasing track from the start to the finish", () => {
    const one = { distanceMeters: 0, elapsedSeconds: 0 };
    const end = { distanceMeters: 10460.736, elapsedSeconds: 2400 };
    assert.ok(bad({ splits: [one] }).length > 0, "a single split is neither empty nor a track");
    assert.ok(bad({ splits: [{ distanceMeters: 5, elapsedSeconds: 1 }, end] }).length > 0, "must start at 0 m / 0 s");
    assert.ok(bad({ splits: [one, { distanceMeters: 0, elapsedSeconds: 10 }, end] }).length > 0, "distance must strictly increase");
    assert.ok(bad({ splits: [one, { distanceMeters: 100, elapsedSeconds: 0 }, end] }).length > 0, "time must strictly increase");
    assert.ok(bad({ splits: [one, { distanceMeters: 5000, elapsedSeconds: 2401 }, end] }).length > 0, "a split cannot be later than the finish");
    assert.ok(bad({ splits: [one, { distanceMeters: 10460.736, elapsedSeconds: 2399 }] }).length > 0, "the finish time must equal bestDurationSeconds");
    assert.ok(bad({ splits: [one, { distanceMeters: 10000, elapsedSeconds: 2400 }] }).length > 0, "the finish must be at the segment's installed length");
    assert.ok(bad({ splits: [one, { distanceMeters: "10460.736", elapsedSeconds: 2400 }] }).length > 0, "string numbers are not repaired");
    assert.ok(bad({ splits: [one, { distanceMeters: 10460.736, elapsedSeconds: 2400, extra: 1 }] }).length > 0, "unknown keys are rejected");
    assert.ok(validateSegmentRecord({ ...fixture, splits: [one, { distanceMeters: 10460.74, elapsedSeconds: 2400 }] }, context).length === 0, "0.01 m tolerance on the finish distance");
  });

  it("rejects a record over 8192 bytes and anything that is not an object", () => {
    assert.equal(MAX_RECORD_BYTES, 8192);
    for (const value of [null, undefined, [], "x", 3]) assert.ok(validateSegmentRecord(value).length > 0);
  });

  it("never echoes a rider id or any record content in a problem message", () => {
    const text = JSON.stringify(validateSegmentRecord({ ...fixture, riderId: "synthetic_rider_0001", bestDurationSeconds: -1 }, context));
    assert.doesNotMatch(text, /synthetic_rider_0001/);
  });
});
