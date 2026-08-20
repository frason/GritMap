export interface DeleteSegmentDatabase {
  prepare(sql: string): {
    run(...parameters: unknown[]): unknown;
  };
}

/**
 * Permanently removes a segment's definition and its reference points (cascade). Attempts
 * and diagnostics referencing it also cascade-delete, per the segments FK -- the source ride
 * and its points are never touched, matching docs/MVP.md: "Deleting a segment permanently
 * removes the definition and its attempts/diagnostics but leaves every ride intact."
 */
export function deleteSegment(database: DeleteSegmentDatabase, segmentId: string): void {
  database.prepare("DELETE FROM segments WHERE id = ?").run(segmentId);
}
