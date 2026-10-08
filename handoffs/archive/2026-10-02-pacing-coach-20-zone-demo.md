# Handoff: Pacing Coach 20-zone demo installed

- Updated: `2026-10-02 11:52 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: interleaved uncommitted Karoo and phone changes; do not bulk-commit or revert.

## Outcome

Both the running physical-device demo and Karoo page-editor preview now use the same contiguous
20-zone plan with varied REST/HOLD/PUSH targets. This exercises the zone counter, adjacent-zone
stack, frozen completed averages, live current actual, future target-only behavior, and variable
plan boundaries without changing imported production plans.

## Changed

- Added shared `demoPacingZones(totalDistanceMeters)` in `LiveDemoController.kt`.
- Updated `KarooPreviewState.kt` and the running demo to use it.
- Updated fixture-dependent tests and added assertions for 20 contiguous, full-span zones.
- Bumped Android app to `0.10.32`, code `55`.

## Verified

- Focused renderer, running-demo, and combined-data-type tests plus `:app:assembleDebug` passed
  (21 focused tests, 72 Gradle tasks).
- Inspected exported preview showing `REST · 9/20 ZONES` with five correctly staged rows.

## External state

- Installed successfully on Karoo `00442GA241760203`; app data preserved.

## Hazards and blockers

- The 20-zone plan is preview/demo-only. Imported segment plans are unchanged.

## Next safe action

Run the demo on the Karoo and review transitions through several zone boundaries.
