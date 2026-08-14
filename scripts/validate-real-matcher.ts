import { readFile } from "node:fs/promises";

import { parseFitFile, type ParsedPoint } from "../src/fit/parseFitFile.ts";
import {
  matchSegment,
  type MatchCandidate,
  type ReferencePoint,
  type RidePoint,
  type SegmentDefinition,
} from "../src/matcher/matchSegment.ts";

const DEFAULT_REFERENCE_FILE = "fixtures/fit/Karoo-Morning_Ride-2026-08-02-0837.fit";
const DEFAULT_COMPARISON_FILE = "fixtures/fit/Karoo-Morning_Ride-2026-08-09-0844.fit";
const SEGMENT_START_RIDE_METERS = 58_200;
const SEGMENT_END_RIDE_METERS = 60_800;
const RESAMPLE_METERS = 10;

const [referencePath = DEFAULT_REFERENCE_FILE, comparisonPath = DEFAULT_COMPARISON_FILE] =
  process.argv.slice(2);

const [referenceBytes, comparisonBytes] = await Promise.all([
  readFile(referencePath),
  readFile(comparisonPath),
]);
const referenceRide = parseFitFile(asUint8Array(referenceBytes));
const comparisonRide = parseFitFile(asUint8Array(comparisonBytes));
const referenceGps = gpsPoints(referenceRide.points);
const comparisonGps = gpsPoints(comparisonRide.points);
const segment = buildSegment(referenceGps);

const selfMatches = matchSegment(asRidePoints(referenceGps), segment);
const crossRideMatches = matchSegment(asRidePoints(comparisonGps), segment);

console.log(
  JSON.stringify(
    {
      referencePath,
      comparisonPath,
      parsedPoints: {
        reference: referenceRide.points.length,
        comparison: comparisonRide.points.length,
      },
      gpsPoints: {
        reference: referenceGps.length,
        comparison: comparisonGps.length,
      },
      segment: {
        sourceRideStartMeters: SEGMENT_START_RIDE_METERS,
        sourceRideEndMeters: SEGMENT_END_RIDE_METERS,
        referencePoints: segment.referencePolyline.length,
        lengthMeters: segment.referencePolyline.at(-1)?.distanceMeters,
        corridorMeters: segment.corridorMeters,
        requiredCoveragePct: segment.requiredCoveragePct,
      },
      selfMatches: summarize(selfMatches),
      crossRideMatches: summarize(crossRideMatches),
    },
    null,
    2,
  ),
);

function buildSegment(points: GpsParsedPoint[]): SegmentDefinition {
  const selected = points.filter(
    (point) =>
      point.distanceMeters >= SEGMENT_START_RIDE_METERS &&
      point.distanceMeters <= SEGMENT_END_RIDE_METERS,
  );
  if (selected.length < 2) {
    throw new Error("Reference ride does not contain enough GPS points in the chosen range");
  }

  const sourceStartDistance = selected[0].distanceMeters;
  const relative = selected.map((point) => ({
    lat: point.lat,
    lng: point.lng,
    // Critical: progress is relative to the segment, never to the full source ride.
    distanceMeters: point.distanceMeters - sourceStartDistance,
  }));

  return {
    id: "real-karoo-validation-segment",
    corridorMeters: 30,
    requiredCoveragePct: 0.9,
    referencePolyline: resample(relative, RESAMPLE_METERS),
  };
}

function resample(points: ReferencePoint[], stepMeters: number): ReferencePoint[] {
  const totalDistance = points.at(-1)?.distanceMeters ?? 0;
  const output: ReferencePoint[] = [];
  let upperIndex = 1;

  for (let distanceMeters = 0; distanceMeters <= totalDistance; distanceMeters += stepMeters) {
    while (
      upperIndex < points.length - 1 &&
      points[upperIndex].distanceMeters < distanceMeters
    ) {
      upperIndex += 1;
    }
    const lower = points[upperIndex - 1];
    const upper = points[upperIndex];
    const span = upper.distanceMeters - lower.distanceMeters;
    const ratio = span === 0 ? 0 : (distanceMeters - lower.distanceMeters) / span;
    output.push({
      lat: lower.lat + ratio * (upper.lat - lower.lat),
      lng: lower.lng + ratio * (upper.lng - lower.lng),
      distanceMeters,
    });
  }

  if (output.at(-1)?.distanceMeters !== totalDistance) {
    output.push({ ...points.at(-1)!, distanceMeters: totalDistance });
  }
  return output;
}

interface GpsParsedPoint extends ParsedPoint {
  lat: number;
  lng: number;
  distanceMeters: number;
}

function gpsPoints(points: ParsedPoint[]): GpsParsedPoint[] {
  return points.filter(
    (point): point is GpsParsedPoint =>
      point.lat !== undefined &&
      point.lng !== undefined &&
      point.distanceMeters !== undefined,
  );
}

function asRidePoints(points: GpsParsedPoint[]): RidePoint[] {
  return points.map(({ lat, lng, timestampMs }) => ({ lat, lng, timestampMs }));
}

function summarize(candidates: MatchCandidate[]): Record<string, unknown> {
  return {
    count: candidates.length,
    decisions: candidates.reduce<Record<string, number>>((counts, candidate) => {
      counts[candidate.decision] = (counts[candidate.decision] ?? 0) + 1;
      return counts;
    }, {}),
    candidates,
  };
}

function asUint8Array(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}
