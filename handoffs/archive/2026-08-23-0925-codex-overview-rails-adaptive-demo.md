# Handoff: Overall progress rails and adaptive-zoom demo installed

- Updated: `2026-08-23 09:25 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted Karoo work; this increment changes the profile renderer, animated preview, XML layout, and focused tests.

## Outcome

Large Pacing Profile cards now show overall segment progress in thin edge rails: complete plan on the left, completed actual execution on the right, and shared white progress notches. Guidance is centered. The demo cycles through close, far-ahead, close, and far-behind target gaps at steady simulated speed to expose adaptive tick scaling.

## Changed

- `ProfileBitmapRenderer.kt`: plan/actual overview rails and progress notches.
- `KarooPreviewState.kt`: 24-second four-phase adaptive-zoom demo.
- `karoo_live_pacing_field.xml`: centered guidance.
- `KarooPreviewStateTest.kt`: 24-step loop and updated zone traversal.

## Verified

- Focused renderer, preview, and layout tests plus APK assembly: `BUILD SUCCESSFUL in 1m 13s`.
- APK installed on Karoo `00442GA241760203`: `Success`.

## External state

- Updated APK is installed on the connected Karoo.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- The extension remains limited to 1 Hz updates, so tick motion is stepped.
- Physical video validation is required to judge the four demo phases and rail widths.
- Preserve existing uncommitted Karoo work.

## Next safe action

Run the data-field demo for at least 24 seconds and capture video covering one full cycle; verify that close phases visibly zoom in and move ticks faster while far phases zoom out and move ticks slower.
