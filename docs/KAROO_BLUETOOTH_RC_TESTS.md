# Bluetooth release candidate: physical acceptance

Candidate: 0.10.45-bluetooth-beta / code71. Installed after Jason's exact approval.

**Scope update, 2026-10-23:** Jason waived the during-ride coexistence test because the extension
app screen cannot be accessed during an active ride. Supported instructions now say to send before
starting a recording. This is a waiver, **not a passed coexistence test**. Deliberate disconnect/resume
failed full-radio tests on71/72, then passed a controlled GATT-only disconnect on diagnostic73 (details below). Normal public candidate validation and release approval remain required before wide invites. Tag/publication still need approval.

## Before the tests

Record committed source, beta APK SHA-256, signature and code/name; install only after Jason approves
the exact candidate. Use an in-place signed update, preserve all app/recording data. Confirm the
matching phone build has Bluetooth enabled. Keep the iPhone foregrounded. Use a synthetic segment/package
for transfer diagnostics, so retained logs can avoid private GPS/rider data. Record phone/Karoo versions,
negotiated MTU, timing, outcome and receipts. No uninstalls or clear-data.

Confirm labels: GritMap > Inbox > Receive from Phone; WAITING FOR PHONE; Cancel Receiving;
Bluetooth closes automatically after 2 minutes; Legacy Wi-Fi Receive. The two-minute limit is discovery,
not a claim that a long transfer is cut off once connected. Bluetooth/Nearby devices permission and
location permission must work on a fresh installation; denial must leave a useful retry/fallback.

## Gate A: during-ride H10 coexistence (waived by Jason)

Jason said this test is unnecessary because the extension screen cannot be accessed while a ride
is happening. Do not force the app open over a ride to manufacture a supported rider flow.

Observed on code71: H10 Enhanced connected and capture started; diagnostics showed60 RR samples
at100% validity before the test ride. Recording/Paused ride states subsequently appeared. No phone
transfer, saved-artifact inspection or RR-continuity-during-transfer result has been established.
Subsequent ride-end log confirmed h10_capture_saved reason=ride-ended samples=624. The supplied native FIT contained standard heart rate but no RR/HRV messages or H10-derived metric fields. Raw artifact integrity/quality remains uninspected; recording list/export to the phone is unfinished. Do not infer BLE RR
continuity from native heart rate or a stale alpha-1 value.

Send segments/plans before starting a ride. The old requirement that both gates must pass is superseded
by Jason's explicit waiver of this during-ride test; GateB and publication approval remain requirements.

## Gate B: deliberate disconnect and resume (R3/R5)

### Observed on code71, 2026-10-23

- Baseline transfer: MTU517, segment60,833 bytes, plan4,313 bytes, rider114 bytes;
  imported existing=false in32,963ms at16:16:33.810. This was not interrupted and is not a resume pass.
- Interrupted attempt: connected16:33:06.129, shell-triggered radio disable16:33:11,
  sensor service requested enable16:33:12, shell requested enable16:33:14; adapter confirmed ON.
  Shell helper processes returned137, but Bluetooth manager's enable log confirmed the radio transition.
- Receiver failed16:33:29.429 with BLE request-characteristic write status1. Phone remained at
  Sending13%; another connection appeared16:33:40.309, without a ble_resume event or successful import.
  This later connection alone does not establish continuation of the same session.
- Gate failed. The full-radio restart is a harsher outage than a single GATT-link disconnect.
  No publication approval; preserve installed data. Recovery patch0312e10/code72 passes257 tests/lint/signed build; installation approval and repeat physical validation pending.

### Code72 radio-restart repeat, 2026-10-23

- Connected17:56:23.912. A buffered monitor delayed interruption to~17:57:29 (not intended5s).
- Resume offset122368 attempt1 at17:57:29.514, attempt2 at17:57:43.864; connected17:57:45.856.
- Manifest read failed status2/read-not-permitted at17:57:53.980. Phone stopped41%; no import/receipt.
- Radio restoredON. Still failed. Next isolate with a GATT-only disconnect; do not weaken ownership.

### Repeat procedure

1. Use a sufficiently large synthetic missing segment (150–250KiB within contract caps) so multiple completed
   chunks are observed before interruption. Record the last complete offset and current session/package identity.
2. With Jason, deliberately interrupt the phone/Karoo Bluetooth link mid-transfer without cancelling the
   transfer session. Restore it within the30s inactivity window. Avoid resetting the phone session/owner.
3. Observe bounded reconnect attempts and continued requests from the last completed chunk (not silently
   starting a different package or claiming success from a partial payload). Check same-central ownership.
4. Verify exact-byte resource hashes, a single successful atomic import, and a delivered success receipt on
   both devices. Retry an installed segment separately to retain coverage of the skip path.
5. If recovery does not complete, record the actual error/timeout and fail the gate. Do not mark a manual
   fresh-session resend as reconnect/resume success.

Pass evidence: real disconnect, stable ownership, last-complete-offset resume, bounded timing, hashes,
exactly one imported plan/segment and receipt. Failure blocks wide Bluetooth invites.

## After gates and publication approval

Keep APK/source/hash and redacted evidence with the handoff. Obtain Jason's separate approval before tagging
or publication. After release, validate the stable download link using Companion's Share Link installation
and verify the installed code/name with existing segments/settings retained. Only then expand invites.

## Controlled link-only diagnostic candidate

Use code73 diagnostic variant `0.10.45-bluetooth-linktest1`, built explicitly with
`-PgritmapBleTestDisconnectAfterBytes=8192`. The flag defaults to0 and public release CI asserts0.
This variant drops only the active transfer GATT link once after8192 fully read segment bytes,
requires the real disconnected callback, then lets normal receiver recovery run. No radio toggle,
session reset, ownership relaxation or H10 disconnect is requested. Diagnostic transfers use BLE
instead of the public-segment HTTPS optimization so the test actually exercises a segment link.
Use a missing segment larger than8192 bytes; installed segments take the skip path and cannot
exercise this injection. A new receive session gets a fresh one-shot test controller.

Monitor with `python3 -B scripts/monitor-karoo-ble.py --adb /opt/homebrew/bin/adb --serial <serial>`.
It reads lines directly with a bounded lifetime and has no radio-control commands. Look for
ble_test_disconnect completed=8192, ble_test_disconnected callback=true, ble_resume offset=8192,
ble_resume_verified offset=8192, completed/hash-verified resources, import and phone receipt.
Do not count a test without the real callback, matched manifest and successful import/receipt.

Normal-build QA must run without the test property (one test asserts the default is0). Build the
diagnostic APK separately after that QA and verify its flag/version/signature/hash. Present the exact
APK for install approval. The diagnostic binary is not the public release binary: afterward build
and validate the final public candidate with injection0 and obtain separate release approval.
Discovery is limited to two minutes; a found phone gets a separate bounded ten-minute transfer window.
A connected transfer timeout is reported as a transfer timeout, not as no phone found.

## Controlled-link physical pass on diagnostic73

Observed10-23: connected23:12:23.268 (MTU517), actual link drop/callback after8192 bytes at23:12:27;
resume attempts1/2/3 retained offset8192; reconnected23:12:45.042 and verified the same complete
manifest23:12:45.080. Hash-verified segment298148 bytes, plan5778 and rider114, then imported
existing=false at23:15:15.763 in174327ms with acknowledged success receipt. Jason confirmed phone success.
Bluetooth independently remainedON. This proves controlled link recovery on the diagnostic variant,
not full-radio restart recovery or H10 continuity. Normal injection0 APK still needs approved installation
and normal-transfer/skip validation; public release remains separately gated.
