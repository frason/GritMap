# Handoff: Karoo BLE transfer-capsule receiver is implemented

- Updated: `2026-10-09 16:30 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `c1866fb docs: record first public Karoo beta release`
- Worktree: uncommitted BLE capsule receiver, contract/tests and earlier Karoo icon/release-link edits

## Outcome

The Karoo side of the no-IP transfer path is implemented and verified in isolation. GritMap now
requests Bluetooth through `karoo-ext`, continuously performs a filtered low-power scan for the
GritMap transfer service, reads a compact 36-byte JSON token from a foreground iPhone peripheral,
and downloads a strict short-lived capsule over HTTPS. It independently downloads the public
segment and private plan, verifies SHA-256 over their exact bytes, combines them into the existing
`gritmap-transfer` shape, and uses the existing strict parser and atomic Room import. Successful
imports produce a Karoo alert and beep; failures produce a bounded alert and diagnostic entry.

This is not end-to-end usable yet: the iPhone advertiser and capsule service do not exist.

## Changed

- `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md` is the normative phone/server/Karoo contract.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/BleTransferTokenClient.kt` implements
  address-free, bond-free BLE discovery and the one-characteristic read.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/importing/TransferCapsule.kt` adds strict token and
  capsule parsing, bounded non-redirecting HTTPS fetches, expiry/URL/hash validation, package
  composition and import.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/GritMapKarooExtension.kt` owns the guarded
  long-lived watcher, `RequestBluetooth`/`ReleaseBluetooth`, duplicate suppression, diagnostics and
  user confirmation.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/MainActivity.kt` now requests Android 12 scan and
  connect permissions on both fresh installs and upgrades where location was already granted.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/importing/TransferCapsuleTest.kt` covers the compact
  envelope, invalid tokens, successful composition through the existing parser, tampering, expiry
  and HTTPS-only resources.

### Exact phone/server contract

- BLE service: `e7a4e868-0a21-45d6-ac63-5812c740ba12`
- BLE readable characteristic: `58fc915a-a32c-42c1-babd-fa58123409d7`
- Payload: `{"v":1,"t":"<exactly 22 unpadded base64url chars>"}`
- Capsule GET: `https://gritmap.app/t/{token}`
- Capsule schema and limits are fully specified in `docs/BLE_TRANSFER_CAPSULE_CONTRACT.md`.
- Capsule points to a public segment JSON plus a short-lived private baseline-plan JSON, each with
  exact-byte SHA-256. The phone must not report success merely because the BLE characteristic was
  read; server-side receipt/status remains to be designed and implemented.

## Verified

- Focused `TransferCapsuleTest`: 6/6 passed.
- Full `:app:testDebugUnitTest`: 189/189 passed, zero skipped/failures/errors.
- `:app:lintDebug`: passed.
- `:app:assembleDebug`: passed.
- `git diff --check`: passed.
- Not run: physical BLE advertisement, real HTTPS capsule fetch, end-to-end phone transfer, H10
  coexistence/dropout measurement, signed beta build or device install.

## External state

- No server resources, secrets, accounts or public URLs were created.
- No APK containing this receiver was installed on the physical Karoo.
- The existing IP receiver remains unchanged and usable.

## Goal alignment

- Implements the first Karoo portion of the post-beta **pair once, then Send just works** direction
  in `docs/GOALS.md`; it does not replace or destabilize the beta IP fallback.
- Shared contract touched: a new versioned BLE/capsule contract was added. Existing portable segment,
  baseline plan, fingerprint and `gritmap-transfer` formats are reused without changes.
- Phone/server work is required before this path can be enabled end to end.

## Hazards and blockers

- `https://gritmap.app/t/` is a contract placeholder until the transfer service exists.
- The phone must remain foregrounded while advertising a custom BLE service to a non-Apple central.
- Always-on low-power scanning follows SendPin's proven pattern but has not been measured alongside
  GritMap's active Polar H10 GATT connection. Do not ship it publicly until an H10 ride confirms no
  RR dropout or sensor regression.
- Version 1 protects private plans with TLS plus a 128-bit short-lived bearer capability. It does
  not yet encrypt plan content from the transfer service itself.
- Completion receipt/status is documented but intentionally not invented on the Karoo before the
  server design exists.
- All work is uncommitted and shares a worktree with the earlier app-icon and README changes.

## Next safe action

Claude should implement a minimal phone-side CoreBluetooth peripheral and a local fake capsule
server against the exact fixture contract, then Codex can install a signed candidate and perform
three physical checks: successful import, expired/tampered rejection, and Polar H10 RR coexistence.
