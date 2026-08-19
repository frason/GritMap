# Handoff: Karoo Segment Performance shows planned finish

- Updated: `2026-08-18 22:07 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `62d1c68 apps/karoo: show planned segment finish`
- Worktree: `clean before this handoff update`

## Outcome

Segment Performance now displays the baseline pacing plan's target finish alongside its live
predicted finish. Completion alerts also include the plan time when present. Missing plan targets
are shown honestly as `Plan --` rather than inferred from live performance.

## Changed

- `62d1c68 apps/karoo: show planned segment finish`
- Live candidate discovery reads the segment's baseline `targetFinishTimeSeconds` from Room and
  carries it into framework-neutral `LiveUiState`.
- The on-device plan generator receives the imported target when no explicit engine-level target
  overrides it.
- Segment Performance displays separate `Plan` and `Predicted` values; preview data shows
  `Plan 2:40` and `Predicted 2:48`.
- Completion summary includes `Plan m:ss` when available.
- APK versionName is `0.6.1`, versionCode `9`.

## Verified

- Ran full `:app:testDebugUnitTest :app:assembleDebug`: `BUILD SUCCESSFUL in 1m 29s`.
- The Karoo was not connected, so installation did not run.

## External state

- Verified 0.6.1 APK is at `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- 0.5.0 remains the last confirmed device installation.

## Hazards and blockers

- A plain GPX/segment import does not contain a target finish. It will display `Plan --` until a
  baseline transfer package or plan generation supplies `targetFinishTimeSeconds`.

## Next safe action

Reconnect the Karoo, install 0.6.1 in place, and verify a segment with an imported target time.
