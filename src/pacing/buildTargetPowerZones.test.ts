import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTargetPowerZones } from "./buildTargetPowerZones.ts";
import type { ZoneWindow } from "./computeZoneGrades.ts";

function zone(startDistanceMeters: number, endDistanceMeters: number, gradePct: number): ZoneWindow {
  return { startDistanceMeters, endDistanceMeters, gradePct };
}

describe("buildTargetPowerZones", () => {
  it("returns [] for no zones", () => {
    assert.deepEqual(buildTargetPowerZones([], 290, 290), []);
  });

  it("matches the worked synthetic example (-2%/0%/+8% grades, 290W anchor)", () => {
    const zones = buildTargetPowerZones(
      [zone(0, 100, -2), zone(100, 200, 0), zone(200, 300, 8)],
      290,
      290,
    );
    assert.deepEqual(zones.map((z) => z.targetPowerWatts), [232, 261, 341]);
    assert.deepEqual(zones.map((z) => z.classification), ["REST", "HOLD", "PUSH"]);
    assert.deepEqual(zones.map((z) => z.instruction), ["Rest", "Hold", "Push — 8% pitch ahead"]);
  });

  it("returns one zone equal to the anchor exactly, for a single-zone segment", () => {
    const zones = buildTargetPowerZones([zone(0, 100, 15)], 283, 300);
    assert.equal(zones.length, 1);
    assert.equal(zones[0]!.targetPowerWatts, 283);
  });

  it("keeps the distance-weighted mean close to the anchor when nothing clamps", () => {
    const anchor = 300;
    const zones = buildTargetPowerZones(
      [zone(0, 100, -1), zone(100, 200, 0), zone(200, 300, 1), zone(300, 400, 2)],
      anchor,
      anchor, // ftp == anchor keeps the [0.7,1.5]x bounds well clear of these mild grades
    );
    const mean = zones.reduce((sum, z) => sum + z.targetPowerWatts, 0) / zones.length;
    assert.ok(Math.abs(mean - anchor) <= 1, `expected mean near ${anchor}, got ${mean}`);
  });

  it("never lets two adjacent zones' power differ by more than 80W, even under extreme grades", () => {
    const anchor = 300;
    const ftp = 300;
    const zones = buildTargetPowerZones(
      [zone(0, 100, -30), zone(100, 200, 30), zone(200, 300, -30), zone(300, 400, 30)],
      anchor,
      ftp,
    );
    for (let i = 1; i < zones.length; i += 1) {
      const step = Math.abs(zones[i]!.targetPowerWatts - zones[i - 1]!.targetPowerWatts);
      assert.ok(step <= 80, `step ${step} between zone ${i - 1} and ${i} exceeds 80W`);
    }
    const minWatts = Math.floor(ftp * 0.7);
    const maxWatts = Math.floor(ftp * 1.5);
    for (const z of zones) {
      assert.ok(z.targetPowerWatts >= minWatts && z.targetPowerWatts <= maxWatts);
    }
  });

  it("classifies exactly 90%/110% of anchor as HOLD, not REST/PUSH (lower-bound-inclusive boundaries)", () => {
    const anchor = 300;
    const zones = buildTargetPowerZones([zone(0, 100, 2), zone(100, 200, -2)], anchor, anchor);
    assert.equal(zones[0]!.targetPowerWatts, 330); // 110% of anchor
    assert.equal(zones[0]!.classification, "HOLD");
    assert.equal(zones[1]!.targetPowerWatts, 270); // 90% of anchor
    assert.equal(zones[1]!.classification, "HOLD");
  });

  it("mentions a steep downhill in a REST instruction, and a steep grade in a HOLD instruction", () => {
    const anchor = 300;
    const [restZone] = buildTargetPowerZones(
      [zone(0, 100, -10), zone(100, 200, 2)],
      anchor,
      anchor,
    );
    assert.equal(restZone!.classification, "REST");
    assert.equal(restZone!.instruction, "Rest — 10% downhill");

    const [steepHold] = buildTargetPowerZones([zone(0, 100, 5)], anchor, anchor);
    assert.equal(steepHold!.classification, "HOLD");
    assert.equal(steepHold!.instruction, "Hold — 5% grade");
  });

  it("never mentions a percentage for a non-steep grade (|grade| < 3)", () => {
    const zones = buildTargetPowerZones([zone(0, 100, 1)], 300, 300);
    assert.equal(zones[0]!.instruction, "Hold");
  });

  it("keeps every instruction non-blank and within the Karoo's 80-character limit", () => {
    const zones = buildTargetPowerZones(
      [zone(0, 100, -15), zone(100, 200, 0), zone(200, 300, 20)],
      290,
      290,
    );
    for (const z of zones) {
      assert.ok(z.instruction.length > 0 && z.instruction.length <= 80);
    }
  });

  it("throws for a non-positive or non-finite anchorPowerWatts or ftpWatts", () => {
    const zones = [zone(0, 100, 0)];
    assert.throws(() => buildTargetPowerZones(zones, 0, 300), RangeError);
    assert.throws(() => buildTargetPowerZones(zones, 290, -300), RangeError);
    assert.throws(() => buildTargetPowerZones(zones, Number.NaN, 300), RangeError);
  });
});
