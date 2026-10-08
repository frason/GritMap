# Handoff: native Karoo map pacer installed

- Updated: `2026-10-02 12:25 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: interleaved uncommitted Karoo and phone changes; do not bulk-commit or revert.

## Outcome

GritMap now declares a Karoo native map layer. During an active deterministic segment match it
draws the segment reference route as a blue polyline and a custom bullseye pacer symbol at the
latitude/longitude interpolated from `targetProgressMeters`. The same stable symbol ID is updated
rather than accumulating markers. Both symbol and route are removed when state becomes idle,
uncertain, complete, or abandoned.

## Changed

- Added `karoo/PacerMapLayer.kt` with pure state-to-map-effect logic, route interpolation, and
  precision-5 Google polyline encoding.
- Added `gm_map_pacer.xml` custom map symbol.
- Implemented `startMap()` in `GritMapKarooExtension.kt` using `LiveUiStore`.
- Enabled `mapLayer="true"` in `karoo_extension_info.xml`.
- Added `PacerMapLayerTest.kt`; bumped Android app to `0.10.35`, code `58`.

## Verified

- Focused map-layer and Pacing Coach tests plus `:app:assembleDebug` passed (72 tasks).
- Tests cover interpolation, stable update identity, route-only-on-change behavior, cleanup,
  and the canonical Google encoded-polyline example.

## External state

- Installed successfully on Karoo `00442GA241760203`; app data preserved.
- Because extension capabilities changed, Karoo may require toggling the extension off/on once
  before invoking `startMap()`.

## Hazards and blockers

- Physical native-map rendering has not yet been visually confirmed.
- Pacer position is the existing distance-proportional target fallback until phone plans carry
  explicit time anchors.

## Next safe action

Toggle the GritMap extension off/on if necessary, start the demo, open Karoo's native map, and
confirm the blue route plus bullseye pacer marker appear and move.
