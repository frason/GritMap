# Handoff: responsive secondary Karoo data fields

- Updated: `2026-09-30 23:13 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `cbd23a1 feat: phone-side pacing-plan generator + rider-profile transfer`
- Worktree: dirty shared tree; this milestone modified Karoo files already carrying prior uncommitted visual work. No unrelated phone files were changed.

## Outcome

GritMap Karoo `0.10.17`/code 40 is installed on device `00442GA241760203`. Three secondary fields now make deliberate small-layout choices instead of merely hiding or squeezing their large content:

- GM Segment Performance: smallest layout shows a dominant fixed `AHEAD`/`BEHIND` finish variance; small-wide adds a stable plan-versus-prediction timeline and progress rail.
- GM Power Balance: compact layouts now render the W′ reserve percentage and comparison to plan inside the battery graphic; redundant outer percentage text is removed, while small-wide retains the drain-rate context.
- GM Pacing Coach: smallest layouts combine action and target in one prominent line; small-wide additionally retains actual three-second power and delta.

## Changed

- `apps/karoo/app/build.gradle.kts`: version `0.10.17`, code 40.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/CombinedDataTypes.kt`: size-specific visibility, labels, finish variance, and renderer routing.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/SegmentPerformanceBitmapRenderer.kt`: compact plan/prediction timeline.
- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/WPrimeBalanceBitmapRenderer.kt`: informative compact reserve battery.
- `apps/karoo/app/src/main/res/layout/karoo_segment_performance_field.xml`: centered compact hierarchy.
- `apps/karoo/app/src/test/java/com/gritmap/karoo/karoo/CombinedDataTypesTest.kt` and `apps/karoo/app/src/test/java/com/gritmap/karoo/ui/SegmentPerformanceBitmapRendererTest.kt`: variance semantics and compact renderer coverage.

## Verified

- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ./gradlew testDebugUnitTest assembleDebug`: passed.
- Rebuilt after version bump with `./gradlew assembleDebug`: passed.
- `adb install -r app/build/outputs/apk/debug/app-debug.apk`: `Success` on the connected Karoo.

## External state

- Karoo device `00442GA241760203` now has debug build `0.10.17`/40.

## Hazards and blockers

- The shared Karoo worktree contains substantial earlier uncommitted pacing-profile, cardiac-drift, power-balance, and service work. Do not revert or overwrite whole files.
- Native numeric fields were intentionally unchanged; Karoo controls their responsive presentation.
- Actual Karoo screenshots are still needed to validate typography and clipping in the two compact grid shapes.

## Next safe action

Open GM Segment Performance, GM Power Balance, and GM Pacing Coach in smallest and short full-width preview slots on the Karoo and capture one screenshot of each shape before further styling.
