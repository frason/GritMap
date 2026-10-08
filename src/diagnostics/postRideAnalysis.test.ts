import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ParsedRide } from "../fit/parseFitFile.ts";
import {
  analyzePostRide,
  decodeRrArtifact,
  parseDiagnosticLog,
} from "./postRideAnalysis.ts";

describe("postRideAnalysis", () => {
  it("decodes Java big-endian schema-v1 RR records including gap reasons", () => {
    const bytes = rrArtifact([
      [1_000n, 1_000, true, 0],
      [5_000n, 1_000, false, 4],
    ]);
    const decoded = decodeRrArtifact(bytes);

    assert.equal(decoded.schemaVersion, 1);
    assert.equal(decoded.captureStartTimestampMs, 1_700_000_000_000);
    assert.equal(decoded.observations.length, 2);
    assert.equal(decoded.observations[1]?.reasonCode, 4);
    assert.equal(decoded.observations[0]?.rrInterval1024, 1_024);
    assert.equal(decoded.ignoredTrailingBytes, 0);
  });

  it("decodes schema-v2 native 1024-second values without losing precision", () => {
    const decoded = decodeRrArtifact(rrArtifact([[516n, 528, true, 0]], 2));

    assert.equal(decoded.schemaVersion, 2);
    assert.equal(decoded.observations[0]?.rrInterval1024, 528);
    assert.equal(decoded.observations[0]?.rrIntervalMs, 516);
  });

  it("reports approach latency retries RR quality and FIT agreement", () => {
    const log = [
      "1700000000000\th10_approach_requested\tsegment=realize state=IDLE",
      "1700000001000\th10_auto_retry_started\treason=error attempt=1 mode=known",
      "1700000002000\th10_auto_state\tstate=CONNECTED status=ready",
      "1700000002100\th10_auto_capture_started\tsource=auto",
      "1700000005000\tattempt_started\tsegment=realize attempt=a1",
    ].join("\n");
    const ride: ParsedRide = {
      points: [
        { timestampMs: 1_700_000_001_000, heartRate: 60 },
        { timestampMs: 1_700_000_002_000, heartRate: 60 },
      ],
      deviceMetadata: {},
    };
    const analysis = analyzePostRide(ride, [decodeRrArtifact(rrArtifact([
      [1_000n, 1_000, true, 0],
      [2_000n, 1_000, true, 0],
    ]))], parseDiagnosticLog(log));

    assert.deepEqual(analysis.approaches[0], {
      segmentId: "realize",
      requestedAtMs: 1_700_000_000_000,
      connectedAfterMs: 2_000,
      captureStartedAfterMs: 2_100,
      attemptStartedAfterMs: 5_000,
      retries: 1,
      fallback: false,
    });
    assert.equal(analysis.rrArtifacts[0]?.validPct, 100);
    assert.equal(analysis.rrArtifacts[0]?.heartRateDifferenceBpm, 0);
    assert.deepEqual(analysis.warnings, []);
  });

  it("warns when approach never starts capture and artifact is truncated", () => {
    const bytes = new Uint8Array([...rrArtifact([]), 1, 2]);
    const analysis = analyzePostRide(
      { points: [], deviceMetadata: {} },
      [decodeRrArtifact(bytes)],
      parseDiagnosticLog("100\th10_approach_requested\tsegment=x"),
    );

    assert.match(analysis.warnings.join("\n"), /did not start RR capture/);
    assert.match(analysis.warnings.join("\n"), /incomplete record/);
  });
});

function rrArtifact(records: Array<[bigint, number, boolean, number]>, schemaVersion = 1): Uint8Array {
  const bytes = new Uint8Array(16 + records.length * 14);
  bytes.set([71, 77, 82, 82]);
  const view = new DataView(bytes.buffer);
  view.setInt32(4, schemaVersion, false);
  view.setBigInt64(8, 1_700_000_000_000n, false);
  records.forEach(([elapsed, rr, valid, reason], index) => {
    const offset = 16 + index * 14;
    view.setBigInt64(offset, elapsed, false);
    view.setInt32(offset + 8, rr, false);
    view.setUint8(offset + 12, valid ? 1 : 0);
    view.setInt8(offset + 13, reason);
  });
  return bytes;
}
