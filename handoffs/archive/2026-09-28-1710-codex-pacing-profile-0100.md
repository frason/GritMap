# Handoff: Pacing Profile mockup alignment 0.10.0

- Updated: `2026-09-28 17:10 PDT`
- Agent: `Codex`
- Branch: `main`
- Head at completion: `dd4878b feat: optional git-repo-backed segment registry (#62)`

## Outcome

Built and installed GritMap Karoo 0.10.0/code23 on device `00442GA241760203`.

## Changed

- Road gradient now runs from bright near YOU to dark at the horizon, not side-to-side.
- Light-grey road shoulders scale with perspective.
- Added subtle two-layer mountain silhouettes at the horizon.
- Added fixed Target/Pace/Actual metric cards between road and elevation.
- Center Pace card combines signed distance and signed time: negative behind, positive ahead.
- Large guidance badge includes effort and target watts.
- Added next-block effort/distance/watts callout anchored to the road.
- Elevation values appear only on the far-left graph axis.
- Distance/elevation units follow karoo-ext `UserProfile.preferredUnit`; preview defaults imperial.

## Verification

- Four-state local visual contact sheet reviewed.
- Clean build passed: 109 JVM tests, 0 failures/errors.
- Debug APK assembled at `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- Replacement install succeeded and retained app data.
- Device reports versionCode 23 and versionName 0.10.0.
- Post-install process was alive; `extension_created`, `service_created`, and
  `karoo_connected` were logged with no AndroidRuntime/FATAL startup crash.

## Known hazards

- 0.10.0 still needs one full-loop hardware review.
- Shared worktree changes remain uncommitted; preserve unrelated iOS and Claude work.

## Safest next action

Review one complete preview loop on the installed 0.10.0 build.
