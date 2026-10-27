# Plan ceilings contract (DRAFT for Codex): realistic quarter-mile targets and live replanning

Receiver update, 2026-10-26: optional v1 parsing/storage exists behind default-off flags.
Receiver capability negotiation and a gated Wi-Fi phone path are implemented in source; BLE needs the
matching phone native capability characteristic/variant selection before it can send the extension.
See `RECEIVER_CAPABILITIES_CONTRACT.md` for exact handshake, fixture paths and deployment limits.
Public73 remains unchanged. No supervised live-replanner ride has passed.

GOALS priority8: deterministic live replanning within phone-supplied ceilings. Needle is backlogged
per Jason's2026-10-24 decision; no Needle dependency or integration is part of this work.

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

## Optional wire additions (only after capability advertisement)

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
- Needle remains backlogged. Use the deterministic replanner only.

## Shared fixture

`docs/fixtures/plan-ceilings-synthetic.json` (synthetic, invented numbers, no ride data; the phone test keeps it equal to what the
planner generates): the input (FTP, goal, grades, best-held power per zone), the constants, and the expected raw targets, final
targets and ceilings per zone. A Karoo implementation of the ceiling and redistribution rules, given the same input and constants,
must produce the same `targetPowerWatts` and `ceilingPowerWatts` (whole watts) and `feasible`. Replanning fixtures (an actual-vs-plan
trace and the expected adjusted targets) are the next addition once the Karoo layer is designed.

## Compatibility and open points

- Imported coach/rider plans carry no ceilings; the phone warns (`findTargetsAboveCeilings`) and does not rewrite them.
- The rider-facing words: "sections" for pacing stretches; "zones" only for power/HR training zones. The wire key stays `zones`.
- The Karoo computes grade from the installed segment polyline. Its finish estimate uses a simplified normalized response and remains an estimate, not a calibrated prediction.
