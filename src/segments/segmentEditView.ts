import { clampRangeEnd, clampRangeStart, SEGMENT_RANGE_STEP_METERS } from "./clampSegmentRange.ts";

export type EditMode = "start" | "end";

/** How long the elevation chart stays zoomed on the pin after the last touch before it returns to the whole ride. */
export const ZOOM_RETURN_MS = 3_000;

/** The share of the ride the zoomed chart shows around the pin, and the least it ever shows (so a short ride is not zoomed to nothing). */
const ZOOM_SHARE = 0.1;
const ZOOM_MIN_SPAN_METERS = 200;

/** The stretch of the ride the elevation chart zooms to while the rider fine-tunes a pin at `centerMeters`. */
export function zoomWindow(centerMeters: number, totalMeters: number): { startDistanceMeters: number; endDistanceMeters: number } {
  const span = Math.min(totalMeters, Math.max(ZOOM_MIN_SPAN_METERS, totalMeters * ZOOM_SHARE));
  const start = Math.min(Math.max(0, centerMeters - span / 2), totalMeters - span);
  return { startDistanceMeters: start, endDistanceMeters: start + span };
}

/** The distance under a touch at `x` pixels across a chart `width` wide that shows `domain`. Clamped to the domain. */
export function xToDistance(x: number, width: number, domain: { startDistanceMeters: number; endDistanceMeters: number }): number {
  if (!(width > 0)) return domain.startDistanceMeters;
  const fraction = Math.min(1, Math.max(0, x / width));
  return domain.startDistanceMeters + fraction * (domain.endDistanceMeters - domain.startDistanceMeters);
}

/** Moves the pin for `mode` to `candidateMeters`, kept inside the ride and apart from the other pin. */
export function placePin(
  mode: EditMode,
  candidateMeters: number,
  range: { startDistanceMeters: number; endDistanceMeters: number },
  totalMeters: number,
): { startDistanceMeters: number; endDistanceMeters: number } {
  return mode === "start"
    ? { startDistanceMeters: clampRangeStart(candidateMeters, range.endDistanceMeters), endDistanceMeters: range.endDistanceMeters }
    : { startDistanceMeters: range.startDistanceMeters, endDistanceMeters: clampRangeEnd(candidateMeters, range.startDistanceMeters, totalMeters) };
}

/** One arrow press: the pin for `mode` moves a step earlier or later. */
export function nudgePin(
  mode: EditMode,
  direction: -1 | 1,
  range: { startDistanceMeters: number; endDistanceMeters: number },
  totalMeters: number,
  stepMeters = SEGMENT_RANGE_STEP_METERS,
): { startDistanceMeters: number; endDistanceMeters: number } {
  const current = mode === "start" ? range.startDistanceMeters : range.endDistanceMeters;
  return placePin(mode, current + direction * stepMeters, range, totalMeters);
}
