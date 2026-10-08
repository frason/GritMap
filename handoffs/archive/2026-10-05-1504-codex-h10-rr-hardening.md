# Handoff: H10 RR diagnostics hardened and versioned for physical testing

- Updated: `2026-10-05 15:04 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d739851 docs: review of Karoo AI/physiology plan and H10 RR foundation`
- Worktree: `uncommitted mixed worktree; physiology package/tests and version bump are Codex work;
  shared manifest/home/activity files already contain concurrent work and were not reverted`

## Outcome

Karoo debug build `0.10.36` (code 59) is ready for the first physical Polar H10 desk test. The
private diagnostic flow scans/connects through standard Bluetooth HRS, parses multiple RR values,
shows recent-window quality plus diagnostic HR/RMSSD/SDNN, reports incomplete recoverable captures,
and writes a durable app-private RR artifact. Claude's four pre-ride blockers B1-B4 are addressed:
recoverable partials are never overwritten, checkpoints are flushed and fsynced, the beat timeline
uses cumulative sensor intervals rather than notification arrival jitter, and validity is computed
over the bounded recent window rather than lifetime capture.

## Changed

- `apps/karoo/app/build.gradle.kts`: version 0.10.36 / code 59.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/`: parser, bounded buffer,
  diagnostic metrics, exclusive/durable artifact storage and catalog, jitter-resistant timestamp
  mapping, BLE client, capture controller and diagnostic Activity.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/physiology/`: 18 focused tests, including
  recent-window recovery, non-overwrite and delayed-notification regression cases.
- `docs/PLAN_KAROO_AI_PHYSIOLOGY.md`: factual implementation checkpoint and remaining gaps.
- BLE reliability pass uses atomic `StateFlow.update`, ignores stale GATT callbacks, bounds scan to
  12 seconds, and counts/skips malformed packets without falsely failing a healthy connection.

## Verified

- From `apps/karoo/` with JDK 17:
  `./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*' :app:lintDebug :app:assembleDebug`
  -> **BUILD SUCCESSFUL**, all 18 focused tests passed, lint passed, APK assembled.
- `git diff --check` passed.
- APK: `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`
- APK SHA-256: `32d2cce0e58d8687335f5c350c1b3dc6ac1ca96ab09c8502e35e06b8b209735e`.
- Physical H10, process-kill recovery, long capture and coexistence with Karoo HR recording did not
  run because no ADB device was connected.

## External state

- `/Users/frason/Library/Android/sdk/platform-tools/adb devices` returned no devices.
- Nothing was installed on the Karoo.
- Finished and partial RR artifacts remain in app-private `files/physiology`; no external export
  or deletion UI exists yet.

## Hazards and blockers

- Capture ownership still belongs to the private diagnostic Activity, not the ride foreground
  service. It must not be treated as production ride capture.
- Reconnect/backoff and saved-address reconnect are not implemented; first test is intentionally a
  single explicit scan/connect session.
- RR remains rounded to milliseconds in artifact schema v1. Raw 1/1024-second units, ride/pause
  timeline alignment, persisted integrity sidecar, export/deletion/privacy controls and FIT HRV
  post-processing remain future work.
- Do not wire HR Drift or live adaptation to these diagnostic metrics until the physical quality
  gate and cross-check against Karoo BPM have been measured.
- The unrelated existing full-suite failure in `KarooPreviewStateTest.kt:26` was not modified.

## Next safe action

Connect the Karoo over ADB, install this exact APK, open GritMap > Settings > H10 Diagnostics,
connect the Polar H10, capture 3-5 minutes while Karoo also displays ordinary HR, stop/save, then
pull the artifact and logs before any foreground-service or HR Drift integration.
