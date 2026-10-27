// Pure helpers for the Segments list: how it is sorted and how a segment's course is thinned into a
// small preview. No React or database, so the rules are unit-tested (segmentListView.test.ts).

export type SegmentSort = "recent" | "name" | "added" | "efforts";

/** The sort choices in the order the menu shows them. The first is the default. */
export const SEGMENT_SORTS: readonly { value: SegmentSort; label: string }[] = [
  { value: "recent", label: "Most recent attempts" },
  { value: "name", label: "Name" },
  { value: "added", label: "Recently added" },
  { value: "efforts", label: "Most efforts" },
];

export const DEFAULT_SEGMENT_SORT: SegmentSort = "recent";

export interface SortableSegment {
  segmentId: string;
  name: string;
  createdAtMs: number;
  effortCount: number;
  lastEffortAtMs?: number;
}

/** A new array, ordered by `sort`. Ties fall back to newest-added, then id, so the order never jumps around. */
export function sortSegments<T extends SortableSegment>(segments: readonly T[], sort: SegmentSort): T[] {
  const byAdded = (a: T, b: T) => b.createdAtMs - a.createdAtMs || (a.segmentId < b.segmentId ? 1 : a.segmentId > b.segmentId ? -1 : 0);
  const compare = (a: T, b: T): number => {
    if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || byAdded(a, b);
    if (sort === "efforts") return b.effortCount - a.effortCount || byAdded(a, b);
    if (sort === "recent") {
      // A segment with no efforts has no latest attempt, so it goes after every segment that does.
      const aLast = a.lastEffortAtMs ?? Number.NEGATIVE_INFINITY;
      const bLast = b.lastEffortAtMs ?? Number.NEGATIVE_INFINITY;
      if (aLast !== bLast) return bLast > aLast ? 1 : -1;
    }
    return byAdded(a, b);
  };
  return [...segments].sort(compare);
}

export interface PreviewPoint {
  lat: number;
  lng: number;
}

/** At most `max` points taken evenly along the course, always keeping the first and last. */
export function thinCourse(points: readonly PreviewPoint[], max: number): PreviewPoint[] {
  if (points.length <= max || max < 2) return points.map((point) => ({ lat: point.lat, lng: point.lng }));
  const result: PreviewPoint[] = [];
  for (let i = 0; i < max; i += 1) {
    const point = points[Math.round((i * (points.length - 1)) / (max - 1))]!;
    result.push({ lat: point.lat, lng: point.lng });
  }
  return result;
}
