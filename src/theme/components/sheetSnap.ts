export type SheetStop = "peek" | "half" | "full";

export const SHEET_STOPS: readonly SheetStop[] = ["peek", "half", "full"];

/** Heights of the three stops for a container: a strip that shows the title, half the screen, and nearly all of it. */
export function sheetHeights(containerHeight: number, peekHeight = 112): Record<SheetStop, number> {
  const full = Math.max(peekHeight, Math.round(containerHeight * 0.9));
  const half = Math.min(full, Math.max(peekHeight, Math.round(containerHeight * 0.5)));
  return { peek: Math.min(peekHeight, full), half, full };
}

/**
 * Where a sheet settles after a drag released at `height`. A fast flick (|velocity| over 0.5 px/ms) moves to the
 * next stop in that direction; a slow release goes to the nearest stop. Velocity is positive when moving up.
 */
export function settleStop(height: number, velocityPxPerMs: number, heights: Record<SheetStop, number>): SheetStop {
  const ordered = SHEET_STOPS.map((stop) => ({ stop, height: heights[stop] }));
  if (Math.abs(velocityPxPerMs) > 0.5) {
    const candidates = velocityPxPerMs > 0 ? ordered.filter((s) => s.height > height + 1) : ordered.filter((s) => s.height < height - 1).reverse();
    const next = candidates[0] ?? ordered[velocityPxPerMs > 0 ? ordered.length - 1 : 0]!;
    return next.stop;
  }
  return ordered.reduce((best, s) => (Math.abs(s.height - height) < Math.abs(best.height - height) ? s : best)).stop;
}

/** The stop one step up or down, for the VoiceOver "expand / collapse" actions. */
export function stepStop(current: SheetStop, direction: "up" | "down"): SheetStop {
  const index = SHEET_STOPS.indexOf(current) + (direction === "up" ? 1 : -1);
  return SHEET_STOPS[Math.min(SHEET_STOPS.length - 1, Math.max(0, index))]!;
}
