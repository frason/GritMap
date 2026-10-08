# Handoff: Polar H10 RR capture verified on Karoo

- Updated: `2026-10-05 15:50 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d739851 docs: review of Karoo AI/physiology plan and H10 RR foundation`
- Worktree: `uncommitted mixed worktree; physiology package/tests and version bump are Codex work`

## Outcome

The first real Polar H10 standard-BLE RR capture on Karoo succeeded. GritMap connected to HRS,
received live RR intervals, reached the enhanced-metrics quality gate, and atomically finalized a
schema-v1 artifact without a crash or GATT error. A small UI defect discovered during the test—the
active partial being labelled as a prior recoverable capture—was fixed, tested, and installed as
Karoo build `0.10.37` (code 60).

## Changed

- `H10CaptureController.kt`: snapshot recoverable partial count before creating the active writer,
  so the current capture is not reported as an incomplete prior capture.
- `H10CaptureControllerTest.kt`: regression assertion for zero recoverable captures at a clean start.
- `apps/karoo/app/build.gradle.kts`: version 0.10.37 / code 60.

## Verified

- Physical capture saved 163 RR observations to
  `files/physiology/h10-diagnostic-1791240171503.rr`.
- Exact size 2,298 bytes = 16-byte header + 163 fixed 14-byte records.
- Header bytes identify `GMRR`, schema version 1.
- Artifact SHA-256:
  `33d4422cfab0e0f799bf037d9adb8b93d2aead6cd49744049bba4a1719edc989`.
- Final displayed state: HR from RR 57.6 bpm, diagnostic RMSSD 20.6 ms, diagnostic SDNN 48.7 ms,
  enhanced metrics READY. Contact support was not reported by this packet stream.
- No `.rr.partial` remained after save; no fatal app or nonzero Bluetooth GATT status was logged.
- Focused command passed after the UI correction:
  `./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*' :app:lintDebug :app:assembleDebug`.
- `git diff --check` passed.
- Installed APK SHA-256:
  `644be0de555a571db96ee6151086656ddc0d179d6898c14d2373ff1d79d685f7`.

## External state

- Connected Karoo `00442GA241760203` now runs GritMap `0.10.37` (code 60).
- The finalized 163-record test artifact remains in app-private storage on the Karoo.
- No export or deletion action was taken.

## Hazards and blockers

- This verifies the private Activity-owned feasibility path only, not ride-service capture.
- Capture duration was short; reconnect, process-kill recovery, 60-minute bounded behavior, H10 plus
  active Karoo ride recording, and BPM comparison against Karoo's own stream remain unverified.
- Metrics are diagnostic calculations, not coaching or medical conclusions.
- Raw sensor 1/1024-second units are still rounded to milliseconds in artifact schema v1.

## Next safe action

Do a controlled recorded ride with the H10 simultaneously paired to Karoo's normal HR channel and
GritMap diagnostics, then compare Karoo BPM with H10 BPM and verify power/GPS/cadence remain stable.
Only after that should capture ownership move into the ride foreground service.
