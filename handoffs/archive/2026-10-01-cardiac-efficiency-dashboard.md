# Handoff: cardiac efficiency dashboard

- Updated: `2026-10-01 14:01 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer`
- Worktree: dirty shared tree; this milestone modifies three existing Karoo files and builds on prior uncommitted visual work.

## Outcome

The large GM Cardiac Drift field is rebuilt around the approved efficiency concept. It now has exactly two headline cards (HR Drift and HR Cost), a power-steadiness trust banner, and a single normalized efficiency-index curve with baseline and green/amber/red threshold zones. The previous three small cards and competing Power/HR lines are removed from the large presentation. Compact SMALL and SMALL_WIDE renderers are unchanged.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/CardiacDriftBitmapRenderer.kt`: new large dashboard hierarchy, BPM/100W HR-cost derivation, normalized efficiency graph (`100 - drift`), threshold bands, baseline, endpoint, and trust state.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/ui/CardiacDriftBitmapRendererTest.kt`: asserts the primary blue and green visual signals and continues writing actual-size previews.
- `apps/karoo/app/build.gradle.kts`: version `0.10.18`, code 41.

## Verified

- Actual-size `480x624` render inspected at `apps/karoo/app/build/reports/cardiac-drift-preview/large.png`; no clipping after chart/footer adjustment.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew testDebugUnitTest assembleDebug`: passed, 87 actionable tasks.
- Device installation did not run: ADB reported no connected devices.

## External state

- Debug APK `0.10.18`/41 is built at `apps/karoo/app/build/outputs/apk/debug/app-debug.apk`.
- No device state changed.

## Hazards and blockers

- HR Cost is derived as `100 / current W-per-BPM`, expressed as BPM/100W. Its comparison to baseline is derived from the current smoothed drift, so it intentionally shares the tracker's existing smoothing and baseline rather than creating a second physiological model.
- The renderer identifies variable power and changes the trust banner, but it still plots the efficiency curve; riders must treat a variable-power trace as lower confidence.
- Real-device daylight legibility still needs a Karoo screenshot.

## Next safe action

Connect the Karoo, install `0.10.18`, and capture the large GM Cardiac Drift preview in both light and dark Karoo themes.
