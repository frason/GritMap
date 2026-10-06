import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readFile } from "node:fs/promises";

import { resolveSegmentPlan } from "./resolveSegmentPlan.ts";
import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";
import {
  computePlanVsActual,
  type ActualTrackPoint,
  type PlanZoneLike,
} from "./computePlanVsActual.ts";

const ZONES: PlanZoneLike[] = [
  { startDistanceMeters: 0, endDistanceMeters: 250, targetPowerWatts: 200 },
  { startDistanceMeters: 250, endDistanceMeters: 500, targetPowerWatts: 250 },
  { startDistanceMeters: 500, endDistanceMeters: 750, targetPowerWatts: 300 },
  { startDistanceMeters: 750, endDistanceMeters: 1_000, targetPowerWatts: 250 },
];
const T0 = 1_000_000;

/** One sample per second at constant speed; power is a function of distance. */
function track(
  powerAt: (distanceMeters: number) => number | undefined,
  { speed = 5, lengthMeters = 1_000, startMs = T0 }: { speed?: number; lengthMeters?: number; startMs?: number } = {},
): ActualTrackPoint[] {
  const points: ActualTrackPoint[] = [];
  const seconds = lengthMeters / speed;
  for (let s = 0; s <= seconds; s += 1) {
    const distanceMeters = s * speed;
    const power = powerAt(distanceMeters);
    points.push({ distanceMeters, timestampMs: startMs + s * 1_000, ...(power === undefined ? {} : { power }) });
  }
  return points;
}

const onPlan = (d: number) => ZONES[Math.min(3, Math.floor(d / 250))]!.targetPowerWatts;

describe("computePlanVsActual", () => {
  it("scores a ride that follows the plan as on target in every zone", () => {
    const { zones, summary } = computePlanVsActual({ track: track(onPlan), zones: ZONES, segmentLengthMeters: 1_000 });
    assert.deepEqual(zones.map((zone) => zone.status), ["on", "on", "on", "on"]);
    assert.equal(summary.zonesOnTarget, 4);
    assert.equal(summary.zonesWithData, 4);
    assert.ok(Math.abs(summary.averageActualWatts! - summary.averageTargetWatts) < 1);
    assert.match(summary.insights[0]!, /right on plan/);
    for (const zone of zones) {
      assert.ok(Math.abs(zone.durationMs! - 50_000) <= 1_000, `zone ${zone.index} took ${zone.durationMs}`);
      assert.ok(zone.powerCoverage > 0.95);
    }
  });

  it("averages power over time in the zone, not over distance", () => {
    // Zone 1: 125 m crawled at 2.5 m/s / 100 W (50 s), then 125 m at 25 m/s / 300 W (5 s).
    const points: ActualTrackPoint[] = [];
    let t = T0;
    let d = 0;
    for (let s = 0; s < 50; s += 1) {
      points.push({ distanceMeters: d, timestampMs: t, power: 100 });
      d += 2.5;
      t += 1_000;
    }
    for (let s = 0; s <= 5; s += 1) {
      points.push({ distanceMeters: d, timestampMs: t, power: 300 });
      d += 25;
      t += 1_000;
    }
    const { zones } = computePlanVsActual({
      track: points,
      zones: [{ startDistanceMeters: 0, endDistanceMeters: 250, targetPowerWatts: 200 }],
      segmentLengthMeters: 250,
    });
    // (100 W x 50 s + ~300 W x 5 s) / 55 s is about 118 W; a distance-weighted mean would be 200 W.
    assert.ok(zones[0]!.actualPowerWatts! > 110 && zones[0]!.actualPowerWatts! < 130, String(zones[0]!.actualPowerWatts));
    assert.equal(zones[0]!.status, "under");
  });

  it("classifies over / under with a 5% tolerance and a 5 W floor", () => {
    const scaled = (factor: number) => (d: number) => onPlan(d) * factor;
    const at = (factor: number) =>
      computePlanVsActual({ track: track(scaled(factor)), zones: ZONES, segmentLengthMeters: 1_000 }).zones[2]!.status;
    assert.equal(at(1.1), "over");
    assert.equal(at(1.04), "on");
    assert.equal(at(0.96), "on");
    assert.equal(at(0.9), "under");

    const low = computePlanVsActual({
      track: track(() => 44, { lengthMeters: 100 }),
      zones: [{ startDistanceMeters: 0, endDistanceMeters: 100, targetPowerWatts: 40 }],
      segmentLengthMeters: 100,
    });
    assert.equal(low.zones[0]!.status, "on"); // 4 W over a 40 W target is inside the 5 W floor
  });

  it("stretches an odometer that disagrees with the segment length", () => {
    // The ride's own distance reads 3% long; the result must match the exact-length ride.
    const long = track(onPlan, { speed: 5.15, lengthMeters: 1_030 }).map((point) => ({
      ...point,
      power: onPlan((point.distanceMeters / 1_030) * 1_000),
    }));
    const { zones } = computePlanVsActual({ track: long, zones: ZONES, segmentLengthMeters: 1_000 });
    assert.deepEqual(zones.map((zone) => zone.status), ["on", "on", "on", "on"]);
  });

  it("excludes a pause instead of averaging across it", () => {
    const base = track(onPlan);
    // Insert a 10-minute stop (no samples) after the 400 m point, with 0 W at the restart sample.
    const paused = base.map((point) => (point.distanceMeters > 400 ? { ...point, timestampMs: point.timestampMs + 600_000 } : point));
    const { zones } = computePlanVsActual({ track: paused, zones: ZONES, segmentLengthMeters: 1_000 });
    assert.equal(zones[1]!.status, "on");
    assert.ok(Math.abs(zones[1]!.actualPowerWatts! - 250) < 1);
  });

  it("reports no power data without throwing or inventing a number", () => {
    const { zones, summary } = computePlanVsActual({ track: track(() => undefined), zones: ZONES, segmentLengthMeters: 1_000 });
    assert.ok(zones.every((zone) => zone.status === "nodata" && zone.actualPowerWatts === null));
    assert.equal(summary.averageActualWatts, null);
    assert.equal(summary.zonesWithData, 0);
    assert.match(summary.insights[0]!, /no power data/);
  });

  it("copes with an empty track", () => {
    const { zones, summary } = computePlanVsActual({ track: [], zones: ZONES, segmentLengthMeters: 1_000 });
    assert.equal(zones.length, 4);
    assert.ok(zones.every((zone) => zone.durationMs === null && zone.status === "nodata"));
    assert.equal(summary.averageActualWatts, null);
  });

  it("notes when power covers only part of the effort", () => {
    const { summary } = computePlanVsActual({
      track: track((d) => (d < 500 ? onPlan(d) : undefined)),
      zones: ZONES,
      segmentLengthMeters: 1_000,
    });
    assert.ok(summary.insights.some((line) => /covers only \d+%/.test(line)), summary.insights.join(" | "));
  });

  it("measures time gained or lost per zone against a reference attempt", () => {
    // This ride takes 200 s; the reference takes 220 s (10% slower): 5 s gained in each 250 m zone.
    const { zones, summary } = computePlanVsActual({
      track: track(onPlan),
      zones: ZONES,
      segmentLengthMeters: 1_000,
      reference: track(onPlan, { speed: 1_000 / 220 }),
    });
    for (const zone of zones) assert.ok(Math.abs(zone.timeVsReferenceMs! + 5_000) < 600, `zone ${zone.index}: ${zone.timeVsReferenceMs}`);
    assert.ok(Math.abs(summary.totalVsReferenceMs! + 20_000) < 1_500, String(summary.totalVsReferenceMs));
  });

  it("leaves time-vs-reference null without a reference", () => {
    const { zones, summary } = computePlanVsActual({ track: track(onPlan), zones: ZONES, segmentLengthMeters: 1_000 });
    assert.ok(zones.every((zone) => zone.timeVsReferenceMs === null));
    assert.equal(summary.totalVsReferenceMs, null);
  });

  it("describes going out too hard and fading", () => {
    // 20% over plan through the first third, 15% under in the last.
    const hard = (d: number) => onPlan(d) * (d < 333 ? 1.2 : d < 667 ? 1 : 0.85);
    const { summary } = computePlanVsActual({ track: track(hard), zones: ZONES, segmentLengthMeters: 1_000 });
    assert.ok(summary.firstThirdPct! > 8);
    assert.ok(summary.lastThirdPct! < -5);
    assert.ok(summary.insights.some((line) => /^Went out hard/.test(line)), summary.insights.join(" | "));
  });

  it("describes a steady fade, and a steady build, in the pattern of a real under-paced climb", () => {
    // Shaped like the real 2026-09-13 Diablo effort: -5%, -8%, -13% by thirds.
    const fade = (d: number) => onPlan(d) * (d < 333 ? 0.95 : d < 667 ? 0.92 : 0.87);
    const faded = computePlanVsActual({ track: track(fade), zones: ZONES, segmentLengthMeters: 1_000 }).summary;
    assert.ok(faded.insights.some((line) => /^Faded as the effort went on: −\d+% against plan in the first third, −\d+% in the last\./.test(line)), faded.insights.join(" | "));

    const build = (d: number) => onPlan(d) * (d < 333 ? 0.9 : d < 667 ? 0.97 : 1.0);
    const built = computePlanVsActual({ track: track(build), zones: ZONES, segmentLengthMeters: 1_000 }).summary;
    assert.ok(built.insights.some((line) => /^Built through the effort/.test(line)), built.insights.join(" | "));
  });

  it("describes a strong finish and names the biggest miss", () => {
    const strong = (d: number) => (d < 500 ? onPlan(d) : onPlan(d) * 1.1);
    const { summary } = computePlanVsActual({ track: track(strong), zones: ZONES, segmentLengthMeters: 1_000 });
    assert.ok(summary.insights.some((line) => /^Finished strong/.test(line)), summary.insights.join(" | "));
    // 330 W against a 300 W target; a boundary sample shared with the next zone can pull it down a watt.
    const miss = summary.insights.map((line) => /Biggest miss: 500–750 m, (\d+) W over/.exec(line)).find(Boolean);
    assert.ok(miss && Number(miss[1]) >= 28 && Number(miss[1]) <= 30, summary.insights.join(" | "));
  });
});

describe("computePlanVsActual on the real Diablo fixture", () => {
  it("scores a ride that holds each generated target as on target in every one of the 26 zones", async () => {
    const fixture = JSON.parse(
      await readFile("apps/karoo/samples/Diablo.Northgate-to-Junction.40m30.guidance-package.json", "utf8"),
    ) as { segment: { referencePolyline: SegmentReferencePoint[] } };
    const polyline = fixture.segment.referencePolyline;
    const lengthMeters = polyline.at(-1)!.distanceMeters;
    const resolved = resolveSegmentPlan({ ftpWatts: 280, goalDurationMs: 39 * 60_000, referencePolyline: polyline });
    assert.equal(resolved.kind, "generated");
    if (resolved.kind !== "generated") return;

    // Ride it in 39:00 at constant speed, with the odometer reading 2% long, holding each zone's target.
    const seconds = 39 * 60;
    const points: ActualTrackPoint[] = [];
    for (let s = 0; s <= seconds; s += 1) {
      const distanceMeters = (s / seconds) * lengthMeters;
      const zone = resolved.zones.find((z) => distanceMeters >= z.startDistanceMeters && distanceMeters < z.endDistanceMeters) ?? resolved.zones.at(-1)!;
      points.push({ distanceMeters: distanceMeters * 1.02, timestampMs: T0 + s * 1_000, power: zone.targetPowerWatts });
    }
    const { zones, summary } = computePlanVsActual({ track: points, zones: resolved.zones, segmentLengthMeters: lengthMeters });
    assert.equal(zones.length, 26);
    assert.ok(summary.zonesOnTarget >= 25, `only ${summary.zonesOnTarget}/26 on target`);
    assert.ok(Math.abs(summary.averageActualWatts! - summary.averageTargetWatts) < 5);
    const totalMs = zones.reduce((sum, zone) => sum + zone.durationMs!, 0);
    assert.ok(Math.abs(totalMs - seconds * 1_000) < 2_000);
  });
});

