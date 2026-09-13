# Handoff: Larger simplified Power Balance built; Karoo disconnected before install

- Updated: `2026-08-25 22:00 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a74752d docs: hand off advanced review + comparison screens (#11, #13)`
- Worktree: substantial uncommitted work remains under `apps/karoo/`; preserve it.

## Outcome

The large Power Balance hierarchy is simplified again: its primary external metric is now only `N% ABOVE PLAN`, `N% BELOW PLAN`, or `ON PLAN`. Duplicate comparison/status text inside the bitmap is removed. PLAN/RIDE nodes and the battery are larger, `W′ N%` is larger, and the amber `PLAN N%` label directly follows its moving marker without a fixed leader elbow. The build is tested but not installed because Karoo disconnected.

## Changed

- Added tested `reserveComparisonHeadline(actualPct, plannedPct)` with rounded comparisons and missing-plan fallback.
- Replaced projected finish as the large field's main metric with current reserve relative to plan.
- Removed the internal `YOU / PLAN / ±%` row and duplicate reserve-status sentence.
- Enlarged nodes, labels, battery width/height, chevrons, and battery percentage text.
- Amber `PLAN N%` text is positioned directly above its amber marker line and moves with it.
- Retained stable amber PLAN identity, blue RIDE/YOU identity, active-route illumination, top REST/HOLD/PUSH banner, and compact signed-rate footer.

## Verified

- Focused `CombinedDataTypesTest` and `WPrimeBalanceBitmapRendererTest` plus debug APK assembly: `BUILD SUCCESSFUL in 45s`.
- New headline tests cover below, above, on-plan, and missing-plan cases.

## External state

- Install attempt failed with `adb: no devices/emulators found`; this exact revision is not on Karoo.
- APK is ready at `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- Last confirmed installed version remains 0.8.2/versionCode 13 from `2026-08-25 14:24:38`.

## Hazards and blockers

- Device-scale verification is pending.
- Matcher real-route rejection risk remains documented in prior combined handoffs.
- Preserve unrelated and pre-existing uncommitted work.

## Next safe action

Reconnect/authorize Karoo, install the existing debug APK without rebuilding, and review the new primary metric and enlarged battery at device scale.
