# Handoff: realistic plan, evidenced floors, history-informed critical power, PR-relative notice

- Updated: `2026-10-20 22:25 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `c5d0d51 feat: evidenced floors, history-informed critical power, forward-only redistribution, PR-relative wording`
- Worktree: Codex's uncommitted Karoo/doc/handoff files only; my work committed locally, not pushed

## Outcome

Follow-up to `handoffs/archive/2026-10-20-1945-claude-realistic-plan-steps-1-3.md`, as approved by the coordinator and Jason:
1. **Evidenced floor.** If a past effort is faster than the plan's predicted finish and the goal is at least as ambitious as that effort (goal <= effort x 1.02), the plan
   never targets below the power that effort held in a zone. Default is the whole profile (`evidencedFloorFromFraction` 0), not only the late half: with 0.5 the floors did not bind
   and the plan was still predicted slower than the rider's best because early power sat below that effort's hot start. Floors beat the W' guard and still respect the hard 80 W cap.
2. **History-informed critical power.** Past 20 to 90 minute efforts may raise the CP used by the W' guard (CP >= mean power - W'/duration), capped at +15% of FTP, never below the FTP-based value;
   labelled `criticalPowerSource: "ftp" | "history"` (assumption, configurable).
3. **Redistribution is forward-only** (fixed a flaw: effort trimmed late could flow back into early zones). Lost effort is reported as shortfall.
4. **Notice.** Hidden until the rider has saved their own FTP (`app_settings` `ftp_confirmed_at_ms`, set by the Profile save and first-run); decided by the predicted finish when known
   (out of reach only if predicted > goal + max(15 s, 2%)); worded against the rider's best effort ("a stretch ... but your best is within reach" when the plan beats it).
Untouched on purpose: W' reserve 15%, `historyMarginPct` 4%, `targetFinishTimeSeconds` (still the rider's goal; best-achievable goes to the Karoo only after the contract work).

## Changed (`c5d0d51`)

`src/pacing/planCeilings.ts` (`summarizeEfforts`), `realisticPlan.ts` (CP from efforts, `evidencedFloorWatts`, forward-only redistribution, `floorZoneIndices`),
`generateRealisticPlan.ts` (reference effort selection, `finish`, `referenceEffort`), `src/screens/describePlanFeasibility.ts`, `src/db/ftpConfirmation.ts`,
`SegmentDetailScreen.tsx`, `ZonesSettingsScreen.tsx`, `OnboardingFlow.tsx`, `docs/PLAN_CEILINGS_CONTRACT.md`, `docs/fixtures/plan-ceilings-synthetic.json` (regenerated).

## Verified

- `npx tsc --noEmit` clean; `npm test` 707/707; `npm run web:smoke` clean. New tests cover floors, CP from history, forward-only redistribution, reference-effort selection, the feasibility wording and the FTP flag.
- Local reproduction with Jason's real FTP/weight/goals (values are NOT committed anywhere; scratch only): the realistic plan is predicted 41:17 for either goal (the PR is 41:27), W' does not bind at the real FTP,
  goal 39:00 is out of reach for now, goal = the PR time is reachable. Details were sent to the coordinator.
- Not run: simulator/device after these UI changes (the notice now needs a saved FTP, so the demo screenshot no longer shows it until Profile is saved); the Karoo (wire shape unchanged).

## External state

- Nothing installed, pushed or published. No ride data or personal values committed.

## Goal alignment

- GOALS priority 8 (realistic plan targets; phone owns plan and ceilings). No wire change. `docs/PLAN_CEILINGS_CONTRACT.md` updated; Codex's Karoo replanner and Needle work still depend on it.

## Hazards and blockers

- Whole-profile floors make the plan at least as hard as the reference effort in every zone: it can be harder than the reference effort's pacing late (higher mean). The rider's PR proves the profile, not that more is sustainable.
- The goal's power still comes from the power-duration table (283 W vs 284 W for 41:27 vs 39:00 at the real FTP): different goals give almost the same plan. Proposed fix: derive required power from the goal time with the physics model (staged-goal work).
- Riders who saved an FTP before this change will not see the out-of-reach notice until they save the Profile again.

## Next safe action

Coordinator decisions pending: whole-profile vs late-only floors, the staged-goal build (next goal = beat PR, long-term goal), and the physics-derived anchor. Codex: the contract and fixture are ready for the optional-field parser.
