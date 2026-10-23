# Bluetooth release candidate: physical acceptance

Candidate: 0.10.45-bluetooth-beta / code71. **Neither gate has been performed on this candidate.**
Existing success evidence on code69/70 does not establish these two tests passed. They must both
pass before wide Bluetooth beta invites. APK install/tag/publication each need Jason's approval.

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

## Gate A: H10 coexistence (R5)

1. With Jason's H10 attached and producing usable RR, start a Karoo recording and GritMap enhanced capture.
   Establish live RR sample counts/quality before opening the Inbox; ANT+ heart rate alone is insufficient.
2. Open Receive from Phone. Leave discovery open long enough to observe H10 RR updates.
3. Transfer a synthetic missing segment plus plan/rider; verify the successful Karoo import and phone receipt.
4. Observe H10 updates during transfer and after the receiver closes; finish/save the recording normally.
5. Inspect diagnostics and a safe recording export for RR timestamps, gap markers and counts before/during/after.
   Report any interruption explicitly; do not interpret a stale alpha-1 or ANT+ BPM as BLE RR continuity.

Pass evidence: successful import/receipt, live RR continuing throughout receive/discovery and data transfer,
no unexplained capture gap/disconnect, saved recording intact. Failure blocks wide H10/Bluetooth invites.
The RR recording itself remains private; commit only a redacted result summary.

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
