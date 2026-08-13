# GritMap MVP Specification

This document defines the executable MVP slice for GritMap. The broader product vision, post-MVP integrations, AI concepts, and open-source direction remain in [Grip-Map-app-spec.md](./Grip-Map-app-spec.md). If the documents differ on MVP behavior, this document is authoritative.

## Objective

Target date: **October 3, 2026** (fixed). Let a cyclist import Karoo FIT files, define an immutable directed segment, find every traversal of that segment across imported rides, and compare attempts spatially and physiologically, in time to inform training decisions before that attempt.

The validated loop is:

`Batch FIT import → choose reference ride → define segment → scan all rides → review borderline matches → compare attempts`

## Platform and boundaries

- React Native with Expo, cross-platform (iOS and Android) — not iOS-only. iOS is the primary day-to-day dev/test device; Android is verified via the Android Studio emulator, since no physical Android device is available for testing.
- No live device location/GPS dependency for MVP: all GPS and sensor data comes from imported FIT files, not from the phone's own location services. This means Android emulator testing is not blocked by the emulator's lack of real GPS hardware.
- Use an Expo development build, not Expo Go.
- All processing and persistence are local.
- SQLite is the canonical application store; original FIT files are retained locally.
- No login, backend, cloud sync, Terra, direct Hammerhead OAuth/API, webhooks, Peloton, Garmin, HealthKit/Health Connect, AI coach, leaderboard, or cloud segment registry.
- Segment definitions must still have a versioned portable JSON representation for future sharing and open-source extraction.

## MVP capabilities

### 1. FIT import

- Select and import one or many FIT files through the native file picker.
- Parse files independently and show progress plus imported, duplicate, replaced, and failed totals.
- Retain each original file and its SHA-256 hash.
- Preserve available timestamps, coordinates, distance, elevation, power, heart rate, cadence, speed, temperature, and device metadata.
- Store metric-normalized values, UTC timestamps, and original timezone/offset when available.
- Missing sensor data remains missing and must never be converted to zero.
- A parser version permits later reparsing from the original file.

#### Duplicate behavior

Flag a duplicate when any of these strong identity rules apply:

1. Exact file-content hash.
2. Same reliable FIT activity/session identifier.
3. If no identifier is available: same recording device, start timestamps within five seconds, and durations within five seconds.

Route similarity never establishes duplication; repeated rides on the same route are separate rides.

The prompt offers:

- **Keep Existing** — cancel this file's import.
- **Replace Existing** — preserve the internal ride ID, replace its parsed content, clear all automatic/manual match decisions, and rescan it against every segment.

Do not offer import-as-copy for the same physical ride.

### 2. Ride storage

- A ride is the source record and owns its GPS and sensor streams.
- Track/sensor points are stored once.
- Deleting a ride removes attempts and diagnostics derived from it.
- A minimal ride detail shows key stats, route, import status, detected segments, and a create-segment action. Full-ride performance charts may be deferred if the schedule tightens.

### 3. Segment definition

- Select start and end positions on an imported ride using map handles plus a distance/elevation scrubber for precision.
- Create a complete directed reference polyline from that ride range.
- Resample the reference polyline every 10 meters.
- Store a unique ID, name, directed polyline, endpoints, reference ride/range, 30-meter corridor, 90% required coverage, schema version, creation timestamp, and deterministic fingerprint.
- Segments are immutable. A correction creates a new segment.
- Segment names need not be unique, and overlapping or geographically identical segments are allowed.
- Deleting a segment permanently removes the definition and its attempts/diagnostics but leaves every ride intact.

### 4. Directed matching

For each segment and ride:

1. Find every ride point within 30 meters of the directed segment start.
2. Evaluate forward only from every candidate start.
3. Project ride points onto the reference polyline.
4. Record perpendicular corridor distance and progress along the reference.
5. Require mostly monotonic forward progress. Permit up to 30 meters of temporary backward projected movement for GPS jitter.
6. Require at least 90% reference-route coverage within the 30-meter corridor for automatic acceptance.
7. Allow GPS gaps up to 30 seconds. Longer gaps make an otherwise completed candidate borderline.
8. Reject reverse traversal and endpoint-only matches that use another route.
9. Save every valid traversal, including multiple attempts in one ride, without duplicating overlapping detections of the same traversal.
10. Ignore candidates that never reach the segment end.

Candidates passing every rule are accepted automatically. Completed same-direction candidates that are sub-threshold or ambiguous go to advanced review.

Calculate a diagnostic confidence score using coverage, direction/order, corridor distance, backward movement, and GPS continuity. Store the matcher version with every decision.

### 5. Attempt and review model

A segment attempt references its source ride using start/end point indexes or offsets and timestamps. It does not copy the ride's GPS or sensor streams.

Segment duration is wall-clock time between FIT timestamps at the segment boundaries. Stops and bike-computer auto-pause remain part of the attempt time.

Advanced review shows:

- Ride/reference route overlay and proposed boundaries.
- Coverage percentage.
- Maximum and median deviation.
- Backward projected movement.
- GPS gaps and direction/order checks.
- Confidence and reasons for uncertainty.

The user can confirm or reject a completed candidate. Confirmed candidates participate normally and retain a `manuallyApproved` marker. Rejected candidates create no segment-attempt relationship. Lightweight review diagnostics may remain associated with the intact ride for tuning.

Rejected and borderline candidates are reevaluated when the matcher version changes during MVP tuning. Because segments are immutable, changing a definition means creating and scanning a new segment.

The advanced-review workflow is temporary and may be hidden or removed once matching reliability is proven.

### 6. Attempt comparison

- Select any two valid attempts; default to newest versus the previous valid attempt.
- Resample both attempts on a common 10-meter distance axis.
- Use linear interpolation for ordinary continuous metrics, but never interpolate through a gap longer than 30 seconds.
- Display missing regions as gaps, not zeros.
- Calculate cumulative wall-clock elapsed-time difference at every distance sample.
- MVP channels: cumulative time gap, power, heart rate, and elevation.
- Cadence and speed are optional schedule-dependent channels.
- Show attempt lines with a color-coded difference band and make the selected attempts explicit.
- Use unsmoothed data for calculations. Any light display smoothing must be documented.

## Suggested UI scope

Prioritize the core loop over navigation polish. A stack or two primary sections—**Rides** and **Segments**—is sufficient initially. Home/goal polish and a three-tab structure may follow if the core loop is complete.

Required screens:

1. FIT import/batch result.
2. Ride list and minimal ride detail.
3. Segment definition with map and precision scrubber.
4. Segment detail with attempts.
5. Advanced diagnostic review.
6. Attempt comparison.

## Persistence model

Use SQLite with explicit migrations and foreign-key enforcement. At minimum, model:

- `rides`
- `ride_points`
- `imported_files`
- `segments`
- `segment_reference_points`
- `segment_attempts`
- `match_diagnostics`

Index ride timestamps, segment IDs, and attempt ride/range columns. Segment deletion cascades only to its attempts and diagnostics. Ride deletion cascades to all derived attempts and diagnostics.

## Delivery order

1. FIT parser spike using real Karoo files; verify per-point timestamps, GPS, elevation, power, and heart rate.
2. SQLite schema, original-file retention, batch import, and duplicate handling.
3. Route rendering and segment-selection prototype.
4. Directed matcher with synthetic and real fixtures.
5. Diagnostic review and matcher-version reevaluation.
6. Distance resampling, cumulative time-gap calculation, and comparison chart.
7. UX cleanup, performance validation, and acceptance testing.

## Acceptance criteria

- Import at least 100 FIT files in a batch without crashing.
- A failed file does not roll back successful imports.
- Correctly report exact duplicates and distinguish daily rides over the same route.
- Replace a ride and automatically reevaluate all segment relationships.
- Define an immutable directed segment from an imported ride.
- Find every known valid same-direction traversal, including multiple traversals in one ride.
- Reject reverse traversal and paths that merely connect the endpoints through another route.
- Ignore incomplete traversals that never reach the end.
- Automatically accept candidates satisfying the matcher contract.
- Surface completed borderline candidates with useful diagnostics.
- Include manually confirmed attempts in normal comparison.
- Preserve stopped/auto-paused time in attempt duration.
- Compare attempts across cumulative time gap, power, heart rate, and elevation.
- Complete first import through first comparison without an account, backend, or network dependency beyond map tiles.

## Post-MVP handoff

After validating the core loop:

- Improve the matcher from collected fixtures and remove/disable routine review.
- Extract the matcher as a standalone open-source library.
- Add an optional cloud registry for immutable segment definitions and discovery while keeping rides and matching local by default.
- Evaluate direct Hammerhead integration or an aggregation provider based on cost and demand.
- Continue with the broader roadmap in [Grip-Map-app-spec.md](./Grip-Map-app-spec.md).
