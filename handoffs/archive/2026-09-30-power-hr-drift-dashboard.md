# Handoff: Power/HR Drift dashboard

- Updated: `2026-09-30 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `0788207 feat: historical trend/band comparison view (#68)`
- Worktree: shared dirty worktree; this increment changed Karoo telemetry/state, the
  cardiac-drift tracker and renderer, layouts, tests, app version, and handoffs while
  preserving unrelated edits

## Outcome

GritMap Karoo 0.10.15/code38 is built and ready. The large Cardiac Drift field is now a
Power/HR Drift dashboard grounded in live efficiency rather than an unexplained sparkline.

## Changed

- Tracker now emits rolling W/bpm efficiency, drift rate per 10 minutes, valid duration,
  paired-sample percentage, power steadiness, and normalized Power/HR indices.
- Baseline remains established after three minutes using paired two-minute rolling data.
- Added a dedicated full-field 480x624 dashboard while preserving compact layouts.
- Added recommendation + drift banner, Drift/Rate/Efficiency cards, normalized Power and HR
  chart, shaded divergence, three-minute baseline marker, amber 5% line, time axis, and
  confidence footer.
- Efficiency uses neutral blue rather than amber to avoid implying a universal threshold.
- Added a native-graphics visual regression that rejects blank output.
- Bumped the app to 0.10.15/code38.

## Verified

- Focused `CardiacDriftTrackerTest` and `CardiacDriftBitmapRendererTest`: passed.
- Inspected the nonblank 480x624 dashboard preview.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- APK is built at `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- Karoo `00442GA241760203` subsequently reconnected; replacement install succeeded and the
  package reports 0.10.15/code38.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.
- Physical Karoo rendering has not yet been inspected.

## Next safe action

Inspect the large GM Cardiac Drift field in preview mode before tuning any typography or
spacing.
