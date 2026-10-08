import { readFileSync, writeFileSync } from "node:fs";
import { parseFitFile } from "../src/fit/parseFitFile.ts";

interface SegmentPoint {
  lat: number;
  lng: number;
  distanceMeters: number;
  elevationMeters?: number;
}

interface SegmentDocument {
  referencePolyline: SegmentPoint[];
  [key: string]: unknown;
}

const EARTH_RADIUS_METERS = 6_371_000;

function distanceMeters(a: SegmentPoint, b: { lat?: number; lng?: number }): number {
  if (b.lat === undefined || b.lng === undefined) return Number.POSITIVE_INFINITY;
  const radians = Math.PI / 180;
  const lat1 = a.lat * radians;
  const lat2 = b.lat * radians;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function closestIndex(point: SegmentPoint, ride: ReturnType<typeof parseFitFile>["points"]): number {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  ride.forEach((candidate, index) => {
    const distance = distanceMeters(point, candidate);
    if (candidate.elevationMeters !== undefined && distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return bestIndex;
}

function elevationAtRideDistance(
  distance: number,
  ride: ReturnType<typeof parseFitFile>["points"],
): number {
  let upper = 1;
  while (upper < ride.length && ride[upper]!.distanceMeters! < distance) upper += 1;
  if (upper >= ride.length) return ride[ride.length - 1]!.elevationMeters!;
  const before = ride[upper - 1]!;
  const after = ride[upper]!;
  const ratio = (distance - before.distanceMeters!) / (after.distanceMeters! - before.distanceMeters!);
  return before.elevationMeters! + ratio * (after.elevationMeters! - before.elevationMeters!);
}

const [segmentPath, fitPath] = process.argv.slice(2);
if (!segmentPath || !fitPath) {
  throw new Error("Usage: node scripts/enrich-segment-elevation-from-fit.ts <segment.json> <ride.fit>");
}

const segment = JSON.parse(readFileSync(segmentPath, "utf8")) as SegmentDocument;
if (segment.referencePolyline.length < 2) throw new Error("Segment needs at least two points");

const fitBytes = readFileSync(fitPath);
const allRidePoints = parseFitFile(
  new Uint8Array(fitBytes.buffer, fitBytes.byteOffset, fitBytes.byteLength),
).points.filter(
  (point) =>
    point.lat !== undefined &&
    point.lng !== undefined &&
    point.distanceMeters !== undefined &&
    point.elevationMeters !== undefined,
);

const startIndex = closestIndex(segment.referencePolyline[0]!, allRidePoints);
const endIndex = closestIndex(segment.referencePolyline[segment.referencePolyline.length - 1]!, allRidePoints);
if (startIndex < 0 || endIndex <= startIndex) {
  throw new Error("FIT file does not contain a forward traversal of the segment");
}

const ride = allRidePoints.slice(startIndex, endIndex + 1);
const startOffset = ride[0]!.distanceMeters!;
const rideLength = ride[ride.length - 1]!.distanceMeters! - startOffset;
const segmentLength = segment.referencePolyline[segment.referencePolyline.length - 1]!.distanceMeters;

segment.referencePolyline = segment.referencePolyline.map((point) => {
  const rideDistance = startOffset + (point.distanceMeters / segmentLength) * rideLength;
  return {
    ...point,
    elevationMeters: Math.round(elevationAtRideDistance(rideDistance, ride) * 10) / 10,
  };
});

writeFileSync(segmentPath, `${JSON.stringify(segment, null, 2)}\n`);

const first = segment.referencePolyline[0]!.elevationMeters!;
const last = segment.referencePolyline[segment.referencePolyline.length - 1]!.elevationMeters!;
console.log(
  `Enriched ${segment.referencePolyline.length} points from FIT indexes ${startIndex}-${endIndex}; ` +
    `elevation ${first.toFixed(1)}-${last.toFixed(1)} m (${(last - first).toFixed(1)} m net gain).`,
);
