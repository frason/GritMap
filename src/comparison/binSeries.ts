export interface BinnableSample {
  distanceMeters: number;
  primary: number | null;
  comparison: number | null;
}

/** A quarter of a mile, the step the rider reads power and heart rate in. */
export const QUARTER_MILE_METERS = 402.336;

/**
 * Averages a per-distance series into fixed-length steps (default a quarter mile), one point per step placed at
 * the step's middle. A channel with no readings in a step stays null there, so a gap never reads as zero.
 */
export function binByDistance<T extends BinnableSample>(series: readonly T[], binMeters: number = QUARTER_MILE_METERS): BinnableSample[] {
  if (series.length === 0 || binMeters <= 0) return [];
  const bins = new Map<number, { primary: number[]; comparison: number[]; first: number; last: number }>();
  for (const sample of series) {
    const index = Math.floor(sample.distanceMeters / binMeters);
    const bin = bins.get(index) ?? { primary: [], comparison: [], first: sample.distanceMeters, last: sample.distanceMeters };
    if (sample.primary !== null) bin.primary.push(sample.primary);
    if (sample.comparison !== null) bin.comparison.push(sample.comparison);
    bin.first = Math.min(bin.first, sample.distanceMeters);
    bin.last = Math.max(bin.last, sample.distanceMeters);
    bins.set(index, bin);
  }
  const average = (values: number[]) => (values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length);
  return [...bins.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, bin]) => ({ distanceMeters: (bin.first + bin.last) / 2, primary: average(bin.primary), comparison: average(bin.comparison) }));
}
