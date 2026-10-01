export interface BuildRiderHistoryPackageInput {
  ftpWatts: number;
  weightKg: number;
  maxHeartRateBpm?: number;
}

/**
 * Produces the exact JSON shape apps/karoo's RiderHistoryJsonParser.parse() expects (read
 * directly from that Kotlin source, not paraphrased). trainingLoads and samples are always
 * sent empty -- this app doesn't compute either yet, and the parser only requires the
 * arrays to exist, not to be non-empty. weightKg is required here because the Kotlin
 * parser rejects a non-positive or missing one outright; callers must have it before
 * calling this (the UI gates the "send pacing plan" action on weight being set).
 */
export function buildRiderHistoryPackage(input: BuildRiderHistoryPackageInput): object {
  if (!Number.isFinite(input.ftpWatts) || input.ftpWatts <= 0) {
    throw new RangeError(`ftpWatts must be positive and finite, got ${input.ftpWatts}`);
  }
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) {
    throw new RangeError(`weightKg must be positive and finite, got ${input.weightKg}`);
  }

  return {
    schemaVersion: 1,
    profile: {
      ftpWatts: Math.round(input.ftpWatts),
      weightKg: input.weightKg,
      ...(input.maxHeartRateBpm === undefined
        ? {}
        : { maxHeartRateBpm: Math.round(input.maxHeartRateBpm) }),
    },
    trainingLoads: [],
    samples: [],
  };
}
