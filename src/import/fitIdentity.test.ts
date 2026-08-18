import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseFitFile } from "../fit/parseFitFile.ts";
import { extractRideIdentity } from "./fitIdentity.ts";

describe("extractRideIdentity", () => {
  it("extracts exact identity from a real Karoo fixture (2026-08-02)", () => {
    const bytes = readFileSync("fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit");
    const ride = parseFitFile(bytes);

    assert.deepEqual(extractRideIdentity(ride), {
      deviceId: "241760203",
      startTimestampMs: 1_785_685_040_000, // sessionMesgs[0].startTime, not the first record
      durationMs: 11_458_000, // sessionMesgs[0].totalElapsedTime (11458s), not totalTimerTime
    });
  });

  it("extracts exact identity from a real Karoo fixture (2026-08-09)", () => {
    const bytes = readFileSync("fixtures/fit/Karoo-Morning_Ride-2026-08-09-0844.fit");
    const ride = parseFitFile(bytes);

    assert.deepEqual(extractRideIdentity(ride), {
      deviceId: "241760203",
      startTimestampMs: 1_786_290_291_000,
      durationMs: 9_336_000,
    });
  });

  it("never includes activityId -- no stable field exists in real Karoo output", () => {
    const bytes = readFileSync("fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit");
    const identity = extractRideIdentity(parseFitFile(bytes));
    assert.ok(!("activityId" in identity));
  });

  it("falls back to the first ride point's timestamp when no session message exists", () => {
    const ride = {
      points: [
        { timestampMs: 5_000 },
        { timestampMs: 8_000 },
      ],
      deviceMetadata: {},
    } as Parameters<typeof extractRideIdentity>[0];

    const identity = extractRideIdentity(ride);
    assert.equal(identity.startTimestampMs, 5_000);
    assert.equal(identity.durationMs, 3_000); // last (8000) minus first (5000)
    assert.ok(!("deviceId" in identity));
  });

  it("prefers session totalElapsedTime over a point-derived duration when both are available", () => {
    const ride = {
      points: [{ timestampMs: 0 }, { timestampMs: 1_000 }],
      deviceMetadata: { sessions: [{ startTime: new Date(0), totalElapsedTime: 999 }] },
    } as Parameters<typeof extractRideIdentity>[0];

    assert.equal(extractRideIdentity(ride).durationMs, 999_000);
  });

  it("throws when there is no session data and no ride points to fall back on", () => {
    const ride = { points: [], deviceMetadata: {} } as Parameters<typeof extractRideIdentity>[0];
    assert.throws(() => extractRideIdentity(ride), /Cannot determine ride start/);
  });

  it("does not treat a paired sensor's serial number as the device id", () => {
    // fileId identifies the recording head unit; devices (deviceInfoMesgs) are paired
    // sensors and must never be read for identity, even if present.
    const ride = {
      points: [{ timestampMs: 0 }],
      deviceMetadata: {
        fileId: { manufacturer: "hammerhead", serialNumber: 111 },
        devices: [{ manufacturer: "favero", serialNumber: 999 }],
      },
    } as Parameters<typeof extractRideIdentity>[0];

    assert.equal(extractRideIdentity(ride).deviceId, "111");
  });
});
