# Handoff: cardiac dashboard type scale

- Updated: `2026-10-01 14:36 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer`
- Worktree: dirty shared tree; existing uncommitted Karoo visual work remains intact.

## Outcome

The LARGE GM Cardiac Drift field has a riding-distance typography pass installed as GritMap Karoo `0.10.19`/code 42. The two compact fields were deliberately unchanged. HR Cost now uses a large standalone numeric value, with `BPM/100W` and baseline comparison on the support line; title, valid time, recommendation, trust banner, chart title, axes, endpoint, and footer are all larger.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/CardiacDriftBitmapRenderer.kt`: large-dashboard typography and HR Cost hierarchy.
- `apps/karoo/app/build.gradle.kts`: version `0.10.19`, code 42.

## Verified

- Actual-size `480x624` preview inspected at `apps/karoo/app/build/reports/cardiac-drift-preview/large.png`.
- `./gradlew :app:testDebugUnitTest --tests com.gritmap.karoo.ui.CardiacDriftBitmapRendererTest assembleDebug`: passed with Java 17.
- `adb install -r .../app-debug.apk`: `Success`.
- Package inspection confirms `versionCode=42`, `versionName=0.10.19`.

## External state

- Device `00442GA241760203` has `0.10.19`/42 installed.

## Hazards and blockers

- Only the large renderer changed; the two top compact fields in the supplied screenshot intentionally retain their prior typography.
- Real-device screenshot review is still required because Karoo's page chrome reduces perceived field size relative to the raw bitmap preview.

## Next safe action

Refresh the large GM Cardiac Drift preview on the Karoo and assess the two metric values, chart endpoint, and axis labels from normal riding distance.
