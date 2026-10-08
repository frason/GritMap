/**
 * Seeds synthetic demo rides, and the efforts the real matcher finds on them, into a GritMap
 * database so screens can be screenshotted and QA'd without anyone's real ride files.
 *
 *   node scripts/seed-demo-efforts.ts --db <gritmap.db> --segment "<name contains>" [--efforts 3] [--goal-minutes 41]
 *
 * The app must not be running (close it first: it holds the database). The segment must already
 * be in the database (add it from Open Segments). Every ride is generated here: it follows the
 * segment's own published path, with invented timing, power and heart rate and a few metres of
 * deterministic GPS noise, dated in the recent past. No real GPS is read, written or committed.
 * Each ride goes through the app's own import and matcher code, so the efforts are real ones.
 */
import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { getSegmentDetail } from "../src/db/getSegmentDetail.ts";
import { insertImportedRide } from "../src/db/persistImportedRide.ts";
import { setActiveGoal } from "../src/db/setActiveGoal.ts";
import type { SyncDatabase } from "../src/db/types.ts";
import type { ParsedPoint } from "../src/fit/parseFitFile.ts";
import { runMatcherForRide } from "../src/matcher/runMatcher.ts";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const dbPath = arg("db");
const segmentName = arg("segment");
if (dbPath === undefined || segmentName === undefined) {
  console.error('usage: node scripts/seed-demo-efforts.ts --db <gritmap.db> --segment "<name>" [--efforts 3] [--goal-minutes 41]');
  process.exit(1);
}
const effortCount = Number(arg("efforts") ?? "1");
const goalMinutes = arg("goal-minutes") === undefined ? undefined : Number(arg("goal-minutes"));

const raw = new DatabaseSync(dbPath);
raw.exec("PRAGMA foreign_keys = ON");
const database: SyncDatabase = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => {
    const statement = raw.prepare(sql);
    return {
      get: (...params) => statement.get(...(params as never[])),
      run: (...params) => statement.run(...(params as never[])),
      all: (...params) => statement.all(...(params as never[])),
    };
  },
  runMany: (sql, paramsList) => {
    const statement = raw.prepare(sql);
    for (const params of paramsList) statement.run(...(params as never[]));
  },
};

const row = raw.prepare("SELECT id FROM segments WHERE name LIKE ? ORDER BY created_at_ms LIMIT 1").get(`%${segmentName}%`) as
  | { id: string }
  | undefined;
if (row === undefined) {
  console.error(`No segment with "${segmentName}" in its name. Add it from Open Segments first.`);
  process.exit(1);
}
const segment = getSegmentDetail(database, row.id)!;
const polyline = segment.referencePolyline;
const segmentLength = polyline[polyline.length - 1]!.distanceMeters;

/** Deterministic noise so reruns produce the same demo data. */
let seed = 20261008;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff - 0.5;
};

function pointAtDistance(distanceMeters: number): { lat: number; lng: number; elevationMeters?: number } {
  const clamped = Math.max(0, Math.min(segmentLength, distanceMeters));
  let index = 1;
  while (index < polyline.length - 1 && polyline[index]!.distanceMeters < clamped) index += 1;
  const a = polyline[index - 1]!;
  const b = polyline[index]!;
  const span = b.distanceMeters - a.distanceMeters || 1;
  const t = (clamped - a.distanceMeters) / span;
  const elevation =
    a.elevationMeters !== undefined && b.elevationMeters !== undefined
      ? a.elevationMeters + t * (b.elevationMeters - a.elevationMeters)
      : undefined;
  return {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
    ...(elevation === undefined ? {} : { elevationMeters: elevation }),
  };
}

const METERS_PER_DEGREE_LAT = 111_320;

/** One effort: lead-in, the segment, lead-out, at 1 Hz, with a power plan that fades a little. */
function buildRide(startMs: number, averageSpeed: number, fadePct: number): ParsedPoint[] {
  const points: ParsedPoint[] = [];
  const leadMeters = 120;
  const first = polyline[0]!;
  const second = polyline[1]!;
  const last = polyline[polyline.length - 1]!;
  const beforeLast = polyline[polyline.length - 2]!;

  const extend = (from: { lat: number; lng: number }, toward: { lat: number; lng: number }, meters: number) => {
    const cosLat = Math.cos((from.lat * Math.PI) / 180);
    const north = (toward.lat - from.lat) * METERS_PER_DEGREE_LAT;
    const east = (toward.lng - from.lng) * METERS_PER_DEGREE_LAT * cosLat;
    const length = Math.hypot(north, east) || 1;
    return {
      lat: from.lat + ((north / length) * meters) / METERS_PER_DEGREE_LAT,
      lng: from.lng + ((east / length) * meters) / (METERS_PER_DEGREE_LAT * cosLat),
    };
  };

  // Walk a combined path: lead-in (reverse of the first leg), the segment, lead-out (continuing the last leg).
  const totalPath = leadMeters + segmentLength + leadMeters;
  let travelled = 0;
  let t = 0;
  while (travelled < totalPath) {
    const onSegment = travelled - leadMeters;
    let lat: number;
    let lng: number;
    let elevationMeters: number | undefined;
    if (onSegment < 0) {
      const p = extend(first, second, onSegment); // negative meters: back along the first leg
      lat = p.lat;
      lng = p.lng;
      elevationMeters = first.elevationMeters;
    } else if (onSegment > segmentLength) {
      const p = extend(last, { lat: last.lat + (last.lat - beforeLast.lat), lng: last.lng + (last.lng - beforeLast.lng) }, onSegment - segmentLength);
      lat = p.lat;
      lng = p.lng;
      elevationMeters = last.elevationMeters;
    } else {
      const p = pointAtDistance(onSegment);
      lat = p.lat;
      lng = p.lng;
      elevationMeters = p.elevationMeters;
    }

    const progress = Math.min(1, Math.max(0, onSegment / segmentLength));
    const power = Math.round(Math.max(0, 250 * (1.04 - fadePct * progress) + noise() * 24));
    points.push({
      timestampMs: startMs + t * 1_000,
      lat: lat + (noise() * 3) / METERS_PER_DEGREE_LAT,
      lng: lng + (noise() * 3) / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180)),
      distanceMeters: travelled,
      ...(elevationMeters === undefined ? {} : { elevationMeters }),
      power,
      heartRate: Math.round(138 + 34 * progress + noise() * 4),
      cadence: Math.round(84 + noise() * 8),
      speedMetersPerSec: averageSpeed,
    });
    travelled += averageSpeed * (1 + noise() * 0.06);
    t += 1;
  }
  return points;
}

const now = Date.now();
const DAY = 86_400_000;
// Oldest effort first; each a bit faster and a bit more even than the last, like a rider improving.
const plans = [
  { daysAgo: 21, speedFactor: 0.9, fade: 0.2 },
  { daysAgo: 10, speedFactor: 0.96, fade: 0.14 },
  { daysAgo: 3, speedFactor: 1.0, fade: 0.08 },
].slice(-effortCount);

const baseSpeed = segmentLength / (segmentLength > 3_000 ? 2_520 : 300); // ~42 min for a long climb, ~5 min for a short one
for (const [index, plan] of plans.entries()) {
  const startMs = now - plan.daysAgo * DAY;
  const points = buildRide(startMs, baseSpeed * plan.speedFactor, plan.fade);
  const durationMs = points[points.length - 1]!.timestampMs - startMs;
  const filename = `Demo ride ${index + 1}.fit`;
  const { rideId } = insertImportedRide(database, () => randomUUID(), {
    contentHash: createHash("sha256").update(`${filename}:${startMs}`).digest("hex"),
    originalFilename: filename,
    retainedFileUri: `file:///demo/${filename}`,
    fileSizeBytes: points.length * 40,
    points,
    parserVersion: 1,
    deviceMetadataJson: "{}",
    startTimestampMs: startMs,
    durationMs,
    nowMs: now,
  });
  const summary = runMatcherForRide(database, () => randomUUID(), rideId, now);
  console.log(`${filename}: ${points.length} points, matcher -> ${JSON.stringify(summary)}`);
}

if (goalMinutes !== undefined) {
  setActiveGoal(database, { segmentId: segment.segmentId, targetDurationMs: goalMinutes * 60_000, nowMs: now });
  console.log(`Goal set to ${goalMinutes} minutes on "${segment.name}".`);
}
raw.exec("PRAGMA wal_checkpoint(TRUNCATE)");
raw.close();
