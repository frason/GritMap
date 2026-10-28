export interface DonutArc {
  zone: number;
  /** Length of the drawn arc and the gap after it, as stroke-dasharray values for a circle of this radius. */
  dashLength: number;
  gapLength: number;
  /** Where the arc starts, as a stroke-dashoffset (the circle's own start is 3 o'clock; callers rotate it to 12). */
  dashOffset: number;
}

/**
 * Arcs for a doughnut of time in zone. Each zone's share of the circle is its percent of the total; zones with
 * no time draw nothing. Percents that don't add to 100 are scaled to fill the ring, so rounding never leaves a gap.
 */
export function donutArcs(breakdown: readonly { zone: number; percent: number }[], radius: number): DonutArc[] {
  const circumference = 2 * Math.PI * radius;
  const total = breakdown.reduce((sum, item) => sum + Math.max(0, item.percent), 0);
  if (total <= 0) return [];
  let used = 0;
  const arcs: DonutArc[] = [];
  for (const item of breakdown) {
    if (item.percent <= 0) continue;
    const length = (item.percent / total) * circumference;
    arcs.push({ zone: item.zone, dashLength: length, gapLength: circumference - length, dashOffset: -used });
    used += length;
  }
  return arcs;
}
