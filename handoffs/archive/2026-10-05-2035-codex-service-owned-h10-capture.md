# Handoff: service-owned H10 capture sustained during a Karoo ride

- Updated: `2026-10-05 20:35 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d739851 docs: review of Karoo AI/physiology plan and H10 RR foundation`
- Worktree: `uncommitted mixed worktree; Karoo physiology/service/manifest/version changes are Codex work`

## Outcome

GritMap `0.10.38` (code 61) moves H10 BLE and RR artifact ownership from the diagnostics Activity
into the existing ride foreground service. The diagnostics Activity now sends explicit commands
and renders process-local `StateFlow` state; leaving it no longer closes GATT or the writer. On the
physical Karoo, BLE RR capture remained connected and continued growing on the native ride screen
while Karoo simultaneously received ANT+ HR.

## Changed

- Added `physiology/H10ServiceBridge.kt`: service command intent contract and framework-neutral
  process-local state bridge; Room is not used as a live communication channel.
- Updated `H10DiagnosticActivity.kt`: view/controller only; it no longer constructs or closes BLE
  and capture owners.
- Updated `LiveSegmentService.kt`: constructs BLE/capture once, publishes state, handles scan/
  connect/capture commands, finalizes at ride end/service shutdown/manual stop, and disconnects at
  ride end.
- Updated `AndroidManifest.xml`: foreground service declares `location|connectedDevice` and the
  connected-device foreground permission.
- Updated `apps/karoo/app/build.gradle.kts`: version 0.10.38 / code 61.

## Verified

- `./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*' --tests
  'com.gritmap.karoo.service.*' :app:lintDebug :app:assembleDebug` passed.
- `git diff --check` passed.
- APK SHA-256:
  `7276a4d6f60104e4b3623e2c3ff40228a994d857df812834aa5c1b8ce7374fd4`.
- Installed package reports `versionName=0.10.38`, `versionCode=61`.
- Physical service is foreground (`LiveSegmentService`, notification 701).
- H10 `FC:6B:7A:4D:6A:A6` retained one BLE GATT connection after returning to the ride screen.
- Active artifact grew from 926 to 1,822 bytes in 20 seconds (64 additional fixed records), proving
  ongoing RR notifications rather than a merely connected socket.
- ANT+ HR packets continued throughout the same interval. No fatal app, GATT status, or artifact
  save error appeared.

## External state

- Karoo `00442GA241760203` runs 0.10.38 and currently has an active recorded ride plus active H10
  capture `h10-diagnostic-1791257561267.rr.partial`.
- Do not reinstall or kill GritMap until the ride ends if the current lifecycle finalization test
  is to remain valid.
- An older two-record partial from the failed Activity-owned test remains intentionally recoverable.

## Hazards and blockers

- Ride-end automatic finalization/disconnect is implemented but has not yet been physically
  observed; the current ride must end normally first.
- First pairing still requires opening diagnostics and manually scanning/connecting/starting.
  Saved-address reconnect and bounded reconnect/backoff remain pending.
- RR data is still a separate app-private artifact and is not yet aligned/exported with the FIT.
- `H10ServiceState` is process-local; after process death the partial is recoverable, but the UI
  correctly loses live state until reconnect.

## Next safe action

End the current Karoo ride normally, then verify the active `.rr.partial` atomically becomes `.rr`,
the BLE GATT connection closes, and the ANT/FIT ride completes normally.
