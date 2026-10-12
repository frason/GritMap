# Handoff: Karoo BLE transfer is user-triggered and bounded

- Updated: `2026-10-09 16:42 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `c1866fb docs: record first public Karoo beta release`
- Worktree: uncommitted Karoo BLE receiver, transfer-capsule contract/tests, launcher icon, README/install-guide, and handoff changes

## Outcome

The Karoo-side no-IP transfer receiver no longer scans continuously. In GritMap's Inbox,
**Receive from Phone** now starts a foreground, filtered, low-latency BLE scan for at most two
minutes. It stops scanning before the GATT connection, reads the compact capability token, fetches
and validates the HTTPS transfer capsule, imports through the existing atomic `gritmap-transfer`
path, and releases Karoo Bluetooth on success, timeout, cancellation, or error.

The prior local HTTP receiver remains available as **Legacy Wi-Fi Receive**. The extension service
itself no longer requests Bluetooth or owns a background token watcher, reducing idle power and
contention with Polar H10 capture.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/BleTransferReceiveSession.kt`
  owns the bounded Bluetooth lifecycle and two-minute timeout.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/BleTransferTokenClient.kt` performs a
  filtered foreground scan and closes GATT after reading the token.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/MainActivity.kt` starts/cancels the receive
  session, reports timeout/errors, refreshes the segment library, and preserves the legacy HTTP
  flow separately.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/KarooHomeScreen.kt` labels the primary path as
  Bluetooth and exposes **Legacy Wi-Fi Receive** as the fallback.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/GritMapKarooExtension.kt` contains no BLE
  transfer scanner or Bluetooth resource ownership.
- `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md` now specifies the explicit two-minute receive window and
  all-exit Bluetooth release policy.
- This supersedes the continuous low-power scan described in
  `handoffs/archive/2026-10-09-1630-codex-ble-transfer-capsule-karoo.md`.

## Verified

- From `apps/karoo/`, with Homebrew Java 17:
  `./gradlew testDebugUnitTest lintDebug assembleDebug`
- Result: build successful; 189 JVM tests, 0 failures, 0 ignored; Android lint passed; debug APK
  assembled.
- `git diff --check` passed.
- No physical BLE transfer was run because the iPhone peripheral and capsule service are not yet
  implemented.

## External state

- No new APK was installed on the Karoo for this milestone.
- The connected/published beta remains unchanged by this uncommitted work.
- GitHub contains no capsule endpoint, private plan store, or phone BLE advertiser yet.

## Goal alignment

- Advances the phone-to-Karoo segment/plan handoff without requiring the rider to discover or type
  a Karoo IP address.
- Shared contracts touched: compact BLE token and the new `gritmap-transfer-capsule` HTTPS schema.
  The existing segment JSON, `baselinePacingPlan`, and atomic `gritmap-transfer` import schemas are
  reused unchanged.
- Phone work still required: foreground BLE peripheral/advertiser, secure one-time token creation,
  capsule/resource upload, status polling, expiry, and retry UX.

## Hazards and blockers

- End-to-end transfer is not usable until the phone and HTTPS service exist. Do not publish the UI
  as a working transport before that integration is available, or feature-gate it for the beta.
- The capsule base URL is still the placeholder `https://gritmap.app/t/`.
- Android/JVM tests cannot validate Karoo Bluetooth arbitration. Physically test an Inbox transfer
  during H10 capture and confirm RR continuity before release.
- All work in this and the immediately preceding icon/BLE milestones remains uncommitted on `main`.

## Next safe action

Implement the phone-side foreground BLE advertiser against `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md`
behind a development flag, using a mock HTTPS capsule endpoint first; then run the two-minute Inbox
flow on a physical Karoo while recording H10 RR diagnostics.
