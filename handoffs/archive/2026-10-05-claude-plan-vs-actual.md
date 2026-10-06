# Handoff: plan vs actual per zone (phone app, uncommitted)

- Updated: `2026-10-05`
- Agent: `Claude`
- Branch: `main`
- Head: `e8be5b4 docs: next-ride test checklist and follow-up review of the H10 work` (pushed) -- **the work below is uncommitted**
- Worktree: Codex's `apps/karoo/`, `ios/`, other archives and `LATEST.md` edits untouched.

## Outcome

An effort can now be lined up against its pacing plan, zone by zone, on the phone. Entry points: the
**"Plan vs actual"** row under *Your Efforts* on the segment screen (most recent valid effort) and a
**"Compare with your pacing plan"** button on the attempt review screen. No schema change, no Karoo
change, no new native dependency (JS only: reload the app).

## What it shows

- Summary tiles: average power vs the plan's, zones on target (x/N), time gained/lost against your best
  *other* attempt.
- A plain-language read (at most four lines): overall over/under, "went out hard", "finished strong",
  "faded as the effort went on" / "built through the effort", the single biggest miss, and a note when power
  covers under 80% of the effort.
- Chart: one column per zone, actual power as a bar (over = amber, on target = green, under = blue), the plan
  target as a dark tick; scrolls horizontally with a fixed width per zone like the plan chart.
- Table: zone, distance range, plan W, actual W, delta W, time gained/lost vs the reference attempt.

## How it is computed (src/pacing/computePlanVsActual.ts, pure)

- Power is averaged over **time in each zone**, not distance (a fast descent must not outweigh a slow climb);
  gaps over 30 s (pauses) are excluded, not averaged across.
- The attempt's odometer is stretched to the segment polyline length first (they differ by ~0.25% on Diablo).
- Zone entry/exit and time-vs-reference reuse the comparison screens' gap-aware distance interpolation
  (`src/comparison/resampleChannel.ts`).
- "On target" = within 5% of the target, never tighter than 5 W.
- The plan is the one the segment has **now** (`resolveSegmentPlan`: an active imported plan, else the plan
  generated from FTP + this segment's goal, else none with a message). It is not recorded per ride, so the screen
  says it may differ from the plan actually ridden. Recording the plan sent to the Karoo with each send would fix
  that; not done.

## Verified

- `npm run typecheck` clean; `npm test` **445/445** (was 426); `npm run web:smoke` clean.
- New tests: 14 calculation (time-weighting, tolerance/floor, odometer scaling, pause handling, no/partial power,
  reference gap, shape insights, and a 26-zone Diablo fixture run), 3 plan resolver, 2 time formatter.
- **Real data:** ran the real `2026-09-13` Diablo effort (the only Downloads FIT that matches Diablo; 45:45) through
  the real matcher and parser against the 39:00 generated plan: 262 W average vs 284 W planned, 6/26 zones on
  target, thirds -5% / -8% / -13%, biggest miss 7,242-7,644 m at 55 W under. That exposed a missing "faded"
  insight, since added. (Throwaway script in the session scratchpad, not committed.)
- **Not live-checked on a device:** the screen, chart, table and both entry points have only typecheck / web-export
  verification.

## Hazards and blockers

- Compared against the *current* plan, not necessarily the one on the Karoo during the ride.
- Needs power data in the FIT; efforts without a power meter show a message instead.
- The "best other attempt" reference is the fastest other accepted/approved attempt; with only one attempt there is
  no time-vs-reference column.

## Next safe action

Reload the phone app, open Diablo (or Realize after tomorrow's ride and FIT import) -> Your Efforts -> Plan vs
actual. After the ride, compare what it says with how the effort felt, and tell us if the 5% tolerance or the read
is wrong.

## For Codex

Nothing required. The phone could later record the exact plan it sent to the Karoo with each send; if the Karoo
ever returns attempt-time zone data, the same computation can use it.
