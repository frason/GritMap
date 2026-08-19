# Handoff: Plan ready for review — render ride track + define segment (issues #6, #7)

- Updated: `2026-08-18 22:55 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `1097e5f Merge pull request #56 from frason/test/issue-53-expo-sqlite-bootstrap-test`
- Worktree: clean

## Status: awaiting review, not yet implemented

Per this repo's established process (the first UI increment's plan was reviewed by Codex
before implementation, see `docs/PLAN_first_ui_increment.md`'s revisions-incorporated
section), a plan for the next increment is written and ready for review, **not started**:

**[`docs/PLAN_segment_definition_increment.md`](../docs/PLAN_segment_definition_increment.md)**

Covers issues #6 ("Render ride GPS track on MapLibre map") and #7 ("Segment definition: map
handles + scrubber, persist directed segment") together, since #7 formally `depends_on: #6`
and #6 isn't done yet — `RideDetailScreen.tsx`'s Route section is still the honest placeholder
from the first increment.

**Grounded in real source, not assumed**, including a subagent survey of the actual installed
`@maplibre/maplibre-react-native@11.3.6` API surface (no `ShapeSource`/`LineLayer` — v11 uses
`GeoJSONSource`+`Layer`; no gesture-handler/reanimated installed; no snap-to-line drag
primitive exists in the library).

**Four things flagged for review rather than decided solo** (see the plan's "Open questions"
section for full detail):
1. **Handle interaction model** — the plan recommends a scrubber-only precision model (no new
   native dependency) over literal free-drag map pins (would need
   `react-native-gesture-handler` + hand-rolled line-snapping, another native-linking cycle).
2. **Fingerprint composition** — `segments.fingerprint` is `NOT NULL UNIQUE` at the schema
   level, but MVP.md says geographically-identical segments are allowed. A geometry-only hash
   would collide on that UNIQUE constraint for two identical-route segments from different
   rides. Plan recommends folding `source_ride_id` + point-range into the fingerprint so only
   an exact re-save of the same range collides (arguably correct), not real duplicates.
3. Whether replacing the Segments tab's placeholder with a real list screen is in scope now.
4. The MapLibre-on-web `web:smoke` risk (flagged twice already, never yet gone live because
   nothing reachable imported MapLibre) becomes real the moment this increment wires
   `RouteMapView` into `RideDetailScreen` — confirm it gets fixed as part of this work, not
   deferred a third time.

## Next safe action

Review `docs/PLAN_segment_definition_increment.md`, resolve the four open questions above (or
send back requested revisions the way Codex did for the first plan), then implement per the
commit/PR breakdown at the end of the plan (6 small PRs, same verification discipline as the
first increment — typecheck/test/web:smoke every PR, real on-device verification for anything
MapLibre-touching).

## Recent history (this session, full detail in `handoffs/archive/`)

- First UI increment (8 PRs: nav shell, dev-client, sqlite adapter, import screens, ride
  list/detail) — complete, pushed, manually verified including the duplicate-decision modal
  and multi-file batch import (`2026-08-18-1539-claude-manual-pass-verified.md`).
- PR #54 (MapLibre scaffold, issue #47) — resolved directly on `main`, not a raw merge
  (`2026-08-18-1343-claude-pr54-resolved.md`).
- Issues #5, #19 closed as already-shipped by the first increment.
  [PR #55](https://github.com/frason/GritMap/pull/55) rebased the stale issue #43 worktree
  onto current `main`, hand-resolved a real conflict with an independently-landed
  `persistMatchCandidate.ts` fix, merged.
  [PR #56](https://github.com/frason/GritMap/pull/56) added the automated `mock.module()`
  test issue #53 asked for against the real `initializeDatabase.ts`/`toSyncDatabase.ts` (no
  duplicate adapter file), merged.
  (`2026-08-18-2156-claude-issues-5-19-43-53-closed.md`)

## Parallel Karoo status (carried forward, full history in `handoffs/archive/`)

Codex has been shipping steadily on `apps/karoo/` throughout this session, entirely
independently of the root-app work above. Most recent: `74150e4 apps/karoo: add live data
field demo` — launcher Start/Stop controls for a process-local, non-persistent 34-second
segment simulation cycling through zones/metrics for demo purposes; never writes dummy data to
Room, a real detected segment takes control automatically. APK is 0.7.0/versionCode 10, JVM
tests and assembly passed. The Karoo device remains disconnected, so on-device installation of
the last several versions is still pending — reconnect and `adb install -r
apps/karoo/app/build/outputs/apk/debug/app-debug.apk` when ready.
