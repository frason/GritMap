# Handoff: controlled BLE link test setup verified; exact install approval pending

- Updated: `2026-10-23 18:13 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `46eb5beea3ea30b103e063b1cdf769acd9972171 fix(karoo): isolate BLE link recovery tests and discovery timeout`
- Worktree: source committed; this archive and LATEST are documentation-only follow-up

## Outcome

Controlled link-only diagnostic setup is implemented and built, replacing the earlier review-only checkpoint. Normal source QA passes. The diagnostic APK is ready for exact installation approval; it is not installed and has no physical recovery pass. Installed72 remains unchanged.

## Changed

- Source46eb5be: DirectBleLinkTest drops the actual transfer GATT link once after a complete segment chunk crosses the configured threshold. Diagnostic code73 config8192 bytes; default0 disables injection. DirectBleGattClient.disconnectForTest waits for the real disconnect callback. No radio toggle, phone session reset or ownership relaxation. Diagnostic builds force the segment through BLE rather than the optional HTTPS optimization.
- DirectBleTransferReceiver logs test request/callback and verified complete manifest on reconnect; completed buffer/hash validation remains authoritative.
- BleTransferReceiveSession and DirectBleReceiveWindow now limit discovery to2min, then provide a separate bounded10min transfer window. Transfer errors/timeouts propagate; MainActivity reports connected timeout as transfer timeout rather than no phone found/cancelled.
- Gradle code73, default-off test property gritmapBleTestDisconnectAfterBytes; public release CI asserts BLE_TEST_DISCONNECT_AFTER_BYTES=0. Exact copied Inbox labels unchanged.
- scripts/monitor-karoo-ble.py uses direct line iteration and a bounded reader lifetime, no select/text-buffer mismatch and no radio controls. scripts/test-monitor-karoo-ble.py reproduces two events in one pipe flush with no further output.
- Six new Kotlin tests cover default-disabled/one-shot controls, discovery vs transfer budgets and cancellation; two Python monitor regression tests. Docs describe diagnostic-vs-public artifacts explicitly.

## Verified

- Source committed before QA; no later source changes.
- Normal configuration: JDK17/Android SDK, apps/karoo/gradlew -p apps/karoo :app:testDebugUnitTest :app:lintDebug :app:assembleBeta with existing private beta signing properties, code73/name0.10.45-bluetooth-beta, no fault property. BUILD SUCCESSFUL in2m48s;263 Kotlin tests,0 failures/errors/skips; debug lint/beta vital lint/signed optimized build pass. Log /tmp/gritmap-ble-link73-default-qa.log.
- python3-B scripts/test-monitor-karoo-ble.py:2 tests pass, including real pipe buffering reproduction.
- Diagnostic build separately: :app:assembleBeta, code73/name0.10.45-bluetooth-linktest1, -PgritmapBleTestDisconnectAfterBytes=8192. BUILD SUCCESSFUL in1m40s, beta lint and signed optimized build pass. Log /tmp/gritmap-ble-link73-diagnostic-build.log. The263-test normal-config run is not a test-suite run with the diagnostic property enabled; its controller tests explicitly exercise threshold8192.
- apksigner verifies both; certificate matches installed/public identity `eac4c309da0e0410b2926c6a478b17038cdf7407fe3d4d86341eebf53a90f5f6`. aapt verifies both versions. Generated beta flags: BLE true, concurrent/replanner/ceilings false; injection0 for normal artifact and8192 for diagnostic artifact.
- Normal APK: /tmp/gritmap-karoo-0.10.45-bluetooth-beta-73/gritmap-karoo.apk, 3900465 bytes, SHA256 `c371496a8d32d80949dc3986dec4ee8e0975fd2eb5f666c278c63d7bbd62fd3e`.
- Diagnostic APK: /tmp/gritmap-karoo-0.10.45-bluetooth-linktest1-73/gritmap-karoo.apk, 3897265 bytes, SHA256 `c62ad47e80144c51fba5f08e4c35e7fbe214e12f61fd3bb56db44078f6a54e17`.
- Both folders contain SHA256SUMS.txt and verification.json. No new device test/install, no tag/publication.

## External state

- Physical Karoo last verified0.10.45-bluetooth-resume1/code72, in-place install. Bluetooth last verifiedON. Phone internal build5 last reported; exact installed phone module source not independently proven.
- Prior code72 radio restart test failed: offset122368 retries, reconnect, manifest read refused/status2, phone stopped41%. Earlier monitor delayed interruption~65s. This result remains failed; new setup does not supersede it as a pass.
- Saved624-sample H10 artifact remains app-private; export unfinished. Private ride/raw RR files remain outside Git. Preserve app data.

## Goal alignment

- GOALS priority1 public Bluetooth beta, with Karoo sensor capture retained. No wire contract or phone source changes. Same-central/full-manifest checks remain strict.

## Hazards and blockers

- Diagnostic artifact deliberately breaks one link; never publish it as the public beta. Public CI/default0 gate and separate artifact hashes are intentional.
- Needs a missing segment larger than8192 bytes. Installed-segment skip or too-small resource will not exercise injection. Successful test requires actual callback, verified same manifest, offset resume, all hashes/import and phone receipt; percentage alone is insufficient.
- Full-radio restart failure cause remains unresolved (phone ownership/session refusal); controlled GATT-only test isolates this without resetting radio/H10. Do not weaken refusal checks.
- Need exact installation approval for diagnostic73, physical test, then normal public-artifact validation and separate exact publication approval. In-ride coexistence owner-waived, not passed. No tag/publication authorized.

## Next safe action

Present diagnostic73/version/source/hash/QA for exact install approval. Once approved, recheck hash and adb install-r, verify version/launch, run read-only monitor, open a fresh Receive from Phone, and have Jason Send the previously failed missing segment. No manual or ADB radio interruption is needed: candidate injects the real link drop at8192 bytes. Keep phone foregrounded, do not cancel/resend, and record offset/callback/manifest/hash/import/receipt evidence. Validate the normal injection0 candidate before requesting public release approval.
