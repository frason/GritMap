# Handoff: Power Balance actual-size layout correction

- Updated: `2026-09-29 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `85026b2 docs: hand off post-MVP backlog cleared (#60-#63)`
- Worktree: shared dirty worktree; this increment changed graphical-field sizing contracts, Power Balance rendering/tests, app version, and handoffs while preserving unrelated edits

## Outcome

GritMap Karoo 0.10.10/code33 is installed. GM Power Balance now renders against the actual
Karoo field aspect rather than appearing as a small centered island with large empty bands.

## Changed

- `StateGraphicDataType` passes `ViewConfig.viewSize` to graphical renderers.
- Large GM Power Balance uses actual width/height and receives full `LiveUiState`.
- Added `GM POWER BALANCE` and segment progress header.
- Rescaled banner, comparison headline, nodes, battery, status, rate cards, and finish footer
  for a 480x624 physical field.
- Replaced segment-count chevron placement with distance-based 48px spacing across paths.
- Renderer regression output now uses 480x624.
- Bumped version to 0.10.10/code33.

## Verified

- Focused `WPrimeBalanceBitmapRendererTest` and `CombinedDataTypesTest`: passed.
- Inspected actual-aspect `app/build/reports/power-balance-preview/large.png`.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.10/code33.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.
- Actual `ViewConfig.viewSize` can differ slightly from the 480x624 regression fixture; the
  renderer is fractional, but a physical screenshot remains the decisive check.

## Next safe action

Start the demo and capture GM Power Balance full-page. Compare its occupied bounds and type
scale to the 480x624 regression before making any detail-level changes.
