# Handoff: Perspective pacing route corrected and installed

- Updated: `2026-09-28 15:50 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `71ef851 docs: hand off attempt-persistence and reverse-descent fixes`

## Outcome

Installed GritMap Karoo 0.8.7/code18. Replaced the large Pacing Profile's flat top-down projection with a rider-aligned perspective road, adaptive pacer-gap zoom, near-field road widening, and interpolated 100-foot elevation contours.

## Files changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/ProfileBitmapRenderer.kt`
- `apps/karoo/app/build.gradle.kts`
- `handoffs/LATEST.md`

## Verification

- Focused renderer tests passed.
- Debug APK assembled successfully.
- Diff check passed.
- APK installed successfully; device reports 0.8.7/code18.

## Known hazards

- Real-device visual proportions still require screenshot review.
- Contours are visible only where the current distance window crosses a 100-foot elevation boundary.
- Shared worktree changes remain uncommitted; preserve unrelated iOS work.

## Safest next action

Review the large full-width preview in close- and far-pacer phases and adjust only visual proportions after seeing the hardware rendering.
