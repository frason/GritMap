# Handoff: Custom graphical fields require product-design review

- Updated: `2026-08-24 14:54 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted Karoo work remains; no code changed after the 2026-08-23 custom-field review build.

## Outcome

The installed 0.8.1 custom-field build is an exploratory implementation, not an approved design for Pacing Coach, Power Balance, Cardiac Drift, or Segment Performance. The user correctly identified that the prior pass emphasized responsive presentation before deciding what rider decision each field should support. Do not treat those four field designs as finished. Pacing Profile remains the visual benchmark developed through device screenshots.

## Current product-design direction

- Pacing Coach should answer: **What should I do now, and what is coming next?** Candidate elements: dominant REST/HOLD/PUSH action, target tolerance gauge, approaching zone transition, short power trend, and AI/sensor-confidence state.
- Power Balance should answer: **Am I applying the prescribed power consistently?** Candidate elements: target-centered tolerance band, separate 3-second and 30-second markers, signed delta, time-in-band score, and a fading recent-execution trail.
- Cardiac Drift should answer: **Is this effort becoming physiologically more expensive?** Candidate elements: explicit power/HR efficiency definition, baseline-build state, zero-centered signed graph, slope/projection, and confidence warnings during unstable power or sensor loss.
- Segment Performance should answer: **Am I on schedule for the goal, and why?** Candidate elements: primary ahead/behind time, YOU-versus-PLAN markers, prediction range instead of false precision, zone-adherence history, and a distinct completion summary.

These are proposals for joint review, not approved requirements. The recommended discussion/implementation order is Power Balance, Pacing Coach, Segment Performance, then Cardiac Drift.

## Existing exploratory code

- Shared graphical-field host passes `KarooFieldLayout` and legacy row size.
- Pacing Coach currently has a rounded one-word banner and responsive text visibility.
- Power Balance currently has a stable 0-150% scale, target/actual markers, and trend arrow.
- Cardiac Drift currently has signed threshold bands, guides, endpoint, and trend.
- Segment Performance currently has a plan/prediction comparison graphic and progress rail.
- `SegmentPerformanceBitmapRenderer.kt` and focused tests were added.

## Verified

- Focused combined/layout and bitmap-renderer suites plus APK assembly: `BUILD SUCCESSFUL in 2m 8s`.
- Complete `:app:testDebugUnitTest`: `BUILD SUCCESSFUL in 42s`.
- No verification was run after the product-design discussion because no further code was changed.

## External state

- Exploratory 0.8.1/versionCode 12 APK is installed on the Karoo.
- The installed visuals should be reviewed as prototypes only.

## Hazards and blockers

- Do not continue polishing all four fields in parallel before agreeing on information priorities.
- Do not infer that the candidate elements above are approved merely because they are documented.
- Preserve unrelated and pre-existing uncommitted Karoo work.

## Next safe action

Review **Power Balance** with the user first: agree on its primary metric, target tolerance, time windows, and small/short-wide/large visual hierarchy before changing its implementation.
