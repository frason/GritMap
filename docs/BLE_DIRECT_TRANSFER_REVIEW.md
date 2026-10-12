# Review: BLE direct transfer v2, contract vs phone implementation

Reviewer: coordinator (Claude), 2026-10-12. Requested by Jason. Scope: `docs/BLE_DIRECT_TRANSFER_CONTRACT.md` checked line by
line against the phone implementation at `fd60a70` (`modules/gritmap-ble-peripheral/ios/TransferSession.swift`,
`GritMapBlePeripheralModule.swift`), and against the Karoo importer (`apps/karoo/.../importing/TransferPackage.kt`, Codex's
uncommitted working tree). It answers the open questions in `handoffs/archive/2026-10-12-1222-codex-direct-ble-decision.md`.
Not run: any physical BLE exchange.

## Verdict

The contract and the phone code agree on the parts that already work: UUIDs, manifest keys and caps, the request/data/status flow,
exact-byte hashes, receipt validation, and first-central ownership. The skip-the-segment path is valid: `TransferPackage` accepts a
package without `segment` (`segment: SegmentDefinition?`), and the importer looks up the installed segment by the plan's fingerprint.
**Codex can start the Karoo reader once the contract changes below are merged.** The phone needs four small fixes (P1 to P4), and
none of them changes the wire format.

## Jason's decisions (2026-10-12)

- **D1. Keep the optional `rider` resource.** The Karoo's strict parser requires a profile whose FTP matches the plan, so sending the
  rider profile with each plan keeps a BLE send equivalent to a Wi-Fi send.
- **D2. No link encryption in v2 (beta).** There is no bonding and no pairing prompt. `docs/PRIVACY.md` gets one sentence about Bluetooth
  before the feature is visible to riders. Revisit encryption after the beta.

## Findings and resolutions

### R1. Logical chunk vs ATT reads (Codex question 1): clarify the contract; phone bug P1

A logical chunk is `min(chunkBytes, bytes - offset)` bytes. One ATT Read returns at most MTU-1 bytes, and the rest comes back through
Read Blob at increasing value offsets. Android's `BluetoothGatt.readCharacteristic` performs the long read internally and delivers the
whole value. **Contract change:** the Karoo knows the expected chunk length from the manifest, so it must treat a Data value shorter than
`min(chunkBytes, bytes - offset)` as an error and retry, never as end of data.

**P1 (phone bug):** `TransferSession.readData` records progress, and with it `planFullyServed()`, as soon as it *builds* the response at
value offset 0. CoreBluetooth then truncates that response to MTU-1 bytes. So on the last plan chunk the phone can decide "plan fully
served" before the Karoo has the remaining Read Blob bytes, and show "Sent; check your Karoo" for a transfer that never completed.
Fix: count a chunk as served only when a read's value offset plus the bytes actually deliverable (`min(part.count,
central.maximumUpdateValueLength + 2)`, or more simply the next request or receipt) covers the chunk's end. The cleanest rule:
a chunk is served when the Karoo issues the next Request (or the Status write) after reading it.

### R2. Segment duration and timeouts (Codex question 2): add MTU and duration rules to the contract

Each logical chunk costs one Request write plus ⌈chunk / (MTU-1)⌉ reads.
- MTU 247 or more: about 3 to 4 round trips per chunk. A 250 KiB segment (about 489 chunks) is about 1,700 to 2,000 round trips,
  roughly 1 to 2 minutes at typical connection intervals.
- Default MTU 23: about 25 round trips per chunk, over 12,000 for the same segment, roughly 7 to 15 minutes. That breaks the
  10-minute session cap.

**Contract change:** the Karoo **must** request MTU 517 (Android `requestMtu(517)`) before reading. If the negotiated MTU is below 185 and
the segment is needed, it should prefer the public fetch when `segment.public` is set and it has internet. Otherwise it reads over BLE
and shows progress, accepting that it is slow. The plan, at about 3 KB, is fine at any MTU. Keep the 30 s inactivity limit (it resets on
every request and read), and keep the 10-minute total cap. The 2-minute window covers discovery only and ends at the first manifest read
(already in the contract).

### R3. Retry, restart and receipt (Codex question 3): define reconnect/resume; phone change P2, P3

- **Reconnect and resume.** The phone stops advertising after the first manifest read, so if the link drops mid-transfer the Karoo can't
  find the phone again, and the rider has to start both sides over. **Contract change and P2:** keep advertising for the whole session.
  Ownership stays locked to the first central, so a second Karoo is still refused, and the same Karoo can reconnect and **resume from its
  last complete chunk**. Requests are offset-based, so resume needs no new wire format. The Karoo retries a dropped connection up to 3
  times within the 30 s inactivity window. CoreBluetooth's central identifier for the same remote device is expected to stay stable
  within the session; confirm this physically.
- **Receipt timing, P3.** The phone ends the session 30 s after the last request or read. Writing the receipt doesn't extend it. An import
  that takes longer than 30 s, or a slow write, would lose the receipt. Fix: after the plan is fully served, give the receipt a dedicated
  60 s window. Contract: the Karoo writes the receipt **within 30 s of its last read**, or `rejected` with `timeout`.
- **Receipt retry.** Receipts are accepted once. If the write response is lost and the Karoo retries, it gets "write not permitted".
  **Contract change:** the Karoo treats "write not permitted" on a receipt retry as delivered, and doesn't loop.

### R4. Minor (phone change P4)

- A manifest read with a value offset past the end returns success with an empty value. The ATT-correct answer is `.invalidOffset`. The
  same applies to `readData` and `writeRequest`, which currently answer `readNotPermitted`/`writeNotPermitted`. That's acceptable, but the
  contract should list the ATT errors the Karoo can expect, so its error mapping is deterministic.
- `startTransfer` accepts a manifest whose declared byte counts don't match the resource bytes passed in. That's harmless because the
  TS builder produces both, but a cheap length check in Swift would catch a bug before it reaches the Karoo as `bad_hash`.

### R5. Not checked here: needs a physical test

- iPhone advertising to the Karoo 3 (a non-Apple central) while the Send screen is foregrounded.
- Negotiated MTU and real transfer time for the plan, and for a 150 to 250 KiB segment.
- H10 RR continuity while a receive session is open (Codex owns this; do it during the H10 ride).
- Central identifier stability across a reconnect (R3).

## Who does what

- **Phone session:** P1 to P4, merge the contract changes below, and add the `docs/PRIVACY.md` Bluetooth sentence when the dev flag is
  lifted (not before).
- **Codex:** after committing and tagging 0.10.44, implement the Karoo central against the updated contract: MTU 517, chunk length check,
  resume, receipt rules. Keep the v1 capsule code disabled.
- **Jason:** approve the physical test, then a flagged Release build on the iPhone 15 Pro Max and a Karoo build with the v2 reader.
