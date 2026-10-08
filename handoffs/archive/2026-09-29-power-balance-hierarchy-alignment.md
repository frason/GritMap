# Handoff: Power Balance hierarchy alignment

- Updated: `2026-09-29 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `dd22d92 feat: power/HR zones in segment comparison (#73)`
- Worktree: shared dirty worktree; this increment changed the Power Balance renderer, app
  version, and handoffs while preserving unrelated edits

## Outcome

GritMap Karoo 0.10.13/code36 is installed. Power Balance now follows the visual hierarchy
and typography scale established by the Pacing Profile field.

## Changed

- Action banner combines action and reserve-plan delta.
- Projected finish moved immediately below the action banner.
- Header, progress, action, projected finish, metric labels, and values were enlarged.
- Bottom metric cards were enlarged and lowered to fill available space.
- PLAN drain/recovery is left beneath PLAN; ACTUAL drain/recovery is right beneath RIDE.
- Removed the redundant projected-finish footer.
- Bumped the app to 0.10.13/code36.

## Verified

- Focused `WPrimeBalanceBitmapRendererTest`: passed.
- Inspected 480x624 on-plan, overextended, and recovering previews.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.13/code36.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.

## Next safe action

Review the complete field hierarchy on the physical display, especially the banner and
bottom cards; avoid returning to isolated arrow tweaks unless direction is actually wrong.
