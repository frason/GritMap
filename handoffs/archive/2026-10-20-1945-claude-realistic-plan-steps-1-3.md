# Handoff: realistic quarter-mile targets, phone side (GOALS priority 8, Steps 1 to 3)

- Updated: `2026-10-20 19:45 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `05f2d83 fix: call a goal out of reach when the predicted finish is well over it, even if the power adds up`
- Worktree: Codex's uncommitted Karoo/doc/handoff files only; my work is committed locally (3 commits ahead of origin/main, not pushed)

## Outcome

GritMap's generated pacing plan is now realistic: no target above what the rider has held in that quarter-mile, an energy-budget (W')
guard as the primary check, a limit on the step between targets, and trimmed effort moved to later, easier sections. If the goal is out of
reach the segment screen says so, with the best achievable finish and the gap. The Wi-Fi send, the Bluetooth send and the segment screen
all use the same generator. **Nothing about ceilings is sent to the Karoo yet** (the Karoo parser is exact-key strict); the Karoo sees only
the changed per-section targets in the existing `baselinePacingPlan` shape. Imported coach/rider plans are never rewritten.

## Step 1 (reproduction, local print only, no ride data committed)

Real Diablo attempts in `fixtures/fit` (git-ignored): only two: 2026-07-18 09:08 (45:19) and 2026-09-13 06:47 (45:45). Jason's six
newer files are not Diablo (short 2 to 12 minute rides near 37.891,-122.128, no power). The 41:40 PR and the other recent Diablo efforts are NOT available;
the simulator's three rides are synthetic "Demo ride" files. Plan: FTP 250 W, goal 40:00 (assumed; real values not confirmed).
- 10 of 26 quarter-miles planned above the best ever held: worst qm19 (7.6%) +21 W, qm3 (descent) +16, qm13 (8.5%) +16, qm21 +15, qm24 +10.
- Calibrated on the two efforts, even the raw plan is predicted to finish in 45:06, not 40:00: a 40:00 goal at FTP 250 is out of reach on this evidence.
- Realistic plan on the same history: trims 13 quarter-miles, raises 7 (up to ~25 W), holds qm18 to 26 at critical power because W' runs down; predicted 46:01.
- Leave-one-out: ceilings from the other ride were exceeded by the fastest ride in 3 zones (up to 11 W): +4% margin is tight with a single prior effort.
Rerun the scratch comparison when the real PR ride is in `fixtures/fit` (script is in the session scratch directory; easy to recreate from `generateRealisticPlan`).

## Changed (`b9644b2`, `9bd9275`, `05f2d83`)

- `src/pacing/planCeilings.ts`: `computeZoneCeilings` (best held x1.04 where held >= 70% FTP, else a fallback relative to the goal's anchor power, 1.10 to 1.04),
  `summarizeZoneHistory`, `findTargetsAboveCeilings`, config `DEFAULT_PLAN_CEILING_CONFIG`.
- `src/pacing/realisticPlan.ts`: `buildRealisticPlan`: ceilings, W' guard (ASSUMPTION: CP = FTP, W' 80 J per FTP watt, 15% reserve), 20 W step limit between
  climbing zones, hard 80 W cap between any adjacent zones (Karoo rejects 100 W), redistribution forward within limits, feasibility (2% tolerance), best-achievable result. Configurable.
- `src/pacing/generateRealisticPlan.ts` (single generator), `loadPlanHistory.ts`, `buildTargetPowerZones.ts` (`retargetZone`).
- Wiring: `src/karoo/buildTransferParts.ts` (`planHistory` option, `generator.modelVersion` "pacing-anchor-grade-realistic-v1"), `sendGuidancePackageToKaroo.ts`,
  `src/transfer/directTransfer.ts` + `BleSendSection.tsx`, `resolveSegmentPlan.ts` + `PlanVsActualScreen.tsx`, `SegmentDetailScreen.tsx` (plan and notice).
- Wording `src/screens/describePlanFeasibility.ts`: out of reach when power is short OR the predicted finish is more than 2% (min 15 s) over goal;
  "Some targets were held back" when trimmed but the goal still holds; silent otherwise.
- `docs/PLAN_CEILINGS_CONTRACT.md` (draft for Codex: optional per-zone `ceilingPowerWatts` + plan-level `replan` constants, same rule as `segmentRecord`: not sent
  until the Karoo parser accepts them and the fixture passes both sides) and the synthetic shared fixture `docs/fixtures/plan-ceilings-synthetic.json` (+ test keeping it equal to the planner).
- Screenshot on synthetic demo data: `docs/screenshots/realistic-plan/out-of-reach-notice-demo-data.png`.

## Verified

- `npx tsc --noEmit` clean; `npm test` 691/691; `npm run web:smoke` clean (earlier in this milestone; re-run after the last wording change: tests only).
- Unsigned Release simulator build (iPhone 17 Pro): the segment screen shows the plan card with the new notice on the demo data ("about 42:02, 2:02 slower").
- Not run: a physical iPhone; the Karoo (the wire shape is unchanged, but the changed per-section targets have not been through the Karoo importer on a device);
  the real PR ride; Jason's real FTP, weight and goal.

## External state

- Nothing installed on a physical device; nothing pushed. No ride data or credentials committed (fixtures are synthetic).

## Goal alignment

- GOALS priority 8: plans never target above what the rider has sustained; the phone owns the plan and the ceilings. The Karoo replanner and Needle are Codex's (Steps 4 and 5).
- Shared contract touched: none on the wire. New draft contract `docs/PLAN_CEILINGS_CONTRACT.md`; Codex must accept the optional fields before the phone sends them.

## Hazards and blockers

- W' and critical power are assumptions, not measurements; a 40:00 goal at FTP 250 is flagged out of reach with the current data.
- The notice appears for any rider whose predicted finish is more than 2% over their goal, including those with no history (prediction then uses the estimate, not a calibration).
- `targetFinishTimeSeconds` is still the rider's goal even when it is out of reach (open question for the coordinator).
- With one prior effort, a +4% ceiling margin is tight (`historyMarginPct`).
- `docs/PRIVACY.md` unaffected (all local).

## Next safe action

Coordinator/Jason: provide the real PR ride FIT and the real FTP, weight and goal so I can rerun Step 1 and tune the constants. Codex: read
`docs/PLAN_CEILINGS_CONTRACT.md` and the fixture, accept the optional fields, then build the live replanner.
