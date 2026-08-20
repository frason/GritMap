const EARTH_RADIUS_METERS = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Great-circle distance between two points. Used wherever a segment's full length needs to
 * be measured accurately (resampling, the distance-based scrubber) -- unlike
 * matchSegment.ts's `toXY`/`distance` helpers, which are an origin-relative flat-plane
 * approximation validated only at corridor scale (tens of meters), not over a segment's
 * full length.
 */
export function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);

  const sinDeltaLat = Math.sin(deltaLat / 2);
  const sinDeltaLng = Math.sin(deltaLng / 2);
  const h =
    sinDeltaLat * sinDeltaLat + Math.cos(lat1) * Math.cos(lat2) * sinDeltaLng * sinDeltaLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_METERS * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
