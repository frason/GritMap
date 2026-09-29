export interface PointRange {
  startPointIndex: number;
  endPointIndex: number;
}

/** Candidates must overlap more than half of the shorter inclusive range. */
export const DUPLICATE_TRAVERSAL_OVERLAP_THRESHOLD = 0.5;

export function traversalOverlapRatio(left: PointRange, right: PointRange): number {
  const overlapPoints = Math.max(
    0,
    Math.min(left.endPointIndex, right.endPointIndex) -
      Math.max(left.startPointIndex, right.startPointIndex) +
      1,
  );
  const shorterPointCount = Math.min(pointCount(left), pointCount(right));
  return shorterPointCount === 0 ? 0 : overlapPoints / shorterPointCount;
}

export function isSamePhysicalTraversal(left: PointRange, right: PointRange): boolean {
  return traversalOverlapRatio(left, right) > DUPLICATE_TRAVERSAL_OVERLAP_THRESHOLD;
}

function pointCount(range: PointRange): number {
  return Math.max(0, range.endPointIndex - range.startPointIndex + 1);
}
