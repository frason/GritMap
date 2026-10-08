# Handoff: Pacing road typography restored to mockup hierarchy

- Updated: `2026-09-28 16:10 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `71ef851 docs: hand off attempt-persistence and reverse-descent fixes`

## Outcome

Installed GritMap Karoo 0.8.9/code20. Increased large Pacing Profile typography after hardware review showed 0.8.8's road geometry was improved but its Target/Actual, watt, gap, pacer, rider, and contour text was substantially smaller than the mockup hierarchy.

## Files changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/ProfileBitmapRenderer.kt`
- `apps/karoo/app/build.gradle.kts`
- `handoffs/LATEST.md`

## Verification

- Focused renderer tests passed.
- Debug APK assembled successfully.
- APK installed; device reports 0.8.9/code20.

## Known hazards

- Hardware screenshot review is required to confirm the new type scale does not crowd narrow cards.
- Shared worktree changes remain uncommitted; preserve unrelated iOS work.

## Safest next action

Capture the same large-field preview at close and far pacer phases and compare legibility plus card fit against the mockup.
