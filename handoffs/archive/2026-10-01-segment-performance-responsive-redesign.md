# Handoff: responsive Segment Performance redesign

- Updated: `2026-10-01 17:14 PDT`
- Agent: `Codex`
- Branch: `main`
- Head at verification: `d2befcb Merge remote-tracking branch 'origin/main'`
- Worktree: shared and dirty with existing Karoo/phone work; this change remains uncommitted.

## Outcome

Rebuilt GM Segment Performance across large, medium, and small Karoo field shapes. The large
field now uses a clear result-first hierarchy, a fixed zero-centered gradient time bank with
an enlarged signed-seconds marker, projected-versus-goal supporting text, labeled horizontal
quarter-mile gain/loss bars, a deliberate pre-first-split state, and contained completion and
adherence cards. Compact sizes now use dedicated Canvas compositions instead of shrinking the
legacy generic prediction view.

## Changed

- `apps/karoo/app/src/main/java/com/gritmap/karoo/ui/SegmentPerformanceBitmapRenderer.kt`
- `apps/karoo/app/src/main/java/com/gritmap/karoo/karoo/CombinedDataTypes.kt`
- `apps/karoo/app/src/test/java/com/gritmap/karoo/ui/SegmentPerformanceBitmapRendererTest.kt`
- `apps/karoo/app/build.gradle.kts`: `0.10.22`, code 45.

## Verified

- Inspected actual-size large, pre-split, medium-wide, and small PNG renders under
  `apps/karoo/app/build/reports/segment-performance-preview/`.
- `./gradlew testDebugUnitTest assembleDebug`: passed, 87 actionable tasks.
- ADB replacement install succeeded on `00442GA241760203`.
- Installed package reports `versionCode=45`, `versionName=0.10.22`.

## Known hazard

- The separate Karoo transfer-listener connection bug documented in `handoffs/LATEST.md`
  remains unresolved by this visual-only milestone.

## Next safe action

Review LARGE, MEDIUM_WIDE, and SMALL GM Segment Performance previews on the physical Karoo and
capture screenshots for final typography/density tuning.
