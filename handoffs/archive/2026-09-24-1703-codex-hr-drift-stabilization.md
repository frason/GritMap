# Handoff: HR drift stabilized and Karoo updated to 0.8.3

- Updated: `2026-09-24 17:03 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `71ef851 docs: hand off attempt-persistence and reverse-descent fixes`
- Worktree: HR-drift/version changes are uncommitted in four `apps/karoo` files; unrelated pre-existing `ios/GritMap.xcodeproj/project.pbxproj` modification was preserved.

## Outcome

The live cardiac-drift metric now waits for a physiologically useful baseline, ignores coasting/stopped samples, smooths the displayed value, and emits a much quieter graph history. GritMap Karoo 0.8.3/versionCode 14 containing these changes is installed on the connected Karoo.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/pacing/CardiacDriftTracker.kt`: 3-minute baseline, 2-minute rolling window, valid-sample thresholds, gap handling, smoothing/deadband, and 15-second graph cadence.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/CombinedDataTypes.kt`: baseline UI says `Settling · 3 min`.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/pacing/CardiacDriftTrackerTest.kt`: added baseline, coasting, and history-cadence tests.
- `apps/karoo/app/build.gradle.kts`: versionName `0.8.3`, versionCode `14`.

## Verified

- Focused tracker suite: 5 tests, 0 failures, 0 errors.
- Full JVM suite: 32 suites, 98 tests, 0 failures, 0 errors.
- `git diff --check` passed for the changed Karoo files.
- Debug APK assembled successfully with JDK 17; `aapt` reports 0.8.3/code14 and min/target SDK 31.

## External state

- Replacement install succeeded on the connected Karoo.
- Device package state reports GritMap 0.8.3/versionCode 14.
- Existing application data was retained.

## Hazards and blockers

- Short segments may remain in the 3-minute settling state by design.
- Thresholds need a real sustained power+HR ride before further tuning.
- Changes are uncommitted; the unrelated iOS project-file modification remains untouched.

## Next safe action

Test the large cardiac-drift field during an 8–10 minute sustained effort and capture it around minutes 3, 6, and 10 before changing thresholds again.
