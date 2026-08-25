# Handoff: Matcher wired into import/segment-creation triggers (closes #30)

- Updated: `2026-08-25 07:36 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `f945754 matcher: wire confidence scoring + persistence into import/segment triggers (closes #30)`
- Worktree: substantial uncommitted work remains in `apps/karoo/` (Codex's concurrent
  W′/cardiac-drift/UI work) — untouched by this increment.

## Outcome

Attempts now get scored and persisted automatically. Importing (or replacing) a FIT ride
scans it against every existing segment; saving a new segment scans it against every existing
ride. Both write through the already-tested `persistMatchCandidate` contract into
`segment_attempts`/`match_diagnostics`. This was the last piece connecting the matcher
(closed in #29) to real user actions — before this, the matcher was fully built and tested but
never actually ran except from test files.

## Changed

- `src/db/getMatcherRidePoints.ts` (new) + test — reads every `ride_points` row for a ride in
  `point_index` order, **including** rows with no GPS fix. This is deliberately different from
  `getRideTrack.ts` (which filters at the SQL level for map rendering): `toMatcherRidePoints`
  needs array position to equal the true `point_index` to preserve point identity across GPS
  gaps, so the input array can't have any rows filtered out before it gets there.
- `src/matcher/runMatcher.ts` (new) + test — `runMatcherForRide` / `runMatcherForSegment`,
  thin orchestration composed entirely from already-tested pieces: `getMatcherRidePoints` →
  `toMatcherRidePoints` → `matchSegment` → `persistMatchCandidate`, looping over the other
  side's full list (`listSegments`/`listRides` + per-row detail fetch). Returns a
  `MatchRunSummary` (counts by persist outcome) for callers/tests to assert against.
- `src/screens/ImportScreen.tsx` — calls `runMatcherForRide` right after a successful
  `"imported"` or `"replaced"` result.
- `src/screens/DefineSegmentScreen.tsx` — calls `runMatcherForSegment` right after
  `insertSegment` succeeds, before navigating away. No special-case for the segment's own
  source ride — it gets scanned like any other ride, matching how the matcher itself makes no
  such distinction.
- Commit: `f945754`, on local `main`, **not yet pushed** (see Karoo transfer handoff for the
  same standing note — `origin/main` is now 12 commits behind).

## Verified

- 10 new `node:test` cases across the two new test files: both trigger directions, scanning
  every row (not just the first), idempotency on a second run (`duplicate`, no double-insert),
  and safe no-ops for an unknown ride/segment id.
- Full suite: 168 tests pass. `npm run typecheck` clean. `npm run web:smoke` succeeds.
- **Ran the real orchestration functions against a copy of the phone app's actual live SQLite
  database** (not synthetic fixtures) — the real "Morning Climb" segment and its real 8.5k-point
  source ride. Confirms the wiring reads real rows and invokes the real matcher correctly. The
  two candidates it found were genuine rejects (`backward-progress` / `reverse-traversal`, from
  actual GPS geometry near this route's start — the rider's real track briefly moves backward
  in progress-distance terms, likely a loop or hairpin near the start) and were correctly *not*
  persisted, exactly matching `persistMatchCandidate`'s existing, separately-tested contract for
  rejects. This is `matchSegment`'s own pre-existing decision logic, unrelated to this change —
  not a bug introduced here. The accept/persist path itself is covered by the synthetic-fixture
  tests, which use a guaranteed-overlap straight-line ride/segment pair.
- **Not verified**: the actual on-screen trigger call in `ImportScreen.tsx` /
  `DefineSegmentScreen.tsx` firing from a real UI interaction (tap Import, tap Save Segment).
  Both screens have no automated coverage (project convention — screens are thin, logic lives
  in tested modules; see `docs/` test-strategy notes from the segment-definition increment).
  The added call sites are one line each, directly after the existing, already-manually-verified
  success paths (`importFitFile` returning "imported"/"replaced"; `insertSegment` succeeding).

## External state

- No device/simulator state changed by this increment — the "real data" verification ran
  against a **copy** of the simulator's SQLite file in scratch space, never the live file.
- The live phone app database still has zero `segment_attempts` rows (the copy-based test run
  didn't touch it). The next real FIT import or segment save on-device will be the actual first
  live exercise of this wiring.

## Hazards and blockers

- Real-world matcher accuracy against messy GPS (the backward-progress/reverse-traversal
  rejects found above) is worth a closer look at some point, but is `matchSegment.ts`'s own
  tuning question (`MAX_BACKWARD_METERS = 30`), not something this issue's scope covers.
- The iOS Simulator MCP control tool's touch injection was still broken as of the prior
  handoff; not re-tested in this increment. Real-device builds (`npx expo run:ios --device`)
  remain the working fallback if UI-level manual verification is wanted.
- `handoffs/LATEST.md` will need a fresh `git status` check before anyone edits it further —
  Codex is working concurrently and may update it independently.

## Next safe action

Either #13 (attempt comparison chart UI — the natural next step now that `segment_attempts`
rows actually get created) or #11 (diagnostic review screen + matcher-version reevaluation).
A real on-device FIT import or segment save, followed by inspecting the live
`segment_attempts` table, would be a good first move regardless — the copy-based verification
above didn't touch the live app.
