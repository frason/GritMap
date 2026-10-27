# Handoff: Bluetooth-only test acknowledged; two stored plans explained

- Updated: `2026-10-27 12:02 PDT`
- Agent: `Codex`
- Branch: `codex/karoo-receiver-capabilities`
- Head before this documentation: `6bd21fc docs: record diagnostic74 approval and device prerequisites`
- Worktree: clean before documentation; only LATEST and this new archive changed. No implementation changes.

## Outcome

Read own LATEST then fetched/read coordinator origin/main974a28f. **The supervised pacing test must use Bluetooth. Wi-Fi is not an alternative for this test.** Phone MVP session owns native BLE sender integration, consuming this branch's capability contract/fixtures. Diagnostic74 exact approval persists, but do not install until Jason confirms the sender build exists AND the Karoo is connected, unlocked and authorized. No such new confirmation received in this turn. No device action taken.

Build8 is internal TestFlight only and owner checklist passed, per coordinator; next public phone build is the redesign including sender. Public Karoo0.10.45/73 remains unchanged with experimental flags off. Order remains receiver/sender test → plan-free BLE+PR → On Karoo inventory design note. The phone's current Karoo check comes from send history, not verified device inventory.

## Changed

Documentation only: acknowledged974a28f decisions and answered the requested two-plan question below. Source/APKs remain eac155f and the exact diagnostic74/fallback75 artifacts documented in the previous archive. No merge/rebuild/substitution or public release.

## Verified

Read source at eac155f, unchanged on this branch:
- `data/KarooDatabase.kt`: PacingDao.baseline(segmentId), replacePlan/deleteBaseline scoped to that segment.
- `service/LiveSegmentCoordinator.kt`, `matching/DirectedLiveMatcher.kt`: single selection, direction/forward confirmation, lock threshold50m, discovery/reset behavior.
- `matching/ConcurrentSegmentTracker.kt`: planned-first headline comparator, remaining-distance/fingerprint ties, maxActive4/maxCandidates32 and admission order.
- `service/ConcurrentLiveRide.kt`, `service/RoomConcurrentRide.kt`: per-segment plan/goal snapshots, per-attempt sessions and secondary summaries.
- `service/ActiveAttemptSession.kt`, `service/LiveSegmentService.kt`, `service/AttemptReplanner.kt`: per-attempt replanner through shared enrichLiveMetrics; independent energy balance.
- `ui/SegmentPerformanceBitmapRenderer.kt`: secondary summary, not dual full pacing panels.
No tests/build needed or run for this read-only code review/documentation milestone; previous271 Karoo/219 phone tests and lint remain the prior verification, not a new run. No physical overlap test performed.

## Two segments with stored plans: current behavior

1. **Storage and goals:** two different installed segments can each retain a baseline plan and its own `targetFinishTimeSeconds` (phone coach input calls it `targetFinishSeconds`). Importing one segment's plan replaces that segment's baseline, not the other's. There is no single global goal time that makes the last-sent segment win. Normal transfers use distinct plan IDs.
2. **Public73 and approved diagnostic74 both have concurrency OFF:** only one attempt is actively executed/headlined. Before lock, select a direction-valid/forward-confirmed candidate with greatest matched progress, then nearest start, then segment ID. **Having a stored plan gives no priority in this legacy selector.** At50m it locks to that segment until termination/reset. Its own plan/goal supplies live guidance. A second stored plan neither takes over because it was sent last nor creates a second full display. Discovery runs when candidate set is empty; a start encountered during a locked traversal can be missed. Sequential non-overlapping starts can be handled after reset; overlapping plans are not both independently tracked in these builds.
3. **Development concurrent path (still OFF):** discovers starts each valid GPS update, with up to4 active attempts and32 candidates. Headline prioritizes an imported/stored plan, then smallest remaining DISTANCE (not predicted finish time or fastest goal), then fingerprint. With two planned active segments, nearer finish by distance headlines; the other can appear as a small secondary summary in Segment Performance. Full-size fields show one headline; no two full pacing charts/targets side by side. Each attempt retains its own plan, goal and progress. Two active segments are within the4-attempt cap; stored-plan count itself does not consume active capacity. Overflow admission is deterministic, not plan-prioritized, and can ignore a new start until it leaves/rearms.
4. **Replanning interaction:** ActiveAttemptSession owns its own AttemptReplanner, and concurrent updates call the same enrichLiveMetrics path, so one plan's target list/goal is not used for the other. Public73 replanning is OFF; diagnostic74 replanning ON but concurrency OFF, so the approved test exercises only one attempt. The development concurrent path has independent per-attempt W' balances, NOT one shared ride-level energy ledger. Overlapping plans can request different powers and do not reconcile them into one rider target beyond headline selection; no combined energy-safety/overlap physical validation claim. Turning concurrency on or changing headline policy is a separate later milestone, not part of this note.

## External state

No new device query, install, phone build, transfer, ride, tag or publication. Last actual ADB query on2026-10-26 listed no devices; this is historical, not a claim about today's cable state. Exact diagnostic74 approved SHA256 remains d8bca0eb8c841c5490d11cb6837630cc1918e9087e2e7371a28c168ad69d9d32. Public73 last owner-confirmed installed, not freshly read.

## Goal alignment

Answers coordinator's2026-10-27 per-segment goal question (phone priorities2/4, Karoo7/8) without implementation. Phone remains owner of goal/plan authoring and sender; Karoo consumes per-segment goals. Needle remains untouched/backlogged.

## Hazards and blockers

Matching Bluetooth sender build and Jason's readiness confirmation still pending. Existing exact diagnostic approval remains valid. No Wi-Fi substitution for this test. Room4 needs the newer signed flag-off75 fallback to disable; never clear data/uninstall or return to public73/Room3 as a backout. Concurrency remains off; do not infer two-plan storage means two-plan execution today. Questions from the phone session should be answered in LATEST, not by unauthorized cross-chat messaging.

## Next safe action

Await phone sender completion/contract questions through coordinator. Once Jason confirms that sender build exists and the Karoo is connected/unlocked/authorized, verify the approved APK and install in place without repeat approval. Use Bluetooth to send a generated ceiling-bearing plan, verify persisted metadata, then ONE supervised ride. Keep all public experimental flags off.
