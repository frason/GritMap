# Handoff: Karoo direct-BLE v2 reader implemented and dev-gated

- Updated: `2026-10-12 19:35 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `3d503c3 feat(karoo): add direct BLE plan transfer reader`
- Worktree: handoff files only after implementation commit

## Outcome

The Karoo now implements the reviewed v2 direct-Bluetooth transfer contract as a user-triggered,
bounded central. Debug builds expose **Receive from Phone**; release/beta builds keep it hidden unless
`-PgritmapDirectBleV2=true` is supplied. The public `0.10.44` APK and Legacy Wi-Fi receive path are
unchanged.

The reader requests MTU 517, strictly validates the manifest and resource caps, performs exact
Request/Data chunk reads, resumes completed offsets after up to three reconnects, verifies each
resource's exact-byte SHA-256 before JSON parsing, skips installed segments, optionally fetches a
public Open Segments file without redirects, includes optional rider history, and imports through the
existing atomic `gritmap-transfer` importer. Receipts are written within the post-read 30-second
window; a lost response gets one reconnect/retry and `writeNotPermitted` on that retry is considered
delivered.

## Changed

- Commit `3d503c3`.
- Added `DirectBleGattClient.kt`, `DirectBleTransfer.kt`, and `DirectBleTransferReceiver.kt`.
- Rewired `BleTransferReceiveSession.kt` and `MainActivity.kt` from the unused v1 capsule receiver to
  v2 while preserving the old v1 source disabled.
- Added `DIRECT_BLE_V2_ENABLED`; debug is enabled, other variants default disabled.
- Added seven protocol tests in `DirectBleTransferTest.kt`.
- Updated `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` status to implemented behind development flags,
  awaiting device verification.
- Confirmed rider-facing Karoo pacing-plan copy uses **section(s)**; wire/domain keys remain `zones`.

## Verified

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.importing.DirectBleTransferTest' --no-daemon` — pass.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --no-daemon` — pass: 196/196 JVM tests, lint, native build, and debug APK.
- `git diff --check` — pass before commit.
- Debug-signed, dev-enabled APK: `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`;
  SHA-256 `4136cfd7ba015a3a1037e2f947a6bf1671c6f9a5a2ad2414b642d2877fd9f008`;
  Android Debug certificate SHA-256
  `b2ad840e744fbe49065d1c718d115f492e910d84ff6d8db66134d8fd12a2f8a3`.

## External state

- No APK was installed and no tag/release was created.
- Public beta remains `0.10.44`; direct BLE remains invisible there.
- A beta-signed build was not produced locally because no beta signing-properties file is available
  in this environment. The debug-signed development APK is ready for a clean-install device test but
  cannot update an APK signed with the beta certificate in place.

## Goal alignment

- Advances `docs/GOALS.md` Priority 1 by replacing the IP-address handoff with a rider-triggered,
  offline phone-to-Karoo transfer while retaining strict validation and the existing import path.
- Shared contract touched: `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` and `gritmap-transfer`; no wire
  fields changed. The phone implementation already matches v2 and requires no code change.

## Hazards and blockers

- Physical iPhone-to-Karoo behavior is not yet verified: MTU/chunk timing, installed and missing
  segment paths, reconnect/resume, receipt display, and Polar H10 RR continuity remain open.
- Android/iOS long-characteristic reads at 512 logical bytes are compile/test verified but require the
  planned hardware test.
- The v1 capsule classes remain in the tree only for history/rollback and are not wired into the UI.

## Next safe action

Produce or install a beta-certificate-signed dev-enabled build without clearing Karoo app data, then
run the installed-segment transfer first and record negotiated behavior, receipt, duration, and H10 RR
continuity before attempting a missing-segment transfer.
