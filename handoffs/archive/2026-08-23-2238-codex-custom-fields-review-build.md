# Handoff: Remaining GM graphical fields redesigned for device review

- Updated: `2026-08-23 22:38 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial pre-existing uncommitted Karoo work; this milestone modifies combined field presentation/rendering/layout/tests and adds a segment-performance bitmap renderer/test.

## Outcome

Pacing Coach, Power Balance, Cardiac Drift, and Segment Performance now have distinct responsive information hierarchies and visual roles. Every graphical field receives both Karoo row size and width/height shape, enabling short-wide, narrow-tall, and large layouts to diverge. The tested review APK is installed on the connected Karoo.

## Changed

- Shared graphical-field host now passes `KarooFieldLayout` as well as legacy row size.
- Pacing Coach: rounded one-word REST/HOLD/PUSH banner; responsive target sizing; actual/delta appears when space permits; next-zone instruction is reserved for expanded layouts; trend-aware coloring.
- Power Balance: stable 0-150% target scale; muted under/on/over zones; actual fill/dot; fixed target marker; ACTUAL/TARGET labels and power trend arrow.
- Cardiac Drift: negative/improving state, trend arrow, zero/3%/5% guides, threshold bands, trace endpoint marker, responsive title/status visibility.
- Segment Performance: new plan-versus-predicted timing visualization, independent segment-progress rail, timing delta appended to adherence, responsive graph/name/progress visibility.
- Added `SegmentPerformanceBitmapRenderer.kt` and its Robolectric test; expanded combined-field tests.

## Verified

- Focused combined/layout and three bitmap-renderer suites plus APK assembly: `BUILD SUCCESSFUL in 2m 8s`.
- Complete `:app:testDebugUnitTest`: `BUILD SUCCESSFUL in 42s`.

## External state

- Installed `apps/karoo/app/build/outputs/apk/debug/app-debug.apk` on connected Karoo; adb result `Success`.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- Device visual review is still required for text clipping, RemoteViews sizing, and semantic clarity at real Karoo field shapes.
- Preserve all unrelated/pre-existing uncommitted Karoo work.

## Next safe action

Review Pacing Coach first in smallest, short full-width, and large field shapes; capture screenshots before changing Power Balance.
