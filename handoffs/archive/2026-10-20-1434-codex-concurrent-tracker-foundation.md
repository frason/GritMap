# Handoff: concurrent segment lifecycle foundation passes QA

- Updated: `2026-10-20 14:34 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `910153c docs: BLE verified on Karoo; multi-segment task unblocked for Codex`
- Worktree: uncommitted design/proposal docs, new tracker/test, LATEST and design/foundation archives. No commits this milestone.

## Outcome

First implementation slice is complete: isolated pure concurrent lifecycle and headline selector. It is NOT wired to the live service and does not enable multi-segment recording on a device. No beta or wire behavior changes.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/matching/ConcurrentSegmentTracker.kt`: per-fingerprint matchers and forward gates, independent traversal IDs, terminal lifecycle, stable plan/distance/fingerprint headline ordering, frozen plan inputs, duplicate/out-of-order tick handling, active/tentative caps and capacity events, rearm and finish-all handling.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/matching/ConcurrentSegmentTrackerTest.kt`: nine synthetic tests including second start at 950 m, independent finish/handover, abandonment, stable headline/ties, cap admission, duplicate ticks, reverse/mid-route exclusion, simultaneous completion/shutdown and repeated traversal/plan freezing.
- Design/proposal docs updated to distinguish isolated implementation from pending runtime integration.
- This archive and LATEST.

## Verified

- Initial seven focused tracker tests passed.
- Final JDK 17 command in `apps/karoo`: `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug --no-daemon`: BUILD SUCCESSFUL; 207 tests, zero failures/errors, lint and native/debug APK pass.
- Log `/tmp/gritmap-concurrent-qa.log`; test XML under `apps/karoo/app/build/test-results/testDebugUnitTest/`.
- `git diff --check`: clean. Synthetic geometry only; no personal ride files added.
- No physical test, install, signed beta build or performance benchmark run for this slice.

## External state

- Last verified installed Karoo stays `0.10.44-ble2`/69; no device operations, tag, release or push.
- Debug APK regenerated locally; not installed.

## Goal alignment

- Starts `docs/GOALS.md` priority 7, post-beta. Follows reviewed design while leaving existing runtime path intact.
- No shared segment/transfer/coach/rider/pairing/BLE contract changed.

## Hazards and blockers

- Current production coordinator/service still use one active attempt. Tracker has no runtime call site or development flag yet; add both together during integration.
- Exact crossing timestamps and buffered start telemetry are not implemented: firstObservedAtMs and confirmedAtMs are deliberately distinct from PR timing.
- Ordered immutable persistence, per-session telemetry ownership, shared H10 capture lifetime, aggregate UI, PR storage/interpolation and segmentRecord import are pending.
- Cap defaults four active/32 tentative. Overflow produces an explicit event, never evicts an active attempt. Review performance/overflow presentation during integration.
- Phone PR timing/rider ownership contract coordination is still required before sender changes. H10 recordings/export remains separate.

## Next safe action

Integrate tracker into a dedicated default-off development path in LiveSegmentCoordinator/LiveSegmentService with keyed attempts and ordered immutable persistence; preserve shared H10 ownership and test service teardown/headline switching before any device install.
