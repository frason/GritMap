# Handoff: Relize segment and 6:54 baseline installed on Karoo

- Updated: `2026-08-22 08:43 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: uncommitted Karoo work from multiple milestones; no existing changes discarded.

## Outcome

Relize and its rider-specific 6:54 baseline guidance are installed in the connected Karoo database and ready for a ride test. The device library visibly reports `Installed segments (2)` and `Relize · 1906 m · 192 points · baseline plan`.

## Changed

- No additional code change in this confirmation step.
- Processed `Relize.6m54.guidance-package.json`, containing FTP 285 W, weight 92.53 kg, target 414 seconds, and contiguous 270/280/300 W zones.

## Verified

- Inspected the live Karoo UI hierarchy and confirmed the Relize library row and baseline-plan label.
- Confirmed the package moved from pending to `/sdcard/Android/data/com.gritmap.karoo/files/imports/processed/Relize.6m54.guidance-package.json`.

## External state

- Connected Karoo `00442GA241760203` now has two installed segments: Coco Jumbo and Relize.
- Relize is ready for live detection in its forward GPX direction.

## Hazards and blockers

- Import status feedback was not visually obvious even though processing succeeded; importer UX still needs later refinement.
- The working tree contains pre-existing uncommitted Karoo work; do not discard it.

## Next safe action

Ride through Relize beginning near `37.91007,-122.09979` and verify activation, planned-time comparison, and baseline zone transitions.
