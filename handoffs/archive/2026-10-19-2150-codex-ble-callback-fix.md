# Handoff: BLE callback fix tested and installed; physical retest pending

- Updated: `2026-10-19 21:50 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a915233 docs: coordinator next task for Codex`
- Worktree: implementation and documentation below are uncommitted; coordinator bug report in LATEST preserved.

## Outcome

The code cause of `Unexpected BLE read event` is addressed: only a callback matching the current operation and characteristic can complete it. One connection now serves manifest, segment, plan, rider and receipt. `0.10.44-ble2` / code 69 is installed in place. Physical transfer success is not yet verified.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/DirectBleEventGate.kt`: synchronized typed callback gate, persistent disconnect failure, operation context in disconnect errors.
- `DirectBleGattClient.kt` in the same directory: route callbacks through the gate; close unsuccessful opens; wait up to 2 seconds for disconnection before closing, including during cancellation; log MTU.
- `DirectBleTransferReceiver.kt`: reuse connection across resources; reconnect/resume chunks only on disconnect; keep the session alive with manifest reads during optional HTTP fetch; fetch segment before plan; log resource sizes, resume offsets and duration; timeout rejection code.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/importing/DirectBleEventGateTest.kt`: regression tests for duplicate MTU/service/wrong-characteristic callbacks during read and mid-chunk disconnect/late callback. These test the production callback gate with synthetic callbacks, not Android hardware.
- This archive, previous installation archive, and `handoffs/LATEST.md` remain uncommitted. No new commits.

## Verified

- Final command from `apps/karoo`, JDK 17: `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleBeta -PgritmapBetaSigningProperties=<existing beta-signing.properties> -PgritmapVersionCode=69 -PgritmapVersionName=0.10.44-ble2 -PgritmapDirectBleV2=true --no-daemon`: BUILD SUCCESSFUL; 198 tests, zero failures/errors, lint and minified/native beta build pass.
- Initial run failed lint while source edits were ongoing; final unchanged-source rerun above passed. Build log `/tmp/gritmap-ble2-build.log`.
- `git diff --check` clean.
- APK `apps/karoo/app/build/outputs/apk/beta/app-beta.apk`: SHA-256 `634560e772c22b15c8e188a621da7a017451a7d9bd4ce6535ed0ef56fbb5e766`; `apksigner verify --print-certs` passes, beta signer SHA-256 `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`.
- `adb install -r`: Success; dumpsys confirms `0.10.44-ble2`/69.
- UI retains `1 installed · 1 ready`; settings text identical before/after. First install timestamp `2026-10-09 13:18:34` and ceDataInode `109481` unchanged.
- MainActivity launched successfully in 559 ms; crash buffer empty. Inbox Ready.

## External state

- USB Karoo 3 serial `00442GA241760203` now runs `0.10.44-ble2`/69; app data retained.
- Left on Inbox, Ready, receiver not started. Phone build 5 per coordinator; not inspected in this turn.
- No uninstall, clear data, tag, push or publication. Public release remains 0.10.44.

## Goal alignment

- Serves the dev-gated direct Bluetooth sharing track in `docs/GOALS.md`.
- No wire/schema change; phone changes not required by this fix.

## Hazards and blockers

- Hardware success remains unverified: existing segment, missing segment, receipt, reconnect/resume, and live H10 RR continuity still need testing.
- Next public release must use versionCode >=70 to install over this device build.
- Existing receive session has a two-minute total scan/transfer ceiling; large slow BLE transfers may hit it. Not changed in this fix.

## Next safe action

Jason opens phone build 5 Bluetooth send for an already-installed segment; tap Karoo Receive from Phone and record MTU, duration, receipt and reconnects from GritMapLive logs. Then test a missing segment and H10 coexistence. Do not claim Bluetooth beta is validated until these pass.
