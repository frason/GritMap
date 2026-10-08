# Handoff: isolated H10 packet/RR foundation implemented

- Updated: `2026-10-05 14:31 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: heavily dirty from existing mixed work; this milestone adds only new physiology
  source/tests and updates the plan/handoffs

## Outcome

The isolated physiology module can now decode standard Bluetooth Heart Rate Measurement packets,
including 8/16-bit BPM, sensor-contact state, optional energy fields, and all RR intervals encoded
in 1/1024-second units. It feeds the already-added conservative validation, bounded quality window,
and crash-recoverable raw artifact format. No Android Bluetooth connection is active yet.

## Changed

- Added `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/BleHeartRateMeasurementParser.kt`.
- Added its focused test file with normal and malformed packet cases.
- The other new physiology files are `RrModels.kt`, `RrLiveBuffer.kt`, and `RrArtifactStore.kt`,
  with matching tests.
- Updated `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` and `handoffs/LATEST.md`.

## Verified

- Focused physiology suite: 9/9 passed with
  `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*'`.
- Earlier full suite compiled this module and ran 138 tests; only unrelated
  `KarooPreviewStateTest.kt:26` failed, including when rerun alone.
- `git diff --check` passed before the parser addition; the final handoff pass should rerun it.

## External state

- No APK was installed and no H10/Karoo pairing changed.

## Hazards and blockers

- Android GATT scanning/connection and API 31 Bluetooth permissions are not implemented.
- The caller must assign each decoded RR interval an elapsed ride timestamp; the BLE packet can
  contain multiple RR intervals and does not provide the ride timeline itself.
- No current ride service or UI code was modified.

## Next safe action

After Claude reviews connection ownership, add an Android API 31 GATT client behind a small
interface and test its lifecycle without yet making it authoritative in `LiveSegmentService`.
