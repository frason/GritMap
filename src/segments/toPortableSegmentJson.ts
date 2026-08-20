import type { SegmentReferencePoint } from "./resamplePolyline.ts";

export interface PortableSegmentInput {
  id: string;
  name: string;
  schemaVersion: number;
  corridorMeters: number;
  requiredCoveragePct: number;
  fingerprint: string;
  referencePolyline: readonly SegmentReferencePoint[];
}

/**
 * Produces the exact JSON shape apps/karoo's SegmentJsonParser.parse() expects (read
 * directly from that source, not paraphrased) -- a segment saved on the phone is
 * immediately valid input to it. See
 * docs/PLAN_segment_definition_increment.md's "Fingerprint" section.
 */
export function toPortableSegmentJson(segment: PortableSegmentInput): object {
  return {
    schemaVersion: segment.schemaVersion,
    id: segment.id,
    name: segment.name,
    direction: "forward",
    matching: {
      corridorMeters: segment.corridorMeters,
      requiredCoveragePct: segment.requiredCoveragePct,
    },
    referencePolyline: segment.referencePolyline.map((point) => ({
      lat: point.lat,
      lng: point.lng,
      distanceMeters: point.distanceMeters,
      ...(point.elevationMeters === undefined ? {} : { elevationMeters: point.elevationMeters }),
    })),
    fingerprint: segment.fingerprint,
  };
}
