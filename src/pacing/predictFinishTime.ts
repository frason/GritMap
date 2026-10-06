import type { SegmentReferencePoint } from "../segments/resamplePolyline.ts";

/**
 * Predicts how long a pacing plan should take, from first principles: at each point along the
 * route the plan's target power must overcome gravity, rolling resistance and air drag, and the
 * speed that balances them gives the time over that stretch. The model is a standard
 * steady-state cycling power equation, so it is most trustworthy on climbs (where gravity
 * dominates and the result barely depends on drag) and least on fast or windy sections.
 *
 * Its inputs are the rider's weight and the route's elevation; everything else is a fixed,
 * documented assumption. `calibrationFactor` (below) removes the biggest remaining error --
 * the rider's real bike mass, position and conditions -- by comparing the model's prediction
 * for one of the rider's own past efforts with how long it actually took.
 */
export interface RiderBikeModel {
  /** Rider weight in kg. */
  riderWeightKg: number;
  /** Bike, shoes, helmet, bottles and clothing. */
  bikeAndKitKg?: number;
  /** Drag area in m^2. 0.36 is an upright, hands-on-hoods climbing position. */
  cdaSquareMeters?: number;
  /** Rolling resistance coefficient. 0.005 is a good road tyre on decent asphalt. */
  rollingResistance?: number;
  /** Air density in kg/m^3. */
  airDensity?: number;
  /** Fraction of pedal power reaching the wheel. */
  drivetrainEfficiency?: number;
}

export const DEFAULT_BIKE_AND_KIT_KG = 9.5;
export const DEFAULT_CDA = 0.36;
export const DEFAULT_ROLLING_RESISTANCE = 0.005;
export const DEFAULT_AIR_DENSITY = 1.2;
export const DEFAULT_DRIVETRAIN_EFFICIENCY = 0.975;

/** Riders brake and coast on descents, so a plan watt target never turns into an unbounded speed. */
export const MAX_SPEED_METERS_PER_SECOND = 16;
const MIN_SPEED_METERS_PER_SECOND = 0.8;
const GRAVITY = 9.80665;
const STEP_METERS = 50;
/** Grade is measured over this much road around each step, to ride out per-sample elevation noise. */
const GRADE_WINDOW_METERS = 100;
const MAX_ABS_GRADE = 0.25;

export interface PredictionZone {
  startDistanceMeters: number;
  endDistanceMeters: number;
  targetPowerWatts: number;
}

export interface FinishTimePrediction {
  durationMs: number;
  /** False when the route has too little elevation data for the grade to mean anything. */
  hasElevation: boolean;
}

/** The speed (m/s) at which pedal power `watts` exactly balances the resistances on `grade` (rise/run). */
export function solveSpeedMetersPerSecond(watts: number, grade: number, model: RiderBikeModel): number {
  const mass = model.riderWeightKg + (model.bikeAndKitKg ?? DEFAULT_BIKE_AND_KIT_KG);
  const cda = model.cdaSquareMeters ?? DEFAULT_CDA;
  const crr = model.rollingResistance ?? DEFAULT_ROLLING_RESISTANCE;
  const rho = model.airDensity ?? DEFAULT_AIR_DENSITY;
  const efficiency = model.drivetrainEfficiency ?? DEFAULT_DRIVETRAIN_EFFICIENCY;

  const slope = Math.atan(grade);
  const staticForce = mass * GRAVITY * (Math.sin(slope) + crr * Math.cos(slope));
  const wheelPower = Math.max(0, watts) * efficiency;
  const residual = (speed: number) => speed * staticForce + 0.5 * rho * cda * speed ** 3 - wheelPower;

  // residual(0) = -wheelPower <= 0, and it rises through zero exactly once (on a steep descent it
  // dips first, then rises), so bisection finds the balance speed.
  if (residual(MAX_SPEED_METERS_PER_SECOND) <= 0) return MAX_SPEED_METERS_PER_SECOND;
  let low = 0;
  let high = MAX_SPEED_METERS_PER_SECOND;
  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    if (residual(mid) > 0) high = mid;
    else low = mid;
  }
  return Math.max(MIN_SPEED_METERS_PER_SECOND, (low + high) / 2);
}

/** Predicted time to ride `zones` (each at its constant target power) over the route. */
export function predictFinishTime(
  zones: readonly PredictionZone[],
  referencePolyline: readonly SegmentReferencePoint[],
  model: RiderBikeModel,
): FinishTimePrediction | undefined {
  if (zones.length === 0) return undefined;
  const elevation = elevationProfile(referencePolyline);
  const hasElevation = elevation.length >= 2;

  let seconds = 0;
  for (const zone of zones) {
    const length = zone.endDistanceMeters - zone.startDistanceMeters;
    if (!(length > 0)) continue;
    const steps = Math.max(1, Math.ceil(length / STEP_METERS));
    const stepLength = length / steps;
    for (let i = 0; i < steps; i += 1) {
      const center = zone.startDistanceMeters + (i + 0.5) * stepLength;
      const grade = hasElevation ? gradeAround(elevation, center) : 0;
      seconds += stepLength / solveSpeedMetersPerSecond(zone.targetPowerWatts, grade, model);
    }
  }
  return { durationMs: Math.round(seconds * 1_000), hasElevation };
}

/**
 * How far the model is off for a rider's own effort: actual time / model time for the power they
 * actually held. Multiply a plan's predicted time by this to correct for their bike, position
 * and usual conditions.
 */
export function calibrationFactor(actualDurationMs: number, modelDurationMs: number): number | undefined {
  if (!(actualDurationMs > 0) || !(modelDurationMs > 0)) return undefined;
  return actualDurationMs / modelDurationMs;
}

export const MIN_CALIBRATION_FACTOR = 0.8;
export const MAX_CALIBRATION_FACTOR = 1.3;

/** Median of several attempts' factors, rejected outright if outside the plausible band. */
export function combineCalibrationFactors(factors: readonly number[]): { factor: number; spreadPct: number } | undefined {
  const usable = factors.filter((value) => value >= MIN_CALIBRATION_FACTOR && value <= MAX_CALIBRATION_FACTOR);
  if (usable.length === 0) return undefined;
  const sorted = [...usable].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return { factor: median, spreadPct: ((sorted[sorted.length - 1]! - sorted[0]!) / median) * 100 };
}

interface ElevationPoint {
  distanceMeters: number;
  elevationMeters: number;
}

function elevationProfile(polyline: readonly SegmentReferencePoint[]): ElevationPoint[] {
  const profile: ElevationPoint[] = [];
  for (const point of polyline) {
    if (point.elevationMeters === undefined || !Number.isFinite(point.elevationMeters)) continue;
    if (profile.length > 0 && point.distanceMeters <= profile[profile.length - 1]!.distanceMeters) continue;
    profile.push({ distanceMeters: point.distanceMeters, elevationMeters: point.elevationMeters });
  }
  return profile;
}

function elevationAt(profile: readonly ElevationPoint[], distanceMeters: number): number {
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  if (distanceMeters <= first.distanceMeters) return first.elevationMeters;
  if (distanceMeters >= last.distanceMeters) return last.elevationMeters;
  let low = 0;
  let high = profile.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (profile[middle]!.distanceMeters <= distanceMeters) low = middle;
    else high = middle;
  }
  const a = profile[low]!;
  const b = profile[high]!;
  const ratio = (distanceMeters - a.distanceMeters) / (b.distanceMeters - a.distanceMeters);
  return a.elevationMeters + ratio * (b.elevationMeters - a.elevationMeters);
}

function gradeAround(profile: readonly ElevationPoint[], centerMeters: number): number {
  const last = profile[profile.length - 1]!.distanceMeters;
  const from = Math.max(0, centerMeters - GRADE_WINDOW_METERS / 2);
  const to = Math.min(last, centerMeters + GRADE_WINDOW_METERS / 2);
  if (to - from < 1) return 0;
  const grade = (elevationAt(profile, to) - elevationAt(profile, from)) / (to - from);
  return Math.max(-MAX_ABS_GRADE, Math.min(MAX_ABS_GRADE, grade));
}
