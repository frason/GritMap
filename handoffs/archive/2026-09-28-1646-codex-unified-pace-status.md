# Handoff: Unified pace status and gradient road 0.9.1

- Updated: `2026-09-28 16:46 PDT`
- Agent: `Codex`
- Branch: `main`
- Head at completion: concurrent Claude commits may have advanced `main`; Karoo changes are uncommitted.

## Outcome

Installed GritMap Karoo 0.9.1/code22. Combined target distance and time into one stable
status block, removed tiny time text from the moving target, and added dark-edge/
bright-center effort gradients to the road.

## Files changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/ProfileBitmapRenderer.kt`
- `apps/karoo/app/src/test/java/com/gritmap/karoo/ui/ProfileBitmapRendererTest.kt`
- `apps/karoo/app/build.gradle.kts`
- `handoffs/LATEST.md`

## Verification

- Four-state local contact sheet regenerated and reviewed.
- Full JVM tests and debug APK assembly passed.
- APK installed; device reports 0.9.1/code22.

## Known hazards

- Hardware review remains useful after a complete preview loop.
- Shared worktree changes remain uncommitted; preserve unrelated iOS and Claude work.

## Safest next action

Observe one full 24-second preview loop and confirm the fixed status area and road
gradients remain readable on hardware.
