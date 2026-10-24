# Handoff: controlled link-disconnect setup checkpoint

- Updated: `2026-10-23 18:04 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-bluetooth-beta`
- Head: `38cb64e docs: record code72 radio interruption recovery failure`
- Worktree: documentation-only checkpoint; no new source modifications

## Outcome

Jason asked for a controlled transfer-link disconnect and then a handoff update. Preparation has started with source/GOALS/LATEST review. No GATT-only test control or replacement monitor has been implemented, built or installed yet. This checkpoint must not be read as completed setup.

## Changed

- LATEST and this dated archive only. Existing recovery source0312e10 unchanged.

## Verified

- Read latest handoff, goals, MainActivity receiver construction/UI wiring, DirectBleGattClient and DirectBleRecovery.
- No new tests/build/device actions in this setup turn. Prior code72 QA:257 tests, debug/beta lint and signed build pass.
- Last physical evidence unchanged: code72 resume offset122368 attempts1/2, reconnect, manifest read status2/not permitted; phone stopped41%. No import/receipt pass.

## External state

- Karoo remains approved0.10.45-bluetooth-resume1/code72; Bluetooth last verifiedON. Phone internal build5 last reported.
- Jason was instructed to cancel the stalled send/receiver. Completion of cancellation not independently confirmed.
- No new APK/install/tag/publication. Saved624-sample H10 artifact not exported; private FIT/RR files outside Git.

## Goal alignment

- GOALS priority1 Bluetooth beta acceptance. Wire contract and same-central ownership must remain unchanged.

## Hazards and blockers

- Full-radio restart may alter identity/session, so use GATT-only disconnect to isolate recovery. Manifest refusal cause remains unproven.
- Existing monitor uses select plus buffered text readline and delayed trigger by~65s; replace it before relying on timing.
- Existing two-minute timeout encloses the transfer as well as discovery; fix and validate before public release.
- User already authorized either remote interruption or a test button. A new APK still requires exact install approval per release instructions; no need to ask again merely to implement/test setup.

## Next safe action

Implement an isolated single-GATT-link test control without weakening ownership or affecting H10/radio, plus an unbuffered monitor. Add meaningful regression coverage, run QA, prepare a committed signed code73-or-higher candidate, update handoff, then request exact installation approval before physical retry.
