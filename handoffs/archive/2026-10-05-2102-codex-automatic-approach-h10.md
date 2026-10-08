# Handoff: automatic approach-time H10 preparation installed

- Updated: `2026-10-05 21:02 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d739851 docs: review of Karoo AI/physiology plan and H10 RR foundation`
- Worktree: `uncommitted mixed worktree; Karoo automatic-H10/matcher/version changes are Codex work`

## Outcome

GritMap `0.10.39` (code 62) automatically prepares H10 Enhanced during segment approach without
requiring a normal-use toggle. A separate 250 m coarse start-point query triggers Bluetooth warm-up;
the authoritative 30 m directed matcher and all acceptance thresholds are unchanged. A previously
paired H10 reconnects directly; otherwise a bounded HRS scan auto-selects only one unambiguous Polar
H10/sensor. Missing permission, missing hardware or ambiguity silently retain standard Karoo ANT+
HR and never delay matching.

## Changed

- `LiveSegmentCoordinator.kt`: throttled 250 m approach discovery callback, separate from 30 m
  candidate creation.
- `H10PreferredDeviceStore.kt`: app-private/no-backup preferred address required for direct GATT
  reconnect when the H10 is not advertising.
- `H10BleClient.kt`: direct known-address connection and successful-device callback.
- `H10AutoConnectPolicy.kt`: deterministic selection; refuses multiple plausible sensors.
- `LiveSegmentService.kt`: approach-triggered reconnect/scan, automatic capture warm-up, segment-
  entry fallback, three-minute abandoned-approach timeout and two-minute post-segment grace.
- Focused tests cover preferred-address validation/persistence and non-guessing device selection.
- `apps/karoo/app/build.gradle.kts`: version 0.10.39 / code 62.

## Verified

- `./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*' --tests
  'com.gritmap.karoo.service.*' :app:lintDebug :app:assembleDebug` passed (42 focused tests).
- `git diff --check` passed.
- Installed package reports 0.10.39 / code 62.
- APK SHA-256:
  `9e8a57f9263dc88695a2f8e1f4e8033a201cc8aa75709185836111e51aefd152`.
- Prior version physically verified simultaneous BLE RR + ANT+ HR and ride-end finalization.
- Automatic 250 m approach trigger itself has not yet been exercised on a moving ride.

## External state

- Karoo `00442GA241760203` runs 0.10.39.
- Installing the APK stopped the prior process; there was no active ride/capture at install time.
- A successful 0.10.39 manual or automatic H10 connection will save the preferred address locally.

## Hazards and blockers

- Android Bluetooth permission still requires one explicit system grant; background code cannot
  silently grant it. This Karoo already has permission.
- If multiple plausible H10/HR sensors appear and none is remembered, automatic selection does
  nothing by design; diagnostics can establish the preferred device once.
- Approach lookup is a 250 m bounding box, intentionally coarse. Matching remains 30 m/exact.
- Automatic reconnect uses 10-second approach polling plus the client's bounded 12-second scan;
  richer exponential backoff and connection-status UI remain pending.
- Saved Bluetooth address is app-private and excluded from backup, but not Keystore-encrypted.

## Next safe action

On the next ride toward a saved segment, do not open diagnostics. Verify logs show
`segment_approaching` -> `h10_auto_reconnect` or `h10_auto_scan` ->
`h10_auto_capture_started` before `attempt_started`, then confirm normal ride-end finalization.
