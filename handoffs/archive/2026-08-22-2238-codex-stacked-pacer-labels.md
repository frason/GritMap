# Handoff: Stacked power labels and visible virtual pacer installed

- Updated: `2026-08-22 22:38 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted Karoo work; this increment modifies `ProfileBitmapRenderer.kt`.

## Outcome

Vertical Pacing Profile metrics now show `TARGET` and `ACTUAL` as large headings on separate lines above their watt values. The virtual target marker is restored as a white-ringed red/green dot. Both it and the white rider dot render last, above every chart layer.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/ProfileBitmapRenderer.kt`: stacked metric blocks, final marker layer, high-contrast marker outlines.

## Verified

- Focused `ProfileBitmapRendererTest` plus `:app:assembleDebug`: `BUILD SUCCESSFUL in 1m 15s`.
- Installed APK via `adb install -r`: `Success`.

## External state

- Corrected APK is installed on Karoo `00442GA241760203`.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- Physical-display validation still needs a screenshot with GM Pacing Profile placed on the active page.
- Preserve the existing uncommitted Karoo work.

## Next safe action

Open the GM Pacing Profile preview on the Karoo and verify the two stacked metric blocks and both center-line markers.
