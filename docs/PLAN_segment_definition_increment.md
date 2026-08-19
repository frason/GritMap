# Second UI increment: render ride track → define segment (issues #6, #7)

## Status

Reviewed by Codex (2026-08-18); revisions below are folded into the plan body. One
correction to Codex's review, verified independently against the real JVM rather than
trusted from the summary: see "Fingerprint — verified cross-platform algorithm" below —
the canonical string format and a real conformance-test hash are now confirmed, not just
described.

## Context

The first UI increment (import → ride list → ride detail, `docs/PLAN_first_ui_increment.md`)
is complete, merged, and manually verified — including this session's follow-up work landing
issue #43 (matcher overlap-dedup + version-aware rescan) and issue #53 (automated test for the
SQLite bootstrap adapter). `src/screens/MapScreen.tsx` exists as a bare, unwired scaffold from
issue #47/PR #54 (`<Map style={...} mapStyle="..." />`, nothing else) — no other file in the
root app references MapLibre.

Issue #7 ("Segment definition: map handles + scrubber, persist directed segment") formally
`depends_on: #4, #6`. #4 (schema) is done. **#6 ("Render ride GPS track on MapLibre map") is
not done** — `RideDetailScreen.tsx`'s "Route" section is still an honest placeholder ("Map
view — available once segment tooling lands"). This plan covers both issues together, in that
dependency order.

**Cross-platform constraint discovered during review, not in the original plan**:
`apps/karoo/` already has a real, tested segment-JSON import/fingerprint contract
(`SegmentJsonParser.kt`, `SegmentJsonParserTest.kt`) that the root app's segment definitions
must produce byte-identical fingerprints against, since segments are meant to transfer
phone → Karoo. This plan is written against that real contract (read directly, not
paraphrased) rather than inventing an independent one.

## What's already there (verified against real source, not assumed)

- `ride_points` (`src/db/migrations.ts:42`): `ride_id, point_index, timestamp_ms, latitude,
  longitude, distance_meters, elevation_meters, ...`, PK `(ride_id, point_index)`. Lat/lng are
  nullable together (`CHECK ((latitude IS NULL) = (longitude IS NULL))`).
- `segments` (`migrations.ts:60`): `id, name, corridor_meters, required_coverage,
  schema_version, fingerprint TEXT NOT NULL UNIQUE, source_ride_id, source_start_point_index,
  source_end_point_index, created_at_ms`. **The `UNIQUE` on `fingerprint` needs a migration to
  remove it** — see fingerprint section below for why.
- `segment_reference_points` (`migrations.ts:85`): `segment_id, point_index, latitude,
  longitude, distance_meters NOT NULL, elevation_meters`, PK `(segment_id, point_index)`,
  cascades on segment delete.
- `matchSegment.ts`'s `SegmentDefinition.referencePolyline: ReferencePoint[]` is
  `{lat, lng, distanceMeters}[]` (no `elevationMeters` on the matcher's own type — the
  resampler's output type extends this with elevation for storage/fingerprinting, matcher
  input can structurally ignore the extra field).
- `getRideDetail.ts` returns ride summary stats only — no track points. A new query is needed
  for both #6 (render) and #7 (handle-drag range selection).
- Existing conventions to reuse, not reinvent: injected `generateId` (not bare
  `crypto.randomUUID()`, see `insertImportedRide.ts`); one-transaction insert pattern
  (`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`); `expo-crypto`'s `digestStringAsync(algorithm, data:
  string)` for hashing a canonical string (confirmed in `node_modules/expo-crypto/build/
  Crypto.d.ts:41` — distinct from `digest()`, which takes `BufferSource` and is what
  `computeFileHash.ts` already uses for raw file bytes).

## MapLibre API surface (confirmed against installed v11.3.6 source)

No `ShapeSource`/`LineLayer` (pre-v11 naming) — v11 uses:
- `GeoJSONSource` (`data: string | GeoJSON.GeoJSON`) + `<Layer type="line" layout={...}
  paint={{lineColor: ...}} />` nested inside it, to render a track as a line.
- `Camera` component: `initialViewState={{ bounds: LngLatBounds }}` for first-load framing, or
  imperative `cameraRef.current.fitBounds(bounds, padding?, durationMs?)`.
  `LngLatBounds = [west, south, east, north]` (plain number tuple).
- **No built-in "draggable point snapped to a line" primitive.** The only component with real
  `draggable`/`onDrag*` props is `ViewAnnotation`; `Marker` has none. No
  `react-native-gesture-handler`/`react-native-reanimated` installed.

## Decisions (Codex review, incorporated)

1. **Scrubber-driven selection (Option A).** Two-thumb range control built on React Native's
   built-in `PanResponder` (no gesture-handler/reanimated added). Map shows the selected
   sub-range as a highlighted polyline plus two non-draggable pin markers at the current
   endpoints — visual echoes of the scrubber thumbs, not independently draggable. Scrubber
   thumbs are keyboard/screen-reader accessible via explicit increment/decrement actions.
   Enforce start < end.
2. **Fingerprint is geometry-only — no source ride/range folded in.** See the dedicated
   section below; this is the correction that most needed independent verification, and it's
   now grounded in the real Kotlin implementation, not a description of it.
3. **`SegmentListScreen` is in scope**, replacing `SegmentsPlaceholderScreen`.
4. **Platform-specific map module** (`RouteMapView.native.tsx` / `RouteMapView.web.tsx`) so
   the web bundle's reachable graph never imports MapLibre's native-only code. Web renders a
   labeled static preview (e.g. distance/elevation summary, no map) — `web:smoke` must
   actually exercise the Ride Detail screen's import graph in the same commit that wires
   `RouteMapView` in, not just still pass by accident.

## Part 1 (issue #6): render the ride track

### New query
- `src/db/getRideTrack.ts` — `getRideTrack(db, rideId): RideTrackPoint[]`, one row per
  `ride_points` entry with GPS present (`WHERE latitude IS NOT NULL`), ordered by
  `point_index`, returning `{ pointIndex, timestampMs, lat, lng, distanceMeters,
  elevationMeters }` (nullable fields omitted per the existing convention, not emitted as
  `null`). `timestampMs` is required in the output (unlike the nullable-omitted fields) — the
  gap-splitting below depends on it.

### Gap handling (Codex correction, adopted)
A single `LineString` across a real GPS gap draws a false straight-line "road" through, e.g.,
a tunnel. Split into a `MultiLineString`: start a new line segment whenever two consecutive
GPS-present points are more than 30 seconds apart by `timestampMs` — reusing the exact
threshold `docs/MVP.md`'s matcher rules already use ("Allow GPS gaps up to 30 seconds"), not a
new invented constant.

### New component
- `src/screens/RouteMapView.native.tsx` — `<Map>` → `<Camera initialViewState={{bounds:
  computedBounds}}>` → `<GeoJSONSource data={multiLineStringFromSegments(points)}><Layer
  type="line" .../></GeoJSONSource>`. Props: `points`, optional `highlightRange:
  {startPointIndex, endPointIndex}` for #7's reuse (rendered as a second, differently-styled
  `Layer`). Bounding box: plain min/max reduce over `points`, no new dependency.
- `src/screens/RouteMapView.web.tsx` — same props, renders a labeled static fallback (no
  MapLibre import at all, so nothing in the web bundle's import graph touches native-only
  code).
- Wire into `RideDetailScreen.tsx`'s "Route" section, replacing the placeholder `View`.

### Verification
- `npm run typecheck && npm test && npm run web:smoke` — confirm `web:smoke` actually resolves
  `RouteMapView.web.tsx` (not the native file) once wired into `RideDetailScreen`; this is the
  first commit where that risk (flagged since the first plan, never yet live) becomes real.
- Real on-device: open the ride detail screen for both already-imported fixtures in the iOS
  Simulator, confirm the track renders (including a visible gap if either fixture has one —
  check first rather than assume), camera frames it.

## Part 2 (issue #7): define a segment

### Scrubber (Codex correction: distance-based, not index-based)
GPS sampling density varies with speed and pauses, so an index-linear scrubber gives uneven,
misleading precision (a stopped rider's points cluster in space; a fast descent's points
spread out). The scrubber must be driven by **cumulative geographic distance**:
1. Compute true cumulative haversine distance across GPS-present points (same distance
   function as the resampler below — one shared implementation, not two).
2. Each thumb's position maps to a distance value, not an array index.
3. On release, snap the distance to the nearest actual `ride_points` row, and persist that
   row's real `pointIndex` (which is `point_index` from `ride_points`, not necessarily
   contiguous with the other thumb's index if GPS points are sparse in that region).
4. Show the selected distance and elevation-at-point as scrubber context text.

### Resampling
- `src/segments/resamplePolyline.ts` — `resamplePolyline(points: {lat, lng, elevationMeters?}[],
  intervalMeters: number): SegmentReferencePoint[]` where `SegmentReferencePoint = {lat, lng,
  distanceMeters, elevationMeters?}` (structurally a superset of matcher's `ReferencePoint`,
  so it satisfies `SegmentDefinition.referencePolyline` without narrowing away elevation).
- Real haversine distance (matchSegment.ts's `toXY`/`distance` are a flat-plane approximation
  validated only at corridor scale, not over a segment's full length — do not reuse for this).
- Interpolates `elevationMeters` linearly alongside lat/lng when both bracketing points have
  it; omits it when either is missing (matches the "missing sensor data stays missing" rule
  already used throughout `persistImportedRide.ts`).
- Emits a point at distance 0, then every `intervalMeters` (10m), then the exact final
  endpoint if the total isn't an exact multiple of 10 — no duplicate-distance points, no
  zero-length trailing segment.
- Pure function, fully unit-testable with `node:test` (hand-verifiable against known
  distances, same pattern as `matchSegment.test.ts`).

### Fingerprint — verified cross-platform algorithm, not just a described one

Read `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/SegmentJsonParser.kt` and its
test directly (not paraphrased from a review comment). The real, already-shipped, already-
tested contract:

**Portable JSON shape** (`SegmentJsonParser.parse`/`SegmentDefinition`/`GeoPoint` in
`Models.kt`):
```json
{
  "schemaVersion": 1,
  "id": "...",
  "name": "...",
  "direction": "forward",
  "matching": { "corridorMeters": 30, "requiredCoveragePct": 0.9 },
  "referencePolyline": [
    { "lat": 37.0, "lng": -122.0, "distanceMeters": 0, "elevationMeters": 10 },
    { "lat": 37.001, "lng": -122.0, "distanceMeters": 111, "elevationMeters": 20 }
  ],
  "fingerprint": "..."
}
```
`corridorMeters` is an **Int** (30, matching `docs/MVP.md`'s fixed 30m corridor);
`requiredCoveragePct` a **Double** (0.9, matching the fixed 90% coverage) — both currently
fixed constants per `SegmentDefinition`'s Kotlin defaults, not yet user-configurable on
either platform, which simplifies canonicalization (no exotic values to round-trip).

**Canonical string** (`SegmentFingerprint.compute`, `SegmentJsonParser.kt` lines 66-79):
```
segment-fingerprint-v1\n
direction=forward\n
corridorMeters=30\n
requiredCoveragePct=0.9\n
<lat>,<lng>,<distanceMeters>,<elevationMeters-or-"null">\n   (repeated per point)
```
SHA-256 hex digest of that UTF-8 string, lowercase.

**The exact numeric-formatting gap Codex flagged, now verified rather than assumed**: Kotlin's
`Double.toString()` on the JVM (which `SegmentFingerprint.compute` calls directly) always
keeps a trailing `.0` for whole-number values — `37.0`, `-122.0`, `0.0`. JavaScript's
`Number.prototype.toString()` does not — `(37.0).toString()` gives `"37"`. Confirmed by
running both the real Java `Double.toString()` (via a standalone `javac`/`java` snippet
reproducing `SegmentFingerprint.compute`'s exact canonicalization, not a rewrite) and Node's
`Number.toString()` on the identical input values side by side: digit sequences agree for
non-whole numbers (`37.001` → `"37.001"` both sides); only the trailing `.0` differs. So the
TypeScript-side canonicalization needs exactly:
```ts
function toJavaDoubleString(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : value.toString();
}
```
**Known edge case to guard explicitly, not silently**: `Number.isInteger(-0)` is `true` in JS,
and `${-0}` stringifies to `"0"` (giving `"0.0"`), but Java's `Double.toString(-0.0)` gives
`"-0.0"`. Normalize any `-0` to `0` before formatting on the TS side (e.g. `value === 0 ?
0 : value`) so this asymmetry can never surface — cheap to guard, expensive to debug if a
resampled point ever lands on exactly `-0` from floating-point arithmetic.

**Real conformance fixture, verified against actual JVM execution** (not hand-computed): using
`SegmentJsonParserTest.kt`'s own existing `valid` fixture (`direction=forward, corridorMeters=
30, requiredCoveragePct=0.9`, points `[{37.0,-122.0,0,10}, {37.001,-122.0,111,20}]`), the
canonical string and SHA-256 are:
```
segment-fingerprint-v1
direction=forward
corridorMeters=30
requiredCoveragePct=0.9
37.0,-122.0,0.0,10.0
37.001,-122.0,111.0,20.0

SHA-256: c2b8492774847a2117a8a045de50aadecb71b9b98017892da38338809772e615
```
Implementation must include this exact fixture and hash as a `node:test` assertion in
`resamplePolyline.test.ts`/a dedicated fingerprint test, so a future accidental
canonicalization change on the TS side breaks CI immediately instead of silently producing
segments Karoo can't recognize. If Karoo's algorithm ever needs to change, version it
(`segment-fingerprint-v2`) rather than silently changing what existing fingerprints mean.

### Fingerprint uniqueness — schema migration required
`segments.fingerprint` is currently `NOT NULL UNIQUE`. Since the fingerprint is geometry-only
(no source ride/range), two geographically-identical segments from different rides — which
`docs/MVP.md` explicitly allows — would collide on that constraint. **New migration**: drop
`UNIQUE` from `fingerprint`, add a plain (non-unique) index for lookup performance. Segment
`id` remains the real primary key and stays unique. If exact re-save prevention is wanted
later, compare `(source_ride_id, source_start_point_index, source_end_point_index)` for a true
duplicate — a separate concern from fingerprint identity, out of scope for this increment
unless reviewers want it pulled in now.

### New persistence
- `src/segments/insertSegment.ts` — `insertSegment(db, generateId, params): {segmentId}`.
  Validate before opening the transaction (matches `insertImportedRide.ts`'s own practice of
  computing everything before `BEGIN IMMEDIATE`): at least 2 reference points, first point's
  `distanceMeters === 0`, strictly increasing `distanceMeters`, finite lat in [-90,90] and lng
  in [-180,180], finite optional elevation, `sourceStartPointIndex < sourceEndPointIndex`. One
  transaction: `segments` row + all `segment_reference_points` rows via `runMany` (existing
  `toSyncDatabase.ts` pattern, no adapter changes needed).
  - Tests: valid insert, each validation rejection, rollback when a mid-batch point insert
    fails (same pattern as `runMany`'s existing finalize-on-error test in
    `toSyncDatabase.test.ts`), and delete-cascades-to-reference-points.
- `src/db/getSegmentDetail.ts` — read-only query for the segment detail screen.
- `src/db/listSegments.ts` — for the Segments tab.

### Self-match verification — end-to-end, not just in-memory (Codex correction, adopted)
Before considering a saved segment correct, a test must: insert it via `insertSegment`, read
the reference points back from SQLite (not reuse the in-memory pre-insert array — this is the
whole point, since a bug in the round-trip through SQLite storage/retrieval wouldn't be caught
by validating data that never left memory), build `SegmentDefinition` from that read-back row,
feed the *source ride's own* timestamped GPS points (via `toMatcherRidePoints`) into the
already-tested `matchSegment()`, and assert it accepts a near-100%-coverage traversal. This
mirrors how PR3's real expo-sqlite mismatch was only caught by testing the actual adapter
shape, not a hand-copied stand-in — applied here to the new resampling/storage path.

### New screens
- `src/screens/DefineSegmentScreen.tsx` — pushed from `RideDetailScreen`'s now-enabled
  "Create Segment" button. Map (`RouteMapView` with `highlightRange`) + distance-based
  scrubber + name input + Save. On save: resample → fingerprint → `insertSegment` → navigate
  to the new segment's detail screen (cross-stack, see navigation below).
- `src/screens/SegmentDetailScreen.tsx` — name, route overview (`RouteMapView`, no highlight),
  empty "Attempts" section placeholder (matcher output isn't wired to any screen yet — out of
  scope here, matches issue #7's own "Done when").
- `src/screens/SegmentListScreen.tsx` — replaces `SegmentsPlaceholderScreen.tsx`. Lists saved
  segments (`listSegments`), tap → detail, with a delete action (segments are immutable in
  content but deletable per `docs/MVP.md`: "Deleting a segment permanently removes the
  definition... but leaves every ride intact").

### Navigation — real stack, typed cross-stack transition (Codex correction, adopted)
`RootNavigator` currently mounts `SegmentsPlaceholderScreen` directly as a bare tab screen, not
a stack — there's nowhere for `SegmentDetail` to push to today. Add:
- `src/navigation/SegmentsStackNavigator.tsx` — native-stack: `SegmentList` → `SegmentDetail`.
- `RootNavigator.tsx` — `SegmentsTab` now mounts `SegmentsStackNavigator`, not the placeholder.
- `src/navigation/types.ts` — `RidesStackParamList` gains `DefineSegment: {rideId}`;
  `SegmentsStackParamList` becomes `{SegmentList: undefined; SegmentDetail: {segmentId}}`.
- Post-save navigation from `DefineSegmentScreen` (mounted in the Rides stack) to
  `SegmentDetail` (in the Segments stack) is a cross-stack jump — React Navigation handles
  this via the root navigator's `navigate("SegmentsTab", {screen: "SegmentDetail", params:
  {segmentId}})`, not a same-stack `navigation.navigate("SegmentDetail")` call, which would
  fail silently/type-error since `SegmentDetail` isn't a route in `RidesStackParamList`. Get
  the typed signature right before writing the screen, not after debugging a runtime failure.

### Portable JSON representation
`toPortableSegmentJson(segment): object` — produces exactly the JSON shape verified above
(`schemaVersion`, `id`, `name`, `direction: "forward"`, `matching: {corridorMeters,
requiredCoveragePct}`, `referencePolyline`, `fingerprint`), so a segment saved on the phone is
immediately valid input to Karoo's real `SegmentJsonParser.parse()` — this is the actual
sharing contract, not a hypothetical one. Pure function, unit-tested against the conformance
fixture above.

## Testing approach

**Unit-testable, `node:test`, no native deps**: `resamplePolyline.ts` (including the
conformance fixture/hash above), `toJavaDoubleString`/canonicalization, `insertSegment.ts`
(validation + rollback + cascade-delete), `getRideTrack.ts`/`getSegmentDetail.ts`/
`listSegments.ts` (DB logic against `node:sqlite`), `toPortableSegmentJson.ts`, the end-to-end
self-match test (SQLite round-trip → `matchSegment()`).

**Not unit-testable, verify manually on-device**: `RouteMapView.native.tsx` (MapLibre
rendering, camera fitting, gap rendering), the scrubber interaction, the full define-segment
flow end to end on a real imported fixture. Call out exactly what was manually exercised in
each PR description.

## Commit/PR breakdown

1. `db/ride-track-query` — `getRideTrack.ts` (with `timestampMs`) + gap-detection/cumulative-
   distance tests.
2. `map/route-map-view` — `RouteMapView.native.tsx` + `RouteMapView.web.tsx`, wired into
   `RideDetailScreen`, `MultiLineString` gap rendering. Verify: web:smoke actually resolves
   the web variant, manual on-device render of both existing fixture rides.
3. `segments/resample-and-fingerprint` — `resamplePolyline.ts` (with elevation), the shared
   haversine distance function (reused by the scrubber), `toJavaDoubleString`, fingerprint
   computation, `toPortableSegmentJson.ts` + the conformance-fixture test. Pure logic, no UI.
4. `db/insert-and-query-segments` — migration removing `fingerprint UNIQUE` (+ non-unique
   index), `insertSegment.ts` (validation/rollback/cascade tests), `getSegmentDetail.ts`,
   `listSegments.ts`, and the end-to-end self-match test.
5. `ui/define-segment-screen` — distance-based accessible scrubber, non-draggable map pins,
   `DefineSegmentScreen.tsx`, `RideDetailScreen`'s button enabled. Verify manually on-device:
   define a real segment from an imported fixture, confirm persistence and a sane
   `matchSegment()` self-match.
6. `ui/segment-detail-and-list` — `SegmentsStackNavigator`, `SegmentDetailScreen.tsx`,
   `SegmentListScreen.tsx`, typed cross-stack post-save navigation.

Each PR reviewed the way this session has reviewed everything else: read the actual diff, run
the actual tests, verify on-device where native code is involved, don't trust a summary —
applied in this plan itself to Codex's own review, not just to future implementation.
