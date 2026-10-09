import { formatDurationMinutesSeconds } from "./formatRideStats.ts";

/** One sentence on who finished ahead, from the two efforts' elapsed times. */
export function describeOverallGap(primaryDurationMs: number, comparisonDurationMs: number): string {
  const gapMs = primaryDurationMs - comparisonDurationMs;
  const gap = formatDurationMinutesSeconds(Math.abs(gapMs));
  if (Math.round(Math.abs(gapMs) / 1_000) === 0) return "You finished level with the other effort.";
  return gapMs < 0 ? `You finished ${gap} ahead of the other effort.` : `You finished ${gap} behind the other effort.`;
}

/** Mean of the values that exist, or undefined if none do (missing data is not zero). */
export function averageOf(values: readonly (number | null)[]): number | undefined {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? undefined : present.reduce((sum, value) => sum + value, 0) / present.length;
}

/** "Power averaged 250 W for this effort and 245 W for the other." for a screen-reader summary. */
export function describeChannelAverages(input: {
  name: string;
  unit: string;
  primary: number | undefined;
  comparison: number | undefined;
}): string | undefined {
  const round = (value: number) => String(Math.round(value));
  if (input.primary === undefined && input.comparison === undefined) return undefined;
  if (input.primary !== undefined && input.comparison !== undefined) {
    return `${input.name} averaged ${round(input.primary)} ${input.unit} for this effort and ${round(input.comparison)} ${input.unit} for the other.`;
  }
  return input.primary !== undefined
    ? `${input.name} averaged ${round(input.primary)} ${input.unit} for this effort; the other has no data.`
    : `${input.name} averaged ${round(input.comparison!)} ${input.unit} for the other effort; this one has no data.`;
}
