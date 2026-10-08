# Handoff: Android background-service startup replaced with binding

- Updated: `2026-10-06 09:45 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `e8be5b4 docs: next-ride test checklist and follow-up review of the H10 work`
- Worktree: extensive shared uncommitted Karoo, phone, physiology, UI and documentation changes

## Outcome

The offline 0.10.41 candidate no longer depends on a visible GritMap data field or map layer to
recover from Android 12 rejecting the extension's background `startService()` call. Because Karoo
already binds the extension, the extension now uses `BIND_AUTO_CREATE` to keep the local tracking
service alive. The tracking service initializes Karoo ride-state observation from `onBind` as well
as from legacy start commands.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/GritMapKarooExtension.kt`
  binds `LiveSegmentService` during extension creation, records binding lifecycle diagnostics, and
  safely unbinds during extension destruction.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/service/LiveSegmentService.kt` now returns a local
  binder and idempotently starts Karoo observation from either binding or a start command.
- Added `apps/karoo/app/src/test/java/com/gritmap/karoo/service/LiveSegmentServiceBindingTest.kt`.

## Verified

- New Robolectric binding regression test: passed.
- Focused `com.gritmap.karoo.service.*` suite: 19 tests, 0 failures/errors/skips.
- `:app:compileDebugKotlin :app:lintDebug`: passed.
- `:app:assembleDebug`: passed.
- APK SHA-256: `8c5b2498877cd1bd2da114cec223f6cfdf30028562e6f197e58f58a43fea7b37`.
- A broader service plus `karoo.*` test selection reached the known unrelated
  `KarooPreviewStateTest > preview traverses recover hold and push zones` failure: 52 tests, one
  failure. The service-only selection passed and the preview implementation was not changed here.
- Repository-wide `git diff --check` currently reports trailing blank lines in Claude-owned
  `src/pacing/resolveSegmentPlan.test.ts` and `src/screens/describePlanPrediction.test.ts`; this
  milestone did not edit those files.

## External state

- No APK was installed. The Karoo remains on 0.10.40/code63 for the planned-segment physical test.

## Hazards and blockers

- The binding lifecycle has Robolectric coverage but has not yet been physically observed on Karoo.
- The binding lasts only while Karoo keeps the extension service bound. That is the correct SDK
  ownership boundary, but the device log should confirm `service_bind_requested`, `service_bound`,
  `karoo_observation_requested origin=bound`, and `karoo_connected` after installation.
- Existing visible-view/map `startService()` calls remain as compatibility fallbacks; the extension
  creation path itself no longer uses the prohibited background start.

## Next safe action

Keep 0.10.40 for one planned-segment ride. After that evidence is preserved, install 0.10.41 and
confirm the four binding events before testing schema-2 RR/dropout behavior.
