import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it, mock } from "node:test";

// Same real mock.module() pattern as segmentFingerprint.test.ts -- fromPortableSegmentJson
// recomputes the fingerprint via the real expo-crypto-backed function, not a stand-in.
mock.module("expo-crypto", {
  exports: {
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    async digestStringAsync(_algorithm: string, data: string) {
      return createHash("sha256").update(data, "utf8").digest("hex");
    },
  },
});

const { fromPortableSegmentJson } = await import("./fromPortableSegmentJson.ts");
const { toPortableSegmentJson } = await import("./toPortableSegmentJson.ts");

// Same JVM-verified conformance fixture as segmentFingerprint.test.ts, so this is a real,
// externally-checked fingerprint, not one generated and re-checked by the same code path.
const VALID_POLYLINE = [
  { lat: 37.0, lng: -122.0, distanceMeters: 0, elevationMeters: 10 },
  { lat: 37.001, lng: -122.0, distanceMeters: 111, elevationMeters: 20 },
];
const VALID_FINGERPRINT = "c2b8492774847a2117a8a045de50aadecb71b9b98017892da38338809772e615";

function validPortableJson(overrides: Record<string, unknown> = {}) {
  return {
    ...toPortableSegmentJson({
      id: "wall",
      name: "Local Wall",
      schemaVersion: 1,
      corridorMeters: 30,
      requiredCoveragePct: 0.9,
      fingerprint: VALID_FINGERPRINT,
      referencePolyline: VALID_POLYLINE,
    }),
    ...overrides,
  };
}

describe("fromPortableSegmentJson", () => {
  it("parses a valid, correctly-fingerprinted registry entry", async () => {
    const result = await fromPortableSegmentJson(validPortableJson());

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.segment, {
      id: "wall",
      name: "Local Wall",
      schemaVersion: 1,
      corridorMeters: 30,
      requiredCoveragePct: 0.9,
      fingerprint: VALID_FINGERPRINT,
      referencePolyline: VALID_POLYLINE,
    });
  });

  it("rejects a fingerprint that doesn't match the recomputed value (corrupted or tampered)", async () => {
    const result = await fromPortableSegmentJson(validPortableJson({ fingerprint: "0".repeat(64) }));
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /fingerprint mismatch/i);
  });

  it("rejects a reverse direction (this app only defines forward segments)", async () => {
    const result = await fromPortableSegmentJson(validPortableJson({ direction: "reverse" }));
    assert.equal(result.ok, false);
  });

  for (const field of ["schemaVersion", "id", "name", "fingerprint", "matching", "referencePolyline"]) {
    it(`rejects a missing "${field}" field`, async () => {
      const json = validPortableJson() as Record<string, unknown>;
      delete json[field];
      const result = await fromPortableSegmentJson(json);
      assert.equal(result.ok, false);
    });
  }

  it("rejects a referencePolyline with fewer than two points", async () => {
    const result = await fromPortableSegmentJson(validPortableJson({ referencePolyline: [VALID_POLYLINE[0]] }));
    assert.equal(result.ok, false);
  });

  it("rejects a reference point missing lat/lng/distanceMeters", async () => {
    const result = await fromPortableSegmentJson(
      validPortableJson({ referencePolyline: [{ lat: 0 }, VALID_POLYLINE[1]] }),
    );
    assert.equal(result.ok, false);
  });

  it("rejects non-object input", async () => {
    assert.equal((await fromPortableSegmentJson(null)).ok, false);
    assert.equal((await fromPortableSegmentJson("not json")).ok, false);
    assert.equal((await fromPortableSegmentJson(42)).ok, false);
  });

  describe("allowMissingFingerprint", () => {
    const withoutFingerprint = () => {
      const { fingerprint: _drop, ...rest } = validPortableJson();
      return rest;
    };

    it("is off by default: a file with no fingerprint is still rejected (the registry path)", async () => {
      assert.deepEqual(await fromPortableSegmentJson(withoutFingerprint()), {
        ok: false,
        error: "Missing or invalid fingerprint",
      });
    });

    it("when on, uses the locally computed fingerprint for a file that has none", async () => {
      const result = await fromPortableSegmentJson(withoutFingerprint(), { allowMissingFingerprint: true });
      assert.ok(result.ok);
      assert.equal(result.segment.fingerprint, VALID_FINGERPRINT);
    });

    it("when on, still rejects a fingerprint that is present but wrong, or not text", async () => {
      assert.deepEqual(
        await fromPortableSegmentJson(validPortableJson({ fingerprint: "0".repeat(64) }), { allowMissingFingerprint: true }),
        { ok: false, error: "Fingerprint mismatch -- segment data may be corrupted or tampered" },
      );
      assert.deepEqual(
        await fromPortableSegmentJson(validPortableJson({ fingerprint: 5 }), { allowMissingFingerprint: true }),
        { ok: false, error: "Missing or invalid fingerprint" },
      );
    });
  });
});

