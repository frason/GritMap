# Handoff: multi-segment design and PR contract review drafted

- Updated: `2026-10-20 13:42 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `910153c docs: BLE verified on Karoo; multi-segment task unblocked for Codex`
- Worktree: design note, proposal link, LATEST and this archive uncommitted; no source edits.

## Outcome

Completed the requested first step: `docs/KAROO_MULTI_SEGMENT_DESIGN.md` describes concurrency ownership, headline selection, rendering, persistence/H10 integration, PR handling, contract review and implementation order. No feature implementation yet.

## Changed

- New `docs/KAROO_MULTI_SEGMENT_DESIGN.md`.
- Linked it from `docs/KAROO_MULTI_SEGMENT_AND_PR.md`.
- This archive and `handoffs/LATEST.md`.
- No commits, schema migration, contract mutation or device changes.

## Verified

- Read current goals/proposal and inspected runtime coordinator, service callbacks/lifecycle, both ActiveAttemptSession classes, ForwardProgressGate, DirectedLiveMatcher, LiveUiState, RoomAttemptEventSink, attempt entities, TransferPackage parser/repository and BLE allowed-field handling.
- Confirmed single-session service ownership, discovery-only-when-empty, reset-on-completion, provisional fallback masking no-plan state, strict unknown-key rejection and required BLE plan.
- `git diff --check` for documentation changes; no tests/build run for design-only milestone.

## External state

- Last verified Karoo install remains `0.10.44-ble2`/69. No install, tag, push or release.

## Goal alignment

- `docs/GOALS.md` priority 7, post-beta. Preserves beta build and current BLE contract.
- Reviews proposed `segmentRecord`; phone must not send it before Karoo support/capability handling and shared fixtures exist.

## Hazards and blockers

- Time basis (elapsed including pauses versus phone PR semantics), cap versus “every segment”, rider ownership, record replacement and bounded split anchors require agreement before sender implementation.
- Current runtime timestamps cannot be assumed to represent exact crossings; current local attempt rows do not by themselves provide a full PR split curve.
- H10 capture identity/release and asynchronous persistence must be refactored with multi-session ownership, not just discovery.
- H10 export request remains separate and unimplemented. BLE live H10 continuity and deliberate reconnect/resume validation remain open; next public code >=70.

## Next safe action

Review design/time basis and record semantics with phone-side work, then implement pure concurrent lifecycle/headline logic behind a dedicated development flag; do not change beta or BLE wire format.
