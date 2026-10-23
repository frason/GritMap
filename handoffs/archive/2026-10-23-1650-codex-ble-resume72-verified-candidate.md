# Handoff: BLE recovery fix verified; code72 installation approval pending

- Updated: `2026-10-23 16:50 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `0312e10 fix(karoo): recover interrupted BLE chunk transfers`
- Worktree: documentation-only handoff follow-up; source committed, isolated phone checkout untouched

## Outcome

The physical disconnect/resume gate failed on code71. A corrected signed code72 candidate is prepared and passes automated QA, but is not installed or physically validated. No tag/publication approval or action.

## Changed

- Commit0312e10: DirectBleGattClient observes radio shutdown immediately, waits boundedly for adapter availability, and classifies recoverable transport/stale-handle errors separately from ATT permission/payload refusals. GATT operation timeout8s leaves room within the phone30s inactivity window.
- DirectBleRecovery bounds recovery to three attempts/20s per outage, including connection setup. DirectBleTransferReceiver uses the existing exact-length/hash reader, retains completed bytes, requests the unfinished chunk offset, and compares the complete manifest after reconnect. Parent cancellation escapes receipt retry.
- Seven DirectBleRecoveryTest regressions cover retained offsets/bytes, setup retries, exhaustion, changed transfer rejection, refusal/cancellation, deadline and status classification.
- Gradle default code72; release and physical-test docs updated. No wire-format/phone source/UI-label changes.

## Verified

- Final QA from committed0312e10 in apps/karoo: JDK17/Android SDK, `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleBeta -PgritmapBetaSigningProperties=<existing private signing properties> -PgritmapVersionCode=72 -PgritmapVersionName=0.10.45-bluetooth-resume1 --no-daemon`.
- BUILD SUCCESSFUL in4m19s;257 tests,0 failures/errors/skips; debug lint and beta vital lint pass. Log `/tmp/gritmap-ble-resume72-final-qa.log`.
- Initial exploratory QA finished tests/build but failed lint with a line-mapping/indentation report while files were being edited. Final committed-source run above passes; no lint baseline/suppression added.
- APK apksigner verification passed; persistent certificate matches installed71/public0.10.44: `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`.
- aapt verified com.gritmap.karoo /72/0.10.45-bluetooth-resume1. Generated beta BuildConfig: BLE true; concurrent/replanner/ceilings false.
- APK `3898629` bytes, SHA256 `2e15a9543047d65b05c46bec54473e1c5acce81a30815d28e407f7f5d5cbc8f2`.
- Physical code71 baseline transfer: segment60833/plan4313/rider114 bytes, MTU517, imported existing=false in32963ms at16:16:33.810. Uninterrupted, not a resume pass.
- Interrupted attempt connected16:33:06.129. Bluetooth manager recorded shell disable16:33:11, sensor-service enable request16:33:12 and shell enable request16:33:14; ON verified afterward. Shell toggle helpers returned137 despite real radio transition.
- Receiver failed16:33:29.429: request-characteristic write status1; phone remained Sending13%. Connection16:33:40.309 has no ble_resume/import evidence and is not proven to be the same session. Earlier status1 failures also occurred16:15:25 and16:28:58, so radio shutdown is not proven to be the sole trigger.

## External state

- Installed Karoo remains71. User-reported phone internal build5. No uninstall/clear-data.
- Exact new candidate `/tmp/gritmap-karoo-0.10.45-bluetooth-resume1-72/gritmap-karoo.apk`; sibling SHA256SUMS.txt/verification.json. Not installed.
- H10 test capture624 samples saved locally; export/phone ingestion unfinished. User FIT has HR, no RR/HRV; raw private ride/capture files not committed.

## Goal alignment

- GOALS priority1 public Bluetooth beta before replanner/H10 export expansion. Shared BLE contract unchanged; no phone modification required by this patch, but same-central/session recovery still needs hardware evidence.

## Hazards and blockers

- Automated tests are not a physical pass. Gate remains failed on71 and pending on72. Full-radio reset is harsher than a GATT-only disconnect. In-ride coexistence remains Jason-waived, not passed.
- Existing BleTransferReceiveSession currently wraps scanning AND receiving in its two-minute timeout, despite docs describing discovery only. This pre-existing mismatch was found during review and is not changed by this recovery patch; assess/fix before public release and do not assume long connected transfers are unbounded.
- Preserve app data and saved RR artifacts. No new installation/tag/publication without approval of the exact step/APK.

## Next safe action

Present exact code72/version/hash/source/QA and request installation approval under docs/KAROO_BETA_RELEASE.md. After approval, install-r, verify version, repeat interruption with a fresh receive window and missing segment, then separately assess the discovery-timeout mismatch before release approval.
