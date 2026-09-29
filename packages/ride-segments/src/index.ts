export {
  matchSegment,
  calculateConfidenceScore,
  MATCHER_VERSION,
  type RidePoint,
  type ReferencePoint,
  type SegmentDefinition,
  type MatchDecision,
  type MatchCandidate,
  type ConfidenceScoreInput,
} from "./matchSegment.ts";
export { toMatcherRidePoints, type SourcePoint } from "./toMatcherRidePoints.ts";
export {
  traversalOverlapRatio,
  isSamePhysicalTraversal,
  DUPLICATE_TRAVERSAL_OVERLAP_THRESHOLD,
  type PointRange,
} from "./traversalOverlap.ts";
