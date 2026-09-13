# Handoff: W′ battery-and-flow Power Balance installed

- Updated: `2026-08-24 16:19 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted work remains; this increment extends W′ rate state and replaces trajectory/tank visuals inside `WPrimeBalanceBitmapRenderer.kt` plus related preview/text/tests.

## Outcome

Power Balance now uses a battery-and-energy-flow metaphor. The battery visibly empties/recharges from estimated live W′ balance, includes the plan-expected level marker, reports actual and planned balance-change rates, and independently warns when reserve is draining too quickly relative to plan. The verified APK is installed on the connected Karoo.

## Changed

- `WPrimeState` now includes actual and planned balance change in J/s and a deterministic `depletingTooFast` classification.
- Actual depletion rate above CP is `-(power − CP)` J/s. Recovery below CP is `(capacity − balance) / tau` J/s.
- `TOO FAST` requires active depletion exceeding planned drain by `max(10 J/s, 20% of planned-rate magnitude)`; low reserve alone does not trigger it.
- Compact view retains a reserve battery gauge with planned marker.
- Medium/narrow view uses one large battery, plan-level line, directional flow arrows, and rate text.
- Large view now shows:
  - `YOU` and `RIDE` nodes connected by the current ride-power stream;
  - a central vertical battery that visibly empties/recharges;
  - plan-expected reserve line inside the battery;
  - directional arrows between the battery and ride stream;
  - arrow density and connector thickness scaled by rate;
  - red battery outline and `TOO FAST` warning when excessive depletion is detected.
- RemoteViews text reports `USING N J/s` or `RECOVERING +N J/s`, planned rate, too-fast state, current reserve, and projected finish reserve.
- Preview rates are derived from its changing power and estimated CP, so it cycles between depletion/recovery and planned/excessive drain.

## Verified

- Narrowed Kotlin compilation after an initially slow build: `BUILD SUCCESSFUL in 3m 1s`.
- Focused W′ engine/renderer/live metrics/preview tests plus APK assembly: `BUILD SUCCESSFUL in 1m 40s`.
- Complete `:app:testDebugUnitTest`: `BUILD SUCCESSFUL in 1m 16s`.

## External state

- Installed `apps/karoo/app/build/outputs/apk/debug/app-debug.apk` on connected Karoo `00442GA241760203`; adb result `Success`.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- CP=95% FTP, W′=20 kJ, and tau=546 s remain explicit estimates pending phone-supplied calibration.
- The battery is a capacity metaphor; recovery represents modeled physiological reconstitution, not mechanical energy returned by the rider.
- W′ still resets at segment entry and is not checkpointed.
- Physical review must confirm arrows, labels, light/dark contrast, and whether rate-scaled motion is understandable at Karoo size.
- Preserve unrelated and pre-existing uncommitted work.

## Next safe action

Open Power Balance in the large Karoo preview first and capture both a `TOO FAST` depletion phase and a `RECOVERING` phase; then inspect medium and compact battery legibility.
