import { formatDistanceMiles } from "./formatRideStats.ts";

/** "1.1 mi · 3 efforts" -- what a rider wants to know about a segment at a glance. */
export function describeSegmentRow(segment: { distanceMeters?: number; effortCount: number }): string {
  const effort = segment.effortCount === 0 ? "No efforts yet" : `${segment.effortCount} effort${segment.effortCount === 1 ? "" : "s"}`;
  return segment.distanceMeters === undefined ? effort : `${formatDistanceMiles(segment.distanceMeters)} · ${effort}`;
}
