# Handoff: RR pipeline completion for offline 0.10.41

- Updated: `2026-10-06 07:52 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `e8be5b4 docs: next-ride test checklist and follow-up review of the H10 work`
- Worktree: extensive shared uncommitted Karoo, phone, physiology, UI and documentation work; this milestone is not committed

## Outcome

The four requested isolated tasks are complete. RR artifact writes no longer run on the Bluetooth
callback. Finalized captures carry stable capture/segment/attempt identity and a hash-verifiable
sidecar. Schema 2 preserves Polar's native 1/1024-second RR precision while reading old schema-1
files. A standalone post-ride analyzer joins FIT, service-log and RR evidence into Markdown and JSON.

## Changed

- Added `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/RrArtifactPersistenceWorker.kt`
  with a single ordered daemon writer, bounded queue, checkpoints, identity updates and terminal
  finalize/close operations.
- Updated physiology models, H10 packet parsing, capture control and service wiring under
  `apps/karoo/app/src/main/java/com/gritmap/karoo/physiology/` and
  `apps/karoo/app/src/main/java/com/gritmap/karoo/service/LiveSegmentService.kt`.
- `RrArtifactStore.kt` now writes schema 2 native RR units and an atomic `.rr.json` sidecar with
  capture ID, segment ID, attempt ID, start time, schema, samples and SHA-256. Its reader supports
  schema 1 and 2.
- Added `src/diagnostics/postRideAnalysis.ts`, its test, and
  `scripts/analyze-karoo-ride.ts`; exposed as `npm run analyze:karoo-ride`.
- Updated `docs/PLAN_KAROO_AI_PHYSIOLOGY.md` and `docs/NEXT_RIDE_TEST_CHECKLIST.md`.

## Verified

- `npm test`: 449 tests passed, 0 failed.
- `npm run typecheck`: passed for the root app and `packages/ride-segments`.
- `JAVA_HOME=/opt/homebrew/Cellar/openjdk@17/17.0.20/libexec/openjdk.jdk/Contents/Home ./gradlew :app:testDebugUnitTest --tests 'com.gritmap.karoo.physiology.*' --tests 'com.gritmap.karoo.service.*' :app:lintDebug :app:assembleDebug`: build successful; reports contain 56 tests, 0 failures/errors/skips.
- `git diff --check`: passed.
- Offline APK SHA-256: `dedf981c2315763757c0da5d4fd49d8b18ca8f01479041ea2e7de08c242bb3ac`.
- A separate full Karoo JVM run still has the pre-existing unrelated `KarooPreviewStateTest > preview traverses recover hold and push zones` failure (169 tests, 1 failure); this milestone did not change that preview logic.

## External state

- No APK was installed for this milestone. The physical Karoo should remain on `0.10.40`/code63
  for the clean moving approach test; it was not reachable by ADB during final verification.
- Source and generated debug APK identify the offline `0.10.41`/code64 candidate.

## Hazards and blockers

- Schema 2, the background writer and metadata sidecar have JVM coverage but no physical H10/device validation yet.
- Final RR and metadata sidecar are each atomic, but they are not a cross-file transaction; a metadata write failure can leave a valid final RR without its sidecar and is reported as capture failure.
- Queue overflow or storage failure stops persistence and retains a recoverable partial rather than blocking Bluetooth.
- The shared worktree contains substantial unrelated uncommitted work; do not mass-reset or broadly format it.

## Next safe action

Run the planned moving segment test on installed 0.10.40, pull its FIT/log/schema-1 RR artifact,
and run `npm run analyze:karoo-ride`. Only after preserving that clean result should 0.10.41 be
installed for a desk dropout/background-writer/schema-2 validation.
