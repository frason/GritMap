# Handoff: Power Balance UX redesign

- Updated: `2026-09-29 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `85026b2 docs: hand off post-MVP backlog cleared (#60-#63)`
- Worktree: shared dirty worktree; this increment changed Power Balance rendering/presentation, demo tests, app version, and handoffs while preserving unrelated edits

## Outcome

GritMap Karoo 0.10.9/code32 is installed. GM Power Balance now matches the visual hierarchy
and glanceability established by GM Pacing Profile while retaining the battery metaphor.

## Changed

- Large layout moved all presentation into one responsive Canvas bitmap and hides obsolete
  outer value/delta text.
- Added action banner, reserve comparison, Plan/Ride nodes, horizontal battery and plan
  marker, energy-state label, Actual/Plan rate cards, and projected finish reserve.
- Reserve rates display as watts (`1 J/s = 1 W`) with explicit DRAIN/RECOVERY labels.
- Active path is 8px blue; inactive is 6px grey. Chevrons use enlarged black lead-in
  knockouts for clearer direction at arm's length.
- Null W-prime uses a consistent CALCULATING battery shell instead of the former power bar.
- Added a generated renderer preview at test time under
  `app/build/reports/power-balance-preview/large.png`.
- Bumped version to 0.10.9/code32.

## Verified

- Focused `WPrimeBalanceBitmapRendererTest`: passed and preview inspected.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.9/code32.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.
- Physical-device review should confirm that the large image receives the expected full
  height in Karoo's page editor and that 1 Hz chevron stepping reads clearly.

## Next safe action

Start the demo, open GM Power Balance at full-page size, and capture one screenshot for the
final physical-device layout check.
