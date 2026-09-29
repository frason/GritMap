export type PowerZone = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type HeartRateZone = 1 | 2 | 3 | 4 | 5;

/**
 * Coggan's standard 7-zone power-training model, as a percentage of FTP. The industry-
 * standard scheme for cycling (the terminology docs/Grip-Map-app-spec.md's "zone 3 vs.
 * zone 4" language assumes). Lower bound inclusive; zone 7 has no upper bound.
 */
export function classifyPowerZone(watts: number, ftpWatts: number | undefined): PowerZone | undefined {
  if (ftpWatts === undefined || !Number.isFinite(watts) || !Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    return undefined;
  }
  const pctFtp = (watts / ftpWatts) * 100;
  if (pctFtp < 55) return 1; // Active Recovery
  if (pctFtp < 76) return 2; // Endurance
  if (pctFtp < 91) return 3; // Tempo
  if (pctFtp < 106) return 4; // Lactate Threshold
  if (pctFtp < 121) return 5; // VO2max
  if (pctFtp < 151) return 6; // Anaerobic Capacity
  return 7; // Neuromuscular Power
}

/**
 * Standard 5-zone heart-rate model, as a percentage of max heart rate. Lower bound
 * inclusive; zone 5 has no upper bound (max HR is an estimate, not a hard ceiling).
 */
export function classifyHeartRateZone(
  bpm: number,
  maxHeartRateBpm: number | undefined,
): HeartRateZone | undefined {
  if (
    maxHeartRateBpm === undefined ||
    !Number.isFinite(bpm) ||
    !Number.isFinite(maxHeartRateBpm) ||
    maxHeartRateBpm <= 0
  ) {
    return undefined;
  }
  const pctMax = (bpm / maxHeartRateBpm) * 100;
  if (pctMax < 60) return 1; // Active Recovery
  if (pctMax < 70) return 2; // Endurance
  if (pctMax < 80) return 3; // Tempo
  if (pctMax < 90) return 4; // Threshold
  return 5; // VO2max / Anaerobic
}
