# Handoff: Responsive vertical virtual-pacer profile installed

- Updated: `2026-08-22 16:24 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: uncommitted Karoo work from multiple milestones; this milestone modifies shared UI state, coordinator, DAO, renderer, preview, and tests.

## Outcome

Larger Pacing Profile fields now use a vertical virtual-pacer design. The real rider remains a fixed white dot at center; a target-schedule dot appears red above when the target rider is ahead and green below when the real rider is ahead. Upcoming planned effort moves downward from the top. Below the rider, prescribed effort is retained on the left and actual execution is rendered on the right. Compact sizes retain the proven horizontal strip.

The live coordinator now consumes validated stored baseline zones rather than discarding them and generating a single 95%-FTP zone. Relize will therefore use its imported 270/280/300 W plan and 6:54 target.

## Changed

- `KarooDatabase.kt`: added ordered pacing-zone lookup by plan ID.
- `LiveSegmentCoordinator.kt`: candidate discovery loads baseline zones once off the 1 Hz path; stored zones/instructions/icons drive live UI, with provisional FTP planning only when no baseline exists.
- `LiveUiState.kt`: added framework-neutral elapsed-attempt seconds, target-progress fallback, and retained domain units.
- `LiveSegmentService.kt`: publishes elapsed attempt seconds during live metric enrichment.
- `KarooPreviewState.kt`: preview simulates changing schedule gap so the target rider moves ahead/behind.
- `LivePacingDataType.kt`: medium, medium-wide, narrow, and large layouts select the vertical pacer; small layouts retain the compact strip.
- `ProfileBitmapRenderer.kt`: added vertical plan road with:
  - fixed white rider marker,
  - red/green virtual target marker and meter gap,
  - planned watts left and actual watts right,
  - full-width upcoming Recover/Hold/Push bands,
  - completed prescribed bands on the left,
  - completed execution-quality bands on the right.
- Added/updated responsive and renderer tests for target rider direction, ±50 m schedule gaps, split plan/actual rendering, fixed rider marker, and large-layout selection.

## Verified

- Ran focused tests for `KarooFieldLayoutTest`, `KarooPreviewStateTest`, `ProfileBitmapRendererTest`, and `LiveMetricsTest`, plus `:app:assembleDebug`.
- Result: `BUILD SUCCESSFUL in 1m 22s`.
- The known non-fatal Android SDK XML v3/v4 warning remains.
- Installed the resulting APK successfully with `adb install -r`.

## External state

- Connected Karoo `00442GA241760203` has the new APK installed with app data and Relize segment/plan preserved.
- GritMap MainActivity was force-stopped and relaunched.
- Version metadata remains 0.8.1/versionCode 12.

## Hazards and blockers

- Target progress currently uses an explicit distance-proportional fallback: `elapsed / targetFinish × totalDistance`. It correctly supports the existing 6:54 package, but a terrain-aware phone plan should later provide cumulative time anchors for exact virtual-rider placement.
- The visual scale shows at least 150 m, or 12% of total segment distance, above and below the rider. Real-device screenshots are needed to tune marker separation, text sizing, and band density.
- Medium half-width fields now use the vertical design; this may be too dense and should be judged from the Karoo page editor.
- The focused affected suite passed; a completely unfiltered suite was not rerun after this milestone. Immediately prior, the full suite had only the documented flaky Needle timeout failure, which passed alone.
- The working tree contains substantial pre-existing uncommitted Karoo work; do not discard or wholesale-replace it.

## Next safe action

Start **Data-field demo**, open the Karoo page editor, and capture Pacing Profile at small, medium, medium-wide, narrow, and large sizes. Check whether the virtual target marker and left/right watt labels remain legible and whether medium should retain a simpler layout.

