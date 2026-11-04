# Karoo-to-phone Bluetooth data return: feasibility review

2026-11-04. Docs only, reviewed from local source f828191 and main ea4290b instructions. No phone/native edits, payload schema changes, device access, data export or transport tests.

## Conclusion

Returning completed attempt summaries and finalized H10 RR artifacts directly over Bluetooth is technically feasible, but it is not implemented by the current send protocol. Full Hammerhead ride FIT sync is a separate problem: this extension does not currently have a demonstrated supported way to read the head unit’s completed native FIT. Keep manual FIT import as the beta analysis path. Summary sync or RR transfer does not replace a full recorded ride.

## What exists

- docs/BLE_DIRECT_TRANSFER_CONTRACT.md v2: phone is a foreground peripheral/GATT server; Karoo is central. Manifest/data flow phone→Karoo, request/status writes flow Karoo→phone. Strict manifest resource names plan/segment/rider and size caps, offset reads, hashes and receipts. Its header still describes early flag/physical status; read it for protocol shape, not current release status.
- importing/DirectBleGattClient.kt already performs acknowledged characteristic writes for capabilities, requests and receipts. modules/gritmap-ble-peripheral/ios/GritMapBlePeripheralModule.swift didReceiveWrite dispatches only recognized request/status characteristics. TransferSession.swift accepts a single status receipt, maximum128 bytes, exact3 keys; receipt is not a reverse data channel. Putting result/RR bytes there would break the current contract.
- data/Entities.kt and service/RoomAttemptEventSink.kt persist attempt UUID, segment fingerprint snapshot, captured goal/name, sampled duration, outcome and averages. These are good summary inputs. HistoricalAttemptSampleEntity exists for imported historical samples; the current final event sink does not write a full per-second live ride stream. No vendor ride UUID in the reviewed RideState integration, and no guarantee every overlapping segment is recorded with concurrency OFF.
- physiology/RrArtifactStore.kt: finalized app-private .rr plus JSON sidecar, SHA-256, sample count and captureId with optional segmentId/attemptId. RR schema2 has a16-byte header and14-byte observation records. RrArtifactCatalog currently enumerates recoverable partials, not a complete sync inventory. Add a safe catalog of finalized artifacts; never transfer an actively mutating file as a finalized one.
- src/diagnostics/postRideAnalysis.ts already decodes RR schema1/2 and provides analysis helpers. This is useful format reuse, not proof of a persisted phone RR library, Bluetooth import UI or stable FIT association. Those receive/store/join flows remain new work.
- Vendor FitEffect models support writing developer fields to a recording. No completed native FIT download/read API was found in the inspected models; writing FIT fields is not access to the recorded file. No permission bypass or reading another app’s private storage is proposed. A documented platform export API or explicit user-selected file is required before promising full FIT return.

## Recommended staged scope

1. Versioned contract and synthetic fixtures first. Define completed-attempt summary identity as sender installation identity + attemptId, segment linkage by canonical fingerprint, timingVersion/approximate flag, nullable goal/averages and explicit outcome. UUID alone is not account ownership. No GPS in the summary. Deletion/reinstall and sender ownership rules must be explicit.
2. Foreground, rider-initiated post-ride session, preserving phone-peripheral/Karoo-central roles. New negotiated export protocol/characteristics and UI for listing selected summaries/artifacts, capacity and progress; keep existing v2 sends unchanged. No background-auto-sync or concurrent H10 recording promises. New iOS native receiver support requires its own approval/security review in the phone session.
3. Transfer attempt summaries first. Then finalized RR+sidecar only after phone storage/decoder/association tests. Preserve raw RR ticks and schema; do not convert/re-encode into pretend native FIT. Mark unresolved ride association for the rider rather than joining by nearest clock time silently.
4. Full FIT export is a separately blocked milestone until supported acquisition is established. An extension-created stream would be a different recording, with its own completeness/timer/GPS contract, not an original Karoo FIT.

## Proposed transfer guarantees, not a final wire contract

Negotiate a new protocol version before streaming; older apps get unsupported, not partial parsing. Use immutable opaque resource IDs, resource kind/schema, exact length, SHA-256 and capture/attempt linkage in a bounded paged manifest. No local filesystem path supplied over the wire. Draft caps for review:64KiB summary bundle,8MiB per RR resource, bounded batch total and free-space check before acceptance. Do not reuse v2’s segment cap as an RR limit or allocate an entire untrusted manifest size in memory.

A separate acknowledged data-write characteristic can carry offset-framed chunks from the Karoo central to the phone peripheral, while status/control reads supply accepted durable offsets. Frame length must fit the negotiated write payload including headers; never assume512 bytes fit a single acknowledged write. Serialize GATT operations and backpressure from durable receiving storage. MTU fallback, chunk/frame encoding and minimum supported MTU require shared fixtures and real measurements before commitment. No throughput/ETA assertion is justified from the old phone→Karoo read tests.

Journal transferId/resourceId + byte offset/hash state durably on the receiver; validate bounds and out-of-order/duplicate chunks; resume by resource hash after reconnect and even after app restart if consent/session trust permits. Final hash/length/schema validation precedes atomic file promotion and idempotent DB commit; return committed receipt only afterward. Retain source on Karoo until confirmed receipt, and retain it by default afterward—sync is not deletion consent. Restart, cancellation, full storage, failure during final commit and lost receipt must never duplicate a result or delete the only copy. Do not acknowledge RAM-only progress as durable.

## Privacy and authorization blocker

The current v2 design has no bonding/encrypted-link requirement and first-central session ownership; a hash is integrity checking, not peer authentication. That historical plan-send decision does not approve a new raw-physiology export threat model. Before implementation, choose an authenticated/encrypted peer/session design and explicit first-use transfer consent, with replay protection and bounded discovery; review what session identity survives reconnection. No open RR advertising, raw sensor logs, account tokens or shared secrets in public diagnostics. Native permissions, key storage or bonding changes need separate approval. This is a design/security gate, not proof Bluetooth cannot carry the data.

## Verification and effort boundaries

Contract fixtures must cover schema versions, unknown resources, length/hash mismatch, caps, sender association and timestamp ambiguity. Synthetic transport tests: duplicate/reordered writes, dropped link at multiple offsets, process death, MTU mismatch, concurrent request refusal, disk-full, duplicate final receipt, old v2 client and durable-import failure. Phone RR decoder tests should retain schema1/2 unit semantics and file truncation errors. Later physical checks require both foreground apps after ride save and explicit device/native approval. No new tests run for this documentation-only review; existing code was inspected, not exercised.

This needs coordinated phone native receiver/storage work plus Karoo export work; it is not a one-sided Karoo toggle. No external hosting, Open Segments account or liked-segments dependency is necessary for the proposed local return. Do not block existing manual FIT beta loop on this larger feature. Next approval should be for a shared contract/security proposal, not a full sync implementation or install.
