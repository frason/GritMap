# Handoff: Backward chevron animation fixed and installed

- Updated: `2026-08-24 20:48 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted work remains; this increment adds an independent W′ animation phase and updates engine/preview/renderer tests.

## Outcome

Power Balance chevrons no longer move backward when W′ reserve decreases. Chevron orientation and route still come from the energy-flow state, while their frame position now comes from a separate monotonically advancing animation phase.

## Changed

- Added `WPrimeState.flowAnimationPhase`, explicitly independent of reserve level and direction.
- `WPrimeEngine` advances the phase on every telemetry update.
- Preview state derives a forward-cycling phase from demo progression.
- `WPrimeBalanceBitmapRenderer` no longer derives chevron phase from `actualRemainingPct`.
- Added a W′ engine assertion covering animation-phase advancement.

## Verified

- Focused W′ engine/renderer tests plus debug APK assembly: `BUILD SUCCESSFUL in 1m 16s`.

## External state

- Installed the debug APK on Karoo `00442GA241760203`; adb reported `Success`.
- Package manager confirms `versionName=0.8.2`, `versionCode=13`, and `lastUpdateTime=2026-08-24 20:48:44`.

## Hazards and blockers

- Chevrons still advance in 1 Hz RemoteViews steps rather than continuous animation.
- A route-state transition deliberately changes the path and can visually jump; within one state, phase is forward-only.
- CP/W′/tau remain estimates pending phone-supplied calibration.
- Preserve unrelated and pre-existing uncommitted work.

## Next safe action

Watch one complete Power Balance preview cycle and verify that chevrons advance consistently along each active route, especially while the battery percentage is falling.
