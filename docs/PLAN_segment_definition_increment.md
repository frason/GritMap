# Second UI increment: render ride track → define segment (issues #6, #7)

## Codex review — revisions required before implementation (2026-08-18)

The six-commit increment and dependency order are sound, but the plan is **approved only after
the revisions below are incorporated**. These resolve the four open questions and correct
cross-platform/data-integrity gaps found against the current root and Karoo implementations.

### Decisions on the four open questions

1. **Use Option A: scrubber-driven selection.** Show start/end pins on the map as visual echoes
   of the two scrubber thumbs, but do not imply that the map pins themselves are draggable.
   Use React Native `PanResponder`; do not add gesture-handler/reanimated for this increment.
   Add accessible increment/decrement actions and enforce start < end.
2. **Do not put source ride identity into the fingerprint.** A fingerprint identifies immutable,
   directed geography plus matching parameters for phone/Karoo/cloud sharing. Including
   `source_ride_id` or source indexes would make the same segment hash differently for every
   user and conflicts with the existing Karoo `SegmentFingerprint` contract. Instead add a
   migration that removes `UNIQUE` from `segments.fingerprint`; keep a normal fingerprint index.
   IDs remain unique, while geographically identical definitions may share a fingerprint as
   the product specification requires. Exact re-save prevention, if desired, should compare the
   source `(ride_id,start_index,end_index)` separately and must not redefine fingerprint identity.
3. **Include `SegmentListScreen` now.** A saved immutable segment needs a discoverable home and
   deletion path; leaving the permanent Segments tab as a placeholder would make the creation
   loop incomplete.
4. **Fix web reachability in the map commit.** Use platform-specific modules (for example,
   `RouteMapView.native.tsx` and `RouteMapView.web.tsx`) so the reachable web graph never imports
   MapLibre's native implementation. The web version may be a clearly labeled track preview or
   fallback, but `web:smoke` must exercise the real Ride Detail import graph in that same commit.

### Required technical corrections

- **Preserve GPS gaps instead of drawing false roads.** `getRideTrack` must also return
  `timestampMs`. Build a `MultiLineString`, splitting whenever consecutive GPS-present points
  are more than 30 seconds apart. This uses the already-decided matcher continuity threshold and
  prevents a tunnel/device gap from appearing as a real traversed straight line.
- **Drive the scrubber by cumulative geographic distance, not array index.** GPS sampling density
  changes with speed and pauses, so index-linear thumbs produce uneven and misleading precision.
  Compute cumulative haversine distance across GPS-present points, map each thumb to distance,
  then snap to a source point while retaining its real (possibly non-contiguous) `pointIndex` for
  persistence. Display selected distance and elevation context in the scrubber.
- **Resample elevation as well as coordinates.** The resampler input/output must carry optional
  `elevationMeters` and linearly interpolate it when both bracketing values exist. Its output can
  structurally extend matcher `ReferencePoint`; do not narrow it to `{lat,lng}` and silently lose
  FIT barometric elevation. Emit 0 m, each 10 m station, and the exact final endpoint when the
  total is not a multiple of 10; avoid duplicate-distance endpoints and consecutive zero-length
  source legs.
- **Make the fingerprint byte-identical across TypeScript and Kotlin.** The portable JSON must
  match Karoo's schema (`schemaVersion`, `id`, `name`, `direction: "forward"`, `matching`, ordered
  `referencePolyline`, optional `fingerprint`) and include elevation. Add a checked-in conformance
  fixture with its expected SHA-256 and tests on both sides before relying on sharing. Explicitly
  define numeric canonicalization—plain JS and Kotlin string conversion differ for values such
  as `0` versus `0.0`. If the Karoo v1 algorithm must be revised, version the fingerprint
  algorithm rather than silently changing existing hashes.
- **Define cross-stack navigation before UI implementation.** `RootNavigator` currently mounts
  the Segments placeholder directly, not a Segments stack. Add a real `SegmentsStackNavigator`
  and type the nested tab navigation used after Save (`SegmentsTab` → `SegmentDetail`). Do not
  assume a screen in the Rides stack can directly navigate to a sibling stack route.
- **Validate persistence inputs before the transaction.** Require at least two reference points,
  first distance exactly zero, strict distance increase, finite/in-range coordinates, valid
  optional elevation, a real source ride/range, and start < end. Inject both ID and clock for
  deterministic tests. Test rollback on a mid-point insert failure and deletion semantics.
- **Keep the real self-match check, but make it end-to-end.** Read the newly stored reference
  points back from SQLite, feed the source ride's timestamped GPS points to `matchSegment`, and
  assert an accepted near-100% traversal. Do not validate only the in-memory pre-insert array.

### Revised commit implications

- Commit 1 (`db/ride-track-query`) also includes timestamps and gap/cumulative-distance tests.
- Commit 2 (`map/route-map-view`) includes native/web module separation and MultiLineString gaps.
- Commit 3 (`segments/resample-and-fingerprint`) includes elevation interpolation, the shared
  JSON/fingerprint conformance fixture, and numeric-canonicalization tests.
- Commit 4 (`db/insert-and-query-segments`) begins with the migration removing fingerprint
  uniqueness while adding a non-unique index, then covers validation/rollback/delete behavior.
- Commit 5 uses a distance-based accessible scrubber and explicitly non-draggable map pins.
- Commit 6 adds the actual Segments stack/list/detail and typed cross-tab post-save navigation.

Do not begin implementation from the contradictory recommendations later in this document
(especially source-derived fingerprints); this review section supersedes them until Claude folds
the revisions into the main body.

## Context

The first UI increment (import → ride list → ride detail, `docs/PLAN_first_ui_increment.md`)
is complete, merged, and manually verified — including this session's follow-up work landing
issue #43 (matcher overlap-dedup + version-aware rescan) and issue #53 (automated test for the
SQLite bootstrap adapter). `src/screens/MapScreen.tsx` exists as a bare, unwired scaffold from
issue #47/PR #54 (`<Map style={...} mapStyle="..." />`, nothing else) — no other file in the
repo references MapLibre.

Issue #7 ("Segment definition: map handles + scrubber, persist directed segment") formally
`depends_on: #4, #6`. #4 (schema) is done. **#6 ("Render ride GPS track on MapLibre map") is
not done** — `RideDetailScreen.tsx`'s "Route" section is still an honest placeholder ("Map
view — available once segment tooling lands"). So this plan covers both issues together, in
that dependency order, as one increment — matching this repo's practice of not building #7
against a foundation that doesn't exist yet.

## What's already there (verified against real source, not assumed)

- `ride_points` (`src/db/migrations.ts:42`): `ride_id, point_index, timestamp_ms, latitude,
  longitude, distance_meters, elevation_meters, ...`, PK `(ride_id, point_index)`. Lat/lng are
  nullable together (`CHECK ((latitude IS NULL) = (longitude IS NULL))`).
- `segments` (`migrations.ts:60`): `id, name, corridor_meters, required_coverage,
  schema_version, fingerprint TEXT NOT NULL UNIQUE, source_ride_id, source_start_point_index,
  source_end_point_index, created_at_ms`.
- `segment_reference_points` (`migrations.ts:85`): `segment_id, point_index, latitude,
  longitude, distance_meters NOT NULL, elevation_meters`, PK `(segment_id, point_index)`,
  cascades on segment delete.
- `matchSegment.ts`'s `SegmentDefinition.referencePolyline: ReferencePoint[]` is exactly
  `{lat, lng, distanceMeters}[]` — the resampled output this plan produces must match this
  shape exactly, since it's what the matcher (already built, already tested) consumes.
- `getRideDetail.ts` returns ride summary stats only — no track points. A new query is needed
  for both #6 (render) and #7 (handle-drag range selection).
- Existing conventions to reuse, not reinvent: injected `generateId` (not bare
  `crypto.randomUUID()`, see `insertImportedRide.ts`); one-transaction insert pattern
  (`BEGIN IMMEDIATE`/`COMMIT`/`ROLLBACK`); `expo-crypto`'s `digestStringAsync(algorithm, data:
  string)` for hashing a canonical string (confirmed in `node_modules/expo-crypto/build/
  Crypto.d.ts:41` — distinct from `digest()`, which takes `BufferSource` and is what
  `computeFileHash.ts` already uses for raw file bytes).

## MapLibre API surface (confirmed against installed v11.3.6 source, not general Mapbox/MapLibre knowledge)

No `ShapeSource`/`LineLayer` (pre-v11 naming) — v11 uses:
- `GeoJSONSource` (`data: string | GeoJSON.GeoJSON`) + `<Layer type="line" layout={...}
  paint={{lineColor: ...}} />` nested inside it, to render a track as a line.
- `Camera` component: `initialViewState={{ bounds: LngLatBounds }}` for first-load framing, or
  imperative `cameraRef.current.fitBounds(bounds, padding?, durationMs?)`.
  `LngLatBounds = [west, south, east, north]` (plain number tuple).
- **No built-in "draggable point snapped to a line" primitive exists.** The only component
  confirmed to expose real `draggable`/`onDragStart`/`onDrag`/`onDragEnd` props is
  `ViewAnnotation` — `Marker` (the more commonly-documented component) does not expose
  `draggable` in its type surface at all, on either platform. Dragging a handle *along* a
  specific GPS track would require hand-rolling nearest-point-on-line projection in an
  `onDrag` handler.
- No `react-native-gesture-handler` or `react-native-reanimated` installed. Adding
  interactive drag would mean adding one of these, or working entirely through
  `ViewAnnotation`'s native drag callbacks without a gesture library.

**This directly shapes a design decision below (see "Handle interaction model").**

## Part 1 (issue #6): render the ride track

### New query
- `src/db/getRideTrack.ts` — `getRideTrack(db, rideId): RideTrackPoint[]`, one row per
  `ride_points` entry with GPS present (`WHERE latitude IS NOT NULL`), ordered by
  `point_index`, returning `{ pointIndex, lat, lng, distanceMeters, elevationMeters }` (nullable
  fields omitted per the existing convention in `getRideIdentity.ts`/`listRides.ts`, not
  emitted as `null`).
- **MVP simplification worth flagging explicitly, not silently deciding**: rendering a single
  `LineString` from consecutive GPS-present points draws a straight line across any GPS gap
  (e.g., a tunnel). This matches the matcher's own gap-tolerance philosophy (`docs/MVP.md`
  "Allow GPS gaps up to 30 seconds") but is a real visual simplification for longer gaps —
  acceptable for MVP, flagging so it isn't assumed away.

### New component
- `src/screens/RouteMapView.tsx` — takes `points: {lat, lng}[]` (plus optional highlighted
  sub-range for #7's reuse) as props. Renders `<Map>` → `<Camera initialViewState={{bounds:
  computedBounds}}>` → `<GeoJSONSource data={lineStringFromPoints(points)}><Layer type="line"
  .../></GeoJSONSource>`. Bounding box computed as a plain min/max reduce over the points — no
  new dependency needed.
- Wire into `RideDetailScreen.tsx`'s "Route" section, replacing the placeholder `View`.

### Verification
- `npm run typecheck && npm test && npm run web:smoke` (note: `MapScreen.tsx`'s existing
  flagged risk — MapLibre's native-only imports never resolve for `web:smoke` today because
  nothing reachable imports it. The moment `RouteMapView` is wired into `RideDetailScreen`
  (which the web-reachable entry graph does hit), this risk goes live. **Confirm and fix at
  implementation time, don't assume it "probably still works."**
- Real on-device: open the ride detail screen for one of the two already-imported fixtures in
  the iOS Simulator, confirm the track renders and the camera frames it.

## Part 2 (issue #7): define a segment

### Handle interaction model — flagging for review, not deciding unilaterally

MVP.md: "Select start and end positions ... using map handles **plus** a distance/elevation
scrubber for precision." Given MapLibre has no snap-to-line drag primitive and no gesture
library is installed, two honest options:

**Option A (recommended): scrubber is the precision mechanism, handles are a visual echo.**
A horizontal scrubber (two thumbs on a single track, standard RN slider composition — no new
native dependency needed for a basic two-handle range slider on a `View`/`PanResponder`,
which *is* built into React Native core, no gesture-handler needed) selects the sub-range by
**point index**, and the map just re-renders the highlighted sub-polyline as visual feedback.
No native map-gesture code, no line-snapping math, no new dependency. Matches "handles plus a
scrubber for precision" if "handles" refers to the scrubber's own thumbs rather than literal
free-drag pins on the map.

**Option B: real map-based dragging.** Add `react-native-gesture-handler`, drag a
`ViewAnnotation` per handle, project each drag position onto the nearest `ride_points` index
(haversine nearest-neighbor, not full line-snapping) on every `onDrag` event, update both the
map highlight and a synced scrubber position. Materially more implementation and native-linking
risk (new native module → another `expo prebuild --clean` cycle) for a precision benefit the
scrubber alone likely already covers, since ride points are GPS-frequency (~1/sec), not
sparse.

**This plan defaults to Option A** pending review — it's a real UX/scope call, not a foregone
conclusion.

### Resampling (new, nothing existing to reuse)
- `src/segments/resamplePolyline.ts` — `resamplePolyline(points: {lat,lng}[], intervalMeters:
  number): ReferencePoint[]`. Needs a **real haversine distance function** — `matchSegment.ts`'s
  `toXY`/`distance` helpers are an origin-relative flat-plane approximation validated only at
  corridor scale (tens of meters), not verified accurate over a multi-kilometer segment's full
  length. Walks the selected point range, accumulates true great-circle distance, and produces
  a new point every `intervalMeters` (10m per MVP.md) via linear interpolation between the two
  bracketing source points. Pure function, fully unit-testable with `node:test` — no native
  dependency, same pattern as `matchSegment.test.ts`.

### Fingerprint — a real spec/schema tension to flag, not paper over
`segments.fingerprint` is `NOT NULL UNIQUE` at the DB level. MVP.md: "overlapping or
geographically identical segments are allowed" and "deterministic fingerprint (e.g. hash of
resampled polyline + endpoints)." Taken literally, two geographically-identical segments would
produce the *same* fingerprint and collide on the UNIQUE constraint — contradicting "allowed."
Needs a decision before implementation, not an assumption:
- (a) Fold something disambiguating into the fingerprint (e.g. `source_ride_id` +
  `source_start_point_index`/`end_point_index`, not just geometry) — then "identical geometry
  from two different rides" is allowed but "the exact same ride range saved twice" collides
  (arguably correct — that's a real duplicate, not a new segment).
  (b) Treat a fingerprint collision as its own "this exact geometry already exists" duplicate
  flow (mirroring the FIT import duplicate modal) rather than a hard save failure.
  Recommend (a) as simplest and most consistent with "geographically identical from different
  rides is allowed, the literal same save twice is not" — but this is exactly the kind of call
  this repo's process has routed through Codex review before, not decided solo.

### New persistence
- `src/segments/insertSegment.ts` — `insertSegment(db, generateId, params): {segmentId}`. One
  transaction: `segments` row + all `segment_reference_points` rows, mirroring
  `insertImportedRide.ts`'s pattern (including its `runMany`-based bulk point insert via
  `toSyncDatabase.ts` — already exists, no adapter changes needed).
- `src/db/getSegmentDetail.ts` — read-only query for the segment detail screen.
- `src/db/listSegments.ts` — for the Segments tab (see screens below).

### New screens
- `src/screens/DefineSegmentScreen.tsx` — pushed from `RideDetailScreen`'s now-enabled
  "Create Segment" button. Map (reusing `RouteMapView` with a highlighted sub-range) + range
  scrubber + name input + Save. On save: resample → fingerprint → `insertSegment` → navigate
  to the new segment's detail screen.
- `src/screens/SegmentDetailScreen.tsx` — name, route overview (`RouteMapView` again, no
  highlight needed), empty "Attempts" section placeholder (matcher output isn't wired to any
  screen yet — out of scope here, matches issue #7's own "Done when").
- `src/screens/SegmentsPlaceholderScreen.tsx` → real `SegmentListScreen.tsx` (cheap given
  `listSegments` already exists for the detail screen's own needs, and completes the tab's
  loop instead of leaving it a dead-end stub). Not explicitly required by issue #7's "Done
  when" — flagging as an in-scope-but-not-mandated addition, drop it if reviewers want a
  tighter scope.
- `src/navigation/types.ts` — extend `SegmentsStackParamList` with `SegmentList`,
  `SegmentDetail: {segmentId}`; `RidesStackParamList` gains `DefineSegment: {rideId}`.

### Portable JSON representation
MVP.md/issue #7 also asks for "a versioned portable JSON representation ... for future
sharing." A simple `toPortableSegmentJson(segment): object` pure function (schema version +
name + directed polyline + endpoints + corridor + coverage) satisfies this per the issue's own
"a simple JSON serialization of the stored segment is sufficient for MVP" — no file I/O, no
UI, just the serialization function, unit-tested.

## Testing approach (same split as the first increment)

**Unit-testable, `node:test`, no native deps**: `resamplePolyline.ts` (pure geometry, easy to
hand-verify against known distances), `insertSegment.ts`/`getRideTrack.ts`/
`getSegmentDetail.ts`/`listSegments.ts` (DB logic against `node:sqlite`, same pattern as every
other `src/db/*.test.ts`), `toPortableSegmentJson.ts`.

**Not unit-testable, verify manually on-device**: `RouteMapView.tsx` (MapLibre rendering,
camera fitting), the scrubber interaction itself, the full define-segment flow end to end.
Call out exactly what was manually exercised in the PR description, per this repo's standing
practice — including confirming the resampled/persisted segment's `referencePolyline` actually
round-trips correctly into `matchSegment()` against a real ride (even though wiring the
matcher into the UI is out of scope for #7 itself, a quick script-level check that a real
saved segment's stored polyline produces a sane `matchSegment()` result against its own source
ride is cheap and would have caught PR3's original expo-sqlite API mismatch class of bug
early, applied here to the new resampling math instead).

## Open questions for review (not decided solo, same as the first plan's Codex round)

1. Handle interaction model: Option A (scrubber-only precision, recommended) vs Option B (real
   map dragging, needs a new native dependency).
2. Fingerprint composition: fold in `source_ride_id` + point-range (recommended), or a
   geometry-only hash with a duplicate-decision UI like FIT import's.
3. Whether `SegmentListScreen` (replacing the tab placeholder) is in scope now or deferred.
4. Confirm the `web:smoke` MapLibre-on-web risk gets addressed as part of #6, not deferred
   again — it was flagged twice already (PLAN_first_ui_increment.md, then the PR #54 handoff)
   without ever actually going live until now.

## Commit/PR breakdown (small, single-purpose, matching this repo's convention)

1. `db/ride-track-query` — `getRideTrack.ts` + tests.
2. `map/route-map-view` — `RouteMapView.tsx`, wired into `RideDetailScreen`, `web:smoke` fix
   if needed. Verify: web:smoke, manual on-device render of both existing fixture rides.
3. `segments/resample-and-fingerprint` — `resamplePolyline.ts`, fingerprint function,
   `toPortableSegmentJson.ts` + tests. Pure logic, no UI yet.
4. `db/insert-and-query-segments` — `insertSegment.ts`, `getSegmentDetail.ts`,
   `listSegments.ts` + tests.
5. `ui/define-segment-screen` — the scrubber UI, `DefineSegmentScreen.tsx`, wired to
   `RideDetailScreen`'s now-enabled button. Verify manually on-device: define a real segment
   from an imported fixture, confirm it persists and round-trips into `matchSegment()`
   sanely.
6. `ui/segment-detail-and-list` — `SegmentDetailScreen.tsx`, `SegmentListScreen.tsx`,
   navigation wiring.

Each PR reviewed the way this session has reviewed everything else: read the actual diff, run
the actual tests, verify on-device where native code is involved, don't trust a summary.
