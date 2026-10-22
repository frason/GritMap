# Handoff: default-off deterministic live replanner verified

- Updated: `2026-10-22 16:44 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `1650b79 feat(karoo): add opt-in deterministic live replanning`
- Worktree: all feature source/tests/docs committed; this handoff is the only pending change before its commit.

## Outcome

Concurrent foundation and installed field changes are committed/pushed (`c9da364`, verification handoff `c26e024`). A first deterministic live replanner is now implemented and tested behind a separate default-off flag (`1650b79`). Both debug/beta defaults remain false. No install, version bump, release or Needle activation this milestone.

## Changed

- `1650b79`: `pacing/LiveReplanner.kt`, `service/AttemptReplanner.kt`, session/enrichment and both legacy/concurrent paths: quarter-mile boundary trigger, 3s deadband, retained/frozen completed targets, easier-first bounded increases, ceiling/step/estimated W′ checks, conservative missing-power handling and matching/gap gating. Legacy Needle replacement bypassed while enabled. Original plan/goal unchanged.
- `importing/ReplanMetadata.kt`, `TransferPackage.kt`, Room entities/discovery: optional v1 metadata validation, persistence/reload; unknown versions ignore metadata. Database v3 with non-destructive migration 2→3, exported schema3. No phone production sender change.
- `SectionWorkTracker.kt`: preserve completed work when future targets change. Performance renderer: estimated finish/gap and limited-adjustment status, including compact layouts.
- `docs/fixtures/plan-ceilings-transfer-v1.json` aligns with the phone-generated fixture; `src/pacing/planCeilingsFixture.test.ts` verifies it on the phone side. New synthetic replay fixture has no personal data.
- `docs/KAROO_LIVE_REPLANNER.md`, `docs/NEEDLE_READINESS.md`, ceilings contract/provenance/status notes describe implementation, timing/energy limitations and rollout gate.

## Verified

From `apps/karoo`, JDK17:
- Default full `:app:testDebugUnitTest :app:lintDebug :app:assembleDebug`: passed before final refinements (247 tests); log `/tmp/gritmap-replanner-default.log`.
- Final opt-in full same tasks with `-PgritmapConcurrentSegments=true -PgritmapLiveReplanner=true --no-daemon`: passed **249 tests, zero failures/errors**, lint/build. Log `/tmp/gritmap-replanner-optin.log`.
- Final default full same tasks plus `:app:generateBetaBuildConfig -PgritmapBetaSigningProperties=<existing persistent properties> --no-daemon`: passed **249 tests, zero failures/errors**, lint/build; generated debug and beta BuildConfig both have CONCURRENT_SEGMENTS_ENABLED=false and LIVE_REPLANNER_ENABLED=false. Log `/tmp/gritmap-replanner-final-default.log`.
- Tests cover import compatibility/validation, shared phone targets/ceilings, stored metadata reload, schema2 segment/plan preservation, work retention, ahead/deadband/unreachable/step/ceiling/energy/unknown-grade cases, conflicting constraints, session retention/freezing/GPS gaps, energy convention and synthetic replay.
- Root `node --experimental-test-module-mocks --test src/pacing/planCeilingsFixture.test.ts`: 3/3 pass. Root `npx tsc --noEmit`: pass, log `/tmp/gritmap-replanner-phone-typecheck.log`. No full phone suite or web smoke run for the test-only phone edit.
- Synthetic first-section actual230W vs target250W: elapsed217.391s; targets `[250,250,250,270]`; estimate802.576s against800s goal, within3s deadband. Artifact `/tmp/gritmap-replanner-synthetic-replay.txt`.
- Visually inspected `/tmp/gritmap-replan-estimate.png`, `/tmp/gritmap-replan-limited.png`, `/tmp/gritmap-replan-compact.png`: estimates/limit labels fit.
- `git diff --check` and staged checks clean. Initial development compile errors and a migration-fixture missing-index-list assumption were fixed; final checks above passed.

## External state

- Installed Karoo remains `0.10.44-fields1` / code70, with data preserved from previous install. No ADB/device operations this milestone.
- c9da364/c26e024 push confirmed. Replanner/handoff push follows this record; final tool output confirms it. Next device/public build requires code >=71.
- No models/libraries downloaded or redistributed, and no private ride data committed.

## Goal alignment

GOALS priorities7/8; deterministic live execution stays authoritative, phone authors plans. Optional ceilings contract now accepted in source, with a shared fixture passing on both sides. **Installed code70 still rejects the extension. Phone must not send metadata until a compatible receiver is deployed and rollout/capability gating exists.**

## Hazards and blockers

- This is a first default-off development implementation, not a completed production rollout. Distance-proportional time anchors and normalized power response are estimates, not calibrated best-finish physics or a global optimum. Optimizer bounded to8192 candidates/128 sections/24h; zero-target plans not adapted.
- No private Diablo PR replay, physical pacing replay, outdoor readability, cardiac stability or H10 continuity test this milestone. Full estimated energy at attempt start cannot account for pre-segment fatigue; ride-level budgeting remains pending. Conflicting fixed-past step/energy limits withhold adjustment and retain baseline with REPLAN LIMITED.
- PR ownership/replacement/splits contract, `segmentRecord` import/storage/display remain unfinished; concurrent runtime stays off. H10 recordings list/export and October18 separate RR artifact confirmation remain unfinished. Preserve device data; never uninstall/clear-data to inspect it.
- Needle remains non-operational. Official Needle2 ARM64 packaging/API differs from the existing Cactus bridge. Read readiness note before selecting/pinning artifacts. Optional bounded cue/tool selection is the closest supported fit; sustainable-power/fade inference is not validated. ABI, digests/licences, packaging, inference deadlines, device latency/RAM/battery and advisory validation remain work. No need for Needle to block deterministic development.

## Next safe action

Coordinate compatible receiver rollout/capability gating before enabling phone metadata; benchmark a code>=71 development build on the Karoo with both flags explicitly selected only for validation. Keep defaults off. Finish PR contract/import/display and H10 export as separate milestones; real-ride validation remains required before promoting replanning.
