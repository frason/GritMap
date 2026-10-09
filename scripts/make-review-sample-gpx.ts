/**
 * Writes a synthetic ride (GPX) that follows an Open Segments entry's own published path, for
 * the TestFlight Beta App Review attachment and for demos. Nothing real: the timing is invented
 * (steady ~14 km/h), the path is the public registry segment plus a short lead-in and lead-out.
 *
 *   node scripts/make-review-sample-gpx.ts [registry-segment.json] [out.gpx]
 */
import { readFileSync, writeFileSync } from "node:fs";

interface Point {
  lat: number;
  lng: number;
  distanceMeters: number;
  elevationMeters?: number;
}

const input = process.argv[2] ?? "registry/segments/17779c8b14fbe84126712e79982a870d82433a37d7c7193f3af4bbb2b5dc530c.json";
const output = process.argv[3] ?? "docs/beta-review-sample-ride.gpx";
const segment = JSON.parse(readFileSync(input, "utf8")) as { name: string; referencePolyline: Point[] };
const line = segment.referencePolyline;

const METERS_PER_DEGREE_LAT = 111_320;
function extend(from: Point, towards: Point, meters: number): { lat: number; lng: number; elevationMeters: number } {
  const dLat = towards.lat - from.lat;
  const dLng = towards.lng - from.lng;
  const length = Math.hypot(dLat * METERS_PER_DEGREE_LAT, dLng * METERS_PER_DEGREE_LAT * Math.cos((from.lat * Math.PI) / 180)) || 1;
  const scale = meters / length;
  return { lat: from.lat + dLat * scale, lng: from.lng + dLng * scale, elevationMeters: from.elevationMeters ?? 0 };
}

// 250 m lead-in before the start and 150 m lead-out after the finish, on the same bearings.
const lead = extend(line[0]!, line[1]!, -250);
const out = extend(line[line.length - 1]!, line[line.length - 2]!, -150);
const path = [lead, ...line, out];

const speed = 3.9; // m/s
const start = Date.UTC(2026, 9, 3, 14, 0, 0);
const points: string[] = [];
let seconds = 0;
for (let i = 0; i < path.length - 1; i += 1) {
  const a = path[i]!;
  const b = path[i + 1]!;
  const meters = Math.hypot((b.lat - a.lat) * METERS_PER_DEGREE_LAT, (b.lng - a.lng) * METERS_PER_DEGREE_LAT * Math.cos((a.lat * Math.PI) / 180));
  const steps = Math.max(1, Math.round(meters / speed));
  for (let s = 0; s < steps; s += 1) {
    const t = s / steps;
    const lat = a.lat + (b.lat - a.lat) * t;
    const lng = a.lng + (b.lng - a.lng) * t;
    const ele = (a.elevationMeters ?? 0) + ((b.elevationMeters ?? 0) - (a.elevationMeters ?? 0)) * t;
    const time = new Date(start + seconds * 1_000).toISOString().replace(".000Z", "Z");
    points.push(`<trkpt lat="${lat.toFixed(6)}" lon="${lng.toFixed(6)}"><ele>${ele.toFixed(1)}</ele><time>${time}</time></trkpt>`);
    seconds += 1;
  }
}
const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="GritMap synthetic sample" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Sample ride (synthetic) - ${segment.name}</name><trkseg>\n${points.join("\n")}\n</trkseg></trk></gpx>\n`;
writeFileSync(output, gpx);
console.log(`${points.length} points, ${(seconds / 60).toFixed(1)} min -> ${output}`);
