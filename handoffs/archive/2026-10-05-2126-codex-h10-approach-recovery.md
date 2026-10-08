# Handoff: bounded H10 approach recovery installed

- Updated: `2026-10-05 21:26 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a47e928 feat: coach-plan import, versioned rider profile, saved Karoo address`
- Worktree: mixed uncommitted Karoo/phone work; this milestone is uncommitted

## Outcome

GritMap Karoo `0.10.40` (code 63) now owns a bounded recovery sequence when approach-time H10
preparation encounters an empty scan, GATT error, or unexpected disconnect. It retries after 2, 5,
and 10 seconds, then stops reconnecting and continues with Karoo HR. Manual disconnect, approach
timeout, and normal release cancel pending retries and reset the budget for the next approach.

Diagnostics now record approach request, every BLE state transition, missing preferred-device
setup, retry scheduling/start, fallback, capture start, and release. Automatic approach never scans
or selects a new device: that could capture and remember another rider's strap.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/H10ApproachRecoveryPolicy.kt`
- `apps/karoo/app/src/test/java/com/gritmap/karoo/physiology/H10ApproachRecoveryPolicyTest.kt`
- `apps/karoo/app/src/main/java/com/gritmap/karoo/service/LiveSegmentService.kt`
- `apps/karoo/app/build.gradle.kts`: version 0.10.40 / code 63

The directed matcher, 250 m coarse approach lookup, 30 m activation rule, and RR artifact format
were not changed.

## Verified

- Java 17 Gradle command:
  `./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*' --tests 'com.gritmap.karoo.service.*' :app:lintDebug :app:assembleDebug`
- Result: build successful; 45 tests, zero failures/errors; lint passed.
- `git diff --check` passed.
- Safety-corrected APK SHA-256:
  `03c30c0053f1f46ba2b0d031600633ef096580b1f545af4b4aa08c4bbbfdb87f`

## External state

- Installed successfully on Karoo `00442GA241760203` over USB.
- Installed package reports version 0.10.40 / code 63.

## Hazards and blockers

- The automatic moving approach and recovery paths still require the planned outdoor test.
- A preferred H10 must first be confirmed through diagnostics. With none saved, automatic approach
  logs `h10_auto_setup_required` and keeps Karoo HR; it never scans during a ride.
- A remembered Bluetooth address remains app-private but is not encrypted.
- Existing mixed worktree changes were preserved and not committed.

## Next safe action

Ride toward a saved segment without opening H10 diagnostics. Afterward inspect logs for
`segment_approaching`, `h10_approach_requested`, `h10_auto_state`, and
`h10_auto_capture_started`; if connection fails, inspect the bounded retry/fallback events.
