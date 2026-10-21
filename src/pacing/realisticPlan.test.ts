import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTargetPowerZones, classifyAgainstAnchor, type PacingZone } from "./buildTargetPowerZones.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";
import type { ZoneHistory } from "./planCeilings.ts";
import { buildRealisticPlan, DEFAULT_REALISTIC_PLAN_CONFIG, type RealisticPlanConfig, type RealisticPlanResult } from "./realisticPlan.ts";

// Synthetic fixture shaped like a long steady climb with a descent early and steep pitches late.
const ZONE_METERS = 402.336;
const GRADES = [2.5, 2.1, -1.7, 4.3, 2.8, 3.2, 6.9, 6.9, 5.8, 5.1, 4.4, 7.0, 8.5, 5.9, 3.6, 4.3, 5.7, 6.3, 7.6, 5.8, 6.5, 5.8, 6.8, 5.6, 6.7, 6.5];
const FTP = 250;
const GOAL_MS = 40 * 60_000;
const ANCHOR = computeAnchorPowerWatts(FTP, GOAL_MS);

function windows(grades: readonly number[] = GRADES) {
  return grades.map((gradePct, i) => ({ startDistanceMeters: i * ZONE_METERS, endDistanceMeters: (i + 1) * ZONE_METERS, gradePct }));
}

const RAW = buildTargetPowerZones(windows(), ANCHOR, FTP);

function plan(overrides: {
  zones?: readonly PacingZone[];
  history?: readonly (ZoneHistory | undefined)[];
  config?: Partial<RealisticPlanConfig>;
  goalMs?: number;
  ftp?: number;
  anchor?: number;
  zoneSeconds?: number[];
} = {}): RealisticPlanResult {
  return buildRealisticPlan({
    zones: overrides.zones ?? RAW,
    ftpWatts: overrides.ftp ?? FTP,
    anchorPowerWatts: overrides.anchor ?? ANCHOR,
    goalDurationMs: overrides.goalMs ?? GOAL_MS,
    ...(overrides.history === undefined ? {} : { history: overrides.history }),
    ...(overrides.zoneSeconds === undefined ? {} : { zoneSeconds: overrides.zoneSeconds }),
    ...(overrides.config === undefined ? {} : { config: overrides.config }),
  });
}

/** Rules that must hold for every plan the planner returns. */
function assertValid(result: RealisticPlanResult, config: RealisticPlanConfig = DEFAULT_REALISTIC_PLAN_CONFIG, zones: readonly PacingZone[] = RAW) {
  result.zones.forEach((zone, i) => {
    assert.ok(Number.isInteger(zone.targetPowerWatts), `zone ${i} target is whole watts`);
    assert.ok(zone.targetPowerWatts <= result.ceilings[i]!.ceilingWatts, `zone ${i} target ${zone.targetPowerWatts} is within its ceiling ${result.ceilings[i]!.ceilingWatts}`);
    assert.equal(zone.classification, classifyAgainstAnchor(zone.targetPowerWatts, ANCHOR));
    assert.equal(zone.startDistanceMeters, zones[i]!.startDistanceMeters);
    if (i > 0 && zones[i - 1]!.gradePct >= config.stepLimitMinGradePct && zone.gradePct >= config.stepLimitMinGradePct) {
      assert.ok(Math.abs(zone.targetPowerWatts - result.zones[i - 1]!.targetPowerWatts) <= config.maxStepWatts, `step into zone ${i} is within ${config.maxStepWatts} W`);
    }
  });
  const reserve = result.assumptions.wPrimeJoules * config.wPrimeReserveFraction;
  assert.ok(result.minWPrimeBalanceJoules >= reserve - 1, "W' balance never drops below the reserve");
}

describe("buildRealisticPlan", () => {
  it("with no history keeps a goal at its anchor reachable and every target within its ceiling", () => {
    const result = plan();
    assertValid(result);
    assert.ok(result.ceilings.every((ceiling) => ceiling.source === "fallback"));
    assert.ok(result.feasible, `shortfall ${result.shortfallWatts.toFixed(1)} W`);
    assert.ok(result.achievedMeanWatts >= result.requiredMeanWatts * (1 - DEFAULT_REALISTIC_PLAN_CONFIG.feasibleToleranceFraction));
    const peakRaw = Math.max(...RAW.map((zone) => zone.targetPowerWatts));
    const peakNow = Math.max(...result.zones.map((zone) => zone.targetPowerWatts));
    assert.ok(peakNow < peakRaw, `the steepest pitch is trimmed (${peakRaw} -> ${peakNow})`);
  });

  it("trims a pitch above what history shows and hands the effort to later, easier zones within their ceilings", () => {
    const history: ZoneHistory[] = RAW.map(() => ({ bestHeldWatts: 270, attemptsWithData: 2 }));
    history[12] = { bestHeldWatts: 250, attemptsWithData: 2 }; // the 8.5% pitch: never held more than 250 W
    const result = plan({ history });
    assertValid(result);
    assert.equal(result.ceilings[12]!.ceilingWatts, Math.floor(250 * 1.04));
    assert.ok(RAW[12]!.targetPowerWatts > result.ceilings[12]!.ceilingWatts);
    assert.equal(result.zones[12]!.targetPowerWatts <= 260, true);
    assert.ok(result.trimmedZoneIndices.includes(12));
    const firstTrimmed = Math.min(...result.trimmedZoneIndices);
    assert.ok(result.raisedZoneIndices.length > 0, "some later zone takes over effort");
    assert.ok(result.raisedZoneIndices.every((index) => index > firstTrimmed), "effort moves only forward");
    assert.ok(result.feasible, "the lost effort fits in the following zones");
  });

  it("uses the fallback for zones without history and history only where the rider has ridden", () => {
    const history: (ZoneHistory | undefined)[] = RAW.map(() => undefined);
    history[3] = { bestHeldWatts: 280, attemptsWithData: 1 };
    history[4] = { bestHeldWatts: 275, attemptsWithData: 1 };
    const result = plan({ history });
    assertValid(result);
    assert.deepEqual(
      result.ceilings.map((ceiling) => ceiling.source).filter((source) => source === "history").length,
      2,
    );
    assert.equal(result.ceilings[3]!.source, "history");
    assert.equal(result.ceilings[5]!.source, "fallback");
  });

  it("when the goal is out of reach returns the best achievable plan and the shortfall, never raising a target above a ceiling", () => {
    const history: ZoneHistory[] = RAW.map(() => ({ bestHeldWatts: 205, attemptsWithData: 3 }));
    const result = plan({ history });
    assertValid(result);
    assert.equal(result.feasible, false);
    assert.ok(result.shortfallWatts > 20, `shortfall ${result.shortfallWatts.toFixed(1)} W`);
    assert.ok(result.achievedMeanWatts < result.requiredMeanWatts);
    assert.ok(result.zones.every((zone) => zone.targetPowerWatts <= Math.floor(205 * 1.04)));
  });

  it("guards the energy budget: a plan that spends more than W' above critical power is cut back, and it still never exceeds its ceilings", () => {
    const tight = plan({ config: { wPrimeJoulesPerFtpWatt: 8 } }); // W' 2 kJ at 250 W FTP
    assertValid(tight, { ...DEFAULT_REALISTIC_PLAN_CONFIG, wPrimeJoulesPerFtpWatt: 8 });
    assert.ok(tight.budgetLimitedZoneIndices.length > 0, "the W' guard binds");
    assert.ok(tight.minWPrimeBalanceJoules >= 2000 * DEFAULT_REALISTIC_PLAN_CONFIG.wPrimeReserveFraction - 1);
    const loose = plan({ config: { wPrimeJoulesPerFtpWatt: 400 } });
    assert.equal(loose.budgetLimitedZoneIndices.length, 0, "a huge W' never binds");
    assert.ok(tight.achievedMeanWatts <= loose.achievedMeanWatts + 0.01);
    assert.equal(tight.assumptions.wPrimeJoules, 2000);
    assert.equal(loose.assumptions.criticalPowerWatts, 250);
  });

  it("limits the step between adjacent climbing zones to the configured size and leaves descents free", () => {
    for (const maxStepWatts of [10, 20]) {
      const config = { ...DEFAULT_REALISTIC_PLAN_CONFIG, maxStepWatts };
      const result = plan({ config });
      assertValid(result, config);
    }
    const result = plan();
    // zones 2 -> 3 -> 4 sit around the 1.7% descent, which is exempt from the step limit
    const stepAroundDescent = Math.abs(result.zones[3]!.targetPowerWatts - result.zones[2]!.targetPowerWatts);
    assert.ok(stepAroundDescent > DEFAULT_REALISTIC_PLAN_CONFIG.maxStepWatts, `descent step ${stepAroundDescent}`);
  });

  it("is deterministic and does not modify its input", () => {
    const frozen = RAW.map((zone) => Object.freeze({ ...zone }));
    const history: ZoneHistory[] = RAW.map((_, i) => ({ bestHeldWatts: 240 + (i % 5) * 8, attemptsWithData: 1 }));
    const a = plan({ zones: frozen, history });
    const b = plan({ zones: frozen, history });
    assert.deepEqual(a, b);
    assert.deepEqual(frozen.map((zone) => zone.targetPowerWatts), RAW.map((zone) => zone.targetPowerWatts));
  });

  it("uses supplied zone times for the W' guard instead of the default share-out", () => {
    const slow = plan({ zoneSeconds: RAW.map(() => 400) });
    const fast = plan({ zoneSeconds: RAW.map(() => 20) });
    assertValid(slow);
    assertValid(fast);
    assert.ok(fast.minWPrimeBalanceJoules > slow.minWPrimeBalanceJoules);
  });

  it("returns an empty, feasible plan for no zones and works for a single zone", () => {
    const none = plan({ zones: [] });
    assert.deepEqual(none.zones, []);
    assert.equal(none.feasible, true);
    const one = buildTargetPowerZones(windows([5]), ANCHOR, FTP);
    const result = plan({ zones: one });
    assert.equal(result.zones.length, 1);
    assert.ok(result.zones[0]!.targetPowerWatts <= result.ceilings[0]!.ceilingWatts);
  });

  it("leaves a plan alone when nothing needs trimming", () => {
    const flat = buildTargetPowerZones(windows(GRADES.map(() => 4)), ANCHOR, FTP);
    const result = plan({ zones: flat });
    assert.deepEqual(result.zones.map((zone) => zone.targetPowerWatts), flat.map((zone) => zone.targetPowerWatts));
    assert.equal(result.trimmedZoneIndices.length, 0);
    assert.equal(result.raisedZoneIndices.length, 0);
    assert.ok(result.feasible);
  });

  it("scales for a short hard goal: a 10-minute goal is not capped at an hour's power", () => {
    const shortAnchor = computeAnchorPowerWatts(FTP, 10 * 60_000);
    const zones = buildTargetPowerZones(windows([3, 4, 5, 6, 5, 4, 5, 6]), shortAnchor, FTP);
    const result = plan({ zones, anchor: shortAnchor, goalMs: 10 * 60_000, config: { wPrimeJoulesPerFtpWatt: 200 } });
    assert.ok(result.achievedMeanWatts > FTP, "still above FTP for a 10-minute effort");
    assert.ok(result.feasible);
  });
});
