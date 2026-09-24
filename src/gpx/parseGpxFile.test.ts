import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { looksLikeGpx, parseGpxFile } from "./parseGpxFile.ts";

const REAL_FIXTURE = "fixtures/gpx/Tilden_Inspiration_1_5_Bears_turnaround_repeat.gpx";

describe("parseGpxFile", () => {
  it("parses a real Strava-exported GPX file", async () => {
    const bytes = await readFile(REAL_FIXTURE);
    const ride = parseGpxFile(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));

    assert.equal(ride.points.length, 5_207);
    assert.ok(ride.points.every((point) => Number.isFinite(point.timestampMs)));
    assert.ok(ride.points.every((point) => point.lat !== undefined && point.lng !== undefined));
    assert.ok(ride.points.every((point) => point.elevationMeters !== undefined));
    assert.ok(ride.points.every((point) => point.heartRate !== undefined));
    // GPX structurally has no power/cadence/speed/temperature fields at all.
    assert.ok(ride.points.every((point) => point.power === undefined));
    assert.ok(ride.points.every((point) => point.cadence === undefined));
    assert.ok(ride.points.every((point) => point.speedMetersPerSec === undefined));
    assert.ok(ride.points.every((point) => point.temperatureCelsius === undefined));

    // distanceMeters is computed (GPX has no cumulative-distance field), starts at 0, and
    // strictly increases -- real GPS noise between consecutive points is never exactly 0m.
    assert.equal(ride.points[0]?.distanceMeters, 0);
    for (let i = 1; i < ride.points.length; i += 1) {
      assert.ok(ride.points[i]!.distanceMeters! > ride.points[i - 1]!.distanceMeters!);
    }
    const totalDistanceMeters = ride.points.at(-1)?.distanceMeters ?? 0;
    // The real ride's title is "1.5 Bears" repeats over Tilden/Inspiration Point -- a
    // multi-hour climbing ride, so tens of km is the right order of magnitude (loose bound,
    // not a golden value -- the file's exact distance was never independently measured).
    assert.ok(totalDistanceMeters > 20_000 && totalDistanceMeters < 150_000);

    assert.equal(ride.deviceMetadata.trackName, "Tilden, Inspiration,  1.5 Bears turnaround repeat.");
  });

  it("throws on a track point missing a timestamp", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="37.1" lon="-122.1"><ele>10</ele></trkpt>
    </trkseg></trk></gpx>`;
    assert.throws(() => parseGpxFile(new TextEncoder().encode(gpx)), /missing a <time> element/);
  });

  it("throws on a track point missing lat/lon", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt><time>2024-01-01T00:00:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    assert.throws(() => parseGpxFile(new TextEncoder().encode(gpx)), /missing a lat\/lon/);
  });

  it("throws when there are no track points at all", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg></trkseg></trk></gpx>`;
    assert.throws(() => parseGpxFile(new TextEncoder().encode(gpx)), /no track points/);
  });

  it("throws when the input isn't GPX at all", () => {
    assert.throws(
      () => parseGpxFile(new TextEncoder().encode("not xml at all")),
      /not a GPX file/,
    );
  });

  it("omits elevation and heart rate when a point lacks them, without fabricating zero", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="37.1" lon="-122.1"><time>2024-01-01T00:00:00Z</time></trkpt>
      <trkpt lat="37.2" lon="-122.2"><time>2024-01-01T00:00:05Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const ride = parseGpxFile(new TextEncoder().encode(gpx));
    assert.equal(ride.points.length, 2);
    assert.equal(ride.points[0]?.elevationMeters, undefined);
    assert.equal(ride.points[0]?.heartRate, undefined);
    assert.ok(!("elevationMeters" in ride.points[0]!));
    assert.ok(!("heartRate" in ride.points[0]!));
  });

  it("decodes XML entities in the track name", () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><name>Tom &amp; Jerry&apos;s Ride</name><trkseg>
      <trkpt lat="0" lon="0"><time>2024-01-01T00:00:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const ride = parseGpxFile(new TextEncoder().encode(gpx));
    assert.equal(ride.deviceMetadata.trackName, "Tom & Jerry's Ride");
  });
});

describe("looksLikeGpx", () => {
  it("returns true for a real GPX file", async () => {
    const bytes = await readFile(REAL_FIXTURE);
    assert.equal(looksLikeGpx(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)), true);
  });

  it("returns false for a real (binary) FIT file", async () => {
    const bytes = await readFile("fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit");
    assert.equal(looksLikeGpx(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)), false);
  });

  it("returns false for arbitrary non-GPX text", () => {
    assert.equal(looksLikeGpx(new TextEncoder().encode("just some text")), false);
  });
});
