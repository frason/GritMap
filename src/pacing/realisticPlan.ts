import { retargetZone, type PacingZone } from "./buildTargetPowerZones.ts";
import {
  computeZoneCeilings,
  DEFAULT_PLAN_CEILING_CONFIG,
  type PlanCeilingConfig,
  type ZoneCeiling,
  type ZoneHistory,
} from "./planCeilings.ts";

/**
 * Turns the grade-shaped plan from buildTargetPowerZones into one the rider can actually ride (GOALS
 * priority 8): no target above its ceiling, the energy-budget (W') guard satisfied, adjacent climbing
 * targets no more than a few watts apart, and effort that had to be trimmed moved to the following,
 * easier zones within their ceilings. If the goal cannot be reached that way, the result is the best
 * achievable plan and says how far short it falls; targets are never raised above a ceiling to hit
 * the goal. Pure and deterministic. The W' model is an assumption (see the config), not a measurement.
 */
export interface RealisticPlanConfig extends PlanCeilingConfig {
  /** Largest change in target between two adjacent climbing zones (W). */
  maxStepWatts: number;
  /** The step limit applies only between zones at least this steep (%). Flats and descents are recovery and exempt. */
  stepLimitMinGradePct: number;
  /**
   * The largest change allowed between ANY two adjacent zones (W), recoveries included. The Karoo rejects a
   * whole plan when adjacent targets differ by more than 100 W (AiPlanValidator), so this keeps a margin under it.
   */
  hardMaxStepWatts: number;
  /** How strongly redistribution prefers easier grades: weight = room / (1 + grade% * bias). */
  easierGradeBias: number;
  /** Critical power as a fraction of FTP. ASSUMPTION: 1.0, the conservative end (CP is usually a little higher). */
  criticalPowerFractionOfFtp: number;
  /** W' (work above critical power) in joules per watt of FTP. ASSUMPTION: 80, i.e. 20 kJ at 250 W FTP. */
  wPrimeJoulesPerFtpWatt: number;
  /** Share of W' that must stay unspent at every point, so the plan never empties the tank before the finish. */
  wPrimeReserveFraction: number;
  /** A plan averaging within this fraction of the required mean counts as meeting the goal. */
  feasibleToleranceFraction: number;
  /** Cap on W'-guard tightening rounds. */
  maxOuterIterations: number;
}

export const DEFAULT_REALISTIC_PLAN_CONFIG: RealisticPlanConfig = {
  ...DEFAULT_PLAN_CEILING_CONFIG,
  maxStepWatts: 20,
  stepLimitMinGradePct: 1.5,
  hardMaxStepWatts: 80,
  easierGradeBias: 0.1,
  criticalPowerFractionOfFtp: 1.0,
  wPrimeJoulesPerFtpWatt: 80,
  wPrimeReserveFraction: 0.15,
  feasibleToleranceFraction: 0.02,
  maxOuterIterations: 40,
};

export interface RealisticPlanInput {
  /** The raw grade-shaped zones (buildTargetPowerZones output). */
  zones: readonly PacingZone[];
  ftpWatts: number;
  /** The plan's anchor power, used for the REST/HOLD/PUSH wording. */
  anchorPowerWatts: number;
  goalDurationMs: number;
  /** What past efforts held in each zone (summarizeZoneHistory); absent or sparse means the fallback ceilings apply. */
  history?: readonly (ZoneHistory | undefined)[];
  /** Estimated seconds spent in each zone, for the W' guard; defaults to the goal time shared out by distance. */
  zoneSeconds?: readonly number[];
  config?: Partial<RealisticPlanConfig>;
}

export interface RealisticPlanResult {
  zones: PacingZone[];
  ceilings: ZoneCeiling[];
  /** Distance-weighted mean target (W) the raw plan asked for. */
  requiredMeanWatts: number;
  /** Distance-weighted mean target (W) of the plan that can be ridden. */
  achievedMeanWatts: number;
  /** Required minus achieved, never negative (W). */
  shortfallWatts: number;
  /** True when the plan still averages the required power, within tolerance. */
  feasible: boolean;
  /** Zones whose target is lower than the raw plan's, and zones whose target was raised to take over effort. */
  trimmedZoneIndices: number[];
  raisedZoneIndices: number[];
  /** Zones where the W' guard, not the ceiling, set the limit. */
  budgetLimitedZoneIndices: number[];
  /** The lowest W' balance reached along the final plan (J). */
  minWPrimeBalanceJoules: number;
  /** The assumed critical power (W) and W' (J) that produced it. */
  assumptions: { criticalPowerWatts: number; wPrimeJoules: number };
}

export function buildRealisticPlan(input: RealisticPlanInput): RealisticPlanResult {
  const config = { ...DEFAULT_REALISTIC_PLAN_CONFIG, ...input.config };
  const raw = input.zones;
  const count = raw.length;
  const criticalPowerWatts = input.ftpWatts * config.criticalPowerFractionOfFtp;
  const wPrimeJoules = input.ftpWatts * config.wPrimeJoulesPerFtpWatt;
  const reserveJoules = wPrimeJoules * config.wPrimeReserveFraction;
  const base = {
    assumptions: { criticalPowerWatts: Math.round(criticalPowerWatts), wPrimeJoules: Math.round(wPrimeJoules) },
  };
  if (count === 0) {
    return { ...base, zones: [], ceilings: [], requiredMeanWatts: 0, achievedMeanWatts: 0, shortfallWatts: 0, feasible: true, trimmedZoneIndices: [], raisedZoneIndices: [], budgetLimitedZoneIndices: [], minWPrimeBalanceJoules: wPrimeJoules };
  }

  const lengths = raw.map((zone) => zone.endDistanceMeters - zone.startDistanceMeters);
  const totalLength = lengths.reduce((sum, length) => sum + length, 0);
  const rawTargets = raw.map((zone) => zone.targetPowerWatts);
  const requiredEnergy = weightedSum(rawTargets, lengths);
  const ceilings = computeZoneCeilings({
    zones: raw,
    ftpWatts: input.ftpWatts,
    anchorPowerWatts: input.anchorPowerWatts,
    ...(input.history === undefined ? {} : { history: input.history }),
    config,
  });
  const seconds =
    input.zoneSeconds !== undefined && input.zoneSeconds.length === count
      ? [...input.zoneSeconds]
      : lengths.map((length) => (totalLength > 0 ? (input.goalDurationMs / 1000) * (length / totalLength) : 0));
  const minWatts = Math.floor(input.ftpWatts * config.minPctFtp);

  /** The largest allowed change between zone i and zone i + 1: tight between climbing zones, the hard cap elsewhere. */
  const pairLimit = raw.map((zone, i) =>
    i + 1 < count && zone.gradePct >= config.stepLimitMinGradePct && raw[i + 1]!.gradePct >= config.stepLimitMinGradePct
      ? config.maxStepWatts
      : config.hardMaxStepWatts,
  );

  // Limits start at the ceilings and are tightened wherever the W' guard finds an overspend; the trimmed
  // effort is then redistributed again under the tighter limits, until the plan settles.
  const limits = ceilings.map((ceiling) => ceiling.ceilingWatts);
  const budgetLimited = new Set<number>();
  let changed = false;
  let targets = fill();
  for (let round = 0; round < config.maxOuterIterations; round += 1) {
    if (!tightenLimitsToBudget(targets)) break;
    targets = fill();
  }
  // Whatever happened above, the plan handed back never overspends W' (lowering power only helps it).
  targets = clampToBudget(targets, false);
  lowerToStepLimit(targets);
  const balance = simulateWPrime(targets);

  const achievedEnergy = weightedSum(targets, lengths);
  const requiredMean = totalLength > 0 ? requiredEnergy / totalLength : 0;
  const achievedMean = totalLength > 0 ? achievedEnergy / totalLength : 0;
  const shortfall = Math.max(0, requiredMean - achievedMean);
  const zones = raw.map((zone, i) => (targets[i] === zone.targetPowerWatts ? { ...zone } : retargetZone(zone, targets[i]!, input.anchorPowerWatts)));
  return {
    ...base,
    zones,
    ceilings,
    requiredMeanWatts: requiredMean,
    achievedMeanWatts: achievedMean,
    shortfallWatts: shortfall,
    feasible: shortfall <= requiredMean * config.feasibleToleranceFraction,
    trimmedZoneIndices: targets.flatMap((value, i) => (value < rawTargets[i]! ? [i] : [])),
    raisedZoneIndices: targets.flatMap((value, i) => (value > rawTargets[i]! ? [i] : [])),
    budgetLimitedZoneIndices: [...budgetLimited].sort((a, b) => a - b),
    minWPrimeBalanceJoules: balance.minimum,
  };

  /** The most power zone `i` can take given the W' left on entering it, ignoring any recovery inside the zone. */
  function allowedAt(balanceBefore: number, i: number): number {
    return Math.max(minWatts, Math.floor(criticalPowerWatts + (balanceBefore - reserveJoules) / Math.max(seconds[i]!, 1)));
  }

  /** Forward pass: lowers any zone that would spend more W' than is left. With `record`, also tightens that zone's limit. */
  function clampToBudget(t: readonly number[], record: boolean): number[] {
    const clamped = [...t];
    let bal = wPrimeJoules;
    for (let i = 0; i < count; i += 1) {
      const allowed = allowedAt(bal, i);
      if (clamped[i]! > allowed) {
        clamped[i] = allowed;
        if (record && allowed < limits[i]!) {
          limits[i] = allowed;
          budgetLimited.add(i);
          changed = true;
        }
      }
      bal = stepWPrime(bal, clamped[i]!, seconds[i]!);
    }
    return clamped;
  }
  /** True when the plan overspends W' somewhere and a limit was tightened because of it. */
  function tightenLimitsToBudget(t: readonly number[]): boolean {
    changed = false;
    clampToBudget(t, true);
    return changed;
  }

  /** Cap at the limits, smooth the climbing steps, then move the trimmed effort to following zones with room. */
  function fill(): number[] {
    const t = rawTargets.map((value, i) => Math.min(value, limits[i]!));
    lowerToStepLimit(t);
    const firstLowered = t.findIndex((value, i) => value < rawTargets[i]!);
    if (firstLowered !== -1) redistribute(t, firstLowered);
    for (let i = 0; i < count; i += 1) t[i] = Math.min(Math.round(t[i]!), limits[i]!);
    lowerToStepLimit(t);
    return t;
  }

  /** Two passes lower peaks until no two adjacent zones differ by more than their step limit. */
  function lowerToStepLimit(t: number[]): void {
    for (let i = 1; i < count; i += 1) t[i] = Math.min(t[i]!, t[i - 1]! + pairLimit[i - 1]!);
    for (let i = count - 2; i >= 0; i -= 1) t[i] = Math.min(t[i]!, t[i + 1]! + pairLimit[i]!);
  }

  function roomAt(t: readonly number[], j: number): number {
    let limit = limits[j]!;
    if (j > 0) limit = Math.min(limit, t[j - 1]! + pairLimit[j - 1]!);
    if (j + 1 < count) limit = Math.min(limit, t[j + 1]! + pairLimit[j]!);
    return Math.max(0, limit - t[j]!);
  }

  /** Hands the energy lost to trimming (watt-metres) to the zones after the first trimmed one, easier grades first. */
  function redistribute(t: number[], firstLowered: number): void {
    let remaining = requiredEnergy - weightedSum(t, lengths);
    const tolerance = totalLength * 0.05;
    for (let pass = 0; pass < 200 && remaining > tolerance; pass += 1) {
      const weights: number[] = [];
      let totalWeight = 0;
      for (let j = 0; j < count; j += 1) {
        const room = j > firstLowered ? roomAt(t, j) : 0;
        const weight = room / (1 + Math.max(0, raw[j]!.gradePct) * config.easierGradeBias);
        weights.push(weight);
        totalWeight += weight;
      }
      if (totalWeight <= 1e-9) return;
      const budget = remaining;
      for (let j = firstLowered + 1; j < count; j += 1) {
        if (weights[j]! <= 0) continue;
        const raise = Math.min(roomAt(t, j), (budget * (weights[j]! / totalWeight)) / lengths[j]!);
        if (raise <= 0) continue;
        t[j] = t[j]! + raise;
        remaining -= raise * lengths[j]!;
      }
    }
  }

  /** W' left after riding `power` for `duration` seconds: spent above critical power, regained below it (Skiba's differential form). */
  function stepWPrime(balanceBefore: number, power: number, duration: number): number {
    let bal = balanceBefore;
    const subSteps = Math.max(1, Math.ceil(duration / 10));
    const dt = duration / subSteps;
    for (let s = 0; s < subSteps; s += 1) {
      bal += power > criticalPowerWatts ? -(power - criticalPowerWatts) * dt : ((criticalPowerWatts - power) * (wPrimeJoules - bal) * dt) / wPrimeJoules;
      bal = Math.min(bal, wPrimeJoules);
    }
    return bal;
  }

  /** The lowest W' balance reached along the plan, checked at the end of every ten-second step. */
  function simulateWPrime(t: readonly number[]): { minimum: number } {
    let bal = wPrimeJoules;
    let minimum = bal;
    for (let i = 0; i < count; i += 1) {
      const subSteps = Math.max(1, Math.ceil(seconds[i]! / 10));
      const dt = seconds[i]! / subSteps;
      for (let s = 0; s < subSteps; s += 1) {
        bal = stepWPrime(bal, t[i]!, dt);
        if (bal < minimum) minimum = bal;
      }
    }
    return { minimum };
  }
}

function weightedSum(values: readonly number[], weights: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i]! * weights[i]!;
  return sum;
}
