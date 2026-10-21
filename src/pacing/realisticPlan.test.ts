import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTargetPowerZones, classifyAgainstAnchor, type PacingZone } from "./buildTargetPowerZones.ts";
import { computeAnchorPowerWatts } from "./powerDurationAnchor.ts";
import type { ZoneHistory } from "./planCeilings.ts";
import type { EffortSummary } from "./planCeilings.ts";
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
  efforts?: readonly EffortSummary[];
  evidencedFloorWatts?: readonly (number | null)[];
} = {}): RealisticPlanResult {
  return buildRealisticPlan({
    zones: overrides.zones ?? RAW,
    ftpWatts: overrides.ftp ?? FTP,
    anchorPowerWatts: overrides.anchor ?? ANCHOR,
    goalDurationMs: overrides.goalMs ?? GOAL_MS,
    ...(overrides.history === undefined ? {} : { history: overrides.history }),
    ...(overrides.zoneSeconds === undefined ? {} : { zoneSeconds: overrides.zoneSeconds }),
    ...(overrides.efforts === undefined ? {} : { efforts: overrides.efforts }),
    ...(overrides.evidencedFloorWatts === undefined ? {} : { evidencedFloorWatts: overrides.evidencedFloorWatts }),
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
    if (i > 0) {
      assert.ok(Math.abs(zone.targetPowerWatts - result.zones[i - 1]!.targetPowerWatts) <= config.hardMaxStepWatts, `step into zone ${i} is within the hard ${config.hardMaxStepWatts} W cap`);
    }
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

  it("never lets adjacent targets differ by more than the hard cap, even beside a steep descent with high ceilings", () => {
    const grades = [5, 5, 5, -8, 5, 8.5, 8.5, 5, 5, 5, 5, 5];
    const zones = buildTargetPowerZones(windows(grades), ANCHOR, FTP);
    const history: ZoneHistory[] = zones.map(() => ({ bestHeldWatts: 245, attemptsWithData: 2 }));
    const result = plan({ zones, history });
    assertValid(result, DEFAULT_REALISTIC_PLAN_CONFIG, zones);
    for (let i = 1; i < result.zones.length; i += 1) {
      assert.ok(Math.abs(result.zones[i]!.targetPowerWatts - result.zones[i - 1]!.targetPowerWatts) <= DEFAULT_REALISTIC_PLAN_CONFIG.hardMaxStepWatts);
    }
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

describe("redistribution only moves effort forward", () => {
  it("never raises a zone that comes before every trimmed zone", () => {
    // Plenty of room early, one pitch near the end trimmed by its ceiling: the early zones must stay as the raw plan had them.
    const grades = [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8.5, 3, 3];
    const zones = buildTargetPowerZones(windows(grades), ANCHOR, FTP);
    const history: ZoneHistory[] = zones.map(() => ({ bestHeldWatts: 300, attemptsWithData: 3 }));
    history[12] = { bestHeldWatts: 230, attemptsWithData: 3 };
    const result = plan({ zones, history });
    assertValid(result, DEFAULT_REALISTIC_PLAN_CONFIG, zones);
    assert.ok(result.trimmedZoneIndices.includes(12));
    for (let i = 0; i < 12; i += 1) assert.equal(result.zones[i]!.targetPowerWatts, zones[i]!.targetPowerWatts, `zone ${i} is unchanged`);
    assert.ok(result.raisedZoneIndices.every((index) => index > 12));
  });
});

describe("critical power from history", () => {
  const effort = (minutes: number, meanWatts: number | null): EffortSummary => ({ durationSeconds: minutes * 60, meanWatts, zoneWatts: RAW.map(() => meanWatts) });

  it("uses FTP when there is no usable effort", () => {
    assert.equal(plan().assumptions.criticalPowerSource, "ftp");
    assert.equal(plan({ efforts: [effort(5, 400), effort(200, 300), effort(40, null)] }).assumptions.criticalPowerSource, "ftp");
  });

  it("lets a 30 to 60 minute effort raise critical power: CP >= average power - W'/duration", () => {
    const result = plan({ efforts: [effort(45, 275)] });
    // W' is 20 kJ at 250 W FTP: 275 - 20000/2700 = 267.6
    assert.equal(result.assumptions.criticalPowerSource, "history");
    assert.equal(result.assumptions.criticalPowerWatts, 268);
  });

  it("never lowers critical power below the FTP-based value, and caps the lift", () => {
    assert.equal(plan({ efforts: [effort(45, 200)] }).assumptions.criticalPowerWatts, 250);
    assert.equal(plan({ efforts: [effort(45, 600)] }).assumptions.criticalPowerWatts, Math.round(250 * DEFAULT_REALISTIC_PLAN_CONFIG.historyCpMaxFractionOfFtp));
  });

  it("a higher critical power lets the plan keep more of its late power", () => {
    const lowCp = plan();
    const highCp = plan({ efforts: [effort(45, 290)] });
    assert.ok(highCp.achievedMeanWatts >= lowCp.achievedMeanWatts);
    assert.ok(highCp.budgetLimitedZoneIndices.length <= lowCp.budgetLimitedZoneIndices.length);
  });
});

describe("evidenced floors", () => {
  it("never plan below the power a past effort held, even where the energy budget would cut it", () => {
    const tight = { wPrimeJoulesPerFtpWatt: 8 };
    const floorWatts = RAW.map((_, i) => (i >= 14 ? 262 : null));
    const without = plan({ config: tight });
    const withFloor = plan({ config: tight, evidencedFloorWatts: floorWatts });
    assert.ok(without.zones.slice(14).some((zone) => zone.targetPowerWatts < 262), "the budget alone cuts these zones");
    assert.ok(withFloor.zones.slice(14).every((zone) => zone.targetPowerWatts >= 262));
    assert.deepEqual(withFloor.floorZoneIndices.length > 0, true);
    withFloor.zones.forEach((zone, i) => {
      if (i > 0) assert.ok(Math.abs(zone.targetPowerWatts - withFloor.zones[i - 1]!.targetPowerWatts) <= DEFAULT_REALISTIC_PLAN_CONFIG.hardMaxStepWatts);
    });
  });

  it("ignores null floors and applies only from the configured fraction of the segment", () => {
    const floors = RAW.map(() => 270);
    const late = plan({ evidencedFloorWatts: floors, config: { evidencedFloorFromFraction: 0.5 } });
    assert.ok(late.zones.slice(13).every((zone) => zone.targetPowerWatts >= 270));
    assert.ok(late.zones.slice(0, 13).some((zone) => zone.targetPowerWatts < 270), "early zones are not floored");
    const none = plan({ evidencedFloorWatts: RAW.map(() => null) });
    assert.deepEqual(none.zones.map((zone) => zone.targetPowerWatts), plan().zones.map((zone) => zone.targetPowerWatts));
    assert.deepEqual(none.floorZoneIndices, []);
  });
});
