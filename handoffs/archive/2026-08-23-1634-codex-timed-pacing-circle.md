# Handoff: Pacing circle displays time ahead or behind

- Updated: `2026-08-23 16:34 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `7b6ea68 docs: hand off segment-definition increment completion (closes #6, #7)`
- Worktree: substantial uncommitted Karoo work; this increment modifies profile renderer and focused tests.

## Outcome

The virtual pacer is a timed red/green circular badge. It displays signed seconds (`+12s`, `-8s`, `0s`) and compact minutes (`-1:12`). It remains separate from the white rider at all gaps and appears in compact and large layouts.

## Changed

- `ProfileBitmapRenderer.kt`: schedule-time calculation, formatting, timed pacer circles, guaranteed marker separation.
- `ProfileBitmapRendererTest.kt`: time calculation/formatting and exact-pace separation tests.

## Verified

- Focused renderer/live-demo tests plus assembly: `BUILD SUCCESSFUL in 56s`.
- APK installed on Karoo `00442GA241760203`: `Success`.

## External state

- Updated APK is installed on the connected Karoo.
- Version remains 0.8.1/versionCode 12.

## Hazards and blockers

- Schedule time uses the current distance-proportional target fallback until terrain-aware plan time anchors arrive.
- Physical display validation is required for text size inside compact pacer circles.
- Preserve existing uncommitted Karoo work.

## Next safe action

Run GM Demo Climb and inspect the red/green target badge across close and ±120 m phases, especially signed time legibility in compact cards.
