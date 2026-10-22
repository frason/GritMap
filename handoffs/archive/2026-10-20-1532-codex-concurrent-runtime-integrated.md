# Handoff: concurrent runtime integrated behind default-off flag

- Updated: `2026-10-20 15:32 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `860f82c docs: handoff for building the GritMap screens in Figma`
- Worktree: multi-segment foundation, runtime, tests, design/proposal docs and handoffs uncommitted; no new commits.

## Outcome

The pure tracker now has a real live-service path selected with `-PgritmapConcurrentSegments=true`. It independently updates/persists up to four attempts, hands the headline to a surviving segment, logs an ignored fifth by segment ID/reason, retains shared H10 capture across headline changes, and shows secondary segments in Performance fields. No-plan Performance shows elapsed/progress; PR import/comparison is not implemented yet. Default builds keep the legacy path.

## Changed

- New `apps/karoo/app/src/main/java/com/gritmap/karoo/service/ConcurrentLiveRide.kt`: serialized per-attempt sessions, bounded pre-confirmation sample replay, immutable macro-event records, ordered retry outbox, independent checkpoints/finishes, headline publication, lifecycle teardown. Failed writes retain their original snapshots for retry; backlog backpressure is bounded and diagnosed.
- New `service/RoomConcurrentRide.kt`: discovery during active segments, approach notifications, baseline snapshots, macro persistence using telemetry timestamps. `data/KarooDatabase.kt` adds idempotent concurrent entry insertion, no schema/table migration.
- `service/LiveSegmentService.kt`: default-off routing, all-attempt ride/service shutdown, shared H10 release guard and ride-scoped capture identity; legacy branch retained.
- `service/ActiveAttemptSession.kt`: optional W′ disable, default remains enabled for legacy. Concurrent path intentionally disables per-attempt W′ pending a correct ride-level engine.
- `ui/state/LiveUiState.kt`: headline attempt ID and secondary summaries. `ui/SegmentPerformanceBitmapRenderer.kt`: secondary line/count, headline name, unplanned elapsed/progress; optional fields leave legacy rendering unchanged.
- `apps/karoo/app/build.gradle.kts`: `CONCURRENT_SEGMENTS_ENABLED`, default false for all build types, opt-in `gritmapConcurrentSegments` property.
- Tracker result now exposes candidate fingerprints for bounded runtime metadata/sample retention.
- New runtime tests `service/ConcurrentLiveRideTest.kt`, `service/RoomConcurrentRideTest.kt`; renderer preview test. Prior nine tracker tests retained.
- Design/proposal updated with approved cap and phone PR timing evidence. No phone code or wire/parser changes.

## Verified

- Focused concurrent-runtime tests passed during development.
- Final JDK 17 command in `apps/karoo`: `./gradlew :app:testDebugUnitTest :app:lintDebug :app:assembleDebug -PgritmapConcurrentSegments=true --no-daemon`: BUILD SUCCESSFUL, **213 tests, zero failures/errors**, lint and native/debug APK pass. Log `/tmp/gritmap-runtime-complete.log`.
- Tests cover overlap/handover with buffered sample counts, snapshot immutability, four-session cap diagnostics, independent Room rows and telemetry timestamps, ordered failed-entry retry through finish, repeated teardown, and large/compact rendering.
- Final default command: `./gradlew :app:assembleDebug :app:generateBetaBuildConfig -PgritmapBetaSigningProperties=<existing properties> --no-daemon`: BUILD SUCCESSFUL; generated debug and beta BuildConfig both have `CONCURRENT_SEGMENTS_ENABLED = false`. Log `/tmp/gritmap-runtime-default-final.log`. Initial beta config generation without signing properties refused as designed; rerun with existing properties passed.
- Inspected renderer PNGs: `/tmp/gritmap-concurrent-planned.png`, `/tmp/gritmap-concurrent-unplanned.png`, `/tmp/gritmap-concurrent-compact.png`; corrected footer/card crowding and duplicate unplanned title.
- `git diff --check`: clean. No Android-service hardware integration test, physical overlapping ride, H10 continuity test or performance benchmark run.

## Phone PR time basis confirmed

- `src/screens/SegmentDetailScreen.tsx`: eligible attempts have decision `accept` OR `manuallyApproved`; best is minimum `endTimestampMs - startTimestampMs`.
- `src/db/persistMatchCandidate.ts`: timestamps come directly from matched boundary `ride_points` rows using source point indices.
- Thus **sampled elapsed time including pauses/gaps**, not moving time, FIT timer time or interpolated crossings. Proposed `bestDurationSeconds` must preserve duration / 1000 without integer rounding. The live matcher may select different boundary samples; matching the time basis is not a claim that detected durations are already identical.

## External state

- No device operations, installation, signing of a new beta APK, tag, release, commit or push this turn. Last verified Karoo remains `0.10.44-ble2`/69.
- Final local debug APK was rebuilt with concurrent feature OFF by default; supply the opt-in property to rebuild an enabled development APK. Do not install a debug-signed APK over the beta-signed device package.

## Goal alignment

- `docs/GOALS.md` priority 7, post-beta, approved cap four and phone time basis.
- Current beta/BLE contract unchanged. `segmentRecord` remains unsupported; phone must not send it yet.

## Hazards and blockers

- PR persistent records, interpolation, record-only import, parser/shared fixtures, ownership/replacement and split anchors remain open. This is concurrent runtime integration, not completion of the whole PR feature.
- Ride-level W′ remains unimplemented in this development path; existing beta W′ unchanged.
- H10 artifact remains ride-scoped; multi-attempt association metadata is not yet added. Physical H10 coexistence is unverified.
- Start sample replay retains at most 32 tentative samples, so a prolonged ambiguous start can lose early telemetry aggregates even though its original observation timestamp is retained.
- Retry outbox is memory-only. Persistent storage failure at service/process loss can leave unsaved macro events; diagnostics report pending writes. No claim of crash-durable write recovery.
- Discovery currently loads nearby definitions each fix; profile/cache/route memory performance needs measurement before public rollout.
- Existing public-release version requirement remains code >=70. No new test APK was installed.

## Next safe action

Settle record ownership/replacement and bounded split anchors in the shared proposal, then implement strict Wi-Fi `segmentRecord` parser/storage with shared fixtures before phone sends. Separately validate the opt-in concurrent runtime and H10 behavior on hardware before enabling any public path.
