# Handoff: predicted finish time for imported plans (phone app, uncommitted)

- Updated: `2026-10-06`
- Agent: `Claude`
- Branch: `main`
- Head: `aa6fe94 feat: plan vs actual per zone for a segment effort` (local, unpushed at the time of writing) -- **the work below is uncommitted**
- Worktree: Codex's `apps/karoo/`, `ios/`, `src/diagnostics/`, other archives and `LATEST.md` edits untouched.

## Why

Rider request: "when a new plan is imported there should be a predicted completion time given with the goal."
A coach plan has watts but no time, and the Karoo showed the Realize segment's "Goal" as "Fastest sustainable"
(its `targetFinishTimeSeconds` was null; `LivePacingGuidanceEngine` falls back to a default planned finish).

## Outcome

- **Import preview** (`ImportCoachPlanScreen`) and **segment screen** (imported-plan section) show
  "Predicted finish about mm:ss", where it comes from (estimate vs calibrated to the last N efforts), the
  comparison with the rider's goal for that segment ("Your goal is 39:00: this plan is predicted 1:12 slower"),
  and the plan's own target when it had one.
- **Karoo:** a coach plan with no target time is now sent with the predicted finish as
  `targetFinishTimeSeconds` (the wire field already existed and the Karoo parser already accepts it), so the
  Karoo's Goal and pacer have a time. A plan that states its own target keeps it. The phone's goal is not touched.
- Needs the rider's weight and a route with elevation; otherwise nothing is shown or sent, with a link to set weight.

## How (src/pacing)

- `predictFinishTime.ts`: steady-state power equation (gravity, rolling, drag), 50 m steps, 100 m grade window,
  speed cap 16 m/s, bisection solver. `predictPlanFinish.ts` + `loadCalibrationAttempts.ts`: calibrates against the
  last three accepted efforts (model run on the power actually held; median factor, 0.8-1.3 band).
- `src/screens/describePlanPrediction.ts`: the wording.
- Constants and evidence are documented in `docs/COACH_PLAN_CONTRACT.md` ("Predicted finish time").

## Verified

- `npm run typecheck` clean; `npm test` **471/471** (was 445); `npm run web:smoke` clean. New: 12 physics, 6
  calibration, 4 wording tests; one cross-checks the generator (39:00 Diablo plan predicts within 3% of 39:00).
- **Real data (2026-09-13 Diablo effort, 92.5 kg):** the uncalibrated model on the power held gives 42:43 for a
  45:45 ride (about 7% optimistic). The generated 39:00 plan models to 39:05 uncalibrated but **41:52 calibrated** --
  i.e. on that evidence the 284 W / 39:00 plan is more likely a ~42:00 plan for this rider.
- **Not live-checked on a device.** Not tested: a Karoo import of a plan whose target came from the prediction
  (the field is the same one the generator already sends).

## Hazards and blockers

- The uncalibrated figure is optimistic by ~7% on the one effort available; treat it as a guide until the rider has
  an effort on the segment. Realize has none yet, so its first prediction is an estimate.
- Weight is the phone profile's value; if it is stale the prediction is too.
- The predicted time is stored nowhere: it is recomputed on each view and at send time (so it moves with weight
  and with new efforts).

## Next safe action

Reload the phone app, set weight if needed, open Realize -> its coach plan: confirm "Predicted finish" appears
with the goal comparison, then resend and check the Karoo's Realize "Goal" now shows a time. After tomorrow's
ride and FIT import, the Realize prediction becomes calibrated.

## For Codex

Nothing required. FYI the Karoo's segment "Goal" for coach plans will now be a predicted time rather than
"Fastest sustainable"; the pacer / `LivePacingGuidanceEngine` will use it as the target finish.
