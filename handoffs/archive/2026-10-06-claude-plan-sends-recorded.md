# Handoff: the phone records the plan each Karoo send carried (phone app, uncommitted)

- Updated: `2026-10-06`
- Agent: `Claude`
- Branch: `main`
- Head: `71f3c32 feat: predicted finish time for imported pacing plans` (pushed) -- **the work below is uncommitted**
- Worktree: Codex's `apps/karoo/`, `ios/`, `src/diagnostics/`, `docs/NEXT_RIDE_TEST_CHECKLIST.md`, other archives and
  `LATEST.md` edits untouched.

## Why

Plan vs actual compared an effort with the segment's *current* plan, which the screen admitted "may differ from the
plan you rode with" (the historical-plan caveat Codex also noted in the next-ride checklist). Resending or replacing
a plan between rides would silently change an earlier ride's comparison.

## Outcome

- Every successful send to the Karoo now stores the exact `baselinePacingPlan` JSON it carried (generated or
  imported, including the target time actually given to the Karoo) in a new `plan_sends` table (migration **v13**;
  `user_version` is now 13). `src/db/planSends.ts`: `recordPlanSend`, `getPlanSentBefore(segment, rideStartMs)`.
- `sendGuidancePackageToKaroo` returns the plan it sent (`baselinePlan`, only when the Karoo acknowledged).
- **Plan vs actual** uses the latest plan sent at or before the effort's start (`resolvePlanForEffort`); the header
  says "the plan sent to your Karoo on <date> (coach plan / GritMap generated plan / ...)". With no send recorded
  before the ride it falls back to the current plan and keeps the old caveat.
- When the Karoo was given a target time, plan vs actual adds a line: "Finished 0:18 slower than the 41:52 target
  your Karoo was given." That is also a direct check of the finish-time prediction.

## Verified

- `npm run typecheck` clean; `npm test` **482/482** (was 467 on the committed tree); `npm run web:smoke` clean.
- New tests: 6 persistence (round trip, latest-at-or-before selection, ride predating every send, per-segment,
  cascade, FK), 2 effort-plan resolver, 1 outcome wording, 2 sender (returns the exact wire plan; none on a failed
  send), migration/version assertions.
- **Not live-checked on a device.**

## Hazards and blockers

- **Sends made before this build are not recorded.** In particular the 2026-10-05 Realize send is not in
  `plan_sends`, so a Realize ride compared without a fresh send falls back to the current plan with the caveat.
  Resend each segment's plan once from this build before the ride (the checklist's desk step already does this).
- A row means the Karoo's receiver acknowledged the bytes (HTTP 200). The Karoo imports afterwards and may still
  reject the package, in which case the recorded plan is not what the Karoo holds. Closing that needs the Karoo's
  planned "imported/rejected" reply (docs/KAROO_PAIRING_CONTRACT.md Phase 1).
- Send timestamps use the phone's clock and rides the Karoo's; both are network/GPS-synced, so a skew of seconds
  only matters if a send happens within seconds of a ride's start.

## Next safe action

Reload the phone app, then resend Realize's (and Diablo's) plan to the Karoo from this build before the ride. After
the ride and FIT import: Realize -> Your Efforts -> Plan vs actual should say "the plan sent to your Karoo on ...".

## For Codex

Nothing required. If the Karoo can later report which plan is installed per segment (the proposed `GET /segments`),
the phone can reconcile `plan_sends` against it instead of trusting the HTTP 200. The checklist's
"historical-plan caveat" is resolved for sends made from this build onward.
