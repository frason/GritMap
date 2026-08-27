# Handoff: Ride-detail attempts fixed; post-MVP backlog filed (#57-#63)

- Updated: `2026-08-26 22:07 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `d5acbf7 ui/ride-detail: wire real detected-segment attempts (was a static placeholder)`
- Worktree: substantial uncommitted work remains under `apps/karoo/` (Codex, concurrent) —
  untouched by this increment.

## Outcome

Found and fixed a real gap during a live on-device walkthrough with the client on their
physical iPhone (dev-client rebuild, `react-native-svg` now linked): `RideDetailScreen`'s
"Detected segments" section was a hardcoded placeholder, never wired to real data — the
mirror-image of what #11 fixed on the segment side. Also filed 7 post-MVP issues (#57-#63)
covering client-identified UX problems plus `docs/MVP.md`'s own stated post-MVP roadmap.

## Changed

- `src/db/listAttemptsForRide.ts` (new, tested) — mirrors `listAttemptsForSegment.ts`, joined
  to `segments` instead of `rides`/`imported_files`.
- `src/screens/RideDetailScreen.tsx` — "Detected segments" is now a real, tappable list
  (previously always showed "No segments defined yet" regardless of actual attempts), using
  the same cross-stack navigation pattern `DefineSegmentScreen.tsx` already uses to reach
  `AttemptReview`.
- Commit `d5acbf7`, pushed to `origin/main`.
- Filed issues **#57** (map lacks real detail — swap MapLibre's demo tiles for a real OSM
  vector style), **#58** (segment editing is hard to use — redesign toward dragging handles
  directly on the map instead of the disconnected 1D distance scrubber), **#59** (GPX import,
  for historical pre-Karoo rides — see Hazards below for what this format can and can't
  provide), **#60**–**#63** (the four items from `docs/MVP.md`'s own "Post-MVP handoff"
  section: matcher tuning from real fixtures + retiring routine review, extracting the
  matcher as a standalone library, an optional cloud segment registry, and a Hammerhead-API
  cost/demand evaluation). All labeled `agent-backlog`, all currently unstarted.

## Verified

- 3 new tests for `listAttemptsForRide`. Full suite 177 tests, typecheck clean.
- **Live on-device, on the client's real physical iPhone** (not a simulator, not a scratch
  DB copy): rebuilt the dev-client app (needed a manual `pod install` with
  `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` first — the known CocoaPods encoding issue, see
  `docs/DEV_SETUP.md` — then `npx expo run:ios --device`, then a locked-device launch failure
  resolved by `xcrun devicectl device process launch` once unlocked). The client then walked
  the actual happy path themselves while I guided them: Rides → ride detail (found the bug
  here) → Segments → "Rerun matcher" (backfilled a pre-existing ride/segment pair that
  predated this session's matcher-trigger wiring, so was never automatically scanned) → back
  to ride detail (fix confirmed working) → tapped into the attempt → AttemptReview screen
  opened correctly with real diagnostics rendered.
- This is the first genuinely on-device (not scratch-copy) confirmation this session that the
  #11/#30 wiring works end-to-end through actual taps, not just data-pipeline scripts.

## External state

- The client's physical iPhone now has this build installed and running, connected to the
  dev Metro server on this Mac. It has at least one real ride and one real segment with a
  confirmed, manually-approved attempt (the client tapped "Confirm" during the walkthrough).
- The client tried importing a real GPX file (a 2014 Strava export) and it correctly failed
  — GPX was never a supported import format, FIT-only. Inspected the actual file: real
  lat/lng/elevation/timestamp/heart-rate per point (via Garmin's TrackPointExtension), but
  **no power field at all** (a structural GPX limitation, not a parsing gap) and no cadence/
  speed/temperature in this particular file. Captured in issue #59.
- Comparison-screen visual verification is still outstanding — the client only has one
  confirmed attempt on their test segment so far (needs a second real traversal of the same
  physical route to test "Compare two attempts" for real, since a second FIT copy of the
  identical file would just register as a duplicate, not a new attempt).

## Hazards and blockers

- The pattern that caused this bug — a screen shipped with a static placeholder that never
  got wired to real data once the underlying query existed — is worth a quick audit for any
  other similar leftover placeholders in the app before assuming everything else is wired.
- iOS Simulator MCP touch injection was never re-diagnosed (still presumed broken from
  earlier in this session); real-device testing continues to be the reliable path.
- `origin/main` should be re-checked for divergence before assuming any specific commit
  count — both agents push periodically.

## Next safe action

Client-directed priority is #57 (map detail) and #58 (segment editing UX) next, based on
direct usage friction. #59 (GPX import) is scoped and ready whenever picked up. The
comparison-screen on-device visual check (chart rendering, gap breaks, legend) is still
open — needs the client to get a second real traversal of the same segment first.
