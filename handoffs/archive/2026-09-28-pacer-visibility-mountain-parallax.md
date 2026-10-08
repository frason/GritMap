# Handoff: Conditional pacer and mountain parallax

- Updated: `2026-09-28 21:10 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `85026b2 docs: hand off post-MVP backlog cleared (#60-#63)`
- Worktree: shared dirty worktree; this increment changed the Karoo renderer, app version, and handoffs while preserving unrelated changes

## Outcome

GritMap Karoo 0.10.4/code27 is installed. Contour labels form a fixed left column, an
ahead rider no longer sees an unnecessary target marker on the 1P road, and the smaller
horizon mountains respond subtly to route direction.

## Changed

- Fixed contour label x-position at the left margin.
- Limited the large 1P road's target marker to `targetIsAhead`; the elevation overview
  continues to show both rider and target regardless of gap direction.
- Reduced mountain height and horizon depth, and added opposite-direction parallax derived
  from the distant projected road offset.
- Bumped version to 0.10.4/code27.

## Verified

- Focused `ProfileBitmapRendererTest`: passed; contact sheet visually inspected across
  behind, near-target, and ahead states.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.4/code27.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.
- Parallax is intentionally subtle and frame-derived; physical-device preview is the best
  validation of whether its magnitude should be increased.

## Next safe action

Watch a full preview loop on the Karoo and decide whether the mountain parallax should stay
subtle or be made more pronounced.
