import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it, mock } from "node:test";

/**
 * mock.module() replaces the expo-crypto package itself (not a hand-copied stand-in of
 * segmentFingerprint.ts), backed by Node's real SHA-256 -- same pattern proven in
 * initializeDatabase.test.ts for issue #53.
 */
mock.module("expo-crypto", {
  exports: {
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    async digestStringAsync(_algorithm: string, data: string) {
      return createHash("sha256").update(data, "utf8").digest("hex");
    },
  },
});

const { buildFingerprintCanonicalString, computeSegmentFingerprint } = await import(
  "./segmentFingerprint.ts"
);

// The exact fixture from apps/karoo's SegmentJsonParserTest.kt ("valid"), with an expected
// SHA-256 verified against a real JVM run (see
// docs/PLAN_segment_definition_increment.md's "Fingerprint" section for how it was checked).
const KAROO_CONFORMANCE_FIXTURE = {
  corridorMeters: 30,
  requiredCoveragePct: 0.9,
  referencePolyline: [
    { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
    { lat: 37.001, lng: -122.0, distanceMeters: 111, elevationMeters: 20 },
  ],
};
const EXPECTED_CANONICAL_STRING =
  "segment-fingerprint-v1\n" +
  "direction=forward\n" +
  "corridorMeters=30\n" +
  "requiredCoveragePct=0.9\n" +
  "37.0,-122.0,0.0,10.0\n" +
  "37.001,-122.0,111.0,20.0\n";
const EXPECTED_SHA256 = "c2b8492774847a2117a8a045de50aadecb71b9b98017892da38338809772e615";

describe("segmentFingerprint", () => {
  it("builds the exact canonical string Karoo's SegmentFingerprint.compute() produces", () => {
    assert.equal(buildFingerprintCanonicalString(KAROO_CONFORMANCE_FIXTURE), EXPECTED_CANONICAL_STRING);
  });

  it("computes the JVM-verified conformance hash for Karoo's own test fixture", async () => {
    const fingerprint = await computeSegmentFingerprint(KAROO_CONFORMANCE_FIXTURE);
    assert.equal(fingerprint, EXPECTED_SHA256);
  });

  it("changes when a matching parameter changes (corridorMeters)", async () => {
    const changed = await computeSegmentFingerprint({
      ...KAROO_CONFORMANCE_FIXTURE,
      corridorMeters: 31,
    });
    assert.notEqual(changed, EXPECTED_SHA256);
  });

  it("is unaffected by fields FingerprintInput doesn't accept, e.g. renaming a segment", async () => {
    // FingerprintInput has no name/id field at all -- TypeScript enforces this structurally
    // at compile time. This asserts the runtime behavior it implies: two inputs differing
    // only in properties outside FingerprintInput's shape produce the same fingerprint.
    const withExtraField = await computeSegmentFingerprint({
      ...KAROO_CONFORMANCE_FIXTURE,
      // @ts-expect-error -- deliberately passing a field outside FingerprintInput's shape
      name: "Renamed",
    });
    assert.equal(withExtraField, EXPECTED_SHA256);
  });
});
