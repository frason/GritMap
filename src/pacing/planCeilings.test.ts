import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeZoneCeilings,
  DEFAULT_PLAN_CEILING_CONFIG,
  findTargetsAboveCeilings,
  summarizeZoneHistory,
  type ZoneHistory,
} from "./planCeilings.ts";

const zones = Array.from({ length: 10 }, (_, i) => ({ startDistanceMeters: i * 400, endDistanceMeters: (i + 1) * 400 }));
const FTP = 250;
const ANCHOR = 252;

describe("computeZoneCeilings", () => {
  it("uses the best power held plus the margin where the rider has history", () => {
    const history: ZoneHistory[] = zones.map(() => ({ bestHeldWatts: null, attemptsWithData: 0 }));
    history[4] = { bestHeldWatts: 270, attemptsWithData: 2 };
    const ceilings = computeZoneCeilings({ zones, ftpWatts: FTP, anchorPowerWatts: ANCHOR, history });
    assert.deepEqual(ceilings[4], { ceilingWatts: Math.floor(270 * 1.04), source: "history" });
    assert.equal(ceilings[3]!.source, "fallback");
  });

  it("ignores history where the rider was coasting (below the minimum held fraction of FTP)", () => {
    const history: ZoneHistory[] = zones.map(() => ({ bestHeldWatts: 120, attemptsWithData: 1 }));
    const ceilings = computeZoneCeilings({ zones, ftpWatts: FTP, anchorPowerWatts: ANCHOR, history });
    assert.ok(ceilings.every((ceiling) => ceiling.source === "fallback"));
  });

  it("with no history slides from the early to the late fallback, relative to the anchor", () => {
    const ceilings = computeZoneCeilings({ zones, ftpWatts: FTP, anchorPowerWatts: ANCHOR });
    assert.ok(ceilings.every((ceiling) => ceiling.source === "fallback"));
    assert.ok(ceilings[0]!.ceilingWatts > ceilings[9]!.ceilingWatts, "early ceiling is higher than late");
    assert.ok(ceilings[0]!.ceilingWatts <= Math.floor(ANCHOR * DEFAULT_PLAN_CEILING_CONFIG.fallbackStartPctOfAnchor));
    assert.ok(ceilings[9]!.ceilingWatts >= Math.floor(ANCHOR * DEFAULT_PLAN_CEILING_CONFIG.fallbackEndPctOfAnchor) - 2);
    for (let i = 1; i < ceilings.length; i += 1) assert.ok(ceilings[i]!.ceilingWatts <= ceilings[i - 1]!.ceilingWatts);
  });

  it("never goes below 70% or above 150% of FTP", () => {
    const high = computeZoneCeilings({ zones, ftpWatts: FTP, anchorPowerWatts: 1000 });
    assert.ok(high.every((c) => c.ceilingWatts === Math.floor(FTP * 1.5)));
    const low = computeZoneCeilings({ zones, ftpWatts: FTP, anchorPowerWatts: 10 });
    assert.ok(low.every((c) => c.ceilingWatts === Math.floor(FTP * 0.7)));
  });

  it("takes configured constants", () => {
    const history: ZoneHistory[] = zones.map(() => ({ bestHeldWatts: 250, attemptsWithData: 1 }));
    const [first] = computeZoneCeilings({ zones, ftpWatts: FTP, anchorPowerWatts: ANCHOR, history, config: { historyMarginPct: 0.1 } });
    assert.equal(first!.ceilingWatts, 275);
  });

  it("rejects a non-positive FTP or anchor", () => {
    assert.throws(() => computeZoneCeilings({ zones, ftpWatts: 0, anchorPowerWatts: ANCHOR }), RangeError);
    assert.throws(() => computeZoneCeilings({ zones, ftpWatts: FTP, anchorPowerWatts: -1 }), RangeError);
  });

  it("returns nothing for no zones", () => {
    assert.deepEqual(computeZoneCeilings({ zones: [], ftpWatts: FTP, anchorPowerWatts: ANCHOR }), []);
  });
});

function trackAt(watts: (distance: number) => number | undefined, length: number) {
  return Array.from({ length: length + 1 }, (_, d) => {
    const power = watts(d);
    return { distanceMeters: d, timestampMs: d * 1000, ...(power === undefined ? {} : { power }) };
  });
}

describe("summarizeZoneHistory", () => {
  it("keeps the best average per zone across efforts", () => {
    const attemptA = { track: trackAt(() => 240, 4000) };
    const attemptB = { track: trackAt((d) => (d < 2000 ? 200 : 280), 4000) };
    const history = summarizeZoneHistory({ attempts: [attemptA, attemptB], zones: zones.slice(0, 10), segmentLengthMeters: 4000 });
    assert.equal(Math.round(history[0]!.bestHeldWatts!), 240);
    assert.equal(Math.round(history[9]!.bestHeldWatts!), 280);
    assert.equal(history[0]!.attemptsWithData, 2);
  });

  it("ignores a zone with too little power data in an effort", () => {
    const sparse = { track: trackAt((d) => (d >= 400 && d < 800 ? undefined : 250), 4000) };
    const history = summarizeZoneHistory({ attempts: [sparse], zones, segmentLengthMeters: 4000 });
    assert.equal(history[1]!.bestHeldWatts, null);
    assert.equal(history[1]!.attemptsWithData, 0);
    assert.ok(history[2]!.bestHeldWatts !== null);
  });

  it("skips efforts without a usable track and reports no history", () => {
    const history = summarizeZoneHistory({ attempts: [{ track: [] }], zones, segmentLengthMeters: 4000 });
    assert.ok(history.every((entry) => entry.bestHeldWatts === null && entry.attemptsWithData === 0));
  });
});

describe("findTargetsAboveCeilings", () => {
  it("lists the zones whose target is above the ceiling", () => {
    const ceilings = computeZoneCeilings({ zones: zones.slice(0, 3), ftpWatts: FTP, anchorPowerWatts: ANCHOR });
    const found = findTargetsAboveCeilings(
      [{ targetPowerWatts: 200 }, { targetPowerWatts: 400 }, { targetPowerWatts: ceilings[2]!.ceilingWatts }],
      ceilings,
    );
    assert.deepEqual(found.map((entry) => entry.zoneIndex), [1]);
    assert.equal(found[0]!.ceilingWatts, ceilings[1]!.ceilingWatts);
  });
});
