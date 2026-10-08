# Handoff: Fixed rider anchor and stronger mountain parallax

- Updated: `2026-09-28 21:40 PDT`
- Agent: `Codex`
- Branch: `main`
- Head: `85026b2 docs: hand off post-MVP backlog cleared (#60-#63)`
- Worktree: shared dirty worktree; this increment changed the Karoo renderer, app version, and handoffs while preserving unrelated edits

## Outcome

GritMap Karoo 0.10.6/code29 is installed. The YOU marker no longer jumps vertically with
pace state, and mountain motion is now visible as two-layer parallax.

## Changed

- Replaced conditional rider Y positioning with a fixed `mapBottom - 48f` anchor.
- Derived horizon movement from the average lateral offset of the distant third of the
  projected road, increased its scale, and bounded it to 14% of field width.
- Rear ridge moves at 42% of the foreground ridge offset to produce actual layer parallax.
- Bumped version to 0.10.6/code29.

## Verified

- Focused `ProfileBitmapRendererTest`: passed; contact sheet confirms identical rider Y
  anchors in ahead/behind states and distinct ridge positions.
- Full `:app:testDebugUnitTest :app:assembleDebug`: passed.

## External state

- Replacement-installed APK on Karoo `00442GA241760203`; package reports 0.10.6/code29.

## Hazards and blockers

- Work remains uncommitted in the shared dirty worktree.

## Next safe action

Watch the preview loop on the Karoo and validate that the stronger parallax reads clearly
without distracting from pacing guidance.
