import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { parseFitFile } from "./parseFitFile.ts";

const FIXTURES = [
  "fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit",
  "fixtures/fit/Karoo-Morning_Ride-2026-08-09-0844.fit",
];

describe("parseFitFile", () => {
  for (const fixture of FIXTURES) {
    it(`parses real Karoo data from ${fixture}`, async () => {
      const bytes = await readFile(fixture);
      const ride = parseFitFile(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));

      assert.ok(ride.points.length > 8_000);
      assert.ok(ride.points.every((point) => Number.isFinite(point.timestampMs)));
      assert.ok(ride.points.some((point) => point.lat !== undefined && point.lng !== undefined));
      assert.ok(ride.points.some((point) => point.distanceMeters !== undefined));
      assert.ok(ride.points.some((point) => point.elevationMeters !== undefined));
      assert.ok(ride.points.some((point) => point.power !== undefined));
      assert.ok(ride.points.some((point) => point.heartRate !== undefined));
      assert.ok(ride.points.some((point) => point.cadence !== undefined));
      assert.ok(ride.points.some((point) => point.speedMetersPerSec !== undefined));
      assert.ok(ride.points.some((point) => point.temperatureCelsius !== undefined));
      assert.ok(ride.points.some((point) => point.power === 0));
      assert.ok(ride.points.some((point) => point.power === undefined));
      assert.equal(ride.originalTimezoneOffsetMinutes, undefined);
    });
  }

  it("accepts an ArrayBuffer without Node-specific file handling in the parser", async () => {
    const bytes = await readFile(FIXTURES[0]);
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    assert.equal(parseFitFile(arrayBuffer).points.length, 11_004);
  });
});
