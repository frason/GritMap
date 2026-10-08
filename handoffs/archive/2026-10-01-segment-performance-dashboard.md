# Handoff: segment performance dashboard

- Updated: `2026-10-01 16:48 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer`
- Worktree: dirty shared tree; this milestone adds to existing uncommitted Karoo visual work.

## Outcome

The LARGE GM Segment Performance field is rebuilt and installed as GritMap Karoo `0.10.21`/code 44. It combines a dominant projected finish, a fixed zero-centered time-bank bar, a large endpoint marker containing the cumulative seconds ahead/behind, a restrained directional gradient inside the active bar, real completed quarter-mile split bars, completion, and plan adherence.

Quarter-mile split deltas are now tracked in bounded in-memory attempt state. A completed interval stores `planned split seconds - actual split seconds`; positive means time gained and renders green, negative means time lost and renders red. No 1 Hz Room writes or raw telemetry persistence were added.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/state/LiveUiState.kt`: completed quarter-mile split deltas.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/service/ActiveAttemptSession.kt`: bounded 402.336 m split crossing/accounting.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/service/LiveSegmentService.kt`: publishes completed split history.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/KarooPreviewState.kt`: animated representative split history.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/SegmentPerformanceBitmapRenderer.kt`: full large dashboard, gradient time bank, and split chart.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/CombinedDataTypes.kt`: routes LARGE to the new Canvas dashboard.
- `apps/karoo/app/src/main/res/layout/karoo_segment_performance_dashboard_field.xml`: full-field bitmap host.
- Relevant service and renderer tests cover split sign semantics and large visual signals.
- `apps/karoo/app/build.gradle.kts`: version `0.10.21`, code 44.

## Verified

- Actual-size `480x624` preview inspected at `apps/karoo/app/build/reports/segment-performance-preview/large.png`.
- `JAVA_HOME=... ./gradlew testDebugUnitTest assembleDebug`: passed; 87 actionable tasks.
- ADB replacement install: `Success`; package reports `versionCode=44`, `versionName=0.10.21`.

## External state

- Device `00442GA241760203` has `0.10.21`/44 installed.

## Hazards and blockers

- Planned split time currently uses distance-proportional allocation from the goal finish because phone pacing plans do not yet provide time anchors at quarter-mile boundaries. It is honest and deterministic, but a future distance-to-time plan should replace this fallback.
- Split crossing time is sampled at the first 1 Hz update beyond the boundary, so individual deltas have roughly one-second resolution.
- Only LARGE uses the new dashboard; existing compact Segment Performance layouts remain.

## Next safe action

Open the LARGE GM Segment Performance preview on the Karoo and review typography, chart density, and the enlarged time-bank marker.
