import type { ComparisonSample } from "../comparison/compareAttempts.ts";
import { classifyHeartRateZone, classifyPowerZone, type HeartRateZone, type PowerZone } from "./classifyZone.ts";

export interface AthleteProfileInput {
  ftpWatts?: number;
  maxHeartRateBpm?: number;
}

export interface ZoneBreakdownEntry<Zone extends number> {
  zone: Zone;
  /** Percentage (0-100) of this attempt's samples with data that fell in this zone. */
  percent: number;
}

export interface AttemptZoneBreakdown {
  /** Absent when no FTP is set; empty array when FTP is set but no power data exists. */
  power?: ZoneBreakdownEntry<PowerZone>[];
  /** Absent when no max heart rate is set; empty array when set but no HR data exists. */
  heartRate?: ZoneBreakdownEntry<HeartRateZone>[];
}

export interface ZoneBreakdown {
  primary: AttemptZoneBreakdown;
  comparison: AttemptZoneBreakdown;
}

/**
 * Summarizes what fraction of each attempt was spent in each power/HR zone, from the same
 * gap-aware, distance-aligned samples compareAttempts.ts already produces -- no separate
 * data pass over the raw ride points. Samples are evenly distance-spaced, so % of samples
 * with a value ~= % of segment distance, matching docs/Grip-Map-app-spec.md's "spent most
 * of this climb in zone 4 vs. zone 3" framing.
 */
export function computeZoneBreakdown(
  samples: readonly ComparisonSample[],
  profile: AthleteProfileInput,
): ZoneBreakdown {
  return {
    primary: {
      ...breakdownFor(
        samples.map((sample) => sample.primaryPower),
        profile.ftpWatts,
        classifyPowerZone,
        "power",
      ),
      ...breakdownFor(
        samples.map((sample) => sample.primaryHeartRate),
        profile.maxHeartRateBpm,
        classifyHeartRateZone,
        "heartRate",
      ),
    },
    comparison: {
      ...breakdownFor(
        samples.map((sample) => sample.comparisonPower),
        profile.ftpWatts,
        classifyPowerZone,
        "power",
      ),
      ...breakdownFor(
        samples.map((sample) => sample.comparisonHeartRate),
        profile.maxHeartRateBpm,
        classifyHeartRateZone,
        "heartRate",
      ),
    },
  };
}

function breakdownFor<Zone extends number, Key extends "power" | "heartRate">(
  values: readonly (number | null)[],
  threshold: number | undefined,
  classify: (value: number, threshold: number | undefined) => Zone | undefined,
  key: Key,
): { [K in Key]?: ZoneBreakdownEntry<Zone>[] } {
  if (threshold === undefined) {
    return {} as { [K in Key]?: ZoneBreakdownEntry<Zone>[] };
  }

  const zoneCounts = new Map<Zone, number>();
  let total = 0;
  for (const value of values) {
    if (value === null) continue;
    const zone = classify(value, threshold);
    if (zone === undefined) continue;
    total += 1;
    zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1);
  }

  const entries: ZoneBreakdownEntry<Zone>[] =
    total === 0
      ? []
      : [...zoneCounts.entries()]
          .sort(([left], [right]) => left - right)
          .map(([zone, count]) => ({ zone, percent: (count / total) * 100 }));

  return { [key]: entries } as { [K in Key]?: ZoneBreakdownEntry<Zone>[] };
}
