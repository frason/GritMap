/**
 * Shared by every UI that edits a segment's start/end distance (DistanceRangeScrubber's
 * drag thumbs and stepper buttons, RouteMapView's on-map drag handles) so a range picked one
 * way is never inconsistent with the same range picked another way -- both surfaces edit the
 * exact same startDistanceMeters/endDistanceMeters state.
 */
export const MIN_SEGMENT_RANGE_GAP_METERS = 10;

/** The distance a single increment/decrement (keyboard, VoiceOver, stepper button) moves. */
export const SEGMENT_RANGE_STEP_METERS = 10;

export function clampRangeStart(candidateMeters: number, endDistanceMeters: number): number {
  return clamp(candidateMeters, 0, endDistanceMeters - MIN_SEGMENT_RANGE_GAP_METERS);
}

export function clampRangeEnd(
  candidateMeters: number,
  startDistanceMeters: number,
  totalDistanceMeters: number,
): number {
  return clamp(candidateMeters, startDistanceMeters + MIN_SEGMENT_RANGE_GAP_METERS, totalDistanceMeters);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
