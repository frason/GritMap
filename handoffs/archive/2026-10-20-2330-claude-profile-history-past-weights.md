# Handoff: profile history (migration 15), past weights, weight at each effort, plain "why" copy

- Updated: `2026-10-20 23:30 PDT`
- Agent: `Claude`
- Branch: `main`
- Head: `1c0bd47 feat: profile history (migration 15), past weights, weight at each effort, plain 'why' copy`
- Worktree: Codex's uncommitted Karoo/doc/handoff files only; my work committed locally, not pushed

## Outcome

Follows `handoffs/archive/2026-10-20-2255-claude-staged-goal-physics-anchor.md` (approved by Jason via the coordinator):
1. **Migration 15 `athlete_profile_history`** (id, effective_from_ms, ftp_watts, weight_kg, max_heart_rate_bpm, source `profile|backdated|backfill`, recorded_at_ms). It backfills one row from the current profile when it runs
   (`effective_from_ms` = the profile's last-saved time); a database with no profile gets no row. `setAthleteProfile` appends a row only when FTP, weight or max HR differs from the latest saved (non-back-dated) row.
2. **Past weights.** Profile screen section "Past weights (optional)": a date (year-month-day or month/day/year) and a weight in the rider's unit, with a list and "Remove" for the ones the rider entered. A past weight never changes the
   current profile; dates after today and impossible dates are refused with plain messages.
3. **Weight at each effort.** `weightAt` = the latest row (with a weight) at or before the effort's start, the earliest row for older efforts. `loadPlanHistory`, the segment screen and the coach-plan screen now pass it, so each past effort is calibrated at
   the weight the rider had that day when it is known (otherwise at today's weight, as before).
4. **Goal card says why.** The "held back", "out of reach" and "a stretch but your best is within reach" notices now end with: "GritMap plans no more power than you have held on this climb, or than your effort budget allows. That grows as you set new bests."
   (the "held back" one: "...on this climb; it grows as you set new bests."). 4% ceiling margin and CP/W' model unchanged, as decided.

## Changed (`1c0bd47`)

`src/db/migrations.ts` (v15) + `migrations.test.ts`/`initializeDatabase.test.ts` (version 15), `setAthleteProfile.ts`, new `src/db/profileHistory.ts` (+ `profileHistory.test.ts`: migration on a populated v14 database,
no-profile database, fresh install, history append rules, back-dated entries, `weightAt` rules), `src/pacing/loadPlanHistory.ts`, `SegmentDetailScreen.tsx`, `ImportCoachPlanScreen.tsx`, `ZonesSettingsScreen.tsx`,
new `src/screens/parsePastDate.ts` (+ tests), `describePlanFeasibility.ts` (+ tests).

## Verified

- `npx tsc --noEmit` clean; `npm test` 746/746; `npm run web:smoke` clean.
- Migration tested on an existing database (a v14 database with a saved profile gets exactly one `backfill` row with its values; the profile row is untouched; user_version 15).
- Release simulator build on the existing demo database: the Profile screen shows the new "Past weights (optional)" section (date and weight fields, "Add past weight") and number-and-punctuation keyboard for the date.
  The full add-and-list flow was not driven end to end in the simulator (typing was slow); it is covered by the unit tests.
- Not run: a physical iPhone; the Karoo (no wire change).

## External state

- Nothing installed, pushed or published. No personal numbers anywhere in the repo or tests (synthetic values only). Jason enters his own past weight in the app (the rider's date and weight stay on the phone).

## Goal alignment

- GOALS priority 8 follow-up and the "weight at the time of each effort" product ask. No shared contract touched: the history table is local; the rider-profile package sent to the Karoo is unchanged.

## Hazards and blockers

- Back-dated weights apply to every effort after their date until the next row. One entry on 2025-05-10 therefore also covers efforts up to the next recorded weight (for example the profile row written when the app was updated); add further dated weights for a closer fit.
- Efforts older than the earliest row use the earliest row's weight (so, with only today's profile, all efforts use today's weight, as before).
- The per-effort weight only affects the calibration of the physics model (finish predictions and the goal-time power); it does not change what is sent to the Karoo directly.

## Next safe action

Coordinator: ask Jason about pushing and the next TestFlight build (nothing is pushed). After it is installed Jason enters his weight for 2025-05-10 on the Profile screen.
