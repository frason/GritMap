# Plan ceilings contract (DRAFT for Codex): realistic quarter-mile targets and live replanning

Status: **draft, 2026-10-20**. The phone side (ceilings, W' guard, redistribution) is implemented and used when GritMap generates
a plan for display and sending (`src/pacing/realisticPlan.ts`, `planCeilings.ts`, `generateRealisticPlan.ts`). **Nothing in this
document is on the wire yet.** The phone must not send ceilings or constants to the Karoo until Codex's parser accepts the optional
fields below and the shared fixture passes on both sides (same rule as `segmentRecord`). Until then a Karoo only ever sees the
final per-zone targets, already realistic, in the existing `baselinePacingPlan` shape.

GOALS priority 8: plans must never target above what the rider has sustained; the Karoo replans the remaining quarter-miles at each
boundary from what the rider actually did, within the same ceilings; Needle (on-device AI) assists the live layer only, clamped to
the ceilings and smoothing limits, with silent fallback to the deterministic replanner.

## What the phone does today (informational)

For a generated plan (never for an imported coach/rider plan) the phone starts from the grade-shaped targets
(`buildTargetPowerZones`) and then:

1. **Ceiling per zone.** Where the rider has held at least 70% of FTP in that zone in a past accepted effort: best average power ever
   held there x 1.04, source `history`. Everywhere else: a fallback that slides from 1.10 x the plan's anchor power (the average the
   goal needs) at the start to 1.04 x at the end, source `fallback`. Always within 0.7 x to 1.5 x FTP.
2. **Energy budget (primary guard).** W' = 80 J per FTP watt (20 kJ at 250 W), a 15% reserve kept, Skiba's recovery below CP.
   Critical power starts at FTP and past efforts of 20 to 90 minutes can raise it (an effort of D seconds at average power P implies
   CP >= P - W'/D), by at most 15% of FTP; it is never lowered below FTP. Zone times come from the physics model, shared out to the
   goal time. **These are assumptions, not measurements.** Any zone that would spend the budget is cut to what the budget allows.
3. **Step limit.** Adjacent *climbing* zones (both at least 1.5% grade) differ by at most 20 W; any adjacent zones by at most 80 W
   (the Karoo rejects 100 W: `AiPlanValidator`).
4. **Redistribution.** Effort trimmed from a zone moves only to the zones AFTER it that have room, easier grades first, within every limit;
   it never moves backwards, and whatever finds no room is lost (reported as a shortfall).
4b. **Evidenced floor.** If a past effort is faster than the plan's predicted finish and the goal asks for at least as much as that effort,
   the plan never targets below the power that effort held in a zone (whole profile by default): evidence beats the W' assumption.
5. **Infeasible goal.** If the plan still averages less than the goal needs (more than 2% short), the plan is the best achievable one;
   the phone shows the predicted finish and the gap and never raises a target above a ceiling. The sent `targetFinishTimeSeconds` is
   still the rider's goal.

Constants are configuration (`DEFAULT_REALISTIC_PLAN_CONFIG`); the shared fixture records the ones in force.

## Proposed optional wire additions (not sent yet)

Both are optional. Today `TransferPackageParser.parseBaseline` and `parseZone` are exact-key strict, so an unmodified Karoo would
reject a plan that contains them: the Karoo parser **must** accept them before the phone sends them.

Per zone, next to `targetPowerWatts`:

```json
{ "startDistanceMeters": 0, "endDistanceMeters": 402, "targetPowerWatts": 219, "ceilingPowerWatts": 244,
  "classification": "HOLD", "icon": "HOLD", "instruction": "Hold" }
```

- `ceilingPowerWatts`: integer, `targetPowerWatts <= ceilingPowerWatts <= floor(1.5 x ftpWatts)`, at least `floor(0.7 x ftpWatts)`. Absent
  means "no personal ceiling known": the Karoo uses its existing behaviour.

Plan level, next to `zones`:

```json
"replan": { "schemaVersion": 1, "criticalPowerWatts": 250, "wPrimeJoules": 20000, "wPrimeReserveFraction": 0.15,
            "maxStepWatts": 20, "hardMaxStepWatts": 80, "stepLimitMinGradePct": 1.5 }
```

- Present only together with `ceilingPowerWatts` on every zone. Unknown `schemaVersion` means ignore `replan` and ceilings (fail
  open to the old behaviour, never reject the plan).
- `ceilingPowerWatts` is also where the Karoo takes its ceilings for live replanning (below), so it must not be rewritten on the device.

## What the Karoo live layer needs (Codex, GOALS priority 8, Steps 4 and 5)

- At each quarter-mile boundary compare cumulative actual vs planned time and recompute the remaining targets with a deadband; behind:
  spread the deficit over later, easier zones within the ceilings; ahead: never spend the surplus early; unreachable: show the best
  achievable finish. Use the same constants from `replan`, so phone and Karoo agree.
- Needle only estimates sustainable power and fade and suggests the adjustment size and a cue, clamped to the ceilings and smoothing
  limits; unavailable, slow or invalid means silent fallback to the deterministic replanner (which stays the authority).
- The README says Needle initialisation is disabled until a model bundle and digest are recorded: say what is missing and whether the
  Karoo can run it today.

## Shared fixture

`docs/fixtures/plan-ceilings-synthetic.json` (synthetic, invented numbers, no ride data; the phone test keeps it equal to what the
planner generates): the input (FTP, goal, grades, best-held power per zone), the constants, and the expected raw targets, final
targets and ceilings per zone. A Karoo implementation of the ceiling and redistribution rules, given the same input and constants,
must produce the same `targetPowerWatts` and `ceilingPowerWatts` (whole watts) and `feasible`. Replanning fixtures (an actual-vs-plan
trace and the expected adjusted targets) are the next addition once the Karoo layer is designed.

## Compatibility and open points

- Imported coach/rider plans carry no ceilings; the phone warns (`findTargetsAboveCeilings`) and does not rewrite them.
- The rider-facing words: "sections" for pacing stretches; "zones" only for power/HR training zones. The wire key stays `zones`.
- Open: whether the Karoo should also receive the infeasible-goal gap, or only the targets; whether `ceilingPowerWatts` is enough for
  Needle or it also needs each zone's grade (the Karoo can compute grade from the segment polyline).
