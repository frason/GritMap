export interface RegistrySegmentSummary {
  name: string;
  /** Length of the segment, from its last reference point; absent if the file has no usable polyline. */
  distanceMeters?: number;
}

/**
 * What a rider needs to recognise a published segment in a list -- its name and length -- read
 * from the portable segment JSON. The Open Segments list is otherwise just file names, which are
 * fingerprints. This does not validate the segment (importing does, with fromPortableSegmentJson);
 * it returns undefined for anything that has no usable name, so a bad file never shows a blank row.
 */
export function summarizeRegistrySegment(raw: unknown): RegistrySegmentSummary | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.name !== "string" || value.name.trim().length === 0) return undefined;
  const name = value.name.trim();

  const polyline = Array.isArray(value.referencePolyline) ? value.referencePolyline : [];
  const last = polyline.length > 0 ? (polyline[polyline.length - 1] as Record<string, unknown> | null) : undefined;
  const distance = last?.distanceMeters;
  return typeof distance === "number" && Number.isFinite(distance) && distance > 0
    ? { name, distanceMeters: distance }
    : { name };
}
