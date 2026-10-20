# Handoff: BLE reliability update committed

- Updated: `2026-10-20 09:00 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `67bfc60 fix(karoo): isolate BLE callbacks and reuse transfer connection`
- Worktree: separate H10 recordings/export request remains uncommitted in LATEST and its archive; no uncommitted BLE source.

## Outcome

BLE callback routing and connection lifecycle update committed as `67bfc60`, with regression tests and five device installation/validation archives.

## Changed

- `DirectBleGattClient.kt`, `DirectBleTransferReceiver.kt`, new `DirectBleEventGate.kt` and `DirectBleEventGateTest.kt` under `apps/karoo/app/src/`.
- Dated installation/validation archives from October 19, 21:28 through 22:41.
- This archive and LATEST record commit completion.

## Verified

- Reviewed source/test diff and `git diff --check`: clean.
- Prior unchanged-source QA: 198 JVM tests, lintDebug, signed assembleBeta passed; retained build log `/tmp/gritmap-ble2-build.log` confirms BUILD SUCCESSFUL. No tests rerun for committing.
- Prior hardware evidence: two missing-segment transfers and one installed-segment skip succeeded, MTU 517; see validation archives.

## External state

- Last verified device install `0.10.44-ble2`/69, data retained. No install or device action this turn.
- Local commit only; no push, release, or tag.

## Goal alignment

- Dev-gated direct Bluetooth sharing track in docs/GOALS.md. No wire contract change.

## Hazards and blockers

- H10 RR coexistence and deliberate reconnect/resume remain unverified.
- Next public release needs code >=70; existing two-minute receive-session ceiling remains.
- H10 recordings/export is a separate requested task, still unimplemented and uncommitted.

## Next safe action

Validate transfer with a live H10 and RR continuity, then deliberate reconnect/resume before public Bluetooth rollout.
