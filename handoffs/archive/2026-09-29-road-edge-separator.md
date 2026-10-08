# Handoff: Perspective road edge separator

- Updated: `2026-09-29 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `85026b2 docs: hand off post-MVP backlog cleared (#60-#63)`
- Worktree: shared dirty worktree; this increment changed the Karoo renderer, app version, and handoffs while preserving unrelated edits

## Outcome

GritMap Karoo 0.10.7/code30 is installed. The colored 1P road now has a thin near-black
reveal before the grey shoulder, matching the original depth concept.

## Changed

- Added a separate near-black geometry layer between road surface and shoulder.
- Separator tapers from 4px in the foreground to 0.6px at the horizon.
- Bumped version to 0.10.7/code30.

## Verified

- Focused `ProfileBitmapRendererTest`: passed; contact sheet inspected.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.7/code30.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.

## Next safe action

Review the separator at physical device size, then return to the separate GM Power Balance
field if the pacing-profile visual baseline is accepted.
