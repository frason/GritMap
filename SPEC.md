# SPEC — GritMap

_Living spec. Discovery for this project happened via a `/grill-me` interrogation pass
before this repo existed; the outcome is summarized here, with full detail in
[docs/MVP.md](docs/MVP.md) (authoritative for MVP behavior) and
[docs/Grip-Map-app-spec.md](docs/Grip-Map-app-spec.md) (broader product context)._

## Status
- Phase: build <!-- discovery | build | verify -->
- Settled slices: FIT import, segment definition, directed matching, diagnostic review,
  attempt comparison (all of `docs/MVP.md`'s "MVP capabilities" 1–6)
- Open: sample Karoo FIT files for the parser spike (see lead-inbox kickoff — the lead will
  raise this as an `agent-question` if needed)

## Overview
A React Native (Expo) app that lets a cyclist import Karoo FIT files, define a directed
GPS segment once, automatically find every past/future traversal of it, and compare
attempts on a distance-aligned diff overlay — replacing Strava segment matching, which is
losing third-party access in September 2026.

## Users & jobs
- Primary user: Jason, an endurance cyclist training for a specific goal.
- The one job: PR a 6.5-mile hill climb (45min → 39min target) by comparing this attempt
  against past attempts on the same physical stretch of road.
- MVP = done enough to use when: import real FIT files → define the hill climb segment →
  see every historical attempt auto-detected → compare two attempts on one overlay chart,
  entirely offline, with no account/backend.

## Scope & non-goals
- In scope (v1): batch FIT import, directed segment definition (map scrubber UI),
  automatic directed segment matching (including retroactive history), advanced diagnostic
  review for borderline matches, attempt comparison (cumulative time-gap, power, HR,
  elevation channels on a shared 10m distance axis).
- Explicitly NOT doing (v1): Peloton/indoor rides, HealthKit/Health Connect ingestion,
  AI coach, multi-goal dashboard, open-source segment library extraction, login/accounts,
  cloud sync, Garmin, direct Hammerhead OAuth/API/Terra/webhooks, weather beyond what the
  Karoo records, cloud segment registry, leaderboards.
  ← karen flags anything built beyond this as over-engineering.

## Main flow (happy path)
1. Import one or many Karoo-exported FIT files via the native file picker.
2. Pick a reference ride, drag start/end scrubber handles on its rendered GPS track to
   define a segment (e.g. "Hill Climb PR").
3. App scans all imported rides against the segment's directed reference polyline and
   surfaces every valid same-direction traversal, including retroactively.
4. Borderline candidates go to an advanced diagnostic review screen; user confirms/rejects.
5. User compares any two valid attempts on a distance-resampled diff-overlay chart.

## Stack & integrations
- Runs as: mobile app (React Native + Expo, development build — not Expo Go).
- Platform: cross-platform (iOS + Android), not iOS-only. iOS is the primary dev/test
  device; Android is verified via the Android Studio emulator only (no physical Android
  device available). No live device GPS dependency — all spatial data comes from imported
  FIT files, so the emulator's lack of real GPS hardware is not a blocker.
- Language/framework: TypeScript, React Native, Expo.
- Map/elevation stack: MapLibre (`@maplibre/maplibre-react-native`) + OpenStreetMap vector
  tiles. FIT files' own barometric elevation is the elevation source — no separate lookup.
- Persistence: SQLite (canonical store), explicit migrations, foreign-key enforcement.
  Original FIT files retained locally with SHA-256 hashes for reparsing. Minimum tables:
  `rides`, `ride_points`, `imported_files`, `segments`, `segment_reference_points`,
  `segment_attempts`, `match_diagnostics`. See `docs/MVP.md` "Persistence model" for detail.
- Integrates with: nothing external for MVP — no backend, no network dependency beyond
  map tiles.
- Auth/users: none for MVP (single local user, no accounts).

## Acceptance & quality bar
- A feature is "done" when it meets `docs/MVP.md`'s "Acceptance criteria" list, in full,
  including:
  - Import ≥100 FIT files in a batch without crashing; a failed file never rolls back
    successful imports.
  - Correctly distinguishes exact duplicates from daily rides over the same route.
  - Directed matcher rejects reverse traversal and endpoint-only matches via another route
    (this was the core correctness requirement surfaced during discovery — the matcher
    must use the full directed reference polyline, not just start/end proximity, because
    the primary segment is ridden in both directions).
  - First import through first comparison completes with no account, backend, or network
    dependency beyond map tiles.
- Quality bar: no performance/scale requirements beyond the acceptance criteria above —
  this is a single-user personal tool, not a multi-tenant product, for MVP.

## Guardrails
- Agents must never: add a backend/auth/cloud sync for MVP, add Peloton/Garmin/Hammerhead
  live-API integrations for MVP, push to `main`, force-push, or introduce a paid
  dependency (map tiles, elevation, etc. — the recommended stack is free/open-source).
- Decisions that come back to the client: anything that would expand scope beyond the
  "Explicitly NOT doing (v1)" list above, and the sample-FIT-files question noted in Open.

## Build order & dependencies
See [docs/MVP.md](docs/MVP.md) "Delivery order" (7 steps) and the kickoff goal in
`lead-inbox/` for the lead's first-pass decomposition into GitHub Issues with `depends_on`
chains: scaffold → FIT parser spike → SQLite schema/import → route rendering/segment
selection → directed matcher → diagnostic review → comparison chart → UX/perf/acceptance
testing. Target date: **October 3, 2026** (fixed).
