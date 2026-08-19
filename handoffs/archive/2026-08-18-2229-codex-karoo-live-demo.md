# Handoff: Karoo live data-field demo built

- Updated: `2026-08-18 22:29 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `74150e4 apps/karoo: add live data field demo`
- Worktree: `clean before this handoff update`

## Outcome

The Karoo launcher now has a non-persistent live demo that exercises every GritMap data field
with changing plan, sensor, and progress data. It completes and loops in 34 seconds and never
writes dummy plans, attempts, or telemetry to Room.

## Changed

- `74150e4 apps/karoo: add live data field demo`
- Added Start/Stop data-field demo controls to the launcher.
- The demo publishes a 600 m elevation profile; Recover/Hold/Push zones; changing target and
  three-second power; rising HR; watts/HR; plan and predicted times; adherence; and completion.
- A real detected segment stops the demo without clearing the real attempt state.
- Added pure-state tests for zone progression, complete metrics, completion, and looping.
- APK versionName is `0.7.0`, versionCode `10`.

## Verified

- Ran full `:app:testDebugUnitTest :app:assembleDebug`: `BUILD SUCCESSFUL in 2m 55s`.
- The Karoo was not connected, so installation did not run.

## External state

- Verified 0.7.0 APK is at `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- 0.5.0 remains the last confirmed installed device version.

## Hazards and blockers

- Demo state is process-local. Android process death stops it, which is intentional.
- The demo does not dispatch entry/completion alerts; it is scoped to exercising persistent data
  fields. Real traversal alert behavior remains separate.

## Next safe action

Reconnect the Karoo, install 0.7.0 in place, tap Start data-field demo, and inspect the configured
GM fields on a ride page through one complete 34-second cycle.
