# Bluetooth release candidate: physical acceptance

Candidate: 0.10.45-bluetooth-beta / code71. Installed after Jason's exact approval.

**Scope update, 2026-10-23:** Jason waived the during-ride coexistence test because the extension
app screen cannot be accessed during an active ride. Supported instructions now say to send before
starting a recording. This is a waiver, **not a passed coexistence test**. Deliberate disconnect/resume
remains unperformed and required before wide Bluetooth invites. Tag/publication still need approval.

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
