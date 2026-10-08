# Handoff: cardiac dashboard legibility pass

- Updated: `2026-10-01 15:16 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer`
- Worktree: dirty shared tree; existing Karoo visual work remains uncommitted.

## Outcome

Physical-device review drove a second LARGE-only legibility pass, installed as GritMap Karoo `0.10.20`/code 43. Rather than allowing larger typography to collide, redundant copy was removed: HR Cost now shows a large number with only `BPM / 100 W`; the footer is shortened to confidence plus paired coverage; the chart baseline label is separated from its endpoint. All primary and chart text is larger. Compact fields remain unchanged.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/CardiacDriftBitmapRenderer.kt`: simplified large-card copy, larger type scale, shorter footer, non-overlapping chart annotations.
- `apps/karoo/app/build.gradle.kts`: version `0.10.20`, code 43.

## Verified

- Actual-size `480x624` preview inspected at `apps/karoo/app/build/reports/cardiac-drift-preview/large.png`.
- `./gradlew :app:testDebugUnitTest --tests com.gritmap.karoo.ui.CardiacDriftBitmapRendererTest assembleDebug`: passed with Java 17.
- ADB replacement install: `Success`; package reports `versionCode=43`, `versionName=0.10.20`.

## External state

- Device `00442GA241760203` has `0.10.20`/43 installed.

## Hazards and blockers

- The baseline HR-cost comparison was intentionally removed from the live card to preserve legibility; the drift value and efficiency graph still provide baseline-relative information.
- Real-device review remains authoritative because Karoo chrome changes perceived scale.

## Next safe action

Refresh the large GM Cardiac Drift preview and review only the large field from normal riding distance.
