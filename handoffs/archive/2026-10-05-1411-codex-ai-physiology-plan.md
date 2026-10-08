# Handoff: AI, H10 physiology, and RR retention plan ready for Claude review

- Updated: `2026-10-05 14:11 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: heavily dirty from existing mixed Codex/Claude Karoo and phone work; this milestone
  added only the plan and handoff files described below

## Outcome

The consolidated GritMap Karoo AI/physiology architecture is documented and ready for review at
`docs/PLAN_KAROO_AI_PHYSIOLOGY.md`. It includes H10 Enhanced and standard-HR tiers, crash-safe raw
RR retention, privacy controls, the AI Endurance boundary, a constrained Needle role, staged
delivery, verification gates, and an explicit Claude review checklist.

## Changed

- Added `docs/PLAN_KAROO_AI_PHYSIOLOGY.md`.
- Updated `handoffs/LATEST.md` with the review request.
- Added this archive handoff.
- No production code, database schema, Gradle configuration, tests, or device state changed.

## Verified

- Research used official/current AI Endurance, Polar, Needle and Hammerhead materials linked in
  the plan.
- Locally decoded all 12 FIT files currently in `/Users/frason/Downloads`: none contains FIT HRV
  messages, RR fields, DFA alpha 1 fields, or respiration fields.
- The 2026-09-13 FIT identifies the Polar sensor as an ANT+ HR device and contains ordinary BPM
  on all 9,035 ride records.
- No automated test was run because this milestone changes documentation only.

## External state

- Claude has not reviewed the plan yet. The handoff tells the next Claude session exactly what to
  review and asks it not to implement before review acceptance.
- No Karoo installation or configuration was changed.

## Hazards and blockers

- The worktree contains extensive pre-existing uncommitted files owned by both agents; do not
  sweep them into a plan-only commit.
- Official Polar BLE SDK documentation currently specifies a minimum API above Karoo's API 31
  target; the proposed spike therefore begins with the standard BLE Heart Rate Service.
- Needle compatibility is plausible but not proven on the physical Karoo until benchmarked.

## Next safe action

Tell Claude to read `handoffs/LATEST.md`, review `docs/PLAN_KAROO_AI_PHYSIOLOGY.md`, and record
specific findings in a separate review document without editing production code.
