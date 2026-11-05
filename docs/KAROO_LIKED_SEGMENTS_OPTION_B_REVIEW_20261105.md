# Liked segments Option B: Karoo compatibility review

2026-11-05. Source: origin/main 815495f, top of handoffs/LATEST.md. Reviewed Karoo branch ee438ae (runtime as pushed at 2e73fd2) and the local phone reference 84d43b5 read-only. The phone reference predates the new Option B requirement to retain the catalog UUID; this review does not verify a later phone build or live API behavior.

**Recommendation: no Karoo code, schema, protocol or APK change for Option B.** Keep Add to my segments a phone-only save. Send one selected segment with a compatible pacing plan through the existing flow. Do not advertise bulk sending, plan-free BLE, catalog metadata refresh or linked deletion. Qualify larger libraries before promising support for hundreds of installed segments.

## 1. Volume

No explicit installed-segment count limit is enforced in the reviewed Room import path. The 512 KiB BLE segment limit is per payload, not a library capacity. Each new fingerprint adds one segment, one row per reference point and three point indexes; a plan adds a baseline row and one row per zone. Re-sending the same fingerprint does not add geometry. Actual database size depends on identifiers, SQLite/index overhead, elevation, attempts and page allocation. Illustrative cost: 1,000 points with elevation contain roughly 32 kB of coordinate/distance/elevation doubles alone (before keys/indexes and storage encoding); 300 such segments yield 300,000 points and roughly 9.6 MB of those scalar values. This is arithmetic, not a disk or heap measurement.

The activity calls SegmentLibraryRepository.list at startup and refreshes after import. SegmentDao.library returns metadata, not all polylines, but aggregates points and zones in the same join, using distinct counts. A segment with 1,000 points and 40 zones can contribute roughly 40,000 joined rows before aggregation; 300 such segments imply about 12 million joined combinations. The Segments screen eagerly composes cards in a scrolling Column. Startup, post-import refresh and UI work are the likely first library-wide pressure points.

LiveSegmentCoordinator discovers starts in a roughly 30 m bounding box when the candidate set is empty; it loads the entire geometry of each hit before checking canStart. The coordinate index covers all points, and the query restricts to pointIndex zero; it is not a dedicated start-point index or a capped result. The separate approach discovery is roughly 250 m with a 10 s interval. Distant installed segments are not all turned into live matchers; dense co-located starts and repeated empty discovery can still be expensive. Default matching follows one headline attempt. Experimental concurrent tracking is off and is not a library-capacity solution.

For launch, encourage sending the next ride's selection rather than the full Liked library. Use about 50 installed segments as a provisional soft-warning/benchmark trigger if a warning is needed, not a validated limit or a hard cap. Do not add a warning just to ship Option B. Before supporting hundreds or bulk sends, benchmark synthetic libraries of 50/100/300 including dense starts and long polylines; measure database size, first open, refresh, discovery and ride update latency. If needed, aggregate points/zones independently, virtualize the list and index starts; preserve matching behavior and do not silently truncate eligible candidates.

## 2. Identity and updates

The reviewed phone pin implementation (src/openSegments/pinSegment.ts → src/db/importRegistrySegment.ts at 84d43b5) validates/recomputes fingerprint, deduplicates by it, and inserts under a generated local ID. It does not persist a separate catalog UUID on this path. Option B's phone-side UUID retention still needs implementation or verification there. src/karoo/buildTransferParts.ts serializes the local segment ID and fingerprint, not a catalog UUID or source/type field.

Karoo SegmentJsonParser retains the wire ID and recomputes the canonical fingerprint from matching rules and geometry; SegmentEntity indexes fingerprint uniquely. Karoo cannot infer catalog provenance from an opaque ID, and the displayed plan source is not segment provenance. Existing-fingerprint BLE sends skip the segment body, so even a new name or extra metadata in that body will not refresh the existing row. TransferPackageRepository can replace the baseline plan for the existing fingerprint; a conflicting ID with different fingerprint is rejected when a segment body reaches the importer. Changed geometry under a distinct ID can be a separate segment, not an in-place update. Preserve existing attempts.

For Option B, use the fingerprint and ordinary immutable segment semantics; no contract change. If Karoo provenance becomes necessary later, coordinate optional validated origin metadata (provider and catalog UUID) in portable segment JSON and Karoo storage. Keep the local ID and fingerprint separate. Define metadata refresh for known fingerprints explicitly, since optional fields on skipped bodies are insufficient. The outer gritmap-transfer package and BLE manifest are strict; do not append undeclared fields to them. Use shared fixtures and a negotiated extension if metadata needs an independent delivery path.

## 3. Removal

Unlike, sign-out, catalog removal and deleting the phone copy should not affect the Karoo copy or history. There is no reverse inventory reconciliation or delete command in this flow. Continue explicit manual Karoo removal with the existing confirmation, preferably after the ride. Current Room cascades remove points, baseline plans/zones and attempts/checkpoints/records; Recent results disappear with their attempts. This is destructive deletion, not hide/archive. If a rider needs to retire a segment while keeping attempts, design an archive separately. No silent delete or history cleanup.

## 4. Type tag

The API's segmentType is not carried by buildTransferParts, retained by SegmentJsonParser/SegmentEntity, or present in SegmentLibraryRow. Neither installed rows nor a future Nearby list can show the authoritative type today. Defer the tag; do not infer it from plan source or activityType. If later needed, agree on optional climb/descent/ride metadata in the portable contract, nullable persistence, old/missing-value behavior and same-fingerprint refresh. Keep it out of fingerprint identity and matching. Do not add a Room migration for this release.

## 5. Nearby, Recent and tester APK

Nearby remains a proposal; its pool should be **installed Karoo segments**, including any phone-saved segment actually sent successfully, never the remote Liked list. Use indexed start discovery, cheap projected rows and a bounded result; don't call the full library aggregate or load full geometry for every row. Radius, ordering and row content still need approval.

Recent is an independent Room query over completed attempts, returning at most 20 and drawing at most three. A large installed library does not become a large result feed. LIMIT bounds output, not the scan/sort cost of a large attempt history (the reviewed attempt indexes are on segmentId and startedAtMs, not the completion sort keys). Imports can invalidate the joined observation; benchmark if sustained import/history growth makes this noticeable. Room 5 adds attempt snapshots, not likes/provenance/type fields. Library volume matters for upgrade verification and launch/refresh time, not the scope of the migration.

No Option B dependency on a tester Karoo update. Keep the separate signed candidate and migration/ride validation gates already documented. Add one synthetic/approved later compatibility scenario: pin via phone, send with existing plan flow, resend, then unlike on phone and confirm the installed segment remains. No such test run here.

## 6. Multi-send safety

Current BLE v2 manifest represents one fingerprint, one segment and one required plan, with optional rider/record resources. Per-resource caps: segment 512 KiB, plan 128 KiB, rider 16 KiB, record 8 KiB where enabled. A new pin alone is not a plan: the existing sender requires a compatible saved/imported plan or goal to generate one; do not promise plan-free BLE. The phone Add all controller pins locally one at a time; it does not send to Karoo.

DirectBleTransferReceiver skips known geometry, otherwise obtains and validates it before the plan, then optional resources. TransferPackageRepository commits one package in a Room transaction. DirectBleRecovery supports bounded reconnect/resume within one transfer; a changed manifest is fatal. The phone peripheral has a single active transfer/owner and one terminal receipt; MainActivity's receive job finishes after one package. DirectBleTransferTest covers strict shape, length/hash, installed geometry skip and receipt shape; DirectBleRecoveryTest covers reconnect/resume, retry budget and changed transfer rejection; ReplanStorageTest includes transactional rollback. These are source/test inspections, not new execution or proof of batch safety.

Commit precedes receipt, so a lost receipt can leave a successfully installed segment even if the phone reports uncertainty. A retry with the same fingerprint does not duplicate geometry, but a plan resend can replace the baseline; there is no monotonic plan revision check in the reviewed importer. Do not auto-retry an old plan over a newer one. Keep sends individually selected and serialized, checking each outcome. A future bulk feature should sequence separate sessions with per-item success/failure/unknown states, selective retry and explicit ordering, never imply atomic rollback across segments or run parallel sessions.

No tests, builds, device access, install or runtime changes in this review.
