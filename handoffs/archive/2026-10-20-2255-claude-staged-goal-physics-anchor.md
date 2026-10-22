# Handoff: staged goal (next + long-term) and a goal-time-derived plan power

- Updated: `2026-10-20 22:55 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `e3d12ff feat: loadCalibrationAttempts can supply the weight at each effort; staged goal screenshot`
- Worktree: Codex's uncommitted Karoo/doc/handoff files only; my work committed locally, not pushed

## Outcome

Approved by Jason via the coordinator:
1. **Staged goal.** `active_goal` gets a nullable `long_term_duration_ms` (migration 14, one column; a single goal is unchanged). The goal in `target_duration_ms` is the **next goal**: plans, the Wi-Fi and Bluetooth sends, the
   notice and Plan vs Actual all use it. The long-term goal only drives a progress line ("2:27 to go to your 38:00 goal. Your best is 40:27.") and, when the best effort reaches the next goal, a note and a one-tap
   "Set my next goal to ..." button. The goal editor offers "Beat my best of X (Y)" (about 1% faster, rounded down to 5 s) and optional long-term fields (only when the rider has an effort here or already has a long-term goal);
   a fresh install with no history sees the single-goal editor exactly as before.
2. **Plan power from the goal time.** When the rider's weight and the route's elevation are known, the plan's average power is solved from the goal time with the physics model (`solveAnchorForGoal`), calibrated on the
   rider's own efforts (newest 3), replacing the power-duration table (the table is the fallback and is unchanged). The anchor is held within 0.7 to 1.3 x FTP (`anchorLimited` flags it).
3. **FTP is never asked for twice.** The earlier `ftp_confirmed_at_ms` flag is removed: any install with a profile FTP gets the plan and the notice; only installs without an FTP are asked, as before.
4. **Weight at each effort.** `CalibrationAttempt.riderWeightKg` and `loadCalibrationAttempts(..., weightAt?)` are in place: calibration runs each effort at the weight the rider had that day when it is known. No weight history is stored yet (see below).

## Changed (`cdf7648`, `e3d12ff`)

`src/db/migrations.ts` (v14) + tests, `getActiveGoal.ts` / `setActiveGoal.ts` (+ tests: keeps long-term on re-save, clears when the goal moves segment, null removes), `src/screens/describeStagedGoal.ts`
(+ tests), `SegmentDetailScreen.tsx`, `src/pacing/solveAnchorForGoal.ts` (+ tests), `generateRealisticPlan.ts` (`anchorSource`, `anchorLimited`), `predictPlanFinish.ts` (`calibrateModel`, per-effort weight),
`loadCalibrationAttempts.ts`; removed `src/db/ftpConfirmation.ts`. (The simulator screenshot of the staged goal was left out of the push because it shows the rider's own goal value.)

## Verified

- `npx tsc --noEmit` clean; `npm test` 730/730; `npm run web:smoke` clean.
- Release simulator build on the existing demo database (migration 14 applied to a v13 database): goal editor shows "Beat my best of 41:56 (41:30)" and long-term fields; saving 41:30 next plus a long-term goal shows
  "Next goal 41:30", "2:56 to go to your long-term goal. Your best is 41:56.", and the plan at 249 W (99% of FTP).
- Local reproduction with Jason's real values (kept out of the repo): the physics anchors differ strongly by goal (the anchor power differs by about 15 to 20 W between a long-term goal and a next goal a couple of minutes slower), but the **realistic** plans for
  the long-term goal and the next goal both end up near the best-effort profile (mean a few watts above the best ride, predicted a few seconds faster than it) because the per-zone ceilings and the whole-profile floor from the PR ride cap what can be asked. For achievable goals the realistic plans differ
  (test: goals 18 and 21 minutes on a synthetic climb differ by > 10 W).
- Not run: a physical iPhone or the Karoo with these changes; the notice and sends use the new plan power.

## External state

- Nothing installed, pushed or published. No personal values in the repo (tests and fixtures are synthetic).

## Goal alignment

- GOALS priority 8 follow-up and the "beat my best, keep a long-term goal" product ask. No Karoo wire change: the plan is the same `baselinePacingPlan` shape with different per-section targets, and `targetFinishTimeSeconds` is still the next goal.
- Migration 14 is a nullable column on a local table: no data loss, no Karoo impact.

## Hazards and blockers

- The phone profile for Jason's real install could not be read from here. The Karoo's FTP can only have come from a phone send (the Karoo has no screen to enter one and the transfer carries the profile), so the phone profile held that FTP at the last send;
  confirm in the app's Profile screen.
- No weight history is stored: `athlete_profile` is a singleton row with a `profile_version` counter, and `plan_sends` / `segment_plans` record FTP but not weight. Proposal (needs a migration, not done): an `athlete_profile_history` table
  (effective_from_ms, ftp_watts, weight_kg, max_hr_bpm) written whenever setAthleteProfile changes a value, plus an optional "weight on this date" entry for a back-dated first row; `loadPlanHistory` then passes
  `weightAt(effortStart)` (latest row at or before the effort; earliest row for older efforts). Until then every effort is calibrated at today's weight.
- A goal that is out of reach still shows the same plan as the best achievable one (by design); both a long-term goal and a next goal a couple of minutes slower currently land near the best-effort-profile plan for the real history.
- `targetFinishTimeSeconds` for an out-of-reach next goal is unchanged (open decision, phone-side only until the contract work lands).

## Next safe action

Coordinator/Jason: confirm the weight-history table proposal (migration), then I build it and the back-dated weight entry. Codex: no change needed for this milestone.
