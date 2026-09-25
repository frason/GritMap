# Handoff: Two real-ride bugs fixed (pacingPlanId persistence, reverse-descent attempts)

- Updated: `2026-09-24 17:05 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: PR #66 merged (`karoo: fix pacingPlanId=NULL persistence and false reverse-descent attempts`)
- Worktree: Codex has further uncommitted work in progress right now on
  `CardiacDriftTracker.kt`/`CombinedDataTypes.kt`/`build.gradle.kts` -- untouched by this change,
  left in place.

## Outcome

Both defects flagged in `handoffs/archive/2026-09-24-1633-codex-diablo-real-ride.md` are fixed,
tested, merged to `main` (also merged PRs #64 GPX import and #65 segment-editing tap-to-place,
both stale/unreviewed for 12 days -- user approved merging all three this session).

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/matching/ForwardProgressGate.kt` (new) --
  requires 2 consecutive samples of strictly increasing progress before a segment candidate is
  direction-confirmed. Closes the reverse-descent bug: descending back through a segment's
  start corridor satisfies `DirectedLiveMatcher.canStart()`'s pure proximity check, and GPS
  noise/projection wobble during reverse travel doesn't always trip the existing 30m
  backtracking-abandon threshold fast enough -- real evidence was an 18-second bogus attempt.
  Wired into `LiveSegmentCoordinator` via the existing `directionValid` field on
  `CandidateScore` -- no new state machine.
- `LiveSegmentCoordinator.kt` -- `Candidate` now carries `pacingPlanId` (the discovered
  baseline plan's id), threaded into `ActiveAttemptSession` at `newSession()`.
- `ActiveAttemptSession.kt` -- new `pacingPlanId: String?` constructor param.
- `RoomAttemptEventSink.kt` -- both `insertAttempt` and `saveCheckpoint` now write
  `session.pacingPlanId` instead of a hardcoded `null`.
- Test additions: `ForwardProgressGateTest.kt` (6 cases, including a direct repro of the
  real reverse-descent GPS wobble) and one new case in `ActiveAttemptSessionTest.kt`.

## Verified

- `./gradlew :app:testDebugUnitTest` -- 102/102 passing (95 existing + 7 new).
- Not yet verified on a real ride -- the next ride is the natural verification point for both
  fixes; nothing about them changes pacing targets or matcher tolerances, only when an attempt
  is allowed to start and what id gets persisted with it.

## External state

- PRs #64, #65, #66 all merged to `main` and pushed. No Android build/install performed this
  session -- the Karoo still has whatever build was installed for the 2026-09-13 ride.
- Local stale/duplicate `fixtures/gpx/`, `src/gpx/`, and `ios/Podfile.lock` churn (leftover from
  an earlier abandoned attempt, unrelated to this fix) was found and discarded while syncing
  `main` after the merges -- confirmed byte-identical to what the merge itself brought in before
  discarding, so nothing was lost.

## Hazards and blockers

- Same as before: neither fix has real-ride confirmation yet. If the next ride still shows
  `pacingPlanId = NULL` or another reverse-direction false-start, both need a second look.
- Codex has further, currently-uncommitted cardiac-drift-related work in the main checkout as
  of this handoff -- do not assume `main`'s working tree is clean without checking `git status`
  first.

## Next safe action

User is moving to feature planning next (new capabilities, not bug fixes) -- see whatever plan
gets written this session for the actual direction. No specific "next safe action" from this
increment beyond the real-ride verification already noted.
