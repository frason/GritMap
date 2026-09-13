# Handoff: Two-path W′ energy-flow layout installed on Karoo

- Updated: `2026-08-24 17:13 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted work remains; this increment changes W′ state classification, the Power Balance large renderer/text, and focused state tests.

## Outcome

The large Power Balance field now separates current ride power from anaerobic-reserve exchange. An upper `YOU → RIDE` line represents direct power delivered to the ride. A second lower path places the battery, rider, and ride on one energy-exchange line. Animated-position flow circles move from battery only as far as the rider while overextended, and from the ride all the way back toward the battery while underextended/recovering. The battery is larger, its current percentage no longer collides with the plan marker, and the plan level has an explicit `PLAN N%` label.

## Changed

- `WPrimeState.energyFlowStatus` classifies `DRAINING TOO FAST`, `BURNING · PLAN RECOVERY`, `CONTROLLED BURN`, `RECOVERING`, `RECOVERING TOO SLOW`, and `ON ENERGY PLAN`.
- `WPrimeBalanceBitmapRenderer.renderTrajectory` now draws two distinct paths, larger reserve storage, directional exchange circles/arrow, explicit plan level, and a state-colored status.
- The large field no longer uses the generic overlapping `TOO FAST` annotation.
- RemoteViews rate text preserves sign semantics: `ACTUAL: USING/RECOVERING` and `PLAN: USING/RECOVERING`.
- `LiveUiStateTest` covers burning during planned recovery, excessive drain, and recovery slower than plan.

## Verified

- Focused `LiveUiStateTest` and `WPrimeBalanceBitmapRendererTest`: `BUILD SUCCESSFUL in 3m 19s`.
- Debug APK assembly: `BUILD SUCCESSFUL in 2m 59s`.
- Final focused renderer test plus APK assembly after constraining the overextension path to battery → rider: `BUILD SUCCESSFUL in 12m 10s`.

## External state

- Installed `apps/karoo/app/build/outputs/apk/debug/app-debug.apk` on connected Karoo `00442GA241760203`; adb reported `Success`.
- Package manager confirms `versionName=0.8.2`, `versionCode=13`, and `lastUpdateTime=2026-08-24 17:12:34`.

## Hazards and blockers

- Version remains 0.8.2 because this is a visual iteration of the same uncommitted W′ milestone; package time distinguishes the installed build.
- RemoteViews updates provide stepped motion rather than continuous animation; circle positions advance whenever Karoo requests/emits a new frame.
- Physical review is still required for label scale, path comprehension, light/dark contrast, and whether five flow circles feel too busy.
- CP=95% FTP, W′=20 kJ, and tau=546 s remain estimates pending phone-supplied calibration.
- Preserve unrelated and pre-existing uncommitted work.

## Next safe action

Open or re-add the large Power Balance field in Karoo's page editor and capture one preview phase where the plan expects recovery and one where actual effort is below plan; confirm the flow-circle direction reads correctly in both states.
