# Handoff: Estimated W′ Power Balance review build installed

- Updated: `2026-08-24 15:43 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted work remains; this increment adds W′ engine/state/rendering/tests and modifies live metrics, preview, Power Balance binding/layout.

## Outcome

Power Balance now combines immediate power deviation with an estimated anaerobic-engine reserve. The responsive family is implemented: compact reserve gauge, plan-versus-actual tanks for medium shapes, and a large dual reserve trajectory showing actual history, planned history, current gap, planned finish, and projected actual finish. The tested APK is installed on the connected Karoo for visual review.

## Changed

- Added `WPrimeEngine.kt` with deterministic depletion above CP, exponential recovery below CP, 0-5 second live-update clamping, plan-at-progress simulation, planned finish reserve, and projected actual finish reserve.
- Added a phone-replaceable `WPrimeState`/`WPrimePoint` UI contract containing CP, capacity, actual/planned/projected balances, estimate provenance, and bounded history.
- `ActiveAttemptSession` owns the W′ engine and a maximum 240 distance-progress samples; ordinary telemetry still does not write W′ to Room.
- Current estimates: CP = 95% FTP, W′ capacity = 20,000 J, recovery tau = 546 seconds. UI explicitly labels this `EST.`.
- Added `WPrimeBalanceBitmapRenderer.kt`:
  - small/small-wide: colored reserve gauge, actual level, planned marker;
  - medium/medium-wide/narrow: side-by-side planned and actual tanks;
  - large: planned dashed trajectory, actual solid trajectory, current gap, and dashed finish projection.
- Power Balance text now includes W′ %, kJ, signed percent-vs-plan, projected finish reserve, signed watt delta, and power trend as space permits.
- Animated Karoo preview now supplies changing estimated W′ plan/actual history.
- Added focused W′ engine, live-integration, and renderer tests.

## Verified

- Focused W′ engine/renderer/live metrics/combined field/preview suites plus APK assembly: `BUILD SUCCESSFUL in 53s`.
- Complete `:app:testDebugUnitTest`: `BUILD SUCCESSFUL in 34s`.

## External state

- Connected Karoo: `00442GA241760203` (`k24`).
- Installed `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`; adb result `Success`.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- CP, W′ capacity, and recovery tau are estimates, not individualized physiology; do not use them for aggressive AI adaptation yet.
- Phone transfer does not yet supply authoritative W′ parameters. The UI/state contract is ready, but import/transport wiring remains future work.
- W′ resets at segment/session entry and is not yet included in recovery checkpoints.
- The large trajectory needs physical Karoo review for labels, scale comprehension, and light/dark legibility.
- Preserve unrelated and pre-existing uncommitted work.

## Next safe action

Open Power Balance in small, short-wide, medium, and large Karoo preview shapes. Review the large dual trajectory first, then decide whether the visual needs axis labels, a stronger planned/actual legend, or different reserve thresholds.
