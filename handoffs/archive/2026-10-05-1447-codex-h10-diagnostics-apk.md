# Handoff: desk-testable H10 RR diagnostics APK ready

- Updated: `2026-10-05 14:47 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: heavily dirty from existing mixed work; this milestone adds the physiology package,
  tests, manifest permissions/activity, and a small Settings entry point

## Outcome

A self-contained H10 diagnostic flow is built and ready for physical desk testing. It scans for
standard BLE heart-rate sensors, connects through GATT, subscribes to Heart Rate Measurement,
shows live BPM/RR/contact/quality state, captures every RR observation, and finalizes a local
hash-verifiable artifact. It does not feed live pacing or the active ride service.

## Changed

- Added the `com.gritmap.karoo.physiology` production and test packages.
- Added Android 12 `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` permissions plus legacy max-SDK
  permissions in `AndroidManifest.xml`.
- Declared non-exported `H10DiagnosticActivity`.
- Added `Open H10 Diagnostics` to the existing Settings screen and its MainActivity callback.
- Updated `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` and `handoffs/LATEST.md`.

## Verified

- 12/12 focused physiology JVM tests pass:
  `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*'`.
- `:app:assembleDebug` succeeds in the same environment.
- Debug APK: `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- `git diff --check` passes for the changed milestone paths.
- The earlier full Karoo suite compiled this work but retains one unrelated existing failure at
  `KarooPreviewStateTest.kt:26`, which also fails alone.

## External state

- `adb devices -l` reported no connected device, so nothing was installed.
- No H10 pairing or Karoo sensor configuration changed.

## Hazards and blockers

- Physical Android 12 permission, scan filtering, simultaneous ANT+/BLE use, GATT subscription,
  contact flags and actual H10 packet behavior are unverified.
- Stopping capture finalizes the artifact. Leaving the Activity during capture intentionally
  leaves a recoverable `.rr.partial`; recovery UI is not implemented yet.
- Artifacts remain in app-private storage and do not yet have export/share UX.
- The diagnostic Activity is deliberately non-exported and must be opened through Settings.
- No algorithm consumes RR yet; DFA alpha 1 and HR Drift integration remain later phases.

## Next safe action

Connect the Karoo by USB, install the debug APK, open Settings > H10 Diagnostics, grant Bluetooth,
wear/moisten the H10, scan/connect, capture 5-10 minutes, stop/save, and pull the `.rr` artifact
for validation before wiring anything into the ride service.
