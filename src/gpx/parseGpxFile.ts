import type { ParsedPoint, ParsedRide } from "../fit/parseFitFile.ts";
import { haversineDistanceMeters } from "../segments/haversineDistance.ts";

export const GPX_PARSER_VERSION = 1;

/**
 * GPX has no per-point power, cadence, speed, or temperature field at all -- not a parsing
 * gap, a structural limitation of the format. Confirmed by reading a real Strava-exported
 * GPX directly (fixtures/gpx/Tilden_Inspiration_1_5_Bears_turnaround_repeat.gpx): lat/lon,
 * elevation, and timestamp are always present per point; heart rate is present via Garmin's
 * `<gpxtpx:hr>` TrackPointExtension (the de facto standard used by Strava/Garmin Connect
 * exports) when the recording device had a paired HR strap.
 */
const TRACK_POINT_PATTERN = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
const LAT_ATTR_PATTERN = /\blat="(-?[\d.]+)"/;
const LON_ATTR_PATTERN = /\blon="(-?[\d.]+)"/;
const ELEVATION_PATTERN = /<ele>(-?[\d.]+)<\/ele>/;
const TIME_PATTERN = /<time>([^<]+)<\/time>/;
const HEART_RATE_PATTERN = /<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/;
const TRACK_NAME_PATTERN = /<trk>[\s\S]*?<name>([^<]*)<\/name>/;

/**
 * Parses GPX bytes without performing file I/O, mirroring parseFitFile.ts's contract and
 * ParsedRide/ParsedPoint shape so the rest of the import pipeline (duplicate detection,
 * persistence, matching) doesn't need to know which format a ride came from. Unlike FIT,
 * GPX carries no cumulative distance field -- distanceMeters is computed here via
 * accumulated great-circle distance between consecutive points (haversineDistanceMeters,
 * already used elsewhere for segment-length measurement at this same scale).
 *
 * Deliberately a hand-rolled regex parser, not a general XML library dependency: GPX track
 * points are a narrow, well-known, highly regular structure, and pulling in a full XML
 * parser (React Native has no built-in DOMParser) for this one repeating element would be
 * more dependency than the actual parsing need -- matches this project's existing
 * "lightweight, hand-rolled over a heavy general dependency" pattern (e.g. the Karoo
 * transfer's HTTP receiver).
 */
export function parseGpxFile(bytes: ArrayBuffer | Uint8Array): ParsedRide {
  const text = decodeUtf8(bytes);
  if (!text.includes("<gpx")) {
    throw new Error("Input is not a GPX file");
  }

  const points: ParsedPoint[] = [];
  let cumulativeDistanceMeters = 0;
  let previousLatLng: { lat: number; lng: number } | undefined;

  TRACK_POINT_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRACK_POINT_PATTERN.exec(text)) !== null) {
    const [, attributes, body] = match;
    const latMatch = LAT_ATTR_PATTERN.exec(attributes);
    const lonMatch = LON_ATTR_PATTERN.exec(attributes);
    if (!latMatch || !lonMatch) {
      throw new Error("GPX track point is missing a lat/lon attribute");
    }
    const lat = Number(latMatch[1]);
    const lng = Number(lonMatch[1]);

    const timeMatch = TIME_PATTERN.exec(body);
    if (!timeMatch) {
      throw new Error("GPX track point is missing a <time> element");
    }
    const timestampMs = Date.parse(timeMatch[1]);
    if (!Number.isFinite(timestampMs)) {
      throw new Error(`GPX track point has an unparseable timestamp: ${timeMatch[1]}`);
    }

    if (previousLatLng !== undefined) {
      cumulativeDistanceMeters += haversineDistanceMeters(previousLatLng, { lat, lng });
    }
    previousLatLng = { lat, lng };

    const elevationMatch = ELEVATION_PATTERN.exec(body);
    const heartRateMatch = HEART_RATE_PATTERN.exec(body);

    points.push({
      timestampMs,
      lat,
      lng,
      distanceMeters: cumulativeDistanceMeters,
      ...(elevationMatch ? { elevationMeters: Number(elevationMatch[1]) } : {}),
      ...(heartRateMatch ? { heartRate: Number(heartRateMatch[1]) } : {}),
    });
  }

  if (points.length === 0) {
    throw new Error("GPX file has no track points");
  }

  const nameMatch = TRACK_NAME_PATTERN.exec(text);

  return {
    points,
    deviceMetadata: {
      gpxParserVersion: GPX_PARSER_VERSION,
      ...(nameMatch ? { trackName: decodeXmlEntities(nameMatch[1]) } : {}),
    },
  };
}

/** True when `bytes` looks like a GPX file, cheaply, without fully parsing it. */
export function looksLikeGpx(bytes: ArrayBuffer | Uint8Array): boolean {
  // GPX is plain-text XML; a FIT file is binary and will not decode to valid UTF-8 text
  // containing "<gpx" -- checking the first few KB is enough and avoids decoding a
  // multi-megabyte file twice.
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const head = decodeUtf8(array.slice(0, 4096));
  return head.includes("<gpx");
}

function decodeUtf8(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new TextDecoder("utf-8", { fatal: false }).decode(array);
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
