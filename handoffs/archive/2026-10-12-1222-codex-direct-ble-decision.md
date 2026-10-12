# Handoff: direct BLE approved in principle, pending contract review

- Updated: `2026-10-12 12:22 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `fd60a70 docs: handoff for direct Bluetooth send (phone side) and v2 contract`
- Worktree: existing unrelated/uncommitted phone and Karoo work remains; this milestone changes only handoff documents

## Outcome

Jason approved direct Bluetooth v2 as the intended no-IP phone-to-Karoo transport. This supersedes
building the hosted HTTPS capsule service for now, but does not authorize changing the Karoo reader
until the direct-transfer contract and actual phone implementation receive a cross-side review.

The agreed behavior is:

- The private pacing plan always travels directly over BLE.
- The Karoo skips segment transfer when the fingerprint is already installed.
- A missing public segment may be fetched from Open Segments when internet is available.
- Direct chunked BLE is the offline fallback for a missing segment.
- Karoo verifies exact byte length and SHA-256 before parsing.
- The existing strict `gritmap-transfer` parser and atomic transaction remain authoritative.
- Karoo writes an imported/rejected receipt only after the transaction outcome is known.
- The existing user-triggered, bounded receive window and Legacy Wi-Fi path remain.

The v1 HTTPS capsule implementation should be preserved but disabled until direct BLE passes a
physical end-to-end test. No Vercel capsule service should be built as part of this decision.

## Changed

- `handoffs/LATEST.md`: recorded the approved direction, implementation gate, and review checklist.
- `handoffs/archive/2026-10-12-1222-codex-direct-ble-decision.md`: archived this decision.
- No production code or shared wire contract was edited.

## Verified

- Read `docs/GOALS.md` and confirmed phone-to-Karoo sharing is a post-beta improvement; the working
  IP route remains the beta path.
- Read the newest coordinator section in `handoffs/LATEST.md`.
- Inspected `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` from commit `fd60a70` with `git show` because the
  current working-tree copy is not materialized locally.
- Confirmed the contract defines the v2 service, manifest/request/data/status characteristics,
  resource hashes and caps, receipt codes, and threat model.
- No build or automated test was run because this was a documentation/architecture decision only.

## External state

- Karoo still runs `0.10.44-beta`/67 with the v1 bounded capsule receiver installed.
- The public beta remains `0.10.43`.
- Direct BLE has not been exercised phone-to-Karoo on physical hardware.
- H10 coexistence during a transfer remains unmeasured.

## Goal alignment

- Supports `docs/GOALS.md` “Phone ↔ Karoo sharing”: pair/send without retyping an IP, while retaining
  the working IP route for the beta.
- Shared contracts affected: proposed v2 direct-BLE transport and existing `gritmap-transfer` import
  envelope. The import envelope must not change.
- Both phone and Karoo must implement the same final v2 contract before either side enables it.

## Hazards and blockers

- The v2 contract must be checked against real CoreBluetooth and Android GATT behavior before the
  Karoo implementation starts. In particular, a logical 512-byte chunk may span ATT Read/Read Blob
  operations depending on negotiated MTU; this must not be mistaken for a complete app chunk.
- A 250 KiB segment is roughly 489 logical 512-byte chunks, so direct segment BLE is a fallback and
  needs a separate connected-session timeout from the two-minute discovery window.
- Retry/restart semantics, receipt behavior, optional rider resource, link encryption, and H10
  continuity still require explicit confirmation.
- Existing uncommitted work and the branch being behind origin must be reconciled before commits to
  production Karoo code.

## Next safe action

Perform a line-by-line cross-review of `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` against the phone BLE
peripheral implementation, resolve the protocol questions above in the contract, and only then
replace the Karoo v1 token reader with the agreed v2 manifest/chunk/receipt client.
