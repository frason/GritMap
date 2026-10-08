# Handoff: next-ride checklist synchronized with installed build and phone analysis

- Updated: `2026-10-05 22:14 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `a47e928 feat: coach-plan import, versioned rider profile, saved Karoo address`
- Worktree: mixed uncommitted Karoo/phone work; checklist change is uncommitted

## Outcome

`docs/NEXT_RIDE_TEST_CHECKLIST.md` now reflects the actual test boundary: Karoo 0.10.40/code63 is
installed, the rider's preferred H10 was confirmed in app-private preferences, and the offline
0.10.41 RR-gap build must not be installed until the clean moving approach test finishes. The exact
0.10.40 diagnostic event sequence and bounded reconnect expectations are documented. The checklist
also includes Claude's new phone Plan vs Actual review and its current-plan-versus-historical-plan
caveat.

## Changed

- `docs/NEXT_RIDE_TEST_CHECKLIST.md`
- Marked preferred-H10 setup complete.
- Removed stale 0.10.39/no-preference language.
- Added no-reinstall/no-diagnostics boundary, explicit absence of 0.10.41 `h10_rr_gap`, phone Plan
  vs Actual checks, and a results-table row.
- Deferred the optional process-kill test until after the ride.

## Verified

- Read against `LiveSegmentService.kt` event names and installed 0.10.40 lifecycle.
- `git diff --check` passed before the final documentation-only adjustment.

## External state

- Karoo remains on 0.10.40/code63.
- Preferred H10 exists and was previously verified over ADB.

## Hazards and blockers

- Phone Plan vs Actual uses the segment's current plan, not a plan snapshot captured at ride time.
- The source tree is 0.10.41 while the physical test device intentionally remains 0.10.40.

## Next safe action

Run the ride without opening H10 Diagnostics or reinstalling GritMap, then reconnect the Karoo and
let Codex pull the bounded log, new RR artifact, database and FIT evidence.
