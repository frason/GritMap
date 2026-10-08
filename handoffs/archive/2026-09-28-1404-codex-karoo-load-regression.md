# Handoff: Karoo extension load regression fixed in 0.8.4

- Updated: `2026-09-28 14:04 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `71ef851 docs: hand off attempt-persistence and reverse-descent fixes`
- Worktree: Karoo 0.8.3 HR-drift changes plus the 0.8.4 service fix are uncommitted; unrelated pre-existing iOS project-file modification remains untouched.

## Outcome

Installed GritMap Karoo 0.8.4. Telemetry matching is serialized and conflated instead of spawning concurrent work for every GPS point, and heavy GPS/sensor consumers are active only during a recorded or paused ride.

## Changed

- `LiveSegmentService.kt`: conflated worker, ride-scoped telemetry subscriptions, teardown, diagnostics.
- `app/build.gradle.kts`: 0.8.4/versionCode 15.
- Prior uncommitted HR-drift stabilization remains included.

## Verified

- Full JVM suite passed (98 tests).
- Debug APK assembled; `aapt` verified 0.8.4/code15 and SDK 31.
- Extension bound successfully without crashes/restarts.
- Device log reached `karoo_connected` and `RideState.Idle` without starting telemetry consumers.
- Settled extension CPU sampled at 0.0% three times.

## External state

- Karoo has 0.8.4 installed with location permission restored.
- Uninstall erased Room data: 0 segments/plans/attempts.
- Diablo 40:30, Relize 6:54, and Coco Jumbo recovery files are staged for the normal import button.

## Hazards and blockers

- No direct performance trace exists from uninstalled 0.8.3.
- A short recorded-ride lifecycle test is still required.
- Changes are uncommitted; preserve the unrelated iOS modification.

## Next safe action

Import the staged library once, record a short ride, then confirm one telemetry-consumer start and stop event in diagnostics.
