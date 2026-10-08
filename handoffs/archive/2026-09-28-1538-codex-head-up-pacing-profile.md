# Handoff: Large Pacing Profile rebuilt as head-up route plus elevation

- Updated: `2026-09-28 15:38 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `71ef851 docs: hand off attempt-persistence and reverse-descent fixes`
- Worktree: 0.8.3–0.8.6 Karoo changes uncommitted; unrelated iOS work preserved.

## Outcome

Installed 0.8.6 with a new large-only Pacing Profile: real segment geography in a rider-forward view, timed pacer, distance gap, color-coded target/actual watt cards, and retained full elevation profile.

## Changed

- Added `RouteSample` to live UI state and populated it from segment reference points.
- Added large-only `renderFirstPersonRoute` Canvas renderer.
- Target card follows REST/HOLD/PUSH color; actual card is green/amber/red by execution delta.
- Added representative preview/demo route geometry.
- Hid the legacy large footer and increased graphic allocation.
- Bumped to 0.8.6/code17.

## Verified

- Clean build succeeded.
- 106 JVM tests passed.
- Critical DEX class definitions verified.
- On-device install succeeded with no crash and 0.0% CPU in three samples.

## External state

- Karoo runs 0.8.6; data preserved by replacement install.
- New field is visible through the large full-width picker preview.

## Hazards and blockers

- Needs real-device screenshot review.
- Projection should be visually checked on switchbacks.
- Work is uncommitted; preserve unrelated iOS change.

## Next safe action

Capture the large full-width Pacing Profile preview on Karoo and tune proportions from that evidence.
