# Deterministic live replanning

Implemented behind `-PgritmapLiveReplanner=true`, default **false**, 2026-10-22. GOALS priority 8; phone remains the plan author. No device install or public release for this milestone. Concurrent tracking has its own independent flag.

## Behavior

- Optional transfer `replan` v1 parameters plus a ceiling on every section are validated and stored separately from original targets. Unknown versions ignore the extension. Old plans keep their original targets; no ceiling is invented. Room migration 2→3 adds one nullable metadata column without deleting existing plans/data.
- Each attempt owns retained live targets. At crossed quarter-mile boundaries, cumulative elapsed is compared with the original distance-proportional schedule, with a 3-second deadband. Completed section targets freeze. Future targets are recomputed from the original baseline rather than compounding previous increases.
- Behind: prefer easier remaining sections, within immutable personal ceilings, supplied adjacent-step limits and the supplied estimated W′ reserve. Ahead/on-time: retain original effort, apart from necessary energy reductions. Descents/unknown grades receive no extra power. A fixed completed transition that conflicts with the energy reserve withholds adjustment and shows REPLAN LIMITED.
- W′ uses the phone's ten-second differential recovery convention and supplied parameters. Missing power receives no recovery credit, and unobserved intervals assume at least the maximum supplied ceiling. Start-of-attempt balance assumes full estimated capacity; it cannot measure pre-segment fatigue.
- Matching uncertainty or a telemetry gap over five seconds suppresses that boundary's adjustment. Repeated timestamps cannot repeat integration. Matching/attempt completion remain unchanged.
- Both legacy and concurrent live paths reapply retained targets each tick. Future-target changes preserve completed-section work. Original imported targets, database plan and goal remain unchanged. Existing Needle whole-plan replacement callbacks are bypassed when deterministic replanning is enabled.
- Performance shows EST and the finish/goal gap. Estimates update between boundaries. Compact fields label the result ESTIMATE. Needle is not needed or activated.

## Timing and limits

The current wire contract has no per-section planned time anchors or rider/physics parameters. This first version shares the existing pacer's distance-proportional planned schedule. The response model scales remaining section time by original/new watts on climbs and its cube root on flats. **This is an explicitly estimated normalized response, not a calibrated best-finish prediction or proof that a private PR can be reproduced.** A terrain-aware plan schedule/phone physics contract is still needed before making that claim.

Greedy easier-first adjustments are bounded to 8,192 candidate evaluations, 128 sections and a goal no longer than 24 hours. Zero-target plans remain importable but are not adapted. Global mathematical optimality is not claimed. If no safe adjustment fits, preserve the baseline and report limits rather than publish a partially validated adjustment.

The old W′ display still uses its own FTP estimate; it is not relabeled as the phone-supplied replanning budget. Concurrent attempt-level budgeting is not ride-level energy accounting. Keep both experimental features off for general riders pending physical validation.

## Verification artifacts

- `docs/fixtures/plan-ceilings-transfer-v1.json`: synthetic transfer matching the existing phone-generated ceiling fixture; tested on phone and Karoo. Phone production sender unchanged.
- `docs/fixtures/live-replan-synthetic.json`: invented 230 W actual versus 250 W target first section; expected bounded targets `[250,250,250,270]`, estimated finish ~802.58 s for an 800 s goal, within the 3 s deadband.
- Unit/integration tests cover deadband, ahead, infeasible goal, ceilings/steps, reserve, missing grades, completed-target freezing, state reconstruction, GPS gaps, import validation, metadata round trip, Room import/reload and schema-2 data preservation.
- `/tmp/gritmap-replanner-synthetic-replay.txt` and `/tmp/gritmap-replan-{estimate,limited,compact}.png` are local replay/visual artifacts, not personal ride data.

## Rollout boundary

Installed Karoo version70 does **not** accept the new metadata. The phone must continue sending the old shape until a receiver build >=71 containing this parser is installed and compatible receiver capability/rollout gating exists. The shared fixture passing is not permission to send the extension to old devices. PR `segmentRecord`, H10 export and Needle activation are separate unfinished work.

Needle readiness and ABI findings: `docs/NEEDLE_READINESS.md`.
