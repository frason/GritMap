# Handoff: Karoo data-field previews built and ready to install

- Updated: `2026-08-18 08:15 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `8395834 apps/karoo: preview pacing data fields`
- Worktree: not clean; unrelated root Expo/iOS/import work remains uncommitted

## Outcome

Both GritMap Karoo fields now provide representative fake data while a rider edits a data page.
Target Power shows 260 W. Pacing Profile shows a 533 m sample climb with elevation, current
progress, blue recover, green hold, red push regions, and a concise recommendation. Preview state
cannot leak into normal ride rendering.

## Changed

- `8395834 apps/karoo: preview pacing data fields`
- Added `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/KarooPreviewState.kt` as the shared,
  framework-neutral preview fixture.
- Updated `TargetPowerDataType` to switch its stream to sample watts only while a preview view is
  attached.
- Updated `PacingProfileDataType` to render the sample state once in preview mode and avoid
  starting the live foreground service from the editor.
- Added focused preview-contract tests.
- Bumped the Karoo APK from 0.2.0/versionCode 2 to 0.2.1/versionCode 3.

## Verified

- `:app:testDebugUnitTest --tests com.gritmap.karoo.karoo.KarooPreviewStateTest --tests com.gritmap.karoo.karoo.TargetPowerDataTypeTest`: passed.
- `:app:assembleDebug`: passed; APK is at
  `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- A full `testDebugUnitTest assembleDebug` run compiled and assembled successfully but reported
  one unrelated failure in the existing timing-sensitive
  `NeedleAgentManagerTest.timeoutReturnsFallbackWithoutConcurrentInference` test. 36 tests ran,
  one failed.

## External state

- The physical Karoo was not connected when installation was attempted. Version 0.2.1 is not yet
  installed.
- The device's previous 0.2.0 install, Coco Jumbo segment, permissions, and private pre-update
  database backup should remain unchanged.

## Hazards and blockers

- Do not uninstall the app, clear its data, or run connected instrumentation; those operations
  can erase the imported segment.
- Uncommitted root app changes belong to the parallel Claude track and must be preserved.
- The SDK XML version warning remains non-fatal and did not prevent assembly.

## Next safe action

Reconnect the Karoo, run only `adb install -r` with the 0.2.1 debug APK, then open the Karoo page
editor and confirm both GritMap fields display sample data before being added.
