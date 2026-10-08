# Handoff: Final 1P road perspective pass

- Updated: `2026-09-28 21:25 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `85026b2 docs: hand off post-MVP backlog cleared (#60-#63)`
- Worktree: shared dirty worktree; this increment changed the Karoo renderer, app version, and handoffs while preserving unrelated edits

## Outcome

GritMap Karoo 0.10.5/code28 is installed. The 1P route now meets the mountain horizon
cleanly and its border treatment reinforces perspective without the former center dash.

## Changed

- Added a road vanishing-point baseline equal to the bottom of the rear mountain layer.
- Removed the white dashed road centerline.
- Increased shoulder width with depth from 1.5px at the horizon to 13.5px in the foreground.
- Made shoulders approximately 50% darker and applied the same four-stop vertical depth
  gradient used by the colored road surface.
- Bumped version to 0.10.5/code28.

## Verified

- Focused `ProfileBitmapRendererTest`: passed; four-state contact sheet inspected.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.5/code28.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.

## Next safe action

Perform a real ride preview and preserve this visual baseline unless device evidence reveals
a functional readability issue.
