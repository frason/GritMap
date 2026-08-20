import * as Crypto from "expo-crypto";
import { toJavaDoubleString } from "./toJavaDoubleString.ts";
import type { SegmentReferencePoint } from "./resamplePolyline.ts";

export interface FingerprintInput {
  corridorMeters: number;
  requiredCoveragePct: number;
  referencePolyline: readonly SegmentReferencePoint[];
}

/**
 * Byte-for-byte the same canonicalization as apps/karoo's
 * SegmentJsonParser.kt's SegmentFingerprint.compute() -- read directly from that source, not
 * paraphrased. `corridorMeters` is a whole number (Kotlin Int, never gets a trailing `.0`);
 * every other numeric field is a Kotlin Double and goes through toJavaDoubleString().
 * See docs/PLAN_segment_definition_increment.md's "Fingerprint" section for the verified
 * conformance fixture this must match.
 */
export function buildFingerprintCanonicalString(input: FingerprintInput): string {
  const lines = [
    "segment-fingerprint-v1",
    "direction=forward",
    `corridorMeters=${input.corridorMeters}`,
    `requiredCoveragePct=${toJavaDoubleString(input.requiredCoveragePct)}`,
    ...input.referencePolyline.map((point) =>
      [
        toJavaDoubleString(point.lat),
        toJavaDoubleString(point.lng),
        toJavaDoubleString(point.distanceMeters),
        point.elevationMeters === undefined ? "null" : toJavaDoubleString(point.elevationMeters),
      ].join(","),
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/** SHA-256 hex digest (lowercase, matching Java's `"%02x"` format) of the canonical string. */
export async function computeSegmentFingerprint(input: FingerprintInput): Promise<string> {
  const canonical = buildFingerprintCanonicalString(input);
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical);
  return digest.toLowerCase();
}
