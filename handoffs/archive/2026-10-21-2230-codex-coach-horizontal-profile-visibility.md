# Handoff: horizontal Coach work and Profile visibility

- Updated: `2026-10-21 22:30 PDT`
- Agent: `Codex`
- Branch: current working branch (no branch change)
- Head: `ec38f81 docs: correct the profile-history handoff timestamp and filename`
- Worktree: visual refinements and prior concurrent/work/cardiac/H10 changes remain uncommitted.

## Outcome

Active Coach row/content is 1.5× the original size. Actual work fills left to right with a vertical white planned-work line. Large Profile includes its title and HOLD/action timing banner in the bitmap, left elevation labels, a smaller white rider dot without YOU, and brighter terrain.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/PacingCoachBitmapRenderer.kt`: 1.5× active row, horizontal work fill, vertical target line rendered over labels, translucent active label background.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/ProfileBitmapRenderer.kt`: self-contained title/action banner, left elevation labels, brighter road/mountains/contours, smaller rider dot; profileTimingLabel helper.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/LivePacingDataType.kt`: large Profile uses full bitmap; outer header/guidance hidden to avoid duplicates.
- Renderer tests and `KarooFieldLayoutTest.kt`: horizontal raster regression, timing banner and large presentation assertions.
- `docs/KAROO_FIELD_WORK_FILL.md`: revised visual semantics. No commit created.

## Verified

- Full `:app:testDebugUnitTest :app:lintDebug :app:assembleDebug --no-daemon`: 226 tests, zero failures; BUILD SUCCESSFUL. Log `/tmp/gritmap-field-refinement.log`.
- After final transparency/test refinements, focused PacingCoachBitmapRendererTest, ProfileBitmapRendererTest and KarooFieldLayoutTest plus lintDebug/assembleDebug: BUILD SUCCESSFUL. Log `/tmp/gritmap-field-refinement-final.log`.
- Visually inspected `/tmp/gritmap-coach-ahead.png`, `/tmp/gritmap-coach-behind.png`, `/tmp/gritmap-profile-two-cards.png`; labels, fill direction and banner visible without clipping.
- `git diff --check` clean. No device verification or install this milestone.

## External state

- Last verified installed Karoo remains 0.10.44-ble2 / versionCode 69. A future device/public build must use code >=70. No signing, release, push, ADB or device-data changes.

## Goal alignment

- Explicit user-requested Karoo readability refinement. Work integration and plan contracts unchanged; no phone action required.

## Hazards and blockers

- Outdoor visibility and device layout still need rider validation. Existing work scale remains estimated distance-proportional planned time.
- Prior concurrent runtime remains default-off and uncommitted; H10 recording export/list and separate RR-recording confirmation remain pending. Cardiac drift real-ride stability not yet proven.
- Preserve concurrent/coordinator work and private ride data; no uninstall or clear-data.

## Next safe action

Review these previews with the rider; when device installation is requested, build with versionCode >=70 and install preserving device data.
