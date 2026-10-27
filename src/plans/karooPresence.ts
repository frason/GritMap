import type { PlanSendMark } from "../db/listPlanSendMarks.ts";

/**
 * Which segments a Karoo is known to hold. The Segments list shows a bare "Karoo" check from this.
 * Today the only source is this phone's own send log; when the Karoo can report what it holds, add
 * another implementation of this interface and pass it to loadSegmentCards. Nothing else changes.
 */
export interface KarooInventory {
  hasSegment(segmentId: string): boolean;
}

/** The inventory as far as this phone knows: every segment it has sent at least once. */
export function sendLogInventory(marks: readonly Pick<PlanSendMark, "segmentId">[]): KarooInventory {
  const sent = new Set(marks.map((mark) => mark.segmentId));
  return { hasSegment: (segmentId) => sent.has(segmentId) };
}
