# Handoff: code72 radio-restart recovery still fails physical acceptance

- Updated: `2026-10-23 17:59 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `d1a046d docs: record approved code72 device installation`
- Worktree: documentation-only test evidence

## Outcome

Code72 reaches the intended chunk-recovery path after a real radio interruption, but no successful resumed import/receipt. Phone stopped at41% per Jason. Physical acceptance remains failed, not passed.

## Changed

- No source/APK/device installation changes. LATEST, this archive and physical acceptance notes updated.

## Verified

- Connected17:56:23.912, MTU517.
- Monitoring defect: Python select plus buffered text readline delayed consumption of the connection event. The intended five-second interruption did not occur. Harmless log ticks woke the monitor; actual interruption was around17:57:29, about65s after connection. Do not report this as an early five-second outage. Replace the monitor with an unbuffered reader/queue before next test.
- At17:57:29.514: ble_resume resource=segment offset=122368 attempt=1.
- At17:57:43.864: ble_resume resource=segment offset=122368 attempt=2.
- At17:57:45.856: ble_connected mtu=517.
- At17:57:53.980: ble_transfer_failed error=D:BLE read a9c5876c-8f5f-48be-aae7-eb47ef573c41 failed (2). UUID is manifest; status2 is read not permitted. No ble_resource completion, ble_imported or receipt success established.
- Bluetooth independently verified enabled:true/state:ON after restoration. Shell svc helpers again returned137 despite effective radio control.
- Jason reported6% before interruption and41% stopped afterward. Percent change alone does not prove post-reconnect chunk delivery; both resume logs retained the same last-completed offset.
- No automated retest/build needed for documentation only; prior257-test/lint/signed-build QA still applies to installed source0312e10.

## External state

- Karoo remains0.10.45-bluetooth-resume1/code72, approved in-place install. Phone internal build5 last reported. No clear-data/uninstall/tag/publication.
- User was asked to keep both apps open during observation; cancel the stalled transfer before a fresh attempt.

## Goal alignment

- GOALS priority1 Bluetooth beta. No protocol/phone change. Same-central ownership must remain strict.

## Hazards and blockers

- Full adapter restart affects all GATT connections and can change central identity, unlike dropping only the transfer link. Phone TransferSession.readManifest refuses an ended session or different owner. Current evidence cannot distinguish those causes; do not claim a definitive phone bug or relax the ownership check.
- Need a controlled GATT-only disconnect test (user previously authorized either remote interruption or a test button) to distinguish link recovery from whole-radio/session behavior. Production checks must not be weakened to make a test pass.
- Existing receive two-minute timeout also encloses transfer; correct/validate this before public release.
- In-ride coexistence owner-waived; raw H10 export unfinished, saved artifacts must be retained.

## Next safe action

Prepare a controlled single-GATT-link fault injection and fix the monitor buffering. Verify same session/offset recovery without radio restart, preserving ownership checks; coordinate any phone-side diagnosis via Jason if manifest refusal persists. A new candidate needs exact install approval. Public release remains blocked by physical gate and separate release approval.
